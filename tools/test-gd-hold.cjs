// Compare an attached, unmodified GMD against measured native hold outcomes.
// node tools/test-gd-hold.cjs "path/to/HELIOPOSSIBLE hOlD.gmd" "path/to/Zodiac hold.gmd"
// No level payloads are committed. SHA-256 identifies the exact native fixture.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), zlib = require('node:zlib');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const references = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-hold-outcomes.json'),'utf8')).samples;
const unescapeXML = s => s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function readFixture(file) {
  const xml = fs.readFileSync(file,'utf8');
  const encoded = unescapeXML(xml.match(/<(?:k|key)>k4<\/(?:k|key)>\s*<(?:s|string)>([\s\S]*?)<\/(?:s|string)>/)?.[1] || '');
  assert.ok(encoded,'GMD must contain k4');
  const bytes = encoded.includes(';') ? Buffer.from(encoded) : zlib.unzipSync(Buffer.from(encoded.replace(/-/g,'+').replace(/_/g,'/'),'base64'));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const reference = references.find(r=>r.decodedSha256===hash);
  assert.ok(reference,'Unknown fixture; capture its native outcome before comparing');
  const frames = Number(xml.match(/<(?:k|key)>k95<\/(?:k|key)>\s*<(?:i|integer)>(\d+)<\/(?:i|integer)>/)?.[1]) || 0;
  assert.equal(frames,reference.verificationFrames);
  return {file:path.resolve(file),data:bytes.toString('utf8'),reference};
}
(async()=>{
  assert.ok(process.argv.length>2,'Pass the original GMD file(s)');
  const fixtures=process.argv.slice(2).map(readFixture);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:process.platform==='win32'?['--use-angle=d3d11']:[]});
  try {
    for (const {file,data,reference} of fixtures) {
      const page=await browser.newPage({viewport:{width:1138,height:640}}),errors=[];
      page.on('pageerror',e=>errors.push(e.stack));
      await page.goto((process.env.WD_URL||'http://127.0.0.1:8790/')+'?devraf=1',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
      await page.evaluate(({data,frames})=>{
        // The physics replay does not depend on external music/SFX downloads.
        window.GDAudioState.prototype.prepareLevel=function(){this.loading=false;return Promise.resolve();};
        window.GDAudioState.prototype.load=async()=>null;
        const s=window.scene.get('GameScene');window.__holdOldLevel=s._level;
        const update=s.update;
        s.update=function(t,dt){update.call(this,t,dt);if(s._level!==window.__holdOldLevel&&!s._slideIn)s._paused=true;};
        window._onlineLevelId='gd_hold_acceptance';window._onlineLevelString=data;
        window._onlineLevelMetadata={id:'gd_hold_acceptance',verificationFrames:frames};
        window.currentlevel=['stereo_madness','Native hold acceptance','gd_hold_acceptance',['Local','QA']];
        s.game.registry.set('autoStartGame',true);s.scene.restart();
      },{data,frames:reference.verificationFrames});
      await page.waitForFunction(()=>{
        const s=window.scene.get('GameScene');return s._level!==window.__holdOldLevel&&!s._slideIn&&!s._audio.musicLoading;
      },null,{timeout:120000});
      const result=await page.evaluate(({limit,stopFrame,cbf,checkpointFrames})=>{
        const s=window.scene.get('GameScene');
        s._level.logicState?.persistent.clear();s._level.logicState?.persistentTimers.clear();
        s._restartLevel();s._waitingForLevelMusic=false;s._audio.pauseMusic();
        s._menuActive=s._slideIn=s._paused=false;window.noClip=false;window.clickBetweenFrames=cbf;
        let presses=0;const push=s._pushButton;
        s._pushButton=function(...args){if(!args[1])presses++;return push.apply(this,args);};
        s._spaceKey.isDown=true;s._spaceWasDown=true;s._pushButton();
        const update=s.constructor.prototype.update,tick=1000/240;
        const wanted=new Set(checkpointFrames),checkpoints=[];
        for(let i=0;i<limit&&s._physicsFrame<stopFrame&&!s._state.isDead&&!s._levelWon;i++){
          s._visualTick=i%4===3;update.call(s,i*tick,tick);
          if(wanted.has(s._physicsFrame))checkpoints.push({frame:s._physicsFrame,x:s._playerWorldX/2,y:s._state.y/2+90});
        }
        s._paused=true;
        return {frame:s._physicsFrame,won:!!s._levelWon,dead:!!s._state.isDead,noclip:window.noClip,presses,
          x:s._playerWorldX/2,y:s._state.y/2+90,percent:s._getCurrentPercent(),checkpoints};
      },{limit:reference.frame+240,stopFrame:reference.kind==='prefix'?reference.frame:Infinity,
        cbf:!!reference.clickBetweenSteps,checkpointFrames:(reference.checkpoints||[]).map(r=>r.frame)});
      assert.deepEqual(errors,[]);assert.equal(result.presses,1);assert.equal(result.noclip,false);
      for(const key of ['frame','won','dead','x','y'])assert.equal(result[key],reference[key],reference.name+' '+key);
      if(reference.percent!==undefined)assert.equal(result.percent,reference.percent);
      assert.equal(result.checkpoints.length,(reference.checkpoints||[]).length);
      for(const expected of reference.checkpoints||[]){
        const actual=result.checkpoints.find(r=>r.frame===expected.frame);
        for(const axis of ['x','y'])assert.ok(Math.abs(actual[axis]-expected[axis])<.002,JSON.stringify({expected,actual,axis}));
      }
      const out=path.resolve(process.env.GD_HOLD_OUTPUT||'work/hold-qa');fs.mkdirSync(out,{recursive:true});
      fs.writeFileSync(path.join(out,reference.name.replace(/[^a-z0-9]+/gi,'-')+'.json'),JSON.stringify({file,reference,result,errors},null,2));
      console.log('PASS '+reference.name+': '+JSON.stringify(result));
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
