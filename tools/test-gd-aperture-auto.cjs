// End-to-end acceptance check: original auto level, no presses, no Noclip.
// Run with the local server running:
// node tools/test-gd-aperture-auto.cjs [decoded-level.txt] [output-directory]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
(async () => {
  const fixture = path.resolve(process.argv[2] || 'work/fixtures/aperture.txt');
  const output = path.resolve(process.argv[3] || 'work/aperture-auto-qa');
  const bytes = fs.readFileSync(fixture), errors = [];
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true,
    executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage({viewport:{width:1138,height:640}});
    page.on('pageerror', error => errors.push(error.stack));
    await page.goto((process.env.WD_URL || 'http://127.0.0.1:8790/') + '?devraf=1', {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.scene?.get('GameScene')?._level, null, {timeout:120000});
    await page.evaluate(data => {
      const s = window.scene.get('GameScene'); window.__autoOldLevel = s._level;
      const update = s.update;
      s.update = function(t, dt) {
        update.call(this, t, dt);
        if (s._level !== window.__autoOldLevel && !s._slideIn) s._paused = true;
      };
      window._onlineLevelId = 'aperture_auto_acceptance'; window._onlineLevelString = data;
      window.currentlevel = ['stereo_madness', 'Aperture auto acceptance', 'aperture_auto_acceptance', ['Local','QA']];
      s.game.registry.set('autoStartGame',true); s.scene.restart();
    }, bytes.toString('utf8'));
    await page.waitForFunction(() => {
      const s = window.scene.get('GameScene');
      return s._level !== window.__autoOldLevel && !s._slideIn && !s._audio.musicLoading;
    }, null, {timeout:120000});
    const result = await page.evaluate(() => {
      const s = window.scene.get('GameScene');
      s._restartLevel(); s._waitingForLevelMusic = false; s._audio.pauseMusic();
      s._menuActive = s._slideIn = s._paused = false; window.noClip = false;
      let presses = 0;
      s._pushButton = () => { presses++; throw Error('Acceptance replay must never press a button'); };
      const update = s.constructor.prototype.update, tick = 1000 / 240;
      const checkpoints = [], targets = [26000,28000,30000,32000,35000];
      for (let frame = 0; frame < 145 * 240 && !s._state.isDead && !s._levelWon; frame++) {
        s._visualTick = frame % 4 === 3;
        update.call(s, frame * tick, tick);
        if (checkpoints.length < targets.length && s._playerWorldX / 2 >= targets[checkpoints.length]) {
          checkpoints.push({target:targets[checkpoints.length],x:s._playerWorldX/2,y:s._state.y/2,
            mode:s._getDualModeId(s._state),seconds:s._level._spawnClock});
        }
      }
      s._paused = true; s._visualTick = true;
      s._level._syncGDRenderer(0); s._level.cameraState.updateVisual();
      return {won:!!s._levelWon, dead:!!s._state.isDead, noclip:window.noClip,
        presses, frame:s._physicsFrame, seconds:s._level._spawnClock,
        x:s._playerWorldX, y:s._state.y, checkpoints};
    });
    const report = {fixture, sha256:crypto.createHash('sha256').update(bytes).digest('hex'), ...result, errors};
    fs.writeFileSync(path.join(output,'result.json'), JSON.stringify(report,null,2));
    assert.equal(result.presses,0); assert.equal(result.noclip,false);
    assert.equal(result.dead,false); assert.equal(result.won,true);
    // Independent no-input native telemetry (2.2081, saved Y excludes its
    // +90 ground offset). Completion alone can conceal a different route.
    const nativeY = [15,15,1796.1084,1725.6821,1443.8171];
    assert.equal(result.checkpoints.length,nativeY.length);
    result.checkpoints.forEach((p,i)=>assert.ok(Math.abs(p.y-nativeY[i])<40,
      `Route differs from native at X=${p.target}: Y=${p.y}, expected about ${nativeY[i]}`));
    assert.deepEqual(errors,[]);
    console.log('PASS Aperture auto completes without input or Noclip: ' + JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
