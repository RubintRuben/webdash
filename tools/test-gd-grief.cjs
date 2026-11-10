// Regression against the user's complete 189k-object GRIEF export.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']});try{
const p=await browser.newPage({viewport:{width:1138,height:640}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.goto((process.env.WD_URL||'http://127.0.0.1:8790/')+'?devraf=1');await p.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
await p.evaluate(data=>{const s=window.scene.get('GameScene');window.__old=s._level;const update=s.constructor.prototype.update;s.update=function(t,dt){update.call(this,t,dt);if(this._level!==window.__old&&!this._slideIn)this._paused=true;};window._onlineLevelId='grief_geometry';window._onlineLevelString=data;window.currentlevel=['stereo_madness','GRIEF','grief_geometry',['Local','QA']];s.game.registry.set('autoStartGame',true);s.scene.restart();},fs.readFileSync('work/codex-20261109b/grief.txt','utf8'));
await p.waitForFunction(()=>{const s=window.scene.get('GameScene');return s._level!==window.__old&&!s._slideIn&&!s._audio.musicLoading;},null,{timeout:180000});
const result=await p.evaluate(()=>{const s=window.scene.get('GameScene'),l=s._level,r=l.gdRenderer;s.game.loop.sleep();s._audio.pauseMusic();s._waitingForLevelMusic=false;s._paused=false;
const samples=l.objects.filter(c=>['solid','slope'].includes(c.type)&&c._eeGroups?.length&&l.gdObjects[c._eeObjectId]);
const baseline=new Map(samples.map(c=>{const p=r.livePosition(l.gdObjects[c._eeObjectId]);return[c,{x:c.x/2-p.x,y:c.y/2-p.y}];}));
const compare=()=>{r.flushMoves();let max=0,bad=[];for(const c of samples){const p=r.livePosition(l.gdObjects[c._eeObjectId]),b=baseline.get(c),error=Math.hypot(c.x/2-p.x-b.x,c.y/2-p.y-b.y);if(error>max)max=error;if(error>.1&&bad.length<8)bad.push({id:c.objid,uid:c._eeObjectId,error,collider:[c.x/2,c.y/2],render:p,base:b,raw:c._eeLevelObject?._raw});}return{max,bad};};
const target=samples.find(c=>c._eeGroups.length>1),groups=target._eeGroups.slice(0,2),moves=[];
for(const [i,g] of groups.entries()){l._translateGroup(g,80*(i+1),-40*(i+1));moves.push(compare());}
s._restartLevel();s._audio.pauseMusic();s._waitingForLevelMusic=false;s._paused=false;window.noClip=true;
baseline.clear();for(const c of samples){const p=r.livePosition(l.gdObjects[c._eeObjectId]);baseline.set(c,{x:c.x/2-p.x,y:c.y/2-p.y});}
const frames=[];for(let f=0;f<1200;f++){s._fixedTickActive=true;s._visualTick=f%60===0;s._updateSimulationStep(f*1000/240,1000/240);if(f%120===119)frames.push({frame:s._physicsFrame,...compare()});}s._fixedTickActive=false;s._paused=true;s._visualTick=true;l._syncGDRenderer(0);l.cameraState.updateVisual();
return{objects:window.levelObjects.length,colliders:l.objects.length,samples:samples.length,groups,moves,frames,x:s._playerWorldX,y:s._state.y};});
fs.writeFileSync('work/codex-20261109b/grief-geometry.json',JSON.stringify(result,null,2));
for(const row of [...result.moves,...result.frames])assert.ok(row.max<.1,JSON.stringify(row));assert.deepEqual(errors,[]);
console.log('PASS complete GRIEF: overlapping group moves and 1200 physics steps preserve collider/render centres',JSON.stringify({objects:result.objects,colliders:result.colliders,samples:result.samples,max:Math.max(...result.moves.map(x=>x.max),...result.frames.map(x=>x.max))}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
