// Song/SFX triggers. Property semantics checked against the supplied Steam
// build: activateSongTrigger 34b7c0, applySFXEditTrigger 34c260, 5f550.
(function () {
  'use strict';
  const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const on = v => v === true || v === 1 || v === '1';
  const rate = r => {const value=Math.trunc(n(r[404]));return Math.abs(value)<=12?Math.pow(2,value/12):1;};
  let pitchWorker,pitchJob=0;
  const pitchJobs=new Map();
  function shiftPitch(context,buffer,semitones){
    if(!pitchWorker){
      pitchWorker=new Worker(new URL('assets/scripts/core/gd-audio-pitch-worker.js',document.baseURI),{type:'module'});
      pitchWorker.onmessage=({data})=>{const pending=pitchJobs.get(data.job);if(!pending)return;pitchJobs.delete(data.job);
        if(data.error){pending.reject(new Error(data.error));return;}
        const result=pending.context.createBuffer(data.channels.length,data.channels[0].length,pending.sampleRate);
        data.channels.forEach((values,ch)=>result.copyToChannel(values,ch));pending.resolve(result);
      };
      pitchWorker.onerror=error=>{for(const p of pitchJobs.values())p.reject(new Error(error.message));pitchJobs.clear();pitchWorker.terminate();pitchWorker=null;};
    }
    const job=++pitchJob,channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,ch)=>buffer.getChannelData(ch).slice());
    return new Promise((resolve,reject)=>{pitchJobs.set(job,{resolve,reject,context,sampleRate:buffer.sampleRate});
      pitchWorker.postMessage({job,channels,sampleRate:buffer.sampleRate,semitones},channels.map(a=>a.buffer));});
  }
  class TriggerVoice {
    constructor(owner, buffer, spec) {
      this.owner = owner; this.buffer = buffer; this.spec = { ...spec };
      this.key = spec.key; this.position = spec.start; this.speed = spec.speed;
      this.levelVolume = spec.volume; this.age = 0; this.paused = false; this.ended = false;
      this.gain = owner.context.createGain();
      this.gain.connect(owner.destination);
      this._start(); this.applyGain();
    }
    _start() {
      if (this.ended) return;
      const ctx = this.owner.context, end = Math.min(this.spec.end || this.buffer.duration, this.buffer.duration);
      if (this.spec.start >= end || (!this.spec.loop && this.position >= end)) { this.stop(); return; }
      if (this.spec.loop && this.position >= end)
        this.position = this.spec.start + (this.position - this.spec.start) % (end - this.spec.start);
      const source = ctx.createBufferSource(); source.buffer = this.buffer;
      source.playbackRate.value = this.speed;
      source.loop = this.spec.loop; source.loopStart = this.spec.start; source.loopEnd = end;
      source.connect(this.gain);
      this.source = source; this.startedAt = ctx.currentTime;
      source.onended = () => { if (this.source === source && !this.paused) this.stop(); };
      source.start(ctx.currentTime + Math.max(0, -this.position / this.speed), Math.max(0, this.position));
      if (!this.spec.loop) source.stop(ctx.currentTime + Math.max(0, (end - this.position) / this.speed));
    }
    sync() {
      if (this.paused || this.ended) return;
      const now = this.owner.context.currentTime;
      const dt = Math.max(0, now - this.startedAt);
      this.position += dt * this.speed; this.age += dt; this.startedAt = now;
      const end = Math.min(this.spec.end || this.buffer.duration, this.buffer.duration);
      if (this.spec.loop && this.position >= end)
        this.position = this.spec.start + (this.position - this.spec.start) % (end - this.spec.start);
    }
    applyGain() {
      let envelope = 1;
      if (this.spec.fadeIn > 0) envelope = Math.min(1, this.age / this.spec.fadeIn);
      if (!this.spec.loop && this.spec.fadeOut > 0) {
        const remaining = ((Math.min(this.spec.end || this.buffer.duration, this.buffer.duration)) - this.position) / this.speed;
        envelope = Math.min(envelope, Math.max(0, remaining / this.spec.fadeOut));
      }
      this.gain.gain.value = this.owner.volume(this.spec.kind) * this.levelVolume * envelope;
    }
    get isPlaying() { return !this.paused && !this.ended; }
    get isPaused() { return this.paused && !this.ended; }
    get seek() { this.sync(); return this.position; }
    get volume() { return this.gain.gain.value; }
    set volume(v) { this.levelVolume = n(v) / (this.owner.volume(this.spec.kind) || 1); this.applyGain(); }
    setRate(v) {
      this.sync(); this.speed = v;
      if (this.source) {
        this.source.playbackRate.value = v;
        // A stop scheduled at the old rate must not cut off the new tail.
        if (!this.spec.loop) this.source.stop(this.owner.context.currentTime +
          Math.max(0, ((Math.min(this.spec.end || this.buffer.duration, this.buffer.duration)) - this.position) / v));
      }
    }
    setLoop(loop) {
      this.sync(); this.spec.loop = !!loop;
      if (this.source) {
        this.source.loop = !!loop;
        if (!loop) this.source.stop(this.owner.context.currentTime + Math.max(0,
          (Math.min(this.spec.end || this.buffer.duration, this.buffer.duration) - this.position) / this.speed));
      }
    }
    _detach() {
      const source = this.source; this.source = null;
      if (source) { source.onended = null; try { source.stop(); } catch (_) {} source.disconnect(); }
    }
    pause() { if (!this.isPlaying) return; this.sync(); this.paused = true; this._detach(); }
    resume() { if (!this.isPaused) return; this.paused = false; this._start(); }
    stop() { this.ended = true; this.paused = false; this._detach(); this.gain.disconnect(); }
    destroy() { this.stop(); }
    snapshot() { this.sync(); return { spec: { ...this.spec, volume: this.levelVolume, speed: this.speed },
      position: this.position, age: this.age, ramps: structuredClone(this.ramps || {}) }; }
  }
  class GDAudioState {
    constructor(audio) {
      this.audio = audio; this.buffers = new Map(); this.loads = new Map();
      this.songs = new Map(); this.prepared = new Map(); this.effects = new Set();
      this.variants=new Map();this.variantLoads=new Map();
      this.intervals = new Map(); this.generation = 0; this.loading = false;
    }
    get context() { return this.audio._scene?.game?.sound?.context; }
    get destination() {
      const sound = this.audio._scene.game.sound;
      return sound.masterVolumeNode || sound.destination || this.context.destination;
    }
    volume(kind) {
      return kind === 'song' ? this.audio._effectiveVolume() :
        Math.max(0, n(this.audio._scene?._sfxVolume ?? localStorage.getItem('userSfxVol') ?? 1, 1));
    }
    async load(kind, id) {
      id = n(id); if (id <= 0 || !this.context) return null;
      const key = `${kind}:${id}`;
      if (this.buffers.has(key)) return this.buffers.get(key);
      if (kind === 'song' && window._onlineSongKey === `ng_song_${id}` && window._onlineSongBuffer) {
        this.buffers.set(key, window._onlineSongBuffer); return window._onlineSongBuffer;
      }
      if (this.loads.has(key)) return this.loads.get(key);
      const promise = (async () => {
        window.GDDownloads?.begin(key);
        // Storage can be denied (private browsing / quota). Downloading and
        // playback must still work when IndexedDB is unavailable.
        let bytes = await window.SongDB?.load(kind === 'song' ? id : `s${id}`).catch(()=>null);
        if(bytes){
          try{
            const cached=await this.context.decodeAudioData(bytes.slice(0));
            this.buffers.set(key,cached);window.GDDownloads?.finish(key);return cached;
          }catch(_){
            // Old failed proxy responses can exist in IndexedDB. A corrupt
            // cache entry must not make a level permanently silent.
            bytes=null;window.SongDB?.delete(kind==='song'?id:`s${id}`).catch(()=>{});
          }
        }
        if (!bytes) {
          if (!this.manifest) this.manifest = fetch('assets/audio/gd/manifest.json')
            .then(r => r.ok ? r.json() : {}).catch(() => ({}));
          const manifest = await this.manifest, file = manifest[key];
          if (file) { const response = await fetch(`assets/audio/gd/${file}`); if (response.ok) bytes = await (window.readGdAudioResponse?.(response,key)||response.arrayBuffer()); }
        }
        let downloaded = false;
        if (!bytes && kind === 'song' && window.fetchGdSongAudio) {
          const response = await window.fetchGdSongAudio(id, { signal: AbortSignal.timeout(120000) });
          if (response.ok) { bytes = await (window.readGdAudioResponse?.(response,key)||response.arrayBuffer()); downloaded = true; }
        }
        if (!bytes && window.fetchGdAudio) {
          let url;
          if (kind === 'sfx') url = `https://geometrydashfiles.b-cdn.net/sfx/s${id}.ogg`;
          else if (id >= 10000000) url = `https://geometrydashfiles.b-cdn.net/music/${id}.ogg`;
          else {
            const response = await window.fetchGdApi('/getGJSongInfo.php', {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `songID=${id}&secret=Wmfd2893gb7`, signal: AbortSignal.timeout(120000) });
            const fields = (await response.text()).split('~|~');
            const index = fields.indexOf('10'); if (index >= 0) url = decodeURIComponent(fields[index + 1]);
          }
          if (url) {
            const response = await window.fetchGdAudio(url, { signal: AbortSignal.timeout(120000) });
            if (response.ok) { bytes = await (window.readGdAudioResponse?.(response,key)||response.arrayBuffer()); downloaded = true; }
          }
        }
        if (!bytes) throw new Error(`Missing ${key}`);
        const buffer = await this.context.decodeAudioData(bytes.slice(0));
        if (downloaded) window.SongDB?.save(kind === 'song' ? id : `s${id}`, bytes).catch(error =>
          console.warn('Could not cache GD audio', key, error));
        this.buffers.set(key, buffer); window.GDDownloads?.finish(key); return buffer;
      })().catch(error => { window.GDDownloads?.finish(key,false); console.warn('GD audio asset could not be loaded', key, error); return null; })
        .finally(() => this.loads.delete(key));
      this.loads.set(key, promise); return promise;
    }
    prepareLevel(level) {
      if (this.level === level && this.ready && [...(this.required||[])].every(key=>this.buffers.has(key)) && [...(this.requiredVariants||[])].every(key=>this.variants.has(key))) return this.ready;
      this.level = level; const generation = this.prepareGeneration = (this.prepareGeneration || 0) + 1;
      const assets = new Map(),variants=new Map();
      const main = /^ng_song_(\d+)$/.exec(window.currentlevel?.[0] || '');
      if (main) assets.set(`song:${main[1]}`, ['song', Number(main[1])]);
      for (const t of level?._logicTriggers || []) if (t.id === 1934 || t.id === 3602) {
        const kind = t.id === 1934 ? 'song' : 'sfx', id = n(t.raw[392]);
        if (id > 0) assets.set(`${kind}:${id}`, [kind, id]);
        if(kind==='sfx'&&n(t.raw[405])&&Math.abs(n(t.raw[405]))<=12)variants.set(`${id}:${n(t.raw[405])}`,[id,n(t.raw[405])]);
      }
      this.required = new Set(assets.keys());
      this.requiredVariants=new Set(variants.keys());
      window.GDDownloads?.plan([...assets.keys()].filter(key=>!this.buffers.has(key)).concat(
        [...variants.keys()].filter(key=>!this.variants.has(key)).map(key=>{const [id,pitch]=key.split(':');return `sfx:${id} (pitch ${pitch})`;})));
      this._pruneBuffers();
      this.loading = !!assets.size;
      // Bound network requests and PCM decoding on low-memory browsers.
      const queue=[...assets.values()];
      const worker=async()=>{while(queue.length){const [kind,id]=queue.shift();await this.load(kind,id);}};
      this.ready = Promise.all(Array.from({length:Math.min(3,queue.length)},worker))
        .then(()=>Promise.all([...variants.values()].map(([id,pitch])=>this.preparePitch(id,pitch))))
        .finally(() => {
          if (generation === this.prepareGeneration) { this.loading = false; this._pruneBuffers(); }
        });
      return this.ready;
    }
    preparePitch(id,pitch){
      if(!pitch||Math.abs(pitch)>12)return this.load('sfx',id);
      const key=`${id}:${pitch}`;
      if(this.variants.has(key))return Promise.resolve(this.variants.get(key));
      if(this.variantLoads.has(key))return this.variantLoads.get(key);
      const progress=`sfx:${id} (pitch ${pitch})`;window.GDDownloads?.begin(progress);
      const promise=this.load('sfx',id).then(buffer=>buffer?shiftPitch(this.context,buffer,pitch):null)
        .then(buffer=>{if(buffer)this.variants.set(key,buffer);window.GDDownloads?.finish(progress,!!buffer);return buffer;})
        .catch(error=>{window.GDDownloads?.finish(progress,false);console.warn('SFX pitch preparation failed',key,error);return null;})
        .finally(()=>this.variantLoads.delete(key));
      this.variantLoads.set(key,promise);return promise;
    }
    _pruneBuffers() {
      // Decoded PCM can be ten times larger than its downloaded MP3/OGG.
      // Keep the current level's assets; retire older levels above 256 MiB.
      const bytes = b => (b.length || 0) * (b.numberOfChannels || 2) * 4;
      let total = [...this.buffers.values()].reduce((sum, b) => sum + bytes(b), 0);
      total += [...this.variants.values()].reduce((sum,b)=>sum+bytes(b),0);
      for(const [key,buffer] of this.variants){
        if(total<=256*1024*1024)break;
        if(this.requiredVariants?.has(key))continue;
        this.variants.delete(key);total-=bytes(buffer);
      }
      for (const [key, buffer] of this.buffers) {
        if (total <= 256 * 1024 * 1024) break;
        if (this.required?.has(key)) continue;
        this.buffers.delete(key); total -= bytes(buffer);
      }
    }
    _primary() {
      if (this.songs.has(0) && !this.songs.get(0).ended) return this.songs.get(0);
      this.songs.delete(0);
      const music = this.audio._music;
      if (!music || this.audio._shouldUsePracticeSong()) return null;
      // The initial level song also belongs to channel zero. Edits must affect
      // it before any replacement Song trigger has played.
      const owner = this;
      const voice = { external: true, music, levelVolume: 1, speed: 1, spec: { kind: 'song', channel: 0 },
        get ended() { return owner.audio._music !== music; },
        applyGain() { music.volume = owner.volume('song') * this.levelVolume; },
        setRate(value) { this.speed = value;
          if (music.setRate) music.setRate(value);
          else if (owner.audio._onlineSource) owner.audio._onlineSource.playbackRate.value = value; },
        pause() { music.pause(); }, resume() { music.resume(); }, stop() { music.stop(); },
        setLoop(value) { music.setLoop?.(value); }, sync() {} };
      this.songs.set(0, voice); return voice;
    }
    trigger(trig) {
      if (this.audio._shouldUsePracticeSong()) return;
      const r = trig.raw || {}, id = trig.id, channel = n(r[432]);
      if (id === 3605 || id === 3603) { this.edit(trig); return; }
      if (id === 1934 && on(r[400])) {
        const spec = this.prepared.get(channel);
        if (spec) this.play(spec);
        return;
      }
      const kind = id === 1934 ? 'song' : 'sfx', soundId = n(r[392]);
      if (soundId <= 0) return;
      const spec = { kind, id: soundId, key: `${kind === 'song' ? 'ng_song_' : 'sfx_'}${soundId}`,
        channel, start: n(r[408]) / 1000, end: n(r[410]) / 1000,
        fadeIn: Math.max(0, n(r[409]) / 1000), fadeOut: Math.max(0, n(r[411]) / 1000),
        volume: Math.max(0, n(r[406])), speed: rate(r), loop: on(r[413]),
        unique: on(r[415]), uniqueId: n(r[416]), group: n(r[455]), override: on(r[420]),
        minInterval: Math.max(0, n(r[434])), pitch: n(r[405]), dontReset: on(r[595]) };
      if (kind === 'song' && on(r[399])) { this.prepared.set(channel, spec); this.load(kind, soundId); return; }
      this.play(spec);
    }
    play(spec, restore = null) {
      const key = `${spec.kind}:${spec.id}`,pitched=spec.kind==='sfx'&&spec.pitch&&Math.abs(spec.pitch)<=12;
      const buffer = pitched?this.variants.get(`${spec.id}:${spec.pitch}`):this.buffers.get(key);
      if (!buffer) {
        // Loading normally finishes before the first physics tick. A changed
        // level or restart must invalidate delayed callbacks from the old run.
        const generation = this.generation;
        (pitched?this.preparePitch(spec.id,spec.pitch):this.load(spec.kind, spec.id)).then(b => { if (b && generation === this.generation) this.play(spec, restore); });
        return;
      }
      if (spec.kind === 'song') {
        if (spec.channel === 0) this._primary();
        this.songs.get(spec.channel)?.stop();
      } else {
        const now = this.context.currentTime, ref = spec.uniqueId || spec.id;
        if (!restore && now - (this.intervals.get(ref) ?? -Infinity) < spec.minInterval) return;
        const matches = [...this.effects].filter(v => !v.ended && (spec.uniqueId ? v.spec.uniqueId === spec.uniqueId : v.spec.id === spec.id));
        if (spec.unique && matches.length && !spec.override) return;
        if (spec.override) for (const v of matches) v.stop();
        this.intervals.set(ref, now);
      }
      const voice = new TriggerVoice(this, buffer, spec);
      if (restore) {
        voice._detach(); voice.position = restore.position; voice.age = restore.age;
        voice.ramps = structuredClone(restore.ramps || {}); voice._start(); voice.applyGain();
      }
      if (spec.kind === 'song') {
        this.songs.set(spec.channel, voice);
        if (spec.channel === 0) {
          this.ownsPrimary = true; this.audio._music = voice;
          this.audio._onlineGain = voice.gain; this.audio._onlineSource = voice.source;
        }
      } else this.effects.add(voice);
      this.audio._setupAnalyser();
      if (this.audio._musicTransportPaused || this.audio._scene?._paused) voice.pause();
    }
    edit(trig) {
      const r = trig.raw, song = trig.id === 3605;
      if (song && n(r[432]) === 0) this._primary();
      const targets = song ? [this.songs.get(n(r[432]))].filter(Boolean) :
        [...this.effects].filter(v => (!n(r[416]) || v.spec.uniqueId === n(r[416])) &&
          (!n(r[455]) || v.spec.group === n(r[455])));
      for (const voice of targets) {
        if (on(r[417])) { voice.stop(); continue; }
        // FMOD stopChannel(..., stopLoop=true) clears the remaining loops,
        // leaving the current pass audible instead of stopping it outright.
        if (on(r[414])) voice.setLoop(false);
        const duration = Math.max(0, n(r[10], .5));
        const changes = { levelVolume: on(r[418]) ? Math.max(0, n(r[406])) : null,
          speed: on(r[419]) ? rate(r) : null };
        voice.ramps ||= {};
        for (const [key, value] of Object.entries(changes)) if (value !== null) {
          if (!duration) { voice[key] = value; delete voice.ramps[key]; if (key === 'speed') voice.setRate(value); }
          else voice.ramps[key] = { from: voice[key], to: value, duration, elapsed: 0 };
        }
        voice.applyGain();
      }
    }
    update(dt) {
      for (const voice of [...this.songs.values(), ...this.effects]) {
        if (voice.ended) { this.effects.delete(voice); continue; }
        voice.sync();
        for (const [key, ramp] of Object.entries(voice.ramps || {})) {
          ramp.elapsed += dt;
          const value = ramp.from + (ramp.to - ramp.from) * Math.min(1, ramp.elapsed / ramp.duration);
          if (key === 'speed') voice.setRate(value); else voice[key] = value;
          if (ramp.elapsed >= ramp.duration) delete voice.ramps[key];
        }
        voice.applyGain();
      }
    }
    pause() { for (const v of [...this.songs.values(), ...this.effects]) v.pause(); }
    resume() { for (const v of [...this.songs.values(), ...this.effects]) if (!v.ended) v.resume(); }
    reset() {
      ++this.generation;
      for (const v of [...this.songs.values(), ...this.effects]) v.stop();
      this.songs.clear(); this.prepared.clear(); this.effects.clear(); this.intervals.clear(); this.ownsPrimary = false;
    }
    capture() {
      return { songs: [...this.songs].filter(([,v]) => !v.external && !v.ended).map(([id,v]) => [id,v.snapshot()]),
        primary: this.songs.get(0)?.external ? { levelVolume: this.songs.get(0).levelVolume, speed: this.songs.get(0).speed,
          ramps: structuredClone(this.songs.get(0).ramps || {}) } : null,
        effects: [...this.effects].filter(v => !v.ended).map(v => v.snapshot()), prepared: [...this.prepared] };
    }
    restore(state) {
      this.reset(); if (!state) return;
      this.prepared = new Map(state.prepared);
      if (state.primary) { const v = this._primary(); if (v) { Object.assign(v, state.primary); v.setRate(v.speed); v.applyGain(); } }
      for (const [,v] of state.songs) this.play(v.spec, v);
      for (const v of state.effects) this.play(v.spec, v);
    }
  }
  window.GDAudioState = GDAudioState;
})();
