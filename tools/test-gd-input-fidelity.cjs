// Actual browser input and menu lifecycle regressions. Needs the local QA server.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = path.resolve('work/qa-input-fidelity');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']});
 try {
  const page=await browser.newPage({viewport:{width:1138,height:640}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto((process.env.WD_URL||'http://127.0.0.1:8790/')+'?devraf=1');
  await page.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
  async function load(data){
   await page.evaluate(data=>{const s=scene.get('GameScene');window.__old=s._level;const up=s.constructor.prototype.update;
    s.update=function(t,dt){up.call(this,t,dt);if(this._level!==window.__old&&!this._slideIn&&!this._menuActive)this._paused=true;};
    window._onlineLevelId='local_input_fidelity';window._onlineLevelString=data;
    window.currentlevel=['stereo_madness','Input fidelity','local_input_fidelity',['Local','QA']];
    s.game.registry.set('autoStartGame',true);s.game.loop.wake();s.scene.restart();},data);
   await page.waitForFunction(()=>{const s=scene.get('GameScene');return s._level!==window.__old&&!s._slideIn&&!s._audio.musicLoading;},null,{timeout:120000});
   await page.evaluate(()=>{const s=scene.get('GameScene');s.game.loop.sleep();s.update=s.sys.sceneUpdate=s.constructor.prototype.update;s._audio.pauseMusic();s._waitingForLevelMusic=false;s._menuActive=s._slideIn=false;window.noClip=true;});
  }
  await load('kA4,0;1,1,2,50000,3,15;');
  await page.evaluate(()=>{const s=scene.get('GameScene');window.startPosSwitcher=true;s._paused=false;s.update(0,1000/60);});
  assert.equal(await page.evaluate(()=>scene.get('GameScene')._startPosGui.visible),false);
  console.log('PASS Startpos controls stay hidden on a level without Start Positions');
  await page.evaluate(()=>{const s=scene.get('GameScene');window.__pauseTrace=[];for(const name of ['_pauseGame','_resumeGame']){const old=s[name];s[name]=function(...args){__pauseTrace.push({name,paused:this._paused,held:this._jumpKeysDown(),was:this._pauseJumpWasDown,stack:new Error().stack});return old.apply(this,args);};}s.game.loop.wake();});
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>scene.get('GameScene')._spaceKey.isDown);
  // Reproduce the CBF/menu-handover mismatch that used to schedule resumes.
  await page.evaluate(()=>scene.get('GameScene')._spaceWasDown=false);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>scene.get('GameScene')._paused),true,JSON.stringify(await page.evaluate(()=>__pauseTrace)));
  await page.keyboard.up('Space');await page.waitForTimeout(40);
  await page.keyboard.down('Space');await page.waitForFunction(()=>!scene.get('GameScene')._paused);
  await page.keyboard.up('Space');
  console.log('PASS Escape stays paused through a held jump key; a fresh press resumes');
  await page.evaluate(()=>{const s=scene.get('GameScene');s.game.loop.sleep();s._paused=false;window.clickBetweenFrames=true;
   s._jumpEventQueue=[];s._jumpEventHeld={};window.__edges=[];
   window.__push=s._pushButton;window.__release=s._releaseButton;
   s._pushButton=function(){__edges.push(true);return __push.call(this);};s._releaseButton=function(){__edges.push(false);return __release.call(this);};});
  await page.keyboard.down('Space');await page.mouse.click(200,100);await page.mouse.click(200,100);await page.keyboard.up('Space');
  const edges=await page.evaluate(()=>{const s=scene.get('GameScene');const queued=s._jumpEventQueue.map(e=>e.down);s._drainJumpEvents(Infinity);
   s._pushButton=__push;s._releaseButton=__release;window.clickBetweenFrames=false;return{queued,delivered:__edges};});
  assert.deepEqual(edges.queued,[true,true,false,true,false,false]);assert.deepEqual(edges.delivered,edges.queued);
  console.log('PASS CBF delivers both mouse clicks while Space is held, with ordered releases');
  const heldStarts=[];
  for(const cbf of [false,true]) {
   await load('kA4,0;1,1,2,50000,3,15;');
   await page.evaluate(cbf=>{const s=scene.get('GameScene');window.clickBetweenFrames=cbf;
    s._paused=false;s._slideIn=true;s._playerWorldX=-70;s._state.canJump=false;s._spaceWasDown=true;s.game.loop.wake();},cbf);
   await page.keyboard.down('Space');
   await page.waitForFunction(()=>{const s=scene.get('GameScene');return !s._slideIn&&s._state.y>40;});
   heldStarts.push(await page.evaluate(()=>{const s=scene.get('GameScene');s.game.loop.sleep();return{held:s._logicButtonDown,y:s._state.y};}));
   if(cbf){
    await page.evaluate(()=>{const s=scene.get('GameScene');s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
     for(let i=0;i<4;i++)s.update(i*1000/240,1000/240);});
    assert.ok(await page.evaluate(()=>scene.get('GameScene')._state.y>40),'CBF must retain a physical hold through restart');
   }
   await page.keyboard.up('Space');
   if(cbf){
    const released=await page.evaluate(()=>{const s=scene.get('GameScene');s._drainJumpEvents(Infinity);s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
     for(let i=0;i<4;i++)s.update(i*1000/240,1000/240);return{physical:[...GDHeldJumpKeys],phaser:s._spaceKey.isDown,logical:s._logicButtonDown,y:s._state.y};});
    assert.deepEqual(released,{physical:[],phaser:false,logical:false,y:30});
   }
  }
  assert.ok(heldStarts.every(x=>x.held&&x.y>40),JSON.stringify(heldStarts));
  await load('kA4,0;1,1,2,50000,3,15;');
  await page.keyboard.down('Space');await page.keyboard.up('Space');
  assert.equal(await page.evaluate(()=>{const s=scene.get('GameScene');s._paused=false;for(let i=0;i<4;i++)s.update(i*1000/240,1000/240);return s._logicButtonDown;}),false);
  await page.evaluate(()=>window.clickBetweenFrames=false);
  console.log('PASS physical intro holds jump with and without CBF, survive restart and stay released after keyup');
  await load(fs.readFileSync(path.resolve(__dirname,'../assets/levels/14.txt'),'utf8'));
  const clubstep=await page.evaluate(()=>{const s=scene.get('GameScene');window.noClip=false;
   const attempt=()=>{s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;s._pushButton();const rows=[];
    for(let i=0;i<12;i++){s.update(i*1000/240,1000/240);rows.push({x:s._playerWorldX/2,y:s._state.y/2+90,vy:s._state.yVelocity/2});}return rows;};
   return{first:attempt(),restart:attempt()};});
  assert.deepEqual(clubstep.first,clubstep.restart);
  // Captured from the original executable with the button held before its
  // first update: one floor contact, followed by the first unshortened jump.
  const nativeStart=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-clubstep-start.json'),'utf8'));
  for(const sample of nativeStart.samples)for(const axis of ['x','y','vy'])
   assert.ok(Math.abs(clubstep.first[sample.frame-1][axis]-sample[axis])<.00001,JSON.stringify({sample,web:clubstep.first[sample.frame-1]}));
  console.log('PASS Clubstep held-from-start jump matches native ticks and is identical after restart');
  const nativeControls=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-control-options.json'),'utf8'));
  await load(nativeControls.level);
  const controls=await page.evaluate(cases=>{const s=scene.get('GameScene'),out={};window.noClip=false;
   for(const [name,c] of Object.entries(cases)){
    s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
    const rows=[];for(let f=0;f<400;f++){
     if(f===c.pressAfterFrame)s._pushButton();s.update(f*1000/240,1000/240);
     rows.push({x:s._playerWorldX/2,y:s._state.y/2+90,vy:s._state.yVelocity/2});
    }out[name]=rows;
   }return out;
  },nativeControls.cases);
  for(const [name,c] of Object.entries(nativeControls.cases))for(const sample of c.samples)for(const axis of ['x','y','vy'])
   assert.ok(Math.abs(controls[name][sample.frame-1][axis]-sample[axis])<.00001,JSON.stringify({name,sample,web:controls[name][sample.frame-1]}));
  console.log('PASS Options resumes held and disabled-time presses on the same native physics tick');
  const controlIsolation=await page.evaluate(()=>{const s=scene.get('GameScene'),l=s._level;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
   l.logicState._options({165:'1'});s._pushButton();s._releaseButton();l.logicState._options({165:'-1'});
   const released=!s._state.upKeyDown&&!s._state.queuedHold;
   s._enableDualMode();s._state.canJump=s._state2.canJump=false;
   l.logicState._options({165:'1',199:'-1'});s._pushButton();
   const p2Only=!s._state.upKeyDown&&s._state2.upKeyDown;
   s._releaseButton();s._pressUnseen=false;s._releaseButton();l.logicState._options({165:'-1',199:'1'});s._pushButton();
   return{released,p2Only,p1Only:s._state.upKeyDown&&!s._state2.upKeyDown};
  });
  assert.deepEqual(controlIsolation,{released:true,p2Only:true,p1Only:true});
  console.log('PASS releasing during disabled controls stays released; dual control restrictions stay independent');
  await load('kA4,0;1,1594,2,300,3,100,51,7,56,1,507,1;1,1594,2,300,3,100,51,7,56,1,507,1;1,1,2,50000,3,15;');
  const ringPress=await page.evaluate(()=>{
   const s=scene.get('GameScene'),l=s._level;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
   s._playerWorldX=600;s._state.y=s._state.lastY=200;s._state.onGround=false;
   s._setPlayerGamemode(s._player,s._state,'ship',true);
   s._player._nativeTouchedRings=l.objects.filter(o=>o.orbId===1594);
   let activations=0;const activate=l.activateCustomRing;l.activateCustomRing=function(...a){activations++;return activate.apply(this,a);};
   l.logicState._options({165:'1'});s._spaceKey.isDown=s._spaceWasDown=true;s._pushButton();l.logicState._options({165:'-1'});
   const immediate=activations;s.update(0,1000/240);s._spaceKey.isDown=false;
   l.activateCustomRing=activate;return{immediate,next:activations};
  });
  assert.deepEqual(ringPress,{immediate:1,next:1});
  console.log('PASS Options resumes one ring press without firing another overlapping custom ring on the next tick');
  await load('kA4,0;1,1764,2,300,3,100,57,7;1,1,2,50000,3,15;');
  const teleportBounds=await page.evaluate(()=>{
   const s=scene.get('GameScene'),l=s._level,out=[];
   const floor=l.getFloorY,ceiling=l.getCeilingY;
   l.getFloorY=()=>400;l.getCeilingY=()=>1000;
   for(const vy of [20,-20]) {
    s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=true;
    s._setPlayerGamemode(s._player,s._state,'ship',true);
    Object.assign(s._state,{isMini:false,yVelocity:vy,onGround:false});
    l.logicState._teleport({raw:{51:'7'},uid:-1,x:0,y:0});
    s._player.checkCollisions(s._playerWorldX-centerX);const first={y:s._state.y,vy:s._state.yVelocity};
    s._player.checkCollisions(s._playerWorldX-centerX);out.push({first,next:{y:s._state.y,vy:s._state.yVelocity,ground:s._state.onGround}});
   }
   l.getFloorY=floor;l.getCeilingY=ceiling;return out;
  });
  assert.deepEqual(teleportBounds,[{first:{y:200,vy:20},next:{y:430,vy:20,ground:false}},
   {first:{y:200,vy:-20},next:{y:430,vy:0,ground:true}}]);
  console.log('PASS teleport skips one corridor pass; a ship clamped while rising preserves its speed');
  await load('kA4,0;1,2013,2,100,3,0,371,0.5,10,1;1,31,2,800,3,300,kA2,0,kA20,1;1,1,2,50000,3,15;');
  const start=await page.evaluate(()=>{const s=scene.get('GameScene');window.startPosSwitcher=true;s._startPosIndex=0;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();
   const c=s._level.cameraState,initial={x:s._playerWorldX,y:s._state.y,cam:s._cameraX,zoom:c.values.zoom,lead:c.follow.leadX,tweens:c.tweens.length};
   s.update(0,1000/240);return{initial,next:{cam:s._cameraX,x:s._playerWorldX},visible:s._startPosGui.visible};});
  assert.equal(start.initial.x,1600);assert.equal(start.initial.y,600);assert.equal(start.initial.tweens,0);
  assert.ok(start.initial.lead<0);assert.ok(Math.abs(start.next.cam-start.initial.cam)<10,JSON.stringify(start));assert.equal(start.visible,true);
  console.log('PASS reverse Start Position settles its zoom, direction and camera before the first tick');
  await load('kA4,0;1,1,2,300,3,100,57,7;1,901,2,60,3,90,51,7,28,100,10,1;1,1007,2,75,3,90,51,7,35,0.25,10,0.5;1,31,2,1200,3,100,kA2,1,kA35,1;1,1,2,50000,3,15;');
  const settled=await page.evaluate(()=>{const s=scene.get('GameScene');s._startPosIndex=0;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=true;
   const l=s._level;return{offset:l.gdObjects[0].offX,opacity:l._groupOpacity[7],moves:l._activeMoveTweens.length,seconds:s._startPosEffectTime,
    player:[s._playerWorldX,s._state.y],container:[l.container.x,l.container.y],camera:[s._cameraX,s._cameraY],cube:s._player._playerSpriteLayer.sprite.visible};});
  assert.ok(Math.abs(settled.offset-100)<.0001,JSON.stringify(settled));assert.equal(settled.opacity,.25);assert.equal(settled.moves,0);
  assert.ok(settled.seconds>3);assert.deepEqual(settled.player,[2400,200]);assert.equal(settled.cube,true);
  assert.deepEqual(settled.container,[-settled.camera[0],settled.camera[1]]);
  console.log('PASS Start Position advances historical Move/Alpha actions and synchronizes its ship and camera before drawing');
  await load(fs.readFileSync(path.resolve(__dirname,'../assets/levels/22.txt'),'utf8'));
  const dashStarts=await page.evaluate(()=>{const s=scene.get('GameScene'),out=[];for(const index of [6,7,8,9,6,8,7]){
   s._startPosIndex=index;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
   const c=s._level.cameraState,initial=c.view(1138,640,s._cameraX,s._cameraY);
   for(let i=0;i<4;i++)s.update(i*1000/240,1000/240);
   out.push({index,x:s._level.getStartPositions()[index].x,initial,next:c.view(1138,640,s._cameraX,s._cameraY),targets:c.targets,effectTime:s._startPosEffectTime});}return out;});
  for(const start of dashStarts){assert.equal(start.targets.x,null);assert.equal(start.targets.y,null);
   assert.equal(start.initial.rotation,0);assert.ok(Math.abs(start.initial.x-start.x)<300,JSON.stringify(start));
   assert.ok(Math.abs(start.next.x-start.initial.x)<40,JSON.stringify(start));}
  assert.ok(Math.abs(dashStarts[1].effectTime-63.064035)<.0001);
  assert.ok(dashStarts[1].initial.x>dashStarts[0].initial.x+2000);assert.ok(dashStarts[2].initial.x>dashStarts[1].initial.x+4000);
  console.log('PASS Dash Start Positions 7–10 clear saved camera locks and show distinct stable rooms in both switch directions');
  await load('kA4,0;1,31,2,900,3,15;1,1,2,50000,3,15;');
  const bestRuns=await page.evaluate(()=>{
   const s=scene.get('GameScene'),key='bestPercent_'+window.currentlevel[2],pkey='practiceBestPercent_'+window.currentlevel[2];
   let popups=0;s._showNewBest=()=>{popups++;};
   const run=(index,practice)=>{s._startPosIndex=index;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;s._practicedMode.practiceMode=practice;
    s._bestPercent=10;localStorage.setItem(key,'10');localStorage.setItem(pkey,'7');s._physicsFrame=3000;s._playerWorldX=s._level.endXPos*.8;s._state.isDead=true;
    const before=popups;s.update(0,1000/240);return{start:s._startedFromStartPos,popups:popups-before,best:localStorage.getItem(key),practice:localStorage.getItem(pkey)};};
   const start=run(0,false),practice=run(0,true),normal=run(-1,false);
   s._startPosIndex=0;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._practicedMode.practiceMode=false;
   localStorage.setItem(key,'10');const completed=localStorage.getItem('gd_completedSet');s._endTrigger={noEffects:true};s._showCompleteText=()=>{};s._levelComplete();
   return{start,practice,normal,completionBest:localStorage.getItem(key),completionUnchanged:localStorage.getItem('gd_completedSet')===completed};
  });
  assert.deepEqual(bestRuns.start,{start:true,popups:0,best:'10',practice:'7'});
  assert.deepEqual(bestRuns.practice,{start:true,popups:0,best:'10',practice:'7'});
  assert.equal(bestRuns.normal.start,false);assert.equal(bestRuns.normal.popups,1);assert.equal(bestRuns.normal.best,'80');
  assert.equal(bestRuns.completionBest,'10');assert.equal(bestRuns.completionUnchanged,true);
  console.log('PASS Start Position attempts never announce or persist New Best or completion; normal runs still record progress');
  for(const later of [false,true]) {
   const gravity='1,11,2,300,3,100',teleport='1,747,2,300,3,300,54,-200';
   await load('kA4,0,kA37,1;'+(later?[teleport,gravity]:[gravity,teleport]).join(';')+';1,1,2,50000,3,15;');
   const cursor=await page.evaluate(()=>{
    const s=scene.get('GameScene');s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
    s._playerWorldX=600;s._state.y=s._state.lastY=600;s._state.onGround=false;s._state.yVelocity=0;
    s._player.checkCollisions(600-centerX);const first={y:s._state.y,g:s._state.gravityFlipped};
    s._player.checkCollisions(600-centerX);return{first,second:s._state.gravityFlipped};
   });
   assert.deepEqual(cursor,{first:{y:200,g:later},second:true});
  }
  console.log('PASS vertical teleports preserve the authored cursor through Y culling and still activate later destination portals');
  // Native Toggle + portal ordering: a portal exposed by this tick's touch
  // must change mode before the tick's solid pass and next updateJump.
  await load('kA4,0;1,13,2,300,3,120,57,7;1,1049,2,0,3,0,51,7;1,1049,2,300,3,120,11,1,51,7,56,1;1,1,2,50000,3,15;');
  const entry=await page.evaluate(()=>{const s=scene.get('GameScene'),l=s._level;s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();s._paused=false;
   s._playerWorldX=600;s._state.y=s._state.lastY=240;s._state.onGround=false;
   s._player.checkCollisions(600-centerX);return{ship:s._state.isFlying,enabled:l._groupEnabled[7]};});
  assert.equal(entry.enabled,true);assert.equal(entry.ship,true);
  console.log('PASS touch Toggle exposes and activates a mode portal in the same collision pass');
  await page.evaluate(()=>{const s=scene.get('GameScene');s._paused=true;GDDownloads.plan(['song:1','sfx:2','sfx:3']);GDDownloads.begin('song:1');GDDownloads.progress('song:1',50,100);});
  assert.equal(await page.locator('#gd-download-progress').isVisible(),true);
  assert.equal(await page.locator('#gd-download-status').isVisible(),false);
  const download=await page.evaluate(()=>{const s=scene.get('GameScene');window.__downloadObjects=[];s._bindSongDownloadProgress(__downloadObjects,850,550,300);return GDDownloads.state;});
  assert.equal(download.rows.length,3);assert.equal(await page.locator('#gd-download-progress').isVisible(),false);
  await page.evaluate(()=>{GDDownloads.finish('song:1');GDDownloads.finish('sfx:2');GDDownloads.finish('sfx:3',false);});
  assert.equal(await page.locator('#gd-download-status').isVisible(),true);
  assert.match(await page.locator('#gd-download-status').textContent(),/Download failed/);
  await page.screenshot({path:path.join(out,'download-error.png')});
  console.log('PASS download progress binds beside the arrow, counts SFX and reserves the top for errors');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({edges,clubstep,controls,controlIsolation,start,entry,download,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
