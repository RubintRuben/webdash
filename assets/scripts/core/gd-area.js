// GD 2.2 area effects: Area Move/Rotate/Scale/Fade/Tint (3006-3010) and
// their Edit triggers (3011-3015), read from the installed GeometryDash.exe:
//   triggerAreaEffect 32fe50, addAreaEffect 330110,
//   processAreaActions 331c00 / processAreaEffects 331030,
//   getAreaObjectValue 330cc0, getEasedAreaValue 330eb0,
//   group actions move 333120, rotate 3329d0, transform 331e60,
//   tint 3337f0, GameObject::setAreaOpacity 295830,
//   EnterEffectInstance::loadValuesFromObject 209940 / loadTransitions 209ae0,
//   area parent groups 32d610.
// GD recomputes every area effect from the object's base state each step
// (updateAreaObjectLastValues undoes the previous step's offsets), so an
// object's area state is a function of the instances and their centres. The
// renderer asks for it per drawn object; colliders are updated per step.
(function () {
  "use strict";
  const MOVE = 0, ROTATE = 1, SCALE = 2, FADE = 3, TINT = 4;
  // EnterEffectInstance value slots, in loadTransitions key order.
  const LEN = 0, LENV = 1, OFF = 2, OFFV = 3, MODF = 4, MODB = 5, DEAD = 6, DIST = 7, DISTV = 8, ANG = 9, ANGV = 10,
    MX = 11, MXV = 12, MY = 13, MYV = 14, SX = 15, SXV = 16, SY = 17, SYV = 18, ROT = 19, ROTV = 20, TINTV = 21,
    P285 = 22, TO_OP = 23, FROM_OP = 24, OFFY = 25, OFFYV = 26, RELF = 27, SLOTS = 28;
  // Saved keys of the slots (EnterEffectObject properties).
  const KEYS = [222, 223, 220, 221, 263, 264, 282, 218, 219, 231, 232, 237, 238, 239, 240, 233, 234, 235, 236,
    270, 271, 265, 285, 275, 286, 252, 253, 288];
  // Integer EnterEffectObject fields (length, offsets, move distance/angle/x/y).
  const INT_SLOT = new Set([LEN, LENV, OFF, OFFV, DIST, DISTV, ANG, ANGV, MX, MXV, MY, MYV, OFFY, OFFYV]);
  // Random table slots used by each value (offset from the object's index).
  const R_LEN = 0, R_OFFX = 1, R_OFFY = 2, R_MX = 8, R_MY = 9, R_DIST = 10, R_ANG = 11, R_SX = 12, R_SY = 13, R_ROT = 18;
  const DEG = Math.PI / 180;

  // GJBaseGameLayer's per-object random table: a fixed value per object and
  // slot. GD seeds it at load; a stable hash keeps attempts identical here.
  function rnd(seed, slot) {
    let h = (Math.imul(seed + 1, 0x9E3779B1) ^ Math.imul(slot + 1, 0x85EBCA77)) | 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return (h >>> 0) / 4294967295 * 2 - 1;
  }
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const on = v => v === "1" || v === 1 || v === true;

  function parseValues(raw) {
    const v = new Float64Array(SLOTS);
    for (let i = 0; i < SLOTS; i++) {
      const s = raw[KEYS[i]];
      // Saved zeroes are omitted, including in Edit objects. Only an
      // explicitly saved -99 means "leave unchanged" (native 209ae0).
      const d = 0;
      let x = s === undefined || s === "" ? d : num(s, d);
      if (INT_SLOT.has(i)) x = Math.trunc(x);
      v[i] = x;
    }
    return v;
  }

  class GDAreaState {
    constructor(level) {
      this.level = level;
      this.lists = [[], [], [], [], []];
      this.frame = 0;
      this.version = 0;
      this.byGroup = new Map();
      this._units = new Map();
      this._cols = new Set();
    }
    get active() { return this.lists[0].length + this.lists[1].length + this.lists[2].length + this.lists[3].length + this.lists[4].length > 0; }

    // The trigger record the level stores for 3006-3015.
    static parse(base, levelObj) {
      const raw = levelObj._raw || {}, id = levelObj.id, edit = id >= 3011;
      const hsv = raw[49] && typeof parseGdHSV === "function" ? parseGdHSV(raw[49]) : null;
      return { ...base, id, raw: { ...raw }, type: (id - 3006) % 5, edit,
        target: num(raw[51]), center: num(raw[71]), special: num(raw[538]),
        values: parseValues(raw), duration: Math.max(0, num(raw[10])),
        dirType: num(raw[262]), inbound: on(raw[276]), twoDir: on(raw[283]), xyMode: on(raw[241]),
        relative: on(raw[287]), easeOut: on(raw[261]),
        inType: num(raw[242]), inRate: num(raw[243], 2), outType: num(raw[248]), outRate: num(raw[249], 2),
        tintChannel: num(raw[260]), hsvOn: on(raw[278]), hsv, mainOnly: on(raw[65]), detailOnly: on(raw[66]),
        effectID: num(raw[225]), useEffectID: on(raw[355]), ignoreParent: on(raw[280]),
        dontEditParent: on(raw[539]) };
    }

    reset() {
      for (const list of this.lists) list.length = 0;
      this._restoreColliders(true);
      this._changed();
    }
    _changed() {
      this.version++;
      this.byGroup.clear();
      for (const list of this.lists) for (const inst of list) {
        const g = inst.trig.target;
        let entry = this.byGroup.get(g);
        if (!entry) this.byGroup.set(g, entry = []);
        entry.push(inst);
      }
    }

    // GJBaseGameLayer::triggerAreaEffect
    trigger(trig) {
      if (!trig) return;
      if (!trig.edit) return this._add(trig);
      if (trig.useEffectID) {
        for (const list of this.lists) for (const inst of list) {
          if (inst.trig.effectID !== trig.target) continue;
          this._transition(inst, trig);
          if (trig.target > 0) break;
        }
        return;
      }
      const members = this.level.gdRenderer?.groups.get(trig.target) || [];
      for (const obj of members) {
        if (obj.id < 3006 || obj.id > 3010) continue;
        for (const inst of this.lists[obj.id - 3006]) if (this.level.gdObjects?.[inst.trig.uid] === obj) this._transition(inst, trig);
      }
    }
    // GJBaseGameLayer::addAreaEffect: re-firing the same trigger reloads its
    // values; a new effect ID replaces the instance holding it.
    _add(trig) {
      const list = this.lists[trig.type];
      const same = list.find(inst => inst.trig === trig);
      if (same) { same.v.set(trig.values); same.trans.length = 0; return; }
      if (trig.effectID > 0) {
        const i = list.findIndex(inst => inst.trig.effectID === trig.effectID);
        if (i >= 0) list.splice(i, 1);
      }
      list.push({ trig, v: Float64Array.from(trig.values), trans: [], ease: new Map(), cx: 0, cy: 0, modFront: 1 });
      this._changed();
    }
    // EnterEffectInstance::loadTransitions: each field the edit trigger sets
    // (not -99) animates from its current value over the trigger's duration
    // with the trigger's easing (its 242/243 fields).
    _transition(inst, edit) {
      for (let k = 0; k < SLOTS; k++) {
        const to = edit.values[k];
        if (to === -99) continue;
        const i = inst.trans.findIndex(t => t.k === k);
        if (i >= 0) inst.trans.splice(i, 1);
        if (!(edit.duration > 0)) { inst.v[k] = to; continue; }
        inst.trans.push({ k, from: inst.v[k], to, t: 0, d: edit.duration, type: edit.inType, rate: edit.inRate });
      }
    }
    stopGroup(group) {
      let changed = false;
      for (const list of this.lists) for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].trig.groups?.includes(group)) { list.splice(i, 1); changed = true; }
      }
      if (changed) this._changed();
    }
    controlGroup(group, command) {
      for (const list of this.lists) for (const inst of list)
        if (inst.trig.groups?.includes(group)) inst.paused = command === 1;
      this._changed();
    }

    // Per step: transitions advance; each instance's centre is read once.
    step(dt) {
      if (!this.active) { if (this._cols.size) this._restoreColliders(true); return; }
      this.frame++;
      const level = this.level, renderer = level.gdRenderer, scene = level._scene || {};
      for (const list of this.lists) for (const inst of list) {
        if (inst.paused) continue;
        for (let i = 0; i < inst.trans.length;) {
          const tr = inst.trans[i];
          tr.t += dt;
          const p = Math.min(1, tr.t / tr.d);
          inst.v[tr.k] = tr.from + (tr.to - tr.from) * (tr.type ? Easing.sample(tr.type, tr.rate, p) : p);
          if (p >= 1) inst.trans.splice(i, 1); else i++;
        }
        const t = inst.trig, v = inst.v;
        const id = t.special || t.center;
        let cx = 0, cy = 0;
        if (id > 0) {
          const o = level._moveGroupParent(id);
          if (o && renderer) { const p = renderer.livePosition(o, this._tmp || (this._tmp = {})); cx = p.x; cy = p.y; }
        } else if (id === -1 || id === -2) {
          const two = id === -2 && !!scene._state2;
          cx = (two ? (scene._secondaryWorldX ?? scene._playerWorldX) : scene._playerWorldX) / 2 || 0;
          cy = ((two ? scene._state2?.y : scene._state?.y) || 0) / 2;
        } else if (id < -2 && renderer) {
          const cam = renderer.camera, w = cam.w, h = cam.h;
          const at = { [-4]: [0, 0], [-5]: [0, h / 2], [-6]: [0, h], [-7]: [w / 2, 0], [-8]: [w / 2, h],
            [-9]: [w, 0], [-10]: [w, h / 2], [-11]: [w, h] }[id] || [w / 2, h / 2];
          cx = cam.x + at[0]; cy = cam.y + at[1];
        }
        if (t.dirType !== 0) { v[OFFY] = v[OFF]; v[OFFYV] = v[OFFV]; }
        inst.cx = cx + v[OFF]; inst.cy = cy + v[OFFY];
        inst.modFront = t.twoDir ? -Math.abs(v[MODF]) : v[MODF];
      }
      this._stepColliders();
    }

    // getAreaObjectValue: the distance along the area's axis (or radius),
    // over the (randomised) length, past the deadzone, clamped to 0..1;
    // inbound areas invert it. `seed` picks the object's random values.
    _value(inst, x, y, seed) {
      const t = inst.trig, v = inst.v;
      let dist;
      if (t.dirType === 1 || t.dirType === 2) {
        const off = v[OFFV] ? v[OFFV] * rnd(seed, R_OFFX) : 0;
        const d = (t.dirType === 1 ? x - inst.cx : y - inst.cy) + off;
        dist = d * (d < 0 ? inst.modFront : v[MODB]);
        this._in = t.dirType === 1 ? x >= inst.cx : y >= inst.cy;
      } else {
        const ox = v[OFFV] ? v[OFFV] * rnd(seed, R_OFFX) : 0, oy = v[OFFYV] ? v[OFFYV] * rnd(seed, R_OFFY) : 0;
        dist = Math.hypot(x - (inst.cx + ox), y - (inst.cy + oy));
        // GD compares the object's y with the centre's x here.
        this._in = y >= inst.cx;
      }
      const length = Math.trunc((v[LENV] ? v[LENV] * rnd(seed, R_LEN) : 0) + v[LEN]);
      const dz = v[DEAD], a = dist / length;
      let value = dz === 0 ? a : (a - dz) / (1 - dz);
      if (!(value <= 1)) value = 1; else if (value < 0) value = 0;
      return t.inbound ? 1 - value : value;
    }
    // getEasedAreaValue: the ease-in curve, or with ease out enabled the curve
    // chosen when the object entered (ahead of the centre: in), kept while it
    // stays inside.
    _eased(inst, value, seed) {
      const t = inst.trig;
      let useIn = true;
      if (t.easeOut) {
        if (value > 0.01 && value < 0.99) {
          // (The renderer asks once per drawn frame, after several steps.)
          const prev = inst.ease.get(seed);
          useIn = prev && prev.f >= this.frame - 8 ? prev.in : this._in;
          inst.ease.set(seed, { f: this.frame, in: useIn });
        } else useIn = this._in;
      }
      const type = useIn ? t.inType : t.outType, rate = useIn ? t.inRate : t.outRate;
      return type ? Easing.sample(type, rate, value) : value;
    }

    // Area parent groups (32d610): a group parent (274) in the target group
    // makes each of its parent groups one unit -- the value is read at the
    // unit's area parent (279, else the group parent) and rotation/scale turn
    // the unit about its parent (34, else the group parent).
    _unitsFor(group) {
      const renderer = this.level.gdRenderer;
      const version = renderer?.membershipVersion;
      let entry = this._units.get(group);
      if (entry && entry.version === version) return entry.map;
      const map = new Map();
      // Editor links (108) with a 34/279 parent are independent Area units.
      // A containing 274 group cannot pull their members into another unit.
      if (this._linkedVersion !== version || !this._linkedMembers) {
        this._linkedVersion = version;
        this._linkedMembers = new Map();
        this._linkedUnits = new Map();
        for (const obj of renderer?.objects || []) {
          const link = obj.levelObj?.linkedGroup;
          if (!link || obj.removed) continue;
          let members = this._linkedMembers.get(link);
          if (!members) this._linkedMembers.set(link, members = []);
          members.push(obj);
        }
      }
      const linkedUnit = link => {
        if (!this._linkedUnits.has(link)) {
          const members = this._linkedMembers.get(link);
          const areaParent = members?.find(o => o.levelObj?.hasAreaParent);
          const pivot = members?.find(o => o.levelObj?.toggleGroupParent);
          this._linkedUnits.set(link, areaParent || pivot ? { parent: areaParent || pivot, pivot: pivot || areaParent, members } : null);
        }
        return this._linkedUnits.get(link);
      };
      for (const obj of renderer?.groups.get(group) || []) {
        const link = obj.levelObj?.linkedGroup, members = this._linkedMembers.get(link);
        if (!members || map.has(obj.index)) continue;
        const unit = linkedUnit(link);
        if(!unit)continue;
        for (const m of members) map.set(m.index, unit);
      }
      const directParent = renderer?.parents.get(group);
      const resolvedGroups = new Set();
      for (const obj of renderer?.groups.get(group) || []) {
        if (directParent && obj !== directParent) continue;
        const parents = obj.levelObj?.groupParents;
        if (!parents?.length) continue;
        for (const p of parents) {
          // A target with an explicit parent is one unit of its own. Other
          // parent declarations on that object must not absorb the target
          // through a reused group (native 32e002..32e01b).
          if (directParent && p !== group) continue;
          // Each explicit group keeps its first winning parent. Repeated
          // declarations cannot change the map, but used to rescan all of
          // its members for every declaration (quadratic on large art).
          if(resolvedGroups.has(p))continue;
          resolvedGroups.add(p);
          const members = renderer.groups.get(p) || [];
          const areaParent = (obj.levelObj.hasAreaParent ? obj : members.find(o => o.levelObj?.hasAreaParent)) || obj;
          const pivot = (obj.levelObj.toggleGroupParent ? obj : members.find(o => o.levelObj?.toggleGroupParent)) || obj;
          const unit = { parent: areaParent, pivot, group: p };
          for (const m of members) {
            const link = m.levelObj?.linkedGroup;
            if (link && link !== obj.levelObj?.linkedGroup && linkedUnit(link)) continue;
            if (!map.has(m.index) || !map.get(m.index).group) map.set(m.index, unit);
          }
        }
      }
      this._units.set(group, { version, map });
      return map;
    }

    // The instances that reach an object, in GD's order (scale, rotate, move
    // in processAreaActions, then fade and tint), with its parent unit. Kept
    // until an instance is added or removed or group membership changes.
    _plan(obj) {
      const renderer = this.level.gdRenderer, mver = renderer?.membershipVersion;
      let plan = obj._areaPlan;
      if (plan && plan.ver === this.version && plan.mver === mver) return plan;
      const entries = [], groups = obj.groups;
      for (const type of [SCALE, ROTATE, MOVE, FADE, TINT]) for (const inst of this.lists[type]) {
        if (inst.paused) continue;
        const unit = inst.trig.ignoreParent ? null : this._unitsFor(inst.trig.target).get(obj.index) || null;
        if (!groups.includes(inst.trig.target) && !unit) continue;
        entries.push({ inst, type, unit, src: unit ? unit.parent : obj });
      }
      return (obj._areaPlan = { ver: this.version, mver, entries });
    }

    // The renderer's per-object query: offsets (GD units), rotation (deg),
    // scale factors, opacity factor and tints, for an object at (px, py).
    _beginLinear(obj, out) {
      if (out.linearActive) return out.linear;
      const m = out.linear || (out.linear = [1, 0, 0, 1]);
      const rx = -(obj.rotationX + out.rot) * DEG, ry = -(obj.rotationY + out.rot) * DEG;
      const sx = obj.scaleX * out.sx * (obj.flipX ? -1 : 1), sy = obj.scaleY * out.sy * (obj.flipY ? -1 : 1);
      const a = Math.cos(ry) * sx, b = Math.sin(ry) * sx, c = -Math.sin(rx) * sy, d = Math.cos(rx) * sy;
      const f = obj.affine;
      m[0] = f[0] * a + f[2] * b; m[1] = f[1] * a + f[3] * b;
      m[2] = f[0] * c + f[2] * d; m[3] = f[1] * c + f[3] * d;
      out.linearActive = true;
      return m;
    }
    static renderLinear(area, sx, sy, angle, out) {
      const m = area.linear, c = Math.cos(-angle * DEG), s = Math.sin(-angle * DEG);
      out[0] = (c * m[0] - s * m[1]) * sx; out[1] = (s * m[0] + c * m[1]) * sx;
      out[2] = (c * m[2] - s * m[3]) * sy; out[3] = (s * m[2] + c * m[3]) * sy;
      return out;
    }
    forObject(obj, px, py, out) {
      out.dx = 0; out.dy = 0; out.rot = 0; out.sx = 1; out.sy = 1; out.op = 1; out.tints = 0;
      out.linearActive = false;
      const entries = this._plan(obj).entries;
      if (!entries.length) return false;
      const renderer = this.level.gdRenderer, tmp = this._tmp2 || (this._tmp2 = {});
      let x = px, y = py, fadeValue = Infinity;
      for (let e = 0; e < entries.length; e++) {
        const { inst, type, unit, src } = entries[e], v = inst.v;
        if (type < FADE && unit && src === obj && inst.trig.dontEditParent) continue;
        let sx, sy;
        if (unit) { const p = renderer.livePosition(src, tmp); sx = p.x; sy = p.y; }
        else if (type >= FADE) { sx = px; sy = py; }
        else { sx = x; sy = y; }
        const seed = src.index, value = this._value(inst, sx, sy, seed);
        if (type === FADE) {
          // setAreaOpacity: the closest fade of the step decides.
          if (value < fadeValue) { fadeValue = value; out.op = v[FROM_OP] + (v[TO_OP] - v[FROM_OP]) * value; }
          continue;
        }
        if (!(value < 1)) { if (inst.trig.easeOut) inst.ease.delete(seed); continue; }
        if (type === TINT) {
          const list = out.tintList || (out.tintList = []);
          const slot = list[out.tints] || (list[out.tints] = { inst: null, value: 0 });
          slot.inst = inst; slot.value = value; out.tints++;
        } else if (type === SCALE) {
          const tx = v[SX] + v[SXV] * rnd(seed, R_SX), ty = v[SY] + v[SYV] * rnd(seed, R_SY);
          if (tx === 0 && ty === 0) continue;
          const s = 1 - this._eased(inst, value, seed);
          const fx = (tx - 1) * s + 1, fy = (ty - 1) * s + 1;
          if (unit && unit.pivot !== obj) {
            const p = renderer.livePosition(unit.pivot, this._tmp3 || (this._tmp3 = {}));
            x = p.x + (x - p.x) * fx; y = p.y + (y - p.y) * fy;
          }
          // Native transforms the whole unit in world axes, including each
          // sprite's two rotation axes. Scaling its local axes instead
          // flattens rotated faces in perspective artwork (332360).
          if (unit || out.linearActive) {
            const m = this._beginLinear(obj, out);
            if (unit) { m[0] *= fx; m[2] *= fx; m[1] *= fy; m[3] *= fy; }
            else { m[0] *= fx; m[1] *= fx; m[2] *= fy; m[3] *= fy; }
          }
          out.sx *= fx; out.sy *= fy;
        } else if (type === ROTATE) {
          const r = v[ROT] + v[ROTV] * rnd(seed, R_ROT);
          if (r === 0) continue;
          const a = (1 - this._eased(inst, value, seed)) * r;
          if (unit && unit.pivot !== obj) {
            const p = renderer.livePosition(unit.pivot, this._tmp3 || (this._tmp3 = {}));
            const c = Math.cos(-a * DEG), s = Math.sin(-a * DEG), dx = x - p.x, dy = y - p.y;
            x = p.x + dx * c - dy * s; y = p.y + dx * s + dy * c;
          }
          if (unit || out.linearActive) {
            const m = this._beginLinear(obj, out), c = Math.cos(-a * DEG), s = Math.sin(-a * DEG);
            const a0 = m[0], a2 = m[2];
            m[0] = c * a0 - s * m[1]; m[1] = s * a0 + c * m[1];
            m[2] = c * a2 - s * m[3]; m[3] = s * a2 + c * m[3];
          }
          out.rot += a;
        } else {
          let mx, my;
          if (inst.trig.xyMode) {
            mx = v[MX] + v[MXV] * rnd(seed, R_MX); my = v[MY] + v[MYV] * rnd(seed, R_MY);
            if (mx === 0 && my === 0) continue;
            const s = 1 - this._eased(inst, value, seed);
            mx *= s; my *= s;
          } else {
            let dist = v[DIST] + (v[DISTV] ? v[DISTV] * rnd(seed, R_DIST) : 0);
            if (dist === 0) continue;
            const eased = this._eased(inst, value, seed);
            let dirX, dirY;
            if (inst.trig.relative) {
              const ddx = sx - inst.cx, ddy = sy - inst.cy;
              const len = Math.hypot(ddx, ddy), fade = Math.max(0, v[RELF]);
              if (fade > len) dist *= len / fade;
              dirX = len > 0 ? ddx / len : 0; dirY = len > 0 ? ddy / len : 0;
            } else {
              const ang = (v[ANG] + (v[ANGV] ? v[ANGV] * rnd(seed, R_ANG) : 0) - 90) * DEG;
              dirX = Math.cos(ang); dirY = Math.sin(ang);
            }
            const s = (1 - eased) * dist;
            mx = s * dirX; my = s * dirY;
          }
          x += mx; y += my;
        }
      }
      out.dx = x - px; out.dy = y - py;
      return true;
    }

    // Every tint reaching an object, applied to its main and detail colours in
    // order. Static centres leave most values unchanged between frames, so
    // each object keeps the last inputs and results per tint.
    applyTints(obj, area, main, detail, hasDetail) {
      const n = area.tints, list = area.tintList;
      let cache = obj._areaTint;
      if (!cache || cache.length < n * 16) cache = obj._areaTint = new Float64Array(Math.max(16, n * 16)).fill(-1);
      for (let i = 0; i < n; i++) {
        const e = list[i], ch = e.inst.trig.tintChannel;
        // A channel tint follows that channel's colour: not cached.
        const fixed = (e.inst.trig.hsvOn && e.inst.trig.hsv) || !ch || ch === 1010 || ch === 1011;
        for (let pass = 0; pass < (hasDetail ? 2 : 1); pass++) {
          const color = pass ? detail : main, c = i * 16 + pass * 8;
          if (!fixed) { this.tintColor(e, color, !pass, color); continue; }
          if (cache[c] === e.value && cache[c + 1] === color[0] && cache[c + 2] === color[1] && cache[c + 3] === color[2] && cache[c + 7] === e.inst.v[TINTV]) {
            color[0] = cache[c + 4]; color[1] = cache[c + 5]; color[2] = cache[c + 6];
            continue;
          }
          cache[c] = e.value; cache[c + 1] = color[0]; cache[c + 2] = color[1]; cache[c + 3] = color[2]; cache[c + 7] = e.inst.v[TINTV];
          this.tintColor(e, color, !pass, color);
          cache[c + 4] = color[0]; cache[c + 5] = color[1]; cache[c + 6] = color[2];
        }
      }
    }

    // processAreaTintGroupAction: a colour lerps toward the tint colour by
    // the tint amount (without easing), or takes the HSV shift scaled by
    // 1 - value.
    tintColor(entry, color, isMain, out) {
      const t = entry.inst.trig, v = entry.value;
      out[0] = color[0]; out[1] = color[1]; out[2] = color[2];
      if (isMain ? t.detailOnly : t.mainOnly) return out;
      if (t.hsvOn && t.hsv) {
        const k = 1 - v, h = t.hsv, hsv = this._hsv || (this._hsv = { h: 0, s: 1, v: 1, absoluteSaturation: false, absoluteBrightness: false });
        hsv.h = h.h * k; hsv.s = h.s * k + (h.absoluteSaturation ? 0 : v); hsv.v = h.v * k + (h.absoluteBrightness ? 0 : v);
        hsv.absoluteSaturation = h.absoluteSaturation; hsv.absoluteBrightness = h.absoluteBrightness;
        return gdTransformColorRGB(color[0], color[1], color[2], hsv, out);
      }
      const tint = this._tintSource(t.tintChannel);
      const f = Math.min(1, 1 - entry.inst.v[TINTV] * (1 - v));
      if (f <= 0) { out[0] = tint[0]; out[1] = tint[1]; out[2] = tint[2]; return out; }
      if (f === 1) return out;
      for (let i = 0; i < 3; i++) out[i] = Math.trunc(tint[i] + (color[i] - tint[i]) * f);
      return out;
    }
    _tintSource(channel) {
      if (channel === 1010) return [0, 0, 0];
      if (!channel || channel === 1011) return [255, 255, 255];
      const renderer = this.level.gdRenderer;
      return renderer ? renderer._channelColor(channel) : [255, 255, 255];
    }
    // Target groups of area moves (the renderer widens their culling).
    moveGroups() {
      if (this._moveGroupsVersion !== this.version) {
        this._moveGroups = [...new Set(this.lists[MOVE].map(inst => inst.trig.target))];
        this._moveGroupsVersion = this.version;
      }
      return this._moveGroups;
    }
    // Furthest an area move can take an object (culling slack, GD units).
    maxMove() {
      let m = 0;
      for (const inst of this.lists[MOVE]) {
        const v = inst.v;
        m = Math.max(m, inst.trig.xyMode ? Math.abs(v[MX]) + Math.abs(v[MXV]) + Math.abs(v[MY]) + Math.abs(v[MYV])
          : Math.abs(v[DIST]) + Math.abs(v[DISTV]));
      }
      return m;
    }

    // Colliders of area-moved groups: GD moves the objects themselves, so
    // their hitboxes follow. Each step the previous offset is undone and the
    // new one applied (updateAreaObjectLastValues / moveAreaObject); objects
    // no longer reached return to their base (resetStoppedAreaObjects).
    _stepColliders() {
      const level = this.level, touched = new Set(), tmp = this._colTmp || (this._colTmp = {});
      const px = (level._scene?._playerWorldX || 0) / 2;
      for (const inst of this.lists[MOVE]) {
        const cols = level._getUniqueGroupColliders(inst.trig.target);
        if (!cols.length) continue;
        for (const col of cols) {
          const obj = level.gdObjects?.[col._eeObjectId];
          if (!obj) continue;
          const bx = (col.x - (col._areaDX || 0)) / 2;
          if (Math.abs(bx - px) > 900) continue;
          if (!touched.has(col)) { touched.add(col); col._areaNX = 0; col._areaNY = 0; }
          const by = (col.y - (col._areaDY || 0)) / 2;
          if (!this.forObject(obj, bx, by, tmp)) continue;
          col._areaNX = tmp.dx * 2; col._areaNY = tmp.dy * 2;
        }
      }
      for (const col of this._cols) if (!touched.has(col)) { col._areaNX = 0; col._areaNY = 0; touched.add(col); }
      for (const col of touched) {
        const dx = col._areaNX - (col._areaDX || 0), dy = col._areaNY - (col._areaDY || 0);
        if (dx || dy) {
          level._recordColliderMotion(col);
          col.x += dx; col.y += dy; col._baseX = col.x; col._baseY = col.y;
          level._refreshCollisionSection(col);
        }
        col._areaDX = col._areaNX; col._areaDY = col._areaNY;
        if (col._areaDX || col._areaDY) this._cols.add(col); else this._cols.delete(col);
      }
    }
    _restoreColliders(clear) {
      for (const col of this._cols) {
        col.x -= col._areaDX || 0; col.y -= col._areaDY || 0; col._baseX = col.x; col._baseY = col.y;
        col._areaDX = 0; col._areaDY = 0;
        this.level._refreshCollisionSection?.(col);
      }
      if (clear) this._cols.clear();
    }

    capture() {
      return { frame: this.frame, lists: this.lists.map(list => list.map(inst => ({ uid: inst.trig.uid, id: inst.trig.id,
        paused: !!inst.paused, v: Array.from(inst.v), trans: inst.trans.map(t => ({ ...t })) }))) };
    }
    restore(data) {
      for (const list of this.lists) list.length = 0;
      if (!data) { this._changed(); return; }
      const byUid = new Map((this.level._areaTriggers || []).map(t => [t.uid + ":" + t.id, t]));
      data.lists?.forEach((list, type) => {
        for (const s of list) {
          const trig = byUid.get(s.uid + ":" + s.id);
          if (trig) this.lists[type].push({ trig, paused: !!s.paused, v: Float64Array.from(s.v), trans: s.trans.map(t => ({ ...t })), ease: new Map(), cx: 0, cy: 0, modFront: 1 });
        }
      });
      this.frame = data.frame || 0;
      this._changed();
    }
  }
  // Custom Enter Move/Rotate/Scale/Fade/Tint (3017-3021), Enter Stop (3023).
  // Installed binary: addCustomEnterEffect 314490, stopCustomEnterEffect
  // 3147c0, PlayLayer::applyCustomEnterEffect 50f410. These change the draw
  // transform only: the original collision geometry remains in place.
  class GDEnterState {
    constructor(level) {
      this.level = level;
      this.channels = [new Map(), new Map()]; // right/enter, left/exit
      this.reach = [new Float64Array(101), new Float64Array(101)];
    }
    static parse(base, obj) {
      const t = GDAreaState.parse(base, obj), raw = obj._raw || {};
      return { ...t, type: obj.id - 3017, edit: false, values: parseValues(raw),
        gdEffect: -15, gdChannel: Math.trunc(num(raw[344])), gdMode: Math.trunc(num(raw[217])),
        stop: obj.id === 3023 };
    }
    reset() { for (let side = 0; side < 2; side++) { this.channels[side].clear(); this.reach[side].fill(0); } }
    _updateReach(side, channel) {
      let reach = 0;
      for (const inst of this.channels[side].get(channel) || []) {
        const v = inst.v;
        reach = Math.max(reach, Math.abs(v[LEN]) + Math.abs(v[LENV]) + Math.abs(v[OFF]) + Math.abs(v[OFFV]));
      }
      this.reach[side][channel] = reach;
    }
    trigger(trig) {
      const ch = trig.stop && (trig.gdChannel < 0 || trig.gdChannel > 100) ? 0 : trig.gdChannel, renderer = this.level.gdRenderer;
      if (ch < 0 || ch > 100 || !renderer) return;
      for (let side = 0; side < 2; side++) {
        if (trig.gdMode !== 0 && trig.gdMode !== side + 1) continue;
        const map = this.channels[side], effects = side ? renderer.exitMap : renderer.enterMap;
        let list = map.get(ch);
        if (trig.stop) {
          if (!trig.effectID) map.delete(ch);
          else if (list) {
            const i = list.findIndex(inst => inst.trig.effectID === trig.effectID);
            if (i >= 0) list.splice(i, 1);
            if (!list.length) map.delete(ch);
          }
          if (!map.get(ch)?.length) effects[ch] = -2;
        } else {
          if (!list) map.set(ch, list = []);
          // Effect ID 0 stacks. A named effect replaces the earlier instance
          // with that ID, including an instance of a different effect type.
          const i = trig.effectID > 0 ? list.findIndex(inst => inst.trig.effectID === trig.effectID) : -1;
          if (i >= 0 && list[i].trig.uid === trig.uid && list[i].trig.target === trig.target && list[i].trig.center === trig.center) {
            // Native 31457c reloads this instance in place. Re-appending it
            // would change the order of non-commuting tint effects.
            list[i].v.set(list[i].trig.values); effects[ch] = -15;
            this._updateReach(side, ch); continue;
          }
          if (i >= 0) list.splice(i, 1);
          list.push({ trig, v: Float64Array.from(trig.values) });
          effects[ch] = -15;
        }
        this._updateReach(side, ch);
      }
    }
    needsPrepare(obj, px) {
      if (obj.ignoreEnter) return false;
      const r = this.level.gdRenderer, cam = r.camera, ch = obj.enterChannel;
      const enter = obj.enterType !== -1 && obj.enterType !== -15 ? true : obj.exitType !== -1 && obj.exitType !== -15 ? false : px > cam.x + cam.w / 2;
      const side = enter ? 0 : 1;
      if ((enter ? r.enterMap : r.exitMap)[ch] !== -15) return false;
      return enter ? px >= cam.x + cam.w - this.reach[side][ch] : px <= cam.x + this.reach[side][ch];
    }
    forObject(obj, enter, px, main, detail, out) {
      out.dx = 0; out.dy = 0; out.sx = 1; out.sy = 1; out.rot = 0; out.op = 1;
      if (obj.ignoreEnter) return out;
      const cam = this.level.gdRenderer.camera, seed = obj.index, sign = enter ? -1 : 1;
      const edge = cam.x + (enter ? cam.w : 0);
      for (const inst of this.channels[enter ? 0 : 1].get(obj.enterChannel) || []) {
        const t = inst.trig, v = inst.v;
        const distance = (px - edge - v[OFF] + v[OFFV] * rnd(seed, R_OFFX)) * sign;
        const length = Math.trunc(v[LEN] + v[LENV] * rnd(seed, R_LEN));
        const f = distance / length, dz = v[DEAD];
        let value = dz === 0 ? f : (f - dz) / (1 - dz);
        if (!(value <= 1)) value = 1; else if (value < 0) value = 0;
        if (value === 1) continue;
        if (t.type === TINT) {
          const e = this._tint || (this._tint = {}); e.inst = inst; e.value = value;
          const area = this.level.areaState;
          if (area) { area.tintColor(e, main, true, main); if (obj.hasDetail) area.tintColor(e, detail, false, detail); }
          continue;
        }
        const eased = t.inType ? Easing.sample(t.inType, t.inRate, value) : value, k = 1 - eased;
        if (t.type === FADE) { if (!obj.ignoreFade) out.op *= eased; }
        else if (t.type === ROTATE) out.rot += (v[ROT] + v[ROTV] * rnd(seed, R_ROT)) * k;
        else if (t.type === SCALE) {
          const sx = v[SX] + v[SXV] * rnd(seed, R_SX), sy = v[SY] + v[SYV] * rnd(seed, R_SY);
          // Both zero is the native "unset" sentinel; one zero collapses
          // that axis and must not be changed into a neutral scale of one.
          if (sx || sy) { out.sx *= 1 + (sx - 1) * k; out.sy *= 1 + (sy - 1) * k; }
        } else if (t.xyMode) {
          out.dx += (v[MX] + v[MXV] * rnd(seed, R_MX)) * sign * k;
          out.dy += (v[MY] + v[MYV] * rnd(seed, R_MY)) * sign * k;
        } else {
          const dist = (v[DIST] + v[DISTV] * rnd(seed, R_DIST)) * k;
          const angle = (v[ANG] + v[ANGV] * rnd(seed, R_ANG) - 90) * DEG;
          out.dx += Math.cos(angle) * dist; out.dy += Math.sin(angle) * dist;
        }
      }
      if (enter) obj.enterType = -15; else obj.exitType = -15;
      // Once the object has reached the interior it can later leave through
      // the other edge; retaining -15 here would pin it to the enter side.
      if (enter ? px < cam.x + cam.w / 2 : px > cam.x + cam.w / 2) {
        if (enter) obj.enterType = -1; else obj.exitType = -1;
      }
      return out;
    }
    capture() {
      return this.channels.map(map => [...map].map(([ch, list]) => [ch, list.map(inst => ({ uid: inst.trig.uid, v: Array.from(inst.v) }))]));
    }
    restore(data) {
      this.reset();
      const byUid = new Map(this.level._enterEffectTriggers.map(t => [t.uid, t]));
      data?.forEach((entries, side) => { for (const [ch, saved] of entries) {
        const list = [];
        for (const s of saved) { const trig = byUid.get(s.uid); if (trig) list.push({ trig, v: Float64Array.from(s.v) }); }
        if (list.length) this.channels[side].set(ch, list);
        this._updateReach(side, ch);
      } });
    }
  }
  window.GDEnterState = GDEnterState;

  // Advanced Follow (3016): GJBaseGameLayer::processAdvancedFollowActions
  // (installed 337c40) runs every instance each 240 Hz tick with dt = 1;
  // processAdvancedFollowAction (337e60) moves each unit of the target group
  // toward the follow target (P1 -1, P2 -2, camera -3, else a group parent),
  // read from `delay` seconds ago (320820). Follow mode 0 -- the only one
  // the supplied levels use -- sets the velocity to delta / max(1, easing)
  // (an easing <= 1 reaches the target in one tick), clamped to the max
  // speed, with X Only / Y Only masking the axes. Units are the area parent
  // groups (32d610): a group parent moves its whole parent group.
  class GDAdvancedFollowState {
    constructor(level) { this.level = level; this.active = []; this.tick = 0; this.history = new Map(); this._tracked = new Set(); }
    static parse(base, levelObj) {
      const raw = levelObj._raw || {};
      return { ...base, id: levelObj.id, raw: { ...raw }, target: num(raw[51]),
        follow: on(raw[138]) ? -1 : on(raw[200]) ? -2 : on(raw[201]) ? -3 : num(raw[71]),
        delay: num(raw[292]), delayVar: num(raw[293]), maxSpeed: num(raw[298]), maxSpeedVar: num(raw[299]),
        xOnly: on(raw[306]), yOnly: on(raw[307]), maxRange: num(raw[308]), maxRangeVar: num(raw[309]),
        easing: num(raw[361]), easingVar: num(raw[362]), mode: num(raw[367]), priority: num(raw[365]),
        exclusive: on(raw[571]), maxRangeRef: num(raw[366]), ignoreParent: on(raw[280]) };
    }
    reset() {
      this.active.length = 0; this.history.clear(); this.tick = 0;
      for (const obj of this._tracked) delete obj._advFollow;
      this._tracked.clear();
    }
    trigger(trig) {
      if (!trig || !(trig.target > 0)) return;
      const i = this.active.findIndex(inst => inst.trig === trig);
      if (i >= 0) this.active.splice(i, 1);
      this.active.push({ trig });
      this.active.sort((a, b) => b.trig.priority - a.trig.priority);
    }
    stopGroup(group) {
      this.active = this.active.filter(inst => !(inst.trig.groups?.includes(group) || inst.trig.target === group));
    }
    controlGroup(group, command) {
      for (const inst of this.active) if (inst.trig.groups?.includes(group) || inst.trig.target === group)
        inst.paused = command === 1;
    }
    _realPosition(obj, out) {
      const renderer = this.level.gdRenderer;
      renderer.livePosition(obj, out);
      const area = this.level.areaState;
      // Native Advanced Follow reads GameObject::getRealPosition, including
      // area movement and the positional part of area scale/rotation.
      if (area?.active) {
        const effect = this._areaPosition || (this._areaPosition = {});
        if (area.forObject(obj, out.x, out.y, effect)) {
          out.x += effect.dx; out.y += effect.dy;
        }
      }
      return out;
    }
    _position(id, out) {
      const level = this.level, scene = level._scene || {}, renderer = level.gdRenderer;
      if (id === -1 || id === -2) {
        const two = id === -2 && !!scene._state2;
        out.x = ((two ? scene._secondaryWorldX ?? scene._playerWorldX : scene._playerWorldX) || 0) / 2;
        out.y = ((two ? scene._state2?.y : scene._state?.y) || 0) / 2;
        return true;
      }
      if (id === -3) { const cam = renderer?.camera; if (!cam) return false; out.x = cam.x; out.y = cam.y; return true; }
      const o = level._moveGroupParent(id);
      if (!o || !renderer) return false;
      this._realPosition(o, out);
      return true;
    }
    // GD keeps a 240 Hz position history for delayed targets.
    _record() {
      const ids = new Set();
      for (const inst of this.active) if (inst.trig.delay > 0 || inst.trig.delayVar) ids.add(inst.trig.follow);
      const tmp = {};
      for (const id of ids) {
        let h = this.history.get(id);
        if (!h) this.history.set(id, h = { x: new Float64Array(2048), y: new Float64Array(2048), ok: new Uint8Array(2048), stamp: new Float64Array(2048).fill(-1) });
        const k = this.tick & 2047;
        h.stamp[k] = this.tick;
        h.ok[k] = this._position(id, tmp) ? 1 : 0; h.x[k] = tmp.x; h.y[k] = tmp.y;
      }
    }
    _target(id, delay, out) {
      if (!(delay > 0)) return this._position(id, out);
      const h = this.history.get(id), back = Math.min(2047, Math.round(delay * 240));
      if (!h) return false;
      const k = (this.tick - back) & 2047;
      if (!h.ok[k] || h.stamp[k] !== this.tick - back) return false;
      out.x = h.x[k]; out.y = h.y[k];
      return true;
    }
    step(dt) {
      if (!this.active.length) return;
      this.tick++;
      this._record();
      const level = this.level, renderer = level.gdRenderer, area = level.areaState;
      if (!renderer) return;
      const ticks = dt * 240, pos = {}, tgt = {}, ref = {};
      for (const inst of this.active) {
        if (inst.paused) continue;
        const t = inst.trig, done = new Set();
        const members=renderer.groups.get(t.target)||[];
        const single=members.length===1&&!members[0].companionOf || members.filter(o=>!o.companionOf&&!o.removed).length===1;
        let memberColliders = null;
        const units = !t.ignoreParent && area ? area._unitsFor(t.target) : null;
        for (const obj of members) {
          if (obj.removed || obj.companionOf) continue;
          const unit = units ? units.get(obj.index) : null;
          const src = unit ? unit.parent : obj;
          if (done.has(src)) continue;
          done.add(src);
          const state = src._advFollow || (src._advFollow = { vx: 0, vy: 0, exclusive: -1 });
          this._tracked.add(src);
          if (state.exclusive === this.tick) continue;
          const seed = src.index;
          const delay = t.delay + (t.delayVar ? t.delayVar * rnd(seed, 0) : 0);
          if (!this._target(t.follow, delay, tgt) || (tgt.x === 0 && tgt.y === 0)) continue;
          this._realPosition(src, pos);
          let dx = tgt.x - pos.x, dy = tgt.y - pos.y;
          const dist = Math.hypot(dx, dy);
          const maxSpeed = t.maxSpeed + (t.maxSpeedVar ? t.maxSpeedVar * rnd(seed, 1) : 0);
          const maxRange = t.maxRange + (t.maxRangeVar ? t.maxRangeVar * rnd(seed, 3) : 0);
          let rangeDist = dist;
          if (t.maxRangeRef > 0) {
            const o = level._moveGroupParent(t.maxRangeRef);
            if (o) { renderer.livePosition(o, ref); rangeDist = Math.hypot(tgt.x - ref.x, tgt.y - ref.y); }
          }
          if (t.xOnly) dy = 0; else if (t.yOnly) dx = 0;
          if (maxRange !== 0 && maxRange < rangeDist) continue;
          if (t.exclusive) state.exclusive = this.tick;
          const easing = t.easing + (t.easingVar ? t.easingVar * rnd(seed, 6) : 0);
          const instant = easing <= 1, e = Math.max(1, easing);
          if (!t.xOnly) state.vy = dy / e;
          if (!t.yOnly) state.vx = dx / e;
          const speed = t.xOnly ? Math.abs(state.vx) : t.yOnly ? Math.abs(state.vy) : Math.hypot(state.vx, state.vy);
          if (speed > maxSpeed && maxSpeed > 0) {
            const f = maxSpeed / speed;
            if (t.xOnly) state.vx *= f; else if (t.yOnly) state.vy *= f; else { state.vx *= f; state.vy *= f; }
          }
          const k = instant ? 1 : ticks;
          const mx = t.yOnly ? 0 : state.vx * k, my = t.xOnly ? 0 : state.vy * k;
          if (!mx && !my) continue;
          if (unit?.group) {
            level._recordMoveDelta(unit.group,mx*2,-my*2);
            level._translateGroup(unit.group, mx * 2, -my * 2);
          }
          else {
            // Native Advanced Follow emits a group move for a singleton.
            // Follow commands consume that move next tick. Independent
            // members of a multi-object group are moved individually and
            // do not supply a group delta (verified in native controls).
            if(single)level._recordMoveDelta(t.target,mx*2,-my*2);
            renderer.flushMovesFor?.(t.target);
            if (!memberColliders) {
              memberColliders = new Map();
              for (const col of level._getUniqueGroupColliders(t.target)) {
                const id = col._eeObjectId;
                let list = memberColliders.get(id); if (!list) memberColliders.set(id, list = []);
                list.push(col);
              }
            }
            for (const moved of unit?.members || [src]) {
            moved.offX += mx; moved.offY += my; renderer._indexObject(moved);
            if (moved.companion && !moved.companion.removed) {
              moved.companion.offX += mx; moved.companion.offY += my; renderer._indexObject(moved.companion);
            }
            for (const col of memberColliders.get(moved.linkedId) || []) {
              level._translateCollider(col, mx * 2, -my * 2);
              level._syncColliderMoveBaseFromCurrent(col);
            }
            for (const spr of level.objectSprites?.[moved.linkedId] || []) {
              if (!spr?.active) continue;
              spr.x = spr._eeWorldX = (spr._eeWorldX ?? spr.x) + mx * 2;
              spr.y = spr._eeBaseY = (spr._eeBaseY ?? spr.y) - my * 2;
              level._syncSpriteMoveBaseFromCurrent(spr); level._refreshSpriteSection(spr);
            }
            }
          }
        }
      }
    }
    capture() {
      return { tick: this.tick, active: this.active.map(inst => inst.trig.uid), paused: this.active.filter(inst => inst.paused).map(inst => inst.trig.uid),
        history: structuredClone([...this.history]),
        objects: [...this._tracked].filter(o => !o.removed).map(o => [o.index, { ...o._advFollow }]) };
    }
    restore(data) {
      this.reset();
      if (!data) return;
      const byUid = new Map((this.level._advFollowTriggers || []).map(t => [t.uid, t]));
      for (const uid of data.active || []) { const trig = byUid.get(uid); if (trig) this.active.push({ trig, paused: !!data.paused?.includes(uid) }); }
      this.tick = data.tick || 0;
      this.history = new Map(structuredClone(data.history || []));
      for (const [index, state] of data.objects || []) {
        const obj = this.level.gdRenderer?.objects[index];
        if (obj && !obj.removed) { obj._advFollow = { ...state }; this._tracked.add(obj); }
      }
    }
  }
  window.GDAdvancedFollowState = GDAdvancedFollowState;
  window.GDAreaState = GDAreaState;
  window.GD_AREA_IDS = new Set([3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015]);
})();
