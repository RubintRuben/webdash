// Deterministic regression tests for the GD trigger/renderer integration.
// Uses the actual level parser, object definitions, collision and colour code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console, TextDecoder, TextEncoder, URLSearchParams, structuredClone,
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  location: { search: '' }, localStorage: { getItem: () => null, setItem() {} },
  indexedDB: { open: () => ({}) },
  Phaser: { WEBGL: 2, BlendModes: { ADD: 1, NORMAL: 0 } },
  pako: { inflate: bytes => zlib.unzipSync(bytes) }
});
vm.runInContext('window = globalThis;', context);
for (const file of ['game/allObjects.js', 'utils/config.js', 'game/gd-objects.js', 'game/gd-effect-presets.js', 'core/triggers.js', 'core/gd-particles.js', 'core/gd-shaders.js', 'core/gd-camera.js', 'core/gd-gameplay.js', 'core/gd-logic.js', 'core/gd-keyframes.js', 'core/gd-area.js', 'core/gd-render.js', 'core/gd-gradients.js', 'core/level.js', 'core/player.js', 'core/gd-audio.js', 'core/audio.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/scripts', file), 'utf8'), context, { filename: file });
}
// Renderer tests read the per-frame draw records.
vm.runInContext('GDRenderer.debugItems = true;', context);
vm.runInContext('globalThis.testAPI = { Easing, ColorManager, Collider, parseLevel, parseObject, PlayerObject, PlayerState, AudioManager, WaveTrail, StreakManager };', context);
const { Easing, ColorManager, parseLevel, parseObject } = context.testAPI;
const chain = () => ({ setDepth() { return this; }, setVisible() { return this; }, add() {}, list: [] });
const scene = {
  add: { container: chain, extern: chain },
  events: { on() {}, once() {} },
  game: { renderer: { type: 2 } },
  textures: { exists: () => false },
  _state: { y: 0 }, _playerWorldX: 0, _cameraY: 0
};
context.LevelObject.prototype._buildGround = () => {};
// The renderer applies group moves when it next reads positions (once per
// frame in game); tests read object offsets directly, so apply them at once.
for (const name of ['stepMoveTriggers', 'stepCameraLockMoves', '_translateGroup', 'stepFollowTriggers', 'stepSpawnTriggers']) {
  const original = context.LevelObject.prototype[name];
  if (typeof original !== 'function') continue;
  context.LevelObject.prototype[name] = function (...args) {
    const result = original.apply(this, args);
    if (!this._moveBatch) this.gdRenderer?.flushMoves?.();
    return result;
  };
}
context.LevelObject.prototype._spawnTriggerEditorVisual = () => {};
let passes = 0;
function test(name, run) {
 const camera={x:scene._cameraX,y:scene._cameraY,playerX:scene._playerWorldX,frame:scene._physicsFrame};
 try {run();passes++;console.log('PASS '+name);}
 finally {scene._cameraX=camera.x;scene._cameraY=camera.y;scene._playerWorldX=camera.playerX;scene._physicsFrame=camera.frame;}
}
function near(value, expected, tolerance) { assert.ok(Math.abs(value - expected) < (typeof tolerance === 'number' ? tolerance : 1e-7), `${value} != ${expected}`); }
function fixture(strings, prepareRenderer = null) {
  const level = new context.LevelObject(scene, { _v: 0 });
  scene._colorManager = new ColorManager();
  prepareRenderer?.(level.gdRenderer);
  context.levelObjects = strings.map(parseObject);
  level._spawnLevelObjects(context.levelObjects);
  return level;
}
const block = '1,1,2,100,3,100,57,1';
const move = '1,901,2,0,3,0,51,1,28,3000,29,60,10,1';

test('wave trails keep only turning points, draw GD widths and fade out when the mode ends', () => {
  const trailScene = { add: { extern: () => ({setBlendMode(){}}) } };
  const make = () => {
    const t = new context.testAPI.WaveTrail(trailScene, 0xff8000);
    let draws=0, triangles=[];
    t._gfx.clear=()=>{draws++;triangles=[];};
    t._gfx.fillStyle=()=>t._gfx;
    t._gfx.fillTriangle=(...p)=>triangles.push(p);
    t.start(); return {t,get draws(){return draws;},get triangles(){return triangles;}};
  };
  const every=make(), final=make();
  for(let i=0;i<2400;i++) for(const {t} of [every,final]) {
    t.setPosition(i*3,Math.abs(i%80-40)*3);
    t.update(1/240,t===every.t||i%4===3);
  }
  // HardStreak keeps a vertex per turn (every 40 ticks), not per tick, and
  // nothing expires with age
  assert.ok(final.t._pts.length>=60&&final.t._pts.length<=62);
  assert.deepEqual(final.t._pts,every.t._pts);
  assert.deepEqual(final.triangles,every.triangles);
  assert.equal(every.draws,final.draws*4);
  // pulse = (audioScale - 0.1) * 2.1 + 0.4: at 0.5 the colour pass is
  // 6 * 1.24 GD wide, i.e. a 7.44 web half-width on a straight run
  final.t.setAudioScale(0.5); final.t.update(0);
  const [ax,ay,bx,by]=final.triangles[0];
  near(Math.hypot(bx-ax,by-ay)/2,7.44);
  final.t.update(1); assert.ok(final.t._pts.length>=60);
  final.t.fadeOut(0.2); final.t.update(0.1); near(final.t._opacity,0.5);
  final.t.update(0.11); assert.equal(final.t._pts.length,0);
});

test('wave trail suppresses the tiny overlapping head after a turn until it clears the joint', () => {
  const t = new context.testAPI.WaveTrail({ add:{ extern:()=>({setBlendMode(){}}) } }, 0xff8000);
  let triangles = 0;
  t._gfx.clear = () => { triangles = 0; };
  t._gfx.fillStyle = () => t._gfx;
  t._gfx.fillTriangle = () => { triangles++; };
  t.start(); t.setAudioScale(0.5);
  t.setPosition(0, 0); t.update(0);
  t.setPosition(100, 100); t.update(0);
  assert.equal(triangles, 4);
  t.setPosition(101, 99); t.update(0);
  assert.equal(triangles, 4);
  t.setPosition(110, 90); t.update(0);
  assert.equal(triangles, 8);
});

test('all easing curves have finite samples and correct endpoints', () => {
  for (let type = 0; type <= 18; type++) {
    assert.equal(Easing.sample(type, 2, 0), 0);
    assert.equal(Easing.sample(type, 2, 1), 1);
    for (let i = 1; i < 100; i++) assert.ok(Number.isFinite(Easing.sample(type, 2, i / 100)));
  }
  near(Easing.sample(4, 0.45, 0.5), 0.5);
  near(Easing.sample(4, 0.45, 0.75), 1 - Easing.sample(4, 0.45, 0.25));
});

// The renderer's culling grid: obj is listed in the cell whose X index is sx.
const inCell = (r, obj, sx) => !!r.grids[obj._class]?.get(obj._cell)?.includes(obj._rank) && Math.floor(obj._cell / 65536) - 32768 === sx;

test('move triggers keep graphics and colliders together across distant sections', () => {
  const l = fixture([block, move]);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.5);
  const gd = l.gdObjects[0], col = l.objects[0];
  near((gd.x + gd.offX) * 2, col.x);
  near((gd.y + gd.offY) * 2, col.y);
  near(gd.offX, 1500); near(gd.offY, 30);
  assert.ok(inCell(l.gdRenderer, gd, 16));
  const visible = [];
  const r = l.gdRenderer;
  r.colorManager = scene._colorManager;
  r._prepareObject = obj => visible.push(obj);
  r._fastPrepare = rank => visible.push(r._byRank[rank]);
  r._buildVertices = () => {};
  r.setCamera(3000, 0); r.update(0);
  assert.ok(visible.includes(gd), 'moved object must be found by visibility culling');
});

test('rotate uses an invisible GD centre and rotates the matching collider', () => {
  const l = fixture([block, '1,1764,2,100,3,70,57,2', '1,1346,2,0,3,0,51,1,71,2,68,90,10,1']);
  l.checkRotateTriggers(0); l.stepRotateTriggers(1);
  const gd = l.gdObjects[0], col = l.objects[0];
  near(gd.x + gd.offX, 130); near(gd.y + gd.offY, 70);
  // collideObject never reads a solid's angle: only the art turns.
  near(gd.rotOff, 90); near(col.rotationDegrees, 0);
  near((gd.x + gd.offX) * 2, col.x); near((gd.y + gd.offY) * 2, col.y);
});

test('target rotation follows a moving real position indefinitely and preserves its checkpoint references', () => {
  const l = fixture(['1,211,2,100,3,1000,57,293', '1,1764,2,200,3,1100,57,294',
    '1,1346,2,0,51,293,71,293,100,1,401,294,402,90,397,1,10,-1']);
  l.checkRotateTriggers(0); l.stepRotateTriggers(1 / 240);
  near(l.gdObjects[0].rotOff, 135);
  assert.equal(l._activeRotateTweens.length, 1);
  l._translateGroup(294, 0, -200); l.stepRotateTriggers(1 / 240);
  near(l.gdObjects[0].rotOff, 180 - Math.atan2(200, 100) * 180 / Math.PI);
  l._activeRotateTweens = structuredClone(l._activeRotateTweens);
  l._translateGroup(294, 200, 0); l.stepRotateTriggers(1 / 240);
  near(l.gdObjects[0].rotOff, 135);
  near(l.gdObjects[0].x + l.gdObjects[0].offX, 100);
});

test('target moves measure the Area-transformed positions of both ends', () => {
  const l = fixture(['1,211,2,100,3,1000,57,293,274,293', '1,211,2,200,3,1100,57,294,274,294',
    '1,3006,2,0,51,294,71,294,222,1000,241,1,237,40',
    '1,901,2,30,51,293,71,294,100,1']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  l.checkMoveTriggers(60); l.stepMoveTriggers(0); l.stepMoveTriggers(0);
  near(l.gdObjects[0].x + l.gdObjects[0].offX, 240);
  near(l.gdObjects[0].y + l.gdObjects[0].offY, 1100);
});

test('a retracted Free Mode ground remains at the world floor under a rotated static camera', () => {
  const l=fixture([]),c=l.cameraState;c.freeMode=true;
  c.values.zoom=.5;c.values.rotation=30;c.values.staticY=1;
  c.targets.y={point:{x:100,y:1000}};
  l._flyGroundActive=true;l._groundTargetValue=0;
  const high=l._gdGroundLayout();
  assert.ok(high.bottom < -500);near(high.camBottom+high.bottom/high.zoom,2);
  c.targets.y.point.y=70;
  const low=l._gdGroundLayout();assert.ok(low.bottom>0);
  near(low.camBottom+low.bottom/low.zoom,2);
});

test('target rotation supports mirrored objects, copy angle, shortest turns, bounds, easing and spawn remapping', () => {
  const l = fixture(['1,211,2,100,3,100,6,350,5,1,57,1', '1,1764,2,200,3,100,6,10,57,2',
    '1,1346,2,0,51,1,71,1,394,1,401,2,397,1,403,2,10,-1',
    '1,1764,2,100,3,200,57,3']);
  l.checkRotateTriggers(0); l.stepRotateTriggers(1 / 240);
  near(l.gdObjects[0].rotOff, 10); // 350 -> 10 takes the +20 degree turn, half each step.
  const t = l._rotateTriggers[0];
  const remapped = l._remapSpawnedTrigger(t, 'rotate', [[[2, 3]]]);
  assert.equal(remapped.targetRotationGroup, 3);
  const aim = { ...t, useTarget: true, targetRotationMode: false, rotationOffset: 0, directionBounds: [0, 3, 0, 0] };
  const ends = l._rotateTargetEnds(aim);
  near(l._rotateTargetDelta(aim, ends), 45);
});

test('a player-targeted dynamic rotation copies the icon angle including its gameplay frame',()=>{
 const old=scene._player;
 const l=fixture(['1,8,2,3825,3,15,57,77,121,1','1,1346,2,0,51,77,10,-1,138,1,394,1,397,1,402,-90']);
 scene._player={_rotation:Math.PI/3};l.checkRotateTriggers(0);l.stepRotateTriggers(1/240);
 near(l.gdObjects[0].rotOff,-30);
 scene._player._rotation=Math.PI*2/3;l.stepRotateTriggers(1/240);near(l.gdObjects[0].rotOff,30);
 l.gameplayState.u={x:0,y:1};l.gameplayState.v={x:1,y:0};l.stepRotateTriggers(1/240);
 near(l.gdObjects[0].rotOff,60);scene._player=old;
});

test('custom respawn options can be updated, preserved, and explicitly returned to the level default',()=>{
 const l=fixture([]),g=l.logicState;
 g._options({573:'1',574:'3.5',575:'1',576:'1'});near(g.options.respawnTime,3.5);
 assert.equal(g.options.audioOnDeath,true);assert.equal(g.options.noDeathSFX,true);
 const saved=g.capture();g._options({573:'-1',575:'-1',576:'-1'});
 assert.equal(g.options.respawnTime,undefined);assert.equal(g.options.audioOnDeath,false);
 g.restore(saved);near(g.options.respawnTime,3.5);assert.equal(g.options.noDeathSFX,true);
});

test('a dual death sends On Death once, after restoring normal time, and practice restore rearms it',()=>{
 const l=fixture(['1,1812,2,0,51,7,56,1']),g=l.logicState,events=[];l.checkLogicTriggers(0);
 l._toggleGroupTriggered=()=>events.push(g.timeWarp);g.timeWarp=.4;const saved=g.capture();
 g.playerDied();g.playerDied();assert.deepEqual(events,[1]);
 g.restore(saved);g.playerDied();assert.deepEqual(events,[1,1]);
});

test('rotation and scale use a declared group parent instead of averaging the artwork', () => {
  const l = fixture([block, '1,1764,2,100,3,70,34,1,274,2',
    '1,211,2,900,3,800,57,2', '1,1346,2,0,51,1,71,2,68,90']);
  near(l._getRotateTriggerCenter(2).x, 200); near(l._scaleReference({centerGroup:2}).y, 70);
  l.checkRotateTriggers(0); l.stepRotateTriggers(0);
  near(l.gdObjects[0].x + l.gdObjects[0].offX, 130); near(l.gdObjects[0].y + l.gdObjects[0].offY, 70);
  near(l.objects[0].x, 260); near(l.objects[0].y, 140);
  const parent = l._moveGroupParent(2);
  l.gdRenderer.removeObject(parent);
  assert.notEqual(l._moveGroupParent(2), parent, 'a removed group parent invalidates the cached membership');
});

test('scale tweens of one group and centre combine into the same result', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1764,2,130,3,100,57,2',
    '1,2067,2,0,51,1,71,2,150,2,151,2', '1,2067,2,0,51,1,71,2,150,3,151,0.5']);
  l.checkScaleTriggers(0); l.stepScaleTriggers(0);
  const o = l.gdObjects[0];
  near(o.x + o.offX, 130 + 6 * (100 - 130)); near(o.y + o.offY, 100);
  near(o.extraScaleX, 6); near(o.extraScaleY, 1);
  near(l.objects[0].x, (130 + 6 * (100 - 130)) * 2);
});

test('area move uses the native distance value, easing and angle', () => {
  // getAreaObjectValue: X mode, 50 points ahead of the centre over a length
  // of 100 -> 0.5; processAreaMoveGroupAction moves (1 - eased) * distance
  // along angle - 90 degrees (180 -> straight up).
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1764,2,50,3,100,57,2',
    '1,3006,2,0,3,0,51,1,71,2,222,100,218,30,231,180,262,1,263,1,264,1']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  const o = l.gdObjects[0], out = {};
  assert.ok(l.areaState.forObject(o, o.x + o.offX, o.y + o.offY, out));
  near(out.dx, 0); near(out.dy, 15);
  // An edit with the same fields at -99 except the distance retargets it.
  l.areaState.trigger(context.GDAreaState.parse({ uid: -1, groups: [] }, { id: 3011, _raw: { 51: '7', 218: '60' } }));
  l.areaState.lists[0][0].trig.effectID = 7;
  l.areaState.trigger(context.GDAreaState.parse({ uid: -1, groups: [] }, { id: 3011, _raw: { 51: '7', 355: '1', 218: '60',
    222: '-99', 223: '-99', 220: '-99', 221: '-99', 263: '-99', 264: '-99', 282: '-99', 219: '-99', 231: '-99', 232: '-99',
    237: '-99', 238: '-99', 239: '-99', 240: '-99', 233: '-99', 234: '-99', 235: '-99', 236: '-99', 270: '-99', 271: '-99',
    265: '-99', 285: '-99', 275: '-99', 286: '-99', 252: '-99', 253: '-99', 288: '-99' } }));
  l.areaState.step(0);
  l.areaState.forObject(o, o.x + o.offX, o.y + o.offY, out);
  near(out.dy, 30);
});

test('Area Edit distinguishes omitted zeroes from explicitly unchanged -99 values', () => {
  // Native native-area-edit-defaults reads zero in every omitted value slot.
  // Aperture's first circle edit omits length/deadzone to animate both to
  // zero, but explicitly saves -99 for the opacity and other unchanged slots.
  const l=fixture(['1,211,2,100,3,100,57,1', '1,1764,2,0,3,100,57,2',
    '1,3009,2,0,51,1,71,2,222,660,282,1,275,1,57,3']);
  l.checkAreaTriggers(0);l.areaState.step(0);
  const parse=raw=>context.GDAreaState.parse({uid:-1,groups:[]},{id:3014,_raw:raw});
  assert.ok(Array.from(parse({51:'3'}).values).every(v=>v===0));
  const raw={51:'3',10:'2'};
  for(const key of [223,220,221,263,264,218,219,231,232,237,238,239,240,
    233,234,235,236,270,271,265,285,275,286,252,253,288])raw[key]='-99';
  l.areaState.trigger(parse(raw));l.areaState.step(1);
  const inst=l.areaState.lists[3][0];near(inst.v[0],330);near(inst.v[6],.5);near(inst.v[23],1);
  l.areaState.step(1);
  near(inst.v[0],0);near(inst.v[6],0);near(inst.v[23],1);
  const out={},o=l.gdObjects[0];l.areaState.forObject(o,100,100,out);
  near(out.op,1,'the zero-length circle fade releases the artwork');
});

