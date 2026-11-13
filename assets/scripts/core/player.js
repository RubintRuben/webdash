// PlayerObject::update (Steam RVA 4e7824): convert each displacement to
// float, then CCPoint::operator+ adds it to a float position. Keeping JS
// doubles accumulates a different horizontal position in long levels.
function gdAdvancePosition(position, delta, origin = 0) {
  // Saved object Y excludes the native 90-point ground offset (180 web px).
  return Math.fround(Math.fround(position + origin) + Math.fround(delta)) - origin;
}
// setYVelocity (4e6f50): round the fractional native velocity to 0.001,
// with ties away from zero. Web velocities are twice native velocities.
function gdQuantizeVelocity(value) {
  const native = value / 2, whole = Math.trunc(native), fraction = (native - whole) * 1000;
  return (whole + Math.sign(fraction) * Math.floor(Math.abs(fraction) + 0.5) / 1000) * 2;
}

class PlayerState {
  constructor() {
    this.reset();
  }
  reset() {
    this.y = 30;
    this.lastY = 30;
    this.lastGroundPosY = 30;
    this.yVelocity = 0;
    this.onGround = true;
    this.canJump = true;
    this.isJumping = false;
    this.gravityFlipped = false;
    this.gravityMod = 1;
    this.forceX = 0;
    this.forceY = 0;
    this.isFlying = false;
    this.isBall = false;
    this.isWave = false;
    this.isUfo = false;
    this.isSpider = false;
    this.isBird = false;
    this.isDart = false;
    this.isRobot = false;
    this.isSwing = false;
    this.isJetpack = false;
    this.isMini = false;
    this.wasBoosted = false;
    // PlayerObject +0x952 (gdsolver State::boost): the velocity-limit
    // exemption boostPlayer raises; ship, UFO and swing read it
    this.boostLatch = false;
    this.forceBoostLatch = false;
    this.jumpTrailActive = false;
    this._slopeBounceActive = false;
    this.pendingVelocity = null;
    this.collideTop = 0;
    this.collideBottom = 0;
    this.onCeiling = false;
    this.upKeyDown = false;
    this._physicalJumpHeld = false;
    this.upKeyPressed = false;
    this.queuedHold = false;
    this._orbActivationConsumedForPress = false;
    this.isDead = false;
    this.mirrored = false;
    this.isGoingLeft = false;
    this.isDashing = false;
    this.dashSlope = 0;
    this.dashXVelocity = 0;
    this.dashYVelocity = 0;
    this.stateHitHead = 0;
    this.stateFlipGravity = 0;
    this.stateNoAutoJump = 0;
    this.stateDartSlide = 0;
    this._holdDead = false;
    this.isDual = false;
    this.ignorePortals = false;
    this._robotHold = false;
    this._robotPadBoost = true;
    this._robotHoldTimer = 0;
    this._robotHoverBudget = 0;
    this._lastSpiderTeleportTime = -Infinity;
    this._spiderLocalGravityFrame = -1;
    this._spiderTeleportNoclipDeathPending = false;
    this.ballShouldRotate = false;
    this.ballRotateOpposite = false;
    this.ballNormalRotate = 0.86;
    this.ballHitPad = false;
    this.ballRotation2 = 0.86;
  }
}

// Triangle layer with the subset of the Graphics API the trails use. Phaser
// Graphics re-tessellates its command list on every render and every camera,
// which cost ~1.5 ms per frame for a wave trail; this keeps one interleaved
// vertex array (premultiplied colour) and draws it with a single call.
const FastTriangles = (() => {
  const programs = new WeakMap();
  const VS = "attribute vec2 aPos; attribute vec4 aCol; uniform vec2 uRes; uniform mat3 uView; varying vec4 vCol;" +
    "void main(){ vCol = aCol; vec2 p = (uView * vec3(aPos, 1.0)).xy; gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0); }";
  const FS = "precision mediump float; varying vec4 vCol; void main(){ gl_FragColor = vCol; }";
  const programFor = gl => {
    let entry = programs.get(gl);
    if (entry) return entry;
    const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    entry = { prog, vbo: gl.createBuffer(), bytes: 0, aPos: gl.getAttribLocation(prog, "aPos"), aCol: gl.getAttribLocation(prog, "aCol"),
      uRes: gl.getUniformLocation(prog, "uRes"), uView: gl.getUniformLocation(prog, "uView") };
    programs.set(gl, entry);
    return entry;
  };
  return function create(scene) {
    const ext = scene.add.extern();
    let buffer = new ArrayBuffer(3 * 12 * 256), f32 = new Float32Array(buffer), u32 = new Uint32Array(buffer);
    let vertices = 0, packed = 0xffffffff;
    const view = new Float32Array(9);
    let version = 0, uploaded = -1;
    ext.clear = () => { vertices = 0; version++; return ext; };
    ext.pack = (color, alpha = 1) => {
      const a = Math.max(0, Math.min(1, alpha));
      const r = Math.round(((color >> 16) & 255) * a), g = Math.round(((color >> 8) & 255) * a), b = Math.round((color & 255) * a);
      return ((Math.round(a * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
    };
    ext.fillStyle = (color, alpha = 1) => { packed = ext.pack(color, alpha); return ext; };
    const vertex = (x, y) => {
      const i = vertices * 3;
      f32[i] = x; f32[i + 1] = y; u32[i + 2] = packed; vertices++;
    };
    const reserve = () => {
      if ((vertices + 3) * 12 > buffer.byteLength) {
        const next = new ArrayBuffer(buffer.byteLength * 2);
        new Uint8Array(next).set(new Uint8Array(buffer));
        buffer = next; f32 = new Float32Array(buffer); u32 = new Uint32Array(buffer);
      }
    };
    ext.fillTriangle = (x1, y1, x2, y2, x3, y3) => {
      reserve();
      vertex(x1, y1); vertex(x2, y2); vertex(x3, y3); version++;
      return ext;
    };
    // per-vertex colours from ext.pack (Gouraud, as GL interpolates them)
    ext.colorTriangle = (x1, y1, c1, x2, y2, c2, x3, y3, c3) => {
      reserve();
      packed = c1; vertex(x1, y1); packed = c2; vertex(x2, y2); packed = c3; vertex(x3, y3); version++;
      return ext;
    };
    let lineWidth = 1, lineColor = 0xffffff, lineAlpha = 1;
    ext.lineStyle = (width, color, alpha = 1) => { lineWidth = width; lineColor = color; lineAlpha = alpha; return ext; };
    ext.lineBetween = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      if (!len) return ext;
      const nx = -dy / len * lineWidth * 0.5, ny = dx / len * lineWidth * 0.5;
      ext.fillStyle(lineColor, lineAlpha);
      ext.fillTriangle(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x1 - nx, y1 - ny);
      ext.fillTriangle(x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny);
      return ext;
    };
    ext.render = function (renderer, camera, m) {
      if (!vertices) return;
      const gl = renderer.gl, P = programFor(gl);
      gl.useProgram(P.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.vbo);
      const bytes = vertices * 12;
      if (bytes > P.bytes) { P.bytes = Math.max(bytes, P.bytes * 2, 4096); gl.bufferData(gl.ARRAY_BUFFER, P.bytes, gl.DYNAMIC_DRAW); P.owner = null; }
      // The buffer is shared by all layers; re-upload when another layer
      // used it since, or this layer's triangles changed (several cameras
      // draw the same layer each frame).
      if (P.owner !== ext || uploaded !== version) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint8Array(buffer, 0, bytes));
        P.owner = ext; uploaded = version;
      }
      gl.enableVertexAttribArray(P.aPos);
      gl.vertexAttribPointer(P.aPos, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(P.aCol);
      gl.vertexAttribPointer(P.aCol, 4, gl.UNSIGNED_BYTE, true, 12, 8);
      gl.uniform2f(P.uRes, renderer.width, renderer.height);
      view[0] = m.a; view[1] = m.b; view[3] = m.c; view[4] = m.d; view[6] = m.e; view[7] = m.f; view[8] = 1;
      gl.uniformMatrix3fv(P.uView, false, view);
      gl.enable(gl.BLEND);
      if (ext.blendMode === Phaser.BlendModes.ADD) gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, vertices);
      gl.disableVertexAttribArray(P.aCol);
    };
    return ext;
  };
})();
class StreakManager {
  constructor(_0x9c2356, _0x171c7f, _0x49d49a, _0xb01616, _0x5aac4b, _0x293ce3, _0x5c7bc5 = 16777215, _0x5a3e29 = 1) {
    this._color = _0x5c7bc5;
    this._opacity = _0x5a3e29;
    this._fadeDelta = 1 / _0x49d49a;
    this._minSegSq = _0xb01616 * _0xb01616;
    this._maxSeg = _0x293ce3;
    this._maxPoints = Math.floor(_0x49d49a * 60 + 2) * 5;
    this._stroke = _0x5aac4b;
    this._pts = [];
    this._posR = {
      x: 0,
      y: 0
    };
    this._posInit = false;
    this._active = false;
    const graphicsSettings = window.performanceOptimizer ? window.performanceOptimizer.getGraphicsSettings() : {
      enableGlow: true,
      blendMode: Phaser.BlendModes.ADD
    };
    
    this._gfx = FastTriangles(_0x9c2356);
    this._gfx.setBlendMode(graphicsSettings.blendMode);
  }
  addToContainer(_0xa23240, _0x4b05db) {
    _0xa23240.add(this._gfx);
    this._gfx.setDepth(_0x4b05db);
  }
  setColor(newColor) {
    this._color = newColor
  }
  setPosition(_0x388397, _0x292e79) {
    this._posR.x = _0x388397;
    this._posR.y = _0x292e79;
    this._posInit = true;
  }
  start() {
    this._active = true;
  }
  stop() {
    this._active = false;
  }
  reset() {
    this._pts = [];
    this._posInit = false;
    this._gfx.clear();
  }
  update(_0x2acf4c, draw = true) {
    if (!this._posInit) {
      this._gfx.clear();
      return;
    }
    const _0x1817b7 = _0x2acf4c * this._fadeDelta;
    let _0x56ab0b = 0;
    for (let _0x3ca060 = 0; _0x3ca060 < this._pts.length; _0x3ca060++) {
      this._pts[_0x3ca060].state -= _0x1817b7;
      if (this._pts[_0x3ca060].state > 0) {
        if (_0x56ab0b !== _0x3ca060) {
          this._pts[_0x56ab0b] = this._pts[_0x3ca060];
        }
        _0x56ab0b++;
      }
    }
    this._pts.length = _0x56ab0b;
    if (this._active && this._pts.length < this._maxPoints) {
      const _0x89a79d = this._pts.length;
      let _0x3d12ca = true;
      if (_0x89a79d > 0) {
        const _0x2748e4 = this._pts[_0x89a79d - 1];
        const _0x3a1a00 = this._posR.x - _0x2748e4.x;
        const _0x4c247a = this._posR.y - _0x2748e4.y;
        const _0x1f9fea = _0x3a1a00 * _0x3a1a00 + _0x4c247a * _0x4c247a;
        if (this._maxSeg > 0 && Math.sqrt(_0x1f9fea) > this._maxSeg) {
          this._pts.length = 0;
        } else if (_0x1f9fea < this._minSegSq) {
          _0x3d12ca = false;
        } else if (_0x89a79d > 1) {
          const _0x375c40 = this._pts[_0x89a79d - 2];
          const _0x14c0c1 = this._posR.x - _0x375c40.x;
          const _0x2d01f0 = this._posR.y - _0x375c40.y;
          if (_0x14c0c1 * _0x14c0c1 + _0x2d01f0 * _0x2d01f0 < this._minSegSq * 2) {
            _0x3d12ca = false;
          }
        }
      }
      if (_0x3d12ca) {
        this._pts.push({
          x: this._posR.x,
          y: this._posR.y,
          state: 1
        });
      }
    }
    if (!draw) return;
    this._gfx.clear();
    const pts = this._pts, n = pts.length;
    if (n < 2) return;
    // CCMotionStreak::update / ccVertexLineToPolygon: each point is pushed
    // stroke / 2 out along its perpendicular (the bisector at a joint, by
    // its angle as cocos2d does); a vertex's alpha is the point's fade
    // state, and streak_01_001's alpha across the stroke (STREAK_PROFILE,
    // bilinear) shapes the band. GD draws it additively.
    const half = this._stroke * 0.5, prof = StreakManager.PROFILE, cols = prof.length;
    const perp = this._perp || (this._perp = []);
    perp.length = n;
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      let px, py;
      if (i === 0 || i === n - 1) {
        const a = i === 0 ? p1 : pts[i - 1], b = i === 0 ? pts[1] : p1;
        const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1;
        px = -dy / l; py = dx / l;
      } else {
        const p0 = pts[i - 1], p2 = pts[i + 1];
        let ax = p2.x - p1.x, ay = p2.y - p1.y, la = Math.hypot(ax, ay) || 1;
        let bx = p0.x - p1.x, by = p0.y - p1.y, lb = Math.hypot(bx, by) || 1;
        ax /= la; ay /= la; bx /= lb; by /= lb;
        const angle = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by)));
        const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, lm = Math.hypot(mx, my) || 1;
        if (angle < 70 * Math.PI / 180) { px = -my / lm; py = mx / lm; }
        else if (angle < 170 * Math.PI / 180) { px = mx / lm; py = my / lm; }
        else { const dx = p2.x - p0.x, dy = p2.y - p0.y, l = Math.hypot(dx, dy) || 1; px = -dy / l; py = dx / l; }
      }
      perp[i] = [px * half, py * half];
    }
    const gfx = this._gfx, color = this._color;
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1], a = perp[i], b = perp[i + 1];
      const sa = Math.max(0, p.state) * this._opacity, sb = Math.max(0, q.state) * this._opacity;
      for (let k = 0; k < cols - 1; k++) {
        const t0 = -1 + 2 * k / (cols - 1), t1 = -1 + 2 * (k + 1) / (cols - 1);
        const ca0 = gfx.pack(color, sa * prof[k]), ca1 = gfx.pack(color, sa * prof[k + 1]);
        const cb0 = gfx.pack(color, sb * prof[k]), cb1 = gfx.pack(color, sb * prof[k + 1]);
        const x00 = p.x + a[0] * t0, y00 = p.y + a[1] * t0, x01 = p.x + a[0] * t1, y01 = p.y + a[1] * t1;
        const x10 = q.x + b[0] * t0, y10 = q.y + b[1] * t0, x11 = q.x + b[0] * t1, y11 = q.y + b[1] * t1;
        gfx.colorTriangle(x00, y00, ca0, x01, y01, ca1, x11, y11, cb1);
        gfx.colorTriangle(x00, y00, ca0, x11, y11, cb1, x10, y10, cb0);
      }
    }
  }
}
// HardStreak (Steam 0x3bfb60, updateStroke): the wave trail is the polyline
// of the points PlayerObject::placeStreakPoint drops where the wave turns,
// with the player's position as its head, pulled 4 back along the last
// segment once that is longer than 10. Two additive ribbons with mitred
// joints (offset (n1 + n2) / |n1 + n2| / dot, the dot floored at 0.25): the
// trail colour max(1, 6 * waveSize * pulse) wide at the node's opacity and
// white max(1, 2 * waveSize * pulse) wide at 0.65 of it, where pulse =
// (audioScale - 0.1) * 2.1 + 0.4 (PlayerObject::update). Nothing fades with
// age: points leave behind the camera, and the whole trail fades out
// (CCFadeOut) when the wave mode ends. Web units are 2x GD.
// streak_01_001.png's alpha across its 32 columns, sampled at 9 points
StreakManager.PROFILE = [0.025, 0.474, 0.681, 0.716, 0.718, 0.707, 0.643, 0.372, 0.024];
class WaveTrail {
  constructor(scene, color) {
    this._color = color;
    this._pts = [];
    this._active = false;
    this._posInit = false;
    this._pos = { x: 0, y: 0 };
    this._waveSize = 1;
    this._pulse = 1;
    this._opacity = 1;
    this._fadeLeft = 0;
    this._fadeTime = 0;
    this._scale = 1;
    this._gfx = FastTriangles(scene);
    this._gfx.setBlendMode(Phaser.BlendModes.ADD);
  }
  addToContainer(container, depth) {
    container.add(this._gfx);
    this._gfx.setDepth(depth);
  }
  setPosition(x, y) { this._pos.x = x; this._pos.y = y; this._posInit = true; }
  setColor(color) { this._color = color; }
  setMiniScale(isMini) { this._waveSize = isMini ? 0.6 : 1; }
  setAudioScale(audioScale) {
    const a = Number.isFinite(audioScale) ? audioScale : 0.5;
    this._pulse = (a - 0.1) * 2.1 + 0.4;
  }
  start() {
    if (!this._active) this._pts.length = 0;
    this._active = true; this._opacity = 1; this._fadeLeft = 0;
  }
  // PlayerObject::fadeOutStreak2: the trail keeps its points and fades
  fadeOut(duration) {
    if (!this._active) return;
    this._active = false;
    this._fadeTime = this._fadeLeft = Math.max(0.001, duration);
  }
  stop() { this._active = false; }
  reset() { this._pts.length = 0; this._posInit = false; this._fadeLeft = 0; this._gfx.clear(); }
  // placeStreakPoint: a vertex where the direction changes. Per-frame
  // positions that continue the last segment's line move that vertex instead.
  _place(x, y) {
    const P = this._pts, n = P.length;
    if (n >= 2) {
      const ax = P[n - 2].x, ay = P[n - 2].y, bx = P[n - 1].x, by = P[n - 1].y;
      const ux = bx - ax, uy = by - ay, vx = x - bx, vy = y - by;
      const cross = ux * vy - uy * vx, dot = ux * vx + uy * vy;
      if (dot >= 0 && Math.abs(cross) <= 0.02 * Math.hypot(ux, uy) * Math.hypot(vx, vy) + 1e-9) {
        P[n - 1].x = x; P[n - 1].y = y;
        return;
      }
    }
    if (n && (P[n - 1].x - x) ** 2 + (P[n - 1].y - y) ** 2 <= 0.04) return;
    P.push({ x, y });
  }
  update(seconds, draw = true, minX = -Infinity) {
    if (!this._posInit) { this._gfx.clear(); return; }
    if (this._fadeLeft > 0) {
      this._fadeLeft = Math.max(0, this._fadeLeft - Math.max(0, seconds || 0));
      this._opacity = this._fadeLeft / this._fadeTime;
      if (this._fadeLeft <= 0) this._pts.length = 0;
    }
    if (this._active) this._place(this._pos.x, this._pos.y);
    // clearBehindXPos: drop points whose next point is also off the left
    let drop = 0;
    while (drop + 1 < this._pts.length && this._pts[drop + 1].x < minX) drop++;
    if (drop) this._pts.splice(0, drop);
    if (!draw) return;
    this._gfx.clear();
    const pts = this._pts;
    if (pts.length < 2 || this._opacity <= 0) return;
    // the head: the stored polyline already ends at the player while active
    const n = pts.length;
    const head = { x: pts[n - 1].x, y: pts[n - 1].y };
    const tail = pts[n - 2];
    const hl = Math.hypot(head.x - tail.x, head.y - tail.y);
    if (this._active && hl > 20) { head.x -= (head.x - tail.x) / hl * 8; head.y -= (head.y - tail.y) / hl * 8; }
    const P = this._drawPts || (this._drawPts = []);
    P.length = 0;
    for (let i = 0; i < n - 1; i++) P.push(pts[i]);
    P.push(head);
    const N = this._normals || (this._normals = []), M = this._miters || (this._miters = []);
    N.length = n - 1; M.length = n;
    for (let i = 0; i < n - 1; i++) {
      const dx = P[i + 1].x - P[i].x, dy = P[i + 1].y - P[i].y, len = Math.hypot(dx, dy) || 1;
      N[i] = [-dy / len, dx / len];
    }
    for (let i = 0; i < n; i++) {
      const a = N[i === 0 ? 0 : i - 1], c = N[i === n - 1 ? n - 2 : i];
      const sx = a[0] + c[0], sy = a[1] + c[1], len = Math.hypot(sx, sy);
      if (len < 0.001) { M[i] = a; continue; }
      const ux = sx / len, uy = sy / len, dot = a[0] * ux + a[1] * uy;
      const k = dot > 0.25 ? 1 / dot : 4;
      M[i] = [ux * k, uy * k];
    }
    const custom=window.customWaveTrail,settings=window.GDHacks?.state||{};
    const pulse=custom?Number(settings.waveScale??2):this._pulse;
    let trailColor=this._color;
    if(custom&&settings.waveRainbow){
      const hue=(performance.now()/1000*Number(settings.waveRainbowSpeed??.5)/10)%1;
      const sat=Number(settings.waveSaturation??100)/100,val=Number(settings.waveValue??100)/100;
      const rgb=[0,2/3,1/3].map(offset=>Math.round(val*(1-sat+sat*Math.max(0,Math.min(1,Math.abs(((hue+offset)%1)*6-3)-1)))*255));
      trailColor=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];
    }else if(custom&&settings.waveCustomColor)trailColor=parseInt(String(settings.waveColor||'#ffffff').slice(1),16);
    const gfx = this._gfx, size = this._waveSize * pulse * this._scale;
    if (!(size > 0) || !Number.isFinite(size)) return;
    // HardStreak 3c0211..3c029a suppresses a newly turned segment while
    // its joint protrudes farther along it than the head has travelled.
    // Without this guard the overlapping mitre flashes as a spike at every
    // direction change. The native 3 * size threshold is 6 in web units.
    const lastDx = head.x - tail.x, lastDy = head.y - tail.y;
    const lastLength = Math.hypot(lastDx, lastDy), joint = M[n - 2];
    const skipHead = lastLength > 0 && Math.abs((lastDx * joint[0] + lastDy * joint[1]) / lastLength) * 6 * size > lastLength;
    // Solid Wave Trail (HardStreak::m_isSolid): only the colour pass, blended
    // normally instead of additively
    const solid = window.solidWave === true;
    gfx.setBlendMode(solid ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
    for (const [width, color, alpha] of solid ? [[6, trailColor, 1]] : [[6, trailColor, 1], [2, 0xffffff, 0.65]]) {
      const h = Math.max(1, width * size); // GD half-width x 2 web
      gfx.fillStyle(color, alpha * this._opacity);
      for (let i = 0; i < n - 1; i++) {
        if (skipHead && i === n - 2) continue;
        const p = P[i], q = P[i + 1], m1 = M[i], m2 = M[i + 1];
        const ax = p.x - m1[0] * h, ay = p.y - m1[1] * h, bx = p.x + m1[0] * h, by = p.y + m1[1] * h;
        const cx = q.x + m2[0] * h, cy = q.y + m2[1] * h, dx = q.x - m2[0] * h, dy = q.y - m2[1] * h;
        gfx.fillTriangle(ax, ay, bx, by, cx, cy);
        gfx.fillTriangle(ax, ay, cx, cy, dx, dy);
      }
    }
  }
}
function ds(scene, x, y, frameName, depth, isVisible) {
  let atlasData = getAtlasFrame(scene, frameName);
  if (!atlasData) {
    return null;
  }
  let image = scene.add.image(x, y, atlasData.atlas, atlasData.frame);
  image.setDepth(depth);
  image.setVisible(isVisible);
  return {
    sprite: image
  };
}

function _textureHasFrameSafe(scene, textureKey, frameName) {
  try {
    const texture = scene?.textures?.get(textureKey);
    return !!(texture && typeof texture.has === "function" && texture.has(frameName));
  } catch (err) {
    return false;
  }
}
function _makeAtlasLayer(scene, x, y, textureKey, frameName, depth, isVisible, tint = null, kind = "base") {
  if (!_textureHasFrameSafe(scene, textureKey, frameName)) {
    return null;
  }
  const image = scene.add.image(x, y, textureKey, frameName);
  image.setDepth(depth);
  image.setVisible(isVisible);
  if (tint !== null && tint !== undefined) image.setTint(tint);
  if (kind === "glow") image._glowEnabled = false;
  return {
    sprite: image,
    kind,
    frameName,
    textureKey
  };
}
function _parseAnimPair(value, fallbackX = 0, fallbackY = 0) {
  const match = String(value ?? "").match(/\{\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\}/);
  if (!match) return { x: fallbackX, y: fallbackY };
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  return {
    x: Number.isFinite(x) ? x : fallbackX,
    y: Number.isFinite(y) ? y : fallbackY
  };
}
function _spiderVariantFrameName(frameName, variant) {
  if (!frameName) return frameName;
  if (variant === "glow") return frameName.replace(/_001\.png$/, "_glow_001.png");
  if (variant === "overlay") return frameName.replace(/_001\.png$/, "_2_001.png");
  if (variant === "extra") return frameName.replace(/_001\.png$/, "_extra_001.png");
  return frameName;
}
function _mixTintTowardWhite(baseColor, amount) {
  const clamped = Math.max(0, Math.min(1, Number(amount) || 0));
  const color = Number.isFinite(Number(baseColor)) ? Number(baseColor) : 0xffffff;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const rr = Math.round(r + (255 - r) * clamped);
  const gg = Math.round(g + (255 - g) * clamped);
  const bb = Math.round(b + (255 - b) * clamped);
  return (rr << 16) | (gg << 8) | bb;
}
function _mixColors(colorA, colorB, amount) {
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  const a = Number.isFinite(Number(colorA)) ? Number(colorA) : 0xffffff;
  const b = Number.isFinite(Number(colorB)) ? Number(colorB) : 0xffffff;
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const rr = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return (rr << 16) | (gg << 8) | rb;
}

class PlayerObject {
  constructor(scene, _0x3f50cc, _0x2811e1) {
    this._scene = scene;
    this.p = _0x3f50cc;
    this._gameLayer = _0x2811e1;
    this._rotation = 0;
    this._resetSlopeState();
    this.rotateActionActive = false;
    this.rotateActionRate = 0;
    this._lastLandObject = null;
    this._lastXOffset = 0;
    this._lastCameraX = 0;
    this._lastCameraY = 0;
    this._dashAnimationFrame = 0;
    this._dashAnimationTimer = 0;
    this._dashAnimationSprite = null;
    this._spiderTeleportCircles = [];
    this._robotJumpFlameSprite = null;
    this._robotJumpFlamePulse = 0;
    this._robotJumpFlameFadeInTimer = 0;
    this._robotJumpFlameActive = false;
    this._robotJumpFlameAnchorX = centerX;
    this._robotJumpFlameAnchorY = b(this.p.y);
    this._lastScreenX = centerX;
    this._lastScreenY = b(this.p.y);
    this._hitboxTrail = [];
    this._lastCollisionWorldX = null;
    this._lastCollisionWorldY = null;
    this._ignoreTeleportUntilClear = false;
    this._multiContacts = new Set();
    this._invertPlayerColors = false;
    this._deathBurstEmitter = null;
    this._deathFlashGraphics = null;
    this._deathFlashTween = null;
    this._deathAnimationPaused = false;
    this._createSprites();
    this._hitboxGraphics = scene.add.graphics().setScrollFactor(1).setDepth(20);
    this._initParticles(scene);
    scene.events.on("shutdown", () => this._cleanupExplosion());
    this.noclipStats = {
      totalFrames: 0,
      deathFrames: 0,
      accuracy: 100,
      deaths: 0
    };
  }
  _primaryColor() {
    return this._invertPlayerColors ? window.secondaryColor : window.mainColor;
  }
  _secondaryColor() {
    return this._invertPlayerColors ? window.mainColor : window.secondaryColor;
  }
  _tintForLayerKind(kind) {
    if (kind === "base") return this._primaryColor();
    if (kind === "overlay" || kind === "glow") return this._secondaryColor();
    return null;
  }
  setInvertedColors(inverted) {
    this._invertPlayerColors = !!inverted;
    this._applyPlayerTints();
  }
  _applyPlayerTints() {
    const applyLayer = (layer) => {
      if (!layer?.sprite) return;
      const tint = this._tintForLayerKind(layer.kind || "base");
      if (tint !== null && tint !== undefined) layer.sprite.setTint(tint);
      else if (layer.sprite.clearTint) layer.sprite.clearTint();
    };
    for (const layer of (this._allLayers || [])) applyLayer(layer);
    if (this._playerSpriteLayer?.sprite) this._playerSpriteLayer.sprite.setTint(this._primaryColor());
    if (this._playerGlowLayer?.sprite) this._playerGlowLayer.sprite.setTint(this._secondaryColor());
    if (this._playerOverlayLayer?.sprite) this._playerOverlayLayer.sprite.setTint(this._secondaryColor());
    if (this._shipSpriteLayer?.sprite) this._shipSpriteLayer.sprite.setTint(this._primaryColor());
    if (this._shipGlowLayer?.sprite) this._shipGlowLayer.sprite.setTint(this._secondaryColor());
    if (this._shipOverlayLayer?.sprite) this._shipOverlayLayer.sprite.setTint(this._secondaryColor());
    if (this._ballSpriteLayer?.sprite) this._ballSpriteLayer.sprite.setTint(this._primaryColor());
    if (this._ballGlowLayer?.sprite) this._ballGlowLayer.sprite.setTint(this._secondaryColor());
    if (this._ballOverlayLayer?.sprite) this._ballOverlayLayer.sprite.setTint(this._secondaryColor());
    if (this._waveSpriteLayer?.sprite) this._waveSpriteLayer.sprite.setTint(this._primaryColor());
    if (this._waveGlowLayer?.sprite) this._waveGlowLayer.sprite.setTint(this._secondaryColor());
    if (this._waveOverlayLayer?.sprite) this._waveOverlayLayer.sprite.setTint(this._secondaryColor());
    if (this._birdSpriteLayer?.sprite) this._birdSpriteLayer.sprite.setTint(this._primaryColor());
    if (this._birdGlowLayer?.sprite) this._birdGlowLayer.sprite.setTint(this._secondaryColor());
    if (this._birdOverlayLayer?.sprite) this._birdOverlayLayer.sprite.setTint(this._secondaryColor());
    if (this._particleEmitter) this._particleEmitter.tint = this._primaryColor();
    if (this._landEmitter1) this._landEmitter1.tint = this._primaryColor();
    if (this._landEmitter2) this._landEmitter2.tint = this._primaryColor();
    if (this._streak?.setColor) this._streak.setColor(this._secondaryColor());
    if (this._waveTrail?.setColor) this._waveTrail.setColor(this._primaryColor(), this._primaryColor());
  }
	  _makeportalguide(gameObj) {
	    if (!gameObj) return;
	    if (typeof this._activatePortalGuideGlow === "function") {
	        this._activatePortalGuideGlow(gameObj);
	    }
	  }
  _getActivationKey() {
    return this._activationKey || (this.p === this._scene?._state2 ? "dual" : "main");
  }
  _usesIndependentActivation(gameObj) {
    const type = String(gameObj?.type || "");
    return type.startsWith("portal_") || type === speedType || type === "speed" || type === jumpRingType || type === jumpPadType;
  }
  _isObjectActivated(gameObj) {
    if (!gameObj) return false;
    if (!this._usesIndependentActivation(gameObj)) return !!gameObj.activated;
    return !!gameObj._activatedByPlayer?.[this._getActivationKey()];
  }
  _setObjectActivated(gameObj, activated = true) {
    if (!gameObj) return;
    // EffectGameObject::activatedByPlayer / hasBeenActivatedByPlayer
    // (2a1a30 / 2a1a90) share the Multi Activate gate for rings, pads and
    // portals. Reusable gravity portals must be able to reverse an auto
    // player's next crossing too, rather than staying used for the attempt.
    if (activated && gameObj.multiActivate) return;
    if (!this._usesIndependentActivation(gameObj)) {
      gameObj.activated = !!activated;
      return;
    }
    if (!gameObj._activatedByPlayer) gameObj._activatedByPlayer = {};
    gameObj._activatedByPlayer[this._getActivationKey()] = !!activated;
    gameObj.activated = Object.values(gameObj._activatedByPlayer).some(Boolean);
  }
  _syncOtherDualGravityForBlueBoost() {
    const scene = this._scene;
    if (!scene?._isDual) return;
    if (this.p === scene._state && typeof scene._syncDualGlobalsFromPrimary === "function") {
      scene._syncDualGlobalsFromPrimary({ forceGravitySync: true });
    } else if (this.p === scene._state2 && typeof scene._syncDualGlobalsFromSecondary === "function") {
      scene._syncDualGlobalsFromSecondary({ forceGravitySync: true });
    }
  }
  _worldX() {
    return this.p === this._scene?._state2 ? (this._scene._secondaryWorldX ?? this._scene._playerWorldX) : this._scene?._playerWorldX;
  }
  _setWorldX(x) {
    if (this.p === this._scene._state2) this._scene._secondaryWorldX = x;
    else this._scene._playerWorldX = x;
  }
  reversePlayer(object = null) {
    if (object && object._eeLevelObject?._raw?.[117] !== "1") return;
    // PlayerObject::reversePlayer / doReversePlayer (4f6740, 4f6830):
    // a reversing pad/ring turns this player, independently of its dual.
    this.p.isGoingLeft = !this.p.isGoingLeft;
    if (this.p.isBall) { this.stopRotation(); this._runBallRotation(); }
  }
  _markActivatedOrbSprites(gameObj) {
    if (!gameObj) return;
    this.reversePlayer(gameObj);
    const objectId = Number.isInteger(gameObj._eeObjectId) ? gameObj._eeObjectId : -1;
    if (objectId >= 0) this._gameLayer.gdRenderer?.activateRing(this._gameLayer.gdObjects?.[objectId]);
    const targetY = typeof b === "function" ? b(gameObj.y) : gameObj.y;
    const now = Date.now();
    try {
      for (let _orbSpr of (this._gameLayer._orbSprites || [])) {
        if (!_orbSpr) continue;
        const sameObject = objectId >= 0 && _orbSpr._eeObjectId === objectId;
        const samePosition = _orbSpr._eeWorldX !== undefined &&
          Math.abs(_orbSpr._eeWorldX - gameObj.x) < 10 &&
          (_orbSpr._eeBaseY === undefined || Math.abs(_orbSpr._eeBaseY - targetY) < 10);
        if (sameObject || (objectId < 0 && samePosition)) {
          _orbSpr._hitTime = now;
        }
      }
    } catch(e) {}
  }
  _consumeOrbActivationInput() {
    this.p._orbActivationConsumedForPress = true;
    this.p.upKeyPressed = false;
    this.p.queuedHold = false;
    // ringJump's tail (Steam 4f77f6..4f783b) also drops the held flag for
    // ball, spider and swing.
    if (this.p.isBall || this.p.isSpider || this.p.isSwing) this._consumeHeldButton();
  }
  // PlayerObject's held flag (0x98d) is set only by pushButton; ball flips,
  // spider teleports and some rings clear it, so the hold does nothing more
  // (no ship lift, no cube auto-jump) until the next press.
  _consumeHeldButton() {
    this.p._holdDead = true;
    this.p.upKeyDown = false;
    this.p.upKeyPressed = false;
    this.p.queuedHold = false;
  }
  // ringJump clears the buffered press (m_jumpBuffered, Steam 4f7423) but
  // leaves the held one (0x98d), which is what a grounded cube, ball or
  // spider jumps on. Here queuedHold is the buffered press, and upKeyPressed
  // stands for both on the UFO, robot and swing, which need both.
  _ringTakesBufferedPress(keepHeld) {
    this.p.queuedHold = false;
    if (!keepHeld) this.p.upKeyPressed = false;
  }
  // ringJump's speed (Steam 4f7448..4f775b, drop ring 4f7acb..4f7b60): the
  // float jump base times the ring factor and the mini 0.8, stored through
  // setYVelocity (0.001 steps); ball and spider then keep 0.7, swing 0.6.
  // Web units; the caller applies the gravity direction.
  _ringJumpSpeed(orbId) {
    const P = this.p, ship = P.isFlying && !P.isSwing;
    if (orbId === 1330) {
      const drop = ship || P.isSwing || P.isWave || P.isUfo ? (P.isUfo ? Math.fround(-14 * Math.fround(0.8)) : -14)
        : P.isSpider && !P.isRobot ? Math.fround(-15 * Math.fround(1.1)) : -15;
      return gdQuantizeVelocity(drop * 2);
    }
    if (![36, 141, 1333, 84, 1022].includes(orbId)) return 0;
    let k = 1;
    if (orbId === 84) k = 0.8;
    else if (orbId === 1022) k = ship ? 0.7 : 1;
    else if (orbId === 141) k = ship ? 0.37 : P.isUfo ? 0.42 : P.isBall ? 0.77 : 0.72;
    else if (orbId === 1333) k = ship ? (P.isMini ? 1.4 : 1) : P.isUfo ? (P.isMini ? 1.36 : 1.02) : P.isBall || P.isSpider ? 1.34 : P.isRobot ? 1.28 : 1.38;
    else if (P.isRobot) k = 0.9;
    const base = Math.fround(this._gdSpeedPhys().jump / 2);
    let v = Math.fround(base * Math.fround(k));
    if (P.isMini) v = Math.fround(v * Math.fround(0.8));
    v = gdQuantizeVelocity(v * 2);
    if (P.isBall || P.isSpider) v *= 0.7;
    else if (P.isSwing) v *= 0.6;
    return v;
  }
  // updateJump's ground jump (Steam 4e9eb1..4e9f8c): the float jump base,
  // x0.5 for the robot and x0.8 mini, stored through setYVelocity.
  _groundJumpSpeed() {
    let v = Math.fround(this._gdSpeedPhys().jump / 2);
    if (this.p.isRobot) v = Math.fround(v * Math.fround(0.5));
    if (this.p.isMini) v = Math.fround(v * Math.fround(0.8));
    return gdQuantizeVelocity(v * 2);
  }
  _heldPressActsOnGround() {
    return !this.p.isFlying && !this.p.isWave && !this.p.isUfo && !this.p.isRobot;
  }
  // Steam 3453c4/4f71be: the custom ring keeps the buffered press when the
  // level enables 2.2 changes (kA40) or is official level 22.
  _customRingKeepsPress() {
    return String(window.settingsMap?.kA40 ?? "0") === "1";
  }
  _getDashHoldTicks(gameObj) {
    if (!gameObj) return 0;
    if (!gameObj._dashHoldTicksByPlayer) gameObj._dashHoldTicksByPlayer = {};
    return gameObj._dashHoldTicksByPlayer[this._getActivationKey()] || 0;
  }
  _setDashHoldTicks(gameObj, ticks) {
    if (!gameObj) return;
    if (!gameObj._dashHoldTicksByPlayer) gameObj._dashHoldTicksByPlayer = {};
    gameObj._dashHoldTicksByPlayer[this._getActivationKey()] = ticks;
    gameObj._dashHoldTicks = Math.max(0, ...Object.values(gameObj._dashHoldTicksByPlayer).map(Number).filter(Number.isFinite));
  }
	  _getSpiderIconBase() {
    const rawBase = String(window.currentSpider || "spider_01");
    const match = rawBase.match(/^spider_\d+/);
    return match ? match[0] : "spider_01";
  }
  _resolveSpiderIconFrame(frameName) {
    const base = this._getSpiderIconBase();
    const resolved = String(frameName || "").replace(/^spider_\d+/, base);
    if (_textureHasFrameSafe(this._scene, "GJ_GameSheetIcons", resolved)) return resolved;
    if (_textureHasFrameSafe(this._scene, "GJ_GameSheetIcons", frameName)) return frameName;
    return resolved;
  }
  _getSpiderAnimDesc() {
    if (this._spiderAnimDesc !== undefined) return this._spiderAnimDesc;
    let data = null;
    try {
      data = this._scene?.cache?.json?.get?.("Spider_AnimDesc") || null;
    } catch (err) {
      data = null;
    }
    if (!data && typeof window !== "undefined") data = window.Spider_AnimDesc || null;
    if (!data || !data.animationContainer) {
      this._spiderFrameGroups = {};
      return null;
    }
    this._spiderAnimDesc = data;
    this._spiderFrameGroups = {};
    if (this._spiderAnimDesc?.animationContainer) {
      const frameKeys = Object.keys(this._spiderAnimDesc.animationContainer);
      const sortBySuffix = (a, b) => {
        const aa = parseInt((String(a).match(/_(\d+)\.png$/) || [0, 0])[1], 10) || 0;
        const bb = parseInt((String(b).match(/_(\d+)\.png$/) || [0, 0])[1], 10) || 0;
        return aa - bb;
      };
      this._spiderFrameGroups.run = frameKeys.filter(k => /^Spider_run_\d+\.png$/.test(k)).sort(sortBySuffix);
      this._spiderFrameGroups.run2 = frameKeys.filter(k => /^Spider_run2_\d+\.png$/.test(k)).sort(sortBySuffix);
      this._spiderFrameGroups.walk = frameKeys.filter(k => /^Spider_walk_\d+\.png$/.test(k)).sort(sortBySuffix);
      this._spiderFrameGroups.fall = frameKeys.filter(k => /^Spider_fall_loop_\d+\.png$/.test(k)).sort(sortBySuffix);
      this._spiderFrameGroups.idle = frameKeys.filter(k => /^Spider_idle01_\d+\.png$/.test(k)).sort(sortBySuffix);
      this._spiderFrameGroups.idle2 = frameKeys.filter(k => /^Spider_idle02_\d+\.png$/.test(k)).sort(sortBySuffix);
    }
    return this._spiderAnimDesc;
  }
  _createSpiderLayerSet(scene, x, y, textureName, tag) {
    const resolvedBase = this._resolveSpiderIconFrame(textureName);
    const layers = [];
    const makeLayer = (variant, tint, depthOffset) => {
      const frame = this._resolveSpiderIconFrame(_spiderVariantFrameName(resolvedBase, variant));
      const layer = _makeAtlasLayer(scene, x, y, "GJ_GameSheetIcons", frame, 8 + tag * 0.1 + depthOffset, false, tint, variant);
      if (layer) layers.push(layer);
      return layer;
    };
    const glow = makeLayer("glow", this._secondaryColor(), -0.04);
    const base = makeLayer("base", this._primaryColor(), 0);
    const overlay = makeLayer("overlay", this._secondaryColor(), 0.04);
    const extra = makeLayer("extra", null, 0.08);
    return { tag, textureName, layers, glow, base, overlay, extra };
  }
  _initSpiderAnimationParts(scene, x, y) {
    this._spiderAnimTimer = 0;
    this._spiderAnimDesc = undefined;
    this._spiderPartsByTag = {};
    this._spiderLayers = [];
    const desc = this._getSpiderAnimDesc();
    const usedTextures = desc?.usedTextures || null;
    let entries = [];
    if (usedTextures) {
      entries = Object.values(usedTextures).slice().sort((a, b) => (parseInt(a.tag || "0", 10) || 0) - (parseInt(b.tag || "0", 10) || 0));
    }
    if (!entries.length) {
      entries = [
        { tag: "0", texture: "spider_01_02_001.png" },
        { tag: "1", texture: "spider_01_02_001.png" },
        { tag: "2", texture: "spider_01_04_001.png" },
        { tag: "3", texture: "spider_01_01_001.png" },
        { tag: "4", texture: "spider_01_03_001.png" },
        { tag: "5", texture: "spider_01_02_001.png" }
      ];
    }
    for (const entry of entries) {
      const tag = parseInt(entry.tag || "0", 10) || 0;
      const part = this._createSpiderLayerSet(scene, x, y, entry.texture, tag);
      if (!part.layers.length) continue;
      this._spiderPartsByTag[tag] = part;
      this._spiderLayers.push(...part.layers);
    }
  }
  _selectSpiderFrameKey(dt) {
    const desc = this._getSpiderAnimDesc();
    if (!desc?.animationContainer) return null;
    if (this.p._spiderTeleportAnimTimer > 0 && desc.animationContainer["Spider_jump_001.png"]) {
      this.p._spiderTeleportAnimTimer = Math.max(0, this.p._spiderTeleportAnimTimer - dt);
      return "Spider_jump_001.png";
    }
    const _speedPortalRef = (typeof SpeedPortal !== "undefined" && SpeedPortal) ? SpeedPortal : null;
    const _oneSpeed = Number(_speedPortalRef?.ONE_TIMES ?? 11.540004) || 11.540004;
    const _halfSpeed = Number(_speedPortalRef?.HALF ?? (_oneSpeed * 0.8)) || (_oneSpeed * 0.8);
    const _fourSpeed = Number(_speedPortalRef?.FOUR_TIMES ?? (_oneSpeed * 1.85)) || (_oneSpeed * 1.85);
    const _activeSpeed = Number.isFinite(Number(playerSpeed)) ? Number(playerSpeed) : _oneSpeed;
    let spiderAnimationSpeed = 1.75;
    if (_activeSpeed >= _oneSpeed) {
      const _fastT = Math.max(0, Math.min(1, (_activeSpeed - _oneSpeed) / Math.max(1e-6, _fourSpeed - _oneSpeed)));
      spiderAnimationSpeed = 1.75 + _fastT * 0.35;
    } else {
      const _slowT = Math.max(0, Math.min(1, (_oneSpeed - _activeSpeed) / Math.max(1e-6, _oneSpeed - _halfSpeed)));
      spiderAnimationSpeed = 1.75 - _slowT * 0.15;
    }
    this._spiderAnimTimer = (this._spiderAnimTimer || 0) + Math.max(0, dt || 0) * spiderAnimationSpeed;
    let group = null;
    if (!this.p.onGround && !this.p.onCeiling) {
      group = this._spiderFrameGroups?.fall;
    } else {
      group = this._spiderFrameGroups?.run;
    }
    if (!group || !group.length) group = this._spiderFrameGroups?.walk;
    if (!group || !group.length) group = this._spiderFrameGroups?.idle;
    if (!group || !group.length) return desc.animationContainer["Spider_idle_001.png"] ? "Spider_idle_001.png" : null;
    const fps = this.p.onGround || this.p.onCeiling ? 16 : 12;
    const idx = Math.floor(this._spiderAnimTimer * fps) % group.length;
    return group[idx];
  }
  _applySpiderFrame(frameKey, baseX, baseY, dt) {
    const desc = this._getSpiderAnimDesc();
    const frame = frameKey && desc?.animationContainer ? desc.animationContainer[frameKey] : null;
    if (!frame || !this._spiderPartsByTag) return false;
    const miniScale = (this.p.isMini ? 0.6 : 1) * this._spiderPopScale();
    const mirrorSign = this._getMirrorVisualScale();
    const gameplay = this._gameLayer?.gameplayState?.frameForPlayer?.(this) || this._gameLayer?.gameplayState;
    const visualFlipped = this.p.gravityFlipped !== !!gameplay?.reflection;
    const gravitySign = visualFlipped ? -1 : 1;
    const positionYSign = visualFlipped ? 1 : -1;
    const flashAmount = this._spiderFlashAmount();
    const seenTags = new Set();
    const robotFootTags = [2, 6];
    const robotFootPoints = [];
    const robotLegPoints = [];

    for (const spriteKey of Object.keys(frame)) {
      if (!spriteKey.startsWith("sprite_")) continue;
      const spriteData = frame[spriteKey];
      const tag = parseInt(spriteData.tag || "0", 10) || 0;
      const part = this._spiderPartsByTag[tag];
      if (!part) continue;
      seenTags.add(tag);
      const pos = _parseAnimPair(spriteData.position, 0, 0);
      const spiderLegTags = [0, 1, 4, 5];
      const isSpiderLegTag = spiderLegTags.includes(tag);
      const spiderLocalYOffset = tag === 3 ? 5 : (isSpiderLegTag ? -9 : 0);
      const spiderLocalXScale = isSpiderLegTag ? 1.8 : 1;
      const sc = _parseAnimPair(spriteData.scale, 1, 1);
      const fl = _parseAnimPair(spriteData.flipped, 0, 0);
      const zValue = parseFloat(spriteData.zValue || tag || "0") || 0;
      const rotDeg = parseFloat(spriteData.rotation || "0") || 0;
      const baseTexture = this._resolveSpiderIconFrame(spriteData.texture || part.textureName);
      const resolvedFrames = {
        glow: this._resolveSpiderIconFrame(_spiderVariantFrameName(baseTexture, "glow")),
        base: this._resolveSpiderIconFrame(baseTexture),
        overlay: this._resolveSpiderIconFrame(_spiderVariantFrameName(baseTexture, "overlay")),
        extra: this._resolveSpiderIconFrame(_spiderVariantFrameName(baseTexture, "extra"))
      };
      const commonX = baseX + pos.x * spiderLocalXScale * mirrorSign * miniScale;
      const commonY = baseY + (pos.y + spiderLocalYOffset) * positionYSign * miniScale;
      let commonRot = rotDeg * Math.PI / 180;
      commonRot *= mirrorSign < 0 ? -1 : 1;
      if (visualFlipped) commonRot = -commonRot;
      const baseScaleX = sc.x * (fl.x ? -1 : 1) * mirrorSign * miniScale;
      const baseScaleY = sc.y * (fl.y ? -1 : 1) * gravitySign * miniScale;


      const applyLayer = (layer, kind, depthOffset) => {
        if (!layer?.sprite) return;
        const frameName = resolvedFrames[kind];
        if (!_textureHasFrameSafe(this._scene, "GJ_GameSheetIcons", frameName)) {
          layer.sprite.setVisible(false);
          return;
        }
        layer.sprite.setTexture("GJ_GameSheetIcons", frameName);
        layer.sprite.x = commonX;
        layer.sprite.y = commonY;
        layer.sprite.rotation = commonRot;
        layer.sprite.scaleX = baseScaleX;
        layer.sprite.scaleY = baseScaleY;
        layer.sprite.setDepth(8 + zValue * 0.1 + depthOffset);

        const normalTint = this._tintForLayerKind(kind);
        if (flashAmount > 0 && (kind === "base" || kind === "overlay")) {
          layer.sprite.setTint(_mixTintTowardWhite(normalTint ?? 0xffffff, flashAmount));
        } else if (normalTint !== null && normalTint !== undefined) {
          layer.sprite.setTint(normalTint);
        } else if (typeof layer.sprite.clearTint === "function") {
          layer.sprite.clearTint();
        }

        layer.sprite.setVisible(kind === "glow" ? !!layer.sprite._glowEnabled : true);
      };
      applyLayer(part.glow, "glow", -0.04);
      applyLayer(part.base, "base", 0);
      applyLayer(part.overlay, "overlay", 0.04);
      applyLayer(part.extra, "extra", 0.08);
    }

    for (const tag of Object.keys(this._spiderPartsByTag)) {
      if (seenTags.has(parseInt(tag, 10))) continue;
      const part = this._spiderPartsByTag[tag];
      for (const layer of part.layers) layer?.sprite?.setVisible(false);
    }
    this._turnArtLayers(this._spiderLayers, baseX, baseY);
    return true;
  }
  // PlayerObject's spider teleport effect (Steam 0x4f3370, called by
  // spiderTestJumpInternal with the old and new positions after the flip):
  // three CCCircleWaves, a white flash of both player colours, an elastic pop
  // of the spider sprite and the spiderDash streak. Web units are 2x GD.
  _spawnSpiderTeleportEffects(oldGameY, newGameY) {
    if (window.noSpiderDash) return;
    if (this._effectsHidden()) return;
    if (this._scene?._editorPlaytestActive || !this._scene?.add) return;
    const scene = this._scene;
    const s = this.p.isMini ? 0.6 : 1;
    // CCPoints are shifted 7.5 forward (m_isGoingLeft flips it)
    const frame = scene._localPhysicsActive ? this._gameLayer.gameplayState : null;
    const x = Number.isFinite(Number(this._worldX())) ? Number(this._worldX()) : 0;
    const dir = this.p.isGoingLeft ? -1 : 1;
    const from = frame ? frame.toWorld(x + 15 * dir, oldGameY) : { x: x + 15 * dir, y: oldGameY };
    const to = frame ? frame.toWorld(x + 15 * dir, newGameY) : { x: x + 15 * dir, y: newGameY };
    const u = frame?.u || { x: 1, y: 0 };
    const fromY = b(from.y), toY = b(to.y);
    const color = this._secondaryColor();
    const layer = this._gameLayer?.container;
    if (!window.enableLDM) {
      // CCCircleWave(start, end, duration, fadeIn=false, easeOut=false):
      // radius and opacity 255 -> 0 tween linearly; m_opacityMod scales the
      // drawn alpha; mode 1 draws a 2 px outline instead of a filled disc.
      const waves = [
        [from.x, fromY, 13 * s, 1, 0.15, 0.42, false],
        [to.x + 12 * u.x * dir, toY - 12 * u.y * dir, 26 * s, 2, 0.25, 0.84, false],
        [to.x + 12 * u.x * dir, toY - 12 * u.y * dir, 10 * s, 45 * s, 0.25, 1, true]
      ];
      for (const [x, y, r0, r1, dur, mod, outline] of waves) {
        const g = scene.add.graphics().setDepth(7.5).setBlendMode("ADD").setPosition(x, y);
        g._spiderFx = { kind: "wave", t: 0, r0, r1, dur, mod, outline, color };
        layer?.add?.(g);
        this._spiderTeleportCircles.push(g);
        this._drawSpiderWave(g);
      }
    }
    // the colours go white, hold 0.05 s and blend back over 0.3 s
    // (m_flashTime / m_flashDelay / m_flashDuration, PlayerObject::update)
    this.p._spiderFlashTimer = 0.35;
    this.p._spiderFlashDuration = 0.35;
    // m_spiderSprite: setScale(0.4) then CCEaseElasticOut(CCScaleTo(0.45, 1), 0.35)
    this._spiderPopT = 0;
    // spiderDash_002 rotated along the jump, scaleX (|dy| + 30) / width, at
    // the midpoint; animates spiderDash_001..008 at 0.04 s and removes itself
    if (_textureHasFrameSafe(scene, "GJ_GameSheet04", "spiderDash_002.png")) {
      const dash = scene.add.image((from.x + to.x) * 0.5, (fromY + toY) * 0.5, "GJ_GameSheet04", "spiderDash_002.png");
      dash.setDepth(7.7).setBlendMode("ADD").setTint(color);
      const dashAngle = this.p.gravityFlipped ? Math.PI / 2 : -Math.PI / 2;
      dash.rotation = frame ? frame.visualAngle(dashAngle) : dashAngle;
      dash.scaleX = (Math.hypot(to.x - from.x, toY - fromY) + 60) / Math.max(1, dash.frame.realWidth || dash.width);
      dash._spiderFx = { kind: "dash", t: 0 };
      layer?.add?.(dash);
      this._spiderTeleportCircles.push(dash);
    }
  }

  _drawSpiderWave(g) {
    const fx = g._spiderFx, k = Math.min(1, fx.t / fx.dur);
    const radius = fx.r0 + (fx.r1 - fx.r0) * k;
    const alpha = Math.trunc(Math.max(0, Math.min(255, fx.mod * 255 * (1 - k)))) / 255;
    // ccDrawCircle / ccDrawFilledCircle segment counts by GD radius
    const segments = radius < 10 ? 10 : radius < 20 ? 15 : radius < 40 ? 20 : radius < 200 ? 30 : 50;
    const r = radius * 2;
    g.clear();
    if (fx.outline) g.lineStyle(2, fx.color, alpha);
    else g.fillStyle(fx.color, alpha);
    g.beginPath();
    g.moveTo(r, 0);
    for (let i = 1; i <= segments; i++) {
      const angle = i * Math.PI * 2 / segments;
      g.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.closePath();
    if (fx.outline) g.strokePath();
    else g.fillPath();
  }

  // 0..1 toward white for the teleport flash
  _spiderFlashAmount() {
    const left = this.p._spiderFlashTimer;
    if (!(left > 0) || this._scene?._editorPlaytestActive) return 0;
    const elapsed = 0.35 - left - 0.05;
    return elapsed <= 0 ? 1 : Math.max(0, 1 - elapsed / 0.3);
  }

  // CCEaseElasticOut(period 0.35) over CCScaleTo(0.45, 1) from 0.4
  _spiderPopScale() {
    const t = this._spiderPopT;
    if (!(t >= 0) || t >= 0.45) return 1;
    const x = t / 0.45;
    const e = x === 0 ? 0 : Math.pow(2, -10 * x) * Math.sin((x - 0.35 / 4) * Math.PI * 2 / 0.35) + 1;
    return 0.4 + 0.6 * e;
  }

  _clearSpiderTeleportEffects() {
    for (const fx of this._spiderTeleportCircles || []) fx?.destroy?.();
    this._spiderTeleportCircles = [];
    if (this.p._spiderFlashTimer > 0) {
      this.p._spiderFlashTimer = 0;
      this._applyPlayerTints();
    }
    this._spiderPopT = undefined;
  }

  _updateSpiderTeleportEffects(dt) {
    if (this._scene?._editorPlaytestActive) {
      if (this._spiderTeleportCircles?.length || this.p._spiderFlashTimer > 0) this._clearSpiderTeleportEffects();
      return;
    }
    const step = Math.max(0, dt || 0);
    const list = this._spiderTeleportCircles;
    for (let i = list.length - 1; i >= 0; i--) {
      const node = list[i], fx = node?._spiderFx;
      if (!fx) { list.splice(i, 1); node?.destroy?.(); continue; }
      fx.t += step;
      if (fx.kind === "wave") {
        if (fx.t >= fx.dur) { list.splice(i, 1); node.destroy(); continue; }
        this._drawSpiderWave(node);
      } else {
        const frame = Math.floor(fx.t / 0.04) + 1;
        if (frame > 8) { list.splice(i, 1); node.destroy(); continue; }
        node.setFrame(`spiderDash_${String(frame).padStart(3, "0")}.png`);
      }
    }
    if (this._spiderPopT >= 0) this._spiderPopT += step;
    if (this.p._spiderFlashTimer > 0) {
      this.p._spiderFlashTimer = Math.max(0, this.p._spiderFlashTimer - step);
      const amount = this._spiderFlashAmount();
      for (const layer of this._allLayers || []) {
        const kind = layer?.kind || "base";
        if (!layer?.sprite || (kind !== "base" && kind !== "overlay")) continue;
        layer.sprite.setTint(_mixTintTowardWhite(this._tintForLayerKind(kind), amount));
      }
      if (!(this.p._spiderFlashTimer > 0)) this._applyPlayerTints();
    }
  }

  _syncSpiderAnimation(baseX, baseY, dt) {
    if (this.p.isDead || !this.p.isSpider || !this._spiderLayers?.length) {
      this.setSpiderVisible(false);
      return;
    }
    const frameKey = this._selectSpiderFrameKey(dt);
    const applied = this._applySpiderFrame(frameKey, baseX, baseY, dt);
    if (!applied) {
      for (const layer of this._spiderLayers) {
        if (!layer?.sprite) continue;
        layer.sprite.x = baseX;
        layer.sprite.y = baseY;
        const mirrorScale = this._getMirrorVisualScale();
        layer.sprite.rotation = this._rotation * (mirrorScale < 0 ? -1 : 1);
        const miniScale = this.p.isMini ? 0.6 : 1;
        layer.sprite.scaleX = miniScale * mirrorScale;
        layer.sprite.scaleY = (this.p.gravityFlipped ? -miniScale : miniScale);
        layer.sprite.setVisible(layer.kind === "glow" ? !!layer.sprite._glowEnabled : true);
      }
    }
  }
  _getRobotIconBase() {
    const rawBase = String(window.currentRobot || "robot_01");
    const match = rawBase.match(/^robot_\d+/);
    return match ? match[0] : "robot_01";
  }
  _resolveRobotIconFrame(frameName) {
    const base = this._getRobotIconBase();
    const resolved = String(frameName || "").replace(/^robot_\d+/, base);
    if (_textureHasFrameSafe(this._scene, "GJ_GameSheetIcons", resolved)) return resolved;
    if (_textureHasFrameSafe(this._scene, "GJ_GameSheetIcons", frameName)) return frameName;
    return resolved;
  }
  _getRobotAnimDesc() {
    if (this._robotAnimDesc !== undefined) return this._robotAnimDesc;
    let data = null;
    try {
      data = this._scene?.cache?.json?.get?.("Robot_AnimDesc") || null;
    } catch (err) {
      data = null;
    }
    if (!data && typeof window !== "undefined") data = window.Robot_AnimDesc || null;
    if (!data || !data.animationContainer) {
      this._robotFrameGroups = {};
      return null;
    }
    this._robotAnimDesc = data;
    this._robotFrameGroups = {};
    const frameKeys = Object.keys(data.animationContainer);
    const sortBySuffix = (a, b) => {
      const aa = parseInt((String(a).match(/_(\d+)\.png$/) || [0, 0])[1], 10) || 0;
      const bb = parseInt((String(b).match(/_(\d+)\.png$/) || [0, 0])[1], 10) || 0;
      return aa - bb;
    };
    this._robotFrameGroups.run = frameKeys.filter(k => /^Robot_run_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.run2 = frameKeys.filter(k => /^Robot_run2_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.run3 = frameKeys.filter(k => /^Robot_run3_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.skip = frameKeys.filter(k => /^Robot_skip_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.jumpStart = frameKeys.filter(k => /^Robot_jump_start_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.jumpLoop = frameKeys.filter(k => /^Robot_jump_loop_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.fallStart = frameKeys.filter(k => /^Robot_fall_start_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.fallLoop = frameKeys.filter(k => /^Robot_fall_loop_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.idle = frameKeys.filter(k => /^Robot_idle_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.idle1 = frameKeys.filter(k => /^Robot_idle01_\d+\.png$/.test(k)).sort(sortBySuffix);
    this._robotFrameGroups.idle2 = frameKeys.filter(k => /^Robot_idle02_\d+\.png$/.test(k)).sort(sortBySuffix);
    return this._robotAnimDesc;
  }
  _createRobotLayerSet(scene, x, y, textureName, tag) {
    const resolvedBase = this._resolveRobotIconFrame(textureName);
    const layers = [];
    const makeLayer = (variant, tint, depthOffset) => {
      const frame = this._resolveRobotIconFrame(_spiderVariantFrameName(resolvedBase, variant));
      const layer = _makeAtlasLayer(scene, x, y, "GJ_GameSheetIcons", frame, 8 + tag * 0.1 + depthOffset, false, tint, variant);
      if (layer) layers.push(layer);
      return layer;
    };
    const glow = makeLayer("glow", this._secondaryColor(), -0.04);
    const base = makeLayer("base", this._primaryColor(), 0);
    const overlay = makeLayer("overlay", this._secondaryColor(), 0.04);
    const extra = makeLayer("extra", null, 0.08);
    return { tag, textureName, layers, glow, base, overlay, extra };
  }
  _initRobotAnimationParts(scene, x, y) {
    this._robotAnimTimer = 0;
    this._robotAnimState = "run";
    this._robotAnimDesc = undefined;
    this._robotPartsByTag = {};
    this._robotLayers = [];
    const desc = this._getRobotAnimDesc();
    const usedTextures = desc?.usedTextures || null;
    let entries = [];
    if (usedTextures) {
      entries = Object.values(usedTextures).slice().sort((a, b) => (parseInt(a.tag || "0", 10) || 0) - (parseInt(b.tag || "0", 10) || 0));
    }
    if (!entries.length) {
      entries = [
        { tag: "0", texture: "robot_01_03_001.png" },
        { tag: "1", texture: "robot_01_02_001.png" },
        { tag: "2", texture: "robot_01_04_001.png" },
        { tag: "3", texture: "robot_01_01_001.png" },
        { tag: "4", texture: "robot_01_03_001.png" },
        { tag: "5", texture: "robot_01_02_001.png" },
        { tag: "6", texture: "robot_01_04_001.png" }
      ];
    }
    for (const entry of entries) {
      const tag = parseInt(entry.tag || "0", 10) || 0;
      const part = this._createRobotLayerSet(scene, x, y, entry.texture, tag);
      if (!part.layers.length) continue;
      this._robotPartsByTag[tag] = part;
      this._robotLayers.push(...part.layers);
    }
  }
  _selectRobotFrameKey(dt) {
    const desc = this._getRobotAnimDesc();
    if (!desc?.animationContainer) return null;
    const _speedPortalRef = (typeof SpeedPortal !== "undefined" && SpeedPortal) ? SpeedPortal : null;
    const _oneSpeed = Number(_speedPortalRef?.ONE_TIMES ?? 11.540004) || 11.540004;
    const _halfSpeed = Number(_speedPortalRef?.HALF ?? (_oneSpeed * 0.8)) || (_oneSpeed * 0.8);
    const _fourSpeed = Number(_speedPortalRef?.FOUR_TIMES ?? (_oneSpeed * 1.85)) || (_oneSpeed * 1.85);
    const _activeSpeed = Number.isFinite(Number(playerSpeed)) ? Number(playerSpeed) : _oneSpeed;
    let robotAnimationSpeed = 1.75;
    if (_activeSpeed >= _oneSpeed) {
      const _fastT = Math.max(0, Math.min(1, (_activeSpeed - _oneSpeed) / Math.max(1e-6, _fourSpeed - _oneSpeed)));
      robotAnimationSpeed = 1.75 + _fastT * 0.35;
    } else {
      const _slowT = Math.max(0, Math.min(1, (_oneSpeed - _activeSpeed) / Math.max(1e-6, _oneSpeed - _halfSpeed)));
      robotAnimationSpeed = 1.75 - _slowT * 0.15;
    }
    robotAnimationSpeed *= 1.2;

    const grounded = this.p.onGround || this.p.onCeiling;
    const goingUp = this.p.gravityFlipped ? this.p.yVelocity < 0 : this.p.yVelocity > 0;
    const nextState = grounded ? "run" : (goingUp ? "jump" : "fall");
    if (this._robotAnimState !== nextState) {
      this._robotAnimState = nextState;
      this._robotAnimTimer = 0;
    }
    this._robotAnimTimer = (this._robotAnimTimer || 0) + Math.max(0, dt || 0) * robotAnimationSpeed;

    const pickFromStartThenLoop = (startGroup, loopGroup, fps) => {
      const start = startGroup || [];
      const loop = loopGroup || [];
      if (start.length) {
        const startDuration = start.length / fps;
        if (this._robotAnimTimer < startDuration || !loop.length) {
          return start[Math.min(start.length - 1, Math.floor(this._robotAnimTimer * fps))];
        }
        const loopTime = this._robotAnimTimer - startDuration;
        return loop[Math.floor(loopTime * fps) % loop.length];
      }
      if (loop.length) return loop[Math.floor(this._robotAnimTimer * fps) % loop.length];
      return null;
    };

    if (this.p.isDashing) {
      const group = this._robotFrameGroups.fallLoop;
      return group[Math.floor(this._robotAnimTimer * 16) % group.length];
    }
    if (nextState === "run") {
      const group = this._robotFrameGroups?.run?.length ? this._robotFrameGroups.run : (this._robotFrameGroups?.idle1 || this._robotFrameGroups?.idle || []);
      if (group?.length) return group[Math.floor(this._robotAnimTimer * 16) % group.length];
    } else if (nextState === "jump") {
      const frame = pickFromStartThenLoop(this._robotFrameGroups?.jumpStart, this._robotFrameGroups?.jumpLoop, 15);
      if (frame) return frame;
    } else {
      const frame = pickFromStartThenLoop(this._robotFrameGroups?.fallStart, this._robotFrameGroups?.fallLoop, 15);
      if (frame) return frame;
    }
    return desc.animationContainer["Robot_idle_001.png"] ? "Robot_idle_001.png" : null;
  }
  _applyRobotFrame(frameKey, baseX, baseY, dt) {
    const desc = this._getRobotAnimDesc();
    const frame = frameKey && desc?.animationContainer ? desc.animationContainer[frameKey] : null;
    if (!frame || !this._robotPartsByTag) return false;
    const miniScale = this.p.isMini ? 0.6 : 1;
    const mirrorSign = this._getMirrorVisualScale();
    const gameplay = this._gameLayer?.gameplayState?.frameForPlayer?.(this) || this._gameLayer?.gameplayState;
    const visualFlipped = this.p.gravityFlipped !== !!gameplay?.reflection;
    const gravitySign = visualFlipped ? -1 : 1;
    const positionYSign = visualFlipped ? 1 : -1;
    const seenTags = new Set();
    const robotFootTags = [2, 6];
    const robotFootPoints = [];
    const robotLegPoints = [];

    for (const spriteKey of Object.keys(frame)) {
      if (!spriteKey.startsWith("sprite_")) continue;
      const spriteData = frame[spriteKey];
      const tag = parseInt(spriteData.tag || "0", 10) || 0;
      const part = this._robotPartsByTag[tag];
      if (!part) continue;
      seenTags.add(tag);
      const pos = _parseAnimPair(spriteData.position, 0, 0);
      const robotLegTags = [0, 2, 4, 6];
      const robotArmTags = [1, 5];
      const isRobotLegTag = robotLegTags.includes(tag);
      const isRobotArmTag = robotArmTags.includes(tag);
      const robotLocalYOffset = tag === 3 ? 5 : (isRobotArmTag ? -1 : (isRobotLegTag ? -9 : 0));
      const robotLocalXScale = (isRobotLegTag || isRobotArmTag) ? 1.8 : 1;
      const sc = _parseAnimPair(spriteData.scale, 1, 1);
      const fl = _parseAnimPair(spriteData.flipped, 0, 0);
      const zValue = parseFloat(spriteData.zValue || tag || "0") || 0;
      const rotDeg = parseFloat(spriteData.rotation || "0") || 0;
      const baseTexture = this._resolveRobotIconFrame(spriteData.texture || part.textureName);
      const resolvedFrames = {
        glow: this._resolveRobotIconFrame(_spiderVariantFrameName(baseTexture, "glow")),
        base: this._resolveRobotIconFrame(baseTexture),
        overlay: this._resolveRobotIconFrame(_spiderVariantFrameName(baseTexture, "overlay")),
        extra: this._resolveRobotIconFrame(_spiderVariantFrameName(baseTexture, "extra"))
      };
      const commonX = baseX + pos.x * robotLocalXScale * mirrorSign * miniScale;
      const commonY = baseY + (pos.y + robotLocalYOffset) * positionYSign * miniScale;
      let commonRot = rotDeg * Math.PI / 180;
      commonRot *= mirrorSign < 0 ? -1 : 1;
      if (visualFlipped) commonRot = -commonRot;
      const baseScaleX = sc.x * (fl.x ? -1 : 1) * mirrorSign * miniScale;
      const baseScaleY = sc.y * (fl.y ? -1 : 1) * gravitySign * miniScale;

      const applyLayer = (layer, kind, depthOffset) => {
        if (!layer?.sprite) return;
        const frameName = resolvedFrames[kind];
        if (!_textureHasFrameSafe(this._scene, "GJ_GameSheetIcons", frameName)) {
          layer.sprite.setVisible(false);
          return;
        }
        layer.sprite.setTexture("GJ_GameSheetIcons", frameName);
        layer.sprite.x = commonX;
        layer.sprite.y = commonY;
        layer.sprite.rotation = commonRot;
        layer.sprite.scaleX = baseScaleX;
        layer.sprite.scaleY = baseScaleY;
        layer.sprite.setDepth(8 + zValue * 0.1 + depthOffset);

        const normalTint = this._tintForLayerKind(kind);
        if (normalTint !== null && normalTint !== undefined) {
          layer.sprite.setTint(normalTint);
        } else if (typeof layer.sprite.clearTint === "function") {
          layer.sprite.clearTint();
        }
        layer.sprite.setVisible(kind === "glow" ? !!layer.sprite._glowEnabled : true);
      };
      applyLayer(part.glow, "glow", -0.04);
      applyLayer(part.base, "base", 0);
      applyLayer(part.overlay, "overlay", 0.04);
      applyLayer(part.extra, "extra", 0.08);

      const footSprite = part.base?.sprite || part.overlay?.sprite || part.extra?.sprite || part.glow?.sprite;
      if (footSprite && (robotFootTags.includes(tag) || isRobotLegTag)) {
        const footHalfHeight = Math.max(6 * miniScale, Math.abs(footSprite.displayHeight || (footSprite.height || 0) * baseScaleY) * 0.5);
        const footEdgeY = commonY + (this.p.gravityFlipped ? -footHalfHeight : footHalfHeight);
        const point = { x: commonX, y: footEdgeY };
        if (robotFootTags.includes(tag)) {
          robotFootPoints.push(point);
        } else if (isRobotLegTag) {
          robotLegPoints.push(point);
        }
      }
    }

    const flameAnchorPoints = robotFootPoints.length ? robotFootPoints : robotLegPoints;
    if (flameAnchorPoints.length) {
      let attachedFoot = flameAnchorPoints[0];
      for (const pt of flameAnchorPoints) {
        if (this.p.gravityFlipped ? pt.y < attachedFoot.y : pt.y > attachedFoot.y) {
          attachedFoot = pt;
        }
      }
      this._robotJumpFlameAnchorX = attachedFoot.x;
      this._robotJumpFlameAnchorY = attachedFoot.y;
    }
    for (const tag of Object.keys(this._robotPartsByTag)) {
      if (seenTags.has(parseInt(tag, 10))) continue;
      const part = this._robotPartsByTag[tag];
      for (const layer of part.layers) layer?.sprite?.setVisible(false);
    }
    const turn = this._turnArtLayers(this._robotLayers, baseX, baseY);
    if (turn) {
      const x = this._robotJumpFlameAnchorX - baseX, y = this._robotJumpFlameAnchorY - baseY;
      this._robotJumpFlameAnchorX = baseX + turn.c * x - turn.s * y;
      this._robotJumpFlameAnchorY = baseY + turn.s * x + turn.c * y;
    }
    return true;
  }
  _turnArtLayers(layers, baseX, baseY) {
    const frame = this._gameLayer?.gameplayState?.frameForPlayer?.(this) || this._gameLayer?.gameplayState;
    const angle = (frame?.visualAngle(this._rotation) ?? this._rotation) * (this._getMirrorVisualScale() < 0 ? -1 : 1);
    if (!angle) return;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const layer of layers || []) {
      const sprite = layer?.sprite;
      if (!sprite?.visible) continue;
      const x = sprite.x - baseX, y = sprite.y - baseY;
      sprite.x = baseX + c * x - s * y;
      sprite.y = baseY + s * x + c * y;
      sprite.rotation += angle;
    }
    return { c, s, angle };
  }
  _hideRobotJumpFlame() {
    if (!this._robotJumpFlameSprite) return;
    this._robotJumpFlameSprite.setVisible(false);
    this._robotJumpFlameSprite.setAlpha(0);
  }
  _updateRobotJumpFlame(dt) {
    if (!this._robotJumpFlameSprite) return;
    if(window.noRobotFire || window.noParticles){this._hideRobotJumpFlame();return;}
    const goingUp = this.p.gravityFlipped ? this.p.yVelocity < -0.01 : this.p.yVelocity > 0.01;
    if (!this._robotJumpFlameActive || this.p.isDead || !this.p.isRobot || !goingUp || this.p.onGround || this._endAnimating) {
      this._robotJumpFlameActive = false;
      this._hideRobotJumpFlame();
      return;
    }
    const upwardVelocity = Math.max(0, this.p.gravityFlipped ? -this.p.yVelocity : this.p.yVelocity);
    const fadeThreshold = this.p.isMini ? 7 : 10;
    const fade = Math.max(0, Math.min(1, upwardVelocity / Math.max(0.001, fadeThreshold)));
    if (fade <= 0.02) {
      this._robotJumpFlameActive = false;
      this._hideRobotJumpFlame();
      return;
    }
    const miniScale = this.p.isMini ? 0.8 : 1.2;
    this._robotJumpFlameFadeInTimer = (this._robotJumpFlameFadeInTimer || 0) + Math.max(0, dt || 0);
    const fadeIn = Math.max(0, Math.min(1, this._robotJumpFlameFadeInTimer / 0.24));
    const visibleFade = Math.min(fade, fadeIn);
    this._robotJumpFlamePulse = (this._robotJumpFlamePulse || 0) + Math.max(0, dt || 0) * (Math.PI * 4);
    const pulse = (Math.sin(this._robotJumpFlamePulse) + 1) * 0.5;
    const stretchY = 0.7 + 0.4 * pulse;
    const overallScale = 0.82 * miniScale * visibleFade;
    this._robotJumpFlameSprite.setPosition(
      this._robotJumpFlameAnchorX,
      this._robotJumpFlameAnchorY
    );
    const frame = this._gameLayer?.gameplayState?.frameForPlayer?.(this) || this._gameLayer?.gameplayState;
    const angle = frame?.visualAngle(this._rotation) ?? this._rotation;
    this._robotJumpFlameSprite.rotation = angle * (this._getMirrorVisualScale() < 0 ? -1 : 1);
    const flipped = this.p.gravityFlipped !== !!frame?.reflection;
    this._robotJumpFlameSprite.setScale(overallScale, overallScale * stretchY * (flipped ? -1 : 1));
    this._robotJumpFlameSprite.setAlpha(Math.max(0, Math.min(1, visibleFade)));
    this._robotJumpFlameSprite.setVisible(true);
  }
  _syncRobotAnimation(baseX, baseY, dt) {
    if (this.p.isDead || !this.p.isRobot || !this._robotLayers?.length) {
      this.setRobotVisible(false);
      return;
    }
    const frameKey = this._selectRobotFrameKey(dt);
    const applied = this._applyRobotFrame(frameKey, baseX, baseY, dt);
    if (!applied) {
      for (const layer of this._robotLayers) {
        if (!layer?.sprite) continue;
        layer.sprite.x = baseX;
        layer.sprite.y = baseY;
        const mirrorScale = this._getMirrorVisualScale();
        layer.sprite.rotation = this._rotation * (mirrorScale < 0 ? -1 : 1);
        const miniScale = this.p.isMini ? 0.6 : 1;
        layer.sprite.scaleX = miniScale * mirrorScale;
        layer.sprite.scaleY = (this.p.gravityFlipped ? -miniScale : miniScale);
        layer.sprite.setVisible(layer.kind === "glow" ? !!layer.sprite._glowEnabled : true);
      }
      this._robotJumpFlameAnchorX = baseX;
      this._robotJumpFlameAnchorY = baseY + (this.p.gravityFlipped ? (-8 * (this.p.isMini ? 0.6 : 1)) : (8 * (this.p.isMini ? 0.6 : 1)));
    }
  }

  _defaultMiniIcon() {
    const usedefaultMiniIcon = window.enableMiniIcon === true && this.p.isMini;
    const updateFrame = (layer, frameName) => {
      if (!layer?.sprite || layer.sprite._defaultMiniIconFrame === frameName) return;
      const atlasData = getAtlasFrame(this._scene, frameName);
      if (!atlasData) return;
      layer.sprite.setTexture(atlasData.atlas, atlasData.frame);
      layer.sprite._defaultMiniIconFrame = frameName;
    };

    updateFrame(this._playerSpriteLayer, usedefaultMiniIcon ? "player_00_001.png" : `${window.currentPlayer}_001.png`);
    updateFrame(this._playerOverlayLayer, usedefaultMiniIcon ? "player_00_2_001.png" : `${window.currentPlayer}_2_001.png`);
    updateFrame(this._ballSpriteLayer, usedefaultMiniIcon ? "player_ball_00_001.png" : `${window.currentBall}_001.png`);
    updateFrame(this._ballOverlayLayer, usedefaultMiniIcon ? "player_ball_00_2_001.png" : `${window.currentBall}_2_001.png`);
  }

  _createSprites() {
    const spriteY = this._scene;
    const spriteX = b(this.p.y);
    const particleY = centerX;
    this._playerGlowLayer = ds(spriteY, particleY, spriteX, `${window.currentPlayer}_glow_001.png`, 9, false);
    this._playerSpriteLayer = ds(spriteY, particleY, spriteX, `${window.currentPlayer}_001.png`, 10, true);
    this._playerOverlayLayer = ds(spriteY, particleY, spriteX, `${window.currentPlayer}_2_001.png`, 8, true);
    this._playerExtraLayer = ds(spriteY, particleY, spriteX, `${window.currentPlayer}_extra_001.png`, 12, true);
    if (this._playerGlowLayer) {
      this._playerGlowLayer.sprite.setTint(this._secondaryColor());
      this._playerGlowLayer.sprite._glowEnabled = false;
    }
    if (this._playerSpriteLayer) {
      this._playerSpriteLayer.sprite.setTint(this._primaryColor());
    } else {
      let _0x3aecd9 = spriteY.add.rectangle(particleY, spriteX, g, g, this._primaryColor());
      _0x3aecd9.setDepth(10);
      this._playerSpriteLayer = {
        sprite: _0x3aecd9
      };
    }
    if (this._playerOverlayLayer) {
      this._playerOverlayLayer.sprite.setTint(this._secondaryColor());
    }
    this._shipGlowLayer = ds(spriteY, particleY, spriteX, `${window.currentShip}_glow_001.png`, 9, false);
    this._shipSpriteLayer = ds(spriteY, particleY, spriteX, `${window.currentShip}_001.png`, 10, false);
    this._shipOverlayLayer = ds(spriteY, particleY, spriteX, `${window.currentShip}_2_001.png`, 8, false);
    this._shipExtraLayer = ds(spriteY, particleY, spriteX, `${window.currentShip}_extra_001.png`, 12, false);
    if (this._shipGlowLayer) {
      this._shipGlowLayer.sprite.setTint(this._secondaryColor());
      this._shipGlowLayer.sprite._glowEnabled = false;
    }
    if (this._shipSpriteLayer) {
      this._shipSpriteLayer.sprite.setTint(this._primaryColor());
    } else {
      let _0x100643 = spriteY.add.polygon(particleY, spriteX, [{
        x: -72,
        y: 40
      }, {
        x: 72,
        y: 0
      }, {
        x: -72,
        y: -40
      }, {
        x: -40,
        y: 0
      }], this._primaryColor());
      _0x100643.setDepth(10).setVisible(false);
      this._shipSpriteLayer = {
        sprite: _0x100643
      };
    }
    if (this._shipOverlayLayer) {
      this._shipOverlayLayer.sprite.setTint(this._secondaryColor());
    }
    this._ballGlowLayer = ds(spriteY, particleY, spriteX, `${window.currentBall}_glow_001.png`, 9, false);
    this._ballSpriteLayer = ds(spriteY, particleY, spriteX, `${window.currentBall}_001.png`, 10, false);
    this._ballOverlayLayer = ds(spriteY, particleY, spriteX, `${window.currentBall}_2_001.png`, 8, false);
    if (this._ballGlowLayer) {
      this._ballGlowLayer.sprite.setTint(this._secondaryColor());
      this._ballGlowLayer.sprite._glowEnabled = false;
    }
    if (this._ballSpriteLayer) {
      this._ballSpriteLayer.sprite.setTint(this._primaryColor());
    }
    if (this._ballOverlayLayer) {
      this._ballOverlayLayer.sprite.setTint(this._secondaryColor());
    }
    this._waveGlowLayer = ds(spriteY, particleY, spriteX, `${window.currentWave}_glow_001.png`, 9, false);
    this._waveOverlayLayer = ds(spriteY, particleY, spriteX, `${window.currentWave}_2_001.png`, 8, false);
    this._waveExtraLayer = null;
    this._waveSpriteLayer = ds(spriteY, particleY, spriteX, `${window.currentWave}_001.png`, 10, false);
    if (this._waveGlowLayer) {
      this._waveGlowLayer.sprite.setTint(this._secondaryColor());
      this._waveGlowLayer.sprite._glowEnabled = false;
    }
    if (this._waveSpriteLayer) {
      this._waveSpriteLayer.sprite.setTint(this._primaryColor());
    }
    if (this._waveOverlayLayer) {
      this._waveOverlayLayer.sprite.setTint(this._secondaryColor());
    }
    this.playerSprite = this._playerSpriteLayer.sprite;
    this.shipSprite = this._shipSpriteLayer.sprite;
    this._playerLayers = [this._playerSpriteLayer, this._playerGlowLayer, this._playerOverlayLayer, this._playerExtraLayer];
    this._shipLayers = [this._shipSpriteLayer, this._shipGlowLayer, this._shipOverlayLayer, this._shipExtraLayer];
    this._ballLayers = [this._ballSpriteLayer, this._ballGlowLayer, this._ballOverlayLayer].filter(_0x37ad93 => !!_0x37ad93);
    this._waveLayers = [this._waveSpriteLayer, this._waveOverlayLayer, this._waveExtraLayer, this._waveGlowLayer].filter(_0x37ad93 => !!_0x37ad93);
    this._initSpiderAnimationParts(spriteY, particleY, spriteX);
    this._spiderSpriteLayer = this._spiderLayers.find(layer => layer.kind === "base") || null;
    this._spiderGlowLayer = this._spiderLayers.find(layer => layer.kind === "glow") || null;
    this._spiderOverlayLayer = this._spiderLayers.find(layer => layer.kind === "overlay") || null;
    this._spiderExtraLayer = this._spiderLayers.find(layer => layer.kind === "extra") || null;
    this._initRobotAnimationParts(spriteY, particleY, spriteX);
    this._robotSpriteLayer = this._robotLayers.find(layer => layer.kind === "base") || null;
    this._robotGlowLayer = this._robotLayers.find(layer => layer.kind === "glow") || null;
    this._robotOverlayLayer = this._robotLayers.find(layer => layer.kind === "overlay") || null;
    this._robotExtraLayer = this._robotLayers.find(layer => layer.kind === "extra") || null;
    this._birdSpriteLayer = ds(spriteY, particleY, spriteX, `${window.currentBird}_001.png`, 10, false);
    this._birdGlowLayer = ds(spriteY, particleY, spriteX, `${window.currentBird}_2_001.png`, 9, false);
    this._birdOverlayLayer = ds(spriteY, particleY, spriteX, `${window.currentBird}_3_001.png`, 8, false);
    this._birdExtraLayer = ds(spriteY, particleY, spriteX, `${window.currentBird}_extra_001.png`, 12, false);
    if (this._birdSpriteLayer) {
      this._birdSpriteLayer.sprite.setTint(this._primaryColor());
    }
    if (this._birdGlowLayer) {
      this._birdGlowLayer.sprite.setTint(this._secondaryColor());
      this._birdGlowLayer.sprite._glowEnabled = false;
    }
    if (this._birdOverlayLayer) {
      this._birdOverlayLayer.sprite.setTint(this._secondaryColor());
    }
    this._birdLayers = [this._birdSpriteLayer, this._birdGlowLayer, this._birdOverlayLayer, this._birdExtraLayer].filter(x => !!x);
    this._swingLayers = [];
    const swing = window.currentSwing || "swing_01";
    for (const [suffix, color, depth] of [["_001.png", this._primaryColor(), 10],
      ["_2_001.png", this._secondaryColor(), 8], ["_extra_001.png", 0xffffff, 12]]) {
      const layer = ds(spriteY, particleY, spriteX, swing + suffix, depth, false);
      if (layer) {
        layer.kind = suffix === "_001.png" ? "base" : suffix === "_2_001.png" ? "overlay" : "extra";
        layer.sprite.setTint(color); this._swingLayers.push(layer);
      }
    }

    this._createSwingFires(spriteY, particleY, spriteX);

    this._allLayers = [...this._playerLayers, ...this._ballLayers, ...this._waveLayers, ...this._shipLayers, ...this._spiderLayers, ...this._robotLayers, ...this._birdLayers, ...this._swingLayers];
    this._applyPlayerTints();
    
    this._dashAnimationSprite = spriteY.add.image(particleY, spriteX, "GJ_GameSheetGlow", "playerDash2_001.png");
    this._dashAnimationSprite.setDepth(7);
    this._dashAnimationSprite.setVisible(false);
    this._dashAnimationSprite.setTint(0xffffff);
    this._dashAnimationSprite.setBlendMode('ADD');
    if (_textureHasFrameSafe(spriteY, "GJ_GameSheetIcons", "fireBoost_001.png")) {
      this._robotJumpFlameSprite = spriteY.add.image(particleY, spriteX, "GJ_GameSheetIcons", "fireBoost_001.png");
      this._robotJumpFlameSprite.setDepth(7.75);
      this._robotJumpFlameSprite.setVisible(false);
      this._robotJumpFlameSprite.setAlpha(0);
      this._robotJumpFlameSprite.setOrigin(0.5, 0);
      this._robotJumpFlameSprite.setBlendMode('ADD');
    }
  }
  _updateDashAnimation(deltaTime) {
    if (this._scene?._editorPlaytestActive) {
      if (this._dashAnimationSprite) this._dashAnimationSprite.setVisible(false);
      return;
    }

    if (!this._dashAnimationSprite) return;
    if (this.p.isDashing) {
      this._dashAnimationSprite.setVisible(true);
      this._dashAnimationTimer += deltaTime;
      const frameDuration = 1000 / 60;
      if (this._dashAnimationTimer >= frameDuration) {
        const frameSteps = Math.floor(this._dashAnimationTimer / frameDuration);
        this._dashAnimationTimer -= frameSteps * frameDuration;
        this._dashAnimationFrame = ((this._dashAnimationFrame + frameSteps - 1) % 12) + 1;
        const frameName = `playerDash2_${String(this._dashAnimationFrame).padStart(3, '0')}.png`;
        this._dashAnimationSprite.setFrame(frameName);
      }
    } else {
      this._dashAnimationSprite.setVisible(false);
      this._dashAnimationFrame = 0;
      this._dashAnimationTimer = 0;
    }
  }
  _initParticles(scene) {
    this._particleEmitter = scene.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: {
        min: 110,
        max: 190
      },
      angle: {
        min: 225,
        max: 315
      },
      lifespan: {
        min: 150,
        max: 450
      },
      scale: {
        start: 0.5,
        end: 0
      },
      gravityY: 600,
      frequency: 1000 / 30,
      blendMode: "ADD",
      alpha: {
        start: 1,
        end: 0
      },
      tint: this._primaryColor()
    });
    this._particleEmitter.stop();
    this._particleEmitter.setDepth(9);
    this._gameLayer.container.add(this._particleEmitter);
    this._flyParticleEmitter = scene.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: {
        min: 22,
        max: 38
      },
      angle: {
        min: 225,
        max: 315
      },
      lifespan: {
        min: 150,
        max: 450
      },
      scale: {
        start: 0.5,
        end: 0
      },
      gravityY: 600,
      frequency: 1000 / 30,
      blendMode: "ADD",
      tint: {
        start: 16737280,
        end: 16711680
      },
      alpha: {
        start: 1,
        end: 0
      }
    });
    this._flyParticleEmitter.stop();
    this._flyParticleEmitter.setDepth(9);
    this._gameLayer.container.add(this._flyParticleEmitter);
    this._flyParticle2Emitter = scene.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: {
        min: 220,
        max: 380
      },
      angle: {
        min: 180,
        max: 360
      },
      lifespan: {
        min: 150,
        max: 450
      },
      scale: {
        start: 0.75,
        end: 0
      },
      gravityY: 600,
      frequency: 1000 / 30,
      blendMode: "ADD",
      tint: {
        start: 16760320,
        end: 16711680
      },
      alpha: {
        start: 1,
        end: 0
      }
    });
    this._flyParticle2Emitter.stop();
    this._flyParticle2Emitter.setDepth(9);
    this._gameLayer.container.add(this._flyParticle2Emitter);
    this._shipDragEmitter = scene.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      x: {
        min: -18,
        max: 18
      },
      speed: {
        min: 223.79999999999998,
        max: 343.79999999999995
      },
      angle: {
        min: 205,
        max: 295
      },
      lifespan: {
        min: 80,
        max: 220
      },
      scale: {
        start: 0.375,
        end: 0
      },
      gravityX: -700,
      gravityY: 600,
      frequency: 25,
      blendMode: "ADD",
      alpha: {
        start: 1,
        end: 0
      }
    });
    this._shipDragEmitter.stop();
    this._shipDragEmitter.setDepth(22);
    this._gameLayer.container.add(this._shipDragEmitter);
    this._shipDragActive = false;
    this._particleActive = false;
    this._flyParticle2Active = false;
    this._flyParticleActive = false;
    const _0x57911a = {
      frame: "square.png",
      speed: {
        min: 250,
        max: 350
      },
      angle: {
        min: 210,
        max: 330
      },
      lifespan: {
        min: 50,
        max: 600
      },
      scale: {
        start: 0.625,
        end: 0
      },
      gravityY: 1000,
      blendMode: "ADD",
      alpha: {
        start: 1,
        end: 0
      },
      tint: this._primaryColor(),
      emitting: false
    };
    this._landEmitter1 = scene.add.particles(0, 0, "GJ_WebSheet", {
      ..._0x57911a
    });
    this._landEmitter2 = scene.add.particles(0, 0, "GJ_WebSheet", {
      ..._0x57911a
    });
    this._aboveContainer = scene.add.container(0, 0);
    this._aboveContainer.setDepth(13);
    this._gameLayer.topContainer.add(this._landEmitter1);
    this._gameLayer.topContainer.add(this._landEmitter2);
    this._landIdx = false;
    // Both streaks are children behind the native player's icon (HardStreak
    // at -3, CCMotionStreak at -2). A shared T1 world container puts the wave
    // over the icon and over foreground geometry, and selects the wrong
    // shader band. Keep their own world transform and native draw position.
    this._trailContainer = scene.add.container(0, 0).setDepth(7);
    // PlayerObject::init: CCMotionStreak(fade 0.3, minSeg 5, stroke 10,
    // streak_01_001) with GD's max segment 50; web units are 2x GD
    this._streak = new StreakManager(this._scene, "streak_01", 0.3, 10, 20, 100, this._secondaryColor(), 1);
    this._streak.addToContainer(this._trailContainer, 1);
    this._waveTrail = new WaveTrail(this._scene, this._primaryColor(), this._primaryColor());
    this._waveTrail.addToContainer(this._trailContainer, 0);
  }
  // PlayerObject::update clears the wave trail behind the camera's left edge
  // (HardStreak::clearBehindXPos with the layer's camera x)
  _cameraLeftX(fallbackX) {
    const scene = this._scene, cs = this._gameLayer?.cameraState;
    const W = scene?.scale?.width || 1138, H = scene?.scale?.height || 640;
    const view = cs?.view?.(W, H, scene?._cameraX || 0, scene?._cameraY || 0);
    if (view && Number.isFinite(view.x) && view.zoom > 0) return view.x - W / (2 * view.zoom);
    return fallbackX - 4000;
  }
  stopVisualEmission() {
    for (const emitter of [this._particleEmitter, this._flyParticleEmitter, this._flyParticle2Emitter, this._shipDragEmitter]) emitter?.stop();
    this._particleActive = this._flyParticleActive = this._flyParticle2Active = this._shipDragActive = false;
    this._streak.stop();
    this._waveTrail.fadeOut(0.2);
    for (const fire of this._swingFires || []) fire.sprite?.setVisible(false);
    this._dashAnimationSprite?.setVisible(false);
    this._hideRobotJumpFlame?.();
  }
  updateInactiveTrails(cameraX, cameraY, seconds) {
    this._trailContainer.x = -cameraX;
    this._trailContainer.y = cameraY;
    const draw = this._scene._visualTick !== false;
    this._streak.update(seconds, draw);
    this._waveTrail.update(seconds, draw);
    this._updateSpiderTeleportEffects?.(seconds);
  }
  _regularTrailPosition(x, y, particleX, particleY) {
    if (this.p.isSwing) {
      // A swing flips its gravity, not its art: the streak stays on the middle
      // of its back instead of jumping across the body at every flip.
      const frame = this._gameLayer.gameplayState;
      const angle = frame ? frame.visualAngle(this._rotation) : this._rotation;
      const back = -24 * (this.p.isMini ? 0.6 : 1);
      return { x: x + back * Math.cos(angle), y: y + back * Math.sin(angle) };
    }
    if (this.p.isFlying) {
      const u = this._gameLayer.gameplayState?.u || { x: 1, y: 0 };
      return { x: particleX + 8 * u.x, y: particleY - 8 * u.y };
    }
    if (this.p.isBall) return { x, y };
    // PlayerObject::updatePlayerArt (4fb502..4fb58e): the regular
    // streak is two GD points behind the player along the travel axis.
    // The icon's jump rotation does not rotate this offset around it.
    const u = this._gameLayer.gameplayState?.u || { x: 1, y: 0 };
    const offset = -4 * (this.p.isMini ? 0.6 : 1);
    return { x: x + u.x * offset, y: y - u.y * offset };
  }
  // PlayerObject::playSpawnEffect (4f5710): CCBlink(0.4, 4) on the body and,
  // unless low detail, four closing circles of its main colour.
  playSpawnEffect() {
    if (window.noRespawnFlash) { this._blinkStart=null; return; }
    const scene = this._scene;
    if (!scene?.time) return;
    this._blinkStart = scene.time.now;
    if (window.enableLDM) return;
    for (const delay of [0, 100, 200, 300]) scene.time.delayedCall(delay, () => this._spawnCircle());
  }
  // spawnCircle (4f5840): CCCircleWave(70, 2, 0.3, fadeIn, easeOut) on the body.
  _spawnCircle() {
    const scene = this._scene;
    if (!scene?.add || this.p.isDead) return;
    const graphics = scene.add.graphics().setDepth(15).setBlendMode(S);
    this._gameLayer.topContainer.add(graphics);
    const follow = () => graphics.setPosition(this._worldX(), b(this.p.y));
    follow();
    scene.events.on("postupdate", follow);
    const state = { progress: 0 }, colour = this._primaryColor();
    scene.tweens.add({ targets: state, progress: 1, duration: 300, ease: "Linear",
      onUpdate: () => {
        const eased = Math.sqrt(state.progress), radius = 140 - 136 * eased;
        graphics.clear();
        graphics.lineStyle(2, colour, eased);
        graphics.strokeCircle(0, 0, radius);
      },
      onComplete: () => { scene.events.off("postupdate", follow); graphics.destroy(); }
    });
  }
  // CCBlink: visible in the second half of each of its four slices. Other code
  // may change which of the body's parts show, so a blink only hides what shows.
  updateBlink() {
    const hidden = this._blinkHidden;
    if (hidden) {
      if (hidden.mode === this._blinkMode()) for (const sprite of hidden.sprites) sprite.setVisible(true);
      this._blinkHidden = null;
    }
    if (this._blinkStart === undefined || this._blinkStart === null) return;
    const t = (this._scene.time.now - this._blinkStart) / 400;
    if (t >= 1 || this.p.isDead) { this._blinkStart = null; return; }
    if ((t % 0.25) > 0.125) return;
    const sprites = (this._allLayers || []).map(layer => layer?.sprite).filter(sprite => sprite?.visible);
    for (const sprite of sprites) sprite.setVisible(false);
    this._blinkHidden = { mode: this._blinkMode(), sprites };
  }
  _blinkMode() {
    const P = this.p;
    return [P.isFlying, P.isSwing, P.isBall, P.isUfo, P.isWave, P.isRobot, P.isSpider].join();
  }
  _effectsHidden() {
    return !!this._gameLayer?.logicState?.playerHidden(this.p === this._scene?._state2 ? 2 : 1);
  }
  _updateParticles(_0xc43238, _0x52b718, _0x5af874) {
    if (this._effectsHidden()) {
      for (const emitter of [this._particleEmitter, this._flyParticleEmitter, this._flyParticle2Emitter, this._shipDragEmitter]) {
        emitter?.stop(); emitter?.killAll?.();
      }
      this._particleActive = this._flyParticleActive = this._flyParticle2Active = this._shipDragActive = false;
      // Keep the mode's activation state, but discard geometry from the
      // hidden interval so showing the player cannot join a distant point.
      this._streak.reset(); this._waveTrail.reset();
      this._clearSpiderTeleportEffects();
      return;
    }
    // Low detail suppresses emitters, never HardStreak/CCMotionStreak.
    // Stopping a wave here left it invisible until another mode portal.
    const suppressParticles = !!(this._scene?._editorPlaytestActive || window.enableLDM || window.noParticles || window.noVehicleParticles);

    if (this.p.isDead) {
      // playerDestroyed fades the wave trail out (fadeOutStreak2(0.2))
      this._waveTrail.update(_0x5af874, this._scene._visualTick !== false);
      return;
    }
    const _0x119eb7 = this._worldX();
    const _0x519d38 = b(this.p.y);
    this._particleEmitter.particleX = _0x119eb7 - 20;
    this._particleEmitter.particleY = _0x519d38 + (this.p.gravityFlipped ? (-26 + (this.p.isUfo ? -5 : 0)) : (26 + (this.p.isUfo ? 5 : 0)));
    const _0x4436ac = !suppressParticles && this.p.onGround && !this.p.isFlying && !this.p.isWave;
    if (_0x4436ac && !this._particleActive) {
      this._particleEmitter.start();
      this._particleActive = true;
    } else if (!_0x4436ac && this._particleActive) {
      this._particleEmitter.stop();
      this._particleActive = false;
    }
    {
      const frame = this._gameLayer.gameplayState;
      const angle = frame ? frame.visualAngle(this._rotation) : this._rotation;
      const _0xe76a85 = Math.cos(angle);
      const _0x26ec65 = Math.sin(angle);
      const size = this.p.isMini ? 0.6 : 1;
      const _0x216018 = (this.p.isWave ? 0 : (this.p.isUfo ? 0 : -24)) * size;
      const _0x2baeac = (this.p.isWave ? 4 : (this.p.isUfo ? 5 : 18)) * size * (this.p.gravityFlipped !== !!frame?.reflection ? -1 : 1);
      const _0x75c380 = _0x119eb7 + _0x216018 * _0xe76a85 - _0x2baeac * _0x26ec65;
      const _0x2b31d7 = _0x519d38 + _0x216018 * _0x26ec65 + _0x2baeac * _0xe76a85;
      const _0x5d66f4 = (Math.random() * 2 - 1) * 2 * 2;
      this._flyParticleEmitter.particleX = _0x75c380;
      this._flyParticleEmitter.particleY = _0x2b31d7 + _0x5d66f4;
      this._flyParticle2Emitter.particleX = _0x75c380;
      this._flyParticle2Emitter.particleY = _0x2b31d7 + _0x5d66f4;
      const streak = this._regularTrailPosition(_0x119eb7, _0x519d38, _0x75c380, _0x2b31d7);
      this._streak.setPosition(streak.x, streak.y);
      this._waveTrail.setPosition(_0x119eb7, _0x519d38);
    }
    const drawTrails = this._scene._visualTick !== false;
    if (!this.p.isFlying && !this.p.isUfo && !this.p.isWave && !this.p.isSwing) {
      if (this.p.onGround) this.p.jumpTrailActive = false;
      if (this.p.jumpTrailActive) this._streak.start();
      else this._streak.stop();
    }
    // updatePlayerScale: setStroke(m_streakStrokeWidth * vehicleSize * (wave ? 0.8 : 1))
    this._streak._stroke = 20 * (this.p.isMini ? 0.6 : 1) * (this.p.isWave ? 0.8 : 1);
    this._streak.update(_0x5af874, drawTrails);
    this._waveTrail.setMiniScale(this.p.isMini);
    this._waveTrail.setAudioScale(this._gameLayer?.gdRenderer?.audioScale);
    this._waveTrail.update(_0x5af874, drawTrails, this._cameraLeftX(_0x119eb7));
    const _0x3d69d2 = !suppressParticles && (this.p.isFlying || this.p.isUfo);
    if (_0x3d69d2 && !this._flyParticleActive) {
      this._flyParticleEmitter.start();
      this._flyParticleActive = true;
    } else if (!_0x3d69d2 && this._flyParticleActive) {
      this._flyParticleEmitter.stop();
      this._flyParticleActive = false;
    }
    const _0x169e30 = !suppressParticles && ((this.p.isFlying && this.p.upKeyDown) || (this.p.isUfo && this.p.isJumping));
    if (_0x169e30 && !this._flyParticle2Active) {
      this._flyParticle2Emitter.start();
      this._flyParticle2Active = true;
    } else if (!_0x169e30 && this._flyParticle2Active) {
      this._flyParticle2Emitter.stop();
      this._flyParticle2Active = false;
    }
    const _0x2e5643 = _0xc43238 + this._scene._getMirrorXOffset(_0x119eb7 - _0xc43238);
    this._shipDragEmitter.x = _0x2e5643;
    this._shipDragEmitter.particleY = this.p.gravityFlipped ? b(this.p.y) + _0x52b718 + 10 : b(this.p.y) + _0x52b718 + 30;
    this._shipDragEmitter.setAngle(this.p.mirrored ? {
      min: 245,
      max: 335
    } : {
      min: 205,
      max: 295
    });
    this._shipDragEmitter.gravityX = this.p.mirrored ? 700 : -700;
    this._shipDragEmitter.setScale(1, 1);
    const _0x2ac9d0 = !suppressParticles && this.p.isFlying && this.p.onGround && (this.p.gravityFlipped ? this.p.onCeiling : !this.p.onCeiling);
    if (_0x2ac9d0 && !this._shipDragActive) {
      this._shipDragEmitter.start();
      this._shipDragActive = true;
    } else if (!_0x2ac9d0 && this._shipDragActive) {
      this._shipDragEmitter.stop();
      this._shipDragActive = false;
    }
    if(suppressParticles) {
      for(const emitter of [this._particleEmitter,this._flyParticleEmitter,this._flyParticle2Emitter,this._shipDragEmitter]){emitter?.stop();emitter?.killAll?.();}
      this._particleActive=this._flyParticleActive=this._flyParticle2Active=this._shipDragActive=false;
    }
    if(window.noTrail){this._streak.reset();this._waveTrail.reset();}
  }
  setCubeVisible(_0x411813) {
    this._playerSpriteLayer.sprite.setVisible(_0x411813);
    if (this._playerGlowLayer) {
      this._playerGlowLayer.sprite.setVisible(_0x411813 && this._playerGlowLayer.sprite._glowEnabled);
    }
    if (this._playerOverlayLayer) {
      this._playerOverlayLayer.sprite.setVisible(_0x411813);
    }
    if (this._playerExtraLayer) {
      this._playerExtraLayer.sprite.setVisible(_0x411813);
    }
  }
  setShipVisible(_0x1c5620) {
    this._shipSpriteLayer.sprite.setVisible(_0x1c5620);
    if (this._shipGlowLayer) {
      this._shipGlowLayer.sprite.setVisible(_0x1c5620 && this._shipGlowLayer.sprite._glowEnabled);
    }
    if (this._shipOverlayLayer) {
      this._shipOverlayLayer.sprite.setVisible(_0x1c5620);
    }
    if (this._shipExtraLayer) {
      this._shipExtraLayer.sprite.setVisible(_0x1c5620);
    }
  }
  // The swing's PlayerFireBoostSprites (PlayerObject::init, toggleSwingMode,
  // updateSwingFire 0x4f9080; PlayerFireBoostSprite::init 0x502480 and
  // loopFireAnimation 0x5024e0): fireBoost_001 anchored at its top, behind
  // the icon on the main layer, which the swing never flips. The middle fire
  // always loops; with normal gravity the top one scales in (0.06 s) and
  // loops while the bottom one shrinks to 0.01 over 0.4 s, upside down the
  // other way round. Offsets are GD units, rotations clockwise degrees.
  _createSwingFires(scene, x, y) {
    this._swingFires = [];
    this._swingFireState = null;
    if (!_textureHasFrameSafe(scene, "GJ_GameSheetIcons", "fireBoost_001.png")) return;
    for (const [dx, dy, rot, size] of [[-14, 0, 90, 0.96], [-9.5, -10, 45, 0.72], [-9.5, 10, 135, 0.72]]) {
      const sprite = scene.add.image(x, y, "GJ_GameSheetIcons", "fireBoost_001.png").setOrigin(0.5, 0).setDepth(7.9).setVisible(false);
      this._swingFires.push({ sprite, dx, dy, rot, size, sx: size, sy: size, steps: null, loop: false, i: 0, t: 0, fromX: size, fromY: size });
    }
  }
  _swingFireRun(fire, steps, loop) {
    fire.steps = steps; fire.loop = loop; fire.i = 0; fire.t = 0; fire.fromX = fire.sx; fire.fromY = fire.sy;
  }
  _swingFireLoop(fire) {
    const s = fire.size;
    return [[0.06, s * 1.2, s], [0.06, s * 0.6, s * 1.5]];
  }
  _updateSwingFires(x, y, rotation, mirrorScale, mirrorDirection, dt) {
    const fires = this._swingFires;
    if (!fires?.length) return;
    const on = this.p.isSwing && !this.p.isDead && !this._endAnimating;
    if (!on) {
      if (this._swingFireState) {
        for (const fire of fires) { fire.sprite.setVisible(false); fire.steps = null; }
        this._swingFireState = null;
      }
      return;
    }
    const [middle, bottom, top] = fires;
    if (!this._swingFireState) {
      // toggleSwingMode: the middle fire loops, the others start at 0.01
      middle.sx = middle.sy = middle.size;
      this._swingFireRun(middle, this._swingFireLoop(middle), true);
      for (const fire of [bottom, top]) { fire.sx = fire.sy = 0.01; fire.steps = null; }
      this._swingFireState = { flipped: null };
    }
    const flipped = !!this.p.gravityFlipped;
    if (this._swingFireState.flipped !== flipped) {
      this._swingFireState.flipped = flipped;
      const active = flipped ? bottom : top, idle = flipped ? top : bottom;
      this._swingFireRun(active, [[0.06, active.size * 0.6, active.size * 1.5]], false);
      active.then = true;
      this._swingFireRun(idle, [[0.4, 0.01, 0.01]], false);
      idle.then = false;
    }
    const step = Math.max(0, dt || 0);
    const mini = this.p.isMini ? 0.6 : 1;
    const visual = rotation * mirrorDirection;
    const cos = Math.cos(visual), sin = Math.sin(visual);
    for (const fire of fires) {
      let left = step;
      while (fire.steps && left > 0) {
        const [dur, tx, ty] = fire.steps[fire.i];
        const used = Math.min(left, dur - fire.t);
        fire.t += used; left -= used;
        const k = dur > 0 ? Math.min(1, fire.t / dur) : 1;
        fire.sx = fire.fromX + (tx - fire.fromX) * k;
        fire.sy = fire.fromY + (ty - fire.fromY) * k;
        if (k < 1) break;
        fire.fromX = fire.sx; fire.fromY = fire.sy; fire.t = 0; fire.i++;
        if (fire.i >= fire.steps.length) {
          if (fire.loop) fire.i = 0;
          else if (fire.then) { fire.then = false; this._swingFireRun(fire, this._swingFireLoop(fire), true); }
          else fire.steps = null;
        }
      }
      // child of the rotated, mirrored player: GD y up -> screen y down
      const lx = fire.dx * 2 * mini * mirrorScale, ly = -fire.dy * 2 * mini;
      fire.sprite.setPosition(x + lx * cos - ly * sin, y + lx * sin + ly * cos);
      fire.sprite.rotation = visual + Phaser.Math.DegToRad(fire.rot) * mirrorDirection;
      fire.sprite.setScale(fire.sx * mini, fire.sy * mini);
      fire.sprite.setVisible(true);
    }
  }
  setSwingVisible(visible) {
    for (const layer of this._swingLayers || []) layer.sprite.setVisible(visible);
  }
  setBirdVisible(v) {
    for (const layer of (this._birdLayers || [])) {
      if (layer === this._birdGlowLayer) {
        layer.sprite.setVisible(v && layer.sprite._glowEnabled);
      } else {
        layer.sprite.setVisible(v);
      }
    }
  }
  setBallVisible(_0x5685cf) {
    if (this._ballSpriteLayer) {
      this._ballSpriteLayer.sprite.setVisible(_0x5685cf);
    }
    if (this._ballGlowLayer) {
      this._ballGlowLayer.sprite.setVisible(_0x5685cf && this._ballGlowLayer.sprite._glowEnabled);
    }
    if (this._ballOverlayLayer) {
      this._ballOverlayLayer.sprite.setVisible(_0x5685cf);
    }
  }
  setWaveVisible(_0x2d078b) {
    if (this._waveSpriteLayer) {
      this._waveSpriteLayer.sprite.setVisible(_0x2d078b);
    }
    if (this._waveOverlayLayer) {
      this._waveOverlayLayer.sprite.setVisible(_0x2d078b);
    }
    if (this._waveExtraLayer) {
      this._waveExtraLayer.sprite.setVisible(_0x2d078b);
    }
    if (this._waveGlowLayer) {
      this._waveGlowLayer.sprite.setVisible(_0x2d078b && this._waveGlowLayer.sprite._glowEnabled);
    }
  }
  setSpiderVisible(v) {
    for (const layer of (this._spiderLayers || [])) {
      if (!layer?.sprite) continue;
      if (layer.kind === "glow") {
        layer.sprite.setVisible(v && !!layer.sprite._glowEnabled);
      } else {
        layer.sprite.setVisible(v);
      }
    }
  }
  setRobotVisible(v) {
    for (const layer of (this._robotLayers || [])) {
      if (!layer?.sprite) continue;
      if (layer.kind === "glow") {
        layer.sprite.setVisible(v && !!layer.sprite._glowEnabled);
      } else {
        layer.sprite.setVisible(v);
      }
    }
    if (!v) {
      this._hideRobotJumpFlame();
    }
  }
  _primeRobotAnimationFrame(dt = 1 / 30) {
    if (!this.p.isRobot || this.p.isDead || !this._robotLayers?.length) return;
    const screenX = Number.isFinite(this._lastScreenX) ? this._lastScreenX : centerX;
    const screenY = Number.isFinite(this._lastScreenY) ? this._lastScreenY : b(this.p.y) + (this._scene?._cameraY || 0);
    const frameKey = this._selectRobotFrameKey(dt);
    const applied = this._applyRobotFrame(frameKey, screenX, screenY, dt);
    if (!applied) {
      const miniScale = this.p.isMini ? 0.6 : 1;
      for (const layer of (this._robotLayers || [])) {
        if (!layer?.sprite) continue;
        layer.sprite.x = screenX;
        layer.sprite.y = screenY;
        const mirrorScale = this._getMirrorVisualScale();
        layer.sprite.rotation = this._rotation * (mirrorScale < 0 ? -1 : 1);
        layer.sprite.scaleX = miniScale * mirrorScale;
        layer.sprite.scaleY = this.p.gravityFlipped ? -miniScale : miniScale;
      }
    }
    this.setRobotVisible(true);
  }
  _primeSpiderAnimationFrame(dt = 1 / 30) {
    if (!this.p.isSpider || this.p.isDead || !this._spiderLayers?.length) return;
    const screenX = Number.isFinite(this._lastScreenX) ? this._lastScreenX : centerX;
    const screenY = Number.isFinite(this._lastScreenY) ? this._lastScreenY : b(this.p.y) + (this._scene?._cameraY || 0);
    const frameKey = this._selectSpiderFrameKey(dt);
    const applied = this._applySpiderFrame(frameKey, screenX, screenY, dt);
    if (!applied) {
      const miniScale = this.p.isMini ? 0.6 : 1;
      for (const layer of (this._spiderLayers || [])) {
        if (!layer?.sprite) continue;
        layer.sprite.x = screenX;
        layer.sprite.y = screenY;
        const mirrorScale = this._getMirrorVisualScale();
        layer.sprite.rotation = this._rotation * (mirrorScale < 0 ? -1 : 1);
        layer.sprite.scaleX = miniScale * mirrorScale;
        layer.sprite.scaleY = this.p.gravityFlipped ? -miniScale : miniScale;
      }
    }
    this.setSpiderVisible(true);
  }
  _getMirrorVisualScale() {
    if (typeof this._scene?._getMirrorVisualScale === "function") {
      return this._scene._getMirrorVisualScale() * (this.p.isGoingLeft ? -1 : 1);
    }
    return (this.p.mirrored ? -1 : 1) * (this.p.isGoingLeft ? -1 : 1);
  }
  _syncShipArt(x,y,rotation,mirrorScale,flipped) {
    // Native ship/cube nodes are siblings at Y -5/+5 inside one player
    // transform. Rotate and scale both offsets together, including mini and
    // inverted gravity; a screen-space correction makes the cube wobble.
    const mini=this.p.isMini ? .6 : 1,angle=rotation*(mirrorScale<0?-1:1);
    const offset=10*mini*(flipped?-1:1),dx=-Math.sin(angle)*offset,dy=Math.cos(angle)*offset;
    for(const [layers,sign,size] of [[this._shipLayers,1,mini],[this._playerLayers,-1,mini*.55]]) {
      for(const layer of layers) if(layer?.sprite) {
        const sprite=layer.sprite;sprite.x=x+sign*dx;sprite.y=y+sign*dy;
        sprite.rotation=angle;sprite.scaleX=size*mirrorScale;sprite.scaleY=flipped?-size:size;
      }
    }
  }
  syncSprites(cameraX, cameraY, _0x3afedf, mirrorOffset) {
    if (this._endAnimating) {
      return;
    }
    this._defaultMiniIcon();
    const _0x7f0705 = mirrorOffset !== undefined ? mirrorOffset : centerX;
    const _0x1a433c = b(this.p.y) + cameraY;
    const gameplayFrame = this._gameLayer.gameplayState?.frameForPlayer?.(this) || this._gameLayer.gameplayState;
    const visualGravityFlipped = this.p.gravityFlipped !== !!gameplayFrame?.reflection;
    const playerRotation = gameplayFrame ? gameplayFrame.visualAngle(this._rotation) : this._rotation;
    const mirrorScale = this._getMirrorVisualScale();
    const mirrorDirection = mirrorScale < 0 ? -1 : 1;
    this._lastCameraX = cameraX;
    this._lastCameraY = cameraY;
    this._lastScreenX = _0x7f0705;
    this._lastScreenY = _0x1a433c;
    this._aboveContainer.x = -cameraX;
    this._aboveContainer.y = cameraY;
    this._trailContainer.x = -cameraX;
    this._trailContainer.y = cameraY;
if (this.p.isFlying || this.p.isUfo) {
      const _0x3904f8 = 10;
      const _miniS = this.p.isMini ? 0.6 : 1;
      const playerOffset = visualGravityFlipped ? (-30 * _miniS) : (10 * _miniS);
      const cosRotation = Math.cos(playerRotation);
      const sinRotation = Math.sin(playerRotation);
	    const mirrored = mirrorScale;
      const _0x1b1d28 = -_0x3904f8 * sinRotation * mirrored;
      const _0x185f91 = _0x3904f8 * cosRotation; 
      const _0x562424 = playerOffset * sinRotation * mirrored;
      const _0x3011c9 = -playerOffset * cosRotation;
      const _ufoMode = this.p.isUfo && !this.p.isFlying;
      if (this.p.isFlying) this._syncShipArt(_0x7f0705,_0x1a433c,playerRotation,mirrorScale,visualGravityFlipped);

	if (this.p.isUfo && !this.p.isDead) {
        for (const layer of this._birdLayers) {
          if (layer) {
            layer.sprite.setVisible(true);
            layer.sprite.x = _0x7f0705 + _0x1b1d28;
            layer.sprite.y = _0x1a433c + _0x185f91 + (visualGravityFlipped ? -15 : 5);
            layer.sprite.rotation = playerRotation * mirrorDirection;
            const _miniS = this.p.isMini ? 0.6 : 1;
            layer.sprite.scaleY = visualGravityFlipped ? -_miniS : _miniS;
            layer.sprite.scaleX = _miniS * mirrorScale;
          }
        }
      }
      
      if (!this.p.isFlying) for (const playerLayerItem of this._playerLayers) {
        if (playerLayerItem) {
          const _miniS = this.p.isMini ? 0.6 : 1;
          playerLayerItem.sprite.x = _0x7f0705 + _0x562424;
          playerLayerItem.sprite.y = (_0x1a433c + _0x3011c9) + (this.p.isMini ? (8 * _miniS) : 0) + (visualGravityFlipped ? (-20 * _miniS) : 0);
          playerLayerItem.sprite.rotation = playerRotation * mirrorDirection;
          const _shipCubeS = _miniS * 0.55;
          playerLayerItem.sprite.scaleY = visualGravityFlipped ? -_shipCubeS : _shipCubeS;
          playerLayerItem.sprite.scaleX = _shipCubeS * mirrorScale;
        }
      }
      if (_ufoMode) {
        const _ufotilt = Math.max(-0.1, Math.min(3, (this.p.y - this.p.lastY) * 0.015));
        const targetuforotation = _ufotilt * mirrorDirection;
        if (!Number.isFinite(this._uforotation)) this._uforotation = targetuforotation;
        const rotationmix = Math.min(1, Math.max(0, (_0x3afedf || 0) * 8.5));
        this._uforotation += (targetuforotation - this._uforotation) * rotationmix;
        this._uforotation = Math.max(-0.11, Math.min(3, this._uforotation));
        const uforotation = this._uforotation;
        const currentRotation = playerRotation * mirrorDirection;
        const birdX = _0x7f0705 + _0x1b1d28;
        const birdY = _0x1a433c + _0x185f91 + (visualGravityFlipped ? -15 : 5);
        const cubeX = _0x7f0705 + _0x562424;
        const cubeY = (_0x1a433c + _0x3011c9) + (this.p.isMini ? (8 * _miniS) : 0) + (visualGravityFlipped ? (-20 * _miniS) : 0);
        const offsetX = cubeX - birdX;
        const offsetY = cubeY - birdY;
        const rotationDelta = uforotation - currentRotation;
        const cosDelta = Math.cos(rotationDelta);
        const sinDelta = Math.sin(rotationDelta);
        const attachedCubeX = birdX + offsetX * cosDelta - offsetY * sinDelta;
        const attachedCubeY = birdY + offsetX * sinDelta + offsetY * cosDelta;
        for (const layer of this._birdLayers) {
          if (layer) {
            layer.sprite.rotation = uforotation;
          }
        }
		  for (const playerLayerItem of this._playerLayers) {
          if (playerLayerItem) {
            playerLayerItem.sprite.x = attachedCubeX;
            playerLayerItem.sprite.y = attachedCubeY;
            playerLayerItem.sprite.rotation = uforotation;
          }
        }
      }
    } else {
      for (const layer of this._spiderLayers) {
        if (layer) {
          layer.sprite.setVisible(false);
        }
      }
      
      for (const playerLayer of this._allLayers) {
        if (playerLayer) {
            playerLayer.sprite.x = _0x7f0705;
            playerLayer.sprite.y = _0x1a433c;
            const isBallLayer = this._ballLayers.includes(playerLayer);
            playerLayer.sprite.rotation = isBallLayer ? playerRotation : playerRotation * mirrorDirection;
            let _miniS = this.p.isMini ? 0.6 : 1;
            if (this.p.isWave && this._waveLayers.includes(playerLayer)) {
              _miniS *= 0.94; //fix wave size
            }
            playerLayer.sprite.scaleY = isBallLayer ? _miniS : (visualGravityFlipped ? -_miniS : _miniS);
            playerLayer.sprite.scaleX = _miniS * mirrorScale;
        }
      }
    }
    if (this.p.isWave && this._waveSpriteLayer) {
      const _0x3f036a = -mirrorScale;
      this._waveSpriteLayer.sprite.x += 1.5 * _0x3f036a;
      this._waveSpriteLayer.sprite.y -= 1;
    }
    if (this.p.isSpider && !this.p.isDead) {
      this.setCubeVisible(false);
      this.setBallVisible(false);
      this.setShipVisible(false);
      this.setWaveVisible(false);
      this.setBirdVisible(false);
      this.setRobotVisible(false);
      this._syncSpiderAnimation(_0x7f0705, _0x1a433c, _0x3afedf);
    } else {
      this.setSpiderVisible(false);
    }
    if (this.p.isRobot && !this.p.isDead) {
      this.setCubeVisible(false);
      this.setBallVisible(false);
      this.setShipVisible(false);
      this.setWaveVisible(false);
      this.setBirdVisible(false);
      this.setSpiderVisible(false);
      this._syncRobotAnimation(_0x7f0705, _0x1a433c, _0x3afedf);
      this._updateRobotJumpFlame(_0x3afedf);
    } else {
      this.setRobotVisible(false);
      this._hideRobotJumpFlame();
    }
    this._updateSpiderTeleportEffects(_0x3afedf);
    this.setSwingVisible(this.p.isSwing && !this.p.isDead);
    this._updateSwingFires(_0x7f0705, _0x1a433c, playerRotation, mirrorScale, mirrorDirection, _0x3afedf);
    if (this.p.isSwing) {
      this.setShipVisible(false); this.setCubeVisible(false);
      const size = this.p.isMini ? 0.6 : 1;
      for (const layer of this._swingLayers || []) {
        layer.sprite.setPosition(_0x7f0705, _0x1a433c);
        layer.sprite.setScale(size * mirrorScale, size);
        layer.sprite.rotation = playerRotation * mirrorDirection;
      }
    }
    if (this.p.isDashing && !this.p.isDead && this._dashSpinsIcon()) {
      // updateDashArt: the cube/ball icon spins inside the turned player.
      const spinLayers = this.p.isBall ? this._ballLayers : this._playerLayers;
      for (const layer of spinLayers) {
        if (!layer) continue;
        layer.sprite.rotation += (this._dashSpin || 0) * (this.p.isBall ? 1 : mirrorDirection);
        layer.sprite.scaleX *= 0.9;
        layer.sprite.scaleY *= 0.9;
      }
    }
    this.updateBlink();
    this._updateParticles(cameraX, cameraY, _0x3afedf);

    this._updateDashAnimation(_0x3afedf * 1000);
    if (this._dashAnimationSprite && this._dashAnimationSprite.visible) {
      // m_dashFireSprite is a child of the player: it takes the dash angle,
      // the per-mode offset/scale from updateDashArt and startDashing's
      // CCSequence(EaseInOut(ScaleTo(0.1, sx*0.9, sy*1.2)), EaseInOut(ScaleTo(0.1, sx, sy))).
      const _miniS = this.p.isMini ? 0.6 : 1;
      const mode = this.p.isFlying && !this.p.isSwing ? [0, -2, 1, 0.85] : this.p.isUfo ? [0, 0, 0.95, 0.9]
        : this.p.isRobot ? [1, 0, 0.9, 0.85] : this.p.isSpider ? [1, 0, 0.95, 0.8] : [0, 0, 0.9, 0.8];
      const sx = mode[2] * 1.1, sy = mode[3] * 1.2;
      this._dashFireTime = (this._dashFireTime || 0) + (_0x3afedf || 0);
      const ease = t => t < 0.5 ? 0.5 * Math.pow(t * 2, 2) : 1 - 0.5 * Math.pow((1 - t) * 2, 2);
      let fx = sx, fy = sy;
      if (this._dashFireTime < 0.1) {
        const k = ease(this._dashFireTime / 0.1);
        fx = 0.3 + (sx * 0.9 - 0.3) * k; fy = 0.2 + (sy * 1.2 - 0.2) * k;
      } else if (this._dashFireTime < 0.2) {
        const k = ease((this._dashFireTime - 0.1) / 0.1);
        fx = sx * 0.9 + (sx - sx * 0.9) * k; fy = sy * 1.2 + (sy - sy * 1.2) * k;
      }
      const rot = playerRotation * mirrorDirection;
      const ox = mode[0] * 2 * _miniS * mirrorScale, oy = mode[1] * -2 * _miniS * (visualGravityFlipped ? -1 : 1);
      this._dashAnimationSprite.x = _0x7f0705 + ox * Math.cos(rot) - oy * Math.sin(rot);
      this._dashAnimationSprite.y = _0x1a433c + ox * Math.sin(rot) + oy * Math.cos(rot);
      this._dashAnimationSprite.rotation = rot;
      this._dashAnimationSprite.scaleY = (visualGravityFlipped ? -_miniS : _miniS) * fy;
      this._dashAnimationSprite.scaleX = _miniS * mirrorScale * fx;
    }

    if (!this._scene._slideIn && this._scene._visualTick !== false){
      if (window.hitboxesOnDeath ? this.p.isDead : window.showHitboxes) {
        this.drawHitboxes(this._hitboxGraphics, cameraX, cameraY);
      } else if (this._hitboxGraphics) {
        this._hitboxGraphics.clear();
      }
    }
  }
  _setGamemodeFlyBounds(...args) {
    if (args[0] && this._scene) this._scene._lastBandY = args[1];
    if (this._scene?._isDual) return;
    this._gameLayer.setFlyMode(...args);
  }
  // switchToFlyMode (31a4a0) re-centres the ground on every mode portal, also
  // one of the mode the body is already in.
  _recenterBand(portal, height) {
    if (!portal) return;
    const level = this._gameLayer, center = portal.portalY !== undefined ? portal.portalY : portal.y;
    if (this._scene) this._scene._lastBandY = center;
    if (this._scene?._isDual) return;
    if (level._computeFlyBounds(center, height, false).floorY !== level._flyFloorY) level.setFlyMode(true, center, height, false, height);
  }
  enterShipMode(_0xeb37c6 = null, fromCheckpoint = false) {
    if (this.p.isSwing) this.exitShipMode();
    this.p.isSwing = false; this.setSwingVisible(false);
    if (_0xeb37c6) this._gameLayer.cameraState?.portalMode(_0xeb37c6);
    if (this.p.isFlying) {
      this._recenterBand(_0xeb37c6, f);
      return;
    }
    this.exitSpiderMode();
    this.exitRobotMode();
    this.exitBallMode();
    this.exitWaveMode();
    this.p.isFlying = true;
    this._scene.toggleGlitter(true);
    if (!fromCheckpoint){ // dont mess with y velocity if ur loading a checkpoint
      this.p.yVelocity *= 0.5;
    }
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this._particleEmitter.stop();
    this._flyParticle2Active = false;
    this._streak.reset();
    this._streak.start();
    this.setWaveVisible(false);
    this.setShipVisible(true);
    this.setCubeVisible(true);
    for (const layer of this._playerLayers) {
      if (layer) {
        layer.sprite.setScale(0.55);
      }
    }
    let spawnY = this.p.y;
    if (_0xeb37c6) {
      spawnY = _0xeb37c6.portalY !== undefined ? _0xeb37c6.portalY : _0xeb37c6.y;
    }
    this._setGamemodeFlyBounds(true, spawnY, f, false);
  }
  exitShipMode() {
    this.p.isSwing = false; this.setSwingVisible(false);
    if (this.p.isFlying) {
      this.p.isFlying = false;
      this._scene.toggleGlitter(false);
      this.p.yVelocity *= 0.5;
      this.p.onGround = false;
      this.p.canJump = false;
      this.p.isJumping = false;
      this.stopRotation();
      this._rotation = 0;
      this._flyParticleEmitter.stop();
      this._flyParticleActive = false;
      this._flyParticle2Emitter.stop();
      this._flyParticle2Active = false;
      this._shipDragEmitter.stop();
      this._shipDragActive = false;
      this._particleActive = false;
      this._streak.stop();
      this._streak.reset();
      this.p.jumpTrailActive = false;
      this.setShipVisible(false);
      this.setCubeVisible(!this.p.isBall && !this.p.isWave);
      this.setBallVisible(this.p.isBall);
      this.setWaveVisible(this.p.isWave);
      this.setSpiderVisible(false);
      for (const layer of this._playerLayers) {
        if (layer) {
          layer.sprite.setScale(1);
        }
      }
      this._setGamemodeFlyBounds(false, 0);
    }
  }
  enterBallMode(_0x36bb3d = null) {
    if (_0x36bb3d) this._gameLayer.cameraState?.portalMode(_0x36bb3d);
    if (this.p.isBall) {
      this._recenterBand(_0x36bb3d, f - a * 2);
      return;
    }
    this.exitShipMode(); this.exitUfoMode();
    this.exitSpiderMode();
    this.exitRobotMode();
    this.exitWaveMode();
    this.p.isBall = true;
    this.stopRotation();
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this._rotation = 0;
    this.setCubeVisible(false);
    this.setWaveVisible(false);
    this.setBallVisible(true);
    let _0x18df19 = this.p.y;
    if (_0x36bb3d) {
      _0x18df19 = _0x36bb3d.portalY !== undefined ? _0x36bb3d.portalY : _0x36bb3d.y;
    }
    this._setGamemodeFlyBounds(true, _0x18df19, f - a * 2, false);
  }
  enterSwingMode(portal = null, fromCheckpoint = false) {
    this._swingPendingFlip = false;
    // toggleSwingMode (4f8dd0): a swing keeps its speed through another swing portal.
    if (this.p.isSwing && this.p.isFlying) {
      if (portal) this._gameLayer.cameraState?.portalMode(portal);
      this._recenterBand(portal, f);
      return;
    }
    this.exitShipMode(); this.exitUfoMode();
    this.enterShipMode(portal, fromCheckpoint);
    this.p.isSwing = true;
    this.setShipVisible(false); this.setCubeVisible(false); this.setSwingVisible(true);
  }
  exitBallMode() {
    if (!this.p.isBall) {
      return;
    }
    this.p.isBall = false;
    this.stopRotation();
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this.setBallVisible(false);
    this.setWaveVisible(false);
    this.setCubeVisible(true);
    this._setGamemodeFlyBounds(false, 0);
  }
  enterWaveMode(_0x5a10cc = null) {
    if (_0x5a10cc) this._gameLayer.cameraState?.portalMode(_0x5a10cc);
    if (this.p.isWave) {
      this._recenterBand(_0x5a10cc, f);
      return;
    }
    this.exitSpiderMode();
    this.exitRobotMode();
    this.exitShipMode();
    this.exitBallMode();
    this.p.isWave = true;
    // PlayerObject::toggleDartMode (4f9291..4f92a1) halves the current
    // vertical velocity on both transitions, including leaving the dart.
    this.p.yVelocity *= 0.5;
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this._streak.reset();
    this._streak.start();
    this._waveTrail.reset();
    this._waveTrail.start();
    this.setCubeVisible(false);
    this.setBallVisible(false);
    this.setShipVisible(false);
    this.setWaveVisible(true);
    let _0x38b484 = this.p.y;
    if (_0x5a10cc) {
      _0x38b484 = _0x5a10cc.portalY !== undefined ? _0x5a10cc.portalY : _0x5a10cc.y;
    }
    this._setGamemodeFlyBounds(true, _0x38b484, f, false);
  }
  exitWaveMode() {
    if (!this.p.isWave) {
      return;
    }
    this.p.isWave = false;
    // A mini dart's speed is kept doubled here; native doubles its step instead.
    this.p.yVelocity *= this.p.isMini ? 0.25 : 0.5;
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this._streak.stop();
    this._streak.reset();
    this.p.jumpTrailActive = false;
    this._waveTrail.fadeOut(0.2);
    this._hitboxTrail = [];
    this.setWaveVisible(false);
    this.setCubeVisible(!this.p.isBall && !this.p.isFlying);
    this.setBallVisible(this.p.isBall);
    this.setShipVisible(this.p.isFlying);
    this.setSpiderVisible(false);
    this._setGamemodeFlyBounds(false, 0);
  }
  enterSpiderMode(portal = null) {
    if (portal) this._gameLayer.cameraState?.portalMode(portal);
    if (this.p.isSpider) { this._recenterBand(portal, Math.max(a, f - a)); return; }
    const enteredFromPortal = !!portal;
    this.exitShipMode();
    this.exitRobotMode();
    this.exitBallMode();
    this.exitWaveMode();
    this.p.isSpider = true;
    if (!enteredFromPortal) this.p.yVelocity = 0;
    this.p.onGround = !enteredFromPortal;
    this.p.onCeiling = !enteredFromPortal && !!this.p.gravityFlipped;
    this.p.canJump = !enteredFromPortal;
    this.p.isJumping = false;
    this.p._spiderTeleportPending = false;
    this.p._spiderTeleportAnimTimer = 0;
    this._spiderAnimTimer = (this._spiderAnimTimer || 0) + 0.18;
    this.stopRotation();
    this._rotation = 0;
    this.setCubeVisible(false);
    this.setBallVisible(false);
    this.setShipVisible(false);
    this.setWaveVisible(false);
    this.setSpiderVisible(true);
    let _y = this.p.y;
    if (portal) _y = portal.portalY !== undefined ? portal.portalY : portal.y;
    const spiderBlockSize = typeof a !== "undefined" ? a : 30;
    const spiderBaseHeight = typeof f !== "undefined" ? f : 480;
    const spiderFlyHeight = Math.max(spiderBlockSize, spiderBaseHeight - spiderBlockSize);
    this._setGamemodeFlyBounds(true, _y, spiderFlyHeight, false, spiderFlyHeight);
    this._primeSpiderAnimationFrame(1 / 30);
  }
  exitSpiderMode() {
    if (!this.p.isSpider) return;
    this.p.isSpider = false;
    // Leaving spider preserves momentum; the destination mode applies its
    // own transition multiplier (for example UFO halves it once).
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.p._spiderTeleportPending = false;
    this.p._spiderTeleportAnimTimer = 0;
    this.stopRotation();
    this._rotation = 0;
    this.setSpiderVisible(false);
    this._hideRobotJumpFlame();
    this._robotJumpFlameActive = false;
    this._robotJumpFlamePulse = 0;
    this._robotJumpFlameFadeInTimer = 0;
    this.setCubeVisible(true);
    this._setGamemodeFlyBounds(false, 0);
  }
  enterRobotMode(portal = null) {
    if (this.p.isRobot) return;
    const enteredFromPortal = !!portal;
    this.exitShipMode();
    this.exitBallMode();
    this.exitWaveMode();
    this.exitSpiderMode();
    this.exitUfoMode();
    this.p.isRobot = true;
    this.p._robotHold = false;
    this.p._robotHoldTimer = 0;
    this.p.onGround = !enteredFromPortal;
    this.p.onCeiling = !enteredFromPortal && !!this.p.gravityFlipped;
    this.p.canJump = !enteredFromPortal;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this._robotAnimState = "run";
    this._robotAnimTimer = (this._robotAnimTimer || 0) + 0.12;
    this.setCubeVisible(false);
    this.setBallVisible(false);
    this.setShipVisible(false);
    this.setWaveVisible(false);
    this.setSpiderVisible(false);
    this.setBirdVisible(false);
    this.setRobotVisible(true);
    this._setGamemodeFlyBounds(false, 0);
    this._primeRobotAnimationFrame(1 / 30);
  }
  exitRobotMode() {
    if (!this.p.isRobot) return;
    this.p.isRobot = false;
    this.p._robotHold = false;
    this.p._robotHoldTimer = 0;
    this._robotJumpFlameActive = false;
    this._hideRobotJumpFlame();
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this.setRobotVisible(false);
    this.setCubeVisible(!this.p.isBall && !this.p.isFlying && !this.p.isWave && !this.p.isUfo && !this.p.isSpider);
    this._setGamemodeFlyBounds(false, 0);
  }
  enterUfoMode(_portal = null, fromCheckpoint = false) {
    if (_portal) this._gameLayer.cameraState?.portalMode(_portal);
    if (this.p.isUfo) { this._recenterBand(_portal, f); return; }
    this.exitSpiderMode();
    this.exitRobotMode();
    this.exitBallMode();
    this.exitWaveMode();
    this.exitShipMode();
    this.p.isUfo = true;
    this._scene.toggleGlitter(true);
    if (!fromCheckpoint){ // dont mess with y velocity if ur loading a checkpoint
      this.p.yVelocity *= 0.5;
    }
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.stopRotation();
    this._rotation = 0;
    this._particleEmitter.stop();
    this._streak.reset();
    this._streak.start();
    this.setBallVisible(false);
    this.setShipVisible(false);
    this.setWaveVisible(false);
    this.setSpiderVisible(false);
    this.setBirdVisible(true);
    this.setCubeVisible(true);
    for (const _layer of this._playerLayers) {
      if (_layer) {
        _layer.sprite.setScale(0.55);
      }
    }
    let _spawnY = this.p.y;
    if (_portal) {
      _spawnY = _portal.portalY !== undefined ? _portal.portalY : _portal.y;
    }
    this._setGamemodeFlyBounds(true, _spawnY, f, false);
  }
  exitUfoMode() {
    if (!this.p.isUfo) return;
    this.p.isUfo = false;
    this._scene.toggleGlitter(false);
    this.p.yVelocity *= 0.5;
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
	this._streak.stop();
    this._streak.reset();
    this.p.jumpTrailActive = false;
    this.stopRotation();
    this._rotation = 0;
    this._flyParticleEmitter.stop();
    this.setCubeVisible(!this.p.isBall && !this.p.isFlying);
    this.setBallVisible(this.p.isBall);
    this.setShipVisible(this.p.isFlying);
    this.setWaveVisible(this.p.isWave);
    this.setBirdVisible(false);
    this.setSpiderVisible(false);
    for (const _0xe1b715 of this._playerLayers) {
      if (_0xe1b715) {
        _0xe1b715.sprite.setScale(1);
      }
    }
    this._setGamemodeFlyBounds(false, 0);
  }
  hitGround(skipBurst = false) {
    const _0x4a38a5 = !skipBurst && !this.p.onGround;
    if (_0x4a38a5) this._gameLayer?.logicState?.landing(this.p.yVelocity);
    if (!this.p.isFlying && !this.p.isWave && !this.p.isUfo) {
      this.p.lastGroundY = this.p.y;
    }
    this.p.yVelocity = 0;
    this.p.onGround = true;
    this.p.canJump = !(this.p.stateNoAutoJump > 0) || this.p.upKeyPressed;
    this.p.isJumping = false;
    this.p.queuedHold = false;
    if (this.p.isBall) {
      // 4fa7e3..4fa83e: a reversed roll ends on the ground, and the body rolls.
      if (this._ballReversed || (this._ballRateScaled && !this._slopeContactThisTick)) this.stopRotation();
      if (!this.rotateActionActive) this._runBallRotation();
      return;
    } else if (this.p.isSpider) {
      if (_0x4a38a5) {
        this._rotation = Math.round(this._rotation / Math.PI) * Math.PI;
      }
    } else if (this.p.isWave) {
      this._rotation = 0;
    }
    this.stopRotation();
    if (_0x4a38a5 && !this.p.isFlying && !this.p.isWave && !this.p.isSpider && !this._scene?._editorPlaytestActive) {
      if (!window.enableLDM) {
        this._landIdx = !this._landIdx;
        const _0x31584b = this._landIdx ? this._landEmitter1 : this._landEmitter2;
        const _0x2248d5 = this._worldX();
        const _0x17e0bb = this.p.gravityFlipped ? b(this.p.y) - 30 : b(this.p.y) + 30;
        _0x31584b.explode(10, _0x2248d5, _0x17e0bb);
      }
    }
  }
  _getparticlecolor(gameObj) {
    if (Number.isFinite(Number(gameObj?.particleColor))) {
      return Number(gameObj.particleColor);
    }
    if (gameObj?.userCoinId !== undefined) return 0xd0d0d0;
    if (gameObj?.coinId !== undefined) return 0xffff00;
    const colororb = {
      35: 0xffff00,
      36: 0xffff00,
      67: 0x00ffff,
      84: 0x00ffff,
      1022: 0x00ff00,
      1330: 0x000000,
      1332: 0xff0000,
      1333: 0xff0000,
      140: 0xff00ff,
      141: 0xff00ff,
      1704: 0x00ff00,
      1751: 0xff00ff
    };
    return colororb[Number(gameObj?.padId ?? gameObj?.orbId)] ?? this._primaryColor();
  }

  _orbpadHitEffect(gameObj) {
    if (!gameObj || this._scene?._editorPlaytestActive || window.enableLDM) return;
    const isRing = gameObj.type === jumpRingType;
    const source = gameObj._eeLevelObject;
    if (gameObj.noEffects || source?.noEffects || (!isRing && (gameObj.noParticles || source?.noParticles))) return;
    if (isRing && Number(gameObj.orbId) === 3643) return;

    const scene = this._scene;
    const worldX = Number(gameObj.x);
    const worldY = Number(gameObj.y);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;

    const color = this._getparticlecolor(gameObj);
    const isPad = gameObj.type === jumpPadType;
    const maxRadius = isPad ? 82 : 68;
    const graphics = scene.add.graphics().setDepth(15).setBlendMode(S);
    this._gameLayer.topContainer.add(graphics);
    const followPos = { x: 0, y: 0 };
    const followObject = () => {
      // Collision handling may be in a rotated gameplay frame. Follow the
      // original rendered object in world space, as CCCircleWave does.
      const object = scene._level?.gdObjects?.[gameObj._eeObjectId];
      // The live position includes deferred group moves without flushing
      // every moved group's members each frame.
      const live = object && scene._level.gdRenderer?.livePosition ? scene._level.gdRenderer.livePosition(object, followPos) : null;
      const currentX = live ? live.x * 2 : object ? (object.x + object.offX) * 2 : Number(gameObj.x);
      const currentY = live ? live.y * 2 : object ? (object.y + object.offY) * 2 : Number(gameObj.y);
      if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
        graphics.setPosition(currentX, b(currentY));
      }
    };
    followObject();
    scene.events.on("postupdate", followObject);
    const state = { progress: 0 };

    scene.tweens.add({
      targets: state,
      progress: 1,
      duration: isRing ? 250 : 300,
      ease: isRing ? "Linear" : "Quad.Out",
      onUpdate: () => {
        // RingObject::spawnCircle -> CCCircleWave(5,55,.25,false,true).
        // CCEaseOut(rate=2) samples sqrt(t), including the opacity action.
        const progress = isRing ? Math.sqrt(state.progress) : state.progress;
        const radius = 10 + progress * ((isRing ? 110 : maxRadius) - 10);
        const alpha = Math.max(0, 1 - progress);
        graphics.clear();
        graphics.setAlpha(1);
        if (isRing) {
          const gdRadius = radius / 2;
          const segments = gdRadius < 10 ? 10 : gdRadius < 20 ? 15 : gdRadius < 40 ? 20 : gdRadius < 200 ? 30 : 50;
          graphics.lineStyle(2, 0xffffff, Math.trunc(alpha * 255) / 255);
          graphics.beginPath();
          graphics.moveTo(radius, 0);
          for (let i = 1; i <= segments; i++) {
            const angle = i * Math.PI * 2 / segments;
            graphics.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          graphics.closePath();
          graphics.strokePath();
        } else {
          graphics.fillStyle(color, alpha);
          graphics.fillCircle(0, 0, radius);
        }
      },
      onComplete: () => {
        scene.events.off("postupdate", followObject);
        graphics.destroy();
      }
    });
  }

  playGravityEffect(toUp) {
    if (this._scene?._editorPlaytestActive || window.enableLDM || !this._scene) return;
    const scene = this._scene;
    const color = toUp ? 0xffff00 : 0x00ffff;
    const lineCount = 14;
    const sWidth = typeof screenWidth !== "undefined" ? screenWidth : (scene.scale?.width || 100);
    const sHeight = typeof screenHeight !== "undefined" ? screenHeight : (scene.scale?.height || 600);
    const step = (sWidth - 60) / lineCount;

    const startY = toUp ? sHeight + 95 : -95;
    const targetY = toUp ? -95 : sHeight + 95;

    const container = scene.add.container(0, startY).setDepth(30).setScrollFactor(0);

    for (let i = 0; i < lineCount; i++) {
      const lineX = 32 - sWidth * 0 + i * step + Math.random() * step;
      const yOff = (Math.random() * 1 - 1) * 10;
      const scaleX = Math.random() * 14 + 2;
      const scaleY = Math.random() * 1 + 2;
      const alpha = (60 + Math.random() * 60) / 255;
      const spr = scene.add.image(lineX, yOff, "gravityLine_001")
        .setTint(color)
        .setScale(scaleX, scaleY)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setFlipY(!toUp);
      container.add(spr);
    }

    scene.tweens.add({
      targets: container,
      y: targetY,
      alpha: 0,
      duration: 400,
      ease: "Quad.Out",
      onComplete: () => {
        container.destroy();
      }
    });
  }

  _noclipEnabled() {
    if(!window.noClip)return false;
    const cfg=window.GDHacks?.state||{},stats=this.noclipStats;
    const second=this.p===this._scene?._state2;
    if(second?cfg.noclipP2===false:cfg.noclipP1===false)return false;
    if(cfg.noclipAccuracyLimitEnabled&&stats?.accuracy<cfg.noclipAccuracyLimit)return false;
    if(cfg.noclipDeathLimitEnabled&&stats?.deaths>=cfg.noclipDeathLimit)return false;
    return true;
  }
  killPlayer(force = false) {
    // Every death path (including slopes, world bounds and dual mode) goes
    // through this gate. Keep accuracy accounting without starting a death.
    if (!force && this._noclipEnabled()) {
      this.p.diedThisFrame = true;
      return;
    }
    if (this.p.isDead || this._scene._macroBot?.playing) {
      return;
    }
    const isOtherDeath = !!this._gameLayer?.logicState?.deathNotified;
    this.p.isDead = true;
    this._gameLayer?.logicState?.playerDied?.();
    this._scene.toggleGlitter(false);
    this._particleEmitter.stop();
    this._particleActive = false;
    this._flyParticleEmitter.stop();
    this._flyParticleActive = false;
    this._flyParticle2Emitter.stop();
    this._flyParticle2Active = false;
    this._shipDragEmitter.stop();
    this._shipDragActive = false;
    this._streak.stop();
    this._streak.reset();
    this._waveTrail.fadeOut(0.2);
    this._clearSpiderTeleportEffects();

    // Native playerDestroyed only shows the primary death effect when
    // that body's artwork was visible. Troll hides it behind authored art.
    if (window.noDeathEffect || this._scene?._editorPlaytestActive || this._effectsHidden() || isOtherDeath) {
      this.setCubeVisible(false);
      this.setShipVisible(false);
      this.setBallVisible(false);
      this.setWaveVisible(false);
      this.setBirdVisible(false);
      this.setSpiderVisible(false);
      this.setRobotVisible(false);
      this.setSwingVisible?.(false);
      this._hideRobotJumpFlame();
      if (this._dashAnimationSprite) this._dashAnimationSprite.setVisible(false);
      return;
    }

    const _0x3f4b84 = this._scene;
    const _0x3f0446 = _0x3f4b84._getMirrorXOffset(this._worldX() - _0x3f4b84._cameraX);
    const _0x53ac5b = b(this.p.y) + this._lastCameraY;
    const _0x281e43 = this.p.isMini ? .6 : .9;
    const frame = this._scene._localPhysicsActive ? this._gameLayer.gameplayState : null;
    const world = frame ? frame.toWorld(this._worldX(), this.p.y) : { x:this._worldX(), y:this.p.y };
    const primary = this._primaryColor();
    this._gameLayer.gdRenderer?.deathParticles({ x:world.x/2, y:world.y/2 },
      [(primary>>>16)&255,(primary>>>8)&255,primary&255], _0x281e43);
    const _0x438d80 = _0x3f4b84.add.graphics().setDepth(15).setBlendMode(S).setPosition(world.x, b(world.y));
    this._gameLayer.topContainer.add(_0x438d80);
    this._deathFlashGraphics = _0x438d80;
    const _0x4683eb = {
      t: 0
    };
    this._deathFlashTween = _0x3f4b84.tweens.add({
      targets: _0x4683eb,
      t: 1,
      duration: 500,
      ease: "Linear",
      onUpdate: () => {
        // Default playDeathEffect (4e2098): CCCircleWave(10*s,90*s,.5,
        // false,true), with the same native sqrt progress as ring waves.
        const progress = Math.sqrt(_0x4683eb.t);
        const radius = (20 + progress * 160) * _0x281e43;
        const alpha = Math.trunc(Math.max(0, 1 - progress) * 255) / 255;
        _0x438d80.clear();
        _0x438d80.fillStyle(this._primaryColor(), alpha);
        _0x438d80.fillCircle(0, 0, radius);
      },
      onComplete: () => {
        if (this._deathFlashGraphics === _0x438d80) {
          this._deathFlashGraphics = null;
        }
        if (this._deathFlashTween) {
          this._deathFlashTween = null;
        }
        _0x438d80.destroy();
      }
    });
    this._createExplosionPieces(_0x3f0446, _0x53ac5b, _0x281e43);
    this.setCubeVisible(false);
    this.setShipVisible(false);
    this.setBallVisible(false);
    this.setWaveVisible(false);
    this.setBirdVisible(false);
    this.setSpiderVisible(false);
    this.setRobotVisible(false);
    this.setSwingVisible?.(false);
    this._hideRobotJumpFlame();
  }
  _createExplosionPieces(_0x49be85, _0x13b56e, _0x349a09) {
    const _0x44acaf = this._scene;
    const _0x4a9f23 = _0x349a09 * 40;
    const sliderBar = Math.round(_0x4a9f23 * 2);
    const _0x26dcbd = _0x44acaf.make.renderTexture({
      x: 0,
      y: 0,
      width: sliderBar,
      height: sliderBar,
      add: false
    });
    const _0x5c571a = [this._playerGlowLayer, this._playerOverlayLayer, this._ballGlowLayer, this._ballOverlayLayer, this._waveGlowLayer, this._waveOverlayLayer, this._waveExtraLayer, this._shipGlowLayer, this._shipOverlayLayer, this._spiderGlowLayer, this._spiderOverlayLayer, this._robotGlowLayer, this._robotOverlayLayer, this._playerSpriteLayer, this._playerExtraLayer, this._ballSpriteLayer, this._waveSpriteLayer, this._shipSpriteLayer, this._shipExtraLayer, this._spiderSpriteLayer, this._spiderExtraLayer, this._robotSpriteLayer, this._robotExtraLayer, this._birdSpriteLayer, this._birdGlowLayer, this._birdOverlayLayer, this._birdExtraLayer, ...(this._robotLayers || [])];
	  for (const _0x1f09e3 of _0x5c571a) {
      if (!_0x1f09e3) {
        continue;
      }
      if (!_0x1f09e3.sprite.visible) {
        continue;
      }
      const _0x53102a = _0x1f09e3.sprite;
      _0x26dcbd.draw(_0x53102a, sliderBar / 2 + (_0x53102a.x - _0x49be85), sliderBar / 2 + (_0x53102a.y - _0x13b56e));
    }
    const _0xd0201e = "__deathRT_" + Date.now();
    _0x26dcbd.saveTexture(_0xd0201e);
    const _0x5a2621 = _0x44acaf.textures.get(_0xd0201e);
    let _0x28c600 = 2 + Math.round(Math.random() * 2);
    let _0x247253 = 2 + Math.round(Math.random() * 2);
    const _0x5b9267 = Math.random();
    if (_0x5b9267 > 0.95) {
      _0x28c600 = 1;
    } else if (_0x5b9267 > 0.9) {
      _0x247253 = 1;
    }
    const _0x1e8c09 = playerSpeed * d * .9 * .8;
    const _0x422587 = _0x1e8c09 * 0.5;
    const _0x1e87b0 = _0x1e8c09 * 1;
    const _0x4dd9c4 = 0.45;
    const _0x5e8097 = sliderBar / _0x28c600;
    const _0x5af9d3 = sliderBar / _0x247253;
    const _0xe9c860 = [];
    const _0x3215fa = [];
    const _0x416e63 = [0];
    const _0x57d0dc = [0];
    let _0x44e1e1 = 0;
    let _0x38011e = 0;
    for (let _0x3f4d44 = 0; _0x3f4d44 < _0x28c600 - 1; _0x3f4d44++) {
      const _0x5b2c12 = Math.round(_0x5e8097 * (0.55 + Math.random() * _0x4dd9c4 * 2));
      _0xe9c860.push(_0x5b2c12);
      _0x44e1e1 += _0x5b2c12;
      _0x416e63.push(_0x44e1e1);
    }
    _0xe9c860.push(sliderBar - _0x44e1e1);
    for (let _0x325ce1 = 0; _0x325ce1 < _0x247253 - 1; _0x325ce1++) {
      const _0x37f0ad = Math.round(_0x5af9d3 * (0.55 + Math.random() * _0x4dd9c4 * 2));
      _0x3215fa.push(_0x37f0ad);
      _0x38011e += _0x37f0ad;
      _0x57d0dc.push(_0x38011e);
    }
    _0x3215fa.push(sliderBar - _0x38011e);
    this._explosionPieces = [];
    this._explosionContainer = _0x44acaf.add.container(_0x49be85, _0x13b56e).setDepth(16);
    let _0x156c8b = 0;
    for (let _0x4cd06e = 0; _0x4cd06e < _0x28c600; _0x4cd06e++) {
      const _0x5c6aa9 = _0xe9c860[_0x4cd06e];
      const _0x43a4e9 = _0x416e63[_0x4cd06e];
      for (let _0x5b14cf = 0; _0x5b14cf < _0x247253; _0x5b14cf++) {
        const _0x20847a = _0x3215fa[_0x5b14cf];
        const _0x20396e = _0x57d0dc[_0x5b14cf];
        if (_0x5c6aa9 <= 0 || _0x20847a <= 0) {
          continue;
        }
        _0x156c8b++;
        const _0x526d03 = "piece_" + _0x4cd06e + "_" + _0x5b14cf;
        _0x5a2621.add(_0x526d03, 0, _0x43a4e9, _0x20396e, _0x5c6aa9, _0x20847a);
        const _0xba83f5 = _0x44acaf.add.image(0, 0, _0xd0201e, _0x526d03);
        _0xba83f5.x = _0x43a4e9 + _0x5c6aa9 / 2 - sliderBar / 2;
        _0xba83f5.y = -(_0x20396e + _0x20847a / 2 - sliderBar / 2);
        this._explosionContainer.add(_0xba83f5);
        let _0x298d34 = null;
        if (_0x156c8b % 2 == 0) {
          const _0x367bdb = 200 + Math.random() * 200;
          const _0x5e5fa8 = _0xba83f5;
          _0x298d34 = _0x44acaf.add.particles(0, 0, "GJ_WebSheet", {
            frame: "square.png",
            speed: 0,
            scale: {
              start: 0.5,
              end: 0
            },
            alpha: {
              start: 1,
              end: 0
            },
            lifespan: _0x367bdb,
            frequency: 25,
            quantity: 1,
            emitting: true,
            blendMode: S,
            tint: this._primaryColor(),
            emitCallback: _0x2f7fc7 => {
              _0x2f7fc7.x = _0x5e5fa8.x + (Math.random() * 2 - 1) * 3 * 2;
              _0x2f7fc7.y = _0x5e5fa8.y + (Math.random() * 2 - 1) * 3 * 2;
            }
          });
          this._explosionContainer.addAt(_0x298d34, 0);
        }
        const _0x159cfa = {
          spr: _0xba83f5,
          particle: _0x298d34,
          xVel: (_0x422587 + (Math.random() * 2 - 1) * _0x1e87b0) * (this.p.mirrored ? -1 : 1),
          yVel: -(12 + (Math.random() * 2 - 1) * 6),
          timer: 1.4,
          fadeTime: 0.5,
          rotDelta: (Math.random() * 2 - 1) * 360 / 60,
          halfSize: Math.min(_0x5c6aa9, _0x20847a) / 2
        };
        this._explosionPieces.push(_0x159cfa);
      }
    }
    this._explosionGroundSY = b(0) + this._lastCameraY;
    this._explosionRT = _0x26dcbd;
    this._explosionTexKey = _0xd0201e;
  }
  updateExplosionPieces(_0x1c8c6d) {
    if (this._deathAnimationPaused) {
      return;
    }
    if (!this._explosionPieces || this._explosionPieces.length === 0) {
      return;
    }
    const _0x1ed0a8 = _0x1c8c6d / 1000;
    const _0x3e389c = Math.min(_0x1ed0a8 * 60 * 0.9, 2);
    const _0x59eafe = _0x3e389c * 0.5 * 2;
    const _0x5a7549 = this._explosionGroundSY - this._explosionContainer.y;
    let _0x4284b0 = 0;
    while (_0x4284b0 < this._explosionPieces.length) {
      const particleX = this._explosionPieces[_0x4284b0];
      particleX.timer -= _0x1ed0a8;
      if (particleX.timer > 0) {
        {
          particleX.yVel += _0x59eafe;
          particleX.xVel *= 0.98 + (1 - _0x3e389c) * 0.02;
          let _0x57034b = particleX.spr.x + particleX.xVel * _0x3e389c;
          let _0x4c0481 = particleX.spr.y + particleX.yVel * _0x3e389c;
          const _0x3f6377 = _0x5a7549 - particleX.halfSize;
          if (_0x4c0481 > _0x3f6377 && particleX.yVel > 0) {
            _0x4c0481 = _0x3f6377;
            particleX.yVel *= -0.8;
            if (Math.abs(particleX.yVel) < 3) {
              particleX.yVel = -3;
            }
          }
          particleX.spr.x = _0x57034b;
          particleX.spr.y = _0x4c0481;
          particleX.spr.angle += particleX.rotDelta * _0x3e389c;
          if (particleX.timer < particleX.fadeTime) {
            const _0x2d8b5f = particleX.timer / particleX.fadeTime;
            particleX.spr.setAlpha(_0x2d8b5f);
            if (particleX.particle) {
              particleX.particle.setAlpha(_0x2d8b5f);
            }
          }
        }
        _0x4284b0++;
      } else {
        if (particleX.particle) {
          particleX.particle.stop();
          particleX.particle.destroy();
        }
        particleX.spr.destroy();
        this._explosionPieces.splice(_0x4284b0, 1);
      }
    }
    if (this._explosionPieces.length === 0) {
      this._cleanupExplosion();
    }
  }
  setDeathAnimationPaused(paused) {
    const shouldPause = !!paused;
    this._deathAnimationPaused = shouldPause;

    if (this._deathBurstEmitter) {
      this._deathBurstEmitter.timeScale = shouldPause ? 0 : 1;
    }

    if (this._explosionPieces) {
      for (const piece of this._explosionPieces) {
        if (piece?.particle) {
          piece.particle.timeScale = shouldPause ? 0 : 1;
        }
      }
    }

    if (this._deathFlashTween) {
      if (shouldPause) {
        this._deathFlashTween.pause?.();
      } else {
        this._deathFlashTween.resume?.();
      }
    }
  }
  _cleanupExplosion() {
    if (this._deathFlashTween) {
      this._deathFlashTween.stop?.();
      this._deathFlashTween = null;
    }
    if (this._deathFlashGraphics) {
      this._deathFlashGraphics.destroy?.();
      this._deathFlashGraphics = null;
    }
    if (this._deathBurstEmitter) {
      this._deathBurstEmitter.stop?.();
      this._deathBurstEmitter.destroy?.();
      this._deathBurstEmitter = null;
    }
    this._deathAnimationPaused = false;

    if (this._explosionPieces) {
      for (const _0x59172d of this._explosionPieces) {
        if (_0x59172d.particle) {
          _0x59172d.particle.stop();
          _0x59172d.particle.destroy();
        }
        if (_0x59172d.spr) {
          _0x59172d.spr.destroy();
        }
      }
    }
    if (this._explosionContainer) {
      this._explosionContainer.destroy();
      this._explosionContainer = null;
    }
    if (this._explosionTexKey) {
      this._scene.textures.remove(this._explosionTexKey);
      this._explosionTexKey = null;
    }
    if (this._explosionRT) {
      this._explosionRT.destroy();
      this._explosionRT = null;
    }
    this._explosionPieces = null;
  }
  _getPortalShineFrames(portalCollider, type = 1) {
    const portalType = portalCollider?.type;

    if (portalType === speedType || portalType === "speed") {
      const speedShineMap = {
        200: "boost_01_shine_001.png",
        201: "boost_02_shine_001.png",
        202: "boost_03_shine_001.png",
        203: "boost_04_shine_001.png",
        1334: "boost_05_shine_001.png"
      };
      const speedFrame = speedShineMap[portalCollider?.speedId] || "boost_02_shine_001.png";
      return [{ frame: speedFrame, container: this._gameLayer.topContainer }];
    }

    const portalShineMap = {
      portal_mirror_on: "03",
      portal_mirror_off: "03",
      portal_mini_on: "04",
      portal_mini_off: "04",
      portal_dual_on: "05",
      portal_dual_off: "05",
      portal_teleport: "06"
    };

    const typeStr = portalShineMap[portalType] || ((type === 1) ? "02" : "01");
    return [
      { frame: `portalshine_${typeStr}_front_001.png`, container: this._gameLayer.topContainer },
      { frame: `portalshine_${typeStr}_back_001.png`, container: this._gameLayer.container }
    ];
  }

  _getPortalShineAtlasFrameData(scene, frameName) {
    if (!scene?.textures) return null;

    const requestedSheet = "GJ_GameSheet04";
    if (scene.textures.exists(requestedSheet)) {
      const texture = scene.textures.get(requestedSheet);
      const frameData = texture?.get?.(frameName);
      if (frameData && frameData.name !== "__MISSING") {
        return {
          atlasFrame: { atlas: requestedSheet, frame: frameName },
          atlasTexture: texture,
          frameData
        };
      }
    }

    if (typeof getAtlasFrame !== "function") return null;
    const atlasFrame = getAtlasFrame(scene, frameName);
    if (!atlasFrame) return null;
    const atlasTexture = scene.textures.get(atlasFrame.atlas);
    const frameData = atlasTexture?.get?.(atlasFrame.frame);
    if (!atlasTexture || !frameData || frameData.name === "__MISSING") return null;
    return { atlasFrame, atlasTexture, frameData };
  }

  _readPortalShineFrameRect(frameData, packedMeta = {}) {
    const customData = frameData?.customData || {};
    const frameRect = customData.frame || packedMeta.frame || {};
    const sourceSize = customData.sourceSize || packedMeta.sourceSize || {};
    const spriteSourceSize = customData.spriteSourceSize || packedMeta.spriteSourceSize || {};

    const frameX = Number(frameRect.x ?? frameData?.cutX ?? frameData?.x ?? 0) || 0;
    const frameY = Number(frameRect.y ?? frameData?.cutY ?? frameData?.y ?? 0) || 0;
    const frameW = Number(frameRect.w ?? frameRect.width ?? frameData?.realWidth ?? frameData?.width ?? frameData?.cutWidth ?? 0) || 0;
    const frameH = Number(frameRect.h ?? frameRect.height ?? frameData?.realHeight ?? frameData?.height ?? frameData?.cutHeight ?? 0) || 0;

    const drawW = Number(spriteSourceSize.w ?? spriteSourceSize.width ?? frameW) || frameW;
    const drawH = Number(spriteSourceSize.h ?? spriteSourceSize.height ?? frameH) || frameH;
    const drawX = Number(spriteSourceSize.x ?? 0) || 0;
    const drawY = Number(spriteSourceSize.y ?? 0) || 0;
    const sourceW = Number(sourceSize.w ?? sourceSize.width ?? frameData?.realWidth ?? (drawX + drawW)) || (drawX + drawW);
    const sourceH = Number(sourceSize.h ?? sourceSize.height ?? frameData?.realHeight ?? (drawY + drawH)) || (drawY + drawH);

    return { frameX, frameY, frameW, frameH, drawX, drawY, drawW, drawH, sourceW, sourceH };
  }

  _getPortalShinePackedFrameMeta(frameName) {
    const shineAtlasMeta = {
      "boost_01_shine_001.png": { rotated: false, frame: { x: 910, y: 1038, w: 64, h: 82 }, sourceSize: { w: 64, h: 82 }, spriteSourceSize: { x: 0, y: 0, w: 64, h: 82 } },
      "boost_02_shine_001.png": { rotated: true, frame: { x: 325, y: 1083, w: 61, h: 108 }, sourceSize: { w: 61, h: 108 }, spriteSourceSize: { x: 0, y: 0, w: 61, h: 108 } },
      "boost_03_shine_001.png": { rotated: true, frame: { x: 801, y: 1052, w: 96, h: 108 }, sourceSize: { w: 96, h: 108 }, spriteSourceSize: { x: 0, y: 0, w: 96, h: 108 } },
      "boost_04_shine_001.png": { rotated: true, frame: { x: 332, y: 957, w: 125, h: 108 }, sourceSize: { w: 125, h: 108 }, spriteSourceSize: { x: 0, y: 0, w: 125, h: 108 } },
      "boost_05_shine_001.png": { rotated: true, frame: { x: 937, y: 742, w: 128, h: 103 }, sourceSize: { w: 128, h: 103 }, spriteSourceSize: { x: 0, y: 0, w: 128, h: 103 } },
      "portalshine_03_front_001.png": { rotated: true, frame: { x: 971, y: 1, w: 72, h: 178 }, sourceSize: { w: 88, h: 178 }, spriteSourceSize: { x: 16, y: 0, w: 72, h: 178 } },
      "portalshine_04_front_001.png": { rotated: true, frame: { x: 1, y: 1092, w: 40, h: 174 }, sourceSize: { w: 50, h: 174 }, spriteSourceSize: { x: 10, y: 0, w: 40, h: 174 } },
      "portalshine_05_front_001.png": { rotated: true, frame: { x: 176, y: 1069, w: 66, h: 148 }, sourceSize: { w: 66, h: 148 }, spriteSourceSize: { x: 0, y: 0, w: 66, h: 148 } }
    };
    return shineAtlasMeta[frameName] || null;
  }

  _getCorrectedPortalShineTextureKey(scene, frameName) {
    const data = this._getPortalShineAtlasFrameData(scene, frameName);
    if (!data) return null;

    const { atlasFrame, atlasTexture, frameData } = data;
    const customData = frameData.customData || {};
    const packedMeta = this._getPortalShinePackedFrameMeta(frameName) || {};
    const frameRect = this._readPortalShineFrameRect(frameData, packedMeta);
    const isRotated = !!(frameData.rotated || customData.rotated || packedMeta.rotated);
    const hasTrim = frameRect.sourceW !== frameRect.drawW || frameRect.sourceH !== frameRect.drawH || frameRect.drawX !== 0 || frameRect.drawY !== 0;

    if (!isRotated && !hasTrim) return null;

    const fixedKey = `__portal_shine_fixed_${String(atlasFrame.atlas)}_${String(frameName).replace(/[^a-zA-Z0-9_]/g, "_")}`;
    if (scene.textures.exists(fixedKey)) return fixedKey;

    const sourceImage =
      (typeof atlasTexture.getSourceImage === "function" ? atlasTexture.getSourceImage() : null) ||
      atlasTexture.source?.[0]?.image ||
      atlasTexture.source?.[0]?.source;
    if (!sourceImage) return null;

    const outW = Math.max(1, Math.ceil(frameRect.sourceW));
    const outH = Math.max(1, Math.ceil(frameRect.sourceH));
    const canvasTexture = scene.textures.createCanvas(fixedKey, outW, outH);
    if (!canvasTexture) return null;

    const canvas = canvasTexture.getCanvas();
    const ctx = canvas?.getContext?.("2d");
    if (!ctx || frameRect.frameW <= 0 || frameRect.frameH <= 0 || frameRect.drawW <= 0 || frameRect.drawH <= 0) {
      scene.textures.remove(fixedKey);
      return null;
    }

    ctx.clearRect(0, 0, outW, outH);
    if (isRotated) {
      const frameRectUsesRotatedSize =
        Math.abs(frameRect.frameW - frameRect.drawH) < 0.5 &&
        Math.abs(frameRect.frameH - frameRect.drawW) < 0.5;
      const packedW = frameRectUsesRotatedSize ? frameRect.frameW : frameRect.frameH;
      const packedH = frameRectUsesRotatedSize ? frameRect.frameH : frameRect.frameW;
      ctx.save();
      ctx.translate(frameRect.drawX + frameRect.drawW / 2, frameRect.drawY + frameRect.drawH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(
        sourceImage,
        frameRect.frameX,
        frameRect.frameY,
        packedW,
        packedH,
        -frameRect.drawH / 2,
        -frameRect.drawW / 2,
        frameRect.drawH,
        frameRect.drawW
      );
      ctx.restore();
    } else {
      ctx.drawImage(
        sourceImage,
        frameRect.frameX,
        frameRect.frameY,
        frameRect.frameW,
        frameRect.frameH,
        frameRect.drawX,
        frameRect.drawY,
        frameRect.drawW,
        frameRect.drawH
      );
    }

    canvasTexture.refresh();
    return fixedKey;
  }

  _createPortalShineSprite(scene, x, y, frameName, rotationDegrees = 0, flipX = false, flipY = false) {
    const correctedTextureKey = this._getCorrectedPortalShineTextureKey(scene, frameName);
    if (correctedTextureKey) {
      const correctedSprite = scene.add.image(x, y, correctedTextureKey).setAngle(rotationDegrees || 0);
      if (correctedSprite?.setFlipX) correctedSprite.setFlipX(!!flipX);
      if (correctedSprite?.setFlipY) correctedSprite.setFlipY(!!flipY);
      return correctedSprite;
    }

    let shineSprite = null;
    const data = this._getPortalShineAtlasFrameData(scene, frameName);
    if (data) {
      shineSprite = scene.add.image(x, y, data.atlasFrame.atlas, data.atlasFrame.frame);
    } else if (typeof addImageToScene === "function") {
      shineSprite = addImageToScene(scene, x, y, frameName);
    }

    if (!shineSprite) return null;

    const visualPropsObject = {
      rot: rotationDegrees || 0,
      flipX: !!flipX,
      flipY: !!flipY,
      scale: 1
    };

    if (this._gameLayer && typeof this._gameLayer._applyVisualProps === "function") {
      this._gameLayer._applyVisualProps(scene, shineSprite, frameName, visualPropsObject);
    } else {
      shineSprite.setAngle(rotationDegrees || 0);
    }

    return shineSprite;
  }

  _playPortalShine(_0x49e81f, type = 1) {
    const portalEvent = { portal_cube: 26, portal_fly: 27, portal_ball: 28, portal_ufo: 29,
      portal_wave: 30, portal_robot: 31, portal_spider: 32, portal_swing: 33 }[_0x49e81f?.type];
    if (portalEvent) this._gameLayer?.logicState?.event(portalEvent);
    if (portalEvent) this.p._modeChangeTime = (this._scene?._physicsFrame ?? 0) / 240;   // m_gameModeChangedTime
    // Mode portals rebuild updateDashArt even when the mode stays the same.
    // Its child RotateBy action restarts at zero (Orbit's cube portal in a dash).
    if (portalEvent && this.p.isDashing) {
      this._dashSpin = 0; this._dashSpinFirstTick = true; this._dashFireTime = 0;
    }
    if (_0x49e81f?.noEffects || _0x49e81f?._eeLevelObject?.noEffects) return;
    const _0x4ed8ff = this._scene;
    const portalX = Number(_0x49e81f.portalX);
    const portalY = Number(_0x49e81f.portalY);
    const _0xf31b0d = Number.isFinite(portalX) ? portalX : _0x49e81f.x;
    const _0x3824c0 = b(Number.isFinite(portalY) ? portalY : _0x49e81f.y);
    const shineFrames = this._getPortalShineFrames(_0x49e81f, type);
    const flipX = !!(_0x49e81f.flipX || _0x49e81f.portalFlipX);
    const flipY = !!(_0x49e81f.flipY || _0x49e81f.portalFlipY);

    for (const shineDef of shineFrames) {
      const pieceSize = this._createPortalShineSprite(_0x4ed8ff, _0xf31b0d, _0x3824c0, shineDef.frame, _0x49e81f.rotationDegrees, flipX, flipY);
      if (!pieceSize) {
        continue;
      }
      pieceSize.setBlendMode(S);
      pieceSize.setAlpha(0);
      shineDef.container.add(pieceSize);
      _0x4ed8ff.tweens.add({
        targets: pieceSize,
        alpha: {
          from: 0,
          to: 1
        },
        duration: 50,
        onComplete: () => {
          _0x4ed8ff.tweens.add({
            targets: pieceSize,
            alpha: 0,
            duration: 400,
            onComplete: () => pieceSize.destroy()
          });
        }
      });
    }
  }
  _resetSlopeState() {
    this._onSlopeAngle = this._activeSlopeObj = this._activeSlopeAngle = null;
    this._prevSlopeObj = this._prevSlopeAngle = this._slopeEntryX = null;
    this._lastSlopeSeatY = null;
    this._seatSlopeId = null;
    this._slopeSeatExtra = 0;
    this._groundLatched = false;
    this._rotationX = this._rotationY = undefined;
    this._slopeLaunch = this._slopeRate = 0;
    this._slopeSeatCeil = this._slopeClampA = this._slopeClampB = false;
    this._potentialSlope = null; this._potentialSlopeStale = false;
    this._slopeRiding = this._slopeSeatDownhill = this._skipSlopeExit = false;
    this._slopeContactFrames = 0;
    this._slopeContactTime = null;
    this._slopeStepSeconds = 1 / 240;
    this._slopeExitVel = null;
    this._c6Now = 0; this._prevC6 = 0; this._groundColliderId = null;
    this._groundObj = this._groundRamp = this._nextGround = null;
    this._onMovingGround = false;
    this._groundTouches = 0;
    this._groundUid = this._headUid = this._lastGroundUid = this._lastHeadUid = -1;
    this._swingPendingFlip = false;
  }
  captureSlopeState() {
    const fields = ['_onSlopeAngle', '_activeSlopeAngle', '_prevSlopeAngle', '_slopeEntryX',
      '_lastSlopeSeatY', '_slopeRiding', '_slopeSeatDownhill', '_skipSlopeExit',
      '_slopeContactFrames', '_slopeContactTime', '_slopeStepSeconds', '_slopeExitVel',
      '_lastCollisionWorldX', '_lastCollisionWorldY', '_prevC6', '_groundColliderId', '_onMovingGround', '_seatSlopeId', '_slopeSeatExtra', '_slopeLaunch', '_slopeRate', '_slopeSeatCeil', '_slopeClampA', '_slopeClampB', '_potentialSlopeStale', '_swingPendingFlip', '_multiContacts'];
    const state = Object.fromEntries(fields.map(key => [key, this[key]]));
    state.previousId = this._prevSlopeObj?._eeObjectId ?? null;
    state.activeId = this._activeSlopeObj?._eeObjectId ?? null;
    state.groundId = this._groundObj?._eeObjectId ?? null;
    state.rampId = this._groundRamp?._eeObjectId ?? null;
    return state;
  }
  restoreSlopeState(state) {
    this._resetSlopeState();
    if (!state) return;
    const { previousId, activeId, groundId, rampId, ...fields } = state;
    Object.assign(this, fields);
    const find = id => {
      if (id === null || id === undefined) return null;
      const collider = this._gameLayer.objects.find(obj => obj._eeObjectId === id);
      const gameplay = this._gameLayer.gameplayState;
      return collider && gameplay?.rotated ? gameplay.localCollider(collider) : (collider || null);
    };
    this._prevSlopeObj = find(previousId);
    this._activeSlopeObj = find(activeId);
    this._groundObj = find(groundId);
    this._groundRamp = find(rampId);
    if (this._slopeRiding && !this._prevSlopeObj) this._resetSlopeState();
  }
  _getSlopeHitSize(playerSize, waveHitSize) {
    return this.p.isWave ? waveHitSize : playerSize;
 }
  // collidedWithObject's walk over m_potentialSlopeMap (4f0356..4f0547): a
  // ramp near this block tells whether the block's faces lie under the ramp's
  // surface, where a body riding the ramp is not stopped by them.
  _potentialSlopeFaces(o, x, minX, maxX, minY, maxY, half) {
    const map = this._potentialSlopes;
    let touching = false, nearTop = false, nearBottom = false;
    if (!map.size) return { nearTop, nearBottom };
    const anywhere = !o || this._slopeContactThisTick || this._slopeRiding;
    const y = this.p.y, current = this._prevSlopeObj;
    for (const s of map) {
      if (!anywhere && s !== current && !(o.x > s.x - s.w / 2 && s.x + s.w / 2 > o.x)) continue;
      const hw = s.w * .6, hh = s.h * .55;
      if (!(s.x + hw >= minX && s.x - hw <= maxX && s.y + hh >= minY && s.y - hh <= maxY)) continue;
      if (!(s.x + hw >= x - half && s.x - hw <= x + half && s.y + hh >= y - half && s.y - hh <= y + half)) continue;
      touching = true;
      const ceiling = !s.slopeSolidBelow, surface = this._slopeSurface(s, s.slopeUphill === ceiling ? maxX : minX);
      if (surface === null) continue;
      if (surface + 4 >= maxY && (!ceiling || current === s)) nearTop = true;
      if (minY >= surface - 4 && (ceiling || current === s)) nearBottom = true;
      if (nearTop && nearBottom) break;
    }
    return { nearTop: touching && nearTop, nearBottom: touching && nearBottom };
  }
  // PlayerObject::collidedWithObject (Steam 4efd50), classic mode. The
  // tolerance widens the body's two faces towards its centre: 10 points on the
  // ground, 6 in flight, plus the ramp's extra radius and the speed of a face
  // moving up under it. A passable block has only the feet's face of a
  // non-flipped body. Returns 'ground', 'head', 'dead' or undefined.
  _collideSolid(o, x, minX, maxX, minY, maxY, motion, lastY, rectOnly = false) {
    const P = this.p, fm = this.flipMod(), flipped = P.gravityFlipped;
    const flight = P.isFlying || P.isUfo || P.isWave || P.isSwing;
    const half = P.isWave ? ((this._passMini ?? P.isMini) ? 6 : 10) : this._collisionHalfSize();
    const was = this._slopeRiding, passable = !rectOnly && !!o.passable;
    let tolerance = fm * (flight ? 12 : 20) + (was ? fm * (this._slopeSeatExtra || 0) : 0);
    let faceVelocity = 0, fast = false, toward = false, away = false;
    if (fm * motion.y > 0) {
      faceVelocity = motion.y / ((this._slopeStepSeconds ?? 1 / 240) * 60);
      fast = Math.abs(faceVelocity) > 10;
      tolerance += fm * Math.abs(faceVelocity);
      this._c6Now = faceVelocity;
      toward = true;
    } else if (fm * motion.y < 0) away = true;
    // collidedWithObject tests getObjectRect(.3, .3). Native telemetry:
    // a full wave's contact rect is 10x10 GD, its fatal inner rect 3x3.
    const innerHalf = P.isWave ? (P.isMini ? 1.8 : 3) : 9;
    const inner = () => x + innerHalf >= minX && x - innerHalf <= maxX && P.y + innerHalf >= minY && P.y - innerHalf <= maxY;
    if (P.isWave && !(P.stateDartSlide > 0)) return !passable && inner() ? this._solidDeath(rectOnly ? null : o, x, maxX, minY, maxY, half, false) : undefined;
    const y = P.y, dy = y - lastY;
    const feet = y - fm * half + tolerance, feetPrevious = feet - dy;
    const head = y + fm * half - tolerance, headPrevious = head - dy;
    const cubeLike = !flight && !P.isBall;
    const armed = P.stateHitHead > 0 || P.stateFlipGravity > 0;
    const headSide = flipped ? feet >= maxY || feetPrevious >= maxY : minY >= feet || minY >= feetPrevious;
    const hitGround = (noJump, noBurst) => this._hitGroundKeeping(noJump, noBurst);
    const supported = () => {
      if (rectOnly) return;
      this._groundObj = o;
      if (this._groundUid !== o._eeObjectId) { this._groundUid = o._eeObjectId; this._groundTouches++; }
    };
    const record = (face, onHead) => {
      if (onHead) P.collideTop = P.collideTop ? (flipped ? Math.max(P.collideTop, face) : Math.min(P.collideTop, face)) : face;
      else P.collideBottom = P.collideBottom ? (flipped ? Math.min(P.collideBottom, face) : Math.max(P.collideBottom, face)) : face;
    };
    // A Flip Gravity face turns the body round (4f1e30), -2 GD units after it.
    const flipState = () => {
      if (!(P.stateFlipGravity > 0)) return;
      this._groundLatched = false;
      this.flipGravity(!P.gravityFlipped, 1);
      P.yVelocity = P.gravityFlipped ? 4 : -4;
      P.wasBoosted = true;
      P.isJumping = false;
      if (P.stateNoAutoJump > 0) { P.onGround = false; P.canJump = false; P.queuedHold = false; P.upKeyPressed = false; P._orbActivationConsumedForPress = true; }
    };
    const land = (seat, face, noVelocity) => {
      P.y = seat;
      if (!rectOnly) this._checkSnapJump(o);
      if (noVelocity) P.yVelocity = 0;
      else hitGround(headSide, headSide || (flipped && flight));
      P.onCeiling = seat < face;
      record(face, headSide && !passable);
      if (!headSide) { supported(); this._c6Now = faceVelocity; }
      else if (!passable && !rectOnly) this._headUid = o._eeObjectId;
      if (flight && toward) {
        if (headSide) { P.yVelocity = gdQuantizeVelocity(this._c6Now); flipState(); }
      } else if (headSide) flipState();
      return headSide ? 'head' : 'ground';
    };
    const { nearTop, nearBottom } = this._potentialSlopeFaces(rectOnly ? null : o, x, minX, maxX, minY, maxY, half);
    const breakable = !rectOnly && parseInt(o.objid ?? 0, 10) === 143;
    const uid = rectOnly ? -1 : o._eeObjectId;
    const metLastTick = uid >= 0 && uid === (flipped ? this._lastGroundUid : this._lastHeadUid);
    const firstFace = !flipped || (!cubeLike && !passable);
    const secondFace = flipped || (!cubeLike && !passable);
    let deadly = true, second = true;
    if ((firstFace || armed) && ((flipped ? head : feet) >= maxY || (flipped ? headPrevious : feetPrevious) >= maxY)) {
      const vy = P.yVelocity;
      if (flipped && P.isUfo && breakable) {
        // A UFO's head breaks the block (4f073c..4f0778).
        if (inner()) { this.breakabletheblock(o); return undefined; }
        second = deadly = false;
      } else if ((vy > 0 && !was && !fast) || nearTop) {
        if (!flipped) {
          if (!headSide && toward) {
            P.y = maxY + half;
            hitGround(false, false);
            record(maxY, false);
            supported();
            this._c6Now = faceVelocity;
            P.yVelocity = gdQuantizeVelocity(Math.max(vy, faceVelocity));
            return 'ground';
          }
        } else if (headSide && away) {
          P.y = maxY + half;
          hitGround(true, true);
          record(maxY, true);
          if (!rectOnly) this._headUid = o._eeObjectId;
          P.yVelocity = gdQuantizeVelocity(Math.max(vy, this._c6Now + 2));
          flipState();
          return 'head';
        }
        second = deadly = false;
      } else return land(maxY + half, maxY, armed && !firstFace);
    }
    if (second && (secondFace || armed) && (minY >= (flipped ? feet : head) || minY >= (flipped ? feetPrevious : headPrevious) || metLastTick)) {
      const vy = P.yVelocity;
      if (!flipped && P.isUfo && breakable) {
        if (inner()) { this.breakabletheblock(o); return undefined; }
        deadly = false;
      } else if ((vy < 0 && !was && !fast) || nearBottom) {
        if (flipped) {
          if (!headSide && toward) {
            P.y = minY - half;
            hitGround(false, false);
            record(minY, false);
            supported();
            this._c6Now = faceVelocity;
            P.yVelocity = gdQuantizeVelocity(Math.min(vy, faceVelocity));
            return 'ground';
          }
        } else if (headSide && away) {
          P.y = minY - half;
          hitGround(true, true);
          record(minY, true);
          if (!rectOnly) this._headUid = o._eeObjectId;
          P.yVelocity = gdQuantizeVelocity(Math.min(vy, this._c6Now - 2));
          flipState();
          return 'head';
        }
        deadly = false;
      } else return land(minY - half, minY, armed && !secondFace);
    }
    return deadly && !passable && inner() ? this._solidDeath(rectOnly ? null : o, x, maxX, minY, maxY, half, headSide) : undefined;
  }
  // The 0.3 scaled body inside a solid (4f184f). A flip within 0.1 s puts a
  // head-side contact back outside, and a spider just teleported spares the
  // block's far edge for 0.04 s, instead of killing.
  // hitGround (4fa250) takes the ground only below 5 GD units of launch;
  // hitGroundNoJump keeps the ground state as it was.
  _hitGroundKeeping(noJump, noBurst) {
    const P = this.p, launched = this.flipMod() * P.yVelocity > 10, ground = P.onGround, canJump = P.canJump, queued = P.queuedHold, latched = this._groundLatched;
    this.hitGround(noBurst);
    if (noJump || launched) { P.onGround = ground; P.canJump = canJump; }
    if (noJump) P.queuedHold = queued;
    this._groundLatched = noJump ? latched : launched;
  }
  _solidDeath(o, x, maxX, minY, maxY, half, headSide) {
    const P = this.p, now = (this._scene?._physicsFrame ?? 0) / 240;
    if (headSide && now - (P._lastFlipTime ?? -Infinity) < 0.1) {
      P.y = P.gravityFlipped ? maxY + half : minY - half;
      const ground = P.onGround, canJump = P.canJump;
      this.hitGround(true);
      P.onGround = ground; P.canJump = canJump;
      return 'head';
    }
    if (P.isSpider && x + 9 > maxX && now - (P._lastSpiderTeleportTime ?? -Infinity) < 0.04) return undefined;
    if (this.breakabletheblock(o)) return undefined;
    if (this._noclipEnabled()) { P.diedThisFrame = true; return undefined; }
    this.killPlayer();
    return 'dead';
  }
  // slopeYPos (29e2b0): a hazard ramp's surface lies 4 points inside it.
  _slopeSurface(o, x) {
    const y = o.getSlopeSurfaceY(x, true);
    return y === null || !o.slopeIsHazard ? y : y + (o.slopeSolidBelow ? 8 : -8);
  }
  // PlayerObject::preSlopeCollision (4ed660). A ramp's flat wall and flat edge
  // are one-point solids. A body past neither is remembered for the blocks
  // around the ramp (m_potentialSlopeMap) until it sits on one.
  _preSlopeCollision(o, x, half) {
    if (o._eeObjectId !== undefined && o._eeObjectId === this._seatSlopeId) return false;
    const P = this.p, motion = this._colliderStepMotion(o), lastY = P.lastY, y0 = P.y;
    const minX = o.x - o.w / 2, maxX = o.x + o.w / 2, minY = o.y - o.h / 2, maxY = o.y + o.h / 2;
    const touches = (a, b, c, e) => x + half >= a && x - half <= b && y0 + half >= c && y0 - half <= e;
    let hit = false, inset = 0;
    if (o.gdWallOnLeft) {
      if (minX > x) {
        hit = true;
        if (touches(minX, minX + 2, minY, maxY) && this._collideSolid(o, x, minX, minX + 2, minY, maxY, motion, lastY, true) === 'dead') return 'dead';
      }
    } else if (motion.x > playerSpeed * (this._slopeStepSeconds ?? 1 / 240) * 60 * d && x > maxX) {
      hit = true; inset = 2;
      if (touches(maxX - 2, maxX, minY + 2, maxY - 2) && this._collideSolid(o, x, maxX - 2, maxX, minY + 2, maxY - 2, motion, lastY, true) === 'dead') return 'dead';
    }
    const ceiling = !o.slopeSolidBelow, flatLow = ceiling ? maxY - 2 : minY;
    if (ceiling ? P.y >= maxY : flatLow + 2 >= P.y) {
      hit = true;
      if (touches(minX + inset, maxX - inset, flatLow, flatLow + 2) && this._collideSolid(o, x, minX + inset, maxX - inset, flatLow, flatLow + 2, motion, lastY, true) === 'dead') return 'dead';
    } else if (!hit) {
      this._potentialSlopeStale = false;
      if (!this._slopeContactThisTick) {
        this._potentialSlopes.add(o);
        // 4ed9e4..4edab4: the rightmost of rising floors, else the leftmost.
        const held = this._potentialSlope, rising = s => s.slopeUphill && s.slopeSolidBelow;
        if (!held || (rising(held) ? o.x > held.x : !rising(o) && held.x > o.x)) this._potentialSlope = o;
      }
    }
    return hit || !touches(minX, maxX, minY, maxY);
  }
  // PlayerObject::collidedWithSlopeInternal (4edb90), classic mode. Every game
  // mode runs this one routine and writes the seat at once.
  _collidedWithSlope(o, x, half, force = false) {
    const P = this.p, flipped = P.gravityFlipped, fm = this.flipMod(), f = Math.fround;
    if (!force) {
      const skip = this._preSlopeCollision(o, x, half);
      if (skip) return skip === 'dead' ? 'dead' : undefined;
    }
    const y = P.y, motion = this._colliderStepMotion(o), dt = force ? 0 : (this._slopeStepSeconds ?? 1 / 240) * 60;
    const minX = o.x - o.w / 2, maxX = o.x + o.w / 2, minY = o.y - o.h / 2, maxY = o.y + o.h / 2;
    const ceil = !o.slopeSolidBelow, speed = playerSpeed * d;
    const was = this._slopeRiding, is = this._slopeContactThisTick, hold = P.upKeyDown;
    let downhill = !o.slopeUphill, outran = false, outranBack = false;
    if (motion.x > speed * dt) { outran = true; outranBack = flipped ? !downhill : downhill; downhill = !downhill; }
    if (flipped) downhill = !downhill;
    const launching = was && fm * (this._slopeLaunch || 0) > 0;
    if (launching && downhill && this._slopeSeatCeil === ceil && ceil === flipped) return undefined;
    // Native floats in GD units; the web keeps twice those.
    const rateGd = f(f(o.h / 2) / f(f(o.w / 2) / (speed / 2)));
    if (launching && (this._slopeRate || 0) > rateGd * 2) return undefined;
    const movingDown = fm * motion.y < 0;
    let allowance = downhill ? (was ? 8 : 2) : 0;
    if (force || movingDown) allowance += Math.min(Math.abs(motion.y), 10 * dt);
    const previousRadius = half / Math.cos(this._prevSlopeAngle || 0);
    const threshold = y - fm * (previousRadius + allowance);
    if (was) {
      if (flipped ? minY > threshold : threshold > maxY) return undefined;
    } else if (!(x + half >= minX && x - half <= maxX && y + half >= minY + 2 && y - half <= maxY - 2)) return undefined;
    const angle = f(Math.atan(f(f(o.h / 2) / f(o.w / 2)))), radius = half / Math.cos(angle);
    const changedFace = was && o._eeObjectId !== this._seatSlopeId && this._slopeSeatCeil !== ceil;
    const scalar = changedFace ? (P.isMini ? 24 : 40) : 0;
    const surface = this._slopeSurface(o, x);
    if (surface === null) return undefined;
    let seat, clampA, clampB = false;
    if (!ceil) {
      const top = half + maxY - scalar, line = surface + radius - scalar;
      clampA = line >= top;
      seat = clampA ? top : line;
      if (minY >= seat) { clampB = true; seat = minY; }
    } else {
      const low = minY - half + scalar, line = surface - radius + scalar;
      clampA = low >= line;
      seat = clampA ? low : line;
      if (seat >= maxY) { clampB = true; seat = maxY; }
    }
    // Native seats are floats: a dart sliding along the line never gets past it.
    seat = (f(seat / 2 + 90) - 90) * 2;
    const ship = P.isFlying && !P.isSwing, flier = P.isFlying || P.isUfo || P.isWave || P.isSwing;
    const past = fm * (y - seat);
    let hit, head = false, skipGround = false, thrustLift = false, headLimit = false;
    if (flipped === ceil) {
      let hover;
      if (!changedFace && downhill && !is) hover = ship ? !hold : P.wasBoosted ? P.isUfo || P.isWave || P.isSwing : true;
      else hover = !downhill && (force || movingDown);
      hit = past < 0 || (hover && past < allowance && (!P.isUfo || fm * P.yVelocity <= 0));
      skipGround = thrustLift = hold && flier && !downhill;
    } else {
      head = true;
      const margin = downhill ? 0 : flier && hold ? (was ? 4 : 2) : allowance;
      hit = past > 0 || (!changedFace && !(flier && downhill) && !is && past > -margin);
      skipGround = !hold && (flier || P.isBall) && downhill && was;
      headLimit = !hold && flier && downhill;
      if (hit && !flier && !P.isBall && !(P.stateHitHead > 0)) {
        // A ground mode's head: a flip or mode change within 0.1 s pushes it
        // out; otherwise past 2 points kills, and less only takes the ground.
        const now = (this._scene?._physicsFrame ?? 0) / 240;
        if (now - (P._modeChangeTime ?? -Infinity) < 0.1 || now - (P._lastFlipTime ?? -Infinity) < 0.1) {
          P.y = seat;
          P.yVelocity = gdQuantizeVelocity(fm > 0 ? Math.min(P.yVelocity, -4) : Math.max(P.yVelocity, 4));
        } else if (past > 4) {
          if (this._noclipEnabled()) { P.diedThisFrame = true; return undefined; }
          this.killPlayer();
          return 'dead';
        }
        P.onGround = false; P.canJump = false;
        this._groundLatched = false;
        return undefined;
      }
    }
    if (hit && (o.slopeIsHazard || ((changedFace || (P.isWave && !(P.stateDartSlide > 0))) && !(P.stateHitHead > 0)))) {
      if (this._noclipEnabled()) { P.diedThisFrame = true; return undefined; }
      this.killPlayer();
      return 'dead';
    }
    if (was) {
      if (seat === this._lastSlopeSeatY) hit = false;
      else if (motion.y !== 0 && ((clampA && this._slopeClampA) || (clampB && this._slopeClampB)) && !P.isDashing) hit = false;
    }
    if (downhill && P.isWave && hold && ceil === flipped) return undefined;
    if (!hit) return undefined;

    this._prevSlopeObj = o;
    this._potentialSlope = o;
    this._potentialSlopes.add(o);
    this._slopeSeatExtra = radius - half;
    this._slopeSeatCeil = ceil;
    this._lastSlopeSeatY = seat;
    this._seatSlopeId = o._eeObjectId;
    this._slopeSeatDownhill = downhill;
    this._slopeClampA = clampA;
    this._slopeClampB = clampB;
    const previousAngle = this._prevSlopeAngle;
    const sign = (downhill ? fm : -fm) * (outran ? -1 : 1);
    this._prevSlopeAngle = f(f(sign * f(angle * f(57.29578))) * f(0.01745329252));
    P.y = seat;
    this._slopeContactThisTick = true;
    if (!skipGround) {
      const vy = P.yVelocity;
      if (head) {
        P.yVelocity = gdQuantizeVelocity(fm > 0 ? Math.min(vy, 0) : Math.max(vy, 0));
        P.onGround = false; P.canJump = false;
        this._groundLatched = false;
      } else {
        this._hitGroundKeeping(false, false);
        if (fm * vy > 10) P.yVelocity = gdQuantizeVelocity(vy);
        // 4eec65..4eec93: the seat of a ramp moving up (for a flipped body the
        // native code reads X here) is its c6.
        if (dt > 0 && (flipped ? motion.x < 0 : motion.y > 0)) this._c6Now = (flipped ? motion.x : motion.y) / dt;
      }
    }
    if (headLimit && fm * P.yVelocity > -4) P.yVelocity = -4 * fm;
    if (thrustLift && fm * P.yVelocity < 4) P.yVelocity = 4 * fm;
    this._slopeRate = rateGd * 2;
    let launch = f(f(Math.min(f(1.1), f(f(0.8) / angle))) * f(rateGd * f(1.4)));
    if (downhill && !outranBack) launch = -launch;
    launch = f(fm * launch);
    if (flier || P.isBall) launch = f(launch * f(0.75));
    this._slopeLaunch = launch * 2;
    if (P.isBall) {
      // A ball rolls faster along a steeper seat (4eee70..4eeec8).
      if (previousAngle !== this._prevSlopeAngle) {
        const secant = 1 / Math.cos(this._prevSlopeAngle);
        this.stopRotation();
        this._runBallRotation(secant > 2 ? (secant - 1) * 0.7 + 1 : secant);
      }
    } else if (!P.isUfo && !P.isWave) this._turnTo(dt, this._closestRotation(this._prevSlopeAngle), false);
    return 'seat';
  }
  _slopeLaunchVelocity(includeRamp = true) {
    // The first contact has elapsed time zero; include the exit tick.
    const held = (this._slopeContactTime ?? (this._slopeContactFrames || 0) / 240) + (this._slopeStepSeconds ?? 1 / 240);
    const rampTime = window.slopeRampTime ?? 0.1;
    const ramp = held < rampTime ? Math.max(held / rampTime, window.slopeRampFloor ?? 0.4) : 1;
    return (this._slopeLaunch || 0) * (includeRamp ? ramp : 1);
  }
  // postCollision (4eba67..4ebe99), the tick a ride ends. A floor rising or a
  // ceiling falling under the body launches it (boostPlayer) when the ramp's
  // speed beats its own, scaled by how long the ride lasted. A ramp that falls
  // away under a released, unboosted body takes it down at the ramp's rate.
  _applySlopeExitVelocity() {
    if (this._slopeExitVel === null || this._skipSlopeExit) return;
    const P = this.p, flipped = P.gravityFlipped, vy = P.yVelocity;
    const ceiling = this._slopeSeatCeil;
    const launch = this._slopeLaunchVelocity(false);
    const boosted = P.wasBoosted || P.isJumping;
    const cubeLike = !P.isFlying && !P.isUfo && !P.isWave && !P.isSwing && !P.isBall;
    if (((launch < 0 && vy > launch && ceiling) || (launch > 0 && launch > vy && !ceiling)) && !(boosted && cubeLike)) {
      const speed = this._slopeLaunchVelocity();
      const away = flipped ? !ceiling && this._slopeSeatDownhill : ceiling && this._slopeSeatDownhill;
      if (flipped ? (away ? speed > vy : vy > speed) : (away ? vy > speed : speed > vy)) this._boostPlayer(speed);
      return;
    }
    if ((flipped ? launch > 0 : launch < 0) && !boosted && !P.upKeyDown && !P.queuedHold && ceiling === flipped) {
      P.yVelocity = gdQuantizeVelocity(-this.flipMod() * this._slopeRate);
      this._groundLatched = false;
      P.onGround = false;
      P.canJump = false;
      if (!P.isDashing) { this.stopRotation(); this.runRotateAction(); }
    }
  }
  // PlayerObject::boostPlayer (4fe2f0): the cube turns back at half speed.
  _boostPlayer(velocity) {
    const P = this.p;
    P.yVelocity = gdQuantizeVelocity(velocity);
    P.boostLatch = true;
    P.wasBoosted = true;
    this._groundLatched = false;
    P.onGround = false;
    P.canJump = false;
    P.isJumping = false;
    if (P.isDashing || P.isFlying || P.isUfo || P.isWave || P.isSwing || P.isBall || P.isRobot || P.isSpider) return;
    this.rotateActionActive = true;
    this.rotateActionRate = -this.flipMod() * (P.isGoingLeft ? -1 : 1) * Math.PI / (P.isMini ? Math.fround(2 / 3) : Math.fround(13 / 15));
  }
  // PlayerObject::checkSnapJumpToObject (Steam 4f1eb0), called for solid
  // landings. A landing one jump away from the previous solid keeps the body's
  // offset on the block. The expected distances follow the speed (m_playerSpeed
  // 0.7, 0.9, 1.1, 1.3); the tolerance and the largest correction are 1 point,
  // 2 from double speed up to triple.
  _checkSnapJump(landed) {
    // Only the cube (4f05c4..4f05f7).
    if (this.p.isFlying || this.p.isUfo || this.p.isWave || this.p.isSwing || this.p.isBall || this.p.isRobot || this.p.isSpider) return;
    const previous = this._lastLandObject;
    if (previous && previous !== landed && previous.type === solidType) {
      let a = 240, b = 300, c = 180, tolerance = 2;
      if (playerSpeed === SpeedPortal.HALF) { a = 180; b = 240; c = 120; }
      else if (playerSpeed === SpeedPortal.TWO_TIMES) { a = 300; b = 390; c = 240; tolerance = 4; }
      else if (playerSpeed === SpeedPortal.THREE_TIMES) { a = 360; b = 450; c = 270; tolerance = 4; }
      if (this.p.isMini && playerSpeed !== SpeedPortal.FOUR_TIMES) a = 180;
      const fm = this.flipMod();
      const at = (dx, dy) => Math.abs(landed.x - (previous.x + dx)) <= tolerance && Math.abs(landed.y - (previous.y + dy * fm)) <= tolerance;
      if (at(a, 60) || at(b, -60) || at(c, 120)) {
        const target = landed.x + this._lastXOffset, x = this._worldX();
        this._setWorldX(Math.abs(target - x) <= tolerance ? target : target > x ? x + tolerance : x - tolerance);
      }
    }
    this._lastLandObject = landed;
    this._lastXOffset = this._worldX() - landed.x;
  }
  _isFallingPastThreshold() {
    if (this.p.gravityFlipped) {
      return this.p.yVelocity > 0.5;
    } else {
      return this.p.yVelocity < -0.5;
    }
  }
  flipMod() {
    if (this.p.gravityFlipped) {
      return -1;
    } else {
      return 1;
    }
  }
  flipGravity(flipped, _0x11bbde = 0.5) {
      if (this.p.gravityFlipped === flipped) {
        return;
      }
      this.p.gravityFlipped = flipped;
      this.p._lastFlipTime = (this._scene?._physicsFrame ?? 0) / 240;   // m_lastFlipTime
      // 4f84c6..4f84ff: the crush faces are forgotten, and the ramp under the
      // body runs the other way in its new frame.
      this.p.collideTop = 0;
      this.p.collideBottom = 0;
      this._forgetContacts();
      if (this._slopeRiding || this._slopeContactThisTick) this._slopeSeatDownhill = !this._slopeSeatDownhill;
      this._gameLayer?.logicState?.event(flipped ? "gravityInverted" : "gravityRestored");
      this.p.yVelocity *= _0x11bbde;
      this.p.onGround = false;
      this.p.canJump = false;
      if (this.p.isBall) this._runBallRotationBack();
  }
  _resetTeleportTrails() {
    // teleportPlayer -> resetStreak (31635b -> 4e9840) clears both paths
    // after placing the player, retaining their emission state. Even a
    // short, repeated teleport must not join its departure to its exit.
    this._streak?.reset();
    this._waveTrail?.reset();
  }
  applyTeleportForce(raw, degrees) {
    // teleportPlayer / redirectPlayerForce: strengths are GD units, unscaled
    // by mode or mini size. Classic mode has no independent horizontal vy.
    const f = Math.fround, value = (key, fallback = 0) => {
      const n = Number(raw[key]); return Number.isFinite(n) ? n : fallback;
    };
    const angle = f(f(degrees) * f(Math.PI / 180));
    const x = f(Math.cos(angle)), y = f(Math.sin(angle));
    const frame = this._gameLayer?.gameplayState;
    const v = frame?.rotated ? frame.v : { x: 0, y: 1 };
    const vertical = f(x * v.x + y * v.y);
    if (value(347) === 1) {
      let magnitude = f(Math.abs(f(this.p.yVelocity / 2)) * f(value(350, 1)));
      const length = Math.abs(magnitude), min = f(value(348)), max = f(value(349));
      if (max > 0 && length > max) magnitude = f(magnitude * f(max / length));
      else if (min > 0 && length < min) magnitude = length ? f(magnitude * f(min / length)) : min;
      this.p.yVelocity = f(vertical * magnitude) * 2;
      this.p.boostLatch = true;
    } else if (value(345) === 1) {
      const strength = f(value(346)), additive = value(443) === 1;
      if (strength === 0 && !additive) {
        this.p.yVelocity = 0; this.p.boostLatch = false;
      } else {
        const length = f(Math.sqrt(f(f(x * x) + f(y * y))));
        if (!(length > 0)) return;
        const force = f(vertical * f(strength / length)) * 2;
        this.p.yVelocity = additive ? force + this.p.yVelocity : force;
        this.p.boostLatch = true;
      }
    }
    if (value(345) === 1 || value(347) === 1) this.p.jumpTrailActive = true;
  }
  // runBallRotation (4eb600): 120 degrees per 0.2 s, scaled by size and speed.
  _ballRollTime() {
    const speed = playerSpeed === SpeedPortal.HALF ? 1.24056 : playerSpeed === SpeedPortal.TWO_TIMES ? 0.804243
      : playerSpeed === SpeedPortal.THREE_TIMES ? 0.665769 : playerSpeed === SpeedPortal.FOUR_TIMES ? 0.540937 : 1;
    return (this.p.isMini ? 0.8 : 1) * speed;
  }
  _runBallRotation(rate = 1) {
    if (this.p.isDashing) return;
    this.rotateActionActive = true;
    this._ballReversed = false;
    this._ballRateScaled = rate !== 1;
    this.rotateActionRate = this.flipMod() * (this.p.isGoingLeft ? -1 : 1) * (2 / 3 * Math.PI) / (0.2 * this._ballRollTime()) * rate;
  }
  // runBallRotation2 (4eb730): a flip or a ring rolls it back until it lands.
  _runBallRotationBack() {
    if (this.p.isDashing) return;
    this.rotateActionActive = true;
    this._ballReversed = true;
    this._ballRateScaled = false;
    this.rotateActionRate = -this.flipMod() * (this.p.isGoingLeft ? -1 : 1) * this._gm() * (17 / 9 * Math.PI) / (0.8 * this._ballRollTime());
  }
  runRotateAction() {
    if (this.p.isBall) return this._runBallRotation();
    // runRotateAction(false, ...) at 4eb4de..4eb520 excludes vehicle,
    // robot and spider modes. A pad/orb must not start the cube's half-turn
    // on them; their own art update supplies the flight/surface angle.
    if (this.p.isFlying || this.p.isUfo || this.p.isWave || this.p.isSwing || this.p.isRobot || this.p.isSpider || this.p.isDashing) return;
    this.rotateActionActive = true;
    // Native 4eb5aa applies reverseMod when a new turn starts. Reversing
    // mid-turn retains the existing rate until the next pad, jump or landing.
    this.rotateActionRate = this.flipMod() * (this.p.isGoingLeft ? -1 : 1) * this._gm() * Math.PI / (this.p.isMini ? Math.fround(1 / 3) : Math.fround(13 / 30));
  }
  // PlayerObject::updateDashArt: the whole player is turned to the dash
  // line, and for the cube and ball the icon sprites additionally run
  // CCRepeatForever(CCRotateBy(0.3, 288 * dir * m_gravityMod)) at scale 0.9.
  _dashSpinsIcon() {
    return !this.p.isFlying && !this.p.isUfo && !this.p.isWave && !this.p.isSwing && !this.p.isRobot && !this.p.isSpider;
  }
  updateDashRotation(dt) {
    this._rotation = -Math.atan(this.p.dashSlope);
    if (this._dashSpinsIcon()) {
      const dir = this.p.gravityFlipped ? -1 : 1;
      const gravityMod = Number.isFinite(this.p.gravityMod) ? this.p.gravityMod : 1;
      // The native RotateBy action consumes its first positive tick at t=0.
      // Counting that tick added four degrees to the angle left by a dash.
      if (dt > 0 && this._dashSpinFirstTick) this._dashSpinFirstTick = false;
      else this._dashSpin = (this._dashSpin || 0) + (288 / 0.3) * (Math.PI / 180) * dir * gravityMod * dt;
    } else {
      this._dashSpin = 0;
    }
  }
  _startDash(gameObj) {
    // PlayerObject::startDashing (supplied Steam exe, RVA 0x4f3b20):
    // fold the ring angle into the forward half plane, clamp to +/-70,
    // then retain sin(angle)/abs(cos(angle)) as the non-platformer dash line.
    const f = Math.fround;
    let angle = f(-(gameObj.orbRotation || 0)) % 360;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    if (Math.abs(angle) > 90) angle = (angle > 0 ? 180 : -180) - angle;
    angle = Math.max(-70, Math.min(70, angle));
    const radians = f(f(angle) * f(Math.PI / 180));
    this.p.dashSlope = f(f(Math.sin(radians)) / Math.abs(f(Math.cos(radians))));
    this.p.isDashing = true;
    this.p.dashXVelocity = 0;
    this.p.dashYVelocity = 0;
    this.p.yVelocity = 0;
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    this.rotateActionActive = false;
    this._dashSpin = 0;
    this._dashFireTime = 0;
    this._dashSpinFirstTick = true;
    this.updateDashRotation(0);
  }
  _stopDash(consumeHold = false) {
    const wasDashing = this.p.isDashing;
    // stopDashing: the icon's spun angle becomes the player's rotation.
    if (this.p.isDashing && this._dashSpinsIcon()) this._rotation = this._dashSpin || 0;
    this._dashSpin = 0;
    this.p.isDashing = false;
    this.p.dashSlope = 0;
    this.p.dashXVelocity = 0;
    this.p.dashYVelocity = 0;
    this.p.yVelocity = 0;
    // stopDashing 4f4e6e..4f4ea5 restarts the ball's forward roll. Leaving
    // its action stopped also changes contact with oblique portal boxes.
    if (wasDashing && this.p.isBall) this._runBallRotation();
    if (consumeHold) {
      this.p._holdDead = true;
      this.p.upKeyDown = false;
      // The S block clears only m_isHolding (31ce25..31ce2a). Its pass's
      // buffered ring press survives and can activate a ring beside it.
      this.p.upKeyPressed = false;
      this.p._orbActivationConsumedForPress = true;
    }
  }
  _updateCollisionModifiers(objects, x, y, size) {
    for (const key of ["stateHitHead", "stateFlipGravity", "stateNoAutoJump", "stateDartSlide"])
      this.p[key] = Math.max(0, (this.p[key] || 0) - 1);
    this._applyCollisionModifiers(objects, x, y, size);
  }
  _applyCollisionModifiers(objects, x, y, size) {
    for (const obj of objects) {
      if (obj?.type !== "collision_modifier" || obj._eeDisabled || obj.noTouch) continue;
      const motion = this._colliderStepMotion(obj);
      const previousX = obj.x - motion.x, previousY = obj.y - motion.y;
      if (x + size <= Math.min(obj.x, previousX) - obj.w / 2 || x - size >= Math.max(obj.x, previousX) + obj.w / 2 ||
          y + size <= Math.min(obj.y, previousY) - obj.h / 2 || y - size >= Math.max(obj.y, previousY) + obj.h / 2) continue;
      if (obj.shape && !obj.shapeOverlapsRect(x, y, size, size)) continue;
      switch (obj.modifierId) {
        case 1755: this.p.stateDartSlide = 2; break;
        case 1813: this.p.stateNoAutoJump = 2; break;
        case 1859: this.p.stateHitHead = 2; break;
        case 2866: this.p.stateFlipGravity = 2; break;
        case 1829: if (this.p.isDashing) this._stopDash(true); break;
      }
    }
  }
  _updateForceContacts(objects, x, y, size) {
    const f = Math.fround, seen = new Set();
    let fx = 0, fy = 0;
    for (const o of objects) {
      if (o?.type !== 'force_field' || o._eeDisabled || o.noTouch) continue;
      const angle = -(o.rotationDegrees || 0) * Math.PI / 180;
      const hw = o.shape ? o.w / 2 : Math.abs(Math.cos(angle)) * o.w / 2 + Math.abs(Math.sin(angle)) * o.h / 2;
      const hh = o.shape ? o.h / 2 : Math.abs(Math.sin(angle)) * o.w / 2 + Math.abs(Math.cos(angle)) * o.h / 2;
      const dx = x - o.x, dy = y - o.y;
      if (o.hitbox_radius > 0) {
        if (dx * dx + dy * dy > (o.hitbox_radius + size) ** 2) continue;
      } else if (Math.abs(dx) > hw + size || Math.abs(dy) > hh + size ||
          (o.shape && !o.shapeOverlapsRect(x, y, size, size)) ||
          (!o.shape && Math.abs((o.rotationDegrees || 0) % 90) > 1e-6 &&
            !this._rotatedRectanglesOverlap(o.x,o.y,o.w/2,o.h/2,-(o.rotationDegrees||0),x,y,size,size,-this._rotation*180/Math.PI))) continue;
      if (o.forceId > 0 && seen.has(o.forceId)) continue;
      if (o.forceId > 0) seen.add(o.forceId);
      const raw = o._eeLevelObject?._raw || {}, flipped = !!o._eeLevelObject?.flipY;
      // calculateForceToTarget (662b00): directional or radial force,
      // optionally interpolated from min to max across its radius/diameter.
      let ux, uy, amount = f(Number(raw[149]) || 0);
      if (raw[528] === '1') {
        const distance = Math.hypot(dx,dy), sign = flipped ? -1 : 1;
        ux = distance ? dx / distance * sign : sign; uy = distance ? dy / distance * sign : 0;
      } else {
        const rot = Number.isFinite(o.forceRotationDegrees) ? o.forceRotationDegrees : (o.rotationDegrees || 0)+(o._forceRotationOffset||0);
        const a = (90 - rot + (flipped ? 180 : 0)) * Math.PI / 180;
        ux = Math.cos(a); uy = Math.sin(a);
      }
      if (raw[529] === '1') {
        const radius = o.hitbox_radius > 0 ? o.hitbox_radius : Math.max(hw,hh);
        const t = raw[528] === '1' ? Math.max(0,1-Math.hypot(dx,dy)/radius)
          : Math.max(0,Math.min(1,((dx*ux+dy*uy)/radius+1)/2));
        amount = f(f(Number(raw[526]) || 0) + f(f((Number(raw[527]) || 0)-(Number(raw[526]) || 0))*f(t)));
      }
      fx = f(fx + f(ux * amount)); fy = f(fy + f(uy * amount));
      const length = Math.hypot(fx,fy);
      if (length > 9999) { fx=f(fx*9999/length);fy=f(fy*9999/length); }
    }
    this.p.forceX=fx; this.p.forceY=fy;
  }
  applyObjectForces(dt) {
    this.p.yVelocity=gdQuantizeVelocity(this.p.yVelocity);
    if (this.p.isDashing || this.p.isWave || !(this.p.forceY || this.p.forceX)) return;
    // PlayerObject::update applies the previous collision pass's force
    // AFTER updateJump and its terminal cap. It ignores gravityMod/speed.
    const mini=this.p.isMini;
    const scale=this.p.isSwing ? (mini?Math.fround(0.6153846383):Math.fround(.4))
      : this.p.isFlying ? (mini?Math.fround(.5875):Math.fround(.47))
      : this.p.isUfo ? (mini?Math.fround(.725):Math.fround(.58))
      : this.p.isBall||this.p.isSpider ? Math.fround(.6) : this.p.isRobot ? Math.fround(.9) : 1;
    const push=Math.fround(Math.fround(Math.fround(dt)*this.p.forceY)*scale)*2;
    this.p.yVelocity=gdQuantizeVelocity(this.p.yVelocity+push);
    // The continuous force is not an orb/pad boost. In particular it must
    // not switch a rising ship from its released 1.2 gravity to boost's 0.8.
    if (push) this.p.forceBoostLatch=true;
  }
  // GJBaseGameLayer::update (340da8..340dfd): a frame forgets its supports.
  beginFrameContacts() {
    this._groundTouches = 0;
    this._lastGroundUid = this._groundUid;
    this._lastHeadUid = this._headUid;
    this._groundUid = this._headUid = -1;
  }
  // flipGravity (4f850c..4f854f), the spider's jump and a rotated gameplay
  // forget them at once, last frame's too.
  _forgetContacts() {
    this._groundTouches = 0;
    this._groundUid = this._headUid = this._lastGroundUid = this._lastHeadUid = -1;
  }
  // setGroundObject (4f21f0): a ramp under the body counts as a contact.
  _rampSupports(ramp) {
    this._groundRamp = ramp;
    if (this._groundUid !== ramp._eeObjectId) { this._groundUid = ramp._eeObjectId; this._groundTouches++; }
  }
  // PlayerObject::postCollision (4ecab9..4ecea1): a support sinking away from
  // the body stays under it while it is within a tick's stick (5, Extra Sticky
  // 20 GD units per 60th). It is met again last, with dt 0, so after a head
  // face of the same tick.
  _followMovingGround(x, half, lastY) {
    const P = this.p, flipped = P.gravityFlipped, none = this._stationaryColliderMotion ||= { x: 0, y: 0 };
    const sinking = o => {
      const y = this._colliderStepMotion(o).y;
      return flipped ? y > 0 : y < 0;
    };
    const ground = this._groundObj, ramp = this._groundRamp;
    const away = !!ground && !ramp && !ground.nonStickY && sinking(ground);
    let seated = false;
    if (!this._groundTouches || away) {
      this._onMovingGround = false;
      this._groundObj = null;
      if (away) {
        const reach = (ground.extraSticky ? 20 : 5) * ((this._slopeStepSeconds ?? 1 / 240) * 60) * 2;
        const rect = o => {
          const a = Math.fround(o.rotationDegrees || 0), quarter = Math.abs(Math.abs(a) - 180) === 90;
          const w = (quarter ? o.h : o.w) / 2, h = (quarter ? o.w : o.h) / 2;
          return { minX: o.x - w, maxX: o.x + w, minY: o.y - h, maxY: o.y + h };
        };
        const b = rect(ground);
        const close = reach > (flipped ? b.minY - (P.y + half) : (P.y - half) - b.maxY);
        const low = b.minY - (flipped ? reach : 0), high = b.maxY + (flipped ? 0 : reach);
        let hit = x + half >= b.minX && x - half <= b.maxX && P.y + half >= low && P.y - half <= high, target = ground;
        if (!hit && this._nextGround) { hit = true; target = this._nextGround; }
        if (close && hit) {
          this._onMovingGround = true;
          const t = target === ground ? b : rect(target);
          const flippedBefore = flipped;
          const result = this._collideSolid(target, x, t.minX, t.maxX, t.minY, t.maxY, none, lastY);
          if (result === 'dead') { this._nextGround = null; return false; }
          if (result === 'ground') { seated = true; this._groundColliderId = target._eeObjectId; }
          if (P.gravityFlipped !== flippedBefore) seated = true;
        }
      }
    }
    const rampAway = !!ramp && !ramp.nonStickY && sinking(ramp);
    if (!this._groundTouches || rampAway) {
      this._onMovingGround = false;
      this._groundRamp = null;
      if (rampAway) {
        this._onMovingGround = true;
        const result = this._collidedWithSlope(ramp, x, half, true);
        if (result === 'dead') { this._nextGround = null; return false; }
        if (result === 'seat') {
          this._rampSupports(ramp);
          seated = true;
          this._onSlopeAngle = this._activeSlopeAngle = this._prevSlopeAngle;
          this._activeSlopeObj = ramp;
        }
      }
    }
    this._nextGround = null;
    return seated;
  }
  // PlayerObject::postCollision (Steam 0x38eb5c): when contact with a face
  // that rose faster than 5 GD units ends or slows by more than 0.5, the body
  // leaves with last tick's c6 (clamped to 20) if that is faster than its own
  // vy -- a fast lift throws the player. Mirrored under flipped gravity.
  _launchFromMovingFace() {
    const prev = this._prevC6 || 0, c6 = this._c6Now || 0;
    if (prev !== 0 && Math.abs(prev - c6) > 1) {
      let v = null;
      if (!this.p.gravityFlipped && prev > 10 && prev > c6) {
        const p = Math.min(prev, 40);
        if (p >= this.p.yVelocity) v = p;
      } else if (this.p.gravityFlipped && prev < -10 && prev < c6) {
        const p = Math.max(prev, -40);
        if (p <= this.p.yVelocity) v = p;
      }
      if (v !== null) this._boostPlayer(v);
    }
    this._prevC6 = Math.max(-64, Math.min(64, c6));
    this._c6Now = 0;
  }
  _colliderStepMotion(obj) {
    const scene = this._scene;
    return scene?._fixedTickActive && obj._gdMotionFrame === scene._physicsFrame - 1
      ? { x: obj.x - obj._gdPreviousX, y: obj.y - obj._gdPreviousY }
      : (this._stationaryColliderMotion ||= { x: 0, y: 0 });
  }
  _hitArmedCeiling(y, motion = null) {
    const vyBefore = this.p.yVelocity, flip = this.p.gravityFlipped;
    this.p.y = y;
    // A face moving onto a falling head pushes it away at least 1 GD unit,
    // as for the UFO (native WHAT X51.9: a descending ceiling, -0.216 -> -1).
    this.p.yVelocity = motion && (flip ? motion.y > 0 && vyBefore > 0 : motion.y < 0 && vyBefore < 0) ? (flip ? Math.max(vyBefore, 2) : Math.min(vyBefore, -2)) : 0;
    this.p.onGround = false;
    this.p.canJump = false;
    this.p.isJumping = false;
    if (this.p.stateFlipGravity > 0) {
      const oldFlip = this.flipMod();
      this.flipGravity(!this.p.gravityFlipped, 1);
      // Native collidedWithObjectInternal sets -2 GD units after the flip.
      this.p.yVelocity = -4 * oldFlip;
      if (this.p.stateNoAutoJump > 0) {
        this.p.queuedHold = false;
        this.p.upKeyPressed = false;
        this.p._orbActivationConsumedForPress = true;
      }
    }
  }
  stopRotation() {
    this.rotateActionActive = false;
  }
  updateRotateAction(dt) {
    if (this.rotateActionActive) this._rotation += this.rotateActionRate * dt;
  }
  // PlayerObject::updateRotation(dt) (4ef390), once per frame.
  updateCubeRotation(delta) {
    const P = this.p;
    if (P.isDashing) return this._noteRotationPosition();
    if (P.isBall) { this.updateRotateAction(delta / 60); return this._noteRotationPosition(); }
    const flight = P.isFlying || P.isUfo || P.isWave || P.isSwing;
    const grounded = P.onGround || this._groundLatched;
    if (this._onSlopeAngle !== null) this._turnTo(delta, this._closestRotation(this._onSlopeAngle), false);
    else if (flight) {
      this.updateShipRotation(delta);
      return this._noteRotationPosition();
    } else if (grounded && !this._slopeWasRiding && !(this.flipMod() * P.yVelocity < -0.5)) {
      this.stopRotation();
      this.updateGroundRotation(delta);
    } else if ((P.isRobot || P.isSpider) && !this._slopeWasRiding) this._turnTo(delta * 0.5, 0, false);
    this.updateRotateAction(delta / 60);
    this._noteRotationPosition();
  }
  // GJBaseGameLayer::update (3413bd): the position the next frame's flier
  // rotation measures from.
  _noteRotationPosition() {
    this._rotationX = this._worldX();
    this._rotationY = this.p.y;
  }
  convertToClosestRotation() {
    let _0x5f531c = Math.PI / 2;
    return Math.round(this._rotation / _0x5f531c) * _0x5f531c;
  }
  slerp2D(startAngle, endAngle, t) {
    let halfStart = startAngle * 0.5;
    let halfEnd = endAngle * 0.5;
    let cosStart = Math.cos(halfStart);
    let sinStart = Math.sin(halfStart);
    let cosEnd = Math.cos(halfEnd);
    let sinEnd = Math.sin(halfEnd);
    let dot = (cosStart * cosEnd) + (sinStart * sinEnd);
    let weightStart, weightEnd;
    if (dot < 0.0) {
        dot = -dot;
        sinEnd = -sinEnd;
        cosEnd = -cosEnd;
    }
    if (1.0 - dot > 0.0001) {
        let theta = Math.acos(dot);
        let sinTheta = Math.sin(theta);
        weightStart = Math.sin(theta * (1.0 - t)) / sinTheta;
        weightEnd = Math.sin(theta * t) / sinTheta;
    } else {
        weightStart = 1.0 - t;
        weightEnd = t;
    }
    let interpSin = (sinStart * weightStart) + (sinEnd * weightEnd);
    let interpCos = (cosStart * weightStart) + (cosEnd * weightEnd);
    let out = Math.atan2(interpSin, interpCos);
    return out + out;
  }
  // PlayerObject::updateRotation(dt, rotation) (4ef5b0): flat ground turns the
  // body three times as fast as a ramp.
  _turnTo(delta, target, flat) {
    const P = this.p;
    // m_playerSpeed (9fc) is 0.7, 0.9, 1.1, 1.3 or 1.6 by speed portal.
    const speed = playerSpeed === SpeedPortal.HALF ? 0.7 : playerSpeed === SpeedPortal.TWO_TIMES ? 1.1
      : playerSpeed === SpeedPortal.THREE_TIMES ? 1.3 : playerSpeed === SpeedPortal.FOUR_TIMES ? 1.6 : 0.9;
    let rate = Math.fround(0.175) * Math.fround(speed);
    if (P.isFlying && !P.isSwing) rate *= 0.5;
    else if (flat && !P.isUfo && !P.isWave && !P.isSwing && !P.isBall && (P.onGround || this._groundLatched)) rate *= 3;
    this._rotation = this.slerp2D(this._rotation, target, Math.min(delta, rate * delta));
  }
  // convertToClosestRotation (4eb3b0): the cube reaches an angle by the nearest
  // quarter turn; every other body takes the angle as it is.
  _closestRotation(angle) {
    const P = this.p;
    if (P.isFlying || P.isUfo || P.isWave || P.isSwing || P.isRobot || P.isSpider || P.isDashing) return angle;
    // In float degrees as native: 45 degrees ties and takes the first found.
    const fl = Math.fround, current = fl(Math.trunc(this._rotation * 180 / Math.PI) % 360);
    let last = fl(angle * 180 / Math.PI), previous = last;
    if (last > current) while (last > current) { previous = last; last = fl(last - 90); }
    else while (current > last) { previous = last; last = fl(last + 90); }
    return (Math.abs(fl(current - previous)) > Math.abs(fl(current - last)) ? last : previous) * Math.PI / 180;
  }
  updateGroundRotation(delta) {
    if (this.p.isBall || this.p.isWave) return;
    this._turnTo(delta, this._closestRotation(0), true);
  }
  // PlayerObject::updateShipRotation (4eefa0): towards the direction moved
  // since the last frame, a UFO only a little and the other way.
  updateShipRotation(delta) {
    if (this._onSlopeAngle !== null) return;
    const P = this.p, rotated = this._gameLayer.gameplayState?.rotated;
    const dx = rotated ? delta * playerSpeed * d : this._worldX() - (this._rotationX ?? this._worldX() - delta * playerSpeed * d);
    const dy = rotated ? -P.yVelocity * delta * d : -(P.y - (this._rotationY ?? P.lastY));
    if (dx * dx + dy * dy >= delta * 4.8) {
      let target = Math.atan2(dy, dx), turn = 0.15;
      if (P.isUfo) {
        target *= -0.4;
        target = P.gravityFlipped ? Math.min(0.1, target) : Math.max(-0.1, target);
        turn = 0.07;
      } else if (P.isWave) turn = P.isMini ? 0.4 : 0.25;
      if (this._onMovingGround) { target = 0; turn *= 0.25; }
      this._rotation = this.slerp2D(this._rotation, target, Math.min(delta, turn * delta));
    }
  }
  breakabletheblock(gameObj) {
    if (!gameObj) return false;
    if (parseInt(gameObj.objid ?? 0, 10) !== 143) return false;
    const linkedObjectId = Number.isInteger(gameObj._eeObjectId) ? gameObj._eeObjectId : null;
    if (linkedObjectId === null) return false;
    this._gameLayer?.gdRenderer?.breakBlock(this._gameLayer.gdObjects?.[linkedObjectId]);
    return this._gameLayer?._breakblock?.(linkedObjectId) ?? false;
  }

  // playerIsFalling (4f86d0): below twice the gravity in GD units, and the web
  // keeps twice those, without mirroring the threshold's sign when flipped.
  // playerIsFalling (4f86d0): Fix Gravity Bug (kA32), a swing and a turned
  // gameplay mirror the test. Otherwise it keeps its old lean, and dual turns
  // the upright side round.
  playerIsFalling() {
    return this._nativeFlightFalling();
  }
    _applySlopeJumpBoost() {
    if (window.slopeJumpBoost === false) return;
    // updateJump (4e9f91): a remembered slope velocity is eligible only
    // while touching a ramp or on the first tick after leaving it. Native
    // keeps the velocity after some flat landings, with both flags clear.
    if (!this._slopeRiding && !this._slopeContactThisTick) return;
    if (this._slopeExitVel === null || this._slopeExitVel === undefined) return;
    const base = this.p.yVelocity;
    if (!base) return;
    const dir = base >= 0 ? 1 : -1;
    const contact = Math.fround(this._slopeLaunchVelocity(!this.p.isBall) / 2) * 2;
    if (contact * dir <= 0) return;
    const cap = Math.fround(base / 2 * 1.4) * 2;
    let v = gdQuantizeVelocity(base + Math.fround(contact / 2 * 0.25) * 2);
    if (dir > 0) { if (v > cap) v = cap; }
    else { if (v < cap) v = cap; }
    this.p.yVelocity = gdQuantizeVelocity(v);
  }
    _gravBaseForSpeed() {
    if (window.speedGravity === false) return p;
    return this._gdSpeedPhys().gravity;
  }
  // PlayerObject::updateTimeMod: m_yStart and m_gravity per speed (web units
  // are twice GD's). Rings scale with m_yStart, pads do not.
  // m_gravityMod (Gravity trigger): GD scales every mode's gravity by it.
  _gm() {
    const mod = this.p.gravityMod;
    return Number.isFinite(mod) ? mod : 1;
  }
  _gdSpeedPhys() {
    const sp = typeof playerSpeed === 'number' ? playerSpeed : 11.540004;
    if (typeof SpeedPortal === 'undefined') return { jump: 22.3600636, gravity: p };
    if (sp <= (SpeedPortal.HALF + SpeedPortal.ONE_TIMES) / 2) return { jump: 21.240064, gravity: 1.880398 };
    if (sp <= (SpeedPortal.ONE_TIMES + SpeedPortal.TWO_TIMES) / 2) return { jump: 22.3600636, gravity: 1.916398048 };
    if (sp <= (SpeedPortal.TWO_TIMES + SpeedPortal.THREE_TIMES) / 2) return { jump: 22.840064, gravity: 1.914398 };
    return { jump: 22.460064, gravity: 1.922398 };
  }
  updateJump(_0x3d1c6f) {
    this._slopeStepSeconds = _0x3d1c6f / 54;
    if (!this.p.upKeyDown && !this._scene?.input?.activePointer?.isDown && !this._scene?._spaceWasDown) this.p._holdDead = false;
    if (this.p.pendingVelocity !== null) {
      this.p.yVelocity = this.p.pendingVelocity;
      this.p.pendingVelocity = null;
    }
    if (this.p.isDashing) {
      if (!this.p.upKeyDown) {
        this._stopDash();
      } else {
        // updateJump's swing and UFO branches still take a buffered press
        // while dashing (Steam 4eab87, 4ea995): the swing flips at once.
        if (this.p.upKeyPressed && this.p.queuedHold && (this.p.isSwing || this.p.isUfo)) {
          if (this.p.isSwing) {
            this.flipGravity(!this.p.gravityFlipped, 0.8);
            this._gameLayer?.logicState?.event("swingSwitch");
          }
          this.p.upKeyPressed = false;
          this.p.queuedHold = false;
        }
        this.p.yVelocity = 0;
        return;
      }
    }
    if (this.p.isSwing) {
      this._updateSwingJump(_0x3d1c6f);
    } else if (this.p.isFlying) {
      this._updateFlyJump(_0x3d1c6f);
    } else if (this.p.isWave) {
      this._updateWaveJump(_0x3d1c6f);
    } else if (this.p.isBall) {
      this._updateBallJump(_0x3d1c6f);
    } else if (this.p.isUfo) {
      this._updateUfoJump(_0x3d1c6f);
    } else if (this.p.isSpider) {
      this._updateSpiderJump(_0x3d1c6f);
    } else if (this.p.isRobot) {
      this._updateRobotJump(_0x3d1c6f);
    } else if (this.p.upKeyDown && this.p.canJump && !this._shouldPrioritizeGroundOrbInput()) {
      this.p.isJumping = true;
      this.p.onGround = false;
      this.p.canJump = false;
      this.p.upKeyPressed = false;
      this.p.queuedHold = false;
      this.p.yVelocity = this.flipMod() * this._groundJumpSpeed();
      this._applySlopeJumpBoost();
      this.p.jumpTrailActive = true;
      this.p.wasBoosted = true;
      this._groundLatched = false;
      this.runRotateAction();
      this._gameLayer?.logicState?.event("normalJump");
    } else if (this.p.isJumping) {
      // updateJump: the mini size scales the jump (0.8), never the gravity.
      this.p.yVelocity -= this._gdSpeedPhys().gravity * _0x3d1c6f * this.flipMod() * this._gm();
      if (this.playerIsFalling()) {
        this.p.isJumping = false;
        this.p.onGround = false;
      }
    } else {
      if (this.playerIsFalling()) {
        this.p.canJump = false;
      }
      this.p.yVelocity -= this._gdSpeedPhys().gravity * _0x3d1c6f * this.flipMod() * this._gm();
      if (this.p.gravityFlipped) {
        this.p.yVelocity = Math.min(this.p.yVelocity, 30);
      } else {
        this.p.yVelocity = Math.max(this.p.yVelocity, -30);
      }
      if (this._isFallingPastThreshold() && !this.rotateActionActive) {
        this.runRotateAction();
      }
      if (this.playerIsFalling()) {
        let _0x47ed2a;
        _0x47ed2a = this.p.gravityFlipped ? this.p.yVelocity > p * 2 : this.p.yVelocity < -(p * 2);
        if (_0x47ed2a) {
          this.p.onGround = false;
        }
      }
    }
  }
  // PlayerObject::pushButton (Steam 4f62d9..4f634e) hands a press to the
  // rings the last collision touched and then skips its immediate
  // updateJump(0); the tick's own updateJump just reads the press flags.
  _pressGoesToTouchedRings() {
    return !!this._touchedRings?.length && !this.p.isDead;
  }
  _shouldPrioritizeGroundOrbInput() {
    return false;
  }
  _collisionHalfSize() {
    // toggleSpiderMode (Steam 4f9e08..4f9e1e) sets the native body to
    // 27x27 points; other full ground modes use 30x30. The rect then uses
    // the saved player scale (4fee1e), including the float mini scale 0.6.
    // Web coordinates are doubled, so this native width is our half-size.
    return Math.fround((this.p.isSpider ? 27 : 30) * ((this._passMini ?? this.p.isMini) ? Math.fround(0.6) : 1));
  }
  _shouldPrioritizeUfoOrbInput() {
    return false;
  }
  _isTouchingAvailableOrbForInput(requireUnconsumedPress = true) {
    if (requireUnconsumedPress && this.p._orbActivationConsumedForPress) return false;

    const playerWorldX = this._worldX() ?? centerX;
    const playerSize = this._collisionHalfSize();
    const nearbyObjects = this._gameLayer?.getNearbySectionObjects?.(playerWorldX) || [];

    for (const gameObj of nearbyObjects) {
      if (!gameObj || gameObj.type !== jumpRingType || gameObj._eeDisabled || gameObj.noTouch || this._isObjectActivated(gameObj)) continue;

      const hasCircleHitbox = gameObj.hitbox_radius !== undefined && gameObj.hitbox_radius !== null;
      if (hasCircleHitbox) {
        const dx = playerWorldX - gameObj.x;
        const dy = this.p.y - gameObj.y;
        const hitRadius = gameObj.hitbox_radius + playerSize;
        if ((dx * dx + dy * dy) <= hitRadius * hitRadius) {
          return true;
        }
        continue;
      }

      const rad = (gameObj.rotationDegrees || 0) * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const halfW = gameObj.w / 2;
      const halfH = gameObj.h / 2;
      const rotatedHalfWidth = gameObj.shape ? halfW : Math.abs(halfW * cos) + Math.abs(halfH * sin);
      const rotatedHalfHeight = gameObj.shape ? halfH : Math.abs(halfW * sin) + Math.abs(halfH * cos);
      const left = gameObj.x - rotatedHalfWidth;
      const right = gameObj.x + rotatedHalfWidth;
      const top = gameObj.y - rotatedHalfHeight;
      const bottom = gameObj.y + rotatedHalfHeight;

      if (!(playerWorldX + playerSize <= left) && !(playerWorldX - playerSize >= right) &&
          !(this.p.y + playerSize <= top) && !(this.p.y - playerSize >= bottom)) {
        if (gameObj.shape && !gameObj.shapeOverlapsRect(playerWorldX, this.p.y, playerSize, playerSize)) continue;
        return true;
      }
    }

    return false;
  }
  // updateJump's flying branch clears the velocity-limit exemption first, on
  // the incoming vy: inside (-6.4, 8) GD units / (mini ? 0.85 : 1)
  _clearBoostLatch() {
    const chi = this.p.isMini ? 0.85 : 1, v = this.p.yVelocity * this.flipMod();
    if (v > -12.8 / chi && v < 16 / chi) {
      this.p.boostLatch = false;
      this.p.forceBoostLatch = false;
    }
  }
  _nativeFlightFalling() {
    // playerIsFalling (Steam 4f86d0): Fix Gravity Bug (kA32),
    // sideways/platformer and swing use a symmetric inverted threshold.
    // In dual (aa1, set on both players) the legacy test reverses the upright side.
    const threshold = this._gdSpeedPhys().gravity * 2;
    const fixed = String(window.settingsMap?.kA32 ?? "0") === "1" || this.p.isSwing ||
      this._gameLayer?.gameplayState?.rotated || String(window.settingsMap?.kA22 ?? "0") === "1";
    if (this.p.gravityFlipped) return this.p.yVelocity > (fixed ? -threshold : threshold);
    const secondary = !!this._scene?._isDual;
    return this.p.yVelocity < (!fixed && secondary ? -threshold : threshold);
  }
  _updateFlyJump(_0x130c46) {
    this._clearBoostLatch();
    const _shipMiniScale = this.p.isMini ? 1.176470588 : 1;
    const latch = !!this.p.boostLatch;
    const isFalling = this._nativeFlightFalling();
    // updateJump (4ea843..4ea8bc): a boost against gravity uses -1.
    // Releasing while rising selects 1.2 even when boosted; the released
    // branch calls playerIsFalling after the boost branch.
    let _0x203040 = 0.8;
    if (this.p.upKeyDown) _0x203040 = latch && this.p.yVelocity * this.flipMod() >= 0 ? 0.8 : -1;
    else {
      if (latch && this.p.yVelocity * this.flipMod() < 0) _0x203040 = -1;
      if (!isFalling) _0x203040 = 1.2;
    }
    let _0x2d237f = isFalling ? 0.5 : 0.4;
    let gravityMod = this._gm();
    if (latch) { if (_0x203040 < 0) gravityMod = 1; }
    else if (this.p.upKeyDown) gravityMod = 1;
    else _0x2d237f = 0.4;
    // The native rate is 0.4 on release, including boosted flight.
    if (!this.p.upKeyDown) _0x2d237f = .4;
    this.p.yVelocity -= Math.fround(.9581990242004395)*2 * _0x130c46 * this.flipMod() * gravityMod * _0x203040 * _0x2d237f * _shipMiniScale;
    if (this.p.upKeyDown) {
      this.p.onGround = false;
    }
    if (!latch && !this.p.forceBoostLatch && !this.p._slopeBounceActive) {
      if (this.p.gravityFlipped) {
        this.p.yVelocity = Math.max(this.p.yVelocity, -16 * _shipMiniScale);
        this.p.yVelocity = Math.min(this.p.yVelocity, 12.8 * _shipMiniScale);
      } else {
        this.p.yVelocity = Math.max(this.p.yVelocity, -12.8 * _shipMiniScale);
        this.p.yVelocity = Math.min(this.p.yVelocity, 16 * _shipMiniScale);
      }
    }
    if (this.p._slopeBounceActive && (isFalling || this.p.onGround)) {
      this.p._slopeBounceActive = false;
    }
  }
  _updateSwingJump(dt) {
    // updateJump (Steam 4eab87..4eabd8): a buffered press flips the swing in
    // the update that follows it, damping vy by 0.8 before this tick's new
    // gravity (native orb matrix, 2026-10-27: row of the press tick).
    this._clearBoostLatch();
    this._swingPendingFlip = false;
    if (this.p.upKeyPressed) {
      this.flipGravity(!this.p.gravityFlipped, 0.8);
      this._gameLayer?.logicState?.event("swingSwitch");
      this.p.onGround = false; this.p.onCeiling = false; this.p.canJump = false;
      this.p.upKeyPressed = false; this.p.queuedHold = false;
    }
    this.p.yVelocity -= p * (this.p.isMini ? 0.6 : 0.4) * dt * this.flipMod() * this._gm();
    if (!this.p.boostLatch && !this.p.forceBoostLatch) this.p.yVelocity = Math.max(-16, Math.min(16, this.p.yVelocity));
  }
  _updateBallJump(_0x2fe319) {
      const _0x144266 = p * 0.6;
      let prioritizeOrb = this._shouldPrioritizeGroundOrbInput();

      if (!prioritizeOrb && this.p.upKeyPressed && this.p.canJump) {
        const _0x47d739 = this.flipMod();
        // updateJump's ball flip clears the held flag (Steam 4ea11c).
        this._consumeHeldButton();
        this.p.yVelocity = _0x47d739 * this._groundJumpSpeed();
        this._applySlopeJumpBoost();
        this.flipGravity(!this.p.gravityFlipped);
        this._gameLayer?.logicState?.event("ballSwitch");
        this.p.onGround = false;
        this.p.canJump = false;
        this.p.yVelocity *= 0.6;
         this._skipSlopeExit = true;
        return;
      }
      
      if (this.playerIsFalling()) {
        this.p.canJump = false;
      }
      this.p.yVelocity -= _0x144266 * _0x2fe319 * this.flipMod() * this._gm();
      if (this.p.gravityFlipped) {
        this.p.yVelocity = Math.min(this.p.yVelocity, 30);
      } else {
        this.p.yVelocity = Math.max(this.p.yVelocity, -30);
      }
      if (this.playerIsFalling()) {
        const _0x1439be = this.p.gravityFlipped ? this.p.yVelocity > p * 2 : this.p.yVelocity < -(p * 2);
        if (_0x1439be) {
          this.p.onGround = false;
        }
      }
    }
  _updateWaveJump(dt) {
      // GD's dart moves exactly one x step per y step (two when mini):
      // 45 / 63.4 degrees at every speed.
      const _waveVel = playerSpeed * d * (this.p.isMini ? 2 : 1) * (this._gameLayer.gameplayState?.speedScale ?? 1);
      const isPushingUp = this.p.upKeyDown; 
      let _0x312a7f = (isPushingUp ? 1 : -1) * this.flipMod() * _waveVel;

      if (this.p.onGround || this.p.onCeiling) {
          const movingAwayFromCeiling = this.p.onCeiling && _0x312a7f < 0;
          const movingAwayFromFloor = !this.p.onCeiling && this.p.onGround && _0x312a7f > 0;

          // Native keeps the dart's speed into a surface too and lets the
          // collision pass seat it again: at a face's end the dart leaves on
          // that same tick (MK2 X9028.2: native y +1.046, a held vy 0 lagged).
          if (movingAwayFromCeiling || movingAwayFromFloor) {
              this.p.onGround = false;
              this.p.onCeiling = false;
          }
      }

      this.p.yVelocity = _0x312a7f;
      this.p.canJump = false;
      this.p.isJumping = false;

  }
  _updateRobotJump(dt) {
    // PlayerObject::updateJump, robot arm: the jump is m_yStart * 0.5 (0.8
    // more when mini), gravity is m_gravity * 0.9, and while the press that
    // jumped is still held the gravity is added back (a hover, vy constant)
    // until m_accelerationOrSpeed, grown by dt / 10 per tick, reaches 1.5.
    // A release ends the hover for this jump. Pads give no hover.
    const phys = this._gdSpeedPhys();
    const gravityStep = phys.gravity * 0.9 * dt;

    if (this.p.upKeyPressed && this.p.canJump && !this._shouldPrioritizeGroundOrbInput()) {
      this.p.upKeyPressed = false;
      this.p.isJumping = true;
      this.p.onGround = false;
      this.p.canJump = false;
      this.p.queuedHold = false;
      this.p.yVelocity = this.flipMod() * this._groundJumpSpeed();
      this._applySlopeJumpBoost();
      this.p._robotHold = true;
      this.p._robotPadBoost = false;
      this.p.wasBoosted = true;
      this._groundLatched = false;
      this.p._robotHoverBudget = 0;
      this._robotJumpFlameActive = true;
      this._robotJumpFlamePulse = 0;
      this._robotJumpFlameFadeInTimer = 0;
      this._gameLayer?.logicState?.event("robotBoostStart");
      return;
    }

    if (this.p.isJumping) {
      if (this.p._robotHold && !this.p.upKeyDown) this.p._robotHold = false;
      if (this.p._robotHold && (this.p._robotHoverBudget || 0) < 1.5) {
        this.p._robotHoverBudget = (this.p._robotHoverBudget || 0) + Math.fround(dt * Math.fround(0.1));
      } else {
        this.p.yVelocity -= gravityStep * this.flipMod() * this._gm();
      }
      if (this.playerIsFalling()) {
        this.p.isJumping = false;
        this.p._robotHold = false;
        this._robotJumpFlameActive = false;
      }
    } else {
      this.p.yVelocity -= gravityStep * this.flipMod() * this._gm();
      if (this.p.gravityFlipped) {
        this.p.yVelocity = Math.min(this.p.yVelocity, 30);
      } else {
        this.p.yVelocity = Math.max(this.p.yVelocity, -30);
      }
    }

    if (this.playerIsFalling()) {
      this.p.canJump = false;
      this._robotJumpFlameActive = false;
    }
  }
  _updateUfoJump(_dt) {
    this._clearBoostLatch();
    // Native press velocity after this tick's gravity integration.
    const _ufoJump = this.p.isMini ? 13.296 : 13.742;
    const _ufoMini = window.ufoMiniDiv !== undefined ? window.ufoMiniDiv : 0.85;
    const _ufoFastBase = window.ufoFastGrav !== undefined ? window.ufoFastGrav : 0.6;
    const _ufoSlowBase = window.ufoSlowGrav !== undefined ? window.ufoSlowGrav : 0.4;
    const _ufoFastGrav = this.p.isMini ? _ufoFastBase / _ufoMini : _ufoFastBase;
    const _ufoSlowGrav = this.p.isMini ? _ufoSlowBase / _ufoMini : _ufoSlowBase;
    const _ufoGrav = this._nativeFlightFalling() ? _ufoSlowGrav : _ufoFastGrav;
    // updateJump (4eab3e..4eab82): fixed flight gravity, x0.5 and
    // x1.2 while rising fast / x0.8 otherwise, with the mini divisor.
    this.p.yVelocity -= Math.fround(.9581990242004395)*2 * _ufoGrav * _dt * this.flipMod() * this._gm();
    if (this.p.upKeyPressed) {
      const prioritizeOrb = this._shouldPrioritizeUfoOrbInput();
      this.p.upKeyPressed = false;
      if (prioritizeOrb) {
        this.p.queuedHold = false;
      } else {
        this.p.yVelocity = _ufoJump * this.flipMod();
        this._gameLayer?.logicState?.event("ufoJump");
        this.p.onGround = false;
        this.p.canJump = false;
        this.p.isJumping = true;
        try {
          if (!window.enableLDM) {
            this._flyParticle2Emitter.explode(6, this._worldX(), b(this.p.y) + (this.p.gravityFlipped ? -18 : 18));
          }
        } catch(e) {}
      }
    }
    if (!this.p.boostLatch && !this.p.forceBoostLatch) {
      const _ufoMaxUp = this.p.isMini ? 18.824 : 16;
      const _ufoMaxFall = this.p.isMini ? 15.058 : 12.8;
      if (this.p.gravityFlipped) {
        this.p.yVelocity = Math.max(this.p.yVelocity, -_ufoMaxUp);
        this.p.yVelocity = Math.min(this.p.yVelocity, _ufoMaxFall);
      } else {
        this.p.yVelocity = Math.max(this.p.yVelocity, -_ufoMaxFall);
        this.p.yVelocity = Math.min(this.p.yVelocity, _ufoMaxUp);
      }
    }
    if (this.p.upKeyDown) {
      this.p.onGround = false;
    }
    if (this.p.isJumping && this.playerIsFalling()) {
      this.p.isJumping = false;
    }
  }
  _getSpiderSearchBounds(obj) {
    if (obj.shape || obj.type === slopeType) return { left: obj.x - obj.w / 2, right: obj.x + obj.w / 2, lower: obj.y - obj.h / 2, upper: obj.y + obj.h / 2 };
    const radius = Number(obj?.hitbox_radius);
    if (Number.isFinite(radius) && radius > 0) {
      return {
        left: obj.x - radius,
        right: obj.x + radius,
        lower: obj.y - radius,
        upper: obj.y + radius
      };
    }

    const rad = (obj.rotationDegrees || 0) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const halfW = obj.w / 2;
    const halfH = obj.h / 2;
    const rotatedHalfWidth = Math.abs(halfW * cos) + Math.abs(halfH * sin);
    const rotatedHalfHeight = Math.abs(halfW * sin) + Math.abs(halfH * cos);
    return {
      left: obj.x - rotatedHalfWidth,
      right: obj.x + rotatedHalfWidth,
      lower: obj.y - rotatedHalfHeight,
      upper: obj.y + rotatedHalfHeight
    };
  }

  // getMinPortalY / getMaxPortalY (Steam 31a980 / 31aa60) as the spider
  // search sees them: the band while its ground is shown, else the visible
  // screen, max(ground, camera bottom) to + screen height / zoom. Cube and
  // robot (a spider orb), Free Mode and sideways gameplay search +-3000
  // around the player instead (spiderTestJumpInternal 4f267d..4f27ca).
  _spiderTeleportBand() {
    const gl = this._gameLayer, p = this.p;
    if (gl.cameraState?.freeMode || Math.abs(gl.gameplayState?.u.y || 0) > 0.5 ||
        (!p.isFlying && !p.isUfo && !p.isWave && !p.isSwing && !p.isBall && !p.isSpider))
      return { floor: this._scene?._localPhysicsActive ? p.y - 6000 : Math.max(0, p.y - 6000), ceil: p.y + 6000 };
    const ceil = gl.getCeilingY();
    if (ceil !== null && Number.isFinite(ceil)) {
      const floor = gl.getFloorY();
      return { floor: Number.isFinite(floor) ? floor : 0, ceil };
    }
    const L = gl._gdGroundLayout?.();
    if (L) {
      const floor = Math.max(0, L.camBottom);
      return { floor, ceil: floor + L.H / L.zoom };
    }
    return { floor: 0, ceil: p.y + 6000 };
  }

  // PlayerObject::spiderTestJumpInternal (Steam 0x4f25f0), web units (2x GD),
  // y up; the rules gdsolver measured against the game (spiderTargetGd):
  // solids from a strip from the centre to half + 1 ahead, hazards from a
  // +-4 strip (x0.6 mini), both reaching from 2 inside the leading face to
  // the band; the nearest landing up to 10 behind the player wins, and one
  // wholly ahead of the centre only if the player's box there clears the
  // other candidates (each shrunk 2 top and bottom). A nearer hazard is
  // landed on (and kills); nothing found lands on the band's face.
  _spiderTeleportTarget(goingUp, x, half) {
    const gs = goingUp ? 1 : -1, fromY = this.p.y;
    const band = this._spiderTeleportBand();
    const s0 = x, s1 = x + half + 2, w0 = x - half, w1 = x + half + 8;
    const hazStrip = this.p.isMini ? 4.8 : 8;
    const strip = [], wide = [];
    let haz = null;
    const objects = this._gameLayer.getSpiderSearchObjects
      ? this._gameLayer.getSpiderSearchObjects(x, fromY, goingUp ? band.ceil : band.floor, half + 8)
      : this._gameLayer.getNearbySectionObjects(x);
    for (const obj of objects) {
      if (!obj || obj._eeDisabled || obj.noTouch) continue;
      const isHazard = obj.type === hazardType || obj.type === "hazard";
      const isSolid = obj.type === solidType || obj.type === "solid" || obj.type === slopeType;
      if (!isHazard && (!isSolid || obj.passable)) continue;
      const bounds = this._getSpiderSearchBounds(obj);
      if (goingUp ? bounds.upper < fromY + half - 4 : bounds.lower > fromY - half + 4) continue;
      if (goingUp ? bounds.lower > band.ceil : bounds.upper < band.floor) continue;
      if (isHazard) {
        if (bounds.right < x - hazStrip || bounds.left > x + hazStrip) continue;
        const cy = (bounds.lower + bounds.upper) / 2;
        if (!haz || (cy - haz.cy) * gs < 0) haz = { obj, bounds, cy };
        continue;
      }
      let face = goingUp ? bounds.lower : bounds.upper;
      // a ramp whose diagonal faces the search is met on its line; a ramp
      // later in the contact pass then seats the body (native MK2 X16547)
      if (obj.type === slopeType && !!obj.slopeSolidBelow === !goingUp && obj.hypoBx !== obj.hypoAx) {
        const ax = obj.x + obj.hypoAx, ay = obj.y + obj.hypoAy;
        face = ay + (obj.y + obj.hypoBy - ay) * (x - ax) / (obj.x + obj.hypoBx - ax);
      }
      const c = { bounds, rest: face - gs * half };
      if (!(bounds.right < s0 || bounds.left > s1)) strip.push(c);
      if (!(bounds.right < w0 || bounds.left > w1)) wide.push(c);
    }
    const pick = list => {
      // spiderTestJumpInternal sorts by the rectangle edge, quantized to
      // 0.1 GD points (4e4590/4e45f0), before resolving a slope's diagonal.
      // CRT qsort's small partitions use selection sort: equal edges are
      // intentionally not stable. A slope sharing a face with a thin block
      // can be first even though its diagonal landing lies farther away.
      const edge = c => Math.trunc(Math.fround(Math.fround((goingUp ? c.bounds.lower : c.bounds.upper) / 2 + 90) * (goingUp ? 10 : -10)));
      const ordered = list.slice();
      if (ordered.length <= 8) {
        for (let end = ordered.length - 1; end > 0; end--) {
          let largest = 0;
          for (let i = 1; i <= end; i++) if (edge(ordered[i]) > edge(ordered[largest])) largest = i;
          [ordered[largest], ordered[end]] = [ordered[end], ordered[largest]];
        }
      } else ordered.sort((a,b)=>edge(a)-edge(b));
      let best = null;
      for (const c of ordered) {
        if ((c.rest - fromY) * gs < -20) continue;
        if (c.bounds.left > x) {
          const blocked = list.some(o => o !== c && !(x + half < o.bounds.left || o.bounds.right < x - half
            || c.rest + half < o.bounds.lower + 4 || o.bounds.upper - 4 < c.rest - half));
          if (blocked) continue;
        }
        best = c;
        break;
      }
      return best ? best.rest : null;
    };
    const hazNearer = y => haz && (y === null || (haz.cy - y) * gs < 0);
    let y;
    if (!strip.length) {
      // spiderTestJumpInternal also searches the full body when its forward
      // strip is empty. A platform just behind the centre still catches the
      // spider's feet, even without a hazard in the narrow search (Troll
      // Madness, X13743). Falling back to the world floor embeds it in that
      // platform on the same collision pass.
      y = wide.length ? pick(wide) : null;
      if (hazNearer(y)) return { y: haz.cy, hazard: haz };
    } else {
      y = pick(strip);
      if (hazNearer(y)) {
        const y2 = wide.length ? pick(wide) : null;
        if (hazNearer(y2)) return { y: haz.cy, hazard: haz };
        y = y2;
      }
    }
    // The level floor/ceiling seat a dart by its 20 x 20 (mini 12) body.
    const bandHalf = this.p.isWave ? (this.p.isMini ? 12 : 20) : half;
    if (y === null) y = goingUp ? band.ceil - bandHalf : band.floor + bandHalf;
    return { y, hazard: null };
  }

  // spider orb / pad: the same search from any mode, in mid-air too
  _teleportToOppositeSurface() {
    const size = this._collisionHalfSize();
    const x = this._worldX() ?? centerX;
    const up = !this.p.gravityFlipped, oldY = this.p.y;
    const target = this._spiderTeleportTarget(up, x, size);
    this.flipGravity(up, 1);
    this.p._spiderLocalGravityFrame = this._scene?._physicsFrame;
    this.p._lastSpiderTeleportTime = (this._scene?._physicsFrame ?? 0) / 240;
    this.p.yVelocity = up ? 2 : -2;
    this.p.isJumping = false;
    this.p.y = target.y;
    this.p.lastY = target.y;
    this._lastCollisionWorldX = x;
    this._lastCollisionWorldY = target.y;
    this._spawnSpiderTeleportEffects(oldY, target.y);
    if (target.hazard && !this._noclipEnabled()) { this.killPlayer(); return false; }
    if (target.hazard) this.p.diedThisFrame = true;
    this.p.onGround = true;
    this.p.onCeiling = up;
    this.p.canJump = true;
    // spiderTestJumpInternal (Steam 4f3259) clears the held flag.
    this._consumeHeldButton();
    return true;
  }
  _padFacesDown(object) {
    // GameObject::isFacingDown (29e820): integer rotation, with exact
    // quarter turns handled separately, then the object's Y flip.
    const sideways = this._scene?._localPhysicsActive && Math.abs(this._gameLayer?.gameplayState?.u.y || 0) > 0.5;
    const placed = object._eeLevelObject;
    // isFacingDown calls CCNode::getRotation, whose saved X rotation can
    // come from 131 independently of property 6 (including +/-180 axes).
    const axisOffset = placed ? Number(placed.rotationX ?? placed.rot ?? 0) - Number(placed.rot || 0) : 0;
    const angle = Math.trunc((Number(sideways ? object._baseRotationDegrees : object.rotationDegrees) || 0) + axisOffset) % 360;
    if (sideways && angle % 90 === 0) {
      // isFacingLeft (29e95f): horizontal facings have a separate exact-
      // quarter branch. A Y flip cannot turn 0/180 into a left-facing pad.
      const quarter = (angle + 360) % 360, flipped = !!object._eeLevelObject?.flipY;
      return quarter === 270 && !flipped || quarter === 90 && flipped;
    }
    const down = angle % 90 === 0 ? (sideways ? (angle + 360) % 360 === 270 : Math.abs(angle) === 180)
      : (angle >= 91 && angle <= 269) || (angle >= -269 && angle <= -91);
    return down !== !!object._eeLevelObject?.flipY;
  }

  _emitPadEvents(id) {
    // GJBaseGameLayer::bumpPlayer (31f21c..31f24d) dispatches the pad's
    // specific event before Pad Activated, including pads with No Effects.
    const event = {35: 45, 140: 46, 1332: 47, 67: 48, 3005: 49}[id];
    if (event) this._gameLayer?.logicState?.event(event);
    this._gameLayer?.logicState?.event("padActivated");
  }

  _updateSpiderJump(dt) {
    const playerSize = this._collisionHalfSize();
    const _gravAmt = p * 0.6;
    const canSpiderTeleport = this.p.canJump || this.p.onGround || this.p.onCeiling;

    let prioritizeOrb = this._shouldPrioritizeGroundOrbInput();

    if (!prioritizeOrb && this.p.upKeyPressed && canSpiderTeleport) {
      // spiderTestJumpInternal (Steam 4f3259) clears the held flag.
      this._consumeHeldButton();

      const playerWorldX = this._worldX() ?? centerX;
      const goingUp = !this.p.gravityFlipped;
      // spiderTestJumpInternal always lands: on a solid, on a hazard (and
      // dies there), or on the band's face; the flip comes before the effect
      const oldSpiderTeleportY = this.p.y;
      const target = this._spiderTeleportTarget(goingUp, playerWorldX, playerSize);
      this.p.y = target.y;
      this.flipGravity(goingUp, 1.0);
      this.p._lastSpiderTeleportTime = (this._scene?._physicsFrame ?? 0) / 240;
      this.p.onCeiling = goingUp;
      // spiderTestJumpInternal (Steam 4f3230..4f3246) leaves a speed of 1
      // toward the surface it reached.
      this.p.yVelocity = goingUp ? 2 : -2;
      this.p.isJumping = false;
      this._spawnSpiderTeleportEffects(oldSpiderTeleportY, this.p.y);
      if (target.hazard && !this._noclipEnabled()) {
        this.p.onGround = false;
        this.p.canJump = false;
        this.killPlayer();
        return;
      }
      if (target.hazard) {
        this.p._spiderTeleportNoclipDeathPending = true;
        this.p.diedThisFrame = true;
      }
      this.p.onGround = true;
      this.p.canJump = true;

      this.p._spiderTeleportAnimTimer = 0;
      this._spiderAnimTimer = (this._spiderAnimTimer || 0) + 0.12;
      this.rotateActionActive = false;
      this._rotation = 0;
      this.p.lastY = this.p.y;
      this._lastCollisionWorldY = this.p.y;
      this._lastCollisionWorldX = playerWorldX;
      return;
    }

    if (this.playerIsFalling()) {
      this.p.canJump = false;
    }
    this.p.yVelocity -= _gravAmt * dt * this.flipMod() * this._gm();
    if (this.p.gravityFlipped) {
      this.p.yVelocity = Math.min(this.p.yVelocity, 30);
    } else {
      this.p.yVelocity = Math.max(this.p.yVelocity, -30);
    }
    if (this.playerIsFalling()) {
      const _pastThreshold = this.p.gravityFlipped
        ? this.p.yVelocity > p * 2
        : this.p.yVelocity < -(p * 2);
      if (_pastThreshold) {
        this.p.onGround = false;
      }
    }
  }
  _isPortalCollisionType(colType) {
    const typeStr = String(colType || "");
    return typeStr.startsWith("portal_") || typeStr === speedType || typeStr === "speed";
  }

  _rotatedRectanglesOverlap(cx1, cy1, hw1, hh1, rotDeg1, cx2, cy2, hw2, hh2, rotDeg2 = 0) {
    const makeRect = (cx, cy, hw, hh, rotDeg) => {
      const rad = (Number(rotDeg) || 0) * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        cx,
        cy,
        hw,
        hh,
        ux: { x: cos, y: sin },
        uy: { x: -sin, y: cos }
      };
    };

    const a = makeRect(cx1, cy1, hw1, hh1, rotDeg1);
    const b = makeRect(cx2, cy2, hw2, hh2, rotDeg2);
    const axes = [a.ux, a.uy, b.ux, b.uy];
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;

    for (const axis of axes) {
      const centerDistance = Math.abs(dx * axis.x + dy * axis.y);
      const radiusA =
        a.hw * Math.abs(axis.x * a.ux.x + axis.y * a.ux.y) +
        a.hh * Math.abs(axis.x * a.uy.x + axis.y * a.uy.y);
      const radiusB =
        b.hw * Math.abs(axis.x * b.ux.x + axis.y * b.ux.y) +
        b.hh * Math.abs(axis.x * b.uy.x + axis.y * b.uy.y);

      if (centerDistance >= radiusA + radiusB) {
        return false;
      }
    }

    return true;
  }

  _isPlayerTouchingPortalHitbox(portalObj, playerWorldX, playerWorldY, playerHalfSize, previousWorldX = null, previousWorldY = null) {
    if (!portalObj) return false;
    if (portalObj.shape) return portalObj.shapeOverlapsRect(playerWorldX, playerWorldY, playerHalfSize, playerHalfSize, -this._rotation);

    const portalHalfW = (Number(portalObj.w) || 0) / 2;
    const portalHalfH = (Number(portalObj.h) || 0) / 2;
    const playerHalf = Math.max(0, Number(playerHalfSize) || 0);

    if (portalHalfW <= 0 || portalHalfH <= 0 || playerHalf <= 0) {
      return false;
    }

    const portalCenterX = Number(portalObj.x) || 0;
    const portalCenterY = Number(portalObj.y) || 0;
    const portalRotation = -(Number(portalObj.rotationDegrees) || 0);
    // Only an object at an oblique angle has an oriented box (31bedc): the
    // others meet the player's plain rectangle, whatever its rotation.
    const oblique = Math.fround(portalRotation) % 90 !== 0;
    const quarter = Math.abs(Math.abs(Math.fround(portalRotation)) - 180) === 90;
    const touchesAt = (worldX, worldY) => !oblique
      ? Math.abs(worldX - portalCenterX) <= (quarter ? portalHalfH : portalHalfW) + playerHalf && Math.abs(worldY - portalCenterY) <= (quarter ? portalHalfW : portalHalfH) + playerHalf
      : this._rotatedRectanglesOverlap(
      portalCenterX,
      portalCenterY,
      portalHalfW,
      portalHalfH,
      portalRotation,
      Number(worldX) || 0,
      Number(worldY) || 0,
      playerHalf,
      playerHalf,
      -this._rotation * 180 / Math.PI
    );

    if (touchesAt(playerWorldX, playerWorldY)) return true;

    // Only teleport portals pass a previous position. Number(null) is zero:
    // treating an omitted position as (0,0) swept every ordinary portal all
    // the way from the level origin and admitted contacts outside its OBB.
    if (previousWorldX === null || previousWorldY === null) return false;
    const prevX = Number(previousWorldX);
    const prevY = Number(previousWorldY);
    const curX = Number(playerWorldX);
    const curY = Number(playerWorldY);
    if (!Number.isFinite(prevX) || !Number.isFinite(prevY) || !Number.isFinite(curX) || !Number.isFinite(curY)) {
      return false;
    }

    const dx = curX - prevX;
    const dy = curY - prevY;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (distance <= 0) return false;

    const rad = portalRotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const toLocal = (worldX, worldY) => {
      const lx = worldX - portalCenterX;
      const ly = worldY - portalCenterY;
      return {
        x: lx * cos + ly * sin,
        y: lx * -sin + ly * cos
      };
    };
    const start = toLocal(prevX, prevY);
    const end = toLocal(curX, curY);
    const segDx = end.x - start.x;
    const segDy = end.y - start.y;
    const expandedHalfW = portalHalfW + playerHalf;
    const expandedHalfH = portalHalfH + playerHalf;
    let tMin = 0;
    let tMax = 1;
    const clipAxis = (startValue, deltaValue, minValue, maxValue) => {
      if (Math.abs(deltaValue) < 1e-8) {
        return startValue >= minValue && startValue <= maxValue;
      }
      let t1 = (minValue - startValue) / deltaValue;
      let t2 = (maxValue - startValue) / deltaValue;
      if (t1 > t2) {
        const swap = t1;
        t1 = t2;
        t2 = swap;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      return tMin <= tMax;
    };

    if (clipAxis(start.x, segDx, -expandedHalfW, expandedHalfW) &&
        clipAxis(start.y, segDy, -expandedHalfH, expandedHalfH)) {
      return true;
    }

    const steps = Math.min(12, Math.max(2, Math.ceil(distance / Math.max(1, playerHalf))));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (touchesAt(prevX + dx * t, prevY + dy * t)) return true;
    }

    return false;
  }

  // One ring contact of collisionCheckObjects (orb branch), shared with
  // ringJumpOnPress. ctx carries the tick's consumed/boosted/teleported flags;
  // ctx.stop ends the contact loop (teleporting rings).
  _handleRingContact(gameObj, ctx) {
    const _orbId = gameObj.orbId;
    const _isDash = (_orbId === 1704 || _orbId === 1751);
    // ringJump (4f7083): an active dash ignores further rings, including
    // another green dash ring. It must not flip gravity a second time.
    if (this.p.isDashing) return;
    const justPressed = this.p.upKeyDown && !this.p.wasUpKeyDown;
    // ringJump keeps one used flag per press for custom rings, teleport orbs
    // and every other ring (Steam 4f709d..4f70ca). Collisions only fire rings
    // for grounded modes, on a press the last update left buffered; ship, UFO,
    // wave and swing fire the rings they touch when the button goes down
    // (collisionCheckObjects 31f658..31f68e, pushButton 4f634e).
    const _ringCategory = _orbId === 1594 ? 'customUsed' : _orbId === 3027 ? 'teleportUsed' : 'consumed';
    const _flightRings = this.p.isFlying || this.p.isUfo || this.p.isWave;
    // Native 0x991/0x992 retain this pass's ring press even when a preceding
    // ordinary ring clears 0x98e. Custom/teleport categories can still fire.
    if (!_flightRings && this.p.queuedHold && this.p.upKeyDown) ctx.bufferedPress = true;
    const _pressReady = ctx.atPress ? (ctx.forcePress || justPressed) : (!_flightRings && ctx.bufferedPress);
    const _needsClick = !ctx[_ringCategory] && (_ringCategory !== 'consumed' || !this.p._orbActivationConsumedForPress || (!ctx.atPress && ctx.bufferedPress)) && _pressReady;
    this.p.touchingRing = true;
    if (!this._isObjectActivated(gameObj) && _needsClick) {
      this._gameLayer?.logicState?.event("orbActivated");
      const event = ({36:34,141:35,1333:36,84:37,1022:38,1330:39,1594:40,1704:41,1751:42,3004:43,3027:44})[_orbId];
      if (event) this._gameLayer?.logicState?.event(event);
      const cached = this._nativeTouchedRings?.indexOf(gameObj) ?? -1;
      if (cached >= 0) this._nativeTouchedRings.splice(cached, 1);
      this._orbpadHitEffect(gameObj, true);
      if (_isDash) {
        const dashHoldTicks = this._getDashHoldTicks(gameObj) + 1;
        this._setDashHoldTicks(gameObj, dashHoldTicks);
        if (dashHoldTicks < 2) {
          this._setObjectActivated(gameObj, true);
          ctx.consumed = true;
          // Dash rings skip ringJump's buffer clear (Steam 4f7404 jumps past
          // 4f7423): a swing still flips on the press that starts the dash.
          this.p._orbActivationConsumedForPress = true;
          if (_orbId === 1751) {
            this.flipGravity(!this.p.gravityFlipped);
            this._syncOtherDualGravityForBlueBoost();
          }
          this._startDash(gameObj);
          if (this.p.isBall) {
            this.p.ballRotateOpposite = false;
            this.p.ballHitPad = true;
            this.p.ballRotation2 = 0;
          }
          // Dash rotation starts immediately; leaving a normal jump
          // rotation active made the icon pause, then suddenly spin.
          this.rotateActionActive = false;
          ctx.boosted = true;
          this._markActivatedOrbSprites(gameObj);
        }
      } else {
        this._setObjectActivated(gameObj, true);
        ctx[_ringCategory] = true;
        if (_orbId === 1594) {
          if (!this._customRingKeepsPress()) this._ringTakesBufferedPress(this._heldPressActsOnGround());
        } else if (_orbId === 3027) {
          this._ringTakesBufferedPress(this._heldPressActsOnGround());
        } else if (_orbId === 1330) {
          // The drop ring clears the held press only for ball and swing
          // (Steam 4f7bce..4f7be0): a held cube jumps, a spider teleports.
          this.p._orbActivationConsumedForPress = true;
          this._ringTakesBufferedPress(this._heldPressActsOnGround() && !this.p.isBall);
          if (this.p.isBall || this.p.isSwing) this._consumeHeldButton();
        } else {
          this._consumeOrbActivationInput();
        }
        const _fm = this.flipMod();
        let _orbVel = 0;
        let _flipBefore = false;
        let _flipAfter = false;
        if (_orbId === 1594) {
          this._gameLayer.activateCustomRing(gameObj);
          this._markActivatedOrbSprites(gameObj);
        } else if (_orbId === 3004) {
          // ringJump (4f7215..4f7265): the jump leaves the way the ring faces, so
          // a ring turned against gravity flips the body first. A cube lands level.
          if (this._padFacesDown(gameObj) !== this.p.gravityFlipped) this.flipGravity(!this.p.gravityFlipped, 1);
          this._teleportToOppositeSurface();
          if (!this.p.isFlying && !this.p.isUfo && !this.p.isWave && !this.p.isSwing && !this.p.isBall && !this.p.isSpider) this._rotation = this.p.gravityFlipped ? Math.PI : 0;
          this.playGravityEffect(this.p.gravityFlipped);
          this._markActivatedOrbSprites(gameObj);
          // A teleport is no boost: a ramp met later in the same contact
          // pass still seats the body (native MK2 X16547).
          ctx.teleported = true;
          ctx.stop = true; return;
        } else if (_orbId === 3027) {
          const raw = gameObj._eeLevelObject?._raw || {};
          let target = this._gameLayer.gdRenderer?.groupCenter(Number(raw[51]));
          if (target && this._scene._localPhysicsActive) {
            const local = this._gameLayer.gameplayState.toLocal(target.x * 2, target.y * 2);
            target = { x: local.x / 2, y: local.y / 2 };
          }
          if (target) {
            this._setWorldX(target.x * 2);
            this.p.y = target.y * 2; this.p.lastY = this.p.y;
            this._resetTeleportTrails();
            this.p.onGround = false; this.p.canJump = false;
            this._lastCollisionWorldX = this._worldX();
            this._lastCollisionWorldY = this.p.y;
            ctx.boosted = true; ctx.teleported = true;
          }
          this._markActivatedOrbSprites(gameObj);
          ctx.stop = true; return;
        } else if (_orbId === 444) {
          const _spPlayerSize = this._collisionHalfSize();
          const _spFloorY = this._gameLayer.getFloorY();
          const _spCeilY  = this._gameLayer.getCeilingY() || f;
          if (!this.p.gravityFlipped) {
            this.p.y = _spCeilY - _spPlayerSize;
            this.flipGravity(true, 1.0);
            this.playGravityEffect(true);
          } else {
            this.p.y = _spFloorY + _spPlayerSize;
            this.flipGravity(false, 1.0);
            this.playGravityEffect(false);
          }
          this._syncOtherDualGravityForBlueBoost();
          this.p.yVelocity = 0;
          this.p.onGround = false;
          this.p.canJump = false;
          this.p.isJumping = false;
          this.runRotateAction();
          ctx.boosted = true;
          this._markActivatedOrbSprites(gameObj);
        } else if (this.p.isWave) {
          if (_orbId === 84 || _orbId === 1022) {
            this.flipGravity(!this.p.gravityFlipped);
            this._syncOtherDualGravityForBlueBoost();
            this.playGravityEffect(this.p.gravityFlipped);
            ctx.boosted = true;
            this._markActivatedOrbSprites(gameObj);
          }
        } else {
          // ringJump (Steam 4f7448..4f775b): green rings flip first, blue
          // rings after the speed (flipGravity then halves it).
          _orbVel = this._ringJumpSpeed(_orbId);
          _flipBefore = _orbId === 1022;
          _flipAfter = _orbId === 84;
          // ringJump leaves the robot's pad latch and hover budget intact.
          // A re-enabled held press can continue the unused part of a jump.
          this.p._robotHold = this.p.isRobot && !this.p._robotPadBoost && this.p.upKeyDown;
          if (_orbId !== 1330) {
            this.p.isJumping = true;
            this.p.onGround = false;
            this.p.canJump = false;
          }
          if (_flipBefore) {
            this.flipGravity(!this.p.gravityFlipped);
            this._syncOtherDualGravityForBlueBoost();
            this.playGravityEffect(this.p.gravityFlipped);
            this.p.yVelocity = this.flipMod() * _orbVel;
          } else {
            this.p.yVelocity = _fm * _orbVel;
          }
          this.p.wasBoosted = _orbId !== 1330;
          this._groundLatched = false;
          // ringJump raises the exemption for the red and drop rings
          if (_orbId === 1333 || _orbId === 1330) this.p.boostLatch = true;
          if (this.p.isBall) this._runBallRotationBack();
          else this.runRotateAction();
          ctx.boosted = true;
          if (_flipAfter) {
            this.flipGravity(!this.p.gravityFlipped);
            this._syncOtherDualGravityForBlueBoost();
            this.playGravityEffect(this.p.gravityFlipped);
          }
          this._markActivatedOrbSprites(gameObj);
        }
      }
    } else if (_isDash && !this.p.upKeyDown) {
      this._setDashHoldTicks(gameObj, 0);
    }
  }
  // PlayerObject::pushButton runs ringJump for the rings the previous
  // collision pass touched, before this tick's movement: an orb pressed at the
  // start of a tick moves the body on that same tick (native orb matrix,
  // 2026-10-27: cube, ship, UFO, ball, robot, spider and swing).
  ringJumpOnPress(forcePress = false) {
    // Native keeps the order in which rings first touched the player, not
    // their authored order on every new pass (pushButton, 4f634e..4f6470).
    const rings = this._nativeTouchedRings || this._touchedRings;
    if (!rings?.length || this.p.isDead || !(this.p.upKeyDown && (forcePress || !this.p.wasUpKeyDown))) return;
    const ctx = { consumed: false, customUsed: false, teleportUsed: false, atPress: true, forcePress, boosted: false, teleported: false, stop: false };
    const ordered = rings.filter(r => r?.orbId === 1594).concat(rings.filter(r => r?.orbId !== 1594));
    for (const ring of ordered) {
      if (!ring || ring._eeDisabled) continue;
      this._handleRingContact(ring, ctx);
      if (ctx.stop) break;
    }
    if (ctx.boosted && !this.p.onGround) this.p.jumpTrailActive = true;
    if (ctx.teleported) { this._lastCollisionWorldX = this._worldX(); this._lastCollisionWorldY = this.p.y; }
  }
  finishRingContacts() {
    // processCommands prunes missed rings after Options can push the held
    // button (340d75..340d83). Keep the surviving contacts in their old order.
    if (this._ringContactsThisPass && this._nativeTouchedRings)
      this._nativeTouchedRings = this._nativeTouchedRings.filter(r => this._ringContactsThisPass.has(r));
    this._ringContactsThisPass = null;
  }
  checkCollisions(_0x2f5078) {
    const skipFlyBounds = !!this.p._skipFlyBoundsOnce;
    this.p._skipFlyBoundsOnce = false;
    this._groundColliderId = null;
    const previousMultiContacts=this._multiContacts || new Set();
    this._multiContacts=new Set();
    this.noclipStats.totalFrames++;
    this.p.diedThisFrame = false;
    if (this.p._spiderTeleportNoclipDeathPending) {
      this.p.diedThisFrame = true;
      this.p._spiderTeleportNoclipDeathPending = false;
    }
    if (!this.p.upKeyDown || (this.p.upKeyDown && !this.p.wasUpKeyDown)) {
      this.p._orbActivationConsumedForPress = false;
    }
    // updateJump (4ea396..4ea3e3): a boosted body starts falling.
    if (this.p.wasBoosted && this.playerIsFalling()) { this.p.wasBoosted = false; this._groundLatched = false; }
    // togglePlayerScale leaves the rect of this tick as it is (native Dash
    // X4395: a cube sized up on a floor stays seated by its old half this tick).
    this._passMini = undefined;
    let playerSize = this._collisionHalfSize();
    // Resting world-ground contact precedes overlapping spawn portals in
    // collisionCheckObjects. Do not carry that tick's gravity impulse into
    // a distant teleport (native Blackfire spawn starts with zero velocity).
    let _restSeatedOnFloor = false;
    if(this.p.onGround&&!this.p.gravityFlipped&&this.p.yVelocity<=0) {
      const floor=this._gameLayer.getFloorY(),half=this.p.isWave?(this.p.isMini?12:20):playerSize;
      if(Number.isFinite(floor)&&this.p.y<=floor+half&&this.p.lastY>=floor+half-.001) {
        _restSeatedOnFloor = this.p.y < floor + half;
        this.p.y=floor+half;this.p.yVelocity=0;
      }
    }
    let waveHitSize = this.p.isMini ? 6 : 10;
    let pieceWidth = _0x2f5078 + centerX;
    const previousWorldX = Number.isFinite(this._lastCollisionWorldX) ? this._lastCollisionWorldX : pieceWidth;
    let playersY = this.p.y;
    let playersLastY = this.p.lastY;
    const previousCollisionWorldY = Number.isFinite(this._lastCollisionWorldY) ? this._lastCollisionWorldY : playersLastY;
    // Snap margin: the swing takes the ground modes' 20, not the ship's 12
    // (native synthetic rising floor lifts a swing from 6.5 below the face).
    let gamemodeAddition = this.p.isWave ? 0 : this.p.isSpider ? playerSize * 0.7 : ((this.p.isFlying && !this.p.isSwing) || this.p.isUfo ? 12 : 20);
    this.p.collideTop = 0;
    this.p.collideBottom = 0;
    this.p.onCeiling = false;
    this.p.touchingRing = false;
    this._c6Now = 0;
    this._onSlopeAngle = null;
    this._activeSlopeObj = null;
    this._activeSlopeAngle = null;
    this._slopeContactThisTick = false;
    this._slopeWasRiding = this._slopeRiding;
    if (this._potentialSlopeStale) this._potentialSlope = null; else this._potentialSlopeStale = true;
    const potentialSlopes = this._potentialSlopes ||= new Set();
    potentialSlopes.clear();
    if (this._potentialSlope) potentialSlopes.add(this._potentialSlope);
    if (this._prevSlopeObj) potentialSlopes.add(this._prevSlopeObj);
    let _0x30410f = false;
    let _boostedThisStep = false;
    this.finishRingContacts();
    this._touchedRings = [];
    this._ringContactsThisPass = new Set();
    this._nativeTouchedRings ||= [];
    let _teleportedThisStep = false;
    let _orbInputConsumedThisStep = { consumed: false, customUsed: false, teleportUsed: false,
      bufferedPress: !!(this.p.queuedHold && this.p.upKeyDown) };
    let _touchingTeleportDuringRespawnIgnore = false;
    let seatedRamp = null;
    let scanNextGround = false;
    // Touch Toggle may expose a portal in this collision pass. Waiting
    // until the solids delayed DEPRIVATION's ship entry by one tick.
    this._gameLayer.checkTouchToggleTriggers?.(pieceWidth, playersY);
    const _0x198534 = this._gameLayer.getNearbySectionObjects(pieceWidth, playersY);
    // Modifier objects are checked before solids, independent of level order.
    this._updateCollisionModifiers(_0x198534, pieceWidth, playersY, this.p.isWave ? waveHitSize : playerSize);
    this._updateForceContacts(_0x198534, pieceWidth, playersY, this.p.isWave ? waveHitSize : playerSize);
    // Native collision cells sort by GameObject's unique creation ID
    // (30b120), not contact type. Keep the authored order: a preceding
    // ramp can seat the player before a pad tests its updated rectangle.
    // collisionCheckObjects (31bdd5..31bdfb) handles every other object as
    // it meets it, ramps included, and only queues solids and hazards.
    // checkCollisions then resolves the solids last to first (31b860), and
    // the hazards in order (31bb33).
    const deferredContact = o => !!o && (o.type===solidType || o.type===hazardType);
    const contacts = [], solidContacts = [], hazardContacts = [];
    const sortContact = o => { if (o?.type===solidType) solidContacts.push(o); else if (o?.type===hazardType) hazardContacts.push(o); else contacts.push(o); };
    for (const o of _0x198534) sortContact(o);
    let solidsQueued = false;
    const touchedContacts = new Set();
    const pendingContacts = new Set(_0x198534);
    // collisionCheckObjects continues its pass after a teleport with the
    // objects not yet visited, now tested at the new rectangle; those it
    // already passed are not revisited (native MK2 X14735 / X16547). Only
    // cells the old query did not cover are added.
    const listedContacts = new Set(_0x198534);
    // The pass tests one player rectangle. A mode portal does not resize it
    // for the objects after it (native LIMBO X3043: a gravity portal behind
    // a wave portal in the same tick); ramps and teleports rebuild it, and
    // so does every step of the solid phase.
    let passRectHalf = this.p.isWave ? waveHitSize : playerSize;
    const continueAfterTeleport = (contact, spiderJump = false, keepLast = false) => {
      // A teleport portal moves the body but not m_lastPosition: a block met
      // at the exit is entered from the old side (native WHAT start: a cube
      // sent into a block bumps out under it).
      const previousPassX=pieceWidth, cursor=contacts[contact]?._eeObjectId;
      pieceWidth=this._worldX();playersY=this.p.y;if(!keepLast)playersLastY=this.p.lastY;
      passRectHalf=this.p.isWave?(this.p.isMini?6:10):this._collisionHalfSize();
      // Modifier blocks at the exit apply to the rest of the pass (native
      // WHAT start: a Hit Head block beside the exit lets the cube bump out).
      this._applyCollisionModifiers(this._gameLayer.getNearbySectionObjects(pieceWidth,playersY), pieceWidth, playersY, this.p.isWave ? waveHitSize : playerSize);
      // A spider teleport keeps the pass's list (with Dynamic Height's Y
      // rows, pads beside its landing wait a tick: native MK2 X15198), and a
      // ramp met before it describes the departure rectangle.
      if (spiderJump) { seatedRamp = null; this._slopeContactThisTick = false; return; }
      // A vertical teleport continues the same authored object cursor. Y
      // culling can hide earlier objects from the initial query; discovering
      // them at the exit must not revisit them (Orbit's preceding blue portal).
      const movedX=Math.abs(pieceWidth-previousPassX)>1e-6;
      const destination=this._gameLayer.getNearbySectionObjects(pieceWidth,playersY).filter(o=>!listedContacts.has(o)&&
        (movedX||cursor===undefined||o._eeObjectId===undefined||o._eeObjectId>cursor));
      for(const o of destination){listedContacts.add(o);pendingContacts.add(o);}
      contacts.splice(contact+1,0,...destination.filter(o=>!deferredContact(o)));
      for(const o of destination)if(deferredContact(o))sortContact(o);
    };
    for (let contact = 0; ; contact++) {
      if (contact >= contacts.length) {
        if (solidsQueued) break;
        solidsQueued = true;
        // Touch toggles are met among the other objects of the pass: blocks
        // they switch are gone before the solids resolve (native LIMBO X9635).
        this._gameLayer.checkTouchToggleTriggers?.(pieceWidth, this.p.y);
        contacts.push(...solidContacts.reverse(), ...hazardContacts);
        scanNextGround = !!this._groundObj && this._onMovingGround;
        if (contact >= contacts.length) break;
      }
      const gameObj = contacts[contact];
      pendingContacts.delete(gameObj);
      if (touchedContacts.has(gameObj)) continue;
      playerSize=this._collisionHalfSize();waveHitSize=(this._passMini??this.p.isMini)?6:10;
      gamemodeAddition=this.p.isWave?0:this.p.isSpider?playerSize*.7:((this.p.isFlying&&!this.p.isSwing)||this.p.isUfo?12:20);
      if (!gameObj || gameObj._eeDisabled) continue;
      // collisionCheckObjects (31f6cb): Low Detail Mode has no High Detail objects.
      if (window.enableLDM && gameObj._eeLevelObject?.highDetail) continue;
      // `No Touch` is saved on the placed GameObject. Dash uses it for
      // decorative solids, fake hazards, pads and animated monsters: they
      // must still render and follow their groups, but they are not a player
      // contact surface and cannot activate or kill the player.
      if (gameObj.noTouch) continue;
      let left = gameObj.x - gameObj.w / 2;
      let right = gameObj.x + gameObj.w / 2;
      let top = gameObj.y - gameObj.h / 2;
      let bottom = gameObj.y + gameObj.h / 2;
      const rad = gameObj.rotationDegrees * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const halfW = gameObj.w / 2;
      const halfH = gameObj.h / 2;
      const transformed = gameObj.shape || gameObj.type === slopeType;
      // GameObject::getObjectRect (2949e0): an oblique object's box bounds its
      // oriented box. The others, every solid and ramp among them (setupOBB,
      // 29e640), keep their plain size whatever a trigger turned them to, and
      // swap it only at exactly a quarter turn (295 0c3).
      const oblique = gameObj.type !== solidType && gameObj.type !== slopeType && Math.fround(gameObj.rotationDegrees || 0) % 90 !== 0;
      const quarter = !transformed && !oblique && Math.abs(Math.abs(Math.fround(gameObj.rotationDegrees || 0)) - 180) === 90;
      const rotatedHalfWidth  = oblique && !transformed ? Math.abs(halfW * cos) + Math.abs(halfH * sin) : quarter ? halfH : halfW;
      const rotatedHalfHeight = oblique && !transformed ? Math.abs(halfW * sin) + Math.abs(halfH * cos) : quarter ? halfW : halfH;
      let rotatedLeft = gameObj.x - rotatedHalfWidth;
      let rotatedRight = gameObj.x + rotatedHalfWidth;
      let rotatedTop = gameObj.y - rotatedHalfHeight;
      let rotatedBottom = gameObj.y + rotatedHalfHeight;
      if (solidsQueued) passRectHalf = this.p.isWave ? waveHitSize : playerSize;
      const _broadSize = passRectHalf, broadY = _broadSize;
      // A ramp's contact rectangle is doubled (getObjectRect(2, 2), 31be3a):
      // the ramp a body sat on keeps seating it past its own box until its
      // seat reaches the clamp; preSlopeCollision guards all the others.
      if (gameObj.type === slopeType) {
        rotatedLeft -= halfW; rotatedRight += halfW; rotatedTop -= halfH; rotatedBottom += halfH;
      }
      const _hasCircleHitbox = gameObj.hitbox_radius !== undefined && gameObj.hitbox_radius !== null;
      let _broadPhaseHit;
      if (_hasCircleHitbox) {
        const _dx = pieceWidth - gameObj.x;
        const _dy = playersY - gameObj.y;
        _broadPhaseHit = (_dx * _dx + _dy * _dy) <= (gameObj.hitbox_radius + _broadSize) * (gameObj.hitbox_radius + _broadSize);
      } else {
        // Native CCRect contact rejects only separated edges (31be92..
        // 31bed4). An exact touch still reaches the activation/solid pass; the
        // rects are floats, so a block a sum of moves left off by far less than
        // their precision still touches (native LIMBO X64515).
        const nf = Math.fround;
        _broadPhaseHit = nf((pieceWidth + _broadSize) / 2) >= nf(rotatedLeft / 2) && nf((pieceWidth - _broadSize) / 2) <= nf(rotatedRight / 2) &&
          nf((playersY + broadY) / 2 + 90) >= nf(rotatedTop / 2 + 90) && nf((playersY - broadY) / 2 + 90) <= nf(rotatedBottom / 2 + 90);
      }
      const _colType = gameObj.type;
      // Solids resolve against the same transformed rectangle that admitted
      // the contact above. Reusing the unrotated width/height makes a 90-degree
      // wall kill a spider seated on its real underside on the very next tick.
      if (_colType === solidType) {
        left = rotatedLeft; right = rotatedRight;
        top = rotatedTop; bottom = rotatedBottom;
      }
      const motion = this._colliderStepMotion(gameObj);
      // checkCollisions (31b89d..31b97b): while the support sinks, the first
      // block sinking with it, within a tick's stick of the body, comes next.
      if (scanNextGround && _colType === solidType && (this.p.gravityFlipped ? motion.y > 0 : motion.y < 0)) {
        const reach = 5 * ((this._slopeStepSeconds ?? 1 / 240) * 60) * 2, half = this.p.isWave ? waveHitSize : playerSize;
        const low = rotatedTop - (this.p.gravityFlipped ? reach : 0), high = rotatedBottom + (this.p.gravityFlipped ? 0 : reach);
        if (pieceWidth + half >= rotatedLeft && pieceWidth - half <= rotatedRight && this.p.y + half >= low && this.p.y - half <= high) {
          this._nextGround = gameObj;
          scanNextGround = false;
        }
      }
      if (!_broadPhaseHit && _colType === "portal_teleport") {
        _broadPhaseHit = this._isPlayerTouchingPortalHitbox(gameObj, pieceWidth, playersY, _broadSize, previousWorldX, previousCollisionWorldY);
      }
      if (_broadPhaseHit) {
        if (gameObj.shape && !_hasCircleHitbox && _colType !== solidType && !gameObj.shapeOverlapsRect(pieceWidth, playersY, _broadSize, _broadSize,
          -this._rotation)) continue;
        // A rotated pad tests both oriented boxes after the axis-aligned
        // broad phase (collisionCheckObjects 31befe..31bf48). The player's
        // square follows its real rotation, including a spider riding a slope.
        if (oblique && !_hasCircleHitbox && !gameObj.shape && !this._isPortalCollisionType(_colType) &&
            !this._rotatedRectanglesOverlap(gameObj.x, gameObj.y, halfW, halfH, -(gameObj.rotationDegrees || 0),
              pieceWidth, playersY, _broadSize, _broadSize, -this._rotation * 180 / Math.PI)) continue;
        if (!_hasCircleHitbox && this._isPortalCollisionType(_colType)) {
          _broadPhaseHit = _colType === "portal_teleport"
            ? this._isPlayerTouchingPortalHitbox(gameObj, pieceWidth, playersY, _broadSize, previousWorldX, previousCollisionWorldY)
            : this._isPlayerTouchingPortalHitbox(gameObj, pieceWidth, playersY, _broadSize);
          if (!_broadPhaseHit) continue;
        }
        touchedContacts.add(gameObj);
        if (gameObj.multiActivate && (_colType === jumpPadType || _colType.startsWith('portal_')) &&
            (gameObj.padId !== 67 || this.p.gravityFlipped === this._padFacesDown(gameObj))) {
          // playerTouchedObject (31ef50) remembers multi-use contacts per
          // object/player until one collision tick passes without touching.
          const key=gameObj._eeObjectId ?? gameObj;
          this._multiContacts.add(key);
          if(previousMultiContacts.has(key)) continue;
        }
        if (_colType === "portal_teleport" && this._ignoreTeleportUntilClear) {
          _touchingTeleportDuringRespawnIgnore = true;
          this._setObjectActivated(gameObj, true);
          continue;
        }
        if (this.p.ignorePortals && (_colType.startsWith("portal_") || _colType === "speed")) {
          if (_colType === "portal_teleport") _touchingTeleportDuringRespawnIgnore = true;
          this._setObjectActivated(gameObj, true);
          continue;
        }
        const makeportalguide = (_colType.startsWith("portal_") || _colType === "speed") && !this._isObjectActivated(gameObj) && window.enablePortalGuide !== false;
        if (_colType !== jumpRingType && this._isPortalCollisionType(_colType) && !this._isObjectActivated(gameObj)) {
          this._orbpadHitEffect(gameObj);
        }
        if (_colType === "portal_teleport") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            if (gameObj.teleportToGroup) {
              const previousY=this.p.y,previousVelocity=this.p.yVelocity;
              this._gameLayer.logicState._teleport({raw:gameObj._eeLevelObject?._raw || {},uid:gameObj._eeObjectId,x:gameObj.portalX,y:gameObj.portalY},this);
              _boostedThisStep ||= Math.abs(previousY-this.p.y)>1e-6 || previousVelocity!==this.p.yVelocity;
              _teleportedThisStep = true;
              // collisionCheckObjects 31c902/31d282 rebuilds the player's
              // rectangle after a teleport and continues its contact pass.
              // The destination can belong to another section entirely.
              // Discover its contacts now, rather than delaying a pad by
              // one physics tick. Each collider is visited at most once,
              // including when portals form a cycle.
              continueAfterTeleport(contact);
              continue;
            }
            const exit = this._gameLayer.gdObjects?.[gameObj._eeObjectId]?.teleportExit;
            const liveExit = exit && this._gameLayer.gdRenderer?.livePosition(exit);
            // The orange endpoint participates in group moves, rotations
            // and scales just like its entry. A saved Y would teleport back
            // to the editor position after a moving portal is reached.
            const localExit = liveExit && this._scene?._localPhysicsActive
              ? this._gameLayer.gameplayState.toLocal(liveExit.x * 2, liveExit.y * 2) : null;
            let targetY = localExit ? localExit.y : liveExit ? liveExit.y * 2 : Number(gameObj.teleportTargetY) +
              (gameObj.y - (gameObj._eeInitialBaseY ?? gameObj.y));
            if (Number.isFinite(targetY)) {
              const targetX = Number(gameObj.teleportTargetX);
              // teleportPlayer writes the exit position before updating the
              // corridor/camera. The departure corridor cannot clamp it.
              this._playPortalShine({
                ...gameObj,
                x: Number.isFinite(targetX) ? targetX : gameObj.x,
                portalX: Number.isFinite(targetX) ? targetX : gameObj.portalX,
                portalY: targetY,
                flipX: true,
                portalFlipX: true
              });
              this.p.y = targetY;
              this.p.lastY = targetY;
              this.p.lastGroundPosY = targetY;
              this.p._skipFlyBoundsOnce = true;
              this._resetTeleportTrails();
              if (Math.abs(targetY - playersY) > 0.001) {
                this.p.onGround = false;
                this.p.canJump = false;
              }
              const raw = gameObj._eeLevelObject?._raw || {};
              const gravity = Number(raw[354]);
              if (gravity === 1) this.flipGravity(false, 0.5);
              else if (gravity === 2) this.flipGravity(true, 0.5);
              else if (gravity === 3) this.flipGravity(!this.p.gravityFlipped, 0.5);
              // The paired orange portal uses the native 180-degree basis.
              const forceAngle = exit ? 180 + (exit.flipX ? 180 : 0) - exit.rot - exit.rotOff : -Number(gameObj.rotationDegrees || 0);
              this.applyTeleportForce(raw, forceAngle);
              _boostedThisStep = true;
              _teleportedThisStep = true;
              this._lastCollisionWorldY = targetY;
              this._scene?._checkCameraLimitAfterTeleport?.(this, gameObj._eeLevelObject?._raw?.[55] === "1");
              this._gameLayer.logicState?.event("teleported");
              // collisionCheckObjects rebuilds the player's rectangle after a
              // teleport and continues its pass: a second, stacked portal is
              // used in the same tick (native MK2 X14353), not on the next.
              continueAfterTeleport(contact, false, true);
              continue;
            }
          }
        } else if (_colType === "portal_swing") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true); this._playPortalShine(gameObj);
            this.enterSwingMode(gameObj);
          }
        } else if (_colType === "portal_fly") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitRobotMode();
            this.exitBallMode();
            this.exitWaveMode();
            this.exitUfoMode();
            this.enterShipMode(gameObj);
          }
        } else if (_colType === portalWaveType) {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitRobotMode();
            this.exitBallMode();
            this.exitShipMode();
            this.exitUfoMode();
            this.enterWaveMode(gameObj);
          }
        } else if (_colType === portalUfoType) {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitRobotMode();
            this.exitBallMode();
            this.exitWaveMode();
            this.exitShipMode();
            this.enterUfoMode(gameObj);
          }
        } else if (_colType === "portal_cube") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitSpiderMode();
            this.exitRobotMode();
            this.exitShipMode();
            this.exitBallMode();
            this.exitWaveMode();
            this.exitUfoMode();
          }
        } else if (_colType === "portal_ball") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitRobotMode();
            this.exitShipMode();
            this.exitWaveMode();
            this.exitUfoMode();
            this.enterBallMode(gameObj);
          }
        } else if (_colType === "portal_robot") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitShipMode();
            this.exitBallMode();
            this.exitWaveMode();
            this.exitUfoMode();
            this.exitSpiderMode();
            this.exitRobotMode();
            this.enterRobotMode(gameObj);
          }
        } else if (_colType === "portal_spider") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this.exitShipMode();
            this.exitRobotMode();
            this.exitBallMode();
            this.exitWaveMode();
            this.exitUfoMode();
            this.exitSpiderMode();
            this.enterSpiderMode(gameObj);
          }
        } else if (_colType === "portal_gravity_down") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj, 2);
            if (this.p.isBall) {
              this.p.ballShouldRotate = true;
              this.p.ballRotateOpposite = true;
            }
            if (this.p.gravityFlipped) {
              this.playGravityEffect(false);
            }
            this.flipGravity(false, 0.5);
          }
        } else if (_colType === "portal_gravity_up") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj, 2);
            if (this.p.isBall) {
              this.p.ballShouldRotate = true;
              this.p.ballRotateOpposite = true;
            }
            if (!this.p.gravityFlipped) {
              this.playGravityEffect(true);
            }
            this.flipGravity(true, 0.5);
          }
        } else if (_colType === "portal_gravity_toggle") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj, 2);
            if (this.p.isBall) {
              this.p.ballShouldRotate = true;
              this.p.ballRotateOpposite = true;
            }
            this.playGravityEffect(!this.p.gravityFlipped);
            this.flipGravity(!this.p.gravityFlipped, 0.5);
          }
        } else if (_colType === "portal_mirror_on") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            if (!window.noMirror && !this._scene?._editorPlaytestActive) {
              this._scene?._beginMirrorTransition?.(true);
              this.p.mirrored = true;
            }
          }
        } else if (_colType === "portal_mirror_off") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            if (!window.noMirror && !this._scene?._editorPlaytestActive) {
              this._scene?._beginMirrorTransition?.(false);
              this.p.mirrored = false;
            }
          }
        } else if (_colType === "portal_mini_on") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this._passMini ??= this.p.isMini;
            this.p.isMini = true;
          }
        } else if (_colType === "portal_mini_off") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this._passMini ??= this.p.isMini;
            this.p.isMini = false;
          }
        } else if (_colType === "portal_dual_on") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this._gameLayer.cameraState?.portalMode(gameObj);
            this._scene._enableDualMode(gameObj);
          }
        } else if (_colType === "portal_dual_off") {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            this._scene._disableDualMode(this);
          }
        } else if (_colType === speedType) {
          if (!this._isObjectActivated(gameObj)) {
            this._setObjectActivated(gameObj, true);
            this._playPortalShine(gameObj);
            if (typeof gameObj.speedValue === "number") {
              // updateTimeMod (4ff370): a real speed change restarts a rolling
              // ball at the new rate.
              const changed = gameObj.speedValue !== playerSpeed;
              playerSpeed = gameObj.speedValue;
              if (changed) for (const body of [this._scene._player, this._scene._isDual && this._scene._player2]) {
                if (body && body.p.isBall) { body.stopRotation(); body._runBallRotation(); }
              }
            }
          }
    }
		if (makeportalguide) {
          this._makeportalguide(gameObj);
        } else if (_colType === jumpPadType) {
          if (!this._isObjectActivated(gameObj)) {
            // collisionCheckObjects (Steam 31cc87..31ccaf): a blue pad
            // installs the gravity opposite its facing. If that is already
            // the player's gravity, it is skipped without consuming the pad.
            if (gameObj.padId === 67 && this.p.gravityFlipped !== this._padFacesDown(gameObj)) continue;
            this._setObjectActivated(gameObj, true);
            this.reversePlayer(gameObj);
            this._orbpadHitEffect(gameObj);
            const _padId = gameObj.padId;
            const _grav = 2;
            const _fm = this.flipMod();
            let _padVel = 0;
            let _padFlip = false;
            if (_padId === 3005) {
              // bumpPlayer type 44 first aligns gravity with the pad's
              // facing; teleport then leaves its base, even if entered
              // against the player's current gravity.
              const facingDown = this._padFacesDown(gameObj);
              if (this.p.gravityFlipped !== facingDown) this.flipGravity(facingDown, 1);
              // spiderTestJumpInternal leaves its speed of 1 toward the
              // surface (native MK2 X14735 row: vy 1).
              this._teleportToOppositeSurface();
              this.playGravityEffect(this.p.gravityFlipped);
              this.p.onGround = false;
              this.p.canJump = false;
              if (this.p.isBall) {
                this.p.ballRotateOpposite = this.p.gravityFlipped;
                this.p.ballHitPad = true;
              }
              this.p.isJumping = false;
              // A teleport is no boost: a ramp later in the pass still seats
              // the body (native MK2 X16547: 16.77 above the 2:1 ramp).
              _teleportedThisStep = true;
              this._emitPadEvents(_padId);
              // collisionCheckObjects goes on at the destination rectangle:
              // native MK2 X16547 meets a red pad there on the same tick.
              // Objects along the jump are not hit.
              continueAfterTeleport(contact, true);
              continue;
            } else {
              // GJBaseGameLayer::bumpPlayer / PlayerObject::propellPlayer
              // (gdsolver padTableVy): vy = strength x 16 x (mini 0.8), x0.6
              // for ball, spider and swing; pink 0.35 ship / 0.4 UFO / 0.7
              // ball-spider / 0.65 else, red 0.63 (mini 0.95) ship / 0.6
              // (mini 0.98) UFO / 1.25 else. The gravity pad sets 12.8 (mini
              // 10.24) toward the old up and flips (x0.5): 6.4 as measured on
              // lv14. Ball, spider and swing take the same x0.6 as a yellow
              // pad: native MK2 X2895.9 normal ball leaves at -3.84.
              const ship = this.p.isFlying && !this.p.isSwing, ufo = this.p.isUfo;
              const ballish = this.p.isBall || this.p.isSpider || this.p.isSwing;
              const mini = this.p.isMini;
              let strength = 1;
              if (_padId === 140) strength = ship ? 0.35 : ufo ? 0.4 : (this.p.isBall || this.p.isSpider) ? 0.7 : 0.65;
              else if (_padId === 1332) strength = ship ? (mini ? 0.95 : 0.63) : ufo ? (mini ? 0.98 : 0.6) : 1.25;
              if (_padId === 67) {
                _padFlip = true;
                _padVel = Math.fround(12.8 * (mini ? 0.8 : 1)) * (ballish ? 0.6000000238418579 : 1) * _grav;
              } else if (_padId === 35 || _padId === 140 || _padId === 1332) {
                _padVel = Math.fround(strength * 16 * (mini ? 0.8 : 1)) * (ballish ? 0.6000000238418579 : 1) * _grav;
              }
              this.p.isJumping = true;
              this.p._robotHold = false;
              this.p._robotPadBoost = true;
              this.p.onGround = false;
              this.p.canJump = false;
              this.p.yVelocity = _fm * _padVel;
              // bumpPlayer clears the exemption and raises it for the red pad alone
              this.p.boostLatch = _padId === 1332;
              this.p.wasBoosted = true;
              this._groundLatched = false;
              if (this.p.isBall) {
                this.p.ballRotateOpposite = this.p.gravityFlipped;
                this.p.ballHitPad = true;
              }
              // bumpPlayer starts the turn before the pad flips the body.
              this.runRotateAction();
              if (_padFlip) {
                this.flipGravity(!this.p.gravityFlipped);
                if (_padId === 67) {
                  this._syncOtherDualGravityForBlueBoost();
                  this.playGravityEffect(this.p.gravityFlipped);
                }
              }
              _boostedThisStep = true;
              // bumpPlayer (Steam 4fdcca) clears m_isOnSlope and m_wasOnSlope:
              // no exit impulse, and a ramp after the pad is a new contact.
              this._slopeRiding = false; this._slopeContactThisTick = false;
              seatedRamp = null;
            }
            this._emitPadEvents(_padId);
            if (gameObj._padParticleEmitter) {
              const origX = gameObj._padParticleEmitter.x;
              const origY = gameObj._padParticleEmitter.y;
              const hitX = this._worldX();
              const hitY = b(this.p.y) + (this.p.gravityFlipped ? -24 : 24);
              if (typeof gameObj._padParticleEmitter.emitParticleAt === "function") {
                gameObj._padParticleEmitter.emitParticleAt(hitX, hitY, 24);
              } else {
                gameObj._padParticleEmitter.explode(24, hitX, hitY);
                gameObj._padParticleEmitter.start();
                gameObj._padParticleEmitter.setPosition(origX, origY);
              }
            }
          }
        } else if (_colType === jumpRingType) {
          const _ringCtx = { ..._orbInputConsumedThisStep, boosted: false, teleported: false, stop: false };
          this._touchedRings.push(gameObj);
          this._ringContactsThisPass.add(gameObj);
          if (!this._nativeTouchedRings.includes(gameObj)) this._nativeTouchedRings.push(gameObj);
          this._handleRingContact(gameObj, _ringCtx);
          _orbInputConsumedThisStep = { consumed: _ringCtx.consumed, customUsed: _ringCtx.customUsed, teleportUsed: _ringCtx.teleportUsed, bufferedPress: _ringCtx.bufferedPress };
          if (_ringCtx.boosted) _boostedThisStep = true;
          if (_ringCtx.teleported) _teleportedThisStep = true;
          if (_ringCtx.teleported) { continueAfterTeleport(contact, gameObj.orbId === 3004); continue; }
          if (_ringCtx.stop) break;
        } else if (_colType === coinType) {
          if (!this._isObjectActivated(gameObj)) {
            const isEditorSession = !!window.isEditor;
            if (gameObj.secretCoinId !== undefined && this._scene?._practicedMode?.practiceMode) {
              continue;
            }
            if (!isEditorSession && gameObj.userCoinId !== undefined && this._scene?._practicedMode?.practiceMode) {
              continue;
            }
            if (gameObj.secretCoinId !== undefined && !gameObj._secretCoinCompleted && !this._gameLayer.tryCollectSecretCoin(gameObj)) {
              continue;
            }
            if (gameObj.userCoinId !== undefined && !gameObj._userCoinCompleted && !this._gameLayer.tryCollectUserCoin(gameObj)) {
              continue;
            }
            this._setObjectActivated(gameObj, true);
            if (this._gameLayer.collectPickup?.(gameObj)) continue;
            this._orbpadHitEffect(gameObj);
            try {
              const _coinSpr = this._gameLayer._coinSprites.find(s => s && s.active && Math.abs(s._coinWorldX - gameObj.x) < 2 && Math.abs(s._coinWorldY - gameObj.y) < 2);
              if (_coinSpr && _coinSpr.scene) {
                const _startY = _coinSpr.y;
                _coinSpr.scene.tweens.add({
                  targets: _coinSpr,
                  y: _startY - 70,
                  scaleX: (_coinSpr.scaleX || 1) * 1.3,
                  scaleY: (_coinSpr.scaleY || 1) * 1.3,
                  duration: 180,
                  ease: 'Quad.Out',
                  onComplete: () => {
                    if (!_coinSpr.scene) return;
                    _coinSpr.scene.tweens.add({
                      targets: _coinSpr,
                      y: _startY + 600,
                      alpha: 0,
                      duration: 1200,
                      ease: 'Quad.In',
                      onComplete: () => {
                        try { _coinSpr.setVisible(false); } catch(e) {}
                      }
                    });
                  }
                });
              }
            } catch(e) {}
          }
        } else if (_colType === hazardType) {
          if (this._noclipEnabled()) {
            this.p.diedThisFrame = true; 
            continue;
          }
          if (_hasCircleHitbox) {
            const _hdx = pieceWidth - gameObj.x;
            const _hdy = playersY - gameObj.y;
            const _hDistSq = _hdx * _hdx + _hdy * _hdy;
            const _hMinDist = gameObj.hitbox_radius + (this.p.isWave ? waveHitSize : playerSize);
            if (_hDistSq > _hMinDist * _hMinDist) continue;
          }
          if (this.breakabletheblock(gameObj)) {
            continue;
          }
          this.killPlayer();
          return;
        } else if (_colType === slopeType) {
          const flippedBefore = this.p.gravityFlipped;
          const seated = this._collidedWithSlope(gameObj, pieceWidth, this.p.isWave ? waveHitSize : playerSize);
          playersY = this.p.y;
          if (seated === 'dead') return;
          if (seated === 'seat') {
            seatedRamp = gameObj;
            this._rampSupports(gameObj);
            passRectHalf = this.p.isWave ? waveHitSize : playerSize;
          }
          if (this.p.gravityFlipped !== flippedBefore) _boostedThisStep = true;
          continue;
        } else if (_colType === solidType) {
          if (_hasCircleHitbox) {
            left = gameObj.x - gameObj.hitbox_radius; right = gameObj.x + gameObj.hitbox_radius;
            top = gameObj.y - gameObj.hitbox_radius; bottom = gameObj.y + gameObj.hitbox_radius;
          }
          const flippedBefore = this.p.gravityFlipped;
          const hit = this._collideSolid(gameObj, pieceWidth, left, right, top, bottom, motion, playersLastY);
          playersY = this.p.y;
          if (hit === 'dead') return;
          if (hit === 'ground') {
            _0x30410f = true;
            this._groundColliderId = gameObj._eeObjectId;
          }
          if (this.p.gravityFlipped !== flippedBefore) _boostedThisStep = true;
        }
      }
    }
    if (this._slopeContactThisTick && seatedRamp) {
      // A contacted ramp owns its seat even below the world floor. Native
      // collisionCheckObjects skips that floor after a slope contact.
      if (this._groundColliderId === null) this.p.onCeiling = !seatedRamp.slopeSolidBelow;
      this._onSlopeAngle = this._activeSlopeAngle = this._prevSlopeAngle;
      this._activeSlopeObj = seatedRamp;
      _0x30410f = true;
    }
    if (this.p.collideTop !== 0 && this.p.collideBottom !== 0) {
      // Two faces closer than 0.7 of the body crush it, unless it already
      // passed the head face on this tick and the last.
      const gap = Math.abs(this.p.collideTop - this.p.collideBottom), face = this.p.collideTop;
      const past = gap === 0 || (this.p.gravityFlipped ? face > this.p.y && face > this.p.lastY : this.p.y > face && this.p.lastY > face);
      if (!past && (this.p.isWave ? waveHitSize : playerSize) * 1.4 > gap) {
        if (this._noclipEnabled()) this.p.diedThisFrame = true;
        else {
          this.killPlayer();
          return;
        }
      }
    }
    if (this._followMovingGround(pieceWidth, this.p.isWave ? waveHitSize : playerSize, playersLastY)) _0x30410f = true;
    if (this.p.isDead) return;
    let _0x3020c8 = this._gameLayer.getFloorY();
    const iscube = !this.p.isFlying && !this.p.isBall && !this.p.isWave && !this.p.isUfo && !this.p.isSpider;
    // The level floor/ceiling seat the dart by its 20 x 20 (mini 12) body, not
    // its 10 x 10 contact box: native normal dart rests at y 100, mini at 96.
    const _effectiveSize = this.p.isWave ? (this.p.isMini ? 12 : 20) : playerSize;
    if (!_0x30410f && !_boostedThisStep && !(skipFlyBounds && !iscube)) {
      let gravCeilY = this._gameLayer.getCeilingY();

      if (!_0x30410f && !_boostedThisStep) {
        // checkCollisions 31b20d: only a body below the floor line hits it;
        // a dart reaching it exactly keeps its speed for that tick.
        if (this.p.y < _0x3020c8 + _effectiveSize || _restSeatedOnFloor && this.p.y <= _0x3020c8 + _effectiveSize) {
          if (!this.p.gravityFlipped || !iscube) {
            this.p.y = _0x3020c8 + _effectiveSize;
            // 31b412..31b441: a ship/swing moving out of the floor keeps
            // its velocity and ground flag when the corridor clamps it.
            if (!(this.p.isFlying || this.p.isSwing) || this.p.yVelocity <= 0) this.hitGround();
            if (this.p.gravityFlipped) this.p.onCeiling = true;
          } else {
            // checkCollisions 31b20d..31b3b1: an upside-down cube or robot
            // sunk into the level floor (resting exactly on it is no hit) dies
            // unless it flipped or changed mode in the last 0.2 s; then it
            // rests there with no speed, not grounded.
            const now = (this._scene?._physicsFrame ?? 0) / 240;
            if (now - (this.p._lastFlipTime ?? -Infinity) < 0.2 || now - (this.p._modeChangeTime ?? -Infinity) < 0.2) {
              this.p.y = _0x3020c8 + _effectiveSize;
              this.p.yVelocity = 0;
              this.p.onGround = false;
            } else if (this._noclipEnabled()) {
              this.p.diedThisFrame = true;
            } else {
              this.killPlayer();
              return;
            }
          }
        }

        if (gravCeilY !== null) {
          if (this.p.y >= gravCeilY - _effectiveSize) {
            if (this.p.gravityFlipped) {
              this.p.y = gravCeilY - _effectiveSize;
              this.hitGround();
              this.p.onCeiling = true;
            }
          }
        }
      }
      if (!this.p.gravityFlipped && !this._noclipEnabled() && this.p.y < _0x3020c8 - 30) {
        this.p.y = _0x3020c8 + _effectiveSize;
        this.p.yVelocity = 0;
        this.hitGround();
      }
      if (this.p.gravityFlipped) {
        let gravCeilY = this._gameLayer.getCeilingY();
        if (gravCeilY !== null) {
          if (this.p.y >= gravCeilY - _effectiveSize) {
            this.p.y = gravCeilY - _effectiveSize;
            this.hitGround();
            this.p.onCeiling = true;
          }
          if (!this._noclipEnabled() && this.p.y > gravCeilY + 30) {
            this.p.y = gravCeilY - _effectiveSize;
            this.p.yVelocity = 0;
            this.hitGround();
            this.p.onCeiling = true;
          }
        }
      }
    }
    let _0x496456 = this._gameLayer.getCeilingY();
    if (!skipFlyBounds && !_teleportedThisStep && !_boostedThisStep && _0x496456 !== null && this.p.y >= _0x496456 - _effectiveSize && !iscube) {
      this.p.y = _0x496456 - _effectiveSize;
      if (!(this.p.isFlying || this.p.isSwing) || this.p.yVelocity >= 0) this.hitGround();
      this.p.onCeiling = true;
    }
    const maximumY = (this._gameLayer.maxGameplayY ?? 5400) + (this.p.isMini ? 12 : 0);
    if (this.p.y > maximumY) {
      this.killPlayer();
      return;
    }
    if (this._ignoreTeleportUntilClear && !_touchingTeleportDuringRespawnIgnore) {
      this._ignoreTeleportUntilClear = false;
    }
    if (this._slopeContactThisTick) {
      this._slopeContactTime = this._slopeRiding
        ? (this._slopeContactTime ?? (this._slopeContactFrames || 0) / 240) + (this._slopeStepSeconds ?? 1 / 240) : 0;
      this._slopeContactFrames = this._slopeRiding ? (this._slopeContactFrames || 0) + 1 : 0;
      this._slopeRiding = true;
      this._slopeExitVel = this._slopeLaunch;
    } else if (this._slopeRiding) {
      this._slopeRiding = false;
      this._applySlopeExitVelocity();
      // postCollision (4ebce2..4ebcf6) forgets the ride's rate, speed and ramp.
      this._slopeExitVel = null;
      this._slopeRate = this._slopeLaunch = 0;
      this._prevSlopeAngle = null;
      this._prevSlopeObj = null;
    }
    this._skipSlopeExit = false;
    // Ship, UFO and swing keep m_isOnGround after the support leaves (native
    // synthetic floor drops; MK2 X7938 UFO falls with ground set, so a
    // descending ceiling still meets its head). Spider, ball and cube clear.
    if (this.p.isWave || this.p.isSpider) {
      const _0x354b7c = this.p.y <= _0x3020c8 + _effectiveSize;
      const _0xdc296 = _0x496456 !== null && this.p.y >= _0x496456 - _effectiveSize;
      if (!_0x30410f && !_0x354b7c && this.p.collideTop === 0 && !_0xdc296) {
        this.p.onGround = false;
      }
    }
    this._launchFromMovingFace();
    // boostPlayer / bumpPlayer activate CCMotionStreak for grounded modes
    // too. Keep it through the flight arc; landing stops new points while
    // the existing 0.3-second strip expires naturally.
    if (_boostedThisStep && !this.p.onGround) this.p.jumpTrailActive = true;
    this._lastCollisionWorldX = _teleportedThisStep ? (this._worldX() ?? pieceWidth) : pieceWidth;
    this._lastCollisionWorldY = this.p.y;
    this.p.wasUpKeyDown = this.p.upKeyDown;
    if (this.p.diedThisFrame == true && window.noClip){
      this.noclipStats.deathFrames++;
      const cfg=window.GDHacks?.state||{},flash=this._scene.noclipFlash;
      if(cfg.noclipTint&&flash){
        flash.setFillStyle(parseInt((cfg.noclipTintColor||'#ff0000').slice(1),16));
        this._scene.tweens.killTweensOf(flash);
        this._scene.tweens.add({targets:flash,alpha:{from:Math.max(0,Math.min(1,(cfg.noclipTintOpacity??90)/100)),to:0},
          duration:Math.max(1000/240,(cfg.noclipTintTime||0)*1000),ease:'Linear'});
      }
      if (this.p.diedLastFrame == false){
        this.noclipStats.deaths++;
      }
    }
    if (this.noclipStats.totalFrames > 0) {
      const safeFrames = this.noclipStats.totalFrames - this.noclipStats.deathFrames;
      this.noclipStats.accuracy = (safeFrames / this.noclipStats.totalFrames) * 100;
    }
    this.p.diedLastFrame = this.p.diedThisFrame;
  }
  predictTrajectory(pressed, iterations=300) {
    // Like Eclipse: simulate the real player against a snapshot of solids,
    // hazards and slopes. Interactive objects and trigger effects stay idle.
    const source=this,realScene=this._scene,realLevel=this._gameLayer,frame=realLevel.gameplayState;
    pressed=pressed&&!realLevel.logicState?.controlsDisabled?.(this.p===realScene._state2?2:1);
    const sim=Object.assign(Object.create(Object.getPrototypeOf(this)),this);
    for(const [key,value] of Object.entries(sim)){
      if(value instanceof Set)sim[key]=new Set(value);
      else if(value instanceof Map)sim[key]=new Map(value);
      else if(Array.isArray(value))sim[key]=value.slice();
    }
    sim.p=Object.assign(Object.create(Object.getPrototypeOf(this.p)),structuredClone(this.p));
    sim.noclipStats={totalFrames:0,deathFrames:0,deaths:0,accuracy:100};
    const scene=Object.assign(Object.create(realScene),{_state:sim.p,_state2:null,_player:sim,_isDual:false,
      _playerWorldX:this._worldX(),_localPhysicsActive:!!frame?.rotated,_spaceWasDown:pressed,
      input:{activePointer:{isDown:pressed}},_physicsFrame:realScene._physicsFrame,_fixedTickActive:true,_editorPlaytestActive:true});
    if(frame?.rotated){const p=frame.toLocal(scene._playerWorldX,sim.p.y);scene._playerWorldX=p.x;sim.p.y=p.y;sim.p.lastY=p.y;}
    const level=Object.create(realLevel),colliders=new Map();
    const copy=o=>{if(!colliders.has(o)){const shape=frame?.rotated?frame.localCollider(o):o;
      colliders.set(o,Object.assign(Object.create(Object.getPrototypeOf(o)),shape));}return colliders.get(o);};
    const eligible=o=>[solidType,hazardType,slopeType].includes(o.type);
    level._scene=scene;
    level.getNearbySectionObjects=x=>{const w=frame?.rotated?frame.toWorld(x,sim.p.y):{x};
      return realLevel.getNearbySectionObjects(w.x).filter(eligible).map(copy);};
    level.getSpiderSearchObjects=(x,from,to,half)=>{
      if(frame?.rotated)return level.getNearbySectionObjects(x);
      return (realLevel.getSpiderSearchObjects?.(x,from,to,half)||realLevel.getNearbySectionObjects(x)).filter(eligible).map(copy);};
    if(frame?.rotated){level.getFloorY=()=>-Infinity;level.getCeilingY=()=>null;}
    level.checkTouchToggleTriggers=()=>{};level.logicState={event(){},landing(){},playerHidden(){return false;},controlsDisabled(){return false;},options:{}};
    sim._scene=scene;sim._gameLayer=level;
    sim._noclipEnabled=()=>false;sim.killPlayer=()=>{sim.p.isDead=true;};sim.breakabletheblock=()=>false;
    sim._spawnSpiderTeleportEffects=()=>{};sim._orbpadHitEffect=()=>{};sim._syncOtherDualGravityForBlueBoost=()=>{};
    sim.playGravityEffect=()=>{};
    sim._landEmitter1=sim._landEmitter2={explode(){}};
    sim._streak={start(){},stop(){},reset(){}};sim._waveTrail={start(){},stop(){},reset(){}};
    sim._touchedRings=[];sim._potentialSlopes=new Set();sim._multiContacts=new Set();
    sim._lastCollisionWorldX=scene._playerWorldX;sim._lastCollisionWorldY=sim.p.y;
    sim.p.upKeyPressed=pressed&&!this.p.upKeyDown;sim.p.upKeyDown=pressed;sim.p.queuedHold=pressed;sim.p._holdDead=false;
    if(pressed&&window.jumpHack)sim.p.onGround=sim.p.canJump=true;
    const world=()=>frame?.rotated?frame.toWorld(scene._playerWorldX,sim.p.y):{x:scene._playerWorldX,y:sim.p.y};
    const points=[world()],dt=Math.fround(.25*Math.fround(d));
    for(let i=0;i<Math.min(1000,iterations)&&!sim.p.isDead;i++){
      sim.p.lastY=sim.p.y;scene._physicsFrame++;
      sim.updateJump(dt);
      const dx=.25*playerSpeed*Math.fround(d)*(frame?.speedScale??1);
      sim.p.y=gdAdvancePosition(sim.p.y,sim.p.isDashing?sim.p.dashSlope*dx:sim.p.yVelocity*(sim.p.isWave?.25:dt),frame?.rotated?0:180);
      scene._playerWorldX=gdAdvancePosition(scene._playerWorldX,dx*(sim.p.isGoingLeft?-1:1));
      sim.checkCollisions(scene._playerWorldX-centerX);points.push(world());
      sim.p.upKeyPressed=false;
    }
    return {points,dead:sim.p.isDead};
  }
  drawHitboxes(graphics, camX, camY) {
    graphics.clear();
    const level=this._gameLayer, scene=this._scene, half=this._collisionHalfSize();
    const cfg=window.GDHacks?.state || {};
    // CCDrawNode's border parameter is a radius (both sides of the edge).
    const border=Math.max(.02, Number(cfg.hitboxBorder ?? .25)*4);
    const fillAlpha=cfg.hitboxFillEnabled===true?Number(cfg.hitboxFill ?? .25):0;
    const defaults={hitboxSolid:'#003fff',hitboxInner:'#00ff33'};
    const color=(name,fallback)=>cfg.hitboxCustomColors?parseInt(String(cfg[name]||defaults[name]||fallback.toString(16)).replace('#',''),16):fallback;
    const style=(colour,alpha=1)=>{graphics.lineStyle(border,colour,alpha);graphics.fillStyle(colour,alpha*fillAlpha);};
    const mirror=scene?._getMirrorVisualScale?.() ?? 1, mirrorCenter=screenWidth/2;
    // These are pre-camera coordinates, just like GDRenderer's vertices.
    // The world camera then applies the same static offset, rotation and zoom.
    const container=level.container;
    let shakeX=0,shakeY=0;
    if(container) {
      if(Math.abs(mirror)>1e-4)shakeX=mirrorCenter+(container.x-mirrorCenter)/mirror+camX;
      shakeY=(Number(container.y)||0)-camY;
    }
    const point=(x,y,scenery=false)=>({
      x:mirrorCenter+mirror*(x-camX+(scenery?shakeX:0)-mirrorCenter),
      y:b(y)+camY+(scenery?shakeY:0)
    });
    const polygon=(vertices,scenery=false)=>{
      if(!vertices.length)return;
      const first=point(vertices[0][0],vertices[0][1],scenery);
      graphics.beginPath();graphics.moveTo(first.x,first.y);
      for(let i=1;i<vertices.length;i++){const p=point(vertices[i][0],vertices[i][1],scenery);graphics.lineTo(p.x,p.y);}
      graphics.closePath();if(fillAlpha>0)graphics.fillPath();graphics.strokePath();
    };
    const rectangle=(x,y,hw,hh,rotation=0,scenery=false)=>{
      const co=Math.cos(rotation),si=Math.sin(rotation);
      polygon([[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([u,v])=>[x+co*u-si*v,y+si*u+co*v]),scenery);
    };
    const circle=(x,y,r,scenery=false)=>{
      // A mirror transition can squash X, so a polygon follows the rendered
      // circle through that transition instead of retaining an unscaled disc.
      if(Math.abs(Math.abs(mirror)-1)<1e-8){const p=point(x,y,scenery);if(fillAlpha>0)graphics.fillCircle(p.x,p.y,r);graphics.strokeCircle(p.x,p.y,r);}
      else polygon(Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return[x+r*Math.cos(a),y+r*Math.sin(a)];}),scenery);
    };
    if(this!==scene?._player2) {
      const seen=new Set(),query=level.getNearbySectionObjects(scene?._playerWorldX??camX+centerX);
      for(const obj of query) {
        if(!obj||seen.has(obj)||obj._eeDisabled||obj.noTouch||obj._eeUIObject)continue;
        seen.add(obj);
        // updateDebugDraw (3169c0): hazards red, solids and ramps blue, passable
        // blocks cyan, and every object the body activates green. The drawn
        // box is the contact box: a solid never turns, an oblique object does.
        const colour=obj.type===slopeType?color('hitboxSolid',0x0000ff):obj.type===hazardType?color('hitboxDanger',0xff0000):
          obj.type===solidType?(obj.passable?0x00ffff:color('hitboxSolid',0x0000ff)):color('hitboxOther',0x00ff00);
        if(!(obj.w>0&&obj.h>0)&&!(obj.hitbox_radius>0))continue;
        style(colour);
        const angle=obj.rotationDegrees||0,oblique=obj.type!==solidType&&obj.type!==slopeType&&Math.fround(angle)%90!==0;
        const quarter=!oblique&&Math.abs(Math.abs(Math.fround(angle))-180)===90;
        if(obj.hitbox_radius>0&&obj.circleMatrix){
          const [a,b,c,d]=obj.circleMatrix,r=obj._circleBaseRadius??obj.hitbox_radius;
          polygon(Array.from({length:48},(_,i)=>{const t=i*Math.PI/24,x=Math.cos(t)*r,y=Math.sin(t)*r;return[obj.x+a*x+c*y,obj.y+b*x+d*y];}),true);
        }else if(obj.hitbox_radius>0)circle(obj.x,obj.y,obj.hitbox_radius,true);
        else if(obj.type===slopeType&&!obj.slopeIsFilled) {
          // The actual triangle is independent of player gravity. Sampling a
          // diagonal and guessing its third corner made the outline flip.
          polygon([[obj.x+obj.hypoAx,obj.y+obj.hypoAy],[obj.x+obj.hypoBx,obj.y+obj.hypoBy],[obj.x+obj.rightAx,obj.y+obj.rightAy]],true);
        } else if(obj.shape&&obj.type!==solidType)polygon(obj.shape.map(([x,y])=>[obj.x+x,obj.y+y]),true);
        else if(oblique)rectangle(obj.x,obj.y,obj.w/2,obj.h/2,-angle*Math.PI/180,true);
        else rectangle(obj.x,obj.y,(quarter?obj.h:obj.w)/2,(quarter?obj.w:obj.h)/2,0,true);
      }
    }
    // Eclipse draws getObjectRect, then getObjectRect(.25) / mini(.4).
    // These diagnostic rectangles are independent of the fatal collision box.
    const body=(x,y,size,rotation,wave,mini,alpha)=>{
      const outer=wave?(mini?6:10):size,inner=outer*(mini?.4:.25);
      style(color('hitboxPlayer',0xff0000),alpha);rectangle(x,y,outer,outer);
      if(Math.abs(Math.sin(2*rotation))>1e-3){style(color('hitboxRotated',0xffff00),alpha);rectangle(x,y,outer,outer,-rotation);}
      style(color('hitboxInner',0x00ff00),alpha);rectangle(x,y,inner,inner);
    };
    const frame=level.gameplayState;
    const world=scene?._localPhysicsActive?frame.toWorld(this._worldX(),this.p.y):{x:this._worldX(),y:this.p.y};
    if(!cfg.hitboxHidePlayer)body(world.x,world.y,half,frame?.visualAngle(this._rotation)??this._rotation,this.p.isWave,this.p.isMini,1);
    if(window.showHitboxTrail&&!cfg.hitboxHidePlayer) {
      const trail=this._hitboxTrail||[],mini=p=>p.isMini??p.size<25;
      const length=Math.max(1,Math.min(2000,Number(cfg.hitboxTrailLength)||240));
      const samples=trail.slice(-length);
      // Eclipse submits the entire outer trail before the inner trail.
      // Interleaving both per tick painted over the preceding green boxes.
      style(color('hitboxPlayer',0xff0000));
      for(const p of samples){const outer=p.isWave?(mini(p)?6:10):(p.size??half);rectangle(p.x,p.y,outer,outer);}
      style(color('hitboxInner',0x00ff00));
      for(const p of samples){const outer=p.isWave?(mini(p)?6:10):(p.size??half),inner=outer*(mini(p)?.4:.25);rectangle(p.x,p.y,inner,inner);}
    }
  }
  playEndAnimation(_0x24408e, _0x281588, _0x54bbf4) {
    this._endAnimating = true;
    this._hitboxTrail = [];
    this._hitboxGraphics.clear();
    const _0x3729ef = this._scene;
    const _0x568b25 = _0x54bbf4 || 240;
    const _0x4a45d7 = this._worldX();
    const _0x501b73 = this.p.y;
    const _0x457676 = _0x24408e + 100;
    const _0x3ade39 = _0x568b25 - 40;
    const _0x1295ea = _0x4a45d7;
    const _0x47ae60 = _0x501b73;
    const _0x1f2e19 = _0x4a45d7 + 80;
    const _0x8bc9f4 = _0x568b25 + 300;
    const _0x11b580 = [
      this._playerSpriteLayer, this._playerGlowLayer, this._playerOverlayLayer, this._playerExtraLayer,
      this._ballSpriteLayer, this._ballGlowLayer, this._ballOverlayLayer,
      this._waveSpriteLayer, this._waveOverlayLayer, this._waveExtraLayer, this._waveGlowLayer,
      this._shipSpriteLayer, this._shipGlowLayer, this._shipOverlayLayer, this._shipExtraLayer,
      ...(this._birdLayers || []),
      ...(this._spiderLayers || []),
      ...(this._robotLayers || [])
    ].filter(_0x3e9c62 => _0x3e9c62 && _0x3e9c62.sprite && _0x3e9c62.sprite.visible).map(_0x5cedeb => _0x5cedeb.sprite);
    this._startPercent = this._scene._getCurrentPercent();
    this._particleEmitter.stop();
    this._flyParticleEmitter.stop();
    this._flyParticle2Emitter.stop();
    this._shipDragEmitter.stop();
    this.p.isDashing = false;
    this.p.dashYVelocity = 0;
    if (this._dashAnimationSprite) this._dashAnimationSprite.setVisible(false);
    this._dashAnimationFrame = 0;
    this._dashAnimationTimer = 0;
    this._hideRobotJumpFlame();
    this._robotJumpFlameActive = false;
    this._robotJumpFlamePulse = 0;
    this._robotJumpFlameFadeInTimer = 0;
    this._clearSpiderTeleportEffects();
    const _0x154798 = this.p.isFlying;
    const _0x3a2c8e = this.p.isSpider;
    const _0x37f14a = this.p.isRobot;
    const _0x12bfe9 = _0x3a2c8e || _0x37f14a;
    const _0x3793a4 = [this._shipSpriteLayer, this._shipGlowLayer, this._shipOverlayLayer, this._shipExtraLayer];
    const _0xbd676f = [this._playerSpriteLayer, this._playerGlowLayer, this._playerOverlayLayer, this._playerExtraLayer];
    const _toEndScreenX = worldX => {
      const screenX = worldX - _0x3729ef._cameraX;
      return this.p.mirrored ? screenWidth - screenX : screenX;
    };
    const _0x476284 = (_0x12bfe9 && Number.isFinite(this._lastScreenX)) ? this._lastScreenX : _toEndScreenX(_0x4a45d7);
    const _0x1ed1ce = (_0x12bfe9 && Number.isFinite(this._lastScreenY)) ? this._lastScreenY : (b(_0x501b73) + _0x3729ef._cameraY);
    const _0x4d5f0d = _0x476284;
    const _0x3e4581 = _0x1ed1ce;
    const _0x6f5a9d = _toEndScreenX(_0x1f2e19);
    const _0x31cb6d = b(_0x8bc9f4) + _0x3729ef._cameraY;
    const _0x46e2df = _toEndScreenX(_0x457676);
    const _0x23fbf2 = b(_0x3ade39) + _0x3729ef._cameraY;
    const _0x3fc5a5 = _0x11b580.map(_0x5c0e81 => {
      let _0x5cbb0a = 0;
      let _0x455d13 = 0;
      if (_0x12bfe9) {
        _0x455d13 = _0x5c0e81.x - _0x476284;
        _0x5cbb0a = _0x5c0e81.y - _0x1ed1ce;
      } else if (_0x154798) {
        const _0xff16eb = _0x3793a4.some(_0x40ef1e => _0x40ef1e && _0x40ef1e.sprite === _0x5c0e81);
        const _0x4fdb53 = _0xbd676f.some(_0x4ef5b5 => _0x4ef5b5 && _0x4ef5b5.sprite === _0x5c0e81);
        if (_0xff16eb) {
          _0x5cbb0a = 10;
        } else if (_0x4fdb53) {
          _0x5cbb0a = -10;
        }
      }
      return {
        spr: _0x5c0e81,
        localX: _0x455d13,
        localY: _0x5cbb0a,
        startRotation: _0x5c0e81.rotation || 0
      };
    });
    const _0x3e35e7 = this._streak;
    const _0x51c4a8 = {
      val: 0
    };
    _0x3729ef.tweens.add({
      targets: _0x51c4a8,
      val: 1,
      duration: 1000,
      ease: _0x23df59 => Math.pow(_0x23df59, 1.2),
      onUpdate: () => {
        const spriteWidth = _0x51c4a8.val;
        const _0x2478d6 = (1 - spriteWidth) ** 3 * _0x1295ea + (1 - spriteWidth) ** 2 * 3 * spriteWidth * _0x1295ea + (1 - spriteWidth) * 3 * spriteWidth ** 2 * _0x1f2e19 + spriteWidth ** 3 * _0x457676;
        const _0x148e69 = (1 - spriteWidth) ** 3 * _0x47ae60 + (1 - spriteWidth) ** 2 * 3 * spriteWidth * _0x47ae60 + (1 - spriteWidth) * 3 * spriteWidth ** 2 * _0x8bc9f4 + spriteWidth ** 3 * _0x3ade39;
        let _0x3d0365 = _toEndScreenX(_0x2478d6);
        let _0x3790a9 = b(_0x148e69) + _0x3729ef._cameraY;
        if (_0x12bfe9) {
          _0x3d0365 = (1 - spriteWidth) ** 3 * _0x4d5f0d + (1 - spriteWidth) ** 2 * 3 * spriteWidth * _0x4d5f0d + (1 - spriteWidth) * 3 * spriteWidth ** 2 * _0x6f5a9d + spriteWidth ** 3 * _0x46e2df;
          _0x3790a9 = (1 - spriteWidth) ** 3 * _0x3e4581 + (1 - spriteWidth) ** 2 * 3 * spriteWidth * _0x3e4581 + (1 - spriteWidth) * 3 * spriteWidth ** 2 * _0x31cb6d + spriteWidth ** 3 * _0x23fbf2;
        }
        const _0x1cb4d3 = 1 - spriteWidth * spriteWidth;
        const _0x5c8b4a = _0x12bfe9 ? (Math.PI * 2 * Math.pow(spriteWidth, 1.5)) : 0;
        const _0x1d2e2f = _0x12bfe9 ? _0x5c8b4a : (_0x3fc5a5.length ? _0x3fc5a5[0].spr.rotation : 0);
        const _0xd3cb2a = Math.cos(_0x1d2e2f);
        const _0x2f86c2 = Math.sin(_0x1d2e2f);
        this._scene._interpolatedPercent = this._startPercent + (100 - this._startPercent) * spriteWidth;
        for (const _0x2b394a of _0x3fc5a5) {
          if (!_0x2b394a?.spr) continue;
          const _0x4cc974 = _0x2b394a.localX || 0;
          const _0x522a2c = _0x2b394a.localY || 0;
          const _0xbd4f26 = _0x4cc974 * _0xd3cb2a - _0x522a2c * _0x2f86c2;
          const _0x5b67fe = _0x4cc974 * _0x2f86c2 + _0x522a2c * _0xd3cb2a;
          _0x2b394a.spr.setPosition(_0x3d0365 + _0xbd4f26, _0x3790a9 + _0x5b67fe);
          if (_0x12bfe9) _0x2b394a.spr.rotation = (_0x2b394a.startRotation || 0) + _0x5c8b4a;
          _0x2b394a.spr.setAlpha(_0x1cb4d3);
        }
        _0x3e35e7.setPosition(_0x2478d6, b(_0x148e69));
        this._waveTrail.setPosition(_0x2478d6, b(_0x148e69));
        this.updateInactiveTrails(_0x3729ef._cameraX, _0x3729ef._cameraY, _0x3729ef.game.loop.delta / 1000);
      },
      onComplete: () => {
        this._scene._interpolatedPercent = 100;
        for (const _0x4fce42 of _0x3fc5a5) {
          if (_0x4fce42?.spr) _0x4fce42.spr.setVisible(false);
        }
        _0x3e35e7.stop();
        _0x3e35e7.reset();
        this._waveTrail.stop();
        this._waveTrail.reset();
        _0x281588();
      }
    });
    if (!_0x12bfe9) {
      for (const _0x25f8c5 of _0x11b580) {
        _0x3729ef.tweens.add({
          targets: _0x25f8c5,
          angle: _0x25f8c5.angle + 360,
          duration: 1000,
          ease: _0x228c03 => Math.pow(_0x228c03, 1.5)
        });
      }
    }
  }
  reset() {
    this._blinkHidden=null;this._blinkStart=null;
    this._touchedRings = this._nativeTouchedRings = this._ringContactsThisPass = null;
    this.p._skipFlyBoundsOnce = false;
    this._cleanupExplosion();
    this._endAnimating = false;
    this._lastLandObject = null;
    this._lastXOffset = 0;
    this._resetSlopeState();
    this.stopRotation();
    this.rotateActionRate = 0;
    this._rotation = 0;
    this.p._robotHold = false;
    this._dashSpin = 0;
    this._dashSpinFirstTick = false;
    this._dashFireTime = 0;
    this.p._robotHoldTimer = 0;
    this._lastCameraX = 0;
    this._lastCameraY = 0;
    const _resetWorldX = Number(this._worldX());
    const _resetWorldY = Number(this.p?.y);
    this._lastCollisionWorldX = Number.isFinite(_resetWorldX) ? _resetWorldX : null;
    this._lastCollisionWorldY = Number.isFinite(_resetWorldY) ? _resetWorldY : null;
    // A fresh attempt must activate a portal overlapping the spawn point
    // (Blackfire starts inside an invisible teleport). Only a practice
    // respawn suppresses a portal already occupied by the checkpoint.
    this._ignoreTeleportUntilClear = false;
    this._multiContacts = new Set();
    this.setCubeVisible(true);
    this.setShipVisible(false);
    this.setBallVisible(false);
    this.setWaveVisible(false);
	  this.setBirdVisible(false);
    this.p.isSwing = false; this.setSwingVisible(false);
    this.setSpiderVisible(false);
    this.setRobotVisible(false);
    for (const _0x5a0fa9 of this._allLayers) {
      if (_0x5a0fa9) {
        _0x5a0fa9.sprite.setAlpha(1);
        if (_0x5a0fa9.sprite.scaleY < 0) {
          _0x5a0fa9.sprite.scaleY = Math.abs(_0x5a0fa9.sprite.scaleY);
        }
      }
    }
    for (const _0x1e656c of this._playerLayers) {
      if (_0x1e656c) {
        _0x1e656c.sprite.setScale(1);
      }
    }
    this._particleEmitter.stop();
    this._particleActive = false;
    this._flyParticleEmitter.stop();
    this._flyParticleActive = false;
    this._flyParticle2Emitter.stop();
    this._flyParticle2Active = false;
    this._shipDragEmitter.stop();
    this._shipDragActive = false;
    if (this._dashAnimationSprite) this._dashAnimationSprite.setVisible(false);
    this._dashAnimationFrame = 0;
    this._dashAnimationTimer = 0;
    this._hideRobotJumpFlame();
    this._robotJumpFlameActive = false;
    this._robotJumpFlamePulse = 0;
    this._robotJumpFlameFadeInTimer = 0;
    this._clearSpiderTeleportEffects();
    this._streak.stop();
    this._streak.reset();
    this._waveTrail.stop();
    this._waveTrail.reset();
    this._hitboxTrail = [];
    if (this._hitboxGraphics?.clear) this._hitboxGraphics.clear();
  }
}
