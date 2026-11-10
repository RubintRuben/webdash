(function(){
  'use strict';
  let banner,wakePromise,readyAt=0,unavailable=false,hideTimer;
  const assets=new Map();
  function mount(){
    if(banner)return banner;
    banner=document.createElement('aside');banner.id='gd-download-status';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
    banner.innerHTML='<strong></strong><span></span><progress max="1" value="0"></progress>';
    document.body.appendChild(banner);return banner;
  }
  function notice(title,detail='',fraction=null){
    const el=mount();clearTimeout(hideTimer);el.hidden=false;el.querySelector('strong').textContent=title;el.querySelector('span').textContent=detail;
    const bar=el.querySelector('progress');if(fraction===null)bar.removeAttribute('value');else bar.value=fraction;
  }
  function update(){
    if(wakePromise)return;
    const rows=[...assets.values()],done=rows.filter(x=>x.done).length,failed=rows.filter(x=>x.failed).length;
    if(!rows.length){if(banner)banner.hidden=true;return;}
    const active=rows.find(x=>!x.done&&!x.failed),known=rows.filter(x=>x.total>0),bytes=known.reduce((s,x)=>s+x.loaded,0),total=known.reduce((s,x)=>s+x.total,0);
    notice(failed?'Some sounds could not be downloaded':active?'Downloading music and sound effects…':'Download complete',
      active?`${done}/${rows.length} files · ${active.key.replace('song:','Music #').replace('sfx:','SFX #')} · ${(bytes/1048576).toFixed(1)} MB${total?' / '+(total/1048576).toFixed(1)+' MB':''}`:
      `${done}/${rows.length} files${failed?' · retry the level to retry missing sounds':''}`,active?(known.length===rows.length?bytes/Math.max(1,total):done/rows.length):1);
    if(!active)hideTimer=setTimeout(()=>{if(banner)banner.hidden=true;},failed?8000:1800);
  }
  window.GDDownloads={
    plan(keys){assets.clear();for(const key of keys)assets.set(key,{key,loaded:0,total:0});update();},
    begin(key){if(!assets.has(key)&&![...assets.values()].some(x=>!x.done&&!x.failed))assets.clear();assets.set(key,{key,loaded:0,total:0});update();},
    progress(key,loaded,total){const row=assets.get(key);if(row){Object.assign(row,{loaded,total});update();}},
    finish(key,success=true){const row=assets.get(key);if(row){row.done=success;row.failed=!success;update();}},
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
    const started=performance.now();let announced=false,lastError;
    const delayed=setTimeout(()=>{announced=true;notice('Connecting to download server…','The free server may be waking up. Downloads start when it is ready.');},1200);
    try{
      while(performance.now()-started<95000){
        try{
          const res=await fetch(base+'/gd-health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
          if(res.status===404){unavailable=true;return false;}
          if(res.ok&&(await res.json()).ready){readyAt=performance.now();return true;}
          lastError=new Error('Download server HTTP '+res.status);
        }catch(e){lastError=e;}
        if(announced)notice('Connecting to download server…',`${Math.floor((performance.now()-started)/1000)}s · please wait for the server to wake up`);
        await new Promise(r=>setTimeout(r,1000));
      }
      notice('Download server unavailable','Please retry the download in a moment.');throw lastError||new Error('Download server unavailable');
    }finally{clearTimeout(delayed);}
  }
  window.ensureGdBackend=async signal=>{
    if(readyAt&&performance.now()-readyAt<60000)return true;
    if(!wakePromise){let failed=false;wakePromise=wake().catch(error=>{failed=true;throw error;}).finally(()=>{
      wakePromise=null;
      if(!failed){if(assets.size)update();else if(banner)banner.hidden=true;}
      else hideTimer=setTimeout(()=>{if(banner)banner.hidden=true;},8000);
    });}
    if(!signal)return wakePromise;
    if(signal.aborted)throw signal.reason;
    let abort;const canceled=new Promise((_,reject)=>{abort=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});});
    try{return await Promise.race([wakePromise,canceled]);}finally{signal.removeEventListener('abort',abort);}
  };
})();