test('Area targets keep their own parent unit when a parent declares overlapping groups', () => {
  const l = fixture(['1,36,2,10,3,1000,57,293,279,1', '1,36,2,20,3,1000,57,293,34,1',
    '1,36,2,100,3,1000,57,293.294,274,293.294,34,1', '1,1,2,200,3,1100,57,293.294.296',
    '1,36,2,100,3,1000,57,295', '1,3008,2,0,3,0,51,294,71,295,222,1000000,233,0.5,235,0.5']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  const o = l.gdRenderer.groups.get(296)[0], out = {};
  l.areaState.forObject(o, 200, 1100, out);
  near(200 + out.dx, 150); near(1100 + out.dy, 1050);
  // Native uses the explicit parent's 34 marker ahead of an older marker,
  // while the separate 279 marker still supplies the distance reference.
  l.areaState.reset();
  l.areaState.trigger(context.GDAreaState.parse({ uid: -1, groups: [] },
    { id: 3008, _raw: {51:'293',71:'295',222:'1000000',233:'0.5',235:'0.5'} }));
  l.areaState.step(0); l.areaState.forObject(o, 200, 1100, out);
  near(200 + out.dx, 150.0045); near(1100 + out.dy, 1050.0045);
});

test('Area editor links use separate pivot and reference markers and preserve Dont Edit Area Parent', () => {
  const l = fixture(['1,36,2,100,3,1000,57,294,108,777,34,1',
    '1,36,2,100,3,900,57,294,108,777,279,1', '1,1,2,200,3,1100,57,294.296,108,777',
    '1,36,2,100,3,1000,57,295', '1,3008,2,0,3,0,51,294,71,295,222,1000000,233,0.5,235,0.5,539,1']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  const o = l.gdRenderer.groups.get(296)[0], out = {};
  l.areaState.forObject(o, 200, 1100, out);
  near(200 + out.dx, 150.005); near(1100 + out.dy, 1050.005);
  const parent = l.gdRenderer.groups.get(294).find(o => o.levelObj.hasAreaParent);
  l.areaState.forObject(parent, 100, 900, out);
  near(out.dx, 0); near(out.dy, 0); near(out.sx, 1); near(out.sy, 1);
});

test('Area scaling stretches linked rotated faces in world axes as the native affine does', () => {
  const l = fixture(['1,36,2,100,3,1000,57,294,108,777,34,1',
    '1,36,2,100,3,900,57,294,108,777,279,1', '1,3807,2,200,3,1100,6,45,57,294.296,108,777',
    '1,36,2,100,3,1000,57,295', '1,3008,2,0,3,0,51,294,71,295,222,1000000,233,1,235,0.5,539,1']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  const o = l.gdRenderer.groups.get(296)[0], out = {}, q = Math.SQRT1_2;
  l.areaState.forObject(o, 200, 1100, out);
  assert.equal(out.linearActive, true);
  near(out.linear[0], q); near(out.linear[1], -q * 0.50005);
  near(out.linear[2], q); near(out.linear[3], q * 0.50005);
  // Native: scaleX/Y=.79058522, rotationX=63.432655, rotationY=26.567345.
  assert.ok(Math.abs(Math.hypot(out.linear[0], out.linear[1]) - 0.79058522) < 1e-6);
});

test('custom enter effects combine native edge distance, XY signs, rotation, scale, fade and tint', () => {
  const l = fixture(['1,1,2,100,3,100,343,3',
    '1,3017,2,0,344,3,222,200,241,1,237,80,239,40',
    '1,3018,2,0,344,3,222,200,270,90',
    '1,3019,2,0,344,3,222,200,233,0.5,235,2',
    '1,3020,2,0,344,3,222,200',
    '1,3021,2,0,344,3,222,200,260,1010,265,1']);
  l.checkEnterEffectTriggers(0);
  const o = l.gdObjects[0], r = l.gdRenderer, out = {}, main = [200,100,50], detail = [100,100,100];
  r.camera.x = 0; r.camera.w = 600;
  l.enterState.forObject(o, true, 500, main, detail, out);
  near(out.dx,-40); near(out.dy,-20); near(out.rot,45); near(out.sx,0.75); near(out.sy,1.5); near(out.op,0.5);
  assert.deepEqual(main,[100,50,25]);
  l.enterState.forObject(o, false, 100, [200,100,50], detail, out);
  near(out.dx,40); near(out.dy,20);
  near(l.objects[0].x,200); near(l.objects[0].y,200); // Visual effects never move hitboxes.
});

test('Link Visible joins overlapping declarations at load and expands culling once without bypassing Toggle', () => {
  const l=fixture(['1,1,2,100,3,100,57,1', '1,1,2,2000,3,100,57,1.2', '1,1,2,4000,3,100,57,2',
    '1,3662,2,10000,51,1,62,1', '1,3662,2,10000,51,2,11,1']);
  const r=l.gdRenderer, visible=[];
  r.colorManager=scene._colorManager;
  r._prepareObject=o=>visible.push(o.index); r._fastPrepare=rank=>visible.push(r._byRank[rank].index); r._buildVertices=()=>{};
  // A faded-out candidate is answered without a prepare call; it was still a candidate.
  r._fadedOut=rank=>{visible.push(r._byRank[rank].index);return true;};
  r.setCamera(0,0); r.update(0);
  assert.deepEqual(visible.slice().sort(),[0,1,2]);
  assert.equal(new Set(visible).size,3);
  l._applyToggleTrigger({targetGroup:2,activate:false}); visible.length=0; r.update(0);
  assert.deepEqual(visible,[0]);
  l._applyToggleTrigger({targetGroup:2,activate:true});
  r.removeObject(r.objects.find(o=>o.id===3662&&o.levelObj._raw[51]==='2'));
  visible.length=0;r.update(0);assert.deepEqual(visible.slice().sort(),[0,1], 'deleting the declaration rebuilds the linked components');
  r.moveGroup(1,10000,0); visible.length=0; r.update(0);
  assert.equal(visible.length,0, 'a component with no visible seed remains culled');
});

test('custom enter respects channels, independent ignore flags, easing and long-effect fast-path bounds', () => {
  const l = fixture(['1,1,2,100,3,100,343,3',
    '1,3017,2,0,344,3,222,400,241,1,237,80,242,1',
    '1,3020,2,0,344,3,222,400']);
  l.checkEnterEffectTriggers(0);
  const o=l.gdObjects[0], r=l.gdRenderer, out={}; r.camera.x=0; r.camera.w=1000;
  assert.equal(l.enterState.needsPrepare(o,800),true, 'an effect longer than 70 points bypasses the fast path');
  o.ignoreFade=true;
  l.enterState.forObject(o,true,900,[],[],out);
  near(out.op,1); assert.ok(out.dx < -60, 'No Fade retains eased movement');
  o.ignoreEnter=true;
  l.enterState.forObject(o,true,900,[],[],out); near(out.dx,0); near(out.op,1);
  assert.equal(l.enterState.needsPrepare(o,900),false);
  o.ignoreEnter=false; o.enterChannel=4;
  l.enterState.forObject(o,true,900,[],[],out); near(out.dx,0);
});

test('custom enter spawn, touch, effect IDs, Stop and reusable checkpoints use the real trigger lifecycle', () => {
  const l=fixture(['1,1,2,100,3,100',
    '1,3017,2,0,3,100,11,1,222,100,218,30,225,4',
    '1,3018,2,0,62,1,57,8,222,100,270,90,225,4,217,1',
    '1,3023,2,500,225,4,217,1']);
  l.checkEnterEffectTriggers(0); assert.equal(l.enterState.channels[0].size,0);
  l.checkAdditionalTouchTriggers(0,200);
  assert.equal(l.enterState.channels[0].get(0)[0].trig.type,0);
  l._activateSpawnedGroup(8,scene._colorManager);
  assert.equal(l.enterState.channels[0].get(0).length,1);
  assert.equal(l.enterState.channels[0].get(0)[0].trig.type,1);
  assert.equal(l.enterState.channels[1].get(0)[0].trig.type,0);
  const saved=l.captureRuntimeState();
  for(let i=0;i<2;i++) {
    l.checkEnterEffectTriggers(1000);
    assert.equal(l.enterState.channels[0].size,0); assert.equal(l.gdRenderer.enterMap[0],-2);
    assert.equal(l.enterState.channels[1].size,1); assert.equal(l.gdRenderer.exitMap[0],-15);
    l.restoreRuntimeState(saved);
    assert.equal(l.enterState.channels[0].get(0)[0].trig.type,1);
  }
  l.resetObjects(); l.resetEnterEffectTriggers();
  assert.equal(l.enterState.channels[0].size,0); assert.equal(l.gdRenderer.enterMap[0],-2);
});

test('Area-moved decoration enters and fades at its real position inside the viewport', () => {
  const l=fixture(['1,514,2,1600,3,100,57,1', '1,1764,2,1600,3,100,57,2',
    '1,3006,2,0,51,1,71,2,222,1000,241,1,237,-1400'], r=>{
    r.frames.textures=['test'];
    r.frames.get=()=>({key:'test',slot:0,u0:0,v0:0,u1:1,v1:1,w:30,h:30,cw:30,ch:30,ox:0,oy:0});
  });
  const r=l.gdRenderer; r.colorManager=scene._colorManager;
  l.checkAreaTriggers(0); l.areaState.step(0); r.setCamera(0,0); r.camera.w=600;
  r.enterMap[0]=-3; r.exitMap[0]=-3;
  r.update(0);
  const item=r.buckets.flat().find(i=>i.opacity>0);
  assert.ok(item,'decoration moved from X=1600 into X=200 must be drawn');
  near(item.m[4]+item.part.info.w/2,200);
  near(item.opacity,1); near(Math.hypot(item.m[0],item.m[1]),1);
});

test('fast and general renderers emit matching vertices for combined Area and custom Enter effects', () => {
  const l=new context.LevelObject(scene,{_v:0}),r=l.gdRenderer;
  scene._colorManager=new ColorManager();r.colorManager=scene._colorManager;
  r.frames.textures=['test'];
  r.frames.get=()=>({key:'test',slot:0,u0:0,v0:0,u1:1,v1:1,w:30,h:30,cw:30,ch:30,ox:0,oy:0});
  context.levelObjects=[
    '1,1,2,500,3,100,57,1,343,3','1,90,2,100,3,100,57,1,343,3','1,1764,2,300,3,100,57,2',
    '1,3807,2,380,3,100,57,1,108,777,34,1', '1,3807,2,420,3,100,57,1,108,777,279,1',
    '1,3807,2,500,3,100,57,1,108,777,6,45,343,3',
    '1,3006,2,0,51,1,71,2,222,600,218,10,231,135',
    '1,3007,2,0,51,1,71,2,222,600,270,12',
    '1,3008,2,0,51,1,71,2,222,600,233,0.8,235,0.7',
    '1,3017,2,0,344,3,222,400,241,1,237,80,239,40',
    '1,3018,2,0,344,3,222,400,270,90',
    '1,3019,2,0,344,3,222,400,233,0.5,235,2',
    '1,3020,2,0,344,3,222,400',
    '1,3021,2,0,344,3,222,400,278,1,49,30a0.8a0.7a0a0'
  ].map(parseObject);
  l._spawnLevelObjects(context.levelObjects);l.checkAreaTriggers(0);l.areaState.step(0);l.checkEnterEffectTriggers(0);
  r.setCamera(0,0);r.camera.w=600;
  let fastCalls=0;const prepare=r._fastPrepare;
  r._fastPrepare=function(...args){fastCalls++;return prepare.apply(this,args);};
  for(let frame=0;frame<3;frame++)r.update(0);
  assert.ok(fastCalls>=6,'custom Enter retains the fast path on subsequent frames');
  const quads=r.quadCount,fast=Array.from(r._vf.slice(0,quads*24)),colors=Array.from(r._vu.slice(0,quads*24));
  assert.ok(quads>4,'exercise main, detail, interior masks and glow');
  r.legacyPrepare=true;r.update(0);assert.equal(r.quadCount,quads);
  for(let i=0;i<fast.length;i++)if(i%6===5)assert.equal(r._vu[i],colors[i]);else assert.ok(Math.abs(r._vf[i]-fast[i])<1e-5,`vertex ${i}: ${r._vf[i]} != ${fast[i]}`);
});

test('re-firing a named Enter effect reloads it without changing composition order', () => {
  const l=fixture(['1,3017,2,0,62,1,87,1,57,8,225,4,222,100,218,30',
    '1,3018,2,0,62,1,87,1,57,9,225,5,222,100,270,90']);
  l._activateSpawnedGroup(8,scene._colorManager);l._activateSpawnedGroup(9,scene._colorManager);
  const first=l.enterState.channels[0].get(0)[0];
  l._activateSpawnedGroup(8,scene._colorManager);
  assert.equal(l.enterState.channels[0].get(0)[0],first);
  assert.deepEqual(Array.from(l.enterState.channels[0].get(0),i=>i.trig.effectID),[4,5]);
});

test('advanced follow mode 0 eases a parent group toward its target each tick', () => {
  // processAdvancedFollowAction: delta / max(1, easing) per 240 Hz tick,
  // moving the parent's whole group; easing <= 1 reaches it in one tick.
  const l = fixture(['1,1,2,100,3,100,57,1,274,1', '1,1,2,130,3,100,57,1', '1,1764,2,200,3,100,57,2',
    '1,3016,2,0,3,0,51,1,71,2,361,4']);
  l.checkAreaTriggers(0); l.advFollowState.step(1 / 240);
  const a = l.gdObjects[0], b = l.gdObjects[1], live = o => l.gdRenderer.livePosition(o, {});
  near(live(a).x, 125); near(live(b).x, 155); near(live(a).y, 100);
  l.advFollowState.active[0].trig.easing = 0; l.advFollowState.step(1 / 240);
  near(live(a).x, 200); near(live(b).x, 230);
});

test('Follow consumes Advanced Follow singleton moves on the next tick, but not independent multi-object moves',()=>{
 const saved={x:scene._playerWorldX,y:scene._state.y};
 try {
  for(const multiple of [false,true]) {
   const l=fixture(['1,3805,2,1000,3,500,57,1',...(multiple?['1,3805,2,2000,3,500,57,1']:[]),
    '1,1,2,5000,3,15,57,2','1,1347,2,300,51,2,71,1,10,99,72,1,73,1',
    '1,3016,2,300,51,1,138,1']);
   scene._playerWorldX=600;scene._state.y=30;
   l.checkFollowTriggers(600);l.checkAreaTriggers(600);
   const target=()=>l.gdRenderer.livePosition(l.gdRenderer.groups.get(2)[0]).x;
   l.stepFollowTriggers(1/240);l.advFollowState.step(1/240);near(target(),5000);
   scene._playerWorldX=620;l.stepFollowTriggers(1/240);l.advFollowState.step(1/240);
   near(target(),multiple?5000:4300);
   l.stepFollowTriggers(1/240);near(target(),multiple?5000:4310);
  }
 } finally {scene._playerWorldX=saved.x;scene._state.y=saved.y;}
});

test('advanced follow reads area-transformed targets as native getRealPosition does', () => {
  const l=fixture(['1,1,2,100,3,1000,57,2','1,1,2,50,3,1000,57,1',
    '1,3006,2,0,51,2,71,2,222,100,241,1,239,40',
    '1,3016,2,0,51,1,71,2']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  for(let i=0;i<8;i++) l.advFollowState.step(1/240);
  const p=l.gdRenderer.livePosition(l.gdObjects[1],{});
  // Disposable native fixture ends at (100,1130), including GD's +90 Y.
  near(p.x,100); near(p.y,1040); near(l.objects[1].y,2080);
});

test('advanced follow moves an editor-linked unit from its Area reference without collapsing members', () => {
  const l=fixture(['1,36,2,100,3,1000,57,294,108,777,34,1',
    '1,36,2,100,3,900,57,294,108,777,279,1', '1,1,2,200,3,1100,57,294.296,108,777',
    '1,36,2,300,3,1000,57,295', '1,3016,2,0,3,0,51,294,71,295,361,1']);
  l.checkAreaTriggers(0); l.advFollowState.step(1/240);
  const positions=l.gdRenderer.groups.get(294).map(o=>l.gdRenderer.livePosition(o,{}));
  near(positions[0].x,300); near(positions[0].y,1100);
  near(positions[1].x,300); near(positions[1].y,1000);
  near(positions[2].x,400); near(positions[2].y,1200);
  const block=l.objects.find(o=>o._eeLevelObject?.id===1);
  near(block.x,800); near(block.y,2400);
});

test('advanced follow moves independent members and their colliders together with later group moves', () => {
  const l=fixture(['1,1,2,100,3,100,57,1','1,1,2,140,3,120,57,1','1,1764,2,200,3,200,57,2',
    '1,3016,2,0,51,1,71,2,361,4,280,1']);
  l.checkAreaTriggers(0);l.advFollowState.step(1/240);
  near(l.gdObjects[0].offX,25);near(l.gdObjects[0].offY,25);
  near(l.gdObjects[1].offX,15);near(l.gdObjects[1].offY,20);
  l._translateGroup(1,60,-20);
  for(let i=0;i<2;i++){
    const p=l.gdRenderer.livePosition(l.gdObjects[i],{}),col=l.objects[i];
    near(p.x*2,col.x);near(p.y*2,col.y);
    l._applyGroupedColliderMoveOffset(col);near(p.x*2,col.x);near(p.y*2,col.y);
  }
});

test('advanced follow restores delayed target history and per-object state on every practice respawn', () => {
  const l=fixture(['1,1,2,100,3,100,57,1','1,3016,2,0,51,1,138,1,292,0.0125,361,4']);
  l.checkAreaTriggers(0);
  const oldX=scene._playerWorldX, oldY=scene._state.y;
  const step=n=>{scene._playerWorldX=600+n*16;scene._state.y=400+n*4;l.advFollowState.step(1/240);const o=l.gdObjects[0];return [o.offX,o.offY,l.objects[0].x,l.objects[0].y];};
  try {
    for(let i=0;i<8;i++)step(i);
    const saved=l.captureRuntimeState(), expected=[];
    for(let i=8;i<24;i++)expected.push(step(i));
    for(let restore=0;restore<2;restore++){
      l.restoreRuntimeState(saved);const actual=[];
      for(let i=8;i<24;i++)actual.push(step(i));
      assert.deepEqual(actual,expected);
    }
    l.resetObjects();assert.equal(l.advFollowState.history.size,0);assert.equal(l.gdObjects[0]._advFollow,undefined);
  } finally {scene._playerWorldX=oldX;scene._state.y=oldY;}
});

test('overlapping move and orbit produce the same graphic/collider positions', () => {
  const l = fixture([block, '1,1764,2,100,3,70,57,2', move, '1,1346,2,0,3,0,51,1,71,2,68,90,10,1']);
  l.checkMoveTriggers(0); l.checkRotateTriggers(0);
  for (let i = 0; i < 60; i++) {
    l.stepMoveTriggers(1 / 60); l.stepRotateTriggers(1 / 60);
    const gd = l.gdObjects[0], col = l.objects[0];
    // The collider keeps native float32 positions while it orbits.
    near((gd.x + gd.offX) * 2, col.x, 5e-3); near((gd.y + gd.offY) * 2, col.y, 5e-3);
  }
});

test('alpha multiplies across groups; toggle disables graphics and collision', () => {
  const l = fixture([block + '.2', '1,1007,2,0,51,1,35,0.5', '1,1007,2,0,51,2,35,0.4', '1,1049,2,5,51,1,56,0']);
  l.checkAlphaTriggers(0); l.stepAlphaTriggers(0);
  near(l.gdRenderer._groupOpacity(l.gdObjects[0]), 0.2);
  l.checkToggleTriggers(10);
  assert.equal(l.gdRenderer.groupState.enabled(1), false);
  assert.equal(l.objects[0]._eeDisabled, true);
});

test('group parents come from 274 alone and do not add group membership', () => {
  // loadGroupParentsFromString registers the parent table only; key 34 is
  // the editor toggle and membership stays the object's own groups.
  const l = fixture([block + ',274,2.1', '1,901,2,0,51,2,28,15']);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0);
  near(l.gdObjects[0].offX, 0); near(l.objects[0].x, 200);
  assert.equal(l.gdObjects[0].groups.length, 1);
  assert.equal(l._moveGroupParent(1), l.gdObjects[0]);
  assert.equal(l._moveGroupParent(2), l.gdObjects[0]);
});

test('group and channel pulses reach the native colour manager', () => {
  const l = fixture([block, '1,1006,2,0,51,1,52,1,7,255,8,0,9,0,45,1,46,1,47,1', '1,1006,2,0,51,7,52,0,7,0,8,255,9,0,45,1,46,1']);
  const cm = scene._colorManager;
  cm.setInitialColor(7, { r: 0, g: 0, b: 255 });
  l.checkPulseTriggers(0); l.stepPulseTriggers(0.5, cm); cm.step(0.5);
  const out = cm.colorForGroup(1, [0, 0, 255], true);
  assert.ok(out[0] >= 127 && out[2] >= 127);
  assert.ok(cm.getFinal(7)[1] >= 127 && cm.getFinal(7)[2] >= 127);
});

test('stop cancels movement, pulse actions and queued spawns', () => {
  const l = fixture([block, move, '1,1006,2,0,51,1,52,1,46,5', '1,1268,2,0,51,1,63,5', '1,1616,2,1,51,1']);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.2);
  l.checkPulseTriggers(0); l.stepPulseTriggers(0.1, scene._colorManager);
  l.checkSpawnTriggers(0); l.checkStopTriggers(2, 0);
  assert.equal(l._activeMoveTweens.length, 0); assert.equal(l._activePulses.length, 0);
  assert.equal(l._activeSpawnDelays.length, 0); assert.equal(scene._colorManager.hasGroupPulse(1), false);
});

test('Stop property 580 pauses and resumes movement and pulse clocks across a checkpoint', () => {
  const l = fixture([block, move, '1,1006,2,0,51,1,52,1,45,1,46,5',
    '1,1616,2,1,51,1,580,1', '1,1616,2,2,51,1,580,2']);
  const cm = scene._colorManager;
  l.checkMoveTriggers(0); l.checkPulseTriggers(0); l.stepMoveTriggers(0);
  l.stepMoveTriggers(.25); l.stepPulseTriggers(.25, cm); cm.step(.25);
  l.checkStopTriggers(2, 0);
  const saved = l.captureRuntimeState(cm), offset = l.gdObjects[0].offX;
  l.stepMoveTriggers(2); l.stepPulseTriggers(2, cm); cm.step(2);
  near(l.gdObjects[0].offX, offset); near(l._activeMoveTweens[0].elapsed, .25);
  near(l._activePulses[0].action.deltaTime, .25);
  l.checkStopTriggers(4, 0); l.stepMoveTriggers(.25); l.stepPulseTriggers(.25, cm); cm.step(.25);
  near(l._activeMoveTweens[0].elapsed, .5); near(l._activePulses[0].action.deltaTime, .5);
  l.restoreRuntimeState(saved, cm);
  l.stepMoveTriggers(2); l.stepPulseTriggers(2, cm); cm.step(2);
  near(l.gdObjects[0].offX, offset); near(l._activePulses[0].action.deltaTime, .25);
  l.checkStopTriggers(4, 0); l.stepMoveTriggers(.25);
  near(l._activeMoveTweens[0].elapsed, .5);
});

test('paused Spawn timers retain their phase without blocking unrelated ready actions', () => {
  const l = fixture([block, '1,1346,2,0,51,1,57,7,62,1,87,1,68,90',
    '1,1346,2,0,51,1,57,8,62,1,87,1,68,3']);
  l._pushSpawnItem({targetGroup:7,delay:.5,elapsed:.2,trig:{groups:[10]}});
  l._applyStopTrigger({targetGroup:10,command:1});
  l._pushSpawnItem({targetGroup:8,delay:0,elapsed:0,trig:{groups:[11]}});
  l.stepSpawnTriggers(1, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,3); near(l._activeSpawnDelays[0].elapsed,.2);
  l._applyStopTrigger({targetGroup:10,command:2});
  l.stepSpawnTriggers(.29, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,3);
  l.stepSpawnTriggers(.02, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,93); assert.equal(l._activeSpawnDelays.length,0);
});

test('Pause in a Spawn dispatch preserves deferred entries and does not revive consumed commands', () => {
  const l = fixture([block, '1,1616,2,0,51,7,57,5,62,1,580,1',
    '1,1346,2,0,51,1,57,7,62,1,87,1,68,90',
    '1,1346,2,0,51,1,57,8,62,1,87,1,68,3']);
  for (const targetGroup of [5,7,8]) l._pushSpawnItem({targetGroup,delay:0,elapsed:0,trig:{targetGroup,groups:[]}});
  l.stepSpawnTriggers(1/240, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,3); assert.equal(l._activeSpawnDelays.length,1);
  l.stepSpawnTriggers(1, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,3);
  l._applyStopTrigger({targetGroup:7,command:2});
  l.stepSpawnTriggers(1/240, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,93); assert.equal(l._activeSpawnDelays.length,0);
  l._spawnProcessing=true; l._spawnHead=0;
  l._pushSpawnItem({targetGroup:7,delay:1,elapsed:0,trig:{targetGroup:7,groups:[]}});
  l._applyStopTrigger({targetGroup:7,command:1}); assert.equal(l._spawnDeferred[0].paused,true);
  l._applyStopTrigger({targetGroup:7}); assert.equal(l._spawnDeferred.length,0);
  l._spawnProcessing=false;
});

test('Spawn actions due in the same tick execute in insertion order before advancing a later paused timer', () => {
  const l=fixture([block, '1,1616,2,0,51,7,57,5,62,1,580,1',
    '1,1346,2,0,51,1,57,7,62,1,87,1,68,90',
    '1,1346,2,0,51,1,57,8,62,1,87,1,68,3']);
  // Pause is older, but the younger action would have become due earlier
  // inside this tick. Native 36c5e0 does not sort fractional deadlines.
  l._pushSpawnItem({targetGroup:5,delay:.7,elapsed:.699,trig:{groups:[]}});
  l._pushSpawnItem({targetGroup:7,delay:.005,elapsed:.0045,trig:{targetGroup:7,groups:[]}});
  l._pushSpawnItem({targetGroup:8,delay:0,elapsed:0,trig:{groups:[]}});
  l.stepSpawnTriggers(1/240,scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,3); assert.equal(l._activeSpawnDelays.length,1);
  near(l._activeSpawnDelays[0].elapsed,.0045);
  l._applyStopTrigger({targetGroup:7,command:2});
  l.stepSpawnTriggers(1/240,scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff,93);
});

test('spawn chains consume elapsed time once and respect multi trigger', () => {
  const l = fixture(['1,1268,2,0,51,10,63,0.1', '1,1268,2,0,51,11,57,10,62,1,63,0.1', '1,901,2,0,51,1,57,11,62,1,28,10', block]);
  l.checkSpawnTriggers(0); l.stepSpawnTriggers(0.15, scene._colorManager);
  assert.equal(l._activeMoveTweens.length, 0);
  near(l._activeSpawnDelays[0].elapsed, 0.05);
  l.stepSpawnTriggers(0.051, scene._colorManager);
  assert.equal(l._activeMoveTweens.length, 1);
  l._activateSpawnedGroup(11, scene._colorManager);
  assert.equal(l._activeMoveTweens.length, 1);
  l._moveTriggers[0].multiTriggered = true;
  // GJBaseGameLayer::spawnGroup spawns a group once per 240 Hz step.
  l._activateSpawnedGroup(11, scene._colorManager);
  assert.equal(l._activeMoveTweens.length, 1);
  l._spawnClock += 1 / 240;
  l._activateSpawnedGroup(11, scene._colorManager);
  assert.equal(l._activeMoveTweens.length, 2);
});

test('spawn ordered delays each trigger by its X distance and zero-delay loops stop', () => {
  // Group 5: rotate at x 0 and 60, and a spawn of group 5 itself at x 120, ordered.
  const l = fixture(['1,1346,2,0,51,1,57,5,62,1,87,1,68,1', '1,1346,2,60,51,1,57,5,62,1,87,1,68,1',
    '1,1268,2,120,51,5,57,5,62,1,87,1,441,1', block]);
  let rotations = 0;
  const original = l._startRotateTriggerTween.bind(l);
  l._startRotateTriggerTween = trig => { rotations++; return original(trig); };
  l._activateSpawnedGroup(5, scene._colorManager, true);
  assert.equal(rotations, 1);
  // 60 units at 311.58 per second later the second fires, after 120 the loop.
  for (let i = 0; i < 60; i++) l.stepSpawnTriggers(1 / 240, scene._colorManager);
  assert.equal(rotations, 2);
  for (let i = 0; i < 60; i++) l.stepSpawnTriggers(1 / 240, scene._colorManager);
  assert.equal(rotations, 3);
  // A loop without any delay runs once per step, not unbounded.
  const loop = fixture(['1,1346,2,0,51,1,57,6,62,1,87,1,68,1', '1,1268,2,0,51,6,57,6,62,1,87,1', block]);
  let spins = 0;
  const spin = loop._startRotateTriggerTween.bind(loop);
  loop._startRotateTriggerTween = trig => { spins++; return spin(trig); };
  loop._activateSpawnedGroup(6, scene._colorManager);
  loop.stepSpawnTriggers(1 / 240, scene._colorManager);
  assert.ok(spins <= 3, `zero-delay loop ran ${spins} times`);
});

test('a spawned Stop preserves consumed entries and dispatches future ordered entries only once', () => {
  const l = fixture([block,
    '1,1346,2,0,51,1,57,5,62,1,87,1,68,3',
    '1,1268,2,15,51,6,57,5,62,1,87,1',
    '1,1346,2,30,51,1,57,5,62,1,87,1,68,-3',
    '1,1616,2,0,51,999,57,6,62,1,87,1']);
  const fired = [];
  const original = l._startRotateTriggerTween;
  l._startRotateTriggerTween = function(t) { fired.push(t.degrees); original.call(this, t); };
  l._activateSpawnedGroup(5, scene._colorManager, true);
  for (let i = 0; i < 100; i++) l.stepSpawnTriggers(1 / 240, scene._colorManager);
  assert.deepEqual(fired, [3, -3]);
  assert.equal(l._activeSpawnDelays.length, 0);
  l.stepRotateTriggers(0); near(l.gdObjects[0].rotOff, 0);
});

test('Spawn Ordered starts at the leftmost command even when the ending was saved first', () => {
  const l = fixture(['1,1346,2,62.316021728515625,51,1,57,7,62,1,68,100',
    '1,1346,2,0,51,1,57,7,62,1,68,1',
    '1,1346,2,31.1580108642578125,51,1,57,7,62,1,68,10']);
  const fired = [];
  l._activateSpawnedTrigger = trig => fired.push(trig.degrees);
  l._activateSpawnedGroup(7, scene._colorManager, true);
  assert.deepEqual(fired, [1]);
  l.stepSpawnTriggers(.101, scene._colorManager); assert.deepEqual(fired, [1,10]);
  l.stepSpawnTriggers(.1, scene._colorManager); assert.deepEqual(fired, [1,10,100]);
});

test('Spawn Ordered measures from normal triggers too, while decoration does not delay commands', () => {
  for (const ordered of [true, false]) {
    const l = fixture(['1,1,2,-500,3,100,57,7',
      '1,1912,2,0,51,999,57,7,10,50',
      '1,1346,2,31.1580108642578125,51,1,57,7,62,1,68,10']);
    const fired = [];
    l._activateSpawnedTrigger = trig => fired.push(trig.degrees);
    l._activateSpawnedGroup(7, scene._colorManager, ordered);
    assert.deepEqual(fired, ordered ? [] : [10]);
    l.stepSpawnTriggers(.099, scene._colorManager);
    assert.deepEqual(fired, ordered ? [] : [10]);
    l.stepSpawnTriggers(.002, scene._colorManager);
    assert.deepEqual(fired, [10]);
  }
});

test('toggling off a trigger group stops pending loops and suppresses registered button listeners', () => {
  const l = fixture(['1,1268,2,0,51,7,63,0.0001,62,1,57,7,87,1',
    '1,901,2,0,51,1,28,10,62,1,57,7,87,1',
    '1,1595,2,0,51,8,82,1,62,1,57,7']);
  let moves = 0;
  l._startMoveTriggerTween = () => moves++;
  l._activateSpawnedGroup(7, scene._colorManager);
  assert.equal(moves, 1);
  l._applyToggleTrigger({targetGroup:7,activate:false});
  l.stepSpawnTriggers(1/240, scene._colorManager);
  l.logicState.button(true);
  assert.equal(moves, 1); assert.equal(l._activeSpawnDelays.length, 0);
  assert.equal(l._groupEnabled[8], undefined);
  l._applyToggleTrigger({targetGroup:7,activate:true});
  l._spawnClock += 1/240;
  l._activateSpawnedGroup(7, scene._colorManager);
  assert.equal(moves, 2);
});

test('a Stop in a spawn dispatch cancels a later due entry without skipping unrelated entries', () => {
  const l = fixture([block, '1,1616,2,0,51,7,57,5,62,1',
    '1,1346,2,0,51,1,57,7,62,1,87,1,68,90',
    '1,1346,2,0,51,1,57,8,62,1,87,1,68,3']);
  for (const targetGroup of [5, 7, 8]) l._pushSpawnItem({ targetGroup, delay: 0, elapsed: 0, trig: { targetGroup, groups: [] } });
  l.stepSpawnTriggers(1 / 240, scene._colorManager); l.stepRotateTriggers(0);
  near(l.gdObjects[0].rotOff, 3); assert.equal(l._activeSpawnDelays.length, 0);
});

test('count watches pickups and instant count compares the current value', () => {
  const l = fixture([block, '1,1611,2,0,80,4,77,2,51,1,56,0', '1,1817,2,1,80,4,77,2', '1,1811,2,2,80,4,77,1,88,1,51,1,56,1']);
  l.checkCountTriggers(2); assert.equal(l._itemCounts.get(4), 2);
  assert.equal(l._groupEnabled[1], false); assert.equal(l.objects[0]._eeDisabled, true);
  l.checkCountTriggers(4); assert.equal(l._groupEnabled[1], true);
});

test('touch-only alpha waits for contact and triggers once', () => {
  const l = fixture([block, '1,1007,2,10,3,100,11,1,51,1,35,0']);
  l.checkAlphaTriggers(1000); assert.equal(l._activeAlphaTweens.length, 0);
  l.checkAdditionalTouchTriggers(20, 200); l.checkAdditionalTouchTriggers(20, 200);
  assert.equal(l._activeAlphaTweens.length, 1);
});

test('restart restores group transforms, sections, opacity, collision and timers', () => {
  const l = fixture([block, move, '1,1049,2,0,51,1,56,0']);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.5); l.checkToggleTriggers(0);
  l.resetObjects(); l.resetMoveTriggers(); l.resetRotateTriggers(); l.resetAlphaTriggers(); l.resetToggleTriggers(); l.resetSpawnTriggers();
  near(l.gdObjects[0].offX, 0); near(l.objects[0].x, 200);
  assert.equal(l.objects[0]._eeDisabled, false);
  assert.ok(inCell(l.gdRenderer, l.gdObjects[0], 1));
  assert.equal(l._spawnActivated.size, 0);
});

test('all 22 supplied official levels parse with known trigger definitions', () => {
  let count = 0;
  for (let i = 1; i <= 22; i++) {
    const parsed = parseLevel(fs.readFileSync(path.join(root, 'assets/levels', i + '.txt'), 'utf8'));
    assert.ok(parsed.objects.length > 100, 'level ' + i);
    count += parsed.objects.length;
  }
  console.log('  ' + count + ' official objects parsed');
});
test('a ninth atlas gets its own texture range instead of sampling atlas eight', () => {
  const r = new context.GDRenderer(scene);
  r.frames.textures = Array.from({ length: 9 }, (_, i) => 'atlas' + i);
  r.setCamera(0, 0);
  for (let i = 0; i < 9; i++) r.pushItem(0, {
    part: { qx: 0, qy: 0, info: { slot: i, w: 10, h: 10, u0: 0, v0: 0, u1: 1, v1: 1 } },
    m: [1, 0, 0, 1, 0, 0], opacity: 1, color: [255, 255, 255]
  });
  r._buildVertices();
  assert.equal(r.ranges.length, 2); assert.equal(r.quadCount, 9);
  assert.equal(r.ranges[1].textures[0], 'atlas8');
  assert.equal(r._vf[8 * 4 * 6 + 4], 0);
});
test('practice checkpoint restores in-flight triggers and reusable colour actions', () => {
  const l = fixture([block, move, '1,1006,2,0,51,1,52,1,45,1,46,5,7,255,8,0,9,0']);
  const cm = scene._colorManager;
  cm.setInitialColor(7, { r: 0, g: 0, b: 0 });
  cm.triggerColor(7, { r: 200, g: 100, b: 50 }, 1);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.25);
  l.checkPulseTriggers(0); l.stepPulseTriggers(0.25, cm); cm.step(0.25);
  const saved = l.captureRuntimeState(cm);
  const savedX = l.objects[0].x;
  l.stepMoveTriggers(0.5); cm.step(0.5);
  l.resetObjects(); l.resetMoveTriggers(); l.resetPulseTriggers(); cm.reset();
  l.restoreRuntimeState(saved, cm);
  near(l.objects[0].x, savedX); near(l.gdObjects[0].offX, 750);
  near(l._activeMoveTweens[0].elapsed, 0.25);
  near(cm.getFinal(7)[0], 50);
  assert.equal(l._activePulses[0].action, cm._groupPulses.get(1)[0]);
  cm.step(0.25); near(cm.getFinal(7)[0], 100);
  l.stepMoveTriggers(0.25); near(l.gdObjects[0].offX, 1500);
  l.restoreRuntimeState(saved, cm);
  near(l.objects[0].x, savedX); near(cm.getFinal(7)[0], 50);
  l._applyStopTrigger({ targetGroup: 1 });
  assert.equal(cm.hasGroupPulse(1), false);
});
test('breaking and resetting a block restores one visual and one collider', () => {
  const l = fixture(['1,143,2,100,3,100,57,1']);
  const id = context.levelObjects[0]._eeObjectId;
  l._breakblock(id);
  assert.equal(l.gdRenderer.objects.filter(obj => obj.enabled && !obj.hidden).length, 0);
  assert.equal(l.objects.length, 0);
  l.resetObjects();
  assert.equal(l.gdRenderer.objects.filter(obj => obj.enabled && !obj.hidden).length, 1);
  assert.equal(l.objects.length, 1);
  assert.equal(l.gdRenderer.groups.get(1).length, 1);
});
test('practice checkpoint before a broken block restores its replacement once', () => {
  const l = fixture(['1,143,2,100,3,100,57,1', move]);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.25);
  const snapshot = l.captureRuntimeState();
  l._breakblock(context.levelObjects[0]._eeObjectId);
  l.resetObjects(); l.resetMoveTriggers();
  l.restoreRuntimeState(snapshot);
  const active = l.gdRenderer.objects.filter(obj => obj.enabled && !obj.hidden);
  assert.equal(active.length, 1); assert.equal(l.objects.length, 1);
  near((active[0].x + active[0].offX) * 2, l.objects[0].x);
});
test('practice checkpoint after a broken block keeps that block absent', () => {
  const l = fixture(['1,143,2,100,3,100,57,1']);
  l._breakblock(context.levelObjects[0]._eeObjectId);
  const snapshot = l.captureRuntimeState();
  l.resetObjects(); l.restoreRuntimeState(snapshot);
  assert.equal(l.gdRenderer.objects.filter(obj => obj.enabled && !obj.hidden).length, 0);
  assert.equal(l.objects.length, 0);
});
test('black interior masks stay black while their outline keeps its colour', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = name => ({ key: 'test', slot: 0, u0: 0, v0: 0, u1: 1, v1: 1, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 });
  r.colorManager = new ColorManager();
  r.setCamera(0, 0);
  for (const id of [90, 91, 92, 93, 95, 96]) {
    const obj = r.addObject(parseObject('1,' + id + ',2,100,3,100'));
    r._prepareObject(obj, obj.x, obj.y, false);
    const children = r.buckets.flat().filter(item => item.part.role === 2 && item.part.tag !== 997);
    assert.ok(children.length > 0);
    for (const item of children) assert.deepEqual(Array.from(item.color), [0, 0, 0], 'black mask of object ' + id);
    r.clearFrame();
  }
});
test('official songs reach the official loader instead of a truthy async false', () => {
  const { AudioManager } = context.testAPI;
  const requested = [], callbacks = new Map(), cached = new Set();
  const audioScene = {
    cache: { audio: { exists: key => cached.has(key) } },
    sound: { add: (key, options) => ({key, ...options, play(config) { Object.assign(this, config); this.isPlaying = true; }, stop() {}, destroy() {}}) },
    load: { audio: (key, url) => requested.push([key, url]), once: (event, cb) => callbacks.set(event, cb), isLoading: () => false, start() {} }
  };
  context.allLevels = [['stereo_madness', 'Stereo Madness', 'level_1']];
  context.currentlevel = context.allLevels[0];
  const a = new AudioManager(audioScene);
  assert.equal(a._loadMissingOnlineSong('stereo_madness'), false);
  a.startMusic(0.25);
  assert.deepEqual(requested, [['stereo_madness', 'assets/music/StereoMadness.mp3']]);
  cached.add('stereo_madness'); callbacks.get('filecomplete-audio-stereo_madness')();
  assert.equal(a._music.isPlaying, true); assert.equal(a._music.seek, 0.25);
});
test('native audio pulses average silent stereo channels and sample at most once per 60 Hz interval', () => {
  const a = new context.testAPI.AudioManager({sound:{}});
  a._meteringEnabled = true; a._meterBuffer = new Float32Array(8);
  a._analyser = {getFloatTimeDomainData: data => data.fill(.25)};
  a._analyserR = {getFloatTimeDomainData: data => data.fill(0)};
  a._effectiveVolume = () => .5;
  a._silenceCounter = 3;
  for (let i=0;i<3;i++) a.update(1/240);
  near(a.getMeteringValue(), .1);
  a.update(1/240); near(a.getMeteringValue(), .385);
  a.update(1/60); near(a.getMeteringValue(), .385 * .93);
  a._meterChannels=1; a._silenceCounter=3; a._lastAudio=.1; a._lastPeak=0;
  a.update(1/60); near(a.getMeteringValue(), .66);
  a.update(1/240); a.reset(); near(a._meterClock, 0);
});

test('late music loading catches up in real attempt time, excludes pauses and cancels obsolete songs', () => {
  const callbacks = new Map(), cached = new Set(), starts = [];
  const audioScene = { cache:{audio:{exists:key=>cached.has(key)}}, sound:{add:(key, options)=>({key,...options,
    play(config){starts.push({key,...config});this.isPlaying=true;},stop(){this.isPlaying=false;},destroy(){}})},
    load:{audio(){},once:(event,fn)=>callbacks.set(event,fn),isLoading:()=>false,start(){}} };
  const a = new context.testAPI.AudioManager(audioScene);
  const settings = context.settingsMap;
  context.settingsMap = {kA13:'2'};
  context.allLevels = [['song_a','A','level_a','Local','A'],['song_b','B','level_b','Local','B']];
  context.currentlevel = context.allLevels[0];
  a.startMusic(.5); a.update(.4);
  audioScene._paused=true; a.update(3); audioScene._paused=false;
  near(a.getLevelPosition(),.9);
  cached.add('song_a'); callbacks.get('filecomplete-audio-song_a')();
  near(starts[0].seek,2.9); near(starts[0].delay,0);
  a.update(.1); near(a.getLevelPosition(),1);
  // A failed/late earlier request cannot clear the newer song's pending key.
  cached.clear();a.startMusic(0);
  const old = callbacks.get('filecomplete-audio-song_a');
  context.currentlevel=context.allLevels[1];a.startMusic(0);old();
  assert.equal(a._pendingMusicLoadKey,'song_b');
  a.update(.25);cached.add('song_b');callbacks.get('filecomplete-audio-song_b')();
  near(starts.at(-1).seek,2.25);
  cached.clear();a.startMusic(0);a.stopMusic();
  const count=starts.length;cached.add('song_b');callbacks.get('filecomplete-audio-song_b')();assert.equal(starts.length,count);
  context.settingsMap=settings;
});

test('negative song offsets schedule silence and survive pause and resume for custom audio', () => {
  const calls=[],buffers=[],ctx={currentTime:10,state:'running',destination:{},
    createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),
    createBufferSource:()=>{const source={playbackRate:{value:1},connect(){},disconnect(){},stop(){},start(...args){calls.push(args);}};buffers.push(source);return source;}};
  const a=new context.testAPI.AudioManager({game:{sound:{context:ctx}},sound:{}});
  a._playOnlineBuffer({duration:30},-2);
  assert.deepEqual(calls[0],[12,0]);near(a._music.seek,-2);
  ctx.currentTime=10.5;a.pauseMusic();near(a._music.seek,-1.5);
  ctx.currentTime=20;a.resumeMusic();assert.deepEqual(calls[1],[21.5,0]);
  ctx.currentTime=22;near(a._music.seek,.5);
  const sound={play(config){this.config=config;}};a._playLevelSound(sound,-1.25);
  near(sound.config.seek,0);near(sound.config.delay,1.25);
});

test('every speed gate uses native dimensions and authored independent scaling', () => {
  const expected=[[200,35,44],[201,33,56],[202,51,56],[203,65,56],[1334,69,56]];
  for (const [id,w,h] of expected) {
    const l=fixture([`1,${id},2,100,3,200,128,1.5,129,2,6,90`]);
    const gate=l.objects.find(o=>o.speedId===id);
    near(gate.w,w*2*1.5);near(gate.h,h*2*2);near(gate.rotationDegrees,90);
  }
});

test('noclip blocks the shared death path even for waves and out-of-world deaths', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype);
  context.noClip = true;
  for (const mode of ['isWave', 'isFlying', 'isBall', 'isSpider', 'isRobot', 'isSwing']) {
    p.p = new context.testAPI.PlayerState(); p.p[mode] = true; p.p.y = 100000;
    p.killPlayer(); assert.equal(p.p.isDead, false); assert.equal(p.p.diedThisFrame, true);
  }
  context.noClip = false;
});
test('slope contact samples the solid side and stays valid at adjoining edges', () => {
  const c = new context.testAPI.Collider('slope', 100, 100, 60, 60);
  c.hypoAx = -30; c.hypoAy = -30; c.hypoBx = 30; c.hypoBy = 30;
  c.slopeSolidBelow = true; c.gdSolidAbove = false;
  near(c.getSlopeSurfaceYForPlayer(90, 110), 110);
  near(c.getSlopeSurfaceYForPlayer(120, 150), 130);
  assert.equal(c.getSlopeSurfaceYForPlayer(131, 160), null);
  c.slopeSolidBelow = false;
  near(c.getSlopeSurfaceYForPlayer(90, 110), 90);
});
test('rotate triggers turn the art of a slope and leave the triangle it is hit by', () => {
  const l = fixture(['1,289,2,100,3,100,57,1', '1,1346,2,0,51,1,68,90,10,1']);
  const c = l.objects[0], ax = c.hypoAx, ay = c.hypoAy;
  near(c.w, 60); near(c.h, 60);
  l.checkRotateTriggers(0); l.stepRotateTriggers(0.5);
  near(c.hypoAx, ax); near(c.hypoAy, ay);
});
test('custom particles read the native field layout and emit finite coloured quads', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 10, h: 10, cw: 10, ch: 10, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0); r._buildVertices = () => {};
  const fields = new Array(72).fill(0);
  Object.assign(fields, { 0: 5, 1: -1, 2: 0.5, 4: 20, 7: 10, 17: 10, 21: 1, 23: 1, 25: 1, 27: 1, 29: 10, 33: 1, 35: 1, 37: 1, 39: 1, 53: 1, 57: 28 });
  const serialized = fields.join('a'), data = context.parseGDParticleString(serialized);
  assert.equal(data.TotalParticles, 5); assert.equal(data.customParticleIdx, 28); assert.equal(data.isBlendAdditive, 1);
  const o = r.addObject(parseObject('1,2065,2,100,3,100,145,' + serialized));
  for (let i = 0; i < 20; i++) r.update(1 / 60);
  assert.ok(o.particleSystem.particles.length > 0 && o.particleSystem.particles.length <= 5);
  assert.ok(r.buckets.flat().length > 0);
  for (const item of r.buckets.flat()) { assert.ok(item.m.every(Number.isFinite)); assert.ok(Number.isFinite(item.opacity)); }
  const snapshot = r.captureRuntimeState();
  r.setCamera(20000, 0); for (let i = 0; i < 60; i++) r.update(1 / 60);
  assert.equal(o.particleSystem.particles.length, 0, 'offscreen particles must expire');
  r.restoreRuntimeState(snapshot); assert.ok(o.particleSystem.particles.length > 0);
  r.reset(); assert.equal(o.particleSystem.particles.length, 0);
});
test('animated 2.2 decorations keep both channels and advance their texture frames', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = name => /gj22_anim_03_(?:color_)?00[12]\.png$/.test(name)
    ? { key: 'test', slot: 0, name, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 } : null;
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const o = r.addObject(parseObject('1,2022,2,100,3,100,21,7,22,8'));
  assert.equal(o.hasDetail, true); assert.equal(o.detailID, 8); assert.equal(o.animation.length, 2);
  o.animationOffset = 0; r.time = 0; r._prepareObject(o, 100, 100, false);
  assert.ok(o.parts[0].info.name.endsWith('001.png'));
  r.time = 0.1; r._prepareObject(o, 100, 100, false);
  assert.ok(o.parts[0].info.name.endsWith('002.png'));
});
test('shader triggers ease, spawn and restore at practice checkpoints; Stop cannot reach shader fades', () => {
  const l = fixture(['1,2919,2,0,176,1,10,1,57,2', '1,2910,2,100,62,1,57,5,176,2,180,3,188,1', '1,1268,2,0,51,5', '1,1616,2,1,51,2']);
  l.checkShaderTriggers(0); l.shaderState.step(0.25);
  near(l.shaderState.uniforms()._grayscaleValue, 0.25);
  l.checkSpawnTriggers(0); l.stepSpawnTriggers(0);
  assert.ok(l.shaderState.effects[2910]);
  const snapshot = l.captureRuntimeState();
  // GJShaderState tweens carry unique id -1 in the native game.
  l.checkStopTriggers(2); l.shaderState.step(0.25);
  near(l.shaderState.uniforms()._grayscaleValue, 0.5);
  l.resetObjects(); l.restoreRuntimeState(snapshot); l.shaderState.step(0.25);
  near(l.shaderState.uniforms()._grayscaleValue, 0.5);
});
test('native shader property mapping: edit colour, radial blur and the -909190 sentinel', () => {
  // Hyperluminal's edit colour: CR 176, CG 191, CB 175, BR 179 (absent = 0), BG 180, BB 189.
  const l = fixture(['1,2923,2,0,175,1.06,176,1.01,180,0.01,189,0.02,191,1.02',
    '1,2914,2,0,176,1,179,1,181,1,10,0']);
  l.checkShaderTriggers(0);
  const u = l.shaderState.uniforms();
  near(u._colorChangeC[0], 1.01); near(u._colorChangeC[1], 1.02); near(u._colorChangeC[2], 1.06);
  near(u._colorChangeB[0], 0); near(u._colorChangeB[1], 0.01); near(u._colorChangeB[2], 0.02);
  near(u._radialBlurValue, 1 / 45); near(u._blurFade, 0.2); near(u._blurIntensity, 2);
  const s = l.shaderState; s.trigger({ id: 2922, raw: { 176: '-909190' } });
  assert.equal(u._hueShiftCosA, undefined); near(s.v[38], 0);
});
test('the pit object creates its custom-setup texture instead of an empty sprite', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = name => name === 'pit_01_001.png' ? { key: 'test', slot: 0, w: 30, h: 27, cw: 30, ch: 27, ox: 0, oy: 0 } : null;
  const o = r.addObject(parseObject('1,1715,2,100,3,100'));
  assert.equal(o.parts.length, 1); assert.equal(o.parts[0].info.w, 30);
});
test('spider teleport selects the nearest real platform for normal and mini players', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype);
  p._scene = { _playerWorldX: 100 };
  p._gameLayer = { getFloorY: () => 0, getCeilingY: () => 800,
    getNearbySectionObjects: () => [
      { type: 'solid', x: 100, y: 300, w: 60, h: 60 },
      { type: 'solid', x: 100, y: 200, w: 60, h: 60, passable: true },
      { type: 'solid', x: 100, y: 180, w: 60, h: 60, noTouch: true },
      { type: 'solid', x: 100, y: 160, w: 60, h: 60, _eeDisabled: true }
    ] };
  p.flipGravity = function (flipped) { this.p.gravityFlipped = flipped; };
  p._spawnSpiderTeleportEffects = () => {};
  for (const mini of [false, true]) {
    p.p = new context.testAPI.PlayerState(); p.p.y = 100; p.p.isMini = mini;
    assert.equal(p._teleportToOppositeSurface(), true);
    near(p.p.y, mini ? 252 : 240); assert.equal(p.p.gravityFlipped, true);
    p.p.y = 500;
    assert.equal(p._teleportToOppositeSurface(), true);
    near(p.p.y, mini ? 348 : 360); assert.equal(p.p.gravityFlipped, false);
  }
});
test('follow tracks source movement on each axis and keeps collision in sync', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1,2,200,3,100,57,2',
    '1,1347,2,0,51,2,71,1,72,0.5,73,0.25,10,1',
    '1,901,2,0,51,1,28,60,29,80,10,1']);
  l.checkFollowTriggers(0); l.checkMoveTriggers(0);
  l.stepMoveTriggers(0); l.stepMoveTriggers(0.5); l.stepFollowTriggers(0.5);
  near(l.gdObjects[1].offX, 15); near(l.gdObjects[1].offY, 10);
  near(l.objects[1].x, 430); near(l.objects[1].y, 220);
  const snapshot = l.captureRuntimeState();
  l.stepMoveTriggers(0.5); l.stepFollowTriggers(0.5);
  near(l.gdObjects[1].offX, 30); assert.equal(l._activeFollowTweens.length, 0);
  l.resetObjects(); l.resetMoveTriggers(); l.restoreRuntimeState(snapshot);
  l.stepMoveTriggers(0.5); l.stepFollowTriggers(0.5);
  near(l.gdObjects[1].offX, 30); near(l.objects[1].x, 460);
});
test('Follow carries shared-group motion through a chain in dependency order and after respawn', () => {
  // Original-engine follow-shared.gmd: all three nodes gain 29.5 GD units
  // by tick 120 even though the Move addresses the source's other group.
  for (const reverse of [false, true]) {
    const follow=['1,1347,2,0,51,2,71,1,72,1,73,1,10,10',
      '1,1347,2,0,51,4,71,2,72,1,73,1,10,10'];
    const l=fixture(['1,1,2,100,3,200,57,1.3','1,1,2,160,3,200,57,2',
      '1,1,2,220,3,200,57,4',...(reverse ? follow.reverse() : follow),
      '1,901,2,0,51,3,29,60,10,1']);
    l.checkFollowTriggers(0);l.checkMoveTriggers(0);l.stepMoveTriggers(0);
    const step=n=>{for(let i=0;i<n;i++){l.stepMoveTriggers(1/240);l.stepFollowTriggers(1/240);}};
    step(120);
    for(let i=0;i<3;i++)near(l.gdObjects[i].offY,30,1e-6);
    const saved=l.captureRuntimeState();step(60);
    for(let i=0;i<3;i++)near(l.gdObjects[i].offY,45,1e-6);
    l.resetObjects();l.resetMoveTriggers();l.restoreRuntimeState(saved);step(60);
    for(let i=0;i<3;i++)near(l.gdObjects[i].offY,45,1e-6);
  }
});

