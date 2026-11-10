// Camera trigger state and a world camera. HUD objects retain their own camera.
// Property ids: supplied Geode bindings. Behaviour: RobTop Editor Guide 118-120.
(function () {
  "use strict";
  const IDS = new Set([1913, 1914, 1916, 2015, 2062, 2925]);
  class GDCameraState {
    constructor(level) { this.level = level; this.reset(); }
    // GJBaseGameLayer::updateCamera finds its target with tryGetGroupParent:
    // the group's parent object, else its only object, else no target.
    targetPoint(group) {
      const obj = this.level._moveGroupParent ? this.level._moveGroupParent(group) : null;
      if (!obj) return null;
      const renderer = this.level.gdRenderer;
      return renderer ? renderer.livePosition(obj) : { x: obj.x + obj.offX, y: obj.y + obj.offY };
    }
    reset() {
      this.values = { zoom: 1, rotation: 0, offsetX: 0, offsetY: 0, staticX: 0, staticY: 0 };
      this.targetRotation = 0;
      this.tweens = []; this.targets = { x: null, y: null }; this.edges = {};
      this.freeMode = false; this.freeEasing = 10; this.freePadding = 0.5; this.disableGridSnap = false;
      this.jumpX = null;
      this.velocity = { x: 0, y: 0 }; this.lastPosition = null;
      this.follow = { leadX: 150, leadY: 0, lastX: null, lastY: null, crossX: null, frame: -1 };
    }
    settleStart() {
      // Loading a Start Pos evaluates its existing camera commands before
      // the first displayed frame; it must not replay their entry animation.
      const remaining=Math.max(0,...this.tweens.map(t=>t.duration-t.elapsed));
      this.step(remaining+1/240);
      this.velocity={x:0,y:0};this.lastPosition=null;this.jumpX=null;
      delete this.follow.turnX;delete this.follow.turnY;
    }
    setMode(raw) {
      const wasFree = this.freeMode;
      this.freeMode = raw[111] === "1"; this.disableGridSnap = raw[370] === "1";
      // A same-mode portal still updates the camera/ground state; its
      // player-mode method can return early because the mode is active.
      const level = this.level, floor = level._flyFloorY, ceil = level._flyCeilingY;
      if (wasFree !== this.freeMode && level._flyGroundActive && Number.isFinite(floor) && Number.isFinite(ceil))
        level.setFlyMode?.(true, (floor + ceil) / 2, ceil - floor, !!level._flyVisualOnly);
      if (raw[112] === "1") {
        this.freeEasing = Math.max(0, Number(raw[113] ?? 10));
        this.freePadding = Math.max(0, Math.min(1, Number(raw[114] ?? 0.5)));
      }
    }
    portalMode(collider) {
      if (collider?._eeLevelObject?._raw) this.setMode(collider._eeLevelObject._raw);
    }
    freeDeadZone(height, zoom = this.values.zoom) {
      // updateCamera 346390: inset = 30 + (halfWin - 32) * padding
      // in GD points, then divide the remaining half-window by zoom.
      const half = height / 4;
      return Math.max(0, (half - (30 + (half - 32) * this.freePadding)) * 2 / Math.max(.01, zoom));
    }
    freeFollowAmount(frameDelta, snap = false) {
      // updateCamera 3478b8: divide the remaining distance by easing/dt.
      return snap || this.freeEasing <= 1 ? 1 : Math.min(1, Math.max(0, frameDelta) / this.freeEasing);
    }
    followStep(frameDelta) {
      const s = this.level._scene, f = this.follow, u = this.level.gameplayState?.u || { x: 1, y: 0 };
      const width = s.scale?.width || 1138, z = Math.max(.01, this.values.zoom);
      const px = s._playerWorldX, py = s._state.y, sideways = Math.abs(u.y) > .5;
      f.previousX = s._cameraX; f.previousY = s._cameraY;
      f.axisChanged = typeof f.sideways === 'boolean' && sideways !== f.sideways;
      // The automatic transition is an offset added after normal following.
      // Feed its unshifted position into the next tick, avoiding feedback of
      // the previous offset into the lateral dead zone.
      for (const axis of ['X', 'Y']) {
        const property = '_camera' + axis;
        if (Number.isFinite(f['base' + axis])) {
          // A teleport/out-of-window snap can replace the camera during
          // collision handling. Keep that explicit change as the new base.
          if (s[property] === f['output' + axis]) s[property] = f['base' + axis];
          else delete f['turn' + axis];
        }
      }
      // Native 346551 keeps the lateral viewport edge when zoom changes;
      // the centre therefore moves by the change in its half-window size.
      // Travel following below replaces that axis directly with player+lead.
      if (!this.freeMode && f.zoom && f.zoom !== z && f.sideways === sideways) {
        const change = 1 / z - 1 / f.zoom;
        if (!sideways && (!this.targets.y || this.targets.y.exit)) s._cameraY += (s.scale?.height || 640) / 2 * change;
        else if (sideways && (!this.targets.x || this.targets.x.exit) && f.crossX !== null) f.crossX += width / 2 * change;
      }
      // updateCamera 3467d4..346a32: the 75-point lead belongs to the
      // travel axis. A new/reversed lead advances by at most that axis's
      // player displacement; changing direction must not snap the camera.
      const approach = (value, target, step) => value < target ? Math.min(target, value + step) : Math.max(target, value - step);
      // 34674e: a static axis bypasses automatic lead. Dash's first spider
      // turn takes place under a static camera; retaining its downward lead
      // made the later mini-cube turn jump 90 GD points below its real target.
      // A settled lead scales with a new zoom immediately (3467d4), while
      // direction changes still transfer it by the player's displacement.
      if (f.zoom && f.zoom !== z && f.sideways === sideways) {
        if (sideways && !this.targets.y && f.leadY === u.y * 150 / f.zoom) f.leadY = u.y * 150 / z;
        else if (!sideways && !this.targets.x && f.leadX === u.x * 150 / f.zoom) f.leadX = u.x * 150 / z;
      }
      if (sideways && (!this.targets.y || this.targets.y.exit)) f.leadY = this.targets.y?.exit ? u.y * 150 / z : approach(f.leadY, u.y * 150 / z, f.lastY === null ? 0 : Math.abs(py - f.lastY));
      else if (!sideways && (!this.targets.x || this.targets.x.exit)) f.leadX = this.targets.x?.exit ? u.x * 150 / z : approach(f.leadX, u.x * 150 / z, f.lastX === null ? 0 : Math.abs(px - f.lastX));
      const floor = (s._cameraFloorX ?? -Infinity) + width / 2 * (1 / z - 1) - this.values.offsetX;
      if (sideways) {
        // The old horizontal camera centre becomes the lateral centre.
        // Native cube/robot follow keeps 70/40-point margins, swapping
        // them under flipped gravity, and eases by fixed-frame delta / 10.
        f.crossX ??= s._cameraX + width / 2;
        const high = s._state.gravityFlipped ? 80 : 140, low = s._state.gravityFlipped ? 140 : 80;
        let target = f.crossX;
        if (px > target + high) target = px - high;
        else if (px < target - low) target = px + low;
        f.crossX += (target - f.crossX) * Math.min(1, Math.max(0, frameDelta) / 10);
        f.cameraX = Math.max(f.crossX - width / 2, floor);
        f.cameraY = Math.max(0, py + f.leadY - 140);
      } else {
        f.crossX = null;
        f.cameraX = Math.max(px + f.leadX - width / 2, floor);
      }
      f.sideways = sideways; f.zoom = z; f.frame = s._physicsFrame; f.lastX = px; f.lastY = py;
    }
    finishFollow(frameDelta) {
      const s = this.level._scene, f = this.follow;
      for (const axis of ['x', 'y']) {
        const property = axis === 'x' ? '_cameraX' : '_cameraY';
        const base = axis === 'x' ? 'baseX' : 'baseY';
        const previous = axis === 'x' ? f.previousX : f.previousY;
        const name = axis === 'x' ? 'turnX' : 'turnY';
        // 3460f5 / 347a30: an axis change creates an automatic offset,
        // fading from the previous view to the new follow in one second,
        // with native EaseInOut(2). Static camera axes keep their own tween.
        if (f.axisChanged && !this.targets[axis]) f[name] = { from: previous - s[property], age: 0 };
        else if (f[name]) f[name].age += Math.max(0, frameDelta) / 60;
        f[base] = s[property];
        const turn = f[name];
        if (turn) {
          const t = Math.min(1, turn.age), eased = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
          s[property] += turn.from * (1 - eased);
          if (t >= 1) delete f[name];
        }
        f[axis === 'x' ? 'outputX' : 'outputY'] = s[property];
      }
      f.axisChanged = false;
    }
    animate(trig, property, target, duration = Number(trig.raw[10]) || 0) {
      this.tweens = this.tweens.filter(t => t.property !== property);
      if (!(duration > 0)) { this.values[property] = target; return; }
      this.tweens.push({ trig, property, from: this.values[property], target, elapsed: 0, duration,
        easing: Number(trig.raw[30]) || 0, rate: Number(trig.raw[85] ?? 2) });
    }
    normalPoint() {
      const s = this.level._scene, width = s.scale?.width || 1138, height = s.scale?.height || 640;
      return { x: ((s._cameraX || 0) + width / 2) / 2, y: (460 + (s._cameraY || 0) - height / 2) / 2 };
    }
    staticCamera(trig, mode) {
      const r = trig.raw, exit = r[110] === "1", group = Number(r[71] ?? r[51]) || 0;
      const destination = exit ? this.normalPoint() : this.targetPoint(group);
      if (!destination) return;
      const s = this.level._scene, v = this.values;
      const current = this.view(s.scale?.width || 1138, s.scale?.height || 640, s._cameraX || 0, s._cameraY || 0);
      const from = { x: (current.x - v.offsetX) / 2, y: (current.y - v.offsetY) / 2 };
      if (exit) {
        // Native static-camera exits animate an offset from normal following.
        // Interpolating an absolute point toward the moving player leaves the
        // camera far behind during long exits (Dash's ball / swing entrance).
        // On the lateral axis, normal following resumes at the visible
        // static position. A hidden follow position must not pull the view
        // back toward where the player travelled during the static shot.
        const sideways = Math.abs(this.level.gameplayState?.u?.y || 0) > .5;
        const u = this.level.gameplayState?.u || { x: 1, y: 0 }, lead = 150 / Math.max(.01, v.zoom);
        if (!sideways && mode !== 2 && this.targets.x) {
          const width = s.scale?.width || 1138;
          const floor = (s._cameraFloorX ?? -Infinity) + width / 2 * (1 / Math.max(.01, v.zoom) - 1) - v.offsetX;
          s._cameraX = Math.max(s._playerWorldX + u.x * lead - width / 2, floor); this.follow.leadX = u.x * lead;
        }
        if (sideways && mode !== 1 && this.targets.y) {
          s._cameraY = Math.max(0, s._state.y + u.y * lead - 140); this.follow.leadY = u.y * lead;
        }
        if (sideways && mode !== 2 && this.targets.x) s._cameraX = from.x * 2 - (s.scale?.width || 1138) / 2;
        if (!sideways && mode !== 1 && this.targets.y) s._cameraY = from.y * 2 - 460 + (s.scale?.height || 640) / 2;
        const normal = this.normalPoint();
        from.x -= normal.x; from.y -= normal.y;
      }
      const duration = exit && r[465] === "1" ? 0 : Math.max(0, Number(r[10]) || 0);
      for (const axis of ["x", "y"]) {
        if ((axis === "x" && mode === 2) || (axis === "y" && mode === 1)) continue;
        const property = axis === "x" ? "staticX" : "staticY";
        this.tweens = this.tweens.filter(t => t.property !== property);
        if (exit && (!(duration > 0) || !v[property])) {
          this.targets[axis] = null; v[property] = 0; continue;
        }
        const follow = !exit && r[212] === "1";
        const start = duration > 0 || follow ? from[axis] : destination[axis];
        this.targets[axis] = { group, follow, exit, destination: { ...destination }, point: { ...from, [axis]: start },
          unfiltered: start, easing: Math.max(1, Number(r[213]) || 1), progress: duration > 0 ? 0 : 1, transitioning: duration > 0 };
        v[property] = 1;
        if (!(duration > 0)) continue;
        // updateStaticCameraPos 3491cc / updateCamera 3470b2:
        // cubic P1 = start + clamped camera velocity * duration / 3;
        // P2 = destination + (P1 - destination) * velocity modifier.
        const velocity = Math.max(-10000, Math.min(10000, this.velocity[axis]));
        const tween = { trig, property, axis, from: from[axis], control: from[axis] + velocity * duration / 3,
          smooth: r[453] === "1", modifier: Number(r[454]) || 0, duration, elapsed: 0, previous: 0,
          bornFrame: exit && Number.isFinite(s._physicsFrame) ? s._physicsFrame : null,
          easing: Number(r[30]) || 0, rate: Number(r[85] ?? 2) };
        this.targets[axis].curve = tween;
        this.tweens.push(tween);
      }
    }
    smoothPoint(curve, end, progress) {
      if (progress >= 1) return end;
      const u = 1 - progress, control2 = end + (curve.control - end) * curve.modifier;
      return u * u * u * curve.from + 3 * u * u * progress * curve.control +
        3 * u * progress * progress * control2 + progress * progress * progress * end;
    }
    trigger(trig) {
      const r = trig.raw, mode = Number(r[101]) || 0;
      // The earliest instant camera change this frame (see Level.stepCameraLockMoves).
      const instant = trig.id === 2062 || !(Number(r[10]) > 0) || (trig.id === 1914 && r[110] === "1" && r[465] === "1");
      if (instant && trig.id !== 2925) {
        const x = trig.spawnTriggered || trig.touchTriggered ? -Infinity : Number(trig.x) || 0;
        this.jumpX = Math.min(this.jumpX ?? Infinity, x);
      }
      if (trig.id === 2925) {
        this.setMode(r);
      } else if (trig.id === 1913) {
        const zoom = Number(r[371] ?? r[109] ?? 1);
        // GJBaseGameLayer::updateZoom 33eac0: reset nonpositive values to
        // one, then clamp the destination before creating the tween.
        if (Number.isFinite(zoom)) this.animate(trig, "zoom", Math.max(.4, Math.min(3, zoom > 0 ? zoom : 1)));
      } else if (trig.id === 1916) {
        if (mode !== 2) this.animate(trig, "offsetX", (Number(r[28]) || 0) * 2);
        if (mode !== 1) this.animate(trig, "offsetY", (Number(r[29]) || 0) * 2);
      } else if (trig.id === 2015) {
        let target = (Number(r[68]) || 0) + (Number(r[69]) || 0) * 360;
        // Native updateScreenRotation (Steam 33ec40): Add reads the previous
        // destination, not the in-flight angle. Convert normalizes BOTH angles
        // independently to [-180,180]. Keeping 356 instead of -4 makes Dash's
        // next absolute-zero command spin a whole turn at the spider section.
        if (r[70] === "1") target += this.targetRotation;
        if (r[394] === "1") {
          const convert = angle => { angle %= 360; return angle > 180 ? angle - 360 : angle < -180 ? angle + 360 : angle; };
          this.values.rotation = convert(this.values.rotation);
          target = convert(target);
        }
        this.targetRotation = target;
        this.animate(trig, "rotation", target);
      } else if (trig.id === 1914) {
        this.staticCamera(trig, mode);
      } else if (trig.id === 2062) {
        const direction = Number(r[164]) || 0, group = Number(r[51]) || 0;
        if (direction) { if (group) this.edges[direction] = group; else delete this.edges[direction]; }
      }
    }
    step(dt) {
      for (let i = 0; i < this.tweens.length;) {
        const t = this.tweens[i];
        if (t.paused) { i++; continue; }
        // Native static-camera exits initialize at zero on their first tick.
        // Entry, zoom and offset property tweens advance immediately.
        if (!t.axis || t.bornFrame == null || t.bornFrame !== this.level._scene._physicsFrame) t.elapsed += dt;
        const progress = Math.min(1, t.elapsed / t.duration);
        const value = Easing.sample(t.easing, t.rate, progress);
        if (t.axis) {
          const target = this.targets[t.axis];
          const destination = target.exit ? { x: 0, y: 0 } : target.follow ? this.targetPoint(target.group) : target.destination;
          if (destination) {
            const end = destination[t.axis];
            if (t.smooth) {
              target.unfiltered = this.smoothPoint(t, end, value);
            } else if (!target.follow) {
              // Ordinary static moves tween the position itself, retaining
              // elastic/back overshoot. Follow/Smooth tween a native phase.
              target.unfiltered = t.from + (end - t.from) * value;
            } else if (value >= 1) {
              target.unfiltered = end;
            } else {
              // Native following transitions advance from the previous eased
              // progress, so a moving target does not restart the interpolation.
              const amount = t.previous < 1 ? (value - t.previous) / (1 - t.previous) : 1;
              target.unfiltered += (end - target.unfiltered) * amount;
              t.previous = value;
            }
          }
          target.progress = value;
          if (progress === 1) {
            target.transitioning = false;
            if (target.exit) { this.targets[t.axis] = null; this.values[t.property] = 0; }
          }
        } else this.values[t.property] = t.from + (t.target - t.from) * value;
        if (progress === 1) this.tweens.splice(i, 1); else i++;
      }
      for (const axis of ["x", "y"]) {
        const target = this.targets[axis];
        if (!target) continue;
        // Stop freezes the progress tween, not the native camera update.
        // A followed Bezier endpoint still moves at that frozen progress.
        if (target.transitioning && target.curve?.smooth && !this.tweens.includes(target.curve)) {
          const destination = target.exit ? { x: 0, y: 0 } : target.follow ? this.targetPoint(target.group) : target.destination;
          if (destination) target.unfiltered = this.smoothPoint(target.curve, destination[axis], target.progress);
        }
        if (!target.transitioning && target.follow) {
          const point = this.targetPoint(target.group);
          if (point) target.unfiltered = point[axis];
        }
        // 347292 scales follow ease by transition progress; 34787f uses
        // a linear frame-delta / ease fraction, with ease <= 1 snapping.
        const ease = target.follow ? Math.max(1, target.progress * target.easing) : 1;
        const amount = ease <= 1 ? 1 : Math.min(1, Math.max(0, dt) * 60 / ease);
        target.point[axis] += (target.unfiltered - target.point[axis]) * amount;
      }
      const position = this.cameraPosition();
      if (this.lastPosition && dt > 0) {
        // 348268 multiplies each fixed-tick displacement by 240, including
        // slow TimeWarp ticks. Dividing by warped dt exaggerates the next
        // Smooth Velocity handle during slow motion. Web units are 2x GD.
        this.velocity.x = (position.x - this.lastPosition.x) * 120;
        this.velocity.y = (position.y - this.lastPosition.y) * 120;
      }
      this.lastPosition = { x: position.x, y: position.y };
    }
    view(width, height, cameraX, cameraY) {
      const v = this.values, zoom = Math.max(0.01, v.zoom);
      const normal = { x: cameraX + width / 2, y: 460 + cameraY - height / 2 };
      let x = normal.x, y = normal.y;
      if (this.targets.x) x += (this.targets.x.point.x * 2 - (this.targets.x.exit ? 0 : x)) * v.staticX;
      if (this.targets.y) y += (this.targets.y.point.y * 2 - (this.targets.y.exit ? 0 : y)) * v.staticY;
      x += v.offsetX; y += v.offsetY;
      y = Math.min(y, this.topCentre(height, zoom));
      const rotation = v.rotation * Math.PI / 180, c = Math.cos(rotation), s = Math.sin(rotation);
      const halfW = (Math.abs(c) * width + Math.abs(s) * height) / (2 * zoom);
      const halfH = (Math.abs(s) * width + Math.abs(c) * height) / (2 * zoom);
      for (const [direction, id] of Object.entries(this.edges)) {
        const point = this.targetPoint(id);
        if (!point) continue;
        if (+direction === 1) x = Math.max(x, point.x * 2 + width / (2 * zoom));
        else if (+direction === 2) x = Math.min(x, point.x * 2 - width / (2 * zoom));
        else if (+direction === 3) y = Math.min(y, point.y * 2 - height / (2 * zoom));
        else if (+direction === 4) y = Math.max(y, point.y * 2 + height / (2 * zoom));
      }
      // updateCamera 345eba..345f27, 34785a..34796b: the lower
      // level boundary wins when a top edge lies below one viewport.
      // Native Y=0 is web Y=-180. Troll's top helper is at native Y=105;
      // treating it as an unrestricted top edge moved the view underground.
      y = Math.max(y, height / (2 * zoom) - 180);
      return { x, y, zoom, rotation, scrollX: x - normal.x, scrollY: normal.y - y,
        minX: (x - halfW) / 2, maxX: (x + halfW) / 2, minY: (y - halfH) / 2, maxY: (y + halfH) / 2 };
    }
    constrainFollowY(cameraY, height = 640) {
      const zoom = Math.max(.01, this.values.zoom), half = height / (2 * zoom);
      let y = 460 + cameraY - height / 2 + this.values.offsetY;
      y = Math.min(y, this.topCentre(height, zoom));
      const top = this.edges[3] && this.targetPoint(this.edges[3]);
      const bottom = this.edges[4] && this.targetPoint(this.edges[4]);
      if (top) y = Math.min(y, top.y * 2 - half);
      if (bottom) y = Math.max(y, bottom.y * 2 + half);
      y = Math.max(y, half - 180);
      return y - this.values.offsetY - 460 + height / 2;
    }
    // updateCamera (345e55, 347451): without a top edge group the view stops 150
    // points under the top of the level (344ee3: 2790 unless Platformer or Dynamic
    // Level Height use the highest object). Web units, centre of the view.
    topCentre(height, zoom = this.values.zoom) {
      if (this.edges[3]) return Infinity;
      return (this.level.maxGameplayY ?? 5400) - 300 - height / zoom / 2;
    }
    // GJGameState::m_cameraPosition: the bottom-left corner of the visible
    // area in world units (web pixels, y up), after static camera, offset and
    // zoom. Lock to Camera moves follow this point.
    cameraPosition() {
      const scene = this.level._scene, width = scene.scale?.width || 1138, height = scene.scale?.height || 640;
      const v = this.view(width, height, scene._cameraX || 0, scene._cameraY || 0);
      return { x: v.x - width / (2 * v.zoom), y: v.y - height / (2 * v.zoom), cx: v.x, cy: v.y, zoom: v.zoom };
    }
    project(x, y) {
      const scene = this.level._scene, width = scene.scale?.width || 1138, height = scene.scale?.height || 640;
      const v = this.view(width, height, scene._cameraX || 0, scene._cameraY || 0);
      const dx = x * 2 - v.x, dy = v.y - y * 2, c = Math.cos(v.rotation), s = Math.sin(v.rotation);
      return [0.5 + (c * dx - s * dy) * v.zoom / width, 0.5 - (s * dx + c * dy) * v.zoom / height];
    }
    syncRendererBounds(renderer) {
      if (!this.camera) return;
      const scene = this.level._scene, v = this.view(scene.scale.width, scene.scale.height, scene._cameraX || 0, scene._cameraY || 0);
      renderer.camera.x = v.minX; renderer.camera.y = v.minY;
      renderer.camera.w = v.maxX - v.minX; renderer.camera.h = v.maxY - v.minY;
    }
    capture() { return structuredClone({ values: this.values, targetRotation: this.targetRotation, tweens: this.tweens, targets: this.targets, edges: this.edges,
      freeMode: this.freeMode, freeEasing: this.freeEasing, freePadding: this.freePadding, disableGridSnap: this.disableGridSnap,
      velocity: this.velocity, lastPosition: this.lastPosition, follow: this.follow }); }
    restore(state) { Object.assign(this, structuredClone(state)); }
    attach() {
      const scene = this.level._scene;
      if (this.camera || !scene.cameras?.add) return;
      const main = scene.cameras.main;
      this.camera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, "gd-world");
      this.camera.setBackgroundColor(main.backgroundColor?.rgba || "#000000");
      main.setBackgroundColor("rgba(0,0,0,0)");
      // The world renders before the HUD; UI coordinates remain in screen pixels.
      const cameras = scene.cameras.cameras, index = cameras.indexOf(this.camera);
      cameras.splice(index, 1); cameras.unshift(this.camera);
      scene._gameplayCamera = this.camera;
      this._update = () => this.updateVisual();
      scene.events.on("postupdate", this._update);
      scene.events.once("shutdown", () => scene.events.off("postupdate", this._update));
      this.updateVisual();
    }
    attachShaderBands() {
      if (!this.camera || this.shaderCameras) return;
      const scene = this.level._scene, main = scene.cameras.main;
      const below = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, "gd-below-shader");
      const above = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, "gd-above-shader");
      below.setBackgroundColor(this.camera.backgroundColor?.rgba || "#000000");
      this.camera.setBackgroundColor("rgba(0,0,0,0)");
      above.setBackgroundColor("rgba(0,0,0,0)");
      below._gdShaderBand = -1; this.camera._gdShaderBand = 0; above._gdShaderBand = 1;
      this.shaderCameras = [below, this.camera, above];
      const ordered = scene.cameras.cameras;
      for (const camera of this.shaderCameras) ordered.splice(ordered.indexOf(camera), 1);
      ordered.unshift(...this.shaderCameras);
      this.updateVisual();
    }
    updateVisual() {
      const scene = this.level._scene, cam = this.camera;
      if (!cam) return;
      const width = scene.scale.width, height = scene.scale.height;
      const cameras = this.shaderCameras || [cam];
      const view = this.view(width, height, scene._cameraX || 0, scene._cameraY || 0);
      // A screen-sized background quad rotated/zoomed by the world camera
      // exposes black strips at the viewport edges (visible in EVOLUTION's
      // 90-degree camera sections). Cover the inverse-transformed viewport,
      // keeping the existing texture phase as the quad's origin moves.
      if (scene._bg) {
        const bg = scene._bg;
        const bw = scene._menuActive ? width : Math.ceil((view.maxX - view.minX) * 2) + 2;
        const bh = scene._menuActive ? height : Math.ceil((view.maxY - view.minY) * 2) + 2;
        const x = (width - bw) / 2, y = (height - bh) / 2;
        bg.tilePositionX += x - (bg._gdCoverX || 0); bg.tilePositionY += y - (bg._gdCoverY || 0);
        bg._gdCoverX = x; bg._gdCoverY = y;
        if (bg.width !== bw || bg.height !== bh) bg.setSize(bw, bh);
        bg.setPosition(x, y);
      }
      for (const camera of cameras) {
        camera.setSize(width, height);
        if (scene._menuActive) { camera.setZoom(1); camera.setRotation(0); camera.setScroll(0, 0); }
        else { camera.setZoom(view.zoom); camera.setRotation(view.rotation); camera.setScroll(view.scrollX, view.scrollY); }
      }
      // The camera filters below depend only on the display list, the player
      // hide options and the shader z band; walking every player/level field
      // each frame cost ~1 ms. Recompute them when one of those changes.
      const logicState = this.level.logicState, shaderState = this.level.shaderState, list = scene.children.list;
      const range = shaderState?.zRange?.();
      const filterKey = [list.length, list[list.length - 1]?.type, cameras.length, scene._menuActive ? 1 : 0,
        logicState?.playerHidden?.(1) ? 1 : 0, logicState?.playerHidden?.(2) ? 1 : 0,
        logicState?.options.hideGround ? 1 : 0, logicState?.options.hideAttempts ? 1 : 0,
        range ? range.lo + ":" + range.hi : "", scene._player?._mode ?? "", scene._player2 ? 1 : 0].join("|");
      if (filterKey === this._filterKey && (this._filterFrames = (this._filterFrames || 0) + 1) % 30 !== 0) return;
      this._filterKey = filterKey;
      const collectOwned = (value, into, depth = 0) => {
        if (!value || depth > 3) return;
        if (value.scene === scene && typeof value.setDepth === "function") {
          while (value.parentContainer && ![this.level.container, this.level.additiveContainer, this.level.topContainer].includes(value.parentContainer)) value = value.parentContainer;
          // Never the level's own layers, which a player sprite may sit in.
          if (![this.level.container, this.level.additiveContainer, this.level.topContainer].includes(value)) into.add(value);
          return;
        }
        if (Array.isArray(value)) for (const item of value) collectOwned(item, into, depth + 1);
        else if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
          for (const item of Object.values(value)) collectOwned(item, into, depth + 1);
      };
      const world = new Set(), nativeZ = new Map(), mark = (value, depth = 0, z = null) => {
        if (!value || depth > 3) return;
        if (value.scene === scene && typeof value.setDepth === "function") {
          while (value.parentContainer) value = value.parentContainer;
          world.add(value); if (z !== null) nativeZ.set(value, z); return;
        }
        if (Array.isArray(value)) for (const item of value) mark(item, depth + 1, z);
        else if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
          for (const item of Object.values(value)) mark(item, depth + 1, z);
      };
      for (const key of ["container", "additiveContainer", "topContainer", "_groundTiles", "_ceilingTiles", "_ground2Tiles", "_ceiling2Tiles",
        "_groundLine", "_ceilingLine", "_groundShadowL", "_groundShadowR", "_ceilingShadowL", "_ceilingShadowR"])
        mark(this.level[key], 0, key === "topContainer" ? 360 : key.includes("Container") || key === "container" ? 0 : 1400);
      mark(this.level.gdRenderer?.belowLayer); mark(this.level.gdRenderer?.middleLayer); mark(this.level.gdRenderer?.aboveLayer);
      // A hidden player also hides its effects, including the trail.
      const hidden = new Set(), logic = this.level.logicState;
      [scene._player, scene._player2].forEach((player, index) => {
        if (!player) return;
        const hide = !!logic?.playerHidden(index + 1);
        for (const [key, value] of Object.entries(player)) {
          if (["_scene", "_gameLayer", "p"].includes(key)) continue;
          mark(value, 0, /[Pp]article|[Ee]mitter|[Ss]treak|[Tt]rail/.test(key) ? 39 : 59);
          if (hide && key !== "_hitboxGraphics") collectOwned(value, hidden);
        }
      });
      for (const key of ["_bg", "_glitterEmitter", "_attemptsLabel", "_orbGfx", "_trajectoryGraphics"]) mark(scene[key], 0, key === "_bg" ? -1600 : key === "_trajectoryGraphics" ? 59 : 39);
      if (logic?.options.hideGround) {
        for (const key of ["_groundTiles", "_ceilingTiles", "_ground2Tiles", "_ceiling2Tiles",
          "_groundLine", "_ceilingLine", "_groundShadowL", "_groundShadowR", "_ceilingShadowL", "_ceilingShadowR"])
          collectOwned(this.level[key], hidden);
      }
      if (logic?.options.hideAttempts) collectOwned(scene._attemptsLabel, hidden);
      const mainId = scene.cameras.main.id;
      const mask = cameras.reduce((bits, camera) => bits | camera.id, mainId);
      // Player effects may be children of a shared level layer. Filter the
      // child itself, and restore it when Show Player is issued.
      for (const obj of this._hiddenPlayerChildren || []) if (obj.scene) obj.cameraFilter &= ~mask;
      this._hiddenPlayerChildren = new Set();
      for (const obj of hidden) if (obj.parentContainer) {
        obj.cameraFilter |= mask; this._hiddenPlayerChildren.add(obj);
      }
      // Attempts live inside the shared top container. Filtering its owner
      // would hide the entire level layer, so filter this child directly.
      if (scene._attemptsLabel?.parentContainer)
        scene._attemptsLabel.cameraFilter = (scene._attemptsLabel.cameraFilter & ~mask) | (logic?.options.hideAttempts ? mask : 0);
      const gdRenderer = this.level.gdRenderer;
      for (const obj of scene.children.list) {
        const isWorld = world.has(obj) || (obj.depth >= -100 && obj.depth <= 14);
        let excluded = mask;
        if (hidden.has(obj)) { obj.cameraFilter = (obj.cameraFilter & ~mask) | mask; continue; }
        if (!isWorld) excluded &= ~mainId;
        else if (obj === gdRenderer?.belowLayer || obj === gdRenderer?.middleLayer || obj === gdRenderer?.aboveLayer) excluded = mainId;
        else {
          const z = nativeZ.get(obj) ?? (obj.depth < 0 ? -1600 : obj.depth >= 12 ? 1400 : obj.depth >= 10 ? 360 : obj.depth >= 1 ? 59 : 0);
          const band = this.level.shaderState?.bandForZ(z) ?? 0;
          const target = cameras.find(camera => (camera._gdShaderBand ?? 0) === band) || cam;
          excluded &= ~target.id;
        }
        obj.cameraFilter = (obj.cameraFilter & ~mask) | excluded;
      }
    }
  }
  window.GDCameraState = GDCameraState;
  window.GD_CAMERA_IDS = IDS;
})();
