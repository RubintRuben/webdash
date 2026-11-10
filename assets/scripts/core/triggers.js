class Easing {
  static sample(type, rate, x) {
    x = Math.max(0, Math.min(1, Number(x) || 0));
    rate = Number.isFinite(Number(rate)) && Number(rate) > 0 ? Number(rate) : 2;
    if (x === 0 || x === 1) return x;
    switch (type) {
      case 0: return x;
      case 1: return this._easeInOut(x, rate);
      case 2: return this._easeIn(x, rate);
      case 3: return this._easeOut(x, rate);
      case 4: return this._elasticInOut(x, rate);
      case 5: return this._elasticIn(x, rate);
      case 6: return this._elasticOut(x, rate);
      case 7: return this._bounceInOut(x);
      case 8: return this._bounceIn(x);
      case 9: return this._bounceOut(x);
      case 10: return this._expInOut(x);
      case 11: return this._expIn(x);
      case 12: return this._expOut(x);
      case 13: return this._sineInOut(x);
      case 14: return this._sineIn(x);
      case 15: return this._sineOut(x);
      case 16: return this._backInOut(x);
      case 17: return this._backIn(x);
      case 18: return this._backOut(x);
      default: return x;
    }
  };
  static _easeInOut(x, r) { const t=x*2; return t<1 ? 0.5*Math.pow(t,r) : 1-0.5*Math.pow(2-t,r); };
  static _easeIn(x, r) { return Math.pow(x, r); };
  static _easeOut(x, r) { return Math.pow(x, 1/r); };
  static _elasticInOut(x, p) {
    const period = p || 0.3 * 1.5; const s=period/4; const t=x*2-1;
    return t<0 ? -0.5*Math.pow(2,10*t)*Math.sin((t-s)*(2*Math.PI)/period)
               : Math.pow(2,-10*t)*Math.sin((t-s)*(2*Math.PI)/period)*0.5+1;
  };
  static _elasticIn(x, p) { const s=p/4; const t=x-1; return -Math.pow(2,10*t)*Math.sin((t-s)*(2*Math.PI)/p); };
  static _elasticOut(x, p) { const s=p/4; return Math.pow(2,-10*x)*Math.sin((x-s)*(2*Math.PI)/p)+1; };
  static _bounceTime(x) {
    if (x<1/2.75)          return 7.5625*x*x;
    else if (x<2/2.75)   { const t=x-1.5/2.75;  return 7.5625*t*t+0.75; }
    else if (x<2.5/2.75) { const t=x-2.25/2.75; return 7.5625*t*t+0.9375; }
    else                 { const t=x-2.625/2.75; return 7.5625*t*t+0.984375; }
  };
  static _bounceInOut(x) { return x<0.5 ? (1-this._bounceTime(1-x*2))*0.5 : this._bounceTime(x*2-1)*0.5+0.5; };
  static _bounceIn(x) { return 1-this._bounceTime(1-x); };
  static _bounceOut(x) { return this._bounceTime(x); };
  static _expInOut(x) { return x<0.5 ? 0.5*Math.pow(2,10*(x*2-1)) : 0.5*(-Math.pow(2,-10*(x*2-1))+2); };
  static _expIn(x) { return Math.pow(2,10*(x-1))-0.001; };
  static _expOut(x) { return -Math.pow(2,-10*x)+1; };
  static _sineInOut(x) { return -0.5*(Math.cos(x*Math.PI)-1); };
  static _sineIn(x) { return 1-Math.cos((x*Math.PI)/2); };
  static _sineOut(x) { return Math.sin((x*Math.PI)/2); };
  static _backInOut(x) {
    const ov=1.70158*1.525; const t=x*2;
    return t<1 ? (t*t*((ov+1)*t-ov))/2 : ((t-2)*(t-2)*((ov+1)*(t-2)+ov))/2+1;
  };
  static _backIn(x) { const ov=1.70158; return x*x*((ov+1)*x-ov); };
  static _backOut(x) { const ov=1.70158; const t=x-1; return t*t*((ov+1)*t+ov)+1; };
};