test('Follow coefficient updates replace one target/source pair and preserve other sources', () => {
  const l=fixture(['1,1,2,100,3,100,57,1','1,1,2,200,3,100,57,2','1,1,2,300,3,100,57,3',
    '1,1347,2,0,51,3,71,1,72,1,73,0,10,10',
    '1,1347,2,0,51,3,71,2,72,2,73,0,10,10',
    '1,1347,2,10,51,3,71,1,72,0.5,73,0,10,10',
    '1,901,2,0,51,1,28,60,10,1','1,901,2,0,51,2,28,20,10,1']);
  l.checkFollowTriggers(0);l.checkMoveTriggers(0);
  l.stepMoveTriggers(0); l.stepMoveTriggers(.25);l.stepFollowTriggers(.25);near(l.gdObjects[2].offX,25);
  l.checkFollowTriggers(20);assert.equal(l._activeFollowTweens.length,2);
  l.stepMoveTriggers(.25);l.stepFollowTriggers(.25);near(l.gdObjects[2].offX,42.5);
  near(l.objects[2].x,685);
  const saved=l.captureRuntimeState();l.resetObjects();l.restoreRuntimeState(saved);
  l.stepMoveTriggers(.25);l.stepFollowTriggers(.25);near(l.gdObjects[2].offX,60);
});
test('Follow Player Y approaches each member independently and keeps collision and moves in sync', () => {
  const l = fixture(['1,1,2,100,3,50,57,1', '1,1,2,130,3,200,57,1',
    '1,1814,2,0,51,1,90,1,10,10']);
  scene._state.y = 200;
  l.checkFollowTriggers(0); l.stepFollowTriggers(.01);
  near(l.gdObjects[0].y + l.gdObjects[0].offY, 80);
  near(l.objects[0].y, 160); near(l.objects[1].y, 280);
  l._translateGroup(1, 0, -20);
  near(l.objects[0].y, 180); near((l.gdObjects[0].y + l.gdObjects[0].offY) * 2, 180);
  l.stepFollowTriggers(.01);
  near(l.objects[0].y, 192); near((l.gdObjects[0].y + l.gdObjects[0].offY) * 2, 192);
  scene._state.y = 0;
});

test('Follow Player Y quantizes delay, caps motion and restores history at a checkpoint', () => {
  const l = fixture(['1,1,2,100,3,50,57,1', '1,1814,2,0,51,1,90,1,91,0.02,105,2,10,10']);
  l.checkFollowTriggers(0);
  for (const y of [200,400,600]) { scene._state.y = y; l.stepFollowTriggers(.01); }
  near(l.objects[0].y, 102.4); // First two samples have no delayed target yet.
  const saved = l.captureRuntimeState();
  scene._state.y = 800; l.stepFollowTriggers(.01); near(l.objects[0].y, 104.8);
  for (let n=0;n<2;n++) {
    l.resetObjects(); l.resetMoveTriggers(); l.restoreRuntimeState(saved);
    scene._state.y = 800; l.stepFollowTriggers(.01); near(l.objects[0].y, 104.8);
  }
  l._applyStopTrigger({targetGroup:1}); assert.equal(l._activeFollowTweens.length,0);
  scene._state.y = 0;
});

test('stop cancels an active follow action', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1,2,200,3,100,57,2',
    '1,1347,2,0,51,2,71,1,10,10,57,3', '1,1616,2,1,51,3']);
  l.checkFollowTriggers(0); assert.equal(l._activeFollowTweens.length, 1);
  l.checkStopTriggers(2); assert.equal(l._activeFollowTweens.length, 0);
});
test('saved axis scales take precedence over legacy uniform scale for artwork and collision', () => {
  for (const [properties, sx, sy] of [
    ['32,3',3,3], ['32,3,128,2,129,0.5',2,0.5],
    ['32,3,128,2',2,1], ['32,3,129,0.5',1,0.5],
    ['32,3,128,0,129,0',3,3], ['32,0',1,1],
    ['32,3,128,0,129,2',1,2], ['32,3,128,2,129,0',2,1],
    ['128,-2,129,3',-2,3], ['32,-2',-2,-2], ['128,-1.43,129,-1.43',-1.43,-1.43]
  ]) {
    const l=fixture(['1,1,2,200,3,200,'+properties]);
    near(l.gdObjects[0].scaleX,sx);near(l.gdObjects[0].scaleY,sy);
    // Native CCRect clamps signed extents after calculating their origin.
    near(l.objects[0].w,60*Math.max(0,sx));near(l.objects[0].h,60*Math.max(0,sy));
    near(l.objects[0].x,400-30*Math.min(0,sx));near(l.objects[0].y,400-30*Math.min(0,sy));
  }
});

test('editor save and reopen retain uniform, stretched and newly edited effective sizes', () => {
  if (!context.LevelEditor) vm.runInContext(fs.readFileSync(path.join(root,'assets/scripts/core/level-editor.js'),'utf8'),context);
  const editor=Object.create(context.LevelEditor.prototype);
  editor._getEditorObjectGroupIds=()=>[];
  for (const [properties,sx,sy] of [['32,3',3,3],['32,3,128,2,129,0.5',2,0.5],['128,2',2,1],['128,-2,129,3',-2,3]]) {
    let object=parseObject('1,1,2,200,3,200,'+properties);
    for(let n=0;n<3;n++) {
      object=parseObject(editor._serializeObject(object));
      near(object.scale*object.scaleX,sx);near(object.scale*object.scaleY,sy);
    }
    object.scale=2;
    const edited=parseObject(editor._serializeObject(object));
    near(edited.scale*edited.scaleX,sx*2);near(edited.scale*edited.scaleY,sy*2);
  }
});

test('scale transforms group positions and collider sizes around the same centre', () => {
  const l = fixture(['1,1,2,200,3,200,57,1', '1,1764,2,100,3,100,57,2',
    '1,2067,2,0,51,1,71,2,150,2,151,3,10,1']);
  l.checkScaleTriggers(0); l.stepScaleTriggers(0.5);
  const obj = l.gdObjects[0], col = l.objects[0];
  near(obj.x + obj.offX, 250); near(obj.y + obj.offY, 300);
  near(col.x, 500); near(col.y, 600); near(col.w, 90); near(col.h, 120);
  l.stepScaleTriggers(0.5);
  near(col.x, 600); near(col.y, 800); near(col.w, 120); near(col.h, 180);
  assert.equal(col.shapeOverlapsRect(600, 800, 1, 1), true);
  assert.equal(col.shapeOverlapsRect(700, 800, 1, 1), false);
});
test('only-move scaling leaves object and collision size unchanged', () => {
  const l = fixture(['1,1,2,200,3,200,57,1', '1,1764,2,100,3,100,57,2',
    '1,2067,2,0,51,1,71,2,150,2,151,3,133,1']);
  l.checkScaleTriggers(0); l.stepScaleTriggers(0);
  near(l.objects[0].x, 600); near(l.objects[0].y, 800);
  near(l.objects[0].w, 60); near(l.objects[0].h, 60);
  assert.deepEqual(Array.from(l.gdObjects[0].affine), [1, 0, 0, 1]);
});
test('nonuniform scale uses world or reference axes and preserves the actual polygon', () => {
  for (const relative of [false, true]) {
    const l = fixture(['1,1,2,200,3,200,6,45,57,1', '1,1764,2,100,3,100,6,45,57,2',
      '1,2067,2,0,51,1,71,2,150,2,151,1,452,' + (relative ? '1' : '0')]);
    l.checkScaleTriggers(0); l.stepScaleTriggers(0);
    const col = l.objects[0];
    near(col.w, (relative ? 90 : 120) * Math.SQRT2);
    near(col.h, (relative ? 90 : 60) * Math.SQRT2);
    assert.equal(col.shapeOverlapsRect(col.x + col.w / 2 - 1, col.y + col.h / 2 - 1, 0.1, 0.1), false,
      'a stretched diamond must not collide throughout its bounding rectangle');
    const range = col.shapeVerticalRange(col.x - 1, col.x + 1);
    assert.ok(range.lower < col.y && range.upper > col.y);
  }
});
test('divide scale and checkpoint restores undo the full affine and collision geometry', () => {
  const l = fixture(['1,1,2,200,3,200,6,45,57,1', '1,1764,2,100,3,100,57,2',
    '1,2067,2,0,51,1,71,2,150,3,151,2,10,1', '1,2067,2,5,51,1,71,2,150,3,151,2,153,1,154,1']);
  l.checkScaleTriggers(0); l.stepScaleTriggers(1);
  const snapshot = l.captureRuntimeState(), col = l.objects[0], width = col.w;
  l.checkScaleTriggers(10); l.stepScaleTriggers(0);
  near(col.w, 60 * Math.SQRT2); near(col.x, 400);
  l.resetObjects(); l.resetMoveTriggers(); l.resetRotateTriggers();
  assert.equal(col.shape, undefined); near(col.w, 60);
  l.restoreRuntimeState(snapshot); near(col.w, width); near(l.gdObjects[0].affine[0], 3);
  l.checkScaleTriggers(10); l.stepScaleTriggers(0);
  near(col.w, 60 * Math.SQRT2); near(col.x, 400);
});
test('relative scale shrinks by the reference amount instead of repeated multiplication', () => {
  for (const relative of [false, true]) {
    const l = fixture(['1,1,2,100,3,100,57,1.2', ...[0, 1, 2].map(x =>
      `1,2067,2,${x},51,1,71,2,150,0.9,151,0.9,577,${relative ? 1 : 0}`)]);
    for (const x of [0, 2, 4]) { l.checkScaleTriggers(x); l.stepScaleTriggers(0); }
    near(l.gdObjects[0].affine[0], relative ? 0.7 : 0.729);
    near(l.objects[0].w, (relative ? 0.7 : 0.729) * 60);
  }
});
test('Relative Scale normalizes placed reference size and includes current Area scale', () => {
  const l=fixture(['1,3807,2,100,3,1000,57,293,274,293,129,0.757',
    '1,3807,2,200,3,1100,57,294.296', '1,3008,2,0,3,0,51,293,71,293,222,1000,233,1,235,0.2',
    '1,2067,2,30,3,0,51,294,71,293,150,1,151,1.2,577,1']);
  l.checkAreaTriggers(0); l.areaState.step(0);
  l.checkScaleTriggers(60); l.stepScaleTriggers(0);
  const o=l.gdRenderer.groups.get(296)[0], p=l.gdRenderer.livePosition(o,{});
  // Native ends at (200,1290), scaleY 2, despite the .757 placed reference.
  near(p.x,200); near(p.y,1200); near(o.affine[3],2);
  const plain=fixture(['1,3807,2,100,3,1000,57,293,274,293,128,0.353,129,0.757',
    '1,3807,2,200,3,1100,57,294.296',
    '1,2067,2,0,51,294,71,293,150,1,151,0.3,577,1',
    '1,2067,2,30,51,294,71,293,150,1,151,0.7,154,1,577,1']);
  plain.checkScaleTriggers(0); plain.stepScaleTriggers(0);
  plain.checkScaleTriggers(60); plain.stepScaleTriggers(0);
  near(plain.gdRenderer.groups.get(296)[0].affine[3],3/7);
});

test('scaled slopes and inverse anisotropic circle scaling retain valid hitboxes', () => {
  const l = fixture(['1,289,2,100,3,100,6,90,57,1', '1,2067,2,0,51,1,150,2,151,0.5']);
  l.checkScaleTriggers(0); l.stepScaleTriggers(0);
  const col = l.objects[0]; near(col.w, 120); near(col.h, 30);
  assert.ok(Number.isFinite(col.getSlopeAngleRad()));
  const circle = new context.testAPI.Collider('hazard', 0, 0, 60, 60);
  circle.hitbox_radius = 20;
  circle.transformShape(2, 0, 0, 0.5); near(circle.hitbox_radius, 40);
  circle.transformShape(0.5, 0, 0, 2); near(circle.hitbox_radius, 20);
});
test('chromatic glitch uses native RGB units, preserves negative offsets and disables zero scan lines', () => {
  const l=fixture([]),s=l.shaderState;
  const k=Math.sqrt(960*960+640*640)/960*480/569;
  for(const offset of [1,.02,0,-.02]) {
    s.trigger({id:2911,raw:{180:String(offset),176:'1'}});
    const u=s.uniforms();near(u._cGRGBOffset,(offset===0?.0001:offset*.01)*k);
    assert.equal(u._cGLineThick,0);
  }
  s.trigger({id:2911,raw:{180:'.02',179:'1',189:'.5'}});
  const u=s.uniforms();near(u._cGLineThick,1-k*.2);near(u._cGLineStrength,.025);
  s.trigger({id:2911,raw:{175:'15',179:'1',189:'.56'}});
  near(s.v[8],1/15);near(s.uniforms()._cGHeight,(1/15)/(k/(320/569)));
  s.trigger({id:2911,raw:{175:'-909190'}});near(s.v[8],1/15);
});

test('shock line uses native thickness, phase, wave frequency and parameter tweens', () => {
  const s=fixture([]).shaderState,k=Math.sqrt(960*960+640*640)/960*480/569;
  s.trigger({id:2907,raw:{175:'.76',176:'1.2',180:'.43',179:'1',181:'1',182:'5',186:'1',514:'1'}});
  s.step(.5);const u=s.uniforms();
  near(u._shockLineTime,8.36%(Math.PI*2));near(u._shockLineTime1,.381*k);
  near(u._shockLineTime2,.294*k);near(u._shockLineTime3,.209*k);near(u._shockLineTime4,-.222*k);
  near(u._shockLineWaves,22/k);near(u._shockLineStrength[0],.012*k);near(u._shockLineStrength[1],.012*k);
  s.trigger({id:2907,raw:{513:'1',175:'-909190',176:'2.4',10:'1'}});
  near(s.s.line.phase,.38);near(s.v[52],1.2);s.step(.5);near(s.v[52],1.8);near(s.s.line.phase,.76);
  const saved=s.capture();s.reset();s.restore(saved);near(s.s.line.phase,.76);
});

test('free camera padding has native edge insets and follows zoom', () => {
  const c=fixture([]).cameraState;
  c.freePadding=0;near(c.freeDeadZone(640),260);
  c.freePadding=.5;near(c.freeDeadZone(640),132);near(c.freeDeadZone(640,2),66);
  c.freePadding=1;near(c.freeDeadZone(640),4);
  near(c.freeFollowAmount(.25),.025);near(c.freeFollowAmount(1),.1);
  near(c.freeFollowAmount(0),0);near(c.freeFollowAmount(0,true),1);
});

test('camera zoom, rotation and axis-only offsets ease independently', () => {
  const l = fixture(['1,1913,2,0,371,0.5,10,1', '1,2015,2,0,68,90,10,1',
    '1,1916,2,0,28,30,29,60,101,2,10,1']);
  l.checkCameraTriggers(0); l.cameraState.step(0.5);
  near(l.cameraState.values.zoom, 0.75); near(l.cameraState.values.rotation, 45);
  near(l.cameraState.values.offsetX, 0); near(l.cameraState.values.offsetY, 60);
  const saved = l.captureRuntimeState();
  l.cameraState.step(0.5); near(l.cameraState.values.zoom, 0.5);
  l.resetObjects(); l.restoreRuntimeState(saved); l.cameraState.step(0.5);
  near(l.cameraState.values.zoom, 0.5); near(l.cameraState.values.rotation, 90);
});
test('a static camera can target an invisible camera guide and release instantly', () => {
  const l = fixture(['1,2016,2,1000,3,500,57,7', '1,1914,2,0,71,7,10,1',
    '1,1914,2,10,110,1,465,1']);
  const target = l.gdRenderer.groupCenter(7);
  near(target.x, 1000); near(target.y, 500);
  assert.equal(l.gdObjects[0].hidden, true);
  l.checkCameraTriggers(0); l.cameraState.step(1);
  let view = l.cameraState.view(1138, 640, 0, 0);
  near(view.x, 2000); near(view.y, 1000);
  l.checkCameraTriggers(20); view = l.cameraState.view(1138, 640, 0, 0);
  near(view.scrollX, 0); near(view.scrollY, 0);
});
test('an Instant Count camera is not overwritten by earlier ordinary camera commands in the same tick', () => {
  for(const later of [false,true]) {
    const l=fixture(['1,2016,2,1000,3,500,57,1','1,2016,2,2000,3,700,57,2',
      '1,2016,2,3000,3,900,57,3','1,1914,2,-15,71,1',
      '1,1811,2,-11,80,5,77,0,51,9,56,1','1,1914,2,1,71,2,57,9,62,1',
      ...(later?['1,1914,2,-5,71,3']:[])]);
    l.checkCountTriggers(0);l.checkCameraTriggers(0);l.cameraState.step(0);
    near(l.cameraState.view(1138,640,0,0).x,later?6000:4000);
  }
});
test('spawned camera order follows upward and reverse channel progress rather than spawn layout X', () => {
  for(const direction of [{x:0,y:1},{x:-1,y:0}]) {
    const at=n=>`2,${direction.x*n},3,${direction.y*n}`;
    const l=fixture(['1,2016,2,1000,3,500,57,1','1,2016,2,2000,3,700,57,2',
      `1,1914,${at(-15)},71,1,170,1`, `1,1811,${at(-11)},80,5,51,9,56,1,170,1`,
      '1,1914,2,10000,3,10000,71,2,57,9,62,1,170,1']);
    l._gameplayChannel=1;l._channelDirections[1]=direction;
    l.checkCountTriggers(0);l.checkCameraTriggers(0);l.cameraState.step(0);
    near(l.cameraState.view(1138,640,0,0).x,4000);
  }
});

test('an Instant Count keeps the spawned shader range after earlier gameplay shader commands', () => {
  for (const later of [false, true]) {
    const l = fixture(['1,2904,2,-15,197,11',
      '1,1811,2,-11,80,5,51,9,56,1', '1,2904,2,900,57,9,62,1,197,1',
      ...(later ? ['1,2904,2,-5,197,6'] : [])]);
    l.checkCountTriggers(0); l.checkShaderTriggers(0);
    assert.equal(l.shaderState.s.zMax, later ? 6 : 1);
  }
});

test('UI settings pin offscreen groups to native centre and edge anchors outside the world camera', () => {
  const l = fixture(['1,2016,2,1000,3,5000,57,1',
    '1,1,2,1010,3,5020,57,2', '1,3613,2,9000,51,2,71,1,385,2,386,6',
    '1,1,2,800,3,4880,57,3', '1,1,2,1200,3,5120,57,3',
    '1,3613,2,9000,51,3,71,1',
    '1,1,2,1010,3,5020,57,4', '1,3613,2,9000,51,4,71,1,385,4,386,8,387,1,388,1',
    '1,3802,2,1010,3,5020,57,5,135,1', '1,3613,2,9000,51,5,71,1,385,2,386,6'], r => {
    r.frames.textures = ['test'];
    r.frames.get = () => ({key:'test',slot:0,u0:0,v0:0,u1:1,v1:1,w:30,h:30,cw:30,ch:30,ox:0,oy:0});
  });
  const r = l.gdRenderer, centre = r.groups.get(2)[0], edges = r.groups.get(3), relative = r.groups.get(4)[0];
  near(centre.x, 294.5); near(centre.y, 180);
  near(edges[0].x, 40); near(edges[0].y, 40);
  near(edges[1].x, 529); near(edges[1].y, 280);
  near(relative.x, 569 + (10 - 240) * 569 / 480); near(relative.y, 180);
  assert.equal(r.uiObjects.size, 5);
  const hidden = r.groups.get(5)[0];
  assert.ok(hidden.isUIObject && hidden.hidden, 'UI retains authored Hide on a group helper');
  near(hidden.x, centre.x); near(hidden.y, centre.y);
  const uiCollider=l.objects.find(c=>c._eeObjectId===centre.linkedId);
  assert.ok(uiCollider?._eeUIObject);
  assert.ok(!l.getNearbySectionObjects(uiCollider.x).includes(uiCollider));
  r.colorManager = scene._colorManager;
  r.setCamera(50000, -50000, 30, 40); r.camera.mirror = -1; r.update(0);
  const uiRanges = r.ranges.filter(range => range.overlay);
  assert.ok(uiRanges.length && uiRanges.every(range => range.above && range.screen));
  assert.ok(uiRanges.every(range => range.gradientBlend === -1), 'UI coordinates must not select a gradient blend mode');
  const vertices = [...r._vf.subarray(0, r.quadCount * 24)];
  r.setCamera(-30000, 70000); r.camera.mirror = 1; r.update(0);
  assert.deepEqual([...r._vf.subarray(0, r.quadCount * 24)], vertices);
  l._translateGroup(2, 20, -40); r.update(0);
  near(centre.x + centre.offX, 304.5); near(centre.y + centre.offY, 200);
  assert.ok(!l.getNearbySectionObjects(uiCollider.x).includes(uiCollider));
  const saved = l.captureRuntimeState(); l.resetObjects(); l.restoreRuntimeState(saved);
  near(centre.x + centre.offX, 304.5); near(centre.y + centre.offY, 200);
});
test('static camera retargets from its visible position instead of snapping between locked targets', () => {
  scene._playerWorldX=419;
  const l = fixture(['1,2016,2,1000,3,500,57,7', '1,2016,2,1600,3,800,57,8']);
  const c = l.cameraState, trigger = raw => c.trigger({ id: 1914, raw });
  trigger({71:'7'});
  trigger({71:'8',10:'1',101:'1'});
  let v = c.view(1138,640,0,0); near(v.x,2000); near(v.y,1000);
  c.step(.25); v = c.view(1138,640,0,0); near(v.x,2300); near(v.y,1000);
  const saved = c.capture();
  c.step(.75); near(c.view(1138,640,0,0).x,3200);
  c.restore(saved); c.step(.75); near(c.view(1138,640,0,0).x,3200);
  trigger({110:'1',10:'1',101:'1'}); c.step(.5);
  near(c.view(1138,640,0,0).x,(3200+569)/2);
  c.step(.5); near(c.view(1138,640,0,0).x,569); near(c.view(1138,640,0,0).y,1000);
});
test('static camera following uses native linear tick fractions and snaps at ease one', () => {
  const l = fixture(['1,36,2,1000,3,500,57,7']), c = l.cameraState;
  const follow = ease => c.trigger({id:1914,raw:{71:'7',212:'1',213:String(ease)}});
  c.trigger({id:1914,raw:{71:'7'}}); follow(4);
  l._translateGroup(7,160,-80); c.step(1/240);
  near(c.targets.x.point.x,1005); near(c.targets.y.point.y,502.5);
  const saved = c.capture(); c.step(1/60); near(c.targets.x.point.x,1023.75);
  c.restore(saved); c.step(1/60); near(c.targets.x.point.x,1023.75);
  follow(1); c.step(1/240); near(c.targets.x.point.x,1080); near(c.targets.y.point.y,540);
  // Dash uses a negative duration plus ease 50/100 to begin a slow follow
  // from the existing camera, rather than snapping there on trigger arrival.
  c.trigger({id:1914,raw:{71:'7',212:'1',213:'100',10:'-1'}});
  l._translateGroup(7,200,0); c.step(1/240); near(c.targets.x.point.x,1080.25);
});
test('smooth static camera uses native velocity Bezier handles for entry, retarget and exit', () => {
  scene._playerWorldX=419;
  const l = fixture(['1,2016,2,1000,3,500,57,7', '1,2016,2,1600,3,800,57,8']), c = l.cameraState;
  const trigger = raw => c.trigger({id:1914,raw});
  trigger({71:'7'}); c.velocity={x:120,y:-60};
  trigger({71:'8',10:'2',453:'1',454:'.25'}); c.step(.5);
  // Native cubic at t=.25: P0=(1000,500), P1=(1080,460),
  // P2=(1470,715), P3=(1600,800).
  let v=c.view(1138,640,0,0); near(v.x/2,1109.21875); near(v.y/2,518.046875);
  const saved=c.capture(); c.step(1.5); near(c.view(1138,640,0,0).x,3200);
  c.restore(saved); c.step(1.5); near(c.view(1138,640,0,0).y,1600);
  c.velocity={x:0,y:0}; trigger({110:'1',10:'1',453:'1'}); c.step(.25);
  near(c.view(1138,640,0,0).x/2,1600+(284.5-1600)*.15625);
  c.step(.75); v=c.view(1138,640,0,0); near(v.x,569); near(v.y,140);
  assert.equal(c.targets.x,null); assert.equal(c.targets.y,null);
});
test('camera velocity is derived from its world movement and retained in practice checkpoints', () => {
  const l=fixture([]),c=l.cameraState;
  const oldX=scene._cameraX; scene._cameraX=0; c.step(1/240);
  scene._cameraX=2; c.step(1/240); near(c.velocity.x,240);
  const saved=c.capture(); c.reset(); c.restore(saved);
  scene._cameraX=4; c.step(1/240); near(c.velocity.x,240);
  // Native still multiplies displacement by 240 in slow TimeWarp; it
  // does not divide by the shorter game-time step and inflate velocity.
  scene._cameraX=4.2; c.step(.1/240); near(c.velocity.x,24);
  scene._cameraX=oldX;
});

test('Dash Smooth Velocity exit follows the live camera with measured native offsets on both axes',()=>{
 const n=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-camera-static-exit.json'),'utf8'));
 const l=fixture([`1,2016,2,${n.startX},3,${n.startY-90},57,7`]),c=l.cameraState;
 c.freeMode=true;c.values.zoom=n.zoom;scene._playerWorldX=n.rows[0].playerX*2;
 c.follow.leadX=150/n.zoom;scene._cameraX=scene._playerWorldX+c.follow.leadX-569;
 c.trigger({id:1914,raw:{71:'7'}});c.velocity={x:n.velocityX,y:n.velocityY};
 c.trigger({id:1914,raw:{110:'1',10:'2',453:'1',30:'2',85:'1.8'}});
 let age=0;
 for(const row of n.rows){
  scene._playerWorldX=row.playerX*2;scene._cameraX=scene._playerWorldX+c.follow.leadX-569;
  c.step(row.age-age);age=row.age;
  // At X8500 the source position has ~.001 GD float resolution.
  near(c.targets.x?.point.x||0,row.offsetX,.001);near(c.targets.y?.point.y||0,row.offsetY,.001);
  const v=c.view(1138,640,scene._cameraX,scene._cameraY);
  near(v.x/2,row.playerX+75/n.zoom+row.offsetX,.001);
 }
});

test('a settled camera lead scales with zoom without a travel delay',()=>{
 const l=fixture([]),c=l.cameraState;scene._playerWorldX=2000;scene._cameraX=1581;scene._cameraY=0;
 c.followStep(.25);c.finishFollow(.25);c.values.zoom=.5;c.followStep(.25);
 near(c.follow.leadX,300);near(c.follow.cameraX,2000+300-569);
 c.targets.x={exit:true};c.values.zoom=.4;c.followStep(.25);
 near(c.follow.leadX,375);near(c.follow.cameraX,2000+375-569);
});

test('static camera exits begin at native phase zero while a simultaneous zoom advances',()=>{
 scene._physicsFrame=20;scene._playerWorldX=419;
 const l=fixture(['1,2016,2,1000,3,500,57,7']),c=l.cameraState;
 c.trigger({id:1914,raw:{71:'7'}});c.trigger({id:1914,raw:{110:'1',10:'1'}});
 c.trigger({id:1913,raw:{371:'.5',10:'1'}});c.step(1/240);
 near(c.targets.x.progress,0);near(c.values.zoom,1-.5/240);
 scene._physicsFrame++;c.step(1/240);
 near(c.targets.x.progress,1/240);near(c.values.zoom,1-1/240);
});
test('Stop freezes a camera transition phase while its Smooth Velocity follow endpoint remains live', () => {
  const l=fixture(['1,36,2,1000,3,500,57,7','1,36,2,1600,3,800,57,8']),c=l.cameraState;
  c.trigger({id:1914,raw:{71:'7'}});c.velocity={x:0,y:0};
  c.trigger({id:1914,raw:{71:'8',212:'1',453:'1',10:'1',57:'9'},groups:[9]});
  c.step(.5);near(c.view(1138,640,0,0).x,2600);
  l._applyStopTrigger({targetGroup:9});assert.equal(c.tweens.length,0);
  const saved=c.capture();
  for(let n=0;n<2;n++) {
    c.restore(saved);l._translateGroup(8,200,0);c.step(.2);
    near(c.targets.x.progress,.5);near(c.view(1138,640,0,0).x,2700);
    l._translateGroup(8,-200,0);
  }
});
test('ordinary static position easing retains overshoot while native follow and Smooth phases stop at the endpoint', () => {
  for(const flags of [{},{212:'1'},{453:'1'}]) {
    const l=fixture(['1,2016,2,1000,3,500,57,7','1,2016,2,1600,3,800,57,8']),c=l.cameraState;
    c.trigger({id:1914,raw:{71:'7'}});c.velocity={x:0,y:0};
    c.trigger({id:1914,raw:{71:'8',10:'1',30:'18',...flags}});c.step(.5);
    const phase=Easing.sample(18,2,.5);assert.ok(phase>1);
    near(c.view(1138,640,0,0).x,flags[212]||flags[453]?3200:2000+1200*phase);
    c.step(.1);const next=Easing.sample(18,2,.6);
    near(c.view(1138,640,0,0).x,flags[212]||flags[453]?3200:2000+1200*next);
  }
});
test('a scene restart clears a cancelled font request so the next level can load its text', () => {
  const {EventEmitter}=require('node:events'),loader=new EventEmitter(),events=new EventEmitter(),seen=[];
  let requests=0;loader.image=()=>requests++;loader.text=()=>{};loader.isLoading=()=>false;loader.start=()=>{};
  const s={load:loader,events,cache:{bitmapFont:{has:()=>false},text:{get:()=>null}},textures:{exists:()=>false}};
  const ensure=context.LevelObject.prototype._ensureLevelFont;
  ensure.call({_scene:s,gdRenderer:{fontLoaded:()=>seen.push('old')}},'gjFont59');
  events.emit('shutdown');
  ensure.call({_scene:s,gdRenderer:{fontLoaded:()=>seen.push('new')}},'gjFont59');
  loader.emit('complete');
  assert.equal(requests,2);assert.deepEqual(seen,['new']);assert.equal(events.listenerCount('shutdown'),0);
});

test('a spawned Move created before processing retains the native next-step command phase', () => {
 const old={active:scene._fixedTickActive,frame:scene._physicsFrame};
 const l=fixture(['1,1,2,100,3,100,57,1','1,901,2,200,51,1,29,60,10,1,57,2,62,1']);
 scene._fixedTickActive=true;scene._physicsFrame=10;l._activateSpawnedGroup(2);
 l.stepMoveTriggers(1/240);near(l.gdRenderer.livePosition(l.gdObjects[0],{}).y,100);
 scene._physicsFrame=11;l.stepMoveTriggers(1/240);near(l.gdRenderer.livePosition(l.gdObjects[0],{}).y,100.25);
 scene._fixedTickActive=old.active;scene._physicsFrame=old.frame;
});

test('a zero-delay nested Spawn updates WHAT ship counters before later sibling commands read them', () => {
  const l=fixture([
    '1,1268,2,0,51,1',
    '1,1268,2,10,57,1,62,1,51,2',
    '1,1811,2,20,57,1,62,1,80,20,77,1,51,3,56,1',
    '1,1817,2,30,57,2,62,1,80,20,77,1',
    '1,1817,2,40,57,3,62,1,80,99,77,1'
  ]);
  l.checkSpawnTriggers(0);
  l.stepSpawnTriggers(0);
  assert.equal(l._itemCounts.get(20),1);assert.equal(l._itemCounts.get(99),1);
  assert.equal(l._activeSpawnDelays.length,0);
});

test('ordinary Spawn uses the native placed-X group order for WHAT Count/Pickup feedback', () => {
  const l=fixture([
    '1,1817,2,8392.9,57,380,62,1,87,1,80,10,77,1',
    '1,1811,2,8391.9,57,380,62,1,87,1,80,10,88,1,51,344,56,1',
    '1,1817,2,8421.9,57,344,62,1,87,1,80,10,77,-1'
  ]);
  l._activateSpawnedGroup(380);
  assert.equal(l._itemCounts.get(10),1,'Count reads zero before Pickup increments; file order would cancel the press');
  const source=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-spawn-groups.json'),'utf8'));
  const native=source.groups.find(g=>g.group===380).objects;
  assert.deepEqual(native.map(o=>o.id),[901,1811,1817]);
  assert.ok(native[1].uid>native[2].uid,'native group order differs from allocation/file order');
});

test('camera zoom clamps its destination to the measured native 0.4 through 3 range', () => {
  const c=fixture([]).cameraState;
  // Isolated original-engine fixtures: 0.1 produces 0.40000000596,
  // 10 produces 3 (33eac0..33eb10). FernanFinal uses both 0.1 and 0.2.
  c.trigger({id:1913,raw:{371:'.1',10:'1'}});c.step(.5);near(c.values.zoom,.7);
  c.step(.5);near(c.values.zoom,.4);
  c.trigger({id:1913,raw:{371:'10'}});near(c.values.zoom,3);
  c.trigger({id:1913,raw:{371:'0'}});near(c.values.zoom,1);
});

test('a top camera edge below the viewport cannot pull Troll under the ground or store hidden follow drift', () => {
  const c=fixture(['1,8,2,1005,3,15,57,35']).cameraState;
  c.trigger({id:2062,raw:{51:'35',164:'3'}});
  near(c.view(1138,640,1000,130).y,140);
  near(c.constrainFollowY(130),0);
  c.trigger({id:2062,raw:{164:'3'}});
  near(c.view(1138,640,1000,c.constrainFollowY(0)).y,140);
  c.values.zoom=.5;c.trigger({id:2062,raw:{51:'35',164:'3'}});
  near(c.view(1138,640,1000,130).y,460);
});

test('rotated gameplay transfers the camera lead by actual travel and retains it in a checkpoint', () => {
  const l=fixture([]),c=l.cameraState;
  const old={x:scene._playerWorldX,y:scene._state.y,cx:scene._cameraX,cy:scene._cameraY,frame:scene._physicsFrame};
  scene._playerWorldX=13470.9853516;scene._state.y=618;scene._cameraX=13064.319862;scene._cameraY=478;
  c.values.zoom=1/1.1;c.follow.lastX=scene._playerWorldX;c.follow.lastY=scene._state.y;
  l.gameplayState.u={x:0,y:1};scene._state.gravityFlipped=true;
  c.followStep(.25);near(c.follow.leadY,0);near(c.follow.cameraY,478);
  scene._state.y+=2.0930176;c.followStep(.25);near(c.follow.leadY,2.0930176);
  const saved=c.capture();scene._state.y+=200;c.followStep(.25);near(c.follow.leadY,165);
  c.restore(saved);near(c.follow.leadY,2.0930176);
  scene._playerWorldX=old.x;scene._state.y=old.y;scene._cameraX=old.cx;scene._cameraY=old.cy;scene._physicsFrame=old.frame;
  scene._state.gravityFlipped=false;
});

