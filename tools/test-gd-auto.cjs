// End-to-end acceptance check: original auto level, no presses, no Noclip.
// Run with the local server running:
// node tools/test-gd-auto.cjs [decoded-level.txt] [output-directory]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
(async () => {
  const fixture = path.resolve(process.argv[2] || 'work/fixtures/aperture.txt');
  const output = path.resolve(process.argv[3] || 'work/aperture-auto-qa');
  const secondsLimit=Number(process.env.GD_LIMIT_SECONDS || 300);
  assert.ok(Number.isFinite(secondsLimit)&&secondsLimit>0&&secondsLimit<=300,'Invalid diagnostic time limit');
  const bytes = fs.readFileSync(fixture), errors = [];
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true,
    executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:process.platform === 'win32' ? ['--use-angle=d3d11'] : []});
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
      window._onlineLevelId = 'gd_auto_acceptance'; window._onlineLevelString = data;
      window.currentlevel = ['stereo_madness', 'Auto level acceptance', 'gd_auto_acceptance', ['Local','QA']];
      s.game.registry.set('autoStartGame',true); s.scene.restart();
    }, bytes.toString('utf8'));
    await page.waitForFunction(() => {
      const s = window.scene.get('GameScene');
      return s._level !== window.__autoOldLevel && !s._slideIn && !s._audio.musicLoading;
    }, null, {timeout:120000});
    if(process.env.GD_PRE) await page.evaluate(fs.readFileSync(process.env.GD_PRE,'utf8'));
    const result = await page.evaluate(([secondsLimit, skipVisuals, attemptsLimit]) => {
      const s = window.scene.get('GameScene');
      // The frame the page ran before pausing must not count as an attempt: persistent items survive a restart.
      s._level.logicState?.persistent.clear(); s._level.logicState?.persistentTimers.clear();
      s._restartLevel(); s._waitingForLevelMusic = false; s._audio.pauseMusic();
      s._menuActive = s._slideIn = s._paused = false; window.noClip = false;
      let presses = 0;
      s._pushButton = () => { presses++; throw Error('Acceptance replay must never press a button'); };
      const update = s.constructor.prototype.update, tick = 1000 / 240;
      const checkpoints = [], targets = [], trace = [], pads = []; let death;
      const passCheck=s._player.checkCollisions;s._player.checkCollisions=function(...a){const r=passCheck.apply(this,a);this.__passRot=this._rotation*180/Math.PI;return r;};
      const sample = () => ({rot:s._player.__passRot,frame:s._physicsFrame,t:s._level._spawnClock,x:s._playerWorldX,y:s._state.y,vy:s._state.yVelocity,dart:s._state.stateDartSlide,g:s._state.gravityFlipped,ground:s._state.onGround,mode:s._getDualModeId(s._state),dual:s._isDual,p2:{x:s._secondaryWorldX,y:s._state2.y,vy:s._state2.yVelocity,mode:s._getDualModeId(s._state2)}});
      for (const player of [s._player,s._player2]) { let lastContact;const activate=player._setObjectActivated;player._setObjectActivated=function(o,v){if(v&&o.type==='jump_pad')pads.push({pid:player===s._player?1:2,t:s._level._spawnClock,x:player._worldX(),y:player.p.y,vy:player.p.yVelocity,id:o.padId,ox:o.x,oy:o.y,w:o.w,h:o.h});return activate.call(this,o,v);};const breakBlock=player.breakabletheblock;player.breakabletheblock=function(o){lastContact={type:o.type,x:o.x,y:o.y,w:o.w,h:o.h,radius:o.hitbox_radius,shape:o.shape,raw:o._eeLevelObject?._raw};return breakBlock.call(this,o);};const kill=player.killPlayer;player.killPlayer=function(){if(!death)death={lastContact,player:player===s._player?1:2,state:sample(),stack:new Error().stack,near:s._level.getNearbySectionObjects(player===s._player?s._playerWorldX:s._secondaryWorldX).filter(o=>Math.abs(o.x-(player===s._player?s._playerWorldX:s._secondaryWorldX))<140&&Math.abs(o.y-player.p.y)<200).map(o=>({type:o.type,x:o.x,y:o.y,w:o.w,h:o.h,raw:o._eeLevelObject?._raw}))};return kill.call(this);}; }

      // A level may need its deaths: a persistent item can change the next attempt.
      const attempts = [];
      for (let frame = 0; frame < secondsLimit * 240 * attemptsLimit && !s._levelWon; frame++) {
        if (s._state.isDead) {
          attempts.push({frame:s._physicsFrame,x:s._playerWorldX/2,death:death&&death.lastContact&&death.lastContact.raw});
          if (attempts.length >= attemptsLimit) break;
          death = undefined; s._restartLevel(); s._waitingForLevelMusic = false; s._paused = false;
        }
        s._visualTick = !skipVisuals && frame % 4 === 3;
        update.call(s, frame * tick, tick); if(true){trace.push(sample());if(trace.length>120000)trace.shift();}
        if (checkpoints.length < targets.length && s._playerWorldX / 2 >= targets[checkpoints.length]) {
          checkpoints.push({target:targets[checkpoints.length],x:s._playerWorldX/2,y:s._state.y/2,
            mode:s._getDualModeId(s._state),seconds:s._level._spawnClock});
        }
      }
      s._paused = true; s._visualTick = true;
      s._level._syncGDRenderer(0); s._level.cameraState.updateVisual();
      return {won:!!s._levelWon, dead:!!s._state.isDead, noclip:window.noClip,
        diagnostic:window.__diag, presses, frame:s._physicsFrame, seconds:s._level._spawnClock,
        x:s._playerWorldX, y:s._state.y, end:s._level.endXPos, death, trace, pads, checkpoints, attempts};
    },[secondsLimit, !!process.env.GD_NO_VISUALS, Number(process.env.GD_ATTEMPTS) || 1]);
    const report = {fixture, sha256:crypto.createHash('sha256').update(bytes).digest('hex'), ...result, errors};
    fs.writeFileSync(path.join(output,'result.json'), JSON.stringify(report,null,2));
    assert.equal(result.presses,0); assert.equal(result.noclip,false);
    assert.equal(result.dead,false); assert.equal(result.won,true);
    assert.deepEqual(errors,[]);
    console.log('PASS Auto level completes without input or Noclip: ' + JSON.stringify({seconds:result.seconds,presses:result.presses}));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