// GameToolbox::hsvFromString serializes HSV as
// h + "a" + s + "a" + v + "a" + absoluteSaturation + "a" + absoluteBrightness.
// GD calls the two flags "absolute" but they make the value additive.
function parseGdHSV(serialized) {
  const values = String(serialized ?? "").split("a");
  const numberAt = (index, fallback) => {
    const value = Number(values[index]);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    h: numberAt(0, 0),
    s: numberAt(1, 1),
    v: numberAt(2, 1),
    absoluteSaturation: values[3] === "1" || values[3] === "true",
    absoluteBrightness: values[4] === "1" || values[4] === "true"
  };
}

function gdIsDefaultHSV(hsv) {
  return !hsv || (hsv.h === 0 && hsv.s === 1 && hsv.v === 1 && !hsv.absoluteSaturation && !hsv.absoluteBrightness);
}

// Port of GameToolbox::transformColor (GD 2.2081) together with RobTop's
// CCControlUtils::HSVfromRGB / RGBfromHSV from libExtensions.dll.
//  - grey input has hue 0, black has hue -1
//  - hue is only rotated when the HSV hue is non-zero; > 360 wraps with an
//    integer modulo, < 0 adds 360 once
//  - saturation/brightness are multiplied (or added when "absolute") and are
//    clamped to [0.0001, 1]
//  - the final channels are truncated, not rounded
function gdTransformColorRGB(r, g, b, hsv, out) {
  out = out || [0, 0, 0];
  if (gdIsDefaultHSV(hsv)) {
    out[0] = r; out[1] = g; out[2] = b;
    return out;
  }
  const inv = 0.003921568859368563;
  const fr = Math.fround(r * inv), fg = Math.fround(g * inv), fb = Math.fround(b * inv);
  const mx = Math.max(fr, fg, fb);
  const mn = Math.min(fr, fg, fb);
  let h0, s0;
  const v0 = mx;
  const delta = mx - mn;
  if (mx > 0) {
    s0 = delta / mx;
    if (fr >= mx) h0 = delta === 0 ? 0 : (fg - fb) / delta;
    else if (fg >= mx) h0 = 2 + (fb - fr) / delta;
    else h0 = 4 + (fr - fg) / delta;
    h0 *= 60;
    if (h0 < 0) h0 += 360;
  } else {
    s0 = 0;
    h0 = -1;
  }
  let h = h0;
  const hueShift = Math.fround(Number(hsv.h) || 0);
  if (hueShift !== 0) {
    h = hueShift + h0;
    if (h < 0) h += 360;
    else if (h > 360) {
      const ih = Math.trunc(h);
      h = ih - Math.trunc(ih / 360) * 360;
    }
  }
  let s = hsv.absoluteSaturation ? Math.fround(hsv.s) + s0 : Math.fround(hsv.s) * s0;
  if (Math.min(1, s) < 0.0001) s = 0.0001; else if (s > 1) s = 1;
  let v = hsv.absoluteBrightness ? Math.fround(hsv.v) + v0 : Math.fround(hsv.v) * v0;
  if (Math.min(1, v) < 0.0001) v = 0.0001; else if (v > 1) v = 1;
  let rr, gg, bb;
  if (s <= 0) {
    rr = gg = bb = v;
  } else {
    let hh = h;
    if (hh >= 360) hh = 0;
    hh /= 60;
    const i = Math.trunc(hh);
    const ff = hh - i;
    const p = v * (1 - s);
    const q = v * (1 - s * ff);
    const t = v * (1 - s * (1 - ff));
    switch (i) {
      case 0: rr = v; gg = t; bb = p; break;
      case 1: rr = q; gg = v; bb = p; break;
      case 2: rr = p; gg = v; bb = t; break;
      case 3: rr = p; gg = q; bb = v; break;
      case 4: rr = t; gg = p; bb = v; break;
      default: rr = v; gg = p; bb = q; break;
    }
  }
  out[0] = Math.trunc(rr * 255) & 255;
  out[1] = Math.trunc(gg * 255) & 255;
  out[2] = Math.trunc(bb * 255) & 255;
  return out;
}

