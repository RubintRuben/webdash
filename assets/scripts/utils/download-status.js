(function(){
  'use strict';
  let banner,inline,wakePromise,readyAt=0,unavailable=false,hideTimer,waking=false;
  const assets=new Map();
  const subscribers=new Set();
  function mount(){
    if(banner)return banner;
    banner=document.createElement('aside');banner.id='gd-download-status';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
    banner.innerHTML='<strong></strong><span></span>';
    document.body.appendChild(banner);return banner;
  }
  function notice(title,detail=''){
    const el=mount();clearTimeout(hideTimer);el.hidden=false;el.querySelector('strong').textContent=title;el.querySelector('span').textContent=detail;
  }
  function snapshot(keys){
    const rows=[...assets.values()].filter(x=>!keys||keys.has(x.key)),done=rows.filter(x=>x.done).length,failed=rows.filter(x=>x.failed).length;
    const active=rows.some(x=>!x.done&&!x.failed),known=rows.length>0&&rows.every(x=>x.total>0||x.done||x.failed);
    const fraction=rows.length?rows.reduce((sum,x)=>sum+(x.done?1:x.total>0?Math.min(1,x.loaded/x.total):0),0)/rows.length:0;
    const sounds=rows.filter(x=>x.key.startsWith('sfx:')),music=rows.filter(x=>x.key.startsWith('song:'));
    const label=sounds.length?'Downloading sounds':music.length?'Downloading song':'Downloading';
    return {rows,done,failed,active,waking,fraction,known,
      text:waking&&active?'Connecting...':active?`${label}... ${known?Math.floor(fraction*100)+'%':done+'/'+rows.length}`:failed?'Download failed':rows.length?'Download complete':'',
      detail:sounds.length?`SFX: ${sounds.filter(x=>x.done).length}/${sounds.length}${music.length?'  Music: '+music.filter(x=>x.done).length+'/'+music.length:''}`:''};
  }
  function update(){
    const state=snapshot();let bound=false;
    for(const entry of subscribers){const value=entry.keys?snapshot(entry.keys):state;entry.fn(value);if(value.active)bound=true;}
    if(!inline){inline=document.createElement('aside');inline.id='gd-download-progress';inline.hidden=true;inline.setAttribute('role','status');inline.setAttribute('aria-live','polite');inline.innerHTML='<b aria-hidden="true">↓</b><div><strong></strong><progress max="1" value="0"></progress><span></span></div>';document.body.appendChild(inline);}
    inline.hidden=bound||(!state.active&&!waking);
    if(!inline.hidden){inline.querySelector('strong').textContent=state.text||'Connecting...';inline.querySelector('span').textContent=state.detail;
      const bar=inline.querySelector('progress');if(state.known)bar.value=state.fraction;else bar.removeAttribute('value');}
  }
  window.GDDownloads={
    error(title,detail){notice(title,detail,0);hideTimer=setTimeout(()=>{if(banner)banner.hidden=true;},12000);},
    subscribe(fn,keys){const entry={fn,keys:keys?new Set(keys):null};subscribers.add(entry);fn(snapshot(entry.keys));update();return()=>{subscribers.delete(entry);update();};},
    get state(){return snapshot();},
    plan(keys){assets.clear();for(const key of keys)assets.set(key,{key,loaded:0,total:0});update();},
    begin(key){if(!assets.has(key)&&![...assets.values()].some(x=>!x.done&&!x.failed))assets.clear();assets.set(key,{key,loaded:0,total:0});update();},
    progress(key,loaded,total){const row=assets.get(key);if(row){Object.assign(row,{loaded,total});update();}},
    finish(key,success=true){const row=assets.get(key);if(row&&!row.done&&!row.failed){row.done=success;row.failed=!success;if(!success)this.error('Download failed','Some sounds could not be downloaded. Please try again.');update();}},
    cancel(key){assets.delete(key);update();},
    get assets(){return [...assets.values()].map(x=>({...x}));}
  };
  window.readGdAudioResponse=async(response,key)=>{
    if(!response.body?.getReader)return response.arrayBuffer();
    const total=Number(response.headers.get('Content-Length'))||0,reader=response.body.getReader(),chunks=[];let loaded=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;window.GDDownloads.progress(key,loaded,total);}
    const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;
  };
  window.getGdBackendBase=()=>{
    const configured=String(window.WEBDASH_API_BASE||'').replace(/\/$/,'');
    if(configured)return configured;
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname)||location.hostname.endsWith('.onrender.com')?location.origin:null;
  };
  async function wake(){
    const base=window.getGdBackendBase();if(!base||unavailable)return false;
    const started=performance.now();let lastError;waking=true;update();
    try{
      while(performance.now()-started<95000){
        try{
          const res=await fetch(base+'/gd-health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
          if(res.status===404){unavailable=true;return false;}
          if(res.ok&&(await res.json()).ready){readyAt=performance.now();return true;}
          lastError=new Error('Download server HTTP '+res.status);
        }catch(e){lastError=e;}
        await new Promise(r=>setTimeout(r,1000));
      }
      notice('Download server unavailable','Please retry the download in a moment.');throw lastError||new Error('Download server unavailable');
    }finally{waking=false;update();}
  }
  window.ensureGdBackend=async signal=>{
    if(readyAt&&performance.now()-readyAt<60000)return true;
    if(!wakePromise){let failed=false;wakePromise=wake().catch(error=>{failed=true;throw error;}).finally(()=>{
      wakePromise=null;
      update();
      if(failed)hideTimer=setTimeout(()=>{if(banner)banner.hidden=true;},8000);
    });}
    if(!signal)return wakePromise;
    if(signal.aborted)throw signal.reason;
    let abort;const canceled=new Promise((_,reject)=>{abort=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});});
    try{return await Promise.race([wakePromise,canceled]);}finally{signal.removeEventListener('abort',abort);}
  };
})();
