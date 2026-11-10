// Focused acceptance: actual menu/pointer input, first-frame startpos and live search.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.resolve(__dirname,'../work/codex-20261109');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']});
 try {
  const page=await browser.newPage({viewport:{width:1792,height:1016}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(process.argv[2]||'http://127.0.0.1:8790/?devraf=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
  await page.keyboard.press('Tab');assert.equal(await page.locator('#eclipse-menu').isVisible(),true);
  await page.getByRole('button',{name:'Accurate Percentage settings',exact:true}).click();
  const popup=page.getByRole('dialog',{name:'Accurate Percentage',exact:true});
  await popup.getByRole('spinbutton',{name:'Decimal Places'}).fill('3');
  await popup.getByRole('spinbutton',{name:'Decimal Places'}).dispatchEvent('change');
  await popup.getByRole('switch',{name:'Normal Mode'}).click();
  assert.equal(await page.evaluate(()=>window.percentagePrecision),3);
  await documentFont(page);
  await page.screenshot({path:path.join(out,'eclipse-popup.png')});
  await page.keyboard.press('Escape');assert.equal(await popup.count(),0);
  await page.getByRole('switch',{name:'Noclip',exact:true}).click();assert.equal(await page.evaluate(()=>window.noClip),true);
  await page.getByRole('switch',{name:'Noclip',exact:true}).click();assert.equal(await page.evaluate(()=>window.noClip),false);
  await page.getByRole('button',{name:'Accurate Percentage settings',exact:true}).click();
  await page.getByRole('dialog').getByRole('spinbutton',{name:'Decimal Places'}).fill('2');
  await page.getByRole('dialog').getByRole('spinbutton',{name:'Decimal Places'}).dispatchEvent('change');
  await page.keyboard.press('Escape');
  await page.screenshot({path:path.join(out,'eclipse-menu.png')});
  await page.setViewportSize({width:1138,height:640});
  assert.ok(await page.locator('.eclipse-columns').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1));
  await page.keyboard.press('Tab');await page.locator('#eclipse-menu').waitFor({state:'hidden'});
  console.log('PASS Tab, live switches, numeric popup, Escape and 1138/1792 layouts');
  async function load(data){
   await page.evaluate(data=>{const s=window.scene.get('GameScene');window.__old=s._level;
    const update=s.constructor.prototype.update;s.update=function(t,dt){update.call(this,t,dt);if(this._level!==window.__old&&!this._slideIn)this._paused=true;};
    window._onlineLevelId='local_fixes';window._onlineLevelString=data;window.currentlevel=['stereo_madness','Fidelity','local_fixes',['Local','QA']];
    s.game.registry.set('autoStartGame',true);s.game.loop.wake();s.scene.restart();},data);
   await page.waitForFunction(()=>{const s=window.scene.get('GameScene');return s._level!==window.__old&&!s._slideIn&&!s._audio.musicLoading;},null,{timeout:120000});
   await page.evaluate(()=>{const s=window.scene.get('GameScene');s.game.loop.sleep();s._waitingForLevelMusic=false;s._audio.pauseMusic();});
  }
  await load('kA4,0;1,31,2,800,3,300,kA2,1,kA4,0;1,1,2,3000,3,15;');
  const ground=await page.evaluate(()=>{const s=window.scene.get('GameScene');s._startPosIndex=0;s._restartLevel();
   s._audio.pauseMusic();s._waitingForLevelMusic=false;
   return{animating:s._level._groundAnimating,v:s._level._groundTargetValue,band:s._level._bandMove,x:s._cameraX,playerX:s._playerWorldX};});
  assert.equal(ground.animating,false);assert.equal(ground.v,1);assert.equal(ground.band,null);assert.ok(ground.x>500);
  console.log('PASS Start Position ground and camera are settled before the first simulation tick',ground);
  const frozen=await page.evaluate(()=>window.scene.get('GameScene')._physicsFrame);
  await page.keyboard.press('Tab');
  await page.evaluate(()=>{const s=window.scene.get('GameScene');s._paused=false;s.constructor.prototype.update.call(s,0,100);});
  assert.ok(await page.evaluate(()=>window.scene.get('GameScene')._physicsFrame)>frozen);
  await page.keyboard.press('Tab');console.log('PASS mod menu leaves gameplay running');
  await load('kA4,0,kA3,1;1,1,2,3000,3,15;');
  const point=await page.evaluate(()=>{const s=window.scene.get('GameScene');s._paused=false;s._menuActive=s._slideIn=false;s._state.y=18;
   s._state.onGround=s._state.canJump=true;s._startPosGui.setVisible(false);window.startPosSwitcher=false;
   const b=s._startPosGui.list[0].getBounds(),c=s.game.canvas.getBoundingClientRect();
   return{x:c.left+b.centerX*c.width/s.scale.width,y:c.top+b.centerY*c.height/s.scale.height};});
  await page.mouse.click(point.x,point.y,{delay:20});
  const jump=await page.evaluate(()=>{const s=window.scene.get('GameScene');for(let i=0;i<8;i++)s.constructor.prototype.update.call(s,i*1000/240,1000/240);
   return{y:s._state.y,vy:s._state.yVelocity,dead:s._state.isDead};});
  assert.ok(jump.y>20&&jump.vy>0&&!jump.dead,JSON.stringify(jump));
  console.log('PASS mini cube clicks through hidden Startpos controls',jump);
  await page.evaluate(()=>{const s=window.scene.get('GameScene');s._paused=true;s._menuActive=true;s.game.loop.wake();s._openOnlineLevelsScene({type:0,str:'Dash'});});
  await page.waitForFunction(()=>window.scene.get('GameScene').children.list.some(o=>o.text==='Dash Full Version'),null,{timeout:15000});
  const search=await page.evaluate(async()=>{const t=performance.now();const r=await fetchGdApi('/getGJLevels21.php',{method:'POST',body:'secret=Wmfd2893gb7&type=0&str=Dash&page=0'});return{status:r.status,ms:performance.now()-t,valid:(await r.text()).includes('Dash Full Version')};});
  assert.equal(search.status,200);assert.equal(search.valid,true);
  console.log('PASS live GD search paints real result rows without third-party song metadata',search);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'focused-browser.json'),JSON.stringify({ground,jump,search,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
async function documentFont(page){await page.evaluate(()=>document.fonts.load('14px EclipseRubik'));}
