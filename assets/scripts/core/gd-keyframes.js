// Saved KeyframeGameObject / KeyframeAnimTriggerObject fields from the
// supplied bindings. Commands apply relative movement to the target group;
// moving the editor's path elsewhere therefore does not move the target.
(function () {
  "use strict";
  const lerp = (a, b, t) => a + (b - a) * t;
  // playKeyframeAnimation (Steam 3672e2..3673a8) reads rotationX, not
  // property 6. Cocos can encode a reflected pose with rotation axes that
  // differ by 180 degrees; native keyframes turn that into signed scale.
  function savedPose(object) {
    let rotation = Number(object.rotationX ?? object.rot) || 0;
    const rotationY = Number(object.rotationY ?? object.rot) || 0;
    let sx = object.scale * object.scaleX, sy = object.scale * object.scaleY;
    const difference = Math.abs(rotation - rotationY);
    if (difference > 179.999 && difference < 180.001) {
      if (Math.abs(rotation) > Math.abs(rotationY)) {
        rotation += rotation > 0 ? -180 : 180;
        sy = -sy;
      } else sx = -sx;
    } else if (sx < 0 && sy < 0) {
      rotation += rotation > 0 ? -180 : 180;
      sx = -sx; sy = -sy;
    }
    return { rotation, sx, sy };
  }
  function spline(values) {
    const n = values.length, second = new Array(n).fill(0), rhs = new Array(n).fill(0);
    // Natural cubic spline, with uniformly spaced keyframe indices. Timing
    // and easing choose the parameter within each individual segment.
    for (let i = 1; i < n - 1; i++) {
      const p = 0.5 * second[i - 1] + 2;
      second[i] = -0.5 / p;
      rhs[i] = (3 * (values[i + 1] - 2 * values[i] + values[i - 1]) - 0.5 * rhs[i - 1]) / p;
    }
    for (let i = n - 2; i >= 0; i--) second[i] = second[i] * second[i + 1] + rhs[i];
    return second;
  }
  function sampleSpline(values, second, i, t) {
    const a = 1 - t;
    return a * values[i] + t * values[i + 1] +
      ((a * a * a - a) * second[i] + (t * t * t - t) * second[i + 1]) / 6;
  }
  class GDKeyframeState {
    constructor(level) { this.level = level; this.nodes = []; this.active = []; }
    add(object, uid) { this.nodes.push({ object, uid }); }
    pathFor(trig, first = null) {
      const animationGroup = Number(trig.raw[76]) || 0;
      first ||= this.nodes.find(({ object }) => this.level._getLevelObjectGroupIds(object).includes(animationGroup));
      if (!first || !animationGroup) return null;
      const group = Number(first.object._raw[373]) || 0;
      const nodes = this.nodes.filter(({ object }) => (Number(object._raw[373]) || 0) === group)
        .sort((a, b) => (Number(a.object._raw[374]) || 0) - (Number(b.object._raw[374]) || 0));
      const renderer = this.level.gdRenderer;
      // The animation group selects a path, not a starting frame. Native
      // playKeyframeAnimation passes that path's entire ordered node array
      // to the command, even when only a later marker has the group ID.
      const frames = nodes.map(({ object, uid }) => {
        const raw = object._raw, node = this.level.gdObjects[uid];
        const live = node && renderer ? renderer.livePosition(node) : null;
        return { x: live ? live.x : object.x, y: live ? live.y : object.y,
          ...savedPose(object),
          // customObjectSetup (656d2b..656d79) overwrites the editor's
          // constructor default: an omitted duration loads as zero.
          duration: Math.max(0, Number(raw[10]) || 0), curve: raw[378] === "1", reference: raw[375] === "1",
          spawnGroup: Number(raw[71]) || 0, spawnDelay: Math.max(0, Number(raw[557]) || 0), spawnProximity: raw[377] === '1',
          closeLoop: raw[376] === "1",
          timeMode: Number(raw[379]) || 0, easing: Number(raw[30]) || 0, rate: Number(raw[85] ?? 2),
          direction: Number(raw[536]) || 0, revolutions: Number(raw[537]) || 0 };
      });
      if (frames.length < 2) return null;
      // KeyframeGameObject::m_closeLoop (376) adds the last segment back to
      // the first pose. Omitting it leaves the final rotation/scale applied;
      // repeating a facial animation then compounds that distortion forever.
      // The last saved node owns this return segment's duration and easing.
      if (frames[frames.length - 1].closeLoop) frames.push({ ...frames[0] });
      const durations = frames.slice(0, -1).map(f => f.duration);
      for (let a = 0; a < frames.length - 1; a++) {
        if (frames[a].reference || frames[a].timeMode === 0) continue;
        let b = a + 1;
        while (b < frames.length - 1 && frames[b].reference) b++;
        const weights = [];
        for (let j = a; j < b; j++) weights.push(frames[a].timeMode === 2
          ? Math.hypot(frames[j + 1].x - frames[j].x, frames[j + 1].y - frames[j].y) : 1);
        const sum = weights.reduce((x, y) => x + y, 0);
        weights.forEach((w, j) => { durations[a + j] = frames[a].duration * (sum ? w / sum : 1 / weights.length); });
      }
      for (let i = 1; i < frames.length; i++) {
        let delta = ((frames[i].rotation - frames[i - 1].rotation + 180) % 360 + 360) % 360 - 180;
        const dir = frames[i - 1].direction;
        if (dir === 1 && delta < 0) delta += 360;
        if (dir === 2 && delta > 0) delta -= 360;
        delta += frames[i - 1].revolutions * 360 * (dir === 2 ? -1 : 1);
        frames[i].rotation = frames[i - 1].rotation + delta;
      }
      const xs = frames.map(f => f.x), ys = frames.map(f => f.y);
      return { frames, durations, xs, ys, xx: spline(xs), yy: spline(ys), target: Number(first.object._raw[51]) || 0 };
    }
    trigger(trig) {
      if (!this.level._isTriggerSaveObjectLive(trig.uid)) return;
      // One animation group can contain starting markers for many paths
      // (Skeletal's logos and articulated skeletons). All must run. If the
      // group includes further markers of the same path, start only once.
      const animationGroup = Number(trig.raw[76]) || 0, starts = new Map();
      if (!animationGroup) return;
      for (const node of this.nodes) {
        if (!this.level._getLevelObjectGroupIds(node.object).includes(animationGroup)) continue;
        const group = Number(node.object._raw[373]) || 0;
        if (!starts.has(group)) starts.set(group, node);
      }
      for (const first of starts.values()) this.startPath(trig, this.pathFor(trig, first));
    }
    startPath(trig, path) {
      const targetGroup = Number(trig.raw[51]) || path?.target;
      if (!path || !targetGroup) return;
      const parentGroup = Number(trig.raw[71]) || targetGroup;
      const center = this.level._moveGroupParent(parentGroup);
      // KeyframeAnimTriggerObject::customObjectSetup (652ce0..652fxx)
      // loads every absent modifier as zero, independently. Position-only
      // and transform-only commands deliberately omit the other modifiers.
      const mod = key => Number.isFinite(Number(trig.raw[key])) ? Number(trig.raw[key]) : 0;
      this.active.push({ trig: { ...trig, targetGroup }, path, center: center?.index ?? null,
        time: 0, mod: { time: Math.max(0, mod(520)), x: mod(521), y: mod(545), rot: mod(522), sx: mod(523), sy: mod(546) },
        firedNodes: [], previous: { x: 0, y: 0, rot: 0, sx: 1, sy: 1 } });
    }
    pose(active) {
      const { path, mod } = active, { frames, durations } = path;
      let time = mod.time > 0 ? active.time / mod.time : Infinity, i = 0;
      while (i < durations.length - 1 && time >= durations[i]) { time -= durations[i]; i++; }
      const done = i === durations.length - 1 && time >= durations[i];
      const progress = durations[i] > 0 ? Math.min(1, time / durations[i]) : 1;
      const a = frames[i], b = frames[i + 1], t = Easing.sample(a.easing, a.rate, progress), first = frames[0];
      const x = a.curve ? sampleSpline(path.xs, path.xx, i, t) : lerp(a.x, b.x, t);
      const y = a.curve ? sampleSpline(path.ys, path.yy, i, t) : lerp(a.y, b.y, t);
      return { x: (x - first.x) * mod.x, y: (y - first.y) * mod.y,
        rot: (lerp(a.rotation, b.rotation, t) - first.rotation) * mod.rot,
        sx: 1 + (lerp(a.sx, b.sx, t) / (first.sx || 1) - 1) * mod.sx,
        sy: 1 + (lerp(a.sy, b.sy, t) / (first.sy || 1) - 1) * mod.sy, done };
    }
    step(dt) {
      const level = this.level;
      for (let i = 0; i < this.active.length;) {
        const active = this.active[i], { trig, previous: p } = active;
        if (active.paused) { i++; continue; }
        const spawns=[];
        active.time += dt; const pose = this.pose(active);
        let end=0;
        for(let j=0;j<active.path.durations.length;j++) {
          // playKeyframeAnimation (3676f6) copies the destination node's
          // spawn onto the preceding segment, so it fires on arrival.
          const frame=active.path.frames[j+1],duration=active.path.durations[j];
          const threshold=(end+duration*(frame.spawnProximity ? .95 : 1))*active.mod.time;
          end+=duration;
          active.firedNodes ||= [];
          if(frame.spawnGroup>0&&!active.firedNodes.includes(j)&&active.time>=threshold) {
            active.firedNodes.push(j);spawns.push({group:frame.spawnGroup,delay:frame.spawnDelay,trig});
          }
        }
        level._translateKeyframeGroup(trig.targetGroup, pose.x - p.x, pose.y - p.y, Number(trig.raw[71]) || 0);
        const renderer = level.gdRenderer;
        const node = active.center === null ? null : renderer?.objects[active.center];
        const live = node ? renderer.livePosition(node) : null;
        const center = live ? { x: live.x, y: live.y, rotation: 0 } : null;
        if (pose.sx !== p.sx || pose.sy !== p.sy) {
          // Apply S(new)/S(old) in the previous keyframe's rotated axes.
          // World-axis scale followed by a rotation is not its inverse on
          // the return segment: repeated nonuniform loops accumulate shear.
          level._applyGroupScale({ ...trig, relativeRotation: true, axesRotation: p.rot, _keyframeTransform: true },
            pose.sx / (p.sx || 1e-12), pose.sy / (p.sy || 1e-12), center);
        }
        const rotation = (pose.rot - p.rot) * Math.PI / 180;
        if (rotation) {
          level.gdRenderer?.rotateGroup(trig.targetGroup, rotation, center, false, true);
          const c = Math.cos(rotation), s = Math.sin(rotation);
          for (const sprite of level._getUniqueGroupSprites(trig.targetGroup)) {
            if (center) {
              const cx = center.x * 2, cy = 460 - center.y * 2;
              const dx = (sprite._eeWorldX ?? sprite.x) - cx, dy = (sprite._eeBaseY ?? sprite.y) - cy;
              sprite.x = sprite._eeWorldX = cx + dx * c - dy * s;
              sprite.y = sprite._eeBaseY = cy + dx * s + dy * c;
              level._syncSpriteMoveBaseFromCurrent(sprite); level._refreshSpriteSection(sprite);
            }
            sprite.rotation += rotation;
          }
          for (const col of level._getUniqueGroupColliders(trig.targetGroup))
            level._applyRotateTriggerColliderDelta(col, rotation, center ? center.x * 2 : null, center ? 460 - center.y * 2 : null, false);
        }
        active.previous = pose;
        // The native command loop rereads its end after each command
        // (369ad0..36ad42). A node can append a new path, which receives
        // this tick too; deferring all node spawns loses one physics tick
        // at every chained animation.
        for(const {group,delay,trig} of spawns) {
          if(delay>0)level._queueSpawnTrigger({...trig,targetGroup:group,delay,randomDelay:0});
          else level._activateSpawnedGroup(group,level._scene?._colorManager,false,trig);
        }
        if (pose.done) this.active.splice(i, 1); else i++;
      }
    }
    reset() { this.active = []; }
    capture() { return structuredClone(this.active); }
    restore(data) { this.active = structuredClone(data || []); }
  }
  window.GDKeyframeState = GDKeyframeState;
})();
