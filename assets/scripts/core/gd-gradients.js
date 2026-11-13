// GradientTriggerObject / GJBaseGameLayer::triggerGradientCommand and
// updateGradientLayers, checked against the supplied Steam executable at
// 3274b0 / 327940. Property 456 only controls the editor preview.
(function () {
  "use strict";
  const SCREEN_LAYERS = new Set([1, 2, 13, 14, 15]);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  class GDGradientState {
    constructor(level) { this.level = level; this.reset(); }
    reset() { this.active = new Map(); this.items = new Map(); this.arrivals = new Map(); this.nextArrival = 0; }
    trigger(trig) {
      const r = trig.raw;
      if (r[508] === "1") { this.active.clear(); this.arrivals.clear(); return; }
      const id = Math.min(999, Number(r[209]) || 0);
      if (r[208] === "1") this.active.delete(id);
      else {
        const previous = this.active.get(id);
        if (!this.arrivals.has(id) || (previous && Number(previous.raw[202]) !== Number(r[202]))) this.arrivals.set(id, this.nextArrival++);
        this.active.set(id, trig);
      }
    }
    capture() { return structuredClone({ active: [...this.active], arrivals: [...this.arrivals], nextArrival: this.nextArrival }); }
    restore(data) {
      const saved = structuredClone(data);
      this.active = new Map(Array.isArray(saved) ? saved : saved.active);
      this.arrivals = new Map(Array.isArray(saved) ? [...this.active.keys()].map((id, i) => [id, i]) : saved.arrivals);
      this.nextArrival = Array.isArray(saved) ? this.arrivals.size : saved.nextArrival;
      this.items.clear();
    }
    stopGroup(group, matches = null) {
      for (const [id, trig] of this.active) if (matches ? matches(trig) : trig.groups?.includes(group)) this.active.delete(id);
    }
    controlGroup(group, command, matches = null) {
      // Native controlGradientTrigger removes on Stop/Pause and reruns
      // the authored command on Resume (there is no gradient timer).
      if (command !== 2) { this.stopGroup(group, matches); return; }
      for (const trig of this.level._gradientTriggers || []) if (matches ? matches(trig) : trig.groups?.includes(group)) this.trigger(trig);
    }
    target(id) {
      const r = this.level.gdRenderer;
      // updateGradientLayers uses tryGetGroupParent (native 0x32c200).
      // An arbitrary member of a multi-object group is not a valid target.
      const o = this.level._moveGroupParent(Number(id));
      if (!o) return null;
      const p = r.livePosition(o);
      // Native 328243..3282ac reads getRealPosition for the four corners.
      // Area-transformed targets can be far from their stored positions.
      const area = this.level.areaState;
      if (area?.active) {
        const effect = this._areaTarget || (this._areaTarget = {});
        if (area.forObject(o, p.x, p.y, effect)) { p.x += effect.dx; p.y += effect.dy; }
      }
      return p;
    }
    draw(renderer) {
      const scene = this.level._scene;
      const width = scene.scale?.width || 1138, height = scene.scale?.height || 640;
      const camera = renderer.camera, cm = renderer.colorManager;
      for (const [id, trig] of this.active) {
        const raw = trig.raw, node = this.level.gdObjects[trig.uid];
        if (!node || !node.enabled || node.removed || node.groups.some(g => renderer.groupState && !renderer.groupState.enabled(g))) continue;
        const layer = clamp(Number(raw[202]) || 0, 0, 15), screen = SCREEN_LAYERS.has(layer);
        const mode = clamp(Number(raw[174]) || 0, 0, 3);
        const c1 = renderer._colorForMode(node, Number(raw[21]) || 0, true, [0, 0, 0]);
        const c2 = renderer._colorForMode(node, Number(raw[22]) || 0, false, [0, 0, 0]);
        const opacity = renderer._groupOpacity(node);
        const a1 = Math.trunc(clamp((raw[21] ? cm.getOpacity(Number(raw[21])) : 255) * opacity, 0, 255)) / 255;
        const a2 = Math.trunc(clamp((raw[22] ? cm.getOpacity(Number(raw[22])) : 255) * opacity, 0, 255)) / 255;
        if ((!a1 && !a2) || (mode === 1 && !c1.some(Boolean) && !c2.some(Boolean))) continue;
        // Native screen layers use viewport bounds (+20 points). Other layers
        // use world bounds, expanded to cover the rotated camera as well.
        let left = screen ? -20 : camera.x - 20, right = screen ? width / 2 + 20 : camera.x + camera.w + 20;
        let bottom = screen ? -20 : camera.y - 20, top = screen ? height / 2 + 20 : camera.y + camera.h + 20;
        const targets = [203, 204, 205, 206].map(key => this.target(raw[key]));
        const project = p => {
          if (!screen) return p;
          const q = this.level.cameraState?.project(p.x, p.y);
          return q ? { x: q[0] * width / 2, y: q[1] * height / 2 }
            : { x: p.x - camera.screenX / 2, y: p.y - (camera.screenY - 180) / 2 };
        };
        const points = targets.map(p => p && project(p));
        let corners;
        if (raw[207] === "1") {
          // BL, BR, TL, TR. Missing targets retain the viewport corner:
          // updateGradientLayers initializes all four before applying targets.
          const [bl, br, tl, tr] = points;
          corners = [tl || { x: left, y: top }, tr || { x: right, y: top },
            bl || { x: left, y: bottom }, br || { x: right, y: bottom }];
        } else {
          if (points[0]) top = points[0].y;
          if (points[1]) bottom = points[1].y;
          if (points[2]) left = points[2].x;
          if (points[3]) right = points[3].x;
          if (right <= left || top <= bottom) continue;
          corners = [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }];
        }
        const angle = -(node.rot + node.rotOff) * Math.PI / 180;
        const x = Math.cos(angle), y = Math.sin(angle), norm = Math.abs(x) + Math.abs(y);
        // CCLayerGradient's compressed interpolation (default enabled).
        const values = [(1 + (x - y) / norm) / 2, (1 + (-x - y) / norm) / 2,
          (1 + (x + y) / norm) / 2, (1 + (-x + y) / norm) / 2];
        let item = this.items.get(id);
        if (!item) {
          const slot = renderer.frames.textureSlot("__WHITE");
          const R = window.GDRender;
          item = R.makeItem(R.makePart({ info: R.makeInfo({ key: "__WHITE", slot, u0: 0.5, v0: 0.5, u1: 0.5, v1: 0.5, w: 1, h: 1 }) }));
          item.m = [1, 0, 0, 1, 0, 0]; item.color = [255, 255, 255]; item.opacity = 1;
          this.items.set(id, item);
        }
        item.positions = corners.map(p => screen ? [p.x * 2, height - p.y * 2] : [p.x, p.y]);
        item.colors = values.map(t => {
          const a = clamp(a2 + (a1 - a2) * t, 0, 1);
          const p1 = mode >= 2 ? a1 : 1, p2 = mode >= 2 ? a2 : 1;
          return [0, 1, 2].map(i => Math.trunc(clamp(c2[i] * p2 + (c1[i] * p1 - c2[i] * p2) * t, 0, 255))).concat(Math.trunc(a * 255));
        });
        item.screen = screen; item.gradientBlend = mode;
        item.overlay = layer === 15;
        const order = clamp(node.zOrder, -5, 5);
        // A gradient is a separate CCLayerGradient, added when its trigger
        // first runs. Its arrival order is independent of the trigger
        // object's section/y order (GDRenderer.finalize). Using that order
        // can put an outer dark face over an inner face in custom geometry.
        item.sortKey = order * 1048576 + this.arrivals.get(id);
        item.above = window.GDRender.gradientZ[layer] + order >= 59;
        renderer.pushItem(window.GDRender.gradientBatch[layer], item);
      }
    }
  }
  window.GDGradientState = GDGradientState;
})();