test('Dash travel-axis camera matches 222 consecutive measured native turn frames', () => {
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-camera.json'),'utf8')).dashTurn;
  const l=fixture([]),c=l.cameraState,first=rows[0];
  const old={x:scene._playerWorldX,y:scene._state.y,cx:scene._cameraX,cy:scene._cameraY,frame:scene._physicsFrame};
  scene._cameraX=first.cx*2-569;scene._cameraY=(first.cy-160)*2;
  Object.assign(c.follow,{lastX:first.x*2,lastY:(first.y-90)*2,leadX:first.leadX*2,leadY:first.leadY*2});
  for(const r of rows.slice(1)) {
    c.values.zoom=r.z;l.gameplayState.u={x:0,y:1};
    scene._state.gravityFlipped=r.g;scene._state.y=(r.y-90)*2;scene._playerWorldX=r.x*2;scene._physicsFrame=r.n;
    c.followStep(.25);scene._cameraX=c.follow.cameraX;scene._cameraY=c.follow.cameraY;
    near((scene._cameraX+569)/2,r.cx,.005);near(scene._cameraY/2+160,r.cy,.005);
  }
  scene._playerWorldX=old.x;scene._state.y=old.y;scene._cameraX=old.cx;scene._cameraY=old.cy;scene._physicsFrame=old.frame;
  scene._state.gravityFlipped=false;
});

test('a static camera axis does not accumulate a gameplay-turn lead for a later section',()=>{
 const l=fixture([]),c=l.cameraState,old={x:scene._playerWorldX,y:scene._state.y,cx:scene._cameraX,cy:scene._cameraY};
 l.gameplayState.u={x:0,y:-1};c.targets.y={};c.follow.lastY=scene._state.y;
 scene._state.y-=180;c.followStep(.25);near(c.follow.leadY,0);
 c.targets.y=null;scene._state.y-=2;c.followStep(.25);near(c.follow.leadY,-2);
 scene._playerWorldX=old.x;scene._state.y=old.y;scene._cameraX=old.cx;scene._cameraY=old.cy;
});

test('automatic camera turn offsets reproduce native Dash samples and resume from a checkpoint',()=>{
 const native=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-camera-turn-offsets.json'),'utf8'));
 const l=fixture([]),c=l.cameraState,old={cx:scene._cameraX,cy:scene._cameraY};
 Object.assign(c.follow,{previousX:100+2*native.from[0],previousY:200+2*native.from[1],axisChanged:true});
 scene._cameraX=100;scene._cameraY=200;c.finishFollow(.25);
 let tick=0;
 for(const row of native.rows){while(tick<row.tick){scene._cameraX=100;scene._cameraY=200;c.finishFollow(.25);tick++;}
  near((scene._cameraX-100)/2,row.offset[0],2e-4);near((scene._cameraY-200)/2,row.offset[1],2e-5);
 }
 const saved=c.capture();scene._cameraX=100;scene._cameraY=200;c.finishFollow(60);
 near(scene._cameraX,100);c.restore(saved);assert.ok(c.follow.turnX.age<1);
 scene._cameraX=old.cx;scene._cameraY=old.cy;
});

test('camera snap360 uses the nearest rotation and the world centre stays fixed', () => {
  const l = fixture(['1,2015,2,0,68,390,394,1']);
  l.checkCameraTriggers(0); near(l.cameraState.values.rotation, 30);
  const center = l.cameraState.project(284.5, 70);
  near(center[0], 0.5); near(center[1], 0.5);
  const v = l.cameraState.view(1138, 640, 0, 0);
  assert.ok(v.maxX - v.minX > 569, 'rotated culling must include the viewport corners');
});
test('inactive trigger channels are retained until that channel becomes active', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1007,2,0,51,1,35,0.7',
    '1,1007,2,0,51,1,35,0.2,170,1']);
  l.checkAlphaTriggers(1000); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.7);
  l._gameplayChannel = 1; l.checkAlphaTriggers(1000); l.stepAlphaTriggers(0);
  near(l._groupOpacity[1], 0.2);
});
test('upward and reversed channels sort their triggers along the movement direction', () => {
  const l = fixture(['1,1,2,100,3,100,57,1',
    '1,1007,2,0,3,100,51,1,35,0.3,170,1', '1,1007,2,0,3,200,51,1,35,0.6,170,1',
    '1,2900,2,1000,6,-90,171,1,173,1',
    '1,1007,2,300,51,1,35,0.4,170,2', '1,1007,2,100,51,1,35,0.8,170,2',
    '1,2900,2,1000,6,180,171,1,173,2']);
  l._gameplayChannel = 1; scene._state.y = 250;
  l.checkAlphaTriggers(1000); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.3);
  scene._state.y = 450; l.checkAlphaTriggers(1000); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.6);
  l._gameplayChannel = 2;
  l.checkAlphaTriggers(650); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.6);
  l.checkAlphaTriggers(600); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.4);
  const snapshot = l.captureRuntimeState();
  l.checkAlphaTriggers(200); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.8);
  l.resetObjects(); l.restoreRuntimeState(snapshot);
  l.checkAlphaTriggers(200); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.8);
  scene._state.y = 0;
});
test('moved touch triggers keep their placed X, as moveObjects leaves it (3368d0)', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1007,2,100,3,100,51,1,35,0.4,11,1,57,2,170,1',
    '1,901,2,0,51,2,28,300']);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0);
  l.checkAdditionalTouchTriggers(800, 200); l.stepAlphaTriggers(0); assert.equal(l._groupOpacity[1], undefined);
  l.checkAdditionalTouchTriggers(200, 200); l.stepAlphaTriggers(0); near(l._groupOpacity[1], 0.4);
});
test('rotate gameplay changes the active channel and physics axes without moving the player', () => {
  const l = fixture(['1,2900,2,100,6,90,5,1,171,1,173,1',
    '1,2900,2,0,3,-100,170,1,171,1,173,0']);
  scene._playerWorldX = 200; scene._state.y = 30;
  l.checkGameplayTriggers(200, 30);
  assert.equal(l._gameplayChannel, 1);
  near(l.gameplayState.u.x, 0); near(l.gameplayState.u.y, -1);
  near(l.gameplayState.v.x, 1); near(l.gameplayState.v.y, 0);
  const origin = l.gameplayState.toLocal(200, 30); near(origin.x, 0); near(origin.y, 0);
  const point = l.gameplayState.toWorld(120, 15); near(point.x, 215); near(point.y, -90);
  l.checkGameplayTriggers(215, -210); assert.equal(l._gameplayChannel, 0);
  assert.equal(l.gameplayState.rotated, false);
  scene._state.y = 0; scene._playerWorldX = 0;
});

test('rotated colliders preserve activation identity and transform portals and triangles', () => {
  const l = fixture(['1,289,2,100,3,100', '1,1,2,200,3,100']);
  l.gameplayState.trigger({ raw: { 6: '-90' } });
  const col = l.objects[1], proxy = l.gameplayState.localCollider(col);
  near(proxy.x, 200); near(proxy.y, 400);
  proxy.activated = true; assert.equal(col.activated, true);
  assert.equal(proxy, l.gameplayState.localCollider(col));
  assert.equal(proxy.shapeOverlapsRect(200, 400, 1, 1), true);
  col.portalX = 400; col.portalY = 250;
  l.gameplayState.localCollider(col); near(proxy.portalX, 250); near(proxy.portalY, 400);
  const slope = l.gameplayState.localCollider(l.objects[0]);
  near(slope.hypoAx, l.objects[0].hypoAy); near(slope.hypoAy, l.objects[0].hypoAx);
  assert.ok(Number.isFinite(slope.getSlopeAngleRad()));
});

test('the physics frame restores world coordinates, queries and reusable checkpoint state', () => {
  const l = fixture(['1,1,2,100,3,100']);
  const original = l.getNearbySectionObjects;
  const p = { p: { y: 100, lastY: 95, yVelocity: 0 }, _lastCollisionWorldX: 200, _lastCollisionWorldY: 95 };
  scene._player = p; scene._state = p.p; scene._playerWorldX = 200;
  l.gameplayState.trigger({ raw: { 6: '-90' } });
  const snapshot = l.captureRuntimeState();
  const leave = l.gameplayState.enterPhysics();
  near(scene._playerWorldX, 0); near(p.p.y, 0);
  scene._playerWorldX += 50; p.p.y += 10;
  leave(); near(scene._playerWorldX, 210); near(p.p.y, 150);
  assert.equal(l.getNearbySectionObjects, original); assert.equal(scene._localPhysicsActive, false);
  l.resetObjects(); assert.equal(l.gameplayState.rotated, false);
  l.restoreRuntimeState(snapshot); near(l.gameplayState.u.y, 1);
  near(l.gameplayState.origin.x, 200); near(l.gameplayState.origin.y, 100);
  delete scene._player; scene._state = { y: 0 }; scene._playerWorldX = 0;
});

test('free camera removes the flight corridor, preserves base ground and restores its settings', () => {
  const l = fixture(['1,2925,2,0,111,1,112,1,113,30,114,0.8,370,1']);
  l._flyGroundActive = true; l._flyFloorY = 120; l._flyCeilingY = 600;
  l.checkCameraTriggers(0); assert.equal(l.getFloorY(), 0); assert.equal(l.getCeilingY(), null);
  near(l.cameraState.freeEasing, 30); near(l.cameraState.freePadding, 0.8);
  const snapshot = l.captureRuntimeState();
  l.cameraState.portalMode({ _eeLevelObject: { _raw: {} } });
  near(l.getFloorY(), 120); near(l.getCeilingY(), 600);
  l.restoreRuntimeState(snapshot); assert.equal(l.cameraState.disableGridSnap, true);
  assert.equal(l.cameraState.freeMode, true);
});

test('Free Mode retracts the visible corridor even when entered through a same-mode portal',()=>{
 const l=fixture([]);l.cameraState.freeMode=false;l.setFlyMode(true,600,540);
 l.stepGroundAnimation(.5);near(l._groundTargetValue,1);
 l.cameraState.portalMode({_eeLevelObject:{_raw:{111:'1'}}});
 near(l._groundAnimTo,0);near(l._groundAnimDuration,.4);
 l.stepGroundAnimation(.1);near(l._groundTargetValue,1-Easing.sample(1,1.5,.25));
 l.stepGroundAnimation(.3);near(l._groundTargetValue,0);assert.equal(l.getCeilingY(),null);near(l.getFloorY(),0);
 // A further free-mode mode entry must keep the layers retracted.
 l.setFlyMode(true,900,540);l.stepGroundAnimation(.4);near(l._groundTargetValue,0);
 l.cameraState.portalMode({_eeLevelObject:{_raw:{}}});
 near(l._groundAnimTo,1);l.stepGroundAnimation(.5);near(l._groundTargetValue,1);assert.ok(l.getCeilingY()>l.getFloorY());
});

test('chromatic, pixelate and split screen tween their enabled axes without a strength field', () => {
  const l = fixture(['1,2910,2,0,180,20,189,30,188,1,10,1',
    '1,2912,2,0,180,10,189,20,190,1,10,1', '1,2924,2,0,180,3,189,4,188,1,10,1']);
  l.checkShaderTriggers(0); l.shaderState.step(0.5);
  const u = l.shaderState.uniforms();
  // ShaderLayer: offset / (1.2018504 * window points)
  const G = Math.sqrt(960 * 960 + 640 * 640) / 960;
  near(u._chromaticXOff, 10 / (G * 569)); near(u._chromaticYOff, 0);
  near(u._gdPixelSize[0], 0); near(u._gdPixelSize[1], 10.5 / 320);
  near(u._colmod, 2.5); near(u._rowmod, 1);
});

test('edit colour tweens from the current state (CR 176, CG 191, CB 175)', () => {
  const l = fixture(['1,2923,2,0,175,1.4,176,1.2,191,1.3,10,1']);
  l.checkShaderTriggers(0);
  let u = l.shaderState.uniforms(); assert.equal(u._colorChangeC, undefined);
  l.shaderState.step(0.5); u = l.shaderState.uniforms();
  near(u._colorChangeC[0], 1.1); near(u._colorChangeC[1], 1.15); near(u._colorChangeC[2], 1.2);
});

test('Swing uses a distinct portal and changes gravity only on a fresh press', () => {
  scene.add.particles = () => ({ setDepth() { return this; }, setBlendMode() { return this; }, setVisible() { return this; } });
  const l = fixture(['1,1933,2,100,3,100']);
  assert.equal(l.objects[0].type, 'portal_swing');
  const player = Object.create(context.testAPI.PlayerObject.prototype);
  player.p = new context.testAPI.PlayerState(); player.p.isSwing = true; player.p.isFlying = true;
  player._isTouchingAvailableOrbForInput = () => false;
  player.flipGravity = flipped => { player.p.gravityFlipped = flipped; };
  player.p.upKeyDown = true; player.p.upKeyPressed = true;
  // Native orb matrix (2026-10-27): the update after the press flips, then
  // integrates the new gravity; holding does not flip again.
  player.updateJump(0.25); assert.equal(player.p.gravityFlipped, true);
  const first = player.p.yVelocity;
  assert.ok(first > 0);
  player.updateJump(0.25); assert.equal(player.p.gravityFlipped, true);
  assert.ok(player.p.yVelocity > first);
  player.p.upKeyPressed = true; player.updateJump(0.25); assert.equal(player.p.gravityFlipped, false);
  player.p.upKeyDown = false; player.updateJump(0.25); assert.equal(player.p.gravityFlipped, false);
});

test('dense scenes retain every quad beyond the old 16000-quad cut-off', () => {
  const r = new context.GDRenderer(scene); r.frames.textures = ['test'];
  const part = { info: { slot: 0, w: 30, h: 30, u0: 0, v0: 0, u1: 1, v1: 1 }, qx: 0, qy: 0 };
  const item = { part, m: [1, 0, 0, 1, 0, 0], color: [255, 255, 255], opacity: 1 };
  for (let i = 0; i < 20000; i++) r.pushItem(0, item);
  r._buildVertices();
  assert.equal(r.quadCount, 20000); assert.equal(r.ranges.reduce((n, x) => n + x.count, 0), 20000);
  assert.ok(r._vf.length >= 20000 * 24);
});

test('spider teleport in free mode never turns an absent floor into infinity', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype);
  p.p = new context.testAPI.PlayerState(); p.p.y = 100; p.p.gravityFlipped = true;
  p._scene = { _playerWorldX: 100 };
  p._gameLayer = { getFloorY: () => -Infinity, getCeilingY: () => null, getNearbySectionObjects: () => [] };
  p.flipGravity = flipped => { p.p.gravityFlipped = flipped; };
  // spiderTestJumpInternal always lands: with no band the search ends at
  // max(ground, screen bottom), here the ground
  assert.equal(p._teleportToOppositeSurface(), true); near(p.p.y, 30);
  assert.equal(p.p.gravityFlipped, false);
});

test('spider teleport lands on the band face with nothing in reach, under a block otherwise', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype);
  p.p = new context.testAPI.PlayerState(); p.p.y = 30; p.p.isSpider = true;
  p._scene = { _playerWorldX: 100 };
  const block = { type: 'solid', x: 110, y: 300, w: 60, h: 60 };
  let objects = [];
  p._gameLayer = { getFloorY: () => 0, getCeilingY: () => 540, getNearbySectionObjects: () => objects };
  p.flipGravity = flipped => { p.p.gravityFlipped = flipped; };
  assert.equal(p._teleportToOppositeSurface(), true); near(p.p.y, 513);
  p.p.y = 30; p.p.gravityFlipped = false; objects = [block];
  p._teleportToOppositeSurface(); near(p.p.y, 243);
  // GD's strip runs from the centre forwards: a block wholly behind it is not a candidate
  p.p.y = 30; p.p.gravityFlipped = false; objects = [{ ...block, x: 40 }];
  p._teleportToOppositeSurface(); near(p.p.y, 513);
});

test('spider normal/mini body uses native 27-point geometry for floors, ceilings and touch triggers', () => {
  const p=Object.create(context.testAPI.PlayerObject.prototype);
  p._scene={_playerWorldX:200};
  p._gameLayer={getFloorY:()=>0,getCeilingY:()=>540,getNearbySectionObjects:()=>[]};
  p.flipGravity=flipped=>{p.p.gravityFlipped=flipped;};
  p._spawnSpiderTeleportEffects=()=>{};
  for(const mini of [false,true]){
    p.p=new context.testAPI.PlayerState();p.p.isSpider=true;p.p.isMini=mini;p.p.y=100;
    const half=mini?Math.fround(27*Math.fround(.6)):27;
    near(p._collisionHalfSize(),half);
    p._teleportToOppositeSurface();near(p.p.y,540-half);
    p._teleportToOppositeSurface();near(p.p.y,half);
    const l=fixture(['1,1007,2,100,3,100,11,1,51,9,35,1']);
    l._scene._state=p.p;
    const trig=l._alphaTriggers[0];
    // Trigger extends 30 web pixels from its centre; the old 30/18 body
    // would incorrectly contact it one pixel beyond the native edge.
    assert.equal(l._touchesTrigger(trig,200+30+half-1,200,50),true);
    assert.equal(l._touchesTrigger(trig,200+30+half+1,200,50),false);
  }
  scene._state={y:0};
});

test('dash direction reads horizontal and vertical editor flips', () => {
  for (const rot of [0, 90, 180, 270]) for (const flipX of [0, 1]) for (const flipY of [0, 1]) {
    const l = fixture([`1,1704,2,100,3,100,6,${rot},4,${flipX},5,${flipY}`]);
    const angle = -l.objects[0].orbRotation * Math.PI / 180;
    near(Math.cos(angle), Math.cos(-rot * Math.PI / 180) * (flipX ? -1 : 1));
    near(Math.sin(angle), Math.sin(-rot * Math.PI / 180) * (flipY ? -1 : 1));
  }
});

test('practice checkpoints and restarts restore channel ordering after gameplay turns', () => {
  const l = fixture(['1,2900,2,100,6,-90,62,1']);
  l.gameplayState.trigger({ raw: { 6: '0' } });
  const checkpoint = l.captureRuntimeState();
  l.gameplayState.trigger({ raw: { 6: '180' } }); near(l._channelDirections[0].x, -1);
  l.restoreRuntimeState(checkpoint); near(l._channelDirections[0].x, 1);
  l.resetObjects(); near(l._channelDirections[0].x, 0); near(l._channelDirections[0].y, 1);
});

test('missing native colour trees restore independent layers without changing generated definitions', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = name => name ? { key: 'test', slot: 0, name, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 } : null;
  const before = JSON.stringify(context.GD_OBJECTS[1734]);
  for (const id of [216, 397, 1582, 1583, 1734, 1735, 920, 1936]) {
    const o = r.addObject(parseObject(`1,${id},2,100,3,100,21,7,22,8`));
    assert.ok(o.hasDetail, 'missing colour layer on ' + id);
    assert.equal(o.detailID, 8);
  }
  const cog = r.objects.find(o => o.id === 1734);
  assert.equal(cog.parts.filter(p => p.detail).length, 4);
  const saw = r.objects.find(o => o.id === 1735);
  assert.ok(saw.parts[0].detail, 'colour fill must remain behind the outline');
  assert.equal(JSON.stringify(context.GD_OBJECTS[1734]), before);
});

test('Fingerdash slope fills clip geometry and UVs together while preserving both colour channels', () => {
  const r = new context.GDRenderer(scene); r.frames.textures = ['test'];
  r.frames.get = name => name ? { key: 'test', slot: 0, name, w: name.includes('Outline_15') ? 60 : 30,
    h: 30, cw: name.includes('Outline_15') ? 60 : 30, ch: 30, ox: 0, oy: 0,
    u0: 0.1, v0: 0.2, u1: 0.9, v1: 0.8 } : null;
  const before = JSON.stringify(context.GD_OBJECTS[1801]);
  const o = r.addObject(parseObject('1,1801,2,100,3,100,21,7,22,8'));
  assert.equal(o.baseID, 7); assert.equal(o.detailID, 8);
  assert.ok(o.parts.every(p => p.vertexMods[0] === 1));
  r.setCamera(0, 0);
  r.pushItem(0, { part: o.parts[0], m: [1, 0, 0, 1, 0, 0], color: [255, 255, 255], opacity: 1 });
  r._buildVertices();
  near(r._vf[1], r._vf[13]); // Top-left collapses onto bottom-left.
  near(r._vf[3], 0.8); near(r._vf[9], 0.2); // Texture is clipped, not stretched.
  near(r._vf[7] - r._vf[1], -60);
  assert.equal(JSON.stringify(context.GD_OBJECTS[1801]), before);
  for (const id of [1794, 1796, 1800, 1802, 1804, 1806, 1808, 1810]) {
    const slope = r.addObject(parseObject(`1,${id},2,100,3,100`));
    assert.equal(slope.parts.filter(p => !p.detail).length, 2);
    assert.equal(slope.parts.filter(p => p.detail).length, id === 1796 ? 1 : 2);
    assert.ok(slope.parts.every(p => p.vertexMods && !p.info.name.includes('Outline')));
  }
});

test('native negative vertex modifiers extend the corner without extending its texture', () => {
  const r = new context.GDRenderer(scene); r.frames.textures = ['test']; r.setCamera(0, 0);
  const part = { info: { slot: 0, w: 30, h: 30, u0: 0, v0: 0, u1: 1, v1: 1 },
    qx: 0, qy: 0, vertexMods: [1, -0.15, 0, 0] };
  r.pushItem(0, { part, m: [1, 0, 0, 1, 0, 0], color: [255, 255, 255], opacity: 1 });
  r._buildVertices();
  near(r._vf[7] - r._vf[13], -69); near(r._vf[9], 0);
});

test('rotating sprite parts use the native saved angle tag and a common rotation phase', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const n = ['test', 0, 0, .5, .5, 1, 1, 0, 0, 0, 4, 255, 0xffffff, null,
    [['test', 15, 15, .5, .5, 1, 1, 30, -1, 30, 0, 255, 0xffffff, null, []]]];
  const o = r.addObject(parseObject('1,1,2,100,3,100'), { n, dc: -1, bc: 1004, fl: 0 });
  o.rotSpeed = 30; r.time = 1; r._prepareObject(o, 100, 100, false);
  const m = r.buckets.flat()[0].m;
  near(m[0], .5); near(m[1], -Math.sqrt(3) / 2);
  near(m[2], Math.sqrt(3) / 2); near(m[3], .5);
});

test('rotating cogwheel colour tags do not rotate one quarter away from its mirrored partners', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({key:'test',slot:0,w:41,h:41,cw:80,ch:80,ox:0,oy:39});
  r.colorManager=new ColorManager();r.setCamera(0,0);
  const o=r.addObject(parseObject('1,675,2,100,3,100'));
  for(const time of [0,.123,1.25]) {
    r.clearFrame();r.time=time;r._prepareObject(o,100,100,false);
    const pieces=r.buckets.flat().filter(item=>item.part.info && item.part.tag===997);
    const outline=o.parts.filter(part=>part.info && part.info.cw===80 && !part.info.frame?.includes("_color_"));
    assert.ok(outline.length);
    assert.ok(pieces.length>0);
    const matrix=pieces.find(p=>p.part.rotLocal)?.m || pieces[0].m,angle=o.rotSpeed*time*Math.PI/180;
    near(matrix[0],Math.cos(angle));near(matrix[1],-Math.sin(angle));
  }
});

test('independent saved rotation axes transform Damage Square hitboxes and survive resets', () => {
  const l=fixture(['1,3610,2,100,3,100,128,0.096,129,4.824,131,136.21,132,135.21']);
  const o=l.objects[0];assert.ok(o.shape);assert.ok(o.w>200&&o.h>200);
  const original=JSON.stringify(o.shape);o.transformShape(2,0,0,2);l.resetObjects();
  assert.equal(JSON.stringify(o.shape),original);
  assert.equal(o.shapeOverlapsRect(200,200,10,10),true);
  assert.equal(o.shapeOverlapsRect(200,320,10,10),false);
});

test('sparse practice snapshots omit unchanged scenery and undo later changes on every restore', () => {
  const l=fixture(['1,1,2,100,3,100,57,1','1,211,2,200,3,100,57,2']);
  const r=l.gdRenderer,initial=r.captureRuntimeState();
  assert.equal(initial.packedObjects.indices.length,0);
  for(let i=0;i<2;i++) {
    r.objects[0].offX=75;r.objects[0].affine=[2,0,0,3];r.objects[1].enabled=false;
    r.restoreRuntimeState(initial);near(r.objects[0].offX,0);assert.equal(r.objects[1].enabled,true);
    assert.deepEqual(Array.from(r.objects[0].affine),[1,0,0,1]);
  }
  r.objects[0].offX=30;r.objects[0]._keyframeOuterAffine=[1,0,0,1,7,8];
  const moved=r.captureRuntimeState();assert.equal(moved.packedObjects.indices.length,1);
  r.objects[0].offX=90;r.objects[1].offY=12;r.restoreRuntimeState(moved);
  near(r.objects[0].offX,30);near(r.objects[1].offY,0);
  assert.deepEqual(Array.from(r.objects[0]._keyframeOuterAffine),[1,0,0,1,7,8]);
});

test('No Touch scenery retains group transforms without entering collision-section queries', () => {
  const l=fixture(['1,1,2,100,3,100,121,1,57,1','1,1,2,100,3,100,57,2']);
  const decoration=l.objects[0],physical=l.objects[1];
  assert.equal(l.getNearbySectionObjects(200).includes(decoration),false);
  assert.equal(l.getNearbySectionObjects(200).includes(physical),true);
  l._translateGroup(1,100,0);near(decoration.x,300);
  assert.equal(l.getNearbySectionObjects(300).includes(decoration),false);
});

test('dynamic gameplay height uses the current header and authored object positions', () => {
  const l=fixture(['1,1,2,100,3,5000,135,1']);
  l._setUpSettings('kA4,0,kA37,1');near(l.maxGameplayY,10780);
  l._setUpSettings('kA4,0,kA37,0');near(l.maxGameplayY,5400);
  l._setUpSettings('kA4,0,kA22,1');near(l.maxGameplayY,10780);
  const low=fixture(['1,1,2,100,3,100']);
  low._setUpSettings('kA37,1');near(low.maxGameplayY,3000);
});

test('packed checkpoints preserve an animation waiting for its first frame', () => {
  const r=fixture(['1,1,2,100,3,100']).gdRenderer,o=r.objects[0];
  o.animationTriggered=true;o.animationStart=null;
  const snapshot=structuredClone(r.captureRuntimeState());
  o.animationStart=12;r.restoreRuntimeState(snapshot);
  assert.equal(o.animationTriggered,true);assert.equal(o.animationStart,null);
});

test('Clubstep fading blocks remain drawable with the native near-player opacity floor', () => {
  const l = fixture(['1,146,2,284.5,3,100']);
  const r = l.gdRenderer, o = l.gdObjects[0];
  assert.equal(o.hidden, false);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 });
  r.partsCache.clear(); r.glowPartsCache.clear();
  const v = r.addObject(parseObject('1,146,2,284.5,3,100'));
  r.colorManager = new ColorManager(); r.setCamera(0, 0); r.update(0);
  const main = r.buckets.flat().find(item => item.part.role === 0);
  const glow = r.buckets.flat().find(item => item.part.role === 4);
  near(main.opacity, 12 / 255); near(glow.opacity, 38 / 255);
  const nearPlayerOpacity = main.opacity;
  r.clearFrame();
  r._prepareObject(v, 450, 100, true);
  assert.ok(r.buckets.flat().find(item => item.part.role === 0).opacity > nearPlayerOpacity);
});

test('orb audio scaling uses RingObject limits and honours the saved no-audio flag', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const orb = r.addObject(parseObject('1,36,2,100,3,100'));
  const fixed = r.addObject(parseObject('1,36,2,100,3,100,372,1'));
  for (const [audio, expected] of [[.1, .4], [.6, .9], [2, 1.2]]) {
    r.audioScale = audio;
    r.clearFrame();
    r._prepareObject(orb, 100, 100, false); near(r.buckets.flat()[0].m[0], expected);
    r.clearFrame();
    r._prepareObject(fixed, 100, 100, false); near(r.buckets.flat()[0].m[0], 1);
  }
});

test('orb activation uses the native outline, radius curve, lifetime and No Effects flag', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype);
  const draws = {}, graphics = {
    setDepth() { return this; }, setBlendMode() { return this; }, setPosition(x, y) { draws.position = [x, y]; },
    clear() {}, setAlpha() {}, lineStyle(...args) { draws.line = args; }, beginPath() {},
    moveTo(x) { draws.radius = x; }, lineTo() {}, closePath() {}, strokePath() { draws.outline = true; }, destroy() {}
  };
  let tween;
  p._scene = { add: { graphics: () => graphics }, events: { on() {}, off() {} },
    tweens: { add: value => { tween = value; } },
    _level: { gdObjects: [{ x: 200, y: 100, offX: 10, offY: 20 }] } };
  p._gameLayer = { topContainer: { add() {} } }; p._getparticlecolor = () => 0x00ff00;
  const orb = { type: vm.runInContext('jumpRingType', context), x: 0, y: 0, orbId: 36, _eeObjectId: 0,
    _eeLevelObject: { noParticles: true } };
  p._orbpadHitEffect(orb);
  assert.equal(tween.duration, 250); assert.equal(tween.ease, 'Linear');
  tween.targets.progress = 0.25; tween.onUpdate();
  near(draws.radius, 60); assert.equal(draws.line[0], 2); assert.equal(draws.line[1], 0xffffff);
  near(draws.line[2], 127 / 255); assert.equal(draws.outline, true);
  near(draws.position[0], 420); near(draws.position[1], vm.runInContext('b(240)', context));
  tween = null; orb._eeLevelObject.noEffects = true; p._orbpadHitEffect(orb);
  assert.equal(tween, null);
});

test('resource particle profiles preserve native density, life, radius and No Particles', () => {
  const d = context.cocosParticlePreset('ringEffect');
  near(d.TotalParticles, 30); near(d.Life, 0.30000001192092896);
  near(d.StartRadius, 20); near(d.EndRadius, 0); near(d.EmissionRate * d.Life, 30);
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 8, h: 8, cw: 8, ch: 8, ox: 0, oy: 0 });
  const orb = r.addObject(parseObject('1,36,2,100,3,100'));
  assert.ok(orb.ambientParticleSystem); near(orb.ambientParticleSystem.data.StartColorG, 200 / 255);
  const fixed = r.addObject(parseObject('1,36,2,100,3,100,507,1'));
  assert.equal(fixed.ambientParticleSystem, undefined); assert.ok(fixed.parts.length);
  const pad = r.addObject(parseObject('1,67,2,100,3,100,6,90,128,2,129,3'));
  const pd = pad.ambientParticleSystem.data;
  near(pd.TotalParticles, 30); near(pd.Life, .4); near(pd.StartSize, 3);
  near(pd.StartColorR, 0); near(pd.StartColorG, 1); near(pd.EndColorB, 1);
  assert.equal(r.addObject(parseObject('1,67,2,100,3,100,116,1')).ambientParticleSystem, undefined);
});

test('UI particles emit and draw in screen space while world particles retain camera culling', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ slot: 0, w: 8, h: 8, cw: 8, ch: 8, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(100000, 200000);
  const ui = r.addObject(parseObject('1,67,2,100,3,100'));
  ui.isUIObject = true;
  const world = r.addObject(parseObject('1,67,2,100,3,100'));
  r.finalize(); r.update(.1);
  assert.ok(ui.ambientParticleSystem.particles.length > 0);
  assert.equal(world.ambientParticleSystem.particles.length, 0);
  const draws = r.buckets.flat();
  assert.ok(draws.length > 0 && draws.every(i => i.overlay && i.screen));
  r._objectDrawFlags = context.GDRender.uiDrawFlags; // A prior UI sprite must not contaminate world particles.
  r.setCamera(0, 0); world.ambientParticleSystem.spawn(); r.clearFrame();
  world.ambientParticleSystem.draw();
  assert.ok(r.buckets.flat().length > 0 && r.buckets.flat().every(i => !i.overlay && !i.screen));
});

test('S, H, J and gravity-flip blocks create live colliders and expire their arming counters', () => {
  const l = fixture([1755, 1813, 1829, 1859, 2866].map(id => `1,${id},2,100,3,100`));
  assert.ok(l.objects.every(c => c.type === 'collision_modifier'));
  const p = Object.create(context.testAPI.PlayerObject.prototype); p.p = new context.testAPI.PlayerState();
  p._startDash({ orbRotation: 0 }); p.p.upKeyDown = true;
  p._updateCollisionModifiers(l.objects, 200, 200, 30);
  assert.equal(p.p.isDashing, false); assert.ok(p.p._orbActivationConsumedForPress);
  assert.equal(p.p.stateDartSlide, 2); assert.equal(p.p.stateHitHead, 2); assert.equal(p.p.stateNoAutoJump, 2);
  p._hitArmedCeiling(100); assert.equal(p.p.gravityFlipped, true); near(p.p.y, 100); near(p.p.yVelocity, -4);
  p._updateCollisionModifiers([], 400, 400, 30); assert.equal(p.p.stateFlipGravity, 1);
  p._updateCollisionModifiers([], 400, 400, 30); assert.equal(p.p.stateFlipGravity, 0);
});

test('native dash vectors retain forward travel and clamp the line independently of gravity', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype); p.p = new context.testAPI.PlayerState();
  for (const flip of [false, true]) for (const [angle, slope] of [[0, 0], [-90, 2.7474772930145264], [90, -2.7474772930145264], [180, 0], [-45, 1]]) {
    p.p.gravityFlipped = flip; p._startDash({ orbRotation: angle });
    near(p.p.dashSlope, slope); near(p.p.yVelocity, 0);
    assert.equal(p.p.isDashing, true); near(p._rotation, -Math.atan(slope));
  }
});

test('Dash wall turns read both saved directions and hand over travel velocity', () => {
  const l = fixture([]);
  const p = { p: new context.testAPI.PlayerState() };
  scene._player = p; scene._state = p.p; scene._playerWorldX = 100; p.p.y = 300;
  l.gameplayState.trigger({ raw: { 6: '90', 5: '1', 166: '4', 167: '2' } });
  near(l.gameplayState.u.x, 0); near(l.gameplayState.u.y, -1);
  near(l.gameplayState.v.x, 1); near(l.gameplayState.v.y, 0);
  assert.equal(p.p.gravityFlipped, true); near(p.p.yVelocity, 10.3860036);
  l.gameplayState.trigger({ raw: { 166: '2', 167: '4', 169: '1', 583: '-1' } });
  near(l.gameplayState.u.x, 1); near(p.p.yVelocity, -10.3860036);
  assert.equal(p.p.gravityFlipped, false);
  delete scene._player; scene._state = { y: 0 }; scene._playerWorldX = 0;
});

test('all native slope wall-side enum values survive unsigned range comparison', () => {
  for (let type = 0; type < 8; type++) assert.equal(context._gdSlopeWallOnLeft(type), [2, 3, 4, 6].includes(type), 'slope type ' + type);
});

test('separate saved rotation axes orient Dash grid lines and skew Hyperluminal decorations', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  for (const [rx, ry] of [[-270, 90], [35, -12]]) {
    const o = r.addObject(parseObject(`1,1753,2,100,3,100,131,${rx},132,${ry}`));
    r.clearFrame();
    r._prepareObject(o, 100, 100, false);
    const m = r.buckets.flat()[0].m;
    near(m[0], Math.cos(-ry * Math.PI / 180)); near(m[1], Math.sin(-ry * Math.PI / 180));
    near(m[2], -Math.sin(-rx * Math.PI / 180)); near(m[3], Math.cos(-rx * Math.PI / 180));
  }
});

test('stretched objects remain visible from outside the centre section without duplicate drawing', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ key: 'test', slot: 0, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const o = r.addObject(parseObject('1,1,2,2000,3,100,32,100,57,7'));
  r.update(0); assert.equal(r.quadCount, 2); // Main plus glow.
  r.moveGroup(7, -1900, 0); r.update(0); assert.equal(r.quadCount, 2);
  r.removeObject(o); r.update(0); assert.equal(r.quadCount, 0); assert.equal(r.wideObjects.size, 0);
});

