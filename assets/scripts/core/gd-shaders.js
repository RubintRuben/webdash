// Shader triggers, ported from the supplied GeometryDash.exe:
//   GJBaseGameLayer::triggerShaderCommand  (RVA 0x328da0, switch on id - 2904)
//   ShaderLayer::trigger*                  (0x624d50 .. 0x629df0)
//   GJShaderState::updateTweenAction       (0x622470, action -> state field)
//   ShaderLayer::performCalculations       (0x6292e0, the pre*Shader passes)
//   ShaderLayer centre / bulge / pinch     (0x623ef0)
//   GJBaseGameLayer shader update          (0x32a030: tints, targets, z range)
// ShaderGameObject fields and their save keys come from customObjectSetup
// (0x63c840) and its constructor/customSetup defaults. The GPU program is the
// native GLSL (gd-native-shader.js).
(function () {
  "use strict";
  const IDS = new Set([2904, 2905, 2907, 2909, 2910, 2911, 2912, 2913, 2914, 2915, 2916, 2917, 2919, 2920, 2921, 2922, 2923, 2924]);
  // A trigger value equal to this leaves the state value untouched.
  const SENTINEL = -909190;
  // 1 / (960 / sqrt(960^2 + 640^2)), the static the native code divides by.
  const G = Math.sqrt(960 * 960 + 640 * 640) / 960;
  // updateZLayer index (1..15) -> lowest/highest z order inside the shader.
  // 1 BG, 2 MG, 3 B5, 4 B4, 5 B3, 6 B2, 7 B1, 8 P, 9 T1, 10 T2, 11 T3, 12 T4, 13 G, 14 UI, 15 Max.
  const Z_MIN = [0, -1600, -1600, -1500, -1200, -900, -600, -300, 39, 100, 400, 700, 1000, 1400, 1400, 1400];
  const Z_MAX = [0, -1600, -1600, -1201, -901, -601, -301, 38, 61, 399, 699, 999, 1399, 1399, 1399, 1400];

  // ShaderGameObject::customObjectSetup stores 0 for every key the save string
  // does not contain (getSaveString omits zeros), clamps to +-1e9 and maps NaN
  // to 0. The constructor's 1.0 defaults only apply to editor-placed objects.
  function shaderValue(raw, id, key) {
    if (raw[key] === undefined || raw[key] === "") return 0;
    const value = Number(raw[key]);
    return Number.isFinite(value) ? Math.max(-1e9, Math.min(1e9, value)) : 0;
  }
  const flag = (raw, key) => raw[key] === "1";

  // GJShaderState action ids (the tween table at 0x622718).
  const A = {
    chromaticX: 1, chromaticY: 2, cgSpeed: 3, cgStrength: 4, cgRGB: 5, cgLineThick: 6, cgLineStrength: 7, cgHeight: 8,
    pixelX: 9, pixelY: 10, lensSize: 11, lensFade: 12, lensStrength: 13, lensOX: 14, lensOY: 15,
    radialSize: 16, radialOX: 17, radialOY: 18, motionX: 19, motionY: 20,
    bulge: 21, bulgeOX: 22, bulgeOY: 23, bulgeRadius: 24,
    pinchX: 25, pinchY: 26, pinchOX: 27, pinchOY: 28, pinchRadius: 29, pinchModX: 30, pinchModY: 31,
    gray: 32, sepia: 33, invert: 34, invertR: 35, invertG: 36, invertB: 37, hue: 38,
    cr: 39, cg: 40, cb: 41, br: 42, bg: 43, bb: 44, splitRows: 45, splitCols: 46,
    blurIntensity: 47, blurFade: 48, glitch: 49,
    lineSpeed: 50, lineThickness: 51, lineStrength: 52, lineWidth: 53, lineIn: 54, lineOut: 55, lineOffset: 56, lineMax: 57, lineTime: 58,
    waveSpeed: 59, waveThickness: 60, waveStrength: 61, waveWidth: 62, waveIn: 63, waveOut: 64, waveTime: 65, waveInner: 66,
    waveX: 67, waveY: 68, waveOuter: 69, waveMax: 70
  };

  class GDShaderState {
    constructor(level) { this.level = level; this.reset(); }

    reset() {
      const v = this.v = new Array(71).fill(0);
      v[A.lensSize] = 1; v[A.pixelX] = 1; v[A.pixelY] = 1;
      v[A.invertR] = v[A.invertG] = v[A.invertB] = 1;
      v[A.cr] = v[A.cg] = v[A.cb] = 1;
      this.tweens = {};
      this.time = 0;
      this.s = {
        zMin: 1, zMax: 15, noPlayerParticles: false,
        refChannel: 0, onlyEmpty: false,
        radialTarget: false, radialTargetID: 0,
        lensTargetID: 0, lensTint: 0, lensRelative: false, lensAdditive: false,
        bulgeTargetID: 0, bulgeRelative: false,
        pinchTargetX: false, pinchTargetY: false, pinchTargetIDX: 0, pinchTargetIDY: 0, pinchRelative: false,
        motionDual: false, motionRelative: false, motionEaseX: 1, motionEaseY: 1, motionIDX: 0, motionIDY: 0,
        motionSpeedX: 0, motionSpeedY: 0, motionLast: {},
        glitchSpeed: 0.001, glitchSlice: 0, glitchSliceX: 0, glitchColX: 0, glitchColY: 0, glitchRelative: false,
        chromaticRelative: false,
        cgEnable: false, cgRelative: false, cgRelativePos: false,
        pixelSnap: false, pixelHard: false, pixelRelative: false,
        grayLum: false, grayTint: -1,
        invertClamp: false,
        shock: null, line: null
      };
      // Retained for code that inspects active effects (practice/debug).
      this.effects = {};
      this.disabled = false;
    }

    // GJShaderState::tweenValue / ShaderLayer::tweenValueAuto
    tween(from, to, action, duration, easing, rate) {
      delete this.tweens[action];
      if (!(duration > 0)) { this.v[action] = to; return; }
      this.tweens[action] = { from, to, duration, elapsed: 0, easing: easing | 0, rate: Number.isFinite(rate) ? rate : 2 };
    }
    auto(value, action, duration, easing, rate) {
      if (!Number.isFinite(value) || value === SENTINEL) return;
      this.tween(duration > 0 ? this.v[action] : 0, value, action, duration, easing, rate);
    }

    trigger(trig) {
      const raw = trig.raw || {}, id = Number(trig.id);
      const n = key => shaderValue(raw, id, key);
      const fade = Number(raw[10]) || 0, easing = Number(raw[30]) || 0, rate = raw[85] !== undefined ? Number(raw[85]) : 2;
      // triggerShaderCommand: P1 (138) / P2 (200) / ... (201) select a player target.
      const target = flag(raw, 138) ? -1 : flag(raw, 200) ? -2 : flag(raw, 201) ? -3 : (Number(raw[51]) || 0);
      const s = this.s;
      this.effects[id] = { trig, raw, born: this.time };
      switch (id) {
        case 2904: { // updateZLayer(min, max, flag) then resetAllShaders on Disable All
          const min = parseInt(raw[196] ?? "0", 10), max = parseInt(raw[197] ?? "0", 10);
          s.zMin = min > 0 ? min : 1; s.zMax = max > 0 ? max : 15;
          s.noPlayerParticles = flag(raw, 188);
          if (flag(raw, 192)) {
            const keep = { zMin: s.zMin, zMax: s.zMax, noPlayerParticles: s.noPlayerParticles };
            this.reset(); Object.assign(this.s, keep, { zMin: 1, zMax: 15 });
          }
          this.disabled = false;
          return;
        }
        case 2905: case 2907: { // shock wave / shock line
          const key = id === 2905 ? "shock" : "line", prefix = id === 2905 ? "wave" : "line";
          const data = { kind: id,
            invert: flag(raw, 184), inner: n(183), maxSize: n(512), flip: flag(raw, 185), rotate: flag(raw, 186),
            dual: flag(raw, 187), useTarget: flag(raw, 188), follow: flag(raw, 190), relative: flag(raw, 514),
            target, start: this.time, phase: 0, position: flag(raw, 188) ? this._targetPosition(target) : null };
          // Native triggerShockWave/Line initializes a fresh effect at its
          // saved values immediately (624dbc..624e4a). FadeTime applies only
          // to Animate edits; fading a fresh wave also changes its phase.
          const animate = flag(raw, 513);
          if (!animate || !s[key]) s[key] = data;
          const fields = { Speed: 175, Thickness: 180, Strength: 176, Width: 179, In: 181, Out: 182, Time: 177 };
          if (id === 2905) Object.assign(fields, { Inner: 183, X: 290, Y: 291, Outer: 512, Max: 191 });
          else Object.assign(fields, { Offset: 290, Max: 512 });
          for (const [name, property] of Object.entries(fields)) this.auto(n(property), A[prefix + name], animate ? fade : 0, easing, rate);
          return;
        }
        case 2909: // inline triggerGlitch
          this.tween(this.v[A.glitch], n(176), A.glitch, fade, 0, 0);
          s.glitchSpeed = Math.max(0.001, n(175)); s.glitchSlice = n(179); s.glitchSliceX = n(191);
          s.glitchColX = n(181); s.glitchColY = n(182); s.glitchRelative = flag(raw, 514);
          return;
        case 2910: // triggerChromaticX/Y
          if (flag(raw, 188)) { this.auto(n(180), A.chromaticX, fade, easing, rate); s.chromaticRelative = flag(raw, 514); }
          if (flag(raw, 190)) { this.auto(n(189), A.chromaticY, fade, easing, rate); s.chromaticRelative = flag(raw, 514); }
          return;
        case 2911: // triggerChromaticGlitch(enable = !disable)
          s.cgEnable = !flag(raw, 192); s.cgRelative = flag(raw, 514); s.cgRelativePos = flag(raw, 194);
          this.auto(n(191), A.cgSpeed, fade, easing, rate); this.auto(n(176), A.cgStrength, fade, easing, rate);
          this.auto(n(180), A.cgRGB, fade, easing, rate); this.auto(n(179), A.cgLineThick, fade, easing, rate);
          this.auto(n(189), A.cgLineStrength, fade, easing, rate);
          // Steam 626c27: SegmentH is converted to reciprocal frequency
          // before tweening. Passing the height directly makes fine dark
          // stripes cover the entire screen (225x too dense for height 15).
          this.auto(n(175) === SENTINEL ? SENTINEL : 1 / Math.max(0.1, n(175)), A.cgHeight, fade, easing, rate);
          return;
        case 2912: // inline triggerPixelateX/Y
          if (flag(raw, 188)) {
            if (this.v[A.pixelX] < 1) this.v[A.pixelX] = 1;
            this.auto(n(180), A.pixelX, fade, easing, rate);
            s.pixelSnap = flag(raw, 194); s.pixelRelative = flag(raw, 514); s.pixelHard = flag(raw, 515);
          }
          if (flag(raw, 190)) {
            if (this.v[A.pixelY] < 1) this.v[A.pixelY] = 1;
            this.auto(n(189), A.pixelY, fade, easing, rate);
            s.pixelSnap = flag(raw, 194); s.pixelRelative = flag(raw, 514); s.pixelHard = flag(raw, 515);
          }
          return;
        case 2913: // triggerLensCircle(fade, size 179, fade 181, strength 176, target, tint 71, ox 290, oy 291, ..., relative 514)
          this.auto(n(181), A.lensFade, fade, easing, rate);
          this.auto(n(179), A.lensSize, fade, easing, rate);
          // ShaderLayer::triggerLensCircle (6277af..627804) clamps
          // strength through cocos2d::clampf before scheduling its tween.
          // Authored values above one otherwise produce negative RGB
          // outside the lens (Skeletal's chase uses strength 10).
          this.auto(Math.max(0, Math.min(1, n(176))), A.lensStrength, fade, easing, rate);
          this.auto(n(290), A.lensOX, fade, easing, rate);
          this.auto(n(291), A.lensOY, fade, easing, rate);
          s.lensTargetID = target; s.lensTint = Number(raw[71]) || 0; s.lensRelative = flag(raw, 514);
          s.lensAdditive = flag(raw, 184);
          return;
        case 2914: // triggerRadialBlur(fade, size 179, intensity 176, fade 181, ref 71, ox, oy, target 188, id, ..., emptyOnly 515)
          s.refChannel = Number(raw[71]) || 0;
          this.auto(n(181), A.blurFade, fade, easing, rate);
          this.auto(n(176), A.blurIntensity, fade, easing, rate);
          this.auto(n(179), A.radialSize, fade, easing, rate);
          this.auto(n(290), A.radialOX, fade, easing, rate);
          this.auto(n(291), A.radialOY, fade, easing, rate);
          s.radialTarget = flag(raw, 188); s.radialTargetID = target; s.onlyEmpty = flag(raw, 515);
          return;
        case 2915: // inline triggerMotionBlurX/Y
          for (const [use, key, action, easeKey, idKey] of [[188, 180, A.motionX, "motionEaseX", "motionIDX"], [190, 189, A.motionY, "motionEaseY", "motionIDY"]]) {
            if (!flag(raw, use)) continue;
            s.refChannel = Number(raw[71]) || 0;
            this.auto(n(181), A.blurFade, fade, 0, 0);
            this.auto(n(176), A.blurIntensity, fade, 0, 0);
            this.auto(n(key), action, fade, easing, rate);
            s.motionDual = flag(raw, 194); s.motionRelative = flag(raw, 514);
            s[easeKey] = n(191); s[idKey] = target; s.onlyEmpty = flag(raw, 515);
          }
          return;
        case 2916: // triggerBulge(fade, bulge 176, ox 290, oy 291, radius 180, target, ..., relative 514)
          this.auto(n(176), A.bulge, fade, easing, rate);
          this.auto(n(290), A.bulgeOX, fade, easing, rate);
          this.auto(n(291), A.bulgeOY, fade, easing, rate);
          this.auto(n(180), A.bulgeRadius, fade, easing, rate);
          s.bulgeRelative = flag(raw, 514); s.bulgeTargetID = flag(raw, 188) ? target : 0;
          return;
        case 2917: // triggerPinchX (use 190) / triggerPinchY (use 194): radius 512, modifier 179
          if (flag(raw, 190)) {
            this.auto(n(180), A.pinchX, fade, easing, rate); this.auto(n(290), A.pinchOX, fade, easing, rate);
            this.auto(n(512), A.pinchRadius, fade, easing, rate); this.auto(n(179), A.pinchModX, fade, easing, rate);
            s.pinchTargetIDX = target; s.pinchTargetX = flag(raw, 188); s.pinchRelative = flag(raw, 514);
          }
          if (flag(raw, 194)) {
            this.auto(n(189), A.pinchY, fade, easing, rate); this.auto(n(291), A.pinchOY, fade, easing, rate);
            this.auto(n(512), A.pinchRadius, fade, easing, rate); this.auto(n(179), A.pinchModY, fade, easing, rate);
            s.pinchTargetIDY = target; s.pinchTargetY = flag(raw, 188); s.pinchRelative = flag(raw, 514);
          }
          return;
        case 2919: // gray scale: value 176, luminance 188, tint channel (51) when 190
          if (flag(raw, 190)) s.grayTint = Number(raw[51]) || 0;
          s.grayLum = flag(raw, 188);
          this.auto(n(176), A.gray, fade, easing, rate);
          return;
        case 2920: this.auto(n(176), A.sepia, fade, easing, rate); return;
        case 2921: // triggerInvertColor(fade, target 176, r 179, g 180, b 189, editRGB 188, tweenRGB 190, clamp 194)
          this.auto(n(176), A.invert, fade, easing, rate);
          if (flag(raw, 188)) {
            const tweenRGB = flag(raw, 190);
            this.auto(n(179), A.invertR, tweenRGB ? fade : 0, easing, rate);
            this.auto(n(180), A.invertG, tweenRGB ? fade : 0, easing, rate);
            this.auto(n(189), A.invertB, tweenRGB ? fade : 0, easing, rate);
          } else {
            this.v[A.invertR] = this.v[A.invertG] = this.v[A.invertB] = 1;
          }
          s.invertClamp = flag(raw, 194);
          return;
        case 2922: this.auto(n(176), A.hue, fade, easing, rate); return;
        case 2923: // triggerColorChange(fade, cr 176, cg 191, cb 175, br 179, bg 180, bb 189)
          this.auto(n(179), A.br, fade, easing, rate); this.auto(n(180), A.bg, fade, easing, rate);
          this.auto(n(189), A.bb, fade, easing, rate); this.auto(n(176), A.cr, fade, easing, rate);
          this.auto(n(191), A.cg, fade, easing, rate); this.auto(n(175), A.cb, fade, easing, rate);
          return;
        case 2924: // split screen: cols 180 (use 188), rows 189 (use 190)
          if (flag(raw, 188)) this.auto(n(180), A.splitCols, fade, easing, rate);
          if (flag(raw, 190)) this.auto(n(189), A.splitRows, fade, easing, rate);
          return;
      }
    }

    step(dt) {
      this.time += dt;
      for (const key of Object.keys(this.tweens)) {
        const t = this.tweens[key];
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        const e = typeof Easing !== "undefined" ? Easing.sample(t.easing, t.rate, p) : p;
        this.v[key] = t.from + (t.to - t.from) * e;
        if (p >= 1) delete this.tweens[key];
      }
      if (this.s.shock) this.s.shock.phase += dt * this.v[A.waveSpeed];
      if (this.s.line) this.s.line.phase += dt * this.v[A.lineSpeed];
      // GJBaseGameLayer: motion blur follows its target's velocity with an ease.
      const s = this.s;
      for (const [idKey, axis, easeKey, speedKey] of [["motionIDX", 0, "motionEaseX", "motionSpeedX"], ["motionIDY", 1, "motionEaseY", "motionSpeedY"]]) {
        const id = s[idKey];
        if (!id) continue;
        const pos = this._targetPosition(id);
        const last = s.motionLast[idKey];
        s.motionLast[idKey] = pos;
        if (!pos || !last || !(dt > 0)) continue;
        const velocity = (axis ? pos.y - last.y : pos.x - last.x) / (dt * 60);
        let divisor = s[easeKey];
        if (divisor > 1) { divisor /= dt * 60; s[speedKey] += (velocity - s[speedKey]) / divisor; }
        else s[speedKey] = velocity;
      }
    }

    // ------------------------------------------------------------ helpers
    _targetPosition(id) {
      const level = this.level, scene = level._scene;
      if (id === -1 || id === -3) return scene ? { x: (scene._playerWorldX || 0) / 2, y: (scene._state?.y || 0) / 2 } : null;
      if (id === -2) return scene?._player2 ? { x: (scene._secondaryWorldX ?? scene._playerWorldX ?? 0) / 2, y: (scene._state2?.y || 0) / 2 } : null;
      if (!(id > 0)) return null;
      const obj = level._moveGroupParent?.(id);
      return obj ? level.gdRenderer.livePosition(obj) : null;
    }
    // ShaderLayer::objectPosToShaderPos: normalised texture position, y up.
    _project(p) {
      const level = this.level, cam = level.gdRenderer?.camera || { x: 0, y: 0, w: 569, h: 320 };
      if (level.cameraState?.camera) return level.cameraState.project(p.x, p.y);
      return [(p.x - cam.x) / cam.w, (p.y - cam.y) / cam.h];
    }
    // The untargeted centre: (0.5 + off * 0.5) turned with the camera.
    _centre(ox, oy) {
      let x = 0.5 + ox * 0.5, y = 0.5 + oy * 0.5;
      const deg = Number(this.level.cameraState?.values?.rotation) || 0;
      if (deg) {
        const a = -deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), aspect = this._aspect();
        const dx = x - 0.5, dy = (y - 0.5) * aspect;
        x = 0.5 + dx * c - dy * s; y = 0.5 + (dx * s + dy * c) / aspect;
      }
      return [x, y];
    }
    _centreFor(targetID, useTarget, ox, oy) {
      if (useTarget && targetID) {
        const p = this._targetPosition(targetID);
        if (p) return this._project(p);
      }
      return this._centre(ox, oy);
    }
    _size() {
      const scene = this.level._scene;
      return { w: (scene?.scale?.width || 1138) / 2, h: (scene?.scale?.height || 640) / 2 };
    }
    _aspect() { const { w, h } = this._size(); return h / w; }
    _zoom() { return Math.abs(Number(this.level.cameraState?.values?.zoom) || 1); }
    _channelColor(id, fallback) {
      const cm = this.level._scene?._colorManager;
      if (!(id > 0)) return fallback;
      if (id === 1010) return [0, 0, 0];
      if (id === 1011 || !cm) return [1, 1, 1];
      return cm.getFinal(id).map(v => v / 255);
    }

    // ShaderLayer::performCalculations and the pre*Shader passes.
    uniforms() {
      const { w: winW, h: winH } = this._size(), aspect = winH / winW;
      const u = { _textureScale: [1, 1], _textureScaleInv: [1, 1], _screenAspect: aspect, _screenAspectInv: 1 / aspect,
        _rowmod: 1, _colmod: 1, _splitXRange: 1, _splitYRange: 1, _splitXRangeMult: 1, _splitYRangeMult: 1,
        _grayscaleTint: [1, 1, 1], _blurIntensity: 1 };
      const scene = this.level._scene;
      if (this.disabled || window.noShaders || scene?._menuActive) return u;
      const v = this.v, s = this.s, K = G * 480 / winW, zoom = this._zoom();
      // preCommonShader
      const bg = scene?._colorManager?.getFinal?.(1000) || [0, 0, 0];
      u._blurRefColor = s.refChannel > 0 ? this._channelColor(s.refChannel, [1, 1, 1]) : bg.map(c => c / 255);
      u._blurUseRef = s.zMin > 1;
      u._blurIntensity = v[A.blurIntensity] + 1;
      u._blurOnlyEmpty = s.zMin > 1 && s.onlyEmpty;
      // preShockWaveShader / preShockLineShader (Steam 625520 / 6260f0).
      for (const data of [s.shock, s.line]) {
        if (!data) continue;
        const wave = data.kind === 2905, key = wave ? "wave" : "line", prefix = wave ? "_shockWave" : "_shockLine";
        const get = name => v[A[key + name]], strength = get("Strength");
        if (!(strength > 0)) continue;
        const scale = (data.relative ? zoom : 1) * K;
        const thickness = Math.max(.001, get("Thickness")) * .2;
        const fadeIn = thickness * get("In"), fadeOut = thickness * get("Out");
        const phase = data.phase + get("Time") * .1, frequency = 22 / Math.max(.001, get("Width"));
        const t = wave ? (data.invert ? phase : phase * phase)
          : data.invert ? (data.dual ? .5 : 1) * (fadeIn + thickness + fadeOut) - phase : phase;
        const t2 = t - fadeIn, t3 = Math.min(t2, t2 - thickness), t4 = Math.min(t3, t3 - fadeOut);
        u[prefix + "Time"] = (phase * frequency) % (Math.PI * 2);
        u[prefix + "Time1"] = (t2 + fadeIn + .001) * scale; u[prefix + "Time2"] = t2 * scale;
        u[prefix + "Time3"] = (t3 + .001) * scale; u[prefix + "Time4"] = t4 * scale;
        u[prefix + "Waves"] = frequency / scale;
        const outer = wave ? get("Outer") : get("Max");
        u[prefix + "MaxDistVal"] = outer === 0 ? 0 : 1 / (outer * .5 * scale);
        const position = data.useTarget && (data.follow ? this._targetPosition(data.target) : data.position);
        const centre = position ? this._project(position) : wave ? this._centre(get("X"), get("Y"))
          : this._centre(data.rotate ? 0 : get("Offset"), data.rotate ? get("Offset") : 0);
        if (wave) {
          u._shockWaveCenter = centre; u._shockWaveStrength = strength * .1 * scale;
          u._shockWaveInvert = data.invert; u._shockWaveMaxSize = get("Max") * scale; u._shockWaveMinSize = get("Inner") * .5 * scale;
        } else {
          u._shockLineCenter = data.rotate ? centre[1] : centre[0];
          u._shockLineAxis = data.rotate; u._shockLineDirection = data.flip; u._shockLineDual = data.dual;
          u._shockLineStrength = [strength * .01 * scale, strength * .01 * scale];
        }
      }
      // preGlitchShader (0x626660)
      if (v[A.glitch] > 0) {
        const rel = (s.glitchRelative ? zoom : 1) * K, strength = v[A.glitch];
        const t = Math.fround(Math.sin(s.glitchSpeed * this.time * 20));
        const rnd = c => { const x = Math.fround(Math.fround(Math.sin(t * 12.9898 + c * 4.1414)) * 43758.5453); return x - Math.floor(x); };
        const bot = rnd(2345) * rel;
        let top = rnd(9035) * s.glitchSlice * strength * rel + bot;
        top = Math.floor(top) + top;
        const xo = s.glitchSliceX * strength * 0.02 * rel;
        const cy = s.glitchColY * strength * 0.02 * rel, cx = s.glitchColX * strength * 0.02 * rel;
        u._glitchBot = bot / aspect;
        u._glitchTop = top / aspect;
        u._glitchXOffset = rnd(9625) * 2 * xo - xo;
        const colY = rnd(7205) * 2 * cy - cy, colX = rnd(9545) * 2 * cx - cx;
        u._glitchColOffset = [colX, colY / aspect];
        u._glitchRnd = rnd(9545);
      }
      // chromatic (performCalculations)
      const chromaRel = s.chromaticRelative ? zoom : 1;
      u._chromaticXOff = v[A.chromaticX] / (G * winW) * chromaRel;
      u._chromaticYOff = v[A.chromaticY] / (G * winH) * chromaRel;
      // chromatic glitch (approximate timing, native parameters)
      if (s.cgEnable && (v[A.cgRGB] || v[A.cgStrength] || v[A.cgLineThick])) {
        const rel = (s.cgRelative ? zoom : 1) * K;
        // preChromaticGlitchShader (Steam 627005, 62706a) multiplies
        // RGB offset by 0.1 twice; only exactly zero uses the 0.001 fallback.
        // A single multiplication made Skeletal's coloured edges 10x wider.
        const rgb = v[A.cgRGB] * 0.1;
        u._cGTime = this.time * v[A.cgSpeed]; u._cGRGBOffset = (rgb === 0 ? 0.001 : rgb) * 0.1 * rel;
        u._cGStrength = v[A.cgStrength] * 0.02 * rel; u._cGHeight = v[A.cgHeight] / (rel / aspect || 1);
        u._cGLineThick = v[A.cgLineStrength] === 0 ? 0 : Math.max(0.001, 1 - rel * v[A.cgLineThick] * 0.2);
        u._cGLineStrength = v[A.cgLineStrength] * 0.05;
        u._cGYOffset = 0;
      }
      // prePixelateShader: the native game lowers the render scale; here a grid prepass.
      if (v[A.pixelX] > 1 || v[A.pixelY] > 1) {
        const rel = s.pixelRelative ? zoom : 1;
        u._gdPixelSize = [v[A.pixelX] > 1 ? v[A.pixelX] * rel / winW : 0, v[A.pixelY] > 1 ? v[A.pixelY] * rel / winH : 0];
      }
      // preLensCircleShader (0x627a40)
      if (v[A.lensStrength] > 0) {
        const scale = (s.lensRelative ? zoom : 1) * v[A.lensSize] * K;
        u._lensCircleStart = Math.max(0, scale - Math.max(v[A.lensFade], 0));
        u._lensCircleEnd = Math.max(scale, 0);
        u._lensCircleStrength = v[A.lensStrength];
        u._lensCircleTint = s.lensTint > 0 ? this._channelColor(s.lensTint, [0, 0, 0]) : [0, 0, 0];
        u._lensCircleAdditive = s.lensAdditive;
        const c = this._centreFor(s.lensTargetID, !!s.lensTargetID, v[A.lensOX], v[A.lensOY]);
        u._lensCircleOrigin = [c[0], c[1] * aspect];
      }
      // radial blur: size / 45, fade clamp(fade * 0.2, 0, 0.2)
      if (v[A.radialSize] !== 0) {
        u._radialBlurValue = v[A.radialSize] / 9 * 0.2;
        u._blurFade = Math.max(0, Math.min(v[A.blurFade] * 0.2, 0.2));
        u._radialBlurCenter = this._centreFor(s.radialTargetID, s.radialTarget, v[A.radialOX], v[A.radialOY]);
      }
      // bulge (0x623ef0)
      if (v[A.bulge] > 0) {
        const scale = (s.bulgeRelative ? zoom : 1) * K, len = 0.5 * scale * G * G * Math.SQRT2;
        const value = Math.max(0.001, Math.PI / len * 0.45 * v[A.bulge]);
        u._bulgeValue = value; u._bulgeValue2 = len / Math.tan(value * len);
        u._bulgeRadius = scale * v[A.bulgeRadius];
        u._bulgeOrigin = this._centreFor(s.bulgeTargetID, !!s.bulgeTargetID, v[A.bulgeOX], v[A.bulgeOY]);
      }
      // pinch (0x623ef0)
      let px = v[A.pinchX], py = v[A.pinchY];
      if (px !== 0 || py !== 0) {
        if (px === 0) px = 0.001;
        if (py === 0) py = 0.001;
        const scale = (s.pinchRelative ? zoom : 1) * K;
        u._pinchValue = [-px * 0.1, -py * 0.1];
        const id = s.pinchTargetX ? s.pinchTargetIDX : s.pinchTargetIDY;
        u._pinchCenterPos = this._centreFor(id, s.pinchTargetX || s.pinchTargetY, v[A.pinchOX], v[A.pinchOY]);
        u._pinchRadius = scale * v[A.pinchRadius];
        const mx = Math.max(0.001, v[A.pinchModX]), my = Math.max(0.001, v[A.pinchModY]);
        u._pinchCalc1 = [mx / Math.atan(px * 2 * mx), my / Math.atan(py * 2 * my)];
      }
      // preMotionBlurShader (0x627f10)
      const mx = v[A.motionX], my = v[A.motionY];
      if (mx !== 0 || my !== 0) {
        let sx = s.motionIDX ? s.motionSpeedX : 1, sy = s.motionIDY ? s.motionSpeedY : 1;
        if (sx === 0) sx = 0.001;
        if (sy === 0) sy = 0.001;
        const rel = s.motionRelative ? zoom : 1;
        u._motionBlurValue = [sx * mx * 0.1 * rel * K, sy * my * 0.1 * rel * K * (winW / winH)];
        if (v[A.radialSize] === 0) {
          const f = s.motionDual ? 0.2 : 0.1;
          const blurFade = Math.max(-f, Math.min(f * v[A.blurFade], f));
          u._blurFade = blurFade;
          u._motionBlurMult = 1 / (9 - (s.motionDual ? 20 : 36) * blurFade);
          u._motionBlurDual = s.motionDual;
        } else u._motionBlurMult = 1;
      }
      // grayscale / sepia / invert / hue / colour change
      if (v[A.gray] > 0) {
        u._grayscaleValue = v[A.gray]; u._grayscaleUseLum = s.grayLum;
        u._grayscaleTint = s.grayTint > 0 ? this._channelColor(s.grayTint, [1, 1, 1]) : [1, 1, 1];
      }
      u._sepiaValue = v[A.sepia];
      if (v[A.invert] > 0) {
        let r = v[A.invert] * v[A.invertR], g = v[A.invert] * v[A.invertG], b = v[A.invert] * v[A.invertB];
        if (s.invertClamp) { r = Math.min(r, 1); g = Math.min(g, 1); b = Math.min(b, 1); }
        u._invertColorValue = [r, g, b, v[A.invert]];
      }
      if (v[A.hue] !== 0) {
        const a = v[A.hue] * 0.01745329238474369;
        u._hueShiftCosA = Math.cos(a); u._hueShiftSinA = Math.sin(a);
      }
      if (v[A.cr] !== 1 || v[A.cg] !== 1 || v[A.cb] !== 1 || v[A.br] !== 0 || v[A.bg] !== 0 || v[A.bb] !== 0) {
        u._colorChangeC = [Math.max(v[A.cr], 0.001), v[A.cg], v[A.cb]];
        u._colorChangeB = [v[A.br], v[A.bg], v[A.bb]];
      }
      // preSplitScreenShader (0x628fb0)
      if (v[A.splitRows] !== 0 || v[A.splitCols] !== 0) {
        u._rowmod = v[A.splitRows] + 1; u._colmod = v[A.splitCols] + 1;
        u._rowmodCalc = (1 - u._rowmod); u._colmodCalc = (1 - u._colmod);
      }
      return u;
    }

    // Native z range of the shader layer as z orders (see Z_MIN / Z_MAX).
    zRange() {
      const s = this.s;
      let lo = Z_MIN[Math.max(1, Math.min(15, s.zMin))], hi = Z_MAX[Math.max(1, Math.min(15, s.zMax))];
      if (s.noPlayerParticles) { if (s.zMin === 8) lo = 40; if (s.zMax === 8) hi = 60; }
      return { min: s.zMin, max: s.zMax, lo, hi };
    }

    bandForZ(z) {
      const { lo, hi } = this.zRange();
      return z < lo ? -1 : z > hi ? 1 : 0;
    }

    capture() { return structuredClone({ v: this.v, tweens: this.tweens, time: this.time, s: this.s, disabled: this.disabled }); }
    restore(data) {
      if (!data) return;
      const copy = structuredClone(data);
      if (Array.isArray(copy.v)) { this.v = copy.v; this.tweens = copy.tweens || {}; this.time = copy.time || 0; Object.assign(this.s, copy.s || {}); this.disabled = !!copy.disabled; }
    }
    attach() {
      const scene = this.level._scene, pipelines = scene.game?.renderer?.pipelines;
      if (!pipelines || !window.GD_NATIVE_SHADER || !Phaser.Renderer?.WebGL?.Pipelines?.PostFXPipeline) return;
      if (!pipelines.postPipelineClasses?.has("GDNativeFX")) {
        class GDNativeFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
          constructor(game) {
            // Native colour effects can write RGB into an empty texel while
            // preserving its zero alpha. Phaser composites post effects with
            // premultiplied blending; give it premultiplied output as well.
            // Otherwise a player-only invert turns the entire background white.
            const fragment = window.GD_NATIVE_SHADER.replace(/}\s*$/, 'gl_FragColor.rgb *= gl_FragColor.a;\n}');
            super({ game, name: "GDNativeFX", renderTarget: true, fragShader: fragment });
          }
          onPreRender() {
            const values = this.gdState?.uniforms() || {};
            for (const [type, name] of this.gdUniforms) {
              const value = values[name];
              if (type === "vec2") this.set2f(name, ...(value || [0, 0]));
              else if (type === "vec3") this.set3f(name, ...(value || [0, 0, 0]));
              else if (type === "vec4") this.set4f(name, ...(value || [0, 0, 0, 0]));
              else if (type === "bool") this.set1i(name, value ? 1 : 0);
              else this.set1f(name, value || 0);
            }
          }
        }
        pipelines.addPostPipeline("GDNativeFX", GDNativeFX);
      }
      // The shader captures only the saved z interval. Cameras below and
      // above it composite the remaining layers without the post effect.
      this.level.cameraState?.attachShaderBands();
      if (this.level.gdRenderer) this.level.gdRenderer.shaderState = this;
      const camera = scene._gameplayCamera || scene.cameras.main;
      camera.setPostPipeline("GDNativeFX");
      const pipeline = camera.getPostPipeline("GDNativeFX");
      pipeline.gdState = this;
      pipeline.gdUniforms = Array.from(window.GD_NATIVE_SHADER.matchAll(/uniform\s+(?:PRECISION\s+)?(float|bool|vec[234])\s+(\w+)\s*;/g), m => [m[1], m[2]]);
      this.pipeline = pipeline;
    }
  }
  window.GDShaderState = GDShaderState;
  window.GD_SHADER_IDS = IDS;
  window.GD_SHADER_Z = { Z_MIN, Z_MAX };
})();
