// Focused contact/dual regressions, independent of real-time input and music playback.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
await page.goto(process.argv[2]||'http://127.0.0.1:8790/?devraf=1',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
async function load(index,data,title){
 await page.evaluate(({data,title})=>{const s=window.scene.get('GameScene');window.__old=s._level;window._onlineLevelString=data;window._onlineLevelId='contact_qa';window.currentlevel=['stereo_madness',title,'contact_qa',['Local','QA']];s.game.registry.set('autoStartGame',true);s.scene.restart();},{data,title});
 await page.waitForFunction(()=>window.scene.get('GameScene')._level!==window.__old&&!window.scene.get('GameScene')._slideIn,null,{timeout:120000});
 await page.evaluate(()=>{const s=window.scene.get('GameScene');s._paused=true;s._restartLevel();window.noClip=false;});
}
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
      window.noClip=false;p2.checkCollisions(200-centerX);
      const position={p1:s._playerWorldX,p2:s._secondaryWorldX,y:p2.p.y,dead:p2.p.isDead};
      p.p.gravityFlipped=false;p2.p.gravityFlipped=false;p2.p.isCube=false;p2.p.isUfo=true;
      const asymmetric=s._syncDualGlobalsFromSecondary();
      const g=p.p.gravityFlipped;p2.p.isUfo=false;p2.p.isCube=true;
      const matching=s._syncDualGlobalsFromSecondary();
      s._level.logicState.options.unlinkDualGravity=true;
      return {position,asymmetric,g,matching,unlinked:s._syncDualGlobalsFromPrimary()};
    });
    assert.deepEqual(independentDual,{position:{p1:200,p2:800,y:200,dead:false},asymmetric:false,g:false,matching:true,unlinked:false});
    console.log('PASS green group portals move P2 independently; asymmetric modes and Unlink Dual Gravity preserve independent gravity');
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

await load(0,'kA4,0;1,467,2,100,3,100;1,1612,2,50000,3,0;', 'Leaving a slowly rising platform');
const rising=await page.evaluate(()=>{
 const s=window.scene.get('GameScene'),p=s._player,o=s._level.objects.find(o=>o._eeLevelObject?.id===467);
 const result=[];
 for(const flipped of [false,true]) {
  Object.assign(p.p,new PlayerState(),{onGround:false,gravityFlipped:flipped,y:flipped?140:260,lastY:flipped?140:260,yVelocity:flipped?-20:20});
  p._lastCollisionWorldX=200;p._lastCollisionWorldY=p.p.y;p._prevC6=0;p._slopeRiding=false;
  s._fixedTickActive=true;s._physicsFrame=3;s._playerWorldX=200;
  o._gdMotionFrame=2;o._gdPreviousX=o.x;o._gdPreviousY=o.y+(flipped?.004:-.004);
  p.checkCollisions(200-centerX);result.push({vy:p.p.yVelocity,ground:p.p.onGround,dead:p.p.isDead});
 }
 s._fixedTickActive=false;
 return result;
});
assert.deepEqual(rising,[{vy:20,ground:false,dead:false},{vy:-20,ground:false,dead:false}]);
console.log('PASS a slowly rising floor or falling ceiling cannot cancel a faster jump');

await load(0,'kA4,0;1,747,2,100,3,100,54,100,57,1;1,1612,2,50000,3,0;', 'Moved orange teleport endpoint');
const movedExit=await page.evaluate(()=>{
 const s=window.scene.get('GameScene'),p=s._player,l=s._level;
 l._translateGroup(1,0,-960);l.gdRenderer.flushMoves();
 const portal=l.objects.find(o=>o.type==='portal_teleport');
 Object.assign(p.p,new PlayerState(),{y:portal.y,lastY:portal.y,onGround:false});
 s._playerWorldX=portal.x;p.checkCollisions(portal.x-centerX);
 return {y:p.p.y,dead:p.p.isDead,exitY:l.gdRenderer.livePosition(l.gdObjects[portal._eeObjectId].teleportExit).y*2};
});
assert.equal(movedExit.y,movedExit.exitY);assert.equal(movedExit.y,1360);assert.equal(movedExit.dead,false);
console.log('PASS a moved teleport entry reaches the live orange endpoint');

await load(0,'kA4,0;1,467,2,100,3,100;1,1612,2,50000,3,0;', 'Descending platform rider');
const riders=await page.evaluate(()=>{
 const s=window.scene.get('GameScene'),p=s._player,o=s._level.objects.find(o=>o._eeLevelObject?.id===467),out=[];
 for(const flipped of [false,true]) {
  o.y=200;Object.assign(p.p,new PlayerState(),{gravityFlipped:flipped,y:flipped?140:260,lastY:flipped?140:260,yVelocity:0,onGround:true});
  s._fixedTickActive=false;s._playerWorldX=200;p._groundColliderId=null;p._prevC6=0;p._slopeRiding=false;p._slopeExitGrace=0;
  p.checkCollisions(200-centerX);const saved=p.captureSlopeState();p._groundColliderId=null;p.restoreSlopeState(saved);
  s._fixedTickActive=true;s._physicsFrame=3;o._gdMotionFrame=2;o._gdPreviousX=o.x;o._gdPreviousY=200;o.y+=flipped?2:-2;
  p.p.lastY=p.p.y;p.p.y+=flipped?.1:-.1;p.p.yVelocity=flipped?.4:-.4;
  p.checkCollisions(200-centerX);out.push({y:p.p.y,ground:p.p.onGround,dead:p.p.isDead});
 }
 s._fixedTickActive=false;return out;
});
assert.deepEqual(riders,[{y:258,ground:true,dead:false},{y:142,ground:true,dead:false}]);
console.log('PASS a rider follows its receding platform in both gravities after restoring a checkpoint');

await load(0,'kA4,0;1,467,2,100,3,150;1,1612,2,50000,3,0;', 'A moving H-block ceiling');
const movingHead=await page.evaluate(()=>{
 const s=window.scene.get('GameScene'),p=s._player,o=s._level.objects.find(o=>o._eeLevelObject?.id===467),out=[];
 for(const flipped of [false,true]) {
  Object.assign(p.p,new PlayerState(),{onGround:false,gravityFlipped:flipped,y:flipped?360.1:239.9,lastY:flipped?360:240,yVelocity:flipped?.4:-.4,stateHitHead:2});
  p._groundColliderId=null;p._prevC6=0;p._slopeRiding=false;p._slopeExitGrace=0;
  s._fixedTickActive=true;s._physicsFrame=3;s._playerWorldX=200;o._gdMotionFrame=2;o._gdPreviousX=o.x;o._gdPreviousY=300;o.y=flipped?304:296;
  p.checkCollisions(200-centerX);out.push({y:p.p.y,vy:p.p.yVelocity,dead:p.p.isDead});
 }
 s._fixedTickActive=false;return out;
});
assert.deepEqual(movingHead,[{y:236,vy:0,dead:false},{y:364,vy:0,dead:false}]);
console.log('PASS H-block head contact uses the ceiling movement in both gravities');

assert.deepEqual(errors,[]);console.log('PASS focused Aperture contact regressions');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