test('pickup clones match the native Bezier positions and rotation through the fade, then expire',()=>{
 const native=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-pickup.json'),'utf8'));
 const l=fixture(['1,1275,2,90,3,15'],r=>r.frames.get=()=>({slot:0,w:21,h:21,cw:21,ch:21,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1}));
 const r=l.gdRenderer,o=l.gdObjects[0];r.colorManager=scene._colorManager;r.pickupRandom.set('90,105',native.random);
 r.animatePickup(o);assert.equal(r.pickupEffects.length,1);o.enabled=false;
 // A key's first atlas part is offset within its 30x21 compound sprite.
 // Recover the clone's root in that part's coordinates, rather than measuring
 // the centre of an arbitrary child (which turns around the root).
 const initial=r.pickupEffects[0].pieces[0].matrix,det=initial[0]*initial[3]-initial[1]*initial[2];
 const ax=o.x-initial[4],ay=o.y-initial[5];
 const anchor=[(initial[3]*ax-initial[2]*ay)/det,(-initial[1]*ax+initial[0]*ay)/det];
 for(const row of native.rows){
  r.time=row.age;const drawn=[];r._writePart=(_b,_k,p,m,color,opacity)=>drawn.push({p,m:[...m],opacity});
  r._drawPickupEffects();assert.ok(drawn.length);
  const q=drawn[0],[x,y]=anchor;
  near(q.m[0]*x+q.m[2]*y+q.m[4],row.x,2e-4);
  near(q.m[1]*x+q.m[3]*y+q.m[5]+90,row.y,5e-4); // CCAction's accumulated float clock.
  near(-Math.atan2(q.m[1],q.m[0])*180/Math.PI,row.rotation,2e-4);
 }
 const saved=r.captureRuntimeState();r.reset();assert.equal(r.pickupEffects.length,0);r.restoreRuntimeState(saved);
 assert.equal(r.pickupEffects.length,1);r.time=.601;r._drawPickupEffects();assert.equal(r.pickupEffects.length,0);
});

test('collected numbered coins use the native tint, highlight reveal and independent child fades',()=>{
 const frames=new Map();
 const l=fixture(['1,1614,2,100,3,150,64,1'],r=>r.frames.get=name=>{
  if(!frames.has(name))frames.set(name,{slot:0,w:21,h:21,cw:21,ch:21,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1});
  return frames.get(name);
 });
 const r=l.gdRenderer;r.colorManager=scene._colorManager;r.animatePickup(l.gdObjects[0]);
 const effect=r.pickupEffects[0];assert.equal(effect.pieces.length,3);
 const originals=new Map(effect.pieces.map(p=>[p.coinLayer,[...p.color]]));
 for(const [age,mainAlpha,childAlpha,highlightAlpha] of [[0,1,1,0],[.15,1,1,.5],[.3,1,1,1],[.45,.75,.5,.5],[.55,.25,1/6,1/6]]){
  r.time=age;const drawn=[];r._writePart=(_b,_k,part,_m,color,alpha)=>drawn.push({part,color,alpha});r._drawPickupEffects();
  for(let i=0;i<drawn.length;i++){
   const piece=effect.pieces[i],actual=drawn[i],family=piece.coinLayer;
   near(actual.alpha/piece.opacity,family==='main'?mainAlpha:family==='color'?childAlpha:highlightAlpha,1e-8);
   if(family!=='highlight'){
    const tint=Math.min(1,age/.3),target=originals.get(family);
    assert.deepEqual([...actual.color],target.map((v,j)=>Math.trunc((j===2?200:255)*(1-tint)+v*tint)));
   }
  }
 }
 const saved=r.captureRuntimeState();r.reset();r.restoreRuntimeState(saved);
 assert.deepEqual(Array.from(r.pickupEffects[0].pieces,p=>p.coinLayer),Array.from(effect.pieces,p=>p.coinLayer));
});

test('teleport rings use the native audio scale, fixed particle rays and optional No Audio Scale',()=>{
 const l=fixture(['1,36,2,100,3,150,64,1','1,3027,2,200,3,150,64,1','1,3027,2,300,3,150,64,1,372,1'],
  r=>r.frames.get=()=>({slot:0,w:21,h:21,cw:21,ch:21,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1}));
 const r=l.gdRenderer;r.colorManager=scene._colorManager;r.setCamera(0,0,1000,400);
 for(const meter of [.1,.5,.9,1.2]){
  r.audioScale=meter;r.update(0);
  near(Math.hypot(...l.gdObjects[0]._objectMatrix.slice(0,2)),Math.min(1.2,meter+.3));
  near(Math.hypot(...l.gdObjects[1]._objectMatrix.slice(0,2)),Math.min(1.2,meter+.3));
  near(Math.hypot(...l.gdObjects[2]._objectMatrix.slice(0,2)),1);
 }
 const p=l.gdObjects[1].ambientParticleSystem;near(p.data.RotatePerSecond,0);near(p.data.EndColorA,0);near(p.data.TotalParticles,30);
 r.activateRing(l.gdObjects[1]);r.time+=.08;r.update(0);
 near(Math.hypot(...l.gdObjects[1]._objectMatrix.slice(0,2)),1.2 * context.orbClickScale);
 r.time += 1; r.update(0);
 near(Math.hypot(...l.gdObjects[1]._objectMatrix.slice(0,2)),1.2);
});

test('breakable glass uses the native 30-particle preset and preserves its independent burst in practice',()=>{
 const l=fixture(['1,143,2,100,3,100'],r=>r.frames.get=()=>({slot:0,w:8,h:8,cw:8,ch:8,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1}));
 const r=l.gdRenderer;r.colorManager=scene._colorManager;r.breakBlock(l.gdObjects[0]);
 assert.equal(r.spawnedParticleSystems.length,1);const p=r.spawnedParticleSystems[0];
 near(p.data.TotalParticles,30);near(p.data.GravityY,-616.7763061523438);assert.equal(p.data.sFrame,'square.png');
 p.step(1/240);assert.ok(p.particles.length>0);assert.ok(p.particles.length<=30);
 const saved=r.captureRuntimeState();r.reset();r.restoreRuntimeState(saved);
 assert.equal(r.spawnedParticleSystems.length,1);assert.equal(r.spawnedParticleSystems[0].presetName,'glassDestroy01');
});

test('default death particles use native size/life variance, mini scale, primary colour and dark endpoints',()=>{
 const l=fixture([]),r=l.gdRenderer;r.frames.get=()=>({slot:0,w:8,h:8,cw:8,ch:8,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1});
 assert.equal(r.deathParticles({x:100,y:200},[20,80,160],.6),true);
 const p=r.spawnedParticleSystems[0];near(p.data.TotalParticles,100);near(p.data.LifeVar,.8,1e-7);
 near(p.object.scaleX,.6);near(p.data.StartSize,10);near(p.data.StartSizeVar,5);near(p.data.StartColorB,160/255);
 near(p.data.EndColorB,0);near(p.data.EndColorA,1);
});

test('Fingerdash pickups update the native counter, suppress repeat counts and restore at checkpoints', () => {
  const oldCache = scene.cache;
  scene.cache = { bitmapFont: { get: () => ({ texture: 'test', data: { lineHeight: 67, chars:
    Object.fromEntries('0123456789'.split('').map(c => [c.charCodeAt(0), { width: 40, height: 50,
      xOffset: 0, yOffset: 8, xAdvance: 36, u0: 0, v0: 0, u1: 1, v1: 1 }])) } }) } };
  try {
    const l = fixture(['1,1614,2,100,3,100,79,1,80,1,57,2', '1,1615,2,100,3,200,80,1,57,2']);
    const coin = l.objects.find(c => c.coinId === 1614), label = l._counterLabels[0].object;
    assert.equal(label.labelText, '0'); assert.equal(label.parts.length, 1);
    l.collectPickup(coin); l.collectPickup(coin);
    assert.equal(l._itemCounts.get(1), 1); assert.equal(label.labelText, '1');
    assert.equal(l.gdObjects[coin._eeObjectId].enabled, false);
    const checkpoint = l.captureRuntimeState();
    l.resetObjects(); l.resetSpawnTriggers(); assert.equal(label.labelText, '0');
    l.restoreRuntimeState(checkpoint); assert.equal(label.labelText, '1');
    assert.equal(l.gdObjects[coin._eeObjectId].enabled, false);
  } finally { scene.cache = oldCache; }
});

test('native collectible families update items, toggle groups and survive checkpoint restoration', () => {
  const l=fixture(['1,1,2,100,3,0,57,4','1,1275,2,100,3,100,381,1,80,8,383,5',
    '1,1587,2,130,3,100,79,1,80,8,78,1','1,4401,2,160,3,100,382,1,51,4,56,0',
    '1,3601,2,190,3,100,381,1,80,8,383,0']);
  const pickups=l.objects.filter(c=>c.type==='coin');assert.equal(pickups.length,4);
  for(const c of pickups){assert.equal(l.collectPickup(c),true);l.collectPickup(c);}
  assert.equal(l._itemCounts.get(8),4);assert.equal(l._groupEnabled[4],false);
  for(const c of pickups)assert.equal(l.gdObjects[c._eeObjectId].enabled,false);
  const checkpoint=l.captureRuntimeState();l.resetObjects();l.resetSpawnTriggers();
  for(const c of pickups)assert.equal(l.gdObjects[c._eeObjectId].enabled,true);
  l.restoreRuntimeState(checkpoint);
  for(const c of pickups)assert.equal(l.gdObjects[c._eeObjectId].enabled,false);
  assert.equal(l._itemCounts.get(8),4);
});

test('a collectible can count an item and spawn its toggle target together, once per pickup', () => {
  const l=fixture(['1,1614,2,100,3,100,381,1,382,1,80,1,51,7,56,1']);
  const coin=l.objects.find(c=>c.coinId===1614),spawns=[];
  l._activateSpawnedGroup=group=>spawns.push([group,l._itemCounts.get(1)]);
  l.collectPickup(coin);l.collectPickup(coin);
  assert.equal(l._itemCounts.get(1),1);assert.equal(l._groupEnabled[7],true);
  assert.deepEqual(spawns,[[7,1]]);
  const checkpoint=l.captureRuntimeState();l.resetObjects();l.resetSpawnTriggers();
  l.restoreRuntimeState(checkpoint);l.collectPickup(coin);
  assert.equal(l._itemCounts.get(1),1);assert.deepEqual(spawns,[[7,1]]);
});

test('hitbox geometry uses authored vertices, continuous mirror and shake without a gravity-dependent triangle', () => {
  const l=fixture(['1,289,2,100,3,100','1,3610,2,130,3,100,131,20,132,50']);
  const ps=new context.testAPI.PlayerState(),sc={_state:ps,_playerWorldX:240,_cameraX:100,_cameraY:20,_getMirrorVisualScale:()=>1};
  const player=Object.create(context.testAPI.PlayerObject.prototype);
  Object.assign(player,{p:ps,_scene:sc,_gameLayer:l,_rotation:0,_hitboxTrail:[]});sc._player=player;
  let colour,path;const paths=[];
  const gfx={clear(){paths.length=0;},fillStyle(){},fillPath(){},fillCircle(){},lineStyle(_w,c){colour=c;},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},closePath(){},strokePath(){paths.push({colour,points:path});},strokeCircle(){}};
  l.container.x=-93;l.container.y=31;
  player.drawHitboxes(gfx,100,20);const first=structuredClone(paths);
  ps.gravityFlipped=true;player.drawHitboxes(gfx,100,20);
  assert.deepEqual(paths.filter(p=>p.colour===0x0000ff),first.filter(p=>p.colour===0x0000ff));
  const triangle=first.find(p=>p.colour===0x0000ff).points,o=l.objects[0];
  assert.deepEqual(triangle,[[o.x+o.hypoAx-100+7,context.b(o.y+o.hypoAy)+31],
    [o.x+o.hypoBx-100+7,context.b(o.y+o.hypoBy)+31],[o.x+o.rightAx-100+7,context.b(o.y+o.rightAy)+31]]);
  const playerBox=first.filter(p=>p.colour===0xff0000).at(-1).points;
  near(playerBox.reduce((n,p)=>n+p[0],0)/4,140);
  sc._getMirrorVisualScale=()=>.5;
  const mc=vm.runInContext('screenWidth',context)/2;l.container.x=mc+.5*(-93-mc);
  player.drawHitboxes(gfx,100,20);
  const mirrored=paths.find(p=>p.colour===0x0000ff).points;
  for(let i=0;i<3;i++){near(mirrored[i][0],mc+.5*(triangle[i][0]-mc));near(mirrored[i][1],triangle[i][1]);}
});

test('small coin animation preserves its fixed root and both independent colour channels', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = name => name ? { key: 'test', slot: 0, name, w: name.includes('_02_') ? 10 : 21,
    h: 21, cw: name.includes('_02_') ? 10 : 21, ch: 21, ox: 0, oy: 0 } : null;
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const coin = r.addObject(parseObject('1,1614,2,100,3,100,21,177,22,178'));
  assert.equal(coin.animation.length, 4); assert.equal(coin.parts.length, 3);
  assert.equal(coin.hasDetail, true); assert.equal(coin.baseID, 177); assert.equal(coin.detailID, 178);
  const part = coin.animation[1].find(p => !p.detail && p.info.name === 'smallCoin_02_001.png');
  near(part.matrix[4] + part.info.cw / 2, 0);
});

test('fire animations retain outer and inner sprite families throughout the native colour track', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = name => /^Fire_\d+(?:_2)?_looped_\d+\.png$/.test(name || '') ?
    { key: 'test', slot: 0, name, w: 30, h: 30, cw: 30, ch: 30, ox: 0, oy: 0 } : null;
  for (const id of [920, 921, 923, 924]) {
    const o = r.addObject(parseObject(`1,${id},2,100,3,100`));
    assert.ok(o.hasDetail);
    for (const parts of o.animation) {
      const main = parts.find(p => !p.detail), detail = parts.find(p => p.detail);
      assert.ok(main && detail);
      assert.equal(main.info.name.includes('_2_looped_'), false);
      assert.equal(detail.info.name.includes('_2_looped_'), true);
      assert.equal(main.info.name.slice(-7), detail.info.name.slice(-7));
    }
  }
});

test('gradients interpolate channel colour and opacity, rotate, and ignore editor preview opacity', () => {
  const l = fixture(['1,2903,2,0,3,0,21,1,22,2,202,15,209,9,456,0']);
  const r = l.gdRenderer;
  r.colorManager = { getFinal: id => id === 1 ? [255, 0, 0] : [0, 0, 255], getOpacity: () => 255,
    hasGroupPulse: () => false };
  r.setCamera(0, 0); l.checkShaderTriggers(1); r.update(0);
  let item = r.buckets.flat().find(i => i.colors);
  assert.ok(item && item.screen); assert.deepEqual(Array.from(item.colors[0]), [255, 0, 0, 255]);
  assert.deepEqual(Array.from(item.colors[1]), [0, 0, 255, 255]);
  l.gdObjects[l._gradientTriggers[0].uid].rotOff = -90; r.update(0);
  item = r.buckets.flat().find(i => i.colors);
  assert.deepEqual(Array.from(item.colors[0]), [0, 0, 255, 255]);
  assert.deepEqual(Array.from(item.colors[2]), [255, 0, 0, 255]);
  l.gradientState.trigger({ raw: { 209: '9', 208: '1' } }); r.update(0); assert.equal(r.quadCount, 0);
});

test('BG and MG gradients stay behind every object batch after flattening their native parents', () => {
  const l = fixture(['1,211,2,100,3,100,24,-5,64,1',
    '1,2903,2,0,21,1,22,1,202,1,209,1', '1,2903,2,0,21,2,22,2,202,2,209,2']);
  const r = l.gdRenderer; r.colorManager = scene._colorManager;
  r.setCamera(0, 0); l.checkShaderTriggers(1); r.update(0);
  const batches = context.GDRender.BATCHES;
  const bg = context.GDRender.gradientBatch[1], mg = context.GDRender.gradientBatch[2];
  const objects = batches.filter(b => !b.key.startsWith('gradient:'));
  assert.ok(bg < mg && batches[mg].z < Math.min(...objects.map(b => b.z)));
  assert.equal(r.ranges[0].nativeZ, -1600);
  assert.ok(l.gradientState.items.get(1).screen && l.gradientState.items.get(2).screen);
});

test('gradient world boundaries track group movement; missing vertex targets retain viewport bounds', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1,2,300,3,300,57,2',
    '1,1,2,100,3,300,57,3', '1,2903,2,0,3,0,21,1,22,2,202,5,203,2,204,1,205,1,206,2']);
  const r = l.gdRenderer; r.colorManager = scene._colorManager; r.setCamera(0, 0);
  l.checkShaderTriggers(1); r.update(0);
  let item = r.buckets.flat().find(i => i.colors);
  assert.deepEqual(Array.from(item.positions, p => Array.from(p)), [[100, 300], [300, 300], [100, 100], [300, 100]]);
  r.moveGroup(2, 20, 40); r.update(0); item = r.buckets.flat().find(i => i.colors);
  assert.equal(item.positions[1][0], 320); assert.equal(item.positions[1][1], 340);
  const t = l._gradientTriggers[0]; t.raw[207] = '1'; t.raw[203] = '1'; t.raw[204] = '2'; t.raw[205] = '3'; delete t.raw[206];
  r.update(0); item = r.buckets.flat().find(i => i.colors);
  assert.deepEqual(Array.from(item.positions[1]), [r.camera.x + r.camera.w + 20, r.camera.y + r.camera.h + 20]);
  const save = l.captureRuntimeState(); l.resetObjects(); assert.equal(l.gradientState.active.size, 0);
  l.restoreRuntimeState(save); assert.equal(l.gradientState.active.size, 1);
  l.gradientState.trigger({ raw: { 508: '1' } }); assert.equal(l.gradientState.active.size, 0);
});

test('gradient corners follow Area-transformed real positions', () => {
  const l=fixture(['1,1,2,1600,3,100,57,1', '1,1,2,1700,3,200,57,2',
    '1,1764,2,1600,3,100,57,3', '1,3006,2,0,51,1,71,3,222,1000,241,1,237,-1400',
    '1,2903,2,0,3,0,21,1,22,2,202,5,203,1,204,2,205,1,206,2,207,1']);
  const r=l.gdRenderer; r.colorManager=scene._colorManager; r.setCamera(0,0);
  l.checkAreaTriggers(0); l.areaState.step(0); l.checkShaderTriggers(1); r.update(0);
  near(l.gradientState.target(1).x,200);
  const item=r.buckets.flat().find(i=>i.colors);
  assert.deepEqual(Array.from(item.positions[0]),[200,100]);
  assert.deepEqual(Array.from(item.positions[2]),[200,100]);
});

test('Stop removes a group\'s active gradient while toggling its corner helpers retains the layer', () => {
  // Native controls native-gradient-hidden-corners / native-gradient-stop:
  // hiding the corner group keeps the white layer; stopping the trigger's
  // own group removes it, with the four guide objects still present.
  const l=fixture(['1,211,2,100,3,100,57,1.50', '1,211,2,200,3,100,57,2.50',
    '1,211,2,100,3,200,57,3.50', '1,211,2,200,3,200,57,4.50',
    '1,2903,2,0,21,1,22,1,203,1,204,2,205,3,206,4,207,1,209,5,202,8,57,60',
    '1,1616,2,30,51,60']);
  const r=l.gdRenderer;r.colorManager=scene._colorManager;r.setCamera(0,0);
  l.checkShaderTriggers(0);r.update(0);
  assert.ok(r.buckets.flat().some(i=>i.colors));
  l._toggleGroupTriggered(50,false);r.update(0);
  assert.ok(r.buckets.flat().some(i=>i.colors));
  const saved=l.captureRuntimeState();l.checkStopTriggers(60);r.update(0);
  assert.equal(l.gradientState.active.size,0);assert.ok(!r.buckets.flat().some(i=>i.colors));
  l.restoreRuntimeState(saved);assert.equal(l.gradientState.active.size,1);
});

test('UI-bound artwork retains Area Fade in its local coordinates', () => {
  // native-ui-area-fade: the white square stays in the UI layer but is
  // translucent at half the Area length, rather than opaque white.
  const l=fixture(['1,3807,2,1000,3,1000,57,293,274,293,135,1',
    '1,211,2,1100,3,1000,57,293.296', '1,3613,2,0,51,293,71,293,385,2,386,6',
    '1,3009,2,30,51,293,71,293,280,1,241,1,222,200,275,1'],r=>{
      r.frames.get=()=>({key:'test',slot:0,u0:0,v0:0,u1:1,v1:1,w:30,h:30,cw:30,ch:30,ox:0,oy:0});
    });
  const r=l.gdRenderer;r.colorManager=scene._colorManager;r.setCamera(0,0);
  l.checkAreaTriggers(60);l.areaState.step(0);r.update(0);
  assert.equal(l.gdObjects[1].isUIObject,true);
  const item=r.buckets.flat().find(i=>i.screen);
  assert.ok(item);near(item.opacity,.5);
});

test('gradient targets use the declared group parent and ignore ambiguous groups', () => {
  const l = fixture(['1,1,2,100,3,100,57,1', '1,1,2,300,3,300,57,1',
    '1,1,2,400,3,400,57,2', '1,1,2,600,3,600,57,2,34,1,274,2',
    '1,2903,2,0,3,0,202,5,203,1,206,2']);
  const r = l.gdRenderer; r.colorManager = scene._colorManager; r.setCamera(0, 0);
  l.checkShaderTriggers(1); r.update(0);
  const item = r.buckets.flat().find(i => i.colors);
  assert.equal(l.gradientState.target(1), null);
  assert.deepEqual({...l.gradientState.target(2)}, {x:600,y:600});
  assert.equal(item.positions[1][0],600);
  assert.equal(item.positions[1][1],r.camera.y+r.camera.h+20);
});

test('gradient face order follows activation rather than trigger section order and survives checkpoints', () => {
  const l=fixture(['1,2903,2,1,3,100,202,10,209,1', '1,2903,2,2,3,-100,202,10,209,2']);
  const r=l.gdRenderer;r.colorManager=scene._colorManager;r.finalize();r.setCamera(0,0);
  const [outer,inner]=l._gradientTriggers;
  assert.ok(l.gdObjects[inner.uid].arrival<l.gdObjects[outer.uid].arrival);
  l.gradientState.trigger(outer);l.gradientState.trigger(inner);r.update(0);
  assert.ok(l.gradientState.items.get(1).sortKey<l.gradientState.items.get(2).sortKey);
  const saved=l.gradientState.capture();
  l.gradientState.trigger({raw:{209:'1',208:'1'}});l.gradientState.trigger(outer);r.update(0);
  assert.ok(l.gradientState.items.get(1).sortKey<l.gradientState.items.get(2).sortKey);
  l.gradientState.reset();l.gradientState.restore(saved);r.update(0);
  assert.ok(l.gradientState.items.get(1).sortKey<l.gradientState.items.get(2).sortKey);
});

test('counter glyphs loaded after finalization use the level font and stay live', () => {
  const old=scene.cache;let loaded=false;
  const font={texture:'test',data:{lineHeight:67,chars:{48:{width:40,height:50,xOffset:0,yOffset:8,xAdvance:36,u0:0,v0:0,u1:1,v1:1}}}};
  scene.cache={bitmapFont:{get:()=>loaded?font:null}};
  try {
    const r=new context.GDRenderer(scene);r.colorManager=new ColorManager();r.setCamera(0,0);
    const label=r.addLabel(parseObject('1,1615,2,100,3,100,80,1'),'0','gjFont57');
    r.finalize();r.update(0);assert.equal(r.quadCount,0);
    loaded=true;r.fontLoaded('gjFont57');r.update(0);
    assert.equal(label.parts.length,1);assert.equal(r.quadCount,1);
    loaded=false;r.setLabelText(label,'00');assert.equal(label.labelPending,'00');
    loaded=true;r.setLabelText(label,'000');assert.equal(label.labelPending,undefined);
    r.fontLoaded('gjFont57');assert.equal(label.labelText,'000');assert.equal(label.parts.length,3);
  } finally {scene.cache=old;}
});

test('shared group opacity follows live alpha changes and matches the general renderer', () => {
  const l = fixture(['1,211,2,100,3,100,57,1.2', '1,211,2,130,3,100,57,1.2',
    '1,211,2,160,3,100,57,2.1'],r=>{
      r.frames.textures=['test'];
      r.frames.get=()=>({key:'test',slot:0,u0:0,v0:0,u1:1,v1:1,w:30,h:30,cw:30,ch:30,ox:0,oy:0});
    });
  const r=l.gdRenderer;r.colorManager=scene._colorManager;r.setCamera(-100,-100);r.groupState={enabled:()=>true,opacityMap:{1:.8,2:.5}};
  for(const base of [1,.8])for(const opacity of [.5,.2,0.09999999999999998,1/3,0,1]) {
    r.groupState.opacityMap[1]=base;
    r.groupState.opacityMap[2]=opacity;
    r.legacyPrepare=false;r.update(0);
    const fast=Array.from(r._vu.subarray(0,r.quadCount*24)),count=r.quadCount;
    if(opacity>0)assert.ok(count>0,'compare real quads, not empty buffers');
    r.legacyPrepare=true;r.update(0);
    assert.equal(r.quadCount,count);
    assert.deepEqual(Array.from(r._vu.subarray(0,count*24)),fast);
    for(const o of r.objects) near(r._fastGroupOpacity(o._rank),r._groupOpacity(o));
  }
});

test('custom orbs choose toggle or spawn without invoking both native commands', () => {
  for (const spawn of [false, true]) {
    const l = fixture(['1,1,2,100,3,100,57,7', '1,1,2,200,3,100,57,3',
      '1,901,2,100,3,0,51,3,28,30,57,7,62,1', `1,1594,2,100,3,100,51,7,504,${spawn ? 1 : 0}`]);
    const orb = l.objects.find(c => c.orbId === 1594);
    l.activateCustomRing(orb); l.stepMoveTriggers(0);
    assert.equal(l._groupEnabled[7] === false, !spawn);
    near(l.gdRenderer.groups.get(3)[0].offX, spawn ? 30 : 0);
  }
});

test('Animate and Spawn triggers restart one-shot frame animations and honour speed/offset flags', () => {
  const l = fixture(['1,1614,2,100,3,100,57,8,123,1,107,2',
    '1,1585,2,0,3,0,51,8', '1,1268,2,5,3,0,51,8']);
  const r = l.gdRenderer;
  r.frames.get = name => name ? { key: 'test', slot: 0, name, w: 21, h: 21, cw: 21, ch: 21, ox: 0, oy: 0 } : null;
  // Reload definitions after installing the atlas stand-in.
  r.spriteTreeCache.clear(); r.partsCache.clear(); r.animationCache.clear();
  const obj = r.addObject(parseObject('1,1614,2,100,3,100,57,8,123,1,107,2'));
  r.colorManager = scene._colorManager; r.setCamera(0, 0); r.update(0);
  assert.equal(r.quadCount, 0); assert.equal(obj.animationSpeed, 1); // Use Speed is disabled.
  l.checkAnimationTriggers(0); r.update(0); assert.ok(r.quadCount > 0);
  const checkpoint = l.captureRuntimeState(); r.update(0.5); assert.equal(r.quadCount, 0);
  l.restoreRuntimeState(checkpoint); r.update(0); assert.ok(r.quadCount > 0);
  r.update(0.5); l.checkSpawnTriggers(10); l.stepSpawnTriggers(0); r.update(0); assert.ok(r.quadCount > 0);
  const offset = r.addObject(parseObject('1,1614,2,100,3,100,122,1,107,-2,462,1,592,1'));
  r.time = 0; r.update(0); assert.equal(offset.animationSpeed, -2); assert.equal(offset.parts, offset.animation[2]);
});

test('trigger-only particle bursts wait for Animate, emit the saved count, and restore at checkpoints', () => {
  const l = fixture(['1,2065,2,100,3,100,57,7,123,1,145,10a0a0.53a0a-1a90a0a100', '1,1585,2,0,3,0,51,7']);
  const r = l.gdRenderer, sys = r.particleSystems[0]; r.colorManager = scene._colorManager; r.setCamera(0, 0);
  r.update(0.1); assert.equal(sys.particles.length, 0);
  l.checkAnimationTriggers(0); assert.equal(sys.particles.length, 10);
  const checkpoint = l.captureRuntimeState(); r.update(1); assert.equal(sys.particles.length, 0);
  l.restoreRuntimeState(checkpoint); assert.equal(sys.particles.length, 10);
  l._playAnimationTrigger(l._animationTriggers[0]); assert.equal(sys.particles.length, 10);
  l.resetObjects(); assert.equal(sys.particles.length, 0); assert.equal(sys.triggered, false);
});

test('particle object colours replace saved RGB with main/detail channels and preserve birth colours and alpha', () => {
  const l=fixture(['1,2065,2,100,3,100,21,7,22,8,57,9,123,1,146,1,145,1a0a1']);
  const r=l.gdRenderer,p=r.particleSystems[0],cm=scene._colorManager;r.colorManager=cm;
  Object.assign(p.data,{StartColorR:0,StartColorG:1,StartColorB:1,StartColorA:.6,
    EndColorR:0,EndColorG:1,EndColorB:0,EndColorA:.2});
  cm.setInitialColor(7,{r:255,g:0,b:0});cm.setInitialColor(8,{r:0,g:0,b:255});cm.step(0);r.update(0);
  p.trigger();assert.deepEqual(Array.from(p.particles[0].startColor),[1,0,0,.6]);
  assert.deepEqual(Array.from(p.particles[0].endColor),[0,0,1,.2]);
  cm.setInitialColor(7,{r:0,g:255,b:0});cm.step(0);r.update(0);
  assert.deepEqual(Array.from(p.particles[0].startColor),[1,0,0,.6]);
  r.spawnParticles(9,{x:200,y:200});const clone=r.spawnedParticleSystems[0];
  assert.deepEqual(Array.from(clone.particles[0].startColor),[0,1,0,.6]);
  cm.setInitialColor(7,{r:255,g:0,b:0});cm.step(0);r.update(0);clone.spawn();
  assert.deepEqual(Array.from(clone.particles[1].startColor),[0,1,0,.6]);
});

test('Spawn Particle preserves parent layout, freezes independent bursts, cleans up and restores checkpoints', () => {
  const l = fixture([
    '1,2065,2,100,3,100,57,7,34,1,274,7,123,1,145,10a-1a0.5a0a-1',
    '1,2065,2,120,3,100,57,7,123,1,145,6a-1a0.5a0a-1',
    '1,1764,2,400,3,300,57,8,6,60',
    '1,3608,2,0,3,0,51,7,71,8,551,1,552,30,554,2,547,5,548,-10'
  ]);
  const r = l.gdRenderer; r.colorManager = scene._colorManager; r.setCamera(600,400);
  r.moveGroup(8,10,20); // Spawn reads live positions without a frame flush.
  l.checkLogicTriggers(0);
  const [a,b]=r.spawnedParticleSystems;
  assert.equal(r.spawnedParticleSystems.length,2);
  near(a.object.x,415);near(a.object.y,310);
  near(b.object.x,415);near(b.object.y,270);
  near(a.object.rotationX,90);near(a.object.scaleX,2);
  assert.equal(a.particles.length,10);assert.equal(b.particles.length,6);
  assert.equal(a.data.Duration,0);assert.equal(r.particleSystems[0].data.Duration,-1);
  r.moveGroup(7,2000,2000);l._applyToggleTrigger({targetGroup:7,activate:false});r.update(.1);
  near(a.object.x,415);assert.equal(a.particles.length,10);
  const saved=l.captureRuntimeState();r.update(1);assert.equal(r.spawnedParticleSystems.length,0);
  l.restoreRuntimeState(saved);
  assert.equal(r.spawnedParticleSystems.length,2);assert.equal(r.spawnedParticleSystems[0].particles.length,10);
  near(r.spawnedParticleSystems[0].particles[0].age,.1);
  r.update(1);l.restoreRuntimeState(saved);assert.equal(r.spawnedParticleSystems.length,2);
  l.resetObjects();assert.equal(r.spawnedParticleSystems.length,0);
});

test('Spawn Particle handles ambiguous templates, moved triggers, variance, missing targets and finite duration', () => {
  const l=fixture([
    '1,2065,2,100,3,100,57,7,123,1,145,4a0.2a0.2a0a20',
    '1,2065,2,300,3,300,57,7,123,1,145,4a0.2a0.2a0a20',
    '1,3608,2,10,3,20,57,9,51,7,547,2,548,3,549,10,550,20,552,30,553,10,554,1,555,0.5'
  ]);
  const r=l.gdRenderer;r.colorManager=scene._colorManager;r.moveGroup(9,40,50);
  const samples=[.25,.75,0,1];l._gdRandom=()=>samples.shift();
  l.checkLogicTriggers(20);
  assert.equal(samples.length,0);
  for(const p of r.spawnedParticleSystems) {
    near(p.object.x,42);near(p.object.y,93);near(p.object.rotationX,25);near(p.object.scaleX,1.25);
    assert.equal(p.particles.length,0);
  }
  r.update(.1);assert.ok(r.spawnedParticleSystems.every(p=>p.particles.length===2));
  r.update(.4);assert.equal(r.spawnedParticleSystems.length,0);
  r.spawnParticles(99,{x:0,y:0});assert.equal(r.spawnedParticleSystems.length,0);
  r.spawnParticles(7,{x:0,y:0},0,0);near(r.spawnedParticleSystems[0].object.scaleX,1);
});

test('touch trigger bounds follow stretched and rotated objects and the player size', () => {
  const l = fixture(['1,1585,2,100,3,100,11,1,128,2.64']);
  const t = l._animationTriggers[0], node = l.gdObjects[t.uid];
  assert.equal(l._touchesTrigger(t, 300, 200, 50), true);
  assert.equal(l._touchesTrigger(t, 311, 200, 50), false);
  node.rotationX = node.rotationY = 90;
  assert.equal(l._touchesTrigger(t, 200, 300, 50), true);
  assert.equal(l._touchesTrigger(t, 300, 200, 50), false);
  const wasMini = scene._state.isMini;
  scene._state.isMini = false; assert.equal(l._touchesTrigger(t, 255, 200, 50), true);
  scene._state.isMini = true; assert.equal(l._touchesTrigger(t, 255, 200, 50), false);
  scene._state.isMini = wasMini;
});

test('Move to Target uses the explicit parent, target axis and live collider position', () => {
  const l = fixture([
    '1,1,2,100,3,100,57,1',
    '1,1764,2,120,3,130,34,1,274,1',
    '1,1764,2,400,3,330,57,2',
    '1,901,2,0,51,1,71,2,100,1,101,1,28,999,29,999,58,1,59,1,10,1'
  ]);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.5);
  near(l.gdObjects[0].offX, 140); near(l.gdObjects[0].offY, 0);
  near(l.objects[0].x, 480); near(l.objects[0].y, 200);
  l.stepMoveTriggers(0.5); near(l.gdObjects[0].offX, 280);
});

test('direction moves normalize their vector and silent moves apply immediately', () => {
  const l = fixture([
    '1,1,2,100,3,100,57,1', '1,1764,2,103,3,104,57,2',
    '1,901,2,0,51,1,71,2,394,1,396,50,544,1,10,10'
  ]);
  l.checkMoveTriggers(0);
  near(l.gdObjects[0].offX, 30); near(l.gdObjects[0].offY, 40);
  assert.equal(l._activeMoveTweens.length, 0);
  near(l.objects[0].x, 260); near(l.objects[0].y, 280);
});

test('dynamic target moves retain live endpoints across repeated practice restores', () => {
  const l = fixture([
    '1,1,2,100,3,100,57,1', '1,1764,2,300,3,100,57,2',
    '1,901,2,0,51,1,71,2,100,1,397,1,10,1'
  ]);
  l.checkMoveTriggers(0); l.stepMoveTriggers(0); l.stepMoveTriggers(0.5);
  const saved = l.captureRuntimeState();
  for (let i = 0; i < 2; i++) {
    l.resetObjects(); l.resetMoveTriggers(); l.restoreRuntimeState(saved);
    // The target moves after restoring; a cloned GDObj would miss this.
    l._translateGroup(2, 200, 100); l.stepMoveTriggers(0.5);
    near(l.gdObjects[0].x + l.gdObjects[0].offX, 400);
    near(l.gdObjects[0].y + l.gdObjects[0].offY, 50);
    near(l.objects[0].x, 800); near(l.objects[0].y, 100);
  }
});

test('practice restores the native group-selection RNG and camera lock baseline', () => {
  const l = fixture([block]);
  l._gdRandSeed = 12345; l._camLockLast = { x: 123, y: 456 }; l._camLockLastPlayerX = 78;
  const saved = l.captureRuntimeState();
  const sequence = [l._gdRandom(), l._gdRandom(), l._gdRandom()];
  l.resetMoveTriggers(); l.restoreRuntimeState(saved);
  assert.deepEqual([l._gdRandom(), l._gdRandom(), l._gdRandom()], sequence);
  near(l._camLockLast.x, 123); near(l._camLockLast.y, 456); near(l._camLockLastPlayerX, 78);
});

