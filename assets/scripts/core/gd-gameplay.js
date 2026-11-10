// Rotate Gameplay changes the physics axes, independently of the camera.
// Colliders are viewed through an orthonormal local frame; their activation
// state remains on the original object so dual players and triggers share it.
(function () {
  "use strict";
  const clean = n => Math.abs(n) < 1e-10 ? 0 : n;
  class GDGameplayState {
    constructor(level) { this.level = level; this.reset(); }
    reset() {
      this.u = { x: 1, y: 0 }; this.v = { x: 0, y: 1 };
      this.origin = { x: 0, y: 0 }; this.speedScale = 1;
      this.cache = new WeakMap(); this.pending = [];
      this.secondaryWorldAxes = false; this._secondaryFrame = null; this._physicsOriginals = null;
    }
    get rotated() { return this.u.x !== 1 || this.u.y !== 0 || this.v.x !== 0 || this.v.y !== 1; }
    get visualRotation() { return Math.atan2(-this.u.y, this.u.x); }
    get reflection() { return this.u.x * this.v.y - this.u.y * this.v.x < 0; }
    visualAngle(angle) { return this.visualRotation + (this.reflection ? -angle : angle); }
    toLocal(x, y) {
      x -= this.origin.x; y -= this.origin.y;
      return { x: x * this.u.x + y * this.u.y, y: x * this.v.x + y * this.v.y };
    }
    toWorld(x, y) {
      return { x: this.origin.x + x * this.u.x + y * this.v.x, y: this.origin.y + x * this.u.y + y * this.v.y };
    }
    trigger(trig) {
      const scene = this.level._scene;
      // Spawn/touch triggers can run inside collision handling. Apply their
      // frame change at the next substep boundary, after restoring world space.
      if (scene._localPhysicsActive) { this.pending.push(trig); return; }
      const r = trig.raw;
      if (r[171] === "1") this.level._gameplayChannel = Number(r[173]) || 0;
      if (r[172] === "1") return;
      const wasVertical = Math.abs(this.u.y) > 0.5;
      const directions = { 1: { x: 0, y: 1 }, 2: { x: 0, y: -1 }, 3: { x: -1, y: 0 }, 4: { x: 1, y: 0 } };
      let ground = Number(r[167]), gravity = Number(r[166]);
      if (!directions[ground] || !directions[gravity]) {
        // RotateGameplayGameObject::updateGameplayRotation uses the slope
        // orientation when the explicit direction fields are absent.
        const type = _gdSlopeType(r[4] === "1", r[5] === "1", Number(r[6]) || 0);
        const defaults = [[2, 4], [1, 4], [2, 3], [1, 3], [3, 2], [4, 1], [3, 1], [4, 2]][type ?? 0];
        gravity = directions[gravity] ? gravity : defaults[0];
        ground = directions[ground] ? ground : defaults[1];
      }
      // Despite the field names, groundDirection is travel and moveDirection
      // is gravity (1 up, 2 down, 3 left, 4 right). Sprite flipY cannot replace
      // these fields: Dash deliberately saves both on its wall turns.
      this.u = { ...directions[ground] };
      const vertical = Math.abs(this.u.y) > 0.5;
      this.v = vertical ? { x: 1, y: 0 } : { x: 0, y: 1 };
      this.origin = this.rotated ? { x: scene._playerWorldX || 0, y: scene._state?.y || 0 } : { x: 0, y: 0 };
      this.cache = new WeakMap();
      this.level._channelDirections[this.level._gameplayChannel] = { ...this.u };
      // A new dual body retains its world axes until the next gameplay
      // turn: copyAttributes does not copy m_isSideways (native 4fea30).
      const secondaryWasVertical = this.secondaryWorldAxes ? false : wasVertical;
      this.secondaryWorldAxes = false;
      for (const player of [scene._player, ...(scene._isDual ? [scene._player2] : [])]) {
        if (!player?.p) continue;
        const previousVertical = player === scene._player2 ? secondaryWasVertical : wasVertical;
        if (previousVertical !== vertical) {
          const modY = r[169] === "1" ? Number(r[583] ?? 0) : 1;
          const travel = (typeof playerSpeed === "number" ? playerSpeed : 11.540004) * (typeof d === "number" ? d : 0.9);
          player.p.yVelocity = r[584] === "1" ? modY : travel * modY;
        }
        player.p.gravityFlipped = gravity === (vertical ? 4 : 1);
        player.p.onGround = false; player.p.onCeiling = false; player.p.canJump = false;
        player._prevSlopeObj = null; player._activeSlopeObj = null; player._slopeRiding = false;
      }
    }
    flush() {
      const pending = this.pending.splice(0);
      for (const trig of pending) this.trigger(trig);
    }
    localCollider(col) {
      let entry = this.cache.get(col);
      if (!entry) {
        const geometry = Object.create(Object.getPrototypeOf(col));
        const proxy = new Proxy(col, {
          get: (target, key) => Object.hasOwn(geometry, key) ? geometry[key] : Reflect.get(target, key),
          set: (target, key, value) => { if (Object.hasOwn(geometry, key)) geometry[key] = value; else Reflect.set(target, key, value); return true; }
        });
        entry = { geometry, proxy }; this.cache.set(col, entry);
      }
      const g = entry.geometry, { u, v } = this;
      Object.assign(g, this.toLocal(col.x, col.y));
      if (Number.isFinite(col._gdPreviousX) && Number.isFinite(col._gdPreviousY)) {
        const previous = this.toLocal(col._gdPreviousX, col._gdPreviousY);
        g._gdPreviousX = previous.x; g._gdPreviousY = previous.y;
      }
      g.rotationDegrees = 0;
      const vector = (x, y) => [x * u.x + y * u.y, x * v.x + y * v.y];
      if (col.type === 'force_field') {
        const angle = (90 - (col.rotationDegrees || 0) - (col._forceRotationOffset||0)) * Math.PI / 180;
        const [x, y] = vector(Math.cos(angle), Math.sin(angle));
        g.forceRotationDegrees = 90 - Math.atan2(y, x) * 180 / Math.PI;
      }
      if (col.type === slopeType) {
        for (const [x, y] of [["hypoAx", "hypoAy"], ["hypoBx", "hypoBy"], ["rightAx", "rightAy"]]) [g[x], g[y]] = vector(col[x], col[y]);
        g.type = col.type; g.slopeRotation = 0;
        g.rotateSlope(0);
        // Reconstruct the GD orientation flags from the transformed triangle.
        const top = Math.max(g.hypoAy, g.hypoBy), left = Math.min(g.hypoAx, g.hypoBx);
        g.gdSolidAbove = Math.abs(g.rightAy - top) < 0.01;
        g.gdWallOnLeft = Math.abs(g.rightAx - left) < 0.01;
      } else {
        const theta = -(col.rotationDegrees || 0) * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta);
        const shape = col.shape || [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
          x *= col.w / 2; y *= col.h / 2; return [x * c - y * s, x * s + y * c];
        });
        g.shape = shape.map(([x, y]) => vector(x, y));
        g.w = 2 * Math.max(...g.shape.map(p => Math.abs(p[0])));
        g.h = 2 * Math.max(...g.shape.map(p => Math.abs(p[1])));
      }
      for (const [kx, ky] of [["portalX", "portalY"], ["teleportTargetX", "teleportTargetY"]]) {
        if (Number.isFinite(col[kx]) && Number.isFinite(col[ky])) {
          const p = this.toLocal(col[kx], col[ky]); g[kx] = p.x; g[ky] = p.y;
        }
      }
      if (Number.isFinite(col.orbRotation)) {
        const a = -col.orbRotation * Math.PI / 180;
        const [x, y] = vector(Math.cos(a), Math.sin(a));
        g.orbRotation = -Math.atan2(y, x) * 180 / Math.PI;
      }
      return entry.proxy;
    }
    enterPhysics() {
      const scene = this.level._scene, level = this.level;
      if (!this.rotated) return null;
      const worldX = scene._playerWorldX;
      const players = [scene._player, ...(scene._isDual && !this.secondaryWorldAxes ? [scene._player2] : [])].filter(p => p?.p);
      for (const player of players) {
        const p = player.p, x = player === scene._player ? worldX : (scene._secondaryWorldX ?? worldX);
        const current = this.toLocal(x, p.y), last = this.toLocal(x, p.lastY);
        p.y = current.y; p.lastY = last.y;
        if (player === scene._player) scene._playerWorldX = current.x;
        else scene._secondaryWorldX = current.x;
        if (Number.isFinite(player._lastCollisionWorldX) && Number.isFinite(player._lastCollisionWorldY)) {
          const previous = this.toLocal(player._lastCollisionWorldX, player._lastCollisionWorldY);
          player._lastCollisionWorldX = previous.x; player._lastCollisionWorldY = previous.y;
        }
      }
      const originals = { nearby: level.getNearbySectionObjects, floor: level.getFloorY, ceiling: level.getCeilingY,
        spider: level.getSpiderSearchObjects };
      this._physicsOriginals = originals;
      level.getNearbySectionObjects = localX => {
        const found = new Set();
        for (const player of players) {
          const world = this.toWorld(localX, player.p.y);
          for (const col of originals.nearby.call(level, world.x)) found.add(col);
        }
        return [...found].map(col => this.localCollider(col));
      };
      level.getSpiderSearchObjects = (localX, fromY, toY, halfWidth) => {
        // A turned spider ray can cross many world-X sections. Restricting it
        // to the player's ordinary collision neighbourhood loses distant walls
        // which are directly above the player in its gameplay coordinates.
        const corners = [this.toWorld(localX - halfWidth, fromY), this.toWorld(localX + halfWidth, fromY),
          this.toWorld(localX - halfWidth, toY), this.toWorld(localX + halfWidth, toY)];
        const lo = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)) / 200));
        const hi = Math.min(level._collisionSections.length - 1,
          Math.floor(Math.max(...corners.map(p => p.x)) / 200));
        const found = new Set();
        for (let section = lo; section <= hi; section++)
          for (const col of level._collisionSections[section] || []) if (col) found.add(col);
        return [...found].map(col => this.localCollider(col));
      };
      // The global horizontal floor is no longer the player's ground after a
      // gameplay turn. Authored wall/platform geometry supplies that surface.
      level.getFloorY = () => -Infinity; level.getCeilingY = () => null;
      scene._localPhysicsActive = true;
      return () => {
        for (const player of players) {
          const x = player === scene._player ? scene._playerWorldX : scene._secondaryWorldX;
          const p = player.p, current = this.toWorld(x, p.y), last = this.toWorld(x, p.lastY);
          p.y = current.y; p.lastY = last.y;
          if (player === scene._player) scene._playerWorldX = current.x;
          else scene._secondaryWorldX = current.x;
          if (Number.isFinite(player._lastCollisionWorldX) && Number.isFinite(player._lastCollisionWorldY)) {
            const previous = this.toWorld(player._lastCollisionWorldX, player._lastCollisionWorldY);
            player._lastCollisionWorldX = previous.x; player._lastCollisionWorldY = previous.y;
          }
        }
        level.getNearbySectionObjects = originals.nearby;
        level.getFloorY = originals.floor; level.getCeilingY = originals.ceiling;
        if (originals.spider) level.getSpiderSearchObjects = originals.spider;
        else delete level.getSpiderSearchObjects;
        scene._localPhysicsActive = false; this._physicsOriginals = null;
      };
    }
    frameForPlayer(player) {
      if (!this.secondaryWorldAxes || player !== this.level._scene?._player2) return this;
      return this._secondaryFrame ||= new GDGameplayState(this.level);
    }
    enterSecondaryPhysics() {
      const level = this.level, scene = level._scene, originals = this._physicsOriginals;
      if (!this.secondaryWorldAxes || !scene._localPhysicsActive || !originals) return null;
      const active = { nearby: level.getNearbySectionObjects, floor: level.getFloorY, ceiling: level.getCeilingY, spider: level.getSpiderSearchObjects };
      level.gameplayState = this.frameForPlayer(scene._player2);
      level.getNearbySectionObjects = originals.nearby; level.getFloorY = originals.floor; level.getCeilingY = originals.ceiling;
      if (originals.spider) level.getSpiderSearchObjects = originals.spider; else delete level.getSpiderSearchObjects;
      scene._localPhysicsActive = false;
      return () => {
        level.gameplayState = this; scene._localPhysicsActive = true;
        level.getNearbySectionObjects = active.nearby; level.getFloorY = active.floor; level.getCeilingY = active.ceiling;
        if (active.spider) level.getSpiderSearchObjects = active.spider; else delete level.getSpiderSearchObjects;
      };
    }
    capture() { return structuredClone({ u: this.u, v: this.v, origin: this.origin, speedScale: this.speedScale, pending: this.pending, secondaryWorldAxes: this.secondaryWorldAxes }); }
    restore(state) { Object.assign(this, structuredClone(state)); this.cache = new WeakMap(); }
  }
  window.GDGameplayState = GDGameplayState;
})();
