window.SongDB = {
  db: null,
  init: function() {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve();
      const req = indexedDB.open("GDSongDB", 1);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore("songs");
      };
      req.onsuccess = e => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  },
  save: async function(id, arrayBuffer) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("songs", "readwrite");
      const store = tx.objectStore("songs");
      store.put(arrayBuffer, String(id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  load: async function(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("songs", "readonly");
      const store = tx.objectStore("songs");
      const req = store.get(String(id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  delete: async function(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("songs", "readwrite");
      const store = tx.objectStore("songs");
      const req = store.delete(String(id));
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  },
  isDownloaded: async function(id) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction("songs", "readonly");
      const store = tx.objectStore("songs");
      const req = store.count(String(id));
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
  }
};
window.SongDB.init().catch(console.warn);

class AudioManager {
  constructor(scene) {
    this._scene = scene;
    this.triggers = window.GDAudioState ? new window.GDAudioState(this) : null;
    this._music = null;
    this._userMusicVol = localStorage.getItem("userMusicVol") ?? 1;
    this._meteringEnabled = false;
    this._analyser = null;
    this._meterBuffer = null;
    this._meterValue = 0.1;
    this._meterClock = 0;
    this._meterChannels = 2;
    this._lastAudio = 0.1;
    this._lastPeak = 0;
    this._silenceCounter = 0;
    this._pendingMusicLoadKey = null;
    this._pendingMusicLoadOffset = 0;
    this._pendingMusicFadeDuration = null;
    this._missingMusicWarned = new Set();
    this._pendingOnlineSongLoadKey = null;
    this._pendingOnlineSongLoadOffset = 0;
    this._pendingOnlineSongFadeDuration = null;
    this._musicGameplayOffset = 0;
    this._musicElapsed = 0;
    this._musicTransportActive = false;
    this._musicTransportPaused = false;
    this._musicTransportKey = null;
  }
  _effectiveVolume() {
    return this._userMusicVol * 0.8;
  }
  get musicPlaying() {
    return !!this._pendingMusicLoadKey || !!this._pendingOnlineSongLoadKey || this.isplaying();
  }
  get musicLoading() {
    return !!(this._pendingMusicLoadKey || this._pendingOnlineSongLoadKey || this.triggers?.loading);
  }
  _getLevelSongStartOffset() {
    const rawOffset = window.settingsMap?.["kA13"] ?? 0;
    const parsedOffset = Number(rawOffset);
    return Number.isFinite(parsedOffset) ? parsedOffset : 0;
  }
  _usePreparedLevelSong() {
    const key = window.currentlevel?.[0], match = /^ng_song_(\d+)$/.exec(key || "");
    const buffer = match && this.triggers?.buffers.get(`song:${match[1]}`);
    if (buffer) {
      window._onlineSongKey = key;
      window._onlineSongBuffer = buffer;
    }
  }
  _shouldUsePracticeSong() {
    return !!(this._scene?._practicedMode?.practiceMode && !window.practiceMusicSync);
  }
  _getOfficialSongAudioPath(songKey = window.currentlevel?.[0]) {
    if (!songKey || !Array.isArray(window.allLevels)) return null;

    const currentLevel = Array.isArray(window.currentlevel) ? window.currentlevel : null;
    if (currentLevel && currentLevel[0] === songKey && currentLevel[4]) {
      return "assets/music/" + currentLevel[4] + ".mp3";
    }

    const levelEntry = window.allLevels.find(level => level && level[0] === songKey);
    if (!levelEntry) return null;

    const fileName = levelEntry[4] || String(levelEntry[1] || songKey).replaceAll(" ", "");
    return "assets/music/" + fileName + ".mp3";
  }
  _loadMissingOfficialSong(songKey, startPosOffset = 0, fadeDuration = null) {
    const audioPath = this._getOfficialSongAudioPath(songKey);
    const loader = this._scene?.load;

    if (!audioPath || !loader || !this._scene?.cache?.audio) {
      if (songKey && !this._missingMusicWarned.has(songKey)) {
        console.warn("Missing audio cache and no official song path found for", songKey);
        this._missingMusicWarned.add(songKey);
      }
      return false;
    }

    if (this._pendingMusicLoadKey === songKey) {
      this._pendingMusicLoadOffset = startPosOffset;
      this._pendingMusicFadeDuration = fadeDuration;
      return true;
    }

    this._pendingMusicLoadKey = songKey;
    this._pendingMusicLoadOffset = startPosOffset;
    this._pendingMusicFadeDuration = fadeDuration;

    const playAfterLoad = () => {
      if (this._pendingMusicLoadKey !== songKey) return;
      const shouldPlay = this._pendingMusicLoadKey === songKey && window.currentlevel?.[0] === songKey;
      const nextOffset = this._pendingMusicLoadOffset + this._musicElapsed;
      const nextFadeDuration = this._pendingMusicFadeDuration;

      this._pendingMusicLoadKey = null;
      this._pendingMusicLoadOffset = 0;
      this._pendingMusicFadeDuration = null;

      if (!shouldPlay || !this._scene.cache.audio.exists(songKey)) return;

      if (nextFadeDuration !== null && nextFadeDuration !== undefined) {
        this.fadeInMusic(nextFadeDuration, nextOffset);
      } else {
        this.startMusic(nextOffset);
      }
      if (this._scene._paused) this.pauseMusic();
    };

    const clearFailedLoad = (file) => {
      if (file && file.key !== songKey) return;
      if (this._pendingMusicLoadKey === songKey) {
        this._pendingMusicLoadKey = null;
        this._pendingMusicLoadOffset = 0;
        this._pendingMusicFadeDuration = null;
      }
      console.warn("Failed to load official song audio", songKey, audioPath);
    };

    try {
      loader.audio(songKey, audioPath);
      // `complete` belongs to the whole loader queue.  A parallel asset load
      // could fire it before this file completed, leaving an official level
      // silent.  Bind playback to this exact audio file instead.
      loader.once(`filecomplete-audio-${songKey}`, playAfterLoad);
      loader.once("loaderror", clearFailedLoad);
      if (!loader.isLoading()) {
        loader.start();
      }
      return true;
    } catch (err) {
      clearFailedLoad({ key: songKey });
      console.warn("Failed to queue official song audio", songKey, audioPath, err);
      return false;
    }
  }
  _loadMissingOnlineSong(songKey, startPosOffset = 0, fadeDuration = null) {
    const match = String(songKey || "").match(/^ng_song_(\d+)$/);
    const songId = match ? match[1] : null;
    const soundMgr = this._scene?.game?.sound;
    const ctx = soundMgr?.context;
    if (!songId || !ctx) {
      return false;
    }

    if (this._pendingOnlineSongLoadKey === songKey) {
      this._pendingOnlineSongLoadOffset = startPosOffset;
      this._pendingOnlineSongFadeDuration = fadeDuration;
      return true;
    }

    this._pendingOnlineSongLoadKey = songKey;
    this._pendingOnlineSongLoadOffset = startPosOffset;
    this._pendingOnlineSongFadeDuration = fadeDuration;

    (async () => {
      try {
        if (ctx.state === "suspended") await ctx.resume();

        // A downloaded song is playable without a metadata service. Waiting
        // for that request delayed every imported level (or left it silent
        // when the service was unavailable), even with the audio in IndexedDB.
        const decoded = this.triggers ? await this.triggers.load("song", songId) :
          await window.SongDB.load(songId).then(bytes => bytes ? ctx.decodeAudioData(bytes.slice(0)) : null);
        if (!decoded) throw new Error("Song audio unavailable");

        if (this._pendingOnlineSongLoadKey !== songKey) return;

        const nextOffset = this._pendingOnlineSongLoadOffset + this._musicElapsed;
        const nextFadeDuration = this._pendingOnlineSongFadeDuration;

        this._pendingOnlineSongLoadKey = null;
        this._pendingOnlineSongLoadOffset = 0;
        this._pendingOnlineSongFadeDuration = null;

        const sameSong = window._onlineSongKey === songKey;
        const songTitle = sameSong && window._onlineSongTitle || `Song #${songId}`;
        const songArtist = sameSong && window._onlineSongArtist || "Unknown";
        window._onlineSongBuffer = decoded;
        window._onlineSongKey = songKey;
        window._onlineSongTitle = songTitle;
        window._onlineSongArtist = songArtist;

        if (Array.isArray(window.currentlevel) && window.currentlevel[0] === songKey) {
          window.currentlevel[3] = ["Local", songArtist];
          if (nextFadeDuration !== null && nextFadeDuration !== undefined) {
            this.fadeInMusic(nextFadeDuration, nextOffset);
          } else {
            this.startMusic(nextOffset);
          }
          if (this._scene._paused) this.pauseMusic();
        }
      } catch (err) {
        if (this._pendingOnlineSongLoadKey === songKey) {
          this._pendingOnlineSongLoadKey = null;
          this._pendingOnlineSongLoadOffset = 0;
          this._pendingOnlineSongFadeDuration = null;
        }
        console.warn("Failed to load online song audio", songKey, err);
      }
    })();

    return true;
  }
  startMusic(StartPosOffset = 0) {
    this._beginMusicTransport(StartPosOffset);
    let savedPosition = 0;
    let savedKey = null;
    if (this._music && this._music.isPlaying) {
      savedPosition = this._music.seek || 0;
      savedKey = this._music.key;
    }  
    if (this._music) {
      this._music.stop();
      this._music.destroy();
    }
    if (this._shouldUsePracticeSong()) {
      const practiceSongKey = "StayInsideMe";
      if (this._scene.cache.audio.exists(practiceSongKey)) {
        this._music = this._scene.sound.add(practiceSongKey, {
          loop: true,
          volume: this._effectiveVolume()
        });
        this._music.play();
        if (savedKey === practiceSongKey && savedPosition > 0) {
          this._music.seek = savedPosition;
        }
        this._setupAnalyser();
        this._musicPlaying = true;
        return;
      }
    }
    this._usePreparedLevelSong();
    if (window._onlineSongBuffer && window._onlineSongKey === window.currentlevel?.[0]) {
      const startOffset = this._getLevelSongStartOffset();
      this._playOnlineBuffer(window._onlineSongBuffer, startOffset + StartPosOffset);
      this._setupAnalyser();
      this._musicPlaying = true;
      return;
    }
    const _songKey = window.currentlevel?.[0];
    if (!_songKey) {
      this._setupAnalyser();
      return;
    }
    if (!this._scene.cache.audio.exists(_songKey)) {
      if (this._loadMissingOnlineSong(_songKey, StartPosOffset) || this._loadMissingOfficialSong(_songKey, StartPosOffset)) {
        this._setupAnalyser();
        return;
      }
      this._setupAnalyser();
      return;
    }
    this._music = this._scene.sound.add(_songKey, {
      loop: false,
      volume: this._effectiveVolume()
    });
    const startOffset = this._getLevelSongStartOffset();
    this._playLevelSound(this._music, startOffset + StartPosOffset);
    this._setupAnalyser();
    this._musicPlaying = true;
  }
  _playOnlineBuffer(audioBuffer, startOffset = 0) {
    const soundMgr = this._scene.game.sound;
    const ctx = soundMgr.context;
    if (!ctx) return;
    if (this._onlineSource) {
      try { this._onlineSource.stop(); } catch(e) {}
      try { this._onlineSource.disconnect(); } catch(e) {}
      this._onlineSource = null;
    }
    if (ctx.state === 'suspended') { ctx.resume(); }
    const gainNode = ctx.createGain();
    gainNode.gain.value = this._effectiveVolume();
    const dest = soundMgr.masterVolumeNode || soundMgr.destination || ctx.destination;
    gainNode.connect(dest);
    const delay = Math.max(0, -startOffset);
    const safeOffset = Math.max(0, startOffset);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.connect(gainNode);
    source.start(ctx.currentTime + delay, safeOffset);
    this._onlineSource = source;
    this._onlineGain   = gainNode;
    let _isPlaying = true;
    let _isPaused  = false;
    let _loop = true;
    let _pauseOffset = startOffset;
    let _rate = 1;
    let _startedAt   = ctx.currentTime;
    const self = this;
    const _stopSource = (src) => {
      try { src.stop();       } catch(e) {}
      try { src.disconnect(); } catch(e) {}
    };
    const musicObj = {
      get isPlaying() { return _isPlaying; },
      get isPaused()  { return _isPaused;  },
      key: window.currentlevel?.[0] || window._onlineSongKey || "online",
      stop: () => {
        _isPlaying = false;
        _isPaused  = false;
        _stopSource(self._onlineSource || source);
        try { gainNode.disconnect(); } catch(e) {}
        self._onlineSource = null;
        self._onlineGain = null;
      },
      destroy: () => { musicObj.stop(); },
      pause: () => {
        if (!_isPlaying || _isPaused) return;
        _pauseOffset += (ctx.currentTime - _startedAt) * _rate;
        if (_loop && _pauseOffset >= audioBuffer.duration) _pauseOffset %= audioBuffer.duration;
        _stopSource(self._onlineSource);
        self._onlineSource = null;
        _isPlaying = false;
        _isPaused  = true;
      },
      resume: () => {
        if (!_isPaused) return;
        const newSrc = ctx.createBufferSource();
        newSrc.buffer = audioBuffer;
        newSrc.loop = _loop;
        newSrc.playbackRate.value = _rate;
        newSrc.connect(gainNode);
        newSrc.start(ctx.currentTime + Math.max(0, -_pauseOffset), Math.max(0, _pauseOffset));
        self._onlineSource = newSrc;
        _startedAt  = ctx.currentTime;
        _isPlaying  = true;
        _isPaused   = false;
      },
      setRate: value => {
        if (_isPlaying) _pauseOffset += (ctx.currentTime - _startedAt) * _rate;
        _startedAt = ctx.currentTime; _rate = value;
        if (self._onlineSource) self._onlineSource.playbackRate.value = value;
      },
      setLoop: value => {
        _loop = !!value;
        if (self._onlineSource) self._onlineSource.loop = _loop;
      },
      get seek() { return _isPlaying ? _pauseOffset + (ctx.currentTime - _startedAt) * _rate : _pauseOffset; },
      get volume() { return gainNode.gain.value; },
      set volume(v) { gainNode.gain.value = v; }
    };

    this._music = musicObj;
  }
  startMenuMusic() {
    this.triggers?.reset();
    this._musicTransportActive = false;
    if (this._music) {
      this._music.stop();
      this._music.destroy();
    }
    this._music = this._scene.sound.add("menu_music", {
      loop: true,
      volume: this._effectiveVolume()
    });
    this._music.play();
    this._setupAnalyser();
    this._musicPlaying = true;
  }
  stopMusic() {
    this.triggers?.reset();
    this._musicTransportActive = false;
    // A late file-complete callback must not restart music after quitting.
    this._pendingMusicLoadKey = this._pendingOnlineSongLoadKey = null;
    if (this._music) {
      this._music.stop();
    }
    this._musicPlaying = false;
  }
  isplaying() {
    return this._music != null && this._music.isPlaying != false;
  }
  pauseMusic() {
    this.triggers?.pause();
    this._musicTransportPaused = true;
    if (this._music && this._music.isPlaying) {
      this._music.pause();
    }
  }
  resumeMusic() {
    this.triggers?.resume();
    this._musicTransportPaused = false;
    if (this._music && this._music.isPaused) {
      this._music.resume();
    }
  }
  getUserMusicVolume() {
    return this._userMusicVol;
  }
  setUserMusicVolume(newVolume) {
    this._userMusicVol = newVolume;
    localStorage.setItem("userMusicVol", newVolume);
    if (this.triggers?.songs.size) {
      for (const voice of this.triggers.songs.values()) if (!voice.ended) voice.applyGain();
    } else if (this._music) {
      this._music.volume = this._effectiveVolume();
    }
  }
  getMusicVolume() {
    return this._effectiveVolume();
  }
  setMusicVolume(newVolume) {
    this.setUserMusicVolume(newVolume / 0.8);
  }
  _beginMusicTransport(offset) {
    if (this._musicTransportKey !== window.currentlevel?.[0]) {
      this._pendingMusicLoadKey = this._pendingOnlineSongLoadKey = null;
    }
    this._musicGameplayOffset = Number(offset) || 0;
    this._musicElapsed = 0;
    this._musicTransportKey = window.currentlevel?.[0];
    this._musicTransportActive = true;
    this._musicTransportPaused = false;
  }
  getLevelPosition() {
    return this._musicTransportActive && this._musicTransportKey === window.currentlevel?.[0]
      ? this._musicGameplayOffset + this._musicElapsed : null;
  }
  _playLevelSound(sound, position) {
    // Schedule seek/delay together: play(), then seek, briefly starts at zero.
    // Negative level offsets mean silence before the song, not a seek to zero.
    sound.play({ seek: Math.max(0, position), delay: Math.max(0, -position) });
  }
  fadeInMusic(durationMillis = 1000, StartPosOffset = 0) {
    this._beginMusicTransport(StartPosOffset);
    if (this._music) {
      this._music.stop();
      this._music.destroy();
    }
    if (this._shouldUsePracticeSong()) {
      const practiceSongKey = "StayInsideMe";
      if (this._scene.cache.audio.exists(practiceSongKey)) {
        this._music = this._scene.sound.add(practiceSongKey, {
          loop: true,
          volume: 0
        });
        this._music.play();
        this._setupAnalyser();
        this._musicPlaying = true;
        return;
      }
    }
    
    this._usePreparedLevelSong();
    if (window._onlineSongBuffer && window._onlineSongKey === window.currentlevel?.[0]) {
      const startOffset = this._getLevelSongStartOffset();
      this._playOnlineBuffer(window._onlineSongBuffer, startOffset + StartPosOffset);
      if (this._onlineGain) {
        this._onlineGain.gain.value = this._effectiveVolume();
      }
      this._setupAnalyser();
      this._musicPlaying = true;
      return;
    }

    const songKey = window.currentlevel?.[0];
    if (!songKey) {
      this._setupAnalyser();
      return;
    }

    if (!this._scene.cache.audio.exists(songKey)) {
      if (this._loadMissingOnlineSong(songKey, StartPosOffset, durationMillis) || this._loadMissingOfficialSong(songKey, StartPosOffset, durationMillis)) {
        this._setupAnalyser();
        return;
      }
      this._setupAnalyser();
      return;
    }

    this._music = this._scene.sound.add(songKey, {
      loop: true,
      volume: 0
    });
    this._playLevelSound(this._music, this._getLevelSongStartOffset() + StartPosOffset);
    this._setupAnalyser();
    this._scene.tweens.add({
      targets: this._music,
      volume: this._effectiveVolume(),
      duration: durationMillis
    });
    this._musicPlaying = true;
  }
  fadeOutMusic(durationMillis = 1500) {
    if (this._music && this._music.isPlaying) {
      this._music.setLoop(false);
      this._scene.tweens.add({
        targets: this._music,
        volume: 0,
        duration: durationMillis,
        onComplete: () => {
          if (this._music) {
            this._music.stop();
          }
        }
      });
    }
  }
  playEffect(soundEffect, volumeObj = {}) {
    if (this._scene.sound.context && this._scene.cache.audio.exists(soundEffect)) {
      const soundObject = this._scene.sound.add(soundEffect);
      const rawBaseVolume = volumeObj && Object.prototype.hasOwnProperty.call(volumeObj, "volume")
        ? Number(volumeObj.volume)
        : 1;
      const rawSfxVolume = Number(this._scene?._sfxVolume ?? localStorage.getItem("userSfxVol") ?? 1);
      const baseVolume = Number.isFinite(rawBaseVolume) ? rawBaseVolume : 1;
      const sfxVolume = Number.isFinite(rawSfxVolume) ? rawSfxVolume : 1;
      soundObject.play({
        volume: Math.max(0, baseVolume * sfxVolume)
      });
    }
  }
  _setupAnalyser() {
    const audioContext = this._scene.sound.context;
    const sources = new Set();
    let stereo = false;
    const add = (source, buffer) => {
      if (!source) return;
      sources.add(source); stereo ||= buffer?.numberOfChannels !== 1;
    };
    if ((this._music && this._music.isPlaying !== false) || this._music?.isPaused)
      add(this._onlineGain || this._music?.volumeNode,
        this._onlineSource?.buffer || this._scene.cache?.audio?.get?.(this._music?.key));
    // GD meters the mix. A Song trigger can stop channel zero while its
    // music continues on another channel; measuring only zero makes every
    // audio-driven object and the wave ribbon react as if the song stopped.
    for (const voice of [...(this.triggers?.songs.values() || []), ...(this.triggers?.effects || [])])
      if (!voice.external && !voice.ended) add(voice.gain, voice.buffer);
    if (audioContext && sources.size) {
      this._meterChannels = stereo ? 2 : 1;
      // FMOD meters each channel of the last mix block and GD averages the per-channel peaks
      if (!this._meterSplitter) {
        this._meterSplitter = audioContext.createChannelSplitter(2);
        this._analyser = audioContext.createAnalyser();
        this._analyserR = audioContext.createAnalyser();
        this._analyser.fftSize = this._analyserR.fftSize = 1024;
        this._meterSplitter.connect(this._analyser, 0);
        this._meterSplitter.connect(this._analyserR, 1);
        this._meterBuffer = new Float32Array(1024);
      }
      for (const source of this._meterSources || []) if (!sources.has(source)) {
        try { source.disconnect(this._meterSplitter); } catch (_) {}
      }
      for (const source of sources) if (!this._meterSources?.has(source)) source.connect(this._meterSplitter);
      this._meterSources = sources;
      this._meteringEnabled = true;
    }
  }
  _ensureCorrectMusicMode() {
    if (this._scene?._practiceMusicSyncChangePendingUntilRestart || this.triggers?.ownsPrimary) return;
    if (this._pendingMusicLoadKey || this._pendingOnlineSongLoadKey) return;
    if (!this._music) return;
    const expectedSongKey = this._shouldUsePracticeSong() ? "StayInsideMe" : window.currentlevel?.[0];
    const currentSongKey = this._music?.key || (this._onlineSource ? window._onlineSongKey : null);
    if (currentSongKey !== expectedSongKey) {
      const offset = typeof this._scene._getCurrentMusicSyncOffset === "function"
        ? this._scene._getCurrentMusicSyncOffset()
        : this._scene._getStartPosMusicOffset();
      this.startMusic(offset);
    }
  }
  // FMODAudioEngine::update's metering (Steam 0x5e3a1): at most once per
  // 1/60 s, level = mixer peak / volume + 0.1; after three steps a level at
  // least 1.1x the last value (and not just under a recent peak) restarts the
  // pulse at level x 1.1, anything else decays it by 0.93 a step.
  update(timeSeconds) {
    const dt = Math.max(0, Number(timeSeconds) || 0);
    if (this._musicTransportActive && !this._musicTransportPaused &&
        !this._scene?._paused && !this._scene?._menuActive && !this._scene?._slideIn &&
        !this._scene?._waitingForLevelMusic && !this._scene?._state?.isDead) {
      this._musicElapsed += dt;
      this.triggers?.update(dt);
    }
    if (!this._meteringEnabled || !this._analyser) {
      return;
    }
    this._meterClock = (this._meterClock || 0) + dt;
    if (this._meterClock < 1 / 60) return;
    this._meterClock = 0;
    const peakOf = analyser => {
      analyser.getFloatTimeDomainData(this._meterBuffer);
      let peak = 0;
      for (let index = 0; index < this._meterBuffer.length; index++) {
        const buf = Math.abs(this._meterBuffer[index]);
        if (buf > peak) peak = buf;
      }
      return peak;
    };
    const peakL = peakOf(this._analyser);
    const peakR = this._analyserR && this._meterChannels !== 1 ? peakOf(this._analyserR) : peakL;
    // A silent right channel is still part of a stereo mix. Treating it as
    // mono doubles the measured peak and abruptly widens the wave ribbon.
    let biggestBuf = (peakL + peakR) / 2;
    const volume = this._effectiveVolume();
    if (volume > 0) {
      biggestBuf /= volume;
    }
    this._meterValue = 0.1 + biggestBuf;
    if (this._silenceCounter < 3 || this._meterValue < this._lastAudio * 1.1 || this._meterValue < this._lastPeak * 0.95 && this._lastAudio > this._lastPeak * 0.2) {
      this._meterValue = this._lastAudio * 0.93;
    } else {
      this._silenceCounter = 0;
      this._lastPeak = this._meterValue;
      this._meterValue *= 1.1;
    }
    if (this._meterValue <= 0.1) {
      this._lastPeak = 0;
    }
    this._lastAudio = this._meterValue;
    this._silenceCounter++;
  }
  getMeteringValue() {
    return this._meterValue;
  }
  reset() {
    this._meterValue = 0.1;
    this._meterClock = 0;
    this._lastAudio = 0.1;
    this._lastPeak = 0;
    this._silenceCounter = 0;
    this._pendingMusicLoadKey = null;
    this._pendingMusicLoadOffset = 0;
    this._pendingMusicFadeDuration = null;
    this._pendingOnlineSongLoadKey = null;
    this._pendingOnlineSongLoadOffset = 0;
    this._pendingOnlineSongFadeDuration = null;
    this.stopMusic();
  }
}