test('camera locks begin after an earlier camera jump and retain the final frame', () => {
  const l = fixture([block, '1,901,2,100,51,1,141,1,142,1,10,1']);
  const oldPosition = l._getMoveTriggerPlayerPosition;
  let pos = { playerX: 190, playerY: 0, cameraX: 1000, cameraY: 2000 };
  l._getMoveTriggerPlayerPosition = () => pos;
  l._camLockLast = { x: 0, y: 0 }; l._camLockLastPlayerX = 190;
  scene._playerWorldX = 210; l.cameraState.jumpX = 195;
  l.checkMoveTriggers(210); l.stepMoveTriggers(0); l.stepMoveTriggers(0.5, true); l.stepCameraLockMoves();
  near(l.gdObjects[0].offX, 0); near(l.gdObjects[0].offY, 0);
  pos = { ...pos, cameraX: 1020, cameraY: 2030 };
  l.stepMoveTriggers(0.5, true); l.stepCameraLockMoves();
  near(l.gdObjects[0].offX, 10); near(l.gdObjects[0].offY, 15);
  assert.equal(l._activeMoveTweens.length, 0);
  l._getMoveTriggerPlayerPosition = oldPosition; scene._playerWorldX = 0;
});

test('dash cube and ball spin independently of the dash line and respect gravity modifiers', () => {
  const p = Object.create(context.testAPI.PlayerObject.prototype); p.p = new context.testAPI.PlayerState();
  for (const ball of [false, true]) for (const flipped of [false, true]) {
    Object.assign(p.p, { isBall: ball, gravityFlipped: flipped, gravityMod: 0.5 });
    p._startDash({ orbRotation: -45 }); p.updateDashRotation(0.3);
    near(p._dashSpin, (flipped ? -1 : 1) * 144 * Math.PI / 180);
    near(p._rotation, -Math.atan(p.p.dashSlope));
    const spin = p._dashSpin; p._stopDash(); near(p._rotation, spin); near(p._dashSpin, 0);
  }
  p.p.isFlying = true; p._startDash({ orbRotation: -45 }); p.updateDashRotation(0.3);
  near(p._dashSpin, 0); near(p._rotation, -Math.atan(p.p.dashSlope));
});

test('particle spawn areas and quads share saved rotation, flips and group transforms', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ slot: 0, w: 10, h: 10, cw: 10, ch: 10, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const obj = r.addObject(parseObject('1,2065,2,100,3,100,6,90,128,2,129,3,57,1'));
  const system = new context.GDParticleSystem(r, obj, {
    Life: 1, LifeVar: 0, Angle: 90, AngleVar: 0, Speed: 10, SpeedVar: 0,
    StartSize: 10, StartSizeVar: 0, EndSize: 10, EndSizeVar: 0,
    StartColorR: 1, StartColorG: 1, StartColorB: 1, StartColorA: 1,
    EndColorR: 1, EndColorG: 1, EndColorB: 1, EndColorA: 1,
    PositionType: 2, customParticleIdx: 0
  });
  system.sample = (value = 0) => value;
  system.spawn(); const p = system.particles[0]; p.x = 4; p.y = 5;
  system.draw(); let item = r.buckets.flat().at(-1);
  near(item.m[4], 115); near(item.m[5], 92);
  near(item.m[0], 0); near(item.m[1], -2); near(item.m[2], 3); near(item.m[3], 0);
  r.rotateGroup(1, Math.PI / 2, null, false);
  r.clearFrame();
  system.draw(); item = r.buckets.flat().at(-1);
  near(item.m[4], 92); near(item.m[5], 85);
});

test('teleport entry and generated exit share native batches, groups, visibility and removal', () => {
  const l = fixture(['1,747,2,100,3,100,54,90,57,1,274,1,116,1'], r => {
    r.frames.get = name => ({ key: name, slot: 0, w: 25, h: 90, cw: 25, ch: 90, ox: 0, oy: 0 });
  });
  const r = l.gdRenderer, entry = l.gdObjects[0], exit = entry.teleportExit;
  assert.ok(entry && exit && entry.companion && exit.companion);
  assert.equal(exit.id, 749); assert.equal(exit.companionOf, entry);
  near(entry.y, 100); near(exit.y, 190); assert.equal(exit.flipX, true);
  assert.equal(r.groupParent(1), entry);
  near(r.groupCenter(1).x, 100); near(r.groupCenter(1).y, 100);
  l._translateGroup(1, 60, -40);
  near(r.livePosition(entry).x, 130); near(r.livePosition(exit).x, 130);
  near(r.livePosition(entry).y, 120); near(r.livePosition(exit).y, 210);
  const saved = l.captureRuntimeState();
  for (let n = 0; n < 2; n++) {
    l.resetObjects(); l.restoreRuntimeState(saved);
    near(r.livePosition(exit).y, 210); near(r.groupCenter(1).y, 120);
  }
  r.removeObject(entry);
  for (const object of [entry, entry.companion, exit, exit.companion]) assert.equal(object.removed, true);
  assert.equal(r.groups.get(1).length, 0);
});

test('native Grouped particles inherit node axes; Free and Relative keep identity axes', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ slot: 0, w: 10, h: 10, cw: 10, ch: 10, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  for (const mode of [0, 1, 2]) {
    const obj = r.addObject(parseObject('1,2065,2,100,3,100'));
    const system = new context.GDParticleSystem(r, obj, {
      Life: 2, StartSize: 10, EndSize: 10, StartColorA: 1, EndColorA: 1,
      StartColorR: 1, StartColorG: 1, StartColorB: 1,
      EndColorR: 1, EndColorG: 1, EndColorB: 1, PositionType: mode
    });
    system.sample = value => value; system.spawn();
    system.particles[0].x = 4; system.particles[0].y = 5;
    // Moving an unrotated, unscaled Free/Relative emitter leaves its cloud
    // in place; Grouped particles move with it.
    obj.offX = 10; obj.offY = 20;
    r.clearFrame(); system.draw(); let item = r.buckets.flat().at(-1);
    near(item.m[4], mode === 2 ? 114 : 104);
    near(item.m[5], mode === 2 ? 125 : 105);
    // Native Free/Relative nodes keep scale 1 and rotation 0 (641f90).
    obj.rotationX = obj.rotationY = 90; obj.scaleX = 2; obj.scaleY = 3;
    r.clearFrame(); system.draw(); item = r.buckets.flat().at(-1);
    near(item.m[4], mode === 2 ? 125 : 104);
    near(item.m[5], mode === 2 ? 112 : 105);
    near(item.m[0], mode===2?0:1); near(item.m[1], mode===2?-2:0);
    near(item.m[2], mode===2?3:0); near(item.m[3], mode===2?0:1);
  }
});

test('a linked Area parent keeps Skeletal flames outside the surrounding parent scale', () => {
  for (const childEffect of [false, true]) {
    const l = fixture([
      '1,2065,2,270,3,90,57,2,108,3,128,1.587,129,7.933',
      '1,923,2,270,3,90,57,1.2,274,2,135,1',
      '1,1,2,270,3,90,57,2,108,3,279,1,135,1',
      '1,3008,2,0,51,1,233,0.67,235,0.41,222,10000',
      ...(childEffect ? ['1,3008,2,0,51,2,233,0.5,235,0.5,222,10000'] : [])
    ]);
    l.checkAreaTriggers(0); l.areaState.step(0);
    const o = l.gdObjects[0], area = {};
    l.areaState.forObject(o, o.x, o.y, area);
    // Native controlled fixture: the containing .67/.41 transform never
    // reaches the separately linked child, even without a child effect.
    near(area.sx, area.sy);
    if (!childEffect) { near(area.sx, 1); near(area.sy, 1); }
    else assert.ok(area.sx > .5 && area.sx < .55);
    assert.ok(!l.areaState._plan(o).entries.some(e => e.inst.trig.target === 1));
  }
});

test('Area transforms and fade reach particle spawn coordinates, existing quads and emission culling', () => {
  const frames = r => {
    r.frames.get = () => ({ slot: 0, w: 10, h: 10, cw: 10, ch: 10, ox: 0, oy: 0 });
    r.colorManager = new ColorManager();
  };
  const l = fixture(['1,2065,2,100,3,100,57,1', '1,1764,2,100,3,100,57,2',
    '1,3008,2,0,51,1,71,2,222,600,233,2,235,3',
    '1,3007,2,0,51,1,71,2,222,600,270,90',
    '1,3006,2,0,51,1,71,2,222,600,241,1,237,10,239,20',
    '1,3009,2,0,51,1,71,2,222,600,275,0.5,286,0.5'], frames);
  const r = l.gdRenderer, obj = l.gdObjects[0];
  l.checkAreaTriggers(0); l.areaState.step(0); r.setCamera(0, 0);
  const system = new context.GDParticleSystem(r, obj, {
    Life: 2, StartSize: 10, EndSize: 10, StartColorA: 1, EndColorA: 1, PositionType: 2
  });
  system.sample = value => value; system.spawn();
  const p = system.particles[0]; near(p.originX, 110); near(p.originY, 120);
  p.x = 4; p.y = 5; system.draw(); let item = r.buckets.flat().at(-1);
  near(item.m[4], 125); near(item.m[5], 112); near(item.opacity, .5);
  near(item.m[0], 0); near(item.m[1], -2); near(item.m[2], 3); near(item.m[3], 0);
  l.areaState.reset(); r.clearFrame(); system.draw(); item = r.buckets.flat().at(-1);
  near(item.m[4], 104); near(item.m[5], 105); near(item.opacity, 1);

  const distant = fixture(['1,2065,2,1000,3,100,57,1', '1,1764,2,1000,3,100,57,2',
    '1,3006,2,0,51,1,71,2,222,600,241,1,237,-900'], frames);
  distant.checkAreaTriggers(0); distant.areaState.step(0);
  const cloud = new context.GDParticleSystem(distant.gdRenderer, distant.gdObjects[0], {
    Life: 1, StartSize: 10, EndSize: 10, Speed: 0
  });
  assert.equal(cloud.intersectsView({x:0,y:0,w:200,h:200}, 0), true);
  distant.areaState.reset();
  assert.equal(cloud.intersectsView({x:0,y:0,w:200,h:200}, 0), false);
});

test('object-coloured particles override the saved blend and spawned systems retain the chosen mode', () => {
  // Native Aperture radius control: saved isBlendAdditive=1, but Uniform
  // Object Color on a nonblending channel draws with ONE, ONE_MINUS_SRC_ALPHA.
  const r=new context.GDRenderer(scene),blends=new Set();
  r.frames.get=()=>({slot:0,w:10,h:10,cw:10,ch:10,ox:0,oy:0});
  r.colorManager=new ColorManager();r.colorManager.getBlending=id=>blends.has(id);r.setCamera(0,0);
  const obj=r.addObject(parseObject('1,2065,2,100,3,100,21,7,22,8,147,1,57,9'));
  const system=new context.GDParticleSystem(r,obj,{Life:2,StartSize:10,EndSize:10,isBlendAdditive:1,
    StartColorR:1,StartColorG:1,StartColorB:1,StartColorA:1,EndColorR:1,EndColorG:1,EndColorB:1,EndColorA:1});
  obj.particleSystem=system;system.sample=v=>v;system.spawn();system.draw();
  const normal=context.GDRender.batchFor(obj.zLayer,false,'particle');
  assert.equal(r.buckets[normal].length,1);assert.equal(system.objectBlend(),false);
  r.spawnParticles(9,{x:200,y:200});const clone=r.spawnedParticleSystems[0];
  assert.equal(clone.snapshotBlend,false);
  blends.add(8);r._channelStamp++;assert.equal(system.objectBlend(),true);
  assert.equal(clone.snapshotBlend,false,'spawn snapshots the selected channel blend');
  blends.clear();r._channelStamp++;obj.levelObj._raw[147]='0';
  assert.equal(system.objectBlend(),true,'independent particle colour retains its saved additive profile');
  system.data.isBlendAdditive=0;blends.add(7);r._channelStamp++;
  assert.equal(system.objectBlend(),false,'independent particle colour ignores the object channel blend');
  obj.levelObj._raw[146]='1';assert.equal(system.objectBlend(),true);
});

test('directional particles retain authored spin, the native upright axis and radius motion', () => {
  const r=new context.GDRenderer(scene);
  r.frames.get=()=>({slot:0,w:10,h:10,cw:10,ch:10,ox:0,oy:0});
  const obj=r.addObject(parseObject('1,2065,2,100,3,100'));
  const make=data=>{const s=new context.GDParticleSystem(r,obj,{Life:2,StartSize:10,EndSize:10,...data});s.sample=v=>v;s.spawn();return s;};
  const straight=make({Angle:0,Speed:10,StartSpin:-45,EndSpin:-5,rotationIsDir:1});
  near(straight.particles[0].rotation,45);
  straight.step(.5,false);near(straight.particles[0].rotation,55);
  // Native Aperture radial telemetry keeps 90-angle for fixed-angle
  // emission, e.g. an angle near 117 degrees draws near 333 degrees.
  const radial=make({EmitterMode:1,Angle:117,StartRadius:100,EndRadius:200,dynamicRotationIsDir:1});
  radial.step(.05,false);near(radial.particles[0].rotation,-27);
  const curved=make({EmitterMode:1,Angle:0,StartRadius:100,EndRadius:200,RotatePerSecond:90,dynamicRotationIsDir:1});
  curved.step(.05,false);const p=curved.particles[0];
  let target=90-Math.atan2(p.y,p.x)*180/Math.PI;
  while(target-p.startSpin>180)target-=360;while(target-p.startSpin<-180)target+=360;
  near(p.rotation,target);
  assert.notEqual(p.rotation,-Math.atan2(p.vy,p.vx)*180/Math.PI,'radius movement follows its actual displacement');
  const fullTurn=make({Angle:0,Speed:10,StartSpin:270,dynamicRotationIsDir:1});
  near(fullTurn.particles[0].directionOffset,360);
});

test('native particle friction damps rates after integration and overlapping fades use one ramp', () => {
  const r=new context.GDRenderer(scene);
  r.frames.get=()=>({slot:0,w:10,h:10,cw:10,ch:10,ox:0,oy:0});
  r.colorManager=new ColorManager();r.setCamera(0,0);
  const obj=r.addObject(parseObject('1,2065,2,100,3,100'));
  const system=new context.GDParticleSystem(r,obj,{
    Life:2,Angle:0,Speed:10,StartSize:10,EndSize:20,StartSpin:0,EndSpin:40,
    StartColorR:1,StartColorG:1,StartColorB:1,StartColorA:1,
    EndColorR:1,EndColorG:1,EndColorB:1,EndColorA:1,
    frictionPos:1,frictionSize:1,frictionRot:1,PositionType:2
  });
  system.sample=value=>value;system.spawn();let p=system.particles[0];
  system.step(.5,false);near(p.x,5);near(p.size,12.5);near(p.rotation,10);
  system.step(.5,false);near(p.x,7.5);near(p.size,13.75);near(p.rotation,15);
  system.data.frictionSize=-1;system.reset();system.spawn();p=system.particles[0];
  system.step(.5,false);system.step(.5,false);near(p.size,16.25);
  p.life=1;p.age=.5;p.fadeIn=p.fadeOut=.8;
  system.draw();near(r.buckets.flat().at(-1).opacity,.625);
});

test('particle expiry matches native swap removal and Order Sensitive stable order', () => {
  const r=new context.GDRenderer(scene);
  r.frames.get=()=>({slot:0,w:10,h:10,cw:10,ch:10,ox:0,oy:0});
  const obj=r.addObject(parseObject('1,2065,2,100,3,100'));
  for(const sensitive of [false,true]) {
    const system=new context.GDParticleSystem(r,obj,{Life:2,StartSize:10,EndSize:10,Speed:10,orderSensitive:sensitive});
    system.sample=value=>value;
    for(let n=0;n<4;n++){system.spawn();system.particles[n].tag=n;}
    system.particles[0].life=.01;system.particles[2].life=.01;
    system.step(.1,false);
    assert.deepEqual(Array.from(system.particles,p=>p.tag),sensitive?[1,3]:[3,1]);
    for(const p of system.particles){near(p.age,.1);near(p.x,1);}
  }
});

test('a distant warped particle emitter remains active when its cloud reaches the view', () => {
  const r = new context.GDRenderer(scene);
  r.frames.get = () => ({ slot: 0, w: 16, h: 16, cw: 16, ch: 16, ox: 0, oy: 0 });
  r.colorManager = new ColorManager(); r.setCamera(0, 0);
  const obj = r.addObject(parseObject('1,2065,2,1000,3,100,6,-90,129,10'));
  const system = new context.GDParticleSystem(r, obj, {
    PositionType: 2, Life: 8, LifeVar: 0, Angle: 90, AngleVar: 0, Speed: 50, SpeedVar: 0,
    PosVarX: 10, PosVarY: 10, StartSize: 10, EndSize: 10,
    GravityX: 0, GravityY: 0, RadialAccel: 0, RadialAccelVar: 0, TangentialAccel: 0, TangentialAccelVar: 0
  });
  assert.equal(system.intersectsView(r.camera, 0), true);
  obj.rotationX = obj.rotationY = 90;
  assert.equal(system.intersectsView(r.camera, 0), false);
});

test('native CCPoint precision retains the expected 300-second horizontal position', () => {
  const advance = vm.runInContext('gdAdvancePosition', context);
  let x = 0;
  for (let i = 0; i < 72000; i++) x = advance(x, 623.160216 / 240);
  near(x, 186829.78125);
  assert.ok(Math.abs(x - 623.160216 * 300) > 100);
});

test('shader range classifies native batches and separates player particles', () => {
  const l = fixture(['1,2904,2,0,196,4,197,10']);
  l.checkShaderTriggers(0);
  const s = l.shaderState;
  assert.equal(s.bandForZ(-1600), -1); assert.equal(s.bandForZ(-920), 0);
  assert.equal(s.bandForZ(59), 0); assert.equal(s.bandForZ(710), 1);
  s.trigger({ id: 2904, raw: { 196: '8', 197: '8', 188: '1' } });
  assert.equal(s.bandForZ(39), -1); assert.equal(s.bandForZ(59), 0); assert.equal(s.bandForZ(61), 1);
});

test('End triggers preserve native flags, target position and spawn-only activation', () => {
  const l = fixture(['1,1764,2,500,3,150,57,2',
    '1,3600,2,100,3,50,71,2,460,1,461,1,487,1',
    '1,3600,2,0,3,100,62,1,57,3']);
  const calls = []; scene._endFromTrigger = value => calls.push(value);
  l.checkEndTriggers(199); assert.equal(calls.length, 0);
  l.checkEndTriggers(200); assert.equal(calls.length, 1);
  assert.deepEqual({ ...calls[0] }, { x: 1000, y: 300, noEffects: true, noSFX: true, instant: true });
  l._activateSpawnedGroup(3); assert.equal(calls.length, 2);
  assert.equal(calls[1].instant, false); delete scene._endFromTrigger;
});

test('keyframe paths move, rotate and scale graphics and collision relative to the first frame', () => {
  const l = fixture([block,
    '1,3032,2,1000,3,1000,57,77,373,5,10,2',
    '1,3032,2,1100,3,1100,373,5,374,1,6,90,32,2',
    '1,3033,2,0,51,1,76,77,521,0.5,520,1,545,1,522,1,523,1,546,1']);
  l.checkKeyframeTriggers(0); l.keyframeState.step(1);
  const obj = l.gdObjects[0];
  near(obj.x + obj.offX, 125); near(obj.y + obj.offY, 150); near(obj.rotOff, 45);
  near(obj.extraScaleX, 1.5); near(obj.extraScaleY, 1.5);
  near(l.objects[0].x, 250); near(l.objects[0].y, 300);
  const checkpoint = l.captureRuntimeState();
  l.keyframeState.step(1);
  near(obj.x + obj.offX, 150); near(obj.y + obj.offY, 200); near(obj.rotOff, 90); near(obj.extraScaleX, 2);
  l.resetObjects(); l.restoreRuntimeState(checkpoint); l.keyframeState.step(1);
  near(obj.x + obj.offX, 150); near(obj.y + obj.offY, 200); near(obj.rotOff, 90); near(obj.extraScaleX, 2);
  assert.equal(l.keyframeState.active.length, 0);
});
test('keyframes read separate saved rotation axes and normalize native reflected poses', () => {
  for (const [rx, ry, sx, sy, rotation, expectedX, expectedY] of [
    [-8,-7,1,1,-8,1,1], [266.53,-92,1,1,266.53,1,1],
    [180,0,1,1,0,1,-1], [-180,0,1,1,0,1,-1],
    [0,180,1,1,0,-1,1], [0,-180,1,1,0,-1,1],
    [-30,-30,-2,-3,150,2,3]
  ]) {
    const l=fixture([block,'1,3032,2,1000,3,1000,57,77,51,1,373,5,10,1',
      `1,3032,2,1000,3,1000,373,5,374,1,131,${rx},132,${ry},128,${sx},129,${sy}`]);
    const path=l.keyframeState.pathFor({raw:{76:'77'}}),frame=path.frames[1];
    // Path interpolation unwraps angles to the closest equivalent turn.
    near(((frame.rotation-rotation)%360+360)%360,0);
    near(frame.sx,expectedX);near(frame.sy,expectedY);
    if(rx===-8){
      l.keyframeState.startPath({raw:{76:'77',520:'1',522:'1'}},path);l.keyframeState.step(.5);
      near(l.gdObjects[0].rotOff,-4);
    }
  }
});

test('one Keyframe trigger starts every referenced path once and restores them together', () => {
  const l=fixture(['1,1,2,100,3,100,57,1','1,1,2,200,3,200,57,2',
    '1,3032,2,1000,3,1000,57,77,373,5,51,1,10,1',
    '1,3032,2,1100,3,1000,57,77,373,5,374,1,51,1',
    '1,3032,2,2000,3,2000,57,77,373,6,51,2,10,1',
    '1,3032,2,2000,3,2100,57,77,373,6,374,1,51,2',
    '1,3033,2,0,76,77,520,1,521,1,545,1,522,1,523,1,546,1']);
  l.checkKeyframeTriggers(0);assert.equal(l.keyframeState.active.length,2);
  l.keyframeState.step(.5);
  near(l.gdObjects[0].x+l.gdObjects[0].offX,150);near(l.gdObjects[1].y+l.gdObjects[1].offY,250);
  const saved=l.captureRuntimeState();
  for(let i=0;i<2;i++) {
    l.resetObjects();l.restoreRuntimeState(saved);l.keyframeState.step(.5);
    near(l.gdObjects[0].x+l.gdObjects[0].offX,200);near(l.gdObjects[1].y+l.gdObjects[1].offY,300);
    assert.equal(l.keyframeState.active.length,0);
  }
});

test('a later keyframe marker selects the whole path and preserves its target group', () => {
  const l=fixture([block,
    '1,3032,2,1000,3,1000,373,5,10,1',
    '1,3032,2,1100,3,1040,373,5,374,1,57,77,51,1,10,0.5',
    '1,3032,2,1200,3,1000,373,5,374,2,57,77,51,1,10,0.5,376,1',
    '1,3033,2,0,76,77,520,1,521,1,545,1,522,1,523,1,546,1']);
  l.checkKeyframeTriggers(0);
  assert.equal(l.keyframeState.active.length,1);
  assert.equal(l.keyframeState.active[0].path.frames.length,4);
  l.keyframeState.step(.5);near(l.gdObjects[0].offX,50);near(l.gdObjects[0].offY,20);
  l.keyframeState.step(1.5);near(l.gdObjects[0].offX,0);near(l.gdObjects[0].offY,0);
  assert.equal(l.keyframeState.active.length,0);
});

test('animation group selection follows arrival order and only the final marker closes a path', () => {
  const l=fixture([block,'1,1,2,200,3,100,57,2',
    '1,3032,2,1100,3,1000,373,5,374,1,57,77,51,1',
    '1,3032,2,1000,3,1000,373,5,57,77,51,2,10,1,376,1',
    '1,3033,2,0,76,77,520,1,521,1,545,1,522,1,523,1,546,1']);
  l.checkKeyframeTriggers(0);l.keyframeState.step(1);
  near(l.gdObjects[0].offX,100);near(l.gdObjects[1].offX,0);
  assert.equal(l.keyframeState.active.length,0);
});

test('Close Loop keyframes return their transform to the first pose without accumulating distortion', () => {
  const l=fixture([block,
    '1,3032,2,1000,3,1000,57,77,373,5,51,1,10,0.2',
    '1,3032,2,1100,3,1040,373,5,374,1,51,1,6,30,128,2.5,129,0.7,10,0.3,376,1',
    '1,3033,2,0,76,77,62,1,87,1,57,88,520,1,521,1,545,1,522,1,523,1,546,1']);
  const obj=l.gdObjects[0];
  for(let repeat=0;repeat<5;repeat++) {
    l._activateSpawnedTrigger(l._keyframeTriggers[0],'keyframe');
    near(l.keyframeState.active[0].path.durations.reduce((a,b)=>a+b,0),.5);
    l.keyframeState.step(.2);near(obj.rotOff,30);near(obj.extraScaleX,2.5);
    l.keyframeState.step(.3);
    near(obj.offX,0);near(obj.offY,0);near(obj.rotOff,0);near(obj.extraScaleX,1);near(obj.extraScaleY,1);
    obj.affine.forEach((value,index)=>near(value,index===0||index===3?1:0));
    assert.equal(l.keyframeState.active.length,0);
    near(l.objects[0].x,200);near(l.objects[0].y,200);
  }
});

test('curved keyframes interpolate through all points and Stop cancels the live command', () => {
  const l = fixture([block,
    '1,3032,2,1000,3,1000,57,77,373,5,10,1,378,1',
    '1,3032,2,1100,3,1100,373,5,374,1,10,1,378,1',
    '1,3032,2,1200,3,1000,373,5,374,2',
    '1,3033,2,0,51,1,76,77,62,1,57,88,520,1,521,1,545,1,522,1,523,1,546,1']);
  l._activateSpawnedGroup(88); l.keyframeState.step(0.5);
  near(l.gdObjects[0].offX, 50); near(l.gdObjects[0].offY, 68.75);
  l.keyframeState.step(0.5); near(l.gdObjects[0].offX, 100); near(l.gdObjects[0].offY, 100);
  l._applyStopTrigger({targetGroup:1}); l.keyframeState.step(1);
  near(l.gdObjects[0].offX, 100); near(l.gdObjects[0].offY, 100);
  assert.equal(l.keyframeState.active.length, 0);
});

test('slope checkpoint state survives repeated restores and a fresh attempt clears it', () => {
  const l = fixture(['1,289,2,100,3,100,57,1']);
  const player = Object.create(context.testAPI.PlayerObject.prototype);
  player._gameLayer = l; player._resetSlopeState();
  Object.assign(player, { _prevSlopeObj: l.objects[0], _activeSlopeObj: l.objects[0],
    _slopeRiding: true, _slopeContactFrames: 13, _prevSlopeAngle: Math.PI / 4,
    _slopeExitVel: 10.3860036, _lastSlopeSeatY: 242.4264, _lastCollisionWorldX: 200, _lastCollisionWorldY: 242.4264 });
  const saved = player.captureSlopeState();
  for (let i = 0; i < 3; i++) {
    player._resetSlopeState();
    assert.equal(player._slopeRiding, false); assert.equal(player._slopeExitVel, null);
    player.restoreSlopeState(saved);
    assert.equal(player._prevSlopeObj, l.objects[0]);
    assert.equal(player._slopeContactFrames, 13); near(player._lastSlopeSeatY, 242.4264);
    player._slopeContactFrames += 20;
  }
  assert.equal(saved._slopeContactFrames, 13);
});

test('Swing uses native flip damping, size gravity and symmetric terminal velocity', () => {
  const player = Object.create(context.testAPI.PlayerObject.prototype);
  player._isTouchingAvailableOrbForInput = () => false;
  for (const mini of [false, true]) for (const flip of [false, true]) {
    player.p = new context.testAPI.PlayerState();
    Object.assign(player.p, { isSwing: true, isMini: mini, gravityFlipped: flip, yVelocity: flip ? -10 : 10, upKeyPressed: true });
    player._swingPendingFlip = false;
    const acceleration = 1.916398 * (mini ? 0.6 : 0.4) * 0.225 * (flip ? -1 : 1);
    const before = player.p.yVelocity;
    // updateJump 4eab87..4eabd8: the update after the press flips, damps
    // vy by 0.8 and then integrates the new gravity.
    player._updateSwingJump(0.225);
    assert.equal(player.p.gravityFlipped, !flip);
    near(player.p.yVelocity, before * 0.8 + acceleration);
    player.p.upKeyDown = false;
    for (let n = 0; n < 500; n++) player._updateSwingJump(0.225);
    near(player.p.yVelocity, flip ? -16 : 16);
  }
});

test('mini spider free fall shares full-size gravity', () => {
  const player = Object.create(context.testAPI.PlayerObject.prototype);
  player.updateGroundRotation = () => {}; player._shouldPrioritizeGroundOrbInput = () => false;
  for (const mini of [false, true]) for (const flip of [false, true]) {
    player.p = new context.testAPI.PlayerState();
    Object.assign(player.p, { isSpider: true, isMini: mini, gravityFlipped: flip, onGround: false, canJump: false });
    player._updateSpiderJump(0.225);
    near(player.p.yVelocity, 1.916398 * 0.6 * 0.225 * (flip ? 1 : -1));
  }
});

test('deferred group moves reach shared members before transforms, once, and only for current members', () => {
  const r = new context.GDRenderer(scene);
  const a = r.addObject(parseObject('1,1,2,100,3,100,57,1.2'));
  const b = r.addObject(parseObject('1,1,2,200,3,100,57,3'));
  r.moveGroup(2, 50, 0); r.moveGroup(3, 100, 0);
  near(r.groupCenter(1).x, 150);
  near(a.x + a.offX, 100, 'reading a centre preserves deferred moves');
  r.rotateGroup(1, Math.PI / 2, {x: 0, y: 0});
  near(a.x + a.offX, 100); near(a.y + a.offY, -150);
  near(b.x + b.offX, 200, 'a transform of group 1 leaves group 3 deferred');
  // GD moves the members a group has when the move runs.
  const c = r.addObject(parseObject('1,1,2,300,3,100,57,1.3'));
  r.scaleGroup(1, 2, 1, {x: 0, y: 0});
  near(c.x + c.offX, 600); near(r.livePosition(b).x, 300);
  r.removeObject(c); r.moveGroup(3, 10, 0); r.flushMovesFor(1);
  near(r.livePosition(b).x, 310, 'group 3 is not a group of 1: its move stays pending for b');
  r.flushMoves(); near(b.x + b.offX, 310);
  r.flushMoves(); near(b.x + b.offX, 310, 'a second flush applies nothing again');
});

test('transforms rebuild culling once per draw and preserve wide bounds, removal and restore', () => {
  const l=fixture(['1,1,2,2000,3,100,57,1']);
  const r=l.gdRenderer,o=l.gdObjects[0],visible=[];
  r._rankObjects();r.colorManager=scene._colorManager;
  r._prepareObject=obj=>visible.push(obj);r._fastPrepare=rank=>visible.push(r._byRank[rank]);r._buildVertices=()=>{};
  r._fadedOut=rank=>{visible.push(r._byRank[rank]);return true;};
  let indexed=0;const index=r._indexObject;
  r._indexObject=function(obj){indexed++;return index.call(this,obj);};
  // Four physics ticks move previously offscreen artwork into the view.
  for(let i=0;i<4;i++)r.rotateGroup(1,Math.PI/4,{x:1000,y:100},false);
  near(r.livePosition(o).x,0);assert.equal(indexed,0);
  r.setCamera(0,0);r.update(0);assert.ok(visible.includes(o));assert.equal(indexed,1);
  const saved=r.captureRuntimeState();
  r.scaleGroup(1,1000,1000,null,false,false);r.update(0);assert.equal(o._class,3);
  r.restoreRuntimeState(saved);assert.notEqual(o._class,3);
  r.rotateGroup(1,.1,null,false);r.removeObject(o);r.update(0);
  assert.equal(o._class,undefined);assert.equal(r._pendingIndices.length,0);
});

test('logic triggers are loaded in the regression harness and hold-touch releases its group', () => {
  for (const mode of [0, 1, 2]) {
    const l = fixture([block, `1,1595,2,0,51,1,81,1,82,${mode}`]);
    assert.ok(l.logicState); l.checkLogicTriggers(0);
    const actions = [];
    l._toggleGroupTriggered = (group, active) => { actions.push([group, active]); l._groupEnabled[group]=active; };
    l.logicState.button(true); l.logicState.button(false);
    assert.equal(actions.length, 2); assert.equal(actions[1][1], !actions[0][1]);
  }
});

test('Hold Touch release uses its explicit mode after late registration and Alternate reads external toggles',()=>{
 for(const mode of [1,2]){
  const l=fixture([block,`1,1595,2,0,51,1,81,1,82,${mode}`]);l.checkLogicTriggers(0);
  l.logicState.button(false);assert.equal(l._groupEnabled[1],mode===2);
  l.logicState.button(true);assert.equal(l._groupEnabled[1],mode===1);
  l._groupEnabled[1]=mode===2;l.logicState.button(false);assert.equal(l._groupEnabled[1],mode===2);
 }
 const l=fixture([block,'1,1595,2,0,51,1,81,1']);l.checkLogicTriggers(0);
 l.logicState.button(true);assert.equal(l._groupEnabled[1],false);
 l._groupEnabled[1]=true;l.logicState.button(false);assert.equal(l._groupEnabled[1],false);
});

test('persistent item configuration and timers roll back with reusable practice checkpoints', () => {
  const l = fixture(['1,3641,2,0,80,5,491,1', '1,3614,2,0,80,7,467,2,470,1']);
  l.checkLogicTriggers(0); l.logicState.step(0.5);
  const saved = l.captureRuntimeState();
  for (let n = 0; n < 2; n++) {
    l.logicState._persistent({80: '9', 491: '1'}); l.logicState.step(1);
    l.resetObjects(); l.restoreRuntimeState(saved);
    assert.deepEqual([...l.logicState.persistent], [5]);
    near(l.logicState.timers.get(7).time, 2.5);
  }
});

test('native bitmap text retries missing lowercase glyphs as capitals and keeps available lowercase', () => {
  const glyph = xAdvance => ({width: 10, height: 20, xAdvance, xOffset: 0, yOffset: 0, kerning: {}});
  const fonts = { caps: { texture: 'caps', data: { lineHeight: 24, chars: {65: glyph(12), 66: glyph(14)} } },
    mixed: { texture: 'mixed', data: { lineHeight: 24, chars: {65: glyph(12), 97: glyph(8)} } } };
  const r = new context.GDRenderer({...scene, cache: {bitmapFont: {get: key => fonts[key]}}});
  const label = r.addText(parseObject('1,914,2,100,3,100'), 'ab\na', 'caps');
  assert.equal(label.parts.length, 3);
  near(label.parts[0].matrix[4], -6.5); near(label.parts[1].matrix[4], -0.5);
  const mixed = r.addText(parseObject('1,914,2,100,3,100'), 'Aa', 'mixed');
  assert.equal(mixed.parts.length, 2); near(mixed.parts[0].matrix[4], -5);
  context.settingsMap = { kA18: '999' };
  assert.equal(context.LevelObject.prototype._levelFontKey(), 'gjFont59');
});

test('a press goes to the rings the last collision touched, never to disabled or No Touch rings', () => {
  // pushButton (Steam 4f62d9) skips its immediate jump only when the last
  // collision pass touched a ring; that pass skips disabled and No Touch
  // objects before any ring is recorded.
  const l = fixture(['1,36,2,100,3,100']);
  const p = Object.create(context.testAPI.PlayerObject.prototype); p._scene = scene; p._gameLayer = l;
  p.p = new context.testAPI.PlayerState(); Object.assign(p.p, {y: 200, upKeyPressed: true, onGround: true, canJump: true});
  assert.equal(p._pressGoesToTouchedRings(), false);
  p._touchedRings = [l.objects[0]]; assert.equal(p._pressGoesToTouchedRings(), true);
  p.p.isDead = true; assert.equal(p._pressGoesToTouchedRings(), false);
  assert.equal(p._shouldPrioritizeGroundOrbInput(), false);
  const src = fs.readFileSync(path.join(root, 'assets/scripts/core/player.js'), 'utf8');
  const loop = src.slice(src.indexOf('if (!gameObj || gameObj._eeDisabled) continue;'), src.indexOf('this._touchedRings.push(gameObj);'));
  assert.ok(loop.length > 0 && loop.includes('if (gameObj.noTouch) continue;'));
});

