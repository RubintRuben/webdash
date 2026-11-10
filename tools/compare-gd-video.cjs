// Reproducible visual comparison. Left = supplied GD video; right = web port.
// node tools/compare-gd-video.cjs fixture.txt video.mp4 outdir 1,2,5 [videoOffset]
// GD_INPUT: JSON replay with [{time,down}], in seconds from level start.
// GD_WAVE_Y: optional scripted wave height in WEB units, to test touch portals.
// GD_PRE: optional JS file evaluated in the page before the run starts.
// GD_BASELINE_DIR: optional saved source directory for before/after checks.
// GD_REALTIME=1: run through actual browser frames (required with GD_AUDIO).
// GD_AUDIO: original local song; uses the real Web Audio analyser for pulses.
// GD_WORLD_X=1: capture at GD world-X positions instead of elapsed seconds;
// requires GD_REALTIME=1 and GD_REFERENCE_DIR with matching native-X.png files.
// The height controller is a test route, not a recording of the video's inputs.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {execFileSync} = require('node:child_process');
let chromium;
try { ({chromium} = require('playwright')); } catch { ({chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
(async () => {
  const [fixture, video, output, timesArg, offsetArg] = process.argv.slice(2);
  const times = timesArg.split(',').map(Number).sort((a,b)=>a-b), offset = Number(offsetArg || 0);
  const realtime=process.env.GD_REALTIME==='1',audioFile=process.env.GD_AUDIO;
  if(audioFile&&!realtime)throw Error('GD_AUDIO requires GD_REALTIME=1: accelerated stepping cannot sample live audio at matching song times');
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--use-angle=d3d11']});
  try {
    const page = await browser.newPage({viewport:{width:1138,height:640}}), errors=[];
    page.on('pageerror', e=>errors.push(e.stack));
    if(process.env.GD_BASELINE_DIR) await page.route('**/assets/scripts/core/*.js?*',route=>{
      const file=path.join(process.env.GD_BASELINE_DIR,path.basename(new URL(route.request().url()).pathname));
      return fs.existsSync(file)?route.fulfill({path:path.resolve(file),contentType:'application/javascript'}):route.continue();
    });
    await page.goto((process.env.WD_URL || 'http://127.0.0.1:8790/')+'?devraf=1', {waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.scene?.get('GameScene')?._level,null,{timeout:120000});
    // Do not click the menu to initialise the fixture: its queued press can
    // leak into the fresh attempt and add a jump absent from the replay.
    await page.evaluate(data=>{
      const s=window.scene.get('GameScene'); window.__oldLevel=s._level;
      const update=s.update;
      s.__stopAfterSlide=true;
      s.update=function(t,dt){
        update.call(this,t,dt);
        if(s.__stopAfterSlide && s._level!==window.__oldLevel && !s._slideIn && !s._menuActive)s._paused=true;
      };
      window._onlineLevelId='local_visual_test'; window._onlineLevelString=data.level;
      window.currentlevel=[data.songId ? `ng_song_${data.songId}` : 'stereo_madness','Visual test','local_visual_test',['Local','Test']];
      s.game.registry.set('autoStartGame',true); s.scene.restart();
    },{level:fs.readFileSync(fixture,'utf8'),songId:process.env.GD_SONG_ID});
    await page.waitForFunction(()=>window.scene.get('GameScene')._level!==window.__oldLevel && !window.scene.get('GameScene')._slideIn,null,{timeout:120000});
    await page.waitForFunction(()=>!window.scene.get('GameScene')._audio.musicLoading,null,{timeout:120000});
    await page.evaluate(()=>window.scene.get('GameScene')._audio.pauseMusic());
    await page.waitForFunction(()=>!window.scene.get('GameScene')._level.gdRenderer.objects.some(o=>o.labelPending!==undefined),null,{timeout:120000});
    if(process.env.ATTEMPT2) {
      await page.evaluate(()=>{const s=window.scene.get('GameScene'); window.noClip=true;s.__stopAfterSlide=false;s._paused=false;for(let i=0;i<240;i++)s.update(i*1000/60,1000/60);s._restartLevel();s.__stopAfterSlide=true;});
      await page.waitForFunction(()=>!window.scene.get('GameScene')._slideIn);
    }
    // GD_PRE: a JS file evaluated in the page before stepping (route fixes,
    // e.g. firing a touch trigger the scripted route cannot reach).
    if(process.env.GD_PRE)console.log(JSON.stringify(await page.evaluate(fs.readFileSync(process.env.GD_PRE,'utf8'))));
    if(audioFile){
      await page.route('**/__visual_original_song',route=>route.fulfill({path:path.resolve(audioFile),contentType:/\.ogg$/i.test(audioFile)?'audio/ogg':'audio/mpeg'}));
      await page.evaluate(async()=>{
        const s=window.scene.get('GameScene'),ctx=s.sound.context;
        await ctx.resume();
        window._onlineSongBuffer=await ctx.decodeAudioData(await(await fetch('/__visual_original_song')).arrayBuffer());
        window._onlineSongKey=window.currentlevel[0];
        s._audio.startMusic(0);s._audio.pauseMusic();
        s._audio._meterValue=s._audio._lastAudio=.1;s._audio._meterClock=s._audio._lastPeak=s._audio._silenceCounter=0;
      });
    }
    const input=process.env.GD_INPUT?JSON.parse(fs.readFileSync(process.env.GD_INPUT,'utf8')):[];
    await page.evaluate(({input,waveY,noclip})=>{
      const s=window.scene.get('GameScene'); window.noClip=noclip; window.showPercentage=false;
      s._paused=true;s.__stopAfterSlide=false; s.__visualFrame=0; s.__inputIndex=0; s.__testTime=0; s.__testDown=false;
      window.__visualInitial={physicsFrame:s._physicsFrame,x:s._playerWorldX,y:s._state.y,clock:s._level._spawnClock,audioSeek:s._audio._music?.seek,songOffset:Number(window.settingsMap?.kA13)||0};
      const update=s._updateSimulationStep;
      s._updateSimulationStep=function(t,dt){
        // Phaser still calls this while a screenshot/ffmpeg capture holds
        // gameplay paused. Those calls must not advance the input replay's
        // clock or deliver its next presses during image generation.
        if(s._paused||s._menuActive||s._slideIn||s._state.isDead||s._levelWon||s._waitingForLevelMusic)
          return update.call(this,t,dt);
        while(s.__inputIndex<input.length && input[s.__inputIndex].time<=s.__testTime+1e-9){
          const down=!!input[s.__inputIndex++].down;
          if(down!==s.__testDown || (down&&!s._state.upKeyDown&&!s._level.logicState.controlsDisabled(1))){s.__testDown=down;down?s._pushButton():s._releaseButton();}
        }
        if(Number.isFinite(waveY) && s._state.isWave){
          const down=(s._state.y<waveY)!==!!s._state.gravityFlipped;
          if(down!==s.__testDown || (down&&!s._state.upKeyDown&&!s._level.logicState.controlsDisabled(1))){s.__testDown=down;down?s._pushButton():s._releaseButton();}
        }
        const warp=s._level.logicState.timeWarp;
        const frame=s._physicsFrame;
        update.call(this,t,dt);
        if(s._physicsFrame!==frame)s.__testTime+=dt/(warp*1000);
        const capturePosition=s.__captureWorldX?s._playerWorldX/2:s.__testTime;
        if(s.__realCaptureTarget!==undefined&&capturePosition+1e-8>=s.__realCaptureTarget){s._paused=true;s._audio.pauseMusic();}
      };
    },{input,waveY:process.env.GD_WAVE_Y?Number(process.env.GD_WAVE_Y):null,noclip:process.env.GD_NOCLIP!=='0'});
    const frames=[];
    const worldX=process.env.GD_WORLD_X==='1';
    if(worldX) await page.evaluate(()=>window.scene.get('GameScene').__captureWorldX=true);
    const cpu = process.env.GD_CPU_PROFILE ? await page.context().newCDPSession(page) : null;
    if(cpu){await cpu.send('Profiler.enable');await cpu.send('Profiler.start');}
    for(const t of times){
      if(realtime){
        await page.evaluate(t=>{const s=window.scene.get('GameScene');s.__realCaptureTarget=t;s._audio.resumeMusic();s._paused=false;},t);
        await page.waitForFunction(()=>window.scene.get('GameScene')._paused,null,{timeout:worldX?300000:Math.max(120000,t*2000)});
      }
      const state=await page.evaluate(async ({t,realtime})=>{
        const s=window.scene.get('GameScene');s._paused=false;
        if(!realtime)while(s.__visualFrame<Math.round(t*60)&&!s._levelWon){const tt=s.__visualFrame*1000/60;s.update(tt,1000/60);s.sys.events.emit('postupdate',tt,1000/60);s.__visualFrame++;}
        s._paused=true;s._level.cameraState.updateVisual();
        await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
        // The first draw after many unrendered steps can show stale particle
        // quads (a harness artifact; real play draws every step). Draw again.
        s._level._syncGDRenderer(0);s._level.cameraState.updateVisual();
        await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
        const l=s._level,c=l.cameraState;
        return {time:t,replayTime:s.__testTime,realTicks:s._physicsFrame,x:s._playerWorldX,y:s._state.y,mode:{wave:s._state.isWave,ship:s._state.isFlying},
          speed:playerSpeed,warp:l.logicState.timeWarp,simulationTime:l._spawnClock,view:c.view(1138,640,s._cameraX,s._cameraY),
          camera:c.capture(),shaders:l.shaderState.uniforms(),quads:l.gdRenderer.quadCount,
          audio:{transport:s._audio.getLevelPosition(),seek:s._audio._music?.seek,meter:s._audio.getMeteringValue(),pulse:s._player._waveTrail?._pulse,
            playing:s._audio._music?.isPlaying,paused:s._audio._music?.isPaused,context:s.sound.context.state,
            volume:s._audio._music?.volume,source:!!s._audio._onlineSource,primary:s._audio.triggers?.ownsPrimary},
          gradients:[...l.gradientState.active].map(([id,trig])=>({id,uid:trig.uid,raw:trig.raw,
            targets:[203,204,205,206].map(k=>({group:trig.raw[k],point:l.gradientState.target(trig.raw[k])})),
            positions:l.gradientState.items.get(id)?.positions,colors:l.gradientState.items.get(id)?.colors}))};
      },{t,realtime});
      if(process.env.GD_CAPTURE) state.capture=await page.evaluate(fs.readFileSync(process.env.GD_CAPTURE,'utf8'));
      const tag=String(t).replace('.','_'), web=path.join(output,`web-${tag}.png`), native=path.join(output,`native-${tag}.png`);
      await page.screenshot(); // discarded: see the stale-quad note above
      await page.screenshot({path:web});
      if(process.env.GD_REFERENCE_DIR) {
        fs.copyFileSync(path.join(process.env.GD_REFERENCE_DIR,`native-${tag}.png`),native);
      } else execFileSync('ffmpeg',['-v','error','-y','-ss',String(Math.max(0,t+offset)),'-i',video,'-frames:v','1','-vf','scale=1138:640',native]);
      execFileSync('ffmpeg',['-v','error','-y','-i',native,'-i',web,'-filter_complex','[0:v][1:v]hstack,scale=1707:480',path.join(output,`comparison-${tag}.png`)]);
      frames.push(state);console.log(JSON.stringify({time:t,x:state.x,y:state.y,speed:state.speed,warp:state.warp,view:state.view}));
    }
    const initial=await page.evaluate(()=>window.__visualInitial);
    if(cpu){const profile=await cpu.send('Profiler.stop');fs.writeFileSync(path.join(output,'cpu-profile.json'),JSON.stringify(profile.profile));}
    fs.writeFileSync(path.join(output,'states.json'),JSON.stringify({fixture,video,offset,baseline:process.env.GD_BASELINE_DIR||null,initial,realtime,noclip:process.env.GD_NOCLIP!=='0',audioFile:audioFile||null,inputRoute:process.env.GD_WAVE_Y?'scripted-wave-height':process.env.GD_INPUT||'no input',preRoute:process.env.GD_PRE||null,attempt2:!!process.env.ATTEMPT2,waveY:process.env.GD_WAVE_Y?Number(process.env.GD_WAVE_Y):null,frames,errors},null,2));
    if(errors.length)throw new Error(errors.join('\n'));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
