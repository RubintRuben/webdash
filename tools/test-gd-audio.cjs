// Real Web Audio integration against locally imported original GD audio.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'work/audio-qa'),{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1138,height:640}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(process.argv[2]||'http://127.0.0.1:8790/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
  await page.mouse.click(655,320);
    const result = await page.evaluate(async()=>{
      const s=window.scene.get('GameScene'),a=new AudioManager(s),ctx=s.sound.context;
      const saved={currentlevel:window.currentlevel,settings:window.settingsMap,buffer:window._onlineSongBuffer,key:window._onlineSongKey};
      const trigger=(id,raw)=>a.triggers.trigger({id,raw});
      try {
        window.currentlevel=['ng_song_1382827','Audio test','test'];window.settingsMap={kA13:0};window._onlineSongBuffer=null;window._onlineSongKey=null;
        await a.triggers.prepareLevel({_logicTriggers:[{id:1934,raw:{392:1370030}},{id:3602,raw:{392:4451}}]});
        a.startMusic();while(a.musicLoading)await new Promise(r=>setTimeout(r,10));
        const primary={key:a._music.key,playing:a._music.isPlaying,seek:a._music.seek};
        trigger(3605,{418:1,10:0});
        const mute=a._music.volume;
        trigger(1934,{399:1,392:1370030,406:.3,409:1500,432:1});
        const prepSilent=!a.triggers.songs.has(1);
        trigger(1934,{400:1,392:999999,406:1,408:40000,432:1});
        const first=a.triggers.songs.get(1);await new Promise(r=>setTimeout(r,220));a.triggers.update(.22);
        const intro={id:first.spec.id,position:first.seek,gain:first.gain.gain.value,start:first.spec.start,volume:first.spec.volume};
        // The manual ramp update above must reach a real Web Audio mix block.
        await new Promise(r=>setTimeout(r,80));
        const mixSamples=new Float32Array(1024);a._analyser.getFloatTimeDomainData(mixSamples);
        const secondaryMeterPeak=Math.max(...mixSamples.map(Math.abs));
        trigger(1934,{399:1,392:1370030,406:.65,408:239354,409:7000,432:2});trigger(1934,{400:1,432:2});
        trigger(3605,{418:1,406:.65,10:3,432:1});a.triggers.update(1.5);
        const halfway=first.levelVolume;
        trigger(3602,{392:4451,406:1.61,410:966,411:108});
        const effect=[...a.triggers.effects][0];
        const analyser=ctx.createAnalyser();effect.gain.connect(analyser);analyser.fftSize=1024;
        await new Promise(r=>setTimeout(r,160));const samples=new Float32Array(1024);analyser.getFloatTimeDomainData(samples);
        const sfxPeak=Math.max(...samples.map(Math.abs));
        a.pauseMusic();const p=first.seek;await new Promise(r=>setTimeout(r,120));const held=first.seek; a.resumeMusic();
        await new Promise(r=>setTimeout(r,100));const resumed=first.seek;
        const state=a.triggers.capture();a.startMusic(.7);a.triggers.restore(state);
        const restored=a.triggers.capture();
        const channels=[...a.triggers.songs.keys()];
        a.stopMusic();const cleared=a.triggers.songs.size+a.triggers.effects.size+a.triggers.prepared.size;
        return {primary,mute,prepSilent,intro,secondaryMeterPeak,halfway,sfxPeak,pauseDrift:held-p,resumed:resumed-held,channels,restored,cleared,errors:[]};
      }finally{a.stopMusic();Object.assign(window,saved);window.currentlevel=saved.currentlevel;window.settingsMap=saved.settings;window._onlineSongBuffer=saved.buffer;window._onlineSongKey=saved.key;}
    });
    fs.writeFileSync(path.join(root,'work/audio-qa/results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
    assert.equal(result.primary.playing,true);assert.equal(result.mute,0);assert.equal(result.prepSilent,true);
    assert.equal(result.intro.id,1370030);assert.equal(result.intro.start,0);assert.ok(result.intro.gain>0);assert.ok(Math.abs(result.halfway-.475)<1e-8);
    assert.ok(result.secondaryMeterPeak>.0001,'secondary song channel must reach the visual metering analyser while primary is muted');
    assert.ok(result.sfxPeak>.001);assert.equal(result.pauseDrift,0);assert.ok(result.resumed>.05);assert.deepEqual(result.channels,[0,1,2]);assert.equal(result.cleared,0);assert.deepEqual(errors,[]);
    console.log('PASS original audio: main song, silent prep, Load Prep, two extra channels, native volume flag, fade, audible SFX, pause/resume, checkpoint and stop');

    // Exercise the real imported intro through the ordinary attempt path.
    await page.evaluate(data=>{
      const s=window.scene.get('GameScene');window.__audioOldLevel=s._level;
      window._onlineLevelId='audio_intro_qa';window._onlineLevelString=data;
      window.currentlevel=['ng_song_1382827','Skeletal audio intro','audio_intro_qa',['Local','QA']];
      s.game.registry.set('autoStartGame',true);s.scene.restart();
    },fs.readFileSync(path.join(root,'work/fixtures/skeletal.txt'),'utf8'));
    await page.waitForFunction(()=>{const s=window.scene.get('GameScene');return s._level!==window.__audioOldLevel&&!s._slideIn&&!s._audio.musicLoading;},null,{timeout:120000});
    const intro=await page.evaluate(()=>{
      const s=window.scene.get('GameScene'),l=s._level,a=s._audio;
      l.logicState.persistent.clear();l._itemCounts.delete(5);s._restartLevel();
      s._paused=false;s._slideIn=s._menuActive=false;s._releaseButton();window.noClip=true;
      for(let i=0;i<60;i++)s.update(i*1000/60,1000/60);
      const logo={main:a._music.volume,heldX:s._playerWorldX,prepared:[...a.triggers.prepared.keys()]};
      for(let i=60;i<930;i++)s.update(i*1000/60,1000/60);
      s._paused=true;a.pauseMusic();
      const main=a.triggers.songs.get(0);
      return {logo,after:{x:s._playerWorldX,id:main?.spec.id,start:main?.spec.start,volume:main?.levelVolume},
        logicCommands:l._logicTriggers.filter(t=>[1934,3602,3603,3605].includes(t.id)).length};
    });
    assert.equal(intro.logo.main,0);assert.equal(intro.logo.heldX,0);assert.ok(intro.logo.prepared.includes(1));
    assert.ok(intro.after.x>0);assert.equal(intro.after.id,1382827);assert.equal(intro.after.start,0);assert.ok(intro.after.volume>0);
    fs.writeFileSync(path.join(root,'work/audio-qa/skeletal-intro.json'),JSON.stringify(intro,null,2));
    console.log('PASS actual Skeletal first-attempt intro mutes main, prepares logo channels and starts the main song from zero');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