test('collider movement is accumulated once per tick and rolls back with checkpoints', () => {
  const l = fixture([block]); const c = l.objects[0];
  scene._fixedTickActive = true; scene._physicsFrame = 20;
  try {
    l._translateGroup(1, 2, -3); l._translateGroup(1, 4, -5);
    near(c._gdPreviousX, 200); near(c._gdPreviousY, 200);
    near(c.x, 206); near(c.y, 208);
    const saved = l.captureRuntimeState();
    scene._physicsFrame++;
    l._translateGroup(1, 7, 9); near(c._gdPreviousX, 206);
    l.resetObjects(); assert.equal(c._gdMotionFrame, undefined);
    l.restoreRuntimeState(saved); near(c._gdPreviousX, 200); near(c._gdPreviousY, 200); near(c.x, 206);
    l.restoreRuntimeState(saved); near(c.x, 206);
  } finally { scene._fixedTickActive = false; delete scene._physicsFrame; }
});

test('slow TimeWarp does not deduplicate separate real physics ticks as one spawn step', () => {
  const l = fixture(['1,901,2,0,51,1,28,1,62,1,57,7,87,1']);
  let activations = 0;
  l._activateSpawnedTrigger = () => activations++;
  try {
    scene._fixedTickActive = true; scene._physicsFrame = 1;
    l._activateSpawnedGroup(7); l._activateSpawnedGroup(7);
    assert.equal(activations, 1);
    scene._physicsFrame = 2; l._spawnClock = 0.001;
    l._activateSpawnedGroup(7); l._activateSpawnedGroup(7);
    assert.equal(activations, 2);
  } finally { scene._fixedTickActive = false; delete scene._physicsFrame; }
});

function triggerAudioFixture() {
  const calls=[],ctx={currentTime:0,state:'running',destination:{},
    createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),
    createBufferSource:()=>({playbackRate:{value:1},connect(){},disconnect(){},stop(){},
      start(...args){calls.push(args);}})};
  const audio=new context.testAPI.AudioManager({game:{sound:{context:ctx}},sound:{},_paused:false});
  audio._setupAnalyser=()=>{};
  for(const kind of ['song','sfx'])audio.triggers.buffers.set(`${kind}:123`,{duration:300});
  return {a:audio,t:audio.triggers,ctx,calls,trigger:(id,raw)=>audio.triggers.trigger({id,raw})};
}

test('Song Prepare is silent and Load Prep uses the saved song, start, volume and channel',()=>{
  const {a,t,calls,trigger}=triggerAudioFixture();
  trigger(1934,{392:123,399:1,408:42532,406:.3,409:1500,432:2});
  assert.equal(calls.length,0);assert.equal(t.songs.size,0);
  trigger(1934,{392:456,400:1,408:10,406:1,432:2});
  const voice=t.songs.get(2);
  assert.equal(voice.spec.id,123);near(calls[0][1],42.532);near(voice.levelVolume,.3);
  assert.equal(t.songs.has(0),false);a.stopMusic();assert.equal(t.songs.size,0);assert.equal(t.prepared.size,0);
});

test('Edit Song native flag 418 fades volume to omitted zero; 419 changes semitone speed independently',()=>{
  const {a,t,ctx,trigger}=triggerAudioFixture();
  trigger(1934,{392:123,406:.8,432:1});
  trigger(3605,{418:1,10:2,432:1});t.update(1);
  const voice=t.songs.get(1);near(voice.levelVolume,.4);near(voice.speed,1);
  trigger(3605,{419:1,404:12,406:2,10:0,432:1});near(voice.speed,2);near(voice.levelVolume,.4);
  ctx.currentTime=1;t.update(1);near(voice.position,2);near(voice.levelVolume,0);
  trigger(1934,{392:123,432:2});near(t.songs.get(2).levelVolume,0);
  a.stopMusic();
});

test('SFX clips, unique overrides, minimum intervals and paused checkpoints preserve active voices',()=>{
  const {a,t,ctx,trigger}=triggerAudioFixture();
  trigger(3602,{392:123,406:1,413:1,415:1,416:8,408:100,410:900,434:.2});
  const first=[...t.effects][0];near(first.source.loopStart,.1);near(first.source.loopEnd,.9);
  trigger(3602,{392:123,406:1,415:1,416:8});assert.equal(t.effects.size,1);
  ctx.currentTime=.3;trigger(3602,{392:123,406:1,415:1,416:8,420:1,434:.2});
  assert.equal(first.ended,true);t.update(.3);assert.equal(t.effects.size,1);
  const voice=[...t.effects][0];a.pauseMusic();const pos=voice.seek;ctx.currentTime=4;near(voice.seek,pos);
  a.resumeMusic();ctx.currentTime=4.1;near(voice.seek,pos+.1);
  const state=t.capture();t.restore(state);near([...t.effects][0].seek,pos+.1);
  trigger(3603,{416:8,417:1});assert.equal([...t.effects][0].ended,true);
  a.stopMusic();assert.equal(t.effects.size,0);
});

test('Song and SFX trigger IDs use normal position and spawned-group dispatch',()=>{
  const seen=[],before=scene._audio;scene._audio={triggers:{trigger:t=>seen.push(t.id)}};
  try {
    const l=fixture(['1,1934,2,0,3,0,392,123,406,1','1,3602,2,10,3,0,392,123,406,1',
      '1,3605,2,20,3,0,418,1','1,3603,2,30,3,0,62,1,57,9,417,1']);
    l.checkLogicTriggers(100);assert.deepEqual(seen,[1934,3602,3605]);
    l._activateSpawnedGroup(9,scene._colorManager,false);assert.deepEqual(seen,[1934,3602,3605,3603]);
  } finally {scene._audio=before;}
});

test('a Swing press is spent in its own update and leaves no edge for a checkpoint',()=>{
  const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();
  p._gameLayer={objects:[]};p._isTouchingAvailableOrbForInput=()=>false;
  p.p.upKeyPressed=true;p.p.isSwing=true;p._updateSwingJump(.225);
  assert.equal(p.p.gravityFlipped,true);assert.equal(p.p.upKeyPressed,false);
  const checkpoint=p.captureSlopeState();p.restoreSlopeState(checkpoint);p.p.upKeyDown=false;
  p._updateSwingJump(.225);assert.equal(p.p.gravityFlipped,true);assert.equal(p._swingPendingFlip,false);
});


test('decoded audio cache retires old levels without evicting current song and SFX assets',()=>{
  const {t}=triggerAudioFixture();t.buffers.clear();
  const big={length:16*1024*1024,numberOfChannels:2};
  t.buffers.set('song:oldA',big);t.buffers.set('song:current',big);t.buffers.set('song:oldB',big);
  t.buffers.set('sfx:current',{length:1024,numberOfChannels:1});
  t.required=new Set(['song:current','sfx:current']);t._pruneBuffers();
  assert.equal(t.buffers.has('song:oldA'),false);assert.equal(t.buffers.has('song:oldB'),false);
  assert.equal(t.buffers.has('song:current'),true);assert.equal(t.buffers.has('sfx:current'),true);
});

test('No Effects portals still emit gameplay events without creating shine sprites',()=>{
  const p=Object.create(context.testAPI.PlayerObject.prototype),events=[];
  p.p=new context.testAPI.PlayerState();p._scene={_physicsFrame:240};
  p._gameLayer={logicState:{event:e=>events.push(e)}};
  p._getPortalShineFrames=()=>{throw Error('No Effects portal created art');};
  p._playPortalShine({type:'portal_swing',_eeLevelObject:{noEffects:true}});
  assert.deepEqual(events,[33]);near(p.p._modeChangeTime,1);
});


test('earlier position audio runs before Count-spawned edits without re-entering a command twice',()=>{
  const calls=[],before=scene._audio;scene._audio={triggers:{trigger:t=>calls.push(Number(t.raw[406]||0))}};
  try {
    const l=fixture(['1,3605,2,-15,3,0,418,1,406,1','1,1811,2,-11,3,0,80,5,51,9,56,1',
      '1,3605,2,0,3,0,57,9,62,1,418,1','1,3605,2,10,3,0,418,1,406,.5']);
    l.checkCountTriggers(100);l.checkLogicTriggers(100);
    assert.deepEqual(calls,[1,0,.5]);
  } finally {scene._audio=before;}
});


test('a rotated spider searches the full teleport ray across distant world sections',()=>{
  const l=fixture(['1,1,2,700,3,50']);
  const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();
  p.p.isSpider=true;p.p.y=100;p.p.lastY=100;p._gameLayer=l;p._scene=scene;
  scene._player=p;scene._state=p.p;scene._playerWorldX=200;
  const frame=l.gameplayState;frame.u={x:0,y:1};frame.v={x:1,y:0};frame.origin={x:200,y:100};
  const leave=frame.enterPhysics();
  try {
    assert.equal(l.getNearbySectionObjects(0).length,0);
    p._spiderTeleportBand=()=>({floor:-2000,ceil:2000});
    near(p._spiderTeleportTarget(true,0,27).y,1143);
    assert.ok(l.getSpiderSearchObjects(0,0,2000,35).some(o=>o._eeObjectId===0));
  }finally{leave();delete scene._player;scene._state={y:0};scene._playerWorldX=0;}
  assert.equal(l.getSpiderSearchObjects,undefined);
});


test('Stop Loop finishes the active SFX pass instead of stopping the sound immediately',()=>{
  const {a,t,ctx,trigger}=triggerAudioFixture();
  trigger(3602,{392:123,406:1,413:1,416:3,408:100,410:900});
  const voice=[...t.effects][0];ctx.currentTime=.4;
  trigger(3603,{416:3,414:1});
  assert.equal(voice.ended,false);assert.equal(voice.source.loop,false);assert.equal(voice.spec.loop,false);
  near(voice.position,.5);const saved=t.capture();t.restore(saved);
  assert.equal([...t.effects][0].spec.loop,false);a.stopMusic();
});


test('the user music slider preserves authored channel volumes including a muted intro',()=>{
  const {a,t,trigger}=triggerAudioFixture();
  trigger(1934,{392:123,406:0,432:0});trigger(1934,{392:123,406:.3,432:1});
  a.setUserMusicVolume(.5);
  near(t.songs.get(0).levelVolume,0);near(t.songs.get(0).gain.gain.value,0);
  near(t.songs.get(1).levelVolume,.3);near(t.songs.get(1).gain.gain.value,.12);
  a.stopMusic();
});


test('background and ground Art triggers select native indices and restore checkpoint and header art',()=>{
  const before={settings:context.settingsMap,textures:scene.textures,bg:scene._bg,apply:scene._applyMirroredBackgroundTexture};
  const changes=[];context.settingsMap={kA6:'13',kA7:'2'};
  scene.textures={exists:key=>key.startsWith('game_bg_')||key.startsWith('groundSquare_')};scene._bg={};scene._applyMirroredBackgroundTexture=key=>changes.push(key);
  try {
    const l=fixture(['1,3029,2,0,3,0,533,7','1,3030,2,10,3,0,533,8']);
    l._groundTiles=[{}];l.applyGroundTexture=()=>changes.push(`ground:${context._groundId}`);
    const beforeArt=l.logicState.capture();
    l.checkLogicTriggers(100);
    assert.deepEqual(changes,['game_bg_6','ground:07']);
    const state=l.logicState.capture();l.logicState.reset();
    assert.deepEqual(changes.slice(-2),['game_bg_12','ground:01']);
    l.logicState.restore(state);assert.deepEqual(changes.slice(-2),['game_bg_6','ground:07']);
    l.logicState.restore(beforeArt);assert.deepEqual(changes.slice(-2),['game_bg_12','ground:01']);
    l.logicState.reset();
  }finally{context.settingsMap=before.settings;scene.textures=before.textures;scene._bg=before.bg;scene._applyMirroredBackgroundTexture=before.apply;}
});


test('Collision triggers use their load-time index and track removal, insertion and restart without scanning scenery',()=>{
  const l=fixture(['1,1816,2,100,3,100,80,7,94,1','1,1816,2,110,3,100,80,8','1,1815,2,0,3,0,80,7,95,8']);
  const renderer=l.gdRenderer,blocks=renderer.collisionBlocks;
  assert.equal(blocks.get(7).length,1);assert.equal(blocks.get(8).length,1);
  const original=renderer.objects[Symbol.iterator];
  renderer.objects[Symbol.iterator]=()=>{throw Error('Collision query walked scenery');};
  try {
    assert.equal(l.logicState._collides({80:7,95:8}),true);
    renderer.removeObject(blocks.get(8)[0]);assert.equal(l.logicState._collides({80:7,95:8}),false);
    renderer.addObject(parseObject('1,1816,2,110,3,100,80,8'));
    assert.equal(l.logicState._collides({80:7,95:8}),true);
    l.logicState.reset();assert.equal(l.logicState._collides({80:7,95:8}),true);
  }finally{renderer.objects[Symbol.iterator]=original;}
});

test('Collision triggers retain shared-edge contact and fire an exit when the jump rig lifts off',()=>{
 const l=fixture(['1,1816,2,100,3,100,80,3,94,1,57,4','1,1816,2,100,3,70,80,4']);
 const logic=l.logicState,block=l.gdRenderer.collisionBlocks.get(3)[0];
 const trigger={id:1815,uid:-1,raw:{80:'3',95:'4',93:'1',51:'22',56:'1'}};
 const fired=[];l._toggleGroupTriggered=(group,on)=>fired.push([group,on]);
 assert.equal(logic._collides(trigger.raw),true);
 logic.trigger(trigger);logic.step(1/240);assert.equal(fired.length,0);
 block.offY=.01;assert.equal(logic._collides(trigger.raw),false);
 logic.step(1/240);assert.deepEqual(fired,[[22,true]]);
 logic.step(1/240);assert.equal(fired.length,1);
});

test('Move refreshes static Collision blocks, rotation refreshes Dynamic blocks, and rotated corners use SAT',()=>{
 const l=fixture(['1,1816,2,100,3,100,80,3,57,4','1,1816,2,300,3,100,80,4,94,1',
   '1,1816,2,500,3,100,80,5,94,1,57,6','1,1816,2,600,3,100,80,6,6,45']);
 const r=l.gdRenderer,g=l.logicState,a=r.collisionBlocks.get(3)[0],d=r.collisionBlocks.get(5)[0];
 near(g._box(a).x0,85);r.moveGroup(4,200,0);assert.equal(g._collides({80:3,95:4}),true);
 r.rotateGroup(4,Math.PI/2,{x:0,y:0},false);near(g._box(a).x0,285);
 r.rotateGroup(6,Math.PI/2,{x:0,y:0},false);near(g._box(d).x0,85);near(g._box(d).y0,-515);
 const diamond=g._box(r.collisionBlocks.get(6)[0]);
 assert.equal(g._overlap(diamond,{x0:618,x1:620,y0:118,y1:120}),false);
 assert.equal(g._overlap(diamond,{x0:599,x1:601,y0:99,y1:101}),true);
 const saved=g.capture(),box=structuredClone(g._box(a));
 r.moveGroup(4,80,0);g._box(a);g.restore(saved);assert.deepEqual(g._box(a),box);
 r.reset();near(g._box(a).x0,85);near(g._box(d).x0,485);
 const staticOnly=fixture(['1,1816,2,100,3,100,80,7','1,1816,2,110,3,100,80,8']);
 assert.equal(staticOnly.logicState._collides({80:7,95:8}),false);
});

test('Area transforms move and turn Collision blocks with the visible controller',()=>{
 const l=fixture(['1,1816,2,100,3,100,80,3,94,1,128,.3','1,1816,2,200,3,120,80,4']);
 const r=l.gdRenderer,g=l.logicState,a=r.collisionBlocks.get(3)[0];
 assert.equal(g._collides({80:3,95:4}),false);
 r.areaState={active:true,forObject(o,x,y,out){Object.assign(out,{dx:o===a?100:0,dy:o===a?20:0,rot:o===a?90:0,sx:1,sy:1});},
   _beginLinear:()=>[0,-.3,1,0]};
 const box=g._box(a);near(box.x0,185);near(box.x1,215);near(box.y0,115.5);near(box.y1,124.5);
 assert.equal(g._collides({80:3,95:4}),true);
 r.areaState.active=false;assert.equal(g._collides({80:3,95:4}),false);
});

test('all six animated monster types match native part matrices despite overwritten legacy sprite poses',()=>{
 const reference=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-beast-parts.json'),'utf8'));
 let checked=0;
 for(const actor of reference.actors){
  const frames=new Map(),node={id:actor.id,enabled:true,removed:false,levelObj:{},groups:[],
   rotationX:actor.rootRotation,rotationY:actor.rootRotation,scaleX:Math.abs(actor.rootScale[0]),scaleY:Math.abs(actor.rootScale[1]),
   flipX:actor.rootScale[0]<0,flipY:actor.rootScale[1]<0,affine:[1,0,0,1],zLayer:5,zOrder:2,arrival:0,kind:'fire'};
  const pose=actor.parts.map(p=>({tag:String(p.tag),x:p.pos[0],y:p.pos[1],scaleX:p.scale[0],scaleY:p.scale[1],rotation:p.rotation}));
  const parts=actor.parts.map((p,i)=>{
   const name=String(p.tag);frames.set(name,{cw:p.size[0],ch:p.size[1],w:p.size[0],h:p.size[1]});
   return{tag:name,poseIndex:i,companions:[],sprite:{active:true,visible:true,alpha:1,frame:{name},tintTopLeft:0xffffff,
    _eeZDepth:i,x:9999,y:-9999,scaleX:17,scaleY:23,rotation:9,_eeWorldX:8888,_eeBaseY:7777}};
  });
  const drawn=[];
  const renderer={spriteAnimations:[{node,animation:{parts,lastPose:pose}}],frames:{get:name=>frames.get(name)},
   livePosition:()=>({x:actor.x,y:actor.y}),_batch:()=>0,_writePart:(_b,_k,part,m)=>drawn.push([...m])};
  context.GDRenderer.prototype._drawSpriteAnimations.call(renderer);
  assert.equal(drawn.length,actor.parts.length);
  actor.parts.forEach((p,i)=>p.matrix.forEach((v,k)=>near(drawn[i][k],v,2e-4)));
  if(actor===reference.actors[0]){
   const effected=[];
   renderer.areaState={active:true,forObject(_o,_x,_y,out){Object.assign(out,{dx:10,dy:20,linearActive:true,linear:[0,-1,1,0],op:.25,tints:1});},
    applyTints(_o,_a,main,detail){main.splice(0,3,128,32,64);detail.splice(0,3,0,255,0);}};
   renderer._writePart=(_b,_k,_p,m,color,opacity)=>effected.push({m:[...m],color,opacity});
   context.GDRenderer.prototype._drawSpriteAnimations.call(renderer);
   actor.parts.forEach((p,i)=>{
    const [a,b,c,d,x,y]=p.matrix,expected=[b,-a,d,-c,actor.x+10+y-actor.y,actor.y+20-x+actor.x];
    expected.forEach((v,k)=>near(effected[i].m[k],v,2e-4));
    assert.deepEqual(Array.from(effected[i].color),[128,32,64]);near(effected[i].opacity,.25);
   });
  }
  checked+=drawn.length;
 }
 assert.equal(checked,20);
});

test('animated beast eye retains its real atlas trim and matches the measured native quad',()=>{
 const node={id:918,enabled:true,removed:false,levelObj:{},groups:[],rotationX:0,rotationY:0,
  scaleX:1,scaleY:1,flipX:false,flipY:false,affine:[1,0,0,1],zLayer:5,zOrder:2,arrival:0,kind:'fire'};
 const info={cw:24,ch:26.5,w:11,h:11,ox:0,oy:15.5};
 const eye={active:true,visible:true,alpha:1,frame:{name:'eye'},tintTopLeft:0xffffff,_eeZDepth:1,_eeBeastEye:true};
 const pose={tag:'1',x:1.024999976158142,y:12.5,scaleX:.9998599886894226,scaleY:.9998599886894226,rotation:2.52935791015625};
 const drawn=[];
 const mock={spriteAnimations:[{node,animation:{lastPose:[pose],parts:[{tag:'1',poseIndex:0,sprite:eye}]}}],
  frames:{get:()=>info},livePosition:()=>({x:150,y:200}),_batch:()=>0,
  _writePart(_b,_k,p,m){for(const [x,y] of [[p.qx,p.qy+p.info.h],[p.qx,p.qy],[p.qx+p.info.w,p.qy+p.info.h],[p.qx+p.info.w,p.qy]])drawn.push([m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]+90]);}};
 context.GDRenderer.prototype._drawSpriteAnimations.call(mock);
 const native=[[139.62303161621094,316.2647399902344],[139.13766479492188,305.2769775390625],
  [150.61077880859375,315.77935791015625],[150.12539672851562,304.7915954589844]];
 drawn.forEach((point,i)=>point.forEach((v,k)=>near(v,native[i][k],3e-5)));
});

test('regular trail follows the travel axis rather than the icon jump rotation',()=>{
  const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._gameLayer={gameplayState:{u:{x:1,y:0}}};p._rotation=1.7;
  let q=p._regularTrailPosition(100,200,76,218);near(q.x,96);near(q.y,200);
  p.p.isMini=true;q=p._regularTrailPosition(100,200,76,218);near(q.x,97.6);near(q.y,200);
  p._gameLayer.gameplayState.u={x:0,y:1};q=p._regularTrailPosition(100,200,76,218);near(q.x,100);near(q.y,202.4);
  p.p.isBall=true;q=p._regularTrailPosition(100,200,76,218);near(q.x,100);near(q.y,200);
  p.p.isBall=false;p.p.isFlying=true;q=p._regularTrailPosition(100,200,76,218);near(q.x,76);near(q.y,210);
});

test('pad and orb cube half-turns exclude vehicles, spider and robot as in native runRotateAction',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._rotation=.25;
 for(const mode of ['isFlying','isUfo','isWave','isSwing','isRobot','isSpider','isDashing']){
  p.p[mode]=true;p.rotateActionActive=false;p.runRotateAction();assert.equal(p.rotateActionActive,false,mode);p.p[mode]=false;
 }
 p.runRotateAction();assert.equal(p.rotateActionActive,true);const full=p.rotateActionRate;
 p.p.isMini=true;p.runRotateAction();near(p.rotateActionRate/full,Math.fround(13/30)/Math.fround(1/3),1e-5);
 p.p.isGoingLeft=true;p.runRotateAction();assert.ok(p.rotateActionRate<0);
 p.p.isBall=true;p._runBallRotation();assert.ok(p.rotateActionRate<0);
 p._runBallRotationBack();assert.ok(p.rotateActionRate>0);
});

test('ordinary oblique portals never sweep from an omitted previous position at the level origin',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);
 const portal={x:33390,y:11430,w:25,h:75,rotationDegrees:-133.24};
 // Actual Broken Gameplay P2/native OBB samples. Native rejects the first
 // six contacts and admits the seventh; omitted history must stay omitted.
 p._rotation=-665.74795*Math.PI/180;
 assert.equal(p._isPlayerTouchingPortalHitbox(portal,16726.49609375*2,(5786.21142578125-90)*2,30),false);
 p._rotation=-676.1337890625*Math.PI/180;
 assert.equal(p._isPlayerTouchingPortalHitbox(portal,16712.693359375*2,(5795.81103515625-90)*2,30),true);
});

test('spider pad facing preserves native exact-quarter and flip-Y rules',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);
 for(const angle of [0,45,90,91,135,180,269,270,-90,-91,-180,-270])for(const flipY of [false,true]){
  const down=[91,135,180,269,-91,-180].includes(angle);
  assert.equal(p._padFacesDown({rotationDegrees:angle,_eeLevelObject:{flipY}}),down!==flipY,`${angle}/${flipY}`);
 }
 p._scene={_localPhysicsActive:true};p._gameLayer={gameplayState:{u:{x:0,y:1}}};
 assert.equal(p._padFacesDown({rotationDegrees:0,_baseRotationDegrees:270}),true);
 assert.equal(p._padFacesDown({rotationDegrees:0,_baseRotationDegrees:90}),false);
 for(const [angle,plain,flipped] of [[0,false,false],[90,false,true],[180,false,false],[270,true,false],[-90,true,false]]){
  assert.equal(p._padFacesDown({_baseRotationDegrees:angle,_eeLevelObject:{flipY:false}}),plain);
  assert.equal(p._padFacesDown({_baseRotationDegrees:angle,_eeLevelObject:{flipY:true}}),flipped);
 }

});

test('Lens Circle clamps authored strength before tweening, as native triggerLensCircle does',()=>{
 const l=fixture([]),s=l.shaderState;
 s.trigger({id:2913,raw:{176:'10',179:'1',181:'1',10:'1'}});s.step(.5);near(s.uniforms()._lensCircleStrength,.5);
 s.step(.5);near(s.uniforms()._lensCircleStrength,1);
 s.trigger({id:2913,raw:{176:'-2',179:'1',181:'1',10:'0'}});assert.equal(s.uniforms()._lensCircleStrength,undefined);
 s.trigger({id:2913,raw:{176:'.32',179:'1',181:'1',10:'0'}});near(s.uniforms()._lensCircleStrength,.32);
});

test('unrelated Options triggers preserve later legacy Hide/Show Player commands',()=>{
 const l=fixture([]),s=l.logicState;
 s.trigger({id:2899,raw:{162:'-1',163:'1'}});assert.equal(s.playerHidden(1),false);assert.equal(s.playerHidden(2),true);
 s.trigger({id:1612,raw:{138:'1'}});s.trigger({id:1613,raw:{200:'1'}});
 s.trigger({id:2899,raw:{161:'1',532:'1'}});
 assert.equal(s.playerHidden(1),true);assert.equal(s.playerHidden(2),false);assert.ok(s.options.hideGround&&s.options.hideAttempts);
 s.trigger({id:2899,raw:{162:'-1'}});assert.equal(s.playerHidden(1),false);
});

test('Teleport forces preserve native strength, addition, redirect bounds and rotated gravity axes',()=>{
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5, `${a} != ${b}`);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._gameLayer={};
 for(const mini of [false,true])for(const mode of ['isFlying','isUfo','isBall','isSpider','isSwing','isRobot']){
  p.p.isMini=mini;p.p[mode]=true;p.p.yVelocity=-15.12;
  p.applyTeleportForce({345:'1',346:'10'},90);close(p.p.yVelocity,20);assert.equal(p.p.boostLatch,true);
  p.p[mode]=false;
 }
 p.p.yVelocity=-15.12;p.applyTeleportForce({345:'1',346:'10',443:'1'},90);close(p.p.yVelocity,4.88);
 p.applyTeleportForce({345:'1',346:'0'},90);near(p.p.yVelocity,0);assert.equal(p.p.boostLatch,false);
 p.p.yVelocity=-15.12;p.applyTeleportForce({347:'1',350:'2'},90);close(p.p.yVelocity,30.24);
 p.p.yVelocity=-15.12;p.applyTeleportForce({347:'1',350:'2',349:'3'},90);close(p.p.yVelocity,6);
 p.p.yVelocity=0;p.applyTeleportForce({347:'1',348:'10'},135);close(p.p.yVelocity,Math.SQRT2*10);
 p._gameLayer.gameplayState={rotated:true,v:{x:1,y:0}};
 p.applyTeleportForce({345:'1',346:'10'},0);near(p.p.yVelocity,20);
});

test('Teleport launches along the destination facing even when both position axes are ignored',()=>{
 const l=fixture(['1,3817,2,400,3,100,57,4','1,2902,2,600,3,200,57,5']);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._gameLayer=l;p._scene=scene;
 const saved={player:scene._player,x:scene._playerWorldX};scene._player=p;scene._playerWorldX=123;p.p.y=200;
 const fire=(group,extra={})=>l.logicState._teleport({raw:{51:String(group),352:'1',353:'1',345:'1',346:'15.5',...extra},uid:-1},p);
 try {
  // Troll Madness's yellow-pad event uses an unrotated target in group 1,
  // not the Teleport trigger's own right-facing angle. Its launch is 15.5 GD.
  fire(4);near(p.p.yVelocity,31,1e-5);near(scene._playerWorldX,123);near(p.p.y,200);
  const target=l._moveGroupParent(4,true);
  target.rotOff=90;fire(4);near(p.p.yVelocity,0,1e-5);
  target.rotOff=0;target.flipX=true;fire(4);near(p.p.yVelocity,-31,1e-5);
  target.flipX=false;fire(4,{443:'1'});near(p.p.yVelocity,0,1e-5);
  const portal=l._moveGroupParent(5,true);
  fire(5);near(p.p.yVelocity,0,1e-5);
  portal.rotOff=90;fire(5);near(p.p.yVelocity,31,1e-5);
 }finally{scene._player=saved.player;scene._playerWorldX=saved.x;}
});

test('a targetless Teleport trigger still applies its live direction, gravity and static force',()=>{
 const l=fixture(['1,3022,2,100,3,100,6,-90,345,1,346,6','1,3022,2,200,3,100,354,2']);
 const saved={player:scene._player,state:scene._state,x:scene._playerWorldX};
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._gameLayer=l;p._scene=scene;
 scene._player=p;scene._state=p.p;scene._playerWorldX=123;p.p.y=200;p.p.yVelocity=-18;
 try {
  l.checkLogicTriggers(200);near(p.p.yVelocity,12,1e-5);near(scene._playerWorldX,123);near(p.p.y,200);
  l.checkLogicTriggers(400);assert.equal(p.p.gravityFlipped,true);near(p.p.yVelocity,6,1e-5);
 }finally{scene._player=saved.player;scene._state=saved.state;scene._playerWorldX=saved.x;}
});

test('Free Mode spider searches beyond the viewport, while a bounded UFO keeps its corridor',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p.p.isSpider=true;p.p.y=100;
 p._gameLayer={cameraState:{freeMode:true},getCeilingY:()=>null,getFloorY:()=>0,
  _gdGroundLayout:()=>({camBottom:0,H:640,zoom:1}),getNearbySectionObjects:()=>[{type:'solid',x:100,y:1400,w:60,h:60}]};
 near(p._spiderTeleportBand().ceil,6100);near(p._spiderTeleportTarget(true,100,27).y,1343);
 p._gameLayer.cameraState.freeMode=false;p._gameLayer.getCeilingY=()=>540;p.p.isSpider=false;p.p.isUfo=true;
 near(p._spiderTeleportBand().ceil,540);
 p._gameLayer.gameplayState={u:{x:0,y:1}};near(p._spiderTeleportBand().ceil,6100);
});

test('all physical slope types have native direction flags on first load, matching restart',()=>{
 const defs=context.GD_OBJECTS,strings=[];
 for(const [id,d] of Object.entries(defs))if(d.t===25)for(const rot of [0,90,180,270])for(const fx of [0,1])for(const fy of [0,1])
  strings.push(`1,${id},2,100,3,100,6,${rot},4,${fx},5,${fy}`);
 const l=fixture(strings),slopes=l.objects.filter(o=>o.type==='slope');assert.ok(slopes.length>500);
 const read=o=>[o.slopeType,o.slopeUphill,o.slopeDir,o.slopeFlipY,o.slopeAngleDeg,o.gdSolidAbove,o.gdWallOnLeft,o.getSlopeSurfaceYForPlayer(o.x-5,o.x+5)];
 for(const o of slopes){
  assert.equal(o.slopeUphill,[0,3,6,7].includes(o.slopeType),`${o.objid}/${o.slopeType}`);
  assert.equal(o.slopeDir,o.slopeUphill?1:-1);
 }
 const initial=slopes.map(read);l.resetObjects();assert.deepEqual(slopes.map(read),initial);
});

test('spider teleport catches a platform behind its centre when the forward strip is empty',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p.p.isSpider=true;
 const slab={type:'solid',x:-30,y:30,w:60,h:60};
 p._gameLayer={getFloorY:()=>0,getCeilingY:()=>600,getNearbySectionObjects:()=>[slab]};
 p.p.y=400;
 near(p._spiderTeleportTarget(false,6.140625,27).y,87);
 // No overlap with the full body means the world ground is still the target.
 near(p._spiderTeleportTarget(false,28,27).y,27);
 slab.y=570;p.p.y=200;
 near(p._spiderTeleportTarget(true,6.140625,27).y,513);
 near(p._spiderTeleportTarget(true,28,27).y,573);
});

test('spider search does not rotate an already transformed slope bounding box twice',()=>{
 const l=fixture(['1,1744,2,100,3,100']),o=l.objects[0];
 l._applyRotateTriggerColliderDelta(o,Math.PI/2);const p=Object.create(context.testAPI.PlayerObject.prototype),bounds=p._getSpiderSearchBounds(o);
 near(bounds.right-bounds.left,o.w);near(bounds.upper-bounds.lower,o.h);near(o.w,120);near(o.h,60);
});

test('Multi Activate applies to gravity portals and pads with independent player activation',()=>{
 const l=fixture(['1,10,2,100,3,100,99,1','1,11,2,200,3,100','1,140,2,300,3,100,99,1']);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._scene=scene;
 for(const c of l.objects){
  p._setObjectActivated(c,true);
  assert.equal(p._isObjectActivated(c),!c.multiActivate,`${c.type}/${c.padId}`);
 }
});

test('native pad dimensions and teleport portal box offset preserve saved scales and facing',()=>{
 const l=fixture(['1,35,2,100,3,100','1,67,2,200,3,100','1,140,2,300,3,100','1,1332,2,400,3,100',
  '1,3005,2,500,3,100,128,2,129,3','1,747,2,600,3,100,128,2,129,3','1,747,2,700,3,100,6,90']);
 const pads=l.objects.filter(o=>o.padId);
 assert.deepEqual(Array.from(pads.slice(0,4),o=>[o.w,o.h]),[[50,8],[50,12],[50,10],[58,14]]);
 // Runtime fixture has no atlas frames; the browser assertion below checks
 // the untrimmed spider-pad content size from the real atlas.
 const portals=l.objects.filter(o=>o.type==='portal_teleport');
 near(portals[0].x,1248);near(portals[0].y,200);near(portals[1].x,1400);near(portals[1].y,176);
});

test('shape SAT includes the rotating player after the pad broad phase',()=>{
 const c=new context.testAPI.Collider('jump_pad',0,0,50,8,0);c.transformShape(1,0,0,1);
 assert.equal(c.shapeOverlapsRect(0,22,18,18),true,'an exact face touch is a native contact');
 assert.equal(c.shapeOverlapsRect(0,29,18,18),false);
 assert.equal(c.shapeOverlapsRect(0,29,18,18,Math.PI/4),true);
 assert.equal(c.shapeOverlapsRect(0,32,18,18,Math.PI/4),false);
});

test('Random defaults to zero chance, preserving explicit chances and both endpoints',()=>{
 const l=fixture([]),seen=[];l._activateSpawnedGroup=id=>seen.push(id);
 for(const value of [0,.25,.5,.9999]) {
  l._gdRandom=()=>value;
  l.logicState.trigger({id:1912,raw:{51:'7',71:'8'}});
  l.logicState.trigger({id:1912,raw:{51:'7',71:'8',10:'100'}});
  l.logicState.trigger({id:1912,raw:{51:'7',71:'8',10:'50'}});
 }
 assert.deepEqual(seen,[8,7,7,8,7,7,8,7,8,8,7,8]);
});

test('every portal and the spider pad use the measured native collision dimensions, independently of atlas trim',()=>{
 const measured=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-portal-bounds.json'),'utf8'));
 for(const [id,bounds] of Object.entries(measured.objects)) {
  if(id==='38'||id==='749')continue;
  const l=fixture([`1,${id},2,100,3,100`]),c=l.objects.find(o=>o.type.startsWith('portal_')||o.type==='jump_pad');
  assert.ok(c,'native collider '+id);near(c.w,bounds.w*2);near(c.h,bounds.h*2);
 }
});

