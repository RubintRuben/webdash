// Eclipse MegaOverlay presentation, connected to Web Dash's gameplay settings.
// The font is Rubik (SIL OFL); theme values follow Eclipse's megaoverlay.json.
(function () {
  'use strict';
  const scene = () => window.scene?.get('GameScene');
  const state = { scale: 1, accent: '#ab2cb7', labels: true, decimals: 2, animate: true, animationTime: .3,
    positions: {}, keys: { Noclip: 'Digit1' }, keyTargets:{}, values: {},
    noclipP1:true, noclipP2:true, noclipAccuracyLimit:95, noclipDeathLimit:2,
    noclipTintColor:'#ff0000', noclipTintOpacity:90, noclipTintTime:0,
    hitboxBorder:.25, hitboxFill:.25, hitboxFillEnabled:true, hitboxTrailLength:240,
    trajectoryIterations:300, autoClickP1:true, autoClickP2:true, autoClickHold:1, autoClickRelease:1,
    autoKillPercentage:50,autoKillPercentageEnabled:true,autoKillTime:90,
    frameHold:true,frameHoldDelay:.25,frameHoldSpeed:5,respawnDelay:1,
    waveScale:2,waveRainbowSpeed:.5,waveSaturation:100,waveValue:100,waveColor:'#ffffff',stackWindows:true };
  try { Object.assign(state, JSON.parse(localStorage.getItem('gd_eclipse') || '{}')); } catch (_) {}
  // Version 2 incorrectly migrated Eclipse's enabled fill to disabled.
  if(state.hitboxStyleVersion===2)state.hitboxFillEnabled=true;
  state.hitboxStyleVersion=3;
  state.keys={'Previous Startpos':'KeyQ','Next Startpos':'KeyE','Step Key':'KeyC',...state.keys};
  let root, columns, popup, opener, capturingKey = null, transition = 0;
  window.GDIsTextInput = element => !!element && (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable);
  const popupStack=[];
  const hotkeys=new Map();
  hotkeys.set('Previous Startpos',()=>{if(window.startPosSwitcher)scene()?.changeStartPos(-1);});
  hotkeys.set('Next Startpos',()=>{if(window.startPosSwitcher)scene()?.changeStartPos(1);});
  const stepFrame=()=>{const s=scene();if(s&&window.frameStepper){s._frameStepBudget=(s._frameStepBudget||0)+1;window._frameStepPressedAt=performance.now();}};
  hotkeys.set('Step Key',stepFrame);
  const bindings = [];
  function save() {
    localStorage.setItem('gd_eclipse', JSON.stringify(state));
    scene()?._saveSettings?.();
  }
  const node = (tag, className, text) => {
    const n = document.createElement(tag); n.className = className || '';
    if (text != null) n.textContent = text;
    return n;
  };
  function setting(key, fallback) {
    return { key,kind:'window',get: () => window[key] ?? state.values[key] ?? fallback, set: value => { window[key] = value; state.values[key]=value; } };
  }
  const option=(key,fallback)=>({key,kind:'option',get:()=>state[key]??fallback,set:v=>{state[key]=v;}});
  function refresh() {
    for(let i=bindings.length-1;i>=0;i--){const update=bindings[i];if(update.element&&!update.element.isConnected)bindings.splice(i,1);else update();}
    scene()?._pauseContainer?.setVisible(!window.hidePauseMenu);
  }
  function closePopup(all=true) {
    popup?.remove(); popup = null;
    opener?.setAttribute('aria-expanded', 'false'); opener = null;
    if(all){for(const p of popupStack){p.popup.remove();p.opener.setAttribute('aria-expanded','false');}popupStack.length=0;}
    else if(popupStack.length){const previous=popupStack.pop();popup=previous.popup;opener=previous.opener;}
  }
  function placePopup() {
    if (!popup || !opener) return;
    for(const p of [...popupStack,{popup,opener}]){
      const r=p.opener.getBoundingClientRect(),box=p.popup.getBoundingClientRect();
      const x=r.right+4+box.width>innerWidth&&r.left>box.width?r.left-box.width-4:r.right+4;
      p.popup.style.left=Math.max(4,Math.min(innerWidth-box.width-4,x))+'px';
      p.popup.style.top=Math.max(4,Math.min(innerHeight-box.height-4,r.top-3))+'px';
    }
  }
  function openPopup(button, title, build) {
    const ancestor=popupStack.find(p=>p.popup.contains(button));
    if(ancestor)while(popup!==ancestor.popup)closePopup(false);
    if(opener===button){closePopup(false);return;}
    if(popup?.contains(button))popupStack.push({popup,opener});
    else closePopup();
    opener = button; button.setAttribute('aria-expanded', 'true');
    popup = node('div', 'eclipse-popup'); popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', title); root.appendChild(popup); build(popup); placePopup();
    if(state.animate)popup.animate([{opacity:0,transform:'translateX(-6px)'},{opacity:1,transform:'translateX(0)'}],{duration:state.animationTime*1000});
  }
  function keybind(parent,title,run,id=title) {
    hotkeys.set(id,run);
    const row=node('div','eclipse-row'),label=node('span','eclipse-key-label',title),button=node('button','eclipse-key');
    const update=()=>{button.textContent=capturingKey===id?'Press a key…':(state.keys[id]||'None').replace(/^Key|^Digit/,'');};
    update.element=button;bindings.push(update);update();button.setAttribute('aria-label',title+' keybind');
    button.onclick=()=>{capturingKey=id;refresh();};
    const clear=node('button','eclipse-clear','×');clear.setAttribute('aria-label','Clear '+title+' keybind');
    clear.onclick=()=>{delete state.keys[id];capturingKey=null;refresh();save();};
    row.append(label,button,clear);parent.appendChild(row);
  }
  function toggle(parent, title, binding, options) {
    const owner=parent.closest('.eclipse-popup')?.getAttribute('aria-label'),id=owner?owner+':'+title:title;
    const row = node('div', 'eclipse-row');
    row.dataset.label=title;
    const button = node('button', 'eclipse-toggle', title);
    button.type = 'button'; button.setAttribute('role', 'switch');
    const update = () => { button.setAttribute('aria-checked', String(!!binding.get())); };
    update.element=button;bindings.push(update); update();
    button.onclick = () => { binding.set(!binding.get()); refresh(); save(); };
    hotkeys.set(id,()=>{binding.set(!binding.get());refresh();save();});
    if(binding.key)state.keyTargets[id]={key:binding.key,kind:binding.kind};
    button.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();openPopup(button,title+' keybind',q=>keybind(q,title,hotkeys.get(id),id));};
    row.appendChild(button);
    if (options) {
      const arrow = node('button', 'eclipse-arrow', '▶'); arrow.type = 'button';
      arrow.setAttribute('aria-label', title + ' settings'); arrow.setAttribute('aria-expanded', 'false');
      arrow.onclick = () => openPopup(arrow, title, q=>{options(q);keybind(q,title,hotkeys.get(id),id);}); row.appendChild(arrow);
    }
    parent.appendChild(row); return button;
  }
  function number(parent, title, binding, min, max, step = .1, digits = 2) {
    const row = node('label', 'eclipse-row eclipse-number');
    row.dataset.label=title;
    const input = node('input'); input.type = 'text'; input.inputMode='decimal';input.setAttribute('role','spinbutton');
    input.setAttribute('aria-valuemin',min);input.setAttribute('aria-valuemax',max);
    input.setAttribute('aria-label', title); input.value = Number(binding.get()).toFixed(digits);
    input.onchange = () => {
      const v = Number(input.value.replace(',','.'));
      if (input.value.trim() && Number.isFinite(v)) { binding.set(Math.max(min, Math.min(max, v))); save(); }
      input.value = Number(binding.get()).toFixed(digits);
      input.setAttribute('aria-valuenow',binding.get());
    };
    input.onkeydown=e=>{if(e.code==='ArrowUp'||e.code==='ArrowDown'){
      e.preventDefault();const typed=Number(input.value.replace(',','.'));
      input.value=String((Number.isFinite(typed)?typed:Number(binding.get()))+(e.code==='ArrowUp'?step:-step));input.onchange();
    }else if(e.code==='Enter'){e.preventDefault();input.onchange();input.blur();}};
    row.append(input, node('span', '', title)); parent.appendChild(row); return input;
  }
  function action(parent, title, run) {
    const button = node('button', 'eclipse-action', title); button.type = 'button';
    button.onclick = () => { run(); refresh(); }; parent.appendChild(button); hotkeys.set(title,run);
    button.oncontextmenu=e=>{e.preventDefault();openPopup(button,title+' keybind',q=>keybind(q,title,run));};return button;
  }
  function color(parent,title,key,fallback) {
    const row=node('label','eclipse-row eclipse-number'),input=node('input');input.type='color';input.value=state[key]||fallback;
    input.setAttribute('aria-label',title);input.oninput=()=>{state[key]=input.value;save();};row.append(input,node('span','',title));parent.appendChild(row);
  }
  function numberToggle(parent,title,key,enabled,min,max,step,digits) {
    const input=number(parent,title,option(key),min,max,step,digits),row=input.parentElement;
    const button=node('button','eclipse-value-toggle');button.setAttribute('role','switch');button.setAttribute('aria-label',title+' enabled');
    const update=()=>button.setAttribute('aria-checked',String(!!state[enabled]));update.element=button;bindings.push(update);update();
    button.onclick=()=>{state[enabled]=!state[enabled];refresh();save();};row.insertBefore(button,row.querySelector('span'));
    const owner=parent.closest('.eclipse-popup')?.getAttribute('aria-label'),id=owner?owner+':'+title:title;
    hotkeys.set(id,button.onclick);state.keyTargets[id]={key:enabled,kind:'option'};
    button.oncontextmenu=e=>{e.preventDefault();openPopup(button,title+' keybind',q=>keybind(q,title,button.onclick,id));};
  }
  function panel(column, title, build) {
    const section = node('section', 'eclipse-panel'), header = node('button', 'eclipse-header', title);
    header.type = 'button'; header.setAttribute('aria-expanded', 'true');
    const body = node('div', 'eclipse-body');
    header.onclick = () => { body.hidden = !body.hidden; header.setAttribute('aria-expanded', String(!body.hidden)); };
    section.append(header, body); column.appendChild(section); build(body);
    if(title==='Player'){
      const order=['AutoClicker','Auto Kill','Custom Wave Trail','Frame Stepper','Hide Player','Jump Hack','No Death Effect','No Hide Trigger','No Respawn Flash','No Robot Fire','No Spider Dash','No Trail','No Vehicle Particles','Noclip','Show Trajectory','Solid Wave Trail','Respawn Delay'];
      for(const row of [...body.children].sort((a,b)=>order.indexOf(a.dataset.label)-order.indexOf(b.dataset.label)))body.appendChild(row);
    }
    section.dataset.title=title;
    const saved=state.positions[title];
    if(state.stackWindows===false&&saved)section.style.translate=saved.x+'px '+saved.y+'px';
    let drag;
    header.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const pos=state.stackWindows===false?(state.positions[title]||{x:0,y:0}):{x:0,y:0};
      drag={x:e.clientX,y:e.clientY,px:pos.x,py:pos.y,moved:false};
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener('pointermove',e=>{
      if(!drag)return;
      const z=Number(getComputedStyle(columns).zoom)||1,dx=(e.clientX-drag.x)/z,dy=(e.clientY-drag.y)/z;
      if(Math.hypot(dx,dy)>3)drag.moved=true;
      if(!drag.moved)return;
      const pos={x:drag.px+dx,y:drag.py+dy};
      state.positions[title]=pos;section.style.translate=pos.x+'px '+pos.y+'px';section.style.zIndex='3';placePopup();
    });
    function endDrag(){
      if(drag?.moved){
        header.dataset.dragged='1';
        if(state.stackWindows!==false){
          const from=section.style.translate;section.style.translate='0px 0px';delete state.positions[title];
          if(state.animate)section.animate([{translate:from},{translate:'0px 0px'}],{duration:state.animationTime*1000,easing:'ease-in-out'});
        }
        save();
      }
      drag=null;section.style.zIndex='';
    }
    header.addEventListener('pointerup',endDrag);header.addEventListener('pointercancel',endDrag);
    const click=header.onclick;header.onclick=e=>{if(header.dataset.dragged){delete header.dataset.dragged;return;}click(e);};
  }
  function dimensions() {
    if (!root) return;
    const scale = Math.max(.55, Math.min(1.5, Number(state.scale) || 1)) * Math.min(1, innerWidth / 1792);
    root.style.setProperty('--eclipse-scale', scale);
    root.style.setProperty('--eclipse-accent', state.accent); placePopup();
  }
  function mount() {
    root = node('div', 'eclipse-overlay'); root.id = 'eclipse-menu'; root.hidden = true;
    root.setAttribute('aria-label', 'Eclipse mod menu');
    columns = node('div', 'eclipse-columns'); root.appendChild(columns); document.body.appendChild(root);
    const col = Array.from({ length: 8 }, () => { const c = node('div', 'eclipse-column'); columns.appendChild(c); return c; });
    panel(col[0], 'Global', p => {
      number(p, 'Speedhack', setting('speedHack', 1), .1, 10, .05, 4);
      toggle(p, 'Click Between Frames', setting('clickBetweenFrames', false));
    });
    panel(col[1], 'Level', p => {
      toggle(p, 'Accurate Percentage', setting('percentageDecimals', false), q => {
        toggle(q, 'Normal Mode', setting('showPercentage', true));
        number(q, 'Decimal Places', { get: () => state.decimals, set: v => { state.decimals = v; window.percentagePrecision = v; } }, 0, 6, 1, 0);
      });
      toggle(p, 'Startpos Switcher', setting('startPosSwitcher', false), q => {
        keybind(q,'Previous Startpos',()=>{if(window.startPosSwitcher)scene()?.changeStartPos(-1);});
        keybind(q,'Next Startpos',()=>{if(window.startPosSwitcher)scene()?.changeStartPos(1);});
        action(q, 'Previous Startpos', () => { setOpen(false); scene()?.changeStartPos(-1); });
        action(q, 'Next Startpos', () => { setOpen(false); scene()?.changeStartPos(1); });
      });
      toggle(p, 'No Object Glow', { get: () => window.showGlow === false, set: v => { window.showGlow = !v; } });
      toggle(p, 'No Particles', setting('noParticles', false));
      toggle(p, 'Low Detail Mode', setting('enableLDM', false));
      toggle(p, 'Hide Pause Menu', setting('hidePauseMenu', false));
      toggle(p,'No Mirror',setting('noMirror',false));toggle(p,'Instant Mirror',setting('instantMirror',false));
      toggle(p,'No Shaders',setting('noShaders',false));
      toggle(p, 'Show Hitboxes', setting('showHitboxes', false), q => {
        toggle(q, 'Hide Player', option('hitboxHidePlayer',false));
        toggle(q, 'Hitboxes On Death', setting('hitboxesOnDeath', false));
        toggle(q, 'Custom Colors', option('hitboxCustomColors',false),c=>{
          for(const [title,key,hex] of [['Solid Color','hitboxSolid','#003fff'],['Danger Color','hitboxDanger','#ff0000'],['Other Color','hitboxOther','#00ff00'],['Player Color','hitboxPlayer','#ff0000'],['Player Color Inner','hitboxInner','#00ff33'],['Player Color Rotated','hitboxRotated','#ffff00']])color(c,title,key,hex);
        });
        number(q,'Border Size',option('hitboxBorder'),.01,10,.01,2);
        numberToggle(q,'Fill Alpha','hitboxFill','hitboxFillEnabled',0,1,.01,2);
        toggle(q, 'Hitbox Trail', setting('showHitboxTrail', false));
        number(q,'Trail Length',option('hitboxTrailLength'),1,2000,1,0);
      });
    });
    panel(col[2], 'Bypass', p => {
      toggle(p, 'Practice Music Sync', setting('practiceMusicSync', false));
      toggle(p, 'Portal Helpers', setting('enablePortalGuide', true));
      toggle(p, 'Orb Helpers', setting('enableOrbGuide', false));
    });
    panel(col[3], 'Player', p => {
      toggle(p, 'Hide Player', setting('hidePlayer', false));
      toggle(p,'Custom Wave Trail',setting('customWaveTrail',false),q=>{
        number(q,'Scale',option('waveScale',2),0,10,.01,2);
        toggle(q,'Rainbow',option('waveRainbow',false),c=>{
          number(c,'Speed',option('waveRainbowSpeed',.5),0,10000,.01,2);
          number(c,'Saturation',option('waveSaturation',100),0,100,.01,2);
          number(c,'Value',option('waveValue',100),0,100,.01,2);
        });
        toggle(q,'Custom color',option('waveCustomColor',false),c=>color(c,'Color','waveColor','#ffffff'));
      });
      toggle(p, 'Solid Wave Trail', setting('solidWave', false));
      toggle(p, 'Noclip', setting('noClip', false), q => {
        toggle(q, 'Player 1', option('noclipP1',true));toggle(q, 'Player 2', option('noclipP2',true));
        numberToggle(q,'Accuracy Limit','noclipAccuracyLimit','noclipAccuracyLimitEnabled',.01,100,.01,2);
        numberToggle(q,'Death Limit','noclipDeathLimit','noclipDeathLimitEnabled',1,100,1,0);
        toggle(q,'Noclip Tint',option('noclipTint',false));color(q,'Tint Color','noclipTintColor','#ff0000');
        number(q,'Tint Opacity',option('noclipTintOpacity'),0,100,1,0);number(q,'Tint Time',option('noclipTintTime'),0,5,.01,2);
      });
      toggle(p,'AutoClicker',setting('autoClicker',false),q=>{
        toggle(q,'Player 1',option('autoClickP1',true));toggle(q,'Player 2',option('autoClickP2',true));
        number(q,'Hold Interval',option('autoClickHold'),1,1000,1,0);number(q,'Release Interval',option('autoClickRelease'),1,1000,1,0);
      });
      toggle(p,'Show Trajectory',setting('showTrajectory',false),q=>number(q,'Iterations',option('trajectoryIterations',300),1,1000,1,0));
      toggle(p,'Frame Stepper',setting('frameStepper',false),q=>{
        keybind(q,'Step Key',stepFrame);toggle(q,'Enable Hold',option('frameHold',true));
        number(q,'Hold Delay',option('frameHoldDelay'),0,10,.01,2);number(q,'Hold Speed',option('frameHoldSpeed'),0,100,1,0);
      });
      toggle(p,'Jump Hack',setting('jumpHack',false));
      toggle(p,'Auto Kill',setting('autoKill',false),q=>{
        numberToggle(q,'Kill at Percentage','autoKillPercentage','autoKillPercentageEnabled',0,100,.01,2);
        numberToggle(q,'Kill at Time','autoKillTime','autoKillTimeEnabled',0,3600,.01,2);
      });
      toggle(p,'No Death Effect',setting('noDeathEffect',false));toggle(p,'No Respawn Flash',setting('noRespawnFlash',false));
      toggle(p,'No Robot Fire',setting('noRobotFire',false));
      toggle(p,'No Hide Trigger',setting('noHideTrigger',false));toggle(p,'No Trail',setting('noTrail',false));
      toggle(p,'No Vehicle Particles',setting('noVehicleParticles',false));toggle(p,'No Spider Dash',setting('noSpiderDash',false));
      numberToggle(p,'Respawn Delay','respawnDelay','respawnDelayEnabled',0,120,.05,2);
    });
    panel(col[4], 'Bot', p => {
      action(p, 'Record', () => scene()?._startMacroRecording?.());
      action(p, 'Stop Recording', () => scene()?._stopMacroRecording?.());
      action(p, 'Playback', () => { const s = scene(); if (s?._macroBot?.frames?.length) s._startMacroPlayback(s._macroBot.exportObject()); });
      action(p, 'Stop Playback', () => scene()?._stopMacroPlayback?.());
      action(p, 'Save Replay', () => scene()?._exportMacroFile?.());
    });
    panel(col[4], 'Interface', p => {
      number(p, 'UI Scale', { get: () => state.scale, set: v => { state.scale = v; dimensions(); } }, .55, 1.5, .05, 3);
      const font = node('div', 'eclipse-note', 'Rubik                 Font'); p.appendChild(font);
      const style = node('div', 'eclipse-note', 'MegaOverlay       Style'); p.appendChild(style);
      toggle(p,'Animate Windows',option('animate',true),q=>number(q,'Duration',option('animationTime',.18),0,1,.01,2));
      toggle(p,'Stack Windows',option('stackWindows',true));
      action(p,'Reset Window Positions',()=>{state.positions={};for(const c of columns.querySelectorAll('.eclipse-panel'))c.style.translate='0px 0px';save();});
      const color = node('label', 'eclipse-row eclipse-number'), input = node('input'); input.type = 'color'; input.value = state.accent;
      input.setAttribute('aria-label', 'Accent Color'); input.oninput = () => { state.accent = input.value; dimensions(); save(); };
      color.append(input, node('span', '', 'Accent Color')); p.appendChild(color);
      const search = node('input', 'eclipse-search'); search.placeholder = 'Search'; search.setAttribute('aria-label', 'Search hacks');
      search.oninput = () => {
        const q = search.value.trim().toLowerCase();
        for (const row of columns.querySelectorAll('.eclipse-row,.eclipse-action')) row.hidden = !!q && !row.textContent.toLowerCase().includes(q);
      }; p.appendChild(search);
    });
    panel(col[5], 'Creator', p => {
      toggle(p, 'Show Object IDs', setting('showObjectIds', false));
      toggle(p, 'Editor Glow', setting('showEditorGlow', false));
      toggle(p, 'Mini Icon', setting('enableMiniIcon', false));
    });
    panel(col[5], 'Keybinds', p => {
      p.appendChild(node('div', 'eclipse-note', 'Open Menu                  Tab'));
      p.appendChild(node('div', 'eclipse-note', 'Right-click a hack to set its keybind.'));
      keybind(p,'Noclip',hotkeys.get('Noclip'));
      keybind(p,'Show Hitboxes',hotkeys.get('Show Hitboxes'));
    });
    panel(col[6], 'Labels', p => {
      toggle(p, 'Show Labels', { get: () => state.labels, set: v => {
        state.labels = v; window.eclipseHideLabels = !v;
        const s = scene();
        if (!v) { state.fpsVisible = !!s?._fpsText?.visible; s?._fpsText?.setVisible(false); }
        else s?._fpsText?.setVisible(!!(state.fpsEnabled ?? state.fpsVisible));
      } });
      toggle(p, 'FPS', { get: () => state.fpsEnabled ?? !!scene()?._fpsText?.visible, set: v => {state.fpsEnabled=v;scene()?._fpsText?.setVisible(v&&state.labels);} });
      toggle(p, 'Percentage', setting('showPercentage', true), q => {
        number(q, 'Decimal Places', { get: () => state.decimals, set: v => { state.decimals = v; window.percentagePrecision = v; window.percentageDecimals = v > 0; } }, 0, 6, 1, 0);
      });
      toggle(p, 'CPS', setting('showCPS', false));
      toggle(p, 'Noclip Accuracy', setting('noClipAccuracy', false));
      toggle(p, 'Noclip Deaths', setting('noClipDeaths', false));
    });
    panel(col[7], 'Shortcuts', p => {
      action(p, 'Restart Level', () => { setOpen(false); if (!scene()?._menuActive) scene()?._restartLevel(); });
      action(p, 'Toggle Practice Mode', () => { const s = scene(); if (!s?._menuActive) { s._practicedMode.togglePracticeMode(); s._checkpointBtnContainer?.setVisible(s._practicedMode.practiceMode); } });
      action(p, 'Place Checkpoint', () => { const s = scene(); if (s?._practicedMode.practiceMode) s._practicedMode.saveCheckpoint(s._state, s._playerWorldX, s._cameraX, s); });
      action(p, 'Remove Checkpoint', () => scene()?._practicedMode.deleteLastCheckpoint?.());
      action(p, 'Show Options', () => { setOpen(false); scene()?._buildSettingsPopup(); });
    });
    root.addEventListener('pointerdown', e => { if (popup && !popup.contains(e.target) && !opener?.contains(e.target) && !popupStack.some(p=>p.popup.contains(e.target))) closePopup(); });
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.addEventListener('keydown',e=>e.stopPropagation());
    root.addEventListener('keyup',e=>e.stopPropagation());
    dimensions();
  }
  function setOpen(value) {
    if (!root) mount();
    if(value===!!window.eclipseMenuOpen)return;
    const revision=++transition;
    closePopup();window.eclipseMenuOpen=value;root.hidden=false;root.style.pointerEvents=value?'':'none';
    const s=scene();
    if(value){
      refresh();dimensions();
      if(s){s._pressUnseen=s._pressUnseen2=false;s._releaseButton?.();s._releaseSecondPlayerButton?.();s._jumpEventQueue=[];s._jumpEventHeld={};}
    }else{save();s?.game?.canvas?.focus();}
    s?.input?.keyboard?.resetKeys();
    // Eclipse TabbedLayout::toggle moves each window to/from a random
    // off-screen edge, using the configured easing in both directions.
    const animations=[];
    for(const panel of columns.querySelectorAll('.eclipse-panel')){
      panel.getAnimations().forEach(a=>a.cancel());
      const rect=panel.getBoundingClientRect(),z=Number(getComputedStyle(columns).zoom)||1;
      const side=Math.floor(Math.random()*4);
      const dx=side===2?(-rect.right-8)/z:side===3?(innerWidth-rect.left+8)/z:0;
      const dy=side===0?(-rect.bottom-8)/z:side===1?(innerHeight-rect.top+8)/z:0;
      const off='translate('+dx+'px,'+dy+'px)',on='translate(0,0)';
      if(state.animate)animations.push(panel.animate([{transform:value?off:on},{transform:value?on:off}],{
        duration:Math.max(0,state.animationTime)*1000,easing:'cubic-bezier(.45,0,.55,1)',fill:'both'}).finished.catch(()=>{}));
    }
    Promise.all(animations).then(()=>{if(revision!==transition)return;
      if(!value)root.hidden=true;
      for(const p of columns.querySelectorAll('.eclipse-panel'))p.getAnimations().forEach(a=>a.cancel());
    });
  }
  window.percentagePrecision = state.decimals;
  window.eclipseHideLabels = !state.labels;
  Object.assign(window,state.values);
  window.GDHacks = { state, setOpen, get isOpen() { return !!window.eclipseMenuOpen; } };
  window.addEventListener('keydown', e => {
    if(capturingKey){e.preventDefault();e.stopImmediatePropagation();if(e.code!=='Escape'&&e.code!=='Tab')state.keys[capturingKey]=e.code;capturingKey=null;refresh();save();return;}
    if (e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) setOpen(!window.eclipseMenuOpen); return; }
    if (window.eclipseMenuOpen) {
      if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(popup)closePopup(false);else setOpen(false);return;}
      if(root.contains(e.target))return;
      e.stopImmediatePropagation();
      return;
    }
    // Phaser's global key captures also prevent the browser's text insertion.
    // Stop at the window capture phase, while preserving input default actions.
    if (window.GDIsTextInput(e.target)) { e.stopImmediatePropagation(); return; }
    // The online search uses a canvas text field with its own window
    // listener. It must receive letters before any mod keybind consumes them.
    if(scene()?._searchHtmlInput?.focused)return;
    const playing=scene();
    if(window.clickBetweenFrames&&playing&&!playing._menuActive&&!playing._slideIn&&!playing._paused&&!playing._levelWon&&!playing._state?.isDead&&['Space','ArrowUp','KeyW','KeyL'].includes(e.code)&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){
      e.preventDefault();e.stopImmediatePropagation();if(!e.repeat){const s=scene();s?._queueJumpEvent(true,e.timeStamp,s._isTwoPlayerMode()&&['ArrowUp','KeyL'].includes(e.code)?2:1);}return;
    }
    if (!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) {
      for(const [title,key] of Object.entries(state.keys))if(e.code===key){
        if(title==='Step Key'){if(!window.frameStepper)continue;window._frameStepHeld=true;}
        if(e.repeat){e.preventDefault();e.stopImmediatePropagation();continue;}e.preventDefault();e.stopImmediatePropagation();if(!root)mount();
        const run=hotkeys.get(title);if(run)run();else{const target=state.keyTargets[title];if(target){const bind=target.kind==='option'?option(target.key):setting(target.key,false);bind.set(!bind.get());refresh();save();}}
      }
    }
  }, true);
  window.addEventListener('keyup', e => {
    if(scene()?._searchHtmlInput?.focused&&!window.eclipseMenuOpen)return;
    if (window.GDIsTextInput(e.target) && !window.eclipseMenuOpen) { e.stopImmediatePropagation(); return; }
    if(e.code===state.keys['Step Key'])window._frameStepHeld=false;
    if(window.clickBetweenFrames&&['Space','ArrowUp','KeyW','KeyL'].includes(e.code)&&!window.eclipseMenuOpen){e.preventDefault();e.stopImmediatePropagation();const s=scene();s?._queueJumpEvent(false,e.timeStamp,s._isTwoPlayerMode()&&['ArrowUp','KeyL'].includes(e.code)?2:1);return;}
    if ((window.eclipseMenuOpen&&!root.contains(e.target)) || e.code === 'Tab') e.stopImmediatePropagation();
  }, true);
  window.addEventListener('resize', dimensions);
  window.addEventListener('blur',()=>{window._frameStepHeld=false;});
})();
