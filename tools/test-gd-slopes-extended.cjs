// Browser integration checks. Requires Playwright and a running local server.
// node tools/test-gd-browser.cjs [http://127.0.0.1:8790/]
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { slopeMotion } = require('../work/codex-20261026c/slope-extended.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  ({ chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));
}
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'work/browser-qa');
fs.mkdirSync(output, { recursive: true });
async function main() {
  const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1320, height: 640 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    const url = new URL(process.argv[2] || 'http://127.0.0.1:8790/');
    url.searchParams.set('devraf', '1'); url.searchParams.set('build', '20261020-fidelity');
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.scene?.get('GameScene')?._level, null, { timeout: 120000 });
    const frameClock=await page.evaluate(()=>{
      const loop=window.scene.get('GameScene').game.loop;
      const probe=new loop.constructor(loop.game,{smoothStep:loop.smoothStep});
      probe.nextFpsUpdate=Infinity;
      const delivered=[];probe.callback=(_t,dt)=>delivered.push(dt);
      const elapsed=[1000/60,1000/60,80,1000/60,125,1000/60];
      let now=0;for(const dt of elapsed){now+=dt;probe.step(now);}
      return {smoothStep:loop.smoothStep,elapsed,delivered};
    });
    assert.equal(frameClock.smoothStep,false);
    assert.ok(frameClock.elapsed.every((dt,i)=>Math.abs(dt-frameClock.delivered[i])<1e-8),JSON.stringify(frameClock));
    console.log('PASS actual Phaser frame clock preserves 80/125 ms stutters instead of smoothing time away from the music');
    await page.mouse.click(655, 320); // Actual user gesture unlocks Web Audio.
    async function load(index, data = null, title = '') {
      await page.evaluate(({ index, data, title }) => {
        const s = window.scene.get('GameScene');
        window.__qaOld = s._level;
        window._onlineLevelId = data ? 'local_qa_fixture' : null;
        window._onlineLevelString = data;
        window.currentlevel = data ? ['stereo_madness', title, 'local_qa_fixture', ['Local', 'Test']] : window.allLevels[index];
        s.game.registry.set('autoStartGame', true); s.scene.restart();
      }, { index, data, title });
      await page.waitForFunction(() => window.scene.get('GameScene')._level !== window.__qaOld, null, {timeout:120000})
        .catch(async error => { console.error('LOAD FAILED', {index,title,errors,scene:await page.evaluate(()=>{const s=window.scene.get('GameScene');return {status:s.sys.settings.status,loading:s.load.isLoading(),paused:s._paused,slide:s._slideIn,level:window.currentlevel};})}); throw error; });
      await page.waitForFunction(() => !window.scene.get('GameScene')._level.gdRenderer?.objects.some(o => o.labelPending !== undefined));
      // A deterministic, synchronous frame sweep cannot decode audio in
      // between its ticks. Prepare it first, as real attempts now do.
      await page.evaluate(()=>window.scene.get('GameScene')._audio.startMusic());
      await page.waitForFunction(()=>!window.scene.get('GameScene')._audio.musicLoading,null,{timeout:30000});
      await page.evaluate(() => { window.noClip = true; window.scene.get('GameScene')._paused = true; });
    }
    async function sweep(allHeights = false) {
      return page.evaluate(allHeights => {
        const s = window.scene.get('GameScene'), r = s._level.gdRenderer;
        r.debugItems = true; // validate every draw record of the sweep
        const missing = r.objects.filter(o => !o.hidden && !o.particleSystem && o.parts.length === 0).map(o => o.id);
        let bad = 0, maxQuads = 0, samples = 0;
        const ys = allHeights ? [0, 560, 1120, 1680, 2240, 2800, 3360, 3920, 4480] : [0, 560, 1120];
        for (const y of ys) for (let x = -750; x < s._level.endXPos; x += 500) {
          r.setCamera(x, y); r.update(1 / 60); samples++;
          maxQuads = Math.max(maxQuads, r.quadCount);
          for (const b of r.buckets) for (const item of b)
            if (!item.m.every(Number.isFinite) || !Number.isFinite(item.opacity) || !item.color.every(Number.isFinite)) bad++;
        }
        r.debugItems = false;
        return { title: currentlevel[1], source: levelObjects.length, types: new Set(levelObjects.map(o => o.id)).size,
          renderObjects: r.objects.length, missing: [...new Set(missing)], bad, maxQuads, samples,
          missingChannels: [...new Set(r.objects.filter(o => !o.hidden && o.def.dc >= 0 && o.parts.length && !o.hasDetail).map(o => o.id))],
          particleSystems: r.particleSystems.length, animatedObjects: r.objects.filter(o => o.animation).length };
      }, allHeights);
    }
    await load(0, 'kA6,1,kA7,1;1,3029,2,10,3,0,533,3;1,3030,2,10,3,30,533,4;', 'Art trigger textures');
    const artTextures=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level;
      // Loading audio can take real frames; freeze the art test at its
      // authored initial state even if its x=10 triggers already ran.
      l.logicState.reset();
      l._logicTriggerIdx=0;
      const before=l.logicState.capture();
      const read=()=>({background:s._bg.displayTexture.key,ground:l._groundTiles[0].texture.key});
      const initial=read();l.checkLogicTriggers(100);const changed=read(),checkpoint=l.logicState.capture();
      l.logicState.restore(before);const previous=read();l.logicState.restore(checkpoint);const restored=read();
      l.logicState.reset();const restarted=read();return {initial,changed,previous,restored,restarted};
    });
    assert.ok(artTextures.changed.background.includes('game_bg_2'),JSON.stringify(artTextures));
    assert.equal(artTextures.changed.ground,'groundSquare_03_001.png');
    assert.deepEqual(artTextures.previous,artTextures.initial);assert.deepEqual(artTextures.restored,artTextures.changed);
    assert.deepEqual(artTextures.restarted,artTextures.initial);
    console.log('PASS original background/ground texture changes, checkpoint before/after and restart');
    const official = [];
    for (let i = 0; i < (process.env.GD_QA_FAST ? 0 : 22); i++) {
      await load(i);
      await page.evaluate(() => window.scene.get('GameScene')._audio.startMusic());
      await page.waitForFunction(() => window.scene.get('GameScene')._audio?._music?.isPlaying, {}, { timeout: 15000 });
      const audio = await page.evaluate(() => {
        const s = window.scene.get('GameScene'), buffer = s.cache.audio.get(currentlevel[0]);
        const samples = buffer.getChannelData(0); let peak = 0;
        for (let i = 0; i < Math.min(samples.length, 441000); i += 100) peak = Math.max(peak, Math.abs(samples[i]));
        return { playing: s._audio._music.isPlaying, duration: buffer.duration, peak, context: s.sound.context.state };
      });
      assert.ok(audio.playing && audio.peak > 0 && audio.context === 'running');
      const render = await sweep(); assert.deepEqual(render.missing, []); assert.deepEqual(render.missingChannels, []); assert.equal(render.bad, 0);
      const runtime = await page.evaluate(() => {
        const s = window.scene.get('GameScene'); s._paused = false;
        let frames = 0, invalid = false;
        for (; frames < 3000 && !s._levelWon; frames++) {
          s.update(frames * 1000 / 60, 1000 / 60);
          if (!Number.isFinite(s._playerWorldX) || !Number.isFinite(s._state.y)) { invalid = true; break; }
          if (s._state.isDead) break;
        }
        s._paused = true;
        return { frames, dead: s._state.isDead, invalid, x: s._playerWorldX, y: s._state.y, channel: s._level._gameplayChannel };
      });
      assert.equal(runtime.dead, false); assert.equal(runtime.invalid, false);
      official.push({ ...render, audio, runtime });
      console.log('PASS official ' + render.title);
    }
    const fixtures = [];
    for (const [name, title] of (process.env.GD_QA_FAST ? [] : [['every-object', 'Every object'], ['kocmoc', 'KOCMOC'], ['hyperluminal', 'Hyperluminal'], ['blackfire', 'Blackfire Backfire'], ['skeletal', 'Skeletal Shenanigans'], ['evolution', 'EVOLUTION'], ['ispy', 'iSpyWithMyLittleEye'], ['aperture', 'Aperture auto'], ['what', 'WHAT']])) {
      const file = path.join(root, 'work/fixtures', name + '.txt');
      if (!fs.existsSync(file)) continue;
      await load(0, fs.readFileSync(file, 'utf8'), title);
      const result = await sweep(true);
      assert.deepEqual(result.missing, []); assert.deepEqual(result.missingChannels, []); assert.equal(result.bad, 0);
      fixtures.push(result); console.log('PASS fixture ' + title);
      if (name === 'kocmoc') {
        const effect = await page.evaluate(async () => {
          const l = window.scene.get('GameScene')._level;
          l.checkShaderTriggers(3000); l.shaderState.step(0.1);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          return { triggers: l._shaderTriggers.length, pipeline: !!l.shaderState.pipeline, glError: l._scene.game.renderer.gl.getError() };
        });
        assert.ok(effect.pipeline); assert.equal(effect.glError, 0); result.shader = effect;
      }
    }
    const noclip = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level, p = s._player;
      const original = l.getNearbySectionObjects, floor = l.getFloorY, ceiling = l.getCeilingY;
      const savedState = { ...p.p };
      let contacts = 0, blocked = 0; const failed = [];
      l.getFloorY = () => -10000; l.getCeilingY = () => 10000;
      window.noClip = true; p.p.isFlying = false; p.p.isWave = true;
      for (const id of Object.keys(GD_OBJECTS).filter(id => GD_OBJECTS[id].t === 25)) {
        for (const rot of [0, 90, 180, 270]) for (const mini of [false, true]) {
          const source = parseObject(`1,${id},2,100,3,100,6,${rot}`);
          const c = _createSlopeCollider(source, allObjects[id], 200, 200);
          if (!c) continue;
          l.getNearbySectionObjects = () => [c];
          Object.assign(p.p, { isDead: false, diedThisFrame: false, isMini: mini, y: 200, lastY: 200 });
          p._lastCollisionWorldX = 200; p._lastCollisionWorldY = 200; s._playerWorldX = 200;
          p.checkCollisions(200 - centerX); contacts++;
          if (p.p.diedThisFrame) blocked++;
          if (p.p.isDead || !Number.isFinite(p.p.y)) failed.push({ id, rot, mini });
        }
      }
      l.getNearbySectionObjects = original; l.getFloorY = floor; l.getCeilingY = ceiling;
      Object.assign(p.p, savedState);
      return { contacts, blocked, failed };
    });
    assert.deepEqual(noclip.failed, []); assert.ok(noclip.contacts > 0 && noclip.blocked > 0);
    console.log('PASS wave noclip ' + noclip.contacts + ' slope contacts');
    const orbs = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level, p = s._player;
      const original = l.getNearbySectionObjects, center = l.gdRenderer.groupCenter;
      const results = [];
      for (const id of [36, 141, 84, 1022, 1330, 1333, 1594, 1704, 1751, 3004, 3027]) {
        Object.assign(p.p, { isWave: false, isFlying: false, isBall: false, isUfo: false, isSpider: false, isRobot: false,
          isSwing: false, isMini: false, isDead: false, isDashing: false, gravityFlipped: false, y: 200, lastY: 200,
          yVelocity: 0, onGround: false, upKeyDown: true, upKeyPressed: true, queuedHold: true, wasUpKeyDown: false,
          _orbActivationConsumedForPress: false });
        s._playerWorldX = 200;
        const orb = new Collider(jumpRingType, 200, 200, 72, 72);
        Object.assign(orb, { orbId: id, orbRotation: 0, _eeObjectId: 0, _eeLevelObject: { _raw: { 51: '99', 56: '1' } } });
        const block = new Collider(solidType, 200, 600, 60, 60);
        l.getNearbySectionObjects = () => [orb, block]; l.gdRenderer.groupCenter = () => ({ x: 500, y: 300 });
        p._lastCollisionWorldX = 200; p._lastCollisionWorldY = 200;
        p.checkCollisions(200 - centerX);
        results.push({ id, activated: p._isObjectActivated(orb), velocity: p.p.yVelocity, gravity: p.p.gravityFlipped,
          x: s._playerWorldX, y: p.p.y, dash: p.p.isDashing, dead: p.p.isDead });
      }
      l.getNearbySectionObjects = original; l.gdRenderer.groupCenter = center;
      return results;
    });
    assert.ok(orbs.every(o => o.activated && !o.dead && Number.isFinite(o.velocity)));
    assert.equal(orbs.find(o => o.id === 1594).gravity, false);
    assert.equal(orbs.find(o => o.id === 3004).y, 540);
    assert.equal(orbs.find(o => o.id === 3027).x, 1000);
    assert.equal(orbs.find(o => o.id === 3027).y, 600);
    console.log('PASS activation of all 11 orb variants');
    await load(0);
    const rotatedPhysics = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level, p = s._player;
      const original = l.getNearbySectionObjects, floor = l.getFloorY, ceiling = l.getCeilingY;
      const cases = [];
      window.noClip = false; s._isDual = false;
      l.getFloorY = () => -Infinity; l.getCeilingY = () => null;
      for (const angle of [0, 90, 180, 270]) for (const flipY of [false, true])
        for (const mini of [false, true]) for (const gravity of [false, true]) {
          Object.assign(p.p, new PlayerState());
          p.p.isMini = mini; p.p.gravityFlipped = gravity; p.p.onGround = false; p.p.canJump = false;
          const theta = -angle * Math.PI / 180;
          const u = { x: Math.cos(theta), y: Math.sin(theta) };
          const vertical = angle === 90 || angle === 270;
          const v = vertical ? { x: 1, y: 0 } : { x: 0, y: 1 };
          const size = (mini ? 18 : 30) * (gravity ? -1 : 1);
          s._playerWorldX = v.x * size; p.p.y = p.p.lastY = v.y * size;
          p._lastCollisionWorldX = s._playerWorldX; p._lastCollisionWorldY = p.p.y;
          const wall = new Collider(solidType, u.x * 500 - v.x * Math.sign(size) * 30,
            u.y * 500 - v.y * Math.sign(size) * 30, Math.abs(u.x) > 0.5 ? 1000 : 60, Math.abs(u.y) > 0.5 ? 1000 : 60);
          l.getNearbySectionObjects = () => [wall]; l.gameplayState.reset();
          l.gameplayState.trigger({ raw: { 6: String(angle), 5: flipY ? '1' : '0',
            166: String(vertical ? (gravity ? 4 : 3) : (gravity ? 1 : 2)),
            167: String({ 0: 4, 90: 2, 180: 3, 270: 1 }[angle]), 169: '1', 583: '0' } });
          let deviation = 0;
          for (let tick = 0; tick < 120; tick++) {
            const leave = l.gameplayState.enterPhysics();
            try {
              p.p.lastY = p.p.y; p.updateJump(0.25); p.p.y += p.p.yVelocity * 0.25;
              p.checkCollisions(s._playerWorldX - centerX); s._playerWorldX += 2.5;
            } finally { leave?.(); }
            deviation = Math.max(deviation, Math.abs(s._playerWorldX * v.x + p.p.y * v.y - size));
          }
          cases.push({ angle, flipY, mini, gravity, deviation, dead: p.p.isDead,
            progress: s._playerWorldX * u.x + p.p.y * u.y });
        }
      l.getNearbySectionObjects = original; l.getFloorY = floor; l.getCeilingY = ceiling;
      l.gameplayState.reset(); window.noClip = true;
      return cases;
    });
    assert.ok(rotatedPhysics.every(c => !c.dead && c.deviation < 1e-6 && c.progress > 290));
    console.log('PASS rotated cube collision ' + rotatedPhysics.length + ' floor/wall/ceiling cases');
    const slopeTravel = await page.evaluate(slopeMotion);
    assert.ok(slopeTravel.every(c => !c.dead && c.drops === 0 && c.maxError < 1e-6), JSON.stringify(slopeTravel));
    console.log('PASS joined-ramp movement in ' + slopeTravel.length + ' ascending, descending and inverted cases');
    await load(0, 'kA4,0;1,291,2,300,3,200,57,1;1,1,2,2000,3,0;', 'Slope practice checkpoint');
    const slopeCheckpoint = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level, p = s._player, practice = s._practicedMode;
      const floor = l.getFloorY, ceiling = l.getCeilingY;
      l.getFloorY = () => -10000; l.getCeilingY = () => null;
      try {
        const col = l.objects.find(o => o.type === slopeType), angle = col.getSlopeAngleRad();
        Object.assign(p.p, new PlayerState()); p._resetSlopeState();
        s._playerWorldX = col.x; p.p.y = col.y + 30 / Math.cos(angle);
        Object.assign(p.p, { lastY: p.p.y, onGround: true, canJump: false });
        Object.assign(p, { _slopeRiding: true, _slopeContactFrames: 12, _prevSlopeObj: col,
          _activeSlopeObj: col, _prevSlopeAngle: angle, _activeSlopeAngle: angle,
          _slopeExitVel: Math.tan(angle) * playerSpeed * d,
          _lastCollisionWorldX: col.x, _lastCollisionWorldY: p.p.y });
        practice.practiceMode = true; practice.saveCheckpoint(p.p, s._playerWorldX, s._cameraX, s);
        const run = () => {
          const rows = [];
          for (let tick = 0; tick < 40; tick++) {
            p.p.lastY = p.p.y; p.updateJump(0.225);
            s._playerWorldX += playerSpeed * d * 0.25;
            p.p.y += p.p.yVelocity * 0.225; p.checkCollisions(s._playerWorldX - centerX);
            rows.push([s._playerWorldX, p.p.y, p.p.yVelocity, p._slopeRiding, p.p.isDead]);
          }
          return rows;
        };
        const before = run(), replays = [];
        for (let n = 0; n < 2; n++) { s._respawnFromCheckpoint(); replays.push(run()); }
        p.reset();
        return { before, replays, reset: !p._slopeRiding && p._slopeExitVel === null };
      } finally {
        l.getFloorY = floor; l.getCeilingY = ceiling;
        practice.clearCheckpoints(); practice.practiceMode = false;
      }
    });
    assert.equal(slopeCheckpoint.reset, true);
    assert.ok(slopeCheckpoint.before.some(row => !row[3] && row[2] > 0));
    assert.ok(slopeCheckpoint.before.every(row => !row[4]));
    for (const replay of slopeCheckpoint.replays) assert.deepEqual(replay, slopeCheckpoint.before);
    console.log('PASS actual practice respawns replay a slope exit identically twice; restart clears contact');
    const swing = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), p = s._player;
      Object.assign(p.p, new PlayerState()); p.p.y = 250;
      p.enterSwingMode({ y: 250, _eeLevelObject: { _raw: { 111: '1' } } });
      p.p.yVelocity = 0; p.p.upKeyDown = true; p.p.upKeyPressed = true;
      p.updateJump(0.25); const first = p.p.gravityFlipped;
      p.updateJump(0.25); const held = p.p.gravityFlipped;
      p.syncSprites(0, 0, 1 / 60, 200);
      const result = { first, held, free: s._level.cameraState.freeMode,
        frames: p._swingLayers.map(l => l.sprite.frame.name),
        colours: p._swingLayers.map(l => l.sprite.tintTopLeft),
        expected: [p._primaryColor(), p._secondaryColor(), 0xffffff],
        visible: p._swingLayers.every(l => l.sprite.visible),
        shipHidden: p._shipLayers.every(l => !l || !l.sprite.visible) };
      p.enterBallMode({ y: 250 }); result.exit = !p.p.isSwing && !p.p.isFlying && p.p.isBall;
      s._level.cameraState.reset(); return result;
    });
    assert.ok(!swing.first && swing.held && swing.free && swing.visible && swing.shipHidden && swing.exit);
    assert.deepEqual(swing.colours, swing.expected);
    console.log('PASS Swing defers a press by one physics tick, keeps original icon colours, Free Mode and mode exit');
    const dash = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level, p = s._player;
      const nearby = l.getNearbySectionObjects, input = s._applyJumpInput;
      s._applyJumpInput = () => {}; s._paused = false; s._slideIn = false; s._menuActive = false;
      const cases = [];
      for (const angle of [0, -90, 90, 180]) {
        Object.assign(p.p, new PlayerState()); p.p.y = p.p.lastY = 200;
        Object.assign(p.p, { onGround: false, canJump: false, upKeyDown: true, upKeyPressed: true, queuedHold: true });
        s._playerWorldX = 200; p._lastCollisionWorldX = p._lastCollisionWorldY = 200;
        const orb = new Collider(jumpRingType, 200, 200, 72, 72);
        Object.assign(orb, { orbId: 1704, orbRotation: angle, _eeObjectId: 0, _eeLevelObject: { _raw: {} } });
        l.getNearbySectionObjects = () => [orb]; p.checkCollisions(200 - centerX);
        s.update(0, 1000 / 60);
        cases.push({ angle, x: s._playerWorldX - 200, y: p.p.y - 200, active: p.p.isDashing });
      }
      l.getNearbySectionObjects = nearby; s._applyJumpInput = input; s._paused = true;
      return cases;
    });
    assert.ok(dash.every(c => c.active && Number.isFinite(c.x) && Number.isFinite(c.y)));
    assert.ok(dash.every(c => c.x > 0 && Math.abs(c.x - dash[0].x) < 1e-6));
    assert.ok(dash[1].y > 0 && dash[2].y < 0);
    // Four CCPoint float additions round X/Y separately; the line is exact
    // before those additions, and the rendered position is within float ULPs.
    assert.ok(Math.abs(dash[1].y / dash[1].x - 2.7474772930145264) < 1e-5);
    assert.ok(Math.abs(dash[3].y) < 1e-6);
    console.log('PASS native dash line keeps level speed and clamps its angle');
    await load(20);
    const collectible = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level, p = s._player;
      const coin = l.objects.find(c => c.coinId === 1614 && c._eeLevelObject.groups === '227');
      const nearby = l.getNearbySectionObjects;
      Object.assign(p.p, new PlayerState()); p.p.y = p.p.lastY = coin.y;
      s._playerWorldX = coin.x; p._lastCollisionWorldX = coin.x; p._lastCollisionWorldY = coin.y;
      window.noClip = false; l.getNearbySectionObjects = () => [coin];
      try { p.checkCollisions(coin.x - centerX); } finally { l.getNearbySectionObjects = nearby; window.noClip = true; }
      const visual = l.gdObjects[coin._eeObjectId];
      return { count: l._itemCounts.get(1), text: l._counterLabels[0].object.labelText,
        hidden: !visual.enabled, parts: visual.parts.length, frames: visual.animation.length };
    });
    assert.equal(collectible.count, 1); assert.equal(collectible.text, '1');
    assert.ok(collectible.hidden && collectible.parts === 3 && collectible.frames === 4);
    console.log('PASS Fingerdash small coin collection and native counter glyph');
    await load(21);
    const buttonSource = await page.evaluate(() => {
      const o = levelObjects.find(o => o.id === 1594 && o._raw[51] === '22');
      return Object.entries(o._raw).flat().join(',');
    });
    // Isolate the actual Dash button's saved settings from the surrounding
    // moving level geometry, then deliver a real browser pointer event.
    await load(0, 'kA4,0;' + buttonSource + ';1,1,2,3400,3,600,57,22;', 'Dash hidden button input');
    await page.evaluate(() => {
      const s = window.scene.get('GameScene'), p = s._player;
      const orb = s._level.objects.find(o => o.orbId === 1594);
      Object.assign(p.p, new PlayerState()); p.p.isSpider = true; p.p.y = p.p.lastY = orb.y;
      s._playerWorldX = orb.x; p._lastCollisionWorldX = orb.x; p._lastCollisionWorldY = orb.y;
      s._menuActive = false; s._slideIn = false; s._levelWon = false;
    });
    await page.mouse.down();
    const hiddenButton = await page.evaluate(() => {
      const s = window.scene.get('GameScene'); s._paused = false;
      s.update(0, 1000 / 60); s._paused = true;
      const orb = s._level.objects.find(o => o.orbId === 1594);
      return { activated: s._player._isObjectActivated(orb), enabled: s._level.gdRenderer.groupState.enabled(22),
        dead: s._state.isDead, hidden: orb._eeLevelObject.hidden };
    });
    await page.mouse.up();
    assert.ok(hiddenButton.activated && !hiddenButton.enabled && !hiddenButton.dead && hiddenButton.hidden);
    console.log('PASS actual Dash hidden button settings with a browser pointer press');
    await load(0, 'kA4,0;1,36,2,100,3,150;1,1,2,2000,3,0;', 'Ring pointer feedback');
    const ringBefore = await page.evaluate(() => {
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,r=l.gdRenderer,c=l.objects.find(o=>o.orbId===36);
      Object.assign(p.p,new PlayerState()); Object.assign(p.p,{y:c.y,lastY:c.y,onGround:false,canJump:false});
      s._playerWorldX=c.x;p._lastCollisionWorldX=c.x;p._lastCollisionWorldY=c.y;
      s._menuActive=false;s._slideIn=false;s._levelWon=false;s._levelSelectOverlay=null;window.noClip=false;
      s._paused=false;window.__ringUpdate=s.update;s.update=()=>{};
      window.__ringEffects=0;const effect=p._orbpadHitEffect;
      p._orbpadHitEffect=function(...args){window.__ringEffects++;return effect.apply(this,args);};
      p.checkCollisions(c.x-centerX);r.update(0);
      const o=l.gdObjects[c._eeObjectId];
      window.__ringScale=Math.hypot(o._objectMatrix[0],o._objectMatrix[1]);
      return {activated:p._isObjectActivated(c),effects:window.__ringEffects,scale:window.__ringScale};
    });
    await page.mouse.move(655,320);await page.mouse.down();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const ringPointer = await page.evaluate(() => {
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,r=l.gdRenderer,c=l.objects.find(o=>o.orbId===36);
      s.update=window.__ringUpdate;s._paused=false;s.update(0,1000/240);s._paused=true;
      const o=l.gdObjects[c._eeObjectId];r.time=o.ringHitTime+.08;r.update(0);
      const peak=Math.hypot(o._objectMatrix[0],o._objectMatrix[1]);
      r.time=o.ringHitTime+1;r.update(0);
      return {activated:p._isObjectActivated(c),effects:window.__ringEffects,peak,
        rest:Math.hypot(o._objectMatrix[0],o._objectMatrix[1]),velocity:p.p.yVelocity,dead:p.p.isDead};
    });
    await page.mouse.up();
    assert.ok(!ringBefore.activated && ringBefore.effects===0,JSON.stringify(ringBefore));
    assert.ok(ringPointer.activated && ringPointer.effects===1 && !ringPointer.dead && ringPointer.velocity>0,JSON.stringify(ringPointer));
    // The ambient audio meter can change between the pointer event's real
    // frames. Compare hit/rest at the same frozen meter, not the old frame.
    assert.ok(Math.abs(ringPointer.peak/ringPointer.rest-2)<1e-5,JSON.stringify({ringBefore,ringPointer}));
    console.log('PASS real pointer press activates the ring, produces one hit effect and animates its WebGL geometry');
    await load(0, fs.readFileSync(path.join(root,'work/fixtures/blackfire.txt'),'utf8'), 'Blackfire moving D platform');
    const blackfireStart = await page.evaluate(async () => {
      const s=window.scene.get('GameScene');s._restartLevel();s._slideIn=false;s._paused=true;s._menuActive=false;window.noClip=false;
      await s._audio.startMusic();s._waitingForLevelMusic=false;s._paused=false;
      for(let n=0;n<24;n++)s.update(n*1000/60,1000/60);
      s._paused=true;const l=s._level;l.cameraState.updateVisual();
      const mask=s.cameras.cameras.reduce((mask,c)=>mask|c.id,0);
      const hidden=l._groundTiles.every(o=>(o.cameraFilter&mask)===mask) && (l._groundLine.cameraFilter&mask)===mask;
      const hiddenAttempts=(s._attemptsLabel.cameraFilter&mask)===mask;
      l.logicState._options({161:'-1',532:'-1'});l.cameraState.updateVisual();
      return {y:s._state.y,dead:s._state.isDead,wave:s._state.isWave,dBlock:s._state.stateDartSlide,
        hidden,hiddenAttempts,shown:(l._groundLine.cameraFilter&mask)!==mask};
    });
    assert.ok(!blackfireStart.dead && blackfireStart.wave && blackfireStart.y>2150 && blackfireStart.dBlock>0,JSON.stringify(blackfireStart));
    assert.ok(blackfireStart.hidden && blackfireStart.hiddenAttempts && blackfireStart.shown,JSON.stringify(blackfireStart));
    console.log('PASS Blackfire spawn teleport, moving D platform and hide/show ground/attempts options');
    const waveLifetime = await page.evaluate(() => {
      const s=window.scene.get('GameScene'),trail=s._player._waveTrail;
      window.noClip=true;s._paused=false;
      for(let n=0;n<180;n++){s.update(n*1000/60,1000/60);s.sys.events.emit('postupdate',n*1000/60,1000/60);}
      s._paused=true;
      const left=s._player._cameraLeftX(s._playerWorldX);
      return {points:trail._pts.length,behind:trail._pts.slice(1).filter(p=>p.x<left-1).length,dead:s._state.isDead};
    });
    // HardStreak keeps a vertex per turn and clearBehindXPos drops what the camera has passed
    assert.ok(waveLifetime.points>=2&&waveLifetime.points<400&&waveLifetime.behind===0&&!waveLifetime.dead,JSON.stringify(waveLifetime));
    console.log('PASS actual Blackfire wave trail keeps only the geometry the camera has not passed');
    await load(0, fs.readFileSync(path.join(root,'work/fixtures/skeletal.txt'),'utf8'), 'Skeletal ordered spawn loop');
    const skeletalSpawn = await page.evaluate(() => {
      const s=window.scene.get('GameScene');s._restartLevel();s._slideIn=false;s._paused=false;s._menuActive=false;window.noClip=true;
      for(let n=0;n<240;n++)s.update(n*1000/60,1000/60);
      s._restartLevel();s._slideIn=false;s._paused=false;
      let maxRotation=0;
      for(let n=0;n<120;n++){
        s.update(n*1000/60,1000/60);
        maxRotation=Math.max(maxRotation,Math.abs(s._level.gdRenderer.groups.get(45)[0].rotOff));
      }
      s._paused=true;
      return {maxRotation,rotation:s._level.gdRenderer.groups.get(45)[0].rotOff,queue:s._level._activeSpawnDelays.length};
    });
    assert.ok(skeletalSpawn.maxRotation<=1.500001,JSON.stringify(skeletalSpawn));
    console.log('PASS Skeletal ordered spawn/Stop loop keeps scenery rotation within ±1.5 degrees');
    await load(21);
    const landingSources = await page.evaluate(() => [
      levelObjects.find(o => o.id === 2065 && o.x === 1065 && o._raw[57] === '62'),
      levelObjects.find(o => o.id === 1585 && o._raw[51] === '62')
    ].map(o => Object.entries(o._raw).flat().join(',')).join(';'));
    await load(0, 'kA4,0;' + landingSources + ';1,1,2,1065,3,135,128,6;1,1,2,1065,3,225,128,6;', 'Dash first spider landing');
    await page.evaluate(() => {
      const s = window.scene.get('GameScene'), p = s._player;
      p.enterSpiderMode(); Object.assign(p.p, { y: 330, lastY: 330, onGround: true, canJump: true, gravityFlipped: false });
      s._playerWorldX = 2130; p._lastCollisionWorldX = 2130; p._lastCollisionWorldY = 330;
      s._menuActive = false; s._slideIn = false; s._levelWon = false; window.noClip = false;
      s._levelSelectOverlay = null; // The fixture bypasses the menu's normal close path.
      window.__landingBefore = s._level.gdRenderer.particleSystems[0].particles.length;
      // Deliver a genuine unpaused pointer event while keeping the fixture
      // at the same position on slow CI machines. Step the original update
      // manually after Phaser has dispatched the input event.
      window.__landingUpdate = s.update; s.update = () => {};
      s._paused = false; // The game's pointerdown handler ignores paused input.
    });
    await page.mouse.move(655, 320);
    await page.mouse.down();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const spiderLanding = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), l = s._level;
      const before = window.__landingBefore;
      s.update = window.__landingUpdate;
      s._paused = false; s.update(0, 1000 / 60); s._paused = true; l._syncGDRenderer();
      const system = l.gdRenderer.particleSystems[0];
      return { before, after: system.particles.length, savedCount: system.data.TotalParticles,
        dead: s._state.isDead, ceiling: s._state.onCeiling, flipped: s._state.gravityFlipped,
        touched: l._touchAnimationTriggerActivated.size,
        y: s._state.y, x: s._playerWorldX, pointer: s.input.activePointer.isDown,
        input: s._state.upKeyDown, pressed: s._state.upKeyPressed, canJump: s._state.canJump,
        overlays: !!s._levelSelectOverlay, mode: s._state.isSpider };
    });
    await page.mouse.up();
    if (!spiderLanding.after) console.log('Spider landing diagnostic', spiderLanding);
    assert.equal(spiderLanding.before, 0); assert.equal(spiderLanding.after, spiderLanding.savedCount);
    assert.ok(!spiderLanding.dead && spiderLanding.ceiling && spiderLanding.flipped && spiderLanding.touched === 1);
    console.log('PASS actual Dash first spider landing Animate trigger with browser input and saved particle burst');
    await load(0, 'kA4,0;1,1,2,1065,3,135,128,6;1,1,2,1065,3,225,128,6;', 'Recover held pointer after a missed edge');
    await page.evaluate(() => {
      const s=window.scene.get('GameScene'),p=s._player;
      p.enterSpiderMode();Object.assign(p.p,{y:330,lastY:330,onGround:true,canJump:true,gravityFlipped:false});
      s._playerWorldX=2130;p._lastCollisionWorldX=2130;p._lastCollisionWorldY=330;
      s._menuActive=false;s._slideIn=false;s._levelWon=false;s._levelSelectOverlay=null;window.noClip=false;
      window.__recoveryUpdate=s.update;s.update=()=>{};
      window.__recoveryPush=s._pushButton;window.__recoveryCalls=0;
      // Reproduce an input edge consumed during scene/overlay handover,
      // while Phaser still correctly reports the actual held pointer.
      s._pushButton=function(...args){if(++window.__recoveryCalls===1)return;return window.__recoveryPush.apply(this,args);};
      s._paused=false;
    });
    await page.mouse.down();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const pointerRecovery=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level;
      s.update=window.__recoveryUpdate;s.update(0,1000/60);s._paused=true;
      const recovered={flipped:s._state.gravityFlipped,ceiling:s._state.onCeiling,calls:window.__recoveryCalls};
      s._pushButton=window.__recoveryPush;
      Object.assign(s._state,{y:330,lastY:330,yVelocity:0,onGround:true,onCeiling:false,canJump:true,gravityFlipped:false,upKeyDown:false,upKeyPressed:false,queuedHold:false});
      s._logicButtonDown=false;l.logicState._options({165:'1'});
      s._paused=false;s.update(1000/60,1000/60);s._paused=true;
      return {recovered,disabled:{down:s._state.upKeyDown,flipped:s._state.gravityFlipped},pointer:s.input.activePointer.isDown};
    });
    await page.mouse.up();
    assert.ok(pointerRecovery.pointer&&pointerRecovery.recovered.flipped&&pointerRecovery.recovered.ceiling&&pointerRecovery.recovered.calls>=2,JSON.stringify(pointerRecovery));
    assert.ok(!pointerRecovery.disabled.down&&!pointerRecovery.disabled.flipped,JSON.stringify(pointerRecovery));
    console.log('PASS held pointer recovers a spider press through the button handler and respects disabled controls');
    await load(0,'kA4,0;1,1,2,1065,3,135,128,6;1,1,2,1065,3,225,128,6;','Native spider body seats');
    const spiderBody=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,out=[];
      p.enterSpiderMode();s._playerWorldX=2130;s._menuActive=false;s._slideIn=false;s._levelWon=false;s._levelSelectOverlay=null;
      window.noClip=false;
      for(const mini of [false,true])for(const flipped of [false,true]){
        const half=Math.fround(27*(mini?Math.fround(.6):1));
        p.p.isMini=mini;
        const seat=flipped?420-half:300+half;
        Object.assign(p.p,{y:seat+(flipped?-.2:.2),lastY:seat+(flipped?-1:1),yVelocity:flipped?1:-1,
          onGround:false,onCeiling:false,canJump:false,gravityFlipped:flipped,upKeyDown:false,upKeyPressed:false});
        p._lastCollisionWorldX=s._playerWorldX;p._lastCollisionWorldY=p.p.lastY;
        s._paused=false;s.update(0,1000/60);s._paused=true;
        out.push({mini,flipped,half:p._collisionHalfSize(),expected:seat,y:p.p.y,ground:p.p.onGround,dead:p.p.isDead});
      }
      return out;
    });
    assert.ok(spiderBody.every(v=>Math.abs(v.y-v.expected)<.0001&&v.ground&&!v.dead),JSON.stringify(spiderBody));
    console.log('PASS actual full/mini spider floor and ceiling contacts use the native 27-point body');
    await load(0,'kA4,0;1,747,2,200,3,100,54,100,57,1,116,1,507,1;'+
      '1,211,2,200,3,150,32,10,24,5,25,1000,21,999;', 'Native teleport pair masking');
    const portalMask=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer;
      s._colorManager.setInitialColor(999,{r:0,g:0,b:0});s._colorManager.step(0);
      s._bg.setVisible(false);s.cameras.main.setBackgroundColor('#000000');
      s._cameraX=s._cameraY=0;s._cameraXRef._v=0;
      for(const c of[l.container,l.additiveContainer,l.topContainer]){c.x=0;c.y=0;}
      const entry=l.gdObjects[0],exit=entry?.teleportExit,mask=l.gdObjects[1];
      const sample=covered=>{
        mask.enabled=covered;l._syncGDRenderer();l.cameraState.updateVisual();
        const game=s.game,gl=game.renderer.gl;game.renderer.preRender();s.sys.render(game.renderer);game.renderer.postRender?.();gl.finish();
        const pixels=new Uint8Array(100*280*4);gl.readPixels(350,640-420,100,280,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let orange=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>70&&pixels[i+1]>10&&pixels[i]>pixels[i+1]*1.2&&pixels[i+1]>pixels[i+2]*1.2)orange++;
        return orange;
      };
      const visible=sample(false),covered=sample(true);
      return {entry:entry?.id,exit:exit?.id,pairY:exit?.y,visible,covered,glError:s.game.renderer.gl.getError(),
        legacySprites:(l.objectSprites[0]||[]).filter(sprite=>sprite.frame?.name?.startsWith('portal_')).length};
    });
    assert.equal(portalMask.entry,747);assert.equal(portalMask.exit,749);assert.equal(portalMask.pairY,200);
    assert.equal(portalMask.legacySprites,0);assert.ok(portalMask.visible>50,JSON.stringify(portalMask));
    assert.equal(portalMask.covered,0,JSON.stringify(portalMask));assert.equal(portalMask.glError,0);
    console.log('PASS teleport entry/exit use shared WebGL batches and an authored mask covers both in real GPU pixels');
    await load(0,'kA4,0;1,1612,2,-29,3,2385;1,1,2,3000,3,15;', 'Legacy Hide Player without camera commands');
    const legacyHide=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,c=l.cameraState;
      s._menuActive=false;s._slideIn=false;s._levelWon=false;
      s._cameraX=s._cameraY=0;s._cameraXRef._v=0;s._playerWorldX=200;
      p.p.y=100;p.p.lastY=100;p.p.isDead=false;p.setCubeVisible(true);p.syncSprites(0,0,1/60,200);
      s._bg.setVisible(false);for(const camera of s.cameras.cameras)camera.setBackgroundColor('rgba(0,0,0,0)');
      s.cameras.cameras[0].setBackgroundColor('#000000');
      const sample=hidden=>{
        l.logicState._hide({},hidden);c.updateVisual();l._syncGDRenderer(0);
        const game=s.game,gl=game.renderer.gl;game.renderer.preRender();s.sys.render(game.renderer);game.renderer.postRender?.();gl.finish();
        const pixels=new Uint8Array(80*80*4);gl.readPixels(160,640-400,80,80,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let lit=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>40)lit++;
        return lit;
      };
      const shown=sample(false),hidden=sample(true),shownAgain=sample(false);
      const icon=p._playerSpriteLayer.sprite;
      return {cameraAttached:!!c.camera,cameraCommands:l._cameraTriggers.length,shown,hidden,shownAgain,glError:s.game.renderer.gl.getError(),
        icon:{x:icon.x,y:icon.y,visible:icon.visible,alpha:icon.alpha,filter:icon.cameraFilter,parent:icon.parentContainer?.type},
        cameras:s.cameras.cameras.map(c=>({id:c.id,visible:c.visible,alpha:c.alpha,scrollX:c.scrollX,scrollY:c.scrollY}))};
    });
    assert.ok(legacyHide.cameraAttached&&legacyHide.cameraCommands===0,JSON.stringify(legacyHide));
    assert.ok(legacyHide.shown>100&&legacyHide.shownAgain===legacyHide.shown,JSON.stringify(legacyHide));
    assert.equal(legacyHide.hidden,0,JSON.stringify(legacyHide));assert.equal(legacyHide.glError,0);
    console.log('PASS pre-2.2 Hide/Show Player works without camera commands and removes/restores actual icon GPU pixels');
    const particleTemplates = fs.readFileSync(path.join(root,'work/fixtures/skeletal.txt'),'utf8').split(';').filter(text=>{
      const values=text.split(','),raw={};for(let i=0;i<values.length-1;i+=2)raw[values[i]]=values[i+1];
      return raw[1]==='2065'&&raw[57]==='153';
    });
    assert.equal(particleTemplates.length,2);
    await load(0,'kA4,0;'+particleTemplates.join(';')+';1,1764,2,150,3,150,57,8;1,3608,2,0,51,153,71,8,554,1;', 'Skeletal spawned particles');
    const spawnedParticles=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer;
      l.checkLogicTriggers(0);r.setCamera(0,0);r.update(.1);
      const count=r.spawnedParticleSystems.reduce((n,p)=>n+p.particles.length,0);
      const quads=r.quadCount, saved=l.captureRuntimeState();r.update(3);
      const expired=r.spawnedParticleSystems.length;
      l.restoreRuntimeState(saved);r.update(0);
      const restored=r.spawnedParticleSystems.reduce((n,p)=>n+p.particles.length,0);
      const finite=Array.from(r._vf.subarray(0,r.quadCount*24)).every((v,i)=>i%6===5||Number.isFinite(v));
      const g=s.game;g.renderer.preRender();s.sys.render(g.renderer);g.renderer.postRender?.();g.renderer.gl.finish();
      const glError=g.renderer.gl.getError();l.resetObjects();
      return {count,quads,expired,restored,finite,glError,reset:r.spawnedParticleSystems.length};
    });
    assert.equal(spawnedParticles.count,14);assert.equal(spawnedParticles.restored,14);
    assert.ok(spawnedParticles.quads>=14&&spawnedParticles.finite,JSON.stringify(spawnedParticles));
    assert.equal(spawnedParticles.expired,0);assert.equal(spawnedParticles.reset,0);assert.equal(spawnedParticles.glError,0);
    console.log('PASS actual Skeletal Spawn Particle templates emit independent GPU quads and survive checkpoints');
    const fogTemplate=fs.readFileSync(path.join(root,'work/fixtures/skeletal.txt'),'utf8').split(';').find(text=>{
      const values=text.split(','),raw={};for(let i=0;i<values.length-1;i+=2)raw[values[i]]=values[i+1];
      return raw[1]==='2065'&&raw[2]==='1935.58'&&raw[3]==='2191.31';
    });
    assert.ok(fogTemplate);
    await load(0,'kA4,0;'+fogTemplate.replace('2,1935.58,3,2191.31','2,100,3,100')+';', 'Skeletal object-coloured fog');
    const fogColour=await page.evaluate(async()=>{
      const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer,cm=s._colorManager,p=r.particleSystems[0];
      s._cameraX=0;s._cameraY=0;s._cameraXRef._v=0;
      s._bg.setVisible(false);s.cameras.main.setBackgroundColor('#000000');
      p.object.baseHSV=null;p.object.detailHSV=null; // Isolate the channel replacement from HSV adjustments.
      for(const c of[l.container,l.additiveContainer,l.topContainer]){c.x=0;c.y=0;}
      cm.setInitialColor(34,{r:255,g:0,b:0});cm.step(0);l._syncGDRenderer();
      p.reset();p.started=true;p.spawn();p.particles[0].age=.5;l._syncGDRenderer();l.cameraState.updateVisual();
      const pixel=await new Promise(resolve=>s.game.renderer.snapshotPixel(200,260,c=>resolve([c.r,c.g,c.b])));
      return {pixel,start:p.particles[0].startColor,end:p.particles[0].endColor,glError:s.game.renderer.gl.getError()};
    });
    assert.ok(fogColour.pixel[0]>100&&fogColour.pixel[1]<5&&fogColour.pixel[2]<5,JSON.stringify(fogColour));
    assert.deepEqual(fogColour.start.slice(0,3),[1,0,0]);assert.deepEqual(fogColour.end.slice(0,3),[1,0,0]);assert.equal(fogColour.glError,0);
    console.log('PASS actual Skeletal cyan-saved fog uses red main/end channels in GPU pixels');
    const areaParticleTemplate=fogTemplate.replace('2,1935.58,3,2191.31','2,1000,3,100')+',57,789';
    await load(0,'kA4,0;'+areaParticleTemplate+';1,1764,2,1000,3,100,57,790;'+
      '1,3008,2,0,51,789,71,790,222,600,233,2,235,3;'+
      '1,3007,2,0,51,789,71,790,222,600,270,90;'+
      '1,3006,2,0,51,789,71,790,222,600,241,1,237,-900;'+
      '1,3009,2,0,51,789,71,790,222,600,275,0.5,286,0.5;', 'Area-transformed Skeletal particles');
    const areaParticle=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer,p=r.particleSystems[0];
      p.object.scaleX=p.object.scaleY=1;
      Object.assign(p.data,{Life:2,LifeVar:0,StartSize:10,EndSize:10,StartSizeVar:0,EndSizeVar:0,
        Speed:0,SpeedVar:0,PosVarX:0,PosVarY:0,RadialAccel:0,RadialAccelVar:0,
        TangentialAccel:0,TangentialAccelVar:0,EmissionRate:0,PositionType:2});
      p._emissionBounds=null;p._reach=null;p.sample=value=>value;
      l.checkAreaTriggers(0);l.areaState.step(0);
      p.reset();p.started=true;p.spawn();p.particles[0].x=4;p.particles[0].y=5;
      p.particles[0].startColor[3]=p.particles[0].endColor[3]=1;
      p.particles[0].fadeIn=p.particles[0].fadeOut=0;
      r.debugItems=true;r.setCamera(0,0);r.camera.w=r.camera.h=200;r.update(0);
      const item=r.buckets.flat().find(item=>item.part===p.part);
      const game=s.game;game.renderer.preRender();s.sys.render(game.renderer);game.renderer.postRender?.();game.renderer.gl.finish();
      const matrix=item?.m.slice();
      if(matrix){matrix[0]*=p.part.info.cw;matrix[1]*=p.part.info.cw;matrix[2]*=p.part.info.ch;matrix[3]*=p.part.info.ch;}
      return {matrix,opacity:item?.opacity,quads:r.quadCount,glError:game.renderer.gl.getError()};
    });
    assert.ok(areaParticle.quads>=1&&areaParticle.matrix,JSON.stringify(areaParticle));
    for(const [i,v] of [0,-20,30,0,115,92].entries())assert.ok(Math.abs(areaParticle.matrix[i]-v)<1e-5,JSON.stringify(areaParticle));
    assert.ok(Math.abs(areaParticle.opacity-.5)<1e-5);assert.equal(areaParticle.glError,0);
    console.log('PASS actual Area triggers move an offscreen Skeletal emitter into view and transform/fade its WebGL quads');
    await load(0, 'kA4,0;1,2903,2,0,3,0,21,1,22,2,202,15,209,7,456,0;', 'Native screen gradient');
    const gradient = await page.evaluate(async () => {
      const s = window.scene.get('GameScene'), l = s._level, r = l.gdRenderer, cm = s._colorManager;
      r.debugItems = true; // record the frame's draw items for inspection
      const getFinal = cm.getFinal.bind(cm), getOpacity = cm.getOpacity.bind(cm);
      cm.getFinal = id => id === 1 ? [255, 0, 0] : id === 2 ? [0, 0, 255] : getFinal(id);
      cm.getOpacity = id => id === 1 ? 128 : id === 2 ? 255 : getOpacity(id);
      l.checkShaderTriggers(0); const modes = [];
      for (let mode = 0; mode < 4; mode++) {
        l._gradientTriggers[0].raw[174] = String(mode); l._syncGDRenderer();
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
        const item = r.buckets.flat().find(i => i.colors);
        modes.push({ mode, drawn: !!item, overlay: item?.overlay, screen: item?.screen,
          first: item?.colors[0], last: item?.colors[1], glError: s.game.renderer.gl.getError() });
      }
      const separateCamera = !!l.cameraState.camera && r.overlayLayer.cameraFilter === l.cameraState.camera.id;
      l.gradientState.trigger({ raw: { 209: '7', 208: '1' } }); l._syncGDRenderer();
      return { modes, separateCamera, removed: !r.buckets.flat().some(i => i.colors) };
    });
    assert.ok(gradient.separateCamera && gradient.removed);
    assert.ok(gradient.modes.every(m => m.drawn && m.overlay && m.screen && m.glError === 0));
    assert.deepEqual(gradient.modes[0].first, [255, 0, 0, 128]);
    assert.deepEqual(gradient.modes[2].first, [128, 0, 0, 128]);
    console.log('PASS gradient colour, alpha, four native blend modes and separate screen layer');
    await load(0, 'kA4,0;1,211,2,100,3,100,21,7,24,-5,64,1,67,1;1,2903,2,0,21,8,22,8,202,1,209,1;', 'Background gradient behind B5 artwork');
    const backgroundGradient = await page.evaluate(async () => {
      const s=window.scene.get('GameScene'), l=s._level, r=l.gdRenderer, cm=s._colorManager;
      s._cameraX=0;s._cameraY=0;s._cameraXRef._v=0;s._bg.setVisible(false);
      for(const c of [l.container,l.additiveContainer,l.topContainer]){c.x=0;c.y=0;}
      cm.setInitialColor(7,{r:255,g:0,b:0});cm.setInitialColor(8,{r:0,g:0,b:255});cm.step(0);
      l.checkShaderTriggers(0);
      const result=[];
      const pixel=(x,y)=>new Promise(resolve=>s.game.renderer.snapshotPixel(x,y,c=>resolve([c.r,c.g,c.b])));
      for(const layer of [1,2]){
        l._gradientTriggers[0].raw[202]=String(layer);l._syncGDRenderer();l.cameraState.updateVisual();
        result.push({layer,art:await pixel(200,260),back:await pixel(500,200)});
      }
      return {samples:result,glError:s.game.renderer.gl.getError()};
    });
    assert.equal(backgroundGradient.glError,0);
    assert.ok(backgroundGradient.samples.every(s=>s.art[0]>240&&s.art[1]<5&&s.art[2]<5&&s.back[2]>240&&s.back[0]<5),JSON.stringify(backgroundGradient));
    console.log('PASS opaque BG/MG gradients leave B5 artwork visible in actual GPU pixels');
    await load(0, 'kA4,0;1,211,2,100,3,100,21,7,24,-3,64,1,67,1;1,211,2,200,3,100,21,7,24,5,64,1,67,1;1,2904,2,0,196,4,197,4;1,2919,2,0,176,1;', 'Shader layer interval');
    const shaderBands = await page.evaluate(async () => {
      const s = window.scene.get('GameScene'), l = s._level, cm = s._colorManager;
      s._cameraX = 0; s._cameraY = 0; s._cameraXRef._v = 0;
      for (const c of [l.container, l.additiveContainer, l.topContainer]) { c.x = 0; c.y = 0; }
      cm.setInitialColor(7, { r: 255, g: 0, b: 0 }); cm.step(0);
      l.checkShaderTriggers(0); l._syncGDRenderer(); l.cameraState.updateVisual();
      const pixel = (x, y) => new Promise(resolve => s.game.renderer.snapshotPixel(x, y, c => resolve([c.r, c.g, c.b])));
      const inside = await pixel(200, 260), outside = await pixel(400, 260);
      l.shaderState.trigger({ id: 2904, raw: {} }); l.cameraState.updateVisual();
      const included = await pixel(400, 260);
      return { inside, outside, included, cameras: l.cameraState.shaderCameras.length, glError: s.game.renderer.gl.getError() };
    });
    await page.screenshot({path:path.join(output,'shader-bands.png')});
    assert.equal(shaderBands.cameras, 3); assert.equal(shaderBands.glError, 0);
    assert.ok(shaderBands.inside[0] > 50 && Math.abs(shaderBands.inside[0] - shaderBands.inside[1]) < 3, JSON.stringify(shaderBands));
    assert.ok(shaderBands.outside[0] > 240 && shaderBands.outside[1] < 5, JSON.stringify(shaderBands));
    assert.ok(shaderBands.included[0] > 50 && Math.abs(shaderBands.included[0] - shaderBands.included[1]) < 3, JSON.stringify(shaderBands));
    console.log('PASS actual GPU pixels respect the shader z interval and live changes');
    await load(0,'kA4,0;1,2015,2,0,68,0;1,1,2,5000,3,0;','Rotated background coverage');
    const backgroundCover = await page.evaluate(async()=>{
      const s=window.scene.get('GameScene'),l=s._level,c=l.cameraState,out=[];
      window.noClip=false;s._menuActive=false;s._slideIn=false;s._bg.setTexture('__WHITE').setTint(0x7135d7);
      l.logicState._options({161:'1',532:'1',162:'1'});s._glitterEmitter?.setVisible(false);
      // the corner samples sit under the pause button, which fades in after the slide-in
      s.tweens.killTweensOf(s._pauseBtn);s._pauseBtn.setVisible(false);
      const pixel=(x,y)=>new Promise(resolve=>s.game.renderer.snapshotPixel(x,y,p=>resolve([p.r,p.g,p.b])));
      for(const [rotation,zoom] of [[90,1.22],[45,.4],[-135,.65],[0,1]]){
        Object.assign(c.values,{rotation,zoom});c.updateVisual();
        const samples=[];
        for(const [x,y] of [[20,20],[s.scale.width-20,20],[20,s.scale.height-20],[s.scale.width-20,s.scale.height-20]])samples.push(await pixel(x,y));
        out.push({rotation,zoom,samples,width:s._bg.width,height:s._bg.height});
      }
      return out;
    });
    assert.ok(backgroundCover.every(v=>v.samples.every(p=>p[0]>100&&p[2]>200)),JSON.stringify(backgroundCover));
    console.log('PASS GPU background covers every viewport corner through rotation and zoom');
    await load(0, 'kA4,0;1,1764,2,500,3,150,57,2;1,3600,2,100,3,50,71,2,460,1,461,1,487,1;', 'Instant end trigger');
    const endTrigger = await page.evaluate(() => {
      const s = window.scene.get('GameScene'); let completion = 0, sounds = 0;
      const show = s._showCompleteText, play = s.sound.play;
      s._showCompleteText = () => completion++; s.sound.play = () => sounds++;
      s._level.checkEndTriggers(200); s._level.checkEndTriggers(300);
      s._showCompleteText = show; s.sound.play = play;
      return { won: s._levelWon, x: s._playerWorldX, y: s._state.y, completion, sounds };
    });
    assert.deepEqual(endTrigger, { won: true, x: 1000, y: 300, completion: 1, sounds: 0 });
    console.log('PASS instant End trigger completes once at its target without effect or sound');
    const fixedStep = [];
    for (const fps of [30, 60, 144, 240]) {
      await load(0, 'kA4,0;1,211,2,100,3,100,57,1;1,901,2,80,51,1,28,300,10,3;1,2923,2,100,176,1,191,1,175,1,179,0.5;1,2923,2,102,176,1,191,1,175,1,179,0,10,3;', 'Fixed simulation timing');
      fixedStep.push(await page.evaluate(fps => {
        const s = window.scene.get('GameScene'); s._restartLevel();
        s._paused = false; s._slideIn = false; s._menuActive = false;
        const frame = s._physicsFrame;
        for (let i = 0; i < fps * 2; i++) s.update(i * 1000 / fps, 1000 / fps);
        s._paused = true;
        return { fps, ticks: s._physicsFrame - frame, x: s._playerWorldX, y: s._state.y,
          offset: s._level.gdObjects[0].offX, tint: s._level.shaderState.uniforms()._colorChangeB,
          elapsed: s._level._activeMoveTweens[0]?.elapsed };
      }, fps));
    }
    for (const result of fixedStep) {
      assert.equal(result.ticks, 480);
      const { fps, ...state } = result, { fps: baseFPS, ...base } = fixedStep[0];
      assert.deepEqual(state, base);
    }
    console.log('PASS 30/60/144/240 FPS produce identical player, movement and shader state');
    const warpedStep = [];
    for (const fps of [30, 60, 144, 240]) {
      await load(0, 'kA4,0;1,1935,2,-30,120,0.5;1,1935,2,100,120,1.25;1,1,2,2000,3,0;', 'Warped fixed simulation');
      warpedStep.push(await page.evaluate(fps => {
        const s = window.scene.get('GameScene'); s._restartLevel();
        s._paused = false; s._slideIn = false; s._menuActive = false;
        const initial = s._physicsFrame;
        for (let n = 0; n < fps * 2; n++) s.update(n * 1000 / fps, 1000 / fps);
        s._paused = true;
        return { fps, ticks: s._physicsFrame - initial, x: s._playerWorldX, y: s._state.y,
          clock: s._level._spawnClock, warp: s._level.logicState.timeWarp };
      }, fps));
    }
    for (const result of warpedStep) {
      assert.ok(result.ticks > 480); assert.equal(result.warp, 1.25);
      const { fps, ...state } = result, { fps: initialFPS, ...initial } = warpedStep[0];
      assert.deepEqual(state, initial);
    }
    console.log('PASS slow-to-fast TimeWarp adds native fast-motion substeps with identical state at 30/60/144/240 FPS');
    const fastWarp = [];
    for (const fps of [30,60,144,240]) {
      await load(0,'kA4,0;1,1,2,5000,3,0;','2x TimeWarp step limit');
      fastWarp.push(await page.evaluate(fps=>{
        const s=window.scene.get('GameScene');s._restartLevel();s._paused=false;s._slideIn=false;s._menuActive=false;
        s._level.logicState.timeWarp=2;
        const frame=s._physicsFrame,original=s._updateSimulationStep;let maxStep=0;
        s._updateSimulationStep=function(time,dt){maxStep=Math.max(maxStep,dt);return original.call(this,time,dt);};
        try { for(let n=0;n<fps*2;n++)s.update(n*1000/fps,1000/fps); }
        finally {s._updateSimulationStep=original;s._paused=true;}
        return {fps,ticks:s._physicsFrame-frame,x:s._playerWorldX,y:s._state.y,clock:s._level._spawnClock,maxStep};
      },fps));
    }
    for(const row of fastWarp){
      assert.equal(row.ticks,960);assert.ok(Math.abs(row.clock-4)<1e-10);assert.ok(row.maxStep<=1000/240+1e-9);
      const {fps,...state}=row,{fps:baseFPS,...base}=fastWarp[0];assert.deepEqual(state,base);
    }
    console.log('PASS 2x TimeWarp runs 960 bounded physics steps in two real seconds at all four render rates');
    const renderClock=[];
    for(const warp of [.4,1,2])for(const fps of [30,60,144,240,360]) {
      await load(0,'kA4,0;1,1,2,5000,3,0;','TimeWarp render clock');
      renderClock.push(await page.evaluate(({warp,fps})=>{
        const s=window.scene.get('GameScene');s._restartLevel();s._paused=false;s._slideIn=false;s._menuActive=false;
        const r=s._level.gdRenderer;s._level.logicState.timeWarp=warp;let noTickFrames=0,maxIdleAdvance=0;
        for(let n=0;n<fps;n++){
          const frame=s._physicsFrame,before=r.time;
          s.update(n*1000/fps,1000/fps);s.sys.events.emit('postupdate',n*1000/fps,1000/fps);
          if(s._physicsFrame===frame){noTickFrames++;maxIdleAdvance=Math.max(maxIdleAdvance,r.time-before);}
        }
        s._paused=true;return {warp,fps,renderTime:r.time,simulationTime:s._level._spawnClock,noTickFrames,maxIdleAdvance};
      },{warp,fps}));
    }
    for(const row of renderClock){
      assert.ok(Math.abs(row.renderTime-row.simulationTime)<1e-10,JSON.stringify(row));
      assert.ok(Math.abs(row.renderTime-row.warp)<1e-10,JSON.stringify(row));
      assert.equal(row.maxIdleAdvance,0);
    }
    assert.ok(renderClock.some(r=>r.noTickFrames>0));
    console.log('PASS particle/animation clock follows actual slow/fast simulation at 30/60/144/240/360 FPS');
    const cameraLead=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),rows=[];
      for(const zoom of [.5,.8,1,2]) {
        s._level.cameraState.values.zoom=zoom;
        const anchor=s._getGameplayAnchorX(),width=s.scale.width;
        s._playerWorldX=1000;s._cameraX=1000-anchor;
        const view=s._level.cameraState.view(width,s.scale.height,s._cameraX,0);
        rows.push({zoom,lead:(view.x-1000)*zoom/2,anchor});
      }
      s._level.cameraState.values.zoom=1;return rows;
    });
    for(const row of cameraLead) assert.ok(Math.abs(row.lead-75)<1e-8,JSON.stringify(cameraLead));
    console.log('PASS native camera keeps its 75-unit screen lead through zoom changes');
    const definitions = await page.evaluate(() => {
      const r = new GDRenderer(window.scene.get('GameScene')), missing = [], missingChannels = [], count = Object.keys(GD_OBJECTS).length;
      let visible = 0;
      for (const id of Object.keys(GD_OBJECTS)) {
        const o = r.addObject(parseObject(`1,${id},2,100,3,100`));
        if (!o || o.hidden || /^edit_/.test(GD_OBJECTS[id].f)) continue;
        if (o.parts.length || o.particleSystem) visible++;
        else missing.push({ id: +id, frame: GD_OBJECTS[id].f });
        if (o.parts.length && o.def.dc >= 0 && !o.hasDetail) missingChannels.push(+id);
      }
      r.destroy(); return { count, visible, missing, missingChannels };
    });
    // These 14 pixel-art definitions refer to frames absent from the supplied
    // original PixelSheet as well. Report them explicitly rather than invent art.
    assert.ok(definitions.missing.every(o => o.id >= 4386 && o.id <= 4399));
    assert.deepEqual(definitions.missingChannels, []);
    console.log('PASS definition audit ' + definitions.count + '; absent original frames: ' + definitions.missing.length);
    const denseGPU = await page.evaluate(async () => {
      const s = window.scene.get('GameScene'), r = new GDRenderer(s);
      r.debugItems = true;
      r.addObject(parseObject('1,1,2,100,3,100')); r.colorManager = s._colorManager;
      r.setCamera(0, 0); r.update(0);
      const item = r.buckets.flat()[0];
      r.clearFrame(); r.debugItems = false;
      for (let i = 0; i < 20000; i++) r.pushItem(0, item);
      r._buildVertices(); r.createLayers(1, 11);
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      const result = { quads: r.quadCount, glError: s.game.renderer.gl.getError() };
      r.destroy(); return result;
    });
    assert.equal(denseGPU.quads, 20000); assert.equal(denseGPU.glError, 0);
    console.log('PASS 20000-quad GPU draw without clipping or GL errors');
    const additivePixel = await page.evaluate(() => {
      const s=window.scene.get('GameScene'),renderer=s.game.renderer,gl=renderer.gl,r=new GDRenderer(s),R=GDRender;
      renderer.pipelines.clear();
      const fb=gl.getParameter(gl.FRAMEBUFFER_BINDING),vp=gl.getParameter(gl.VIEWPORT),target=gl.createFramebuffer(),tex=gl.createTexture();
      try {
        gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
        gl.viewport(0,0,1,1);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
        const part=R.makePart({info:R.makeInfo({key:'__WHITE',slot:r.frames.textureSlot('__WHITE'),w:1,h:1,cw:1,ch:1,u0:.5,u1:.5,v0:.5,v1:.5})});
        r._writePart(R.batchFor(5,true,'game'),0,part,[1,0,0,1,0,0],[255,0,0],.5);
        r.camera.screenX=0;r.camera.screenY=0;r.camera.screenGroundY=1;r._buildVertices();r.render({gl,width:1,height:1},true);
        const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        const sprite=[...pixel];
        gl.clear(gl.COLOR_BUFFER_BIT);r.clearFrame();part.opacityModifyRGB=false;
        r._writePart(R.batchFor(5,true,'particle'),0,part,[1,0,0,1,0,0],[255,0,0],.5);
        r._buildVertices();r.render({gl,width:1,height:1},true);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        const particle=[...pixel];
        r.clearFrame();r.colorManager=new ColorManager();r.colorManager.setInitialColor(7,{r:0,g:0,b:0});r.colorManager.step(0);r._channelStamp++;
        const obj=r.addObject(parseObject('1,2065,2,.5,3,.5,21,7,22,7,147,1,24,5'));
        const system=new GDParticleSystem(r,obj,{Life:1,StartSize:1,EndSize:1,PositionType:2,isBlendAdditive:1,
          StartColorR:1,StartColorG:1,StartColorB:1,StartColorA:1,EndColorR:1,EndColorG:1,EndColorB:1,EndColorA:1});
        system.part=R.makePart({info:part.info,qx:-.5,qy:-.5,opacityModifyRGB:false});
        system.sample=v=>v;system.spawn();system.draw();
        gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);
        r._buildVertices();r.render({gl,width:1,height:1},true);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        return {sprite,particle,uniformParticle:[...pixel]};
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(...vp);gl.deleteFramebuffer(target);gl.deleteTexture(tex);r.destroy();renderer.pipelines.rebind();
      }
    });
    assert.deepEqual(additivePixel,{sprite:[64,0,0,255],particle:[128,0,0,255],uniformParticle:[0,0,0,255]});
    console.log('PASS real GPU pixels retain sprite/particle opacity rules and object-coloured particles cover white with black despite a saved additive profile');
    const customTransport = await page.evaluate(async () => {
      const s=window.scene.get('GameScene'), previous={level:window.currentlevel,settings:window.settingsMap,
        load:window.SongDB.load,buffer:window._onlineSongBuffer,key:window._onlineSongKey,title:window._onlineSongTitle,artist:window._onlineSongArtist};
      const bytes=await (await fetch('assets/music/StereoMadness.mp3')).arrayBuffer();
      const scene={sound:s.sound,game:s.game,cache:{audio:{exists:()=>false}},_paused:false,_menuActive:false,_slideIn:false};
      const a=new AudioManager(scene), started=[];const play=a._playOnlineBuffer.bind(a);
      a._playOnlineBuffer=(buffer,offset)=>{started.push(offset);play(buffer,offset);};
      let release;const gate=new Promise(resolve=>release=resolve);
      try {
        window.currentlevel=['ng_song_987654321','Offline transport test','local_qa',['Local','Test']];
        window.settingsMap={kA13:'.25'};window._onlineSongBuffer=null;window._onlineSongKey=null;
        window.SongDB.load=async()=>{await gate;return bytes;};
        a.startMusic(1);a.update(.4);scene._paused=true;a.update(3);scene._paused=false;release();
        while(a._pendingOnlineSongLoadKey)await new Promise(resolve=>setTimeout(resolve,5));
        const result={started,position:a.getLevelPosition(),playing:a._music?.isPlaying};
        a.stopMusic();a.startMusic(-1);result.delayed=a._music.seek;
        a.pauseMusic();result.paused=a._music.isPaused;a.resumeMusic();result.resumed=a._music.isPlaying;
        a.stopMusic();window._onlineSongBuffer=null;window._onlineSongKey=null;
        let finish;const pending=new Promise(resolve=>finish=resolve);
        window.SongDB.load=async()=>{await pending;return bytes;};
        scene._audio=a;scene._simulationBufferMs=500;scene._updateSimulationStep=()=>{throw Error('Attempt advanced before audio was ready');};
        s._startAttemptMusic.call(scene,0);s.update.call(scene,0,400);a.update(.4);
        result.waiting=scene._waitingForLevelMusic;result.heldPosition=a.getLevelPosition();result.buffer=scene._simulationBufferMs;
        finish();while(a.musicLoading)await new Promise(resolve=>setTimeout(resolve,5));
        result.freshStart=started.at(-1);
        return result;
      } finally {
        a.stopMusic();window.currentlevel=previous.level;window.settingsMap=previous.settings;window.SongDB.load=previous.load;
        window._onlineSongBuffer=previous.buffer;window._onlineSongKey=previous.key;
        window._onlineSongTitle=previous.title;window._onlineSongArtist=previous.artist;
      }
    });
    assert.ok(Math.abs(customTransport.started[0]-1.65)<1e-6,JSON.stringify(customTransport));
    assert.ok(Math.abs(customTransport.position-1.4)<1e-6&&customTransport.playing&&customTransport.paused&&customTransport.resumed);
    assert.ok(customTransport.delayed<-.7&&customTransport.delayed>=-.75);
    assert.ok(customTransport.waiting&&customTransport.heldPosition===0&&customTransport.buffer===0&&customTransport.freshStart===.25,JSON.stringify(customTransport));
    console.log('PASS custom music loads from local storage without metadata, catches up after loading and schedules negative offsets');
    const trailOrder = await page.evaluate(() => {
      const s=window.scene.get('GameScene'),r=s._level.gdRenderer,p=s._player,t=p._trailContainer;
      return {trail:t.depth,middle:r.middleLayer.depth,above:r.aboveLayer.depth,
        icons:p._allLayers.filter(Boolean).map(l=>l.sprite.depth),owner:p._waveTrail._gfx.parentContainer===t&&p._streak._gfx.parentContainer===t};
    });
    assert.ok(trailOrder.owner&&trailOrder.trail<trailOrder.middle&&trailOrder.icons.every(z=>z>trailOrder.middle&&z<trailOrder.above),JSON.stringify(trailOrder));
    console.log('PASS wave and regular trails stay behind the icon, B1 top gradients and foreground batches');
    const warpedRotation=[];
    for(const warp of [1,.1]) {
      await load(0,'kA4,0;1,1,2,5000,3,0;','TimeWarp cube rotation');
      warpedRotation.push(await page.evaluate(warp=>{
        const s=window.scene.get('GameScene');s._restartLevel();s._paused=false;s._slideIn=false;s._menuActive=false;window.noClip=true;
        s._level.logicState.timeWarp=warp;s._state.y=1000;s._state.onGround=false;s._state.isJumping=true;
        s._player._rotation=0;s._player.runRotateAction();
        for(let n=0;n<60;n++)s.update(n*1000/60,1000/60);
        s._paused=true;return {warp,actionTime:s._player.rotateActionTime,angle:s._player._rotation,duration:s._player.rotateActionDuration};
      },warp));
    }
    assert.ok(Math.abs(warpedRotation[1].actionTime-.1)<1e-8,JSON.stringify(warpedRotation));
    assert.ok(Math.abs(warpedRotation[1].angle-Math.PI*.1/warpedRotation[1].duration)<1e-6);
    console.log('PASS slow TimeWarp advances cube rotation in game time');
    await load(0,'kA4,0;1,2016,2,1000,3,500,57,7;1,2016,2,1600,3,800,57,8;1,1,2,1000,3,500;1,1,2,1600,3,800;', 'Static camera transitions');
    const staticCamera=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),c=s._level.cameraState;
      s._paused=true;s._slideIn=false;s._menuActive=false;c.attach();c.reset();s._cameraX=0;s._cameraY=0;
      const read=()=>{c.updateVisual();const v=c.view(s.scale.width,s.scale.height,s._cameraX,s._cameraY),cam=c.camera;
        return {x:v.x,y:v.y,scrollX:cam.scrollX,scrollY:cam.scrollY,expectedScrollX:v.scrollX,expectedScrollY:v.scrollY};};
      const trigger=raw=>c.trigger({id:1914,raw});
      trigger({71:'7'});trigger({71:'8',10:'1'});const start=read();
      for(let i=0;i<120;i++)c.step(1/240);const halfway=read(),saved=c.capture();
      for(let i=0;i<120;i++)c.step(1/240);const end=read();
      c.restore(saved);for(let i=0;i<120;i++)c.step(1/240);const restored=read();
      c.velocity={x:120,y:-60};trigger({71:'7',10:'2',453:'1',454:'.25'});
      for(let i=0;i<120;i++)c.step(1/240);const smooth=read();
      trigger({71:'7'});trigger({71:'8',212:'1',213:'100',10:'-1'});c.step(1/240);const slow=read();
      trigger({71:'7'});c.velocity={x:0,y:0};
      c.trigger({id:1914,raw:{71:'8',212:'1',453:'1',10:'1',57:'9'},groups:[9]});
      for(let i=0;i<120;i++)c.step(1/240);
      s._level._applyStopTrigger({targetGroup:9});s._level._translateGroup(8,200,0);c.step(1/240);
      const stopped=read(),stopPhase=c.targets.x.progress,stopTweens=c.tweens.length;
      return {start,halfway,end,restored,smooth,slow,stopped,stopPhase,stopTweens,glError:s.game.renderer.gl.getError()};
    });
    for(const row of Object.values(staticCamera))if(row&&typeof row==='object') {
      assert.ok(Math.abs(row.scrollX-row.expectedScrollX)<1e-7);assert.ok(Math.abs(row.scrollY-row.expectedScrollY)<1e-7);
    }
    assert.equal(staticCamera.start.x,2000);assert.equal(staticCamera.start.y,1000);
    assert.ok(Math.abs(staticCamera.halfway.x-2600)<1e-7&&Math.abs(staticCamera.halfway.y-1300)<1e-7);
    assert.ok(Math.abs(staticCamera.end.x-3200)<1e-7&&Math.abs(staticCamera.end.y-1600)<1e-7);
    assert.deepEqual(staticCamera.restored,staticCamera.end);
    // Return curve: P0=(1600,800), P1=(1680,760), P2=(1170,565), P3=(1000,500).
    assert.ok(Math.abs(staticCamera.smooth.x-3127.8125)<1e-7&&Math.abs(staticCamera.smooth.y-1490.78125)<1e-7);
    assert.ok(Math.abs(staticCamera.slow.x-2003)<1e-7&&Math.abs(staticCamera.slow.y-1001.5)<1e-7);
    assert.ok(Math.abs(staticCamera.stopped.x-2700)<1e-7&&Math.abs(staticCamera.stopPhase-.5)<1e-7);
    assert.equal(staticCamera.stopTweens,0);
    assert.equal(staticCamera.glError,0);
    console.log('PASS native static camera transitions, velocity Bezier, slow follow, Phaser scroll and reusable checkpoint');
    // Intro animation has no physical contacts. Its menu camera position
    // must not become the previous position of the first swept collision.
    await page.evaluate(() => {
      const s=window.scene.get('GameScene'); s.__qaSpawnUpdate=s.update;
      s.update=function(t,dt){
        this.__qaSpawnUpdate.call(this,t,dt);
        if(this._level!==window.__qaOld&&!this._slideIn&&!this._menuActive)this._paused=true;
      };
    });
    await load(0,'kA4,0;1,747,2,18,3,45,54,2355;1,67,2,15,3,3;1,1,2,3000,3,15;', 'First attempt spawn sweep');
    await page.waitForFunction(()=>!window.scene.get('GameScene')._slideIn&&!window.scene.get('GameScene')._menuActive);
    const spawnSweep=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'); s.update=s.__qaSpawnUpdate; delete s.__qaSpawnUpdate;
      // Phaser caches the function when it boots the scene. Restore that
      // reference too, before a later restart can invoke the intro wrapper.
      s.sys.sceneUpdate=s.update;
      window.noClip=false;
      const initial={x:s._playerWorldX,previous:s._player._lastCollisionWorldX,frame:s._physicsFrame};
      const run=()=>{
        s._paused=false;s._fixedTickActive=true;const rows=[];
        for(let n=0;n<2;n++){
          s._updateSimulationStep(n*1000/240,1000/240);
          rows.push({x:s._playerWorldX,y:s._state.y,vy:s._state.yVelocity,flip:s._state.gravityFlipped,camera:s._cameraY});
        }
        s._fixedTickActive=false;s._paused=true;return rows;
      };
      const first=run();s._restartLevel();
      s._paused=false;
      for(let n=0;s._slideIn&&n<600;n++)s.update(n*1000/60,1000/60);
      const restart=run();return {initial,first,restart};
    });
    assert.deepEqual(spawnSweep.initial,{x:0,previous:0,frame:0});
    assert.ok(spawnSweep.first[0].flip&&spawnSweep.first[0].y<40,'the spawn pad runs before the nearby portal');
    assert.equal(spawnSweep.first[1].y,4800,'the portal is reached on the next physics tick');
    assert.equal(spawnSweep.first[1].camera,4580,'a distant teleport updates the normal camera immediately');
    assert.deepEqual(spawnSweep.first,spawnSweep.restart,'first attempt and restart have identical contacts');
    const teleportCamera=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),y=s._state.y,flip=s._state.gravityFlipped;
      s._state.gravityFlipped=false;s._cameraY=0;s._state.y=500;
      s._checkCameraLimitAfterTeleport(s._player);const nearby=s._cameraY;
      s._checkCameraLimitAfterTeleport(s._player,true);const ease=s._cameraY;
      s._cameraY=900;s._state.y=700;s._checkCameraLimitAfterTeleport(s._player);const belowNearby=s._cameraY;
      s._state.y=100;s._checkCameraLimitAfterTeleport(s._player);const belowFar=s._cameraY;
      s._state.y=y;s._state.gravityFlipped=flip;s._paused=true;
      return {nearby,ease,belowNearby,belowFar};
    });
    assert.deepEqual(teleportCamera,{nearby:0,ease:220,belowNearby:900,belowFar:40});
    console.log('PASS actual intro spawn sweep: blue pad before teleport, identical first attempt and restart');
    await load(0,'kA4,0;1,3604,2,-30,51,9,430,12;1,3604,2,-30,51,10,430,1.2.3.4.5;' +
      '1,3604,2,-30,51,11,430,10;1,211,2,1000,3,100,57,1;1,1346,2,0,62,1,87,1,57,9,51,1,68,90,10,.2;', 'Player events');
    const playerEvents=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level;s._restartLevel();s._paused=false;s._slideIn=false;s._menuActive=false;
      for(let n=0;n<4;n++)s.update(n*1000/60,1000/60);
      const fired=[],original=l._activateSpawnedGroup;
      l._activateSpawnedGroup=function(group,...args){fired.push(group);return original.call(this,group,...args);};
      s._pushButton();for(let n=0;n<6;n++)s.update(n*1000/60,1000/60);s._releaseButton();
      const angle=l.gdRenderer.groups.get(1)[0].rotOff;
      for(let n=0;n<40;n++)s.update(n*1000/60,1000/60);
      s._player.flipGravity(true,1);s._player.flipGravity(true,1);s._paused=true;l._activateSpawnedGroup=original;
      return {fired,angle};
    });
    assert.equal(playerEvents.fired.filter(g=>g===9).length,1);assert.ok(playerEvents.angle>0);
    assert.ok(playerEvents.fired.includes(10));assert.equal(playerEvents.fired.filter(g=>g===11).length,1);
    console.log('PASS physical jump, landing and gravity events drive authored animations once');
    // Moving floors (collidedWithObjectInternal / postCollision): a cube on a
    // row a Move raises rides a slow lift at the face speed and is thrown by a
    // fast one (> 5 GD units per 0.25) when it stops.
    const lift = {};
    for (const [name, seconds] of [['fast', 0.15], ['slow', 1]]) {
      const row = []; for (let x = 165; x <= 1200; x += 30) row.push(`1,1,2,${x},3,-15,57,1`);
      await load(0, `kA4,0;${row.join(';')};1,901,2,450,3,300,51,1,28,0,29,90,10,${seconds},30,0;1,1,2,3000,3,15;`, 'Lift ' + name);
      lift[name] = await page.evaluate(() => {
        const s = window.scene.get('GameScene'); window.noClip = false; s._paused = false;
        for (let f = 0; s._slideIn && f < 600; f++) s.update(f * 1000 / 60, 1000 / 60);
        const rows = []; const step = s._updateSimulationStep;
        s._updateSimulationStep = function (t, dt) { step.call(this, t, dt); rows.push({ x: s._playerWorldX / 2, y: s._state.y / 2, vy: s._state.yVelocity / 2, ground: s._state.onGround, dead: s._state.isDead }); };
        for (let f = 0; f < 150 && !s._state.isDead; f++) { s.update(f * 1000 / 60, 1000 / 60); s.sys.events.emit('postupdate', f * 1000 / 60, 1000 / 60); }
        s._updateSimulationStep = step; s._paused = true;
        const riding = rows.filter(r => r.x > 470 && r.x < 480);
        return { dead: rows.some(r => r.dead), maxY: Math.max(...rows.map(r => r.y)), ridingVy: riding.map(r => r.vy), ridingGround: riding.every(r => r.ground) };
      });
    }
    assert.ok(!lift.fast.dead && lift.fast.maxY > 140, 'a fast lift throws the cube: ' + JSON.stringify(lift.fast.maxY));
    assert.ok(!lift.slow.dead && lift.slow.ridingGround && lift.slow.ridingVy.every(v => Math.abs(v - 1.5) < 1e-6), 'slow lift ride: ' + JSON.stringify(lift.slow));
    assert.ok(lift.slow.maxY < 110, 'a slow lift does not throw: ' + lift.slow.maxY);
    console.log('PASS moving floors: slow lifts carry at the face speed, fast lifts throw the cube');
    await load(0, 'kA4,0;1,918,2,500,3,100,57,7,96,1;1,1584,2,650,3,100,57,8;' +
      '1,1585,2,1000,3,100,51,7,76,1;', 'Native animated beasts');
    const beasts=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer;
      s._paused=true;s._slideIn=false;s._menuActive=false;r.colorManager=s._colorManager;
      r.setCamera(700,0);r.debugItems=true;r.update(0);
      const a=l._beastAnimations.find(a=>a.objectId===918),b=l._beastAnimations.find(a=>a.objectId===1584);
      const read=()=>a.parts.map(p=>({tag:p.tag,x:p.sprite.x,y:p.sprite.y,rot:p.sprite.rotation,sx:p.sprite.scaleX,
        companions:p.companions.map(c=>({eye:!!c._eeBeastEye,color:!!c._eeBeastColorSprite,x:c.x,y:c.y,rot:c.rotation,sx:c.scaleX,visible:c.visible,blend:c.blendMode}))}));
      l.updateBeastAnimations(325);const initial=read();
      const timing={default:a.defaultClip,delay:a.frameDuration,looped:a.looped,beast4Delay:b.frameDuration};
      const trigger=l._animationTriggers[0];l._playAnimationTrigger(trigger);l.updateBeastAnimations(425);
      window._animTimer=425;const expected=read(),saved=l.captureRuntimeState();
      l.updateBeastAnimations(700);l.resetAnimationTriggers();l.restoreRuntimeState(saved);
      const restored=read(),clip=a.clip;
      l.updateBeastAnimations(451);const nextClip=a.clip,nextLooped=a.looped;
      l.updateBeastAnimations(900);l.restoreRuntimeState(saved);const twice=read();
      l.updateBeastAnimations(10000);l.resetAnimationTriggers();l.updateBeastAnimations(325);
      const restarted=read();r.update(0);
      const drawn=r.buckets.flat().filter(i=>a.sprites.some(sp=>r.frames.get(sp.frame.name)===i.part.info)).length;
      r.debugItems=false;
      return {initial,expected,restored,twice,restarted,clip,nextClip,nextLooped,timing,drawn,colorCount:a.sprites.filter(sp=>sp._eeBeastColorSprite).length,
        beast4ColorCount:b.sprites.filter(sp=>sp._eeBeastColorSprite).length,z:a.node.zLayer,kind:a.node.kind};
    });
    assert.equal(beasts.colorCount,2);assert.equal(beasts.beast4ColorCount,3);
    assert.equal(beasts.z,5);assert.equal(beasts.kind,'fire');assert.ok(beasts.drawn>=5);
    for(const p of beasts.initial)for(const c of p.companions){assert.equal(c.x,p.x);assert.equal(c.y,p.y);assert.equal(c.rot,p.rot);assert.equal(c.sx,p.sx);assert.ok(c.visible);}
    assert.deepEqual(beasts.restored,beasts.expected);assert.deepEqual(beasts.twice,beasts.expected);
    assert.deepEqual(beasts.restarted,beasts.initial);assert.equal(beasts.clip,'GJBeast01_attack01');
    assert.deepEqual(beasts.timing,{default:'GJBeast01_bite',delay:25,looped:true,beast4Delay:60});
    assert.equal(beasts.nextClip,'GJBeast01_attack01_loop');assert.equal(beasts.nextLooped,true);
    console.log('PASS animated beast colour layers, attached eye, native batch order, restart and reusable checkpoint');
    await load(0, 'kA4,0;1,211,2,500,3,100,343,3;' +
      '1,3017,2,0,344,3,222,400,241,1,237,80,239,40;' +
      '1,3018,2,0,344,3,222,400,270,90;' +
      '1,3019,2,0,344,3,222,400,233,0.5,235,2;' +
      '1,3020,2,0,344,3,222,400;', 'Custom Enter GPU');
    const customEnter = await page.evaluate(() => {
      const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer,o=l.gdObjects[0];
      s._paused=true;s._slideIn=false;s._menuActive=false;
      l.checkEnterEffectTriggers(0);r.colorManager=s._colorManager;r.debugItems=true;
      r.setCamera(0,0);r.camera.w=600;
      const draw=legacy=>{r.legacyPrepare=legacy;r.update(0);const item=r.buckets.flat().find(i=>i.part===o.parts.find(p=>p.role===0));return {m:item.m.slice(),center:[item.m[4]+15*(item.m[0]+item.m[2]),item.m[5]+15*(item.m[1]+item.m[3])],opacity:item.opacity,color:item.color.slice(),quads:r.quadCount};};
      const fast=draw(false), general=draw(true),saved=l.captureRuntimeState();
      l.enterState.reset();const stopped=draw(false);
      const restored=[];for(let n=0;n<2;n++){l.restoreRuntimeState(saved);restored.push(draw(false));l.enterState.reset();}
      l.restoreRuntimeState(saved);o.ignoreFade=true;const noFade=draw(false);
      r.debugItems=false;r.legacyPrepare=false;
      return {fast,general,stopped,restored,noFade,sourceX:o.x,sourceY:o.y};
    });
    assert.deepEqual(customEnter.fast,customEnter.general,'long custom effects match in both preparation paths');
    assert.ok(Math.abs(customEnter.fast.center[0]-440)<1e-6&&Math.abs(customEnter.fast.center[1]-70)<1e-6,JSON.stringify(customEnter));
    assert.ok(Math.abs(customEnter.fast.opacity-63/255)<1e-6);
    assert.equal(customEnter.stopped.center[0],500);
    for(const restored of customEnter.restored)assert.deepEqual(restored,customEnter.fast);
    assert.equal(customEnter.noFade.opacity,1);assert.ok(Math.abs(customEnter.noFade.center[0]-440)<1e-6);
    assert.equal(customEnter.sourceX,500);assert.equal(customEnter.sourceY,100);
    console.log('PASS custom Enter WebGL geometry, opacity, fast-path parity, No Fade and repeated checkpoint restore');
    await load(0, fs.readFileSync(path.join(root,'work/fixtures/skeletal.txt'),'utf8'), 'Skeletal logo intro and skip');
    const skeletalIntro = await page.evaluate(async () => {
      const s=window.scene.get('GameScene');
      s._level.logicState.persistent.clear(); s._level._itemCounts.delete(5);
      s._restartLevel(); s._slideIn=false; s._menuActive=false; s._levelSelectOverlay=null;
      s._paused=false; s._releaseButton(); window.noClip=true;
      for(let i=0;i<480;i++){s.update(i*1000/60,1000/60);s.sys.events.emit('postupdate',i*1000/60,1000/60);}
      s._paused=true;
      const l=s._level,r=l.gdRenderer;
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      const result={heldX:s._playerWorldX,ui:r.uiObjects.size,shaderMax:l.shaderState.s.zMax,
        logoDrawn:r.quadCount,uiDrawn:r.ranges.some(range=>range.overlay&&range.screen&&range.count),
        cameraTarget:l.cameraState.targets.x?.group,
        hiddenHelpers:[...r.uiObjects].filter(o=>o.levelObj._raw?.[135]==='1').every(o=>o.hidden),
        legacyPads:l.objects.filter(o=>o._padParticleEmitter).length,
        nativePads:r.particleSystems.filter(p=>p.ambient&&[8,9,10,34,44].includes(p.object.def.t)).length,
        uiEmitters:r.particleSystems.filter(p=>p.object.isUIObject&&p.viewCamera().x===0&&p.viewCamera().y===0).length};
      let calls=0,seconds=0;const updateAudio=s._audio.update;
      s._audio.update=dt=>{calls++;seconds+=dt;};s._paused=false;s.update(8000,1000/60);s._paused=true;s._audio.update=updateAudio;
      result.meterCalls=calls;result.meterSeconds=seconds;
      s._pushButton();s._releaseButton();s._paused=false;
      for(let i=0;i<180;i++){s.update(8017+i*1000/60,1000/60);s.sys.events.emit('postupdate',8017+i*1000/60,1000/60);}
      s._paused=true;
      result.afterSkipX=s._playerWorldX;result.holdEnabled=l._groupEnabled[1835];result.attemptItem=l._itemCounts.get(5);
      return result;
    });
    assert.ok(Math.abs(skeletalIntro.heldX)<1e-6&&skeletalIntro.ui>50&&skeletalIntro.uiDrawn,JSON.stringify(skeletalIntro));
    assert.equal(skeletalIntro.shaderMax,1);assert.equal(skeletalIntro.cameraTarget,1758);assert.ok(skeletalIntro.logoDrawn>100);
    assert.ok(skeletalIntro.hiddenHelpers); assert.equal(skeletalIntro.legacyPads,0);
    assert.ok(skeletalIntro.nativePads>0&&skeletalIntro.uiEmitters>0,JSON.stringify(skeletalIntro));
    assert.equal(skeletalIntro.meterCalls,1);assert.ok(Math.abs(skeletalIntro.meterSeconds-1/60)<1e-10);
    assert.ok(skeletalIntro.afterSkipX>500&&!skeletalIntro.holdEnabled&&skeletalIntro.attemptItem===1,JSON.stringify(skeletalIntro));
    console.log('PASS actual Skeletal logo UI, shader order, one audio sample per frame and clickable intro skip');
    await load(0, fs.readFileSync(path.join(root,'work/fixtures/ispy.txt'),'utf8'), 'iSpy repeatable following orb');
    const ispyOrb = await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,c=l.objects.find(o=>o.orbId===36&&o.multiActivate);
      const nearby=l.getNearbySectionObjects;
      Object.assign(p.p,new PlayerState());p.enterBallMode();
      s._playerWorldX=c.x;Object.assign(p.p,{y:c.y,lastY:c.y,onGround:false,canJump:false});
      p._lastCollisionWorldX=c.x;p._lastCollisionWorldY=c.y;
      l.getNearbySectionObjects=()=>[c];window.noClip=false;const velocities=[];
      const mark=p._setObjectActivated;let activations=0;
      p._setObjectActivated=function(object,active){if(object===c&&active)activations++;return mark.call(this,object,active);};
      try {for(let i=0;i<3;i++){
        p.p.yVelocity=0;
        p.p._orbActivationConsumedForPress=false;p.p.upKeyDown=true;p.p.upKeyPressed=true;p.p.queuedHold=true;
        p.checkCollisions(c.x-centerX);velocities.push(p.p.yVelocity);p.p.upKeyDown=false;p.p.upKeyPressed=false;
      }} finally {l.getNearbySectionObjects=nearby;p._setObjectActivated=mark;window.noClip=true;}
      return {velocities,activations,used:p._isObjectActivated(c),multi:c.multiActivate,dead:p.p.isDead};
    });
    assert.equal(ispyOrb.activations,3);assert.ok(ispyOrb.velocities.every(v=>v>0),JSON.stringify(ispyOrb));
    assert.ok(ispyOrb.multi&&!ispyOrb.used&&!ispyOrb.dead,JSON.stringify(ispyOrb));
    console.log('PASS actual iSpy Multi Activate yellow orb responds to three separate presses');
    await load(0, 'kA4,0;1,10,2,100,3,100,135,1;1,10,2,200,3,100,507,1;1,10,2,300,3,100,116,1;1,10,2,400,3,100,57,71;1,3610,2,600,3,100,128,5.75;1,3611,2,800,3,100,128,2;', 'Portal particles and damage shapes');
    const effectLifecycle=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,q=s._player2;
      const emitters=(l._legacyEmitters||[]).filter(e=>e._eeWorldX<=800);
      const square=l.objects.find(o=>o._eeLevelObject?.id===3610),circle=l.objects.find(o=>o._eeLevelObject?.id===3611);
      p.p.isWave=true;s._enableDualMode();q._waveTrail.start();q._waveTrail.setPosition(100,100);q._waveTrail.update(.01);q._waveTrail.setPosition(150,150);q._waveTrail.update(.01);
      q._streak.start();q._streak.setPosition(100,100);q._streak.update(.01);q._streak.setPosition(150,150);q._streak.update(.01);
      s._disableDualMode();const fade=q._waveTrail._fadeLeft;
      for(let i=0;i<90;i++)q.updateInactiveTrails(20,30,1/240);
      const result={emitters:emitters.map(e=>({x:e._eeWorldX,groups:e._eeGroups,registered:l._groupSprites[71]?.includes(e)})),
        square:{w:square.w,h:square.h,r:square.hitbox_radius??null},circle:circle.hitbox_radius,
        fade,wavePoints:q._waveTrail._pts.length,streakPoints:q._streak._pts.length,active:q._waveTrail._active,
        emitting:[q._particleEmitter,q._flyParticleEmitter,q._flyParticle2Emitter,q._shipDragEmitter].some(e=>e.emitting),trailXY:[q._trailContainer.x,q._trailContainer.y]};
      s._paused=true;return result;
    });
    assert.deepEqual(effectLifecycle.emitters,[{x:800,groups:[71],registered:true}]);
    assert.deepEqual(effectLifecycle.square,{w:345,h:60,r:null});assert.equal(effectLifecycle.circle,60);
    assert.ok(effectLifecycle.fade>0);assert.equal(effectLifecycle.wavePoints,0);assert.equal(effectLifecycle.streakPoints,0);assert.equal(effectLifecycle.active,false);assert.equal(effectLifecycle.emitting,false);assert.deepEqual(effectLifecycle.trailXY,[-20,30]);
    console.log('PASS hidden/No Particles/No Effects portal emitters, group ownership, damage square geometry and dual trail expiry');
    await load(0,'kA4,0;1,1330,2,100,3,100;1,1,2,100,3,0;1,1,2,100,3,300;','Spider drop-ring buffer');
    const dropBuffer=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,c=l.objects.find(o=>o.orbId===1330),near=l.getNearbySectionObjects;
      Object.assign(p.p,new PlayerState());p.p.isSpider=true;Object.assign(p.p,{y:200,lastY:200,onGround:false,canJump:false,upKeyDown:true,upKeyPressed:true,queuedHold:true});
      s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=200;window.noClip=false;l.getNearbySectionObjects=()=>[c];
      p.checkCollisions(200-centerX);const velocity=p.p.yVelocity,buffer=p.p.upKeyPressed;
      l.getNearbySectionObjects=near;p.p.y=57;p.p.lastY=57;p.p.yVelocity=0;p.p.onGround=p.p.canJump=true;
      p.updateJump(0);const result={velocity,buffer,y:p.p.y,g:p.p.gravityFlipped,press:p.p.upKeyPressed,dead:p.p.isDead};s._paused=true;return result;
    });
    assert.ok(Math.abs(dropBuffer.velocity-Math.fround(-15*Math.fround(1.1))*2)<1e-6,JSON.stringify(dropBuffer));
    assert.ok(dropBuffer.buffer&&dropBuffer.g&&!dropBuffer.press&&!dropBuffer.dead,JSON.stringify(dropBuffer));assert.equal(dropBuffer.y,543);
    console.log('PASS black orb retains the spider landing buffer, applies native impulse and permits one return teleport');
    await load(0,'kA4,0;1,1,2,300,3,100;', 'Turned spider pointer');
    const turnedSpiderInput=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,frame=l.gameplayState;
      Object.assign(p.p,new PlayerState());Object.assign(p.p,{isSpider:true,y:200,lastY:200,onGround:true,canJump:true});
      s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=200;
      Object.assign(frame,{u:{x:0,y:1},v:{x:1,y:0},origin:{x:0,y:0}});
      p._spiderTeleportBand=()=>({floor:0,ceil:1000});s._paused=false;s._menuActive=s._slideIn=false;s._levelWon=false;window.noClip=false;
      s._pushButton();s._paused=true;delete p._spiderTeleportBand;
      return {x:s._playerWorldX,y:p.p.y,local:s._localPhysicsActive,nearRestored:!Object.hasOwn(l,'getSpiderSearchObjects'),g:p.p.gravityFlipped,dead:p.p.isDead};
    });
    assert.equal(turnedSpiderInput.x,543);assert.equal(turnedSpiderInput.y,200);assert.ok(turnedSpiderInput.g&&!turnedSpiderInput.local&&!turnedSpiderInput.dead&&turnedSpiderInput.nearRestored,JSON.stringify(turnedSpiderInput));
    console.log('PASS immediate spider pointer input enters the rotated collision frame and restores world coordinates');
    const lensClampGPU=await page.evaluate(async()=>{
      const s=window.scene.get('GameScene'),sh=s._level.shaderState;
      sh.trigger({id:2913,raw:{176:'10',179:'1',181:'1',10:'0'}});
      s._level.cameraState.updateVisual();await new Promise(requestAnimationFrame);
      return {strength:sh.uniforms()._lensCircleStrength,error:s.game.renderer.gl.getError()};
    });
    assert.equal(lensClampGPU.strength,1);assert.equal(lensClampGPU.error,0);
    console.log('PASS native Lens Circle strength clamp reaches the live WebGL pipeline without errors');

    await load(0,'kA4,0;1,3022,2,10,3,100,6,-90,345,1,346,6;1,747,2,100,3,100,6,-90,54,100,345,1,346,10,354,2;', 'Native teleport launch forces');
    const teleportForces=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player;
      Object.assign(p.p,new PlayerState());Object.assign(p.p,{y:200,lastY:200,yVelocity:-18});
      s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=200;window.noClip=false;
      l.logicState.trigger(l._logicTriggers[0]);const launcher=p.p.yVelocity;
      p.p.yVelocity=6;p.checkCollisions(200-centerX);s._paused=true;
      return {launcher,portal:p.p.yVelocity,y:p.p.y,g:p.p.gravityFlipped,boost:p.p.boostLatch,dead:p.p.isDead};
    });
    assert.ok(Math.abs(teleportForces.launcher-12)<1e-5,JSON.stringify(teleportForces));
    assert.ok(Math.abs(teleportForces.portal-20)<1e-5,JSON.stringify(teleportForces));
    assert.equal(teleportForces.y,400);assert.ok(teleportForces.g&&teleportForces.boost&&!teleportForces.dead,JSON.stringify(teleportForces));
    console.log('PASS targetless Teleport launcher and paired portal apply native forces, gravity and live exit direction');

    await load(0,'kA4,0;1,1,2,100,3,0;1,1,2,100,3,600;', 'Free Mode distant spider landing');
    const distantSpider=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player;
      Object.assign(p.p,new PlayerState());Object.assign(p.p,{isSpider:true,y:57,lastY:57,onGround:true,canJump:true});
      l.cameraState.freeMode=true;s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=57;
      s._paused=false;s._menuActive=s._slideIn=false;s._levelWon=false;window.noClip=false;
      s._pushButton();s._paused=true;
      return {y:p.p.y,g:p.p.gravityFlipped,dead:p.p.isDead};
    });
    assert.deepEqual(distantSpider,{y:1143,g:true,dead:false});
    console.log('PASS real spider pointer reaches a Free Mode ceiling beyond the screen instead of the viewport edge');


    await load(0,'kA4,0;1,10,2,100,3,100,99,1;1,11,2,200,3,100,99,1;1,3005,2,500,3,100,128,2,129,3;', 'Reusable gravity portals');
    const reusablePortals=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player;
      Object.assign(p.p,new PlayerState());p._resetSlopeState();p.p.gravityFlipped=true;window.noClip=false;
      const flips=[];
      for(const x of [200,400,200,400]){
        s._playerWorldX=x;Object.assign(p.p,{y:200,lastY:200,yVelocity:0});p._lastCollisionWorldX=x;p._lastCollisionWorldY=200;
        p.checkCollisions(x-centerX);flips.push(p.p.gravityFlipped);
      }
      const pad=l.objects.find(o=>o.padId===3005);s._paused=true;
      return {flips,dead:p.p.isDead,pad:[pad.w,pad.h]};
    });
    assert.deepEqual(reusablePortals,{flips:[false,true,false,true],dead:false,pad:[114,90]});
    console.log('PASS reusable gravity portals reverse each crossing and spider pads use untrimmed atlas dimensions');

    await load(0,'kA4,0;1,13,2,100,3,300;1,13,2,400,3,300,111,1;', 'Same-mode Free Mode ground');
    const freeGroundLayers=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,portals=l.objects.filter(o=>o.type==='portal_fly');
      Object.assign(p.p,new PlayerState());p.p.y=600;p.enterShipMode(portals[0]);l.stepGroundAnimation(.5);
      const before=l._groundTargetValue;
      s._playerWorldX=800;p._lastCollisionWorldX=800;p._lastCollisionWorldY=600;Object.assign(p.p,{y:600,lastY:600,yVelocity:0});
      window.noClip=false;p.checkCollisions(800-centerX);l.stepGroundAnimation(.4);s._cameraY=1000;
      s._menuActive=false;window.isEditor=false;l.cameraState.attach();
      Object.assign(l.cameraState.values,{zoom:.5,rotation:30,staticY:1});l.cameraState.targets.y={point:{x:100,y:1000}};
      l.cameraState.updateVisual();l.updateGroundTiles(1000);s._paused=true;
      return {before,after:l._groundTargetValue,ship:p.p.isFlying,free:l.cameraState.freeMode,ceiling:l.getCeilingY(),floor:l.getFloorY(),
        ceilingVisible:l._ceilingTiles.some(o=>o.visible),dead:p.p.isDead,groundY:l._groundTiles[0].y};
    });
    assert.deepEqual(freeGroundLayers,{before:1,after:0,ship:true,free:true,ceiling:null,floor:0,ceilingVisible:false,dead:false,groundY:1458});
    console.log('PASS a same-mode Free Mode portal retracts the actual ground/ceiling images without resetting the ship');

    await load(0,'kA4,0;1,1,2,100,3,100;1,289,2,300,3,100;', 'Native block edges and slope landing');
    const landingEdges=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,l=s._level,edges=[];window.noClip=false;
      for(const mini of [false,true])for(const gravity of [false,true]){
        Object.assign(p.p,new PlayerState());p._resetSlopeState();const half=mini?18:30,fm=gravity?-1:1,x=230+half-2,y=200+fm*(30+half);
        Object.assign(p.p,{isMini:mini,gravityFlipped:gravity,y:y-fm*.1,lastY:y+fm*.1,yVelocity:-fm,onGround:true});
        s._playerWorldX=x;p._lastCollisionWorldX=x;p._lastCollisionWorldY=p.p.lastY;
        p.checkCollisions(x-centerX);edges.push({y:p.p.y,expected:y,ground:p.p.onGround,dead:p.p.isDead});
      }
      Object.assign(p.p,new PlayerState());p._resetSlopeState();const y=200+30*Math.SQRT2;
      Object.assign(p.p,{y:y-.1,lastY:y+.2,yVelocity:-1,isJumping:true,onGround:false});
      s._playerWorldX=600;p._lastCollisionWorldX=599;p._lastCollisionWorldY=p.p.lastY;
      p.checkCollisions(600-centerX);s._paused=true;
      return {edges,slope:{ride:p._slopeRiding,ground:p.p.onGround,jumping:p.p.isJumping,dead:p.p.isDead}};
    });
    for(const e of landingEdges.edges){assert.ok(Math.abs(e.y-e.expected)<1e-5,JSON.stringify(e));assert.ok(e.ground&&!e.dead,JSON.stringify(e));}
    assert.deepEqual(landingEdges.slope,{ride:true,ground:true,jumping:false,dead:false});
    console.log('PASS full and mini bodies retain the last block-edge pixels in both gravities, and launched bodies acquire a slope ride');

    await load(0,'kA4,0;1,67,2,100,3,100,6,180;1,67,2,100,3,100,6,180;', 'Blue pad gravity gate');
    const bluePadGate=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player,pads=l.objects.filter(o=>o.padId===67),out=[];
      // Inverted-facing pads flip an inverted body; include an exact outer
      // face touch, which native CCRect accepts before testing activation.
      Object.assign(p.p,new PlayerState());Object.assign(p.p,{isMini:true,gravityFlipped:true,y:224,lastY:224});
      s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=224;window.noClip=false;
      p.checkCollisions(200-centerX);const edgeContact=!p.p.gravityFlipped&&p._isObjectActivated(pads[0]);
      for(const mode of ['cube','isBall','isSpider','isSwing','isFlying','isUfo','isRobot'])for(const flipY of [false,true])for(const gravity of [false,true]){
        for(const o of pads){o.activated=false;o._activatedByPlayer={};o._eeLevelObject.flipY=flipY;}
        Object.assign(p.p,new PlayerState());if(mode!=='cube')p.p[mode]=true;
        Object.assign(p.p,{y:200,lastY:200,gravityFlipped:gravity});s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=200;window.noClip=false;
        p.checkCollisions(200-centerX);
        out.push({mode,flipY,gravity,g:p.p.gravityFlipped,active:pads.map(o=>p._isObjectActivated(o)),dead:p.p.isDead});
      }
      // Pad activation is remembered separately for the two dual players.
      const o=pads[0],p2=s._player2;Object.assign(p2.p,new PlayerState());o._activatedByPlayer={};
      p._setObjectActivated(o,true);const independent=!p2._isObjectActivated(o);s._paused=true;return {out,independent,edgeContact};
    });
    for(const r of bluePadGate.out){
      const fires=r.gravity===!r.flipY;
      assert.deepEqual(r.active,[fires,false],JSON.stringify(r));
      assert.equal(r.g,fires?!r.gravity:r.gravity,JSON.stringify(r));assert.ok(!r.dead,JSON.stringify(r));
    }
    assert.ok(bluePadGate.independent);
    assert.ok(bluePadGate.edgeContact,'an exact pad face touch activates');
    console.log('PASS blue pads require a gravity change, do not double-flip on overlap and keep separate dual-player activation');

    // The upper red-room slab from Skeletal: its 90-degree turn swaps a
    // 180x300 rectangle into 300x180. The search already used that shape;
    // ordinary solid resolution must retain the landing on following ticks.
    await load(0,'kA4,0;1,94,2,1155,3,2565,6,90,128,3,129,5;1,1,2,1155,3,2460;', 'Turned solid spider landing');
    const turnedSolidLanding=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,l=s._level;
      p.enterSpiderMode();Object.assign(p.p,{y:4947,lastY:4947,yVelocity:0,onGround:true,canJump:true,gravityFlipped:false});
      s._playerWorldX=2310;p._lastCollisionWorldX=2310;p._lastCollisionWorldY=4947;l.cameraState.freeMode=true;
      window.noClip=false;s._menuActive=s._slideIn=s._levelWon=false;s._paused=false;
      s._pushButton();s._releaseButton();const arrival=p.p.y;
      const samples=[];for(let i=0;i<24&&!p.p.isDead;i++){s.constructor.prototype.update.call(s,i*1000/240,1000/240);samples.push({y:p.p.y,g:p.p.gravityFlipped,ground:p.p.onGround,dead:p.p.isDead});}
      s._paused=true;return {arrival,samples};
    });
    assert.equal(turnedSolidLanding.arrival,5013);assert.equal(turnedSolidLanding.samples.length,24);
    assert.ok(turnedSolidLanding.samples.every(q=>q.y===5013&&q.g&&q.ground&&!q.dead),JSON.stringify(turnedSolidLanding));
    console.log('PASS Skeletal turned upper slab retains a real spider teleport for 24 normal collision ticks');

    await load(0,'kA4,0;1,1,2,100,3,0;1,36,2,200,3,100;1,1612,2,50000,3,0;', 'Hidden player effects lifecycle');
    const hiddenEffects=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,p=s._player;
      const orb=l.gdObjects[1],ambient=orb.ambientParticleSystem;
      ambient.reset();orb.hidden=true;l.gdRenderer.update(.2);const hiddenAmbient=ambient.particles.length;
      Object.assign(p.p,new PlayerState());p.p.isWave=true;s._playerWorldX=200;p.p.y=100;
      p._waveTrail.start();p._waveTrail.setPosition(100,100);p._waveTrail.update(.01);p._waveTrail.setPosition(200,150);p._waveTrail.update(.01);
      p._streak.start();p._streak.setPosition(100,100);p._streak.update(.01);p._streak.setPosition(200,150);p._streak.update(.01);
      p._flyParticleEmitter.explode(5,200,100);
      const fx=s.add.graphics();l.container.add(fx);p._spiderTeleportCircles.push(fx);
      const mask=()=>s.cameras.cameras.reduce((m,c)=>m|c.id,0);
      l.logicState.trigger({id:1612,raw:{138:'1'}});l.cameraState.updateVisual();
      const filtered=(fx.cameraFilter&mask())===mask(),sharedVisible=(l.container.cameraFilter&mask())!==mask(),trailFiltered=(p._trailContainer.cameraFilter&mask())===mask();
      l.logicState.trigger({id:1613,raw:{138:'1'}});l.cameraState.updateVisual();
      const restored=(fx.cameraFilter&mask())!==mask();
      l.logicState.trigger({id:1612,raw:{138:'1'}});p._updateParticles(0,0,1/60);
      const hidden={wave:p._waveTrail._pts.length,streak:p._streak._pts.length,particles:p._flyParticleEmitter.getAliveParticleCount(),fx:p._spiderTeleportCircles.length,emitting:p._flyParticleEmitter.emitting};
      s._playerWorldX=1800;l.logicState.trigger({id:1613,raw:{138:'1'}});p._updateParticles(0,0,1/60);l.cameraState.updateVisual();
      return {filtered,sharedVisible,trailFiltered,restored,hidden,hiddenAmbient,resumed:p._waveTrail._pts.map(q=>({x:q.x,y:q.y}))};
    });
    assert.ok(hiddenEffects.filtered&&hiddenEffects.sharedVisible&&hiddenEffects.trailFiltered&&hiddenEffects.restored,JSON.stringify(hiddenEffects));
    assert.deepEqual(hiddenEffects.hidden,{wave:0,streak:0,particles:0,fx:0,emitting:false});
    assert.equal(hiddenEffects.hiddenAmbient,0);
    assert.equal(hiddenEffects.resumed.length,1);assert.equal(hiddenEffects.resumed[0].x,1800);
    console.log('PASS Hide/Show Player filters shared-layer effects and trails, clears particles and resumes without a connecting streak');
    await load(0,'kA4,0;1,35,2,100,3,100,41,1,43,0a1a1a0a0;1,3604,2,0,51,5,430,45;1,1049,2,0,51,9,56,1,57,5,62,1;1,1612,2,50000,3,0;', 'Pad-launched cube trail');
    const launchedTrail=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player;
      const l=s._level;l._groupEnabled[9]=false;
      l.logicState.trigger(l._logicTriggers.find(t=>t.id===3604));
      Object.assign(p.p,new PlayerState(),{y:200,lastY:200});s._playerWorldX=200;window.noClip=false;
      p.checkCollisions(200-centerX);const vy=p.p.yVelocity;
      p._updateParticles(0,0,1/240);
      s._playerWorldX=230;p.p.y+=30;p._updateParticles(0,0,1/60);
      const airborne={active:p._streak._active,points:p._streak._pts.length};
      p.hitGround(true);p._updateParticles(0,0,1/60);
      const landing={active:p._streak._active,points:p._streak._pts.length};
      p._updateParticles(0,0,.35);
      const expired=p._streak._pts.length;
      p.enterUfoMode();p.p.jumpTrailActive=true;p._streak.start();
      p.enterBallMode();p._updateParticles(0,0,1/60);
      return {vy,airborne,landing,expired,padEvent:l._groupEnabled[9],modeTrail:{flag:p.p.jumpTrailActive,active:p._streak._active,points:p._streak._pts.length}};
    });
    assert.ok(launchedTrail.vy>0);assert.equal(launchedTrail.airborne.active,true);assert.ok(launchedTrail.airborne.points>=2);
    assert.equal(launchedTrail.landing.active,false);assert.ok(launchedTrail.landing.points>0);assert.equal(launchedTrail.expired,0);
    assert.equal(launchedTrail.padEvent,true);
    assert.deepEqual(launchedTrail.modeTrail,{flag:false,active:false,points:0});
    console.log('PASS a pad-launched cube dispatches Yellow Pad through an Event trigger, draws a continuous trail and lets it fade on landing');

    await load(0,'kA4,0;1,140,2,100,3,100,99,1;1,1612,2,50000,3,0;', 'Multi-use pad contact rearming');
    const padRearm=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player;
      Object.assign(p.p,new PlayerState(),{isUfo:true,isCube:false,y:200,lastY:200});window.noClip=false;
      s._playerWorldX=200;p.checkCollisions(200-centerX);const first=p.p.yVelocity;
      p.p.yVelocity=7;p.checkCollisions(200-centerX);const held=p.p.yVelocity;
      const checkpoint=p.captureSlopeState();p.checkCollisions(500-centerX);
      p.p.yVelocity=3;p.checkCollisions(200-centerX);const returned=p.p.yVelocity;
      p.restoreSlopeState(checkpoint);p.p.yVelocity=5;p.checkCollisions(200-centerX);
      return {first,held,returned,restored:p.p.yVelocity};
    });
    assert.deepEqual(padRearm,{first:12.800000190734863,held:7,returned:12.800000190734863,restored:5});
    console.log('PASS a multi-use pad fires once per contact, rearms after leaving and preserves its contact at a checkpoint');

    await load(0,'kA4,0;1,2902,2,100,3,100,51,4,353,1,99,1;1,3809,2,400,3,100,57,4;', 'Independent dual teleport');
    const independentDual=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,p2=s._player2;
      Object.assign(p.p,new PlayerState(),{y:200,lastY:200});s._playerWorldX=200;s._enableDualMode();
      for(const q of [p,p2])for(const trail of [q._streak,q._waveTrail]){
        trail.start();trail.setPosition(100,100);trail.update(.01);
        trail.setPosition(140,140);trail.update(.01);
      }
      window.noClip=false;p2.checkCollisions(200-centerX);
      const position={p1:s._playerWorldX,p2:s._secondaryWorldX,y:p2.p.y,dead:p2.p.isDead};
      const trails={p1:[p._streak._pts.length,p._waveTrail._pts.length],p2:[p2._streak._pts.length,p2._waveTrail._pts.length],
        emitting:[p2._streak._active,p2._waveTrail._active]};
      p.p.gravityFlipped=false;p2.p.gravityFlipped=false;p2.p.isCube=false;p2.p.isUfo=true;
      const asymmetric=s._syncDualGlobalsFromSecondary();
      const g=p.p.gravityFlipped;p2.p.isUfo=false;p2.p.isCube=true;
      const matching=s._syncDualGlobalsFromSecondary();
      s._level.logicState.options.unlinkDualGravity=true;
      return {position,trails,asymmetric,g,matching,unlinked:s._syncDualGlobalsFromPrimary()};
    });
    assert.deepEqual(independentDual,{position:{p1:200,p2:800,y:200,dead:false},trails:{p1:[2,2],p2:[0,0],emitting:[true,true]},asymmetric:false,g:false,matching:true,unlinked:false});
    console.log('PASS green group portals move P2 and reset its two trails independently; asymmetric modes and Unlink Dual Gravity preserve independent gravity');
    for(const targetX of [400,4000]) {
    await load(0,`kA4,0;1,140,2,${targetX},3,100;1,2902,2,100,3,100,51,4,353,1,99,1;1,3809,2,${targetX},3,100,57,4;1,1612,2,50000,3,0;`, 'Teleport destination pad');
    const destinationPad=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,p2=s._player2;
      Object.assign(p.p,new PlayerState(),{y:200,lastY:200});s._playerWorldX=200;s._enableDualMode();
      Object.assign(p2.p,{isUfo:true,isCube:false,gravityFlipped:false});window.noClip=false;
      p2.checkCollisions(200-centerX);
      const arrived={x:s._secondaryWorldX,vy:p2.p.yVelocity,primary:s._playerWorldX,dead:p2.p.isDead};
      p2.p.yVelocity=7;p2.checkCollisions(s._secondaryWorldX-centerX);
      return {arrived,held:p2.p.yVelocity};
    });
    assert.deepEqual(destinationPad,{arrived:{x:targetX*2,vy:12.800000190734863,primary:200,dead:false},held:7});
    }
    console.log('PASS teleporting to another section activates the destination pad in the same tick, once');
    await load(0,'kA4,0;1,1612,2,50000,3,0;', 'UFO mode velocity transitions');
    const ufoVelocity=await page.evaluate(()=>{
      const p=window.scene.get('GameScene')._player;
      p.p.yVelocity=10;p.enterUfoMode();const entered=p.p.yVelocity;
      p.enterUfoMode();const repeated=p.p.yVelocity;
      p.exitUfoMode();const exited=p.p.yVelocity;
      p.p.yVelocity=10;p.enterUfoMode(null,true);
      return {entered,repeated,exited,checkpoint:p.p.yVelocity};
    });
    assert.deepEqual(ufoVelocity,{entered:5,repeated:5,exited:2.5,checkpoint:10});
    console.log('PASS entering and leaving UFO halves velocity once; checkpoint restoration preserves velocity');
    const spiderMomentum=await page.evaluate(()=>{
      const p=window.scene.get('GameScene')._player;
      p.exitUfoMode();p.enterSpiderMode();p.p.yVelocity=-20;p.enterUfoMode();
      return {spider:p.p.isSpider,ufo:p.p.isUfo,vy:p.p.yVelocity};
    });
    assert.deepEqual(spiderMomentum,{spider:false,ufo:true,vy:-10});
    console.log('PASS spider-to-UFO transition retains momentum and halves it once');
    await load(0,'kA4,0;1,140,2,100,3,100;1,1612,2,50000,3,0;', 'Exit through secondary player');
    const secondaryExit=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,p2=s._player2;
      s._enableDualMode();s._setPlayerGamemode(p2,s._state2,'ship',true);
      Object.assign(s._state2,{y:600,lastY:599,yVelocity:7,isMini:true,gravityFlipped:true});
      s._secondaryWorldX=1600;p2._setObjectActivated(s._level.objects[0],true);
      s._disableDualMode(p2);
      return {dual:s._isDual,x:s._playerWorldX,y:s._state.y,vy:s._state.yVelocity,
        mini:s._state.isMini,g:s._state.gravityFlipped,mode:s._getDualModeId(s._state),
        alive:!s._state.isDead,secondaryDead:s._state2.isDead,used:p._isObjectActivated(s._level.objects[0])};
    });
    assert.deepEqual(secondaryExit,{dual:false,x:1600,y:600,vy:7,mini:true,g:true,mode:'ship',alive:true,secondaryDead:true,used:true});
    console.log('PASS a dual exit touched by P2 transfers position, mode, velocity and activation state to P1');
    await load(0,'kA4,0;1,1612,2,50000,3,0;', 'Linked and unlinked dual spawning');
    const dualSpawns=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),results=[];
      for(const unlink of [false,true])for(const flipped of [false,true]) {
        Object.assign(s._state,{gravityFlipped:flipped,yVelocity:flipped?-4:4});
        s._level.logicState.options.unlinkDualGravity=unlink;s._enableDualMode();
        results.push([s._state2.gravityFlipped,s._state2.yVelocity]);s._disableDualMode();
      }
      return results;
    });
    assert.deepEqual(dualSpawns,[[true,-4],[false,4],[false,4],[true,-4]]);
    console.log('PASS linked dual spawn mirrors gravity and velocity; Unlink Dual Gravity copies both');
    await load(0,'kA4,0;1,1,2,100,3,100;', 'Ball and swing opposite surface');
    const oppositeSurfaces=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,results=[];
      for(const mode of ['ball','swing']) {
        Object.assign(s._state,new PlayerState());s._setPlayerGamemode(p,s._state,mode);
        Object.assign(s._state,{y:150,lastY:140,yVelocity:20,onGround:false,canJump:false,gravityFlipped:false});
        s._playerWorldX=200;p._lastCollisionWorldX=200;p._lastCollisionWorldY=140;window.noClip=false;
        p.checkCollisions(200-centerX);results.push({mode,y:p.p.y,vy:p.p.yVelocity,ground:p.p.onGround,dead:p.p.isDead});
      }
      s._paused=true;return results;
    });
    assert.deepEqual(oppositeSurfaces,[{mode:'ball',y:140,vy:0,ground:false,dead:false},{mode:'swing',y:140,vy:0,ground:false,dead:false}]);
    console.log('PASS ball and swing stop at the opposite solid face without a cube-style head death');

    await load(0,'kA4,0;1,1,2,100,3,100;', 'Rising mini robot ledge');
    const ledgeContacts=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,results=[];
      for(const inverted of [false,true])for(const descending of [false,true]) {
        Object.assign(s._state,new PlayerState());s._setPlayerGamemode(p,s._state,'robot');
        const sign=inverted?-1:1,y=200+sign*35,lastY=y-sign*4;
        Object.assign(s._state,{isMini:true,y,lastY,yVelocity:sign*(descending?-8:8),onGround:false,canJump:false,gravityFlipped:inverted});
        s._playerWorldX=168;p._lastCollisionWorldX=168;p._lastCollisionWorldY=lastY;
        p._groundColliderId=null;window.noClip=false;p.checkCollisions(168-centerX);
        results.push({inverted,descending,y:s._state.y,dead:s._state.isDead,ground:s._state.onGround,vy:s._state.yVelocity});
      }
      s._paused=true;return results;
    });
    assert.deepEqual(ledgeContacts,[
      {inverted:false,descending:false,y:235,dead:false,ground:false,vy:8},
      {inverted:false,descending:true,y:248,dead:false,ground:true,vy:0},
      {inverted:true,descending:false,y:165,dead:false,ground:false,vy:-8},
      {inverted:true,descending:true,y:152,dead:false,ground:true,vy:0}
    ]);
    console.log('PASS rising mini robots clear an inset ledge without dying or snapping; descending robots land in either gravity');

    await load(0,'kA4,0;1,1743,2,100,3,130,4,1;1,1903,2,127.5,3,112;', 'Descending ramp to solid seam');
    const rampSeam=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,l=s._level;
      Object.assign(s._state,new PlayerState());s._setPlayerGamemode(p,s._state,'ball');
      Object.assign(s._state,{y:268,lastY:271,yVelocity:0,onGround:true,canJump:false,gravityFlipped:false});
      const ramp=l.objects.find(o=>o.type==='slope');p._slopeRiding=true;p._prevSlopeObj=ramp;
      p._prevSlopeAngle=ramp.getSlopeAngleRad();p._slopeExitVel=-10;p._lastSlopeSeatY=271;p._seatSlopeId=ramp._eeObjectId;
      s._playerWorldX=240;p._lastCollisionWorldX=237;p._lastCollisionWorldY=271;window.noClip=false;
      p.checkCollisions(240-centerX);s._paused=true;
      return {y:s._state.y,dead:s._state.isDead,ground:s._state.onGround};
    });
    assert.deepEqual(rampSeam,{y:268,dead:false,ground:true});
    console.log('PASS a descending slope cannot pull a ball through its adjoining solid support');

    await load(0,'kA4,0;1,1,2,100,3,100;', 'Dart Slide inset face contact');
    const dartFaces=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,results=[];
      for(const inverted of [false,true])for(const slide of [false,true]) {
        Object.assign(s._state,new PlayerState());p._resetSlopeState();s._setPlayerGamemode(p,s._state,'wave');
        const y=inverted?168:232,lastY=inverted?166:234;
        Object.assign(s._state,{y,lastY,yVelocity:inverted?9:-9,onGround:false,gravityFlipped:inverted,stateDartSlide:slide?2:0});
        s._playerWorldX=200;p._lastCollisionWorldX=198;p._lastCollisionWorldY=lastY;window.noClip=false;
        p.checkCollisions(200-centerX);results.push({inverted,slide,y:s._state.y,dead:s._state.isDead});
      }
      s._paused=true;return results;
    });
    assert.deepEqual(dartFaces,[
      {inverted:false,slide:false,y:232,dead:true},{inverted:false,slide:true,y:240,dead:false},
      {inverted:true,slide:false,y:168,dead:true},{inverted:true,slide:true,y:160,dead:false}
    ]);
    console.log('PASS Dart Slide uses native flight-face tolerance in either gravity; ordinary wave still dies');

    await load(0,'kA4,0;1,1612,2,50000,3,0;', 'Secondary wave exit and ending trail');
    const waveExit=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player,q=s._player2;
      Object.assign(s._state,new PlayerState(),{y:200,lastY:200});s._playerWorldX=1000;s._enableDualMode();
      s._setPlayerGamemode(q,s._state2,'wave');s._secondaryWorldX=1200;
      s._disableDualMode(q);s._paused=true;
      return {mode:s._getDualModeId(s._state),active:p._waveTrail._active,regular:p._streak._active,secondary:q._waveTrail._active};
    });
    assert.deepEqual(waveExit,{mode:'wave',active:true,regular:true,secondary:false});
    await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),p=s._player;
      p._waveTrail.setPosition(1000,440);p._waveTrail.update(.01);p._waveTrail.setPosition(1200,440);p._waveTrail.update(.01);
      s._levelWon=true;s._paused=false;window.__endComplete=false;
      p.playEndAnimation(2100,()=>window.__endComplete=true,240);
    });
    await page.waitForTimeout(220);
    const movingEnd=await page.evaluate(()=>{const t=window.scene.get('GameScene')._player._waveTrail;return {x:t._pos.x,head:t._pts.at(-1)?.x,points:t._pts.length};});
    assert.ok(movingEnd.x>1200&&movingEnd.points>2,JSON.stringify(movingEnd));assert.equal(movingEnd.head,movingEnd.x);
    await page.waitForFunction(()=>window.__endComplete);
    assert.equal(await page.evaluate(()=>window.scene.get('GameScene')._player._waveTrail._pts.length),0);
    console.log('PASS P2 wave exit restarts the surviving trail; the end animation carries and clears it');

    await load(0,'kA4,0,kA8,1,kA10,1;1,1612,2,50000,3,0;', 'Independent two-player controls');
    const controls2P=await page.evaluate(()=>{
      const s=window.scene.get('GameScene');s._restartLevel();s._paused=false;s._slideIn=s._menuActive=false;s._waitingForLevelMusic=false;
      for(const [p,state] of [[s._player,s._state],[s._player2,s._state2]]){
        s._setPlayerGamemode(p,state,'wave');Object.assign(state,{y:240,lastY:240,upKeyDown:false,upKeyPressed:false});
      }
      s._pushButton();const primary=[s._state.upKeyDown,s._state2.upKeyDown];
      s._pushSecondPlayerButton();s._pressUnseen=false;s._releaseButton();const secondary=[s._state.upKeyDown,s._state2.upKeyDown];
      s._pressUnseen2=false;s._releaseSecondPlayerButton();
      const sync=s._syncDualGlobalsFromPrimary();s._paused=true;
      return {primary,secondary,sync};
    });
    assert.deepEqual(controls2P,{primary:[true,false],secondary:[false,true],sync:false});
    await page.evaluate(()=>{const s=window.scene.get('GameScene');s._paused=false;s._simulationBufferMs=0;});
    await page.keyboard.down('w');await page.waitForTimeout(40);
    assert.deepEqual(await page.evaluate(()=>{const s=window.scene.get('GameScene');return [s._state.upKeyDown,s._state2.upKeyDown];}),[true,false]);
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(40);await page.keyboard.up('w');await page.waitForTimeout(40);
    assert.deepEqual(await page.evaluate(()=>{const s=window.scene.get('GameScene');return [s._state.upKeyDown,s._state2.upKeyDown];}),[false,true]);
    await page.keyboard.up('ArrowUp');await page.waitForTimeout(40);
    assert.deepEqual(await page.evaluate(()=>{const s=window.scene.get('GameScene');s._paused=true;return [s._state.upKeyDown,s._state2.upKeyDown];}),[false,false]);
    console.log('PASS two-player button and keyboard inputs remain independent across presses and releases');

    assert.deepEqual(errors, []);
    const report = { date: new Date().toISOString(), official, fixtures, noclip, orbs, rotatedPhysics, slopeTravel, slopeCheckpoint, swing, dash, collectible, hiddenButton, ringBefore, ringPointer, blackfireStart, waveLifetime, skeletalSpawn, spiderLanding, pointerRecovery, spiderBody, gradient, backgroundGradient, shaderBands, backgroundCover, endTrigger, fixedStep, warpedStep, fastWarp, renderClock, definitions, denseGPU, additivePixel, warpedRotation, staticCamera, playerEvents, beasts, lift, customEnter, skeletalIntro, ispyOrb, effectLifecycle, dropBuffer, turnedSpiderInput, lensClampGPU, teleportForces, distantSpider, bluePadGate, turnedSolidLanding, hiddenEffects, errors };
    const reportFile = path.join(output, process.env.GD_QA_FAST ? 'results-fast.json' : 'results.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log('PASS browser integration; results: ' + reportFile);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

