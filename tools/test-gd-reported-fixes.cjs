const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']});try{
const p=await b.newPage({viewport:{width:1138,height:640}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.goto((process.env.WD_URL||'http://127.0.0.1:8791/')+'?devraf=1');await p.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
await p.evaluate(()=>{const s=window.scene.get('GameScene');window.__old=s._level;const up=s.update;s.update=function(t,dt){up.call(this,t,dt);if(this._level!==window.__old&&!this._slideIn&&!this._menuActive)this._paused=true;};window._onlineLevelId='wave_probe';window._onlineLevelString='kA4,0;1,1594,2,500,3,240,51,1,56,1;1,1612,2,50000,3,0;';window.currentlevel=['stereo_madness','Wave probe','wave_probe',['Local','QA']];s.game.registry.set('autoStartGame',true);s.scene.restart();});
await p.waitForFunction(()=>{const s=window.scene.get('GameScene');return s._level!==window.__old&&!s._slideIn&&!s._audio.musicLoading;},null,{timeout:120000});
const rows=await p.evaluate(()=>{const s=window.scene.get('GameScene');s.game.loop.sleep();s._audio.pauseMusic();s._waitingForLevelMusic=false;s._menuActive=s._slideIn=s._paused=false;window.noClip=true;s._player.enterWaveMode();s._state.y=s._state.lastY=240;
const up=s.constructor.prototype.update;let frame=0;const step=n=>{for(let i=0;i<n;i++,frame++){s._state.upKeyDown=Math.floor(frame/30)%2===0;up.call(s,frame*1000/240,1000/240);}};
const t=s._player._waveTrail,gl=s.game.renderer.gl,W=s.game.renderer.width,H=s.game.renderer.height;
const pixels=visible=>{t._gfx.setVisible(visible);const r=s.game.renderer;r.preRender();s.sys.render(r);r.postRender?.();gl.finish();const a=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
const out=[];for(const [name,ldm,custom,particles] of [['normal',false,false,false],['LDM',true,false,false],['custom LDM',true,true,false],['No Particles',false,true,true],['normal restored',false,false,false]]){
 window.enableLDM=ldm;window.customWaveTrail=custom;window.noParticles=particles;GDHacks.state.waveScale=2;step(80);
 const on=pixels(true),off=pixels(false);t._gfx.setVisible(true);let changed=0;for(let i=0;i<on.length;i+=4)if(on[i]!==off[i]||on[i+1]!==off[i+1]||on[i+2]!==off[i+2])changed++;
 out.push({name,changed,active:t._active,points:t._pts.length,error:gl.getError()});
}
window.enableLDM=window.noParticles=false;const l=s._level,o=l.gdObjects[0],col=l.objects.find(c=>c.orbId===1594),before=l.topContainer.list.length;
Object.assign(s._state,{queuedHold:true,upKeyDown:true,wasUpKeyDown:false,_orbActivationConsumedForPress:false});s._player._setObjectActivated(col,false);s._player._handleRingContact(col,{atPress:true});
l.gdRenderer.update(.04);out.push({name:'trigger orb',ring:o.isRing,hit:o.ringHitTime!==undefined,circle:l.topContainer.list.length>before,particles:o.ambientParticleSystem?.particles.length||0});
window.enableLDM=true;o.ringHitTime=undefined;l.gdRenderer.activateRing(o);out.push({name:'trigger orb LDM',hit:o.ringHitTime!==undefined});
s._paused=true;return out;});
console.log(JSON.stringify(rows));for(const r of rows.slice(0,5)){assert.ok(r.changed>100&&r.active&&r.points>=2,JSON.stringify(r));assert.equal(r.error,0);}
assert.ok(rows[5].ring&&rows[5].hit&&rows[5].circle&&rows[5].particles>0,JSON.stringify(rows[5]));assert.equal(rows[6].hit,true);assert.deepEqual(errors,[]);console.log('PASS rendered wave pixels survive LDM, custom settings and No Particles; trigger orbs pulse, animate and emit particles');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