test('force fields are physical contacts rather than one-shot triggers, with group transforms and ID deduplication',()=>{
 const l=fixture(['1,2069,2,100,3,100,6,180,128,4,129,4,149,0.463,530,7,57,1',
  '1,2069,2,100,3,100,6,180,149,0.463,530,7', '1,3645,2,300,3,100,149,2']);
 const fields=l.objects.filter(o=>o.type==='force_field');assert.equal(fields.length,3);
 near(fields[0].w,240);near(fields[2].hitbox_radius,30);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._rotation=0;
 p._updateForceContacts(fields,200,200,30);near(p.p.forceY,Math.fround(-.463));
 p.p.isRobot=true;p.p.isCube=false;p.p.yVelocity=-20.8;p.applyObjectForces(.225);
 near(p.p.yVelocity,-20.988);assert.equal(p.p.boostLatch,false);
 p._updateForceContacts(fields,200,500,30);near(p.p.forceY,0);
 l._translateGroup(1,0,-300);p._updateForceContacts(fields,200,500,30);near(p.p.forceY,Math.fround(-.463));
 fields[0].noTouch=true;p._updateForceContacts(fields,200,500,30);near(p.p.forceY,0);
});

test('force fields interpolate directional and radial ranges and follow rotated gameplay axes',()=>{
 const l=fixture(['1,2069,2,100,3,100,128,4,129,4,529,1,526,-2,527,2',
  '1,3645,2,300,3,100,128,4,129,4,528,1,529,1,526,0,527,4']);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._rotation=0;
 p._updateForceContacts([l.objects[0]],200,260,10);near(p.p.forceY,1);
 p._updateForceContacts([l.objects[1]],660,200,10);near(p.p.forceX,2);near(p.p.forceY,0);
 l.gameplayState.u={x:0,y:1};l.gameplayState.v={x:1,y:0};
 const c=l.gameplayState.localCollider(l.objects[0]);
 p._updateForceContacts([c],260,200,10);near(p.p.forceX,1);near(p.p.forceY,0);
});

test('independent saved force rotation survives baked geometry and rotated gameplay',()=>{
 const l=fixture(['1,2069,2,100,3,100,131,180,132,-180,128,4,129,4,149,10']);
 const c=l.objects[0],p=Object.create(context.testAPI.PlayerObject.prototype);
 p.p=new context.testAPI.PlayerState();p._rotation=0;
 p._updateForceContacts([c],200,200,10);near(p.p.forceY,-10);near(p.p.forceX,0);
 c.rotationDegrees=90;p._updateForceContacts([c],200,200,10);near(p.p.forceY,0);near(p.p.forceX,-10);
 l.gameplayState.u={x:0,y:1};l.gameplayState.v={x:1,y:0};
 const local=l.gameplayState.localCollider(c);
 p._updateForceContacts([local],200,200,10);near(p.p.forceX,0);near(p.p.forceY,-10);
});

test('wave leaves floor and ceiling by its actual velocity in both gravities and keeps pressing a held surface',()=>{
 // Native MK2 X9028.2: the dart moves into its surface every tick and the
 // collision pass seats it, so it leaves on the tick the face ends.
 const p=Object.create(context.testAPI.PlayerObject.prototype);
 p._gameLayer={gameplayState:{speedScale:1}};
 for(const ceiling of [false,true])for(const gravity of [false,true])for(const held of [false,true]) {
  p.p=new context.testAPI.PlayerState();p._rotation=0;
  Object.assign(p.p,{isWave:true,onGround:true,onCeiling:ceiling,gravityFlipped:gravity,upKeyDown:held});
  const up=held!==gravity,leave=ceiling?!up:up;
  p._updateWaveJump(.225);
  assert.equal(p.p.onGround,!leave);assert.equal(p.p.onCeiling,ceiling&&!leave);
  assert.equal(Math.sign(p.p.yVelocity),up?1:-1);
 }
});

test('wave mode halves its incoming and outgoing vertical velocity like native toggleDartMode',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p.p.yVelocity=12;
 for(const key of ['stopRotation','_setGamemodeFlyBounds','setCubeVisible','setBallVisible','setShipVisible','setWaveVisible','setSpiderVisible'])p[key]=()=>{};
 p._streak={reset(){},start(){},stop(){}};p._waveTrail={reset(){},start(){},fadeOut(){}};
 p.enterWaveMode();near(p.p.yVelocity,6);p.exitWaveMode();near(p.p.yVelocity,3);
});

test('green teleport portals retain group targeting and the second player teleports independently',()=>{
 const l=fixture(['1,2902,2,100,3,100,51,4,353,1,99,1','1,3809,2,400,3,100,57,4']);
 const col=l.objects.find(o=>o.type==='portal_teleport');assert.ok(col?.teleportToGroup);assert.ok(col.multiActivate);
 const saved={player:scene._player,player2:scene._player2,state2:scene._state2,x:scene._playerWorldX,x2:scene._secondaryWorldX};
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._scene=scene;p._gameLayer=l;
 scene._player2=p;scene._state2=p.p;scene._playerWorldX=123;scene._secondaryWorldX=200;p.p.y=222;
 try {l.logicState._teleport({raw:{51:'4',353:'1'},uid:0},p);near(scene._playerWorldX,123);near(p._worldX(),800);near(p.p.y,222);}
 finally {Object.assign(scene,{_player:saved.player,_player2:saved.player2,_state2:saved.state2,_playerWorldX:saved.x,_secondaryWorldX:saved.x2});}
});

test('target teleports clear both old trail paths without disabling emission; targetless forces retain them',()=>{
 const l=fixture(['1,3809,2,400,3,100,57,4']);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p.p=new context.testAPI.PlayerState();p._scene=scene;p._gameLayer=l;
 const drawScene={add:{extern:()=>({setBlendMode(){}})}};
 p._streak=new context.testAPI.StreakManager(drawScene,'test',.3,10,20,100);
 p._waveTrail=new context.testAPI.WaveTrail(drawScene,0xffffff);
 for(const trail of [p._streak,p._waveTrail]){
  trail.start();trail.setPosition(100,100);trail.update(.01);
  trail.setPosition(140,140);trail.update(.01);
 }
 const saved={player:scene._player,x:scene._playerWorldX};scene._player=p;scene._playerWorldX=200;p.p.y=200;
 try{
  l.logicState._teleport({raw:{345:'1',346:'5'},uid:-1},p);
  assert.equal(p._streak._pts.length,2);assert.equal(p._waveTrail._pts.length,2);
  l.logicState._teleport({raw:{51:'4'},uid:-1},p);
  assert.equal(p._streak._pts.length,0);assert.equal(p._waveTrail._pts.length,0);
  assert.equal(p._streak._active,true);assert.equal(p._waveTrail._active,true);
 }finally{scene._player=saved.player;scene._playerWorldX=saved.x;}
});

test('Sequence trigger supports counted entries, stop/loop/hold-last, minimum intervals and checkpoint reset',()=>{
 const l=fixture(['1,3607,2,0,3,0,435,10.2.11.1,436,1']),logic=l.logicState;
 const trig=l._logicTriggers.find(t=>t.id===3607),calls=[];
 l._activateSpawnedGroup=group=>calls.push(group);
 for(let i=0;i<5;i++){l._spawnClock=i;logic.trigger(trig);}
 assert.deepEqual(calls,[10,10,11,10,10]);
 const saved=logic.capture();logic.trigger(trig);logic.restore(saved);logic.trigger(trig);
 assert.deepEqual(calls.slice(-2),[11,11]);
 logic.reset();calls.length=0;trig.raw[436]='0';
 for(let i=0;i<5;i++)logic.trigger(trig);assert.deepEqual(calls,[10,10,11]);
 logic.reset();calls.length=0;trig.raw[436]='2';
 for(let i=0;i<5;i++)logic.trigger(trig);assert.deepEqual(calls,[10,10,11,11,11]);
 logic.reset();calls.length=0;Object.assign(trig.raw,{436:'1',437:'1',438:'3',439:'0'});
 for(const t of [0,.5,1,1.5,5]){l._spawnClock=t;logic.trigger(trig);}
 assert.deepEqual(calls,[10,10,10]);
});

test('keyframe node spawns fire once, can start another animation, and delayed spawns survive the path end',()=>{
 const l=fixture(['1,3032,2,100,3,100,373,1,374,0,57,8,10,0.05',
  '1,3032,2,130,3,100,373,1,374,1,71,7,557,0.1', '1,3033,2,0,3,0,51,5,76,8,520,1,521,1,545,1,522,1,523,1,546,1',
  '1,3809,2,100,3,100,57,5','1,1049,2,0,3,0,57,7,62,1,51,9,56,1']);
 l._groupEnabled[9]=false;l.checkKeyframeTriggers(0);l.keyframeState.step(.05);
 assert.equal(l.keyframeState.active.length,0);assert.equal(l._groupEnabled[9],false);
 l.stepSpawnTriggers(.1,scene._colorManager);assert.equal(l._groupEnabled[9],true);
 l._groupEnabled[9]=false;l.keyframeState.step(.1);l.stepSpawnTriggers(.2,scene._colorManager);
 assert.equal(l._groupEnabled[9],false,'completed node does not spawn twice');
});

test('native UFO/ship integration uses fixed flight gravity, mini divisor and classic falling thresholds',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);p._scene={};p._gameLayer={};
 for(const [mode,mini,start,want] of [
  ['ufo',false,14,13.742],['ufo',true,13.6,13.296],['ufo',false,0,-.172],['ufo',true,0,-.202],
  ['ship',false,14,13.794],['ship',false,0,-.138],['ship',true,0,-.162]]) {
  p.p=new context.testAPI.PlayerState();p.p.isMini=mini;p.p.isUfo=mode==='ufo';p.p.isFlying=mode==='ship';p.p.yVelocity=start;
  if(mode==='ufo')p._updateUfoJump(.225);else p._updateFlyJump(.225);
  p.applyObjectForces(.225);near(p.p.yVelocity,want);
 }
});

test('native ship release selects rising gravity after the boost branch and reverses an opposite boost',()=>{
 const p=Object.create(context.testAPI.PlayerObject.prototype);p._scene={};p._gameLayer={};
 for(const flipped of [false,true])for(const [held,start,want] of [
  [false,20,19.794],[false,-20,-19.828],[true,20,19.862],[true,-20,-19.784]]) {
  p.p=new context.testAPI.PlayerState();Object.assign(p.p,{isFlying:true,boostLatch:true,
   upKeyDown:held,gravityFlipped:flipped,yVelocity:flipped?-start:start});
  p._updateFlyJump(.225);p.applyObjectForces(.225);
  near(p.p.yVelocity,flipped?-want:want);
 }
});

test('a keyframe node starts and advances its chained path during the same command update',()=>{
 const l=fixture(['1,1,2,100,3,100,57,1','1,1,2,200,3,100,57,2',
  '1,3032,2,1000,3,1000,373,1,374,0,57,8,10,0.05',
  '1,3032,2,1010,3,1000,373,1,374,1,71,7',
  '1,3032,2,2000,3,1000,373,2,374,0,57,9,51,2,10,0.1',
  '1,3032,2,2020,3,1000,373,2,374,1,51,2',
  '1,3033,2,0,3,0,51,1,76,8,520,1,521,1,545,1,522,1,523,1,546,1', '1,3033,2,0,3,0,51,2,76,9,57,7,62,1,520,1,521,1,545,1,522,1,523,1,546,1']);
 l.checkKeyframeTriggers(0);l.keyframeState.step(.05);
 near(l.gdObjects[0].offX,10);near(l.gdObjects[1].offX,10);
 assert.equal(l.keyframeState.active.length,1);
 near(l.keyframeState.active[0].time,.05);
 l.keyframeState.step(.05);near(l.gdObjects[1].offX,20);
 assert.equal(l.keyframeState.active.length,0);
});

test('P2 follow targets keep P2 coordinates after dual mode ends instead of switching to P1',()=>{
 const saved={dual:scene._isDual,x:scene._playerWorldX,state2:scene._state2,x2:scene._secondaryWorldX};
 try {
  scene._isDual=false;scene._playerWorldX=200;scene._state2={y:1200};scene._secondaryWorldX=9000;
  const l=fixture(['1,1,2,100,3,100,57,1','1,3016,2,0,51,1,200,1']);
  l.checkAreaTriggers(0);l.advFollowState.step(1/240);
  near(l.gdRenderer.livePosition(l.gdObjects[0],{}).x,4500);
  near(l.gdRenderer.livePosition(l.gdObjects[0],{}).y,600);
  scene._playerWorldX=18000;l.advFollowState.step(1/240);
  near(l.objects[0].x,9000);near(l.objects[0].y,1200);
  assert.equal(l._moveTargetEnds({targetGroup:1,targetP2:true}).target,'p2');
 } finally {scene._isDual=saved.dual;scene._playerWorldX=saved.x;scene._state2=saved.state2;scene._secondaryWorldX=saved.x2;}
});

test('Spawn remapping isolates reused commands and survives delays, ordering and checkpoints',()=>{
 const l=fixture(['1,1,2,100,3,100,57,20','1,1,2,200,3,100,57,30',
  '1,1268,2,0,51,7,442,1.20', '1,1268,2,0,51,7,442,1.30',
  '1,901,2,0,57,7,62,1,87,1,51,1,28,10',
  '1,1049,2,0,57,7,62,1,87,1,51,1']);
 l.checkSpawnTriggers(0);l.stepSpawnTriggers(1/240,scene._colorManager);l.stepMoveTriggers(1/240);
 near(l.gdObjects[0].offX,10);near(l.gdObjects[1].offX,10);
 assert.equal(l._groupEnabled[20],false);assert.equal(l._groupEnabled[30],false);
 assert.equal(l._groupEnabled[1],undefined);
 assert.equal(l._moveTriggers[0].targetGroup,1,'saved command remains reusable');
 const d=fixture(['1,1268,2,0,51,7,442,1.20,441,1',
  '1,1268,2,0,57,7,62,1,51,8,63,0.1,442,2.1',
  '1,1049,2,31.158,57,7,62,1,51,1',
  '1,1049,2,0,57,8,62,1,51,2']);
 d.checkSpawnTriggers(0);d.stepSpawnTriggers(.01,scene._colorManager);
 const saved=d.captureRuntimeState(scene._colorManager);
 d.stepSpawnTriggers(.11,scene._colorManager);
 assert.equal(d._groupEnabled[20],false);assert.equal(d._groupEnabled[1],undefined);assert.equal(d._groupEnabled[2],undefined);
 d.restoreRuntimeState(saved,scene._colorManager);assert.equal(d._groupEnabled[20],undefined);
 d.stepSpawnTriggers(.11,scene._colorManager);assert.equal(d._groupEnabled[20],false);
});

test('Fix Gravity Bug selects the native inverted flight threshold without changing legacy P2',()=>{
 const saved=context.settingsMap;context.settingsMap={kA32:'0'};
 try {
  const p=Object.create(context.testAPI.PlayerObject.prototype),p2=Object.create(context.testAPI.PlayerObject.prototype);
  const sc={_player:p,_player2:p2};p._scene=p2._scene=sc;p._gameLayer=p2._gameLayer={};
  p.p=new context.testAPI.PlayerState();p2.p=new context.testAPI.PlayerState();
  p.p.isUfo=true;p.p.gravityFlipped=true;p.p.yVelocity=-2;
  assert.equal(p._nativeFlightFalling(),false);
  context.settingsMap.kA32='1';assert.equal(p._nativeFlightFalling(),true);
  p.p.yVelocity=-6;assert.equal(p._nativeFlightFalling(),false);
  // playerIsFalling (4f86d0): an upright body in dual mode falls below -2g.
  sc._isDual=true;
  context.settingsMap.kA32='0';p2.p.yVelocity=0;assert.equal(p2._nativeFlightFalling(),false);
  context.settingsMap.kA32='1';assert.equal(p2._nativeFlightFalling(),true);
 } finally {context.settingsMap=saved;}
});

test('a dynamic target Move with duration -1 follows indefinitely until a Stop',()=>{
 const l=fixture(['1,1,2,100,3,100,57,1','1,1764,2,300,3,100,57,2',
  '1,901,2,0,51,1,71,2,100,1,397,1,10,-1']);
 l.checkMoveTriggers(0);l.stepMoveTriggers(0); l.stepMoveTriggers(1/240);
 near(l.gdRenderer.livePosition(l.gdObjects[0]).x,300);assert.equal(l._activeMoveTweens.length,1);
 l._translateGroup(2,40,-60);l.stepMoveTriggers(.5);
 near(l.gdRenderer.livePosition(l.gdObjects[0]).x,320);near(l.gdRenderer.livePosition(l.gdObjects[0]).y,130);
 const saved=l.captureRuntimeState();l.stepMoveTriggers(20);assert.equal(l._activeMoveTweens.length,1);
 l.restoreRuntimeState(saved);l._translateGroup(2,20,0);l.stepMoveTriggers(.5);
 near(l.gdRenderer.livePosition(l.gdObjects[0]).x,330);
 l._applyStopTrigger({targetGroup:1});assert.equal(l._activeMoveTweens.length,0);
});

test('keyframe translation follows the enclosing rotation at a moving member pivot',()=>{
 const l=fixture(['1,1,2,200,3,1000,57,294',
  '1,3806,2,100,3,1000,57,293.294,274,293',
  '1,1346,2,0,51,294,71,293,68,90,10,1',
  '1,3032,2,100,3,1000,373,7,374,0,57,8,10,1,379,2,378,1',
  '1,3032,2,200,3,1000,373,7,374,1,375,1',
  '1,3033,2,10,51,293,71,293,76,8,520,1,521,1,545,1,522,1,523,1,546,1']);
 for(let tick=1;tick<=280;tick++) {
  const x=tick*311.5801086425781/240*2;
  l.checkKeyframeTriggers(x);l.checkRotateTriggers(x);
  l.stepRotateTriggers(1/240);l.keyframeState.step(1/240);
 }
 const obj=l.gdRenderer.livePosition(l.gdObjects[0]),pivot=l.gdRenderer.livePosition(l.gdObjects[1]);
 // Native disposable GD fixture: (160.5378, 933.2890) and
 // (160.5381, 933.2894), with native +90 Y removed.
 assert.ok(Math.abs(pivot.x-160.5381)<1.2);assert.ok(Math.abs(pivot.y-933.2894)<1.2);
 assert.ok(Math.hypot(obj.x-pivot.x,obj.y-pivot.y)<.01);
 near(l.objects[0].x,obj.x*2,.01);near(l.objects[0].y,obj.y*2,.01);
});

test('pad facing follows saved X rotation axes and subsequent group rotations',()=>{
 const l=fixture(['1,3005,2,100,3,100,131,180,132,-180',
  '1,3005,2,200,3,100,131,180,132,-180,5,1']);
 const p=Object.create(context.testAPI.PlayerObject.prototype);p._scene={};p._gameLayer=l;
 assert.equal(p._padFacesDown(l.objects[0]),true);assert.equal(p._padFacesDown(l.objects[1]),false);
 l.objects[0].rotationDegrees=180;assert.equal(p._padFacesDown(l.objects[0]),false);
});

test('absent keyframe modifiers are zero and independent position/transform tracks do not double each other',()=>{
 const l=fixture(['1,1,2,100,3,100,57,1',
  '1,3032,2,1000,3,1000,373,1,374,0,57,8,10,1',
  '1,3032,2,1010,3,1020,373,1,374,1,6,90,128,2,129,3',
  '1,'+'3033,2,0,51,1,71,1,76,8,520,1,522,1,523,1,546,1',
  '1,'+'3033,2,0,51,1,76,8,520,1,521,1,545,1']);
 l.checkKeyframeTriggers(0);assert.equal(l.keyframeState.active[0].mod.x,0);assert.equal(l.keyframeState.active[1].mod.rot,0);
 l.keyframeState.step(1);
 const o=l.gdObjects[0];near(o.rotOff,90);near(Math.hypot(o.affine[0],o.affine[1]),2);near(Math.hypot(o.affine[2],o.affine[3]),3);
 // The native split-track fixture moves (10,20) once; its keyframe
 // art rotation and scale do not rotate the independent position track.
 near(o.offX,10);near(o.offY,20);
 const zero=fixture(['1,1,2,100,3,100,57,1',
  '1,3032,2,0,373,1,374,0,57,8,10,1','1,3032,2,100,373,1,374,1,6,90',
  '1,'+'3033,2,0,51,1,76,8']);
 zero.checkKeyframeTriggers(0);zero.keyframeState.step(1);
 near(zero.gdObjects[0].offX,0);near(zero.gdObjects[0].rotOff,0);
});

test('unparented keyframe positions stay in world space after an external scale or rotation',()=>{
 for(const command of ['1,2067,2,0,51,1,71,1,150,2,151,3','1,1346,2,0,51,1,71,1,68,90']) {
  const l=fixture(['1,1,2,100,3,1000,57,1,274,1',command,
   '1,3032,2,1000,3,1000,373,7,374,0,57,8,10,1',
   '1,3032,2,1010,3,1020,373,7,374,1',
   '1,3033,2,0,51,1,76,8,520,1,521,1,545,1']);
  l.checkScaleTriggers(0);l.stepScaleTriggers(0);l.checkRotateTriggers(0);l.stepRotateTriggers(0);
  l.checkKeyframeTriggers(0);l.keyframeState.step(1);
  const p=l.gdRenderer.livePosition(l.gdObjects[0],{});
  // Both original GD fixtures end at (110,1110), including native +90 Y.
  near(p.x,110);near(p.y,1020);
 }
});

test('fresh shock waves initialize immediately and keep Max Size separate from Max Distance',()=>{
 const l=fixture([]),s=l.shaderState;
 s.trigger({id:2905,raw:{176:'100000',177:'7.952',179:'1',180:'3.141',191:'1',10:'.5'}});
 let u=s.uniforms();
 const k=Math.sqrt(960*960+640*640)/960*480/569;
 near(u._shockWaveStrength,10000*k);near(u._shockWaveMaxSize,k);near(u._shockWaveMaxDistVal,0);
 near(u._shockWaveTime2,Math.pow(.7952,2)*k);
 s.trigger({id:2905,raw:{176:'100000',177:'9.405',179:'1',180:'3.141',191:'1',512:'2',513:'1',10:'1'}});
 s.step(.5);u=s.uniforms();
 near(u._shockWaveStrength,10000*k);near(u._shockWaveMaxSize,k);near(u._shockWaveMaxDistVal,2/k);
});

test('collision sections use native 100-point cells and retain only explicitly extended ramp ends', () => {
  const l=fixture(['1,1744,2,115192,3,100,128,8,129,8']);
  const ramp=l.objects.find(o=>o.type==='slope');
  assert.ok(ramp);
  assert.ok(l.getNearbySectionObjects(230599).includes(ramp));
  assert.ok(!l.getNearbySectionObjects(230600).includes(ramp));
  ramp.extendedCollision=true;l._refreshCollisionSection(ramp);
  assert.ok(l.getNearbySectionObjects(230600).includes(ramp));
});

test('collision queries visit native Y cells before creation IDs and keep that order after reinsertion',()=>{
 // The Y cell multiplier is zero unless the level is platformer (kA22) or
 // uses dynamic height (kA37) (Steam 344d58..344d7f): ordinary levels query
 // every height of the three X cells.
 const plain=fixture(['1,1,2,100,3,2000,129,200']);
 assert.equal(plain.getNearbySectionObjects(200,200).includes(plain.objects[0]),true);
 const rows=l=>{l._collisionRowsEnabled=true;for(const o of l.objects){l._removeCollisionFromSections(o);l._addCollisionToSection(o);}return l;};
 const l=rows(fixture(['1,1748,2,8956,3,721','1,35,2,8938.45,3,694.411','1,1,2,8950,3,730']));
 const slope=l.objects.find(o=>o.type==='slope'),pad=l.objects.find(o=>o.type==='jump_pad'),block=l.objects.find(o=>o.type==='solid');
 assert.deepEqual(Array.from(l.getNearbySectionObjects(17840,1440)),[pad,slope,block]);
 l._removeCollisionFromSections(slope);l._addCollisionToSection(slope);
 assert.deepEqual(Array.from(l.getNearbySectionObjects(17840,1440)),[pad,slope,block]);
 const tall=rows(fixture(['1,1,2,100,3,2000,129,200'])),o=tall.objects[0];
 assert.equal(tall.getNearbySectionObjects(200,200).includes(o),false);
 assert.equal(tall.getNearbySectionObjects(200).includes(o),true,'spider rays can still query all heights');
 o.extendedCollision=true;tall._refreshCollisionSection(o);
 assert.equal(tall.getNearbySectionObjects(200,200).filter(x=>x===o).length,1);
});

test('camera Convert normalizes both endpoints and Add retains the command destination', () => {
  const c = fixture([]).cameraState;
  c.values.rotation = c.targetRotation = 360;
  c.trigger({id:2015,raw:{68:'-4',394:'1',10:'1'}});
  near(c.values.rotation,0); near(c.tweens[0].from,0); near(c.tweens[0].target,-4);
  c.step(1);
  c.trigger({id:2015,raw:{10:'1'}});
  near(c.tweens[0].from,-4); near(c.tweens[0].target,0);
  c.step(1);
  c.trigger({id:2015,raw:{68:'90',10:'1'}});c.step(.5);
  near(c.values.rotation,45);
  c.trigger({id:2015,raw:{68:'90',70:'1',10:'1'}});
  near(c.tweens[0].target,180);
  const saved=c.capture();c.reset();c.restore(saved);
  c.trigger({id:2015,raw:{68:'90',70:'1',10:'1'}});near(c.tweens[0].target,270);
});

test('Start Position settles the complete ground band without changing later portal transitions', () => {
  const l=fixture([]);l.setFlyMode(true,600,600);
  assert.equal(l._groundAnimating,true);
  l.settleStartGround();near(l._groundTargetValue,1);
  assert.equal(l._groundAnimating,false);assert.equal(l._bandMove,null);
  l.setFlyMode(false,600,600);assert.equal(l._groundAnimating,true);
});

test('pixel pickups float by the native three-point EaseInOut path and retain fixed colliders', () => {
  const l=fixture(['1,4506,2,100,3,100,64,1','1,4506,2,200,3,100,64,1,116,1'],
    r=>r.frames.get=()=>({slot:0,w:11,h:14,cw:11,ch:14,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1}));
  const r=l.gdRenderer;r.colorManager=scene._colorManager;r.setCamera(0,0,1000,400);
  const o=l.gdObjects[0],fixed=l.gdObjects[1],col=l.objects.find(c=>c.coinId===4506);
  r.legacyPrepare=true;
  assert.ok(o.ambientParticleSystem);assert.equal(fixed.ambientParticleSystem,undefined);
  near(o.ambientParticleSystem.offsetY,-5);
  for(const [time,y] of [[0,100],[.3,98.5],[.6,97],[.9,98.5],[1.2,100]]) {
    r.time=time;r.update(0);near(o._objectMatrix[5],y,1e-5);
    near(fixed._objectMatrix[5],100);near(col.y,200);
  }
});

test('portals use original radius emitters and native spider colours instead of guessed particles', () => {
  const l=fixture(['1,1331,2,100,3,100,64,1','1,13,2,200,3,100,64,1'],
    r=>r.frames.get=()=>({slot:0,w:30,h:80,cw:30,ch:80,ox:0,oy:0,u0:0,v0:0,u1:1,v1:1}));
  const spider=l.gdObjects[0].ambientParticleSystem,ship=l.gdObjects[1].ambientParticleSystem;
  near(spider.data.StartColorR,200/255);near(spider.data.StartColorB,1);
  near(spider.offsetX,-5);near(spider.data.TotalParticles,30);
  near(ship.data.StartColorA,.5);near(ship.data.StartRadius,40);
  near(ship.data.Life,.6000000238418579);
});

test('wave debug rectangles use native 10/6-point bodies and Eclipse inner fractions without facing mirroring',()=>{
 const l=fixture([]),ps=new context.testAPI.PlayerState(),sc={_state:ps,_playerWorldX:300,_getMirrorVisualScale:()=>1};
 const p=Object.create(context.testAPI.PlayerObject.prototype);Object.assign(p,{p:ps,_scene:sc,_gameLayer:l,_rotation:0,_hitboxTrail:[]});sc._player=p;
 let color,path;const boxes=[],g={clear(){boxes.length=0;},lineStyle(w,c){color=c;},fillStyle(){},fillPath(){},fillCircle(){},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},closePath(){},strokePath(){boxes.push({color,path});},strokeCircle(){}};
 ps.isWave=true;ps.isGoingLeft=true;
 for(const mini of [false,true]){ps.isMini=mini;p.drawHitboxes(g,100,0);
  const red=boxes.find(x=>x.color===0xff0000).path,green=boxes.find(x=>x.color===0x00ff00).path;
  const width=a=>Math.max(...a.map(p=>p[0]))-Math.min(...a.map(p=>p[0]));
  near(width(red),mini?12:20);near(width(green),mini?4.8:5);near(red.reduce((n,p)=>n+p[0],0)/4,200);
 }
});
test('saved slope bounds and direction match native signed scales, flips and quarter turns',()=>{
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-slope-bounds.json'),'utf8'));
  for(const n of rows){
    const l=fixture([`1,289,2,100,3,100,4,${n.fx},5,${n.fy},6,${n.rot},128,${n.sx},129,${n.sy}`]);
    const c=l.objects[0];near(c.w,n.w);near(c.h,n.h);
    near(c.x-200,n.dx);near(c.y-200,n.dy);assert.equal(c.slopeType,n.type);
  }
});

test('Start Pos camera settling consumes entry tweens before the first displayed frame',()=>{
  const c=fixture([]).cameraState;
  c.trigger({id:2015,raw:{68:'90',10:'2'}});c.trigger({id:1913,raw:{371:'.7',10:'1'}});
  c.settleStart();near(c.values.rotation,90);near(c.values.zoom,.7);assert.equal(c.tweens.length,0);
  c.trigger({id:2015,raw:{68:'0',10:'1'}});c.step(.5);near(c.values.rotation,45);
});
test('Start Pos Reset Camera clears static locks, offsets, edges and rotation while retaining zoom and free mode',()=>{
 const l=fixture(['1,1764,2,100,3,200,57,1']),c=l.cameraState;
 c.freeMode=true;c.trigger({id:1913,raw:{371:'.6',10:'2'}});
 c.trigger({id:1914,raw:{71:'1',10:'1'}});c.trigger({id:1916,raw:{28:'30',29:'-40',10:'3'}});
 c.trigger({id:2015,raw:{68:'90',10:'2'}});c.trigger({id:2062,raw:{164:'4',51:'1'}});
 c.resetStartCamera();c.settleStart();
 assert.equal(c.targets.x,null);assert.equal(c.targets.y,null);assert.equal(Object.keys(c.edges).length,0);
 for(const key of ['rotation','offsetX','offsetY','staticX','staticY'])near(c.values[key],0);
 near(c.values.zoom,.6);assert.equal(c.freeMode,true);assert.equal(c.tweens.length,0);
});
test('Eclipse outlines hazardous and safe slopes in the configured solid colour and ordinary hazards in red',()=>{
 const l=fixture(['1,289,2,100,3,100','1,8,2,200,3,100']),ps=new context.testAPI.PlayerState(),sc={_state:ps,_playerWorldX:200,_getMirrorVisualScale:()=>1};
 const p=Object.create(context.testAPI.PlayerObject.prototype);Object.assign(p,{p:ps,_scene:sc,_gameLayer:l,_rotation:0,_hitboxTrail:[]});sc._player=p;
 const slope=l.objects.find(o=>o.type==='slope');assert.ok(slope);slope.slopeIsHazard=true;
 const colors=[];const g={clear(){},lineStyle(w,c){colors.push(c);},fillStyle(){},fillPath(){},fillCircle(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},strokePath(){},strokeCircle(){}};
 p.drawHitboxes(g,0,0);assert.equal(colors[0],0x0000ff);assert.equal(colors[1],0xff0000);
 context.GDHacks={state:{hitboxCustomColors:true,hitboxSolid:'#1248ab'}};colors.length=0;
 p.drawHitboxes(g,0,0);assert.equal(colors[0],0x1248ab);assert.equal(colors[1],0xff0000);delete context.GDHacks;
});
test('portal helpers match native trimmed-front positions rather than the untrimmed source rectangle',()=>{
  const r=new context.GDRenderer(scene);
  r.frames.get=name=>({slot:0,w:name==='portal_17_front_001.png'?33.5:23.5,h:84.5,cw:44.5,ch:84.5,ox:11,oy:0,u0:0,v0:0,u1:1,v1:1});
  r.addObject(parseObject('1,1331,2,100,3,100'));
  const tree=r.spriteTreeCache.get(context.GD_OBJECTS[1331]),helpers=tree[14].filter(n=>n.portalGuide);
  near(helpers[0][1],33.75);near(helpers[1][1],31.75);near(helpers[0][2],42.25);
});
test('Startpos song offset integrates the original level speed, independently of its temporary start speed',()=>{
 const l=fixture([]);l._baseSettingsMap={kA4:0};context.settingsMap={kA4:3};
 const expected=context.calculateGeometryDashSongOffsetForX(6000,0,[]);
 near(l.getSongOffsetForX(6000,{sourceObjects:[]}),expected);
 near(l.getSongOffsetForX(6000,{sourceObjects:[],startSpeedKey:3}),context.calculateGeometryDashSongOffsetForX(6000,3,[]));
});
test('native Free particle rotation changes emission angle without scaling its existing cloud',()=>{
 const r=new context.GDRenderer(scene);r.frames.get=()=>({slot:0,w:10,h:10,cw:10,ch:10,ox:0,oy:0});
 const o=r.addObject(parseObject('1,2065,2,270,3,90,6,60,128,1.587,129,7.933'));
 const ps=new context.GDParticleSystem(r,o,{PositionType:0,Angle:-90,Speed:6,Life:.5});ps.sample=v=>v;ps.spawn();
 near(ps.particles[0].vx,Math.cos(-150*Math.PI/180)*6);near(ps.particles[0].vy,Math.sin(-150*Math.PI/180)*6);
 assert.deepEqual(Array.from(ps.emitterPose().m),[1,0,0,1]);
});
test('animated colour layers retain their captured negative z order behind the bright main frame',()=>{
 const r=new context.GDRenderer(scene);
 r.frames.get=name=>name?.endsWith('_001.png')?{slot:0,w:10,h:10,cw:10,ch:10,ox:0,oy:0}:null;
 const o=r.addObject(parseObject('1,2047,2,100,3,100'));
 assert.equal(o.parts[0].detail,true);assert.equal(o.parts[1].detail,false);
});
test('pixel-sheet candle colour frames retain native scale instead of the half-resolution fire scale',()=>{
 const r=new context.GDRenderer(scene);
 r.frames.get=name=>name?.endsWith('_001.png')?{slot:0,w:5,h:9,cw:5,ch:9,ox:0,oy:0}:null;
 const candle=r.addObject(parseObject('1,2630,2,200,3,170'));
 for(const parts of [candle.parts,...candle.animation])for(const part of parts)near(part.matrix[0],1);
 const fire=r.addObject(parseObject('1,2047,2,300,3,170'));
 near(fire.parts.find(p=>p.detail).matrix[0],2);
});
test('negative saved solid and spike axes keep native zero extents and signed rectangle origins',()=>{
 const l=fixture(['1,1,2,50,3,15,128,-1,129,1,57,9','1,8,2,80,3,15,128,-1,129,1,57,9']);
 const solid=l.objects.find(o=>o.type==='solid'),spike=l.objects.find(o=>o.type==='hazard');
 near(solid.x,130);near(solid.y,30);near(solid.w,0);near(solid.h,60);
 near(spike.x,166);near(spike.y,30);near(spike.w,0);near(spike.h,24);
 l._translateGroup(9,100,20);near(solid.x,230);near(spike.x,266);
 l.resetMoveTriggers();near(solid.x,130);near(spike.x,166);near(solid.w,0);near(spike.w,0);
});
test('a reversing dual player does not reverse its partner when Reverse Sync is saved',()=>{
 const old={state:context.settingsMap,p1:scene._player,p2:scene._player2,dual:scene._isDual};
 try{context.settingsMap={kA42:'1'};scene._isDual=true;
  const primary={p:{isGoingLeft:false}},secondary={p:{isGoingLeft:false,isBall:false}};
  scene._player=primary;scene._player2=secondary;secondary._scene=scene;
  vm.runInContext('PlayerObject.prototype.reversePlayer',context).call(secondary);assert.equal(secondary.p.isGoingLeft,true);assert.equal(primary.p.isGoingLeft,false);
 }finally{context.settingsMap=old.state;scene._player=old.p1;scene._player2=old.p2;scene._isDual=old.dual;}
});
console.log(passes + ' regression tests passed.');
