// GD 2.2 logic triggers: teleport, time warp, gravity, options, player
// visibility, collision blocks, items, timers, random, on-death, touch, events
// and player control. Semantics: RobTop's editor guide (2.2) and
// GJBaseGameLayer in the supplied Steam build (toggleGroupTriggered,
// teleportPlayer); property ids: the Geode bindings.
(function () {
  "use strict";
  const IDS = new Set([3029, 3030, 1934, 3602, 3603, 3605, 3022, 1935, 2066, 2899, 1612, 1613, 1815, 3609, 3640, 3619, 3641, 3620,
    3614, 3615, 3617, 1912, 2068, 1812, 1595, 3604, 1932, 1917, 2901, 1818, 1819, 3607, 3608]);
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const on = value => value === "1" || value === 1 || value === true;
  // GameOptionsSetting: 1 turns an option on, -1 turns it off, 0 leaves it.
  const OPTION_KEYS = { 159: "streakAdditive", 160: "unlinkDualGravity", 161: "hideGround", 162: "hideP1",
    163: "hideP2", 165: "disableP1", 199: "disableP2", 195: "hideMG", 532: "hideAttempts",
    575: "audioOnDeath", 576: "noDeathSFX", 593: "boostSlide" };
  // GJGameEvent ids used by Event triggers.
  const EVENTS = { tinyLanding: 1, featherLanding: 2, softLanding: 3, normalLanding: 4, hardLanding: 5,
    hitHead: 6, orbTouched: 7, orbActivated: 8, padActivated: 9, gravityInverted: 10, gravityRestored: 11,
    normalJump: 12, robotBoostStart: 13, robotBoostStop: 14, ufoJump: 15,
    shipBoostStart: 16, shipBoostEnd: 17, spiderTeleport: 18, ballSwitch: 19, swingSwitch: 20,
    wavePush: 21, waveRelease: 22, dashStart: 23, dashStop: 24, teleported: 25,
    jumpPush: 69, jumpRelease: 70 };

  class GDLogicState {
    constructor(level) {
      this.level = level;
      this.persistent = new Set();
      this.persistentTimers = new Set();
      this.reset();
    }
    reset() {
      if (this.art) {
        if (this.art.background !== undefined) this._art(3029, num(window.settingsMap?.kA6, 1));
        if (this.art.ground !== undefined) this._art(3030, num(window.settingsMap?.kA7, 1));
      }
      this.art = {};
      this.timeWarp = 1;
      this.options = {};
      this.hidden = { 1: false, 2: false };
      this.collisionWatchers = [];
      this.stateInside = new Map();
      this.onDeath = [];
      this.deathNotified = false;
      this.touches = [];
      this.timers = this._keepTimers();
      this.timeEvents = [];
      this.eventLinks = [];
      this.pausedEventLinks = new Set();
      this.sequences = new Map();
      this.gameplayOffset = { x: 0, y: 0 };
      this._blocks = null;
      this._stateBlocks = null;
    }
    _keepTimers() {
      const kept = new Map();
      for (const [id, timer] of this.timers || []) if (this.persistentTimers.has(id)) kept.set(id, timer);
      return kept;
    }
    capture() {
      return structuredClone({ timeWarp: this.timeWarp, options: this.options, hidden: this.hidden, art: this.art,
        collisionRects: [...(this.level.gdRenderer?.collisionBlocks?.values() || [])].flat().map(o => [o.index, this._box(o)]),
        collisionWatchers: this.collisionWatchers.map(w => ({ uid: w.trig.uid, inside: w.inside })),
        stateInside: [...this.stateInside], onDeath: this.onDeath.map(t => t.uid), touches: this.touches.map(t => ({ uid: t.trig.uid, active: t.active })),
        timers: [...this.timers], timeEvents: this.timeEvents.map(e => ({ uid: e.trig.uid, fired: e.fired })),
        eventLinks: this.eventLinks.map(t => t.uid), pausedEventLinks: [...this.pausedEventLinks], gameplayOffset: this.gameplayOffset,
        persistent: [...this.persistent], persistentTimers: [...this.persistentTimers], sequences: [...this.sequences] });
    }
    restore(state) {
      if (!state) return;
      this.deathNotified = false;
      const byUid = new Map((this.level._logicTriggers || []).map(t => [t.uid, t]));
      this.timeWarp = state.timeWarp; this.options = state.options; this.hidden = state.hidden;
      const art = state.art || {};
      if (this.art?.background !== undefined && art.background === undefined)
        this._art(3029, num(window.settingsMap?.kA6, 1));
      if (this.art?.ground !== undefined && art.ground === undefined)
        this._art(3030, num(window.settingsMap?.kA7, 1));
      if (art.background !== undefined) this._art(3029, art.background);
      if (art.ground !== undefined) this._art(3030, art.ground);
      this.art = { ...art };
      this.collisionWatchers = state.collisionWatchers.map(w => ({ trig: byUid.get(w.uid), inside: w.inside })).filter(w => w.trig);
      for (const [index, box] of state.collisionRects || []) {
        const o = this.level.gdRenderer?.objects[index];
        if (o?.id === 1816) { o._collisionBox = structuredClone(box); o._collisionBoxDirty = false; }
      }
      this.stateInside = new Map(state.stateInside);
      this.onDeath = state.onDeath.map(uid => byUid.get(uid)).filter(Boolean);
      this.touches = state.touches.map(t => ({ trig: byUid.get(t.uid), active: t.active })).filter(t => t.trig);
      this.timers = new Map(state.timers);
      this.timeEvents = state.timeEvents.map(e => ({ trig: byUid.get(e.uid), fired: e.fired })).filter(e => e.trig);
      this.eventLinks = state.eventLinks.map(uid => byUid.get(uid)).filter(Boolean);
      this.pausedEventLinks = new Set(state.pausedEventLinks || []);
      this.gameplayOffset = state.gameplayOffset;
      this.persistent = new Set(state.persistent || []);
      this.persistentTimers = new Set(state.persistentTimers || []);
      this.sequences = new Map(state.sequences || []);
    }

    get scene() { return this.level._scene; }
    _players(raw) {
      const scene = this.scene, out = [];
      const p1 = on(raw?.[138]), p2 = on(raw?.[200]);
      if (p1 || !p2) if (scene?._player) out.push(scene._player);
      if ((p2 || !p1) && scene?._isDual && scene._player2) out.push(scene._player2);
      return out;
    }

    // ------------------------------------------------------------ activation
    trigger(trig) {
      const r = trig.raw || {};
      switch (trig.id) {
        case 3029: case 3030: this._art(trig.id, num(r[533])); break;
        case 1934: case 3602: case 3603: case 3605: this.scene?._audio?.triggers?.trigger(trig); break;
        case 3022: this._teleport(trig); break;
        case 1935: this.timeWarp = Math.max(0.01, num(r[120], 1)); break;
        case 2066: for (const player of this._players(r)) player.p.gravityMod = num(r[148], 1); break;
        case 2899: this._options(r); break;
        case 1612: this._hide(r, true); break;
        case 1613: this._hide(r, false); break;
        case 1815: if (!this.collisionWatchers.some(w => w.trig === trig)) this.collisionWatchers.push({ trig, inside: this._collides(r) }); break;
        case 3609: this.level._activateSpawnedGroup(this._collides(r) ? num(r[51]) : num(r[71]), this.scene?._colorManager, false, trig); break;
        case 3619: this._itemEdit(r); break;
        case 3641: this._persistent(r); break;
        case 3620: this.level._activateSpawnedGroup(this._itemCompare(r) ? num(r[51]) : num(r[71]), this.scene?._colorManager, false, trig); break;
        case 3614: this._time(trig); break;
        case 3615: if (!this.timeEvents.some(e => e.trig === trig)) this.timeEvents.push({ trig, fired: false }); break;
        case 3617: this._timeControl(r); break;
        case 1912: this._random(trig); break;
        case 2068: this._advancedRandom(trig); break;
        case 1812: if (!this.onDeath.includes(trig)) this.onDeath.push(trig); break;
        case 1595: if (!this.touches.some(t => t.trig === trig)) this.touches.push({ trig, active: false }); break;
        case 3604: if (!this.eventLinks.includes(trig)) this.eventLinks.push(trig); break;
        case 1932: this._playerControl(r); break;
        case 1917: for (const player of this._players(r)) player.reversePlayer?.(null, false); break;
        case 2901: this.gameplayOffset = { x: num(r[28]) * 2, y: num(r[29]) * 2 }; break;
        case 1818: this.options.bgEffectOff = false; break;
        case 1819: this.options.bgEffectOff = true; break;
        case 3608: this._spawnParticle(trig); break;
        case 3607: this._sequence(trig); break;
      }
    }
    _sequence(trig) {
      // SequenceTriggerGameObject::triggerObject (655c50): counts are
      // cumulative, with stop/loop/hold-last modes and optional timed reset.
      const r=trig.raw, values=String(r[435] || '').split('.').map(Number), entries=[];
      let total=0;
      for(let i=0;i+1<values.length;i+=2) {
        const count=Math.max(0,Math.trunc(values[i+1]));
        total+=count;entries.push({group:values[i],end:total});
      }
      if (!total) return;
      const now=this.level._spawnClock || 0, key=trig.uid;
      const state=this.sequences.get(key) || {count:0,last:-1};
      const elapsed=now-state.last, interval=Math.max(0,num(r[437]));
      if(state.last>=0 && interval>0 && elapsed<interval) return;
      const reset=Math.max(0,num(r[438]));
      if(state.count>0 && state.last>=0 && reset>0 && elapsed>reset)
        state.count=num(r[439])===0?0:Math.max(0,state.count-Math.floor(elapsed/reset));
      state.last=now;
      let count=state.count+1;
      if(count>total) {
        const mode=num(r[436]);
        if(mode===0){this.sequences.set(key,state);return;}
        if(mode===1)count=1;else if(mode===2)count=total;
      }
      state.count=count;this.sequences.set(key,state);
      const target=entries.find(e=>e.end>=count)?.group;
      if(target>0)this.level._activateSpawnedGroup(target,this.scene?._colorManager,false,trig);
    }

    // ArtTriggerGameObject property 533 selects the same one-based artwork
    // index used in the level header. Changes are part of checkpoint state.
    _art(id, index) {
      index = Math.max(1, Math.trunc(index));
      this.art ||= {};
      if (id === 3029) {
        this.art.background = index;
        const key = `game_bg_${getBackgroundTextureIndex(index)}`;
        if (this.scene?._bg && this.scene.textures?.exists(key)) {
          window._backgroundId = getBackgroundDisplayId(index);
          this.scene._applyMirroredBackgroundTexture(key);
        }
      } else {
        this.art.ground = index;
        const key = getGroundTextureId(index);
        if (this.level._groundTiles?.length && this.scene?.textures?.exists(`groundSquare_${key}_001.png`)) {
          window._groundId = key;
          this.level.applyGroundTexture();
        }
      }
    }

    // SpawnParticleGameObject / GJBaseGameLayer::spawnParticleTrigger
    // (Steam 6494d6, 349ad0). The centre uses getGroupParent's random
    // fallback; offsets are world coordinates, independent of rotation.
    _spawnParticle(trig) {
      const r = trig.raw || {}, level = this.level, renderer = level.gdRenderer;
      if (!renderer) return;
      const sample = (key, variance, fallback = 0) => num(r[key], fallback) +
        (level._gdRandom() * 2 - 1) * num(r[variance]);
      let rotation = sample(552, 553);
      const scale = sample(554, 555, 1);
      const node = level.gdObjects[trig.uid];
      let position = node ? renderer.livePosition(node) : { x: trig.x / 2, y: trig.y / 2 };
      const center = num(r[71]) > 0 && level._moveGroupParent(num(r[71]), true);
      if (center) {
        position = renderer.livePosition(center);
        if (on(r[551])) rotation += center.rot + center.rotOff;
      }
      renderer.spawnParticles(num(r[51]), { x: position.x + sample(547, 549), y: position.y + sample(548, 550) }, rotation, scale);
    }

    // GJBaseGameLayer::teleportPlayer for a Teleport trigger (no portal pair):
    // the player goes to the target group's object (its parent, its only
    // object or a random member), relative when Save Offset is on, keeping x
    // or y for Ignore X / Ignore Y, then takes the gravity mode.
    _teleport(trig, player = this.scene?._player) {
      const r = trig.raw, scene = this.scene, level = this.level;
      const state = player?.p || scene?._state;
      if (!player || !state) return;
      // teleportPlayer sets 0x560 even for a targetless launcher. The next
      // collision pass consumes it before testing the flight corridor.
      state._skipFlyBoundsOnce = true;
      const target = level._moveGroupParent(num(r[51]), true);
      // A Teleport trigger without a target still applies gravity and force
      // (teleportPlayer, 3161dc / 31658d). It is also a directional launcher.
      if (target) {
        const live = level.gdRenderer ? level.gdRenderer.livePosition(target) : { x: target.x + target.offX, y: target.y + target.offY };
        let tx = live.x * 2, ty = live.y * 2;
        const px = player._worldX?.() ?? scene._playerWorldX, py = state.y;
        const frame = scene._localPhysicsActive ? level.gameplayState : null;
        const before = frame ? frame.toWorld(px, py) : { x: px, y: py };
        if (on(r[351])) {
          const node = level.gdObjects[trig.uid];
          const nl = node && level.gdRenderer ? level.gdRenderer.livePosition(node) : null;
          const ox = nl ? nl.x * 2 : node ? (node.x + node.offX) * 2 : trig.x, oy = nl ? nl.y * 2 : node ? (node.y + node.offY) * 2 : trig.y;
          tx += before.x - ox; ty += before.y - oy;
        }
        if (on(r[352])) tx = before.x;
        if (on(r[353])) ty = before.y;
        // Group positions stay in world space during a sideways collision
        // pass. Convert the completed teleport back into that pass's frame;
        // otherwise leavePhysics transforms the destination a second time.
        if (frame) { const local = frame.toLocal(tx, ty); tx = local.x; ty = local.y; }
        if (player === scene._player2) scene._secondaryWorldX = tx;
        else scene._playerWorldX = tx;
        state.y = ty; state.lastY = ty; state.lastGroundPosY = ty;
        player._resetTeleportTrails?.();
        player._lastCollisionWorldX = tx;
        player._lastCollisionWorldY = ty;
        if (Math.abs(ty - py) > 0.001) { state.onGround = false; state.canJump = false; }
      }
      const mode = num(r[354]);
      if (mode === 1) player.flipGravity(false, 0.5);
      else if (mode === 2) player.flipGravity(true, 0.5);
      else if (mode === 3) player.flipGravity(!state.gravityFlipped, 0.5);
      // teleportPlayer (316280..3162f1): a destination supplies the launch
      // direction even when Ignore X/Y keeps the player in place. Ordinary
      // targets point up; teleport portal endpoints point left. Only a
      // targetless trigger uses its own right-facing direction (316560).
      const node = target || level.gdObjects[trig.uid];
      const rotation = node ? node.rot + node.rotOff : num(r[6]);
      const baseAngle = target ? ([38, 747, 749, 2064, 2902].includes(target.id) ? 180 : 90) : 0;
      const angle = baseAngle - rotation + ((node ? node.flipX : on(r[4])) ? 180 : 0);
      player.applyTeleportForce?.(r, angle);
      this.event("teleported");
      if (on(r[464])) scene._updateCameraY?.(0, true);
    }

    _options(r) {
      for (const [key, name] of Object.entries(OPTION_KEYS)) {
        const v = num(r[key]);
        if (v === 1) this.options[name] = true;
        else if (v === -1) this.options[name] = false;
        if (v === 1 || v === -1) {
          if (name === "hideP1") this.hidden[1] = v === 1;
          if (name === "hideP2") this.hidden[2] = v === 1;
        }
      }
      for (const [key, index] of [[165, 1], [199, 2]]) {
        const value = num(r[key]);
        if (value === 1 || value === -1) this.scene?._setPlayerControlsDisabled?.(index, value === 1);
      }
      if (num(r[573]) === 1) this.options.respawnTime = Math.max(0, num(r[574], 1));
      else if (num(r[573]) === -1) delete this.options.respawnTime;
    }
    _hide(r, hidden) {
      const p1 = on(r[138]), p2 = on(r[200]);
      if (p1 || !p2) this.hidden[1] = hidden;
      if (p2 || !p1) this.hidden[2] = hidden;
    }
    controlsDisabled(index = 1) { return !!this.options[index === 2 ? "disableP2" : "disableP1"]; }
    playerHidden(index = 1) { return !!window.hidePlayer || (!window.noHideTrigger && !!this.hidden[index]); }

    // ------------------------------------------------------------ collision
    // Collision blocks (1816): a 30 point box per object, scaled with it.
    _collisionBlocks(id) {
      // Built while objects load. Scanning WHAT's 592k objects lazily on its
      // first Collision trigger stalled the main thread for over two seconds.
      const index = this.level.gdRenderer?.collisionBlocks;
      if (index) return index.get(id) || [];
      if (!this._blocks) {
        this._blocks = new Map();
        for (const obj of this.level.gdRenderer?.objects || []) {
          if (obj.id !== 1816 || obj.removed) continue;
          const blockId = num(obj.levelObj?._raw?.[80]);
          if (!this._blocks.has(blockId)) this._blocks.set(blockId, []);
          this._blocks.get(blockId).push(obj);
        }
      }
      return this._blocks.get(id) || [];
    }
    _box(obj) {
      const renderer = this.level.gdRenderer;
      if (renderer?.collisionBox) return renderer.collisionBox(obj);
      const raw = obj.levelObj?._raw;
      const pos = raw && raw[94] !== "1" ? { x: Number(raw[2]), y: Number(raw[3]) }
        : renderer ? renderer.livePosition(obj) : { x: obj.x + obj.offX, y: obj.y + obj.offY };
      const m = obj.affine || [1, 0, 0, 1];
      const hw = 15 * (Math.abs(m[0]) + Math.abs(m[2])) * Math.abs(obj.scaleX || 1);
      const hh = 15 * (Math.abs(m[1]) + Math.abs(m[3])) * Math.abs(obj.scaleY || 1);
      return { x0: pos.x - hw, x1: pos.x + hw, y0: pos.y - hh, y1: pos.y + hh };
    }
    _playerBox(player) {
      const scene = this.scene, state = player.p;
      const half = (state.isMini ? 9 : 15) * (state.isWave ? 0.4 : 1);
      const x = (player === scene._player2 ? (scene._secondaryWorldX ?? scene._playerWorldX) : scene._playerWorldX) / 2;
      const y = state.y / 2;
      return { x0: x - half, x1: x + half, y0: y - half, y1: y + half };
    }
    // CCRect::intersectsRect includes a shared edge. WHAT's jump rig rests
    // its dynamic block exactly on the floor blocks; excluding that contact
    // loses the Collision exit that starts the downward part of its jump.
    _overlap(a, b) {
      if (!(a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0)) return false;
      if (!a.points && !b.points) return true;
      const corners = box => box.points || [[box.x0,box.y0],[box.x1,box.y0],[box.x1,box.y1],[box.x0,box.y1]];
      const ap = corners(a), bp = corners(b);
      for (const polygon of [ap,bp]) for (let i=0;i<polygon.length;i++) {
        const p=polygon[i], q=polygon[(i+1)%polygon.length], nx=p[1]-q[1], ny=q[0]-p[0];
        const av=ap.map(p=>p[0]*nx+p[1]*ny), bv=bp.map(p=>p[0]*nx+p[1]*ny);
        if (Math.max(...av)<Math.min(...bv) || Math.max(...bv)<Math.min(...av)) return false;
      }
      return true;
    }
    _collides(r) {
      const blocksB = this._collisionBlocks(num(r[95])).filter(o => o.enabled && !o.removed);
      const p1 = on(r[138]), p2 = on(r[200]), pp = on(r[201]);
      const scene = this.scene;
      if (pp && scene?._isDual && scene._player2) return this._overlap(this._playerBox(scene._player), this._playerBox(scene._player2));
      if (p1 || p2) {
        const players = [];
        if (p1 && scene?._player) players.push(scene._player);
        if (p2 && scene?._isDual && scene._player2) players.push(scene._player2);
        return players.some(player => !player.p.isDead && blocksB.some(b => this._overlap(this._playerBox(player), this._box(b))));
      }
      const blocksA = this._collisionBlocks(num(r[80])).filter(o => o.enabled && !o.removed);
      // Native updateCollisionBlocks iterates the Dynamic list (dd8),
      // testing it against the section lists. Two static blocks never emit
      // a collision event, even when their saved rectangles overlap.
      return blocksA.some(a => blocksB.some(b => a !== b &&
        (on(a.levelObj?._raw?.[94]) || on(b.levelObj?._raw?.[94])) && this._overlap(this._box(a), this._box(b))));
    }

    // ------------------------------------------------------------ items
    _items() { return this.level._itemCounts; }
    _read(id, mode) {
      if (mode === 2) return this.timers.get(id)?.time || 0;
      if (mode === 3) return num(this.level._points);
      // getItemValue (33ceb0): 4 the level time, 5 the attempts.
      if (mode === 4) return num(this.level._spawnClock);
      if (mode === 5) return num(this.scene?._attempts);
      if (mode === 0) return 0;
      return this._items().get(id) || 0;
    }
    _write(id, mode, value) {
      if (mode === 2) {
        const timer = this.timers.get(id) || { time: 0, running: false, mod: 1, ignoreWarp: false, stopAt: null, target: 0 };
        timer.time = value; this.timers.set(id, timer);
      } else if (mode === 3) this.level._points = Math.trunc(value);
      else {
        this._items().set(id, Math.trunc(value));
        this.level._refreshCounterLabels?.(id);
        this.level._evaluateCountWatchers?.();
      }
    }
    _round(value, type) {
      if (type === 1) return Math.round(value);
      if (type === 2) return Math.floor(value);
      if (type === 3) return Math.ceil(value);
      return value;
    }
    _sign(value, type) {
      if (type === 1) return -value;
      if (type === 2) return Math.abs(value);
      return value;
    }
    _op(a, b, op) {
      if (op === 2) return a - b;
      if (op === 3) return a * b;
      if (op === 4) return b === 0 ? 0 : a / b;
      return a + b;
    }
    // Item Edit: target (=, +=, -=, *=, /=) ((item1 op item2) op mod).
    _itemEdit(r) {
      const mode1 = num(r[476]), mode2 = num(r[477]), targetMode = num(r[478], 1);
      let value = this._read(num(r[80]), mode1);
      if (mode2 !== 0) value = this._op(value, this._read(num(r[95]), mode2), num(r[481], 1));
      const mod = num(r[479], 1);
      value = this._op(value, mod, num(r[482], 3));
      value = this._sign(this._round(value, num(r[485])), num(r[578]));
      const id = num(r[51]);
      const current = this._read(id, targetMode);
      const assign = num(r[480]);
      let result = assign === 0 ? value : this._op(current, value, assign);
      result = this._sign(this._round(result, num(r[486])), num(r[579]));
      this._write(id, targetMode, result);
    }
    // activateItemCompareTrigger (33d310). The saved keys are getSaveString's
    // (6611a5, 66132c): 483 is the second mod and 484 the tolerance. A right side
    // without an item is its mod alone: "item 999 == 1".
    _itemCompare(r) {
      const thousandth = value => Math.round(value * 1000) / 1000;
      // A value of zero is not saved, so an omitted mod is 0.
      const mod1 = thousandth(num(r[479])), mod2 = thousandth(num(r[483])), tol = thousandth(num(r[484]));
      const finish = (value, round, sign) => this._sign(this._round(value, round), sign);
      const a = finish(this._op(this._read(num(r[80]), num(r[476]) > 0 ? num(r[476]) : 1), mod1, num(r[480]) > 0 ? num(r[480]) : 3), num(r[485]), num(r[578]));
      const mode2 = num(r[477]), item2 = num(r[95]);
      const hasItem = mode2 !== 0 && (item2 > 0 || mode2 === 3 || mode2 === 4);
      const b = finish(hasItem ? this._op(this._read(item2, mode2), mod2, num(r[481]) > 0 ? num(r[481]) : 3) : mod2, num(r[486]), num(r[579]));
      switch (num(r[482])) {
        case 1: return a + tol > b;
        case 2: return a + tol >= b;
        case 3: return a - tol < b;
        case 4: return a - tol <= b;
        case 5: return Math.abs(a - b) > tol;
        default: return Math.abs(a - b) <= tol;
      }
    }
    _persistent(r) {
      const timer = on(r[494]), id = num(r[80]);
      const set = timer ? this.persistentTimers : this.persistent;
      if (on(r[493])) {
        if (on(r[492])) { for (const item of set) this._write(item, timer ? 2 : 1, 0); }
        else this._write(id, timer ? 2 : 1, 0);
      }
      if (on(r[492])) return;
      if (on(r[491])) set.add(id); else set.delete(id);
    }
    // Items that survive a death (Persistent Item), restored after the reset.
    persistentItems() {
      const out = new Map();
      for (const id of this.persistent) if (this._items().has(id)) out.set(id, this._items().get(id));
      return out;
    }

    // ------------------------------------------------------------ timers
    _time(trig) {
      const r = trig.raw, id = num(r[80]);
      const existing = this.timers.get(id);
      if (on(r[468]) && existing && existing.running && existing.time !== 0) return;
      this.timers.set(id, { time: num(r[467]), running: !on(r[471]), mod: num(r[470], 1) || 1,
        ignoreWarp: on(r[469]), stopAt: on(r[474]) ? num(r[473]) : null, target: num(r[51]), trig });
    }
    // Time Control: start (0) or stop (1) a timer.
    _timeControl(r) {
      const timer = this.timers.get(num(r[80]));
      if (timer) timer.running = num(r[472]) !== 1;
    }
    _stepTimers(dt) {
      for (const [id, timer] of this.timers) {
        if (!timer.running) continue;
        const before = timer.time;
        timer.time += dt * timer.mod * (timer.ignoreWarp ? 1 / this.timeWarp : 1);
        if (timer.stopAt !== null && (timer.mod >= 0 ? timer.time >= timer.stopAt && before < timer.stopAt
          : timer.time <= timer.stopAt && before > timer.stopAt)) {
          timer.time = timer.stopAt; timer.running = false;
          if (timer.target > 0) this.level._activateSpawnedGroup(timer.target, this.scene?._colorManager, false, timer.trig || null);
        }
        for (const event of this.timeEvents) {
          const r = event.trig.raw;
          if (num(r[80]) !== id) continue;
          const at = num(r[473]);
          const crossed = timer.mod >= 0 ? before < at && timer.time >= at : before > at && timer.time <= at;
          if (!crossed || (event.fired && !on(r[475]))) continue;
          event.fired = true;
          this.level._activateSpawnedGroup(num(r[51]), this.scene?._colorManager, false, event.trig);
        }
      }
    }

    // ------------------------------------------------------------ random
    _random(trig) {
      // EffectGameObject's saved chance defaults to zero, not the editor's
      // suggested 50%. An omitted field therefore always selects group 71.
      const r = trig.raw, chance = num(r[10]);
      const group = this.level._gdRandom() * 100 < chance ? num(r[51]) : num(r[71]);
      if (group > 0) this.level._activateSpawnedGroup(group, this.scene?._colorManager, false, trig);
    }
    _advancedRandom(trig) {
      const parts = String(trig.raw[152] ?? "").split(".").map(Number);
      const entries = [];
      for (let i = 0; i + 1 < parts.length; i += 2) if (parts[i] > 0 && parts[i + 1] > 0) entries.push([parts[i], parts[i + 1]]);
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      if (!(total > 0)) return;
      let pick = this.level._gdRandom() * total;
      for (const [group, weight] of entries) {
        if ((pick -= weight) < 0) { this.level._activateSpawnedGroup(group, this.scene?._colorManager, false, trig); return; }
      }
      this.level._activateSpawnedGroup(entries[entries.length - 1][0], this.scene?._colorManager, false, trig);
    }

    // ------------------------------------------------------------ player
    _playerControl(r) {
      for (const player of this._players(r)) {
        const state = player.p;
        if (on(r[540]) && state.yVelocity * (state.gravityFlipped ? -1 : 1) > 0) state.yVelocity = 0;
        if (on(r[542])) { player.rotateActionActive = false; }
      }
    }
    playerDied() {
      if (this.deathNotified) return;
      this.deathNotified = true;
      // PlayLayer::destroyPlayer resets the time warp before On Death
      // commands. Both dual bodies die, but the layer emits this event once.
      this.timeWarp = 1;
      for (const trig of this.onDeath) this.level._toggleGroupTriggered(num(trig.raw[51]), on(trig.raw[56]), trig);
    }
    // TouchToggleAction: Toggle On / Toggle Off, or alternate; Hold Mode does
    // the opposite on release.
    button(down, index = 1) {
      for (const touch of this.touches) {
        if (!this.level._isTriggerSaveObjectLive(touch.trig.uid)) continue;
        const r = touch.trig.raw, playerMode = num(r[198]);
        if ((playerMode === 1 && index !== 1) || (playerMode === 2 && index !== 2)) continue;
        if (!down && !on(r[81])) continue;
        const mode = num(r[82]), group = num(r[51]);
        // GJEffectManager::playerButton (36ca0c..36ca3d): explicit Hold
        // modes derive their state from the button, including a release
        // after this action was registered while the button was held.
        // Alternate mode inverts the group's live toggle bit, which other
        // triggers can also change; it has no private per-action latch.
        const activate = mode ? (on(r[81]) ? (mode === 1 ? !!down : !down) : mode === 1)
          : this.level._groupEnabled?.[group] === false;
        touch.active = activate;
        this.level._toggleGroupTriggered(group, activate, touch.trig);
      }
    }
    event(name) {
      const id = typeof name === "number" ? name : EVENTS[name];
      if (!id) return;
      for (const trig of this.eventLinks) {
        if (this.pausedEventLinks.has(trig.uid)) continue;
        const ids = String(trig.raw[430] ?? "").split(".").map(Number);
        if (ids.includes(id) && this.level._isTriggerSaveObjectLive(trig.uid)) this.level._activateSpawnedGroup(num(trig.raw[51]), this.scene?._colorManager, false, trig);
      }
    }
    landing(speed) {
      const v = Math.abs(speed) / 2;
      this.event(v < 3 ? "tinyLanding" : v < 6 ? "featherLanding" : v < 9 ? "softLanding" : v < 13 ? "normalLanding" : "hardLanding");
    }
    stopGroup(group, matches = null) {
      this.eventLinks = this.eventLinks.filter(t => !(matches ? matches(t) : t.groups?.includes(group)));
    }
    controlGroup(group, command, matches = null) {
      for (const trig of this.eventLinks) if (matches ? matches(trig) : trig.groups?.includes(group)) {
        if (command === 1) this.pausedEventLinks.add(trig.uid); else this.pausedEventLinks.delete(trig.uid);
      }
    }

    // ------------------------------------------------------------ per tick
    step(dt) {
      for (const watcher of this.collisionWatchers) {
        const r = watcher.trig.raw, inside = this._collides(r);
        const fire = on(r[93]) ? (watcher.inside && !inside) : (!watcher.inside && inside);
        watcher.inside = inside;
        if (fire) this.level._toggleGroupTriggered(num(r[51]), on(r[56]), watcher.trig);
      }
      this._stepStates();
      this._stepTimers(dt);
    }
    // Collision State (3640): the player entering/leaving its own box spawns
    // State On (51) / State Off (71).
    _stepStates() {
      if (!this._stateBlocks) this._stateBlocks = (this.level._logicTriggers || []).filter(t => t.id === 3640);
      if (!this._stateBlocks.length) return;
      const scene = this.scene, player = scene?._player;
      if (!player || player.p.isDead) return;
      const px = scene._playerWorldX, py = player.p.y, half = 30 + (typeof playerSize === "number" ? playerSize : 20);
      for (const trig of this._stateBlocks) {
        if (!this.level._isTriggerSaveObjectLive(trig.uid)) continue;
        const node = this.level.gdObjects[trig.uid];
        if (node && (!node.enabled || node.removed)) continue;
        const inside = this.level._touchesTrigger(trig, px, py, half);
        const was = !!this.stateInside.get(trig.uid);
        if (inside === was) continue;
        this.stateInside.set(trig.uid, inside);
        const group = inside ? num(trig.raw[51]) : num(trig.raw[71]);
        if (group > 0) this.level._activateSpawnedGroup(group, scene._colorManager, false, trig);
      }
    }
  }
  window.GDLogicState = GDLogicState;
  window.GD_LOGIC_IDS = IDS;
})();