function transformGdHSVColor(color, hsv) {
  if (!hsv) return { ...color };
  const out = gdTransformColorRGB(Number(color?.r) || 0, Number(color?.g) || 0, Number(color?.b) || 0, hsv);
  return { r: out[0], g: out[1], b: out[2] };
}

// cocos-style colour lerp used by ColorAction::step, calculateInheritedColor
// and colorForPulseEffect: every channel is truncated toward zero.
function gdLerpColor(from, to, p, out) {
  out = out || [0, 0, 0];
  if (p <= 0) { out[0] = from[0]; out[1] = from[1]; out[2] = from[2]; return out; }
  if (p === 1) { out[0] = to[0]; out[1] = to[1]; out[2] = to[2]; return out; }
  const fp = Math.fround(p);
  out[0] = Math.trunc(Math.fround(Math.fround((to[0] - from[0]) * fp) + from[0]));
  out[1] = Math.trunc(Math.fround(Math.fround((to[1] - from[1]) * fp) + from[1]));
  out[2] = Math.trunc(Math.fround(Math.fround((to[2] - from[2]) * fp) + from[2]));
  return out;
}

function gdPlayerColor(which) {
  const value = which === 2 ? window.secondaryColor : window.mainColor;
  const v = Number(value) >>> 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// One colour channel: GD keeps a ColorAction (the fade) plus a
// ColorActionSprite (base colour 0x144, final colour 0x147, opacity 0x140).
class GDColorChannel {
  constructor(id) {
    this.id = id;
    this.from = [255, 255, 255];
    this.to = [255, 255, 255];
    this.color = [255, 255, 255];
    this.currentOpacity = 1;
    this.fromOpacity = 1;
    this.toOpacity = 1;
    this.deltaTime = 0;
    this.duration = 0;
    this.finished = true;
    this.blending = false;
    this.playerColor = 0;
    this.copyID = 0;
    this.copyHSV = null;
    this.copyOpacity = false;
    this.legacyHSV = false;
    this.copyLoop = false;
    this.calculated = false;
    // ColorActionSprite
    this.base = [255, 255, 255];
    this.final = [255, 255, 255];
    this.spriteOpacity = 255;
    this.version = 0;
  }
  step(dt) {
    if (this.finished) return;
    this.deltaTime += dt;
    const t = this.deltaTime;
    if (t >= this.duration) {
      this.color[0] = this.to[0]; this.color[1] = this.to[1]; this.color[2] = this.to[2];
      this.currentOpacity = this.toOpacity;
      this.finished = true;
      return;
    }
    let p = 0;
    if (t > 0) p = Math.min(1, t / this.duration);
    gdLerpColor(this.from, this.to, p, this.color);
    this.currentOpacity = this.fromOpacity + (this.toOpacity - this.fromOpacity) * p;
  }
}

// Port of GJEffectManager colour handling (processColors / ColorAction /
// PulseEffectAction / calculateInheritedColor / calculateLightBGColor).
class ColorManager {
  constructor() {
    this._initialDefs = {};
    this._initialColors = {};
    this.reset();
  }
  static get SPECIAL() {
    return { BG: 1000, G1: 1001, LINE: 1002, LINE3D: 1003, OBJ: 1004, P1: 1005, P2: 1006, LBG: 1007, G2: 1009, BLACK: 1010, WHITE: 1011, LIGHTER: 1012 };
  }
  _defaultFor(id) {
    if (id === 1000) return { r: 40, g: 125, b: 255 };
    if (id === 1001) return { r: 0, g: 102, b: 255 };
    return { r: 255, g: 255, b: 255 };
  }
  _channel(id, create = true) {
    let ch = this._channels.get(id);
    if (!ch && create) {
      ch = new GDColorChannel(id);
      const def = this._defaultFor(id);
      ch.from = [def.r, def.g, def.b];
      ch.to = [def.r, def.g, def.b];
      ch.color = [def.r, def.g, def.b];
      ch.base = [def.r, def.g, def.b];
      ch.final = [def.r, def.g, def.b];
      if (id === 1002) ch.blending = true;
      this._channels.set(id, ch);
    }
    return ch;
  }
  // Legacy API: colour may be a plain {r,g,b} or a full channel definition.
  setInitialColor(channelId, color) {
    const id = Number(channelId);
    this._initialDefs[id] = { ...color };
    this._initialColors[id] = { r: color.r, g: color.g, b: color.b };
    this._applyInitial(id, this._initialDefs[id]);
    this._dirtyChannels.add(String(id));
  }
  _applyInitial(id, def) {
    const ch = this._channel(id);
    const r = Number(def.r ?? 255) | 0, g = Number(def.g ?? 255) | 0, b = Number(def.b ?? 255) | 0;
    ch.from = [r, g, b]; ch.to = [r, g, b]; ch.color = [r, g, b];
    ch.base = [r, g, b]; ch.final = [r, g, b];
    ch.duration = 0; ch.deltaTime = 0; ch.finished = true;
    if (def.blending !== undefined) ch.blending = !!def.blending;
    if (id === 1002 && def.forceBlending) ch.blending = true;
    const op = def.opacity !== undefined ? Math.max(0, Math.min(1, Number(def.opacity))) : 1;
    ch.currentOpacity = op; ch.fromOpacity = op; ch.toOpacity = op;
    ch.spriteOpacity = op * 255;
    ch.playerColor = Number(def.playerColor) === 1 || Number(def.playerColor) === 2 ? Number(def.playerColor) : 0;
    ch.copyID = Number(def.copyID) > 0 ? Number(def.copyID) : 0;
    ch.copyHSV = def.copyHSV || null;
    ch.copyOpacity = !!def.copyOpacity;
    ch.legacyHSV = !!def.legacyHSV;
    ch.version++;
  }
  reset() {
    this._channels = new Map();
    this._pulses = [];
    this._groupPulses = new Map();
    this._groupPulseVersion = 0;
    this._dirtyChannels = new Set();
    this._coloredChannels = new Set();
    this._time = 0;
    for (const id of [1000, 1001, 1002, 1003, 1004, 1009]) this._channel(id);
    for (const id in this._initialDefs) this._applyInitial(Number(id), this._initialDefs[id]);
    for (const id of this._channels.keys()) this._dirtyChannels.add(String(id));
    this._lbg = [255, 255, 255];
    this.processColors();
  }
  // GJBaseGameLayer colour trigger: a new ColorAction from the current
  // channel colour to the target. Copy-colour actions keep following the
  // source channel every frame (calculateInheritedColor).
  triggerColor(index, newColor, duration, options = null) {
    const id = Number(index);
    if (!(id > 0)) return;
    if (id === 1005 || id === 1006 || id === 1010 || id === 1011 || id === 1012) return;
    this._coloredChannels.add(String(id));
    const ch = this._channel(id);
    ch.from = [ch.base[0], ch.base[1], ch.base[2]];
    ch.fromOpacity = ch.currentOpacity;
    let target = [Number(newColor?.r ?? 255) | 0, Number(newColor?.g ?? 255) | 0, Number(newColor?.b ?? 255) | 0];
    const playerColor = Number(options?.playerColor) || 0;
    ch.playerColor = playerColor === 1 || playerColor === 2 ? playerColor : 0;
    if (ch.playerColor) target = gdPlayerColor(ch.playerColor);
    ch.to = target;
    if (options && options.blending !== undefined) ch.blending = !!options.blending;
    const opacity = options && options.opacity !== undefined && Number.isFinite(Number(options.opacity))
      ? Math.max(0, Math.min(1, Number(options.opacity)))
      : 1;
    ch.toOpacity = opacity;
    ch.copyID = Number(options?.copyColorId) > 0 ? Number(options.copyColorId) : 0;
    ch.copyHSV = options?.copyHSV || null;
    ch.copyOpacity = !!options?.copyOpacity;
    ch.legacyHSV = !!options?.legacyHSV;
    if (ch.copyOpacity) ch.fromOpacity = 1;
    ch.duration = Math.max(0, Number(duration) || 0);
    ch.deltaTime = 0;
    ch.finished = false;
    ch.step(0);
    if (ch.copyID === 0) {
      ch.base[0] = ch.color[0]; ch.base[1] = ch.color[1]; ch.base[2] = ch.color[2];
      ch.spriteOpacity = ch.currentOpacity * 255;
    }
    ch.version++;
    this._dirtyChannels.add(String(id));
  }
  // GJEffectManager::runPulseEffect
  addPulse(p) {
    const pulse = {
      targetID: Math.max(0, Math.min(9999, Number(p.targetID) | 0)),
      targetGroup: !!p.targetGroup,
      fadeIn: Math.max(0, Number(p.fadeIn) || 0),
      hold: Math.max(0, Number(p.hold) || 0),
      fadeOut: Math.max(0, Number(p.fadeOut) || 0),
      type: p.hsvMode ? 1 : 2,
      color: [Number(p.color?.r ?? 255) | 0, Number(p.color?.g ?? 255) | 0, Number(p.color?.b ?? 255) | 0],
      hsv: p.hsv || { h: 0, s: 1, v: 1, absoluteSaturation: false, absoluteBrightness: false },
      copyID: Number(p.copyID) || 0,
      mainOnly: !!p.mainOnly,
      detailOnly: !!p.detailOnly,
      dynamicHSV: !!p.dynamicHSV,
      deltaTime: 0,
      value: 0,
      startTime: Number(p.startTime) || 0
    };
    if (!pulse.targetGroup) {
      if (p.exclusive) this._pulses = this._pulses.filter(x => x.targetID !== pulse.targetID);
      this._pulses.push(pulse);
      this._dirtyChannels.add(String(pulse.targetID));
    } else {
      let list = this._groupPulses.get(pulse.targetID);
      if (!list) { list = []; this._groupPulses.set(pulse.targetID, list); }
      if (p.exclusive) list.length = 0;
      list.push(pulse);
      this._groupPulseVersion++;
    }
    return pulse;
  }
  removePulse(pulse) {
    if (!pulse) return;
    if (pulse.targetGroup) {
      const list = this._groupPulses.get(pulse.targetID);
      const index = list?.indexOf(pulse) ?? -1;
      if (index >= 0) list.splice(index, 1);
      if (list && !list.length) this._groupPulses.delete(pulse.targetID);
      this._groupPulseVersion++;
    } else {
      const index = this._pulses.indexOf(pulse);
      if (index >= 0) this._pulses.splice(index, 1);
      this._dirtyChannels.add(String(pulse.targetID));
    }
  }
  restoreRuntimeState(data) {
    Object.assign(this, data);
    // structuredClone preserves Maps and shared pulse references, while
    // channel instances need their interpolation method restored explicitly.
    for (const channel of this._channels.values()) Object.setPrototypeOf(channel, GDColorChannel.prototype);
    this._dirtyChannels = new Set([...this._channels.keys()].map(String));
    this.processColors();
  }
  _stepPulse(pulse, dt) {
    if (pulse.paused) return false;
    pulse.deltaTime += dt;
    const tt = pulse.deltaTime + pulse.startTime;
    let value;
    if (pulse.fadeIn > tt) value = tt / pulse.fadeIn;
    else if (pulse.fadeIn + pulse.hold >= tt) value = 1;
    else if (pulse.fadeOut > 0) value = 1 - (tt - pulse.fadeIn - pulse.hold) / pulse.fadeOut;
    else value = 0;
    pulse.value = value;
    return tt >= pulse.fadeIn + pulse.hold + pulse.fadeOut;
  }
  _updatePulses(dt) {
    for (let i = 0; i < this._pulses.length;) {
      const done = this._stepPulse(this._pulses[i], dt);
      this._dirtyChannels.add(String(this._pulses[i].targetID));
      if (done) this._pulses.splice(i, 1); else i++;
    }
    for (const [group, list] of this._groupPulses) {
      for (let i = 0; i < list.length;) {
        if (this._stepPulse(list[i], dt)) list.splice(i, 1); else i++;
      }
      if (!list.length) this._groupPulses.delete(group);
    }
    if (this._groupPulses.size) this._groupPulseVersion++;
  }
  // GJEffectManager::colorForPulseEffect
  colorForPulse(base, pulse, out) {
    out = out || [0, 0, 0];
    const value = pulse.value;
    if (!(value > 0)) { out[0] = base[0]; out[1] = base[1]; out[2] = base[2]; return out; }
    if (pulse.type === 2) {
      if (value === 1) { out[0] = pulse.color[0]; out[1] = pulse.color[1]; out[2] = pulse.color[2]; return out; }
      return gdLerpColor(base, pulse.color, Math.min(1, value), out);
    }
    if (pulse.type !== 1) { out[0] = base[0]; out[1] = base[1]; out[2] = base[2]; return out; }
    let src = base;
    if (pulse.copyID) {
      if (pulse.copyID === 1010) src = [0, 0, 0];
      else if (pulse.copyID === 1011) src = [255, 255, 255];
      else src = this.getFinal(pulse.copyID);
    }
    if (value === 1) return gdTransformColorRGB(src[0], src[1], src[2], pulse.hsv, out);
    let hsv = pulse.hsv;
    if (pulse.dynamicHSV) {
      const inv = 1 - value;
      hsv = {
        h: hsv.h * value,
        s: hsv.absoluteSaturation ? hsv.s * value : hsv.s * value + inv,
        v: hsv.absoluteBrightness ? hsv.v * value : hsv.v * value + inv,
        absoluteSaturation: hsv.absoluteSaturation,
        absoluteBrightness: hsv.absoluteBrightness
      };
    }
    const target = gdTransformColorRGB(src[0], src[1], src[2], hsv, [0, 0, 0]);
    return gdLerpColor(base, target, Math.min(1, value), out);
  }
  hasGroupPulse(groupId) {
    const list = this._groupPulses.get(groupId);
    return !!(list && list.length);
  }
  get groupPulseVersion() { return this._groupPulseVersion; }
  // GJEffectManager::colorForGroupID
  colorForGroup(groupId, color, isMain, out) {
    out = out || [0, 0, 0];
    out[0] = color[0]; out[1] = color[1]; out[2] = color[2];
    const list = this._groupPulses.get(groupId);
    if (!list) return out;
    for (const pulse of list) {
      if (pulse.mainOnly && !isMain) continue;
      if (pulse.detailOnly && isMain) continue;
      this.colorForPulse(out, pulse, out);
    }
    return out;
  }
  step(dt) {
    const delta = Math.max(0, Number(dt) || 0);
    this._time += delta;
    // GJEffectManager::updateEffects
    for (const ch of this._channels.values()) {
      if (ch.finished) {
        if (ch.playerColor) {
          const pc = gdPlayerColor(ch.playerColor);
          ch.color[0] = pc[0]; ch.color[1] = pc[1]; ch.color[2] = pc[2];
        }
      } else {
        ch.step(delta);
        this._dirtyChannels.add(String(ch.id));
      }
      if (ch.copyID === 0) {
        ch.base[0] = ch.color[0]; ch.base[1] = ch.color[1]; ch.base[2] = ch.color[2];
        ch.spriteOpacity = ch.currentOpacity * 255;
      }
    }
    this._updatePulses(delta);
    this.processColors();
  }
  // GJEffectManager::processColors
  processColors() {
    // calculateBaseActiveColors
    for (const ch of this._channels.values()) {
      ch.calculated = false;
      ch.final[0] = ch.base[0]; ch.final[1] = ch.base[1]; ch.final[2] = ch.base[2];
    }
    // channel pulses on non-copy channels
    for (const pulse of this._pulses) {
      if (pulse.copyID) continue;
      const ch = this._channel(pulse.targetID);
      if (ch.copyID) continue;
      this.colorForPulse(ch.final, pulse, ch.final);
    }
    // processInheritedColors (resolve copy chains in dependency order)
    for (const ch of this._channels.values()) {
      if (ch.copyID > 0) this._resolveInherited(ch, 0);
    }
    // processCopyColorPulseActions
    for (const pulse of this._pulses) {
      if (!pulse.copyID) continue;
      const ch = this._channel(pulse.targetID);
      this.colorForPulse(ch.final, pulse, ch.final);
    }
    // calculateLightBGColor
    const bg = this.getFinal(1000);
    const lbg = gdTransformColorRGB(bg[0], bg[1], bg[2], { h: 0, s: -0.2, v: 0.2, absoluteSaturation: true, absoluteBrightness: true }, [0, 0, 0]);
    const sum = bg[0] + bg[1] + bg[2];
    if (sum < 150) {
      const t = Math.fround(sum / 150);
      const p1 = gdPlayerColor(1);
      for (let i = 0; i < 3; i++) {
        let v = Math.fround(lbg[i] * t + p1[i] * (1 - t));
        v = Math.min(255, Math.max(0, v));
        lbg[i] = Math.trunc(v);
      }
    }
    this._lbg = lbg;
  }
  _resolveInherited(ch, depth) {
    if (ch.calculated || !ch.copyID) return;
    if (depth > 64) { ch.copyLoop = true; return; }
    const srcId = Math.max(0, Math.min(9999, ch.copyID));
    if (srcId === ch.id) { ch.copyLoop = true; return; }
    const src = this._channels.get(srcId);
    if (src && src.copyID > 0 && !src.calculated) this._resolveInherited(src, depth + 1);
    const srcFinal = this.getFinal(srcId);
    const srcOpacity = this.getOpacity(srcId);
    let col = [srcFinal[0], srcFinal[1], srcFinal[2]];
    let opacityFactor = srcOpacity;
    if (ch.duration > 0 && ch.deltaTime < ch.duration) {
      let p = Math.min(1, ch.deltaTime / ch.duration);
      if (p < 0) p = 0;
      col = gdLerpColor(ch.from, srcFinal, Math.min(1, p), [0, 0, 0]);
      opacityFactor = ((1 - p) * ch.fromOpacity + p * (srcOpacity / 255)) * 255;
    }
    let hsv = ch.copyHSV;
    if (hsv && !gdIsDefaultHSV(hsv)) {
      if (ch.legacyHSV && ch.duration > 0) {
        let p2 = Math.min(1, ch.deltaTime / ch.duration);
        if (p2 < 0) p2 = 0;
        if (p2 < 1) {
          const inv = 1 - p2;
          hsv = {
            h: hsv.h * p2,
            s: hsv.absoluteSaturation ? hsv.s * p2 : hsv.s * p2 + inv,
            v: hsv.absoluteBrightness ? hsv.v * p2 : hsv.v * p2 + inv,
            absoluteSaturation: hsv.absoluteSaturation,
            absoluteBrightness: hsv.absoluteBrightness
          };
        }
      }
      col = gdTransformColorRGB(col[0], col[1], col[2], hsv, col);
    }
    for (const pulse of this._pulses) {
      if (pulse.targetID === ch.id && !pulse.copyID) this.colorForPulse(col, pulse, col);
    }
    ch.final[0] = ch.base[0] = col[0];
    ch.final[1] = ch.base[1] = col[1];
    ch.final[2] = ch.base[2] = col[2];
    ch.spriteOpacity = ch.copyOpacity ? ch.currentOpacity * opacityFactor : ch.currentOpacity * 255;
    ch.calculated = true;
  }
  // Final colour of a channel (ColorActionSprite + 0x147).
  getFinal(index) {
    const id = Number(index);
    if (id === 1005) return gdPlayerColor(1);
    if (id === 1006) return gdPlayerColor(2);
    if (id === 1007) return this._lbg || [255, 255, 255];
    if (id === 1010) return [0, 0, 0];
    if (id === 1011 || id === 0) return [255, 255, 255];
    const ch = this._channels.get(id);
    if (!ch) {
      const def = this._defaultFor(id);
      return [def.r, def.g, def.b];
    }
    return ch.final;
  }
  // ColorActionSprite opacity (0..255).
  getOpacity(index) {
    const id = Number(index);
    const ch = this._channels.get(id);
    return ch ? ch.spriteOpacity : 255;
  }
  // GameObject::shouldBlendColor (channel part).
  getBlending(index) {
    const id = Number(index);
    if (id === 1005 || id === 1006 || id === 1007) return true;
    const ch = this._channels.get(id);
    return ch ? !!ch.blending : false;
  }
  getColor(index) {
    const c = this.getFinal(index);
    return { r: c[0], g: c[1], b: c[2] };
  }
  hasColor(index) {
    return this._coloredChannels.has(String(index));
  }
  consumeDirtyChannels() {
    const dirty = [...this._dirtyChannels];
    this._dirtyChannels.clear();
    return dirty;
  }
  getHex(index) {
    const c = this.getFinal(index);
    return 0xFF000000 | (c[0] << 16) | (c[1] << 8) | c[2];
  }
}

function circleEffect(gameScene, xPos, yPos, radius, radius2, duration, filled = false, _0x550b4a /*idk what this is*/ = false, color = 16777215) {
  const graphics = gameScene.add.graphics().setScrollFactor(0).setDepth(55).setBlendMode(S);
  const targets = {
    r: radius,
    t: 0
  };
  gameScene.tweens.add({
    targets: targets,
    r: radius2,
    t: 1,
    duration: duration,
    ease: filled && !_0x550b4a ? "Quad.Out" : "Linear",
    onUpdate: () => {
      const alpha = _0x550b4a ? targets.t < 0.5 ? targets.t * 2 : (1 - targets.t) * 2 : 1 - targets.t;
      graphics.clear();
      if (filled) {
        graphics.fillStyle(color, Math.max(0, alpha));
        graphics.fillCircle(xPos, yPos, targets.r);
      } else {
        graphics.lineStyle(4, color, Math.max(0, alpha));
        graphics.strokeCircle(xPos, yPos, targets.r);
      }
    },
    onComplete: () => graphics.destroy()
  });
}
function particleEffect(gameScene, color1 = 16777215, color2 = 16777215) {
  if (window.enableLDM) return;
  const basePos = 200;
  const xPos = basePos + (screenWidth - 400) * Math.random();
  const yPos = basePos + Math.random() * 240;
  circleEffect(gameScene, xPos, yPos, 40, 140 + Math.random() * 60, 500, true, true, color2);
  gameScene.add.particles(xPos, yPos, "GJ_WebSheet", {
    frame: "square.png",
    speed: {
      min: 520,
      max: 920
    },
    angle: {
      min: 0,
      max: 360
    },
    scale: {
      start: 0.4,
      end: 0.13
    },
    alpha: {
      start: 1,
      end: 0
    },
    lifespan: {
      min: 0,
      max: 500
    },
    stopAfter: 25,
    blendMode: S,
    tint: color1,
    x: {
      min: -20,
      max: 20
    },
    y: {
      min: -20,
      max: 20
    }
  }).setScrollFactor(0).setDepth(57);
}
