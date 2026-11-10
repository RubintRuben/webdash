// CCParticleSystemQuad data layout from Geode's ParticleStruct.
// https://github.com/geode-sdk/geode/blob/main/loader/include/Geode/cocos/particle_nodes/CCParticleSystemQuad.h
(function () {
  "use strict";
  const FIELDS = ("TotalParticles Duration Life LifeVar EmissionRate Angle AngleVar Speed SpeedVar PosVarX PosVarY GravityX GravityY " +
    "RadialAccel RadialAccelVar TangentialAccel TangentialAccelVar StartSize StartSizeVar StartSpin StartSpinVar " +
    "StartColorR StartColorVarR StartColorG StartColorVarG StartColorB StartColorVarB StartColorA StartColorVarA " +
    "EndSize EndSizeVar EndSpin EndSpinVar EndColorR EndColorVarR EndColorG EndColorVarG EndColorB EndColorVarB EndColorA EndColorVarA " +
    "FadeInTime FadeInTimeVar FadeOutTime FadeOutTimeVar StartRadius StartRadiusVar EndRadius EndRadiusVar RotatePerSecond RotatePerSecondVar " +
    "EmitterMode PositionType isBlendAdditive startSpinEqualToEndSpin rotationIsDir dynamicRotationIsDir customParticleIdx uniformColorMode " +
    "frictionPos frictionPosVar respawn respawnVar orderSensitive startSizeEqualToEndSize startRadiusEqualToEndRadius " +
    "startRGBVarSync endRGBVarSync frictionSize frictionSizeVar frictionRot frictionRotVar").split(" ");
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  function parseGDParticleString(value) {
    const values = String(value || "").split("a");
    const data = {};
    FIELDS.forEach((name, i) => { const n = Number(values[i]); data[name] = Number.isFinite(n) ? n : 0; });
    data.sFrame = values[FIELDS.length] || "";
    return data;
  }
  function cocosParticlePreset(preset) {
    const p = typeof preset === "string" ? window.GD_EFFECT_PRESETS?.[preset] : preset;
    if (!p) return null;
    const d = Object.fromEntries(FIELDS.map(k => [k, 0]));
    const keys = { TotalParticles: "maxParticles", Duration: "duration", Life: "particleLifespan", LifeVar: "particleLifespanVariance",
      Angle: "angle", AngleVar: "angleVariance", Speed: "speed", SpeedVar: "speedVariance",
      PosVarX: "sourcePositionVariancex", PosVarY: "sourcePositionVariancey", GravityX: "gravityx", GravityY: "gravityy",
      RadialAccel: "radialAcceleration", RadialAccelVar: "radialAccelVariance", TangentialAccel: "tangentialAcceleration", TangentialAccelVar: "tangentialAccelVariance",
      StartSize: "startParticleSize", StartSizeVar: "startParticleSizeVariance", EndSize: "finishParticleSize", EndSizeVar: "finishParticleSizeVariance",
      StartSpin: "rotationStart", StartSpinVar: "rotationStartVariance", EndSpin: "rotationEnd", EndSpinVar: "rotationEndVariance",
      StartRadius: "maxRadius", StartRadiusVar: "maxRadiusVariance", EndRadius: "minRadius", EndRadiusVar: "minRadiusVariance",
      RotatePerSecond: "rotatePerSecond", RotatePerSecondVar: "rotatePerSecondVariance", EmitterMode: "emitterType" };
    for (const [key, source] of Object.entries(keys)) d[key] = Number(p[source]) || 0;
    for (const [suffix, channel] of [["R", "Red"], ["G", "Green"], ["B", "Blue"], ["A", "Alpha"]]) {
      d["StartColor" + suffix] = Number(p["startColor" + channel]) || 0;
      d["StartColorVar" + suffix] = Number(p["startColorVariance" + channel]) || 0;
      d["EndColor" + suffix] = Number(p["finishColor" + channel]) || 0;
      d["EndColorVar" + suffix] = Number(p["finishColorVariance" + channel]) || 0;
    }
    d.EmissionRate = d.TotalParticles / Math.max(0.001, d.Life);
    d.PositionType = 2;
    d.isBlendAdditive = p.blendFuncSource === 770 && p.blendFuncDestination === 1 ? 1 : 0;
    d.sFrame = p.textureFileName;
    return d;
  }
  class GDParticleSystem {
    constructor(renderer, object, serialized) {
      this.renderer = renderer; this.object = object;
      this.data = typeof serialized === "object" ? { ...parseGDParticleString(""), ...serialized } : parseGDParticleString(serialized);
      this.particles = []; this.elapsed = 0; this.accumulator = 0; this.started = false;
      this.triggered = false; this.pendingTrigger = false;
      this.snapshotColor = null; this.snapshotEndColor = null; this.snapshotOpacity = null; this.snapshotBlend = null;
      const raw = object.levelObj._raw || {};
      this.hiddenObject = raw[135] === "1"; this.noEffects = raw[507] === "1";
      this.animateOnTrigger = raw[123] === "1"; this.useObjectColor = false;
      this._reach = null; this._reachScale = 0;
      // Lazily filled caches and the renderer's sleep bookkeeping, declared
      // so every system keeps one hidden class.
      this.part = null; this.ambient = false; this._pose = null; this._poseKey = null; this._poseKeyed = false; this._areaOut = null;
      this._emissionBounds = null; this._uiCamera = null; this._color = null; this._m = null;
      this._asleep = false; this._bin0 = 0; this._bin1 = 0; this._clock = 0; this._wakeHold = 0; this._psIndex = -1;
      const frame = this.data.sFrame || "particle_" + String(Math.max(0, this.data.customParticleIdx)).padStart(2, "0") + "_001.png";
      const info = renderer.frames.get(frame) || renderer.frames.get("particle_01_001.png");
      if (info) this.part = window.GDRender.makePart({ info, qx: -info.cw / 2 + info.ox, qy: -info.ch / 2 + info.oy, role: 3,
        opacityModifyRGB: !this.data.isBlendAdditive });
    }
    reset() {
      // A sleeping emitter owes nothing once its state is cleared.
      this.renderer._wakeParticles?.(this, -Infinity);
      this.particles.length = 0; this.elapsed = 0; this.accumulator = 0; this.started = false; this.triggered = false; this.pendingTrigger = false;
    }
    trigger() {
      // ParticleGameObject::updateSyncedAnimation calls resetSystem when its
      // Animate on Trigger flag is armed (Steam 643280). Duration zero is a
      // single burst, used on Dash's first spider landing panels.
      this.reset(); this.started = true; this.triggered = true;
      if (this.data.Duration === 0) {
        const max = Math.max(0, Math.min(20000, Math.trunc(this.data.TotalParticles)));
        const pose = this.emitterPose();
        for (let i = 0; i < max; i++) this.spawn(pose);
      }
    }
    sample(value, variance) { return value + (Math.random() * 2 - 1) * variance; }
    objectColor(end = false, area = this.emitterPose().area) {
      const saved = end ? this.snapshotEndColor : this.snapshotColor;
      if (saved) return saved;
      const o = this.object, r = this.renderer;
      const color = r._colorForMode(o, end ? o.detailID : o.baseID, !end, [255, 255, 255]);
      if (area?.tints) {
        const other = [255, 255, 255];
        r.areaState.applyTints(o, area, end ? other : color, end ? color : other, true);
      }
      return color;
    }
    objectBlend(object = this.object) {
      const raw = object.levelObj._raw || {}, r = this.renderer;
      if (raw[146] !== "1" && raw[147] !== "1") return !!this.data.isBlendAdditive;
      // applyParticleSettings 642197/6422cf overwrites the saved particle
      // blend with the main/detail colour-channel blend when object RGB or
      // uniform object colour is enabled. A saved additive profile must not
      // erase dark, normally blended artwork on a light background.
      const main = r._channelBlend(object.baseID);
      return main || (object.detailID === 1012 ? main : r._channelBlend(object.detailID));
    }
    // Upper bound of the distance from the object to any point of its
    // transformed emission area (the affine's Frobenius norm bounds its
    // stretch).
    viewReach(pose = this.emitterPose()) {
      const scale = pose.stretch;
      if (this._reach === null || this._reachScale !== scale) {
        const { x0, x1, y0, y1 } = this.emissionBounds();
        this._reach = Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(y0), Math.abs(y1))) * scale;
        this._reachScale = scale;
      }
      return this._reach;
    }
    // update(dt, false) of a system without particles: only its clock runs.
    idle(dt) {
      if (this.animateOnTrigger && !this.triggered) return;
      if (this.started) this.elapsed += dt;
    }
    emitterPose() {
      const o = this.object, state = this.renderer.areaState;
      const offset = this.offsetX || this.offsetY ? this.objectTransform(null) : null;
      const x = o.x + o.offX + (offset ? offset[0] * (this.offsetX || 0) + offset[2] * (this.offsetY || 0) : 0);
      const y = o.y + o.offY + (offset ? offset[1] * (this.offsetX || 0) + offset[3] * (this.offsetY || 0) : 0);
      const pose = this._pose || (this._pose = { x: 0, y: 0, area: null, m: null, stretch: 0 });
      if (!o.isUIObject && state?.active) {
        const out = this._areaOut || (this._areaOut = {});
        const area = state.forObject(o, x, y, out) ? out : null;
        pose.x = x + (area?.dx || 0); pose.y = y + (area?.dy || 0);
        pose.area = area; this._setPoseMatrix(pose, this.objectTransform(area));
        this._poseKeyed = false;
        return pose;
      }
      pose.x = x; pose.y = y; pose.area = null;
      // Without an Area effect the matrix follows only the object's own
      // transform, which almost never changes: the renderer asks every
      // emitter for its pose each frame.
      const k = this._poseKey || (this._poseKey = new Float64Array(10)), f = o.affine;
      const rx = o.rotationX ?? o.rot ?? 0, ry = o.rotationY ?? o.rot ?? 0;
      const sx = o.flipX ? -o.scaleX : o.scaleX, sy = o.flipY ? -o.scaleY : o.scaleY;
      const f0 = f ? f[0] : 1, f1 = f ? f[1] : 0, f2 = f ? f[2] : 0, f3 = f ? f[3] : 1;
      if (this._poseKeyed && k[0] === rx && k[1] === ry && k[2] === sx && k[3] === sy &&
          k[4] === f0 && k[5] === f1 && k[6] === f2 && k[7] === f3) return pose;
      k[0] = rx; k[1] = ry; k[2] = sx; k[3] = sy; k[4] = f0; k[5] = f1; k[6] = f2; k[7] = f3;
      this._poseKeyed = true;
      this._setPoseMatrix(pose, this.objectTransform(null));
      return pose;
    }
    _setPoseMatrix(pose, m) {
      pose.m = m; pose.stretch = Math.hypot(m[0], m[1], m[2], m[3]);
    }
    objectTransform(area = null) {
      // ParticleGameObject::applyParticleSettings (641f90): Free and
      // Relative systems use an unscaled, unrotated node. Rotation is
      // applied to their emission angle; only Grouped inherits the axes.
      if(this.data.PositionType!==2)return [1,0,0,1];
      if (area?.linearActive) return area.linear.slice();
      const o = this.object, rad = Math.PI / 180;
      const rx = -((o.rotationX ?? o.rot ?? 0) + (area?.rot || 0)) * rad;
      const ry = -((o.rotationY ?? o.rot ?? 0) + (area?.rot || 0)) * rad;
      const sx = o.scaleX * (area?.sx ?? 1) * (o.flipX ? -1 : 1);
      const sy = o.scaleY * (area?.sy ?? 1) * (o.flipY ? -1 : 1);
      const a = Math.cos(ry) * sx, b = Math.sin(ry) * sx, c = -Math.sin(rx) * sy, d = Math.cos(rx) * sy;
      const f = o.affine || [1, 0, 0, 1];
      return [f[0] * a + f[2] * b, f[1] * a + f[3] * b, f[0] * c + f[2] * d, f[1] * c + f[3] * d];
    }
    emissionBounds() {
      if (this._emissionBounds) return this._emissionBounds;
      const d = this.data, life = d.Life < 0 ? 10 : Math.max(0, d.Life + Math.abs(d.LifeVar));
      const size = Math.max(d.StartSize + Math.abs(d.StartSizeVar), d.EndSize + Math.abs(d.EndSizeVar), 0) / 2;
      let x0 = -Math.abs(d.PosVarX) - size, x1 = -x0, y0 = -Math.abs(d.PosVarY) - size, y1 = -y0;
      if (d.EmitterMode === 1) {
        const radius = Math.max(Math.abs(d.StartRadius) + Math.abs(d.StartRadiusVar), Math.abs(d.EndRadius) + Math.abs(d.EndRadiusVar));
        x0 -= radius; x1 += radius; y0 -= radius; y1 += radius;
      } else {
        const lo = d.Angle - Math.abs(d.AngleVar), hi = d.Angle + Math.abs(d.AngleVar);
        const angles = [lo, hi];
        for (let a = Math.ceil(lo / 90) * 90; a <= Math.min(hi, lo + 360); a += 90) angles.push(a);
        const xs = [0], ys = [0];
        for (const a of angles) for (const speed of [d.Speed - Math.abs(d.SpeedVar), d.Speed + Math.abs(d.SpeedVar)]) {
          xs.push(Math.cos(a * Math.PI / 180) * speed * life); ys.push(Math.sin(a * Math.PI / 180) * speed * life);
        }
        const accel = (Math.abs(d.RadialAccel) + Math.abs(d.RadialAccelVar) + Math.abs(d.TangentialAccel) + Math.abs(d.TangentialAccelVar)) * life * life / 2;
        x0 += Math.min(...xs) + Math.min(0, d.GravityX * life * life / 2) - accel;
        x1 += Math.max(...xs) + Math.max(0, d.GravityX * life * life / 2) + accel;
        y0 += Math.min(...ys) + Math.min(0, d.GravityY * life * life / 2) - accel;
        y1 += Math.max(...ys) + Math.max(0, d.GravityY * life * life / 2) + accel;
      }
      return this._emissionBounds = { x0, x1, y0, y1 };
    }
    viewCamera() {
      if (!this.object.isUIObject) return this.renderer.camera;
      const cam = this._uiCamera || (this._uiCamera = { x: 0, y: 0 });
      cam.w = (typeof screenWidth !== "undefined" ? screenWidth : 1138) / 2;
      cam.h = (typeof screenHeight !== "undefined" ? screenHeight : 640) / 2;
      return cam;
    }
    intersectsView(cam, padding = 120, pose = this.emitterPose()) {
      if(this.data.PositionType!==2){
        const radius=this.viewReach(pose)+padding;
        return pose.x+radius>=cam.x&&pose.x-radius<=cam.x+cam.w&&pose.y+radius>=cam.y&&pose.y-radius<=cam.y+cam.h;
      }
      const { x0, x1, y0, y1 } = this.emissionBounds(), m = pose.m;
      const ax = m[0] * x0, bx = m[0] * x1, cx = m[2] * y0, dx = m[2] * y1;
      const ay = m[1] * x0, by = m[1] * x1, cy = m[3] * y0, dy = m[3] * y1;
      const x = pose.x, y = pose.y;
      return x + Math.max(ax, bx) + Math.max(cx, dx) >= cam.x - padding &&
        x + Math.min(ax, bx) + Math.min(cx, dx) <= cam.x + cam.w + padding &&
        y + Math.max(ay, by) + Math.max(cy, dy) >= cam.y - padding &&
        y + Math.min(ay, by) + Math.min(cy, dy) <= cam.y + cam.h + padding;
    }
    spawn(pose = this.emitterPose()) {
      const d = this.data, o = this.object, rad = Math.PI / 180;
      const life = d.Life < 0 ? Infinity : Math.max(0.001, this.sample(d.Life, d.LifeVar));
      // CCParticleSystem simulates in emitter coordinates. The containing
      // node transforms the spawn area, gravity, radius and quads together.
      const area=pose.area;
      const rotation=area?.linearActive?Math.atan2(area.linear[2],area.linear[3])/rad:(o.rotationX??o.rot??0)+(area?.rot||0);
      const angle = (this.sample(d.Angle, d.AngleVar)-(d.PositionType!==2?rotation:0)) * rad;
      const speed = this.sample(d.Speed, d.SpeedVar);
      const color = (prefix, sync) => {
        const random = Math.random() * 2 - 1;
        // ParticleGameObject::applyParticleSettings (Steam 642063) replaces
        // the configured RGB with main/detail colour, preserving alpha.
        // Multiplying them made red-channel fog with saved cyan RGB black.
        const rgb = o.levelObj._raw?.[146] === "1" ? this.objectColor(prefix === "End", pose.area) : null;
        const uniform = o.levelObj._raw?.[147] === "1" && !rgb;
        return ["R", "G", "B", "A"].map((k, i) => clamp((rgb && i < 3 ? rgb[i] / 255 : uniform && i === 3 ? 1 : d[prefix + "Color" + k]) +
          (sync && k !== "A" ? random : Math.random() * 2 - 1) * d[prefix + "ColorVar" + k], 0, 1));
      };
      const startSize = Math.max(0, this.sample(d.StartSize, d.StartSizeVar));
      const spin = this.sample(d.StartSpin, d.StartSpinVar);
      // initParticle 689c3/68c51/68dc2: directional sprites retain their
      // authored spin and face 90 degrees away from the launch angle.
      // The textures' upright axis is Y, not X.
      const directional = d.rotationIsDir || d.dynamicRotationIsDir;
      const startSpin = spin + (directional ? 90 - angle / rad : 0);
      const spinDelta = d.dynamicRotationIsDir || d.startSpinEqualToEndSpin ? 0
        : this.sample(d.EndSpin, d.EndSpinVar) - spin;
      const wrappedSpin = (spin % 360 + 360) % 360;
      const startRadius = this.sample(d.StartRadius, d.StartRadiusVar);
      this.particles.push({
        life, age: 0, x: this.sample(0, d.PosVarX), y: this.sample(0, d.PosVarY),
        originX: pose.x, originY: pose.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle,
        radial: this.sample(d.RadialAccel, d.RadialAccelVar), tangent: this.sample(d.TangentialAccel, d.TangentialAccelVar),
        startSize, endSize: d.startSizeEqualToEndSize || d.EndSize === -1 ? startSize : Math.max(0, this.sample(d.EndSize, d.EndSizeVar)),
        startSpin, endSpin: startSpin + spinDelta,
        directionOffset: d.dynamicRotationIsDir ? (wrappedSpin > 270 ? wrappedSpin - 270 : wrappedSpin + 90) : 0,
        startColor: color("Start", d.startRGBVarSync), endColor: color("End", d.endRGBVarSync),
        fadeIn: Math.max(0, this.sample(d.FadeInTime, d.FadeInTimeVar)), fadeOut: Math.max(0, this.sample(d.FadeOutTime, d.FadeOutTimeVar)),
        startRadius, endRadius: d.startRadiusEqualToEndRadius || d.EndRadius === -1 ? startRadius : this.sample(d.EndRadius, d.EndRadiusVar),
        angularSpeed: this.sample(d.RotatePerSecond, d.RotatePerSecondVar) * rad,
        friction: this.sample(d.frictionPos, d.frictionPosVar),
        sizeFriction: this.sample(d.frictionSize, d.frictionSizeVar),
        spinFriction: this.sample(d.frictionRot, d.frictionRotVar)
      });
      const p = this.particles[this.particles.length - 1];
      // With a fixed radius angle native keeps the initial orientation;
      // its angular motion does not require a new direction each tick.
      if (d.EmitterMode === 1 && !p.angularSpeed) p.directionOffset = 0;
      p.size = startSize; p.deltaSize = (p.endSize - startSize) / life;
      p.rotation = startSpin; p.deltaRotation = (p.endSpin - startSpin) / life;
    }
    step(dt, emitting = true) {
      const d = this.data;
      const max = Math.max(0, Math.min(20000, Math.trunc(d.TotalParticles)));
      const active = d.Duration < 0 || this.elapsed < d.Duration;
      if (emitting && active && max > 0) {
        const rate = d.EmissionRate < 0 ? max / Math.max(0.001, d.Life) : d.EmissionRate;
        this.accumulator += dt * rate;
        let count = Math.min(Math.floor(this.accumulator), max - this.particles.length);
        this.accumulator -= Math.floor(this.accumulator);
        if (count > 0) {
          const pose = this.emitterPose();
          while (count-- > 0) this.spawn(pose);
        }
      }
      this.elapsed += dt;
      for (let i = 0; i < this.particles.length;) {
        const p = this.particles[i]; p.age += dt;
        if (p.age >= p.life) {
          // CCParticleSystem::update 6bf93..6c120: preserve order only
          // when Order Sensitive is enabled. Otherwise fill the hole with
          // the last particle, avoiding a whole-array shift per expiry.
          if (d.orderSensitive) this.particles.splice(i, 1);
          else {
            const last = this.particles.pop();
            if (i < this.particles.length) this.particles[i] = last;
          }
          continue;
        }
        const t = p.age / p.life, oldX = p.x, oldY = p.y;
        p.rotation += p.deltaRotation * dt;
        if (d.EmitterMode === 1) {
          const radius = lerp(p.startRadius, p.endRadius, t);
          p.angle += p.angularSpeed * dt;
          p.x = -Math.cos(p.angle) * radius; p.y = -Math.sin(p.angle) * radius;
        } else {
          const length = Math.hypot(p.x, p.y);
          const nx = length ? p.x / length : 0, ny = length ? p.y / length : 0;
          p.vx += (d.GravityX + nx * p.radial - ny * p.tangent) * dt;
          p.vy += (d.GravityY + ny * p.radial + nx * p.tangent) * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        // CCParticleSystem::update (libcocos 6be52..6bf82) integrates the
        // current size/spin, then damps their rates for the next tick. A
        // signed random friction may accelerate a rate instead of damping
        // it. Position friction likewise applies after this tick's motion.
        p.size = Math.max(0, p.size + p.deltaSize * dt);
        if (p.directionOffset) {
          // update 6bb07 / 6bcb3 uses actual motion, including radius
          // motion, then takes the shortest turn with a dt*10 response.
          const dx = d.EmitterMode === 1 ? p.x - oldX : p.vx;
          const dy = d.EmitterMode === 1 ? p.y - oldY : p.vy;
          let turn = p.directionOffset - Math.atan2(dy, dx) * 180 / Math.PI - p.rotation;
          if (turn > 180) turn -= 360; else if (turn < -180) turn += 360;
          p.rotation += turn * (d.EmitterMode === 1 && p.age - dt < .1 ? 1 : dt * 10);
        }
        p.vx *= 1 - p.friction * dt; p.vy *= 1 - p.friction * dt;
        p.deltaSize *= 1 - p.sizeFriction * dt;
        p.deltaRotation *= 1 - p.spinFriction * dt;
        i++;
      }
    }
    update(dt, visible) {
      if (this.pendingTrigger && visible) this.trigger();
      if (this.object.levelObj._raw?.[123] === "1" && !this.triggered) return;
      if (!this.started && visible) {
        this.started = true;
        if (this.data.Duration === 0) {
          const max = Math.max(0, Math.min(20000, Math.trunc(this.data.TotalParticles)));
          const pose = this.emitterPose();
          for (let i = 0; i < max; i++) this.spawn(pose);
        }
        if (this.object.levelObj._raw?.[211] === "1") {
          const warmup = Math.min(10, Math.max(0, this.data.Life + this.data.LifeVar));
          for (let t = 0; t < warmup; t += 1 / 60) this.step(1 / 60);
        }
      }
      if (this.started) this.step(dt, visible);
    }
    draw(pose = this.emitterPose()) {
      if (!this.part || !this.particles.length) return;
      const r = this.renderer, o = this.object, d = this.data;
      // UI emitters use the same screen layer as UI sprites, independently
      // of the world camera and of whichever sprite was prepared last.
      const previousFlags = r._objectDrawFlags;
      r._objectDrawFlags = o.isUIObject ? window.GDRender.uiDrawFlags : 0;
      const base = this.useObjectColor ? this.objectColor(false, pose.area) : [255, 255, 255];
      const uniformObject = o.levelObj._raw?.[147] === "1" && o.levelObj._raw?.[146] !== "1";
      const uniformStart = uniformObject ? this.objectColor(false, pose.area) : null;
      const uniformEnd = uniformObject ? this.objectColor(true, pose.area) : null;
      const opacity = (this.snapshotOpacity ?? (r._groupOpacity(o) * r._channelOpacity(o.baseID))) * (pose.area?.op ?? 1);
      const blend = this.snapshotBlend ?? this.objectBlend();
      const batch = window.GDRender.batchFor(o.zLayer, blend, "particle");
      const m = pose.m;
      const grouped = d.PositionType === 2;
      const originX = pose.x, originY = pose.y;
      const cam = this.viewCamera(), stretch = pose.stretch;
      const width = Math.max(1, this.part.info.cw), height = Math.max(1, this.part.info.ch);
      const color = this._color || (this._color = [0, 0, 0]);
      const im = this._m || (this._m = [0, 0, 0, 0, 0, 0]);
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i], t = p.age / p.life;
        // CCParticleSystem::update compensates Free/Relative translation in
        // local space before the current node transform is applied. Rotation
        // and scale remain live for particles that have already been emitted.
        const localX = p.x + (grouped ? 0 : p.originX - originX);
        const localY = p.y + (grouped ? 0 : p.originY - originY);
        const x = originX + m[0] * localX + m[2] * localY;
        const y = originY + m[1] * localX + m[3] * localY;
        const size = p.sizeFriction ? p.size : Math.max(0, lerp(p.startSize, p.endSize, t));
        const rotation = p.spinFriction || d.dynamicRotationIsDir ? p.rotation : lerp(p.startSpin, p.endSpin, t);
        const angle = -rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
        const sx = size / width, sy = size / height;
        const radius = size * stretch;
        if (x + radius < cam.x || x - radius > cam.x + cam.w || y + radius < cam.y || y - radius > cam.y + cam.h) continue;
        for (let k = 0; k < 3; k++) color[k] = Math.trunc(uniformObject ? lerp(uniformStart[k], uniformEnd[k], t) :
          base[k] * (d.uniformColorMode ? p.startColor[k] : lerp(p.startColor[k], p.endColor[k], t)));
        let alpha = lerp(p.startColor[3], p.endColor[3], t) * opacity;
        // updateQuadWithParticle 6d242..6d2c2 prioritises the entrance
        // ramp while active; overlapping ramps are not multiplied.
        if (p.age < p.fadeIn) alpha *= p.age / p.fadeIn;
        else if (p.life - p.age < p.fadeOut) alpha *= (p.life - p.age) / p.fadeOut;
        im[0] = (m[0] * c + m[2] * s) * sx; im[1] = (m[1] * c + m[3] * s) * sx;
        im[2] = (-m[0] * s + m[2] * c) * sy; im[3] = (-m[1] * s + m[3] * c) * sy; im[4] = x; im[5] = y;
        r._writePart(batch, o.zOrder * 1048576 + o.arrival + (d.orderSensitive ? i / Math.max(1, d.TotalParticles) : 0), this.part, im, color, alpha);
      }
      r._objectDrawFlags = previousFlags;
    }
  }
  window.parseGDParticleString = parseGDParticleString;
  window.cocosParticlePreset = cocosParticlePreset;
  window.GDParticleSystem = GDParticleSystem;
})();
