class PracticeMode {
  constructor() {
    this.checkpoints = [];
    this.practiceMode = false;
    this.checkpointSprites = [];
  }
  togglePracticeMode() {
    this.practiceMode = !this.practiceMode;
    if (!this.practiceMode) {
      this.clearCheckpoints();
    }
    return this.practiceMode;
  }
  saveCheckpoint(playerState, playerWorldX, cameraX, scene) {
    if (!this.practiceMode || playerState.isDead) return false;
    const checkpoint = {
      x: playerWorldX,
      y: playerState.y,
      yVelocity: playerState.yVelocity,
      gravityFlipped: playerState.gravityFlipped,
      isMini: playerState.isMini,
      isCube: playerState.isCube,
      isShip: playerState.isShip,
      isBall: playerState.isBall,
      isUfo: playerState.isUfo,
      isWave: playerState.isWave,
      isSpider: playerState.isSpider,
      isBird: playerState.isBird,
      isDart: playerState.isDart,
      isRobot: playerState.isRobot,
      isSwing: playerState.isSwing,
      isJetpack: playerState.isJetpack,
      isFlying: playerState.isFlying,
      isJumping: playerState.isJumping,
      onGround: playerState.onGround,
      canJump: playerState.canJump,
      wasBoosted: playerState.wasBoosted,
      boostLatch: playerState.boostLatch,
      forceBoostLatch: playerState.forceBoostLatch,
      forceX: playerState.forceX,
      forceY: playerState.forceY,
      rotation: playerState.rotation,
      rotateActionActive: !!scene?._player?.rotateActionActive,
      gravity: playerState.gravity,
      gravityMod: playerState.gravityMod,
      jumpPower: playerState.jumpPower,
      mirrored: playerState.mirrored,
      isDashing: playerState.isDashing,
      dashSlope: playerState.dashSlope,
      collisionModifiers: [playerState.stateDartSlide, playerState.stateHitHead, playerState.stateFlipGravity, playerState.stateNoAutoJump],
      holdDead: playerState._holdDead,
      skipFlyBoundsOnce: !!playerState._skipFlyBoundsOnce,
      dualSkipFlyBoundsOnce: !!scene._state2?._skipFlyBoundsOnce,
      dashXVelocity: playerState.dashXVelocity,
      dashYVelocity: playerState.dashYVelocity,
      dashSpin: scene._player?._dashSpin || 0,
      dashSpinFirstTick: !!scene._player?._dashSpinFirstTick,
      dashFireTime: scene._player?._dashFireTime || 0,
      slopeState: scene._player?.captureSlopeState(),
      dualSlopeState: scene._isDual ? scene._player2?.captureSlopeState() : null,
      ballShouldRotate: playerState.ballShouldRotate,
      ballRotateOpposite: playerState.ballRotateOpposite,
      ballNormalRotate: playerState.ballNormalRotate,
      ballHitPad: playerState.ballHitPad,
      robotHold: !!playerState._robotHold,
      robotPadBoost: !!playerState._robotPadBoost,
      robotHoverBudget: playerState._robotHoverBudget || 0,
      robotHoldTimer: playerState._robotHoldTimer || 0,
      cameraX: cameraX,
      cameraFloorX: scene._cameraFloorX ?? -Infinity,
      flyFloorY: scene._level._flyFloorY,
      flyCeilingY: scene._level._flyCeilingY,
      flyGroundActive: scene._level._flyGroundActive,
      flyVisualOnly: scene._level._flyVisualOnly,
      flyVisualFloorInset: scene._level._flyVisualFloorInset,
      flyVisualCeilingInset: scene._level._flyVisualCeilingInset,
      groundTargetValue: scene._level._groundTargetValue,
      flyCameraTarget: scene._level.flyCameraTarget,
      groundAnimating: scene._level._groundAnimating,
      groundAnimFrom: scene._level._groundAnimFrom,
      groundAnimTo: scene._level._groundAnimTo,
      groundAnimTime: scene._level._groundAnimTime,
      groundAnimDuration: scene._level._groundAnimDuration,
      cameraY: scene._cameraY,
      groundStartScreenY: scene._level._groundStartScreenY,
      ceilingStartScreenY: scene._level._ceilingStartScreenY,
      groundY: scene._level._groundY,
      ceilingY: scene._level._ceilingY,
      speed: playerSpeed,
      physicsFrame: scene._physicsFrame,
      musicPosition: scene._audio?.getLevelPosition?.(),
      audioState: scene._audio?.triggers?.capture(),
      levelRuntime: scene._level.captureRuntimeState(scene._colorManager),
      dualMode: !!scene._isDual,
      dualGameMode: scene?._getDualModeId ? scene._getDualModeId(scene._state2) : null,
      dualIsMini: !!scene._state2?.isMini,
      dualY: scene._state2?.y,
      dualX: scene._secondaryWorldX,
      dualBandY: scene._dualBandY,
      lastBandY: scene._lastBandY,
      dualYVelocity: scene._state2?.yVelocity,
      dualForceX: scene._state2?.forceX,
      dualForceY: scene._state2?.forceY,
      dualGravityFlipped: scene._state2?.gravityFlipped,
      dualOnGround: scene._state2?.onGround,
      dualOnCeiling: scene._state2?.onCeiling,
      dualCanJump: scene._state2?.canJump,
      dualIsJumping: scene._state2?.isJumping,
      timestamp: Date.now()
    };
    this.checkpoints.push(checkpoint);
    const checkpointSprite = scene.add.image(playerWorldX, b(playerState.y), "GJ_GameSheet02", "checkpoint_01_001.png")
      .setOrigin(0.5, 0.5)
      .setScrollFactor(1)
      .setDepth(15)
      .setScale(1.0);
    scene._level.topContainer.add(checkpointSprite);
    this.checkpointSprites.push(checkpointSprite);
    return true;
  }
  deleteLastCheckpoint() {
    if (this.checkpoints.length > 0) {
      this.checkpoints.pop();
      if (this.checkpointSprites.length > 0) {
        const lastSprite = this.checkpointSprites.pop();
        if (lastSprite && lastSprite.destroy) {
          lastSprite.destroy();
        }
      }
      return true;
    }
    return false;
  }
  clearCheckpoints() {
    this.checkpoints = [];
    for (const sprite of this.checkpointSprites) {
      if (sprite && sprite.destroy) {
        sprite.destroy();
      }
    }
    this.checkpointSprites = [];
  }
  loadLastCheckpoint() {
    if (this.checkpoints.length > 0) {
      return this.checkpoints[this.checkpoints.length - 1];
    }
    return null;
  }
}

class MacroBot {
  constructor(scene) {
    this.scene = scene;
    this.resetAll();
  }

  resetAll() {
    this.recording = false;
    this.playing = false;
    this.cursor = 0;
    this.frames = [];
    this.currentFrameState = null;
    this.meta = {
      author: "Web Dashers",
      level: "",
      version: 2,
    };
  }

  _cloneState(state) {
    if (!state) return null;
    const out = {};
    for (const key of Object.keys(state)) {
      const value = state[key];
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        out[key] = value;
      } else if (Array.isArray(value) && value.every(v => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
        out[key] = value.slice();
      }
    }
    return out;
  }

  _snapshotPlayer(player, state) {
    return {
      state: this._cloneState(state),
      rotation: Number.isFinite(player?._rotation) ? player._rotation : (Number.isFinite(state?.rotation) ? state.rotation : 0),
      mode: this.scene._getDualModeId ? this.scene._getDualModeId(state) : "cube"
    };
  }

  _captureFrame(currentFrame) {
    const scene = this.scene;
    return {
      frame: currentFrame,
      playerWorldX: scene._playerWorldX,
      cameraX: scene._cameraX,
      cameraY: scene._cameraY,
      speed: playerSpeed,
      dual: !!scene._isDual,
      player: this._snapshotPlayer(scene._player, scene._state),
      dualPlayer: scene._isDual ? this._snapshotPlayer(scene._player2, scene._state2) : null
    };
  }

  _applyPlayerSnapshot(snapshot, player, state) {
    if (!snapshot || !player || !state) return;

    const mode = snapshot.mode || "cube";
    const currentMode = this.scene._getDualModeId ? this.scene._getDualModeId(state) : "cube";
    if (currentMode !== mode && this.scene._setPlayerGamemode) {
      this.scene._setPlayerGamemode(player, state, mode, true);
    }

    const savedState = snapshot.state || {};
    for (const key of Object.keys(savedState)) {
      const value = savedState[key];
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        state[key] = value;
      } else if (Array.isArray(value)) {
        state[key] = value.slice();
      }
    }

    if (Number.isFinite(snapshot.rotation)) {
      state.rotation = snapshot.rotation;
      player._rotation = snapshot.rotation;
    }

    if (player.setRotation && Number.isFinite(snapshot.rotation)) {
      try { player.setRotation(snapshot.rotation); } catch (_) {}
    }
  }

  _applyFrame(frameState) {
    if (!frameState) return;
    const scene = this.scene;

    if (Number.isFinite(frameState.playerWorldX)) scene._playerWorldX = frameState.playerWorldX;
    if (Number.isFinite(frameState.cameraX)) scene._cameraX = frameState.cameraX;
    if (Number.isFinite(frameState.cameraY)) scene._cameraY = frameState.cameraY;
    if (Number.isFinite(frameState.speed)) playerSpeed = frameState.speed;

    if (frameState.player) {
      this._applyPlayerSnapshot(frameState.player, scene._player, scene._state);
    }

    scene._isDual = !!frameState.dual;
    if (scene._isDual && frameState.dualPlayer) {
      this._applyPlayerSnapshot(frameState.dualPlayer, scene._player2, scene._state2);
    }

    if (!scene._isDual) {
      scene._player2.setCubeVisible(false);
      scene._player2.setShipVisible(false);
      scene._player2.setBallVisible(false);
      scene._player2.setWaveVisible(false);
      scene._player2.setBirdVisible?.(false);
      scene._player2.setSpiderVisible(false);
      scene._player2.setRobotVisible(false);
    }
  }

  startRecording(meta = {}) {
    this.resetAll();
    this.recording = true;
    this.meta = {
      ...this.meta,
      ...meta,
      version: 2
    };
  }

  stopRecording() {
    this.recording = false;
    return this.exportObject();
  }

  clearRecording() {
    this.frames = [];
    this.cursor = 0;
    this.currentFrameState = null;
  }

  recordFrame(currentFrame) {
    if (!this.recording) return;
    const frameState = this._captureFrame(currentFrame);
    const last = this.frames[this.frames.length - 1];
    if (last && last.frame === currentFrame) {
      this.frames[this.frames.length - 1] = frameState;
    } else {
      this.frames.push(frameState);
    }
  }

  rollbackRecording(currentFrame) {
    this.frames = this.frames.filter(frame => (frame.frame ?? 0) <= currentFrame);
    this.cursor = 0;
    this.currentFrameState = null;
  }

  clearPlayback() {
    this.cursor = 0;
    this.currentFrameState = null;
  }

  rollbackPlayback(currentFrame) {
    if (!this.frames.length) return;
    this.cursor = 0;
    this.currentFrameState = null;

    while (this.cursor < this.frames.length && (this.frames[this.cursor].frame ?? 0) <= currentFrame) {
      this.cursor++;
    }

    const index = Math.max(0, this.cursor - 1);
    const frameState = this.frames[index];
    if (frameState) this._applyFrame(frameState);
  }

  startPlayback(macroData) {
    const macro = typeof macroData === "string" ? JSON.parse(macroData) : macroData;

    this.resetAll();
    this.playing = true;

    this.meta = {
      ...this.meta,
      ...(macro || {})
    };

    this.frames = Array.isArray(macro?.frames) ? macro.frames.slice() : [];
    this.frames.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));

    this.cursor = 0;
    this.currentFrameState = null;

    if (Array.isArray(macro?.inputs) && !this.frames.length) {
      console.warn("Outdated macro file");
    }
  }

  stopPlayback() {
    this.playing = false;
    this.cursor = 0;
    this.currentFrameState = null;
  }

  step(currentFrame) {
    if (!this.playing || !this.frames.length) return;

    while (
      this.cursor < this.frames.length &&
      (this.frames[this.cursor].frame ?? 0) <= currentFrame
    ) {
      this.currentFrameState = this.frames[this.cursor++];
    }

    if (this.cursor >= this.frames.length) {
      this.stopPlayback();
      return; 
    }

    if (this.currentFrameState) {
      this._applyFrame(this.currentFrameState);
    }
  }

  applyCurrentFrame() {
    if (!this.playing || !this.currentFrameState) return;
    this._applyFrame(this.currentFrameState);
  }

  exportObject() {
    return {
      meta: this.meta,
      frames: this.frames.slice()
    };
  }

  exportString(pretty = false) {
    return JSON.stringify(this.exportObject(), null, pretty ? 2 : 0);
  }

  download(filename = "macro.wbgdr2") {
    const blob = new Blob([this.exportString(true)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  importFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = String(event.target.result || "");
          const macro = JSON.parse(text);
          resolve(macro);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read macro file"));
      reader.readAsText(file);
    });
  }
}


class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: "GameScene"
    });
  }
  create() {
    this._bgSpeedX = 0.1;
    this._bgSpeedY = 0.1;
    this._menuCameraX = -centerX;
    this._prevCameraX = -centerX;
    this._bg = this.add.tileSprite(0, 0, screenWidth, screenHeight, "game_bg_01").setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    this._applyMirroredBackgroundTexture("game_bg_01");
    this._cameraX = -centerX;
    this._cameraY = 0;
    this._cameraXRef = {
      get value() {
        return this._v;
      },
      _v: -centerX
    };
    this._state = new PlayerState();
    this._mirrorProgress = 0;
    this._mirrorTarget = 0;
    this._mirrorTransition = null;
    this._level = new window.LevelObject(this, this._cameraXRef);
    this._levelEditor = new window.LevelEditor(this);
    this._orbGfx = null;
    this._orbGfxTimer = 0;
    this._player = new PlayerObject(this, this._state, this._level);
    this._player._activationKey = "main";
    this._state2 = new PlayerState();
    this._player2 = new PlayerObject(this, this._state2, this._level);
    this._player2._activationKey = "dual";
    this._player2.setInvertedColors?.(true);
    this._isDual = false;
    this._player2.setCubeVisible(false);
    this._player2.setShipVisible(false);
    this._player2.setBallVisible(false);
    this._player2.setWaveVisible(false);
    this._player2.setBirdVisible?.(false);
    this._player2.setSpiderVisible(false);
    this._player2.setRobotVisible(false);
    this._colorManager = new ColorManager();
    this._practicedMode = new PracticeMode();
    if (this._audio == null) {
      this._audio = new AudioManager(this);
    }
    if (window._onlineLevelString && window._onlineLevelId &&
        window.currentlevel[2] === window._onlineLevelId) {
      try {
        this.cache.text.entries.set(window._onlineLevelId, window._onlineLevelString);
      } catch(e) {}
    }
    let _0x591888 = this.cache.text.get(window.currentlevel[2]);
    if (!_0x591888 && window._onlineLevelString && window.currentlevel[2] === window._onlineLevelId) {
      _0x591888 = window._onlineLevelString;
    }
    if (_0x591888) {
      this._level.loadLevel(_0x591888);
    }
    this._level.verificationFrames = window._onlineLevelMetadata?.id === window.currentlevel[2]
      ? Number(window._onlineLevelMetadata.verificationFrames) || 0 : 0;
    const _resolveGdArtId = (key, fallback = 1) => {
      const raw = window.settingsMap?.[key];
      const parsed = parseInt(raw ?? fallback, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const _bgGdId = _resolveGdArtId("kA6", parseInt(window._backgroundId || "01", 10) || 1);
    window._backgroundId = String(_bgGdId).padStart(2, "0");

    const _groundRaw = window.settingsMap?.["kA7"] ?? ((parseInt(window._groundId || "00", 10) || 0) + 1);
    window._groundId = getGroundTextureId(_groundRaw);

    const _bgKey = "game_bg_" + getBackgroundTextureIndex(_bgGdId);
    if (this.textures.exists(_bgKey)) {
      this._applyMirroredBackgroundTexture(_bgKey);
    }
    this._level.applyGroundTexture();
    if (this._level._initialColors) {
      for (let chId in this._level._initialColors) {
        let col = this._level._initialColors[chId];
        this._colorManager.setInitialColor(parseInt(chId, 10), col);
      }
    }
    this._level.createEndPortal(this);
    this._glitterCenterX = 0;
    this._glitterCenterY = T;
    this._glitterEmitter = this.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: 0,
      scale: {
        start: 0.375,
        end: 0
      },
      alpha: {
        start: 1,
        end: 0
      },
      lifespan: {
        min: 200,
        max: 1800
      },
      frequency: 60,
      blendMode: S,
      tint: window.mainColor,
      emitting: false,
      emitCallback: _0x3c2a3e => {
        _0x3c2a3e.x = this._glitterCenterX + (Math.random() * 2 - 1) * (screenWidth / 1.8);
        _0x3c2a3e.y = this._glitterCenterY + (Math.random() * 2 - 1) * 320;
      }
    });
    this._level.additiveContainer.add(this._glitterEmitter);
    this._bg.setTint(this._colorManager.getHex(fs));
    this._level.setGroundColor(this._colorManager.getHex(gs));
    this._level.setGround2Color?.(this._colorManager.getHex(1009));
      this._level.setLineColor?.(this._colorManager.getHex(1002), this._colorManager.getBlending(1002));
    this._level.additiveContainer.setVisible(false);
    this._level.container.setVisible(false);
    this._level.topContainer.setVisible(false);
    this._attempts = parseInt(localStorage.getItem("gd_totalAttempts") || "1", 10);
    this._bestPercent = 0;
    this._lastPercent = 0;
    this._practiceBestPercent = parseFloat(localStorage.getItem("practiceBestPercent_" + (window.currentlevel[2] || "level_1")) || "0");
    this._endPortalGameY = 240;
    this._resetGameplayState();
    this._totalJumps = parseInt(localStorage.getItem("gd_totalJumps") || "0", 10);
    this._totalDeaths = parseInt(localStorage.getItem("gd_totalDeaths") || "0", 10);
    this._totalsecretcoins = parseInt(localStorage.getItem("gd_totalsecretcoins") || "0", 10);
    window._totalsecretcoins = this._totalsecretcoins;
    this._totalusercoins = parseInt(localStorage.getItem("gd_totalusercoins") || "0", 10);
    window._totalusercoins = this._totalusercoins;
    window._completedLevels = parseInt(localStorage.getItem("gd_completedLevels") || "0", 10);
    this._playTime = 0;
    this._menuActive = true;
    this._slideIn = false;
    this._slideGroundX = null;
    this._firstPlay = true;
    this._player.setCubeVisible(false);
    this._player.setShipVisible(false);
    this._player.setBallVisible(false);
    this._logo = this.add.image(0, 100, "GJ_LaunchSheet", "GJ_logo_001.png").setScrollFactor(0).setDepth(30).setScale(0.9);
    // The launch-sheet is a high resolution atlas, so use the same source for
    // both menu marks. Keeping these as regular menu objects means their
    // position is recomputed when the canvas changes size.
    this._robLogo = this.add.image(0, 0, "GJ_LaunchSheet", "RobTopLogoBig_001.png")
      .setScrollFactor(0).setDepth(30).setScale(0.525);
    this._socialIcons = [];

    this._copyrightText = this.add.text(0, 630, "© 2026 RobTop Games · geometrydash.com", {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: "Arial"
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(30).setAlpha(0.3);
    this._tryMeImg = null;
    this._downloadBtns = [];
    const _0x4fc67f = [
    {
      key: "GJ_moreGamesBtn_001",
      url: "https://pinkdev.d13qic2f6zga3.amplifyapp.com"
    }];
    for (let _0xfeaf5c = 0; _0xfeaf5c < _0x4fc67f.length; _0xfeaf5c++) {
      const _0x1ce2a6 = _0x4fc67f[_0xfeaf5c];
      const _0x6bf69f = 1 / 1.5;
      const _0x1d293f = this.add.image(0, 0, "GJ_GameSheet04", _0x1ce2a6.key + ".png").setScrollFactor(0).setDepth(30).setScale(1).setInteractive();
      this._makeBouncyButton(_0x1d293f, 1, () => window.open(_0x1ce2a6.url, "_blank"), () => this._menuActive);
      this._downloadBtns.push(_0x1d293f);
    }
    const _0x28fa5b = this.scale.isFullscreen;
this._menuFsBtn = this.add.image(33, 33, "GJ_WebSheet", _0x28fa5b ? "toggleFullscreenOff_001.png" : "toggleFullscreenOn_001.png").setScrollFactor(0).setDepth(30).setScale(0.64).setAlpha(0.8).setTint(Phaser.Display.Color.GetColor(255, 255, 255)).setInteractive();
    this._expandHitArea(this._menuFsBtn, 1.5);
    this._makeBouncyButton(this._menuFsBtn, 0.64, () => {
      const _0x26b7c = !this.scale.isFullscreen;
      this._menuFsBtn.setTexture("GJ_WebSheet", _0x26b7c ? "toggleFullscreenOff_001.png" : "toggleFullscreenOn_001.png");
      this._expandHitArea(this._menuFsBtn, 1.5);
      this._toggleFullscreen();
    }, () => this._menuActive);
    this._menuInfoBtn = null;
    this._menuUpdateLogBtn = null;
    this._menuSettingsBtn = this.add.image(centerX + 92, screenHeight - 90, "GJ_GameSheet03", "GJ_optionsBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive();
    this._expandHitArea(this._menuSettingsBtn, 1);
    this._makeBouncyButton(this._menuSettingsBtn, 1, () => {
      this._showSettingsScreen();
    }, () => this._menuActive && !this._settingsPopup);
    this._menuStatsBtn = this.add.image(centerX + 202, screenHeight - 90, "GJ_GameSheet03", "GJ_statsBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive();
    this._expandHitArea(this._menuStatsBtn, 1);
    this._makeBouncyButton(this._menuStatsBtn, 1, () => {
      this._showStatsScreen();
    }, () => this._menuActive);
    this._menuAchievementsBtn = this.add.image(centerX - 12, screenHeight - 90, "GJ_GameSheet03", "GJ_achBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive().setTint(0x666666);
    this._expandHitArea(this._menuAchievementsBtn, 1);
    this._makeBouncyButton(this._menuAchievementsBtn, 1, () => {
    }, () => this._menuActive);
    this._menuNewgroundsBtn = this.add.image(centerX + 312, screenHeight - 90, "GJ_GameSheet03", "GJ_ngBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive();
    this._expandHitArea(this._menuNewgroundsBtn, 1);
    this._makeBouncyButton(this._menuNewgroundsBtn, 1, () => {
      this._buildNewgroundsPopup();
    }, () => this._menuActive && !this._newgroundsPopup);
    this._menuGlitter = this.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: 0,
      scale: {
        start: 0.5,
        end: 0
      },
      alpha: {
        start: 0.6,
        end: 0.2
      },
      lifespan: {
        min: 1000,
        max: 2000
      },
      frequency: 35,
      blendMode: S,
      tint: 20670,
      x: {
        min: -130,
        max: 130
      },
      y: {
        min: -100,
        max: 100
      }
    }).setScrollFactor(0).setDepth(29);
    this._playBtn = this.add.image(0, 0, "GJ_GameSheet04", "GJ_playBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive();
    this._playBtnPressed = false;
    this._makeBouncyButton(this._playBtn, 1, () => {
      this._openLevelSelect();
    }, () => this._menuActive && !this._playBtnPressed && !this._levelSelectOverlay);
    // creator stuff
    this._creatorBtn = this.add.image(0, 0, "GJ_GameSheet04", "GJ_creatorBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive().setScale(1);
    this._creatorOverlay = null;
    this._creatorOverlayObjects = null;

    this._openCreatorMenu = () => {
      if (this._creatorOverlay) return;
      this._creatorMenuOpen = true;

      const sw = screenWidth;
      const sh = screenHeight;

      const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(200);
      fadeIn.fillStyle(0x000000, 1);
      fadeIn.fillRect(0, 0, sw, sh);
      this.tweens.add({ targets: fadeIn, alpha: 0, duration: 300, ease: "Linear", onComplete: () => fadeIn.destroy() });

      const overlay = this.add.graphics().setScrollFactor(0).setDepth(100);
      const gradientSteps = 80;
      for (let gi = 0; gi < gradientSteps; gi++) {
        const t = gi / (gradientSteps - 1);
        const r1 = Math.round(0x00 + (0x01 - 0x00) * t);
        const g1 = Math.round(0x65 + (0x2c - 0x65) * t);
        const b1 = Math.round(0xff + (0x71 - 0xff) * t);
        const bandColor = (r1 << 16) | (g1 << 8) | b1;
        const bandY = Math.floor(gi * sh / gradientSteps);
        const bandH = Math.ceil(sh / gradientSteps) + 1;
        overlay.fillStyle(bandColor, 1);
        overlay.fillRect(0, bandY, sw, bandH);
      }
      this._creatorOverlay = overlay;

      const blocker = this.add.zone(sw / 2, sh / 2, sw, sh)
        .setScrollFactor(0).setDepth(101).setInteractive();

      const cornerTL = this.add.image(0,  0,  "GJ_GameSheet03", "GJ_sideArt_001.png")
        .setScrollFactor(0).setDepth(100).setOrigin(0, 0).setFlipY(true)
      const cornerBL = this.add.image(0,  sh, "GJ_GameSheet03", "GJ_sideArt_001.png")
        .setScrollFactor(0).setDepth(152).setOrigin(0, 1)
      const treasureroom = this.add.image(1095, 40, "GJ_GameSheet03", "GJ_lock_001.png")
        .setScrollFactor(0).setDepth(104).setTint(0x666666);
      const vaultsecret = this.add.image(1095, 601, "GJ_GameSheet03", "secretDoorBtn_closed_001.png")
        .setScrollFactor(0).setDepth(104).setScale(1).setTint(0x666666);

      const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_03_001.png")
        .setScrollFactor(0).setDepth(104).setFlipY(true).setFlipX(true)
        .setRotation(Math.PI).setInteractive();
      this._makeBouncyButton(backBtn, 1, () => this._closeCreatorMenu());

      this._creatorOverlayObjects = [overlay, blocker, cornerTL, cornerBL, backBtn, treasureroom, vaultsecret];

      const menuButtons = [
        "GJ_createBtn_001.png",
        "GJ_savedBtn_001.png",
        "GJ_highscoreBtn_001.png",
        "GJ_challengeBtn_001.png",
        "GJ_versusBtn_001.png",
        "GJ_mapBtn_001.png",
        "GJ_dailyBtn_001.png",
        "GJ_weeklyBtn_001.png",
        "GJ_eventBtn_001.png",
        "GJ_gauntletsBtn_001.png",
        "GJ_featuredBtn_001.png",
        "GJ_listsBtn_001.png",
        "GJ_pathsBtn_001.png",
        "GJ_mapPacksBtn_001.png",
        "GJ_searchBtn_001.png",
      ];

      const cols = 5;
      const btnScale = 0.77;
      const btnSize = 209 * btnScale;
      const gapX = 18;
      const gapY = 18;
      const gridW = cols * btnSize + (cols - 1) * gapX;
      const gridStartX = sw / 2 - gridW / 2 + btnSize / 2;
      const rows = Math.ceil(menuButtons.length / cols);
      const gridH = rows * btnSize + (rows - 1) * gapY;
      const gridStartY = sh / 2 - gridH / 2 + btnSize / 2;
      menuButtons.forEach((frame, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const bx = gridStartX + col * (btnSize + gapX);
        const by = gridStartY + row * (btnSize + gapY);
        const btn = this.add.image(bx, by, "GJ_GameSheet04", frame)
          .setScrollFactor(0).setDepth(104).setScale(btnScale);
        const isSearchButton  = frame === "GJ_searchBtn_001.png";
        const isFeaturedButton = frame === "GJ_featuredBtn_001.png";
        const isEditorButton = frame === "GJ_createBtn_001.png"; 
        const isSavedButton  = frame === "GJ_savedBtn_001.png";
        if (isSearchButton) {
          btn.setInteractive();
          this._makeBouncyButton(btn, btnScale, () => {
            this._closeCreatorMenu(true);
            this._openSearchMenu();
          }, () => true);
        } else if (isFeaturedButton) {
          btn.setInteractive();
          this._makeBouncyButton(btn, btnScale, () => {
            this._closeCreatorMenu(true);
            this._openOnlineLevelsScene({ type: 6 });
          }, () => true);
        } else if (isEditorButton) {
          btn.setInteractive();
          this._makeBouncyButton(btn, btnScale, () => {
            this._closeCreatorMenu(true);
            this._openEditorMenu();
          }, () => true);
        } else if (isSavedButton) {
          btn.setInteractive();
          this._makeBouncyButton(btn, btnScale, () => {
            this._closeCreatorMenu(true);
            this._openSavedLevelsScene();
          }, () => true);
        } else {
          btn.postFX.addColorMatrix().grayscale(1);
          btn.setTint(0xafafaf);
        }
        this._creatorOverlayObjects.push(btn);
      });
    };
    this._searchOverlay = null;
    this._searchOverlayObjects = [];
    this._playOverlay = null;
    this._playOverlayObjects = [];
    this._saveOnlineLevelToSavedList = (lvl) => {
      if (!lvl || !lvl.id) return;
      try {
        const _savedKey = "gd_saved_online_levels";
        let _savedLevels = JSON.parse(localStorage.getItem(_savedKey) || "[]");
        const numericId = String(lvl.id);
        const _alreadySaved = _savedLevels.some(sl => String(sl.id) === numericId);
        if (!_alreadySaved) {
          _savedLevels.unshift({
            id:            numericId,
            name:          lvl.name || "Online Level",
            author:        lvl.author || "Unknown",
            customSongID:  lvl.customSongID || null,
            songName:      lvl.songName || "Unknown",
            difficulty:    lvl.difficulty || 0,
            downloads:     lvl.downloads || 0,
            likes:         lvl.likes || 0,
            stars:         lvl.stars || 0,
            coins:         lvl.coins || 0,
            coinsVerified: lvl.coinsVerified || false,
            length:        lvl.length || 0,
            featured:      !!lvl.featured,
            epic:          lvl.epic || 0,
            savedAt:       Date.now()
          });
          localStorage.setItem(_savedKey, JSON.stringify(_savedLevels));
        }
      } catch (_e) {}
    };
    this._openPlayMenu = (onBack = null) => {
      if (this._playOverlay) return;
      const sw = screenWidth;
      const sh = screenHeight;
      this._playMenuBackTarget = onBack || (() => this._openCreatorMenu());

      const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(600);
      fadeIn.fillStyle(0x000000, 1);
      fadeIn.fillRect(0, 0, sw, sh);
      this.tweens.add({ targets: fadeIn, alpha: 0, duration: 300, ease: "Linear", onComplete: () => fadeIn.destroy() });

      const overlay = this.add.graphics().setScrollFactor(0).setDepth(500);
      const gradientSteps = 80;
      for (let gi = 0; gi < gradientSteps; gi++) {
        const t = gi / (gradientSteps - 1);
        const r1 = Math.round(0x00 + (0x01 - 0x00) * t);
        const g1 = Math.round(0x65 + (0x2c - 0x65) * t);
        const b1 = Math.round(0xff + (0x71 - 0xff) * t);
        const bandColor = (r1 << 16) | (g1 << 8) | b1;
        const bandY = Math.floor(gi * sh / gradientSteps);
        const bandH = Math.ceil(sh / gradientSteps) + 1;
        overlay.fillStyle(bandColor, 1);
        overlay.fillRect(0, bandY, sw, bandH);
      }
      this._playOverlay = overlay;

      const cornerBL = this.add.image(0, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(502).setOrigin(0, 1).setFlipY(false);
      const cornerBR = this.add.image(sw, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(502).setOrigin(1, 1).setFlipX(true);

      const blocker = this.add.zone(sw / 2, sh / 2, sw, sh).setScrollFactor(0).setDepth(501).setInteractive();
      const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_01_001.png")
        .setScrollFactor(0).setDepth(504).setFlipX(true).setFlipY(true)
        .setRotation(Math.PI).setInteractive();
      this._makeBouncyButton(backBtn, 1, () => { this._closePlayMenu(false, () => this._playMenuBackTarget()); });

      this._playOverlayObjects.push(overlay, blocker, backBtn, cornerBL, cornerBR);
      const lvl = window._selectedLevelData || {};
      if (lvl.id) localStorage.setItem("viewedLevel_" + lvl.id, "1");
      this._saveOnlineLevelToSavedList(lvl);
      const centerX = sw / 2;

      const _diffFrames = [
        "difficulty_00_btn_001.png", "difficulty_01_btn_001.png", "difficulty_02_btn_001.png",
        "difficulty_03_btn_001.png", "difficulty_04_btn_001.png", "difficulty_05_btn_001.png",
        "difficulty_06_btn2_001.png", "difficulty_07_btn2_001.png", "difficulty_08_btn2_001.png",
        "difficulty_09_btn2_001.png", "difficulty_10_btn2_001.png", "difficulty_auto_btn_001.png"
      ];
      const _diffSizes = {
        "difficulty_00_btn_001.png": { w: 60, h: 85, rotated: false },
        "difficulty_01_btn_001.png": { w: 60, h: 85, rotated: false },
        "difficulty_02_btn_001.png": { w: 86, h: 85, rotated: false },
        "difficulty_03_btn_001.png": { w: 60, h: 84, rotated: false },
        "difficulty_04_btn_001.png": { w: 85, h: 84, rotated: false },
        "difficulty_05_btn_001.png": { w: 76, h: 85, rotated: false },
        "difficulty_06_btn2_001.png": { w: 72, h: 88, rotated: false },
        "difficulty_07_btn2_001.png": { w: 72, h: 85, rotated: false },
        "difficulty_08_btn2_001.png": { w: 72, h: 85, rotated: false },
        "difficulty_09_btn2_001.png": { w: 74, h: 88, rotated: false },
        "difficulty_10_btn2_001.png": { w: 80, h: 91, rotated: false },
        "difficulty_auto_btn_001.png": { w: 60, h: 85, rotated: false },
      };
      const diffIdx = Math.min(_diffFrames.length - 1, Math.max(0, lvl.difficulty || 0));
      const _diffMeta = _diffSizes[_diffFrames[diffIdx]];
      const _targetH = 100, _maxW = 105;
      const _scaleW = _diffMeta ? _diffMeta.w : 90;
      const _scaleH = _diffMeta ? _diffMeta.h : 85;
      const _iconScale = Math.min(_targetH / _scaleH, _maxW / _scaleW);

      const nameText = this.add.bitmapText(centerX, sh * 0.11 - 30, "bigFont", lvl.name || "Unknown", 50)
        .setScrollFactor(0).setDepth(503).setOrigin(0.5);
      this._fitBitmapText(nameText, sw * 0.7);
      this._playOverlayObjects.push(nameText);

      const authorText = this.add.bitmapText(centerX, nameText.y + 42, "goldFont", "By " + (lvl.author || "Unknown"), 36)
        .setScrollFactor(0).setDepth(503).setOrigin(0.5);
      this._fitBitmapText(authorText, sw * 0.6);
      this._playOverlayObjects.push(authorText);

      const playBtnY = sh * 0.36 - 15;
      const playBtn2 = this.add.image(centerX, playBtnY, "GJ_GameSheet03", "GJ_playBtn2_001.png")
        .setScrollFactor(0).setDepth(504).setInteractive();
      let playBtnLoading = false;
      this._makeBouncyButton(playBtn2, 1, async () => {
        if (playBtnLoading) return;
        playBtnLoading = true;
        this._audio.playEffect("playSound_01", { volume: 1 });
        playBtn2.setTint(0x666666);
        playBtn2.disableInteractive();

        let started = false;
        try {
          started = await this._playSelectedOnlineLevel(lvl);
        } catch (err) {
          console.warn("Failed to start selected online level", err);
        }

        if (!started && playBtn2.scene) {
          playBtnLoading = false;
          playBtn2.clearTint();
          playBtn2.setInteractive();
        }
      }, () => !playBtnLoading);
      this._playOverlayObjects.push(playBtn2);

      const _playStatDefs = [
        { icon: "GJ_downloadsIcon_001.png", value: (Number(lvl.downloads) || 0).toLocaleString("en-US"), scale: 0.9 },
        { icon: "GJ_sLikeIcon_001.png",     value: (Number(lvl.likes) || 0).toLocaleString("en-US"), scale: 1.3 },
        { icon: "GJ_timeIcon_001.png",      value: this._getLevelLengthLabel(lvl.length), scale: 0.9 }
      ];
      const _playStatX = centerX + (playBtn2.displayWidth / 2) + 100;
      const _playStatGap = 57;
      const _playStatY0 = playBtnY - _playStatGap;
      const _playStatMaxTextW = (sw - 30) - (_playStatX + 60);
      _playStatDefs.forEach((stat, i) => {
        const _statY = _playStatY0 + i * _playStatGap;
        const statIcon = this.add.image(_playStatX, _statY, "GJ_GameSheet03", stat.icon)
          .setScrollFactor(0).setDepth(503).setOrigin(0.5).setScale(stat.scale);
        this._playOverlayObjects.push(statIcon);
        const statText = this.add.bitmapText(_playStatX + statIcon.displayWidth / 2 + 12, _statY, "bigFont", stat.value, 30)
          .setScrollFactor(0).setDepth(503).setOrigin(0, 0.5);
        this._fitBitmapText(statText, _playStatMaxTextW);
        this._playOverlayObjects.push(statText);
      });

      const diffIconX = centerX - (playBtn2.displayWidth / 2) - 100;
      const diffIconY = playBtnY;
      const diffIcon = this.add.image(diffIconX, diffIconY, "GJ_GameSheet03", _diffFrames[diffIdx])
        .setScrollFactor(0).setDepth(503).setOrigin(0.5)
      if (_diffMeta && _diffMeta.rotated) diffIcon.setAngle(90).setFlipY(true);
      this._playOverlayObjects.push(diffIcon);

      let coinIcon = null;
      if (lvl.epic >= 3) {
        coinIcon = this.add.image(diffIconX, diffIconY, "GJ_GameSheet03", "GJ_epicCoin3_001.png").setScrollFactor(0).setDepth(502).setOrigin(0.5);
      } else if (lvl.epic === 2) {
        coinIcon = this.add.image(diffIconX, diffIconY, "GJ_GameSheet03", "GJ_epicCoin2_001.png").setScrollFactor(0).setDepth(502).setOrigin(0.5);
      } else if (lvl.epic === 1) {
        coinIcon = this.add.image(diffIconX, diffIconY, "GJ_GameSheet03", "GJ_epicCoin_001.png").setScrollFactor(0).setDepth(502).setOrigin(0.5);
      } else if (lvl.featured) {
        coinIcon = this.add.image(diffIconX, diffIconY, "GJ_GameSheet03", "GJ_featuredCoin_001.png").setScrollFactor(0).setDepth(502).setOrigin(0.5);
      }
      if (coinIcon) this._playOverlayObjects.push(coinIcon);

      const _progressKeyId = "online_" + (lvl.id || "0");
      const _bestNormal = parseFloat(localStorage.getItem("bestPercent_" + _progressKeyId) || "0");
      const _bestPractice = parseFloat(localStorage.getItem("practiceBestPercent_" + _progressKeyId) || "0");

      const _barFrame = this.textures.getFrame("GJ_WebSheet", "GJ_progressBar_001.png");
      const _barW = _barFrame ? _barFrame.width : 680;
      const _barH = _barFrame ? _barFrame.height : 40;

      const normalBarY = sh * 0.58 - 15;
      const normalLabel = this.add.bitmapText(centerX, normalBarY - 30, "bigFont", "Normal Mode", 32)
        .setScrollFactor(0).setDepth(503).setOrigin(0.5).setScale(0.78);
      const normalBarBg = this.add.image(centerX, normalBarY, "GJ_WebSheet", "GJ_progressBar_001.png")
        .setScrollFactor(0).setDepth(503).setTint(0).setAlpha(125 / 255).setScale(0.7, 0.69);
      const normalFillW = Math.max(1, Math.floor(_barW * (_bestNormal / 100)));
      const normalBarFg = this.add.image(centerX - _barW * 0.695 / 2, normalBarY, "GJ_WebSheet", "GJ_progressBar_001.png")
        .setScrollFactor(0).setDepth(503).setTint(0x00ff00).setScale(0.695, 0.57).setOrigin(0, 0.5)
        .setCrop(0, 0, normalFillW, _barH);
      const normalPctText = this.add.bitmapText(centerX, normalBarY, "bigFont", _bestNormal + "%", 30)
        .setScrollFactor(0).setDepth(504).setOrigin(0.5).setScale(0.7);
      this._playOverlayObjects.push(normalLabel, normalBarBg, normalBarFg, normalPctText);

      const practiceBarY = sh * 0.70 - 25;
      const practiceLabel = this.add.bitmapText(centerX, practiceBarY - 30, "bigFont", "Practice Mode", 32)
        .setScrollFactor(0).setDepth(503).setOrigin(0.5).setScale(0.78);
      const practiceBarBg = this.add.image(centerX, practiceBarY, "GJ_WebSheet", "GJ_progressBar_001.png")
        .setScrollFactor(0).setDepth(503).setTint(0).setAlpha(125 / 255).setScale(0.7, 0.7);
      const practiceFillW = Math.max(1, Math.floor(_barW * (_bestPractice / 100)));
      const practiceBarFg = this.add.image(centerX - _barW * 0.695 / 2, practiceBarY, "GJ_WebSheet", "GJ_progressBar_001.png")
        .setScrollFactor(0).setDepth(503).setTint(0x00ffff).setScale(0.695, 0.57).setOrigin(0, 0.5)
        .setCrop(0, 0, practiceFillW, _barH);
      const practicePctText = this.add.bitmapText(centerX, practiceBarY, "bigFont", _bestPractice + "%", 30)
        .setScrollFactor(0).setDepth(504).setOrigin(0.5).setScale(0.7);
      this._playOverlayObjects.push(practiceLabel, practiceBarBg, practiceBarFg, practicePctText);
      const sideBtnX = sw - 55;
      const sideBtnGap = sh * 0.16;
      const sideBtnY0 = sh * 0.08 - 100;
      const sideBtnScale = 1;

      const rateLockBtn = this.add.image(55, sideBtnY0 + 350, "GJ_GameSheet03", "GJ_duplicateBtn_001.png")
        .setScrollFactor(0).setDepth(504).setScale(sideBtnScale).setInteractive();
      this._makeBouncyButton(rateLockBtn, sideBtnScale, () => {
        this._duplicateOnlineLevelToEditor(lvl);
      });

      const closeBtn = this.add.image(sideBtnX, sideBtnY0 + sideBtnGap, "GJ_GameSheet03", "GJ_deleteBtn_001.png")
        .setScrollFactor(0).setDepth(504).setScale(sideBtnScale).setInteractive();
      this._makeBouncyButton(closeBtn, sideBtnScale, () => {
        this._closePlayMenu(false, () => this._playMenuBackTarget());
      });

      const refreshBtn = this.add.image(sideBtnX, sideBtnY0 + sideBtnGap * 2, "GJ_GameSheet03", "GJ_updateBtn_001.png")
        .setScrollFactor(0).setDepth(504).setScale(sideBtnScale).setInteractive();
      this._makeBouncyButton(refreshBtn, sideBtnScale, () => {
        const backTarget = this._playMenuBackTarget;
        this._closePlayMenu(true, () => this._openPlayMenu(backTarget));
      });

      const infoBtn2 = this.add.image(sideBtnX, sideBtnY0 + sideBtnGap * 3, "GJ_GameSheet03", "GJ_infoBtn_001.png")
        .setScrollFactor(0).setDepth(504).setScale(sideBtnScale).setInteractive().setTint(0x666666);
      this._makeBouncyButton(infoBtn2, sideBtnScale, () => {
      });

      const leaderboardBtn = this.add.image(sideBtnX, sideBtnY0 + sideBtnGap * 4, "GJ_GameSheet03", "GJ_levelLeaderboardBtn_001.png")
        .setScrollFactor(0).setDepth(504).setScale(sideBtnScale).setInteractive().setTint(0x666666);
      this._makeBouncyButton(leaderboardBtn, sideBtnScale, () => {
      });

      const likeBtn = this.add.image(sideBtnX, sideBtnY0 + sideBtnGap * 5, "GJ_GameSheet03", "GJ_like2Btn_001.png")
        .setScrollFactor(0).setDepth(504).setScale(sideBtnScale).setInteractive().setTint(0x666666);
      this._makeBouncyButton(likeBtn, sideBtnScale, () => {
      });

      this._playOverlayObjects.push(rateLockBtn, closeBtn, refreshBtn, infoBtn2, leaderboardBtn, likeBtn);
      const songBoxW = sw * 0.55;
      const songBoxH = 190;
      const songBoxY = sh - 95;
      const _squareCorner = 0.325 * this.textures.get("GJ_square01").source[0].width;
      const songBox = this.add.nineslice(centerX, songBoxY, "GJ_square01", null, songBoxW, songBoxH, _squareCorner, _squareCorner, _squareCorner, _squareCorner)
        .setScrollFactor(0).setDepth(503).setOrigin(0.5);
      this._playOverlayObjects.push(songBox);

      const songNameText = this.add.bitmapText(centerX - songBoxW / 2 + 20, songBoxY - 60, "bigFont", lvl.songName || "Unknown", 50)
        .setScrollFactor(0).setDepth(504).setOrigin(0, 0.5)
      this._fitBitmapText(songNameText, songBoxW - 100);
      this._playOverlayObjects.push(songNameText);
      let songAuthor = "Unknown";

      const songAuthorText = this.add.bitmapText(centerX - songBoxW / 2 + 20, songBoxY - 15, "goldFont", "By: " + songAuthor, 36)
        .setScrollFactor(0).setDepth(504).setOrigin(0, 0.5)
      this._fitBitmapText(songAuthorText, songBoxW - 100);
      this._playOverlayObjects.push(songAuthorText);

      if (lvl.customSongID && lvl.customSongID !== "0") {
        const downloadBtnX = centerX + songBoxW / 2 - 50;
        const downloadBtnY = songBoxY + 40;
        const downloadBtn = this.add.image(downloadBtnX, downloadBtnY, "GJ_GameSheet03", "GJ_downloadBtn_001.png").setScrollFactor(0).setDepth(504).setInteractive();
        this._playOverlayObjects.push(downloadBtn);
        this._bindSongDownloadProgress(this._playOverlayObjects, downloadBtnX, downloadBtnY, songBoxW - 130);
        let isDownloading = false;
        let abortController = null;
        let isDownloaded = false;
        const updateBtnState = async () => {
          if (!downloadBtn || !downloadBtn.scene) return;
          if (isDownloading) {
            downloadBtn.setTexture("GJ_GameSheet03", "GJ_cancelDownloadBtn_001.png");
          } else {
            isDownloaded = await window.SongDB.isDownloaded(lvl.customSongID).catch(() => false);
            if (downloadBtn && downloadBtn.scene) {
              downloadBtn.setTexture("GJ_GameSheet03", isDownloaded ? "GJ_trashBtn_001.png" : "GJ_downloadBtn_001.png");
            }
          }
        };
        updateBtnState();
        this._makeBouncyButton(downloadBtn, 1, async () => {
          if (isDownloading) {
            if (abortController) abortController.abort();
            isDownloading = false;
            updateBtnState();
            return;
          }
          if (isDownloaded) {
            await window.SongDB.delete(lvl.customSongID);
            updateBtnState();
            return;
          }
          isDownloading = true;
          updateBtnState();
          abortController = new AbortController();
          const requestController = abortController;
          const downloadKey = `song:${lvl.customSongID}`;
          window.GDDownloads?.begin(downloadKey);
          try {
            const audioRes = await window.fetchGdSongAudio(lvl.customSongID, { signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(120000)]) });
            const arrayBuf = await (window.readGdAudioResponse?.(audioRes, downloadKey) || audioRes.arrayBuffer());
            // Never persist an HTML proxy error as a supposedly downloaded song.
            await this.sound.context.decodeAudioData(arrayBuf.slice(0));
            await window.SongDB.save(lvl.customSongID, arrayBuf);
            window.GDDownloads?.finish(downloadKey);
          } catch (err) {
            if (abortController === requestController) {
              if (requestController.signal.aborted) window.GDDownloads?.cancel(downloadKey);
              else window.GDDownloads?.finish(downloadKey, false);
            }
            if (err.name === 'AbortError') {
              console.log('Download cancelled.');
            } else {
              console.warn("Failed to download song:", err);
            }
          } finally {
            if (abortController === requestController) {
              isDownloading = false;
              abortController = null;
              updateBtnState();
            }
          }
        });
      }

      if (lvl.customSongID) {
        const PROXY_BASE = (window._gdProxyUrl || "").replace(/\/$/, "");
        if (!PROXY_BASE) {
          console.warn("Play menu song author: window._gdProxyUrl is not configured");
        } else {
          window.fetchGdApi('/getGJSongInfo.php', {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `songID=${lvl.customSongID}&secret=Wmfd2893gb7`
          })
            .then(res => (res.ok ? res.text() : "-1"))
            .then(ngText => {
              if (!ngText || ngText === "-1") return;
              const ngParts = ngText.split("~|~");
              const ngMap = {};
              for (let i = 0; i + 1 < ngParts.length; i += 2) ngMap[ngParts[i]] = ngParts[i + 1];

              const artistName = (ngMap["4"] || "Unknown").trim();
              const songName = (ngMap["2"] || "Unknown").trim();

              if (artistName) {
                songAuthor = artistName;
                songAuthorText.setText("By: " + songAuthor);
                this._fitBitmapText(songAuthorText, songBoxW - 100);
              }

              if (songName && typeof songNameText !== "undefined" && songNameText) {
                songNameText.setText(songName);
                this._fitBitmapText(songNameText, songBoxW - 100);
              }
            })
            .catch(err => {
              console.warn("Failed to fetch song author:", err);
            });
        }
      }
    };
    this._closePlayMenu = (silent = false, onComplete = null) => {
      if (!this._playOverlay) return;
      const destroy = () => {
        for (const obj of this._playOverlayObjects) {
          if (obj && obj.destroy) obj.destroy();
        }
        this._playOverlayObjects = [];
        this._playOverlay = null;
      };
      if (silent) { destroy(); if (onComplete) onComplete(); return; }
      const sw = screenWidth, sh = screenHeight;
      const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(600).setAlpha(0);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, sw, sh);
      this.tweens.add({
        targets: fadeOut, alpha: 1, duration: 150, ease: "Linear",
        onComplete: () => {
          destroy();
          if (onComplete) onComplete();
          this.tweens.add({ targets: fadeOut, alpha: 0, duration: 150, ease: "Linear", onComplete: () => fadeOut.destroy() });
        }
      });
    };
    this._playSelectedOnlineLevel = async (lvl) => {
      if (!lvl || !lvl.id) return false;
      // Unlock while the play button still owns the user gesture, before
      // awaiting the level request. Waiting to resume afterwards can hang.
      this.game.sound.context?.resume()?.catch(()=>{});
      try {
        const res = await window.fetchGdApi('/downloadGJLevel22.php', {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `levelID=${lvl.id}&secret=Wmfd2893gb7`
        });
        if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
        const rawResponse = await res.text();
        if (!rawResponse || rawResponse === "-1" || !rawResponse.includes(":")) return false;

        const lvlParts = rawResponse.split("#")[0].split(":");
        const m = {};
        for (let i = 0; i + 1 < lvlParts.length; i += 2) m[lvlParts[i]] = lvlParts[i + 1];

        const levelString  = m["4"] || null;
        const officialSong = parseInt(m["12"]) || 0;
        const customSongID = (m["35"] || "").trim();
        const isCustomSong = !!customSongID && customSongID !== "0";
        const offset       = parseFloat(m["45"] || "0") || 0;

        window._onlineLevelId    = "online_" + lvl.id;
        window._onlineLevelMetadata = {id:window._onlineLevelId, verificationFrames:Number(m['57']) || 0};
        window._onlineLevelString = levelString;
        window._onlineLevelName   = lvl.name || "Online Level";
        window._onlineSongOffset  = offset;
        window._onlineSongBuffer  = null;
        window._onlineSongKey     = null;

        let songKey = (window.allLevels && window.allLevels[officialSong]) ? window.allLevels[officialSong][0] : `ng_song_${customSongID}`;
        let songArtist = "Unknown";
        let songTitle = null;

        if (isCustomSong) {
          songKey = `ng_song_${customSongID}`;
          try {
            const decoded = await this._audio.triggers.load("song", customSongID);
            if (decoded) {
              window._onlineSongBuffer = decoded;
              window._onlineSongKey = songKey;
            }
          } catch (err) {
            console.warn("Failed to load custom song for online level", err);
          }
        } else if (window.allLevels && window.allLevels[officialSong]) {
          songArtist = window.allLevels[officialSong][3] || "Unknown";
        }
        window.currentlevel = [songKey, window._onlineLevelName, window._onlineLevelId, ["Online", songArtist]];
        this.game.registry.set("autoStartGame", true);
        window._onlineReturnToPlayMenu = { lvl, backTarget: this._playMenuBackTarget };
        this._closePlayMenu(false, () => this.scene.restart());
        return true;
      } catch (err) {
        console.warn("Failed to start online level", err);
        return false;
      }
    };
    this._duplicateOnlineLevelToEditor = async (lvl) => {
      if (!lvl || !lvl.id) return;
      try {
        const res = await window.fetchGdApi('/downloadGJLevel22.php', {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `levelID=${lvl.id}&secret=Wmfd2893gb7`
        });
        if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
        const rawResponse = await res.text();
        if (!rawResponse || rawResponse === "-1" || !rawResponse.includes(":")) return;

        const lvlParts = rawResponse.split("#")[0].split(":");
        const m = {};
        for (let i = 0; i + 1 < lvlParts.length; i += 2) m[lvlParts[i]] = lvlParts[i + 1];

        const levelString = m["4"] || "";
        if (!levelString) { console.warn("Duplicate level: no level data in response"); return; }

        const officialSong = parseInt(m["12"]) || 0;
        const customSongID = (m["35"] || "").trim();
        const isCustomSong = !!customSongID && customSongID !== "0";
        const levelVersion = parseInt(m["16"]) || 1;

        let songName, songId;
        if (isCustomSong) {
          songId = parseInt(customSongID) || 0;
          songName = lvl.songName || `NG#${customSongID}`;
        } else {
          songId = -officialSong - 1;
          try { songName = window.allLevels[officialSong][1]; } catch (e) { songName = lvl.songName || "Unknown"; }
        }

        const rawLevels = localStorage.getItem("created_levels");
        const createdLevels = rawLevels ? JSON.parse(rawLevels) : [];

        const newLevel = {
          levelName: lvl.name || "Unknown",
          song: songName,
          songId: songId,
          levelId: lvl.id,
          levelString: levelString,
          verificationFrames: Number(m['57']) || 0,
          levelLength: lvl.length || 0,
          normalBest: 0,
          practiceBest: 0,
          description: lvl.description || "",
          version: levelVersion,
          status: "Unverified",
          createdId: this._getNextLocalId()
        };

        createdLevels.push(newLevel);
        await window.CreatedLevelStore.save(createdLevels);

        this._audio.playEffect("build_01");
        this._closePlayMenu(false, () => this._openLevelView(newLevel));
      } catch (err) {
        console.warn("Failed to duplicate level to editor:", err);
      }
    };
    this._openEditorMenu = () => {
        if (this._editorOverlay) return;
        const sw = screenWidth;
        const sh = screenHeight;
        const centerX = sw / 2;

        const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(200);
        fadeIn.fillStyle(0x000000, 1);
        fadeIn.fillRect(0, 0, sw, sh);
        this.tweens.add({ targets: fadeIn, alpha: 0, duration: 300, ease: "Linear", onComplete: () => fadeIn.destroy() });

        const overlay = this.add.graphics().setScrollFactor(0).setDepth(100);
        const gradientSteps = 80;
        for (let gi = 0; gi < gradientSteps; gi++) {
            const t = gi / (gradientSteps - 1);
            const r1 = Math.round(0x00 + (0x01 - 0x00) * t);
            const g1 = Math.round(0x65 + (0x2c - 0x65) * t);
            const b1 = Math.round(0xff + (0x71 - 0xff) * t);
            const bandColor = (r1 << 16) | (g1 << 8) | b1;
            overlay.fillStyle(bandColor, 1);
            overlay.fillRect(0, Math.floor(gi * sh / gradientSteps), sw, Math.ceil(sh / gradientSteps) + 1);
        }
        this._editorOverlay = overlay;

        const blocker = this.add.zone(centerX, sh / 2, sw, sh).setScrollFactor(0).setDepth(101).setInteractive();
        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(102);

        const tableW = 712;
        const tableH = 460;
        const tableX = (sw - tableW) / 2;
        const tableY = 85;

        const rawData = localStorage.getItem("created_levels");
        const createdLevels = rawData ? JSON.parse(rawData) : [];

        createdLevels.sort((a, b) => {
            const idA = parseInt(a.createdId.replace("local_", "")) || 0;
            const idB = parseInt(b.createdId.replace("local_", "")) || 0;
            return idB - idA;
        });

        const nameCounts = {};
        const levelRevisions = {};

        createdLevels.forEach(lvl => {
            const name = lvl.levelName;
            if (!nameCounts[name]) {
                nameCounts[name] = 1;
                levelRevisions[lvl.createdId] = "";
            } else {
                levelRevisions[lvl.createdId] = `Rev. ${nameCounts[name]}`;
                nameCounts[name]++;
            }
        });

        const lengthValues = ["Tiny", "Short", "Medium", "Long", "XL", "Plat."]

        const listContainer = this.add.container(0, 0);
        const maskShape = this.add.graphics().fillStyle(0xffffff).fillRect(tableX, tableY, tableW, tableH).setVisible(false);
        const mask = maskShape.createGeometryMask();
        listContainer.setMask(mask);
        container.add(this.add.graphics().setScrollFactor(0).setDepth(90).fillStyle(0xc2723e, 1).fillRect(tableX, tableY, tableW, tableH));
        container.add(listContainer);

        createdLevels.forEach((level, index) => {
            const spacing = 100;
            const slotY = (index * spacing) + (spacing / 2);
            
            const isOdd = index % 2 !== 0;
            const stripeColor = isOdd ? 0xc2723e : 0xa1582c;

            const bgStripe = this.add.rectangle(centerX, slotY, tableW - 10, spacing, stripeColor, 1);
            const separator = this.add.rectangle(centerX, slotY + (spacing / 2), tableW - 10, 1, 0x502c16, 1);
            const nameTxt = this.add.bitmapText(tableX + 20, slotY - 22, "bigFont", level.levelName, 32).setOrigin(0, 0.5);
            const revLabel = levelRevisions[level.createdId];
            const revText = this.add.bitmapText(
                nameTxt.x + nameTxt.width + 10,
                nameTxt.y + 5,
                "goldFont",
                revLabel, 
                20
            ).setOrigin(0, 0.5);
            const infoY = slotY + 18;
            const lenIcon = this.add.image(tableX + 35, infoY, "GJ_GameSheet03", "GJ_timeIcon_001.png").setScale(0.65);
            const lenTxt = this.add.bitmapText(lenIcon.x + 22, infoY, "bigFont", lengthValues[parseInt(level.levelLength, 10)] || "Tiny", 18).setOrigin(0, 0.5);
            const songIcon = this.add.image(tableX + 150, infoY, "GJ_GameSheet03", "GJ_musicIcon_001.png").setScale(0.65);
            const songTxt = this.add.bitmapText(songIcon.x + 22, infoY, "bigFont", level.song, 18).setOrigin(0, 0.5);
            const statusIcon = this.add.image(tableX + 380, infoY, "GJ_GameSheet03", "GJ_infoIcon_001.png").setScale(0.65);
            const songTxtMaxW = Math.max(20, (statusIcon.x - 25) - songTxt.x);
            songTxt.setScale(1);
            if (songTxt.width > songTxtMaxW) {
                songTxt.setScale(songTxtMaxW / songTxt.width);
            }
            const statusTxt = this.add.bitmapText(statusIcon.x + 22, infoY, "bigFont", level.status, 18).setOrigin(0, 0.5);
            
            const viewBtn = this.add.nineslice(tableX + tableW - 80, slotY, "GJ_button01", null, 120, 60, 24, 24, 24, 24 ).setScale(0.75).setInteractive();
            const viewTxt = this.add.bitmapText(viewBtn.x - 2, viewBtn.y - 1, "bigFont", "View", 32).setOrigin(0.5).setScale(0.8);
            
            this._makeCompositeBouncyButton(viewBtn, [viewBtn, viewTxt], 0.75, () => {
                this._closeEditorMenu(false);
                this._openLevelView(level);
            });

            listContainer.add([bgStripe, separator, nameTxt, revText, lenIcon, lenTxt, songIcon, songTxt, statusIcon, statusTxt, viewBtn, viewTxt]);
        });
        if (createdLevels.length === 0) {
            container.add(this.add.bitmapText(centerX, tableY + (tableH/2), "bigFont", "No Levels", 30).setOrigin(0.5).setAlpha(0.5));
        }
        const sideFrame = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
        const sideScaleY = tableH / sideFrame.height;
        container.add(this.add.image(tableX - 40, tableY, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(0, 0).setScale(1, sideScaleY));
        container.add(this.add.image(tableX + tableW + 40, tableY, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(1, 0).setFlipX(true).setScale(1, sideScaleY));
        container.add(this.add.image(centerX, tableY - 10, "GJ_WebSheet", "GJ_table_top_001.png"));
        container.add(this.add.image(centerX, tableY + tableH + 20, "GJ_WebSheet", "GJ_table_bottom_001.png"));
        container.add(this.add.bitmapText(centerX, tableY - 15, "bigFont", "My Levels", 42).setOrigin(0.5).setScale(1.1));

        let startY = tableY;
        const listHeight = createdLevels.length * 100;
        const minY = tableY - Math.max(0, listHeight - tableH) - 10;
        const maxY = tableY + 22;

        listContainer.y = maxY;
        this._scrollTargetY = maxY;
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!this._editorOverlay) return;
            this._scrollTargetY -= deltaY;
            this._scrollTargetY = Phaser.Math.Clamp(this._scrollTargetY, minY, maxY);

            this.tweens.add({
                targets: listContainer,
                y: this._scrollTargetY,
                duration: 250,
                ease: 'Power2',
                overwrite: true
            });
        });
        blocker.on('pointerdown', (pointer) => {
            startY = pointer.y - listContainer.y;
        });

        blocker.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                listContainer.y = pointer.y - startY;
                listContainer.y = Phaser.Math.Clamp(listContainer.y, minY, maxY);
            }
        });

        const newBtnX = sw - 60;
        const newBtnY = sh - 55;
        const newBtn = this.add.image(newBtnX, newBtnY, "GJ_GameSheet03", "GJ_newBtn_001.png")
            .setScale(0.9)
            .setInteractive();
        
        this._makeBouncyButton(newBtn, 0.9, async () => {
            const rawData = localStorage.getItem("created_levels");
            let createdLevels = rawData ? JSON.parse(rawData) : [];

            let counter = 0;
            while (createdLevels.some(lvl => lvl.levelName === "Unnamed " + counter)) {
                counter++;
            }
            const newName = "Unnamed " + counter;

            const newLevel = {
                levelName: newName,
                song: "Stereo Madness",
                songId: -1,
                levelId: null,
                levelString: "H4sIAAAAAAAACq1QwRHDMAhbyO0hwIlzfWWGDsAAXaHD10Z-9Ff3Ln4gG4GMeD2tFYRLaEBrWGitARCUwKTHDbEFRCT2wF3yBOrXvYVEC7wRKSi6JoirBY8FwdHB9iVJjZ5ckP1rlf19taIv7pLGh-wP43XROPq9z9mOtX1uS7LldcKKzPx41ZKwEbz0yPueUSfPF9qApx3kMlrGJE7PSBbCIlYpy5QVuheMciE0AgiaoFRUihk5I2ec0Knp1PTK9slxYDM2OIFmjL8bv-1mBmB6YrvO4UErHR4fJXMaP9sDAAA=", 
                levelLength: 0,
                normalBest: 0,
                practiceBest: 0,
                description: "",
                version: 1,
                status: "Unverified",
                createdId: this._getNextLocalId()
            };

            createdLevels.push(newLevel);
            await window.CreatedLevelStore.save(createdLevels);

            this._closeEditorMenu();
            this._openLevelView(newLevel);
            
            this._audio.playEffect("build_01");
        });
        container.add(newBtn);

        const importBtn = this.add.image(newBtnX, newBtnY - 90, "import").setScale(0.3).setInteractive();
        this._makeBouncyButton(importBtn, 0.3, () => {
            this._importGMD();
        });
        container.add(importBtn);

        const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_03_001.png")
            .setScrollFactor(0).setDepth(104).setFlipX(true).setFlipY(true).setRotation(Math.PI).setInteractive();
        
        this._makeBouncyButton(backBtn, 1, () => {
          this._closeEditorMenu();
          this._openCreatorMenu(); 
        });

        this._editorObjects = [overlay, blocker, container, backBtn, maskShape];
    };
    this._importGMD = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.gmd';

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = event.target.result;
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");
                    const keys = xmlDoc.querySelectorAll("key, k");
                    
                    let extracted = {
                        name: "Imported Level",
                        data: "",
                        version: 1,
                        length: 0,
                        id: "NA",
                        desc: "",
                        officialSongId: 0,
                        customSongId: 0
                    };

                    keys.forEach(keyNode => {
                        const k = keyNode.textContent;
                        const v = keyNode.nextElementSibling;
                        if (!v) return;
                        const val = v.textContent;

                        if (k === "k2") extracted.name = val;
                        if (k === "k4") extracted.data = val;
                        if (k === "k1") extracted.id = val;
                        if (k === "k23") extracted.length = parseInt(val) || 0;
                        if (k === "k16") extracted.version = parseInt(val) || 1;
                        if (k === "k95") extracted.verificationFrames = Number(val) || 0;
                        if (k === "k8") extracted.officialSongId = parseInt(val) || 0;
                        if (k === "k45") extracted.customSongId = parseInt(val) || 0;
                        if (k === "k3") {
                            try { extracted.desc = atob(val); } catch(e) { extracted.desc = val; }
                        }
                    });

                    if (!extracted.data) throw new Error("No level string found.");

                    let finalSongName = "Stereo Madness";
                    let finalSongId = -1;

                    if (extracted.customSongId > 0) {
                        finalSongId = extracted.customSongId;
                        finalSongName = `NG#${extracted.customSongId}`;
                    } else {
                        finalSongId = -extracted.officialSongId -1;
                        try {
                            finalSongName = window.allLevels[extracted.officialSongId][1];
                        } catch(e) {
                            finalSongName = "Unknown";
                        }
                    }

                    const rawLevels = localStorage.getItem("created_levels");
                    let createdLevels = rawLevels ? JSON.parse(rawLevels) : [];
                    
                    const newLevel = {
                        levelName: extracted.name,
                        song: finalSongName,
                        songId: finalSongId,
                        levelId: (extracted.id === "0" || !extracted.id) ? "NA" : extracted.id,
                        levelString: extracted.data, 
                        levelLength: extracted.length,
                        verificationFrames: extracted.verificationFrames || 0,
                        normalBest: 0,
                        practiceBest: 0,
                        description: extracted.desc || "",
                        version: extracted.version,
                        status: "Unverified",
                        createdId: this._getNextLocalId()
                    };

                    createdLevels.push(newLevel);
                    await window.CreatedLevelStore.save(createdLevels);
                    
                    this._closeEditorMenu(false);
                    this._openLevelView(newLevel);

                } catch (err) {
                    console.error("GMD Import Error:", err);
                    alert("Could not import .gmd: " + err.message);
                }
            };
            reader.readAsText(file);
        };

        fileInput.click();
    };
    this._escapeXml = (value) => {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    };
    this._decodeWebLevelStringForGMD = (levelString) => {
        if (!levelString) return "";
        try {
            let base64 = String(levelString)
                .trim()
                .replace(/-/g, "+")
                .replace(/_/g, "/");

            while (base64.length % 4 !== 0) {
                base64 += "=";
            }
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return pako.inflate(bytes, { to: "string" });
        } catch (err) {
            console.warn("Why the fuck didnt it work", err);
            return String(levelString);
        }
    };
    this._exportGMD = async (level) => {
        const levelString = await window.CreatedLevelStore.loadData(level);
        const encodedDesc = btoa(unescape(encodeURIComponent(level.description || "")));
        const authorName = "Web Dashers";
        const officialSong = level.songId < 0 ? Math.abs(level.songId) : 0;
        const customSong = level.songId > 0 ? level.songId : 0;
        const rawLevelData = this._decodeWebLevelStringForGMD(levelString);
        const safeName = this._escapeXml(level.levelName || "Unnamed");
        const safeDesc = this._escapeXml(encodedDesc);
        const safeAuthor = this._escapeXml(authorName);
        const safeLevelData = this._escapeXml(rawLevelData);

        let xml = "";
        xml += '<?xml version="1.0"?>';
        xml += '<plist version="1.0" gjver="2.0">';
        xml += '<dict>';
        xml += '<k>kCEK</k><i>4</i>';
        xml += `<k>k1</k><i>${
            level.levelId && level.levelId !== "NA"
                ? String(level.levelId).replace(/\D/g, "")
                : 0
        }</i>`;
        xml += `<k>k2</k><s>${safeName}</s>`;
        xml += `<k>k3</k><s>${safeDesc}</s>`;
        xml += `<k>k4</k><s>${safeLevelData}</s>`;
        xml += `<k>k5</k><s>${safeAuthor}</s>`;
        xml += `<k>k8</k><i>${officialSong - 1}</i>`;
        xml += `<k>k45</k><i>${customSong}</i>`;
        xml += `<k>k16</k><i>${level.version || 1}</i>`;
        if (level.verificationFrames > 0) xml += `<k>k95</k><i>${Math.round(level.verificationFrames)}</i>`;
        xml += `<k>k18</k><i>${level.levelLength || 0}</i>`;
        xml += `<k>k23</k><i>${level.levelLength || 0}</i>`;
        xml += '<k>k13</k><t/>';
        xml += '<k>k21</k><i>2</i>';
        xml += '<k>k50</k><i>47</i>';
        xml += '<k>k101</k><s>0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0</s>';
        xml += '<k>kI1</k><r>0</r>';
        xml += '<k>kI2</k><r>0</r>';
        xml += '<k>kI3</k><r>0.1</r>';
        xml += '<k>kI6</k><d>';
        xml += '<k>0</k><s>0</s><k>1</k><s>0</s><k>2</k><s>0</s><k>3</k><s>0</s>';
        xml += '<k>4</k><s>0</s><k>5</k><s>0</s><k>6</k><s>0</s><k>7</k><s>0</s>';
        xml += '<k>8</k><s>0</s><k>9</k><s>0</s><k>10</k><s>0</s><k>11</k><s>0</s>';
        xml += '<k>12</k><s>0</s><k>13</k><s>0</s>';
        xml += '</d>';
        xml += '</dict>';
        xml += '</plist>';

        const blob = new Blob([xml], { type: "text/xml" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fileName = `${String(level.levelName || "Unnamed").replace(/[^a-z0-9]/gi, "_")}.gmd`;

        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };
    this._getNextLocalId = () => {
        const rawData = localStorage.getItem("created_levels");
        const levels = rawData ? JSON.parse(rawData) : [];
        let maxId = 0;
        levels.forEach(l => {
            if (l.createdId && typeof l.createdId === "string") {
                const idNum = parseInt(l.createdId.split('_')[1]);
                if (!isNaN(idNum) && idNum > maxId) {
                    maxId = idNum;
                }
            }
        });
        return "local_" + (maxId + 1);
    };
    this._openLevelView = (level) => {
        const sw = screenWidth;
        const sh = screenHeight;
        const centerX = sw / 2;
        const saveToLS = (key, val) => {
            const rawData = localStorage.getItem("created_levels");
            let levels = rawData ? JSON.parse(rawData) : [];
            const idx = levels.findIndex(l => l.createdId === level.createdId);
            if (idx !== -1) {
                levels[idx][key] = val;
                localStorage.setItem("created_levels", JSON.stringify(levels));
            }
        };
        const deleteLevel = () => {
            if (!confirm(`Are you sure you want to delete ${level.levelName}?`)) return;
            const rawData = localStorage.getItem("created_levels");
            let levels = rawData ? JSON.parse(rawData) : [];
            levels = levels.filter(l => l.createdId !== level.createdId);
            localStorage.setItem("created_levels", JSON.stringify(levels));
            window.CreatedLevelStore.removeData(level).catch(err => console.warn("Could not remove level payload", err));
            cleanup();
            this._openEditorMenu();
        };
        this._activeInput = null;
        let cursorVisible = true;

        const blocker = this.add.zone(centerX, sh / 2, sw, sh)
            .setOrigin(0.5).setDepth(101).setInteractive();
        blocker.on('pointerdown', () => { this._activeInput = null; });
        const overlay = this.add.graphics().setScrollFactor(0).setDepth(102);
        const gradientSteps = 80;
        for (let gi = 0; gi < gradientSteps; gi++) {
            const t = gi / (gradientSteps - 1);
            const r1 = Math.round(0x00 + (0x01 - 0x00) * t);
            const g1 = Math.round(0x65 + (0x2c - 0x65) * t);
            const b1 = Math.round(0xff + (0x71 - 0xff) * t);
            const bandColor = (r1 << 16) | (g1 << 8) | b1;
            overlay.fillStyle(bandColor, 1);
            overlay.fillRect(0, Math.floor(gi * sh / gradientSteps), sw, Math.ceil(sh / gradientSteps) + 1);
        }

        const container = this.add.container(0, 0).setDepth(150);
        const boxWidth = sw * 0.6;
        const cornerRad = 18;

        const nameY = 50;
        const nameBox = this.add.graphics().setDepth(151).setInteractive(new Phaser.Geom.Rectangle(centerX - (boxWidth / 2), nameY - 28, boxWidth, 70), Phaser.Geom.Rectangle.Contains);
        nameBox.fillStyle(0x000000, 0.3).fillRoundedRect(centerX - (boxWidth / 2), nameY - 28, boxWidth, 70, cornerRad);
        const titleText = this.add.bitmapText(centerX, nameY + 5, "bigFont", level.levelName, 45).setOrigin(0.5).setDepth(152);
        const titleCursor = this.add.bitmapText(0, nameY + 5, "bigFont", "|", 45).setOrigin(0, 0.5).setDepth(153).setVisible(false);

        const descY = 180;
        const descH = 120;
        const descBox = this.add.graphics().setDepth(151).setInteractive(new Phaser.Geom.Rectangle(centerX - (boxWidth / 2), descY - (descH / 2), boxWidth, descH), Phaser.Geom.Rectangle.Contains);
        descBox.fillStyle(0x000000, 0.3).fillRoundedRect(centerX - (boxWidth / 2), descY - (descH / 2), boxWidth, descH, cornerRad);
        const descText = this.add.text(centerX, descY, level.description || "Description [Optional]", {
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: "22px",
            color: "#ffffff",
            align: "center",
            lineSpacing: 4,
            wordWrap: { width: boxWidth - 40, useAdvancedWrap: true }
        }).setOrigin(0.5).setDepth(152);
        const descCursor = this.add.text(0, 0, "|", { fontFamily: "Helvetica", fontSize: "18px", color: "#ffffff" })
            .setOrigin(0.5).setDepth(153).setVisible(false);

        const updateDisplay = () => {
            titleText.setText(level.levelName);
            if (this._activeInput === 'title') {
                titleCursor.setPosition(titleText.x + (titleText.width / 2) + 2, nameY + 5).setVisible(cursorVisible);
                descCursor.setVisible(false);
            } 
            else if (this._activeInput === 'desc') {
                descText.setText(level.description || "");
                titleCursor.setVisible(false);

                const lines = descText.getWrappedText(level.description || "");
                const lineCount = lines.length;
                const lastLine = lines[lineCount - 1] || "";                
                const metrics = descText.canvas.getContext('2d').measureText(lastLine);
                const lastLineWidth = metrics.width;

                const size = 22;
                const spacing = 4;
                const fullLineHeight = size + spacing;
                const totalHeight = (lineCount * fullLineHeight) - spacing;
                
                const topOfText = descY - (totalHeight / 2);
                const cursorY = topOfText + ((lineCount - 1) * fullLineHeight) + (size / 2);

                descCursor.setPosition(centerX + (lastLineWidth / 2) + 2, cursorY).setVisible(cursorVisible);
            } else {
                descText.setText(level.description || "Description [Optional]");
                titleCursor.setVisible(false);
                descCursor.setVisible(false);
            }
        };

        const cursorInterval = setInterval(() => {
            cursorVisible = !cursorVisible;
            updateDisplay();
        }, 500);

        const keyHandler = (event) => {
            if (!this._activeInput) return;
            if (event.key === "Backspace") {
                if (this._activeInput === 'title') level.levelName = level.levelName.slice(0, -1);
                else level.description = (level.description || "").slice(0, -1);
            } else if (event.key === "Enter") {
                this._activeInput = null;
            } else if (event.key.length === 1) {
                if (this._activeInput === 'title' && level.levelName.length < 20) {
                    level.levelName += event.key;
                } else if (this._activeInput === 'desc' && (level.description || "").length < 150) {
                    level.description = (level.description || "") + event.key;
                }
            }
            saveToLS(this._activeInput === 'title' ? "levelName" : "description", 
                    this._activeInput === 'title' ? level.levelName : level.description);
            cursorVisible = true;
            updateDisplay();
        };

        window.addEventListener('keydown', keyHandler);
        nameBox.on('pointerdown', () => { this._activeInput = 'title'; updateDisplay(); });
        descBox.on('pointerdown', () => { this._activeInput = 'desc'; updateDisplay(); });

        const cleanup = () => {
            clearInterval(cursorInterval);
            window.removeEventListener('keydown', keyHandler);
            container.destroy();
            overlay.destroy();
            blocker.destroy();
            this._levelViewOverlay = null;
            this._closeLevelView = null;
        };
        this._levelViewOverlay = overlay;
        this._closeLevelView = () => { cleanup(); this._openEditorMenu(); };

        const btnY = sh * 0.58;
        const editBtn = this.add.image(centerX - 220, btnY, "GJ_GameSheet03", "GJ_editBtn_001.png").setInteractive().setScale(1.1);
        this._makeBouncyButton(editBtn, 1.1, async () => {
            try { await this._startCreatedLevel(level, true, cleanup); }
            catch (err) { alert("Could not open level: " + err.message); }
        });
        const playBtn = this.add.image(centerX, btnY, "GJ_GameSheet03", "GJ_playBtn2_001.png").setInteractive().setScale(1.1);
        let playBtnLoading = false;
        this._makeBouncyButton(playBtn, 1.1, async () => {
            if (playBtnLoading) return;
            playBtnLoading = true;
            this._audio.playEffect("playSound_01", { volume: 1 });
            playBtn.setTint(0x666666);
            playBtn.disableInteractive();

            let started = false;
            try {
                started = await this._startCreatedLevel(level, false, cleanup);
            } catch (err) {
                console.warn("Failed to start saved level", err);
                alert("Could not start level: " + err.message);
            }

            if (!started && playBtn.scene) {
                playBtnLoading = false;
                playBtn.clearTint();
                playBtn.setInteractive();
            }
        }, () => !playBtnLoading);
        const shareBtn = this.add.image(centerX + 220, btnY, "GJ_GameSheet03", "GJ_shareBtn_001.png").setInteractive().setScale(1.1);
        this._makeBouncyButton(shareBtn, 1.1, async () => {
            try { await this._exportGMD(level); }
            catch (err) { alert("Could not export level: " + err.message); }
        });
        const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_03_001.png").setFlipX(true).setFlipY(true).setRotation(Math.PI).setInteractive();
        this._makeBouncyButton(backBtn, 1, () => { this._closeLevelView(); });
        const deleteBtn = this.add.image(sw - 50, 48, "GJ_GameSheet03", "GJ_deleteBtn_001.png").setInteractive().setScale(0.8);
        this._makeBouncyButton(deleteBtn, 0.8, () => { deleteLevel(); });

        const footerY = sh - 100; 
        const subFooterY = sh - 30;
        const lengthValues = ["Tiny", "Short", "Medium", "Long", "XL", "Plat."]

        const lengthIcon = this.add.image(centerX - 350, footerY, "GJ_GameSheet03", "GJ_timeIcon_001.png").setScale(1).setDepth(152);
        const lengthLabel = this.add.bitmapText(centerX - 310, footerY, "bigFont", lengthValues[parseInt(level.levelLength, 10)] || "Tiny", 33).setOrigin(0, 0.5).setDepth(152);
        const songIcon = this.add.image(centerX - 160, footerY, "GJ_GameSheet03", "GJ_musicIcon_001.png").setScale(1).setDepth(152);
        const songLabel = this.add.bitmapText(centerX - 115, footerY, "bigFont", level.song, 29).setOrigin(0, 0.5).setDepth(152);
        const statusIcon = this.add.image(centerX + 200, footerY, "GJ_GameSheet03", "GJ_infoIcon_001.png").setScale(1).setDepth(152);
        const songLabelMaxW = Math.max(40, (statusIcon.x - 30) - songLabel.x);
        songLabel.setScale(1);
        if (songLabel.width > songLabelMaxW) {
            songLabel.setScale(songLabelMaxW / songLabel.width);
        }
        const statusLabel = this.add.bitmapText(centerX + 245, footerY, "bigFont", level.status, 33).setOrigin(0, 0.5).setDepth(152);
        const versionText = this.add.bitmapText(centerX - 180, subFooterY, "goldFont", `Version: ${level.version || 1}`, 30).setOrigin(0.5).setDepth(152);
        const idText = this.add.bitmapText(centerX + 180, subFooterY, "goldFont", `ID: ${level.levelId || "na"}`, 30).setOrigin(0.5).setDepth(152);

        container.add([nameBox, titleText, titleCursor, descBox, descText, descCursor, playBtn, editBtn, shareBtn, backBtn, deleteBtn, lengthIcon, lengthLabel, songIcon, songLabel, statusIcon, statusLabel, versionText, idText]);
    };
    this._startCreatedLevel = async (level, isEditor, onBeforeRestart = null) => {
        const levelString = await window.CreatedLevelStore.loadData(level);
        const PROXY_BASE = (window._gdProxyUrl || "").replace(/\/$/, "");
        window._onlineLevelString = levelString;
        window._onlineLevelName = level.levelName;
        window._onlineLevelId = level.createdId;
        window._onlineLevelMetadata = {id:level.createdId, verificationFrames:Number(level.verificationFrames) || 0};
        if (!isEditor) {
          window._createdLevelReturnToView = {
            createdId: level.createdId,
            snapshot: { ...level }
          };
        }
        window._onlineSongBuffer = null;
        window._onlineSongKey = null;
        window._onlineSongOffset = 0;
        window.isEditor = !!isEditor;
        this.game.registry.set("autoStartGame", true);
        window.currentlevel = [
            "Placeholder",
            level.levelName,
            level.createdId,
            ["Local", "SongAuthor"]
        ];
        if (level.songId < 0){
          window.currentlevel[0] = window.allLevels[Math.abs(level.songId) - 1][0];
          window.currentlevel[3] = ["Local", window.allLevels[Math.abs(level.songId) - 1][3]]
        } else {
          const songId = level.songId;
          const songKey = `ng_song_${songId}`;
          window.currentlevel[0] = songKey;
          
          if (songId > 0) {
            const decoded = await this._audio.triggers.load("song", songId);
            if (decoded) { window._onlineSongBuffer = decoded; window._onlineSongKey = songKey; }
          }
        }
        if (onBeforeRestart) onBeforeRestart();
        this.scene.restart();
        return true;
    };
    this._closeEditorMenu = () => {
        if (this._editorObjects) {
            this._editorObjects.forEach(obj => obj.destroy());
        }
        this._editorOverlay = null;
        this._editorObjects = null;
    };
    this._openSearchMenu = () => {
      if (this._searchOverlay) return;
      const sw = screenWidth;
      const sh = screenHeight;

      const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(200);
      fadeIn.fillStyle(0x000000, 1);
      fadeIn.fillRect(0, 0, sw, sh);
      this.tweens.add({ targets: fadeIn, alpha: 0, duration: 300, ease: "Linear", onComplete: () => fadeIn.destroy() });
      const overlay = this.add.graphics().setScrollFactor(0).setDepth(100);
      const gradientSteps = 80;
      for (let gi = 0; gi < gradientSteps; gi++) {
        const t = gi / (gradientSteps - 1);
        const r1 = Math.round(0x00 + (0x01 - 0x00) * t);
        const g1 = Math.round(0x65 + (0x2c - 0x65) * t);
        const b1 = Math.round(0xff + (0x71 - 0xff) * t);
        const bandColor = (r1 << 16) | (g1 << 8) | b1;
        const bandY = Math.floor(gi * sh / gradientSteps);
        const bandH = Math.ceil(sh / gradientSteps) + 1;
        overlay.fillStyle(bandColor, 1);
        overlay.fillRect(0, bandY, sw, bandH);
      }
      this._searchOverlay = overlay;
      const blocker = this.add.zone(sw / 2, sh / 2, sw, sh).setScrollFactor(0).setDepth(101).setInteractive();
      const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_01_001.png")
        .setScrollFactor(0).setDepth(104).setFlipX(true).setFlipY(true)
        .setRotation(Math.PI).setInteractive();
      this._makeBouncyButton(backBtn, 1, () => { this._closeSearchMenu(false, () => this._openCreatorMenu()); });

      const cornerBR = this.add.image(sw, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(152).setOrigin(1, 1).setFlipX(true);
      const cornerBL = this.add.image(0, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(152).setOrigin(0, 1);
      const panelMarginX = sw * 0.18;
      const panelLeft    = panelMarginX;
      const panelRight   = sw - panelMarginX;
      const panelW       = panelRight - panelLeft;
      const panelRadius  = 10;
      const panelColor   = 0x002e75; 
      const topPanelColor = 0x00388d; 
      const innerPanelColor = 0x002762; 
      const filtersPanelColor = 0x00245b;  
      const extraPanelColor = 0x001f4f;  
      const panelAlpha   = 0.7;
      const labelSize    = 32;
      const labelColor   = 0xffffff;
      const gfx          = this.add.graphics().setScrollFactor(0).setDepth(104);
      const topPanelY  = sh * 0.10 - 40;
      const topPanelH  = sh * 0.12;
      gfx.fillStyle(topPanelColor, panelAlpha);
      gfx.fillRoundedRect(panelLeft, topPanelY, panelW, topPanelH, panelRadius);
      const innerPanelY = topPanelY + 10;
      const innerPanelX = panelLeft + 10;
      const innerPanelW = panelW * 0.57;
      const innerPanelH = topPanelH - 20;
      gfx.fillStyle(innerPanelColor, panelAlpha);
      gfx.fillRoundedRect(innerPanelX, innerPanelY, innerPanelW, innerPanelH, panelRadius);

      const innerBtnX = innerPanelX + innerPanelW + 20;
      const innerBtnY = innerPanelY + (innerPanelH / 2);
      
      const innerBtn2 = this.add.image(innerBtnX + 137, innerBtnY, "GJ_GameSheet03", "GJ_longBtn05_001.png")
        .setScrollFactor(0).setDepth(105).setOrigin(0.5, 0.5).setInteractive();
      this._makeBouncyButton(innerBtn2, 1, () => {});
      const innerBtn1 = this.add.image(innerBtnX + 47, innerBtnY, "GJ_GameSheet03", "GJ_longBtn06_001.png")
        .setScrollFactor(0).setDepth(105).setOrigin(0.5, 0.5).setInteractive();
      this._makeBouncyButton(innerBtn1, 1, () => {  _doSearch(); });
      
      const innerBtn3 = this.add.image(innerBtnX + 231, innerBtnY, "GJ_GameSheet03", "GJ_longBtn07_001.png")
        .setScrollFactor(0).setDepth(105).setOrigin(0.5, 0.5).setInteractive();
      this._makeBouncyButton(innerBtn3, 1, () => { inputText = ""; _updateInputDisplay(); });

      const allowedChars = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      // LevelSearchLayer's CCTextInputNode: 20 characters (Steam 434d67).
      const inputMaxLen  = 20;
      const inputCX      = innerPanelX + innerPanelW / 2;
      const inputCY      = innerPanelY + innerPanelH / 2;

      let inputText      = String(window._gdSearchText || "");
      let inputCaret = inputText.length;
      let inputFocused   = false;
      let cursorVisible  = false;
      let cursorTimer    = null;
      const placeholderLabel = this.add.bitmapText(inputCX - 5, inputCY, "bigFont", "Enter a level, user or id", 28)
        .setScrollFactor(0).setDepth(106).setOrigin(0.5, 0.5)
        .setTint(0x6c99d8).setAlpha(0.85);
      const typedLabel = this.add.bitmapText(innerPanelX + 10, inputCY, "bigFont", "", 46)
        .setScrollFactor(0).setDepth(106).setOrigin(0, 0.5)
        .setTint(0xffffff).setVisible(false);
      const inputCursor = this.add.text(0, inputCY, "|", {
        fontSize: "33px", fontFamily: "Arial", color: "#92a7c0"
      }).setScrollFactor(0).setDepth(106).setOrigin(0.5, 0.5).setVisible(false);

      const _updateInputDisplay = () => {
        window._gdSearchText = inputText;
        inputCaret = Math.max(0, Math.min(inputText.length, inputCaret));
        typedLabel.setFontSize(46).setScale(1);
        if (inputText === "") {
          typedLabel.setVisible(false);
          placeholderLabel.setVisible(true);
        } else {
          placeholderLabel.setVisible(false);
          typedLabel.setText(inputText).setVisible(true);
          if (typedLabel.width > innerPanelW - 24) typedLabel.setScale((innerPanelW - 24) / typedLabel.width);
        }
        if (inputFocused) {
          const fullText = typedLabel.text;
          typedLabel.setText(inputText.slice(0, inputCaret));
          const textW = inputText === "" ? 0 : typedLabel.displayWidth;
          typedLabel.setText(fullText);
          const textLeft = innerPanelX + 10;
          inputCursor.x = textLeft + textW + 2;
          inputCursor.setVisible(cursorVisible);
        } else {
          inputCursor.setVisible(false);
        }
      };

      const _startCursorBlink = () => {
        cursorVisible = true;
        _updateInputDisplay();
        if (cursorTimer) cursorTimer.remove();
        cursorTimer = null;
      };

      const _stopCursorBlink = () => {
        if (cursorTimer) { cursorTimer.remove(); cursorTimer = null; }
        cursorVisible = false;
        inputCursor.setVisible(false);
      };

      const _focusInput = () => {
        inputFocused = true;
        _startCursorBlink();
      };

      const _blurInput = () => {
        inputFocused = false;
        _stopCursorBlink();
        _updateInputDisplay();
      };
      const inputHitZone = this.add.zone(
        innerPanelX + innerPanelW / 2, innerPanelY + innerPanelH / 2,
        innerPanelW, innerPanelH
      ).setScrollFactor(0).setDepth(107).setInteractive();
      inputHitZone.on("pointerdown", pointer => {
        _focusInput();
        const fullText=typedLabel.text, x=pointer.x-(innerPanelX+10);
        let closest=Infinity;
        for(let i=0;i<=inputText.length;i++) {
          typedLabel.setText(inputText.slice(0,i));
          const distance=Math.abs(typedLabel.displayWidth-x);
          if(distance<closest){closest=distance;inputCaret=i;}
        }
        typedLabel.setText(fullText);_updateInputDisplay();
      });

      blocker.on("pointerdown", () => { if (inputFocused) _blurInput(); });
      const _onKeyDown = (event) => {
        if (!inputFocused) return;
        event.stopPropagation();
        if (event.key === "Backspace") {
          if (inputText.length > 0) {
            inputText = inputText.slice(0, Math.max(0,inputCaret-1)) + inputText.slice(inputCaret);
            inputCaret=Math.max(0,inputCaret-1);_updateInputDisplay();
          }
        } else if (event.key === "Delete") {
          inputText=inputText.slice(0,inputCaret)+inputText.slice(inputCaret+1);_updateInputDisplay();
        } else if (["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) {
          event.preventDefault();
          inputCaret=event.key==='Home'?0:event.key==='End'?inputText.length:inputCaret+(event.key==='ArrowLeft'?-1:1);_updateInputDisplay();
        } else if (event.key === "Enter") {
          _doSearch();
          } else if (event.ctrlKey || event.metaKey) {
          if (event.key === "c" || event.key === "C") {
            event.preventDefault();
            navigator.clipboard.writeText(inputText);
          } else if (event.key === "v" || event.key === "V") {
            event.preventDefault();
            navigator.clipboard.readText().then(pastedText => {
              const filtered = pastedText.split('').filter(c => allowedChars.includes(c)).join('');
              if (filtered.length > 0) {
                const availableSpace = inputMaxLen - inputText.length;
                const inserted=filtered.slice(0,availableSpace);
                inputText=inputText.slice(0,inputCaret)+inserted+inputText.slice(inputCaret);inputCaret+=inserted.length;
                _updateInputDisplay();
              }
            }).catch(() => {});
          } else if (event.key === "a" || event.key === "A") {
            event.preventDefault();
          }
        } else if (event.key.length === 1 && allowedChars.includes(event.key) && !event.ctrlKey) {
          if (inputText.length < inputMaxLen) {
            inputText=inputText.slice(0,inputCaret)+event.key+inputText.slice(inputCaret);inputCaret++;
            _updateInputDisplay();
          }
        }
      };
      window.addEventListener("keydown", _onKeyDown);

      _updateInputDisplay();
      const htmlInput = {
        focus: _focusInput,
        blur: _blurInput,
        get focused() { return inputFocused; },
        remove: () => {
          window._gdSearchText=inputText;
          window.removeEventListener("keydown", _onKeyDown);
          window.removeEventListener("keydown", _onEnterKeydown);
          window.removeEventListener("keyup", _onKeyUpStop);
          window.removeEventListener("keypress", _onKeyPressStop);
          _blurInput();
        },
        get value() { return inputText; },
      };
      const _onEnterKeydown = (e) => {
        if (e.key === "Enter") _doSearch();
        e.stopPropagation();
      };
      const _onKeyUpStop = (e) => e.stopPropagation();
      const _onKeyPressStop = (e) => e.stopPropagation();
      window.addEventListener("keydown", _onEnterKeydown);
      window.addEventListener("keyup", _onKeyUpStop);
      window.addEventListener("keypress", _onKeyPressStop);
      const _repositionInput = () => {};
      const qsLabelY  = sh * 0.195;
      const qsPanelY  = qsLabelY + 25;
      const qsPanelH  = sh * 0.36;
      const qsLabel   = this.add.bitmapText(sw / 2, qsLabelY, "bigFont", "Quick Search", labelSize)
        .setScrollFactor(0).setDepth(105).setOrigin(0.5, 0.5).setTint(labelColor);

      gfx.fillStyle(panelColor, panelAlpha);
      gfx.fillRoundedRect(panelLeft, qsPanelY, panelW, qsPanelH, panelRadius);
      const gridRows = 3;
      const gridCols = 3;
      const qsPadX = 14;
      const qsPadY = 14.5;
      const qsGapX = 10;
      const qsGapY = 12;
      const totalBtnW = panelW - qsPadX * 2;
      const totalBtnH = qsPanelH - qsPadY * 2;
      const btnW = (totalBtnW - qsGapX * (gridCols - 1)) / gridCols;
      const btnH = (totalBtnH - qsGapY * (gridRows - 1)) / gridRows;

      const lbFrame  = this.textures.getFrame("GJ_GameSheet03", "GJ_longBtn01_001.png");
      const lbBorder = Math.round(lbFrame.height * 0.28);

      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const btnCX = panelLeft + qsPadX + col * (btnW + qsGapX) + btnW / 2;
          const btnCY = qsPanelY + qsPadY + row * (btnH + qsGapY) + btnH / 2;

          const atlas  = this.textures.get("GJ_GameSheet03");
          const frameX = lbFrame.cutX;
          const frameY = lbFrame.cutY;
          const frameW = lbFrame.cutWidth;
          const frameH = lbFrame.cutHeight;
          const midW   = btnW  - lbBorder * 2;
          const midH   = btnH  - lbBorder * 2;
          const tag    = `_lbqs_${row}_${col}`;

          const pieces = [
            { sx: frameX,                     sy: frameY,                     sw: lbBorder,          sh: lbBorder,          dx: -btnW/2,             dy: -btnH/2,             dw: lbBorder, dh: lbBorder },
            { sx: frameX + lbBorder,          sy: frameY,                     sw: frameW-lbBorder*2, sh: lbBorder,          dx: -btnW/2 + lbBorder,  dy: -btnH/2,             dw: midW,     dh: lbBorder },
            { sx: frameX + frameW - lbBorder, sy: frameY,                     sw: lbBorder,          sh: lbBorder,          dx: btnW/2 - lbBorder,   dy: -btnH/2,             dw: lbBorder, dh: lbBorder },
            { sx: frameX,                     sy: frameY + lbBorder,          sw: lbBorder,          sh: frameH-lbBorder*2, dx: -btnW/2,             dy: -btnH/2 + lbBorder,  dw: lbBorder, dh: midH     },
            { sx: frameX + lbBorder,          sy: frameY + lbBorder,          sw: frameW-lbBorder*2, sh: frameH-lbBorder*2, dx: -btnW/2 + lbBorder,  dy: -btnH/2 + lbBorder,  dw: midW,     dh: midH     },
            { sx: frameX + frameW - lbBorder, sy: frameY + lbBorder,          sw: lbBorder,          sh: frameH-lbBorder*2, dx: btnW/2 - lbBorder,   dy: -btnH/2 + lbBorder,  dw: lbBorder, dh: midH     },
            { sx: frameX,                     sy: frameY + frameH - lbBorder, sw: lbBorder,          sh: lbBorder,          dx: -btnW/2,             dy: btnH/2 - lbBorder,   dw: lbBorder, dh: lbBorder },
            { sx: frameX + lbBorder,          sy: frameY + frameH - lbBorder, sw: frameW-lbBorder*2, sh: lbBorder,          dx: -btnW/2 + lbBorder,  dy: btnH/2 - lbBorder,   dw: midW,     dh: lbBorder },
            { sx: frameX + frameW - lbBorder, sy: frameY + frameH - lbBorder, sw: lbBorder,          sh: lbBorder,          dx: btnW/2 - lbBorder,   dy: btnH/2 - lbBorder,   dw: lbBorder, dh: lbBorder },
          ];

          const btnContainer = this.add.container(btnCX, btnCY).setScrollFactor(0).setDepth(105);
          const bgPieces = [];
          pieces.forEach((p, i) => {
            const frameKey = `${tag}_p${i}`;
            if (!atlas.has(frameKey)) {
              atlas.add(frameKey, 0, p.sx, p.sy, p.sw, p.sh);
            }
            const bgPiece = this.add.image(p.dx, p.dy, "GJ_GameSheet03", frameKey)
              .setOrigin(0, 0).setDisplaySize(p.dw, p.dh);
            bgPieces.push(bgPiece);
            btnContainer.add(bgPiece);
          });

          const hitZone = this.add.zone(0, 0, btnW, btnH).setInteractive();
          btnContainer.add(hitZone);

          const qsLabels = [
            ["Downloads", "Likes",    "Sent"   ],
            ["Trending",  "Recent",   "Magic"  ],
            ["Awarded",   "Followed", "Friends"],
          ];
          const qsIcons = [
            ["GJ_sDownloadIcon_001.png", "GJ_sLikeIcon_001.png",    "GJ_sModIcon_001.png"    ],
            ["GJ_sTrendingIcon_001.png", "GJ_sRecentIcon_001.png",   "GJ_sMagicIcon_001.png"  ],
            ["GJ_sStarsIcon_001.png",    "GJ_sFollowedIcon_001.png", "GJ_sFriendsIcon_001.png"],
          ];
          const labelStr  = qsLabels[row][col];
          const iconFrame = qsIcons[row][col];
          const fontSize  = labelStr === "Downloads" ? 26 : 32;

          const iconSize  = btnH * 0.54;
          const gap = 10;
          const tmpLbl = this.add.bitmapText(0, -9999, "bigFont", labelStr, fontSize).setOrigin(0, 0.5);
          const measuredW = tmpLbl.width;
          tmpLbl.destroy();

          const groupW    = measuredW + gap + iconSize;
          const groupLeft = -groupW / 2;

          const lbl = this.add.bitmapText(groupLeft, -1, "bigFont", labelStr, fontSize)
            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(106);
          btnContainer.add(lbl);

          const qsIconSizes = {
            "GJ_sDownloadIcon_001.png": { w: 30, h: 30, scale: 1 },
            "GJ_sLikeIcon_001.png":     { w: 31, h: 37, scale: 1 },
            "GJ_sModIcon_001.png":      { w: 31, h: 31, scale: 1 },
            "GJ_sTrendingIcon_001.png": { w: 33, h: 25, scale: 1 },
            "GJ_sRecentIcon_001.png":   { w: 31, h: 29, scale: 1 },
            "GJ_sMagicIcon_001.png":    { w: 33, h: 30, scale: 1 },
            "GJ_sStarsIcon_001.png":    { w: 30, h: 29, scale: 1 },
            "GJ_sFollowedIcon_001.png": { w: 31, h: 29, scale: 1 },
            "GJ_sFriendsIcon_001.png":  { w: 35, h: 29, scale: 1 },
          };
          const iconConfig = qsIconSizes[iconFrame];
          const iconScale = iconConfig.scale;
          const iconW     = iconConfig.w * iconScale;
          const iconH     = iconConfig.h * iconScale;
          const iconCX    = groupLeft + measuredW + gap + iconW / 2 + 5;
          const iconY     = iconFrame === "GJ_sLikeIcon_001.png" ? 2 : (labelStr === "Downloads" ? -2 : -1);
          const icon = this.add.image(iconCX, iconY, "GJ_GameSheet03", iconFrame)
            .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(106)
            .setScale(iconScale);
          btnContainer.add(icon);
          const buttonTypes = {
            "Downloads": 1,
            "Likes": 2,
            "Trending": 3,
            "Recent": 4,
            "Magic": 7,
            "Awarded": 11,
          };
          const type = buttonTypes[labelStr];
          if (!type) {
            const disabledTint = 0x666666;
            lbl.setTint(disabledTint);
            icon.setTint(disabledTint);
            bgPieces.forEach(p => p.setTint(disabledTint));
          }
          if (type) {
            const baseScale = 1;
            const pressedScale = baseScale * 1.26;
            hitZone.on("pointerdown", () => {
              hitZone._pressed = true;
              this.tweens.killTweensOf(btnContainer, "scale");
              this.tweens.add({ targets: btnContainer, scale: pressedScale, duration: 300, ease: "Bounce.Out" });
            });
            hitZone.on("pointerout", () => {
              if (hitZone._pressed) {
                hitZone._pressed = false;
                this.tweens.killTweensOf(btnContainer, "scale");
                this.tweens.add({ targets: btnContainer, scale: baseScale, duration: 400, ease: "Bounce.Out" });
              }
            });
            hitZone.on("pointerup", () => {
              if (hitZone._pressed) {
                hitZone._pressed = false;
                this.tweens.killTweensOf(btnContainer, "scale");
                btnContainer.setScale(baseScale);
                this._closeSearchMenu(true);
                const searchParams = { type };
                const diffParam = _getActiveDiffParam();
                if (diffParam) {
                  searchParams.diff = diffParam;
                  const demonIcon = this._diffFilterIcons && this._diffFilterIcons[6];
                  if (demonIcon && demonIcon._diffFilterActive && this._selectedDemonTier) {
                    searchParams.demonFilter = this._selectedDemonTier;
                  }
                }
                this._openOnlineLevelsScene(searchParams);
              }
            });
          } else {
            this._makeBouncyButton(hitZone, 1, () => {});
          }
          this._searchOverlayObjects.push(btnContainer);
        }
      }
      const filtersLabelY  = qsPanelY + qsPanelH + 24;
      const filtersPanelY  = filtersLabelY + 20;
      const filtersPanelH  = sh * 0.16;
      const filtersLabel   = this.add.bitmapText(sw / 2, filtersLabelY, "bigFont", "Filters", labelSize)
        .setScrollFactor(0).setDepth(105).setOrigin(0.5, 0.5).setTint(labelColor);

      gfx.fillStyle(filtersPanelColor, panelAlpha);
      gfx.fillRoundedRect(panelLeft, filtersPanelY, panelW, filtersPanelH, panelRadius);
      const _diffFilterFrames = [
        "difficulty_00_btn_001.png", "difficulty_01_btn_001.png", "difficulty_02_btn_001.png",
        "difficulty_03_btn_001.png", "difficulty_04_btn_001.png", "difficulty_05_btn_001.png",
        "difficulty_06_btn_001.png", "difficulty_auto_btn_001.png"
      ];
      const _diffFilterCount = _diffFilterFrames.length;
      const _diffFilterSlotW = panelW / _diffFilterCount;
      const _diffFilterIconY = filtersPanelY + filtersPanelH / 2;
      this._diffFilterIcons = [];
      const _diffFilterInactiveTint = 0x666666;
      const _diffFilterBaseScale = 0.85;
      const _diffFilterPressScale = 1;
      const _diffFilterExclusiveIdx = [0, 6, 7];
      _diffFilterFrames.forEach((frame, i) => {
        const cx = panelLeft + _diffFilterSlotW * i + _diffFilterSlotW / 2;
        const icon = this.add.image(cx, _diffFilterIconY, "GJ_GameSheet03", frame)
          .setScrollFactor(0).setDepth(105).setOrigin(0.5)
          .setScale(_diffFilterBaseScale)
          .setInteractive()
          .setTint(_diffFilterInactiveTint);
        icon._diffFilterActive = false;
        icon._diffFilterExclusive = _diffFilterExclusiveIdx.includes(i);
        this._diffFilterIcons.push(icon);

        icon.on("pointerdown", () => {
          icon._pressed = true;
          this.tweens.killTweensOf(icon, "scale");
          this.tweens.add({ targets: icon, scale: _diffFilterPressScale, duration: 300, ease: "Bounce.Out" });
        });
        icon.on("pointerout", () => {
          if (icon._pressed) {
            icon._pressed = false;
            this.tweens.killTweensOf(icon, "scale");
            this.tweens.add({ targets: icon, scale: _diffFilterBaseScale, duration: 400, ease: "Bounce.Out" });
          }
        });
        icon.on("pointerup", () => {
          if (!icon._pressed) return;
          icon._pressed = false;
          this.tweens.killTweensOf(icon, "scale");
          icon.setScale(_diffFilterBaseScale);
          const wasActive = icon._diffFilterActive;
          if (icon._diffFilterExclusive) {
            this._diffFilterIcons.forEach(other => {
              other.setTint(_diffFilterInactiveTint);
              other._diffFilterActive = false;
            });
            if (!wasActive) {
              icon.clearTint();
              icon._diffFilterActive = true;
            }
          } else {
            this._diffFilterIcons.forEach(other => {
              if (other._diffFilterExclusive && other._diffFilterActive) {
                other.setTint(_diffFilterInactiveTint);
                other._diffFilterActive = false;
              }
            });
            if (wasActive) {
              icon.setTint(_diffFilterInactiveTint);
              icon._diffFilterActive = false;
            } else {
              icon.clearTint();
              icon._diffFilterActive = true;
            }
          }
          this._refreshDemonFilterPlus();
        });
        this._searchOverlayObjects.push(icon);
      });
      const _demonPlusX = panelRight + 42;
      const _demonPlusY = filtersPanelY + filtersPanelH / 2;
      const demonPlusBtn = this.add.image(_demonPlusX, _demonPlusY, "GJ_GameSheet03", "GJ_plus2Btn_001.png")
        .setScrollFactor(0).setDepth(105).setOrigin(0.5)
        .setInteractive().setVisible(false);
      this._demonFilterPlusBtn = demonPlusBtn;
      this._makeBouncyButton(demonPlusBtn, 1, () => { this._buildDemonFilterPopup(); }, () => demonPlusBtn.visible);
      this._searchOverlayObjects.push(demonPlusBtn);

      this._refreshDemonFilterPlus = () => {
        const demonIcon = this._diffFilterIcons[6];
        if (demonPlusBtn && demonPlusBtn.scene) {
          demonPlusBtn.setVisible(!!(demonIcon && demonIcon._diffFilterActive));
        }
      };
      this._refreshDemonFilterPlus();

      const extraPanelY  = filtersPanelY + filtersPanelH + 18;
      const extraPanelH  = sh * 0.11;
      gfx.fillStyle(extraPanelColor, panelAlpha);
      gfx.fillRoundedRect(panelLeft, extraPanelY, panelW, extraPanelH, panelRadius);

      const extraComingSoon = this.add.bitmapText(sw / 2, extraPanelY + extraPanelH / 2, "bigFont", "Coming Soon!", 42)
        .setScrollFactor(0).setDepth(105).setOrigin(0.5, 0.5).setTint(0xadd8e6).setAlpha(0.75);

      this._searchOverlayObjects.push(gfx, qsLabel, filtersLabel, cornerBR, cornerBL,
        placeholderLabel, typedLabel, inputCursor, inputHitZone, innerBtn1, innerBtn2, innerBtn3,
        extraComingSoon);

      let _loading = false;
      const _diffFilterCodeMap = [-1, 1, 2, 3, 4, 5, -2, -3];
      const _getActiveDiffParam = () => {
        const icons = this._diffFilterIcons || [];
        const activeCodes = [];
        icons.forEach((icon, idx) => {
          if (icon._diffFilterActive) activeCodes.push(_diffFilterCodeMap[idx]);
        });
        return activeCodes.length ? activeCodes.join(",") : null;
      };
      const _doSearch = async () => {
        if (_loading) return;
        const rawInput = htmlInput.value.trim();
        if (rawInput && /^\d+$/.test(rawInput)) {
          const levelId = rawInput;
          _loading = true;
          try {
            await _doSearchInner(levelId);
          } catch (err) {
          } finally {
            _loading = false;
          }
          return;
        }
        htmlInput.remove();
        window.removeEventListener("resize", _repositionInput);
        this._closeSearchMenu(true);
        const diffParam = _getActiveDiffParam();
        const searchParams = rawInput ? { type: 0, str: rawInput } : { type: 2 };
        if (diffParam) {
          searchParams.diff = diffParam;
          const demonIcon = this._diffFilterIcons && this._diffFilterIcons[6];
          if (demonIcon && demonIcon._diffFilterActive && this._selectedDemonTier) {
            searchParams.demonFilter = this._selectedDemonTier;
          }
        }
        this._openOnlineLevelsScene(searchParams);
      };
      const _doSearchInner = async (levelId) => {
        const formBody = `levelID=${levelId}&secret=Wmfd2893gb7`;
        const res = await window.fetchGdApi('/downloadGJLevel22.php', {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody
        });
        if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
        const rawResponse = await res.text();
        if (!rawResponse || rawResponse === "-1" || !rawResponse.includes(":")) {
          return;
        }

        const responseSegments = rawResponse.split("#");
        const lvlParts = responseSegments[0].split(":");
        const lvlMap = {};
        for (let i = 0; i + 1 < lvlParts.length; i += 2) {
          lvlMap[lvlParts[i]] = lvlParts[i + 1];
        }

        const levelData = {
          // Core Level Info
          id:             lvlMap["1"] || levelId,
          title:          (lvlMap["2"] || "Online Level").trim(),
          description:    lvlMap["3"] ? atob(lvlMap["3"].replace(/-/g, '+').replace(/_/g, '/')) : "", // Base64 decoded
          string:         lvlMap["4"] || null, // The raw level data string
          version:        parseInt(lvlMap["5"]) || 1,
          
          // User / Author Info
          playerID:       lvlMap["6"] || null,
          accountID:      lvlMap["57"] || null, // The author's accountID returned by the server

          // Song Info
          officialSong:   lvlMap["12"] || "0",
          customSongID:   (lvlMap["35"] || "").trim(),
          isCustomSong:   !!(lvlMap["35"] || "").trim() && (lvlMap["35"] || "").trim() !== "0",
          isLibrarySong:  !!(lvlMap["35"] || "").trim() && (lvlMap["35"] || "").trim() !== "0" && parseInt((lvlMap["35"] || "").trim()) >= 1000000,
          offset:         parseFloat(lvlMap["45"] || "0") || 0,

          // Gameplay Details
          difficulty:     (() => {
            const isDemon = parseInt(lvlMap["17"]) === 1;
            const isAuto  = parseInt(lvlMap["25"]) === 1;
            if (isAuto) return 11;
            if (isDemon) {
              const d9 = parseInt(lvlMap["9"]);
              const d43 = parseInt(lvlMap["43"]);
              if (!isNaN(d9) && d9 >= 1 && d9 <= 5) {
                return [7, 8, 6, 9, 10][d9 - 1] ?? 8;
              } else if (!isNaN(d43)) {
                const demonMap43 = { 3: 7, 4: 8, 0: 6, 5: 9, 6: 10 };
                return demonMap43.hasOwnProperty(d43) ? demonMap43[d43] : 8;
              }
              return 8;
            }
            return Math.min(5, Math.max(0, Math.round((parseInt(lvlMap["9"]) || 0) / 10)));
          })(), // Auto, Easy, Normal, Hard, Harder, Insane, Demons
          stars:          parseInt(lvlMap["18"]) || 0,
          diamonds:       parseInt(lvlMap["46"]) || 0,
          orbs:           parseInt(lvlMap["48"]) || 0,
          length:         parseInt(lvlMap["15"]) || 0, // 0=Tiny, 1=Small, 2=Medium, 3=Long, 4=XL, 5=Platformer
          featured:       (parseInt(lvlMap["19"]) || 0) > 0, // Featured score > 0 means the level is Featured
          epic:           parseInt(lvlMap["42"]) || 0, // 0=Original/Featured (see 'featured' flag), 1=Epic, 2=Mythic, 3+=Legendary
          gameVersion:    parseInt(lvlMap["13"]) || 22, // The game version the level was created in (e.g. 22 = 2.2)
          binaryVersion:  parseInt(lvlMap["52"]) || 0,  // The build version used to upload

          // Meta / Social Counters
          downloads:      parseInt(lvlMap["10"]) || 0,
          likes:          parseInt(lvlMap["14"]) || 0,
          objects:        parseInt(lvlMap["45"]) || 0, // Object count (Note: 45 can double as audio offset or object count depending on context)
          ts:             lvlMap["28"] || null, // Upload/Update timestamp hint
          
          // Technical / Security Verification keys sent back by server
          chk:            lvlMap["chk"] || null,
          rs:             lvlMap["rs"] || null
        };
        console.groupCollapsed("level data");
        const { string, ...tableFriendlyData } = levelData;
        console.table(tableFriendlyData);
        console.groupEnd();

        let authorName = "Unknown";
        let songNameForCell = levelData.isCustomSong
          ? ("Song #" + levelData.customSongID)
          : (window.allLevels && window.allLevels[levelData.officialSong] ? window.allLevels[levelData.officialSong][1] : "Unknown");
        try {
          const infoRes = await fetch(`https://gdbrowser.com/api/level/${levelData.id}`, {signal:AbortSignal.timeout(1200)});
          if (infoRes.ok) {
            const infoData = await infoRes.json();
            if (infoData) {
              if (infoData.author) authorName = infoData.author;
              if (infoData.songName) songNameForCell = infoData.songName;
            }
          }
        } catch (_e) {}

        const cellData = {
          ...levelData,
          name: levelData.title,
          author: authorName,
          songName: songNameForCell
        };

        htmlInput.remove();
        window.removeEventListener("resize", _repositionInput);
        this._closeSearchMenu(true);
        this._openSearchResultScene(cellData);
      };
      this._searchOverlayObjects.push(overlay, blocker, backBtn);
      if (window.levelID && !window.alreadydownloaded) { // if there's an ID parameter, load it directly
        window.alreadydownloaded = true;
        htmlInput.remove();
        const loadingBg = this.add.graphics().setScrollFactor(0).setDepth(1000);
        loadingBg.fillStyle(0x000000, 1);
        loadingBg.fillRect(0, 0, sw, sh);
        const loadingText = this.add.bitmapText(sw / 2, sh / 2, "bigFont", "Loading level...", 30)
          .setScrollFactor(0).setDepth(1001).setOrigin(0.5);
        this._searchOverlayObjects.push(loadingBg, loadingText);
        _doSearchInner(window.levelID);
      }
      this._searchHtmlInput = htmlInput;
      this._searchInputResizeFn = _repositionInput;
    };
    this._closeSearchMenu = (silent = false, onComplete = null) => {
      if (!this._searchOverlay) return;
      if (this._searchHtmlInput) {
        this._searchHtmlInput.remove();
        this._searchHtmlInput = null;
      }
      if (this._searchInputResizeFn) {
        window.removeEventListener("resize", this._searchInputResizeFn);
        this._searchInputResizeFn = null;
      }
      const destroy = () => {
        for (const obj of this._searchOverlayObjects) {
          if (obj && obj.destroy) obj.destroy();
        }
        this._searchOverlayObjects = [];
        this._searchOverlay = null;
      };
      if (silent) { destroy(); if (onComplete) onComplete(); return; }
      const sw = screenWidth, sh = screenHeight;
      const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(200).setAlpha(0);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, sw, sh);
      this.tweens.add({
        targets: fadeOut, alpha: 1, duration: 150, ease: "Linear",
        onComplete: () => {
          destroy();
          if (onComplete) onComplete();
          this.tweens.add({ targets: fadeOut, alpha: 0, duration: 150, ease: "Linear", onComplete: () => fadeOut.destroy() });
        }
      });
    };
    this._makeBouncyButton(this._creatorBtn, 1, () => {
      this._openCreatorMenu();
    }, () => this._menuActive && !this._levelSelectOverlay);
      //icon stufff
    this._iconBtn = this.add.image(0, 0, "GJ_GameSheet03", "GJ_garageBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive().setScale(1);
    this._iconBtnSelected = false;
    this._makeBouncyButton(this._iconBtn, 1, () => {
      this._openIconSelector();
    }, () => this._menuActive && !this._levelSelectOverlay);

    this._iconOverlay = null;

    const _iconFrameSets = {
      icon: [
"player_01_001.png", "player_02_001.png", "player_03_001.png", "player_04_001.png", "player_05_001.png", "player_06_001.png", "player_07_001.png", "player_08_001.png", "player_09_001.png", "player_10_001.png",
"player_11_001.png", "player_12_001.png", "player_13_001.png", "player_14_001.png", "player_15_001.png", "player_16_001.png", "player_17_001.png", "player_18_001.png", "player_19_001.png", "player_20_001.png",
"player_21_001.png", "player_22_001.png", "player_23_001.png", "player_24_001.png", "player_25_001.png", "player_26_001.png", "player_27_001.png", "player_28_001.png", "player_29_001.png", "player_30_001.png",
"player_31_001.png", "player_32_001.png", "player_33_001.png", "player_34_001.png", "player_35_001.png", "player_36_001.png", "player_37_001.png", "player_38_001.png", "player_39_001.png", "player_40_001.png",
"player_41_001.png", "player_42_001.png", "player_43_001.png", "player_44_001.png", "player_45_001.png", "player_46_001.png", "player_47_001.png", "player_48_001.png", "player_49_001.png", "player_50_001.png",
"player_51_001.png", "player_52_001.png", "player_53_001.png", "player_54_001.png", "player_55_001.png", "player_56_001.png", "player_57_001.png", "player_58_001.png", "player_59_001.png", "player_60_001.png",
"player_61_001.png", "player_62_001.png", "player_63_001.png", "player_64_001.png", "player_65_001.png", "player_66_001.png", "player_67_001.png", "player_68_001.png", "player_69_001.png", "player_70_001.png",
"player_71_001.png", "player_72_001.png", "player_73_001.png", "player_74_001.png", "player_75_001.png", "player_76_001.png", "player_77_001.png", "player_78_001.png", "player_79_001.png", "player_80_001.png",
"player_81_001.png", "player_82_001.png", "player_83_001.png", "player_84_001.png", "player_85_001.png", "player_86_001.png", "player_87_001.png", "player_88_001.png", "player_89_001.png", "player_90_001.png",
"player_91_001.png", "player_92_001.png", "player_93_001.png", "player_94_001.png", "player_95_001.png", "player_96_001.png", "player_97_001.png", "player_98_001.png", "player_99_001.png", "player_100_001.png",
"player_101_001.png", "player_102_001.png", "player_103_001.png", "player_104_001.png", "player_105_001.png", "player_106_001.png", "player_107_001.png", "player_108_001.png", "player_109_001.png", "player_110_001.png",
"player_111_001.png", "player_112_001.png", "player_113_001.png", "player_114_001.png", "player_115_001.png", "player_116_001.png", "player_117_001.png", "player_118_001.png", "player_119_001.png", "player_120_001.png",
"player_121_001.png", "player_122_001.png", "player_123_001.png", "player_124_001.png", "player_125_001.png", "player_126_001.png", "player_127_001.png", "player_128_001.png", "player_129_001.png", "player_130_001.png",
"player_131_001.png", "player_132_001.png", "player_133_001.png", "player_134_001.png", "player_135_001.png", "player_136_001.png", "player_137_001.png", "player_138_001.png", "player_139_001.png", "player_140_001.png",
"player_141_001.png", "player_142_001.png", "player_143_001.png", "player_144_001.png", "player_145_001.png", "player_146_001.png", "player_147_001.png", "player_148_001.png", "player_149_001.png", "player_150_001.png",
"player_151_001.png", "player_152_001.png", "player_153_001.png", "player_154_001.png", "player_155_001.png", "player_156_001.png", "player_157_001.png", "player_158_001.png", "player_159_001.png", "player_160_001.png",
"player_161_001.png", "player_162_001.png", "player_163_001.png", "player_164_001.png", "player_165_001.png", "player_166_001.png", "player_167_001.png", "player_168_001.png", "player_169_001.png", "player_170_001.png",
"player_171_001.png", "player_172_001.png", "player_173_001.png", "player_174_001.png", "player_175_001.png", "player_176_001.png", "player_177_001.png", "player_178_001.png", "player_179_001.png", "player_180_001.png",
"player_181_001.png", "player_182_001.png", "player_183_001.png", "player_184_001.png", "player_185_001.png", "player_186_001.png", "player_187_001.png", "player_188_001.png", "player_189_001.png", "player_190_001.png",
"player_191_001.png", "player_192_001.png",
"player_193_001.png", "player_194_001.png", "player_195_001.png", "player_196_001.png", "player_197_001.png", "player_198_001.png", "player_199_001.png", "player_200_001.png", "player_201_001.png", "player_202_001.png",
"player_203_001.png", "player_204_001.png", "player_205_001.png", "player_206_001.png", "player_207_001.png", "player_208_001.png", "player_209_001.png", "player_210_001.png", "player_211_001.png", "player_212_001.png",
"player_213_001.png", "player_214_001.png", "player_215_001.png", "player_216_001.png", "player_217_001.png", "player_218_001.png", "player_219_001.png", "player_220_001.png", "player_221_001.png", "player_222_001.png",
"player_223_001.png", "player_224_001.png", "player_225_001.png", "player_226_001.png", "player_227_001.png", "player_228_001.png", "player_229_001.png", "player_230_001.png", "player_231_001.png", "player_232_001.png",
"player_233_001.png", "player_234_001.png", "player_235_001.png", "player_236_001.png", "player_237_001.png", "player_238_001.png", "player_239_001.png", "player_240_001.png", "player_241_001.png", "player_242_001.png",
"player_243_001.png", "player_244_001.png", "player_245_001.png", "player_246_001.png", "player_247_001.png", "player_248_001.png"
      ],
      ship: [
        "ship_01_001.png", "ship_02_001.png", "ship_03_001.png", "ship_04_001.png", "ship_05_001.png", "ship_06_001.png", "ship_07_001.png", "ship_08_001.png", "ship_09_001.png", "ship_10_001.png",
"ship_11_001.png", "ship_12_001.png", "ship_13_001.png", "ship_14_001.png", "ship_15_001.png", "ship_16_001.png", "ship_17_001.png", "ship_18_001.png", "ship_19_001.png", "ship_20_001.png",
"ship_21_001.png", "ship_22_001.png", "ship_23_001.png", "ship_24_001.png", "ship_25_001.png", "ship_26_001.png", "ship_27_001.png", "ship_28_001.png", "ship_29_001.png", "ship_30_001.png",
"ship_31_001.png", "ship_32_001.png", "ship_33_001.png", "ship_34_001.png", "ship_35_001.png", "ship_36_001.png", "ship_37_001.png", "ship_38_001.png", "ship_39_001.png", "ship_40_001.png",
"ship_41_001.png", "ship_42_001.png", "ship_43_001.png", "ship_44_001.png", "ship_45_001.png", "ship_46_001.png", "ship_47_001.png", "ship_48_001.png", "ship_49_001.png", "ship_50_001.png",
"ship_51_001.png", "ship_52_001.png", "ship_53_001.png", "ship_54_001.png", "ship_55_001.png", "ship_56_001.png", "ship_57_001.png", "ship_58_001.png", "ship_59_001.png", "ship_60_001.png",
"ship_61_001.png", "ship_62_001.png", "ship_63_001.png", "ship_64_001.png", "ship_65_001.png", "ship_66_001.png", "ship_67_001.png", "ship_68_001.png", "ship_69_001.png", "ship_70_001.png",
"ship_71_001.png", "ship_72_001.png", "ship_73_001.png", "ship_74_001.png", "ship_75_001.png", "ship_76_001.png", "ship_77_001.png", "ship_78_001.png", "ship_79_001.png"
      ],
      ball: [
        "player_ball_01_001.png", "player_ball_02_001.png", "player_ball_03_001.png", "player_ball_04_001.png", "player_ball_05_001.png", "player_ball_06_001.png", "player_ball_07_001.png", "player_ball_08_001.png", "player_ball_09_001.png", "player_ball_10_001.png",
        "player_ball_11_001.png", "player_ball_12_001.png", "player_ball_13_001.png", "player_ball_14_001.png", "player_ball_15_001.png", "player_ball_16_001.png", "player_ball_17_001.png", "player_ball_18_001.png", "player_ball_19_001.png", "player_ball_20_001.png",
        "player_ball_21_001.png", "player_ball_22_001.png", "player_ball_23_001.png", "player_ball_24_001.png", "player_ball_25_001.png", "player_ball_26_001.png", "player_ball_27_001.png", "player_ball_28_001.png", "player_ball_29_001.png", "player_ball_30_001.png",

        "player_ball_31_001.png", "player_ball_32_001.png", "player_ball_33_001.png", "player_ball_34_001.png", "player_ball_35_001.png", "player_ball_36_001.png", "player_ball_37_001.png", "player_ball_38_001.png", "player_ball_39_001.png", "player_ball_40_001.png",
        "player_ball_41_001.png", "player_ball_42_001.png", "player_ball_43_001.png", "player_ball_44_001.png", "player_ball_45_001.png", "player_ball_46_001.png", "player_ball_47_001.png", "player_ball_48_001.png", "player_ball_49_001.png", "player_ball_50_001.png",
        "player_ball_51_001.png", "player_ball_52_001.png",
      ],
      wave: [
        "dart_01_001.png", "dart_02_001.png", "dart_03_001.png", "dart_04_001.png", "dart_05_001.png",
        "dart_06_001.png", "dart_07_001.png", "dart_08_001.png", "dart_09_001.png", "dart_10_001.png",
        "dart_11_001.png", "dart_12_001.png", "dart_13_001.png", "dart_14_001.png", "dart_15_001.png",
        "dart_16_001.png", "dart_17_001.png", "dart_18_001.png", "dart_19_001.png", "dart_20_001.png",
        "dart_21_001.png", "dart_22_001.png", "dart_23_001.png", "dart_24_001.png", "dart_25_001.png",
        "dart_26_001.png", "dart_27_001.png", "dart_28_001.png", "dart_29_001.png", "dart_30_001.png",
        "dart_31_001.png", "dart_32_001.png", "dart_33_001.png", "dart_34_001.png", "dart_35_001.png",
      ],
      ufo: [
        "bird_01_001.png", "bird_02_001.png", "bird_03_001.png", "bird_04_001.png", "bird_05_001.png",
        "bird_06_001.png", "bird_07_001.png", "bird_08_001.png", "bird_09_001.png", "bird_10_001.png",
        "bird_11_001.png", "bird_12_001.png", "bird_13_001.png", "bird_14_001.png", "bird_15_001.png",
        "bird_16_001.png", "bird_17_001.png", "bird_18_001.png", "bird_19_001.png", "bird_20_001.png",
        "bird_21_001.png", "bird_22_001.png", "bird_23_001.png", "bird_24_001.png", "bird_25_001.png",
        "bird_26_001.png", "bird_27_001.png", "bird_28_001.png", "bird_29_001.png", "bird_30_001.png",
        "bird_31_001.png", "bird_32_001.png", "bird_33_001.png", "bird_34_001.png", "bird_35_001.png",
        "bird_36_001.png", "bird_37_001.png", "bird_38_001.png", "bird_39_001.png", "bird_40_001.png",
        "bird_41_001.png", "bird_42_001.png", "bird_43_001.png", "bird_44_001.png", "bird_45_001.png",
        "bird_46_001.png", "bird_47_001.png", "bird_48_001.png", "bird_49_001.png", "bird_50_001.png",
        "bird_51_001.png",
      ],
    };


    const _selectorParseAnimPair = (value, fallbackX = 0, fallbackY = 0) => {
      const match = String(value ?? "").match(/\{\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\}/);
      if (!match) return { x: fallbackX, y: fallbackY };
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      return {
        x: Number.isFinite(x) ? x : fallbackX,
        y: Number.isFinite(y) ? y : fallbackY
      };
    };

    const _selectorVariantFrameName = (frameName, variant) => {
      if (!frameName) return frameName;
      if (variant === "glow") return frameName.replace(/_001\.png$/, "_glow_001.png");
      if (variant === "overlay") return frameName.replace(/_001\.png$/, "_2_001.png");
      if (variant === "extra") return frameName.replace(/_001\.png$/, "_extra_001.png");
      return frameName;
    };

    const _segmentedIconConfig = {
      spider: {
        prop: "currentSpider",
        prefix: "spider",
        descKey: "Spider_AnimDesc",
        fallbackBase: "spider_01",
        idlePatterns: [/^Spider_idle01_001\.png$/, /^Spider_idle01_\d+\.png$/, /^Spider_idle02_\d+\.png$/, /^Spider_idle_\d+\.png$/, /^Spider_walk_\d+\.png$/],
        defaultEntries: [
          { tag: "0", texture: "spider_01_02_001.png" },
          { tag: "1", texture: "spider_01_02_001.png" },
          { tag: "2", texture: "spider_01_04_001.png" },
          { tag: "3", texture: "spider_01_01_001.png" },
          { tag: "4", texture: "spider_01_03_001.png" },
          { tag: "5", texture: "spider_01_02_001.png" }
        ]
      },
      robot: {
        prop: "currentRobot",
        prefix: "robot",
        descKey: "Robot_AnimDesc",
        fallbackBase: "robot_01",
        idlePatterns: [/^Robot_idle_001\.png$/, /^Robot_idle_\d+\.png$/, /^Robot_idle01_\d+\.png$/, /^Robot_idle02_\d+\.png$/, /^Robot_run_001\.png$/, /^Robot_run_\d+\.png$/],
        defaultEntries: [
          { tag: "0", texture: "robot_01_03_001.png" },
          { tag: "1", texture: "robot_01_02_001.png" },
          { tag: "2", texture: "robot_01_04_001.png" },
          { tag: "3", texture: "robot_01_01_001.png" },
          { tag: "4", texture: "robot_01_03_001.png" },
          { tag: "5", texture: "robot_01_02_001.png" },
          { tag: "6", texture: "robot_01_04_001.png" }
        ]
      }
    };

    const _isSegmentedIconTab = (tab) => !!_segmentedIconConfig[tab];

    const _getSegmentedAnimDesc = (tab) => {
      const cfg = _segmentedIconConfig[tab];
      if (!cfg) return null;
      let data = null;
      try { data = this.cache?.json?.get?.(cfg.descKey) || null; } catch (e) { data = null; }
      if (!data && typeof window !== "undefined") data = window[cfg.descKey] || null;
      return data && data.animationContainer ? data : null;
    };

    const _getSegmentedIdleFrame = (tab) => {
      const cfg = _segmentedIconConfig[tab];
      const desc = _getSegmentedAnimDesc(tab);
      if (!cfg || !desc?.animationContainer) return null;
      const keys = Object.keys(desc.animationContainer).sort((a, b) => {
        const aa = parseInt((String(a).match(/_(\d+)\.png$/) || [0, 0])[1], 10) || 0;
        const bb = parseInt((String(b).match(/_(\d+)\.png$/) || [0, 0])[1], 10) || 0;
        return aa - bb;
      });
      for (const pattern of cfg.idlePatterns) {
        const match = keys.find(key => pattern.test(key));
        if (match) return desc.animationContainer[match];
      }
      return desc.animationContainer[keys[0]] || null;
    };

    const _replaceSegmentedBase = (tab, textureName, baseName) => {
      const cfg = _segmentedIconConfig[tab];
      if (!cfg) return textureName;
      return String(textureName || "").replace(new RegExp("^" + cfg.prefix + "_\\d+"), baseName);
    };

    const _makeSegmentedIconFrames = (tab, max = 120) => {
      const cfg = _segmentedIconConfig[tab];
      if (!cfg) return [];
      const desc = _getSegmentedAnimDesc(tab);
      const entries = desc?.usedTextures
        ? Object.values(desc.usedTextures).slice().sort((a, b) => (parseInt(a.tag || "0", 10) || 0) - (parseInt(b.tag || "0", 10) || 0))
        : cfg.defaultEntries;
      const frames = [];
      for (let i = 1; i <= max; i++) {
        const baseName = `${cfg.prefix}_${String(i).padStart(2, "0")}`;
        const hasAnyPart = entries.some(entry => {
          const frameName = _replaceSegmentedBase(tab, entry.texture, baseName);
          return typeof getAtlasFrame === "function" && !!getAtlasFrame(this, frameName);
        });
        if (hasAnyPart) frames.push(`${baseName}_001.png`);
      }
      return frames.length ? frames : [`${cfg.fallbackBase}_001.png`];
    };

    window.currentSpider = window.currentSpider || localStorage.getItem("iconCurrentSpider") || "spider_01";
    window.currentRobot = window.currentRobot || localStorage.getItem("iconCurrentRobot") || "robot_01";
    _iconFrameSets.spider = _makeSegmentedIconFrames("spider");
    _iconFrameSets.robot = _makeSegmentedIconFrames("robot");


    const _iconWindowProps = {
      icon: "currentPlayer",
      ship: "currentShip",
      ball: "currentBall",
      wave: "currentWave",
      ufo: "currentBird",
      robot: "currentRobot",
      spider: "currentSpider",
    };

    const _iconAtlas = {
      icon: "GJ_GameSheetIcons",
      ship: "GJ_GameSheetIcons",
      ball: "GJ_GameSheetIcons",
      wave: "GJ_GameSheetIcons",
      ufo: "GJ_GameSheetIcons",
      robot: "GJ_GameSheetIcons",
      spider: "GJ_GameSheetIcons",
    };

    const _tabBtnFrames = {
      icon: { on: "gj_iconBtn_on_001.png",    off: "gj_iconBtn_off_001.png"    },
      ship: { on: "gj_shipBtn_on_001.png",    off: "gj_shipBtn_off_001.png"    },
      ball: { on: "gj_ballBtn_on_001.png",    off: "gj_ballBtn_off_001.png"    },
      wave: { on: "gj_dartBtn_on_001.png",    off: "gj_dartBtn_off_001.png"    },
      ufo:  { on: "gj_birdBtn_on_001.png",    off: "gj_birdBtn_off_001.png"    },
      robot:{ on: "gj_robotBtn_on_001.png",   off: "gj_robotBtn_off_001.png"   },
      spider:{ on: "gj_spiderBtn_on_001.png", off: "gj_spiderBtn_off_001.png" },
    };

    const _safeTabBtnFrame = (tab, state) => {
      const frame = _tabBtnFrames[tab]?.[state] || _tabBtnFrames.icon[state];
      return (typeof getAtlasFrame === "function" && getAtlasFrame(this, frame)) ? frame : _tabBtnFrames.icon[state];
    };

    this._openIconSelector = (startTab = "icon") => {
      if (this._iconOverlay) return;

      const sw = screenWidth;
      const sh = screenHeight;

      const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(200);
      fadeIn.fillStyle(0x000000, 1);
      fadeIn.fillRect(0, 0, sw, sh);
      this.tweens.add({ targets: fadeIn, alpha: 0, duration: 300, ease: "Linear", onComplete: () => fadeIn.destroy() });

      const overlay = this.add.graphics().setScrollFactor(0).setDepth(100);
      const gradientSteps = 80;
      for (let gi = 0; gi < gradientSteps; gi++) {
        const t = gi / (gradientSteps - 1);
        const r1 = Math.round(0x92 + (0x3a - 0x92) * t);
        const g1 = Math.round(0x92 + (0x3a - 0x92) * t);
        const b1 = Math.round(0x92 + (0x3a - 0x92) * t);
        const bandColor = (r1 << 16) | (g1 << 8) | b1;
        const bandY = Math.floor(gi * sh / gradientSteps);
        const bandH = Math.ceil(sh / gradientSteps) + 1;
        overlay.fillStyle(bandColor, 1);
        overlay.fillRect(0, bandY, sw, bandH);
      }
      this._iconOverlay = overlay;

      const blocker = this.add.zone(sw / 2, sh / 2, sw, sh)
        .setScrollFactor(0).setDepth(100).setInteractive();

      const titleMaxLength = 20;
      const titleAllowedChars = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
      let titleText = String(localStorage.getItem("playerName") || "Player").replace(/\r|\n/g, "").slice(0, titleMaxLength);
      if (!titleText || titleText.trim() === "") titleText = "Player";

      const titleTxt = this.add.bitmapText(sw / 2, 80, "bigFont", titleText, 50)
        .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(105).setInteractive();
      let titleFocused = false;

      const _updateTitleText = () => {
        const safeTitle = titleText.slice(0, titleMaxLength);
        titleText = safeTitle;
        titleTxt.setText(safeTitle || "");
        localStorage.setItem("playerName", safeTitle || "Player");
      };

      const _focusTitle = () => {
        titleFocused = true;
      };

      const _blurTitle = () => {
        titleFocused = false;
        if (!titleText.trim()) {
          titleText = "Player";
          titleTxt.setText("Player");
          localStorage.setItem("playerName", "Player");
        }
      };

      titleTxt.on("pointerdown", () => _focusTitle());
      blocker.on("pointerdown", () => _blurTitle());

      const _onTitleKeyDown = (event) => {
        if (!titleFocused || !this._iconOverlay) return;
        event.stopPropagation();
        if (event.key === "Backspace") {
          if (titleText.length > 0) {
            titleText = titleText.slice(0, -1);
            _updateTitleText();
          }
        } else if (event.key === "Enter") {
          _blurTitle();
        } else if (event.key.length === 1 && titleAllowedChars.includes(event.key) && !event.ctrlKey && !event.metaKey) {
          if (titleText.length < titleMaxLength) {
            titleText += event.key;
            _updateTitleText();
          }
        }
      };

      window.addEventListener("keydown", _onTitleKeyDown);
      this._iconTitleKeyHandler = _onTitleKeyDown;
      this._iconOverlayObjects = [overlay, blocker, titleTxt];

      const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_03_001.png")
        .setScrollFactor(0).setDepth(104).setFlipY(true)
        .setFlipX(true)
        .setRotation(Math.PI).setInteractive();
      this._iconOverlayObjects.push(backBtn);
      this._makeBouncyButton(backBtn, 1, () => this._closeIconSelector());

      const Pathicon = this.add.image(60, 165, "GJ_GameSheet03", "GJ_shardsBtn_001.png")
        .setScrollFactor(0).setDepth(104).setTint(0x666666)
        .setInteractive();
      this._iconOverlayObjects.push(Pathicon);
      this._makeBouncyButton(Pathicon, 1, () => this.openshardmenu());

      const yourname = this.add.image(670, 15,  "GJ_GameSheet03", "GJ_nameTxt_001.png")
        .setScrollFactor(0).setDepth(100).setOrigin(0, 0);
      this._iconOverlayObjects.push(yourname);

      const topBarHeight = 100;
      const lineY = topBarHeight + 100;
      const linePadding = 230;
      const topBar = this.add.graphics().setScrollFactor(0).setDepth(102);
      const lineSegments = 40;
      const lineStart = linePadding;
      const lineEnd = sw - linePadding;
      const lineWidth = lineEnd - lineStart;
      const fadeZone = lineWidth * 0.25;
      for (let li = 0; li < lineSegments; li++) {
    const t0 = li / lineSegments;
    const t1 = (li + 1) / lineSegments;
    const x0 = lineStart + t0 * lineWidth;
    const x1 = lineStart + t1 * lineWidth;
    const mid = (t0 + t1) / 2 * lineWidth;
    let alpha;
    if (mid < fadeZone) {
      alpha = mid / fadeZone;
    } else if (mid > lineWidth - fadeZone) {
      alpha = (lineWidth - mid) / fadeZone;
    } else {
      alpha = 1;
    }
    topBar.lineStyle(3, 0xFFFFFF, alpha);
    topBar.beginPath();
    topBar.moveTo(x0, lineY);
    topBar.lineTo(x1, lineY);
    topBar.strokePath();
  }
      this._iconOverlayObjects.push(topBar);

      const cols = 12;
      const iconSize = 60;
      const padding = 2;
      const containerPadding = 10;
      const rows = 3;
      const containerWidth  = cols * iconSize + (cols - 1) * padding + 12;
      const containerHeight = rows * iconSize + (rows - 1) * padding + 12;
      const containerX = sw / 2 - containerWidth / 2;
      const containerY = sh - containerHeight - containerPadding - 150;
      const startX = containerX + 6 + iconSize / 2;
      const startY = containerY + 6 + iconSize / 2;

      const gridBg = this.add.graphics().setScrollFactor(0).setDepth(102);
      gridBg.fillStyle(0x454444, 1);
      gridBg.fillRoundedRect(containerX, containerY, containerWidth, containerHeight, 10);
      this._iconOverlayObjects.push(gridBg);

      const cornerTL = this.add.image(0,  0,  "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(100).setOrigin(0, 0).setFlipY(true)
      const cornerTR = this.add.image(sw, 0,  "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(103).setOrigin(1, 0).setFlipY(true).setFlipX(true);
      const cornerBR = this.add.image(sw, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(152).setOrigin(1, 1).setFlipX(true);
      const cornerBL = this.add.image(0, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(152).setOrigin(0, 1);
      this._iconOverlayObjects.push(cornerTL, cornerTR, cornerBR, cornerBL);

      const navDotSpacing = 35;
      const navDotY = containerY + containerHeight + 30;
      const navDot1 = this.add.image(sw / 2 - navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_on_001.png").setScrollFactor(0).setDepth(104).setScale(0.75);
      const navDot2 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75);
      const navDot3 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      const navDot4 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      const navDot5 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      const navDot6 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      const navDot7 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      const navDot8 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      const navDot9 = this.add.image(sw / 2 + navDotSpacing / 2, navDotY, "GJ_GameSheet03", "gj_navDotBtn_off_001.png").setScrollFactor(0).setDepth(104).setScale(0.75).setVisible(false);
      this._iconOverlayObjects.push(navDot1, navDot2, navDot3, navDot4, navDot5, navDot6, navDot7, navDot8, navDot9);
      const _updateNavDots = (page, tab) => {
        const maxPages = Math.max(1, _getMaxPages(tab));
        const dots = [navDot1, navDot2, navDot3, navDot4, navDot5, navDot6, navDot7, navDot8, navDot9];
        dots.forEach(dot => dot.setVisible(false));
        const totalDotsToShow = Math.min(maxPages, dots.length);
        const totalWidth = (totalDotsToShow - 1) * navDotSpacing;
        const dotStartX = sw / 2 - totalWidth / 2;
        for (let i = 0; i < totalDotsToShow; i++) {
          dots[i].setPosition(dotStartX + i * navDotSpacing, navDotY).setVisible(true);
          dots[i].setTexture("GJ_GameSheet03", page === i ? "gj_navDotBtn_on_001.png" : "gj_navDotBtn_off_001.png");
        }
      };

      const rainbowColors = [
        0xFF0000, 0xFF4500, 0xFF7F00, 0xFFAA00, 0xFFD700,
        0xFFFF00, 0xAAFF00, 0x00FF00, 0x00FF7F, 0x00FFFF,
        0x007FFF, 0x0000FF, 0x7F00FF, 0xFF00FF, 0xFF007F,
        0xFFFFFF, 0xC0C0C0, 0x808080, 0x404040, 0x000000,
      ];

      const colorBtnSize = 35;
      const colorPadding = 6;
      const colorRowWidth = rainbowColors.length * (colorBtnSize + colorPadding) - colorPadding;
      const colorRow1Y = containerY + containerHeight + 88;
      const colorRow2Y = colorRow1Y + colorBtnSize + 10;
      const colorRowStartX = sw / 2 - colorRowWidth / 2 + colorBtnSize / 2;

      const colorLabel1 = this.add.text(sw / 2 - colorRowWidth / 2, colorRow1Y - 14, "", {
        fontSize: "11px", color: "#ffffff", fontFamily: "Arial"}).setScrollFactor(0).setDepth(104).setOrigin(0, 0.5).setAlpha(1);
      this._iconOverlayObjects.push(colorLabel1);

      const colorLabel2 = this.add.text(sw / 2 - colorRowWidth / 2, colorRow2Y - 14, "", {
        fontSize: "11px", color: "#ffffff", fontFamily: "Arial"}).setScrollFactor(0).setDepth(104).setOrigin(0, 0.5).setAlpha(1);
      this._iconOverlayObjects.push(colorLabel2);

      const colorBoxWidth = sw;
      const colorBoxHeight = colorBtnSize * 2 + 10 + 20;
      const colorBoxX = 0;
      const colorBoxY = colorRow1Y - colorBtnSize / 2 - 10;
      const colorBox = this.add.graphics().setScrollFactor(0).setDepth(101);
      colorBox.fillStyle(0x000000, 0.5);
      colorBox.fillRect(colorBoxX, colorBoxY, colorBoxWidth, colorBoxHeight);
      this._iconOverlayObjects.push(colorBox);

      const color1SelLabel = this.add.image(0, 0, "GJ_GameSheet03", "GJ_select_001.png").setScrollFactor(0).setDepth(106).setOrigin(0.5, 0.5).setVisible(false).setScale(0.6);
      const color2SelLabel = this.add.image(0, 0, "GJ_GameSheet03", "GJ_select_001.png").setScrollFactor(0).setDepth(106).setOrigin(0.5, 0.5).setVisible(false).setScale(0.6);
      this._iconOverlayObjects.push(color1SelLabel, color2SelLabel);

      const _moveColorSelect = (label, color, rowY) => {
        const idx = rainbowColors.indexOf(color);
        if (idx === -1) {
          label.setVisible(false);
          return;
        }

        label.setPosition(colorRowStartX + idx * (colorBtnSize + colorPadding), rowY).setVisible(true);
      };

      _moveColorSelect(color1SelLabel, window.mainColor, colorRow1Y);
      _moveColorSelect(color2SelLabel, window.secondaryColor, colorRow2Y);

      for (let ci = 0; ci < rainbowColors.length; ci++) {
        const cx = colorRowStartX + ci * (colorBtnSize + colorPadding);

        const btn1AtlasInfo = getAtlasFrame(this, "GJ_colorBtn_001.png");
        let btn1;
        btn1 = this.add.rectangle(cx, colorRow1Y, colorBtnSize, colorBtnSize, rainbowColors[ci]).setScrollFactor(0).setDepth(104).setInteractive();
        this._iconOverlayObjects.push(btn1);

        const btn2AtlasInfo = getAtlasFrame(this, "GJ_colorBtn_001.png");
        let btn2;
        btn2 = this.add.rectangle(cx, colorRow2Y, colorBtnSize, colorBtnSize, rainbowColors[ci]).setScrollFactor(0).setDepth(104).setInteractive();
        this._iconOverlayObjects.push(btn2);

        ((color, b1, b2) => {
          this._makeBouncyButton(b1, 1.0, () => {
            window.mainColor = color;
            localStorage.setItem("iconMainColor", hexadecimalToHex(color));
            _moveColorSelect(color1SelLabel, color, colorRow1Y);
            if (this._player) {
              const safeSetTint = (sprite, color) => {
                if (sprite && sprite.setTint) {
                  try {
                    sprite.setTint(color);
                    if (this.renderer.type === Phaser.CANVAS && sprite.tintTopLeft !== undefined) {
                      if (sprite.tintTopLeft === 0xffffff && color !== 0xffffff) {
                      }
                    }
                  } catch (e) {
                  }
                }
              };
              
              safeSetTint(this._player._playerSpriteLayer?.sprite, color);
              safeSetTint(this._player._shipSpriteLayer?.sprite, color);
              safeSetTint(this._player._ballSpriteLayer?.sprite, color);
              safeSetTint(this._player._waveSpriteLayer?.sprite, color);
              for (const layer of this._player._robotLayers || []) safeSetTint(layer?.sprite, color);
              for (const layer of this._player._spiderLayers || []) safeSetTint(layer?.sprite, color);
              if (this._player._particleEmitter) {
                try {
                  this._player._particleEmitter.tint = color;
                } catch (e) {
                }
              }
            }
            selectedIcon.setTint(color);
            _refreshPreview(_currentTab, _getPreviewFrame(_currentTab));
          });
          this._makeBouncyButton(b2, 1.0, () => {
            window.secondaryColor = color;
            localStorage.setItem("iconSecondaryColor", hexadecimalToHex(color));
            _moveColorSelect(color2SelLabel, color, colorRow2Y);
            if (this._player) {
              const safeSetTint = (sprite, color) => {
                if (sprite && sprite.setTint) {
                  try {
                    sprite.setTint(color);
                  } catch (e) {
                  }
                }
              };
              
              safeSetTint(this._player._playerGlowLayer?.sprite, color);
              safeSetTint(this._player._playerOverlayLayer?.sprite, color);
              safeSetTint(this._player._shipGlowLayer?.sprite, color);
              safeSetTint(this._player._shipOverlayLayer?.sprite, color);
              safeSetTint(this._player._ballGlowLayer?.sprite, color);
              safeSetTint(this._player._ballOverlayLayer?.sprite, color);
              safeSetTint(this._player._waveGlowLayer?.sprite, color);
              safeSetTint(this._player._waveOverlayLayer?.sprite, color);
              for (const layer of this._player._robotLayers || []) safeSetTint(layer?.sprite, color);
              for (const layer of this._player._spiderLayers || []) safeSetTint(layer?.sprite, color);
              if (this._player._streak) {
                try {
                  this._player._streak._color = color;
                } catch (e) {
                }
              }
            }
            selectedIconExtra.setTint(window.secondaryColor);
            _refreshPreview(_currentTab, _getPreviewFrame(_currentTab));
          });
        })(rainbowColors[ci], btn1, btn2);
      }

      const previewY = lineY - 35;
      const selectedIconExtra = this.add.image(sw / 2, previewY, _iconAtlas[startTab], null).setScrollFactor(0).setDepth(102).setVisible(false);
      const selectedIcon = this.add.image(sw / 2, previewY, _iconAtlas[startTab], null).setScrollFactor(0).setDepth(103);
      let selectedSegmentedPreview = null;

      const _destroySegmentedPreview = () => {
        if (selectedSegmentedPreview?.destroy) selectedSegmentedPreview.destroy(true);
        selectedSegmentedPreview = null;
      };

      const _createSegmentedIconComposite = (tab, pseudoFrame, x, y, maxSize, depth, muted = false) => {
        const cfg = _segmentedIconConfig[tab];
        const idleFrame = _getSegmentedIdleFrame(tab);
        if (!cfg || !idleFrame) return null;
        const baseName = String(pseudoFrame || `${cfg.fallbackBase}_001.png`).replace(/_001\.png$/, "");
        const container = this.add.container(x, y).setScrollFactor(0).setDepth(depth);
        const parts = [];
        for (const spriteKey of Object.keys(idleFrame)) {
          if (!spriteKey.startsWith("sprite_")) continue;
          const spriteData = idleFrame[spriteKey];
          const tag = parseInt(spriteData.tag || "0", 10) || 0;
          const pos = _selectorParseAnimPair(spriteData.position, 0, 0);
          const sc = _selectorParseAnimPair(spriteData.scale, 1, 1);
          const fl = _selectorParseAnimPair(spriteData.flipped, 0, 0);
          const zValue = parseFloat(spriteData.zValue || tag || "0") || 0;
          const rotDeg = parseFloat(spriteData.rotation || "0") || 0;
          const sourceTexture = _replaceSegmentedBase(tab, spriteData.texture || `${cfg.fallbackBase}_01_001.png`, baseName);
          const isSpiderLegTag = tab === "spider" && [0, 1, 4, 5].includes(tag);
          const isRobotLegTag = tab === "robot" && [0, 2, 4, 6].includes(tag);
          const isRobotArmTag = tab === "robot" && [1, 5].includes(tag);
          const localYOffset = tab === "spider"
            ? (tag === 3 ? 5 : (isSpiderLegTag ? -9 : 0))
            : (tag === 3 ? 5 : (isRobotArmTag ? -1 : (isRobotLegTag ? -9 : 0)));
          const localXScale = tab === "spider"
            ? (isSpiderLegTag ? 1.8 : 1)
            : ((isRobotLegTag || isRobotArmTag) ? 1.8 : 1);
          const variants = [
            { kind: "base", frame: sourceTexture, tint: muted ? 0xAFAFAF : window.mainColor, z: zValue * 0.1 },
            { kind: "overlay", frame: _selectorVariantFrameName(sourceTexture, "overlay"), tint: muted ? 0xffffff : window.secondaryColor, z: zValue * 0.1 + 0.04 },
            { kind: "extra", frame: _selectorVariantFrameName(sourceTexture, "extra"), tint: null, z: zValue * 0.1 + 0.08 }
          ];
          for (const variant of variants) {
            if (typeof getAtlasFrame !== "function" || !getAtlasFrame(this, variant.frame)) continue;
            const img = this.add.image(pos.x * localXScale, -(pos.y + localYOffset), "GJ_GameSheetIcons", variant.frame);
            img.rotation = rotDeg * Math.PI / 180;
            img.scaleX = sc.x * (fl.x ? -1 : 1);
            img.scaleY = sc.y * (fl.y ? -1 : 1);
            if (variant.tint !== null && variant.tint !== undefined) img.setTint(variant.tint);
            img._selectorZ = variant.z;
            parts.push(img);
          }
        }
        parts.sort((a, b) => (a._selectorZ || 0) - (b._selectorZ || 0));
        parts.forEach(part => container.add(part));
        if (!parts.length) {
          container.destroy(true);
          return null;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const img of parts) {
          const w = Math.abs((img.width || 1) * (img.scaleX || 1));
          const h = Math.abs((img.height || 1) * (img.scaleY || 1));
          minX = Math.min(minX, img.x - w / 2);
          maxX = Math.max(maxX, img.x + w / 2);
          minY = Math.min(minY, img.y - h / 2);
          maxY = Math.max(maxY, img.y + h / 2);
        }
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        const fitScale = muted ? (maxSize / height) : Math.min(maxSize / width, maxSize / height);
        container.setScale(fitScale);
        container._selectorBaseScale = fitScale;
        return container;
      };

      const _getPreviewFrame = (tab) => {
        const prop   = _iconWindowProps[tab];
        const frames = _iconFrameSets[tab] || [];
        const currentValue = String(window[prop] || "");
        const match  = frames.find(f => f.replace("_001.png", "") === currentValue);
        return match || frames[0];
      };

      const _refreshPreview = (tab, frame) => {
        if (_isSegmentedIconTab(tab)) {
          _destroySegmentedPreview();
          selectedIcon.setVisible(false);
          selectedIconExtra.setVisible(false);
          selectedSegmentedPreview = _createSegmentedIconComposite(tab, frame, sw / 2, previewY, 82, 103, false);
          if (selectedSegmentedPreview) this._iconOverlayObjects.push(selectedSegmentedPreview);
          return;
        }
        _destroySegmentedPreview();
        selectedIcon.setVisible(true);
        selectedIcon.setTexture(_iconAtlas[tab], frame);
        const s = Math.min(80 / (selectedIcon.width || 80), 80 / (selectedIcon.height || 80)) * 0.85;
        selectedIcon.setScale(s);
        selectedIcon.setTint(window.mainColor);
        const extraFrame = frame.replace("_001.png", "_2_001.png");
        const extraInfo = getAtlasFrame(this, extraFrame);
        if (extraInfo) {
          selectedIconExtra.setTexture(extraInfo.atlas, extraInfo.frame).setVisible(true).setScale(s).setTint(window.secondaryColor);
        } else {
          selectedIconExtra.setVisible(false);
        }
      };

      _refreshPreview(startTab, _getPreviewFrame(startTab));
      this._iconOverlayObjects.push(selectedIconExtra, selectedIcon);

      const tabBtnY = containerY - 40;
      const tabKeys = ["icon", "ship", "ball", "ufo", "wave", "robot", "spider"];
      const tabSpacing = 58;
      const tabOffsets = {
        icon: -tabSpacing * 3,
        ship: -tabSpacing * 2,
        ball: -tabSpacing,
        ufo: 0,
        wave: tabSpacing,
        robot: tabSpacing * 2,
        spider: tabSpacing * 3,
      };
      const tabRotations = { icon: -Math.PI/2, ship: 0, ball: -Math.PI/2, ufo: Math.PI/2, wave: Math.PI/2, robot: 0, spider: 0 };
      const tabFlipXStates = { icon: true, ship: false, ball: true, ufo: false, wave: false, robot: false, spider: false };
      const tabFlipYStates = { icon: false, ship: false, ball: false, ufo: true, wave: true, robot: false, spider: false };
      const tabBtnSprites  = {};

      const _switchTab = (tab) => {
        for (const k of tabKeys) {
          if (tabBtnSprites[k]) {
            tabBtnSprites[k].setTexture("GJ_GameSheet03",
              _safeTabBtnFrame(k, k === tab ? "on" : "off"));
          }
        }
        _refreshPreview(tab, _getPreviewFrame(tab));
        _buildGrid(tab);
      };

      tabKeys.forEach((tab, i) => {
        const isActive = tab === startTab;
        const btn = this.add.image(sw / 2 + tabOffsets[tab], tabBtnY, "GJ_GameSheet03",
            _safeTabBtnFrame(tab, isActive ? "on" : "off"))
          .setScrollFactor(0).setDepth(104).setScale(0.75)

          .setInteractive();
        tabBtnSprites[tab] = btn;
        this._iconOverlayObjects.push(btn);
        this._makeBouncyButton(btn, 0.75, () => _switchTab(tab));
      });

      this._iconGridObjects = [];

      const selLabel = this.add.image(0, 0, "GJ_GameSheet03", "GJ_select_001.png").setScrollFactor(0).setDepth(106).setOrigin(0.5, 0.5).setVisible(false);
      this._iconOverlayObjects.push(selLabel);

      const iconsPerPage = cols * rows;
      let currentPage = 0;

      const arrowY = containerY + containerHeight / 2;
      const arrowMargin = 54;

      const prevArrow = this.add.image(containerX - arrowMargin, arrowY, "GJ_GameSheet03", "GJ_arrow_01_001.png")
        .setScrollFactor(0).setDepth(106).setScale(0.8).setFlipX(false).setInteractive();
      const nextArrow = this.add.image(containerX + containerWidth + arrowMargin, arrowY, "GJ_GameSheet03", "GJ_arrow_01_001.png")
        .setScrollFactor(0).setDepth(106).setScale(0.8).setInteractive().setFlipX(true);

      //bouncy buttons for arrows
      const _getMaxPages = (tab) => {
        return Math.ceil(_iconFrameSets[tab].length / iconsPerPage);
      };
      const _prevPage = () => {
        const maxPages = _getMaxPages(_currentTab);
        currentPage = (currentPage - 1 + maxPages) % maxPages;
        _updateNavDots(currentPage, _currentTab);
        _buildGrid(_currentTab, currentPage);
      };
      const _nextPage = () => {
        const maxPages = _getMaxPages(_currentTab);
        currentPage = (currentPage + 1) % maxPages;
        _updateNavDots(currentPage, _currentTab);
        _buildGrid(_currentTab, currentPage);
      };
      this._makeBouncyButton(prevArrow, 0.8, _prevPage);
      this._makeBouncyButton(nextArrow, 0.8, _nextPage);
      this._iconOverlayObjects.push(prevArrow, nextArrow);
      const _buildGrid = (tab, page = 0) => {
        for (const o of this._iconGridObjects) {
          if (o && o.destroy) o.destroy();
        }
        this._iconGridObjects = [];
        selLabel.setVisible(false);
        const allFrames = _iconFrameSets[tab];
        const frames = allFrames.slice(page * iconsPerPage, (page + 1) * iconsPerPage);
        const atlas  = _iconAtlas[tab];
        const prop   = _iconWindowProps[tab];
        frames.forEach((frame, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const ix  = startX + col * (iconSize + padding);
          const iy  = startY + row * (iconSize + padding);
          const hitRect = this.add.rectangle(ix, iy, iconSize, iconSize, 0x000000, 0).setScrollFactor(0).setDepth(104).setInteractive();
          let iconImg;
          let extraImg = null;
          let origScale;
          if (_isSegmentedIconTab(tab)) {
            iconImg = _createSegmentedIconComposite(tab, frame, ix, iy, iconSize * 0.76, 103, true);
            if (!iconImg) {
              iconImg = this.add.image(ix, iy, "GJ_GameSheetIcons", frame).setScrollFactor(0).setDepth(103).setTint(0xAFAFAF);
              origScale = Math.min(iconSize / (iconImg.width || iconSize), iconSize / (iconImg.height || iconSize)) * 0.7;
              iconImg.setScale(origScale);
            } else {
              origScale = iconImg._selectorBaseScale || iconImg.scaleX || 1;
            }
          } else {
            iconImg = this.add.image(ix, iy, atlas, frame).setScrollFactor(0).setDepth(103).setTint(0xAFAFAF);
            origScale = Math.min(
              iconSize / (iconImg.width  || iconSize),
              iconSize / (iconImg.height || iconSize)
            ) * 0.7;
            iconImg.setScale(origScale);
            const extraFrame = frame.replace("_001.png", "_2_001.png");
            const extraInfo = getAtlasFrame(this, extraFrame);
            extraImg = extraInfo
              ? this.add.image(ix, iy, extraInfo.atlas, extraInfo.frame).setScrollFactor(0).setDepth(102).setScale(origScale)
              : null;
          }
          if (extraImg) this._iconGridObjects.push(extraImg);
          this._iconGridObjects.push(iconImg, hitRect);
          if (frame.replace("_001.png", "") === window[prop]) {
            selLabel.setPosition(ix, iy).setScale(0.75).setVisible(true);
          }

          ((capturedFrame, capturedImg, capturedExtra, capturedOrigScale) => {
            const bouncedScale = capturedOrigScale * 1.26;
            const iconTargets = capturedExtra ? [capturedImg, capturedExtra] : [capturedImg];
            hitRect.on("pointerdown", () => {
              hitRect._pressed = true;
              iconTargets.forEach(t => this.tweens.killTweensOf(t, "scale"));
              iconTargets.forEach(t => this.tweens.add({ targets: t, scale: bouncedScale, duration: 300, ease: "Bounce.Out" }));
            });
            hitRect.on("pointerout", () => {
              if (hitRect._pressed) {
                hitRect._pressed = false;
                iconTargets.forEach(t => this.tweens.killTweensOf(t, "scale"));
                iconTargets.forEach(t => this.tweens.add({ targets: t, scale: capturedOrigScale, duration: 400, ease: "Bounce.Out" }));
              }
            });
            hitRect.on("pointerup",    () => {
              hitRect._pressed = false;
              iconTargets.forEach(t => { this.tweens.killTweensOf(t); t.setScale(capturedOrigScale); });
              if (!this._iconOverlay) return;

              selLabel.setPosition(capturedImg.x, capturedImg.y).setScale(0.75).setVisible(true);

              window[prop] = capturedFrame.replace("_001.png", "");
              localStorage.setItem("icon" + prop.charAt(0).toUpperCase() + prop.slice(1), window[prop]);

              if (tab === "icon" && this._player) {
                const layerMap = [
                  { lp: "_playerSpriteLayer",  suffix: "_001.png",       tint: window.mainColor      },
                  { lp: "_playerGlowLayer",    suffix: "_glow_001.png",  tint: window.secondaryColor },
                  { lp: "_playerOverlayLayer", suffix: "_2_001.png",     tint: window.secondaryColor },
                  { lp: "_playerExtraLayer",   suffix: "_extra_001.png", tint: window.mainColor      },
                ];
                for (const { lp, suffix, tint } of layerMap) {
                  const layer = this._player[lp];
                  if (!layer || !layer.sprite) continue;
                  const found = getAtlasFrame(this, `${window.currentPlayer}${suffix}`);
                  if (found) {
                    layer.sprite.setTexture(found.atlas, found.frame);
                    if (tint !== null) layer.sprite.setTint(tint);
                  }
                }
              }
              if (tab === "ship" && this._player) {
                const layerMap = [
                  { lp: "_shipSpriteLayer",  suffix: "_001.png",       tint: window.mainColor      },
                  { lp: "_shipGlowLayer",    suffix: "_glow_001.png",  tint: window.secondaryColor },
                  { lp: "_shipOverlayLayer", suffix: "_2_001.png",     tint: window.secondaryColor },
                  { lp: "_shipExtraLayer",   suffix: "_2_001.png",     tint: window.secondaryColor },
                ];
                for (const { lp, suffix, tint } of layerMap) {
                  const layer = this._player[lp];
                  if (!layer || !layer.sprite) continue;
                  const found = getAtlasFrame(this, `${window.currentShip}${suffix}`);
                  if (found) {
                    layer.sprite.setTexture(found.atlas, found.frame);
                    if (tint !== null) layer.sprite.setTint(tint);
                  }
                }
              }
              if (tab === "ball" && this._player) {
                const layerMap = [
                  { lp: "_ballSpriteLayer",  suffix: "_001.png",      tint: window.mainColor      },
                  { lp: "_ballGlowLayer",    suffix: "_glow_001.png", tint: window.secondaryColor },
                  { lp: "_ballOverlayLayer", suffix: "_2_001.png",    tint: window.secondaryColor },
                ];
                for (const { lp, suffix, tint } of layerMap) {
                  const layer = this._player[lp];
                  if (!layer || !layer.sprite) continue;
                  const found = getAtlasFrame(this, `${window.currentBall}${suffix}`);
                  if (found) {
                    layer.sprite.setTexture(found.atlas, found.frame);
                    layer.sprite.setTint(tint);
                  }
                }
              }
              if (tab === "wave" && this._player) {
                const layerMap = [
                  { lp: "_waveSpriteLayer",  suffix: "_001.png",      tint: window.mainColor      },
                  { lp: "_waveGlowLayer",    suffix: "_glow_001.png", tint: window.secondaryColor },
                  { lp: "_waveOverlayLayer", suffix: "_2_001.png",    tint: window.secondaryColor },
                ];
                for (const { lp, suffix, tint } of layerMap) {
                  const layer = this._player[lp];
                  if (!layer || !layer.sprite) continue;
                  const found = getAtlasFrame(this, `${window.currentWave}${suffix}`);
                  if (found) {
                    layer.sprite.setTexture(found.atlas, found.frame);
                    if (tint !== null) layer.sprite.setTint(tint);
                  }
                }
              }
              if (tab === "ufo" && this._player) {
                const layerMap = [
                  { lp: "_birdSpriteLayer",  suffix: "_001.png",      tint: window.mainColor      },
                  { lp: "_birdGlowLayer",    suffix: "_2_001.png",    tint: window.secondaryColor },
                  { lp: "_birdOverlayLayer", suffix: "_3_001.png",    tint: window.secondaryColor },
                  { lp: "_birdExtraLayer",   suffix: "_extra_001.png",tint: window.mainColor      },
                ];
                for (const { lp, suffix, tint } of layerMap) {
                  const layer = this._player[lp];
                  if (!layer || !layer.sprite) continue;
                  const found = getAtlasFrame(this, `${window.currentBird}${suffix}`);
                  if (found) {
                    layer.sprite.setTexture(found.atlas, found.frame);
                    if (tint !== null) layer.sprite.setTint(tint);
                  }
                }
              }

              _refreshPreview(tab, capturedFrame);
            });
          })(frame, iconImg, extraImg, origScale);
        });
      };

      let _currentTab = startTab;

      const _switchTabOrig = _switchTab;
      const _switchTabPaged = (tab) => {
        _currentTab = tab;
        currentPage = 0;
        _updateNavDots(0, tab);
        for (const k of tabKeys) {
          if (tabBtnSprites[k]) {
            tabBtnSprites[k].setTexture("GJ_GameSheet03",
              _safeTabBtnFrame(k, k === tab ? "on" : "off"));
          }
        }
        _refreshPreview(tab, _getPreviewFrame(tab));
        _buildGrid(tab, 0);
      };
      tabKeys.forEach(tab => {
        const btn = tabBtnSprites[tab];
        if (btn) {
          btn.removeAllListeners("pointerup");
          btn.removeAllListeners("pointerdown");
          btn.removeAllListeners("pointerout");
          this._makeBouncyButton(btn, 0.75, () => _switchTabPaged(tab));
        }
      });

      _updateNavDots(0, startTab);
      _buildGrid(startTab, 0);
    };

    this._closeIconSelector = (silent = false) => {
      if (!this._iconOverlay) return;
      const destroy = () => {
        if (this._iconGridObjects) {
          for (const obj of this._iconGridObjects) {
            if (obj && obj.destroy) obj.destroy();
          }
          this._iconGridObjects = null;
        }
        if (this._iconOverlayObjects) {
          for (const obj of this._iconOverlayObjects) {
            if (obj && obj.destroy) obj.destroy();
          }
          this._iconOverlayObjects = null;
        }
        if (this._iconTitleKeyHandler) {
          window.removeEventListener("keydown", this._iconTitleKeyHandler);
          this._iconTitleKeyHandler = null;
        }
        this._iconOverlay = null;
      };
      if (silent) { destroy(); return; }
      const sw = screenWidth;
      const sh = screenHeight;
      const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(200).setAlpha(0);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, sw, sh);
      this.tweens.add({
        targets: fadeOut, alpha: 1, duration: 150, ease: "Linear",
        onComplete: () => {
          destroy();
          this.tweens.add({ targets: fadeOut, alpha: 0, duration: 150, ease: "Linear", onComplete: () => fadeOut.destroy() });
        }
      });
    };
    this._closeCreatorMenu = (silent = false) => {
      if (!this._creatorOverlay) return;
      if (silent == false) this._creatorMenuOpen = false;
      const destroy = () => {
        if (this._creatorOverlayObjects) {
          for (const obj of this._creatorOverlayObjects) {
            if (obj && obj.destroy) obj.destroy();
          }
          this._creatorOverlayObjects = null;
        }
        this._creatorOverlay = null;
      };
      if (silent) { destroy(); return; }
      const sw = screenWidth;
      const sh = screenHeight;
      const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(200).setAlpha(0);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, sw, sh);
      this.tweens.add({
        targets: fadeOut, alpha: 1, duration: 150, ease: "Linear",
        onComplete: () => {
          destroy();
          this.tweens.add({ targets: fadeOut, alpha: 0, duration: 150, ease: "Linear", onComplete: () => fadeOut.destroy() });
        }
      });
    };
    this._positionMenuItems();
    this._menuCharacters = [];
    this._menuCharacterSpawnTimer = 0.45;
    this._spaceWasDown = false;
    this._secondWasDown=false;this._pressUnseen2=false;this._releaseDeferred2=false;this._logicButtonDown2=false;
    this._spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this._wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this._lKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this._leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this._rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this._aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this._dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this._startPosIndex = -1;

    this.input.keyboard.on('keydown-Q', () => {
      if (window.GDIsTextInput?.(document.activeElement) || this._menuActive || window.eclipseMenuOpen) return;
      if (!window.startPosSwitcher || window.GDHacks?.state.keys['Previous Startpos'] !== 'KeyQ') return;
      this.changeStartPos(-1);
    });

    this.input.keyboard.on('keydown-E', () => {
      if (window.GDIsTextInput?.(document.activeElement) || this._menuActive || window.eclipseMenuOpen) return;
      if (!window.startPosSwitcher || window.GDHacks?.state.keys['Next Startpos'] !== 'KeyE') return;
      this.changeStartPos(1);
    });

    this._percentageLabel = this.add.bitmapText(screenWidth / 2, 20, "bigFont", "0%", 30).setOrigin(0.5, 0.5);
    this._percentageLabel.setVisible(false);
    this._percentageLabel.setDepth(100);

    this._noclipIndicator = this.add.bitmapText(10, 10, "bigFont", "Noclip", 20)
      .setOrigin(0, 0)
      .setAlpha(0.4)
      .setDepth(100)
      .setVisible(false);

    this._accuracyIndicator = this.add.bitmapText(10, 30, "bigFont", "100.00%", 20)
      .setOrigin(0, 0)
      .setAlpha(0.4)
      .setDepth(100)
      .setVisible(false);

    this._deathsIndicator = this.add.bitmapText(10, 50, "bigFont", "0 Deaths", 20)
      .setOrigin(0, 0)
      .setAlpha(0.4)
      .setDepth(100)
      .setVisible(false);

    this._cpsIndicator = this.add.bitmapText(10, 70, "bigFont", "0 CPS", 20)
      .setOrigin(0, 0)
      .setAlpha(0.4)
      .setDepth(100)
      .setVisible(false);

    this._bottedIndicator = this.add.bitmapText(10, 70, "bigFont", "Botted", 20)
      .setOrigin(0, 0)
      .setAlpha(0.4)
      .setDepth(100)
      .setTint(0xff0000)
      .setVisible(false);

    this.noclipFlash = this.add.rectangle(
      this.cameras.main.centerX, 
      this.cameras.main.centerY, 
      this.cameras.main.width, 
      this.cameras.main.height, 
      0xff0000
    );
    this.noclipFlash.setScrollFactor(0);
    this.noclipFlash.setDepth(99);
    this.noclipFlash.setAlpha(0);

    this._updatePracticeHUDBar = () => {};

    this._pauseBtn = this.add.image(screenWidth - 30, 30, "GJ_WebSheet", "GJ_pauseBtn_clean_001.png").setScrollFactor(0).setDepth(30).setAlpha(75 / 255).setVisible(false);
    this._pauseBtn.setInteractive();
    this._expandHitArea(this._pauseBtn, 2);
    this._pauseBtn.on("pointerdown", () => this._pauseGame());
    this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._escKey.on("down", (_key, event) => {
      if (event?.repeat) return;
      if (this._levelSelectOverlay) {
        this._closeLevelSelect();
        return;
      }
      if (this._iconOverlay) {
        this._closeIconSelector();
        return;
      }
      if (this._updateLogPopup) {
        this._closeUpdateLogPopup();
        return;
      }
      if (this._levelViewOverlay) {
        this._closeLevelView();
        return;
      }
      if (this._editorOverlay) {
        this._closeEditorMenu();
        this._openCreatorMenu();
        return;
      }
      if (this._playOverlay) {
        this._closePlayMenu(false, () => this._playMenuBackTarget());
        return;
      }
      if (this._searchResultOverlay) {
        this._closeSearchResultScene();
        return;
      } 
      if (this._searchOverlay) {
        this._closeSearchMenu(true);
        this._openCreatorMenu();
        return;
      }
      if (this._onlineLevelsOverlay) {
        this._closeOnlineLevelsScene();
        return;
      }
      if (this._creatorOverlay) {
        this._closeCreatorMenu();
        return;
      }
      if (this._settingsPopup) {
        this._settingsPopup.destroy();
        this._settingsPopup = null;
        return;
      }
      if (this._macroPopup) {
        this.events.off("update", this._refreshMacroButtons);
        this._macroPopup.destroy();
        this._macroPopup = null;
        return;
      }
      if (this._settingsLayerOverlay) {
        if (!this._settingsScreenClosing) {
          this._hideSettingsScreen();
        }
        return;
      }
      if (this._infoPopup) {
        this._infoPopup.destroy();
        this._infoPopup = null;
        return;
      }
      if (this._newgroundsPopup) {
        this._closeNewgroundsPopup();
        return;
      }
      if (this._editorTriggerChannelPopup) {
          if (typeof this._closeEditorTriggerChannelPopup === "function") {
              this._closeEditorTriggerChannelPopup();
          } else {
              this._editorTriggerChannelPopup.destroy();
              this._editorTriggerChannelPopup = null;
          }
          return;
      }
      if (this._editorColorPickerPopup) {
          this._closeEditorColorPickerPopup();
          return;
      }
      if (this._editorHorizontalOptionPopup) {
          this._closeEditorHorizontalOptionPopup();
          return;
      }
      if (this._editorStartOptionsPopup) {
          this._closeEditorStartOptionsPopup();
          return;
      }
      if (this._editorLevelSettingsPopup) {
          this._closeEditorLevelSettingsPopup();
          return;
      }
      if (this._statsLayerOverlay) {
        this._hideStatsScreen();
        return;
      }
      if (this._paused) {
        this._audio.playEffect("quitSound_01");
        this._audio.stopMusic();
        this._queueGameplayLevelViewReturn();
        this._resumeGame();
        this.scene.restart();
      } else if (!this._menuActive && !this._slideIn && !this._levelWon) {
        this._pauseGame();
      }
    });
    this._restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this._restartKey.on("down", () => {
      if (!this._menuActive && !this._slideIn && !this._levelWon && !this._menuActive) {
        this._restartLevel();
      }
    });
    this._practiceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this._practiceKey.on("down", () => {
      if (!this._menuActive && !this._slideIn) {
        const isPracticeMode = this._practicedMode.togglePracticeMode();
        if (this._checkpointBtnContainer) {
          this._checkpointBtnContainer.setVisible(isPracticeMode);
        }
        if (this._practiceModeBarContainer) {
          this._practiceModeBarContainer.setVisible(isPracticeMode);
        }
        this._audio.startMusic(this._getCurrentMusicSyncOffset());
      }
    });
    this._saveCheckpointKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this._saveCheckpointKey.on("down", () => {
      if (!this._menuActive && !this._slideIn && this._practicedMode.practiceMode) {
        const saved = this._practicedMode.saveCheckpoint(this._state, this._playerWorldX, this._cameraX, this);
        if (saved) {
        }
      }
    });
    this._deleteCheckpointKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this._deleteCheckpointKey.on("down", () => {
      if (!this._menuActive && !this._slideIn && this._practicedMode.practiceMode) {
        const deleted = this._practicedMode.deleteLastCheckpoint();
      }
    });
    this._paused = false;
    this._pauseContainer = null;
    this._sfxVolume = localStorage.getItem("userSfxVol") ?? 1;
    this._initMacroBot();
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", pointer => {
      if (!this._menuActive && !this._paused && !this._levelSelectOverlay && !this._levelWon && !window.isEditor) {
        if(window.clickBetweenFrames){this._queueJumpEvent(true,pointer.event?.timeStamp,this._isTwoPlayerMode()&&pointer.button===2?2:1,'pointer:'+pointer.button);return;}
        if(this._isTwoPlayerMode() && pointer.button===2) this._pushSecondPlayerButton();
        else this._pushButton();
      }
    });
    this.input.on("pointerup", pointer => {
      if (!this._menuActive && !this._paused && !this._levelSelectOverlay && !this._levelWon && !window.isEditor) {
        if(window.clickBetweenFrames){this._queueJumpEvent(false,pointer.event?.timeStamp,this._isTwoPlayerMode()&&pointer.button===2?2:1,'pointer:'+pointer.button);return;}
        if(this._isTwoPlayerMode() && pointer.button===2) this._releaseSecondPlayerButton();
        else this._releaseButton();
      }
    });
    if (!window.gdpointerup) {
      window.gdpointerup = true;
      window.addEventListener("pointerup", event => { if(window.clickBetweenFrames){this._queueJumpEvent(false,event.timeStamp,this._isTwoPlayerMode()&&event.button===2?2:1,'pointer:'+event.button);return;}if(this._isTwoPlayerMode() && event.button===2)this._releaseSecondPlayerButton();else this._releaseButton(true); });
    }
    if (!window.gdtouchend) {
      window.gdtouchend = true;
      window.addEventListener("touchend", () => {if(!window.clickBetweenFrames)this._releaseButton(true);});
    }
    this.scale.on("enterfullscreen", () => this._onFullscreenChange(true));
    this.scale.on("leavefullscreen", () => this._onFullscreenChange(false));

    this._buildHUD();
    this._createStartPosGui();
    this._loadSettings();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._audio.pauseMusic();
      } else if (!this._menuActive && !this._paused && !this._state.isDead && !this._levelWon) {
        this._audio.resumeMusic();
      }
    });
    if (!window.gdorientationchange) {
      window.gdorientationchange = true;
      window.addEventListener("orientationchange", () => {
        this.time.delayedCall(100, () => this.scale.refresh());
      });
    }
    if (!window.gdresize) {
      window.gdresize = true;
      window.addEventListener("resize", () => {
        this.scale.refresh();
      });
    }
    if (this.game.registry.get("fadeInFromBlack")) {
      this.game.registry.remove("fadeInFromBlack");
      this.cameras.main.fadeIn(400, 0, 0, 0);
    }
    this._levelLabel = this.add.bitmapText(screenWidth - 565, 30, "bigFont", window.currentlevel[1], 30).setOrigin(0.5, 0.5).setVisible(false);
    this._levelLabel.setScale(Math.min(1, 220 / this._levelLabel.width));
    
    this._leftBtn = this.add.image(screenWidth - 700, 30, "GJ_GameSheet03", "edit_leftBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive().setVisible(false);
    this._rightBtn = this.add.image(screenWidth - 429, 30, "GJ_GameSheet03", "edit_leftBtn_001.png").setScrollFactor(0).setDepth(30).setInteractive().setVisible(false);
    this._rightBtn.setRotation(Math.PI);
    window.scene = this.scene;
    window.rightbuttoncallback = () => {
      if (this._levelSelectOverlay && this._levelSelectSwitchLevel) {
        this._levelSelectSwitchLevel(1);
      }
    };
    window.leftbuttoncallback = () => {
      if (this._levelSelectOverlay && this._levelSelectSwitchLevel) {
        this._levelSelectSwitchLevel(-1);
      }
    };
    this._makeBouncyButton(this._leftBtn, 1, () => {window.leftbuttoncallback()}, () => this._menuActive);
    this._makeBouncyButton(this._rightBtn, 1, () => {window.rightbuttoncallback()}, () => this._menuActive);
    const menuMusicEnabled = localStorage.getItem("menuMusicEnabled");
    const shouldPlayMenuMusic = menuMusicEnabled === null ? true : menuMusicEnabled === "true";
    
    const autoStartPending = !!this.game.registry.get("autoStartGame");
    if (window.isEditor || autoStartPending) {
      this._audio.stopMusic();
    } else if (!this._audio.isplaying() && shouldPlayMenuMusic) {
      this._audio.startMenuMusic();
    } else if (this._audio.isplaying() && !shouldPlayMenuMusic) {
      this._audio.stopMusic();
    }
    if (window.levelID) {
        this._openSearchMenu();
    }
    if (this.game.registry.get("autoStartGame")) {
      if (!window.settingsMap) {
        const cachedLevelText = this.cache.text.get(window.currentlevel[2]) ||
          ((window._onlineLevelString && window.currentlevel[2] === window._onlineLevelId) ? window._onlineLevelString : null);
        if (cachedLevelText) {
          this._level.loadLevel(cachedLevelText);
        }
      }
      if (window.settingsMap) {
        this.game.registry.remove("autoStartGame");
        this._levelLabel.setVisible(false);
        this._leftBtn.setVisible(false);
        this._rightBtn.setVisible(false);
        if (this._practiceModeBarContainer) {
          this._practiceModeBarContainer.setVisible(this._practicedMode && this._practicedMode.practiceMode);
        }
        this._instantLevelStart = true;
        this._startGame();
      } else {
        console.warn("autoStartGame: missing settingsMap for", window.currentlevel && window.currentlevel[2]);
      }
    } else if (window._createdLevelReturnToView) {
      const returnTarget = window._createdLevelReturnToView;
      window._createdLevelReturnToView = null;
      const levelId = returnTarget?.createdId;
      let level = null;
      try {
        const createdLevels = JSON.parse(localStorage.getItem("created_levels") || "[]");
        level = createdLevels.find(entry =>
          entry && levelId !== undefined && levelId !== null &&
          String(entry.createdId) === String(levelId)
        ) || null;
      } catch (err) {
        console.warn("Failed to restore the created-level view", err);
      }
      if (!level && returnTarget?.snapshot) {
        level = returnTarget.snapshot;
      }
      if (level) {
        this._openLevelView(level);
      } else {
        this._openEditorMenu();
      }
    } else if (window._editorReturnToLevelViewId) {
      const levelId = window._editorReturnToLevelViewId;
      window._editorReturnToLevelViewId = null;
      let level = null;
      try {
        const createdLevels = JSON.parse(localStorage.getItem("created_levels") || "[]");
        level = createdLevels.find(entry => entry && entry.createdId === levelId) || null;
      } catch (err) {
        console.warn("Failed to restore the editor level view", err);
      }
      if (level) {
        this._openLevelView(level);
      } else {
        this._openEditorMenu();
      }
    } else if (window._onlineReturnToPlayMenu) {
      const { lvl, backTarget } = window._onlineReturnToPlayMenu;
      window._onlineReturnToPlayMenu = null;
      window._selectedLevelData = lvl;
      this._openPlayMenu(backTarget);
    } else if (window._officialReturnToLevelSelect) {
      window._officialReturnToLevelSelect = false;
      this._openLevelSelect();
    }
  }
  _parseLevelColors(levelId) {
    const LEVEL_COLORS = [
      0x0100f5,0xf902f8,0xf90285,0xfa0102,
      0xfa8702,0xfcfc06,0x03fb03,0x02fbfb,
      0x007dff
    ];   
    let index = 0;
    if (window.allLevels) {
      index = window.allLevels.findIndex(l => l[2] === levelId);
      if (index === -1) index = 0;
    }  
    const bgHex = LEVEL_COLORS[index % LEVEL_COLORS.length];
    return { bgHex, groundHex: bgHex };
  }
  _launchSelectedOfficialLevel(lvl = window.currentlevel) {
    if (this._officialLevelLaunchPending || !Array.isArray(lvl)) return;
    const levelFileName = lvl[2];
    const levelNumber = String(levelFileName || "").split("_")[1];
    if (!levelFileName || !levelNumber) return;

    const startLevel = () => {
      this._audio.playEffect("playSound_01", { volume: 1 });
      this._closeLevelSelect(true);
      this._audio.stopMusic();
      this.input.enabled = true;
      this.game.registry.set("autoStartGame", true);
      this.scene.restart();
    };

    if (this.cache.text.get(levelFileName)) {
      startLevel();
      return;
    }

    // This is only a recovery path: official strings are preloaded by BootScene.
    // Native fetch avoids re-entering Phaser's active loader and cannot leave the
    // menu stuck forever if an audio decode or duplicate cache key fails.
    this._officialLevelLaunchPending = true;
    this.input.enabled = false;
    fetch(`assets/levels/${levelNumber}.txt`, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error(`Level ${levelFileName} returned ${response.status}`);
        return response.text();
      })
      .then(levelText => {
        this.cache.text.add(levelFileName, levelText);
        startLevel();
      })
      .catch(error => {
        console.error("Failed to load official level", levelFileName, error);
        this.input.enabled = true;
      })
      .finally(() => {
        this._officialLevelLaunchPending = false;
      });
  }
  _openLevelSelect() {
    if (this._levelSelectOverlay) return;
    const sw = screenWidth;
    const sh = screenHeight;
    const cx = sw / 2;
    const cy = sh / 2;
    let { bgHex, groundHex } = this._parseLevelColors(window.currentlevel[2]);
    const drawOverlay = (gfx, colorHex, isEveryEnd = false) => {
      gfx.clear();
      const rRaw = (colorHex >> 16) & 0xff;
      const gRaw = (colorHex >> 8)  & 0xff;
      const bRaw =  colorHex        & 0xff;
      const topMul = isEveryEnd ? 0.48 : 0.92;
      const botMul = isEveryEnd ? 0.18 : 0.52;
      const steps = 60;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const mul = topMul + (botMul - topMul) * t;
        const r2 = Math.min(255, Math.round(rRaw * mul));
        const g2 = Math.min(255, Math.round(gRaw * mul));
        const b2 = Math.min(255, Math.round(bRaw * mul));
        gfx.fillStyle((r2 << 16) | (g2 << 8) | b2, 1);
        const y0 = Math.floor(i * sh / steps);
        gfx.fillRect(0, y0, sw, Math.ceil(sh / steps) + 1);
      }
    };
    const isEveryEnd = (levelId) => levelId === "level_99";
    const levelCoinRequirements = {
      "level_14": 10,
      "level_18": 20,
      "level_20": 30
    };
    const getLevelCoinRequirement = (levelId) =>
      /^level_(?:[1-9]|1\d|2[0-2])$/.test(String(levelId || ""))
        ? 0
        : (levelCoinRequirements[levelId] || 0);
    const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(200);
    fadeIn.fillStyle(0x000000, 1);
    fadeIn.fillRect(0, 0, sw, sh);
    this.tweens.add({ targets: fadeIn, alpha: 0, duration: 300, ease: "Linear", onComplete: () => fadeIn.destroy() });
    const overlay = this.add.graphics().setScrollFactor(0).setDepth(150);
    drawOverlay(overlay, bgHex, isEveryEnd(window.currentlevel[2]));
    this._levelSelectOverlay = overlay;
    const tableBottom = this.add.image(cx, 0, "GJ_GameSheet03", "GJ_topBar_001.png").setScrollFactor(0).setDepth(152).setOrigin(0.5, 0);
    const groundY = sh + 175;
    const groundId = (window._groundId || "00");
    const groundFrame = this.textures.getFrame("groundSquare_" + groundId + "_001.png");
    const referenceGroundFrame = this.textures.getFrame("groundSquare_00_001.png") || groundFrame;
    const referenceGroundH = referenceGroundFrame ? referenceGroundFrame.height : 270;
    const groundTopY = groundY - referenceGroundH;
    const tileW = groundFrame ? groundFrame.width : 1012;
    const numTiles = Math.ceil(sw / tileW) + 2;
    const groundTintHex = (colorHex) => {
      const r = Math.round(((colorHex >> 16) & 0xff) * 0.72);
      const g = Math.round(((colorHex >> 8)  & 0xff) * 0.72);
      const b = Math.round(( colorHex        & 0xff) * 0.72);
      return (r << 16) | (g << 8) | b;
    };
    const staticGroundTiles = [];
    const staticGround2Tiles = [];
    const ground2Key = "groundSquare_" + groundId + "_2_001.png";
    const hasGround2 = this.textures.exists(ground2Key);
    for (let gi = 0; gi < numTiles; gi++) {
      const tileX = gi * tileW;
      const gt = this.add.image(tileX, groundTopY, "groundSquare_" + groundId + "_001.png")
        .setScrollFactor(0).setDepth(151).setOrigin(0, 0).setTint(groundTintHex(groundHex));
      staticGroundTiles.push(gt);
      if (hasGround2) {
        const gt2 = this.add.image(tileX, groundTopY, ground2Key)
          .setScrollFactor(0).setDepth(151.5).setOrigin(0, 0).setTint(groundTintHex(groundHex));
        staticGround2Tiles.push(gt2);
      }
    }
    const infoBtn = this.add.image(sw - 40, 40, "GJ_GameSheet03", "GJ_infoIcon_001.png")
        .setScrollFactor(0).setTint(0x666666).setDepth(152)
        .setInteractive();
      this._makeBouncyButton(infoBtn, 1, () => this.levelstats());
    const floorLineFrame = this.textures.getFrame("GJ_WebSheet", "floorLine_01_001.png");
    const floorLineW = floorLineFrame ? floorLineFrame.width : 888;
    const floorLineScale = sw / floorLineW;
    const staticFloorLine = this.add.image(cx, groundTopY, "GJ_WebSheet", "floorLine_01_001.png")
      .setScrollFactor(0).setDepth(152).setOrigin(0.5, 0.5).setScale(floorLineScale, 1).setBlendMode(S);
    const cornerBL = this.add.image(0,  sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(152).setOrigin(0, 1).setFlipY(false);
    const cornerBR = this.add.image(sw, sh, "GJ_GameSheet03", "GJ_sideArt_001.png").setScrollFactor(0).setDepth(152).setOrigin(1, 1).setFlipX(true);
    const backBtn = this.add.image(50, 48, "GJ_GameSheet03", "GJ_arrow_01_001.png").setScrollFactor(0).setDepth(154).setFlipX(true).setScale(1, -1).setRotation(Math.PI).setInteractive();
    backBtn.on("pointerdown", () => {
      backBtn._pressed = true;
      this.tweens.killTweensOf(backBtn);
      this.tweens.add({ targets: backBtn, scaleX: 1.26, scaleY: -1.26, duration: 300, ease: "Bounce.Out" });
    });
    backBtn.on("pointerout", () => {
      if (backBtn._pressed) {
        backBtn._pressed = false;
        this.tweens.killTweensOf(backBtn);
        this.tweens.add({ targets: backBtn, scaleX: 1, scaleY: -1, duration: 400, ease: "Bounce.Out" });
      }
    });
    backBtn.on("pointerup", () => {
      if (backBtn._pressed) {
        backBtn._pressed = false;
        this.tweens.killTweensOf(backBtn);
        backBtn.setScale(1, -1);
        this._closeLevelSelect();
      }
    });

    const downloadsoundtrack = this.add.bitmapText(cx, 585, "bigFont", "Download the soundtracks", 56).setScrollFactor(0).setDepth(155).setOrigin(0.5, 0.5).setScale(0.52).setInteractive();
        this._makeBouncyButton(downloadsoundtrack, 0.52, () => { this._buildsongspopup(1); }); 

    const arrowL = this.add.image(55, cy - 25, "GJ_GameSheet03", "navArrowBtn_001.png").setScrollFactor(0).setDepth(154).setScale(1.1).setFlipX(true).setInteractive();
    const arrowR = this.add.image(sw - 55, cy - 25, "GJ_GameSheet03", "navArrowBtn_001.png").setScrollFactor(0).setDepth(154).setScale(1.1).setFlipX(false).setInteractive();
    const allLevels = window.allLevels || [];
    const visibleLevels = allLevels.slice();
    const pageCount = visibleLevels.length + 1;
    let currentPageIndex = visibleLevels.findIndex(l => l[2] === window.currentlevel[2]);
    if (currentPageIndex < 0) currentPageIndex = 0;
    const isComingSoonPage = () => currentPageIndex >= visibleLevels.length;
    const getPageLevel = () => {
      if (isComingSoonPage()) return visibleLevels[visibleLevels.length - 1] || window.currentlevel || [];
      return visibleLevels[currentPageIndex] || window.currentlevel || [];
    };
    const applyCurrentPage = () => {
      this._levelSelectIsComingSoonPage = isComingSoonPage();
      if (!isComingSoonPage() && visibleLevels[currentPageIndex]) {
        window.currentlevel = [...visibleLevels[currentPageIndex]];
      }
    };
    applyCurrentPage();
    const dotY = sh - 20;
    
    const maxDots = Math.min(pageCount, 28);
    const dotSpacing = 29;
    const dotStartX = cx - (maxDots - 1) * dotSpacing / 2;
    const dotObjs = [];
    const refreshDots = () => {
      for (const d of dotObjs) d.destroy();
      dotObjs.length = 0;
      for (let di = 0; di < maxDots; di++) {
        const active = di === currentPageIndex;
        const d = this.add.graphics().setScrollFactor(0).setDepth(153);
        d.fillStyle(0xffffff, active ? 1 : 0.3);
        d.fillCircle(dotStartX + di * dotSpacing, dotY, 7);
        dotObjs.push(d);
      }
    };
    refreshDots();
    const cardW = Math.min(700, sw - 180);
    const cardH = 185;
    const cardX = cx;
    const cardY = cy - 100;
    const cardSlideContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(152);
    const cardBounceContainer = this.add.container(cardX, cardY).setScrollFactor(0).setDepth(0);
    cardSlideContainer.add(cardBounceContainer);
    const cardContainer = cardSlideContainer;
    const cardBg = this.add.graphics();
    const drawCardBg = (colorHex, dark = false, textOnly = false) => {
      cardBg.clear();
      if (textOnly) return;
      const mul = dark ? 0.10 : 0.22;
      const r = Math.round(((colorHex >> 16) & 0xff) * mul);
      const g = Math.round(((colorHex >> 8)  & 0xff) * mul);
      const b = Math.round(( colorHex        & 0xff) * mul);
      cardBg.fillStyle((r << 16) | (g << 8) | b, 0.75);
      cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    };
    drawCardBg(bgHex, isEveryEnd(window.currentlevel[2]), isComingSoonPage());
    cardBounceContainer.add(cardBg);

    const cardHit = this.add.zone(cardX, cardY, cardW, cardH)
      .setScrollFactor(0).setDepth(156).setInteractive();
    const dragState = {
      pressed: false,
      dragging: false,
      startX: 0,
      lastX: 0,
      velSamples: [],
      get vel() {
        if (!this.velSamples.length) return 0;
        return this.velSamples.reduce((a, b) => a + b, 0) / this.velSamples.length;
      },
      pushVel(v) {
        this.velSamples.push(v);
        if (this.velSamples.length > 5) this.velSamples.shift();
      },
      reset() {
        this.pressed = false;
        this.dragging = false;
        this.velSamples = [];
      }
    };

    const onDragStart = (ptr) => {
      dragState.pressed = true;
      dragState.startX = ptr.x;
      dragState.lastX = ptr.x;
      dragState.dragging = false;
      dragState.velSamples = [];
    };
    cardHit.on("pointerdown", (ptr) => {
      onDragStart(ptr);
      if (isComingSoonPage()) return;
      const levelId = window.currentlevel?.[2];
      if (getLevelCoinRequirement(levelId) > (Number(window._totalsecretcoins) || 0)) return;
      this.tweens.killTweensOf(cardBounceContainer, "scale");
      this.tweens.add({ targets: cardBounceContainer, scale: 1.26, duration: 300, ease: "Bounce.Out" });
    });

    const onDragMove = (ptr) => {
      if (!dragState.pressed) return;
      const dx = ptr.x - dragState.startX;
      const frameDelta = ptr.x - dragState.lastX;
      dragState.pushVel(frameDelta);
      dragState.lastX = ptr.x;
      if (!dragState.dragging && Math.abs(dx) > 12) {
        dragState.dragging = true;
        this.tweens.killTweensOf(cardBounceContainer, "scale");
        this.tweens.add({ targets: cardBounceContainer, scale: 1, duration: 200, ease: "Quad.Out" });
      }
      if (dragState.dragging) {
        cardContainer.x = dx;
      }
    };
    const onDragUp = (ptr) => {
      if (!dragState.pressed) return;
      const wasDragging = dragState.dragging;
      const totalDx = ptr.x - dragState.startX;
      const vel = dragState.vel;
      dragState.reset();
      if (wasDragging) {
        const dragThreshold = cardW * 0.18;
        if (Math.abs(totalDx) > dragThreshold || Math.abs(vel) > 3) {
          const dir = totalDx < 0 ? 1 : -1;
          switchLevel(dir, cardContainer.x, vel);
        } else {
          if (_currentAnimUpdate) {
            this.events.off("preupdate", _currentAnimUpdate);
            _currentAnimUpdate = null;
          }
          let snapX = cardContainer.x;
          let snapVel = vel * 40;
          const snapUpdate = (time, delta) => {
            const dt = Math.min(delta / 1000, 0.05);
            const tension = 400;
            const friction = 18;
            const force = -tension * snapX - friction * snapVel;
            snapVel += force * dt;
            snapX += snapVel * dt;
            if (Math.abs(snapX) < 0.5 && Math.abs(snapVel) < 5) {
              snapX = 0;
              this.events.off("preupdate", snapUpdate);
              if (_currentAnimUpdate === snapUpdate) _currentAnimUpdate = null;
            }
            cardContainer.x = snapX;
          };
          _currentAnimUpdate = snapUpdate;
          this.events.on("preupdate", snapUpdate);
        }
      } else {
        if (ptr.x >= cardX - cardW/2 && ptr.x <= cardX + cardW/2 &&
            ptr.y >= cardY - cardH/2 && ptr.y <= cardY + cardH/2) {
            if (isComingSoonPage()) {
              return;
            }

            const requiredCoins = getLevelCoinRequirement(window.currentlevel?.[2]);
            const collectedCoins = Number(window._totalsecretcoins) || 0;
            if (requiredCoins > collectedCoins) {
              return;
            }
            
            this.tweens.killTweensOf(cardBounceContainer, "scale");
            cardBounceContainer.setScale(1);
            this._launchSelectedOfficialLevel(window.currentlevel);
        } else {
          this.tweens.killTweensOf(cardBounceContainer, "scale");
          this.tweens.add({ targets: cardBounceContainer, scale: 1, duration: 200, ease: "Quad.Out" });
        }
      }
    };
    this.input.on("pointermove", onDragMove);
    this.input.on("pointerup", onDragUp);
    const _origClose = this._closeLevelSelect.bind(this);
    const _patchedClose = (doTransition) => {
      this.input.off("pointermove", onDragMove);
      this.input.off("pointerup", onDragUp);
      this._closeLevelSelect = _origClose;
      _origClose(doTransition);
    };
    this._closeLevelSelect = _patchedClose;
    const cardContentObjs = [];
    const buildCardContent = () => {
      for (const o of cardContentObjs) { this.tweens.killTweensOf(o); o.destroy(); }
      cardContentObjs.length = 0;
      if (isComingSoonPage()) {
        this.tweens.killTweensOf(cardBounceContainer, "scale");
        cardBounceContainer.setScale(1);
        const comingSoonLabel = this.add.bitmapText(0, 0, "bigFont", "Coming Soon!", 56)
          .setScrollFactor(0).setDepth(155).setOrigin(0.5, 0.5);
        comingSoonLabel.setScale(Math.min(1, (cardW - 40) / comingSoonLabel.width));
        cardContentObjs.push(comingSoonLabel);
        cardBounceContainer.add(comingSoonLabel);
        return;
      }
      const lvl = window.currentlevel;
      const levelId = lvl[2] || "level_1";
      const requiredCoins = getLevelCoinRequirement(levelId);
      const collectedCoins = Number(window._totalsecretcoins) || 0;
      const levellocked = requiredCoins > collectedCoins;
      const levelDifficultyMap = {
        "level_1":         "diffIcon_01_btn_001",
        "level_2":         "diffIcon_01_btn_001",
        "level_3":         "diffIcon_02_btn_001",
        "level_4":         "diffIcon_02_btn_001",
        "level_5":         "diffIcon_03_btn_001",
        "level_6":         "diffIcon_03_btn_001",
        "level_7":         "diffIcon_04_btn_001",
        "level_8":         "diffIcon_04_btn_001",
        "level_9":         "diffIcon_04_btn_001",
        "level_10":        "diffIcon_05_btn_001",
        "level_11":        "diffIcon_05_btn_001",
        "level_12":        "diffIcon_05_btn_001",
        "level_13":        "diffIcon_05_btn_001",
        "level_14":        "diffIcon_06_btn_001",
        "level_15":        "diffIcon_05_btn_001",
        "level_16":        "diffIcon_05_btn_001",
        "level_17":        "diffIcon_04_btn_001",
        "level_18":        "diffIcon_06_btn_001",
        "level_19":        "diffIcon_04_btn_001",
        "level_20":        "diffIcon_06_btn_001",
        "level_21":        "diffIcon_05_btn_001",
        "level_22":        "diffIcon_05_btn_001",
        "level_99":        "diffIcon_10_btn_001",
        "level_100":       "diffIcon_10_btn_001",
        "level_137409445": "diffIcon_00_btn_001",
        "level_5703070":   "diffIcon_07_btn_001",
        "level_137677336": "diffIcon_00_btn_001",
        "level_116489424": "diffIcon_00_btn_001",
        "level_4284013": "diffIcon_06_btn_001",
        "level_56199846": "diffIcon_04_btn_001",
        "level_23":       "diffIcon_10_btn_001"
      };
      const diffIconKey = levelDifficultyMap[levelId] || "diffIcon_05_btn_001";
      const diffFrame = diffIconKey + ".png";
      const iconX = cardX - cardW / 2 + 52;
      if (levellocked) {
        const lock = this.add.image(0, -8, "GJ_GameSheet03", "GJLargeLock_001.png")
          .setScrollFactor(0).setDepth(155).setOrigin(0.5, 0.5);
        const lockFrame = this.textures.getFrame("GJ_GameSheet03", "GJLargeLock_001.png");
        if (lockFrame) lock.setScale(Math.min(1, (cardH - 20) / lockFrame.height));
        cardContentObjs.push(lock);
        cardBounceContainer.add(lock);
      } else {
        const isHardDemon = diffIconKey === "diffIcon_06_btn_001";
        const demonIcon = this.add.image(iconX - cardX, 0, "GJ_GameSheet03", diffFrame)
          .setScrollFactor(0).setDepth(155).setScale(1).setOrigin(0.5, 0.5);
        cardContentObjs.push(demonIcon);
        cardBounceContainer.add(demonIcon);
        const maxIconH = cardH - 16;
        const maxIconW = 80;
        const iconFrame = this.textures.getFrame("GJ_GameSheet03", diffFrame);
        let finalIconScale = 1.115;
        if (iconFrame) {
          const scaleForH = maxIconH / iconFrame.height;
          const scaleForW = maxIconW / iconFrame.width;
          finalIconScale = Math.min(1.115, scaleForH, scaleForW);
          demonIcon.setScale(finalIconScale);
        }
        const iconDisplayW = (iconFrame ? iconFrame.width : 80) * finalIconScale;
        const iconDisplayH = (iconFrame ? iconFrame.height : 80) * finalIconScale;
        const nameLabel = this.add.bitmapText(0, 0, "bigFont", lvl[1], 60)
          .setScrollFactor(0).setDepth(155).setOrigin(0, 0.5);
        const gap = 25;
        const naturalGroupW = iconDisplayW + gap + nameLabel.width;
        const naturalGroupH = Math.max(iconDisplayH, nameLabel.height);
        const cardPad = 16;
        const maxGroupW = cardW - cardPad * 2 - 100;
        const maxGroupH = cardH - cardPad * 2;
        const groupScale = Math.min(1, maxGroupW / naturalGroupW, maxGroupH / naturalGroupH);
        const scaledIconW = iconDisplayW * groupScale;
        const scaledGap = gap * groupScale;
        const totalW = scaledIconW + scaledGap + nameLabel.width * groupScale;
        const groupStartX = cardX - totalW / 2;
        demonIcon.setScale(finalIconScale * groupScale);
        demonIcon.setPosition(groupStartX + scaledIconW / 2 - cardX, 0);
        nameLabel.setScale(groupScale);
        nameLabel.setPosition(groupStartX + scaledIconW + scaledGap - cardX, 0);
        cardContentObjs.push(nameLabel);
        cardBounceContainer.add(nameLabel);
      }

      let collectedSecretCoins = [];
      try {
        const savedCoins = JSON.parse(localStorage.getItem("gd_secretCoins_" + levelId) || "[]");
        const savedSlotsKey = "gd_secretCoins_" + levelId + "_slots";
        const savedSlots = JSON.parse(localStorage.getItem(savedSlotsKey) || "null");
        if (Array.isArray(savedSlots)) {
          collectedSecretCoins = savedSlots.filter(slot => Number.isInteger(slot) && slot >= 0 && slot < 3);
        } else if (levelId === window.currentlevel?.[2] && Array.isArray(this._level?._coinSprites)) {
          const savedIds = new Set(Array.isArray(savedCoins) ? savedCoins.map(String) : []);
          collectedSecretCoins = this._level._coinSprites
            .filter(sprite => sprite?._secretCoinId !== undefined && savedIds.has(String(sprite._secretCoinId)))
            .map(sprite => sprite._secretCoinSlot)
            .filter(slot => Number.isInteger(slot));
        }
      } catch (_error) {}
      if (levellocked) {
        const coinCount = this.add.bitmapText(cardW / 2 - 117, 63, "bigFont", `${collectedCoins}/${requiredCoins}`, 42)
          .setScrollFactor(0).setDepth(155).setOrigin(0.5, 0.5);
        const coinIcon = this.add.image(cardW / 2 - 31, 63, "GJ_GameSheet03", "GJ_coinsIcon_001.png")
          .setScrollFactor(0).setDepth(155).setOrigin(0.5);
        cardContentObjs.push(coinCount, coinIcon);
        cardBounceContainer.add([coinCount, coinIcon]);
      }
      for (let coinIndex = 0; !levellocked && coinIndex < 3; coinIndex++) {
        const coinIcon = this.add.image(
          cardW / 2 - 131 + coinIndex * 50,
          63,
          "GJ_GameSheet03",
          collectedSecretCoins.includes(coinIndex) ? "GJ_coinsIcon_001.png" : "GJ_coinsIcon_gray_001.png"
        ).setScrollFactor(0).setDepth(155).setOrigin(0.5);
        cardContentObjs.push(coinIcon);
        cardBounceContainer.add(coinIcon);
      }
    };
    const barAreaY = cardY + cardH / 2 + 100;
    const barW2 = Math.min(600, sw - 200);
    const barH2 = 36;
    const barX0 = cx - barW2 / 2;
    let barObjs = [];
    const buildBar = () => {
      for (const o of barObjs) { this.tweens.killTweensOf(o); o.destroy(); }
      barObjs.length = 0;
      if (isComingSoonPage()) return;
      const bestNormal = parseFloat(localStorage.getItem("bestPercent_" + (window.currentlevel[2] || "level_1")) || "0");
      const modeLabel = this.add.bitmapText(cx, barAreaY - 40, "bigFont", "Normal Mode", 30)
        .setScrollFactor(0).setDepth(155).setOrigin(0.5, 0.5);
      barObjs.push(modeLabel);
      cardContainer.add(modeLabel);
      const barBg = this.add.graphics().setScrollFactor(0).setDepth(154);
      barBg.fillStyle(0x000000, 0.5);
      barBg.fillRoundedRect(barX0, barAreaY - barH2 / 2, barW2, barH2, barH2 / 2);
      barObjs.push(barBg);
      cardContainer.add(barBg);
      const padding = 3;
      const innerH2 = barH2 - padding * 2;
      const innerW2 = barW2 - padding * 2;
      const innerRadius = innerH2 / 2;
      const fillW = Math.max(innerH2, innerW2 * bestNormal / 100);
    if(bestNormal > 0) {
      const barFg = this.add.graphics().setScrollFactor(0).setDepth(155);
      barFg.fillStyle(0x00FF00, 1);   
      const rightR = (bestNormal >= 100) ? innerRadius : 0;  
      barFg.fillRoundedRect(barX0 + padding, barAreaY - barH2 / 2 + padding, fillW, innerH2, {
        tl: innerRadius,
        bl: innerRadius,
        tr: rightR,
        br: rightR
      });
      
      barObjs.push(barFg);
        cardContainer.add(barFg);
      }
      const pctLabel = this.add.bitmapText(cx, barAreaY, "bigFont", Math.round(bestNormal) + "%", 22)
        .setScrollFactor(0).setDepth(156).setOrigin(0.5, 0.5);
      barObjs.push(pctLabel);
      cardContainer.add(pctLabel);
      const bestPractice = parseFloat(localStorage.getItem("practiceBestPercent_" + (window.currentlevel[2] || "level_1")) || "0");
      const practBarAreaY = barAreaY + barH2 + 48;
      const practModeLabel = this.add.bitmapText(cx, practBarAreaY - 40, "bigFont", "Practice Mode", 30)
        .setScrollFactor(0).setDepth(155).setOrigin(0.5, 0.5);
      barObjs.push(practModeLabel);
      cardContainer.add(practModeLabel);
      const practBarBg = this.add.graphics().setScrollFactor(0).setDepth(154);
      practBarBg.fillStyle(0x000000, 0.5);
      practBarBg.fillRoundedRect(barX0, practBarAreaY - barH2 / 2, barW2, barH2, barH2 / 2);
      barObjs.push(practBarBg);
      cardContainer.add(practBarBg);
      if (bestPractice > 0) {
        const practFillW = Math.max(innerH2, innerW2 * bestPractice / 100);
        const practBarFg = this.add.graphics().setScrollFactor(0).setDepth(155);
        practBarFg.fillStyle(0x00FFFF, 1);
        const practRightR = (bestPractice >= 100) ? innerRadius : 0;
        practBarFg.fillRoundedRect(barX0 + padding, practBarAreaY - barH2 / 2 + padding, practFillW, innerH2, {
          tl: innerRadius, bl: innerRadius, tr: practRightR, br: practRightR
        });
        barObjs.push(practBarFg);
        cardContainer.add(practBarFg);
      }
      const practPctLabel = this.add.bitmapText(cx, practBarAreaY, "bigFont", Math.round(bestPractice) + "%", 22)
        .setScrollFactor(0).setDepth(156).setOrigin(0.5, 0.5);
      barObjs.push(practPctLabel);
      cardContainer.add(practPctLabel);
    };
    buildCardContent();
    buildBar();
    let _currentAnimUpdate = null;
    const switchLevel = (dir, startX = null, dragVel = 0) => {
      if (pageCount <= 0) return;

      if (_currentAnimUpdate) {
        this.events.off("preupdate", _currentAnimUpdate);
        _currentAnimUpdate = null;
      }
      currentPageIndex = (currentPageIndex + dir + pageCount) % pageCount;
      applyCurrentPage();
      const pageLevel = getPageLevel();
      const newColors = this._parseLevelColors(pageLevel[2]);
      const dark = isEveryEnd(pageLevel[2]);
      const slideDist = cardW - 200;
      const slideOutTarget = -dir * slideDist;
      const slideInStart = dir * slideDist;
      this.tweens.killTweensOf(cardContainer);
      let state = "out";
      let currentX = startX !== null ? startX : cardContainer.x;
      const dragSpeedBoost = Math.abs(dragVel) * 60;
      const slideOutSpeed = slideDist * 14 + dragSpeedBoost;
      const slideInVel = slideDist * 6 + dragSpeedBoost;
      let vel = 0;
      const scrollAnimUpdate = (time, delta) => {
        const dt = Math.min(delta / 1000, 0.05);
        if (state === "out") {
          currentX += (-dir) * slideOutSpeed * dt;
          if ((dir > 0 && currentX <= slideOutTarget) || (dir < 0 && currentX >= slideOutTarget)) {
            for (const o of cardContentObjs) {
              cardBounceContainer.remove(o, false);
              o.destroy();
            }
            for (const o of barObjs) {
              cardSlideContainer.remove(o, false);
              o.destroy();
            }
            cardContentObjs.length = 0;
            barObjs.length = 0;
            drawCardBg(newColors.bgHex, dark, isComingSoonPage());
            buildCardContent();
            buildBar();
            drawOverlay(overlay, newColors.bgHex, dark);
            for (const gt of staticGroundTiles) gt.setTint(groundTintHex(newColors.groundHex));
            for (const gt of staticGround2Tiles) gt.setTint(groundTintHex(newColors.groundHex));
            refreshDots();
            state = "in";
            currentX = slideInStart;
            vel = (-dir) * slideInVel;
          }
        } else if (state === "in") {
          const tension = 300;
          const friction = 15;
          const force = -tension * currentX - friction * vel;
          vel += force * dt;
          currentX += vel * dt;

          if (Math.abs(currentX) < 1 && Math.abs(vel) < 15) {
            currentX = 0;
            this.events.off("preupdate", scrollAnimUpdate);
            if (_currentAnimUpdate === scrollAnimUpdate) _currentAnimUpdate = null;
          }
        }
        cardContainer.x = currentX;
      };
      _currentAnimUpdate = scrollAnimUpdate;
      this.events.on("preupdate", scrollAnimUpdate);
    };
    this._makeBouncyButton(arrowL, 1.1, () => { switchLevel(-1); });
    this._makeBouncyButton(arrowR, 1.1, () => { switchLevel(1); });
    const inputBlocker = this.add.zone(cx, cy, sw, sh)
      .setScrollFactor(0).setDepth(151).setInteractive();
    inputBlocker.on("pointerdown", onDragStart);
    this._levelSelectStaticObjs = [overlay, inputBlocker, tableBottom, ...staticGroundTiles, ...staticGround2Tiles, staticFloorLine, cornerBL, cornerBR, backBtn, infoBtn, arrowL, arrowR, cardSlideContainer, cardHit, downloadsoundtrack];
    this._levelSelectSwitchLevel = switchLevel;
    this._levelSelectDotObjs = dotObjs;
    this._levelSelectCardContent = cardContentObjs;
    this._levelSelectBarObjs = barObjs;
  }
  _closeLevelSelect(silent = false) {
    if (!this._levelSelectOverlay) return;
    const destroy = () => {
      const all = [
        ...(this._levelSelectStaticObjs || []),
        ...(this._levelSelectDotObjs || []),
        ...(this._levelSelectCardContent || []),
        ...(this._levelSelectBarObjs || []),
      ];
      for (const o of all) { if (o && o.destroy) { this.tweens.killTweensOf(o); o.destroy(); } }
      this._levelSelectOverlay = null;
      this._levelSelectStaticObjs = null;
      this._levelSelectDotObjs = null;
      this._levelSelectCardContent = null;
      this._levelSelectBarObjs = null;
      this._levelSelectSwitchLevel = null;
      this._levelSelectIsComingSoonPage = false;
    };
    if (silent) { destroy(); return; }
    const sw = screenWidth;
    const sh = screenHeight;
    const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(200).setAlpha(0);
    fadeOut.fillStyle(0x000000, 1);
    fadeOut.fillRect(0, 0, sw, sh);
    this.tweens.add({
      targets: fadeOut, alpha: 1, duration: 150, ease: "Linear",
      onComplete: () => {
        destroy();
        this.tweens.add({ targets: fadeOut, alpha: 0, duration: 150, ease: "Linear", onComplete: () => fadeOut.destroy() });
      }
    });
  }
  _buildHUD() {
    this._attemptsLabel = this.add.bitmapText(0, 0, "bigFont", "Attempt 1", 65).setOrigin(0.5, 0.5).setVisible(false);
    this._level.topContainer.add(this._attemptsLabel);
    this._positionAttemptsLabel();
    this._checkpointBtnContainer = this.add.container(screenWidth / 2, screenHeight - 60)
      .setScrollFactor(0)
      .setDepth(30)
      .setVisible(false);
    this._checkpointBtn = this.add.image(-50, 0, "GJ_GameSheet03", "GJ_checkpointBtn_001.png")
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .setScale(0.8);
    this._makeBouncyButton(this._checkpointBtn, 0.8, () => {
      if (this._practicedMode.practiceMode && !this._menuActive && !this._slideIn) {
        this._practicedMode.saveCheckpoint(this._state, this._playerWorldX, this._cameraX, this);
      }
    });
    this._expandHitArea(this._checkpointBtn, 2);
    this._clearCheckpointBtn = this.add.image(50, 0, "GJ_GameSheet03", "GJ_removeCheckBtn_001.png")
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .setScale(0.8);
    this._makeBouncyButton(this._clearCheckpointBtn, 0.8, () => {
      if (this._practicedMode.practiceMode && !this._menuActive && !this._slideIn) {
        this._practicedMode.deleteLastCheckpoint();
      }
    }); 
    this._expandHitArea(this._clearCheckpointBtn, 1.5);
    this._checkpointBtnContainer.add([this._checkpointBtn, this._clearCheckpointBtn]);
    this._fpsText = this.add.text(screenWidth - 20, 10, "", {
      fontSize: "28px",
      fill: "#ffffff",
      fontFamily: "Arial"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(999).setVisible(!!window.GDHacks?.state.fpsEnabled&&!window.eclipseHideLabels);
    this._fpsAccum = 0;
    this._fpsFrames = 0;
  }
  _createStartPosGui() {
        const centerX = screenWidth / 2;
        const bottomY = screenHeight - 60;

        this._startPosGui = this.add.container(centerX, bottomY).setScrollFactor(0).setDepth(100);
        this._startPosGui.setVisible(false);

        const leftArrow = this.add.image(-90, 0, "GJ_GameSheet03", "GJ_arrow_01_001.png")
            .setScale(0.6)
            .setInteractive();
        
        const rightArrow = this.add.image(90, 0, "GJ_GameSheet03", "GJ_arrow_01_001.png")
            .setScale(0.6)
            .setFlipX(true)
            .setInteractive();

        const positions = this._level.getStartPositions();
        const total = positions.length;

        this._startPosText = this.add.bitmapText(0, 0, "bigFont", `0/${total}`, 40).setOrigin(0.5);

        this._startPosGui.add([leftArrow, rightArrow, this._startPosText]);

        this._makeBouncyButton(leftArrow, 0.6, () => this.changeStartPos(-1));
        this._makeBouncyButton(rightArrow, 0.6, () => this.changeStartPos(1));
  }
  changeStartPos(direction) {
        if (this._paused || this._levelWon || this._menuActive || this._slideIn) return;
        
        const positions = this._level.getStartPositions();
        const totalPositions = positions.length;
        
        if (totalPositions === 0) return;

        this._startPosIndex += direction;

        if (this._startPosIndex < -1) {
            this._startPosIndex = totalPositions - 1;
        } else if (this._startPosIndex >= totalPositions) {
            this._startPosIndex = -1;
        }

        if (this._startPosText) {
            const currentId = this._startPosIndex === -1 ? 0 : (this._startPosIndex + 1);
            this._startPosText.setText(`${currentId}/${totalPositions}`);
        }

        this._practicedMode.clearCheckpoints();
        this._restartLevel();
  }
  toggleGlitter(_0x34c21a) {
    if (this._editorPlaytestActive) {
      this._glitterEmitter.stop();
      return;
    }

    if (_0x34c21a) {
      this._glitterEmitter.start();
    } else {
      this._glitterEmitter.stop();
    }
  }
  _setParticleTimeScale(timeScale) {
    const updateTimeScale = object => {
      if (object && object.type === "ParticleEmitter") {
        object.timeScale = timeScale;
      }
      if (object && object.list) {
        object.list.forEach(updateTimeScale);
      }
    };
    updateTimeScale(this._level.container);
    updateTimeScale(this._level.topContainer);
    if (this._glitterEmitter) {
      this._glitterEmitter.timeScale = timeScale;
    }
  }
  _pauseGame() {
    if (!this._paused && !this._menuActive && !this._slideIn && !this._levelWon) {
      this._paused = true;
      // A key already held when Escape arrives is not a request to resume.
      this._pauseJumpWasDown = this._jumpKeysDown();
      this._pauseResumeTimer?.remove();
      this._pauseResumeTimer = null;
      this._pauseBtn.setVisible(false);
      this._audio.pauseMusic();
      this._setParticleTimeScale(0);
      this._player?.setDeathAnimationPaused?.(true);
      this._player2?.setDeathAnimationPaused?.(true);
      this._buildPauseOverlay();
    }
  }
  _resumeGame() {
    if (this._paused) {
      this._pauseResumeTimer?.remove();
      this._pauseResumeTimer = null;
      this._setParticleTimeScale(1);
      this._player?.setDeathAnimationPaused?.(false);
      this._player2?.setDeathAnimationPaused?.(false);
      this._paused = false;
      this._pauseBtn.setVisible(true).setAlpha(75 / 255);
      if (!this._state.isDead || this._practicedMode?.practiceMode) {
        this._audio.resumeMusic();
        this._audio._ensureCorrectMusicMode();
      }
      if (this._pauseContainer) {
        this._pauseContainer.destroy();
        this._pauseContainer = null;
      }
    }
  }
  _queueGameplayLevelViewReturn() {
    const currentLevelId = window.currentlevel?.[2] ?? window._onlineLevelId ?? null;
    const pendingCreatedReturn = window._createdLevelReturnToView || null;
    const candidateCreatedIds = [
      pendingCreatedReturn?.createdId,
      currentLevelId,
      window._onlineLevelId
    ].filter(value => value !== undefined && value !== null);

    let createdLevel = null;
    try {
      const createdLevels = JSON.parse(localStorage.getItem("created_levels") || "[]");
      createdLevel = createdLevels.find(level => {
        if (!level) return false;
        return candidateCreatedIds.some(id =>
          String(level.createdId) === String(id) ||
          (level.levelId !== undefined && level.levelId !== null && String(level.levelId) === String(id))
        );
      }) || null;
    } catch (err) {
      console.warn("Failed to determine the created-level return target", err);
    }

    if (createdLevel || pendingCreatedReturn?.snapshot) {
      const targetLevel = createdLevel || pendingCreatedReturn.snapshot;
      window._createdLevelReturnToView = {
        createdId: targetLevel.createdId ?? pendingCreatedReturn?.createdId ?? currentLevelId,
        snapshot: { ...targetLevel }
      };
      window._editorReturnToLevelViewId = null;
      window._onlineReturnToPlayMenu = null;
      return true;
    }

    const levelSource = window.currentlevel?.[3]?.[0];
    const isOnlineLevel = levelSource === "Online" || String(currentLevelId || "").startsWith("online_");
    if (isOnlineLevel) {
      const existingReturn = window._onlineReturnToPlayMenu;
      const selectedLevel = existingReturn?.lvl || window._selectedLevelData || null;
      if (selectedLevel) {
        window._onlineReturnToPlayMenu = {
          lvl: selectedLevel,
          backTarget: existingReturn?.backTarget || null
        };
        window._createdLevelReturnToView = null;
        window._editorReturnToLevelViewId = null;
        return true;
      }
    }

    // The native main-level menu returns to its level carousel, not to the
    // root menu. Keep that destination across the scene restart.
    const isOfficialLevel = Array.isArray(window.allLevels) && window.allLevels.some(level =>
      String(level?.[2] ?? "") === String(currentLevelId ?? "")
    );
    if (isOfficialLevel) {
      window._officialReturnToLevelSelect = true;
      window._createdLevelReturnToView = null;
      window._onlineReturnToPlayMenu = null;
      return true;
    }

    window._createdLevelReturnToView = null;
    return false;
  }

  _createPauseToggleButton(_0x5376fd, _0x3b6200, _0x2b25c8, _0xe203c3, _0x268e2b, _0x2d04c4) {
    const _0x4864cc = this.add.container(_0x3b6200, _0x2b25c8);
    const pieceHeight = this.add.image(0, 0, "GJ_GameSheet03", _0x268e2b ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png").setScale(0.7).setInteractive();
    const _0x15c0df = this.add.bitmapText(25 + 10, 0, "bigFont", _0xe203c3, 32).setOrigin(0, 0.5);
    _0x4864cc.add([pieceHeight, _0x15c0df]);
    _0x5376fd.add(_0x4864cc);
    const _0x232e51 = _0x1dce15 => {
      pieceHeight.setTexture("GJ_GameSheet03", _0x1dce15 ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png");
      this._expandHitArea(pieceHeight, 2);
      _0x2d04c4(_0x1dce15);
    };
    this._expandHitArea(pieceHeight, 2);
    this._makeBouncyButton(pieceHeight, 0.7, () => {
      _0x232e51(pieceHeight.frame.name === "GJ_checkOff_001.png");
    }, () => this._paused && !!this._pauseContainer);
    _0x15c0df.setInteractive();
    _0x15c0df.on("pointerdown", () => {
      if (this._paused && this._pauseContainer) {
        _0x232e51(pieceHeight.frame.name === "GJ_checkOff_001.png");
      }
    });
    return _0x4864cc;
  }
_buildPauseOverlay() {
    const textureY = screenWidth / 2;
    const _0xf70e04 = 320;
    const _0x4eb71b = screenWidth - 40;
    this._pauseContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    
    const _0x505665 = this.add.rectangle(textureY, _0xf70e04, screenWidth, screenHeight, 0, 75 / 255);
    _0x505665.setInteractive();
    this._pauseContainer.add(_0x505665);
    
    const _0x103191 = this.textures.get("square04_001").source[0].width * 0.325;
    const _0x954813 = this._drawScale9(textureY, _0xf70e04, _0x4eb71b, 600, "square04_001", _0x103191, 0, 150 / 255);
    this._pauseContainer.add(_0x954813);

    const _0x3874ed = this.scale.isFullscreen;
    const _0x426993 = this.add.image(textureY - _0x4eb71b / 2 + 40, 60, "GJ_WebSheet", _0x3874ed ? "toggleFullscreenOff_001.png" : "toggleFullscreenOn_001.png").setScale(0.64).setInteractive();
    this._expandHitArea(_0x426993, 2.5);
    this._pauseContainer.add(_0x426993);
    this._makeBouncyButton(_0x426993, 0.64, () => {
      const _0x23c9e5 = !this.scale.isFullscreen;
      _0x426993.setTexture("GJ_WebSheet", _0x23c9e5 ? "toggleFullscreenOff_001.png" : "toggleFullscreenOn_001.png");
      this._expandHitArea(_0x426993, 2.5);
      this._toggleFullscreen();
    });

    const settingsBtn = this.add.image(textureY + _0x4eb71b / 2 - 60, 80, 'GJ_GameSheet03', "GJ_optionsBtn_001.png").setScale(0.64).setInteractive();
    this._expandHitArea(settingsBtn, 2.5);
    this._pauseContainer.add(settingsBtn);
    this._makeBouncyButton(settingsBtn, 0.64, () => this._buildSettingsPopup());

    this._macroBtn = this.add.image(textureY + _0x4eb71b / 2 - 60, 150, "macroBot").setScale(0.4).setInteractive();
    this._pauseContainer.add(this._macroBtn);
    this._makeBouncyButton(this._macroBtn, 0.4, () => this._buildMacroPopup());

    this._pauseContainer.add(this.add.bitmapText(textureY, 65, "bigFont", window.currentlevel[1], 46).setOrigin(0.5, 0.5));

    const _0x21dacf = 170;
    const _0x46bab2 = this._bestPercent || 0;
    const _0x38b8d1 = this.add.image(textureY, _0x21dacf, "GJ_WebSheet", "GJ_progressBar_001.png").setTint(0).setAlpha(125 / 255);
    this._pauseContainer.add(_0x38b8d1);
    const _0x1d49a9 = this.textures.getFrame("GJ_WebSheet", "GJ_progressBar_001.png");
    const _0xb5ab6f = _0x1d49a9 ? _0x1d49a9.width : 680;
    const _0x1e6502 = _0x1d49a9 ? _0x1d49a9.height : 40;
    const _0x3782ca = Math.max(1, Math.floor(_0xb5ab6f * (_0x46bab2 / 100)));
    const _0x3d0987 = this.add.image(0, 0, "GJ_WebSheet", "GJ_progressBar_001.png").setTint(65280).setScale(0.992, 0.86).setOrigin(0, 0.5).setCrop(0, 0, _0x3782ca, _0x1e6502);
    _0x3d0987.setPosition(textureY - _0xb5ab6f * 0.992 / 2, _0x21dacf);
    this._pauseContainer.add(_0x3d0987);
    this._pauseContainer.add(this.add.bitmapText(textureY, _0x21dacf, "bigFont", _0x46bab2 + "%", 32).setOrigin(0.5, 0.5).setScale(0.82));
    this._pauseContainer.add(this.add.bitmapText(textureY, 130, "bigFont", "Normal Mode", 34).setOrigin(0.5, 0.5).setScale(0.82));

    const _pausePractPct = this._practiceBestPercent || 0;
    const _pausePractBarY = 255;
    const _pausePractBarImg = this.add.image(textureY, _pausePractBarY, "GJ_WebSheet", "GJ_progressBar_001.png").setTint(0).setAlpha(125 / 255);
    this._pauseContainer.add(_pausePractBarImg);
    const _pausePractFrame = this.textures.getFrame("GJ_WebSheet", "GJ_progressBar_001.png");
    const _pausePractBarW = _pausePractFrame ? _pausePractFrame.width : 680;
    const _pausePractBarH = _pausePractFrame ? _pausePractFrame.height : 40;
    const _pausePractFillW = Math.max(1, Math.floor(_pausePractBarW * (_pausePractPct / 100)));
    const _pausePractFg = this.add.image(0, 0, "GJ_WebSheet", "GJ_progressBar_001.png").setTint(0x00FFFF).setScale(0.992, 0.86).setOrigin(0, 0.5).setCrop(0, 0, _pausePractFillW, _pausePractBarH);
    _pausePractFg.setPosition(textureY - _pausePractBarW * 0.992 / 2, _pausePractBarY);
    this._pauseContainer.add(_pausePractFg);
    this._pauseContainer.add(this.add.bitmapText(textureY, _pausePractBarY, "bigFont", _pausePractPct + "%", 32).setOrigin(0.5, 0.5).setScale(0.82));
    this._pauseContainer.add(this.add.bitmapText(textureY, _pausePractBarY - 40, "bigFont", "Practice Mode", 34).setOrigin(0.5, 0.5).setScale(0.82));

    const _0x4791ac = [
        { frame: this._practicedMode.practiceMode ? "GJ_normalBtn_001.png" : "GJ_practiceBtn_001.png", atlas: "GJ_GameSheet03", action: null },
        { frame: "GJ_playBtn2_001.png", atlas: "GJ_WebSheet", action: () => this._resumeGame() },
        { frame: "GJ_menuBtn_001.png", atlas: "GJ_WebSheet", action: () => {
            this._audio.playEffect("quitSound_01");
            this._queueGameplayLevelViewReturn();
            this.game.registry.remove("autoStartGame");
            window.isEditor = false;
            this._audio.stopMusic();
            this._resumeGame();
            this.scene.restart();
        }},
        { frame: "GJ_replayBtn_001.png", atlas: "GJ_WebSheet", action: () => {
            this._resumeGame();
            this._restartLevel();
        }}
    ];

    const _0x25aa59 = _0x4791ac.map(btn => this.textures.getFrame(btn.atlas, btn.frame)?.width || 123);
    let _0x599a9b = textureY - (_0x25aa59.reduce((a, b) => a + b, 0) + (_0x4791ac.length - 1) * 40) / 2;

    for (let i = 0; i < _0x4791ac.length; i++) {
        const item = _0x4791ac[i];
        const width = _0x25aa59[i];
        const btn = this.add.image(_0x599a9b + width / 2, 390, item.atlas, item.frame).setInteractive();
        
        if (item.action === null) {
            this._pausePracticeBtn = btn;
            this._makeBouncyButton(btn, 1, () => {
                const isPracticeMode = this._practicedMode.togglePracticeMode();
                btn.setTexture("GJ_GameSheet03", isPracticeMode ? "GJ_normalBtn_001.png" : "GJ_practiceBtn_001.png");
                if (this._checkpointBtnContainer) this._checkpointBtnContainer.setVisible(isPracticeMode);
                this._resumeGame();
                if (!isPracticeMode) {
                    this._practicedMode.clearCheckpoints();
                    this._restartLevel();
                }
            });
        } else {
            this._makeBouncyButton(btn, 1, item.action);
        }
        this._pauseContainer.add(btn);
        _0x599a9b += width + 40;
    }

    const _0x1008ae = 530;
    const _0x22b43a = 0.7;
    const _0x41925a = this.textures.getFrame("GJ_WebSheet", "slidergroove.png");
    const _0x372782 = _0x41925a ? _0x41925a.width : 420;

    const createSlider = (posX, labelText, initialVal, setter) => {
        this._pauseContainer.add(
          this.add.bitmapText(posX, _0x1008ae - 48, "bigFont", labelText, 30).setOrigin(0.5, 0.5)
        );
        const barMaxW = (_0x372782 - 8) * _0x22b43a;
        const barStartX = posX - _0x372782 * _0x22b43a / 2 + 2.8;
        const fillW = initialVal * barMaxW;
        const fillBar = this.add.tileSprite(barStartX, _0x1008ae, fillW > 0 ? fillW : 1, 11.2, "sliderBar").setOrigin(0, 0.5);
        this._pauseContainer.add(fillBar);
        this._pauseContainer.add(this.add.image(posX, _0x1008ae, "GJ_WebSheet", "slidergroove.png").setScale(_0x22b43a));
        
        const thumb = this.add.image(barStartX + fillW, _0x1008ae, "GJ_WebSheet", "sliderthumb.png").setScale(_0x22b43a).setInteractive({ draggable: true });
        this._pauseContainer.add(thumb);
        thumb.on("drag", (p, dragX) => {
            thumb.x = Math.max(barStartX, Math.min(barStartX + barMaxW, dragX));
            const pct = (thumb.x - barStartX) / barMaxW;
            fillBar.width = Math.max(1, pct * barMaxW);
            setter(pct < 0.03 ? 0 : pct);
        });
    };

    createSlider(textureY - 200, "MUSIC", this._audio.getUserMusicVolume(), v => this._audio.setUserMusicVolume(v));
    createSlider(textureY + 200, "SFX", this._sfxVolume, v => {
        this._sfxVolume = v;
        localStorage.setItem("userSfxVol", v);
    });
 }
_buildSettingsPopup() {
    if (this._settingsPopup) return;

    const centerX = screenWidth / 2,
        centerY = 320,
        panelWidth = 800,
        panelHeight = 550;

    this._settingsPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(250);

    const dim = this.add.rectangle(centerX, centerY, screenWidth, screenHeight, 0, 150 / 255).setInteractive();
    this._settingsPopup.add(dim);

    const innerContainer = this.add.container(centerX, centerY).setScale(0);
    this._settingsPopup.add(innerContainer);

    const corner = 0.325 * this.textures.get("GJ_square01").source[0].width;
    const panel = this._drawScale9(0, 0, panelWidth, panelHeight, 'GJ_square01', corner, 16777215, 1);
    innerContainer.add(panel);

    const closeBtn = this.add.image(-(panelWidth / 2) + 10, -(panelHeight / 2) + 10, 'GJ_WebSheet', "GJ_closeBtn_001.png").setScale(0.8).setInteractive();
    innerContainer.add(closeBtn);
    this._makeBouncyButton(closeBtn, 0.8, () => {
        this._settingsPopup.destroy();
        this._settingsPopup = null;
    });

    const pages = ["Gameplay", "Visual", "Advanced", "Performance"];
    let currentPage = 0;
    const pageTitle = this.add.bitmapText(0, -(panelHeight / 2) + 45, "bigFont", pages[currentPage], 40).setOrigin(0.5);
    innerContainer.add(pageTitle);
    const leftArrow = this.add.image(-(panelWidth / 2) - 130, 0, "GJ_GameSheet03", "GJ_arrow_01_001.png")
        .setFlipX(false).setInteractive();
    innerContainer.add(leftArrow);
    const rightArrow = this.add.image((panelWidth / 2) + 130, 0, "GJ_GameSheet03", "GJ_arrow_01_001.png")
        .setInteractive().setFlipX(true);
    innerContainer.add(rightArrow);
    const column1X = -200;
    const column2X = 200;
    const checkOffset = -120;
    const textOffset = -70;
    const spacingY = 70;
    const startY = -150;
    let pageContainer = this.add.container(0, 0);
    innerContainer.add(pageContainer);

    const createToggle = (container, x, y, label, getVal, setVal, callback, fontSize, hasInfoBox, infoText) => {
        if (fontSize === undefined) fontSize = 25;
        if (hasInfoBox === undefined) hasInfoBox = false;
        if (infoText === undefined) infoText = null;

        var isOn = getVal();
        var checkTexture = isOn ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png";
        var check = this.add.image(x + checkOffset, y, "GJ_GameSheet03", checkTexture).setScale(0.8).setInteractive();
        var txt = this.add.bitmapText(x + textOffset, y, "bigFont", label, fontSize).setOrigin(0, 0.5);
        container.add([check, txt]);

        if (hasInfoBox) {
            if (infoText) {
                createInfoButton(container, x + checkOffset - 34, y - 30, infoText, 0.45);
            }
        }

        this._makeBouncyButton(check, 0.8, () => {
            var current = getVal();
            setVal(!current);
            var newTexture = getVal() ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png";
            check.setTexture("GJ_GameSheet03", newTexture);
            if (callback) {
                callback(getVal());
            }
            if (this._saveSettings) {
                this._saveSettings();
            }
        });
    };

    function TextToSay(key) {
        var normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
        return String(key);
    }

    var infotextstrings = {
        "Enable Portal Guide": "Enables extra indicators on portals.",
        "Enable Orb Guide": "Enables extra indicators on orbs.",
        "Practice Music Bypass": "Plays normal mode music in practice mode.",
        "Show Percentage": "Shows the percentage you are at in a level.",
        "Percentage Decimals": "Shows decimals in level progress.",
        "Startpos Switcher": "Switches between start positions in a level.",
        "Noclip": "Allows you to phase throught mostly anything that would kill you normally.",
        "Noclip Accuracy": "Flashes your screen red when you would've died with noclip.",
        "Macro Bot": "Lets you record and replay your inputs for a level.",
        "Show Hitboxes": "Shows you the hitboxes for objects and your player.",
        "Hitbox Trail": "Shows the hitbox of exactly where your hitbox has been.",
        "Hitboxes on Death": "Shows hitboxes upon death in both normal and practice mode.",
        "Show FPS": "Shows the frames per second your game is running at.",
        "Solid Wave Trail": "Removes the extra details of the wave trail.",
        "Show CPS": "Shows when you click in a level in the top left of your screen.",
        "Show Glow": "Shows glow for basic object sets.",
        "Use Proxy (for schools)": "Enables a proxy for a better chance to see online levels when blocked.",
        "Cull Distance": "Changes how many objects are shown. [DOES NOT SAVE!!]",
        "Default Mini Icon": "Sets player icon in min mode to default.",
        "Safe Mode": "Enables when Noclip or Speedhack are on. Disables level Completion when enabled."
    };

    const createInfoButton = (container, x, y, infoTextOrKey, scale) => {
        var key = String(infoTextOrKey || "");
        var words = TextToSay(key);
        var Infotext = null;
        if (window.settingInfoText && window.settingInfoText[words]) {
            Infotext = window.settingInfoText[words];
        } else if (infotextstrings[words]) {
            Infotext = infotextstrings[words];
        }
        var infoText = Infotext ? Infotext : key;
        if (!infoText) {
            return;
        }

        var infoButton = this.add.image(x, y, "GJ_GameSheet03", "GJ_infoIcon_001.png");
        infoButton.setScale(scale || 0.45);
        infoButton.setInteractive();
        container.add(infoButton);

        this._makeBouncyButton(infoButton, scale, () => {
            this.InfoBoxDoAThing(infoText);
        });
    };
    const createNumberInput = (container, x, y, label, getVal, setVal, minVal = 0, maxVal = 20, integer = true, hasInfoBox = false, infoText = null) => {
        const txt = this.add.bitmapText(x + textOffset, y, "bigFont", label, 25).setOrigin(0, 0.5);
        container.add(txt);

        if (hasInfoBox) {
            if (infoText) {
                createInfoButton(container, x + checkOffset - 38, y - 32, infoText, 0.45);
            }
        }

        const boxX = x + checkOffset;
        const boxY = y;
        const boxW = 64;
        const boxH = 48;

        const bgBoxGraphics = this.add.graphics();
        bgBoxGraphics.fillStyle(0x222222, 0.5);
        bgBoxGraphics.fillRoundedRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH, 8);
        container.add(bgBoxGraphics);

        const hitArea = this.add.rectangle(boxX, boxY, boxW, boxH, 0x000000, 0)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        container.add(hitArea);

        let initialVal = getVal();
        if (initialVal === undefined || initialVal === null) initialVal = minVal;
        const valueTxt = this.add.bitmapText(boxX, boxY, "bigFont", initialVal.toString(), 28)
            .setOrigin(0.5);
        container.add(valueTxt);

        let isFocused = false;
        let internalString = initialVal.toString();

        const updateDisplay = () => {
            if (isFocused) {
                valueTxt.setText(internalString + "|");
            } else {
                valueTxt.setText(internalString || " ");
            }
        };

        const commitValue = () => {
            isFocused = false;

            let val;
            if (integer) {
                val = parseInt(internalString, 10);
            } else {
                val = parseFloat(internalString);
            }
            if (isNaN(val)) val = minVal;

            if (val < minVal) val = minVal;
            if (val > maxVal) val = maxVal;

            internalString = integer ? String(Math.round(val)) : String(val);
            valueTxt.setText(internalString);
            
            setVal(val);
            if (this._saveSettings) this._saveSettings();
        };

        hitArea.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();
            
            if (window._activeCustomInput && window._activeCustomInput !== commitValue) {
                window._activeCustomInput();
            }

            isFocused = true;
            window._activeCustomInput = commitValue;
            
            internalString = ""; 
            updateDisplay();
        });

        const outsideClickListener = () => {
            if (isFocused) commitValue();
        };
        dim.on('pointerdown', outsideClickListener);

        const keydownListener = (event) => {
            if (!isFocused) return;

            const key = event.key;

            if (key === "Enter") {
                event.preventDefault();
                commitValue();
                return;
            }

            if (key === "Backspace") {
                event.preventDefault();
                internalString = internalString.slice(0, -1);
                updateDisplay();
                return;
            }

            if (/^[0-9.]$/.test(key)) {
                event.preventDefault();

                if (integer) {
                    if (key === ".") return;
                    internalString += key;
                } else {
                    if (key === ".") {
                        if (internalString.includes(".")) return;
                        if (internalString.length === 0) return;
                        internalString += key;
                    } else {
                        internalString += key;
                    }
                }

                updateDisplay();
            }
        };

        window.addEventListener('keydown', keydownListener);

        const originalDestroy = container.destroy;
        container.destroy = (...args) => {
            window.removeEventListener('keydown', keydownListener);
            if (dim) dim.off('pointerdown', outsideClickListener);
            if (window._activeCustomInput === commitValue) {
                window._activeCustomInput = null;
            }
            originalDestroy.apply(container, args);
        };
    };

    const buildGameplayPage = (container) => {
        createToggle(container, column1X, startY, "Show Percentage", 
            () => window.showPercentage, 
            (v) => window.showPercentage = v,
            (v) => { if (this._percentageLabel) this._percentageLabel.setVisible(v); },
            undefined,
            true,
            "Show Percentage"
        );

        createToggle(container, column1X, startY + spacingY, "Percentage Decimals", 
            () => window.percentageDecimals, 
            (v) => window.percentageDecimals = v,
            undefined,
            undefined,
            true,
            "Percentage Decimals"
        );

        createToggle(container, column1X, startY + (spacingY * 2), "StartPos Switcher", 
            () => window.startPosSwitcher, 
            (v) => window.startPosSwitcher = v,
            (v) => {
                if (!v) this._startPosIndex = -1;
                if (this._startPosGui) this._startPosGui.setVisible(v && this._level.getStartPositions().length > 0);
                const total = this._level.getStartPositions().length;
                if (this._startPosText) this._startPosText.setText(`0/${total}`);
            },
            undefined,
            25,
            "Startpos Switcher"
        );

        createToggle(container, column1X, startY + (spacingY * 3), "Noclip", 
            () => window.noClip, 
            (v) => window.noClip = v,
            (v) => { if (this._noclipIndicator) this._noclipIndicator.setVisible(v); },
            undefined,
            25,
            "Noclip"
        );
        
        createToggle(container, column1X, startY + (spacingY * 4), "Noclip Accuracy",
            () => window.noClipAccuracy,
            (v) => window.noClipAccuracy = v,
            null,
            25,
            true,
            "Noclip Accuracy"
        );
        
        createToggle(container, column1X, startY + (spacingY * 5), "Macro Bot",
            () => window.macroBot,
            (v) => window.macroBot = v,
            null,
            25,
            true,
            "Macro Bot"
        );

        createNumberInput(container, column2X, startY, "Speedhack", 
          () => window.speedHack, 
          (v) => window.speedHack = v,
          0.1,
          10,
          false
        );

        createToggle(container, column2X, startY + spacingY, "Practice Music Sync",
            () => window.practiceMusicSync,
            (v) => {
                const changed = !!window.practiceMusicSync !== !!v;
                window.practiceMusicSync = v;
                if (changed && !this._menuActive && this._practicedMode?.practiceMode) {
                    this._practiceBypassPending = true;
                }
            },
            null,
            20,
            true,
            "Practice Music Bypass"
        );
    };

    const buildVisualPage = (container) => {
        createToggle(container, column1X, startY, "Show Hitboxes", 
            () => window.showHitboxes, 
            (v) => window.showHitboxes = v,
            (v) => { 
                if (!v) {
                    this._player._hitboxGraphics.clear(); 
                } else {
                    this._player.drawHitboxes(this._player._hitboxGraphics, this._cameraX, this._cameraY);
                }
            },
            undefined,
            25,
            "Show Hitboxes"
        );

        createToggle(container, column1X, startY + (spacingY), "Hitbox Trail", 
            () => window.showHitboxTrail, 
            (v) => window.showHitboxTrail = v,
            (v) => { if (window.showHitboxes) this._player.drawHitboxes(this._player._hitboxGraphics, this._cameraX, this._cameraY); },
            undefined,
            25,
            "Hitbox Trail"
        );
        
        createToggle(container, column1X, startY + (spacingY * 2), "Hitboxes on Death", 
            () => window.hitboxesOnDeath, 
            (v) => window.hitboxesOnDeath = v,
            undefined,
            undefined,
            true,
            "Hitboxes on Death"
        );

        createToggle(container, column1X, startY + (spacingY * 3), "Show FPS", 
            () => this._fpsText.visible, 
            (v) => this._fpsText.visible = v,
            (v) => { if (this._fpsText) this._fpsText.setVisible(v); },
            undefined,
            25,
            "Show FPS"
        );

        createToggle(container, column1X, startY + (spacingY * 4), "Solid Wave Trail", 
            () => window.solidWave, 
            (v) => window.solidWave = v,
            null,
            25,
            true,
            "Solid Wave Trail"
        );
        
        createToggle(container, column1X, startY + (spacingY * 5), "Show CPS",
            () => window.showCPS,
            (v) => window.showCPS = v,
            null,
            25,
            true,
            "Show CPS"
        );

        createToggle(container, column2X, startY, "Show Glow", 
            () => window.showGlow, 
            (v) => window.showGlow = v,
            () => { if (this._level && this._level._updateGlowVisibility) this._level._updateGlowVisibility(); },
            undefined,
            25,
            "Show Glow"
        );

        createToggle(container, column2X, startY + spacingY, "Create Object ID labels", 
            () => window.createObjectIds, 
            (v) => window.createObjectIds = v,
            null, 17
        );

        createToggle(container, column2X, startY + (spacingY * 2), "Show Object ID labels", 
            () => window.showObjectIds, 
            (v) => window.showObjectIds = v,
            null, 17
        );
        createToggle(container, column2X, startY + (spacingY * 3), "Enable Portal Guide", 
            () => window.enablePortalGuide, 
            (v) => window.enablePortalGuide = v,
            null, 22,
            true,
            "Enable Portal Guide"
        );
        createToggle(container, column2X, startY + (spacingY * 4), "Enable Orb Guide", 
            () => window.enableOrbGuide, 
            (v) => window.enableOrbGuide = v,
            null,
            25,
            true,
            "Enable Orb Guide"
        );
          createToggle(container, column2X, startY + (spacingY * 5), "Default Mini Icon", 
            () => window.enableMiniIcon, 
            (v) => window.enableMiniIcon = v,
            null, //broken script refrence???? null??? 
            25,
            true,
            "Default Mini Icon"
        );
    };

    const buildAdvancedPage = (container) => {
        createToggle(container, column1X, startY, "Use Proxy (for schools)",
            () => !window.useDirectInternet,
            (v) => { window.useDirectInternet = !v; },
            null,
            22,
            true,
            "Use Proxy (for schools)"
        );/*
          createToggle(container, column1X, startY + (spacingY * 1), "Safe Mode",
            () => !window.enablesafemode,
            (v) => { window.enablesafemode = !v; },
            null,
            22,
            true,
            "Safe Mode"
            
        );
        */
    };

        const buildPerformancePage = (container) => {
        createNumberInput(container, column1X, startY, "Cull Distance",
          () => (typeof window.cullDistance !== 'undefined' ? window.cullDistance : 3),
          (v) => window.cullDistance = v,
          0,
          3,
          true,
          true,
          "Cull Distance"
        );
    };

    const buildPage = (idx) => {
        pageContainer.destroy();
        pageContainer = this.add.container(0, 0);
        innerContainer.add(pageContainer);
        pageTitle.setText(pages[idx]);
        
        if (idx === 0) buildGameplayPage(pageContainer);
        else if (idx === 1) buildVisualPage(pageContainer);
        else if (idx === 2) buildAdvancedPage(pageContainer);
        else if (idx === 3) buildPerformancePage(pageContainer);
    };

    buildPage(0);

    this._makeBouncyButton(leftArrow, 1, () => {
        currentPage = (currentPage - 1 + pages.length) % pages.length;
        buildPage(currentPage);
    });

    this._makeBouncyButton(rightArrow, 1, () => {
        currentPage = (currentPage + 1) % pages.length;
        buildPage(currentPage);
    });
    this.tweens.add({
        targets: innerContainer,
        scale: 1,
        duration: 660,
        ease: "Elastic.Out",
        easeParams: [1, 0.6]
    });
  }
  _saveSettings() {
    const settings = {
        noclip: window.noClip,
        showPercentage: window.showPercentage,
        percentDecimals: window.percentageDecimals,
        showHitboxes: window.showHitboxes,
        startPosSwitcher: window.startPosSwitcher,
        hitboxTrail: window.showHitboxTrail,
        showFPS: this._fpsText.visible,
        solidWaveTrail: window.solidWave,
        noclipAccuracy: window.noClipAccuracy,
        hitboxesOnDeath: window.hitboxesOnDeath,
        createObjectIds: window.createObjectIds,
        showObjectIds: window.showObjectIds,
        showCPS: window.showCPS,
        speedHack: window.speedHack,
        macroBot: window.macroBot,
        practiceMusicSync: window.practiceMusicSync,
        showGlow: window.showGlow,
        showEditorGlow: window.showEditorGlow,
        useDirectInternet: !!window.useDirectInternet,
        enablePortalGuide: window.enablePortalGuide,
        enableOrbGuide: window.enableOrbGuide,
        enableMiniIcon: window.enableMiniIcon,
        cullDistance: window.cullDistance,
        settingInfoText: window.settingInfoText || {},
        enableLDM: window.enableLDM,
        noParticles: !!window.noParticles,
        hidePlayer: !!window.hidePlayer,
    };
    localStorage.setItem("gd_settings", JSON.stringify(settings));
    localStorage.setItem("gd_useDirectInternet", String(!!window.useDirectInternet));
  }
  _loadSettings() {
    const saved = localStorage.getItem("gd_settings");
    const defaults = {
        noclip: false,
        showPercentage: true,
        percentDecimals: false,
        showHitboxes: false,
        startPosSwitcher: false,
        hitboxTrail: false,
        showFPS: false,
        solidWaveTrail: false,
        noclipAccuracy: false,
        hitboxesOnDeath: false,
        createObjectIds: false,
        showObjectIds: false,
        showCPS: false,
        speedHack: 1.0,
        macroBot: false,
        practiceMusicSync: false,
        showGlow: true,
        showEditorGlow: false,
        useDirectInternet: true,
        enablePortalGuide: true,
        enableOrbGuide: false,
        enableMiniIcon: false,
        enableLDM: false,
        cullDistance: 3
    };

    const data = { ...defaults, ...(saved ? JSON.parse(saved) : {}) };

    window.noClip = data.noclip;
    window.showPercentage = data.showPercentage;
    window.percentageDecimals = data.percentDecimals;
    window.showHitboxes = data.showHitboxes;
    window.startPosSwitcher = data.startPosSwitcher;
    window.showHitboxTrail = data.hitboxTrail;
    this._fpsText.visible = (window.GDHacks?.state.fpsEnabled ?? data.showFPS) && !window.eclipseHideLabels;
    window.solidWave = data.solidWaveTrail;
    window.noClipAccuracy = data.noclipAccuracy;
    window.hitboxesOnDeath = data.hitboxesOnDeath;
    window.showCPS = data.showCPS;
    window.speedHack = data.speedHack;
    window.macroBot = data.macroBot;
    window.practiceMusicSync = !!data.practiceMusicSync;
    window.showGlow = data.showGlow;
    window.showEditorGlow = data.showEditorGlow;
    window.createObjectIds = data.createObjectIds;
    window.showObjectIds = data.showObjectIds;
    window.enablePortalGuide = data.enablePortalGuide;
    window.enableOrbGuide = data.enableOrbGuide;
    window.enableMiniIcon = data.enableMiniIcon;
    window.cullDistance = typeof data.cullDistance !== 'undefined' ? data.cullDistance : 3;
    window.settingInfoText = data.settingInfoText || {};
    window.useDirectInternet = !!data.useDirectInternet;
    localStorage.setItem("gd_useDirectInternet", String(!!window.useDirectInternet));
    window.enableLDM = !!data.enableLDM;
    window.noParticles = !!data.noParticles;
    window.hidePlayer = !!data.hidePlayer;
    window.orbClickScale = 1.35;
  }
  _buildMacroPopup() {
      if (this._macroPopup) return;
      const centerX = screenWidth / 2;
      const centerY = 320;
      const panelWidth = 800;
      const panelHeight = 400;
      this._macroPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(250);
      const dim = this.add.rectangle(centerX, centerY, screenWidth, screenHeight, 0x000000, 150 / 255).setInteractive();
      this._macroPopup.add(dim);

      const corner = 0.325 * this.textures.get("GJ_square02").source[0].width;
      const panel = this._drawScale9(centerX, centerY, panelWidth, panelHeight, "GJ_square02", corner, 0xffffff, 1);
      this._macroPopup.add(panel);

      this._macroPopup.add(this.add.bitmapText(centerX, centerY - (panelHeight / 2) + 45, "bigFont", "Web Bot v2.1", 40).setOrigin(0.5));

      if (this._macroName === undefined) {  
          this._macroName = this._macroBot?.meta?.name || null;
      }
      if (this._macroLoaded === undefined) {
          this._macroLoaded = !!this._macroName || (this._macroBot && this._macroBot.frames && this._macroBot.frames.length > 0);
      }

      const loadedNameText = this.add.bitmapText(centerX, centerY - (panelHeight / 2) + 95, "goldFont", this._macroLoaded ? `Currently loaded "${this._macroName || 'macro'}"` : "No macro loaded", 24).setOrigin(0.5);
      this._macroPopup.add(loadedNameText);

      const optionsBtn = this.add.image(centerX, centerY - (panelHeight / 2) + 95, "GJ_GameSheet03", "GJ_optionsBtn02_001.png").setInteractive().setScale(0.45);
      this._macroPopup.add(optionsBtn);

      const closeBtn = this.add.image(centerX - (panelWidth / 2) + 20, centerY - (panelHeight / 2) + 20, "GJ_WebSheet", "GJ_closeBtn_001.png").setInteractive().setScale(0.8);
      this._macroPopup.add(closeBtn);

      this._makeBouncyButton(closeBtn, 0.8, () => {
          this.events.off("update", this._refreshMacroButtons);
          this._macroPopup.destroy();
          this._macroPopup = null;
      });

      const importBtn = this.add.image(centerX - 300, centerY + 20,"importMacro").setInteractive();
      const exportBtn = this.add.image(centerX - 150, centerY + 20, "GJ_GameSheet03", "GJ_shareBtn_001.png").setInteractive().setScale(0.53);
      const createBtn = this.add.image(centerX, centerY + 20, "GJ_GameSheet03", "GJ_plusBtn_001.png").setInteractive().setScale(1.2);
      const playbackBtn = this.add.image(centerX + 150, centerY + 20, this._macroBot?.playing ? "stopPlayback" : "playbackMacro").setInteractive().setScale(0.25);
      const recordBtn = this.add.image(centerX + 300, centerY + 20, this._macroBot?.recording ? "stopRecord" : "recordMacro").setInteractive().setScale(0.25);

      this._macroPopup.add([createBtn, importBtn, exportBtn, playbackBtn, recordBtn]);

      this._refreshMacroButtons = () => {
          const playing = !!this._macroBot?.playing;
          const recording = !!this._macroBot?.recording;

          let currentMetaName = this._macroBot?.meta?.name;
          if (currentMetaName && currentMetaName !== this._macroName) {
              this._macroName = currentMetaName;
              this._macroLoaded = true;
          }

          if (this._macroLoaded) {
              loadedNameText.setText(`Currently loaded "${this._macroName || 'macro'}"`);
              optionsBtn.setAlpha(1).setActive(true);
              optionsBtn.x = centerX + (loadedNameText.width / 2) + 25;
          } else {
              loadedNameText.setText("No macro loaded");
              optionsBtn.setAlpha(0).setActive(false);
          }

          playbackBtn.setTexture(
              playing
                  ? "stopPlayback"
                  : "playbackMacro"
          );

          recordBtn.setTexture(
              recording
                  ? "stopRecord"
                  : "recordMacro"
          );

          createBtn.setAlpha((playing || recording || this._macroLoaded) ? 0.5 : 1);
          importBtn.setAlpha((playing || recording) ? 0.5 : 1);
          exportBtn.setAlpha((playing || recording || !this._macroLoaded) ? 0.5 : 1);
          playbackBtn.setAlpha((recording || !this._macroLoaded) ? 0.5 : 1);
          recordBtn.setAlpha((playing || !this._macroLoaded) ? 0.5 : 1);
      };

      this._refreshMacroButtons();

      this._makeBouncyButton(optionsBtn, 0.45, () => {
          if (!this._macroLoaded) return;
          const renamePrompt = prompt("New name", this._macroName);
          if (renamePrompt && renamePrompt.trim() !== "") {
              const cleanName = renamePrompt.trim();
              if (!this._macroBot) this._initMacroBot();
              
              if (!this._macroBot.meta) {
                  this._macroBot.meta = {};
              }
              this._macroBot.meta.name = cleanName;
              this._macroName = cleanName;
              this._refreshMacroButtons();
          }
      });

      this._makeBouncyButton(importBtn, 1, () => {
          if (this._macroBot?.playing) return;
          if (this._macroBot?.recording) return;
          this._importMacroFile();
      });

      this._makeBouncyButton(exportBtn, 0.53, () => {
          if (this._macroBot?.playing) return;
          if (this._macroBot?.recording) return;
          if (!this._macroLoaded) return;
          this._exportMacroFile(this._macroName ? `${this._macroName}.wbgdr2` : null);
      });

      this._makeBouncyButton(createBtn, 1.2, () => {
          if (this._macroBot?.playing || this._macroBot?.recording || this._macroLoaded) return;
          const name = prompt("Enter macro name");
          if (name) {
              if (!this._macroBot) this._initMacroBot();
              this._macroBot.resetAll();
              this._macroBot.meta.name = name;
              this._macroName = name;
              this._macroLoaded = true;
              this._refreshMacroButtons();
          }
      });

      this._makeBouncyButton(playbackBtn, 0.25, () => {
          if (this._macroBot?.recording) return;
          if (!this._macroLoaded) return;

          if (this._macroBot?.playing) {
              this._stopMacroPlayback();
          } else {
              if (!this._macroBot) {
                  return;
              }
              const macro = this._macroBot.exportObject();
              this._startMacroPlayback(macro);
          }
          this._refreshMacroButtons();
      });

      this._makeBouncyButton(recordBtn, 0.25, () => {
          if (this._macroBot?.playing) return;
          if (!this._macroLoaded) return;

          if (this._macroBot?.recording) {
              this._stopMacroRecording();
          } else {
              this._startMacroRecording({
                  level: window.currentlevel?.[2] || "",
                  name: this._macroName
              });
          }

          this._refreshMacroButtons();
      });

      this.events.on("update", this._refreshMacroButtons);
  }
  _buildInfoPopup() {
    if (this._infoPopup) {
      return;
    }
    const xPos = screenWidth / 2;
    const popupHeight = 320;
    const popupWidth = 336;
    this._infoPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const background = this.add.rectangle(xPos, popupHeight, screenWidth, screenHeight, 0, 100 / 255);
    background.setInteractive();
    this._infoPopup.add(background);
    
    const bounceContainer = this.add.container(xPos, popupHeight).setScale(0);
    this._infoPopup.add(bounceContainer);
    const cornerRadius = this.textures.get("GJ_square02").source[0].width * 0.325;
    const popupBg = this._drawScale9(0, 0, 480, popupWidth, "GJ_square02", cornerRadius, 16777215, 1);
    bounceContainer.add(popupBg);
    const closeBtn = this.add.image(-240 + 20, -148, "GJ_WebSheet", "GJ_closeBtn_001.png").setScale(0.8).setInteractive();
    bounceContainer.add(closeBtn);
    this._expandHitArea(closeBtn, 2);
    this._makeBouncyButton(closeBtn, 0.8, () => this._closeInfoPopup());
    const title = this.add.bitmapText(0, -124, "bigFont", "Credits", 42).setOrigin(0.5, 0.6);
    bounceContainer.add(title);
    const scrollAreaW = 420;
    const scrollAreaH = 230;
    const scrollAreaX = 0;
    const scrollAreaY = 20;
    const scrollFrameBg = this.add.graphics();
    scrollFrameBg.fillStyle(0x000000, 0.18);
    scrollFrameBg.fillRoundedRect(scrollAreaX - scrollAreaW / 2, scrollAreaY - scrollAreaH / 2, scrollAreaW, scrollAreaH, 8);
    bounceContainer.add(scrollFrameBg);
    const contentContainer = this.add.container(0, scrollAreaY - scrollAreaH / 2 + 8);
    bounceContainer.add(contentContainer);
    
    const creditsEntries = [
      { text: "Made by RobTop Games", scale: 0.8, font: "goldFont" },
      { text: "Modded by:", scale: 0.9, font: "bigFont" },
      { text: "breadbb, PinkDev, rohanis0000,", scale: 0.7, font: "goldFont" },
      { text: "bog, Lasokar, AntiMatter,", scale: 0.7, font: "goldFont" },
      { text: "arbstro, and aloaf", scale: 0.7, font: "goldFont" },
      { text: "Contributors:", scale: 0.9, font: "bigFont" },
      { text: "t0nchi7, Itzar, zainojdaf,", scale: 0.7, font: "goldFont" },
      { text: "Ameth7st, and CoraBitz", scale: 0.7, font: "goldFont" },
      { text: "we love you cora <3", scale: 0.4, font: "bigFont" },
      { text: "© 2026 RobTop Games. All rights reserved.", scale: 0.4, font: "Arial", color: 0x000000 },
    ]; 
    let yPos = 0;
    const lineItems = [];
    creditsEntries.forEach(entry => {
      let txt;
      if (entry.font === "Arial") {
        txt = this.add.text(0, yPos, entry.text, {
          fontSize: `${Math.round(32 * (entry.scale || 0.65))}px`,
          fontFamily: "Arial",
          color: entry.color ? `#${entry.color.toString(16).padStart(6, '0')}` : "#ffffff"
        }).setOrigin(0.5, 0);
      } else {
        txt = this.add.bitmapText(0, yPos, entry.font || "bigFont", entry.text, 32)
          .setOrigin(0.5, 0)
          .setScale(entry.scale || 0.65);
        if (entry.color != null) txt.setTint(entry.color);
      }
      contentContainer.add(txt);
      lineItems.push(txt);
      yPos += Math.round(32 * (entry.scale || 0.65)) + 10;
    });
    const totalContentH = yPos;
    const maxScrollDown = Math.max(0, totalContentH - scrollAreaH + 16);
    const maskGraphics = this.add.graphics();
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff, 1);
    const updateMask = () => {
      if (!bounceContainer || !bounceContainer.active) return;
      const wx = xPos + bounceContainer.x - xPos;
      const s = bounceContainer.scaleX;
      const bwx = xPos;
      const bwy = popupHeight;
      maskShape.clear();
      maskShape.fillRect(
        bwx + (scrollAreaX - scrollAreaW / 2) * s,
        bwy + (scrollAreaY - scrollAreaH / 2) * s,
        scrollAreaW * s,
        scrollAreaH * s
      );
    };
    const geomMask = maskShape.createGeometryMask();
    contentContainer.setMask(geomMask);
    const maskUpdateEvent = this.events.on('postupdate', updateMask);
    let scrollY = 0;
    const baseContentY = scrollAreaY - scrollAreaH / 2 + 8;
    const applyScroll = () => {
      contentContainer.y = baseContentY - scrollY;
    };
    applyScroll();
    const scrollZone = this.add.zone(scrollAreaX, scrollAreaY, scrollAreaW, scrollAreaH).setInteractive();
    bounceContainer.add(scrollZone);
    scrollZone.on('wheel', (_p, _dx, deltaY) => {
      scrollY = Phaser.Math.Clamp(scrollY + deltaY * 0.6, 0, maxScrollDown);
      applyScroll();
    });

    let dragStartY = 0;
    let dragStartScroll = 0;
    scrollZone.on('pointerdown', (pointer) => {
      dragStartY = pointer.y;
      dragStartScroll = scrollY;
    });
    scrollZone.on('pointermove', (pointer) => {
      if (pointer.isDown) {
        const dy = dragStartY - pointer.y;
        scrollY = Phaser.Math.Clamp(dragStartScroll + dy, 0, maxScrollDown);
        applyScroll();
      }
    });
    this._infoPopupCleanup = () => {
      this.events.off('postupdate', updateMask);
      maskShape.destroy();
      geomMask.destroy();
    };
    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
        this._infoPopupCleanup = () => {
      this.events.off('postupdate', updateMask);
      maskShape.destroy();
      geomMask.destroy();
    };
    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeInfoPopup() {
    if (this._infoPopup) {
      if (this._infoPopupCleanup) {
        this._infoPopupCleanup();
        this._infoPopupCleanup = null;
      }
      this._infoPopup.destroy();
      this._infoPopup = null;
        }
    this._infogoaway = () => {
      this.events.off('postupdate', updateMask);
      maskShape.destroy();
      geomMask.destroy();
    };
    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeInfoPopup() {
    if (this._infoPopup) {
      if (this._infogoaway) {
        this._infogoaway();
        this._infogoaway = null;
      }
      this._infoPopup.destroy();
      this._infoPopup = null;
    }
  } //im so tired of this
  _showReqpopup() {
    if (this._reqpopup) {
      return;
    }

    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    const popupWidth = 475;
    const popupContentHeight = 230;
    this._reqpopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 100 / 255).setInteractive();
    this._reqpopup.add(background);

    const bounceContainer = this.add.container(xPos, centerY).setScale(0);
    this._reqpopup.add(bounceContainer);

    const cornerRadius = this.textures.get("GJ_square02").source[0].width * 0.325;
    const popupBg = this._drawScale9(0, 0, popupWidth, popupContentHeight, "GJ_square02", cornerRadius, 16777215, 1);
    bounceContainer.add(popupBg);

    const closeBtn = this.add.image(-(popupWidth / 2) + 20, -(popupContentHeight / 2) + 20, "GJ_WebSheet", "GJ_closeBtn_001.png").setScale(0.95).setInteractive();
    bounceContainer.add(closeBtn);
    this._makeBouncyButton(closeBtn, 0.95, () => this._closeReqPopup());

    const fakeloading = this.add.image(0, -10, "loadingCircle").setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    bounceContainer.add(fakeloading);

    const statusText = this.add.text(0, popupContentHeight / 2 - 40, " Loading...", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(statusText);

    const spinTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!fakeloading.scene) {
          spinTimer.remove();
          return;
        }
        fakeloading.rotation += 0.1;
      }
    });

    const failTimer = this.time.delayedCall(5000, () => {
      if (!fakeloading.scene || !statusText.scene) return;
      spinTimer.remove();
      fakeloading.clearTint();
      fakeloading.setBlendMode(Phaser.BlendModes.NORMAL);
      fakeloading.setAlpha(1);
      fakeloading.setTexture("GJ_GameSheet03", "exMark_001.png");
      fakeloading.setRotation(0);
      fakeloading.setScale(1.25);
      fakeloading.y = -25;
      statusText.setText("Failed. Please try again never. ");
    });

    this._reqpopupexit = () => {
      spinTimer.remove();
      failTimer.remove();
    };

    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeReqPopup() {
    if (this._reqpopup) {
      if (this._reqpopupexit) {
        this._reqpopupexit();
        this._reqpopupexit = null;
      }
      this._reqpopup.destroy();
      this._reqpopup = null;
    }
    }
  _showcontactpopup() {
    if (this._reqpopup) {
      return;
    }

    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    const popupWidth = 500;
    const popupContentHeight = 250;
    this._reqpopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 100 / 255).setInteractive();
    this._reqpopup.add(background);

    const bounceContainer = this.add.container(xPos, centerY).setScale(0);
    this._reqpopup.add(bounceContainer);

    const cornerRadius = this.textures.get("GJ_square02").source[0].width * 0.325;
    const popupBg = this._drawScale9(0, 0, popupWidth, popupContentHeight, "GJ_square02", cornerRadius, 16777215, 1);
    bounceContainer.add(popupBg);

    const closeBtn = this.add.image(-(popupWidth / 2) + 20, -(popupContentHeight / 2) + 20, "GJ_WebSheet", "GJ_closeBtn_001.png").setScale(1).setInteractive();
    bounceContainer.add(closeBtn);
    this._makeBouncyButton(closeBtn, 1, () => this._closeReqPopup());

    const lock = this.add.image(0, 110, "GJ_GameSheet03", "GJ_lockGray_001.png").setOrigin(0.5).setSize(1.5);
    bounceContainer.add(lock);


    const statusText = this.add.text(0, popupContentHeight / 2 - 90, "Or, call 480-957-8838 for more info.", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(statusText);

    
    const statusText2 = this.add.text(0, popupContentHeight / 2 - 130, "Message pinkdevyt on Discord,", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(statusText2);

    const statusText3 = this.add.text(0, popupContentHeight / 2 - 170, "Message ameth7st_nya on Discord,", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(statusText3);

    const statusText4 = this.add.text(0, popupContentHeight / 2 - 210, "Message lasokar on Discord,", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(statusText4);

    const statusText5 = this.add.text(0, popupContentHeight / 2 - 50, "(Pinkdev's real phone number btw)", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#92a7c0",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(statusText5);


    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }

_showwippopup() {
    if (this._reqpopup) {
      return;
    }

    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    const popupWidth = 500;
    const popupContentHeight = 200;
    this._reqpopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 100 / 255).setInteractive();
    this._reqpopup.add(background);

    const bounceContainer = this.add.container(xPos, centerY).setScale(0);
    this._reqpopup.add(bounceContainer);

    const cornerRadius = this.textures.get("GJ_square02").source[0].width * 0.325;
    const popupBg = this._drawScale9(0, 0, popupWidth, popupContentHeight, "GJ_square02", cornerRadius, 16777215, 1);
    bounceContainer.add(popupBg);

    const closeBtn = this.add.image(-(popupWidth / 2) + 20, -(popupContentHeight / 2) + 20, "GJ_WebSheet", "GJ_closeBtn_001.png").setScale(1).setInteractive();
    bounceContainer.add(closeBtn);
    this._makeBouncyButton(closeBtn, 1, () => this._closeReqPopup());

    const allroadsleadtoparticles = this.add.image(0, 100, "GJ_GameSheet03", "GJ_timeIcon_001.png").setOrigin(0.5).setSize(1.5);
    bounceContainer.add(allroadsleadtoparticles);


    const text = this.add.text(0, popupContentHeight / 2 - 150, "Coming in another pr later!-", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#92a7c0",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(text);

    const text1 = this.add.text(0, popupContentHeight / 2 - 100, "This is still being worked on.", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(text1);

    const text2 = this.add.text(0, popupContentHeight / 2 - 50, "Expect this to be finished with particles.", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#92a7c0",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(text2);


    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }

  _closeReqPopup() {
    if (this._reqpopup) {
      if (this._reqpopupexit) {
        this._reqpopupexit();
        this._reqpopupexit = null;
      }
      this._reqpopup.destroy();
      this._reqpopup = null;
    }
  }
  InfoBoxDoAThing(displayText) {
    if (this.EditInfoText) {
      this.InfoBoxStopAThing();
    }

    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    this.EditInfoText = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 0.5).setInteractive();
    this.EditInfoText.add(background);

    const box = this.add.container(xPos, centerY).setScale(0);
    this.EditInfoText.add(box);

    const cornerRadius = this.textures.get("GJ_square01").source[0].width * 0.325;
    const boxWidth = 720;
    const boxHeight = 280;
    box.add(this._drawScale9(0, 0, boxWidth, boxHeight, "square01_001", cornerRadius, 0xffffff, 1));
    box.add(this.add.bitmapText(-4, -90, "goldFont", "Info", 45).setOrigin(0.5));

    const textAreaW = boxWidth - 60;
    const textAreaH = boxHeight - 140;

    const wrapText = (text, maxChars) => {
      const words = String(text).split(" ");
      const lines = [];
      let line = "";
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if ((line + (line ? " " : "") + word).length <= maxChars) {
          line = line ? `${line} ${word}` : word;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    const infoText = String(displayText || "");
    const wrappedText = wrapText(infoText, 40);
    let y = -30;

    wrappedText.forEach(line => {
      box.add(this.add.text(0, y, line, {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#ffffff",
        align: "center"
      }).setOrigin(0.5, 0));
      y += 32;
    });

    const okBtnBg = this._drawScale9(0, 0, 100, 60, "GJ_button01", this.textures.get("GJ_button01").source[0].width * 0.3, 0xffffff, 1);
    const okBtn = this.add.rectangle(0, 0, 100, 60).setInteractive();
    const okLabel = this.add.bitmapText(0, 0, "goldFont", "OK", 48).setOrigin(0.55);
    const okGroup = this.add.container(0, boxHeight / 2 - 50, [okBtnBg, okBtn, okLabel]);
    okBtn._bouncyVisualTarget = okGroup;
    box.add(okGroup);

    this._makeBouncyButton(okBtn, 1.0, () => {
      this.InfoBoxStopAThing();
    });

    this.tweens.add({
      targets: box,
      scale: { from: 0, to: 1 },
      duration: 280,
      ease: "Back.Out"
    });
  }
  InfoBoxStopAThing() {
    if (!this.EditInfoText) return;

    if (this._infoEscKey) {
      this._infoEscKey.off('down', this._infoEscHandler);
      this._infoEscKey.destroy();
      this._infoEscKey = null;
      this._infoEscHandler = null;
    }

    this.EditInfoText.destroy();
    this.EditInfoText = null;
  }
 _buildHowToPlayPopup() {
  if (this._howToPlayPopup) {
    return;
  }
  const TUTORIAL_PAGES = ["tutorial_01", "tutorial_02", "tutorial_03", "tutorial_04", "tutorial_05"];
  const GREEN  = 0x00e719;
  const YELLOW = 0xf8ff00;
  const BLUE   = 0x3cadf5;
  const TUTORIAL_DESCRIPTIONS = [
    { fontSize: 40, lines: [
      [{ text: "TAP", color: GREEN }, { text: " the screen to jump." }],
      [{ text: "HOLD", color: GREEN }, { text: " down to keep jumping." }]
    ]},
    { fontSize: 40, lines: [
      [{ text: "Hold", color: GREEN }, { text: " to fly up." }],
      [{ text: "Release", color: GREEN }, { text: " to fly down." }]
    ]},
    { fontSize: 35, lines: [
      [{ text: "You can enter " }, { text: "practice mode", color: BLUE }, { text: " from" }],
      [{ text: "the pause menu." }],
      [{ text: "Practice mode lets you place" }],
      [{ text: "checkpoints", color: GREEN }, { text: "." }]
    ]},
    { fontSize: 35, lines: [
      [{ text: "You can place checkpoints manually, or" }],
      [{ text: "use the auto-checkpoints feature." }],
      [{ text: "Tap the delete button to remove your" }],
      [{ text: "last checkpoint." }]
    ]},
    { fontSize: 35, lines: [
      [{ text: "Jump Orbs", color: YELLOW }, { text: " activate when you are on" }],
      [{ text: "top of them." }],
      [{ text: "TAP", color: GREEN }, { text: " while touching an orb to" }],
      [{ text: "interact with it and use its effect." }]
    ]}
  ];
  const TOTAL_PAGES = TUTORIAL_PAGES.length;
  let currentPage = 0;

  const xPos = screenWidth / 2;
  const _0x4c3182 = 320;
  this._howToPlayPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(300);
  const _0x249eb7 = this.add.rectangle(xPos, _0x4c3182, screenWidth, screenHeight, 0, 100 / 255);
  _0x249eb7.setInteractive();
  this._howToPlayPopup.add(_0x249eb7);
  const _0x14e46f = this.textures.get("GJ_square01").source[0].width * 0.325;
  const panelContainer = this.add.container(xPos, _0x4c3182);
  this._howToPlayPopup.add(panelContainer);
  const _0x2c64c2 = this._drawScale9(0, 0, 830, 530, "GJ_square01", _0x14e46f, 16777215, 1);
  panelContainer.add(_0x2c64c2);
  const _0x5a0f88 = this.add.image(-240 - 160, 172 - _0x4c3182 - 110, "GJ_WebSheet", "GJ_closeBtn_001.png").setScale(0.8).setInteractive();
  this._expandHitArea(_0x5a0f88, 2);
  this._makeBouncyButton(_0x5a0f88, 0.8, () => this._closeHowToPlayPopup());
  panelContainer.add(_0x5a0f88);
  const howToPlayTitle = this.add.bitmapText(0, -210, "bigFont", "How To Play", 62).setOrigin(0.5, 0.5);
  panelContainer.add(howToPlayTitle);
  const DESC_TOP_Y = -195;
  const DESC_BOT_Y = 15;
  const DESC_MAX_H = DESC_BOT_Y - DESC_TOP_Y;

  let descLineObjects = [];

  const _buildDescLines = (pageIndex) => {
    for (const obj of descLineObjects) obj.destroy();
    descLineObjects = [];

    const page = TUTORIAL_DESCRIPTIONS[pageIndex];
    if (!page || !page.lines.length) return;

    const fontSize = page.fontSize;
    const lineSpacing = 0.35;
    const lineH = fontSize * (1 + lineSpacing);
    const startY = DESC_TOP_Y + fontSize / 0.5;

    for (let i = 0; i < page.lines.length; i++) {
      const segments = page.lines[i];
      const lineY = startY + i * lineH;
      if (segments.length === 1 && !segments[0].color) {
        const obj = this.add.bitmapText(0, lineY, "bigFont", segments[0].text, fontSize)
          .setOrigin(0.5, 0.5);
        panelContainer.add(obj);
        descLineObjects.push(obj);
        continue;
      }
      const measured = segments.map(seg => {
        const tmp = this.add.bitmapText(0, -9999, "bigFont", seg.text, fontSize);
        const w = tmp.width;
        tmp.destroy();
        return w;
      });
      const totalW = measured.reduce((a, b) => a + b, 0);
      let curX = -totalW / 2;

      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        const obj = this.add.bitmapText(curX, lineY, "bigFont", seg.text, fontSize)
          .setOrigin(0, 0.5);
        if (seg.color) obj.setTint(seg.color);
        panelContainer.add(obj);
        descLineObjects.push(obj);
        curX += measured[s];
      }
    }
  };

  _buildDescLines(0);
  const tutorialImage = this.add.image(-240 + 150, 155, TUTORIAL_PAGES[0]);
  panelContainer.add(tutorialImage);
  const nextGroup = this.add.container(-240 + 550, 165);
  const nextBtnW = 125, nextBtnH = 80;
  const nextBtnBorder = this.textures.get("GJ_button01").source[0].width * 0.3;
  const nextBtn9 = this._drawScale9(0, 0, nextBtnW, nextBtnH, "GJ_button01", nextBtnBorder, 0xffffff, 1);
  const nextBtn = this.add.rectangle(0, 0, nextBtnW, nextBtnH).setInteractive();
  const nextLabel = this.add.bitmapText(-5, -2.5, "bigFont", "Next", 35).setOrigin(0.5, 0.5);
  nextGroup.add(nextBtn9);
  nextGroup.add(nextBtn);
  nextGroup.add(nextLabel);
  panelContainer.add(nextGroup);

  nextBtn.on("pointerdown", () => {
    nextGroup._pressed = true;
    this.tweens.killTweensOf(nextGroup);
    this.tweens.add({ targets: nextGroup, scaleX: 1.26, scaleY: 1.26, duration: 300, ease: "Bounce.Out" });
  });
  nextBtn.on("pointerout", () => {
    if (nextGroup._pressed) {
      nextGroup._pressed = false;
      this.tweens.killTweensOf(nextGroup);
      this.tweens.add({ targets: nextGroup, scaleX: 1, scaleY: 1, duration: 400, ease: "Bounce.Out" });
    }
  });
  nextBtn.on("pointerup", () => {
    if (!nextGroup._pressed) return;
    nextGroup._pressed = false;
    this.tweens.killTweensOf(nextGroup);
    nextGroup.setScale(1);

    if (currentPage >= TOTAL_PAGES - 1) {
      this._closeHowToPlayPopup();
    } else {
      currentPage++;
      tutorialImage.setTexture(TUTORIAL_PAGES[currentPage]);
      _buildDescLines(currentPage);
      nextLabel.setText(currentPage >= TOTAL_PAGES - 1 ? "Exit" : "Next");
    }
  });
  panelContainer.setScale(0);
  this.tweens.add({
    targets: panelContainer,
    scale: 1,
    duration: 660,
    ease: "Elastic.Out",
    easeParams: [1, 0.6]
  });
}
  _closeHowToPlayPopup() {
    if (this._howToPlayPopup) {
      this._howToPlayPopup.destroy();
      this._howToPlayPopup = null;
    }
  }
  _buildUpdateLogPopup() {
    if (this._updateLogPopup || window.levelID) {
      return;
    }
    const xPos = screenWidth / 2;
    const popupHeight = 320;
    const popupWidth = 336;
    this._updateLogPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const background = this.add.rectangle(xPos, popupHeight, screenWidth, screenHeight, 0, 100 / 255);
    background.setInteractive();
    this._updateLogPopup.add(background);
    
    const bounceContainer = this.add.container(xPos, popupHeight).setScale(0);
    this._updateLogPopup.add(bounceContainer);
    const cornerRadius = this.textures.get("GJ_square02").source[0].width * 0.325;
    const popupBg = this._drawScale9(0, 0, 480, popupWidth, "GJ_square02", cornerRadius, 16777215, 1);
    bounceContainer.add(popupBg);
    const closeBtn = this.add.image(-240 + 20, -148, "GJ_WebSheet", "GJ_closeBtn_001.png").setScale(0.8).setInteractive();
    bounceContainer.add(closeBtn);
    this._expandHitArea(closeBtn, 2);
    this._makeBouncyButton(closeBtn, 0.8, () => this._closeUpdateLogPopup());
    const title = this.add.bitmapText(0, -124, "bigFont", "BETA (EXPECT BUGS)", 33).setOrigin(0.5, 0.55).setTint(0xff6666);
    bounceContainer.add(title);
    const scrollAreaW = 420;
    const scrollAreaH = 230;
    const scrollAreaX = 0;
    const scrollAreaY = 20;
    const scrollFrameBg = this.add.graphics();
    scrollFrameBg.fillStyle(0x000000, 0.18);
    scrollFrameBg.fillRoundedRect(scrollAreaX - scrollAreaW / 2, scrollAreaY - scrollAreaH / 2, scrollAreaW, scrollAreaH, 8);
    bounceContainer.add(scrollFrameBg);
    const contentContainer = this.add.container(0, scrollAreaY - scrollAreaH / 2 + 8);
    bounceContainer.add(contentContainer);
    /* colors for reference
      0xff6666
      0xff9944
      0xaaddff - fun messages from me :)
      0xFF008E - pink dev entries
    */
    const updateEntries = [
      { text: "Update Log", scale: 1, font: "goldFont" },
      { text: "Sorry for the 10 hour downtime\ni forgot to change the proxy\nurl because i changed the\nsubdomain - rohanis0000", scale: 0.7, color: 0xaaddff },
      { text: "To anyone who is wondering\nwhy online features don't work,\nthe worker is constantly being\nused and its request limit\nis hit daily in a short time\ndue to many users using\nthe online levels feature.\nThis has hopefully been\nfixed now with this update.\n- rohanis0000", scale: 0.7, color: 0xaaddff },
      { text: "Added 2 new proxies to fall back\nto when ones request limit is\n hit to allow you to still\nbe able to use online features.", scale: 0.65 }
    ]; 
    let yPos = 0;
    const lineItems = [];
    updateEntries.forEach(entry => {
      const txt = this.add.bitmapText(0, yPos, entry.font || "bigFont", entry.text, 32)
        .setOrigin(0.5, 0)
        .setCenterAlign()
        .setScale(entry.scale || 0.65);
      if (entry.color != null) txt.setTint(entry.color);
      contentContainer.add(txt);
      lineItems.push(txt);
      yPos += txt.displayHeight + 10;
    });
    const totalContentH = yPos;
    const maxScrollDown = Math.max(0, totalContentH - scrollAreaH + 16);
    const maskGraphics = this.add.graphics();
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff, 1);
    const updateMask = () => {
      if (!bounceContainer || !bounceContainer.active) return;
      const wx = xPos + bounceContainer.x - xPos;
      const s = bounceContainer.scaleX;
      const bwx = xPos;
      const bwy = popupHeight;
      maskShape.clear();
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillRect(
        bwx + (scrollAreaX - scrollAreaW / 2) * s,
        bwy + (scrollAreaY - scrollAreaH / 2) * s,
        scrollAreaW * s,
        scrollAreaH * s
      );
    };
    const geomMask = maskShape.createGeometryMask();
    contentContainer.setMask(geomMask);
    const maskUpdateEvent = this.events.on('postupdate', updateMask);
    let scrollY = 0;
    const baseContentY = scrollAreaY - scrollAreaH / 2 + 8;
    const applyScroll = () => {
      contentContainer.y = baseContentY - scrollY;
    };
    applyScroll();
    const scrollZone = this.add.zone(scrollAreaX, scrollAreaY, scrollAreaW, scrollAreaH).setInteractive();
    bounceContainer.add(scrollZone);
    scrollZone.on('wheel', (_p, _dx, deltaY) => {
      scrollY = Phaser.Math.Clamp(scrollY + deltaY * 0.6, 0, maxScrollDown);
      applyScroll();
    });

    let dragStartY = 0;
    let dragStartScroll = 0;
    scrollZone.on('pointerdown', (pointer) => {
      dragStartY = pointer.y;
      dragStartScroll = scrollY;
    });
    scrollZone.on('pointermove', (pointer) => {
      if (pointer.isDown) {
        const dy = dragStartY - pointer.y;
        scrollY = Phaser.Math.Clamp(dragStartScroll + dy, 0, maxScrollDown);
        applyScroll();
      }
    });
    this._updateLogPopupCleanup = () => {
      this.events.off('postupdate', updateMask);
      maskShape.destroy();
      geomMask.destroy();
    };
    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeUpdateLogPopup() {
    if (this._updateLogPopup) {
      if (this._updateLogPopupCleanup) {
        this._updateLogPopupCleanup();
        this._updateLogPopupCleanup = null;
      }
      this._updateLogPopup.destroy();
      this._updateLogPopup = null;
    }
  }
  _buildNewgroundsPopup() {
    if (this._newgroundsPopup || window.levelID) return;
    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    this._newgroundsPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 100 / 255);
    background.setInteractive();
    this._newgroundsPopup.add(background);
    const bounceContainer = this.add.container(xPos, centerY).setScale(0);
    this._newgroundsPopup.add(bounceContainer);
    const cornerRadius = this.textures.get("square01_001").source[0].width * 0.325;
    const panelBg = this._drawScale9(0, 0, 460, 240, "square01_001", cornerRadius, 16777215, 1);
    bounceContainer.add(panelBg);
    const title = this.add.bitmapText(0, -76, "goldFont", "Newgrounds", 40).setOrigin(0.5, 0.5);
    bounceContainer.add(title);
    const body = this.add.text(0, -10, "Visit Newgrounds to find awesome\nmusic?", {
      fontSize: "25px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(body);
    const cancelGroup = this.add.container(-70, 65);
    const cancelBtnW = 165, cancelBtnH = 55;
    const cancelBtnBorder = this.textures.get("GJ_button01").source[0].width * 0.3;
    const cancelBtn9 = this._drawScale9(0, 0, cancelBtnW, cancelBtnH, "GJ_button01", cancelBtnBorder, 0xffffff, 1);
    const cancelBtn = this.add.rectangle(0, 0, cancelBtnW, cancelBtnH).setInteractive();
    cancelGroup.add(cancelBtn9);
    cancelGroup.add(cancelBtn);
    const cancelLabel = this.add.bitmapText(-2, -3, "goldFont", "Cancel", 38).setOrigin(0.5, 0.5);
    cancelGroup.add(cancelLabel);
    bounceContainer.add(cancelGroup);
    cancelBtn.on("pointerdown", () => { cancelGroup._pressed = true; this.tweens.killTweensOf(cancelGroup); this.tweens.add({ targets: cancelGroup, scaleX: 1.26, scaleY: 1.26, duration: 300, ease: "Bounce.Out" }); });
    cancelBtn.on("pointerout", () => { if (cancelGroup._pressed) { cancelGroup._pressed = false; this.tweens.killTweensOf(cancelGroup); this.tweens.add({ targets: cancelGroup, scaleX: 1, scaleY: 1, duration: 400, ease: "Bounce.Out" }); } });
    cancelBtn.on("pointerup", () => { if (cancelGroup._pressed) { cancelGroup._pressed = false; this.tweens.killTweensOf(cancelGroup); cancelGroup.setScale(1); this._closeNewgroundsPopup(); } });
    const openGroup = this.add.container(90, 65);
    const openBtnW = 125, openBtnH = 55;
    const openBtnBorder = this.textures.get("GJ_button01").source[0].width * 0.3;
    const openBtn9 = this._drawScale9(0, 0, openBtnW, openBtnH, "GJ_button01", openBtnBorder, 0xffffff, 1);
    const openBtn = this.add.rectangle(0, 0, openBtnW, openBtnH).setInteractive();
    openGroup.add(openBtn9);
    openGroup.add(openBtn);
    const openLabel = this.add.bitmapText(-2, -3, "goldFont", "Open", 39).setOrigin(0.5, 0.5);
    openGroup.add(openLabel);
    bounceContainer.add(openGroup);
    openBtn.on("pointerdown", () => { openGroup._pressed = true; this.tweens.killTweensOf(openGroup); this.tweens.add({ targets: openGroup, scaleX: 1.26, scaleY: 1.26, duration: 300, ease: "Bounce.Out" }); });
    openBtn.on("pointerout", () => { if (openGroup._pressed) { openGroup._pressed = false; this.tweens.killTweensOf(openGroup); this.tweens.add({ targets: openGroup, scaleX: 1, scaleY: 1, duration: 400, ease: "Bounce.Out" }); } });
    openBtn.on("pointerup", () => { if (openGroup._pressed) { openGroup._pressed = false; this.tweens.killTweensOf(openGroup); openGroup.setScale(1); this._closeNewgroundsPopup(); window.open("https://www.newgrounds.com/audio", "_blank"); } });
    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeNewgroundsPopup() {
    if (this._newgroundsPopup) {
      this._newgroundsPopup.destroy();
      this._newgroundsPopup = null;
    }
  }
  _buildFeaturedInfoPopup() {
    if (this._featuredInfoPopup) return;
    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    this._featuredInfoPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 100 / 255);
    background.setInteractive();
    this._featuredInfoPopup.add(background);
    const bounceContainer = this.add.container(xPos, centerY).setScale(0);
    this._featuredInfoPopup.add(bounceContainer);
    const cornerRadius = this.textures.get("square01_001").source[0].width * 0.325;
    const panelBg = this._drawScale9(0, 0, 560, 300, "square01_001", cornerRadius, 16777215, 1);
    bounceContainer.add(panelBg);
    const title = this.add.bitmapText(0, -98, "goldFont", "Featured", 42).setOrigin(0.5, 0.5);
    bounceContainer.add(title);
    const body = this.add.text(0, -5, "its finally finished after so long\nso this is awesome am i right\n it has aura. featured tab. roptop fgames.", {
      fontSize: "21px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      align: "center",
      lineSpacing: 4
    }).setOrigin(0.5, 0.5);
    bounceContainer.add(body);
    const okGroup = this.add.container(-5, 95);
    const okBtnW = 90, okBtnH = 55;
    const okBtnBorder = this.textures.get("GJ_button01").source[0].width * 0.3;
    const okBtn9 = this._drawScale9(0, 0, okBtnW, okBtnH, "GJ_button01", okBtnBorder, 0xffffff, 1);
    const okBtn = this.add.rectangle(0, 0, okBtnW, okBtnH).setInteractive();
    okGroup.add(okBtn9);
    okGroup.add(okBtn);
    const okLabel = this.add.bitmapText(-3, -4, "goldFont", "OK", 44).setOrigin(0.5, 0.5);
    okGroup.add(okLabel);
    bounceContainer.add(okGroup);
    okBtn.on("pointerdown", () => { okGroup._pressed = true; this.tweens.killTweensOf(okGroup); this.tweens.add({ targets: okGroup, scaleX: 1.26, scaleY: 1.26, duration: 300, ease: "Bounce.Out" }); });
    okBtn.on("pointerout", () => { if (okGroup._pressed) { okGroup._pressed = false; this.tweens.killTweensOf(okGroup); this.tweens.add({ targets: okGroup, scaleX: 1, scaleY: 1, duration: 400, ease: "Bounce.Out" }); } });
    okBtn.on("pointerup", () => { if (okGroup._pressed) { okGroup._pressed = false; this.tweens.killTweensOf(okGroup); okGroup.setScale(1); this._closeFeaturedInfoPopup(); } });
        this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeFeaturedInfoPopup() {
    if (this._featuredInfoPopup) {
      this._featuredInfoPopup.destroy();
      this._featuredInfoPopup = null;
    }
  }
  _buildDemonFilterPopup() {
    if (this._demonFilterPopup) return;
    const xPos = screenWidth / 2;
    const centerY = screenHeight / 2;
    this._demonFilterPopup = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const background = this.add.rectangle(xPos, centerY, screenWidth, screenHeight, 0, 100 / 255);
    background.setInteractive();
    this._demonFilterPopup.add(background);
    const bounceContainer = this.add.container(xPos, centerY).setScale(0);
    this._demonFilterPopup.add(bounceContainer);

    const panelW = 760, panelH = 360;
    const cornerRadius = this.textures.get("GJ_square01").source[0].width * 0.325;
    const panelBg = this.add.nineslice(0, 0, "GJ_square01", null, panelW, panelH, cornerRadius, cornerRadius, cornerRadius, cornerRadius)
      .setOrigin(0.5);
    bounceContainer.add(panelBg);

    const title = this.add.bitmapText(0, -panelH / 2 + 40, "bigFont", "Demon Filter", 64).setOrigin(0.5, 0.5);
    bounceContainer.add(title);

    const _tierDefs = [
      { frame: "difficulty_06_btn_001.png", w: 72, h: 88, tier: null },
      { frame: "difficulty_07_btn2_001.png", w: 72, h: 85, tier: 1 },
      { frame: "difficulty_08_btn2_001.png", w: 72, h: 85, tier: 2 },
      { frame: "difficulty_06_btn2_001.png", w: 72, h: 88, tier: 3 },
      { frame: "difficulty_09_btn2_001.png", w: 74, h: 88, tier: 4 },
      { frame: "difficulty_10_btn2_001.png", w: 80, h: 91, tier: 5 },
    ];
    const slotW = (panelW - 60) / _tierDefs.length;
    const iconY = 0;
    const iconTargetH = 78;
    const tierIcons = [];
    let selectedTierIdx = _tierDefs.findIndex(t => t.tier === (this._selectedDemonTier || null));
    if (selectedTierIdx < 0) selectedTierIdx = 0;
    const baseScale = 1.1;

    _tierDefs.forEach((def, i) => {
      const cx = -panelW / 2 + 30 + slotW * i + slotW / 2;
      const icon = this.add.image(cx, iconY, "GJ_GameSheet03", def.frame)
        .setOrigin(0.5).setScale(baseScale).setInteractive();
      icon.setTint(i === selectedTierIdx ? 0xffffff : 0x8F8F8F);
      bounceContainer.add(icon);
      tierIcons.push(icon);

      icon.on("pointerdown", () => {
        icon._pressed = true;
        this.tweens.killTweensOf(icon, "scale");
        this.tweens.add({ targets: icon, scale: baseScale * 1.15, duration: 300, ease: "Bounce.Out" });
      });
      icon.on("pointerout", () => {
        if (icon._pressed) {
          icon._pressed = false;
          this.tweens.killTweensOf(icon, "scale");
          this.tweens.add({ targets: icon, scale: baseScale, duration: 400, ease: "Bounce.Out" });
        }
      });
      icon.on("pointerup", () => {
        if (!icon._pressed) return;
        icon._pressed = false;
        this.tweens.killTweensOf(icon, "scale");
        icon.setScale(baseScale);
        selectedTierIdx = i;
        tierIcons.forEach((other, oi) => other.setTint(oi === i ? 0xffffff : 0x8f8f8f));
      });
    });

    const okGroup = this.add.container(0, panelH / 2 - 45);
    const okBtnW = 110, okBtnH = 55;
    const okBtn9 = this.add.nineslice(0, 0, "GJ_button01", null, okBtnW, okBtnH, 18, 18, 18, 18)
      .setOrigin(0.5).setInteractive();
    okGroup.add(okBtn9);
    const okLabel = this.add.bitmapText(-3, -4, "goldFont", "OK", 44).setOrigin(0.5, 0.5);
    okGroup.add(okLabel);
    bounceContainer.add(okGroup);
    okBtn9.on("pointerdown", () => { okGroup._pressed = true; this.tweens.killTweensOf(okGroup); this.tweens.add({ targets: okGroup, scaleX: 1.26, scaleY: 1.26, duration: 300, ease: "Bounce.Out" }); });
    okBtn9.on("pointerout", () => { if (okGroup._pressed) { okGroup._pressed = false; this.tweens.killTweensOf(okGroup); this.tweens.add({ targets: okGroup, scaleX: 1, scaleY: 1, duration: 400, ease: "Bounce.Out" }); } });
    okBtn9.on("pointerup", () => {
      if (!okGroup._pressed) return;
      okGroup._pressed = false;
      this.tweens.killTweensOf(okGroup);
      okGroup.setScale(1);
      const chosen = _tierDefs[selectedTierIdx];
      this._selectedDemonTier = chosen.tier;
      const demonIcon = this._diffFilterIcons && this._diffFilterIcons[6];
      if (demonIcon) {
        demonIcon.setTexture("GJ_GameSheet03", chosen.frame);
        demonIcon.setScale(0.85);
      }
      this._closeDemonFilterPopup();
    });

    this.tweens.add({
      targets: bounceContainer,
      scale: { from: 0, to: 1 },
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6]
    });
  }
  _closeDemonFilterPopup() {
    if (this._demonFilterPopup) {
      this._demonFilterPopup.destroy();
      this._demonFilterPopup = null;
    }
  }
  _expandHitArea(_0x122213, _0x37180a) {
    const _0x46ea45 = _0x122213.width;
    const _0x43b461 = _0x122213.height;
    const _0x960250 = _0x46ea45 * (_0x37180a - 1) / 2;
    const _0x3f88a1 = _0x43b461 * (_0x37180a - 1) / 2;
    _0x122213.input.hitArea.setTo(-_0x960250, -_0x3f88a1, _0x46ea45 + _0x960250 * 2, _0x43b461 + _0x3f88a1 * 2);
  }
  _makeBouncyButton(textureX, _0x57b645, _0x2f13d0, _0xda0c21) {
    textureX._bouncyBaseScale = _0x57b645;
    const getBouncyVisualTargets = () => {
      const configured = Array.isArray(textureX._bouncyVisualTargets) && textureX._bouncyVisualTargets.length
        ? textureX._bouncyVisualTargets
        : [textureX._bouncyVisualTarget || textureX];
      return configured
        .map(entry => {
          const target = entry && entry.target ? entry.target : entry;
          if (!target || typeof target.setScale !== "function") return null;
          const baseScale =
            (entry && typeof entry.getBaseScale === "function" ? entry.getBaseScale() : undefined) ??
            (entry && entry.baseScale !== undefined ? entry.baseScale : undefined) ??
            target._bouncyBaseScale ??
            textureX._bouncyBaseScale ??
            _0x57b645;
          const baseScaleX =
            (entry && typeof entry.getBaseScaleX === "function" ? entry.getBaseScaleX() : undefined) ??
            (entry && entry.baseScaleX !== undefined ? entry.baseScaleX : undefined) ??
            baseScale;
          const baseScaleY =
            (entry && typeof entry.getBaseScaleY === "function" ? entry.getBaseScaleY() : undefined) ??
            (entry && entry.baseScaleY !== undefined ? entry.baseScaleY : undefined) ??
            baseScale;
          return { target, baseScaleX, baseScaleY };
        })
        .filter(Boolean);
    };
    const tweenBouncyTargets = (scaleMultiplier, duration) => {
      for (const entry of getBouncyVisualTargets()) {
        this.tweens.killTweensOf(entry.target);
        this.tweens.add({
          targets: entry.target,
          scaleX: entry.baseScaleX * scaleMultiplier,
          scaleY: entry.baseScaleY * scaleMultiplier,
          duration,
          ease: "Bounce.Out"
        });
      }
    };
    const resetBouncyTargets = (instant = false) => {
      for (const entry of getBouncyVisualTargets()) {
        this.tweens.killTweensOf(entry.target);

        if (instant) {
          entry.target.setScale(entry.baseScaleX, entry.baseScaleY);
        } else {
          this.tweens.add({
            targets: entry.target,
            scaleX: entry.baseScaleX,
            scaleY: entry.baseScaleY,
            duration: 400,
            ease: "Bounce.Out"
          });
        }
      }
    };
    textureX._cancelBouncyPress = (instant = false) => {
      if (!textureX._pressed) return;
      textureX._pressed = false;
      resetBouncyTargets(instant);
      if (this._activeBouncyButton === textureX) this._activeBouncyButton = null;
    };
    textureX.on("pointerdown", () => {
      if (!_0xda0c21 || !!_0xda0c21()) {
        if (this._activeBouncyButton && this._activeBouncyButton !== textureX) {
          this._activeBouncyButton._cancelBouncyPress?.(true);
        }
        this._activeBouncyButton = textureX;
        textureX._pressed = true;
        tweenBouncyTargets(1.26, 300);
      }
    });
    textureX.on("pointerout", () => {
      if (textureX._pressed) {
        textureX._cancelBouncyPress(false);
      }
    });
    textureX.on("pointerup", () => {
      if (textureX._pressed) {
        textureX._cancelBouncyPress(true);
        _0x2f13d0?.();
      }
    });
    textureX.on("pointerupoutside", () => {
      if (textureX._pressed) {
        textureX._cancelBouncyPress(false);
      }
    });
    return textureX;
  }
  _makeCompositeBouncyButton(trigger, visualTargets, baseScale, callback, condition) {
    trigger._bouncyVisualTargets = (Array.isArray(visualTargets) ? visualTargets : [visualTargets])
      .filter(Boolean)
      .map(entry => {
        const target = entry && entry.target ? entry.target : entry;
        const currentScaleX = target?.scaleX ?? baseScale;
        const currentScaleY = target?.scaleY ?? baseScale;
        const entryBase = entry && entry.baseScale !== undefined ? entry.baseScale : undefined;

        return {
          target,
          baseScaleX: entry && entry.baseScaleX !== undefined ? entry.baseScaleX : (entryBase ?? currentScaleX),
          baseScaleY: entry && entry.baseScaleY !== undefined ? entry.baseScaleY : (entryBase ?? currentScaleY),
          getBaseScale: entry && entry.getBaseScale,
          getBaseScaleX: entry && entry.getBaseScaleX,
          getBaseScaleY: entry && entry.getBaseScaleY
        };
      });

    return this._makeBouncyButton(trigger, baseScale, callback, condition);
  }
  _toggleFullscreen() {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
      try {
        screen.orientation.lock("landscape").catch(() => {});
      } catch (_0x22124f) {}
    }
  }
  _drawScale9(x, y, scaleWidth, scaleHeight, textureKey, borderSize, tint, alpha) {
    const container = this.add.container(x, y);
    const texture = this.textures.get(textureKey);
    const baseFrame = texture?.get?.();
    const source = texture?.source?.[0];
    const textureWidth = baseFrame?.width || source?.width || scaleWidth;
    const textureHeight = baseFrame?.height || source?.height || scaleHeight;
    const requestedBorder = Math.max(0, Number(borderSize) || 0);
    const horizontalBorder = Math.min(requestedBorder, textureWidth / 2, scaleWidth / 2);
    const verticalBorder = Math.min(requestedBorder, textureHeight / 2, scaleHeight / 2);

    const nineSlice = this.add.nineslice(
      0,
      0,
      textureKey,
      null,
      scaleWidth,
      scaleHeight,
      horizontalBorder,
      horizontalBorder,
      verticalBorder,
      verticalBorder
    ).setOrigin(0.5);

    if (tint !== undefined) {
      nineSlice.setTint(tint);
    }
    if (alpha !== undefined) {
      nineSlice.setAlpha(alpha);
    }

    container.add(nineSlice);
    return container;
  }
  _startGame() {
    if (!this._menuActive) {
      return;
    }
    const _instant = !!this._instantLevelStart;
    this._instantLevelStart = false;
    const _dismiss = (target, tweenProps, cleanup) => {
      if (!target) return;
      if (_instant) {
        cleanup();
        return;
      }
      this.tweens.killTweensOf(target);
      this.tweens.add({
        targets: target,
        ...tweenProps,
        onComplete: cleanup
      });
    };
    
    // fixed loading saved new best from local storage
    this._bestPercent = parseFloat(localStorage.getItem("bestPercent_" + (window.currentlevel[2] || "level_1")) || "0");
    this._practiceBestPercent = parseFloat(localStorage.getItem("practiceBestPercent_" + (window.currentlevel[2] || "level_1")) || "0");
    
    this._menuActive = false;
    this._audio.stopMusic();
    this._practiceBypassPending = false;
    this._slideIn = true;
    for (const character of this._menuCharacters || []) this._destroyMenuCharacter(character);
    this._menuCharacters = [];
    if (this._menuGlitter) {
      this._menuGlitter.destroy();
      this._menuGlitter = null;
    }
    if (this._menuUpdateLogBtn) {
      this._menuUpdateLogBtn.setVisible(false);
    }
    if (this._menuNewgroundsBtn) {
      this._menuNewgroundsBtn.setVisible(false);
    }
    if (this._menuSettingsBtn) {
      this._menuSettingsBtn.setVisible(false);
    }
    if (this._menuAchievementsBtn) {
      this._menuAchievementsBtn.setVisible(false);
    }
    if (this._menuStatsBtn) {
      this._menuStatsBtn.setVisible(false);
    }
    _dismiss(this._playBtn, { scale: 0.01, duration: 200, ease: "Quad.In" }, () => {
      this._playBtn.destroy();
      this._playBtn = null;
    });
    //icon stuff the threequel
    if (this._iconBtn) {
      this._closeIconSelector && this._closeIconSelector(true);
      _dismiss(this._iconBtn, { scale: 0.01, duration: 200, ease: "Quad.In" }, () => {
        this._iconBtn.destroy();
        this._iconBtn = null;
      });
    }
    _dismiss(this._chrSelDecor, { y: screenHeight + 100, alpha: 0, duration: 200, ease: "Quad.In" }, () => {
      if (this._chrSelDecor) { this._chrSelDecor.destroy(); this._chrSelDecor = null; }
    });
    _dismiss(this._lvlEditDecor, { y: screenHeight + 100, alpha: 0, duration: 200, ease: "Quad.In" }, () => {
      if (this._lvlEditDecor) { this._lvlEditDecor.destroy(); this._lvlEditDecor = null; }
    });
    //creator stuff the threequel
    if (this._creatorBtn) {
      this._closeCreatorMenu && this._closeCreatorMenu(true);
      this._closeSearchMenu && this._closeSearchMenu(true);
      _dismiss(this._creatorBtn, { scale: 0.01, duration: 200, ease: "Quad.In" }, () => {
        this._creatorBtn.destroy();
        this._creatorBtn = null;
      });
    }
    _dismiss(this._robLogo, { y: screenHeight + (this._robLogo ? this._robLogo.height : 0), duration: 300, ease: "Quad.In" }, () => {
      this._robLogo.destroy();
      this._robLogo = null;
    });
    _dismiss(this._copyrightText, { y: 680, duration: 300, ease: "Quad.In" }, () => {
      this._copyrightText.destroy();
      this._copyrightText = null;
    });
    _dismiss(this._menuFsBtn, { y: this._menuFsBtn ? -this._menuFsBtn.height : 0, duration: 300, ease: "Quad.In" }, () => {
      this._menuFsBtn.destroy();
      this._menuFsBtn = null;
    });
    _dismiss(this._menuInfoBtn, { y: this._menuInfoBtn ? -this._menuInfoBtn.height : 0, duration: 300, ease: "Quad.In" }, () => {
      this._menuInfoBtn.destroy();
      this._menuInfoBtn = null;
    });
    this._closeInfoPopup();
    this._closeUpdateLogPopup();
    _dismiss(this._tryMeImg, { y: this._tryMeImg ? -this._tryMeImg.height : 0, duration: 300, ease: "Quad.In" }, () => {
      this._tryMeImg.destroy();
      this._tryMeImg = null;
    });
    if (this._downloadBtns) {
      for (const _0xaa3a95 of this._downloadBtns) {
        _dismiss(_0xaa3a95, { y: screenHeight + _0xaa3a95.height, duration: 300, ease: "Quad.In" }, () => _0xaa3a95.destroy());
      }
      this._downloadBtns = null;
    }
    if (this._socialIcons && this._socialIcons.length > 0) {
      for (const _icon of this._socialIcons) {
        _dismiss(_icon, { y: screenHeight + 64, duration: 300, ease: "Quad.In" }, () => _icon.destroy());
      }
      this._socialIcons = [];
    }
    _dismiss(this._logo, { y: this._logo ? -this._logo.height : 0, duration: 300, ease: "Quad.In" }, () => {
      this._logo.destroy();
      this._logo = null;
    });

    if (window.isEditor) {
        this._audio.stopMusic();
        this._cameraX = 0;
        this._cameraY = 0;
        this._playerWorldX = 0;
        this._level.additiveContainer.setVisible(true);
        this._level.container.setVisible(true);
        this._level.topContainer.setVisible(true);
        this._player.setCubeVisible(false);
        this._player2.setCubeVisible(false);
        this._attemptsLabel.setVisible(false);
        window.selectedObjId = 1;
        this._levelEditor._initEditorLogic();
        return;
    }
    this._cameraFloorX = this._startPosIndex >= 0 ? -Infinity : 30;
    this._cameraX = this._gdFollowCameraX(0);
    this._cameraY = 0;
    this._cameraXRef._v = this._cameraX;
    this._prevCameraX = this._cameraX;
    const _0x22e36e = this._cameraX - (this._menuCameraX || 0);
    this._level.shiftGroundTiles(_0x22e36e);
    // The camera's left edge is independent of the classic player spawn.
    // Initial attempts and restarts both begin at native world X = 0.
    this._playerWorldX = 0;
    let speedKey = parseInt(window.settingsMap["kA4"] || "0");
    if (speedKey == 0) {
      playerSpeed = SpeedPortal.ONE_TIMES;
    } else if (speedKey == 1) {
      playerSpeed = SpeedPortal.HALF;
    } else if (speedKey == 2) {
      playerSpeed = SpeedPortal.TWO_TIMES;
    } else if (speedKey == 3) {
      playerSpeed = SpeedPortal.THREE_TIMES;
    } else if (speedKey == 4) {
      playerSpeed = SpeedPortal.FOUR_TIMES;
    }
    this._state.y = 30;
    this._state.onGround = true;
    // Native setup leaves jumping unarmed until the first floor contact.
    // A button held through the intro must jump on tick two, not tick one.
    this._state.canJump = false;
    this._attemptInputPending = true;
    this._level.additiveContainer.setVisible(true);
    this._level.container.setVisible(true);
    this._level.topContainer.setVisible(true);
    // The slide-in branch returns before the regular colour-trigger pass.
    // Re-apply the native channel palette at the exact moment the level
    // becomes visible so signs, gradient tiles and detail layers never show
    // their untinted white source pixels during the intro.
    this._level.applyColorChannels(this._colorManager, true);
    this._player.setCubeVisible(true);
    this._player.reset();
    this._isDual = false;
    this._state2.reset();
    this._player2.reset();
    this._player2.setCubeVisible(false);
    this._player2.setShipVisible(false);
    this._player2.setBallVisible(false);
    this._player2.setWaveVisible(false);
    this._player2.setBirdVisible?.(false);
    this._player2.setSpiderVisible(false);
    this._player2.setRobotVisible(false);
    this._levelAttempts = 1;
    this._levelJumps = 0;
    this._attempts++;
    localStorage.setItem("gd_totalAttempts", this._attempts);
    this._attemptsLabel.setText("Attempt " + this._levelAttempts);
    this._attemptsLabel.setVisible(true);
    this._positionAttemptsLabel();
    let gamemode = parseInt(window.settingsMap["kA2"] || "0");
    if (gamemode == 1) {
      this._player.enterShipMode();
    } else if (gamemode == 2) {
      this._state.y = 30;
      this._player.enterBallMode({ y: 30 });
    } else if (gamemode == 3) {
      this._player.enterUfoMode();
    } else if (gamemode == 4) {
      this._player.enterWaveMode();
    } else if (gamemode == 5) {
      this._player.enterRobotMode();
    } else if (gamemode == 6) {
      this._player.enterSpiderMode();
    } else if (gamemode == 7) {
      this._player.enterSwingMode();
    }

    this._applyLevelStartOptions();
    this._resetMirrorTransition(this._state.mirrored);
  }
  _jumpKeysDown() {
    return !!(this._spaceKey?.isDown || this._upKey?.isDown || this._wKey?.isDown || this._lKey?.isDown);
  }
  _restoreAttemptInput() {
    if (!this._attemptInputPending || this._slideIn || this._menuActive || this._paused || this._state.isDead) return;
    this._attemptInputPending = false;
    if (!window.clickBetweenFrames || window.autoClicker) return;
    // CBF suppresses Phaser's key state while playing. Physical holds must
    // survive the intro, audio preparation and an attempt restart as well.
    const held = window.GDHeldJumpKeys;
    // Once physical tracking is available it is authoritative. A key pressed
    // during the intro can remain down in Phaser when CBF captures its keyup.
    const key = (code, phaserKey) => held ? held.has(code) : phaserKey?.isDown;
    const pointer = this.input.activePointer;
    const overUI = pointer.isDown && this._startPosGui.visible && this.input.manager.hitTest(pointer, this._startPosGui.list, this.cameras.main).length;
    const mouse = pointer.isDown && !overUI;
    const two = this._isTwoPlayerMode();
    const first = key('Space',this._spaceKey) || key('KeyW',this._wKey) || (!two && (key('ArrowUp',this._upKey) || key('KeyL',this._lKey)));
    const second = two && (key('ArrowUp',this._upKey) || key('KeyL',this._lKey));
    if ((first || (mouse && (!two || pointer.button !== 2))) && !this._logicButtonDown) this._pushButton();
    if ((second || (mouse && two && pointer.button === 2)) && !this._logicButtonDown2) this._pushSecondPlayerButton();
  }
  _bindSongDownloadProgress(objects, arrowX, arrowY, width) {
    if (!window.GDDownloads) return;
    const x = arrowX - 55 - width;
    const bar = this.add.graphics().setScrollFactor(0).setDepth(505);
    const label = this.add.bitmapText(x + width / 2, arrowY - 14, 'bigFont', '', 22).setOrigin(.5).setScrollFactor(0).setDepth(505);
    const detail = this.add.bitmapText(x + width / 2, arrowY + 27, 'goldFont', '', 18).setOrigin(.5).setScrollFactor(0).setDepth(505);
    objects.push(bar, label, detail);
    let previous = '';
    const unsubscribe = window.GDDownloads.subscribe(state => {
      const key = `${state.text}:${state.detail}:${state.fraction}:${state.active}`;
      if (key === previous || !bar.scene) return;
      previous = key;
      const visible = state.rows.length > 0;
      label.setVisible(visible).setText(state.text);detail.setVisible(visible).setText(state.detail);
      bar.clear();if (!visible) return;
      bar.fillStyle(0x000000, .8).fillRoundedRect(x, arrowY + 2, width, 14, 6);
      bar.lineStyle(2, 0xaaaaaa).strokeRoundedRect(x, arrowY + 2, width, 14, 6);
      const fill = Math.max(0, Math.min(1, state.fraction)) * (width - 6);
      if (fill > 0) bar.fillStyle(state.failed ? 0xff5533 : 0x64ff22).fillRoundedRect(x + 3, arrowY + 5, fill, 8, 3);
    });
    bar.once('destroy', unsubscribe);
  }
  _queueJumpEvent(down,stamp=performance.now(),player=1,source='button') {
    if(this._paused||this._menuActive||this._slideIn||this._state.isDead||window.eclipseMenuOpen)return;
    const time=Number.isFinite(stamp)?stamp:performance.now(),queue=this._jumpEventQueue ||= [];
    // GD delivers each physical button edge in order. A new mouse press
    // must still override a held keyboard button (and vice versa).
    const key = `${player}:${source}`;
    if(this._jumpEventHeld?.[key]===down)return;
    (this._jumpEventHeld ||= {})[key]=down;
    queue.push({down,time,player});
  }
  _drainJumpEvents(time) {
    const queue=this._jumpEventQueue||[];
    while(queue.length&&queue[0].time<=time+1e-6){const e=queue.shift();
      if(e.player===2)e.down?this._pushSecondPlayerButton():this._releaseSecondPlayerButton();
      else e.down?this._pushButton():this._releaseButton();
    }
  }
  _pushButton(ignoreMacro = false, onlyPlayer = 0) {
    const objectsUnderPointer = this._startPosGui.visible && this.input.activePointer.isDown ? this.input.manager.hitTest(
      this.input.activePointer, 
      this._startPosGui.list,
      this.cameras.main
    ) : [];
    const isOverUI = this._startPosGui.visible && objectsUnderPointer.length > 0;
    const fromClick = this.input.activePointer.isDown;
    const cancelInput = isOverUI && fromClick;

    if (this._menuActive) {
      this._audio.playEffect("playSound_01", {
        volume: 1
      });
      this._startGame();
      return;
    }

    if (!this._slideIn && !this._state.isDead && !cancelInput) {
      // Touch triggers listen to the button; Options can disable the player.
      const logic = this._level?.logicState;
      if (!this._logicButtonDown) { this._logicButtonDown = true; logic?.button(true, 1); }
      if (!onlyPlayer) {
        this._state._physicalJumpHeld = true;
        if (this._isDual && !this._isTwoPlayerMode()) this._state2._physicalJumpHeld = true;
      }
      const primaryEnabled = onlyPlayer !== 2 && !logic?.controlsDisabled(1);
      const secondaryEnabled = onlyPlayer !== 1 && this._isDual && !this._state2.isDead && !this._isTwoPlayerMode() && !logic?.controlsDisabled(2);
      if (!primaryEnabled && !secondaryEnabled) return;
      if(window.jumpHack){this._state.onGround=this._state.canJump=true;if(this._isDual)this._state2.onGround=this._state2.canJump=true;}
      this._pressUnseen = true;
      this._releaseDeferred = false;
      if (primaryEnabled) {
        this._state._holdDead = false;
        this._state.upKeyDown = true;
        this._state.upKeyPressed = true;
        this._state.queuedHold = true;
        this._state._orbActivationConsumedForPress = false;
      }
      if (secondaryEnabled) {
        this._state2._holdDead = false;
        this._state2.upKeyDown = true;
        this._state2.upKeyPressed = true;
        this._state2.queuedHold = true;
        this._state2._orbActivationConsumedForPress = false;
      }
      let _primaryImmediateJumped = false;
      const restoreInputFrame = !this._localPhysicsActive ? this._level?.gameplayState?.enterPhysics() : null;
      try {
        const _dualImmediateBeforeGravity = !!this._state.gravityFlipped;
        if (primaryEnabled) this._player.ringJumpOnPress(true);
        if (primaryEnabled && !this._state.isFlying && !this._state.isWave && !this._state.isUfo && this._state.canJump && !this._player._pressGoesToTouchedRings()) {
          // pushButton's immediate updateJump(0) skips ship, UFO, wave and
          // swing (Steam 4f62e3..4f6319); their press acts on the next tick.
          this._player.updateJump(0);
          _primaryImmediateJumped = true;
        }
        const _primaryImmediateGravityChanged = this._isDual && !!this._state.gravityFlipped !== _dualImmediateBeforeGravity;
        let _primaryImmediateGravitySynced = false;
        if (_primaryImmediateGravityChanged) {
          _primaryImmediateGravitySynced = this._syncDualGlobalsFromPrimary({
            skipBallInputGravity: this._state.isBall && _primaryImmediateJumped,
            skipSpiderInputGravity: this._state.isSpider && _primaryImmediateJumped
          });
        }
        if (secondaryEnabled) {
          if (this._shouldSuppressDualGravityAction(this._state2, _primaryImmediateGravitySynced)) {
            this._state2.upKeyPressed = false;
            this._state2.queuedHold = false;
          }
          const _secondaryImmediateBeforeGravity = !!this._state2.gravityFlipped;
          const _secondaryImmediateBallInput = this._state2.isBall && this._state2.upKeyPressed;
          const _secondaryImmediateSpiderInput = this._state2.isSpider && this._state2.upKeyPressed;
          this._player2.ringJumpOnPress(true);
          if (!this._state2.isFlying && !this._state2.isWave && !this._state2.isUfo && this._state2.canJump && !this._player2._pressGoesToTouchedRings()) {
            this._player2.updateJump(0);
          }
          if (!!this._state2.gravityFlipped !== _secondaryImmediateBeforeGravity) {
            this._syncDualGlobalsFromSecondary({
              skipBallInputGravity: _secondaryImmediateBallInput,
              skipSpiderInputGravity: _secondaryImmediateSpiderInput
            });
          }
        }
      } finally {
        restoreInputFrame?.();
      }
      if (_primaryImmediateJumped) {
        this._totalJumps++;
        this._levelJumps++;
        localStorage.setItem("gd_totalJumps", this._totalJumps);
      }
    }

  }
  _setPlayerControlsDisabled(index, disabled) {
    const state = index === 2 ? this._state2 : this._state;
    if (!state) return;
    // PlayerObject::disablePlayerControls clears the live button but keeps
    // the physical hold map. enablePlayerControls pushes that held button
    // again (Steam 4fd790 / 4fd940), including presses made while disabled.
    if (disabled) {
      state.upKeyDown = state.upKeyPressed = state.queuedHold = false;
      state._orbActivationConsumedForPress = false;
      // disablePlayerControls (4fd7d7): release the robot's variable jump
      // and end any dash, while preserving the physical button map.
      state._robotPadBoost = true;
      state._robotHold = false;
      const player = index === 2 ? this._player2 : this._player;
      if (state.isDashing) player._stopDash(true);
    } else if (!state._physicalJumpHeld) {
      return;
    } else if (index === 2 && this._isTwoPlayerMode()) {
      if (this._logicButtonDown2) this._pushSecondPlayerButton();
    } else if (this._logicButtonDown) {
      this._pushButton(false, index);
    }
  }
  _releaseButton(ignoreMacro = false) {
    // A press no physics step has seen yet keeps the button down for one
    // step, so a quick tap still jumps or fires the ring it was meant for.
    if (this._pressUnseen && !this._paused && !this._state.isDead && !this._menuActive) {
      this._releaseDeferred = true;
      return;
    }
    this._releaseDeferred = false;
    if (this._logicButtonDown) { this._logicButtonDown = false; this._level?.logicState?.button(false, 1); }
    this._state._holdDead = false;
    this._state.upKeyDown = false;
    this._state._physicalJumpHeld = false;
    this._state._robotPadBoost = true;
    this._state.upKeyPressed = false;
    this._state.queuedHold = false;
    this._state._orbActivationConsumedForPress = false;
    if (!this._isTwoPlayerMode()) {
    this._state2._holdDead = false;
    this._state2.upKeyDown = false;
    this._state2._physicalJumpHeld = false;
    this._state2._robotPadBoost = true;
    this._state2.upKeyPressed = false;
    this._state2.queuedHold = false;
    this._state2._orbActivationConsumedForPress = false;
    }
  }
  _pushSecondPlayerButton() {
    if (!this._isTwoPlayerMode() || !this._isDual || this._state2.isDead || this._paused || this._menuActive || this._slideIn || this._levelWon) return;
    const logic=this._level?.logicState, state=this._state2, player=this._player2;
    if (!this._logicButtonDown2) { this._logicButtonDown2=true;logic?.button(true,2); }
    state._physicalJumpHeld=true;
    if (logic?.controlsDisabled(2)) return;
    if(window.jumpHack)state.onGround=state.canJump=true;
    this._pressUnseen2=true;this._releaseDeferred2=false;
    state._holdDead=false;state.upKeyDown=state.upKeyPressed=state.queuedHold=true;state._orbActivationConsumedForPress=false;
    const restore=!this._localPhysicsActive?this._level?.gameplayState?.enterPhysics():null;
    try {
      player.ringJumpOnPress(true);
      if (!state.isFlying&&!state.isWave&&!state.isUfo&&state.canJump&&!player._pressGoesToTouchedRings()) player.updateJump(0);
    } finally {restore?.();}
  }
  _releaseSecondPlayerButton() {
    if(this._pressUnseen2&&!this._paused&&!this._state2.isDead&&!this._menuActive){this._releaseDeferred2=true;return;}
    this._releaseDeferred2=false;
    if(this._logicButtonDown2){this._logicButtonDown2=false;this._level?.logicState?.button(false,2);}
    const state=this._state2;
    state._physicalJumpHeld=false;
    state._robotPadBoost=true;
    state._holdDead=false;state.upKeyDown=state.upKeyPressed=state.queuedHold=false;state._orbActivationConsumedForPress=false;
  }
  _initMacroBot() {
    this._macroBot = new MacroBot(this);
    window.macroBot = this._macroBot;
  }
  _startMacroRecording(meta = {}) {
    if (!this._macroBot) this._initMacroBot();
    this._macroBot.startRecording({
      level: window.currentlevel?.[2] || "",
      ...meta
    });
  }
  _stopMacroRecording() {
    if (!this._macroBot) return null;
    return this._macroBot.stopRecording();
  }
  _startMacroPlayback(macroData) {
    console.log(macroData);
    if (!this._macroBot) this._initMacroBot();
    this._macroBot.startPlayback(macroData);
  }
  _stopMacroPlayback() {
    if (this._macroBot) this._macroBot.stopPlayback();
  }
  _exportMacroFile(filename = null) {
    if (!this._macroBot) return;
    const safeName = (filename || `${window.currentlevel?.[2] || "macro"}.gdr`)
      .replace(/[^\w.\-]+/g, "_");
    this._macroBot.download(safeName);
  }
  _importMacroFile() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".wbgdr2";

    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        if (!this._macroBot) this._initMacroBot();
        
        const macroData = await this._macroBot.importFile(file);
        this._macroBot.frames = Array.isArray(macroData.frames) ? macroData.frames.slice() : [];
        const fallback = file.name.replace(/\.[^/.]+$/, "");
        const macroName = macroData.meta?.name || fallback;

        this._macroBot.meta = macroData.meta || this._macroBot.meta;
        this._macroBot.meta.name = macroName;

        this._macroName = macroName;
        this._macroLoaded = true;
      } catch (err) {
        alert("Failed to import: " + err.message);
      }
    };

    fileInput.click();
  }
  _positionMenuItems() {
    const _0x1e5db8 = screenWidth / 2;
    const menuY = screenHeight / 2;
    const mainButtonGap = 90;
    if (this._logo) {
      this._logo.x = _0x1e5db8;
    }
    if (this._menuInfoBtn) {
      this._menuInfoBtn.x = screenWidth - 30 - 3;
    }
    if (this._copyrightText) {
      this._copyrightText.setPosition(12, screenHeight - 10);
    }
    if (this._tryMeImg) {
      this._tryMeImg.x = _0x1e5db8 + 260;
    }
    if (this._menuGlitter) {
      this._menuGlitter.x = _0x1e5db8;
      this._menuGlitter.y = 320;
    }
    if (this._playBtn) {
      this._playBtn.x = _0x1e5db8;
      this.tweens.killTweensOf(this._playBtn, "y");
      this._playBtn.y = menuY;
    }
    if (this._downloadBtns) {
      const _0x285ef7 = screenWidth - 105;
      const _0x4a8263 = 550;
      const _0x23d03e = 100;
      for (let _0x1bdfae = 0; _0x1bdfae < this._downloadBtns.length; _0x1bdfae++) {
        const yOffset = _0x1bdfae === 1 ? -_0x23d03e : 0;
        this._downloadBtns[_0x1bdfae].setPosition(_0x285ef7, _0x4a8263 + yOffset);
      }
    }
    if (this._iconBtn) {
      const playWidth = this._playBtn?.displayWidth || 0;
      const iconWidth = this._iconBtn.displayWidth || 0;
      this._iconBtn.x = _0x1e5db8 - playWidth / 2 - mainButtonGap - iconWidth / 2;
      this.tweens.killTweensOf(this._iconBtn, "y");
      this._iconBtn.y = menuY;
    }
    if (this._creatorBtn) {
      const playWidth = this._playBtn?.displayWidth || 0;
      const creatorWidth = this._creatorBtn.displayWidth || 0;
      this._creatorBtn.x = _0x1e5db8 + playWidth / 2 + mainButtonGap + creatorWidth / 2;
      this.tweens.killTweensOf(this._creatorBtn, "y");
      this._creatorBtn.y = menuY;
    }
    if (this._robLogo) {
      this._robLogo.x = 110;
      this._robLogo.y = screenHeight - 45;
    }
    const toolbar = [
      this._menuAchievementsBtn,
      this._menuSettingsBtn,
      this._menuStatsBtn,
      this._menuNewgroundsBtn
    ];
    const toolbarSpacing = 110;
    toolbar.forEach((button, index) => {
      if (!button) return;
      button.setPosition(_0x1e5db8 + (index - 1.5) * toolbarSpacing, screenHeight - 90);
    });
    this._positionMainMenuDecorations();
    if (this._socialIcons && this._socialIcons.length > 0) {
      const _iconSpacing = 52;
      const _originX = 65;
      const _originY = 478;
      const _layout = [{row:0,col:0},{row:0,col:1},{row:0,col:2},{row:0,col:3},
                       {row:1,col:0},{row:1,col:1},{row:1,col:2},{row:1,col:3},
                       {row:2,col:0},{row:2,col:1},{row:2,col:2},{row:2,col:3},{row:2,col:4}];
      this._socialIcons.forEach((icon, i) => {
        icon.x = _originX + _layout[i].col * _iconSpacing;
        icon.y = _originY + _layout[i].row * _iconSpacing;
      });
    }
  }
  _positionMainMenuDecorations() {
    const labelOffsetX = 110;
    const labelOffsetY = 94;
    if (this._iconBtn) {
      if (!this._chrSelDecor) {
        this._chrSelDecor = this.add.image(0, 0, "GJ_GameSheet03", "GJ_chrSel_001.png")
          .setScrollFactor(0).setDepth(31).setScale(0.82);
      }
      this._chrSelDecor.setPosition(this._iconBtn.x - labelOffsetX, this._iconBtn.y + labelOffsetY);
    }
    if (this._creatorBtn) {
      if (!this._lvlEditDecor) {
        this._lvlEditDecor = this.add.image(0, 0, "GJ_GameSheet03", "GJ_lvlEdit_001.png")
          .setScrollFactor(0).setDepth(31).setScale(0.82);
      }
      this._lvlEditDecor.setPosition(this._creatorBtn.x + labelOffsetX, this._creatorBtn.y + labelOffsetY);
    }
  }
  _spawnMenuCharacter() {
    if (!this._menuActive || (this._menuCharacters?.length || 0) >= 1) return;
    {
      // Atlas frames retain their trim data in Phaser.  Each icon layer must
      // therefore share the exact same local origin; manually compensating
      // its source rectangle was what split and clipped the old menu icons.
      const iconTexture = this.textures.get("GJ_GameSheetIcons");
      const hasFrame = frame => !!iconTexture?.has(frame);
      const cleanBase = (value, fallback) => {
        const base = String(value || fallback).replace(/_(?:glow|extra|[23])_001\.png$/, "").replace(/_001\.png$/, "");
        return hasFrame(`${base}_001.png`) ? base : fallback;
      };
      const randomBase = (pattern, fallback, requiredLayers) => {
        const candidates = (iconTexture?.getFrameNames?.() || [])
          .filter(name => pattern.test(name))
          .map(name => name.replace(/_001\.png$/, ""))
          .filter(base => requiredLayers.every(suffix => hasFrame(`${base}${suffix}`)));
        return candidates.length ? Phaser.Utils.Array.GetRandom(candidates) : fallback;
      };
      const randomAnimatedBase = (pattern, fallback) => {
        const candidates = (iconTexture?.getFrameNames?.() || [])
          .filter(name => pattern.test(name))
          .map(name => (name.match(/^(?:robot|spider)_\d+/) || [])[0])
          .filter(Boolean);
        return candidates.length ? Phaser.Utils.Array.GetRandom(candidates) : fallback;
      };
      // MenuGameLayer owns a PlayerObject rather than the equipped player.
      // Use its independently coloured, randomly selected menu forms. The
      // ordering below matches the player's back-to-front atlas layers.
      const palette = [
        0x7dff00, 0x00ff00, 0x00ff7f, 0x00ffff, 0x00c8ff, 0x007dff,
        0x0055ff, 0x7f00ff, 0xc800ff, 0xff00ff, 0xff007f, 0xff0000,
        0xff7f00, 0xffff00, 0xffffff, 0x808080
      ];
      const primaryColor = Phaser.Utils.Array.GetRandom(palette);
      let secondaryColor = Phaser.Utils.Array.GetRandom(palette);
      while (secondaryColor === primaryColor) secondaryColor = Phaser.Utils.Array.GetRandom(palette);
      const modes = [
        { id: "cube", base: randomBase(/^player_\d+_001\.png$/, cleanBase(window.currentPlayer, "player_01"), ["_2_001.png"]), layers: ["_2_001.png", "_001.png", "_extra_001.png"] },
        {
          id: "ship",
          base: randomBase(/^ship_\d+_001\.png$/, cleanBase(window.currentShip, "ship_01"), ["_2_001.png"]),
          // A menu ship is the same composite as the playable ship: it has
          // its own random cube pilot, independently selected from the hull.
          bodyBase: randomBase(/^player_\d+_001\.png$/, cleanBase(window.currentPlayer, "player_01"), ["_2_001.png"]),
          layers: [],
          animated: true
        },
        { id: "ball", base: randomBase(/^player_ball_\d+_001\.png$/, cleanBase(window.currentBall, "player_ball_01"), ["_2_001.png"]), layers: ["_2_001.png", "_001.png"] },
        // Ship, UFO, robot and spider are all PlayerObject composites. The player
        // renderer owns their offsets and frame pivots, so menu code must not
        // rebuild their atlas layers by hand.
        {
          id: "ufo",
          base: randomBase(/^bird_\d+_001\.png$/, cleanBase(window.currentBird, "bird_01"), ["_2_001.png", "_3_001.png"]),
          // The menu UFO uses its own randomly selected cube body, independent
          // from both the selected bird and the user's equipped cube.
          bodyBase: randomBase(/^player_\d+_001\.png$/, cleanBase(window.currentPlayer, "player_01"), ["_2_001.png"]),
          layers: [],
          animated: true
        },
        { id: "wave", base: randomBase(/^dart_\d+_001\.png$/, cleanBase(window.currentWave, "dart_01"), ["_2_001.png"]), layers: ["_2_001.png", "_001.png"] },
        { id: "robot", base: randomAnimatedBase(/^robot_\d+_01_001\.png$/, "robot_01"), layers: [], animated: true },
        { id: "spider", base: randomAnimatedBase(/^spider_\d+_01_001\.png$/, "spider_01"), layers: [], animated: true }
      ];
      const mode = Phaser.Utils.Array.GetRandom(modes);
      const baseFrame = mode.animated ? null : `${mode.base}_001.png`;
      if (!mode.animated && !hasFrame(baseFrame)) return;

      // MenuGameLayer lives below MenuLayer in the original scene graph: the
      // roaming player and all of its effects must pass behind menu controls.
      const character = this.add.container(0, 0).setScrollFactor(0).setDepth(24);
      const parts = [];
      const addPart = (base, suffix, tint, x = 0, y = 0, scale = 1) => {
        const frame = `${base}${suffix}`;
        if (!hasFrame(frame)) return null;
        const part = this.add.image(x, y, "GJ_GameSheetIcons", frame).setScale(scale);
        if (tint !== null) part.setTint(tint);
        parts.push(part);
        character.add(part);
        this._bindMenuCharacterClickTarget(character, part);
        return part;
      };
      for (const suffix of mode.layers) {
        const tint = suffix === "_001.png"
          ? primaryColor
          : (suffix === "_extra_001.png" ? null : secondaryColor);
        addPart(mode.base, suffix, tint);
      }
      if (!parts.length && !mode.animated) {
        character.destroy();
        return;
      }
      const rawWidth = mode.animated
        // PlayerObject's gameplay body is 60 units wide/high. The previous
        // placeholder value of 100 shrank every robot/spider frame and also
        // made its ground anchor use the wrong radius.
        ? 60
        : Math.max(1, ...parts.map(part => Math.abs(part.x) * 2 + (part.width || 1) * Math.abs(part.scaleX || 1)));
      const rawHeight = mode.animated
        ? 60
        : Math.max(1, ...parts.map(part => Math.abs(part.y) * 2 + (part.height || 1) * Math.abs(part.scaleY || 1)));
      // MenuGameLayer's roaming player is deliberately more prominent than a
      // playable icon. Keep the source aspect ratio, but give every form its
      // proper on-screen footprint instead of letting trimmed atlas frames
      // make some forms unexpectedly tiny.
      const targetSizeByMode = {
        cube: 64,
        ball: 68,
        // Composite ships include their small cube pilot. At 64px their hull
        // matches the normal in-level player footprint rather than becoming
        // noticeably larger than a cube/robot in the menu.
        ship: 64,
        ufo: 64,
        // PlayerObject renders a normal wave at 0.94 of its 52px atlas
        // frame. Keeping that natural footprint also makes mini wave exactly
        // the game's 0.6-times normal size.
        wave: 49,
        robot: 64,
        spider: 64
      };
      // PlayerObject's mini form is a 0.6 scale, including its collision
      // body and trail. It is deliberately a separate random menu variant.
      // Mini forms exist in the original menu rotation, but they are a rare
      // variation. At 28% almost every third menu player looked incorrectly
      // undersized; keep them visible without letting them dominate the run.
      const isMini = Math.random() < 0.10;
      // Animated forms receive their mini scale inside PlayerObject. Applying
      // it again here made mini robot/spider/UFO 0.36x instead of 0.6x.
      const animatedMiniScale = mode.animated && isMini ? 0.6 : 1;
      const targetSize = (targetSizeByMode[mode.id] || 70) * (mode.animated ? 1 : (isMini ? 0.6 : 1));
      const visualScale = targetSize / Math.max(rawWidth, rawHeight);
      const displayWidth = rawWidth * visualScale * animatedMiniScale;
      const displayHeight = rawHeight * visualScale * animatedMiniScale;
      // The menu player must be clickable over its entire visible footprint.
      // The old per-mode ratios cut the wave/ship almost in half and left
      // legs, wings and the outside of a robot outside their own hit area.
      // `rawWidth` / `rawHeight` already come from the trimmed rendered
      // frames, so this is neither padded nor larger than the icon itself.
      const hitWidth = Math.max(1, rawWidth);
      const hitHeight = Math.max(1, rawHeight);
      character.setSize(hitWidth, hitHeight);
      character.setScale(visualScale * animatedMiniScale);
      character.x = -displayWidth / 2 - 14;
      character._menuExitX = screenWidth + displayWidth / 2 + 14;
      character._menuMode = mode.id;
      character._menuIsActor = true;
      character._menuIsMini = isMini;
      character._menuDirection = 1;
      character._menuVisualScale = visualScale;
      // Ground movement uses the same speed conversion as GameScene's
      // playable PlayerObject: world units/frame -> menu pixels/second.
      const gameplayRunSpeed = Number(playerSpeed) * Number(d) * 60;
      character._menuSpeed = Number.isFinite(gameplayRunSpeed) ? gameplayRunSpeed : 420;
      // Gameplay positions an icon by its centre and a normal player reaches
      // the floor exactly 30 source units below that centre. Animated robot
      // and spider frames use that same PlayerObject pivot, not their broad
      // animation bounding box; anchoring to the bounding box made them float.
      character._menuGroundY = mode.animated
        ? T - 30 * visualScale * animatedMiniScale
        : T - displayHeight / 2;
      character._menuBaseY = 245 + Math.random() * 70;
      character._menuTrailTail = Math.max(12, displayWidth * 0.5);
      character._menuVelocityY = 0;
      character._menuOnGround = mode.id === "cube" || mode.id === "ufo" || mode.id === "ball" || mode.id === "robot" || mode.id === "spider";
      character._menuJumpTimer = mode.id === "cube"
        ? 0.22 + Math.random() * 0.48
        : 0.12 + Math.random() * 0.34;
      character._menuPhase = Math.random() * Math.PI * 2;
      character._menuCeilingY = 195 + displayHeight / 2;
      character._menuWaveDirection = Math.random() < 0.5 ? -1 : 1;
      character._menuWaveTopY = 195 + displayHeight / 2;
      character._menuWaveBottomY = character._menuGroundY - displayHeight / 4;
      character._menuPrimaryColor = primaryColor;
      character._menuSecondaryColor = secondaryColor;
      if (mode.animated) {
        character._menuAnimatedPlayer = this._createMenuAnimatedPlayer(mode, primaryColor, secondaryColor, isMini);
      }
      character._menuParticles = this.add.particles(0, 0, "GJ_WebSheet", {
        frame: "square.png",
        speed: { min: 24, max: 82 },
        angle: { min: 155, max: 205 },
        lifespan: { min: 220, max: 460 },
        scale: { start: 0.34, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [primaryColor, secondaryColor],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false
      }).setScrollFactor(0).setDepth(23.8);
      character._menuParticles.stop();
      character._menuParticleTimer = 0;
      if (mode.id === "ship" || mode.id === "ufo" || mode.id === "wave") {
        const streak = new StreakManager(this, "streak_01", 0.3, 10, 20 * 3.25 / 6, 100, secondaryColor, 1);
        streak._gfx.setScrollFactor(0).setDepth(23.65);
        streak.start();
        character._menuStreak = streak;
      }
      if (mode.id === "wave") {
        // PlayerObject uses its primary colour for both portions of the wave
        // ribbon. Passing the secondary colour here produced the oversized,
        // mismatched bar that did not follow the icon correctly.
        const waveTrail = new WaveTrail(this, primaryColor, primaryColor);
        // The menu's old 14px half-glow was far thicker than the native wave
        // ribbon relative to a 49px wave. Keep the same core/glow proportion
        // but use the calibrated in-game footprint; setMiniScale below also
        // makes the mini wave's trail exactly 0.6x.
        waveTrail._scale = 3.25 / 6;
        waveTrail._gfx.setScrollFactor(0).setDepth(23.7);
        waveTrail.setMiniScale(isMini);
        waveTrail.start();
        character._menuWaveTrail = waveTrail;
      }
      character.y = (mode.id === "ship" || mode.id === "wave")
        ? character._menuBaseY
        : character._menuGroundY;
      this._menuCharacters.push(character);
      return;
    }
    const iconTexture = this.textures.get("GJ_GameSheetIcons");
    const iconFrames = iconTexture?.getFrameNames?.() || [];
    // The original icon atlas stores many layers trimmed to a smaller rectangle.
    // Put every layer back on the source-image centre, otherwise e.g. ship and
    // wave eyes/glows visibly drift away from their base sprite.
    const getFrameMetrics = frameName => {
      const frame = iconTexture?.get(frameName);
      const customData = frame?.customData || {};
      const spriteSourceSize = customData.spriteSourceSize || {};
      const sourceSize = customData.sourceSize || {};
      const width = Number(frame?.realWidth ?? sourceSize.w ?? sourceSize.width ?? frame?.width ?? 60) || 60;
      const height = Number(frame?.realHeight ?? sourceSize.h ?? sourceSize.height ?? frame?.height ?? 60) || 60;
      const frameWidth = Number(frame?.width ?? spriteSourceSize.w ?? spriteSourceSize.width ?? width) || width;
      const frameHeight = Number(frame?.height ?? spriteSourceSize.h ?? spriteSourceSize.height ?? height) || height;
      const sourceX = Number(spriteSourceSize.x ?? 0) || 0;
      const sourceY = Number(spriteSourceSize.y ?? 0) || 0;
      return {
        width,
        height,
        offsetX: width / 2 - (sourceX + frameWidth / 2),
        offsetY: height / 2 - (sourceY + frameHeight / 2)
      };
    };
    const randomIconBase = (matcher, fallback, requiredLayers = ["_2_001.png"]) => {
      const candidates = iconFrames
        .filter(frame => matcher.test(frame))
        .map(frame => frame.replace(/_001\.png$/, ""))
        .filter(base => requiredLayers.every(layer => iconTexture?.has(`${base}${layer}`)));
      return candidates.length ? Phaser.Utils.Array.GetRandom(candidates) : fallback;
    };
    // Main-menu players use the discrete GD player-colour palette; their glow
    // layer is deliberately disabled, just as it is for the real menu players.
    const menuColors = [
      0x7dff00, 0x00ff00, 0x00ff7f, 0x00ffff, 0x00c8ff, 0x007dff,
      0x0055ff, 0x7f00ff, 0xc800ff, 0xff00ff, 0xff007f, 0xff0000,
      0xff7f00, 0xffff00, 0xffffff, 0x808080, 0x000000
    ];
    const primaryColor = Phaser.Utils.Array.GetRandom(menuColors);
    let secondaryColor = Phaser.Utils.Array.GetRandom(menuColors);
    while (secondaryColor === primaryColor) secondaryColor = Phaser.Utils.Array.GetRandom(menuColors);
    const modes = [
      { id: "cube", base: randomIconBase(/^player_\d+_001\.png$/, "player_01"), parts: ["_2_001.png", "_001.png", "_extra_001.png"] },
      { id: "ship", base: randomIconBase(/^ship_\d+_001\.png$/, "ship_01"), parts: ["_2_001.png", "_001.png", "_extra_001.png"] },
      { id: "ball", base: randomIconBase(/^player_ball_\d+_001\.png$/, "player_ball_01"), parts: ["_2_001.png", "_001.png"] },
      { id: "ufo", base: randomIconBase(/^bird_\d+_001\.png$/, "bird_01", ["_2_001.png", "_3_001.png"]), parts: ["_3_001.png", "_2_001.png", "_001.png", "_extra_001.png"] },
      { id: "wave", base: randomIconBase(/^dart_\d+_001\.png$/, "dart_01"), parts: ["_2_001.png", "_001.png"] },
      { id: "robot", base: randomIconBase(/^robot_\d+_01_001\.png$/, "robot_01_01"), parts: ["_2_001.png", "_001.png", "_extra_001.png"] },
      { id: "spider", base: randomIconBase(/^spider_\d+_01_001\.png$/, "spider_01_01"), parts: ["_2_001.png", "_001.png", "_extra_001.png"] },
      { id: "swing", base: randomIconBase(/^swing_\d+_001\.png$/, "swing_01"), parts: ["_2_001.png", "_001.png", "_extra_001.png"] }
    ];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const baseMetrics = getFrameMetrics(`${mode.base}_001.png`);
    const direction = 1;
    const targetSize = mode.id === "wave" ? 52 : 50;
    const visualScale = Math.min(1, targetSize / Math.max(baseMetrics.width, baseMetrics.height));
    const displayWidth = baseMetrics.width * visualScale;
    const displayHeight = baseMetrics.height * visualScale;
    const character = this.add.container(-displayWidth - 8, T - displayHeight / 2).setScrollFactor(0).setDepth(24);
    const visualParts = [];
    for (const suffix of mode.parts) {
      const frame = `${mode.base}${suffix}`;
      if (!iconTexture?.has(frame)) continue;
      const isPrimaryLayer = suffix === "_001.png" || suffix === "_extra_001.png";
      const metrics = getFrameMetrics(frame);
      const part = this.add.image(metrics.offsetX, metrics.offsetY, "GJ_GameSheetIcons", frame);
      part.setTint(isPrimaryLayer ? primaryColor : secondaryColor);
      visualParts.push(part);
      character.add(part);
    }
    if (!visualParts.length) {
      character.destroy();
      return;
    }
    character.setScale(direction * visualScale, visualScale);
    // Base-frame bounds are the actual source dimensions from GJ_GameSheetIcons,
    // rather than one square hitbox shared by every game mode.  The small extra
    // margin makes a finger click forgiving without stealing clicks from buttons.
    const hitPadding = 5 / visualScale;
    character.setSize(baseMetrics.width + hitPadding * 2, baseMetrics.height + hitPadding * 2);
    character.setInteractive(
      new Phaser.Geom.Rectangle(
        -baseMetrics.width / 2 - hitPadding,
        -baseMetrics.height / 2 - hitPadding,
        baseMetrics.width + hitPadding * 2,
        baseMetrics.height + hitPadding * 2
      ),
      Phaser.Geom.Rectangle.Contains
    );
    character._menuMode = mode.id;
    character._menuDirection = direction;
    character._menuVisualScale = visualScale;
    character._menuSpeed = 165 + Math.random() * 35;
    character._menuGroundY = T - displayHeight / 2;
    character._menuBaseY = 275 + Math.random() * 72;
    character._menuTrailTail = Math.max(12, displayWidth * 0.42);
    character._menuVelocityY = 0;
    character._menuOnGround = mode.id === "cube" || mode.id === "robot" || mode.id === "spider" || mode.id === "ufo" || mode.id === "ball";
    character._menuJumpTimer = 0.25 + Math.random() * 1.1;
    character._menuPhase = Math.random() * Math.PI * 2;
    character._menuCeilingY = 190 + displayHeight / 2;
    character._menuZigTimer = 0.18 + Math.random() * 0.18;
    character._menuWaveDirection = Math.random() < 0.5 ? -1 : 1;
    character._menuPrimaryColor = primaryColor;
    character._menuSecondaryColor = secondaryColor;
    character._menuParticles = this.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: { min: 24, max: 82 },
      angle: { min: 155, max: 205 },
      lifespan: { min: 220, max: 460 },
      frequency: mode.id === "wave" ? 38 : 72,
      scale: { start: 0.34, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [primaryColor, secondaryColor],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    }).setScrollFactor(0).setDepth(23.8);
    character._menuParticles.stop();
    character._menuParticleTimer = 0;
    if (mode.id === "ship" || mode.id === "ufo" || mode.id === "wave" || mode.id === "swing") {
      const streak = new StreakManager(this, "streak_01", 0.3, 10, 20 * 3.25 / 6, 100, secondaryColor, 1);
      streak._gfx.setScrollFactor(0).setDepth(23.65);
      streak.start();
      character._menuStreak = streak;
    }
    if (mode.id === "wave") {
      const waveTrail = new WaveTrail(this, primaryColor);
      waveTrail._gfx.setScrollFactor(0).setDepth(23.7);
      waveTrail.start();
      character._menuWaveTrail = waveTrail;
    }
    if (mode.id === "ship" || mode.id === "wave" || mode.id === "swing") character.y = character._menuBaseY;
    character.on("pointerdown", () => this._explodeMenuCharacter(character));
    this._menuCharacters.push(character);
  }
  _bindMenuCharacterClickTarget(character, target) {
    if (!character || !target || target._menuClickBound) return;
    // These are the actual atlas pixels being drawn, rather than a broad
    // Container rectangle. Pixel-perfect input keeps the click area equal to
    // the visible menu icon, including moving robot/spider animation parts.
    target.setInteractive({ pixelPerfect: true, alphaTolerance: 1, useHandCursor: true });
    target._menuClickBound = true;
    target.on("pointerdown", (_pointer, _localX, _localY, nativeEvent) => {
      nativeEvent?.stopPropagation?.();
      this._explodeMenuCharacter(character);
    });
  }
  _createMenuAnimatedPlayer(mode, primaryColor, secondaryColor, isMini) {
    // Ship/UFO and robot/spider are PlayerObject composites, not a single
    // icon frame. Reuse the gameplay renderer for their attachments, frame
    // timing and pivots.
    const state = new PlayerState();
    state.isMini = !!isMini;
    state.isFlying = mode.id === "ship";
    state.isRobot = mode.id === "robot";
    state.isSpider = mode.id === "spider";
    state.isUfo = mode.id === "ufo";
    state.onGround = true;
    state.canJump = true;
    state.y = 0;
    state.lastY = 0;
    const equippedKeys = mode.id === "ship"
      ? ["currentPlayer", "currentShip"]
      : (mode.id === "ufo"
        ? ["currentPlayer", "currentBird"]
        : [mode.id === "robot" ? "currentRobot" : "currentSpider"]);
    const previousEquipped = Object.fromEntries(equippedKeys.map(key => [key, window[key]]));
    let visual;
    try {
      // Sprite sets are constructed synchronously. Temporarily selecting the
      // random menu icon lets PlayerObject resolve every animation part to it
      // without changing the user's saved equipped icon.
      if (mode.id === "ship") {
        window.currentPlayer = mode.bodyBase;
        window.currentShip = mode.base;
      } else if (mode.id === "ufo") {
        window.currentPlayer = mode.bodyBase;
        window.currentBird = mode.base;
      } else {
        window[equippedKeys[0]] = mode.base;
      }
      visual = new PlayerObject(this, state, this._level);
    } finally {
      for (const key of equippedKeys) window[key] = previousEquipped[key];
    }
    if (!visual) return null;
    visual._primaryColor = () => primaryColor;
    visual._secondaryColor = () => secondaryColor;
    // syncSprites normally reapplies the user's equipped frames every frame.
    // Menu players are deliberately random, so retain the temporary frames
    // constructed above rather than replacing them with the saved icons.
    visual._defaultMiniIcon = () => {};
    if (mode.id === "robot") visual._getRobotIconBase = () => mode.base;
    if (mode.id === "spider") visual._getSpiderIconBase = () => mode.base;
    visual._applyPlayerTints?.();
    visual.setCubeVisible?.(false);
    visual.setShipVisible?.(false);
    visual.setBallVisible?.(false);
    visual.setWaveVisible?.(false);
    visual.setBirdVisible?.(false);
    visual.setRobotVisible?.(false);
    visual.setSpiderVisible?.(false);
    for (const emitter of [
      visual._particleEmitter, visual._flyParticleEmitter, visual._flyParticle2Emitter,
      visual._shipDragEmitter, visual._landEmitter1, visual._landEmitter2
    ]) {
      emitter?.stop?.();
      emitter?.setVisible?.(false);
    }
    visual._streak?.stop?.();
    visual._streak?._gfx?.setVisible?.(false);
    visual._waveTrail?.stop?.();
    visual._waveTrail?._gfx?.setVisible?.(false);
    visual._waveTrail?._glowGfx?.setVisible?.(false);
    visual._hitboxGraphics?.setVisible?.(false);
    visual._dashAnimationSprite?.setVisible?.(false);
    for (const fire of (visual._swingFires || [])) fire.sprite?.setVisible?.(false);
    return visual;
  }
  _updateMenuAnimatedVisual(character, seconds) {
    const visual = character?._menuAnimatedPlayer;
    if (!visual) return;
    const state = visual.p;
    const previousY = Number.isFinite(state.y) ? state.y : (T - character.y);
    const nextY = T - character.y;
    state.onGround = !!character._menuOnGround;
    state.onCeiling = false;
    state.yVelocity = Number(character._menuVelocityY) || 0;
    state.lastY = previousY;
    state.y = nextY;
    state.isJumping = !state.onGround;
    if (character._menuMode === "robot") {
      visual._syncRobotAnimation?.(character.x, character.y, seconds);
    } else if (character._menuMode === "spider") {
      // No teleport timer is ever set for a menu spider: it continuously uses
      // Spider_run rather than its gameplay jump/teleport animation.
      state._spiderTeleportAnimTimer = 0;
      visual._syncSpiderAnimation?.(character.x, character.y, seconds);
    } else if (character._menuMode === "ship") {
      // The same ship renderer used in gameplay keeps the random cube pilot
      // attached while the ship pitches up and down.
      visual._rotation = character.rotation || 0;
      visual.setCubeVisible?.(true);
      visual.setShipVisible?.(true);
      visual.syncSprites?.(0, 0, seconds, character.x);
    } else if (character._menuMode === "ufo") {
      // This is the exact normal renderer: it positions the bird and the
      // 0.55-scale cube body from one pivot, then applies UFO tilt.
      visual.setCubeVisible?.(true);
      visual.setBirdVisible?.(true);
      visual.syncSprites?.(0, 0, seconds, character.x);
    }
    const layers = character._menuMode === "robot"
      ? visual._robotLayers
      : (character._menuMode === "spider"
        ? visual._spiderLayers
        : character._menuMode === "ship"
          ? [...(visual._playerLayers || []), ...(visual._shipLayers || [])]
          : [...(visual._playerLayers || []), ...(visual._birdLayers || [])]);
    const scale = Number(character._menuVisualScale) || 1;
    for (const layer of (layers || [])) {
      const sprite = layer?.sprite;
      if (!sprite?.active) continue;
      this._bindMenuCharacterClickTarget(character, sprite);
      // PlayerObject positions frames at native icon scale. Apply the menu
      // footprint around the animated actor's origin afterwards, preserving
      // all frame pivots rather than flattening the animation into one image.
      sprite.x = character.x + (sprite.x - character.x) * scale;
      sprite.y = character.y + (sprite.y - character.y) * scale;
      sprite.scaleX *= scale;
      sprite.scaleY *= scale;
      sprite.setDepth(24 + Math.max(0, (Number(sprite.depth) || 8) - 8) * 0.01);
    }
  }
  _destroyMenuAnimatedPlayer(visual) {
    if (!visual) return;
    for (const emitter of [
      visual._particleEmitter, visual._flyParticleEmitter, visual._flyParticle2Emitter,
      visual._shipDragEmitter, visual._landEmitter1, visual._landEmitter2
    ]) {
      emitter?.stop?.();
      emitter?.destroy?.();
    }
    visual._streak?.stop?.();
    visual._streak?._gfx?.destroy?.();
    visual._waveTrail?.stop?.();
    visual._waveTrail?._gfx?.destroy?.();
    visual._waveTrail?._glowGfx?.destroy?.();
    visual._trailContainer?.destroy?.();
    const visualLayers = new Set([
      ...(visual._allLayers || []),
      ...(visual._shipLayers || []),
      ...(visual._birdLayers || []),
      ...(visual._robotLayers || []),
      ...(visual._spiderLayers || [])
    ]);
    for (const layer of visualLayers) layer?.sprite?.destroy?.();
    visual._dashAnimationSprite?.destroy?.();
    for (const fire of (visual._swingFires || [])) fire.sprite?.destroy?.();
    visual._robotJumpFlameSprite?.destroy?.();
    visual._hitboxGraphics?.destroy?.();
    visual._aboveContainer?.destroy?.();
    for (const circle of (visual._spiderTeleportCircles || [])) circle?.destroy?.();
  }
  _destroyMenuCharacter(character) {
    if (!character) return;
    character._menuParticles?.stop?.();
    character._menuParticles?.destroy?.();
    character._menuStreak?.stop?.();
    character._menuStreak?.reset?.();
    character._menuStreak?._gfx?.destroy?.();
    character._menuWaveTrail?.stop?.();
    character._menuWaveTrail?._gfx?.destroy?.();
    character._menuWaveTrail?._glowGfx?.destroy?.();
    this._destroyMenuAnimatedPlayer(character._menuAnimatedPlayer);
    character.destroy?.();
  }
  _updateMenuStreak(character, seconds) {
    const streak = character?._menuStreak;
    if (!streak) return;
    const rotation = character.rotation || 0;
    // This is the same attachment point PlayerObject uses for a wave: it is
    // offset perpendicular to the icon, not a long distance behind it.
    const isWave = character._menuMode === "wave";
    const tail = character._menuTrailTail || 23;
    const tailX = isWave
      ? character.x - Math.sin(rotation) * 4
      : character.x - Math.cos(rotation) * tail;
    const tailY = isWave
      ? character.y + Math.cos(rotation) * 4
      : character.y - Math.sin(rotation) * tail;
    streak.setPosition(tailX, tailY);
    streak.update(seconds);
  }
  _updateMenuWaveTrail(character, seconds) {
    const trail = character?._menuWaveTrail;
    if (!trail) return;
    // WaveTrail samples the wave centre. Using the exhaust point here was
    // what displaced the ribbon and created broken-looking corners.
    trail.setPosition(character.x, character.y);
    trail.update(seconds, true, -200);
  }
  _explodeMenuCharacter(character) {
    if (!character || !character.active || character._menuDestroying) return;
    character._menuDestroying = true;
    this._menuIsDestroyingPlayer = true;
    const x = character.x;
    const y = character.y;
    this._audio.playEffect("explode_11", { volume: 0.65 });
    // explodeEffect.plist: a short 100-particle square burst, emitted from a
    // small area around the destroyed icon. The menu uses the icon colours
    // while retaining the resource effect's timing, speeds, and size range.
    const particles = this.add.particles(0, 0, "GJ_WebSheet", {
      frame: "square.png",
      speed: { min: 100, max: 400 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 50, max: 800 },
      scale: { start: 10 / 32, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [character._menuPrimaryColor || 0xffffff, character._menuSecondaryColor || 0xffffff],
      x: { min: -10, max: 10 },
      y: { min: -10, max: 10 },
      quantity: 100,
      emitting: false,
      blendMode: S
    }).setScrollFactor(0).setDepth(24.2);
    particles.explode(100, x, y);
    // The original death effect also has the brief expanding colour flash at
    // its centre. Draw it above the shards but below the menu controls.
    const flash = this.add.graphics().setScrollFactor(0).setDepth(24.3).setBlendMode(S);
    const flashState = { t: 0 };
    this.tweens.add({
      targets: flashState,
      t: 1,
      duration: 300,
      ease: "Quad.Out",
      onUpdate: () => {
        const radius = 12 + flashState.t * 76;
        const alpha = Math.max(0, 1 - flashState.t * flashState.t);
        flash.clear();
        flash.fillStyle(character._menuPrimaryColor || 0xffffff, alpha);
        flash.fillCircle(x, y, radius);
      },
      onComplete: () => flash.destroy()
    });
    // Keep a short, deterministic shard burst in front of the menu as well.
    // This is the immediate visual acknowledgement of the icon click; the
    // particle emitter above remains the softer trailing part of the effect.
    const burst = this.add.container(x, y).setScrollFactor(0).setDepth(24.25);
    const shardColors = [
      character._menuPrimaryColor || 0xffffff,
      character._menuSecondaryColor || 0xffffff,
      0xffffff
    ];
    for (let i = 0; i < 18; i++) {
      const fragment = this.add.rectangle(0, 0, 6, 6, shardColors[i % shardColors.length]);
      fragment.setAngle(Math.random() * 360);
      burst.add(fragment);
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.28;
      const distance = 32 + Math.random() * 66;
      this.tweens.add({
        targets: fragment,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        angle: fragment.angle + 180 + Math.random() * 270,
        scaleX: 0.12,
        scaleY: 0.12,
        alpha: 0,
        duration: 360 + Math.random() * 180,
        ease: "Quad.Out"
      });
    }
    this.time.delayedCall(850, () => particles.destroy());
    this.time.delayedCall(650, () => burst.destroy());
    this._menuCharacters = (this._menuCharacters || []).filter(item => item !== character);
    this._destroyMenuCharacter(character);
    this._menuIsDestroyingPlayer = false;
  }
  _updateMenuCharacters(dt) {
    const seconds = Math.max(0, Math.min(0.05, Number(dt) || 0));
    this._menuCharacterSpawnTimer = (this._menuCharacterSpawnTimer ?? 0.35) - seconds;
    if (this._menuCharacterSpawnTimer <= 0 && (this._menuCharacters?.length || 0) === 0) {
      this._spawnMenuCharacter();
      this._menuCharacterSpawnTimer = 0.6 + Math.random() * 0.7;
    }
    const characters = this._menuCharacters || [];
    for (const character of [...characters]) {
      if (!character?.active) continue;
      character.x += character._menuSpeed * seconds;
      character._menuPhase += seconds * 2.8;
      // GameScene integrates vertical motion in game units with
      // `quantizedDelta * d`. Keep that exact unit conversion here instead
      // of mixing pixel/second velocities with arbitrary menu gravity.
      const verticalStep = seconds * 60 * (Number(d) || 1);
      const gravity = Number(p) || 1.916;
      switch (character._menuMode) {
        case "cube": {
          let jumpedThisFrame = false;
          if (character._menuOnGround) {
            character.y = character._menuGroundY;
            character.rotation = Math.round(character.rotation / (Math.PI / 2)) * (Math.PI / 2);
            character._menuJumpTimer -= seconds;
            if (character._menuJumpTimer <= 0) {
              character._menuOnGround = false;
              character._menuVelocityY = 22.360064 * (character._menuIsMini ? 0.8 : 1);
              jumpedThisFrame = true;
            }
          }
          if (!character._menuOnGround) {
            if (!jumpedThisFrame) {
              character._menuVelocityY -= gravity * verticalStep * (character._menuIsMini ? 0.975 : 1);
            }
            character.y -= character._menuVelocityY * verticalStep;
            character.rotation += seconds * 3.65;
            if (character.y >= character._menuGroundY) {
              character.y = character._menuGroundY;
              character._menuVelocityY = 0;
              character._menuOnGround = true;
              character._menuJumpTimer = 0.18 + Math.random() * 0.6;
            }
          }
          break;
        }
        case "robot": {
          let jumpedThisFrame = false;
          if (character._menuOnGround) {
            character.y = character._menuGroundY;
            character._menuJumpTimer -= seconds;
            if (character._menuJumpTimer <= 0) {
              character._menuOnGround = false;
              character._menuVelocityY = 10.25 * (character._menuIsMini ? (1 / 1.2) : 1);
              character._menuRobotHold = true;
              character._menuRobotHoldTimer = 0;
              jumpedThisFrame = true;
            }
          }
          if (!character._menuOnGround) {
            if (!jumpedThisFrame) {
              if (character._menuRobotHold) {
                character._menuRobotHoldTimer += verticalStep;
                if (character._menuRobotHoldTimer >= 15.5) {
                  character._menuRobotHold = false;
                  if (character._menuVelocityY > 0) character._menuVelocityY *= 0.9;
                } else {
                  character._menuVelocityY += gravity * 0.2 * verticalStep * (character._menuIsMini ? (1 / 1.2) : 1);
                }
              }
              character._menuVelocityY -= gravity * (character._menuRobotHold ? 0.15 : 0.81) * verticalStep;
            }
            character._menuVelocityY = Phaser.Math.Clamp(character._menuVelocityY, -28, 30 * (character._menuIsMini ? (1 / 1.2) : 1));
            character.y -= character._menuVelocityY * verticalStep;
            if (character.y >= character._menuGroundY) {
              character.y = character._menuGroundY;
              character._menuVelocityY = 0;
              character._menuOnGround = true;
              character._menuRobotHold = false;
              character._menuJumpTimer = 0.35 + Math.random() * 0.9;
            }
          }
          character.rotation = 0;
          break;
        }
        case "ufo": {
          const isMini = character._menuIsMini;
          if (character._menuOnGround) {
            character.y = character._menuGroundY;
            character._menuVelocityY = 0;
            character._menuJumpTimer -= seconds;
            if (character._menuJumpTimer <= 0) {
              character._menuVelocityY = isMini ? 13.296 : 13.742;
              character._menuOnGround = false;
            }
          }
          if (!character._menuOnGround) {
            const fastGravity = isMini ? 0.525 / 0.85 : 0.525;
            const slowGravity = isMini ? 0.425 / 0.85 : 0.425;
            const ufoGravity = character._menuVelocityY > 3.832796 ? fastGravity : slowGravity;
            character._menuVelocityY -= gravity * ufoGravity * verticalStep;
            character._menuVelocityY = Phaser.Math.Clamp(character._menuVelocityY, isMini ? -15.058 : -12.8, isMini ? 18.824 : 16);
            character.y -= character._menuVelocityY * verticalStep;
            if (character.y >= character._menuGroundY) {
              character.y = character._menuGroundY;
              character._menuVelocityY = 0;
              character._menuOnGround = true;
              // A menu UFO receives a new autonomous press only after it has
              // landed. The old timer ran while airborne and retriggered on
              // every landing, which is why it appeared to hover forever.
              character._menuJumpTimer = 0.42 + Math.random() * 0.62;
            }
          }
          // PlayerObject's UFO tilt is based on y movement, clamped between
          // -0.11 and 3 radians and eased each frame.
          const targetTilt = Phaser.Math.Clamp(character._menuVelocityY * 0.015, -0.11, 0.32);
          character.rotation = Phaser.Math.Linear(character.rotation || targetTilt, targetTilt, Math.min(1, seconds * 8.5));
          break;
        }
        case "ball": {
          character.y = character._menuGroundY;
          // PlayerObject.updateBallRoll: 0.48 of the horizontal distance,
          // scaled by the gameplay ball radius (g / 2). This makes the ball
          // roll with the moving floor instead of using an arbitrary slow
          // menu spin rate.
          const ballMiniRollScale = character._menuIsMini ? (1 / 0.8) : 1;
          const menuTravel = character._menuSpeed * seconds;
          character.rotation += character._menuDirection *
            (menuTravel / (g / 2)) * 0.48 * ballMiniRollScale;
          break;
        }
        case "ship": {
          {
            const miniScale = character._menuIsMini ? 1.176470588 : 1;
            // Use the exact ship acceleration from PlayerObject._updateFlyJump,
            // while choosing an autonomous press/release from its braking
            // distance. The previous centre-line switch released far too late:
            // a fast ship then spent several frames pinned at the ceiling/floor.
            const flightSpan = character._menuGroundY - character._menuCeilingY;
            const safetyBand = Math.max(18, flightSpan * 0.22);
            const topTurnY = character._menuCeilingY + safetyBand;
            const bottomTurnY = character._menuGroundY - safetyBand;
            const previousVelocity = character._menuVelocityY;
            const rising = previousVelocity > 0;
            const brakeAcceleration = gravity * 1.2 * 0.4 * miniScale;
            const liftAcceleration = gravity * 0.5 * miniScale;
            if (rising) {
              const riseBrakeDistance = (previousVelocity * previousVelocity) /
                Math.max(0.001, 2 * brakeAcceleration);
              character._menuFlightInput = character.y - riseBrakeDistance > topTurnY;
            } else {
              const fallBrakeDistance = (previousVelocity * previousVelocity) /
                Math.max(0.001, 2 * liftAcceleration);
              character._menuFlightInput = character.y + fallBrakeDistance >= bottomTurnY;
            }
            const falling = previousVelocity < gravity;
            let gravityState = character._menuFlightInput ? -1 : (falling ? 0.8 : 1.2);
            let strength = character._menuFlightInput && falling ? 0.5 : 0.4;
            character._menuVelocityY -= gravity * verticalStep * gravityState * strength * miniScale;
            character._menuVelocityY = Phaser.Math.Clamp(character._menuVelocityY, -12.8 * miniScale, 16 * miniScale);
            character.y -= character._menuVelocityY * verticalStep;
            if (character.y <= character._menuCeilingY) {
              character.y = character._menuCeilingY;
              // This should only be a last-resort guard. Nudge back into the
              // lane instead of leaving the icon visibly frozen on the edge.
              character._menuVelocityY = -Math.max(1, Math.abs(character._menuVelocityY) * 0.2);
              character._menuFlightInput = false;
            } else if (character.y >= character._menuGroundY) {
              character.y = character._menuGroundY;
              character._menuVelocityY = Math.max(1, Math.abs(character._menuVelocityY) * 0.2);
              character._menuFlightInput = true;
            }
            // PlayerObject.updateShipRotation uses the actual horizontal and
            // vertical distance travelled, then slerps to that flight angle.
            // Using a clamped velocity multiplier here made a climbing ship
            // face the wrong way and kept its PlayerObject hull unrotated.
            // The gameplay loop advances flight physics in four substeps,
            // then updates the ship pitch once for the full frame. Preserve
            // that same ratio here; using the full vertical frame distance
            // made the menu ship point far too steeply and appear to shoot up.
            const shipFrameDelta = verticalStep / Math.max(0.0001, Number(d) || 0.9);
            const shipSubSteps = Math.max(1, Math.round(shipFrameDelta * 4));
            const shipHorizontalStep = Math.max(0.001,
              shipFrameDelta * (Number(playerSpeed) || 11.540004) * (Number(d) || 0.9));
            const shipVerticalStep = -character._menuVelocityY * (verticalStep / shipSubSteps);
            const targetTilt = Math.atan2(shipVerticalStep, shipHorizontalStep);
            const shipTurnT = Math.min(1, shipFrameDelta * 0.15);
            character.rotation = this._player?.slerp2D?.(
              Number.isFinite(character.rotation) ? character.rotation : 0,
              targetTilt,
              shipTurnT
            ) ?? targetTilt;
          }
          break;
        }
        case "spider": {
          // A menu spider is intentionally a running player. It never gets a
          // jump input, so none of the normal-mode teleport behaviour occurs.
          character.y = character._menuGroundY;
          character._menuOnGround = true;
          character._menuVelocityY = 0;
          character.rotation = 0;
          break;
        }
        case "swing":
          character.y = character._menuBaseY + Math.sin(character._menuPhase * 1.15) * 46;
          character.rotation = Math.cos(character._menuPhase * 1.15) * 0.22;
          break;
        case "wave":
          // Wave velocity comes directly from PlayerObject._updateWaveJump.
          // Normal waves are 45°, mini waves use the game's steeper 62° line.
          const waveBaseSpeed = character._menuIsMini ? 22.7700072 : 11.3850036;
          const waveVelocity = waveBaseSpeed * ((Number(playerSpeed) || 11.540004) / 11.540004);
          const waveYVelocity = character._menuWaveDirection < 0 ? waveVelocity : -waveVelocity;
          character.y -= waveYVelocity * verticalStep;
          if (character.y <= character._menuWaveTopY || character.y >= character._menuWaveBottomY) {
            character.y = Phaser.Math.Clamp(
              character.y,
              character._menuWaveTopY,
              character._menuWaveBottomY
            );
            character._menuWaveDirection *= -1;
          }
          const waveAngle = character._menuIsMini ? (62 * Math.PI / 180) : Math.PI / 4;
          const waveTargetRotation = character._menuWaveDirection < 0 ? -waveAngle : waveAngle;
          // Match PlayerObject._updateWaveJump: it slerps toward the new
          // diagonal using the same 0.55 turn rate instead of snapping at the
          // corner. This preserves a crisp wave while removing the jarring
          // one-frame rotation change in the menu.
          const waveTurnT = Math.min(1, 0.55 * verticalStep);
          character.rotation = this._player?.slerp2D?.(
            Number.isFinite(character.rotation) ? character.rotation : 0,
            waveTargetRotation,
            waveTurnT
          ) ?? waveTargetRotation;
          break;
      }
      this._updateMenuAnimatedVisual(character, seconds);
      const tail = character._menuTrailTail || 23;
      const tailX = character.x - Math.cos(character.rotation || 0) * tail;
      const tailY = character.y - Math.sin(character.rotation || 0) * tail;
      const leavesParticles = character._menuMode === "ship" || character._menuMode === "swing" ||
        (character._menuMode === "ufo" && !character._menuOnGround) ||
        ((character._menuMode === "cube" || character._menuMode === "robot") && !character._menuOnGround);
      if (leavesParticles) {
        character._menuParticleTimer += seconds;
        if (character._menuParticleTimer >= 0.055) {
          const particleCount = Math.min(3, Math.floor(character._menuParticleTimer / 0.055));
          character._menuParticles?.explode?.(particleCount, tailX, tailY);
          character._menuParticleTimer %= 0.055;
        }
      } else {
        character._menuParticleTimer = 0;
      }
      this._updateMenuStreak(character, seconds);
      this._updateMenuWaveTrail(character, seconds);
      if (character.x < -120 || character.x > (character._menuExitX ?? screenWidth + 120)) {
        this._menuCharacters = this._menuCharacters.filter(item => item !== character);
        this._destroyMenuCharacter(character);
        this._menuCharacterSpawnTimer = 0.5 + Math.random() * 0.8;
      }
    }
  }
  _getGameplayAnchorX() {
    // GJBaseGameLayer::resetCamera sets the forward camera distance to 75
    // GD units (Steam 3498cb); updateCamera divides it by zoom (3461df).
    // Web coordinates are twice GD coordinates. A fixed screen fraction
    // also gave camera-locked decorations the wrong accumulated movement
    // when the zoom changed, exposing the edges of Blackfire's sunlight.
    const zoom = Math.max(0.01, this._level?.cameraState?.values.zoom || 1);
    return screenWidth / 2 - 150 / zoom;
  }
  _positionAttemptsLabel() {
    let _0xdbdd91 = this._cameraX + screenWidth / 2;
    if (this._levelAttempts > 1) {
      _0xdbdd91 += 100;
    }
    this._attemptsLabel.setPosition(_0xdbdd91, 150);
  }
  // A fresh attempt from the level's start holds the camera's left edge at
  // x = 15 GD (measured on a level without camera triggers: the player runs
  // in from the left edge and the camera only starts to follow, at full
  // speed, once the player reaches its 75-unit lead); 30 in web units.
  _gdFollowCameraX(playerX = this._playerWorldX) {
    // updateCamera (345fd5, 347424) bounds the corner of the zoomed view, after
    // the camera offset. Zoomed in, the camera therefore starts following sooner,
    // and camera-locked groups (Blackfire's sunlight) keep what that start gave.
    const values = this._level?.cameraState?.values;
    const zoom = Math.max(0.01, values?.zoom || 1);
    const follow = this._level?.cameraState?.follow;
    if (playerX === this._playerWorldX && follow?.frame === this._physicsFrame && follow.zoom === zoom) return follow.cameraX;
    const floor = (this._cameraFloorX ?? -Infinity) + screenWidth / 2 * (1 / zoom - 1) - (values?.offsetX || 0);
    return Math.max(playerX - this._getGameplayAnchorX(), floor);
  }
  // Triggers run in the order of their X, whatever their kind, so a channel change
  // stops what the old channel still had in front of it and nothing behind it
  // (Troll Madness turns to channel 999 at X -645 of its start). Kinds checked one
  // after the other would each see the change at a different place.
  _meetStartTriggers(playerX, restart = false) {
    const level = this._level, startPos=restart&&this._startPosIndex>=0;
    const xs = level.startTriggerXs(playerX,startPos);
    if (!xs) {
      if (restart) level.checkToggleTriggers?.(playerX);
      else level.checkSpawnTriggers(playerX);
      return;
    }
    for (const x of xs) {
      for (const trigger of level.checkColorTriggers(x)) {
        this._colorManager.triggerColor(trigger.index, trigger.color, trigger.duration, trigger.colorOptions);
      }
      level.checkMoveTriggers(x); level.checkFollowTriggers(x); level.checkScaleTriggers(x);
      level.checkCountTriggers(x); level.checkEndTriggers(x); level.checkKeyframeTriggers(x);
      level.checkSpawnTriggers(x); level.checkLogicTriggers?.(x); level.stepSpawnTriggers(0, this._colorManager);
      level.checkAnimationTriggers?.(x);
      level.checkRotateTriggers(x); level.checkAlphaTriggers(x); level.checkToggleTriggers(x);
      level.checkShakeTriggers(x); level.checkStopTriggers(x, this._state.y); level.checkPulseTriggers(x);
      level.checkShaderTriggers(x); level.checkCameraTriggers(x); level.checkAreaTriggers?.(x);
      level.checkEnterEffectTriggers(x);
      if(startPos){
        // The Start Pos supplies its own direction and channel. Consuming
        // older turns prevents the next tick from replaying a previous room.
        for(const ignored of level._orderedTriggers('_gameplayTriggers','_gameplayTriggerIdx',x,this._state.y)){}
      }else level.checkGameplayTriggers(x, this._state.y);
    }
  }
  _loadStartPosEffects(pos) {
    const l=this._level,timeline=l.getStartTimeline();
    const seconds=Math.min(3600,timeline.timeForPosition(pos.x,pos.y,+pos.raw?.kA26 || 0,+pos.raw?.kA19 || 0));
    const saved={x:this._playerWorldX,y:this._state.y,left:this._state.isGoingLeft,gravity:this._state.gravityFlipped,frame:this._physicsFrame};
    const activate=(p)=>{
      this._playerWorldX=p.x;this._state.y=p.y;
      l._gameplayChannel=p.channel;l._channelDirections[p.channel]={x:p.ux,y:p.uy};
      for(const c of l.checkColorTriggers(p.x)) this._colorManager.triggerColor(c.index,c.color,c.duration,c.colorOptions);
      l.checkMoveTriggers(p.x);l.checkFollowTriggers(p.x);l.checkScaleTriggers(p.x);
      l.checkCountTriggers(p.x);l.checkKeyframeTriggers(p.x);l.checkSpawnTriggers(p.x);l.checkLogicTriggers?.(p.x);
      l.checkAnimationTriggers?.(p.x);l.checkRotateTriggers(p.x);l.checkAlphaTriggers(p.x);
      l.checkToggleTriggers(p.x);l.checkStopTriggers(p.x,p.y);l.checkPulseTriggers(p.x);
      l.checkShaderTriggers(p.x);l.checkCameraTriggers(p.x);l.checkAreaTriggers?.(p.x);l.checkEnterEffectTriggers(p.x);
      // Position comes from LevelTools, rather than collision or Rotate Gameplay.
      for(const ignored of l._orderedTriggers('_gameplayTriggers','_gameplayTriggerIdx',p.x,p.y)) {}
    };
    // Native loadStartPos evaluates effect-manager commands in 1/60-second
    // steps. Splitting at route boundaries also consumes the departing channel.
    let elapsed=0;
    activate(timeline.positionAt(0));
    for(const segment of timeline.segments) {
      if(segment.time>seconds+1e-9) break;
      const end=Math.min(seconds,segment.end);
      while(elapsed<end-1e-9) {
        const next=Math.min(end,elapsed+1/60),dt=next-elapsed;
        this._physicsFrame++;
        const distance=(next-segment.time)*segment.speed;
        activate({x:(segment.x+segment.ux*distance)*2,y:(segment.y+segment.uy*distance-90)*2,channel:segment.channel,ux:segment.ux,uy:segment.uy});
        l.stepScaleTriggers(dt);l.stepRotateTriggers(dt);l.stepMoveTriggers(dt,true);l.stepFollowTriggers(dt);
        l.stepSpawnTriggers(dt,this._colorManager);l.logicState?.step(dt);l.stepAlphaTriggers(dt);
        l.advFollowState?.step(dt);l.keyframeState?.step(dt);l.cameraState?.step(dt);
        l.stepCameraLockMoves();l.areaState?.step(dt);l.shaderState?.step(dt);
        l.stepPulseTriggers(dt,this._colorManager);this._colorManager.step(dt);
        elapsed=next;
      }
      if(end>=seconds-1e-9) break;
      activate(timeline.positionAt(elapsed+1e-8));
    }
    this._playerWorldX=saved.x;this._state.y=saved.y;this._state.isGoingLeft=saved.left;this._state.gravityFlipped=saved.gravity;
    this._physicsFrame=saved.frame;
    // loadStartPos clears motion accumulated by historical effect actions.
    this._state.yVelocity=0;this._state.lastY=saved.y;this._state.lastGroundPosY=saved.y;
    l._gameplayChannel=+pos.raw?.kA26 || 0;
    const u=l.gameplayState.u,direction=saved.left?-1:1;
    l._channelDirections[l._gameplayChannel]={x:u.x*direction,y:u.y*direction};
    l.gdRenderer?.flushMoves();
    l.applyColorChannels(this._colorManager,true);
    this._bg.setTint(this._colorManager.getHex(fs));
    l.setGroundColor(this._colorManager.getHex(gs));l.setGround2Color?.(this._colorManager.getHex(1009));
    l.setLineColor?.(this._colorManager.getHex(1002),this._colorManager.getBlending(1002));
    this._startPosEffectTime=seconds;
  }
  _resetGameplayState() {
    this._startPosEffectTime = 0;
    this._pauseResumeTimer?.remove();this._pauseResumeTimer=null;
    this._pressUnseen=false;this._releaseDeferred=false;this._logicButtonDown=false;
    this._jumpEventQueue=[];this._jumpEventHeld={};
    this._attemptInputPending = true;
    this._frameStepBudget=0;this._frameStepHoldTicks=0;
    this._dualBandY = this._lastBandY = null;
    this._cameraFloorX = this._startPosIndex >= 0 ? -Infinity : 30;
    const startCameraX = Math.max(-this._getGameplayAnchorX(), this._cameraFloorX);
    this._cameraX = startCameraX;
    this._cameraY = 0;
    this._cameraXRef._v = startCameraX;
    this._prevCameraX = startCameraX;
    this._playerWorldX = 0;
    this._deltaBuffer = 0;
    this._deathTimer = 0;
    this._deadEffectsBuffer = 0;
    this._simulationBufferMs = 0;
    this._gdRenderDeltaMs = 0;
    this._deathSoundPlayed = false;
    this._newBestShown = false;
    this._hadNewBest = false;
    this._levelWon = false;
    this._endTrigger = null;
    this._endCameraOverride = false;
    this._endCamTween = null;
    this._spaceWasDown = false;
    this._secondWasDown=false;this._pressUnseen2=false;this._releaseDeferred2=false;this._logicButtonDown2=false;
    this._physicsFrame = 0;
    this._levelShake = null;
    this._resetMirrorTransition(false);
  }
  _restartLevel() {
    this._attempts++;
    localStorage.setItem("gd_totalAttempts", this._attempts);
    this._levelAttempts++;
    this._levelJumps = 0;
    const _0x2ba78a = this._cameraX;
    if (this._levelWon && this._practicedMode.practiceMode) {
      this._practicedMode.togglePracticeMode();
      this._practicedMode.clearCheckpoints();
      if (this._checkpointBtnContainer) {
        this._checkpointBtnContainer.setVisible(false);
      }
    }
    if (this._practicedMode.practiceMode) {
      const checkpoint = this._practicedMode.loadLastCheckpoint();
      if (checkpoint) {
        this._respawnFromCheckpoint();
        return;
      }
    }
    this._practicedMode.clearCheckpoints();
    const selectedStart=this._level.getStartPositions()[this._startPosIndex];
    if(this._level._baseSettingsMap){
      const startSettings=Object.fromEntries(Object.entries(selectedStart?.raw||{}).filter(([key])=>/^kA/.test(key)));
      window.settingsMap={...this._level._baseSettingsMap,...startSettings};
    }
    this._resetGameplayState();
    this._state.reset();
    this._state.canJump = false;
    this._player.reset();
    this._isDual = false;
    this._state2.reset();
    this._player2.reset();
    this._player2.setCubeVisible(false);
    this._player2.setShipVisible(false);
    this._player2.setBallVisible(false);
    this._player2.setWaveVisible(false);
    this._player2.setBirdVisible?.(false);
    this._player2.setSpiderVisible(false);
    this._player2.setRobotVisible(false);
    this._glitterEmitter.stop();
    let speedKey = parseInt(window.settingsMap["kA4"] || "0");
    if (speedKey == 0) {
      playerSpeed = SpeedPortal.ONE_TIMES;
    } else if (speedKey == 1) {
      playerSpeed = SpeedPortal.HALF;
    } else if (speedKey == 2) {
      playerSpeed = SpeedPortal.TWO_TIMES;
    } else if (speedKey == 3) {
      playerSpeed = SpeedPortal.THREE_TIMES;
    } else if (speedKey == 4) {
      playerSpeed = SpeedPortal.FOUR_TIMES;
    }
    this._level.resetObjects();
    this._level._setRodframe?.(this._levelAttempts);
    try {
      if (this._level && Array.isArray(this._level._sawSprites)) {
        for (const spr of this._level._sawSprites) {
          if (!spr) continue;
          spr._Sawrotationspeed = Number.isFinite(spr._eeBaseSawRotationSpeed)
            ? spr._eeBaseSawRotationSpeed
            : 0.0032;
          spr._SawRandom1 = undefined;
          spr._SawRandom2 = 0;
          spr._eeSawStartTime = window._animTimer || 0;
          if (Number.isFinite(spr._eeInitialSawRotation)) {
            spr.rotation = spr._eeInitialSawRotation;
          }
        }
      }
    } catch (e) { }
    this._level.shiftGroundTiles(this._cameraX - _0x2ba78a);
    this._level.resetGroundState();
    this._level.resetColorTriggers();
    this._level.resetAlphaTriggers();
    this._level.resetToggleTriggers();
    this._level.resetShakeTriggers();
    this._level.resetStopTriggers();
    this._levelShake = null;
    this._level.resetRotateTriggers();
    this._level.resetPulseTriggers();
    this._level.resetEnterEffectTriggers();
    this._level.resetSpawnTriggers();
    this._level.resetAnimationTriggers?.();
    this._level.resetMoveTriggers();
    this._level.resetVisibility();
    if (this._orbGfx) { this._orbGfx.clear(); }
    this._colorManager.reset();
    // The intro slide renders the level before the normal trigger/update
    // loop runs. Apply all native colour channels now; otherwise composite
    // gradients and detail sprites flash white and their atlas edges form
    // visible cross/line artefacts during the opening animation.
    this._level.applyColorChannels(this._colorManager, true);
    this._player.noclipStats.totalFrames = 0;
    this._player.noclipStats.deathFrames = 0;
    this._player.noclipStats.deaths = 0;

    const musicOffset = this._getStartPosMusicOffset();
    const startPositions = this._level.getStartPositions();
    const activeStartPos = this._startPosIndex !== -1 && !!startPositions[this._startPosIndex];
    this._startedFromStartPos = activeStartPos;

    if (activeStartPos) {
      const pos = startPositions[this._startPosIndex];
      const startPosY = Number.isFinite(Number(pos.y)) ? Number(pos.y) : 30;

      this._playerWorldX = pos.x;
      this._state.y = startPosY;
      this._state.lastY = startPosY;
      this._state.lastGroundPosY = startPosY;
      if (pos.gameMode == 1) {
        this._player.enterShipMode();
      } else if (pos.gameMode == 2) {
        this._state.y = startPosY;
        this._player.enterBallMode({ y: startPosY });
      } else if (pos.gameMode == 3) {
        this._player.enterUfoMode();
      } else if (pos.gameMode == 4) {
        this._player.enterWaveMode();
      } else if (pos.gameMode == 5) {
        this._player.enterRobotMode();
      } else if (pos.gameMode == 6) {
        this._player.enterSpiderMode();
      } else if (pos.gameMode == 7) {
        this._player.enterSwingMode();
      }
      this._state.gravityFlipped = pos.gravityFlipped;
      this._state.isMini = pos.miniMode;
      playerSpeed = [
        SpeedPortal.ONE_TIMES,
        SpeedPortal.HALF,
        SpeedPortal.TWO_TIMES,
        SpeedPortal.THREE_TIMES, 
        SpeedPortal.FOUR_TIMES
      ][pos.speed];
      this._state.mirrored = !window.noMirror && pos.mirrored;
      this._state.isGoingLeft=pos.raw?.kA20==='1';
      this._level._gameplayChannel=Number(pos.raw?.kA26)||0;
      if(pos.raw?.kA29==='1'){
        this._level.gameplayState.u={x:0,y:1};this._level.gameplayState.v={x:1,y:0};
      }
      const startDirection=this._state.isGoingLeft?-1:1;
      this._level._channelDirections[this._level._gameplayChannel]={x:this._level.gameplayState.u.x*startDirection,y:this._level.gameplayState.u.y*startDirection};
      if (pos.dualMode) {
        this._enableDualMode();
      }
      this._loadStartPosEffects(pos);
      this._cameraX=this._gdFollowCameraX(this._playerWorldX);
      this._updateCameraY(0,true);
      if (this._player) {
        this._player._lastCollisionWorldX = Number.isFinite(Number(this._playerWorldX)) ? Number(this._playerWorldX) : null;
        this._player._lastCollisionWorldY = startPosY;
      }
    }
    // Resolve the level's spawn and mode before the first camera/trigger
    // activation. Static-camera transitions capture the current view here.
    if (!activeStartPos) {
      let gamemode = parseInt(window.settingsMap["kA2"] || "0");
      if (gamemode == 1) {
        this._player.enterShipMode();
      } else if (gamemode == 2) {
        this._state.y = 30;
        this._player.enterBallMode({ y: 30 });
      } else if (gamemode == 3) {
        this._player.enterUfoMode();
      } else if (gamemode == 4) {
        this._player.enterWaveMode();
      } else if (gamemode == 5) {
        this._player.enterRobotMode();
      } else if (gamemode == 6) {
        this._player.enterSpiderMode();
      } else if (gamemode == 7) {
        this._player.enterSwingMode();
      }

      this._applyLevelStartOptions();
    }
    // Toggle triggers behind the spawn act before its first collision: GD
    // resolves them while the attempt starts (Troll Madness auto: a kill
    // square on the spawn is switched off by a toggle at X -1785).
    if (!activeStartPos) this._meetStartTriggers(this._playerWorldX - 1e-6, true);

    if (activeStartPos) {
      this._level.settleStartGround();
      if (selectedStart.raw?.kA35 === '1') this._level.cameraState?.resetStartCamera();
      this._level.cameraState?.settleStart();
    }

    this._practiceBypassPending = false;
    this._audio.reset();
    this._startAttemptMusic(musicOffset);
    this._paused = false;
    if (this._pauseContainer) {
      this._pauseContainer.destroy();
      this._pauseContainer = null;
    }
    this._pauseBtn.setVisible(true).setAlpha(75 / 255);
    if (this._practiceModeBarContainer) {
      this._practiceModeBarContainer.setVisible(this._practicedMode && this._practicedMode.practiceMode);
    }
    this._attemptsLabel.setText("Attempt " + this._levelAttempts);
    this._attemptsLabel.setVisible(true);
    this._positionAttemptsLabel();


    if (this._player && this._player._hitboxTrail) {
      this._player._hitboxTrail = [];
    }
    if (this._player?._hitboxGraphics) this._player._hitboxGraphics.clear();
    if (this._player2 && this._player2._hitboxTrail) {
      this._player2._hitboxTrail = [];
    }
    if (this._player2?._hitboxGraphics) this._player2._hitboxGraphics.clear();

    this._resetMirrorTransition(this._state.mirrored);

    if (this._macroBot?.recording == true){
      this._macroBot?.clearRecording();
    }
    if (this._macroBot?.playing == true){
      this._macroBot?.clearPlayback();
    }
    this._level._updateGlowVisibility?.();
    this._updateCameraY(0, true);
    if (activeStartPos) {
      this._cameraX = this._gdFollowCameraX(this._playerWorldX);
      this._cameraXRef._v = this._cameraX;
      this._prevCameraX = this._cameraX;
      for(const c of [this._level.container,this._level.additiveContainer,this._level.topContainer]) {c.x=-this._cameraX;c.y=this._cameraY;}
      this._player.syncSprites(this._cameraX,this._cameraY,0,this._getMirrorXOffset(this._playerWorldX-this._cameraX));
      this._level.cameraState?.attach();
      this._level.cameraState?.updateVisual();
      this._level._updateGDGround?.();
    }
    this._player.playSpawnEffect();
    if (this._isDual) this._player2.playSpawnEffect();
  }
  _getSongOffsetForWorldX(worldX) {
    const startX = Number.isFinite(Number(worldX)) ? Number(worldX) : 0;
    return this._level?.getSongOffsetForX
      ? this._level.getSongOffsetForX(startX, { y:this._state?.y || 0,channel:this._level._gameplayChannel || 0 })
      : Math.max(0, startX) / 623.16;
  }
  _startAttemptMusic(offset = 0, audioState = null) {
    const audioGeneration = this._audio.triggers?.generation;
    const level = this._level, request = this._attemptAudioRequest = (this._attemptAudioRequest || 0) + 1;
    this._audio._beginMusicTransport?.(offset);
    const start = (loaded = false) => {
      if (request !== this._attemptAudioRequest || this._level !== level ||
          (audioGeneration !== undefined && audioGeneration !== this._audio.triggers?.generation)) return;
      this._audio.startMusic(offset);
      if (audioState) this._audio.triggers?.restore(audioState);
      if (loaded && this._paused) this._audio.pauseMusic();
    };
    const ready = this._audio.triggers?.prepareLevel(level);
    if (this._audio.triggers?.loading) ready.then(() => start(true)); else start();
    // Native prepareMusic holds the attempt until the audio is ready.
    // Decoding a locally downloaded custom song must not consume the first
    // beats or let the level run ahead before its music can start.
    this._waitingForLevelMusic = this._audio.musicLoading;
  }
  _getStartPosMusicOffset(){
    const startPositions = this._level.getStartPositions();
    if (this._startPosIndex !== -1 && startPositions[this._startPosIndex]) {
      const p=startPositions[this._startPosIndex];
      return this._level.getSongOffsetForX(p.x,{y:p.y,channel:+p.raw?.kA26 || 0,order:+p.raw?.kA19 || 0});
    }
    return 0;
  }
  _getCurrentMusicSyncOffset() {
    const clock = this._audio?.getLevelPosition?.();
    if (Number.isFinite(clock)) return clock;
    if (this._startPosIndex !== -1 && this._playerWorldX <= 0) {
      return this._getStartPosMusicOffset();
    }
    return this._getSongOffsetForWorldX(this._playerWorldX);
  }
  _respawnFromCheckpoint() {
    const checkpoint = this._practicedMode.loadLastCheckpoint();
    if (!checkpoint) {
      this._restartLevel();
      return;
    }
    this._deathTimer = 0;
    this._deadEffectsBuffer = 0;
    this._deathSoundPlayed = false;
    this._newBestShown = false;
    this._state.isDead = false;
    this._slideIn = false;
    this._playerWorldX = checkpoint.x;
    this._cameraFloorX = checkpoint.cameraFloorX ?? -Infinity;
    this._cameraX = checkpoint.cameraX;
    this._cameraY = checkpoint.cameraY;
    this._cameraXRef._v = this._cameraX;
    this._state.y = checkpoint.y;
    this._state.yVelocity = checkpoint.yVelocity;
    this._state.gravityFlipped = checkpoint.gravityFlipped;
    this._state.isMini = checkpoint.isMini;
    this._state.isCube = checkpoint.isCube;
    this._state.isShip = checkpoint.isShip;
    this._state.isBall = checkpoint.isBall;
    this._state.isUfo = checkpoint.isUfo;
    this._state.isWave = checkpoint.isWave;
    this._state.isSpider = checkpoint.isSpider;
    this._state.isBird = checkpoint.isBird;
    this._state.isDart = checkpoint.isDart;
    this._state.isRobot = checkpoint.isRobot;
    this._state.isSwing = checkpoint.isSwing;
    this._state.isJetpack = checkpoint.isJetpack;
    this._state.isFlying = checkpoint.isFlying;
    this._state.isJumping = checkpoint.isJumping;
    this._state.onGround = checkpoint.onGround;
    this._state.canJump = checkpoint.canJump;
    this._state.wasBoosted = checkpoint.wasBoosted;
    this._state.boostLatch = !!checkpoint.boostLatch;
    this._state.forceBoostLatch = !!checkpoint.forceBoostLatch;
    this._state.forceX = checkpoint.forceX || 0;
    this._state.forceY = checkpoint.forceY || 0;
    this._state.rotation = checkpoint.rotation;
    this._state.gravity = checkpoint.gravity;
    this._state.gravityMod = checkpoint.gravityMod ?? 1;
    this._state.jumpPower = checkpoint.jumpPower;
    this._state.mirrored = checkpoint.mirrored;
    this._state.isDashing = checkpoint.isDashing;
    this._state.dashSlope = checkpoint.dashSlope ?? 0;
    [this._state.stateDartSlide, this._state.stateHitHead, this._state.stateFlipGravity, this._state.stateNoAutoJump] = checkpoint.collisionModifiers || [0, 0, 0, 0];
    this._state._holdDead = !!checkpoint.holdDead;
    this._state.dashXVelocity = checkpoint.dashXVelocity ?? 0;
    this._state.dashYVelocity = checkpoint.dashYVelocity;
    this._state.ballShouldRotate = checkpoint.ballShouldRotate || false;
    this._state.ballRotateOpposite = checkpoint.ballRotateOpposite || false;
    this._state.ballNormalRotate = checkpoint.ballNormalRotate || 1;
    this._state.ballHitPad = checkpoint.ballHitPad || false;
    this._state._robotHold = !!checkpoint.robotHold;
    this._state._robotPadBoost = !!checkpoint.robotPadBoost;
    this._state._robotHoverBudget = checkpoint.robotHoverBudget || 0;
    this._state._robotHoldTimer = checkpoint.robotHoldTimer || 0;

    const checkpointRotation = Number.isFinite(Number(checkpoint.rotation)) ? Number(checkpoint.rotation) : 0;
    const checkpointRotateActionActive = checkpoint.rotateActionActive !== undefined ? !!checkpoint.rotateActionActive: undefined;

    this._player.reset();
    this._state.isFlying = false;
    this._state.isBall = false;
    this._state.isWave = false;
    this._state.isUfo = false;
    this._state.isSpider = false;
    this._state.isRobot = false;
    this._state.isBird = false;
    if (checkpoint.isSwing) {
      this._player.enterSwingMode(null, true);
    } else if (checkpoint.isFlying) {
      this._player.enterShipMode(null, true); // dont mess with y velocity if ur loading a checkpoint
    } else if (checkpoint.isBall) {
      this._player.enterBallMode();
    } else if (checkpoint.isUfo) {
      this._player.enterUfoMode(null, true); // dont mess with y velocity if ur loading a checkpoint
    } else if (checkpoint.isWave) {
      this._player.enterWaveMode();
    } else if (checkpoint.isRobot) {
      this._player.enterRobotMode();
    } else if (checkpoint.isSpider) {
      this._player.enterSpiderMode();
    } else if (checkpoint.isBird) {
      this._player.setBirdVisible(true);
      this._player.setCubeVisible(true);
      for (const layer of this._player._playerLayers) {
        if (layer) {
          layer.sprite.setScale(0.55);
        }
      }
    } else {
      this._player.setCubeVisible(true);
    }
    this._state.isFlying = checkpoint.isFlying;
    this._state.isBall = checkpoint.isBall;
    this._state.isWave = checkpoint.isWave;
    this._state.isUfo = checkpoint.isUfo;
    this._state.isSpider = checkpoint.isSpider;
    this._state.isRobot = checkpoint.isRobot;
    this._state.isBird = checkpoint.isBird;
    this._state._robotHold = !!checkpoint.robotHold;
    this._state._robotHoldTimer = checkpoint.robotHoldTimer || 0;
    
    this._state.rotation = checkpointRotation;
    this._player._rotation = checkpointRotation;
    this._player._dashSpin = checkpoint.dashSpin || 0;
    this._player._dashSpinFirstTick = !!checkpoint.dashSpinFirstTick;
    this._state._skipFlyBoundsOnce = !!checkpoint.skipFlyBoundsOnce;
    this._state2._skipFlyBoundsOnce = !!checkpoint.dualSkipFlyBoundsOnce;
    this._player._dashFireTime = checkpoint.dashFireTime || 0;
    if (typeof this._player.setRotation === "function") {
      try { this._player.setRotation(checkpointRotation); } catch (_) {}
    }
    if (checkpointRotateActionActive !== undefined) {
      this._player.rotateActionActive = checkpointRotateActionActive;
    }

    this._state.ignorePortals = true;
    this._state2.ignorePortals = true;
    this._level.resetGroundTiles(this._cameraX);
    this._level.resetObjects();
    this._lastBandY = checkpoint.lastBandY ?? null;
    this._level._flyFloorY = checkpoint.flyFloorY !== undefined
      ? checkpoint.flyFloorY
      : (this._level._flyFloorY ?? 0);
    this._level._flyCeilingY = checkpoint.flyCeilingY;
    this._level._flyGroundActive = checkpoint.flyGroundActive;
    this._level._flyVisualOnly = checkpoint.flyVisualOnly;
    this._level._flyVisualFloorInset = checkpoint.flyVisualFloorInset !== undefined
      ? checkpoint.flyVisualFloorInset
      : (this._level._flyVisualFloorInset ?? 0);
    this._level._flyVisualCeilingInset = checkpoint.flyVisualCeilingInset !== undefined
      ? checkpoint.flyVisualCeilingInset
      : (this._level._flyVisualCeilingInset ?? 0);
    this._level._groundTargetValue = checkpoint.groundTargetValue;
    this._level.flyCameraTarget = checkpoint.flyCameraTarget;
    this._level._groundAnimating = checkpoint.groundAnimating;
    this._level._groundAnimFrom = checkpoint.groundAnimFrom;
    this._level._groundAnimTo = checkpoint.groundAnimTo;
    this._level._groundAnimTime = checkpoint.groundAnimTime;
    this._level._groundAnimDuration = checkpoint.groundAnimDuration;
    this._level._groundStartScreenY = checkpoint.groundStartScreenY !== undefined
      ? checkpoint.groundStartScreenY - (checkpoint.cameraY || 0) + this._cameraY
      : b(0) + this._cameraY;
    this._level._ceilingStartScreenY = checkpoint.ceilingStartScreenY
      - (checkpoint.cameraY || 0) + this._cameraY;
    this._level._groundY = checkpoint.groundY;
    this._level._ceilingY = checkpoint.ceilingY;
    if (typeof checkpoint.speed === "number") {
      playerSpeed = checkpoint.speed;
    } else {
      let speedKey = parseInt(window.settingsMap["kA4"] || "0");
    if (speedKey == 0) {
      playerSpeed = SpeedPortal.ONE_TIMES;
      } else if (speedKey == 1) {
      playerSpeed = SpeedPortal.HALF;
    } else if (speedKey == 2) {
      playerSpeed = SpeedPortal.TWO_TIMES;
    } else if (speedKey == 3) {
      playerSpeed = SpeedPortal.THREE_TIMES;
    } else if (speedKey == 4) {
      playerSpeed = SpeedPortal.FOUR_TIMES;
    }
    }
    if (checkpoint.dualMode) {
      this._isDual = false;
      this._dualBallOverlapResolved = false;
      this._dualBallSpawnGravityLock = false;
      this._state2.reset();
      this._player2.reset();
      this._player2.setInvertedColors?.(true);
      this._enableDualMode();
      this._dualBandY = checkpoint.dualBandY ?? this._dualBandY;
      this._state2.isDead = false;
      this._secondaryWorldX = checkpoint.dualX ?? this._playerWorldX;
      if (Number.isFinite(Number(checkpoint.dualY))) this._state2.y = Number(checkpoint.dualY);
      if (Number.isFinite(Number(checkpoint.dualYVelocity))) this._state2.yVelocity = Number(checkpoint.dualYVelocity);
      this._state2.forceX = checkpoint.dualForceX || 0;
      this._state2.forceY = checkpoint.dualForceY || 0;
      if (checkpoint.dualIsMini !== undefined) this._state2.isMini = !!checkpoint.dualIsMini;
      if (checkpoint.dualGameMode) this._setPlayerGamemode(this._player2, this._state2, checkpoint.dualGameMode, true);
      if (checkpoint.dualGravityFlipped !== undefined) this._state2.gravityFlipped = !!checkpoint.dualGravityFlipped;
      if (checkpoint.dualOnGround !== undefined) this._state2.onGround = !!checkpoint.dualOnGround;
      if (checkpoint.dualOnCeiling !== undefined) this._state2.onCeiling = !!checkpoint.dualOnCeiling;
      if (checkpoint.dualCanJump !== undefined) this._state2.canJump = !!checkpoint.dualCanJump;
      if (checkpoint.dualIsJumping !== undefined) this._state2.isJumping = !!checkpoint.dualIsJumping;
      this._copyDualInputFlags(this._state, this._state2);
      this._ensureDualFlyBounds(this._state.y);
    } else {
      this._isDual = false;
      this._state2.reset();
      this._player2.reset();
      this._player2.setCubeVisible(false);
      this._player2.setShipVisible(false);
      this._player2.setBallVisible(false);
      this._player2.setWaveVisible(false);
      this._player2.setBirdVisible?.(false);
      this._player2.setSpiderVisible(false);
      this._player2.setRobotVisible(false);
      if (this._player2?._hitboxGraphics) this._player2._hitboxGraphics.clear();
      if (this._player2) this._player2._hitboxTrail = [];
    }
    this._level.resetColorTriggers();
    this._level.resetAlphaTriggers();
    this._level.resetToggleTriggers();
    this._level.resetShakeTriggers();
    this._level.resetStopTriggers();
    this._levelShake = null;
    this._level.resetRotateTriggers();
    this._level.resetPulseTriggers();
    this._level.resetEnterEffectTriggers();
    this._level.resetSpawnTriggers();
    this._level.resetAnimationTriggers?.();
    this._level.resetMoveTriggers();
    this._level.resetVisibility();
    this._level.additiveContainer.x = -this._cameraX;
    this._level.additiveContainer.y = this._cameraY;
    this._level.container.x = -this._cameraX;
    this._level.container.y = this._cameraY;
    this._level.topContainer.x = -this._cameraX;
    this._level.topContainer.y = this._cameraY;
    if (checkpoint.levelRuntime) {
      this._level.restoreRuntimeState(checkpoint.levelRuntime, this._colorManager);
      this._bg.setTint(this._colorManager.getHex(fs));
      this._level.setGroundColor(this._colorManager.getHex(gs));
      this._level.setGround2Color?.(this._colorManager.getHex(1009));
      this._level.setLineColor?.(this._colorManager.getHex(1002), this._colorManager.getBlending(1002));
    }
    this._player.restoreSlopeState(checkpoint.slopeState);
    if (checkpoint.dualMode) this._player2.restoreSlopeState(checkpoint.dualSlopeState);
    this._player._ignoreTeleportUntilClear = true;
    this._player2._ignoreTeleportUntilClear = true;
    this._level.updateVisibility(this._cameraX);
    this._level.updateObjectDebugIds();
    this._updateBackground();
    this._resetMirrorTransition(this._state.mirrored);
    this._applyMirrorEffect();
    this._practiceBypassPending = false;
    if (window.practiceMusicSync) {
      this._startAttemptMusic(Number.isFinite(checkpoint.musicPosition) ? checkpoint.musicPosition : this._getSongOffsetForWorldX(checkpoint.x), checkpoint.audioState);
    } else if (!this._audio.musicPlaying) {
      this._audio.startMusic();
    }

    if (this._player && this._player._hitboxTrail) {
      this._player._hitboxTrail = [];
    }
    if (this._player?._hitboxGraphics) this._player._hitboxGraphics.clear();
    if (this._player2 && this._player2._hitboxTrail) {
      this._player2._hitboxTrail = [];
    }
    if (this._player2?._hitboxGraphics) this._player2._hitboxGraphics.clear();

    this._deltaBuffer = 0;
    this._physicsFrame = checkpoint.physicsFrame;
    if (this._macroBot?.recording == true){
      this._macroBot.rollbackRecording(this._physicsFrame);
    }
    if (this._macroBot?.playing == true){
      this._macroBot?.rollbackPlayback(this._physicsFrame);
    }
    this._level._updateGlowVisibility?.();
    this._player.playSpawnEffect();
    if (this._isDual) this._player2.playSpawnEffect();
  }
  _onFullscreenChange(_0x310c5b) {
    if (!_0x310c5b) {
      l(1138);
    }
    this.time.delayedCall(200, () => this._applyScreenResize());
  }
  _applyScreenResize() {
    if (this.scale.isFullscreen) {
      const _0x5bc34b = window.innerWidth / window.innerHeight;
      l(Math.round(screenHeight * _0x5bc34b));
    }
    this.scale.setGameSize(screenWidth, screenHeight);
    this.scale.refresh();
    this._bg.setSize(screenWidth, screenHeight);
    this._pauseBtn.x = screenWidth - 30;
    if (this._menuActive) {
      this._positionMenuItems();
    }
    if (this._paused && this._pauseContainer) {
      this._pauseContainer.destroy();
      this._pauseContainer = null;
      this._buildPauseOverlay();
    }
    this._level.resizeScreen();
    if (!this._menuActive) {
      const _0x56287b = this._cameraX;
      this._cameraX = this._gdFollowCameraX();
      this._cameraXRef._v = this._cameraX;
      this._level.additiveContainer.x = -this._cameraX;
      this._level.additiveContainer.y = this._cameraY;
      this._level.container.x = -this._cameraX;
      this._level.container.y = this._cameraY;
      this._level.topContainer.x = -this._cameraX;
      this._level.topContainer.y = this._cameraY;
      this._level.shiftGroundTiles(this._cameraX - _0x56287b);
      this._level.updateGroundTiles(this._cameraY);
      this._level.updateVisibility(this._cameraX);
      this._level.updateObjectDebugIds();
      this._level.applyEnterEffects(this._cameraX);
      const _0xde8a1a = this._playerWorldX - this._cameraX;
      this._player.syncSprites(this._cameraX, this._cameraY, 0, this._getMirrorXOffset(_0xde8a1a));
      this._applyMirrorEffect();
    }
  }
  _createMirroredBackgroundTexture(textureKey) {
    const mirroredKey = textureKey + "__mirror_xy_loop";
    if (this.textures.exists(mirroredKey)) return mirroredKey;

    const texture = this.textures.get(textureKey);
    const source = texture?.source?.[0];
    const image = source?.image || source?.canvas;
    const width = source?.width || image?.width || image?.naturalWidth || 0;
    const height = source?.height || image?.height || image?.naturalHeight || 0;

    if (!image || width <= 0 || height <= 0 || !this.textures.createCanvas) {
      return textureKey;
    }

    try {
      // A plain TileSprite wraps the right edge directly back to the left.
      // GD backgrounds are mirrored at every boundary instead, which keeps
      // the edge pixels identical and avoids the vertical one-pixel seam
      // produced by linear sampling while the camera moves sub-pixelly.
      const mirroredTexture = this.textures.createCanvas(mirroredKey, width * 2, height * 2);
      const ctx = mirroredTexture.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width * 2, height * 2);
      ctx.drawImage(image, 0, 0, width, height, 0, 0, width, height);

      ctx.save();
      ctx.translate(width * 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0, width, height, 0, 0, width, height);
      ctx.restore();

      ctx.save();
      ctx.translate(0, height * 2);
      ctx.scale(1, -1);
      ctx.drawImage(image, 0, 0, width, height, 0, 0, width, height);
      ctx.restore();

      ctx.save();
      ctx.translate(width * 2, height * 2);
      ctx.scale(-1, -1);
      ctx.drawImage(image, 0, 0, width, height, 0, 0, width, height);
      ctx.restore();
      mirroredTexture.refresh();
      return mirroredKey;
    } catch (err) {
      console.warn("Failed to create mirrored background texture", textureKey, err);
      if (this.textures.exists(mirroredKey)) this.textures.remove(mirroredKey);
      return textureKey;
    }
  }

  _applyMirroredBackgroundTexture(textureKey) {
    const texture = this.textures.get(textureKey);
    const source = texture?.source?.[0];
    const sourceWidth = source?.width || source?.image?.width || source?.image?.naturalWidth || 0;
    const sourceHeight = source?.height || source?.image?.height || source?.image?.naturalHeight || 0;
    const mirroredKey = this._createMirroredBackgroundTexture(textureKey);
    this._bg.setTexture(mirroredKey);
    this._bgInitY = sourceHeight > 0 ? sourceHeight - screenHeight - o : 0;
    this._bgMirrorTileWidth = sourceWidth > 0 ? sourceWidth * 2 : 0;
    this._bgMirrorTileHeight = sourceHeight > 0 ? sourceHeight * 2 : 0;
  }

  _updateBackground() {
    this._bg.tilePositionX -= this._bg._gdCoverX || 0;
    this._bg.tilePositionX += (this._cameraX - this._prevCameraX) * this._bgSpeedX;
    this._prevCameraX = this._cameraX;
    if (this._bgMirrorTileWidth > 0) {
      this._bg.tilePositionX = ((this._bg.tilePositionX % this._bgMirrorTileWidth) + this._bgMirrorTileWidth) % this._bgMirrorTileWidth;
    }
    let tileY = this._bgInitY - this._cameraY * this._bgSpeedY;
    if (this._bgMirrorTileHeight > 0) {
      tileY = ((tileY % this._bgMirrorTileHeight) + this._bgMirrorTileHeight) % this._bgMirrorTileHeight;
    }
    this._bg.tilePositionX += this._bg._gdCoverX || 0;
    this._bg.tilePositionY = tileY + (this._bg._gdCoverY || 0);
  }
  _checkCameraLimitAfterTeleport(player, ease = false) {
    // GJBaseGameLayer::checkCameraLimitAfterTeleport (Steam 3427b0):
    // keep the normal camera if the exit is in/near its window, otherwise
    // update it immediately. Ease portals use zero margin, normal ones 60
    // GD points. Let rotated gameplay retain its own camera coordinates.
    if (this._localPhysicsActive || !player?.p) return;
    const bottom = this._cameraY - 180, height = this.scale?.height || 640;
    const margin = ease ? 0 : 120;
    if (player.p.y > bottom + height + margin || player.p.y < bottom - margin)
      this._updateCameraY(0, true);
  }
  _updateCameraY(_0xc7c517, snap = false) {
    const cameraState = this._level.cameraState;
    const follow = cameraState?.follow;
    if (follow?.sideways && follow.frame === this._physicsFrame) {
      this._cameraY = follow.cameraY;
      return;
    }
    const height = this.scale?.height || 640;
    const p = this._state;
    // updateCamera's free padding/easing branch is for vehicles, ball and
    // spider. Cube and robot keep the ordinary 70/40-point dead zone.
    if (cameraState?.freeMode && (p.isFlying || p.isUfo || p.isWave || p.isSwing || p.isBall || p.isSpider)) {
      const height = this.scale?.height || 640;
      const center = 460 + this._cameraY - height / 2;
      const padding = cameraState.freeDeadZone(height);
      let target = this._cameraY;
      if (this._state.y > center + padding) target += this._state.y - center - padding;
      else if (this._state.y < center - padding) target += this._state.y - center + padding;
      // Native free follow moves continuously. Rounding this target to a
      // 30-GD-unit tile made slow rises pause and then jump a whole block.
      const amount = cameraState.freeFollowAmount(_0xc7c517, snap);
      this._cameraY += (target - this._cameraY) * amount;
      return;
    }
    let explosionPiece = this._cameraY;
    let _0x1a27be = explosionPiece;
    if (this._level.flyCameraTarget !== null && this._level._gdBandLocked !== false && !this._level.cameraState?.freeMode && !this._level.gameplayState?.rotated) {
      _0x1a27be = this._level.flyCameraTarget;
    } else {
      const center = 460 + explosionPiece - height / 2;
      const high = p.gravityFlipped ? 80 : 140, low = p.gravityFlipped ? 140 : 80;
      if (p.y > center + high) _0x1a27be += p.y - center - high;
      else if (p.y < center - low) _0x1a27be += p.y - center + low;
    }
    if (cameraState) _0x1a27be = cameraState.constrainFollowY(_0x1a27be, this.scale?.height || 640);
    if (!cameraState && _0x1a27be < 0) {
      _0x1a27be = 0;
    }
    const bandMove = this._level._bandMove;
    if (snap) {
      this._cameraY = _0x1a27be;
      this._level._bandMove = null;
    } else if (_0xc7c517 !== 0 && bandMove?.to === _0x1a27be) {
      // updateDualGround (31a8e1): the camera reaches a ground band by EaseInOut(2).
      bandMove.from ??= explosionPiece;
      bandMove.time += _0xc7c517 / 60;
      const t = Math.min(1, bandMove.time / bandMove.duration);
      this._cameraY = bandMove.from + (bandMove.to - bandMove.from) * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
    } else if (_0xc7c517 !== 0) {
      explosionPiece += (_0x1a27be - explosionPiece) / (10 / _0xc7c517);
      if (!cameraState && explosionPiece < 0) {
        explosionPiece = 0;
      }
      this._cameraY = explosionPiece;
    }
  }
  _quantizeDelta(_0x654f39) {
    const speed = window.speedHack || 1;
    // The outer accumulator already selected one native physics tick. A
    // TimeWarp scales that tick's dt; re-quantizing it drops fractional ticks.
    if (this._fixedTickActive) return Math.max(0, _0x654f39) * speed * 60 / 1000;
    let _0x578d1b = Math.max(0, (_0x654f39 * speed) / 1000 + this._deltaBuffer);
    // Never simulate a future fixed tick. Rounding made the accumulator
    // negative every other frame, which showed up as slope/orb micro-stutter.
    let _0x53e02e = Math.floor((_0x578d1b + 1e-10) / u);
    if (_0x53e02e < 0) {
      _0x53e02e = 0;
    }
    if (_0x53e02e > 60) {
      _0x53e02e = 60;
    }
    let _0xd8019e = _0x53e02e * u;
    this._deltaBuffer = Math.max(0, Math.min(u, _0x578d1b - _0xd8019e));
    return _0xd8019e * 60;
  }
  _startLevelShake(trigger) {
    const duration = Math.max(0.001, Number(trigger?.duration) || 0.001);
    const strength = Math.max(0, Number(trigger?.strength) || 0);
    if (!this._levelShake || strength >= this._levelShake.strength || this._levelShake.elapsed >= this._levelShake.duration) {
      this._levelShake = { elapsed: 0, duration, strength };
    }
  }
  _stepLevelShake(dt) {
    const shake = this._levelShake;
    if (!shake) return { x: 0, y: 0 };
    shake.elapsed += Math.max(0, Number(dt) || 0);
    if (shake.elapsed >= shake.duration) {
      this._levelShake = null;
      return { x: 0, y: 0 };
    }
    const fade = 1 - shake.elapsed / shake.duration;
    const phase = shake.elapsed * 73;
    const amplitude = shake.strength * fade;
    return {
      x: Math.sin(phase * 1.91) * amplitude,
      y: Math.sin(phase * 2.47 + 1.3) * amplitude
    };
  }
  _getCurrentPercent() {
    return gdLevelPercent((this._physicsFrame || 0) + Math.round((this._startPosEffectTime || 0) * 240),
      this._level.verificationFrames, this._playerWorldX, this._level.endXPos);
  }
  update(_0x54fa47, deltaTime) {
    this._pauseContainer?.setVisible(!window.hidePauseMenu);
    if (this._waitingForLevelMusic) {
      this._waitingForLevelMusic = this._audio?.musicLoading;
      if (this._waitingForLevelMusic) { this._simulationBufferMs = 0; return; }
    }
    // FMODAudioEngine is a scheduled CCNode, sampled once per real frame.
    // Its peak detector counts frames; running it in every physics substep
    // changes music pulses and wave width, especially during TimeWarp.
    this._audio?.update(Math.max(0, Number(deltaTime) || 0) / 1000);
    // FPS measures real rendered frames, independently of TimeWarp and the
    // number of physics/visual preparation steps in this frame.
    this._fpsAccum = (this._fpsAccum || 0) + Math.max(0, Number(deltaTime) || 0);
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    if (this._fpsAccum >= 250) {
      this._fpsText?.setText(Math.round(this._fpsFrames * 1000 / this._fpsAccum));
      this._fpsAccum = 0; this._fpsFrames = 0;
    }
    const playtest = window.isEditor && this._editorPlaytestActive && !this._editorPlaytestPaused;
    const playing = playtest || (!window.isEditor && this._level && !this._paused && !this._menuActive &&
      !this._slideIn && !this._state?.isDead && !this._levelWon);
    if (!playing) {
      this._simulationBufferMs = 0;
      this._jumpEventQueue=[];this._jumpEventHeld={};
      return this._updateSimulationStep(_0x54fa47, deltaTime);
    }
    // GD advances both player physics and the effect manager at 240 Hz.
    // Splitting only the player let triggers on nearby X positions overwrite
    // each other at 60 Hz, and moved colliders stayed stale for three ticks.
    // Phaser still renders once per animation frame; only simulation is fixed.
    const tick = 1000 / 240;
    let elapsed = Math.max(0, Math.min(250, Number(deltaTime) || 0));
    if(window.frameStepper){
      const cfg=window.GDHacks?.state||{},held=window._frameStepHeld&&cfg.frameHold!==false&&
        performance.now()-(window._frameStepPressedAt||0)>1000*(cfg.frameHoldDelay??.25);
      this._frameStepHoldTicks=held?(this._frameStepHoldTicks||0)+1:0;
      const repeat=held&&this._frameStepHoldTicks>=Math.max(1,cfg.frameHoldSpeed??5);
      if(!(this._frameStepBudget>0)&&!repeat){this._simulationBufferMs=0;return;}
      if(this._frameStepBudget>0)this._frameStepBudget--;if(repeat)this._frameStepHoldTicks=0;
      this._simulationBufferMs=0;elapsed=tick;
    }
    const inputFrameEnd=performance.now();
    this._simulationBufferMs = Math.min(250, (this._simulationBufferMs || 0) + elapsed);
    try {
      this._fixedTickActive = true;
      this._player?.beginFrameContacts?.();
      if (this._isDual) this._player2?.beginFrameContacts?.();
      for (let step = 0; step < 600; step++) {
        // Native update uses delta*240/min(warp,1) steps. Slow motion keeps
        // 240 real-time steps; fast motion adds steps so that a physics step
        // never grows beyond 1/240 game second. Oversized steps changed cube
        // gravity integration and skipped contacts above 1x TimeWarp.
        const timeWarp = this._level?.logicState?.timeWarp ?? 1;
        const realStep = tick / Math.max(1, timeWarp);
        if (this._simulationBufferMs + 1e-8 < realStep) break;
        this._simulationBufferMs = Math.max(0, this._simulationBufferMs - realStep);
        // A subsequent trigger can change the next step size. Preparing the
        // final real tick guarantees current art also across that boundary.
        this._visualTick = this._simulationBufferMs < tick - 1e-8;
        if(window.clickBetweenFrames)this._drainJumpEvents(inputFrameEnd-this._simulationBufferMs);
        if(window.autoClicker){
          const cfg=window.GDHacks?.state||{},hold=Math.max(1,cfg.autoClickHold||1),release=Math.max(1,cfg.autoClickRelease||1);
          const down=(this._autoClickTick||0)%(hold+release)<hold;
          if(down!==this._autoClickDown){if(cfg.autoClickP1!==false)down?this._pushButton():this._releaseButton();
            if(cfg.autoClickP2!==false&&this._isTwoPlayerMode())down?this._pushSecondPlayerButton():this._releaseSecondPlayerButton();this._autoClickDown=down;}
          this._autoClickTick=(this._autoClickTick||0)+1;
        }else if(this._autoClickDown){this._releaseButton();this._releaseSecondPlayerButton();this._autoClickDown=false;this._autoClickTick=0;}
        this._updateSimulationStep(_0x54fa47 - this._simulationBufferMs, tick * Math.min(1, timeWarp));
        if(window.autoKill){const cfg=window.GDHacks?.state||{},percent=this._getCurrentPercent();
          if((cfg.autoKillPercentageEnabled!==false&&percent>=(cfg.autoKillPercentage??50))||
            (cfg.autoKillTimeEnabled&&this._playTime>=(cfg.autoKillTime??90)))this._player.killPlayer(true);
        }
        if (this._state?.isDead || this._levelWon || this._paused || this._menuActive) {
          this._simulationBufferMs = 0;
          break;
        }
      }
    } finally {
      this._fixedTickActive = false;
      this._visualTick = true;
    }
  }
  _updateSimulationStep(_0x54fa47, deltaTime) {
    if (window.isEditor) {
        if (this._editorPlaytestActive && !this._editorPlaytestPaused) {
            this._levelEditor._updateEditorPlaytest(deltaTime);
            this._levelEditor._updateEditorGrid();
            this._levelEditor._updateEditorTimeline();
            return;
        }

        if (window.isEditorPause) return;
        const pointer = this.input.activePointer;
        this._hitObjects = this.input.hitTestPointer(pointer);
        this._levelEditor._handleEditorCamera(deltaTime); 
        this._levelEditor._updateEditorGrid(); 
        if (pointer.isDown && !this._isDraggingSlider) {
            if (this._isSwipeEnabled) {
              if (this._editorTab !== "edit") {
                if (this._hitObjects.length !== 0) return;
                const currentGridX = Math.floor((pointer.x + this._cameraX) / 60) * 60;
                const currentGridY = Math.floor((pointer.y + this._cameraY + 20) / 60) * 60;

                if (currentGridX !== this._lastSwipeGridX || currentGridY !== this._lastSwipeGridY) {
                    this._levelEditor._editorAction();
                    this._lastSwipeGridX = currentGridX;
                    this._lastSwipeGridY = currentGridY;
                }
              }
            } else {
                if (!this._isDragging && this._hitObjects.length !== 0) return;
                const dragX = pointer.x - this._clickStartPos.x;
                const dragY = pointer.y - this._clickStartPos.y;
                const dragDistance = Math.sqrt(dragX * dragX + dragY * dragY);
                if (dragDistance > 10) {
                    this._isDragging = true;
                    this._cameraX = this._cameraStartX - dragX;
                    this._cameraY = this._cameraStartY - dragY;
                }
            }
        }
        this._levelEditor._updateEditorTimeline();
        if (this._editorPlaytestActive && this._editorPlaytestPaused) {
            this._levelEditor._refreshEditorPlaytestGlowVisibility();
            this._levelEditor._syncEditorPlaytestPlayerVisual(deltaTime / 1000);
        }
        return;
    }

    // HUD text only changes what is drawn: once per frame.
    if (this._visualTick !== false) {
      let rawPercent = this._getCurrentPercent();
      rawPercent = Math.min(100, Math.max(0, rawPercent));
      let displayValue;
      if (this._levelWon) {
        const p = this._interpolatedPercent || 0;
        if (window.percentageDecimals) {
          displayValue = p.toFixed(window.percentagePrecision ?? 2) + "%";
        } else {
          displayValue = Math.floor(p) + "%";
        }
      } else if (window.percentageDecimals) {
          displayValue = rawPercent.toFixed(window.percentagePrecision ?? 2) + "%";
      } else {
          displayValue = Math.floor(rawPercent) + "%";
      }
      this._percentageLabel.setText(displayValue);
      this._percentageLabel.setVisible(window.showPercentage && !window.eclipseHideLabels && !this._menuActive);
      this._startPosGui.setVisible(!!window.startPosSwitcher && this._level._startPositions.length > 0 && !this._menuActive && !this._levelWon);
      this._noclipIndicator.setVisible(window.noClip && !window.eclipseHideLabels && !this._menuActive);
      this._accuracyIndicator.setVisible(window.noClip && window.noClipAccuracy && !window.eclipseHideLabels && !this._menuActive);
      this._deathsIndicator.setVisible(window.noClip && (window.noClipDeaths ?? window.noClipAccuracy) && !window.eclipseHideLabels && !this._menuActive);
      this._accuracyIndicator.setText(`${this._player.noclipStats.accuracy.toFixed(2)}%`);
      this._deathsIndicator.setText(`${this._player.noclipStats.deaths} Deaths`);

      this._cpsIndicator.setVisible(window.showCPS && !window.eclipseHideLabels && !this._menuActive);
      if (this._clickHistory && this._clickHistory.length > 0) {
        this._clickHistory = this._clickHistory.filter(timestamp => this.time.now - timestamp <= 1000);
        this._cpsIndicator.setText(`${this._clickHistory.length} CPS`);
      } else {
        this._cpsIndicator.setText("0 CPS");
      }
      if (this._state.upKeyDown && !this._levelWon && !this._state.isDead){
        if (this._cpsIndicator.tint !== 0x00ff00) {
          this._cpsIndicator.setTint(0x00ff00);
          if (!this._clickHistory) this._clickHistory = [];
          this._clickHistory.push(this.time.now);
        }
      } else{
        this._cpsIndicator.setTint(0xffffff);
      }
      this._cpsIndicator.setPosition(10, 10 + (window.noClip * 20) + (window.noClip && window.noClipAccuracy * 40));

      this._bottedIndicator.setVisible(this._macroBot?.playing);
      this._bottedIndicator.setPosition(10, 10 + (window.noClip * 20) + (window.noClip && window.noClipAccuracy * 40) + (window.showCPS * 20));
      if (this._macroBtn){
        this._macroBtn.setVisible(window.macroBot);
      }
    }
    if (this._paused) {
      const held = this._jumpKeysDown();
      if (!this._updateLogPopup && held && !this._pauseJumpWasDown && !this._settingsPopup && !this._pauseResumeTimer) {
        const overlay = this._pauseContainer;
        this._pauseResumeTimer = this.time.delayedCall(75, () => {
          this._pauseResumeTimer = null;
          if (this._paused && this._pauseContainer === overlay) this._resumeGame();
        });
      }
      this._pauseJumpWasDown = held;
      this._deltaBuffer = 0;
      return;
    }
    if (this._menuActive) {
      const _anyOverlayOpen = this._iconOverlay || this._creatorOverlay || this._searchOverlay ||
        this._onlineLevelsOverlay || this._settingsLayerOverlay || this._settingsPopup ||
        this._infoPopup || this._newgroundsPopup || this._statsLayerOverlay || this._updateLogPopup;
      if (!_anyOverlayOpen && (this._spaceKey.isDown || this._upKey.isDown || this._wKey.isDown) && !this._spaceWasDown) {
        if (this._creatorMenuOpen) return;
        this._spaceWasDown = true;
        if (this._levelSelectOverlay) {
        if (this._levelSelectIsComingSoonPage) {
          return;
        }
        this._launchSelectedOfficialLevel(window.currentlevel);
          return;
        }
        this._openLevelSelect();
        return;
      }
      const _arrowLeft = this._leftKey.isDown || this._aKey.isDown;
      const _arrowRight = this._rightKey.isDown || this._dKey.isDown;
      if (!_anyOverlayOpen && (_arrowLeft || _arrowRight) && !this._arrowWasDown) {
        if (this._levelSelectOverlay) {
          if (_arrowLeft) window.leftbuttoncallback();
          else window.rightbuttoncallback();
        }
      }
      this._arrowWasDown = _arrowLeft || _arrowRight;
      this._spaceWasDown = this._spaceKey.isDown || this._upKey.isDown || this._wKey.isDown || this._lKey.isDown;
      this._updateMenuCharacters(deltaTime / 1000);
      const menuDelta = Math.min(deltaTime / 1000 * 60, 2);
      const menuSpeed = 0.85;
      this._menuCameraX = (this._menuCameraX || 0) + menuDelta * playerSpeed * d * menuSpeed;
      const _0x38afac = this._cameraX;
      this._cameraX = this._menuCameraX;
      this._updateBackground();
      this._cameraX = _0x38afac;
      this._prevCameraX = this._menuCameraX;
      this._cameraXRef._v = this._menuCameraX;
      this._level.stepGroundAnimation(deltaTime / 1000);
      this._level.updateGroundTiles(this._cameraY);
      if (this._menuRainbowTime === undefined) this._menuRainbowTime = 0;
      this._menuRainbowTime += deltaTime / 1000;
      const _rainbowHue = (this._menuRainbowTime * 15) % 360;
      const _rainbowHex = Phaser.Display.Color.HSVToRGB(_rainbowHue / 360, 0.85, 1.0).color;
      const _groundHex = Phaser.Display.Color.HSVToRGB(_rainbowHue / 360, 0.85, 1.0).color;
      this._bg.setTint(_rainbowHex);
      this._level.setGroundColor(_groundHex);
      this._level.setGround2Color?.(_groundHex);
      return;
    }
    if (this._slideIn) {
      const slideDelta = this._quantizeDelta(deltaTime);
      this._playerWorldX += slideDelta * playerSpeed * d;
      const slideGroundSpeed = 0.25;
      this._slideGroundX = (this._slideGroundX || this._cameraX) + slideDelta * playerSpeed * d * slideGroundSpeed;
      this._cameraXRef._v = this._slideGroundX;
      const slidePlayerScreenX = this._playerWorldX - this._cameraX;
      this._player.updateGroundRotation(slideDelta * d);
      this._player.syncSprites(this._cameraX, this._cameraY, deltaTime / 1000, this._getMirrorXOffset(slidePlayerScreenX));
      this._level.additiveContainer.x = -this._cameraX;
      this._level.additiveContainer.y = this._cameraY;
      this._level.container.x = -this._cameraX;
      this._level.container.y = this._cameraY;
      this._level.topContainer.x = -this._cameraX;
      this._level.topContainer.y = this._cameraY;
      this._level.updateVisibility(this._cameraX);
      this._level.updateObjectDebugIds();
      this._updateBackground();
      this._level.stepGroundAnimation(deltaTime / 1000);
      this._level.updateGroundTiles(this._cameraY);
      this._applyMirrorEffect();
      if (this._playerWorldX >= 0) {
        this._slideIn = false;
        this._deltaBuffer = 0;
        this._playerWorldX = 0;
        // The intro moves the picture without running collisions. Start
        // swept contacts at the playable spawn, not the old menu/camera
        // position: otherwise a nearby teleport can be crossed backwards
        // on tick one, before the spawn pad has activated.
        for (const player of [this._player, this._player2]) {
          if (!player?.p) continue;
          player._lastCollisionWorldX = this._playerWorldX;
          player._lastCollisionWorldY = player.p.y;
        }
        this._cameraX = this._gdFollowCameraX();
        this._cameraXRef._v = this._cameraX;
        const _0x490749 = this._cameraX - this._slideGroundX;
        this._level.shiftGroundTiles(_0x490749);
        if (this._firstPlay) {
          this._firstPlay = false;
          this._startAttemptMusic();
        }
        this._pauseBtn.setVisible(true).setAlpha(0);
        this.tweens.add({
          targets: this._pauseBtn,
          alpha: 75 / 255,
          duration: 500
        });
        if (this._practiceModeBarContainer) {
          this._practiceModeBarContainer.setVisible(this._practicedMode && this._practicedMode.practiceMode);
        }
      }
      return;
    }
    this._restoreAttemptInput();
    this._applyJumpInput ||= () => {
      if(window.clickBetweenFrames||window.autoClicker)return;
      if(this._isTwoPlayerMode()) {
        for(let id=1;id<=2;id++) {
          const first=id===1?this._spaceKey:this._upKey,second=id===1?this._wKey:this._lKey;
          const previous=id===1?'_spaceWasDown':'_secondWasDown',held=first.isDown||second.isDown;
          const tapped=Phaser.Input.Keyboard.JustDown(first)||Phaser.Input.Keyboard.JustDown(second);
          if(!this._updateLogPopup&&((held&&!this[previous])||tapped)) {
            id===1?this._pushButton():this._pushSecondPlayerButton();
            if(!held)id===1?this._releaseButton():this._releaseSecondPlayerButton();
          } else if(!held&&this[previous])id===1?this._releaseButton():this._releaseSecondPlayerButton();
          this[previous]=held;
        }
        return;
      }
      const jumpHeld = this._spaceKey.isDown || this._upKey.isDown || this._wKey.isDown || this._lKey.isDown;
      // A key tapped and let go between two polls still reaches the step,
      // as GD's button queue delivers both the press and the release.
      const tapped = Phaser.Input.Keyboard.JustDown(this._spaceKey) || Phaser.Input.Keyboard.JustDown(this._upKey) ||
        Phaser.Input.Keyboard.JustDown(this._wKey) || Phaser.Input.Keyboard.JustDown(this._lKey);
      if (!this._updateLogPopup && jumpHeld && (!this._spaceWasDown || tapped)) {
        this._pushButton();
      } else if (!this._updateLogPopup && tapped && !jumpHeld && !this._spaceWasDown) {
        this._pushButton();
        this._releaseButton();
      } else if (!jumpHeld && this._spaceWasDown) {
        this._releaseButton();
      }
      this._spaceWasDown = jumpHeld;
    };

    const objectsUnderPointer = this._startPosGui.visible && this.input.activePointer.isDown ? this.input.manager.hitTest(
      this.input.activePointer,
      this._startPosGui.list,
      this.cameras.main
    ) : [];
    const isOverUI = this._startPosGui.visible && objectsUnderPointer.length > 0;
    const fromClick = this.input.activePointer.isDown && (!this._isTwoPlayerMode() || this.input.activePointer.button!==2);
    const cancelInput = isOverUI && fromClick;

    if (!window.clickBetweenFrames && !window.autoClicker && fromClick && !cancelInput && !this._menuActive && !this._slideIn &&
        !this._state.upKeyDown && !this._state.isDead && !this._state._holdDead) {
      // A held pointer can outlive a scene/overlay handover that consumed
      // its down event. Recover the same fresh press as the event handler:
      // spider/ball need the edge, and Options/Touch/Event triggers must
      // still pass through the normal control checks.
      this._pushButton();
    }
    if (cancelInput) {
      this._state.upKeyDown = false;
      this._state.upKeyPressed = false;
      this._state.queuedHold = false;
      this._state._orbActivationConsumedForPress = false;
    }
    this._level.updateEndPortalY(this._cameraY, this._state.isFlying || this._state.isWave || this._state.isUfo || this._state.isSpider);
    if (!this._levelWon && !this._state.isDead && this._level.endXPos > 0) {
      const _0x448396 = 600;
      if (this._playerWorldX >= this._level.endXPos - _0x448396) {
        this._levelWon = true;
        this._endPortalGameY = this._level._endPortalGameY || 240;
        this._triggerEndPortal();
      }
    }
    if (this._levelWon) {
      this._deltaBuffer = 0;
      if (this._endCamTween) {
        const visMaxSection = this._endCamTween;
        this._cameraX = visMaxSection.fromX + (visMaxSection.toX - visMaxSection.fromX) * visMaxSection.p;
        this._cameraY = visMaxSection.fromY + (visMaxSection.toY - visMaxSection.fromY) * visMaxSection.p;
      }
      this._cameraXRef._v = this._cameraX;
      this._level.additiveContainer.x = -this._cameraX;
      this._level.additiveContainer.y = this._cameraY;
      this._level.container.x = -this._cameraX;
      this._level.container.y = this._cameraY;
      this._level.topContainer.x = -this._cameraX;
      this._level.topContainer.y = this._cameraY;
      this._updateBackground();
      this._level.stepGroundAnimation(deltaTime / 1000);
      this._level.updateGroundTiles(this._cameraY);
      this._stepMirrorTransition(deltaTime / 1000);
      this._applyMirrorEffect();
      return;
    }
    if (this._state.isDead) {
      this._stepDeadLevelEffects(deltaTime);
      if (!this._deathSoundPlayed) {
        const options = this._level.logicState?.options;
        if (!options?.audioOnDeath && !this._audio._shouldUsePracticeSong()) {
          this._audio.stopMusic();
        }
        if (!options?.noDeathSFX) this._audio.playEffect("explode_11", {
          volume: 0.65 * this._sfxVolume
        });
        this._deathSoundPlayed = true;
        this._totalDeaths++;
        localStorage.setItem("gd_totalDeaths", this._totalDeaths);
      }
      if (!this._newBestShown) {
        this._newBestShown = true;
        let _0x435587 = this._level.endXPos || 6000;
        let _0x169d53 = this._playerWorldX;
        this._lastPercent = Math.min(99, Math.floor(this._getCurrentPercent()));
        if (!this._startedFromStartPos && this._lastPercent > this._bestPercent && !this._practicedMode.practiceMode) {
          this._bestPercent = this._lastPercent;
          localStorage.setItem("bestPercent_" + (window.currentlevel[2] || "level_1"), this._bestPercent);
          this._hadNewBest = true;
          this._showNewBest();
        }
        if (!this._startedFromStartPos && this._practicedMode.practiceMode) {
          const pracKey = "practiceBestPercent_" + (window.currentlevel[2] || "level_1");
          const prevPracticeBest = parseFloat(localStorage.getItem(pracKey) || "0");
          if (this._lastPercent > prevPracticeBest) {
            localStorage.setItem(pracKey, this._lastPercent);
            this._practiceBestPercent = this._lastPercent;
            if (this._updatePracticeHUDBar) this._updatePracticeHUDBar();
          }
        }
      }
      this._player?.updateExplosionPieces?.(deltaTime);
      this._player?.updateInactiveTrails?.(this._cameraX, this._cameraY, deltaTime / 1000);
      this._player2?.updateInactiveTrails?.(this._cameraX, this._cameraY, deltaTime / 1000);
      if (this._isDual) {
        this._player2?.updateExplosionPieces?.(deltaTime);
      }
      if (this._player?._hitboxGraphics) {
        if (window.showHitboxes || window.hitboxesOnDeath) {
          this._player.drawHitboxes(this._player._hitboxGraphics, this._cameraX, this._cameraY);
        } else {
          this._player._hitboxGraphics.clear();
        }
      }
      if (this._isDual && this._player2?._hitboxGraphics) {
        if (window.showHitboxes || window.hitboxesOnDeath) {
          this._player2.drawHitboxes(this._player2._hitboxGraphics, this._cameraX, this._cameraY);
        } else {
          this._player2._hitboxGraphics.clear();
        }
      }
      this._deathTimer += deltaTime;
      const respawn = this._level.logicState?.options.respawnTime;
      let _0x237728 = window.GDHacks?.state.respawnDelayEnabled ? Math.max(0,window.GDHacks.state.respawnDelay*1000) : Math.max(this._hadNewBest ? 1400 : 1000, Number.isFinite(respawn) ? respawn * 1000 : 0);
      if (this._deathTimer > _0x237728) {
        if (this._practicedMode.practiceMode) {
          this._respawnFromCheckpoint();
        } else {
          this._restartLevel();
        }
      }
      return;
    }
    this._playTime += deltaTime / 1000;
    
    if (!window.enableLDM) {
      window._animTimer += deltaTime;
      for (let _as of window._animatedSprites) {
        if (!_as || !_as.active || !_as.visible) continue;
        const _animWorldX = Number(_as._eeWorldX);
        if (Number.isFinite(_animWorldX) && (_animWorldX < this._cameraX - 200 || _animWorldX > this._cameraX + screenWidth + 200)) continue;
        if (_as.parentContainer && _as.parentContainer.visible === false) continue;
        const _animInterval = Math.max(1, Number(_as._animInterval) || 100);
        const _elapsedAnim = window._animTimer - (_as._lastAnimSwap || 0);
        if (_elapsedAnim >= _animInterval) {
          const _animSteps = Math.floor(_elapsedAnim / _animInterval);
          _as._lastAnimSwap = (_as._lastAnimSwap || 0) + _animSteps * _animInterval;
          _as._animIdx = (_as._animIdx + _animSteps) % _as._animFrames.length;
          let _fr = getAtlasFrame(_as._animScene, _as._animFrames[_as._animIdx]);
          if (_fr) {
            try {
              _as.setTexture(_fr.atlas, _fr.frame);
            } catch(e){}
          }
        }
      }
    } else {
      window._animTimer += deltaTime;
    }
    if (!window.enableLDM) {
      // Monster clips start with this attempt. The global decoration clock
      // survives scene changes/restarts and must not seek a fresh beast
      // through all the time spent in previously played levels.
      this._level?.updateBeastAnimations?.((this._level._beastAnimationClock || 0) + deltaTime);
    }
    if (this._level && this._level._sawSprites && !window.enableLDM) {
      for (let _saw of this._level._sawSprites) {
        if (!_saw || !_saw.active || !_saw.visible) continue;
        const _sawWorldX = Number(_saw._eeWorldX);
        if (Number.isFinite(_sawWorldX) && (_sawWorldX < this._cameraX - 200 || _sawWorldX > this._cameraX + screenWidth + 200)) continue;
        if (_saw.parentContainer && _saw.parentContainer.visible === false) continue;
        const sawRotationSpeed = _saw._Sawrotationspeed ?? 0.0032;
        const initialSawRotation = Number.isFinite(_saw._eeInitialSawRotation) ? _saw._eeInitialSawRotation : 0;
        const sawElapsed = (window._animTimer || 0) - (_saw._eeSawStartTime || 0);
        const sawAngle = sawElapsed * sawRotationSpeed;
        const sawGroupRotation = Number(_saw._eeSawGroupRotation) || 0;
        const sawVisualAngle = sawAngle + sawGroupRotation;
        if (Number.isFinite(_saw._eeSawPivotX) && Number.isFinite(_saw._eeSawPivotY)) {
          const groupOffset = this._level._getCombinedGroupOffset?.(_saw) || { x: 0, y: 0 };
          const pivotX = _saw._eeSawPivotX + (Number(groupOffset.x) || 0);
          const pivotY = _saw._eeSawPivotY + (Number(groupOffset.y) || 0);
          const localX = Number(_saw._eeSawLocalX) || 0;
          const localY = Number(_saw._eeSawLocalY) || 0;
          const cos = Math.cos(sawVisualAngle);
          const sin = Math.sin(sawVisualAngle);
          _saw.x = pivotX + localX * cos - localY * sin;
          _saw.y = pivotY + localX * sin + localY * cos;
          _saw._eeWorldX = _saw.x;
          _saw._eeBaseY = _saw.y;
        }
        _saw.rotation = initialSawRotation + sawVisualAngle;
      }
    }
    if (this._level && this._level._orbSprites) {
      const gravityGuideRotation = (this._state?.gravityFlipped ? Math.PI : 0);
      for (let _oSpr of this._level._orbSprites) {
        if (!_oSpr || !_oSpr.active || !_oSpr._eeOrbGuide || !_oSpr._OrbGuideGrav) continue;
        const baseRotation = Number.isFinite(_oSpr._OrbGuideRotation) ? _oSpr._OrbGuideRotation : 0;
        _oSpr.rotation = baseRotation + gravityGuideRotation;
      }
    }
    if (this._visualTick !== false) this._level.updateAudioScale(this._audio.getMeteringValue(), this._cameraX, screenWidth);
    // The old procedural squares were a Web Dash-only effect, not the
    // resource-backed GD orb effect. Keep them opt-in so they cannot look
    // like a clipped/corner glow on normal main-level orbs.
    if (window.enableLegacyOrbParticles === true && !this._orbGfx) {
      this._orbGfx = this.add.graphics().setDepth(54).setBlendMode(S);
    }
    this._orbParticleAngle = ((this._orbParticleAngle || 0) + deltaTime * 0.004) % (Math.PI * 2);
    this._orbGfxTimer = (this._orbGfxTimer || 0) + deltaTime;
    if (window.enableLegacyOrbParticles === true && this._orbGfxTimer > 33) {
      this._orbGfxTimer = 0;
      this._orbGfx.clear();
      if (this._level && this._level._orbSprites && this._level.container) {
        try {
        let _drawn = 0;
        const _orbTypeColorMap = {
          36: 0xfffb57,
          84: 0x58ffff,
          141: 0xff52f0,
          444: 0xff00d2,
          1022: 0x63ff5f,
          1330: 0xffffff,
          1333: 0xff6326,
          1594: 0x6cff6b,
          1704: 0x04ff04,
          1751: 0xff00d2
        };
        for (let _oSpr of this._level._orbSprites) {
          if (_drawn >= 4) break;
          if (!_oSpr || !_oSpr.visible || !_oSpr.active || !_oSpr.scene) continue;
          const _sx = _oSpr.x + this._level.container.x;
          const _sy = _oSpr.y + this._level.container.y;
          if (_sx < -40 || _sx > screenWidth + 40 || _sy < -40 || _sy > screenHeight + 40) continue;
          _drawn++;
          const _orbTypeTint = _orbTypeColorMap[_oSpr._orbId];
          for (let _pi = 0; _pi < 5; _pi++) {
            const _orbitSpeed = 0.7 + (_pi % 3) * 0.35;
            const _orbitR = 34 + (_pi * 5 % 17);
            const _ang = this._orbParticleAngle * _orbitSpeed + (_pi * Math.PI * 2 / 5);
            const _px = _sx + Math.cos(_ang) * _orbitR;
            const _py = _sy + Math.sin(_ang) * (_orbitR * 0.85);
            const _size = (window.orbParticleSize || 3.5) + (_pi % 3) * 1.0;
            const _alpha = 0.5 + (_pi % 4) * 0.12;
            this._orbGfx.fillStyle(_orbTypeTint, _alpha);
            this._orbGfx.fillRect(_px - _size, _py - _size, _size * 2, _size * 2);
          }
        }
        } catch(e) {}
      }
    }
    let quantizedDelta = this._quantizeDelta(deltaTime);
    let subSteps = quantizedDelta > 0 ? (this._fixedTickActive ? 1 : Math.max(1, Math.round(quantizedDelta * 4))) : 0;
    if (subSteps > 60) {
      subSteps = 60;
    }
    let subStepDelta = subSteps > 0 ? quantizedDelta / subSteps : 0;
    // PlayerObject::update multiplies its float delta by the float 0.9
    // before integrating Y; X keeps the speed multiplication in double.
    let verticalDelta = Math.fround(Math.fround(subStepDelta) * Math.fround(d));
    let horizontalDelta = Math.fround(subStepDelta) * playerSpeed * Math.fround(d);
    const initialY = this._state.y;
    const initialY2 = this._state2.y;
    for (let i = 0; i < subSteps; i++) {
      this._level.checkGameplayTriggers(this._playerWorldX, this._state.y);
      horizontalDelta = Math.fround(subStepDelta) * playerSpeed * Math.fround(d) * (this._level.gameplayState?.speedScale ?? 1);
      const leavePhysicsFrame = this._level.gameplayState?.enterPhysics();
      try {
        this._state.lastY = this._state.y;
        // resetLevel meets the triggers at the start before the first step: a
        // delayed Spawn at X 0 counts from there (native MK2 intro).
        if (this._physicsFrame === 0) {
          this._meetStartTriggers(this._playerWorldX);
          this._level.stepSpawnTriggers(deltaTime / 1000, this._colorManager);
        }
        this._physicsFrame++;
        // Lock to Player moves read the velocity of the tick they activate on.
        this._tickStart = { frame: this._physicsFrame, x: this._playerWorldX, y: this._state.y };
        this._applyJumpInput();
        if (this._macroBot?.playing) {
          this._macroBot.step(this._physicsFrame);
        }
        const _dualInputState = {
          upKeyDown: this._state.upKeyDown,
          upKeyPressed: this._state.upKeyPressed,
          queuedHold: this._state.queuedHold,
          orbActivationConsumedForPress: !!this._state._orbActivationConsumedForPress
        };
        const _primaryGravityBefore = !!this._state.gravityFlipped;
        const _primarySharedBefore = this._getDualSharedSignature(this._state);
        // _pushButton already fires touched rings at the input boundary.
        // Replaying the press here fires a second overlapping custom ring
        // after Options enabled the held button in the preceding command phase.
        this._player.updateJump(verticalDelta);
        this._player.applyObjectForces(verticalDelta);
        this._state.y = gdAdvancePosition(this._state.y, this._state.isDashing ? this._state.dashSlope * horizontalDelta
          : this._state.yVelocity * (this._state.isWave ? subStepDelta : verticalDelta), this._localPhysicsActive ? 0 : 180);
        // PlayerObject::update moves x and y, then GJBaseGameLayer checks the
        // collisions of the moved box (collisionCheckObjects reads the
        // post-move rect). Testing the pre-move x put every contact a tick late.
        this._playerWorldX = gdAdvancePosition(this._playerWorldX, horizontalDelta * (this._state.isGoingLeft ? -1 : 1));
        // PlayerObject::updateRotation returns while m_isDashing: the dash
        // art owns the rotation in every mode, also on the ground.
        if (this._state.isDashing) {
          this._player.updateDashRotation(subStepDelta / 60);
        }
        this._player.checkCollisions(this._playerWorldX - centerX);
        this._state.y = gdAdvancePosition(this._state.y, 0, this._localPhysicsActive ? 0 : 180);
        const _primaryGravityChanged = this._isDual && !!this._state.gravityFlipped !== _primaryGravityBefore;
        let _primaryGravitySynced = false;
        if (this._isDual && this._getDualSharedSignature(this._state) !== _primarySharedBefore) {
          _primaryGravitySynced = this._syncDualGlobalsFromPrimary({
            skipBallInputGravity: _primaryGravityChanged && this._state.isBall && _dualInputState.upKeyPressed,
            skipSpiderInputGravity: _primaryGravityChanged && this._state.isSpider && _dualInputState.upKeyPressed
          });
        }
        if (this._isDual && this._state.isDead && !this._state2.isDead) {
          this._player2.killPlayer();
        }
        if (this._isDual && !this._state2.isDead && this._dualSpawnPhysicsFrame !== this._physicsFrame) {
          const leaveSecondaryPhysics = this._level.gameplayState?.enterSecondaryPhysics();
          try {
          // Each PlayerObject owns its input flags. Actual button edges
          // reach both in _pushButton; an Options trigger re-enabling P1
          // must not manufacture a press on P2 on the following tick.
          if (this._shouldSuppressDualGravityAction(this._state2, _primaryGravitySynced)) {
            this._state2.upKeyPressed = false;
            this._state2.queuedHold = false;
          }
          this._state2.lastY = this._state2.y;
          const _secondarySharedBefore = this._getDualSharedSignature(this._state2);
          const _secondaryBallInputGravity = this._state2.isBall && this._state2.upKeyPressed;
          const _secondarySpiderInputGravity = this._state2.isSpider && this._state2.upKeyPressed;
          this._player2.updateJump(verticalDelta);
          this._player2.applyObjectForces(verticalDelta);
          this._state2.y = gdAdvancePosition(this._state2.y, this._state2.isDashing ? this._state2.dashSlope * horizontalDelta
            : this._state2.yVelocity * (this._state2.isWave ? subStepDelta : verticalDelta), this._localPhysicsActive ? 0 : 180);
          if (this._dualSpawnPhysicsFrame !== this._physicsFrame)
            this._secondaryWorldX = gdAdvancePosition(this._secondaryWorldX ?? this._playerWorldX-horizontalDelta,
              horizontalDelta * (this._state2.isGoingLeft ? -1 : 1));
          if (this._isDual && !this._state2.isDead && this._state2.isDashing) {
            this._player2.updateDashRotation(subStepDelta / 60);
          } else if (this._isDual && !this._state2.isDead && !this._state2.isFlying && !this._state2.isWave && !this._state2.isUfo) {
          }
          this._player2.checkCollisions((this._secondaryWorldX ?? this._playerWorldX) - centerX);
          this._state2.y = gdAdvancePosition(this._state2.y, 0, this._localPhysicsActive ? 0 : 180);
          if (this._isDual && !this._state2.isDead && this._getDualSharedSignature(this._state2) !== _secondarySharedBefore) {
            this._syncDualGlobalsFromSecondary({
              skipBallInputGravity: _secondaryBallInputGravity,
              skipSpiderInputGravity: _secondarySpiderInputGravity
            });
          }
          this._resolveDualBallOverlap();
          if (this._isDual && this._state2.isDead && !this._state.isDead) {
            this._player.killPlayer(true);
          }
          if (this._isDual && this._state.isDead && !this._state2.isDead) {
            this._player2.killPlayer(true);
          }
          if (this._isDual) this._ensureDualFlyBounds();
          } finally { leaveSecondaryPhysics?.(); }
        }

        if (!this._player._scene._slideIn && window.showHitboxTrail){
          if (!this._player._hitboxTrail) this._player._hitboxTrail = [];
          if (!this._player.p.isDead) {
            const _trailSize = this._player._collisionHalfSize();
            const trailPoint = this._localPhysicsActive ? this._level.gameplayState?.toWorld(this._playerWorldX, this._player.p.y) : { x: this._playerWorldX, y: this._player.p.y };
            this._player._hitboxTrail.push({ x: trailPoint.x, y: trailPoint.y, rotation: this._level.gameplayState?.visualAngle(this._player._rotation) ?? this._player._rotation, size: _trailSize, isWave: this._player.p.isWave, isMini: this._player.p.isMini, isSpider: this._player.p.isSpider });
            if (this._player._hitboxTrail.length > 2000) this._player._hitboxTrail.shift();
          }
          if (this._isDual && !this._player2.p.isDead) {
            if (!this._player2._hitboxTrail) this._player2._hitboxTrail = [];
            const _trailSize2 = this._player2._collisionHalfSize();
            const secondaryX=this._secondaryWorldX ?? this._playerWorldX;
            const trailPoint = this._localPhysicsActive ? this._level.gameplayState?.toWorld(secondaryX, this._player2.p.y) : { x: secondaryX, y: this._player2.p.y };
            this._player2._hitboxTrail.push({ x: trailPoint.x, y: trailPoint.y, rotation: this._level.gameplayState?.visualAngle(this._player2._rotation) ?? this._player2._rotation, size: _trailSize2, isWave: this._player2.p.isWave, isMini: this._player2.p.isMini, isSpider: this._player2.p.isSpider });
            if (this._player2._hitboxTrail.length > 2000) this._player2._hitboxTrail.shift();
          }
        } else if (!window.showHitboxTrail) {
          if (this._player._hitboxTrail?.length) this._player._hitboxTrail.length = 0;
          if (this._player2?._hitboxTrail?.length) this._player2._hitboxTrail.length = 0;
        }

        if (this._macroBot?.playing) {
          this._macroBot.applyCurrentFrame();
        } else if (this._macroBot?.recording) {
          this._macroBot.recordFrame(this._physicsFrame);
        }
        this._pressUnseen = false;
        if (this._releaseDeferred) this._releaseButton();
        this._pressUnseen2=false;
        if(this._releaseDeferred2)this._releaseSecondPlayerButton();
      } finally { leavePhysicsFrame?.(); }
    }
    this._state.lastY = initialY;
    if (this._isDual) this._state2.lastY = initialY2;
    this._state.ignorePortals = false;
    this._state2.ignorePortals = false;
    // A turn crossed by this physics step changes the camera now; the next
    // physics step uses its new axes. Waiting for the next step left the
    // camera on the old axis through Dash's first rotated frame.
    this._level.checkGameplayTriggers(this._playerWorldX, this._state.y);
    let playerX = this._playerWorldX;
    const applyColorTrigger = (colorTrigger) => {
      this._colorManager.triggerColor(colorTrigger.index, colorTrigger.color, colorTrigger.duration, colorTrigger.colorOptions);
      if (colorTrigger.tintGround) {
        this._colorManager.triggerColor(gs, colorTrigger.color, colorTrigger.duration, colorTrigger.colorOptions);
      }
    };
    for (let colorTrigger of this._level.checkColorTriggers(playerX)) {
      applyColorTrigger(colorTrigger);
    }
    if (this._level.checkTouchColorTriggers) {
      for (let colorTrigger of this._level.checkTouchColorTriggers(playerX, this._state.y)) {
        applyColorTrigger(colorTrigger);
      }
      if (this._isDual && !this._state2.isDead) {
        for (let colorTrigger of this._level.checkTouchColorTriggers(this._secondaryWorldX ?? playerX, this._state2.y)) {
          applyColorTrigger(colorTrigger);
        }
      }
    }
    this._level.checkMoveTriggers(playerX);
    this._level.checkFollowTriggers(playerX);
    this._level.checkScaleTriggers(playerX);
    this._level.checkCountTriggers(playerX);
    this._level.checkEndTriggers(playerX);
    this._level.checkKeyframeTriggers(playerX);
    this._level.checkAdditionalTouchTriggers(playerX, this._state.y);
    if (this._isDual && !this._state2.isDead) this._level.checkAdditionalTouchTriggers(this._secondaryWorldX ?? playerX, this._state2.y);
    this._level.checkSpawnTriggers(playerX);
    this._level.checkLogicTriggers?.(playerX);
    this._level.checkAnimationTriggers?.(playerX);
    if (this._level.checkTouchSpawnTriggers) {
        this._level.checkTouchSpawnTriggers(playerX, this._state.y);
        if (this._isDual && !this._state2.isDead) {
            this._level.checkTouchSpawnTriggers(this._secondaryWorldX ?? playerX, this._state2.y);
        }
    }
    this._level.checkTouchAnimationTriggers?.(playerX, this._state.y);
    if (this._isDual && !this._state2.isDead) {
      this._level.checkTouchAnimationTriggers?.(this._secondaryWorldX ?? playerX, this._state2.y);
    }
    if (this._level.checkTouchMoveTriggers) {
        this._level.checkTouchMoveTriggers(playerX, this._state.y);
        if (this._isDual && !this._state2.isDead) {
            this._level.checkTouchMoveTriggers(this._secondaryWorldX ?? playerX, this._state2.y);
        }
    }
    // processMoveActionsStep (33433a..33439b): scale, rotate, then move, so a
    // rotation turns about where its centre stood before this tick's move.
    this._level.stepScaleTriggers(deltaTime / 1000);
    this._level.stepRotateTriggers(deltaTime / 1000);
    this._level.checkRotateTriggers(playerX);
    this._level.stepMoveTriggers(deltaTime / 1000, true);
    // Follow consumes this tick's move deltas before queued Spawn actions.
    // Otherwise a Teleport inside a spawn loop reads the follower one tick
    // late and repeatedly takes horizontal travel away from the player.
    this._level.stepFollowTriggers(deltaTime / 1000);
    this._level.stepSpawnTriggers(deltaTime / 1000, this._colorManager);
    this._level.logicState?.step(deltaTime / 1000);
    this._level.checkAlphaTriggers(playerX);
    this._level.stepAlphaTriggers(deltaTime / 1000);
    this._level.checkToggleTriggers(playerX);
    this._level.checkTouchToggleTriggers(playerX, this._state.y);
    if (this._isDual && !this._state2.isDead) {
      this._level.checkTouchToggleTriggers(this._secondaryWorldX ?? playerX, this._state2.y);
    }
    this._level.checkShakeTriggers(playerX);
    this._level.checkStopTriggers(playerX, this._state.y);
    if (this._isDual && !this._state2.isDead) {
      this._level.checkStopTriggers(this._secondaryWorldX ?? playerX, this._state2.y);
    }
    this._level.advFollowState?.step(deltaTime / 1000);
    this._level.keyframeState?.step(deltaTime / 1000);
    this._level.checkPulseTriggers(playerX);
    this._level.checkShaderTriggers(playerX);
    this._level.checkCameraTriggers(playerX);
    this._level.cameraState?.step(deltaTime / 1000);
    this._level.cameraState?.followStep(quantizedDelta);
    if (!this._endCameraOverride) {
      const cameraOffsetX = this._gdFollowCameraX();
      if (this._level.endXPos > 0) {
        const maxCameraX = this._level.endXPos - screenWidth;
        if (cameraOffsetX >= maxCameraX - 200) {
          this._endCameraOverride = true;
          this._cameraX = cameraOffsetX;
          const endCameraY = -140 + (this._level._endPortalGameY || 240);
          const easingPower = 1.8;
          const easeInOutCubic = t => t < 0.5 ? Math.pow(t * 2, easingPower) / 2 : 1 - Math.pow((1 - t) * 2, easingPower) / 2;
          this._endCamTween = {
            p: 0,
            fromX: this._cameraX,
            toX: maxCameraX,
            fromY: this._cameraY,
            toY: endCameraY
          };
          this.tweens.add({
            targets: this._endCamTween,
            p: 1,
            duration: 1200,
            ease: easeInOutCubic
          });
        } else {
          this._cameraX = cameraOffsetX;
        }
      } else {
        this._cameraX = cameraOffsetX;
      }
    }
    if (this._endCameraOverride && this._endCamTween) {
      const tween = this._endCamTween;
      this._cameraX = tween.fromX + (tween.toX - tween.fromX) * tween.p;
      this._cameraY = tween.fromY + (tween.toY - tween.fromY) * tween.p;
    }
    this._cameraXRef._v = this._cameraX;
    if (!this._endCameraOverride) {
      this._updateCameraY(quantizedDelta);
      this._level.cameraState?.finishFollow(quantizedDelta);
    }
    const _shakeOffset = this._stepLevelShake(deltaTime / 1000);
    this._level.additiveContainer.x = -this._cameraX + _shakeOffset.x;
    this._level.additiveContainer.y = this._cameraY + _shakeOffset.y;
    this._level.container.x = -this._cameraX + _shakeOffset.x;
    this._level.container.y = this._cameraY + _shakeOffset.y;
    this._level.topContainer.x = -this._cameraX + _shakeOffset.x;
    this._level.topContainer.y = this._cameraY + _shakeOffset.y;
    this._level.stepCameraLockMoves();
    this._level.checkAreaTriggers?.(playerX);
    this._level.areaState?.step(deltaTime / 1000);
    this._level.shaderState?.step(deltaTime / 1000);
    this._level.stepPulseTriggers(deltaTime / 1000, this._colorManager);
    this._colorManager.step(deltaTime / 1000);
    this._level.checkEnterEffectTriggers(playerX);
    this._player.finishRingContacts();
    this._player2?.finishRingContacts();
    // Only the last 240 Hz tick of a frame is drawn: like GD, the visual
    // side (colours on sprites, culling, enter effects, background, ground)
    // runs once per frame with the frame's whole time step.
    this._gdRenderDeltaMs = (this._gdRenderDeltaMs || 0) + deltaTime;
    this._visualDt = (this._visualDt || 0) + deltaTime;
    if (this._visualTick !== false) {
      const visualDt = this._visualDt;
      this._visualDt = 0;
      this._level.applyColorChannels(this._colorManager);
      this._bg.setTint(this._colorManager.getHex(fs));
      this._level.setGroundColor(this._colorManager.getHex(gs));
      this._level.setGround2Color?.(this._colorManager.getHex(1009));
      this._level.setLineColor?.(this._colorManager.getHex(1002), this._colorManager.getBlending(1002));
      this._level.updateVisibility(this._cameraX);
      this._level.updateObjectDebugIds();
      this._level.applyEnterEffects(this._cameraX);
      this._glitterCenterX = this._cameraX + screenWidth / 2;
      this._glitterCenterY = T - this._cameraY;
      this._updateBackground();
      this._level.stepGroundAnimation(visualDt / 1000);
      this._level.updateGroundTiles(this._cameraY);
    }
    // GJBaseGameLayer::update (341377) turns the players once per frame, after
    // the frame's collision steps: their boxes keep the last frame's angle.
    this._player.updateCubeRotation(quantizedDelta);
    if (this._isDual && !this._state2.isDead) this._player2.updateCubeRotation(quantizedDelta);
    this._stepMirrorTransition(deltaTime / 1000);
    const playerScreenX = this._playerWorldX - this._cameraX;
    this._player.syncSprites(this._cameraX, this._cameraY, deltaTime / 1000, this._getMirrorXOffset(playerScreenX));
    if (this._isDual && !this._state2.isDead) {
      const secondaryX = this._secondaryWorldX ?? this._playerWorldX;
      this._player2.syncSprites(this._cameraX, this._cameraY, deltaTime / 1000, this._getMirrorXOffset(secondaryX - this._cameraX));
    } else {
      this._player2.updateInactiveTrails(this._cameraX, this._cameraY, deltaTime / 1000);
    }
    if(this._visualTick!==false)this._drawHackTrajectory();
    this._applyMirrorEffect();
  }
  _drawHackTrajectory() {
    if(!window.showTrajectory||this._state.isDead){this._trajectoryGraphics?.clear();return;}
    if(!this._trajectoryGraphics?.scene){
      this._trajectoryGraphics=this.add.graphics().setScrollFactor(1).setDepth(21);
      // Scene restarts destroy Graphics while retaining scene fields. A stale
      // destroyed Graphics previously swallowed every subsequent trajectory.
      if(this._level.cameraState)this._level.cameraState._filterKey=null;
    }
    const graphics=this._trajectoryGraphics;
    graphics.clear();
    const mirror=this._getMirrorVisualScale(),mc=screenWidth/2,iterations=window.GDHacks?.state.trajectoryIterations||300;
    for(const player of [this._player,...(this._isDual?[this._player2]:[])])for(const down of [true,false]){
      const result=player.predictTrajectory(down,iterations),points=result.points;
      graphics.lineStyle(1.3,down?0x00ff19:0xff0019,1);graphics.beginPath();
      for(let i=0;i<points.length;i++){const p=points[i],x=mc+mirror*(p.x-this._cameraX-mc),y=b(p.y)+this._cameraY;
        if(i===0)graphics.moveTo(x,y);else graphics.lineTo(x,y);}
      graphics.strokePath();
    }
  }
  _stepDeadLevelEffects(deltaMs) {
    // Native effect-manager commands continue while the player is dead
    // (Troll Madness uses that interval for its authored death scenes).
    // Preserve the 240 Hz order; no player collision or new touch scan runs.
    const level = this._level;
    if (!level || this._paused) return;
    this._deadEffectsBuffer = (this._deadEffectsBuffer || 0) + Math.max(0, deltaMs) / 1000;
    const tick = 1 / 240;
    while (this._deadEffectsBuffer + 1e-10 >= tick) {
      this._deadEffectsBuffer -= tick;
      this._physicsFrame++;
      const dt = tick * (level.logicState?.timeWarp ?? 1);
      level.stepScaleTriggers(dt); level.stepRotateTriggers(dt);
      level.stepMoveTriggers(dt, true); level.stepFollowTriggers(dt);
      level.stepSpawnTriggers(dt, this._colorManager); level.logicState?.step(dt);
      level.stepAlphaTriggers(dt); level.advFollowState?.step(dt); level.keyframeState?.step(dt);
      level.cameraState?.step(dt); level.stepCameraLockMoves();
      level.areaState?.step(dt); level.shaderState?.step(dt);
      level.stepPulseTriggers(dt, this._colorManager); this._colorManager.step(dt);
      this._gdRenderDeltaMs = (this._gdRenderDeltaMs || 0) + dt * 1000;
    }
    level.updateBeastAnimations?.((level._beastAnimationClock || 0) + Math.max(0, deltaMs));
    level.applyColorChannels(this._colorManager);
  }

  _resetMirrorTransition(mirrored = false) {
    const target = mirrored ? 1 : 0;
    this._mirrorProgress = target;
    this._mirrorTarget = target;
    this._mirrorTransition = null;
  }
  _beginMirrorTransition(mirrored) {
    if(window.instantMirror){this._resetMirrorTransition(mirrored);return;}
    const target = mirrored ? 1 : 0;
    const current = Number.isFinite(this._mirrorProgress)
      ? Math.max(0, Math.min(1, this._mirrorProgress))
      : (this._state?.mirrored ? 1 : 0);
    this._mirrorTarget = target;
    if (Math.abs(target - current) < 0.0001) {
      this._resetMirrorTransition(mirrored);
      return;
    }
    const fullTurnDuration = 0.52;
    this._mirrorTransition = {
      from: current,
      to: target,
      elapsed: 0,
      duration: Math.max(0.08, fullTurnDuration * Math.abs(target - current))
    };
  }
  _stepMirrorTransition(dt) {
    const transition = this._mirrorTransition;
    if (!transition) return;
    transition.elapsed += Math.max(0, Math.min(0.05, Number(dt) || 0));
    const t = Math.max(0, Math.min(1, transition.elapsed / transition.duration));
    const eased = 0.5 - Math.cos(Math.PI * t) * 0.5;
    this._mirrorProgress = transition.from + (transition.to - transition.from) * eased;
    if (t >= 1) {
      this._mirrorProgress = transition.to;
      this._mirrorTransition = null;
    }
  }
  _getMirrorVisualScale() {
    const progress = Number.isFinite(this._mirrorProgress)
      ? Math.max(0, Math.min(1, this._mirrorProgress))
      : (this._state?.mirrored ? 1 : 0);
    return Math.cos(Math.PI * progress);
  }
  _applyMirrorEffect() {
    const mirrorScale = this._getMirrorVisualScale();
    // `centerX` is the gameplay anchor (where the player is held while the
    // level scrolls), not the centre of the rendered viewport.  Mirroring
    // around it shifts the entire scene sideways during a mirror portal.
    const mirrorCenterX = screenWidth / 2;
    const containers = [this._level.additiveContainer, this._level.container, this._level.topContainer,
      this._player?._trailContainer, this._player2?._trailContainer];
    for (const c of containers) {
      if (!c) continue;
      const normalX = c.x;
      c.scaleX = mirrorScale;
      c.x = mirrorCenterX + mirrorScale * (normalX - mirrorCenterX);
    }

    const mirrorGroundTiles = tiles => {
      for (const tile of tiles || []) {
        if (!tile) continue;
        const normalX = tile.x;
        if (!Number.isFinite(tile._eeMirrorBaseScaleX)) {
          tile._eeMirrorBaseScaleX = Math.abs(tile.scaleX) || 1;
        }
        tile.setFlipX(false);
        tile.scaleX = tile._eeMirrorBaseScaleX * mirrorScale;
        tile.x = mirrorCenterX + mirrorScale * (normalX - mirrorCenterX);
      }
    };
    mirrorGroundTiles(this._level._groundTiles);
    mirrorGroundTiles(this._level._ground2Tiles);
    mirrorGroundTiles(this._level._ceilingTiles);
    mirrorGroundTiles(this._level._ceiling2Tiles);

    for (const line of [this._level._groundLine, this._level._ceilingLine]) {
      if (!line) continue;
      if (!Number.isFinite(line._eeMirrorBaseScaleX)) {
        line._eeMirrorBaseScaleX = Math.abs(line.scaleX) || 1;
      }
      line.setFlipX(false);
      line.scaleX = line._eeMirrorBaseScaleX * mirrorScale;
    }

    if (this._bg) {
      this._bg.setFlipX(false);
      this._bg.scaleX = mirrorScale;
      this._bg.x = mirrorCenterX * (1 - mirrorScale);
    }
  }
  _getDualSharedSignature(state) {
    if (!state) return "0|0";
    return [
      state.gravityFlipped ? 1 : 0,
      state.mirrored ? 1 : 0
    ].join("|");
  }
  _getDualModeId(state) {
    if (!state) return "cube";
    if (state.isSwing) return "swing";
    if (state.isFlying) return "ship";
    if (state.isBall) return "ball";
    if (state.isUfo) return "ufo";
    if (state.isWave) return "wave";
    if (state.isRobot) return "robot";
    if (state.isSpider) return "spider";
    return "cube";
  }
  _getGamemodePortalMode(portalType) {
    switch (portalType) {
      case "portal_cube":
        return "cube";
      case "portal_fly":
        return "ship";
      case "portal_swing":
        return "swing";
      case "portal_ball":
        return "ball";
      case "portal_wave":
        return "wave";
      case "portal_ufo":
        return "ufo";
      case "portal_robot":
        return "robot";
      case "portal_spider":
        return "spider";
      default:
        return null;
    }
  }
  _setPlayerGamemode(player, state, mode, keepVelocity = true) {
    if (!player || !state) return;
    const currentMode = this._getDualModeId(state);
    if (currentMode === mode) {
      player.setCubeVisible(mode === "cube" || mode === "ship" || mode === "ufo");
      player.setShipVisible(mode === "ship");
      player.setBallVisible(mode === "ball");
      player.setWaveVisible(mode === "wave");
      player.setBirdVisible?.(mode === "ufo");
      player.setRobotVisible(mode === "robot");
      player.setSpiderVisible(mode === "spider");
      player.setSwingVisible?.(mode === "swing");
      return;
    }
    const saved = {
      y: state.y,
      yVelocity: state.yVelocity,
      gravityFlipped: state.gravityFlipped,
      upKeyDown: state.upKeyDown,
      upKeyPressed: state.upKeyPressed,
      queuedHold: state.queuedHold,
      orbActivationConsumedForPress: !!state._orbActivationConsumedForPress,
      mirrored: state.mirrored,
      isMini: state.isMini
    };
    switch (mode) {
      case "swing":
        player.enterSwingMode({ y: saved.y, portalY: saved.y }, true);
        break;
      case "ship":
        player.enterShipMode({ y: saved.y, portalY: saved.y }, true);
        break;
      case "ball":
        player.enterBallMode({ y: saved.y, portalY: saved.y });
        break;
      case "ufo":
        player.enterUfoMode({ y: saved.y, portalY: saved.y }, true);
        break;
      case "wave":
        player.enterWaveMode({ y: saved.y, portalY: saved.y });
        break;
      case "robot":
        player.enterRobotMode({ y: saved.y, portalY: saved.y });
        break;
      case "spider":
        player.enterSpiderMode({ y: saved.y, portalY: saved.y });
        break;
      default:
        player.exitShipMode();
        player.exitBallMode();
        player.exitUfoMode();
        player.exitWaveMode();
        player.exitRobotMode();
        player.exitSpiderMode();
        state.isFlying = false;
        state.isBall = false;
        state.isUfo = false;
        state.isWave = false;
        state.isRobot = false;
        state.isSpider = false;
        player.setShipVisible(false);
        player.setBallVisible(false);
        player.setWaveVisible(false);
        player.setBirdVisible?.(false);
        player.setRobotVisible(false);
        player.setSpiderVisible(false);
        player.setCubeVisible(true);
        break;
    }
    state.y = saved.y;
    if (keepVelocity && Number.isFinite(saved.yVelocity)) state.yVelocity = saved.yVelocity;
    state.gravityFlipped = saved.gravityFlipped;
    state.upKeyDown = saved.upKeyDown;
    state.upKeyPressed = saved.upKeyPressed;
    state.queuedHold = saved.queuedHold;
    state._orbActivationConsumedForPress = !!saved.orbActivationConsumedForPress;
    state.mirrored = saved.mirrored;
    state.isMini = saved.isMini;
  }
  _getInitialDualPortalMode() {
    if (!this._level || !this._player2 || !this._state2) return null;

    const worldX = Number(this._playerWorldX);
    const worldY = Number(this._state2.y);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;

    const halfSize = this._state2.isWave
      ? (this._state2.isMini ? 6 : 9)
      : this._player2._collisionHalfSize();

    const previousWorldXRaw = Number(this._player?._lastCollisionWorldX);
    const previousWorldYRaw = Number(this._player?._lastCollisionWorldY);
    const previousWorldX = Number.isFinite(previousWorldXRaw) ? previousWorldXRaw : worldX;
    const previousWorldY = Number.isFinite(previousWorldYRaw)
      ? previousWorldYRaw
      : (Number.isFinite(Number(this._state?.lastY)) ? Number(this._state.lastY) : worldY);

    const nearbyObjects = this._level.getNearbySectionObjects?.(worldX) || [];
    const previousNearbyObjects = previousWorldX !== worldX
      ? (this._level.getNearbySectionObjects?.(previousWorldX) || [])
      : [];
    const portalObjects = [...new Set([...nearbyObjects, ...previousNearbyObjects])];

    let portalMode = null;

    for (const gameObj of portalObjects) {
      const mode = this._getGamemodePortalMode(gameObj?.type);
      if (!mode) continue;

      let touching = false;

      if (gameObj.hitbox_radius !== undefined && gameObj.hitbox_radius !== null) {
        const radius = gameObj.hitbox_radius + halfSize;
        const dx = worldX - gameObj.x;
        const dy = worldY - gameObj.y;
        touching = (dx * dx + dy * dy) <= radius * radius;

        if (!touching && (previousWorldX !== worldX || previousWorldY !== worldY)) {
          const prevDx = previousWorldX - gameObj.x;
          const prevDy = previousWorldY - gameObj.y;
          touching = (prevDx * prevDx + prevDy * prevDy) <= radius * radius;

          if (!touching) {
            const steps = Math.min(
              12,
              Math.max(2, Math.ceil(
                Math.max(Math.abs(worldX - previousWorldX), Math.abs(worldY - previousWorldY)) / Math.max(1, halfSize)
              ))
            );

            for (let i = 1; i < steps; i++) {
              const t = i / steps;
              const sampleX = previousWorldX + (worldX - previousWorldX) * t;
              const sampleY = previousWorldY + (worldY - previousWorldY) * t;
              const sampleDx = sampleX - gameObj.x;
              const sampleDy = sampleY - gameObj.y;

              if ((sampleDx * sampleDx + sampleDy * sampleDy) <= radius * radius) {
                touching = true;
                break;
              }
            }
          }
        }
      } else if (typeof this._player2._isPlayerTouchingPortalHitbox === "function") {
        touching = this._player2._isPlayerTouchingPortalHitbox(
          gameObj,
          worldX,
          worldY,
          halfSize,
          previousWorldX,
          previousWorldY
        );
      }

      if (touching) portalMode = mode;
    }

    return portalMode;
  }
  _copyDualInputFlags(fromState, toState) {
    if (!fromState || !toState || this._isTwoPlayerMode()) return;
    toState.upKeyDown = fromState.upKeyDown;
    toState.upKeyPressed = fromState.upKeyPressed;
    toState.queuedHold = fromState.queuedHold;
    const fromConsumed = !!(fromState._orbActivationConsumedForPress ?? fromState.orbActivationConsumedForPress);
    toState._orbActivationConsumedForPress = !!fromState.upKeyDown && (!!toState._orbActivationConsumedForPress || fromConsumed);
  }
  _shouldSuppressDualGravityAction(state, gravityAlreadySynced) {
    return !!(gravityAlreadySynced && state && state.isBall && state.upKeyPressed);
  }
  _shouldSkipDualBallGravitySync(fromState, toState, options = {}) {
    if (!fromState?.isBall || !toState) return false;
    if (options.forceGravitySync) return false;
    if (options.skipBallInputGravity) return true;
    // GJBaseGameLayer::flipGravity synchronizes matching modes even in
    // flight. Only a ball's own button action bypasses that layer call.
    return false;
  }
  _shouldSkipDualSpiderInputGravitySync(fromState, options = {}) {
    // spiderTestJumpInternal changes this PlayerObject's gravity directly;
    // spider pads/rings do not call GJBaseGameLayer's linked dual flip.
    if (fromState?._spiderLocalGravityFrame === this._physicsFrame) return true;
    if (!fromState?.isSpider) return false;
    if (options.forceGravitySync) return false;
    return !!options.skipSpiderInputGravity;
  }
  _isDualBallOnSurface(state) {
    return !!(state && (state.onGround || state.onCeiling || state.canJump));
  }
  _areDualBallsOverlapping() {
    if (!this._isDual || !this._state || !this._state2) return false;
    if (this._state.isDead || this._state2.isDead) return false;
    if (!this._state.isBall || !this._state2.isBall) return false;
    // Opposite-gravity balls separate naturally. Treating their overlap as
    // a same-surface contact reverses P2 when a dual cube enters ball mode.
    // Native dual-then-ball telemetry keeps P2 rising to the upper ground.
    if (this._state.gravityFlipped !== this._state2.gravityFlipped) return false;
    const size1 = this._state.isMini ? 18 : 30;
    const size2 = this._state2.isMini ? 18 : 30;
    if (Math.abs((this._secondaryWorldX ?? this._playerWorldX)-this._playerWorldX) >= size1+size2) return false;
    return Math.abs(this._state.y - this._state2.y) < (size1 + size2);
  }
  _flipDualBallForOverlap(player, state) {
    if (!player || !state || !state.isBall) return false;
    const flipMod = state.gravityFlipped ? -1 : 1;
    state.yVelocity = flipMod * 22.360064 * (state.isMini ? 0.8 : 1);
    player.flipGravity(!state.gravityFlipped);
    state.onGround = false;
    state.onCeiling = false;
    state.canJump = false;
    state.isJumping = false;
    state.yVelocity *= 0.6;
    return true;
  }
  _resolveDualBallOverlap() {
    if (!this._areDualBallsOverlapping()) {
      this._dualBallOverlapResolved = false;
      this._dualBallSpawnGravityLock = false;
      return false;
    }
    if (this._dualBallSpawnGravityLock) {
      this._state2.gravityFlipped = !this._state.gravityFlipped;
      this._dualBallOverlapResolved = true;
      return false;
    }
    if (this._dualBallOverlapResolved) return false;
    const primaryOnSurface = this._isDualBallOnSurface(this._state);
    const secondaryOnSurface = this._isDualBallOnSurface(this._state2);
    if (!primaryOnSurface && !secondaryOnSurface) return false;
    
    let flipped = false;
    if (primaryOnSurface && !secondaryOnSurface) {
      flipped = this._flipDualBallForOverlap(this._player2, this._state2);
    } else if (secondaryOnSurface && !primaryOnSurface) {
      flipped = this._flipDualBallForOverlap(this._player, this._state);
    } else if (primaryOnSurface && secondaryOnSurface) {
      flipped = this._flipDualBallForOverlap(this._player2, this._state2);
    }
    if (flipped) this._dualBallOverlapResolved = true;
    return flipped;
  }
  _copyInitialDualModeFlags(fromState, toState) {
    if (!fromState || !toState) return;
    toState.isGoingLeft = !!fromState.isGoingLeft;
    toState.isMini = fromState.isMini;
    toState.mirrored = fromState.mirrored;
    toState.gravityFlipped = this._level?.logicState?.options.unlinkDualGravity
      ? fromState.gravityFlipped : !fromState.gravityFlipped;
    this._copyDualInputFlags(fromState, toState);
  }
  _syncDualGlobalsFromPrimary(options = {}) {
    if (!this._isDual || !this._state || !this._state2 || this._state2.isDead) return false;
    let gravitySynced = false;
    if (this._dualGravityModesMatch() && !this._shouldSkipDualBallGravitySync(this._state, this._state2, options) && !this._shouldSkipDualSpiderInputGravitySync(this._state, options)) {
      const nextGravity = !this._state.gravityFlipped;
      this._player2.flipGravity(nextGravity);
      gravitySynced = true;
    }
    this._state2.mirrored = this._state.mirrored;
    this._ensureDualFlyBounds();
    return gravitySynced;
  }
  _syncDualGlobalsFromSecondary(options = {}) {
    if (!this._isDual || !this._state || !this._state2 || this._state.isDead || this._state2.isDead) return false;
    let gravitySynced = false;
    if (this._dualGravityModesMatch() && !this._shouldSkipDualBallGravitySync(this._state2, this._state, options) && !this._shouldSkipDualSpiderInputGravitySync(this._state2, options)) {
      const nextGravity = !this._state2.gravityFlipped;
      this._player.flipGravity(nextGravity);
      gravitySynced = true;
    }
    this._state.mirrored = this._state2.mirrored;
    this._ensureDualFlyBounds();
    return gravitySynced;
  }
  _isTwoPlayerMode() {
    return String(window.settingsMap?.kA10 ?? '0') === '1';
  }
  _dualGravityModesMatch() {
    // GJBaseGameLayer::flipGravity (319e9b..319ef9) synchronizes only
    // matching ship/ball/UFO/spider/robot/swing flags. Wave has no flag here.
    return !this._isTwoPlayerMode() && !this._level?.logicState?.options.unlinkDualGravity && ['isFlying','isBall','isUfo','isSpider','isRobot','isSwing'].every(key =>
      !!this._state[key] === !!this._state2[key]);
  }
  _ensureDualFlyBounds(centerY = null) {
    if (!this._isDual || !this._level) return;
    // updateDualGround (31a4ff..31a57f) raises ball's 240-point band to
    // 270, then takes the larger mode's band. Ship/UFO/wave/swing use 300;
    // cube/robot/spider use 270. Coordinates here are twice GD points.
    const hasFlightBand = state => state && (state.isFlying || state.isUfo || state.isWave || state.isSwing);
    const span = hasFlightBand(this._state) || hasFlightBand(this._state2) ? 600 : 540;
    const floorY = this._level._flyFloorY;
    const ceilingY = this._level._flyCeilingY;
    const currentSpan = Number.isFinite(Number(floorY)) && Number.isFinite(Number(ceilingY)) ? Number(ceilingY) - Number(floorY) : null;
    if (currentSpan === null || Math.abs(currentSpan - span) > 0.01 || !this._level._flyGroundActive) {
      // The band belongs to the dual portal (m_lastActivatedPortal2, 31a6de), not
      // to wherever the players are by the time a mode portal changes its span.
      const y = this._dualBandY ?? (Number.isFinite(Number(centerY)) ? Number(centerY) : (Number.isFinite(Number(this._state?.y)) ? Number(this._state.y) : 30));
      this._level.setFlyMode(true, y, span, false);
    }
  }
  _refreshFlyBoundsAfterDual() {
    if (!this._level) return;
    // toggleDualMode (31e38c) goes back to the last mode portal's band.
    const center = this._lastBandY ?? this._state.y;
    if (this._state.isFlying || this._state.isWave || this._state.isUfo || this._state.isSwing) {
      this._level.setFlyMode(true, center, f, false);
    } else if (this._state.isBall) {
      this._level.setFlyMode(true, center, f - a * 2, false);
    } else if (this._state.isSpider) {
      const spiderBlockSize = typeof a !== "undefined" ? a : 30;
      const spiderBaseHeight = typeof f !== "undefined" ? f : 480;
      const spiderFlyHeight = Math.max(spiderBlockSize, spiderBaseHeight - spiderBlockSize);
      this._level.setFlyMode(true, center, spiderFlyHeight, false, spiderFlyHeight);
    } else {
      this._level.setFlyMode(false, 0);
    }
  }
  _killDualPlayers() {
    if (this._state && !this._state.isDead) this._player.killPlayer();
    if (this._isDual && this._state2 && !this._state2.isDead) this._player2.killPlayer();
  }

  _getMirrorXOffset(xOffset) {
    const mirrorCenterX = screenWidth / 2;
    return mirrorCenterX + this._getMirrorVisualScale() * (xOffset - mirrorCenterX);
  }
  _enableDualMode(portal = null) {
    if (this._isDual) {
      // toggleDualMode still records a newly touched dual portal and calls
      // updateDualGround when both players already exist (31a6de). The new
      // corridor must be available before a nearby teleport is used.
      if (portal) {
        this._dualBandY = this._lastBandY = portal.portalY ?? portal.y;
        const flight = state => state.isFlying || state.isUfo || state.isWave || state.isSwing;
        const span = flight(this._state) || flight(this._state2) ? 600 : 540;
        const bounds = this._level._computeFlyBounds(this._dualBandY, span, false);
        if (bounds.floorY !== this._level._flyFloorY || bounds.ceilingY !== this._level._flyCeilingY)
          this._level.setFlyMode(true, this._dualBandY, span, false);
      }
      return;
    }
    this._isDual = true;
    this._dualBandY = portal ? (portal.portalY ?? portal.y) : this._state.y;
    this._lastBandY = this._dualBandY;
    const gameplay = this._level.gameplayState;
    const spawn = this._localPhysicsActive && gameplay?.rotated
      ? gameplay.toWorld(this._playerWorldX, this._state.y) : { x: this._playerWorldX, y: this._state.y };
    if (gameplay) gameplay.secondaryWorldAxes = true;
    this._secondaryWorldX = spawn.x;
    this._dualSpawnPhysicsFrame = this._physicsFrame;
    this._dualBallSpawnGravityLock = false;
    this._dualBallOverlapResolved = false;
    this._state2.reset();
    this._state2.isDead = false;
    const unlinkGravity=!!this._level?.logicState?.options.unlinkDualGravity;
    this._state2.yVelocity = unlinkGravity ? this._state.yVelocity : -this._state.yVelocity;
    this._copyInitialDualModeFlags(this._state, this._state2);
    this._ensureDualFlyBounds(this._state.y);
    const primaryY = Number.isFinite(Number(spawn.y)) ? Number(spawn.y) : 30;
    this._state2.y = primaryY;
    this._state2.lastY = primaryY;
    this._state2.lastGroundPosY = primaryY;
    this._state2.onGround = false;
    this._state2.onCeiling = false;
    this._state2.canJump = false;
    this._state2.isJumping = false;
    this._player2.reset();
    this._player2.setInvertedColors?.(true);
    this._setPlayerGamemode(this._player2, this._state2, this._getDualModeId(this._state), true);
    this._copyInitialDualModeFlags(this._state, this._state2);
    const initialPortalMode = this._getInitialDualPortalMode();
    if (initialPortalMode) this._setPlayerGamemode(this._player2, this._state2, initialPortalMode, true);
    if (this._state.isBall && this._state2.isBall && !unlinkGravity) {
      this._state2.gravityFlipped = !this._state.gravityFlipped;
      this._dualBallOverlapResolved = true;
      this._dualBallSpawnGravityLock = true;
    }
    this._ensureDualFlyBounds(this._state.y);
    if (this._player2 && this._player2._hitboxTrail) this._player2._hitboxTrail = [];
    if (this._player2?._hitboxGraphics) this._player2._hitboxGraphics.clear();
  }
  _disableDualMode(triggeringPlayer = this._player) {
    if (!this._isDual) return;
    if(triggeringPlayer===this._player2) {
      // toggleDualMode (31e15a..31e175) copies the player that touched
      // the exit into P1. Asymmetric duals may have independent positions
      // and modes, so merely hiding P2 strands P1 on the other route.
      const state={...this._state2},mode=this._getDualModeId(this._state2);
      // The surviving body's state comes from P2; P1's physical button map
      // stays attached to P1 (enablePlayerControls later reads that map).
      const physicalJumpHeld = this._state._physicalJumpHeld;
      this._setPlayerGamemode(this._player,this._state,mode,true);
      Object.assign(this._state,state);
      this._state._physicalJumpHeld = physicalJumpHeld;
      this._playerWorldX=this._secondaryWorldX ?? this._playerWorldX;
      this._player.restoreSlopeState(this._player2.captureSlopeState());
      this._player._rotation=this._player2._rotation;
      this._player.stopVisualEmission();
      // The exiting player becomes P1; emission belongs to its surviving mode.
      this._player._resetTeleportTrails();
      if (mode === 'wave') { this._player._waveTrail.start(); this._player._streak.start(); }
      else if (mode === 'ship' || mode === 'ufo' || mode === 'swing') this._player._streak.start();
      for(const o of this._level.objects)if(o._activatedByPlayer) {
        o._activatedByPlayer.main=!!o._activatedByPlayer.dual;
        o.activated=Object.values(o._activatedByPlayer).some(Boolean);
      }
    }
    this._isDual = false;
    this._dualBallOverlapResolved = false;
    this._dualBallSpawnGravityLock = false;
    this._state2.isDead = true;
    this._state2.upKeyDown = false;
    this._state2.upKeyPressed = false;
    this._state2.queuedHold = false;
    this._player2.stopVisualEmission();
    this._player2.setCubeVisible(false);
    this._player2.setShipVisible(false);
    this._player2.setBallVisible(false);
    this._player2.setWaveVisible(false);
    this._player2.setBirdVisible?.(false);
    this._player2.setRobotVisible(false);
    this._player2.setSpiderVisible(false);
    this._player2.setSwingVisible(false);
    if (this._player2?._hitboxGraphics) this._player2._hitboxGraphics.clear();
    if (this._player2 && this._player2._hitboxTrail) this._player2._hitboxTrail = [];
    this._refreshFlyBoundsAfterDual();
  }
  _showNewBest() {
    let _0x9f2437 = screenWidth / 2;
    let _0x12bde3 = this.add.image(0, 0, "GJ_WebSheet", "GJ_newBest_001.png").setOrigin(0.5, 1);
    let _0x544c9c = this.add.bitmapText(0, 2, "bigFont", this._lastPercent + "%", 65).setOrigin(0.5, 0).setScale(1.1);
    let _0x326cb9 = this.add.container(_0x9f2437, 300, [_0x12bde3, _0x544c9c]).setScrollFactor(0).setDepth(60).setScale(0.01);
    this.tweens.add({
      targets: _0x326cb9,
      scale: 1,
      duration: 400,
      ease: "Elastic.Out",
      easeParams: [1, 0.6],
      onComplete: () => {
        this.tweens.add({
          targets: _0x326cb9,
          scale: 0.01,
          duration: 200,
          delay: 700,
          ease: "Quad.In",
          onComplete: () => {
            _0x326cb9.setVisible(false);
            _0x326cb9.destroy();
          }
        });
      }
    });
  }
  _endFromTrigger(trigger) {
    if (this._levelWon || this._state.isDead) return;
    this._endTrigger = trigger;
    this._levelWon = true;
    this._endPortalGameY = trigger.y;
    if (trigger.instant) {
      this._playerWorldX = trigger.x; this._state.y = trigger.y;
      this._player._stopDash();
      if (this._isDual) { this._state2.y = trigger.y; this._player2._stopDash(); }
      this._levelComplete();
    } else this._triggerEndPortal();
  }
  _triggerEndPortal() {
    const endX = this._endTrigger?.x ?? this._level.endXPos;
    if (this._isDual && this._player2 && this._state2 && !this._state2.isDead) {
      this._player2.playEndAnimation(endX, () => {}, this._endPortalGameY);
    }
    this._player.playEndAnimation(endX, () => this._levelComplete(), this._endPortalGameY);
  }
  _levelComplete() {
    if (!this._startedFromStartPos && !this._practicedMode.practiceMode) {
      const isNonPersistentCoinLevel = window.isEditor || this._level?._isStoredUserLevel?.();
      if (isNonPersistentCoinLevel) {
        this._level.resetCoinsForEditorCompletion?.();
      } else {
        this._level.commitSecretCoins?.();
        this._level.commitUserCoins?.();
      }
      this._bestPercent = 100;
      localStorage.setItem("bestPercent_" + (window.currentlevel[2] || "level_1"), 100);
      const completedKey = "gd_completedSet";
      let completedSet;
      try { completedSet = JSON.parse(localStorage.getItem(completedKey) || "[]"); } catch(e) { completedSet = []; }
      const levelId = window.currentlevel[2] || "level_1";
      if (!completedSet.includes(levelId)) {
        completedSet.push(levelId);
        localStorage.setItem(completedKey, JSON.stringify(completedSet));
        window._completedLevels = completedSet.length;
        localStorage.setItem("gd_completedLevels", window._completedLevels);
      }
    } else if (!this._startedFromStartPos) {
      this._practiceBestPercent = 100;
      localStorage.setItem("practiceBestPercent_" + (window.currentlevel[2] || "level_1"), 100);
      if (this._updatePracticeHUDBar) this._updatePracticeHUDBar();
    }

    if (this._endTrigger?.noEffects) {
      this._showCompleteText();
      return;
    }
    const _0x356782 = (this._endTrigger?.x ?? this._level.endXPos) - this._cameraX;
    const _0x2d967b = b(this._endPortalGameY) + this._cameraY;
    for (let _0x481f7c = 0; _0x481f7c < 5; _0x481f7c++) {
      this.time.delayedCall(_0x481f7c * 50, () => circleEffect(this, _0x356782, _0x2d967b, 10, screenWidth, 500, false, true, window.mainColor));
    }
    circleEffect(this, _0x356782, _0x2d967b, 10, 1000, 500, true, false, window.mainColor);
    this._showCompleteEffect();
  }
  _showCompleteEffect() {
    if (!this._endTrigger?.noSFX) this.sound.play("endStart_02", {
      volume: 0.8 * this._sfxVolume
    });
    (function (_0x3f5321, _0x8f5267, _0x2f1e2d, _0x4b5e5b) {
      const _0x29d856 = 2;
      const _0x1b2543 = 8;
      const _0x2cc21f = _0x29d856 * 1;
      const _0x26b2b1 = _0x29d856 * 30;
      const _0x6f49c1 = _0x29d856 * 20;
      const _0x232789 = Math.round(Math.sqrt(screenWidth ** 2 + 102400)) + _0x29d856 * 32.5;
      const _0x1c105b = 180;
      const _0x586720 = 40;
      const _0x57b9ff = 195;
      const _0x2b6612 = 40;
      const _0x5ce50e = 40;
      const _0x4da54f = 155 / 255;
      const _0x20decf = 100 / 255;
      const _0x576e6f = 400;
      const _0x487fb1 = -135;
      const _0x323ded = 90 / _0x1b2543;
      const _0x44369e = Array.from({
        length: _0x1b2543
      }, (_0x18e51d, _0x59ebd4) => _0x487fb1 + _0x59ebd4 * _0x323ded);
      for (let _0x59890f = _0x44369e.length - 1; _0x59890f > 0; _0x59890f--) {
        const _0x2bf73b = Math.floor(Math.random() * (_0x59890f + 1));
        [_0x44369e[_0x59890f], _0x44369e[_0x2bf73b]] = [_0x44369e[_0x2bf73b], _0x44369e[_0x59890f]];
      }
      let _0x594d69 = 0;
      const _0x116c8c = [];
      for (let _0x104cbb = 0; _0x104cbb < _0x1b2543; _0x104cbb++) {
        const _0x1a79fc = _0x104cbb * _0x57b9ff + _0x2b6612 + _0x5ce50e * (Math.random() * 2 - 1);
        const _0x6eb03a = _0x26b2b1 + _0x6f49c1 * (Math.random() * 2 - 1);
        const _0x2e9531 = _0x1c105b + _0x586720 * (Math.random() * 2 - 1);
        const _0x28e7b3 = Math.min(1, Math.max(0, _0x4da54f + _0x20decf * (Math.random() * 2 - 1)));
        const _0x34147c = _0x44369e[_0x104cbb] + _0x323ded * Math.random() + 180;
        const containerY = _0x3f5321.add.graphics().setScrollFactor(0).setDepth(-1).setBlendMode(S).setPosition(_0x8f5267, _0x2f1e2d).setAngle(_0x34147c).setAlpha(_0x28e7b3).setVisible(false);
        const _0x496d96 = {
          h: 1,
          w: _0x2cc21f
        };
        _0x3f5321.time.delayedCall(Math.max(0, _0x1a79fc), () => {
          containerY.setVisible(true);
          _0x3f5321.tweens.add({
            targets: _0x496d96,
            h: _0x232789,
            w: _0x6eb03a,
            duration: _0x2e9531,
            ease: "Quad.Out",
            onUpdate: () => {
              const _0x2db3d7 = _0x2cc21f + (_0x496d96.w - _0x2cc21f) / 4;
              containerY.clear();
              containerY.fillStyle(_0x4b5e5b, 1);
              containerY.beginPath();
              containerY.moveTo(-_0x2db3d7 / 2, 0);
              containerY.lineTo(_0x2db3d7 / 2, 0);
              containerY.lineTo(_0x496d96.w / 2, _0x496d96.h);
              containerY.lineTo(-_0x496d96.w / 2, _0x496d96.h);
              containerY.closePath();
              containerY.fillPath();
            }
          });
        });
        if (_0x1a79fc > _0x594d69) {
          _0x594d69 = _0x1a79fc;
        }
        _0x116c8c.push(containerY);
      }
      _0x3f5321.time.delayedCall(_0x594d69 + _0x576e6f, () => {
        for (const _0x15b95e of _0x116c8c) {
          const _0x51b5fc = Math.random() * 200;
          const _0x3ed1de = 400 + (Math.random() * 2 - 1) * 100;
          _0x3f5321.tweens.add({
            targets: _0x15b95e,
            alpha: 0,
            delay: _0x51b5fc,
            duration: _0x3ed1de,
            onComplete: () => _0x15b95e.destroy()
          });
        }
      });
    })(this, this._level.endXPos - this._cameraX + 60, b(this._endPortalGameY) + this._cameraY, window.mainColor);
    this.cameras.main.shake(1950, 0.004);
    this.time.delayedCall(1950, () => this._showCompleteText());
  }
  _showCompleteText() {
    const _0x56628c = screenWidth / 2;
    const _0x45ab26 = this._practicedMode.practiceMode
      ? this.add.image(_0x56628c, 250, "GJ_GameSheet03", "GJ_practiceComplete_001.png").setScrollFactor(0).setDepth(60).setScale(0.01)
      : this.add.image(_0x56628c, 250, "GJ_WebSheet", "GJ_levelComplete_001.png").setScrollFactor(0).setDepth(60).setScale(0.01);
    this.tweens.add({
      targets: _0x45ab26,
      scale: 1.1,
      duration: 660,
      ease: "Elastic.Out",
      easeParams: [1, 0.6],
      onComplete: () => {
        this.tweens.add({
          targets: _0x45ab26,
          scale: 0.01,
          duration: 220,
          delay: 880,
          ease: "Quad.In",
          onComplete: () => {
            _0x45ab26.setVisible(false);
            _0x45ab26.destroy();
          }
        });
      }
    });
    const _0x2884ff = [window.mainColor, 16777215];
    for (let _0x5f16c8 = 0; _0x5f16c8 < 2; _0x5f16c8++) {
      this.add.particles(_0x56628c, 250, "GJ_WebSheet", {
        frame: "square.png",
        speed: {
          min: 300,
          max: 700
        },
        angle: {
          min: 0,
          max: 360
        },
        scale: {
          start: 0.4,
          end: 0.13
        },
        lifespan: {
          min: 0,
          max: 1000
        },
        quantity: 50,
        stopAfter: 200,
        blendMode: S,
        tint: _0x2884ff[_0x5f16c8],
        x: {
          min: -800,
          max: 800
        },
        y: {
          min: -80,
          max: 80
        }
      }).setScrollFactor(0).setDepth(59);
    }
    const _0x2eadf2 = this._level.endXPos - this._cameraX;
    const _0x380b24 = b(this._endPortalGameY) + this._cameraY;
    circleEffect(this, _0x2eadf2, _0x380b24, 10, screenWidth, 800, true, false, window.mainColor);
    circleEffect(this, _0x56628c, 250, 10, 1000, 800, true, false, window.mainColor);
    for (let _0x579e05 = 0; _0x579e05 < 5; _0x579e05++) {
      this.time.delayedCall(_0x579e05 * 50, () => circleEffect(this, _0x2eadf2, _0x380b24, 10, screenWidth, 500, false, true, window.mainColor));
    }
    for (let _0x429722 = 0; _0x429722 < 10; _0x429722++) {
      const _0xbf7dd0 = _0x429722 * 150 + (Math.random() * 160 - 80);
      this.time.delayedCall(Math.max(0, _0xbf7dd0), () => particleEffect(this, window.mainColor, window.secondaryColor));
    }
    this.time.delayedCall(1500, () => this._showEndLayer());
  }
  _isMainLevelForCoinDisplay() {
    const levelId = window.currentlevel?.[2];
    return !!levelId && Array.isArray(window.allLevels) && window.allLevels.some(level => level?.[2] === levelId);
  }
  _showEndLayer() {
    if (this._pauseBtn) {
      this.tweens.add({
        targets: this._pauseBtn,
        alpha: 0,
        duration: 300
      });
    }
    const containerX = screenWidth / 2;
    const _0x1aa656 = 320;
    this._endLayerOverlay = this.add.rectangle(containerX, _0x1aa656, screenWidth, screenHeight, 0, 0).setScrollFactor(0).setDepth(200).setInteractive();
    this._endLayerInternal = this.add.container(0, -640).setScrollFactor(0).setDepth(201);
    this.tweens.add({
      targets: this._endLayerOverlay,
      alpha: 100 / 255,
      duration: 1000
    });
    const _0x59b9ab = {
      p: 0
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 1,
      duration: 1000,
      ease: "Bounce.Out",
      onUpdate: () => {
        this._endLayerInternal.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: () => {
        if (this._isMainLevelForCoinDisplay()) {
          this._playsecretcoinanimation();
        } else {
          this._playusercoinanimation();
        }
        this.time.delayedCall(250, () => this._playStarAward());
      }
    });
    const _0x595215 = 712;
    const _0x950c8d = 460;
    const _0x2a115c = (screenWidth - _0x595215) / 2;
    this._endLayerInternal.add(this.add.rectangle(_0x2a115c + 356, 310, _0x595215, _0x950c8d, 0, 180 / 255));
    const _0x43f2e3 = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const _0x3feccc = _0x43f2e3 ? _0x950c8d / _0x43f2e3.height : 1;
    this._endLayerInternal.add(this.add.image(_0x2a115c - 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(0, 0).setScale(1, _0x3feccc));
    this._endLayerInternal.add(this.add.image(_0x2a115c + _0x595215 + 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(1, 0).setFlipX(true).setScale(1, _0x3feccc));
    const _0x33b564 = this.add.image(_0x2a115c + 356, 70, "GJ_WebSheet", "GJ_table_top_001.png");
    this._endLayerInternal.add(_0x33b564);
    this._endLayerInternal.add(this.add.image(_0x2a115c + 356, 560, "GJ_WebSheet", "GJ_table_bottom_001.png"));
    const _0x3e9c79 = _0x33b564.y - 35;
    this._endLayerInternal.add(this.add.image(containerX - 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._endLayerInternal.add(this.add.image(containerX + 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    const _completeBanner = this._practicedMode.practiceMode
      ? this.add.image(containerX, 170, "GJ_GameSheet03", "GJ_practiceComplete_001.png").setScale(0.85)
      : this.add.image(containerX, 170, "GJ_WebSheet", "GJ_levelComplete_001.png").setScale(0.85);
    this._endLayerInternal.add(_completeBanner);
    const _0x45b6e4 = 0.8;
    let _0xe44f6d = 250;
    const _0x2de55e = this.add.bitmapText(containerX, _0xe44f6d, "goldFont", "Attempts: " + this._levelAttempts, 46).setOrigin(0.5, 0.5).setScale(_0x45b6e4);
    this._endLayerInternal.add(_0x2de55e);
    _0xe44f6d += 48;
    this._endLayerInternal.add(this.add.bitmapText(containerX, _0xe44f6d, "goldFont", "Jumps: " + this._levelJumps, 46).setOrigin(0.5, 0.5).setScale(_0x45b6e4));
    _0xe44f6d += 48;
    const _0x596450 = Math.floor(this._playTime);
    const _0x30687e = Math.floor(_0x596450 / 3600);
    const _0x52f8ee = Math.floor(_0x596450 % 3600 / 60);
    const _0x2591d0 = _0x596450 % 60;
    let _0x2be782;
    _0x2be782 = _0x30687e > 0 ? String(_0x30687e).padStart(2, "0") + ":" + String(_0x52f8ee).padStart(2, "0") + ":" + String(_0x2591d0).padStart(2, "0") : String(_0x52f8ee).padStart(2, "0") + ":" + String(_0x2591d0).padStart(2, "0");
    const _0x241209 = _0xe44f6d;
    this._endLayerInternal.add(this.add.bitmapText(containerX, _0xe44f6d, "goldFont", "Time: " + _0x2be782, 46).setOrigin(0.5, 0.5).setScale(_0x45b6e4));
    const isMainLevel = this._isMainLevelForCoinDisplay();
    const coinSprites = (this._level?._coinSprites || []).filter(sprite => isMainLevel
      ? sprite?._secretCoinSlot !== undefined
      : sprite?._userCoinSlot !== undefined);
    const coinCount = Math.min(3, coinSprites.length);
    const coinOffsets = coinCount === 1
      ? [0]
      : coinCount === 2
        ? [-60, 60]
        : [-120, 0, 120];
    const completionMessageY = coinCount > 0 ? _0x241209 : _0x241209 + 96;
    this._endsecretcoinPositions = isMainLevel
      ? coinOffsets.map(offset => ({ x: containerX + offset, y: 445 }))
      : null;
    let savedSecretCoinSlots = new Set();
    try {
      const savedSlots = JSON.parse(localStorage.getItem(`gd_secretCoins_${window.currentlevel?.[2] || "level_1"}_slots`) || "[]");
      if (Array.isArray(savedSlots)) {
        savedSecretCoinSlots = new Set(savedSlots.filter(slot => Number.isInteger(slot) && slot >= 0 && slot < 3));
      }
    } catch (_error) {}
    const runSecretCoinSlots = this._level?._editorEndSecretCoinSlots
      ? new Set(this._level._editorEndSecretCoinSlots)
      : new Set(
        (this._level?._coinSprites || [])
          .filter(sprite => this._level?._secretCoinRunCollected?.has(String(sprite?._secretCoinId)))
          .map(sprite => sprite?._secretCoinSlot)
          .filter(slot => Number.isInteger(slot))
      );
    this._endsecretcoinPositions?.forEach(({ x, y }, slot) => {
      if (savedSecretCoinSlots.has(slot) && !runSecretCoinSlots.has(slot)) return;
      this._endLayerInternal.add(
        this.add.image(x, y, "GJ_GameSheet02", "secretCoin_b_01_001.png")
          .setOrigin(0.5)
          .setScale(1.1)
      );
    });
    for (const slot of savedSecretCoinSlots) {
      if (!this._endsecretcoinPositions) break;
      if (runSecretCoinSlots.has(slot)) continue;
      const position = this._endsecretcoinPositions[slot];
      this._endLayerInternal.add(
        this.add.image(position.x, position.y, "GJ_GameSheet03", "secretCoinUI_001.png")
          .setOrigin(0.5)
          .setScale(1.1)
      );
    }
    this._endusercoinPosition = null;
    if (!isMainLevel && coinCount > 0) {
      this._endusercoinPosition = coinOffsets.map(offset => ({ x: containerX + offset, y: 445 }));
      let savedUserCoinSlots = new Set();
      try {
        const savedSlots = JSON.parse(localStorage.getItem(`gd_userCoins_${window.currentlevel?.[2] || "level_1"}_slots`) || "[]");
        if (Array.isArray(savedSlots)) {
          savedUserCoinSlots = new Set(savedSlots.filter(slot => Number.isInteger(slot) && slot >= 0 && slot < 3));
        }
      } catch (_error) {}
      const runUserCoinSlots = this._level?._editorEndUserCoinSlots
        ? new Set(this._level._editorEndUserCoinSlots)
        : new Set(
          (this._level?._coinSprites || [])
            .filter(sprite => this._level?._userCoinRunCollected?.has(String(sprite?._userCoinId)))
            .map(sprite => sprite?._userCoinSlot)
            .filter(slot => Number.isInteger(slot))
        );
      this._endusercoinPosition.forEach(({ x, y }, slot) => {
        if (savedUserCoinSlots.has(slot) && !runUserCoinSlots.has(slot)) return;
        this._endLayerInternal.add(this.add.image(x, y, "GJ_GameSheet02", "secretCoin_2_b_01_001.png").setOrigin(0.5));
      });
      for (const slot of savedUserCoinSlots) {
        if (runUserCoinSlots.has(slot)) continue;
        const position = this._endusercoinPosition[slot];
        this._endLayerInternal.add(this.add.image(position.x, position.y, "GJ_GameSheet0", "secretCoinUI2_001.png").setOrigin(0.5));
      }
    }
    const _0x452429 = ["Awesome!", "Good\nJob!", "Well\nDone!", "Impressive!", "Amazing!", "Incredible!", "Skillful!", "Brilliant!", "Not\nbad!", "Warp\nSpeed!", "Challenge\nBreaker!", "Reflex\nMaster!", "I am\nspeechless...", "You are...\nThe One!", "How is this\npossible!?", "You beat\nme...", /* "You cannot beat a level with Noclip enabled.", "You cannot beat a level with Speedhack enabled.", "Safe Mode enabled."*/];
    const _0x165c06 = _0x452429[Math.floor(Math.random() * _0x452429.length)];
    const _0x45540f = 235;
    const _0x8e2b = ["\x5f\x6d\x61\x63\x72\x6f\x42\x6f\x74", "\x70\x6c\x61\x79\x69\x6e\x67"];let _0x3bc14 = 0xffffff; try {if (this[_0x8e2b[0]] && this[_0x8e2b[0]][_0x8e2b[1]]) {_0x3bc14 = (_0x3bc14 & 0xffff00) | 0xfa;}} catch (_0xe31) {}const _0x17fa2b = this.add.bitmapText(coinCount > 0 ? containerX + _0x45540f : containerX, completionMessageY, "bigFont", coinCount > 0 ? _0x165c06 : _0x165c06.replace(/\n/g, " "), coinCount > 0 ? 40 : 46).setOrigin(0.5, 0.5).setScale(coinCount > 0 ? 0.8 : 0.9).setCenterAlign();if (_0x3bc14 !== 0xffffff) _0x17fa2b.setTint(_0x3bc14);
    this._endLayerInternal.add(_0x17fa2b);
    _0x2de55e.width;
    this._endStarX = containerX + _0x45540f;
    this._endStarY = _0x241209 - 77.5;
    if (window.macroBot){
      const botMenuBtn = this.add.image(containerX - 225, 255, "macroBot").setScale(0.4).setInteractive();
      this._endLayerInternal.add(botMenuBtn);
      this._makeBouncyButton(botMenuBtn, 0.4, () => {
          this._buildMacroPopup();
          if (this._macroPopup) {
              this._macroPopup.setDepth(300); 
          }
      });
    }
    const _0x45fc2b = [{
      frame: "GJ_replayBtn_001.png",
      dx: -200,
      action: () => this._hideEndLayer(() => this._restartLevel())
    }, {
      frame: "GJ_menuBtn_001.png",
      dx: 200,
      action: () => {
        this._audio.playEffect("quitSound_01");
        this._queueGameplayLevelViewReturn();
        this._audio.stopMusic();
        this.game.registry.set("fadeInFromBlack", true);
        this.cameras.main.fadeOut(400, 0, 0, 0, (_0x53bf86, _0x15310d) => {
          if (_0x15310d >= 1) {
            this.scene.restart();
          }
        });
      }
    }];
    for (const _0x2d4335 of _0x45fc2b) {
      const _0xdde774 = this.add.image(containerX + _0x2d4335.dx, 555, "GJ_WebSheet", _0x2d4335.frame).setInteractive();
      this._endLayerInternal.add(_0xdde774);
      this._makeBouncyButton(_0xdde774, 1, _0x2d4335.action);
    }
  }

      _buildhelppopup() {
    this._Helpclosed = false;
    if (this._pauseBtn) {
      this.tweens.add({
        targets: this._pauseBtn,
        alpha: 0,
        duration: 300
      });
    }

    const containerX = screenWidth / 2;
    const _0x1aa656 = 320;
    this._helpoverlay = this.add.rectangle(containerX, _0x1aa656, screenWidth, screenHeight, 0, 0).setScrollFactor(0).setDepth(200).setInteractive();
    this._helplayer = this.add.container(0, -640).setScrollFactor(0).setDepth(201);
    this._helplayer.add(this.add.bitmapText(containerX, 65, "bigFont", "Support", 55).setOrigin(0.5, 0.5));
    this._helpclose = false;
    this.tweens.add({
      targets: this._helpoverlay,
      alpha: 180 / 255,
      duration: 250,
      ease: "Linear"
    });

    const _0x59b9ab = {
      p: 0
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 1,
      duration: 450,
      ease: "Quad.Out",
      onUpdate: () => {
        this._helplayer.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: () => {}
    });
        this._playusercoinanimation();

    const _0x595215 = 712;
    const _0x950c8d = 460;
    const _0x2a115c = (screenWidth - _0x595215) / 2;
    this._helplayer.add(this.add.rectangle(_0x2a115c + 356, 310, _0x595215, _0x950c8d, 0, 180 / 255));
    const _0x43f2e3 = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const _0x3feccc = _0x43f2e3 ? _0x950c8d / _0x43f2e3.height : 1;
    this._helplayer.add(this.add.image(_0x2a115c - 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(0, 0).setScale(1, _0x3feccc));
    this._helplayer.add(this.add.image(_0x2a115c + _0x595215 + 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(1, 0).setFlipX(true).setScale(1, _0x3feccc));
    const _0x33b564 = this.add.image(_0x2a115c + 356, 70, "GJ_WebSheet", "GJ_table_top_001.png");
    this._helplayer.add(_0x33b564);
    this._helplayer.add(this.add.image(_0x2a115c + 356, 560, "GJ_WebSheet", "GJ_table_bottom_001.png"));
    const _0x3e9c79 = _0x33b564.y - 35;
    this._helplayer.add(this.add.bitmapText(containerX, 65, "bigFont", "Support", 55).setOrigin(0.5, 0.5));
    this._helplayer.add(this.add.image(containerX - 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._helplayer.add(this.add.image(containerX + 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._helplayer.add(this.add.image(_0x2a115c + 258, 285, "GJ_GameSheet03", "developedBy_001.png"));
    const robtopSupportLogo = this.add.image(_0x2a115c + 440, 285, "GJ_GameSheet03", "robtoplogo_small.png").setScale(0.95).setInteractive();
    this._makeBouncyButton(robtopSupportLogo, 0.95, () => {
      window.open("https://geometrydash.com", "_blank");
    }, () => !this._helpclose);
    this._helplayer.add(robtopSupportLogo);
    this._helplayer.add(this.add.image(_0x2a115c + 250, 375, "GJ_GameSheet03", "poweredBy_001.png"));
    const phaserlogo = this.add.image(_0x2a115c + 432, 380, "Phaserlogo").setScale(0.1).setInteractive();
    this._makeBouncyButton(phaserlogo, 0.1, () => {
      window.open("https://docs.phaser.io/", "_blank");
    }, () => !this._helpclose);
    this._helplayer.add(phaserlogo);
    this._helplayer.add(this.add.bitmapText(containerX, 440, "goldFont", "Web Dashers not associated with RobTop Games", 22).setOrigin(0.5, 0.5));

    const _helpbuttonborder = this.textures.get("GJ_button01").source[0].width * 0.3;
    const _helpbtnh = 70;
    const _helpbtnw = 195;
    const _helpBtnGap = 52.5;
    const _helpBtnY = 180;
    const _makesupportButton = (cx, label, action) => {
      const grp = this.add.container(cx, _helpBtnY);
      const btn9 = this.add.nineslice(0, 0, "GJ_button01", null, _helpbtnw, _helpbtnh, _helpbuttonborder, _helpbuttonborder, _helpbuttonborder, _helpbuttonborder).setOrigin(0.5).setTint(0xffffff);
      grp.add(btn9);
      const lbl = this.add.bitmapText(0, -5, "bigFont", label, 40).setOrigin(0.5, 0.5);
      grp.add(lbl);
      const hitZone = this.add.zone(0, 0, _helpbtnw, _helpbtnh).setInteractive();
      grp.add(hitZone);
      const baseScale = 1;
      const pressedScale = baseScale * 1.26;
      hitZone.on("pointerdown", () => {
        hitZone._pressed = true;
        this.tweens.killTweensOf(grp, "scale");
        this.tweens.add({ targets: grp, scale: pressedScale, duration: 300, ease: "Bounce.Out" });
      });
      hitZone.on("pointerout", () => {
        if (hitZone._pressed) {
          hitZone._pressed = false;
          this.tweens.killTweensOf(grp, "scale");
          this.tweens.add({ targets: grp, scale: baseScale, duration: 400, ease: "Bounce.Out" });
        }
      });
      hitZone.on("pointerup", () => {
        if (hitZone._pressed) {
          hitZone._pressed = false;
          this.tweens.killTweensOf(grp, "scale");
          grp.setScale(baseScale);
          action?.();
        }
      });
      this._helplayer.add(grp);
      return grp;
    };

    _makesupportButton(containerX - _helpbtnw - _helpBtnGap / 2, "Links", () => {
      this._showwippopup();
    });
    _makesupportButton(containerX, "Contact", () => {
      this._showcontactpopup();
    });
    _makesupportButton(containerX + _helpbtnw + _helpBtnGap / 2, "Notes", () => {
      this._showwippopup();
    });

    const ldmX = _0x2a115c + 160;
    const ldmY = 495;
    const ldmCheckOffset = -120;
    const ldmTextOffset = -80;
    
    var ldmIsOn = window.enableLDM;
    var ldmCheckTexture = ldmIsOn ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png";
    var ldmCheck = this.add.image(ldmX + ldmCheckOffset, ldmY, "GJ_GameSheet03", ldmCheckTexture).setScale(0.8).setInteractive();
    var ldmTxt = this.add.bitmapText(ldmX + ldmTextOffset, ldmY, "bigFont", "Low Detail Mode", 25).setOrigin(0, 0.5);
    this._helplayer.add([ldmCheck, ldmTxt]);

    this._makeBouncyButton(ldmCheck, 0.8, () => {
        var current = window.enableLDM;
        window.enableLDM = !current;
        var newTexture = window.enableLDM ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png";
        ldmCheck.setTexture("GJ_GameSheet03", newTexture);
        if (this._saveSettings) {
            this._saveSettings();
        }
    });

    const reqbtnX = _0x2a115c + 655;
    const reqbtnY = 495;
    const reqbtnW = 80;
    const reqbtnH = 55;
    const reqbtnborder = (this.textures.get("GJ_button04")?.source[0].width || 40) * 0.3;
    const reqbtn = this.add.nineslice(reqbtnX, reqbtnY, "GJ_button04", null, reqbtnW, reqbtnH, reqbtnborder, reqbtnborder, reqbtnborder, reqbtnborder).setInteractive().setOrigin(0.5).setTint(0xffffff);
    const reqLbl = this.add.bitmapText(reqbtnX, reqbtnY - 2, "bigFont", "Req", 28).setOrigin(0.5, 0.5);
    this._helplayer.add([reqbtn, reqLbl]);
    this._makeCompositeBouncyButton(reqbtn, [reqbtn, reqLbl], 0.8, () => this._showReqpopup());

    const closeBtn = this.add.image(containerX - 535, 30, "GJ_GameSheet03", "GJ_arrow_03_001.png").setInteractive();
    this._helplayer.add(closeBtn);
    this._makeBouncyButton(closeBtn, 1, () => this._hideHelpPopup());
  }
    _buildsongspopup() {
    this._songpopupclose = false;
    if (this._pauseBtn) {
      this.tweens.add({
        targets: this._pauseBtn,
        alpha: 0,
        duration: 300
      });
    }

    const containerX = screenWidth / 2;
    const _0x1aa656 = 320;
    this._songsoverlay = this.add.rectangle(containerX, _0x1aa656, screenWidth, screenHeight, 0, 0).setScrollFactor(0).setDepth(200).setInteractive();
    this._songslayer = this.add.container(0, -640).setScrollFactor(0).setDepth(201);
    this._songpopupclose = false;
    this.tweens.add({
      targets: this._songsoverlay,
      alpha: 100 / 255,
      duration: 1000
    });

    const _0x59b9ab = {
      p: 0
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 1,
      duration: 500,
      ease: "Quad.Out",
      onUpdate: () => {
        this._songslayer.y = _0x59b9ab.p * 650 - 640;
      }
    });
    const _0x595215 = 712;
    const _0x950c8d = 460;
    const _0x2a115c = (screenWidth - _0x595215) / 2;

    const panelBase = this.add.rectangle(_0x2a115c + 356, 310, _0x595215, _0x950c8d, 0xac531e).setDepth(150);
    this._songslayer.add(panelBase);
    const _0x43f2e3 = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const _0x3feccc = _0x43f2e3 ? _0x950c8d / _0x43f2e3.height : 1;
    this._songslayer.add(this.add.image(_0x2a115c - 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(0, 0).setScale(1, _0x3feccc).setDepth(200));
    this._songslayer.add(this.add.image(_0x2a115c + _0x595215 + 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(1, 0).setFlipX(true).setScale(1, _0x3feccc).setDepth(200));
    const _0x33b564 = this.add.image(_0x2a115c + 356, 70, "GJ_WebSheet", "GJ_table_top_001.png").setDepth(200);
    this._songslayer.add(_0x33b564);
    this._songslayer.add(this.add.image(_0x2a115c + 356, 560, "GJ_WebSheet", "GJ_table_bottom_001.png").setDepth(200));
    const _0x3e9c79 = _0x33b564.y - 35;
    
    this._songslayer.add(this.add.bitmapText(containerX, 65, "bigFont", "Soundtrack", 55).setOrigin(0.5, 0.5).setDepth(210));
    this._songslayer.add(this.add.bitmapText(containerX, 300, "bigFont", "Nothing here yet... Sorry :(", 42).setOrigin(0.5, 0.5).setDepth(210));
    
    this._songslayer.add(this.add.image(containerX - 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1).setDepth(210));
    this._songslayer.add(this.add.image(containerX + 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1).setDepth(210));
    
    const closeBtn = this.add.image(containerX - 535, 30, "GJ_GameSheet03", "GJ_arrow_03_001.png").setInteractive().setDepth(210);
    this._songslayer.add(closeBtn);
    this._makeBouncyButton(closeBtn, 1, () => this._hideSongsPopup());
  }

  _hideSongsPopup() {
    if (this._songsoverlay) {
      this._songsoverlay.destroy();
      this._songsoverlay = null;
    }
    if (this._songslayer) {
      this._songslayer.destroy();
      this._songslayer = null;
    }
    this._songpopupclose = false;
    if (this._pauseBtn) {
      this.tweens.add({ targets: this._pauseBtn, alpha: 1, duration: 300 });
    }
  }

        _redirectRate() {
window.open("https://github.com/web-dashers/web-dashers.github.io", "_blank"); }

  _showSettingsScreen() {
    this._settingsScreenClosing = false;
    if (this._pauseBtn) {
      this.tweens.add({
        targets: this._pauseBtn,
        alpha: 0,
        duration: 300
      });
    }
    const containerX = screenWidth / 2;
    const _0x1aa656 = 320;
    this._settingsLayerOverlay = this.add.rectangle(containerX, _0x1aa656, screenWidth, screenHeight, 0, 0).setScrollFactor(0).setDepth(200).setInteractive();
    this._settingsLayerInternal = this.add.container(0, -640).setScrollFactor(0).setDepth(201);
    this._settingsScreenClosing = false;
    this.tweens.add({
      targets: this._settingsLayerOverlay,
      alpha: 180 / 255,
      duration: 400,
      ease: "Linear"
    });

    const _0x59b9ab = {
      p: 0
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 1,
      duration: 500,
      ease: "Quad.Out",
      onUpdate: () => {
        this._settingsLayerInternal.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: () => {}
    });
    const _0x595215 = 712;
    const _0x950c8d = 460;
    const _0x2a115c = (screenWidth - _0x595215) / 2;
    this._settingsLayerInternal.add(this.add.rectangle(_0x2a115c + 356, 310, _0x595215, _0x950c8d, 0, 180 / 255));
    const _0x43f2e3 = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const _0x3feccc = _0x43f2e3 ? _0x950c8d / _0x43f2e3.height : 1;
    this._settingsLayerInternal.add(this.add.image(_0x2a115c - 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(0, 0).setScale(1, _0x3feccc));
    this._settingsLayerInternal.add(this.add.image(_0x2a115c + _0x595215 + 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(1, 0).setFlipX(true).setScale(1, _0x3feccc));
    const _0x33b564 = this.add.image(_0x2a115c + 356, 70, "GJ_WebSheet", "GJ_table_top_001.png");
    this._settingsLayerInternal.add(_0x33b564);
    this._settingsLayerInternal.add(this.add.image(_0x2a115c + 356, 560, "GJ_WebSheet", "GJ_table_bottom_001.png"));
    const _0x3e9c79 = _0x33b564.y - 35;
    this._settingsLayerInternal.add(this.add.image(containerX - 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._settingsLayerInternal.add(this.add.image(containerX + 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._settingsLayerInternal.add(this.add.bitmapText(containerX, 65, "bigFont", "Settings", 55).setOrigin(0.5, 0.5));
    const _sBtnBorder = this.textures.get("GJ_button01").source[0].width * 0.3;
    const _sBtnH = 62;
    const _sBtnW2 = 310;
    const _sBtnW3 = 200;
    const _sGap = 18;
    const _sColL = containerX - _sBtnW2 / 2 - _sGap / 2;
    const _sColR = containerX + _sBtnW2 / 2 + _sGap / 2;
    const _sCol3L = containerX - _sBtnW3 - _sGap;
    const _sCol3M = containerX;
    const _sCol3R = containerX + _sBtnW3 + _sGap;
    const _sRow1Y = 155;
    const _sRow2Y = 235;
    const _sRow3Y = 312;
    const _makeSettingsBtn = (cx, cy, label, btnW, isActive, action) => {
        const grp = this.add.container(cx, cy);
        const tint = isActive ? 0xffffff : 0x666666;
        const btn9 = this.add.nineslice(0, 0, "GJ_button01", null, btnW, _sBtnH, _sBtnBorder, _sBtnBorder, _sBtnBorder, _sBtnBorder).setOrigin(0.5).setTint(tint);
        grp.add(btn9);
        const fontSize = label === "How To Play" ? 41 : 50;
        const lbl = this.add.bitmapText(0, -5, "goldFont", label, fontSize).setOrigin(0.5, 0.5);
        if (!isActive) lbl.setTint(0x666666);
        grp.add(lbl);
        if (isActive && action) {
            const hitZone = this.add.zone(0, 0, btnW, _sBtnH).setInteractive();
            grp.add(hitZone);
            const baseScale = 1;
            const pressedScale = baseScale * 1.26;
            hitZone.on("pointerdown", () => {
                hitZone._pressed = true;
                this.tweens.killTweensOf(grp, "scale");
                this.tweens.add({ targets: grp, scale: pressedScale, duration: 300, ease: "Bounce.Out" });
            });
            hitZone.on("pointerout", () => {
                if (hitZone._pressed) {
                    hitZone._pressed = false;
                    this.tweens.killTweensOf(grp, "scale");
                    this.tweens.add({ targets: grp, scale: baseScale, duration: 400, ease: "Bounce.Out" });
                }
            });
            hitZone.on("pointerup", () => {
                if (hitZone._pressed) {
                    hitZone._pressed = false;
                    this.tweens.killTweensOf(grp, "scale");
                    grp.setScale(baseScale);
                    action();
                }
            });
        }
        this._settingsLayerInternal.add(grp);
        return grp;
    };

    _makeSettingsBtn(_sColL, _sRow1Y, "Account",    _sBtnW2, false, null);
    _makeSettingsBtn(_sColR, _sRow1Y, "How To Play", _sBtnW2, true, () => { this._buildHowToPlayPopup(); });
    _makeSettingsBtn(_sColL, _sRow2Y, "Options",    _sBtnW2, true,  () => { this._buildSettingsPopup(); });
    _makeSettingsBtn(_sColR, _sRow2Y, "Graphics",   _sBtnW2, false, null);
    _makeSettingsBtn(_sCol3L, _sRow3Y, "Rate",      _sBtnW3, true, () => { this._redirectRate(); });
    _makeSettingsBtn(_sCol3M, _sRow3Y, "Songs",     _sBtnW3, true, () => { this._hideSettingsScreen(() => this.time.delayedCall(150, () => this._buildsongspopup())); });
    _makeSettingsBtn(_sCol3R, _sRow3Y, "Help",      _sBtnW3, true, () => { this._hideSettingsScreen(() => this.time.delayedCall(150, () => this._buildhelppopup())); });

    const lockIcon = this.add.image(containerX + 535, 30, "GJ_GameSheet03", "GJ_lockGray_001.png").setFlipX(false).setFlipY(false);
    lockIcon.setScale(0.9);
    lockIcon.setInteractive();
    this._expandHitArea(lockIcon, 1.5);
    this._makeBouncyButton(lockIcon, 0.9, () => { this._openVaultMenu(); });
    this._settingsLayerInternal.add(lockIcon);

    const _0x45b6e4 = 0.8;
    let _0xe44f6d = 250;
    const sliderStartY = 430;
    const _0x22b43a = 0.7;
    const _0x41925a = this.textures.getFrame("GJ_WebSheet", "slidergroove.png");
    const _0x372782 = _0x41925a ? _0x41925a.width : 420;

    const createSlider = (posY, labelText, initialVal, setter) => {
        this._settingsLayerInternal.add(this.add.bitmapText(containerX, posY - 37, "bigFont", labelText, 33).setOrigin(0.5, 0.5));
        const barMaxW = (_0x372782 - 8) * _0x22b43a * 1.3; 
        const barStartX = containerX - barMaxW / 2 + 2.8;
        const fillW = initialVal * barMaxW;
        const fillBar = this.add.tileSprite(barStartX, posY, fillW > 0 ? fillW : 1, 18, "sliderBar").setOrigin(0, 0.5);
        this._settingsLayerInternal.add(fillBar);
        this._settingsLayerInternal.add(this.add.image(containerX, posY, "GJ_WebSheet", "slidergroove.png").setScale(_0x22b43a * 1.3));
        
        const thumb = this.add.image(barStartX + fillW, posY, "GJ_WebSheet", "sliderthumb.png").setScale(_0x22b43a * 1.3).setInteractive({ draggable: true });
        this._settingsLayerInternal.add(thumb);
        thumb.on("drag", (p, dragX) => {
            thumb.x = Math.max(barStartX, Math.min(barStartX + barMaxW, dragX));
            const pct = (thumb.x - barStartX) / barMaxW;
            fillBar.width = Math.max(1, pct * barMaxW);
            setter(pct < 0.03 ? 0 : pct);
        });
    };
    
    createSlider(sliderStartY - 15, "Music", this._audio.getUserMusicVolume(), v => this._audio.setUserMusicVolume(v));
    createSlider(sliderStartY + 60, "SFX", this._sfxVolume, v => {
        this._sfxVolume = v;
        localStorage.setItem("userSfxVol", v);
    });
    const checkboxY = sliderStartY - 10;
    const checkboxX = containerX + 280;
    this._settingsLayerInternal.add(this.add.bitmapText(checkboxX, checkboxY - 42, "bigFont", "Menu", 20).setOrigin(0.5, 0.5));
    this._settingsLayerInternal.add(this.add.bitmapText(checkboxX, checkboxY - 22, "bigFont", "Music", 20).setOrigin(0.5, 0.5));

    const getMenuMusicEnabled = () => {
        const saved = localStorage.getItem("menuMusicEnabled");
        return saved === null ? true : saved === "true";
    };
    const setMenuMusicEnabled = (value) => localStorage.setItem("menuMusicEnabled", value);
    
    const getTex = () => getMenuMusicEnabled() ? "GJ_checkOn_001.png" : "GJ_checkOff_001.png";
    const check = this.add.image(checkboxX, checkboxY + 15, "GJ_GameSheet03", getTex()).setScale(0.7).setInteractive();
    this._settingsLayerInternal.add(check);
    this._makeBouncyButton(check, 0.8, () => {
        const newState = !getMenuMusicEnabled();
        setMenuMusicEnabled(newState);
        check.setTexture("GJ_GameSheet03", getTex());
        if (newState) {
            if (!this._audio.isplaying()) {
                this._audio.startMenuMusic();
            }
        } else {
            if (this._audio.isplaying()) {
                this._audio.stopMusic();
            }
        }
    });
    const _0x45fc2b = [{
      frame: "GJ_arrow_03_001.png",
      dx: -535,
      action: () => this._hideSettingsScreen()
    }];
    for (const _0x2d4335 of _0x45fc2b) {
      const _0xdde774 = this.add.image(containerX + _0x2d4335.dx, 30, "GJ_GameSheet03", _0x2d4335.frame).setInteractive();
      this._settingsLayerInternal.add(_0xdde774);
      this._makeBouncyButton(_0xdde774, 1, _0x2d4335.action);
    }
  }
  _playSettingsStarAward() {
    if (!this._settingsLayerInternal) {
      return;
    }
    const _0x4edc03 = containerX;
    const _0x5a0e9 = 200;
    const _0x453043 = this.add.image(_0x4edc03, _0x5a0e9, "GJ_WebSheet", "GJ_bigStar_001.png").setScale(3).setAlpha(0);
    this._settingsLayerInternal.add(_0x453043);
    this.tweens.add({
      targets: _0x453043,
      scale: 0.8,
      alpha: 1,
      duration: 300,
      delay: 0,
      ease: "Bounce.Out"
    });
  }
  _hideSettingsScreen(closeCallback) {
    if (!this._settingsLayerInternal || this._settingsScreenClosing) {
      return;
    }
    this._settingsScreenClosing = true;
    const _0x272eb1 = () => {
      this._settingsScreenClosing = false;
      if (this._settingsLayerOverlay) {
        this._settingsLayerOverlay.destroy();
        this._settingsLayerOverlay = null;
      }
      if (this._settingsLayerInternal) {
        this._settingsLayerInternal.destroy();
        this._settingsLayerInternal = null;
      }

      if (this._pauseBtn) {
        this.tweens.add({
          targets: this._pauseBtn,
          alpha: 1,
          duration: 300
        });
      }

      if (typeof closeCallback === "function") {
        closeCallback();
      }
    };
    this.tweens.add({
      targets: this._settingsLayerOverlay,
      alpha: 0,
      duration: 250,
      ease: "Linear"
    });

    const _0x59b9ab = {
      p: 1
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 0,
      duration: 450,
      ease: "Quad.In",
      onUpdate: () => {
        this._settingsLayerInternal.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: _0x272eb1
    });
  }
  _hideHelpPopup() {
    if (!this._helplayer || this._helpclose) {
      return;
    }
    this._helpclose = true;
    const _0x272eb1 = () => {
      this._helpclose = false;
      if (this._helpoverlay) {
        this._helpoverlay.destroy();
        this._helpoverlay = null;
      }
      if (this._helplayer) {
        this._helplayer.destroy();
        this._helplayer = null;
      }

      if (this._pauseBtn) {
        this.tweens.add({
          targets: this._pauseBtn,
          alpha: 1,
          duration: 300
        });
      }
    };
    this.tweens.add({
      targets: this._helpoverlay,
      alpha: 0,
      duration: 250,
      ease: "Linear"
    });

    const _0x59b9ab = {
      p: 1
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 0,
      duration: 450,
      ease: "Quad.In",
      onUpdate: () => {
        this._helplayer.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: _0x272eb1
    });
  }

  _hideSongsPopup() {
    if (!this._songslayer || this._songpopupclose) {
      return;
    }
    this._songpopupclose = true;
    const _0x272eb1 = () => {
      this._songpopupclose = false;
      if (this._songScrollCleanup) {
        this._songScrollCleanup();
        this._songScrollCleanup = null;
      }
      if (this._songsoverlay) {
        this._songsoverlay.destroy();
        this._songsoverlay = null;
      }
      if (this._songslayer) {
        this._songslayer.destroy();
        this._songslayer = null;
      }

      if (this._pauseBtn) {
        this.tweens.add({
          targets: this._pauseBtn,
          alpha: 1,
          duration: 300
        });
      }
    };
    this.tweens.add({
      targets: this._songsoverlay,
      alpha: 0,
      duration: 250,
      ease: "Linear"
    });

    const _0x59b9ab = {
      p: 1
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 0,
      duration: 450,
      ease: "Quad.In",
      onUpdate: () => {
        this._songslayer.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: _0x272eb1
    });
  }
  _showStatsScreen() {
    if (this._pauseBtn) {
      this.tweens.add({
        targets: this._pauseBtn,
        alpha: 0,
        duration: 300
      });
    }
    const containerX = screenWidth / 2;
    const _0x1aa656 = 320;
    this._statsLayerOverlay = this.add.rectangle(containerX, _0x1aa656, screenWidth, screenHeight, 0, 0).setScrollFactor(0).setDepth(200).setInteractive();
    this._statsLayerInternal = this.add.container(0, -640).setScrollFactor(0).setDepth(201);
    this.tweens.add({
      targets: this._statsLayerOverlay,
      alpha: 100 / 255,
      duration: 1000
    });
    const _0x59b9ab = {
      p: 0
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 1,
      duration: 500,
      ease: "Quad.Out",
      onUpdate: () => {
        this._statsLayerInternal.y = _0x59b9ab.p * 650 - 640;
      }
    });
    const _0x595215 = 712;
    const _0x950c8d = 460;
    const _0x2a115c = (screenWidth - _0x595215) / 2;
    this._statsLayerInternal.add(this.add.rectangle(_0x2a115c + 356, 310, _0x595215, _0x950c8d, 0xac531e));
    const _0x43f2e3 = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const _0x3feccc = _0x43f2e3 ? _0x950c8d / _0x43f2e3.height : 1;
    this._statsLayerInternal.add(this.add.image(_0x2a115c - 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(0, 0).setScale(1, _0x3feccc));
    this._statsLayerInternal.add(this.add.image(_0x2a115c + _0x595215 + 40, 80, "GJ_WebSheet", "GJ_table_side_001.png").setOrigin(1, 0).setFlipX(true).setScale(1, _0x3feccc));
    const _0x33b564 = this.add.image(_0x2a115c + 356, 70, "GJ_WebSheet", "GJ_table_top_001.png");
    this._statsLayerInternal.add(_0x33b564);
    this._statsLayerInternal.add(this.add.image(_0x2a115c + 356, 560, "GJ_WebSheet", "GJ_table_bottom_001.png"));
    const _0x3e9c79 = _0x33b564.y - 35;
    this._statsLayerInternal.add(this.add.image(containerX - 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._statsLayerInternal.add(this.add.image(containerX + 312, _0x3e9c79, "GJ_WebSheet", "chain_01_001.png").setOrigin(0.5, 1));
    this._statsLayerInternal.add(this.add.bitmapText(containerX, 65, "bigFont", "Stats", 55).setOrigin(0.5, 0.5));
    const _rowPanelTop = 102;
    const _rowPanelBottom = 528;
    const _rowLeft = _0x2a115c + 7.8;
    const _rowRight = _0x2a115c + _0x595215 - 7.8;
    const _rowWidth = _rowRight - _rowLeft;
    const _rowCount = 7;
    const _rowH = (_rowPanelBottom - _rowPanelTop) / _rowCount;

    const rows = [
      { label: "Total Jumps:",         value: String(this._totalJumps || 0) },
      { label: "Total Attempts:",       value: String(this._attempts || 1) },
      { label: "Completed Levels:",     value: String(window._completedLevels || 0) },
      { label: "Total Deaths:",      value: String(this._totalDeaths || 0) },
      { label: "Total Secret Coins:",   value: String(window._totalsecretcoins || 0) },
      { label: "Total User Coins:",   value: String(window._totalusercoins || 0) },
      { label: "???:", value: String(window._totalOrbs || '?') },
      
    ];
    rows.forEach((row, index) => {
      const rowCenterY = _rowPanelTop + index * _rowH + _rowH / 2;
      const bgColor = index % 2 === 0 ? 0xac531e : 0xcf6d30;
      this._statsLayerInternal.add(
        this.add.rectangle(containerX, rowCenterY, _rowWidth, _rowH, bgColor).setOrigin(0.5, 0.5)
      );
      if (index > 0) {
        this._statsLayerInternal.add(
          this.add.rectangle(containerX, _rowPanelTop + index * _rowH, _rowWidth, 0.5, 0x000000).setOrigin(0.5, 0.5)
        );
      }
      this._statsLayerInternal.add(
        this.add.bitmapText(_rowLeft + 20, rowCenterY, "goldFont", row.label, 34).setOrigin(0, 0.5)
      );
      this._statsLayerInternal.add(
        this.add.bitmapText(_rowRight - 20, rowCenterY, "goldFont", row.value, 34).setOrigin(1, 0.5)
      );
    });
    const _0x45fc2b = [{
      frame: "GJ_arrow_03_001.png",
      dx: -535,
      action: () => this._hideStatsScreen()
    }];
    for (const _0x2d4335 of _0x45fc2b) {
      const _0xdde774 = this.add.image(containerX + _0x2d4335.dx, 30, "GJ_GameSheet03", _0x2d4335.frame).setInteractive();
      this._statsLayerInternal.add(_0xdde774);
      this._makeBouncyButton(_0xdde774, 1, _0x2d4335.action);
    }
  }
  _hideStatsScreen() {
    if (!this._statsLayerInternal) {
      return;
    }
    const _0x272eb1 = () => {
      if (this._statsLayerOverlay) {
        this._statsLayerOverlay.destroy();
        this._statsLayerOverlay = null;
      }
      if (this._statsLayerInternal) {
        this._statsLayerInternal.destroy();
        this._statsLayerInternal = null;
      }
      if (this._pauseBtn) {
        this.tweens.add({
          targets: this._pauseBtn,
          alpha: 1,
          duration: 300
        });
      }
    };
    this.tweens.add({
      targets: this._statsLayerOverlay,
      alpha: 0,
      duration: 500,
      ease: "Linear"
    });
    const _0x59b9ab = {
      p: 1
    };
    this.tweens.add({
      targets: _0x59b9ab,
      p: 0,
      duration: 500,
      ease: "Quad.In",
      onUpdate: () => {
        this._statsLayerInternal.y = _0x59b9ab.p * 650 - 640;
      },
      onComplete: _0x272eb1
    });
  }
  _playStarAward() {
    if (!this._endLayerInternal) {
      return;
    }
    const _0x4edc03 = this._endStarX;
    const _0x5a0e9 = this._endStarY;
    const _0x453043 = this.add.image(_0x4edc03, _0x5a0e9, "GJ_WebSheet", "GJ_bigStar_001.png").setScale(3).setAlpha(0);
    this._endLayerInternal.add(_0x453043);
    this.tweens.add({
      targets: _0x453043,
      scale: 0.8,
      alpha: 1,
      duration: 300,
      delay: 0,
      ease: "Bounce.Out"
    });
    this.time.delayedCall(125, () => {
      this._audio.playEffect("gold02");
      const _0x1204d3 = _0x4edc03;
      const _0x96e3b2 = _0x5a0e9 + this._endLayerInternal.y;
      this.add.particles(_0x1204d3, _0x96e3b2, "GJ_WebSheet", {
        frame: "square.png",
        speed: {
          min: 200,
          max: 600
        },
        angle: {
          min: 0,
          max: 360
        },
        scale: {
          start: 0.5,
          end: 0
        },
        alpha: {
          start: 1,
          end: 0
        },
        lifespan: {
          min: 200,
          max: 600
        },
        quantity: 30,
        stopAfter: 30,
        blendMode: S,
        tint: 16776960
      }).setScrollFactor(0).setDepth(202);
      const _0x43203f = this.add.graphics().setScrollFactor(0).setDepth(202).setBlendMode(S);
      const _0x403316 = {
        t: 0
      };
      this.tweens.add({
        targets: _0x403316,
        t: 1,
        duration: 400,
        ease: "Quad.Out",
        onUpdate: () => {
          _0x43203f.clear();
          _0x43203f.fillStyle(16776960, 1 - _0x403316.t);
          _0x43203f.fillCircle(_0x1204d3, _0x96e3b2, 20 + _0x403316.t * 200);
        },
        onComplete: () => _0x43203f.destroy()
      });
    });
  }
  _playsecretcoinanimation() {
    if (!this._endLayerInternal || !this._endsecretcoinPositions || this._practicedMode.practiceMode) return;
    this._endcoinAwardTimer = [];
    const collectedSlot = new Set();
    if (this._level?._editorEndSecretCoinSlots) {
      for (const slot of this._level._editorEndSecretCoinSlots) collectedSlot.add(slot);
    }
    for (const sprite of this._level?._coinSprites || []) {
      if (!sprite || sprite._secretCoinSlot === undefined) continue;
      if (this._level._secretCoinRunCollected?.has(String(sprite._secretCoinId))) {
        collectedSlot.add(sprite._secretCoinSlot);
      }
    }

    [...collectedSlot].sort((a, b) => a - b).forEach((slot, index) => {
      const position = this._endsecretcoinPositions[slot];
      if (!position) return;
      const cointimer = this.time.delayedCall(index * 375, () => {
        if (!this._endLayerInternal || !this._endLayerInternal.active) return;
        const coin = this.add.image(position.x, position.y, "GJ_GameSheet03", "secretCoinUI_001.png")
          .setOrigin(0.5)
          .setScale(3)
          .setAlpha(0);
        this._endLayerInternal.add(coin);
        this._audio.playEffect("highscoreGet02");
        this.tweens.add({
          targets: coin,
          scale: 1.1,
          alpha: 1,
          duration: 300,
          ease: "Bounce.Out"
        });
        const effecttimer = this.time.delayedCall(100, () => {
          if (!this._endLayerInternal || !this._endLayerInternal.active) return;
          const effectY = position.y + this._endLayerInternal.y;
          this.add.particles(position.x, effectY, "GJ_WebSheet", {
            frame: "square.png",
            speed: { min: 200, max: 600 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.35, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 200, max: 600 },
            quantity: 30,
            stopAfter: 30,
            blendMode: S,
            tint: 0xd0d0d0
          }).setScrollFactor(0).setDepth(202);

          const glow = this.add.graphics().setScrollFactor(0).setDepth(202).setBlendMode(S);
          const glowState = { progress: 0 };
          this.tweens.add({
            targets: glowState,
            progress: 1,
            duration: 400,
            ease: "Quad.Out",
            onUpdate: () => {
              glow.clear();
              glow.fillStyle(0xd0d0d0, 1 - glowState.progress);
              glow.fillCircle(position.x, effectY, 12 + glowState.progress * 130);
            },
            onComplete: () => glow.destroy()
          });
        });
        this._endcoinAwardTimer.push(effecttimer);
      });
      this._endcoinAwardTimer.push(cointimer);
    });
  }
  _playusercoinanimation() {
    if (!this._endLayerInternal || !this._endusercoinPosition) return;
    this._endcoinAwardTimer = [];
    const collectedSlot = new Set();
    if (this._level?._editorEndUserCoinSlots) {
      for (const slot of this._level._editorEndUserCoinSlots) collectedSlot.add(slot);
    }
    for (const sprite of this._level?._coinSprites || []) {
      if (sprite?._userCoinSlot === undefined) continue;
      if (this._level._userCoinRunCollected?.has(String(sprite._userCoinId))) {
        collectedSlot.add(sprite._userCoinSlot);
      }
    }

    [...collectedSlot].sort((a, b) => a - b).forEach((slot, index) => {
      const position = this._endusercoinPosition[slot];
      if (!position) return;
      const cointimer = this.time.delayedCall(index * 375, () => {
        if (!this._endLayerInternal || !this._endLayerInternal.active) return;
        const coin = this.add.image(position.x, position.y, "GJ_GameSheet03", "secretCoinUI2_001.png")
          .setOrigin(0.5).setScale(3).setAlpha(0);
        this._endLayerInternal.add(coin);
        this._audio.playEffect("highscoreGet02");
        this.tweens.add({ targets: coin, scale: 1.1, alpha: 1, duration: 300, ease: "Bounce.Out" });
        const effecttimer = this.time.delayedCall(100, () => {
          if (!this._endLayerInternal || !this._endLayerInternal.active) return;
          const effectY = position.y + this._endLayerInternal.y;
          this.add.particles(position.x, effectY, "GJ_WebSheet", {
            frame: "square.png",
            speed: { min: 200, max: 600 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.35, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 200, max: 600 },
            quantity: 30,
            stopAfter: 30,
            blendMode: S,
            tint: 0xd0d0d0
          }).setScrollFactor(0).setDepth(202);
          const glow = this.add.graphics().setScrollFactor(0).setDepth(202).setBlendMode(S);
          const glowState = { progress: 0 };
          this.tweens.add({
            targets: glowState,
            progress: 1,
            duration: 400,
            ease: "Quad.Out",
            onUpdate: () => {
              glow.clear();
              glow.fillStyle(0xd0d0d0, 1 - glowState.progress);
              glow.fillCircle(position.x, effectY, 12 + glowState.progress * 130);
            },
            onComplete: () => glow.destroy()
          });
          this._endcoinAwardTimer.push(effecttimer);
        });
        this._endcoinAwardTimer.push(cointimer);
      });
    });
  }
  _openListScene(title, rowHeight, onBack) {
    const sw = screenWidth;
    const sh = screenHeight;
    const objects = [];
    const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(300);
    fadeIn.fillStyle(0x000000, 1);
    fadeIn.fillRect(0, 0, sw, sh);
    this.tweens.add({ targets: fadeIn, alpha: 0, duration: 280, ease: "Linear",
      onComplete: () => fadeIn.destroy() });

    const bgGfx = this.add.graphics().setScrollFactor(0).setDepth(200);
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = 0;
      const g = Math.round(0x66 * (1 - t) + 0x33 * t);
      const b = Math.round(0xff * (1 - t) + 0x99 * t);
      bgGfx.fillStyle((r << 16) | (g << 8) | b, 1);
      bgGfx.fillRect(0, Math.floor(i * sh / steps), sw, Math.ceil(sh / steps) + 1);
    }
    objects.push(bgGfx);
    const blocker = this.add.zone(sw / 2, sh / 2, sw, sh)
      .setScrollFactor(0).setDepth(200).setInteractive();
    objects.push(blocker);
    const cBL = this.add.image(0, sh, "GJ_GameSheet03", "GJ_sideArt_001.png")
      .setScrollFactor(0).setDepth(201).setOrigin(0, 1).setFlipY(false);
    const cBR = this.add.image(sw, sh, "GJ_GameSheet03", "GJ_sideArt_001.png")
      .setScrollFactor(0).setDepth(201).setOrigin(1, 1).setFlipX(true);
    objects.push(cBL, cBR);
    const panelW  = 712;  
    const panelH  = 460;  
    const panelCX = sw / 2;
    const panelCY = sh / 2;
    const panelBg = this.add.rectangle(panelCX, panelCY + 10, panelW, panelH, 0xC2723E)
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);
    objects.push(panelBg);
    const listLeft = panelCX - panelW / 2;
    const listTop  = panelCY - panelH / 2 + 10;
    const stripesGfx = this.add.graphics().setScrollFactor(0).setDepth(202);
    objects.push(stripesGfx);
    let _rowCount = 0;
    const _redrawStripes = (offsetY = 0) => {
      stripesGfx.clear();
      for (let ri = 0; ri < _rowCount; ri++) {
        const ry = (listTop + 12) + ri * rowHeight - offsetY;
        const ryBottom = ry + rowHeight;
        if (ryBottom <= (listTop + 12) || ry >= listTop + panelH) continue;
        const clampedY = Math.max(ry, listTop + 12);
        const clampedH = Math.min(ryBottom, listTop + panelH) - clampedY;
        stripesGfx.fillStyle(ri % 2 === 0 ? 0xB5652E : 0xC2723E, 1);
        stripesGfx.fillRect(listLeft, clampedY, panelW, clampedH);
      }
      if (_rowCount > 0) {
        const topDividerY = (listTop + 12) - offsetY;
        if (topDividerY >= listTop + 12 && topDividerY < listTop + panelH) {
          stripesGfx.fillStyle(0x000000, 0.6);
          stripesGfx.fillRect(listLeft + 5, topDividerY, panelW - 10, 1.5);
        }
        const lastRowY = (listTop + 12) + (_rowCount - 1) * rowHeight - offsetY;
        const bottomDividerY = lastRowY + rowHeight;
        if (bottomDividerY > listTop + 12 && bottomDividerY <= listTop + panelH) {
          stripesGfx.fillStyle(0x000000, 0.6);
          stripesGfx.fillRect(listLeft + 5, bottomDividerY, panelW - 10, 1.5);
        }
      }
    };

    const addRow = () => { _rowCount++; _redrawStripes(); };
    const clearRows = () => { _rowCount = 0; _redrawStripes(); };
    const sideFrame = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const sideScaleY = sideFrame ? panelH / sideFrame.height : 1;
    const leftBorder = this.add.image(listLeft - 40, 90,
      "GJ_WebSheet", "GJ_table_side_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(0, 0).setScale(1, sideScaleY);
    objects.push(leftBorder);
    const rightBorder = this.add.image(listLeft + panelW + 40, 90,
      "GJ_WebSheet", "GJ_table_side_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(1, 0).setFlipX(true).setScale(1, sideScaleY);
    objects.push(rightBorder);
    const topBorder = this.add.image(panelCX, 80,
      "GJ_WebSheet", "GJ_table_top_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    objects.push(topBorder);
    const bottomBorder = this.add.image(panelCX, 570,
      "GJ_WebSheet", "GJ_table_bottom_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    objects.push(bottomBorder);

    if (title) {
      const titleTxt = this.add.bitmapText(panelCX, panelCY - 245, "bigFont", title, 52)
        .setScrollFactor(0).setDepth(204).setOrigin(0.5, 0.5);
      objects.push(titleTxt);
    }
    const pageLbl = this.add.bitmapText(sw - 8, 3, "goldFont", "", 22)
      .setScrollFactor(0).setDepth(204).setOrigin(1, 0).setVisible(false);
    objects.push(pageLbl);
    const backBtn = this.add.image(45, 45, "GJ_GameSheet03", "GJ_arrow_01_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive();
    objects.push(backBtn);
    const closeOverlay = (returnToParent = true, onComplete = null) => {
      const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(400).setAlpha(0);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, sw, sh);
      this.tweens.add({ targets: fadeOut, alpha: 1, duration: 160, ease: "Linear",
        onComplete: () => {
          for (const o of objects) if (o && o.destroy) o.destroy();
          if (returnToParent && onBack) onBack();
          if (onComplete) onComplete();
          this.tweens.add({ targets: fadeOut, alpha: 0, duration: 160, ease: "Linear",
            onComplete: () => fadeOut.destroy() });
        }
      });
    };
    this._makeBouncyButton(backBtn, 1, () => closeOverlay());
    const prevBtn = this.add.image(40, sh / 2, "GJ_GameSheet03", "GJ_arrow_03_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive().setVisible(false);
    objects.push(prevBtn);
    this._makeBouncyButton(prevBtn, 1, () => {});
    const nextBtn = this.add.image(sw - 40, sh / 2, "GJ_GameSheet03", "GJ_arrow_03_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive().setFlipX(true).setVisible(false);
    objects.push(nextBtn);
    this._makeBouncyButton(nextBtn, 1, () => {});

    return { overlay: bgGfx, objects, listLeft, listTop, panelW, panelH,
             panelCX, panelCY, addRow, clearRows, prevBtn, nextBtn,
             pageLbl, closeOverlay, redrawStripes: _redrawStripes };
  }

  _fitBitmapText(textObj, maxWidth, minScale = 0.3) {
    textObj.setScale(1);
    if (textObj.width > maxWidth) {
      textObj.setScale(Math.max(minScale, maxWidth / textObj.width));
    }
    return textObj;
  }

  _formatStatCount(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(n);
    if (n < 1000000) {
      const v = n / 1000;
      return (v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))) + "K";
    }
    const v = n / 1000000;
    return (v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))) + "M";
  }

  _getLevelLengthLabel(lengthIdx) {
    const _lengthValues = ["Tiny", "Short", "Medium", "Long", "XL"];
    if (lengthIdx === 5) {
      return "Plat.";
    }
    return _lengthValues[lengthIdx] || "Tiny";
  }

  _openOnlineLevelsScene(params = {}) {
    if (this._onlineLevelsOverlay) return;

    const sw = screenWidth;
    const sh = screenHeight;
    const isFeatured = (params.type === 6);
    const shell = this._openListScene(
      isFeatured ? "" : "Online Levels",
      180,
      () => {
        this._onlineLevelsOverlay = null;
        if (isFeatured) {
          this._openCreatorMenu();
        } else {
          this._openSearchMenu();
        }
      }
    );
    const { objects, listLeft, listTop, panelW, panelH,
            panelCX, panelCY, addRow, clearRows,
            prevBtn, nextBtn, pageLbl, closeOverlay, redrawStripes } = shell;

    this._onlineLevelsOverlay = shell.overlay;
    const searchRequest = new AbortController();
    objects.push({ destroy: () => searchRequest.abort() });
    this._closeOnlineLevelsOverlay = closeOverlay;
    if (isFeatured) {
      const header = this.add.image(sw / 2, sh / 2 - 265,
        "GJ_GameSheet03", "featuredLabel_001.png")
        .setScrollFactor(0).setDepth(204).setOrigin(0.5);
      objects.push(header);
    }
    {
      const pageBtnGroup = this.add.container(sw - 35, sh / 2 - 240);
      const pageBtn = this.add.image(0, 0, "GJ_button02").setScale(0.7);
      const pageNum = this.add.bitmapText(-2, 0, "bigFont", "1", 35).setOrigin(0.5);
      pageBtnGroup.add(pageBtn);
      pageBtnGroup.add(pageNum);
      const _pageBtnFrame = this.textures.getFrame("GJ_button02");
      const _pageBtnW = (_pageBtnFrame ? _pageBtnFrame.realWidth : 100) * 0.7;
      const _pageBtnH = (_pageBtnFrame ? _pageBtnFrame.realHeight : 100) * 0.7;
      pageBtnGroup.setScrollFactor(0).setDepth(205).setInteractive(
        new Phaser.Geom.Rectangle(-_pageBtnW / 2, -_pageBtnH / 2, _pageBtnW, _pageBtnH),
        Phaser.Geom.Rectangle.Contains
      );
      objects.push(pageBtnGroup);
      this._makeBouncyButton(pageBtnGroup, 1, () => {
        if (!_loading) {
          const pageCount = isFeatured ? 10 : _knownMaxPages;
          const nextPage = (currentPage + 1) % Math.max(1, pageCount);
          _setPage(nextPage);
        }
      }, () => true);
      const updatePageNum = (page) => {
        pageNum.setText(String(page + 1));
      };
      this._featuredPageUpdate = updatePageNum;
    }
    const spinSprite = this.add.image(sw / 2, sh / 2, "loadingCircle")
      .setScrollFactor(0).setDepth(205).setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    objects.push(spinSprite);
    const spinTimer = this.time.addEvent({ 
      delay: 16, 
      loop: true, 
      callback: () => {
        if (!spinSprite.scene) { spinTimer.remove(); return; }
        spinSprite.rotation += 0.1;
      }
    });
    objects.push({ destroy: () => spinTimer.remove() });
    const infoBtn = this.add.image(60, sh - 60,
      "GJ_GameSheet03", "GJ_infoIcon_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive();
    objects.push(infoBtn);
    this._makeBouncyButton(infoBtn, 1, () => { this._buildFeaturedInfoPopup(); });

    const refreshBtn = this.add.image(sw - 55, sh - 55,
      "GJ_GameSheet03", "GJ_updateBtn_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive();
    objects.push(refreshBtn);
    let currentPage = 0;
    let _knownMaxPages = 1;
    const cache = {};
    const _processedCache = {};
    let activeCellObjs = [];
    let _loading = false;
    let scrollOffsetY = 0;
    let _lastLevelStrs = null;
    let _lastLevelData = [];
    const _panelBoundaryTop = listTop + 12;
    const _panelBoundaryBottom = listTop + panelH - 22;
    const _panelMaskShape = this.add.graphics().setScrollFactor(0);
    _panelMaskShape.fillStyle(0xffffff);
    _panelMaskShape.fillRect(listLeft, _panelBoundaryTop, panelW, _panelBoundaryBottom - _panelBoundaryTop);
    const _panelMask = _panelMaskShape.createGeometryMask();
    objects.push(_panelMaskShape);

    const _diffFrames = [
      "difficulty_00_btn_001.png",
      "difficulty_01_btn_001.png",
      "difficulty_02_btn_001.png",
      "difficulty_03_btn_001.png",
      "difficulty_04_btn_001.png",
      "difficulty_05_btn_001.png",
      "difficulty_06_btn_001.png",
      "difficulty_07_btn_001.png",
      "difficulty_08_btn_001.png",
      "difficulty_09_btn_001.png",
      "difficulty_10_btn_001.png",
      "difficulty_auto_btn_001.png"
    ];
    const _diffSizes = {
      "difficulty_00_btn_001.png": { w: 60, h: 85, rotated: false },
      "difficulty_01_btn_001.png": { w: 60, h: 85, rotated: false },
      "difficulty_02_btn_001.png": { w: 86, h: 85, rotated: false },
      "difficulty_03_btn_001.png": { w: 60, h: 84, rotated: false },
      "difficulty_04_btn_001.png": { w: 85, h: 84, rotated: false },
      "difficulty_05_btn_001.png": { w: 76, h: 85, rotated: false },
      "difficulty_06_btn_001.png": { w: 72, h: 88, rotated: false },
      "difficulty_07_btn_001.png": { w: 72, h: 85, rotated: false },
      "difficulty_08_btn_001.png": { w: 72, h: 85, rotated: false },
      "difficulty_09_btn_001.png": { w: 74, h: 88, rotated: false },
      "difficulty_10_btn_001.png": { w: 80, h: 91, rotated: false },
      "difficulty_auto_btn_001.png": { w: 60, h: 85, rotated: false },
    };
    const _officialGDSongs = [
      "Stereo Madness","Back On Track","Polargeist","Dry Out","Base After Base",
      "Can't Let Go","Jumper","Time Machine","Cycles","xStep","Clutterfunk",
      "Theory of Everything","Electroman Adventures","Clubstep","Electrodynamix",
      "Hexagon Force","Blast Processing","Theory of Everything 2",
      "Geometrical Dominator","Deadlocked","Fingerdash","Dash"
    ];

    const _buildLevelCell = (levelData, rowIdx) => {
      const rowH = 180;
      const rowY = _panelBoundaryTop + rowIdx * rowH - scrollOffsetY;
      const rowCenterY = rowY + rowH / 2;
      const cellObjs = [];
      const rx = listLeft;
      const boundaryTop = _panelBoundaryTop;
      const boundaryBottom = _panelBoundaryBottom;
      if (rowIdx > 0 && rowY >= boundaryTop && rowY <= boundaryBottom) {
        const div = this.add.rectangle(rx + panelW / 2, rowY, panelW - 10, 1.5, 0x000000, 0.6)
          .setScrollFactor(0).setDepth(203).setOrigin(0.5, 0.5);
        div.setMask(_panelMask);
        cellObjs.push(div);
      }
      const diffIdx = Math.min(_diffFrames.length - 1, Math.max(0, levelData.difficulty || 0));
      const _diffMeta = _diffSizes[_diffFrames[diffIdx]];
      const _targetH  = 85;
      const _maxW     = 90;
      const _scaleW   = _diffMeta ? _diffMeta.w : 90;
      const _scaleH   = _diffMeta ? _diffMeta.h : 85;
      const _scale    = Math.min(_targetH / _scaleH, _maxW / _scaleW);
      const _diffIconExtraScale = { 6: 1.04, 9: 1.04, 10: 1.1 }[diffIdx] || 1;
      const diffIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", _diffFrames[diffIdx])
        .setScrollFactor(0).setDepth(204).setOrigin(0.5).setAlpha(1)
        .setDisplaySize(_scaleW * _scale * _diffIconExtraScale, _scaleH * _scale * _diffIconExtraScale);
      if (_diffMeta && _diffMeta.rotated) diffIcon.setAngle(90).setFlipY(true);
      diffIcon.setMask(_panelMask);
      cellObjs.push(diffIcon);
      let coinIcon = null;
      if (levelData.epic >= 3) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin3_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      } else if (levelData.epic === 2) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin2_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      } else if (levelData.epic === 1) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      } else if (levelData.featured) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_featuredCoin_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      }
      if (coinIcon) {
        coinIcon.setMask(_panelMask);
        cellObjs.push(coinIcon);
      }
      const nameX = rx + 105;
      const btnX = rx + panelW - 88;
      const _progressKeyId = "online_" + (levelData.id || "0");
      const _bestPercent = parseFloat(localStorage.getItem("bestPercent_" + _progressKeyId) || "0");
      const _hasBest = _bestPercent > 0;
      const _isComplete = _bestPercent >= 100;
      const _bestReserve = _isComplete ? 44 : (_hasBest ? 70 : 0);
      const _maxTextWidth = (btnX - 70 - 15) - nameX - _bestReserve;
      const nameText = this.add.bitmapText(nameX, rowCenterY - 60, "bigFont", levelData.name || "Unknown", 45)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
      this._fitBitmapText(nameText, _maxTextWidth);
      nameText.setMask(_panelMask);
      cellObjs.push(nameText);
      if (_isComplete) {
        const completeIcon = this.add.image(nameX + 5 + nameText.displayWidth + 14, rowCenterY - 60, "GJ_GameSheet03", "GJ_completesIcon_001.png")
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setScale(0.75);
        completeIcon.setMask(_panelMask);
        cellObjs.push(completeIcon);
      } else if (_hasBest) {
        const bestPctText = this.add.bitmapText(nameX + 5 + nameText.displayWidth + 14, rowCenterY - 60, "goldFont", Math.floor(_bestPercent) + "%", 28)
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5)
        bestPctText.setMask(_panelMask);
        cellObjs.push(bestPctText);
      }
      const authorText = this.add.bitmapText(nameX, rowCenterY - 15, "goldFont", "By " + (levelData.author || "Unknown"), 32)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
      this._fitBitmapText(authorText, _maxTextWidth);
      authorText.setMask(_panelMask);
      cellObjs.push(authorText);
      const _isOfficialSong = _officialGDSongs.includes(levelData.songName);
      const songText = this.add.bitmapText(nameX, rowCenterY + 28, "bigFont", levelData.songName || "", 28)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setTint(_isOfficialSong ? 0x00d6ff : 0xff79ff);
      this._fitBitmapText(songText, _maxTextWidth);
      songText.setMask(_panelMask);
      cellObjs.push(songText);
      const _statY = rowCenterY + 63;
      const _statGap = 25;
      const _statDefs = [
        { icon: "GJ_timeIcon_001.png",      value: this._getLevelLengthLabel(levelData.length), scale: 0.6 },
        { icon: "GJ_downloadsIcon_001.png", value: this._formatStatCount(levelData.downloads), scale: 0.6 },
        { icon: "GJ_sLikeIcon_001.png",     value: this._formatStatCount(levelData.likes), scale: 0.9 }
      ];
      let _statX = nameX;
      _statDefs.forEach((stat) => {
        const statIcon = this.add.image(_statX, _statY, "GJ_GameSheet03", stat.icon)
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setScale(stat.scale);
        statIcon.setMask(_panelMask);
        cellObjs.push(statIcon);
        const statText = this.add.bitmapText(_statX + statIcon.displayWidth + 8, _statY, "bigFont", stat.value, 26)
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
        this._fitBitmapText(statText, _maxTextWidth / 2);
        statText.setMask(_panelMask);
        cellObjs.push(statText);
        _statX += statIcon.displayWidth + 8 + statText.displayWidth + _statGap;
      });
      const _hasViewedLevel = !!localStorage.getItem("viewedLevel_" + (levelData.id || "0"));
      const _rowBtnFrame = _hasViewedLevel ? "GJ_button01" : "GJ_button02";
      const _rowBtnLabel = _hasViewedLevel ? "View" : "Get It";
      const _rowBtnLabelSize = _hasViewedLevel ? 40 : 30;
      const btn9 = this.add.nineslice(btnX, rowCenterY, _rowBtnFrame, null, 140, 60, 20, 20, 20, 20)
        .setScrollFactor(0).setDepth(206).setOrigin(0.5).setInteractive();
      btn9.setMask(_panelMask);
      const btnLbl = this.add.bitmapText(btnX - 2, rowCenterY - 4, "bigFont", _rowBtnLabel, _rowBtnLabelSize)
        .setScrollFactor(0).setDepth(207).setOrigin(0.5);
      btnLbl.setMask(_panelMask);
      cellObjs.push(btn9, btnLbl);

      const _btnTargets = [btn9, btnLbl];
      const _baseScale = 1, _pressScale = 1.26;
      btn9.on("pointerdown", () => {
        btn9._pressed = true;
        this.tweens.killTweensOf(_btnTargets, "scale");
        this.tweens.add({ targets: _btnTargets, scale: _pressScale, duration: 300, ease: "Bounce.Out" });
      });
      btn9.on("pointerout", () => {
        if (btn9._pressed) {
          btn9._pressed = false;
          this.tweens.killTweensOf(_btnTargets, "scale");
          this.tweens.add({ targets: _btnTargets, scale: _baseScale, duration: 400, ease: "Bounce.Out" });
        }
      });
      btn9.on("pointerup", () => {
        if (!btn9._pressed) return;
        btn9._pressed = false;
        this.tweens.killTweensOf(_btnTargets);
        btn9.setScale(_baseScale);
        btnLbl.setScale(_baseScale);
        window._selectedLevelData = levelData;
        closeOverlay(false, () => {
          this._onlineLevelsOverlay = null;
          this._closeOnlineLevelsOverlay = null;
          this._openPlayMenu(() => this._openOnlineLevelsScene(params));
        });
      });

      return cellObjs;
    };
    const _parseKV = (str) => {
      const m = {}, p = str.split(":");
      for (let i = 0; i + 1 < p.length; i += 2) m[p[i]] = p[i + 1];
      return m;
    };
    let _listMessage = null;
    const _setPage = async (page) => {
      if (_loading) return;
      _loading = true;
      currentPage = page;
      for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
      activeCellObjs = [];
      clearRows();
      if (this._featuredPageUpdate) {
        this._featuredPageUpdate(page);
      }

      spinSprite.setVisible(true);
      refreshBtn.setVisible(false);
      pageLbl.setVisible(false);
      _listMessage?.setVisible(false);
      this.tweens.killTweensOf(prevBtn, "scale");
      prevBtn.setScale(1);
      prevBtn._pressed = false;
      prevBtn.setVisible(false);
      this.tweens.killTweensOf(nextBtn, "scale");
      nextBtn.setScale(1);
      nextBtn._pressed = false;
      nextBtn.setVisible(false);

      // Results are kept for a few minutes across visits: every page shown
      // again would otherwise spend the proxies' daily request quota.
      const _storeKey = "gdSearch:" + JSON.stringify(params) + ":" + page;
      try {
        let response = cache[page];
        if (!response) {
          try {
            const saved = JSON.parse(sessionStorage.getItem(_storeKey) || "null");
            if (saved && Date.now() - saved.t < 5 * 60 * 1000 && saved.r) response = cache[page] = saved.r;
          } catch (_e) {}
        }
        if (!response) {
          const body = Object.entries({ secret: "Wmfd2893gb7", page, ...params })
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
          const res = await window.fetchGdApi('/getGJLevels21.php', { method: 'POST', body, signal: searchRequest.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          response = await res.text();
          if (searchRequest.signal.aborted || this._onlineLevelsOverlay !== shell.overlay) return;
          if (!response || response === "-1") throw new Error("no results");
          if (!response.includes(":") || /^error code/i.test(response)) throw new Error("bad response");
          cache[page] = response;
          try { sessionStorage.setItem(_storeKey, JSON.stringify({ t: Date.now(), r: response })); } catch (_e) {}
        }
        spinSprite.setVisible(false);
        refreshBtn.setVisible(true);
        pageLbl.setVisible(true);
        prevBtn.setVisible(page > 0);
        nextBtn.setVisible(true);
        const sections   = response.split("#");
        const levelStrs  = (sections[0] || "").split("|").filter(Boolean);
        const playerStrs = (sections[1] || "").split("|").filter(Boolean);
        const songStrs   = (sections[2] || "").split("~:~").filter(Boolean);
        const pageInfo   = (sections[3] || "0:0:10").split(":");

        const playerMap = {};
        for (const ps of playerStrs) {
          const p = ps.split(":");
          if (p.length >= 2) playerMap[p[0]] = p[1];
        }
        const songMap = {};
        for (const ss of songStrs) {
          const sp = ss.split("~|~"), sm = {};
          for (let i = 0; i + 1 < sp.length; i += 2) sm[sp[i]] = sp[i + 1];
          if (sm["1"]) songMap[sm["1"]] = sm["2"] || "";
        }
        const total  = parseInt(pageInfo[0]) || 0;
        const offset = parseInt(pageInfo[1]) || 0;
        const count  = parseInt(pageInfo[2]) || 10;
        const start  = offset + 1;
        const end    = count * (page + 1);
        pageLbl.setText(`${start} to ${end} of ${total}`);
        const maxPages = Math.ceil(total / count);
        _knownMaxPages = Math.max(1, maxPages);
        const hasNextPage = (page + 1) < maxPages;
        nextBtn.setVisible(hasNextPage);
        scrollOffsetY = 0;
        // wip
        _lastLevelStrs = levelStrs;
        if (_processedCache[page]) {
          _lastLevelData = _processedCache[page];
          _lastLevelData.forEach((levelData, idx) => {
            const cellObjs = _buildLevelCell(levelData, idx);
            activeCellObjs.push(...cellObjs);
            addRow();
          });
          spinSprite.setVisible(false);
          refreshBtn.setVisible(true);
          pageLbl.setVisible(true);
          prevBtn.setVisible(page > 0);
          nextBtn.setVisible(hasNextPage);
          _loading = false;
          return;
        }
        _lastLevelData = levelStrs.map((ls) => {
          const m = _parseKV(ls);
          const rawLikes = parseInt(m["14"]) || 0;
          const isDemon   = parseInt(m["17"]) === 1;
          const isAuto    = parseInt(m["25"]) === 1;
          let diffIdx = 0;
          if (isAuto) {
            diffIdx = 11;
          } else if (isDemon) {
            const d9 = parseInt(m["9"]);
            const d43 = parseInt(m["43"]);
            if (!isNaN(d9) && d9 >= 1 && d9 <= 5) {
              diffIdx = [7, 8, 6, 9, 10][d9 - 1] ?? 8;
            } else if (!isNaN(d43)) {
              const demonMap43 = { 3: 7, 4: 8, 0: 6, 5: 9, 6: 10 };
              diffIdx = demonMap43.hasOwnProperty(d43) ? demonMap43[d43] : 8;
            } else {
              diffIdx = 8;
            }
          } else {
            diffIdx = Math.min(5, Math.max(0, Math.round((parseInt(m["9"]) || 0) / 10)));
          }
          return {
            id:            m["1"]  || null,
            name:          m["2"]  || "Unknown",
            author:        playerMap[m["6"]] || ("Player " + (m["6"] || "?")),
            difficulty:    diffIdx,
            downloads:     parseInt(m["10"]) || 0,
            length:        parseInt(m["15"]) || 0,
            likes:         rawLikes,
            stars:         parseInt(m["18"]) || 0,
            coins:         parseInt(m["37"]) || 0,
            coinsVerified: m["38"] === "1",
            customSongID:  (m["35"] && m["35"] !== "0") ? m["35"] : null,
            songName:      m["35"]
              ? (songMap[m["35"]] || ("Song #" + m["35"]))
              : (_officialGDSongs[Number(m["12"] || 0)] || ("Song #" + (m["12"] || "0"))),
            featureScore:  parseInt(m["19"]) || 0,
            featured:      (parseInt(m["19"]) || 0) > 0,
            epic:          parseInt(m["42"]) || 0
          };
        });
        _processedCache[page] = _lastLevelData;
        _lastLevelData.forEach((levelData, idx) => {
          const cellObjs = _buildLevelCell(levelData, idx);
          activeCellObjs.push(...cellObjs);
          addRow();
        });

      } catch (err) {
        if (searchRequest.signal.aborted || this._onlineLevelsOverlay !== shell.overlay) return;
        spinSprite.setVisible(false);
        refreshBtn.setVisible(true);
        const noResults = String(err?.message || "") === "no results";
        if (!_listMessage) {
          _listMessage = this.add.bitmapText(sw / 2, sh / 2, "bigFont", "", 32)
            .setScrollFactor(0).setDepth(206).setOrigin(0.5).setCenterAlign();
          objects.push(_listMessage);
        }
        _listMessage.setText(noResults ? "Nothing found!" : ["Something went wrong.", "Try again later."]).setVisible(true);
      }
      _loading = false;
    };
    prevBtn.removeAllListeners("pointerup");
    nextBtn.removeAllListeners("pointerup");
    prevBtn.on("pointerup", () => { if (!_loading && currentPage > 0) _setPage(currentPage - 1); });
    nextBtn.on("pointerup", () => { if (!_loading) _setPage(currentPage + 1); });
    this._makeBouncyButton(refreshBtn, 1, () => {
      delete cache[currentPage]; delete _processedCache[currentPage];
      try { sessionStorage.removeItem('gdSearch:' + JSON.stringify(params) + ':' + currentPage); } catch (_) {}
      _setPage(currentPage);
    });
    const _onWheel = (pointer, gameObjects, deltaX, deltaY) => {
      if (pointer.x < listLeft || pointer.x > listLeft + panelW) return;
      if (pointer.y < listTop  || pointer.y > listTop + panelH) return;
      const maxScroll = Math.max(0, (_lastLevelStrs ? _lastLevelStrs.length : 0) * 180 - (panelH - 33));
      const newScrollOffset = Math.max(0, Math.min(scrollOffsetY + deltaY * 0.5, maxScroll));
      if (newScrollOffset !== scrollOffsetY) {
        scrollOffsetY = newScrollOffset;
        for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
        activeCellObjs = [];
        if (_lastLevelData) _lastLevelData.forEach((levelData, idx) => {
          const cellObjs = _buildLevelCell(levelData, idx);
          activeCellObjs.push(...cellObjs);
        });
        
        redrawStripes(scrollOffsetY);
      }
    };    this.input.on("wheel", _onWheel);
    objects.push({ destroy: () => this.input.off("wheel", _onWheel) });
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollOffset = 0;
    let dragThreshold = 5;
    let bounceBackTween = null;
    const onDragStart = (pointer) => {
      if (pointer.x < listLeft || pointer.x > listLeft + panelW) return;
      if (pointer.y < listTop  || pointer.y > listTop + panelH) return;
      if (bounceBackTween) {
        bounceBackTween.destroy();
        bounceBackTween = null;
      }
      isDragging = true;
      dragStartY = pointer.y;
      dragStartScrollOffset = scrollOffsetY;
    };
    const onDragMove = (pointer) => {
      if (!isDragging || !pointer.isDown) return;
      if (pointer.x < listLeft || pointer.x > listLeft + panelW) return;
      if (pointer.y < listTop  || pointer.y > listTop + panelH) return;
      const deltaY = dragStartY - pointer.y;
      if (Math.abs(deltaY) < dragThreshold) return;
      const maxScroll = Math.max(0, (_lastLevelStrs ? _lastLevelStrs.length : 0) * 180 - (panelH - 33));
      let newScrollOffset = dragStartScrollOffset + deltaY * 0.5;
      const elasticLimit = 100;
      if (newScrollOffset < -elasticLimit) {
        newScrollOffset = -elasticLimit;
      } else if (newScrollOffset > maxScroll + elasticLimit) {
        newScrollOffset = maxScroll + elasticLimit;
      }    
      if (newScrollOffset !== scrollOffsetY) {
        scrollOffsetY = newScrollOffset;
        for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
        activeCellObjs = [];
        if (_lastLevelData) _lastLevelData.forEach((levelData, idx) => {
          const cellObjs = _buildLevelCell(levelData, idx);
          activeCellObjs.push(...cellObjs);
        });
        redrawStripes(scrollOffsetY);
      }
    };

    const onDragEnd = () => {
      isDragging = false;
      const maxScroll = Math.max(0, (_lastLevelStrs ? _lastLevelStrs.length : 0) * 180 - (panelH - 33));
      let targetScrollOffset = scrollOffsetY;
      if (scrollOffsetY < 0) {
        targetScrollOffset = 0;
      } else if (scrollOffsetY > maxScroll) {
        targetScrollOffset = maxScroll;
      }
      if (targetScrollOffset !== scrollOffsetY) {
        const startOffset = scrollOffsetY;
        bounceBackTween = this.tweens.add({
          targets: { scrollOffset: startOffset },
          scrollOffset: targetScrollOffset,
          duration: 300,
          ease: "Quad.Out",
          onStart: () => {
            isDragging = false;
          },
          onUpdate: () => {
            scrollOffsetY = bounceBackTween.targets[0].scrollOffset;
            for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
            activeCellObjs = [];
            if (_lastLevelData) _lastLevelData.forEach((levelData, idx) => {
              const cellObjs = _buildLevelCell(levelData, idx);
              activeCellObjs.push(...cellObjs);
            });
            
            redrawStripes(scrollOffsetY);
          },
          onComplete: () => {
            bounceBackTween = null;
          }
        });
      }
    };

    this.input.on('pointerdown', onDragStart);
    this.input.on('pointermove', onDragMove);
    this.input.on('pointerup', onDragEnd);
    
    objects.push({ destroy: () => this.input.off('pointerdown', onDragStart) });
    objects.push({ destroy: () => this.input.off('pointermove', onDragMove) });
    objects.push({ destroy: () => this.input.off('pointerup', onDragEnd) });
    objects.push({ destroy: () => {
      for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
      activeCellObjs = [];
    }});

    _setPage(0);
  }

  _openSavedLevelsScene() {
    const sw = screenWidth;
    const sh = screenHeight;

    const objects = [];
    const rowHeight = 180;

    const fadeIn = this.add.graphics().setScrollFactor(0).setDepth(300);
    fadeIn.fillStyle(0x000000, 1);
    fadeIn.fillRect(0, 0, sw, sh);
    this.tweens.add({ targets: fadeIn, alpha: 0, duration: 280, ease: "Linear",
      onComplete: () => fadeIn.destroy() });

    const bgGfx = this.add.graphics().setScrollFactor(0).setDepth(200);
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = 0;
      const g = Math.round(0x66 * (1 - t) + 0x33 * t);
      const b = Math.round(0xff * (1 - t) + 0x99 * t);
      bgGfx.fillStyle((r << 16) | (g << 8) | b, 1);
      bgGfx.fillRect(0, Math.floor(i * sh / steps), sw, Math.ceil(sh / steps) + 1);
    }
    objects.push(bgGfx);

    const blocker = this.add.zone(sw / 2, sh / 2, sw, sh)
      .setScrollFactor(0).setDepth(200).setInteractive();
    objects.push(blocker);

    const cBL = this.add.image(0, sh, "GJ_GameSheet03", "GJ_sideArt_001.png")
      .setScrollFactor(0).setDepth(201).setOrigin(0, 1).setFlipY(false);
    const cBR = this.add.image(sw, sh, "GJ_GameSheet03", "GJ_sideArt_001.png")
      .setScrollFactor(0).setDepth(201).setOrigin(1, 1).setFlipX(true);
    objects.push(cBL, cBR);

    const panelW  = 712;
    const panelH  = 460;
    const panelCX = sw / 2;
    const panelCY = sh / 2;
    const panelBg = this.add.rectangle(panelCX, panelCY + 10, panelW, panelH, 0xC2723E)
      .setScrollFactor(0).setDepth(201).setOrigin(0.5);
    objects.push(panelBg);

    const listLeft = panelCX - panelW / 2;
    const listTop  = panelCY - panelH / 2 + 10;

    const stripesGfx = this.add.graphics().setScrollFactor(0).setDepth(202);
    objects.push(stripesGfx);
    let _rowCount = 0;
    const redrawStripes = (offsetY = 0) => {
      stripesGfx.clear();
      for (let ri = 0; ri < _rowCount; ri++) {
        const ry = (listTop + 12) + ri * rowHeight - offsetY;
        const ryBottom = ry + rowHeight;
        if (ryBottom <= (listTop + 12) || ry >= listTop + panelH) continue;
        const clampedY = Math.max(ry, listTop + 12);
        const clampedH = Math.min(ryBottom, listTop + panelH) - clampedY;
        stripesGfx.fillStyle(ri % 2 === 0 ? 0xB5652E : 0xC2723E, 1);
        stripesGfx.fillRect(listLeft, clampedY, panelW, clampedH);
      }
      if (_rowCount > 0) {
        const topDividerY = (listTop + 12) - offsetY;
        if (topDividerY >= listTop + 12 && topDividerY < listTop + panelH) {
          stripesGfx.fillStyle(0x000000, 0.6);
          stripesGfx.fillRect(listLeft + 5, topDividerY, panelW - 10, 1.5);
        }
        const lastRowY = (listTop + 12) + (_rowCount - 1) * rowHeight - offsetY;
        const bottomDividerY = lastRowY + rowHeight;
        if (bottomDividerY > listTop + 12 && bottomDividerY <= listTop + panelH) {
          stripesGfx.fillStyle(0x000000, 0.6);
          stripesGfx.fillRect(listLeft + 5, bottomDividerY, panelW - 10, 1.5);
        }
      }
    };
    const addRow   = () => { _rowCount++; redrawStripes(); };
    const clearRows = () => { _rowCount = 0; redrawStripes(); };

    const sideFrame = this.textures.getFrame("GJ_WebSheet", "GJ_table_side_001.png");
    const sideScaleY = sideFrame ? panelH / sideFrame.height : 1;
    const leftBorder = this.add.image(listLeft - 40, 90,
      "GJ_WebSheet", "GJ_table_side_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(0, 0).setScale(1, sideScaleY);
    objects.push(leftBorder);
    const rightBorder = this.add.image(listLeft + panelW + 40, 90,
      "GJ_WebSheet", "GJ_table_side_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(1, 0).setFlipX(true).setScale(1, sideScaleY);
    objects.push(rightBorder);
    const topBorder = this.add.image(panelCX, 80,
      "GJ_WebSheet", "GJ_table_top_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    objects.push(topBorder);
    const bottomBorder = this.add.image(panelCX, 570,
      "GJ_WebSheet", "GJ_table_bottom_001.png")
      .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    objects.push(bottomBorder);

    const pageLbl = this.add.bitmapText(sw - 8, 3, "goldFont", "", 22)
      .setScrollFactor(0).setDepth(204).setOrigin(1, 0).setVisible(false);
    objects.push(pageLbl);

    const backBtn = this.add.image(45, 45, "GJ_GameSheet03", "GJ_arrow_01_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive();
    objects.push(backBtn);
    const closeOverlay = (returnToCreator = true, onComplete = null) => {
      const fadeOut = this.add.graphics().setScrollFactor(0).setDepth(400).setAlpha(0);
      fadeOut.fillStyle(0x000000, 1);
      fadeOut.fillRect(0, 0, sw, sh);
      this.tweens.add({ targets: fadeOut, alpha: 1, duration: 160, ease: "Linear",
        onComplete: () => {
          for (const o of objects) if (o && o.destroy) o.destroy();
          if (returnToCreator) this._openCreatorMenu();
          if (onComplete) onComplete();
          this.tweens.add({ targets: fadeOut, alpha: 0, duration: 160, ease: "Linear",
            onComplete: () => fadeOut.destroy() });
        }
      });
    };
    this._makeBouncyButton(backBtn, 1, () => closeOverlay());
    const prevBtn = this.add.image(40, sh / 2, "GJ_GameSheet03", "GJ_arrow_03_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive().setVisible(false);
    objects.push(prevBtn);
    this._makeBouncyButton(prevBtn, 1, () => {});
    const nextBtn = this.add.image(sw - 40, sh / 2, "GJ_GameSheet03", "GJ_arrow_03_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive().setFlipX(true).setVisible(false);
    objects.push(nextBtn);
    this._makeBouncyButton(nextBtn, 1, () => {});
    const header = this.add.bitmapText(sw / 2, sh / 2 - 245, "bigFont", "Saved Levels", 52)
      .setScrollFactor(0).setDepth(204).setOrigin(0.5);
    objects.push(header);
    const savedPerPage = 10;
    let currentPage = 0;
    const pageBtnGroup = this.add.container(sw - 35, sh / 2 - 240);
    const pageBtn = this.add.image(0, 0, "GJ_button02").setScale(0.7);
    const pageNum = this.add.bitmapText(-2, 0, "bigFont", "1", 35).setOrigin(0.5);
    pageBtnGroup.add(pageBtn);
    pageBtnGroup.add(pageNum);
    const _pageBtnFrame = this.textures.getFrame("GJ_button02");
    const _pageBtnW = (_pageBtnFrame ? _pageBtnFrame.realWidth : 100) * 0.7;
    const _pageBtnH = (_pageBtnFrame ? _pageBtnFrame.realHeight : 100) * 0.7;
    pageBtnGroup.setScrollFactor(0).setDepth(205).setInteractive(
      new Phaser.Geom.Rectangle(-_pageBtnW / 2, -_pageBtnH / 2, _pageBtnW, _pageBtnH),
      Phaser.Geom.Rectangle.Contains
    );
    objects.push(pageBtnGroup);
    const _updateSavedPageNum = (page) => { pageNum.setText(String(page + 1)); };
    const _getSavedTotalPages = () => Math.max(1, Math.ceil(savedLevelData.length / savedPerPage));
    const infoBtn = this.add.image(60, sh - 60,
      "GJ_GameSheet03", "GJ_infoIcon_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive();
    objects.push(infoBtn);
    this._makeBouncyButton(infoBtn, 1, () => {}, () => true);

    const refreshBtn = this.add.image(sw - 55, sh - 55,
      "GJ_GameSheet03", "GJ_deleteBtn_001.png")
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setInteractive();
    objects.push(refreshBtn);
    this._makeBouncyButton(refreshBtn, 1, () => {
      try { localStorage.removeItem("gd_saved_online_levels"); } catch(_e) {}
      savedLevelData = [];
      currentPage = 0;
      scrollOffsetY = 0;
      for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
      activeCellObjs = [];
      clearRows();
      redrawStripes(scrollOffsetY);
      _updateSavedNav();
      if (_emptyTxt) {
        _emptyTxt.setVisible(true);
      } else {
        _emptyTxt = this.add.bitmapText(panelCX, panelCY + 10, "bigFont", "You have not downloaded any\n    levels yet!", 32)
          .setScrollFactor(0).setDepth(204).setOrigin(0.5);
        objects.push(_emptyTxt);
      }
    }, () => true);

    const _panelBoundaryTop    = listTop + 12;
    const _panelBoundaryBottom = listTop + panelH - 22;
    const _panelMaskShape = this.add.graphics().setScrollFactor(0);
    _panelMaskShape.fillStyle(0xffffff);
    _panelMaskShape.fillRect(listLeft, _panelBoundaryTop, panelW, _panelBoundaryBottom - _panelBoundaryTop);
    const _panelMask = _panelMaskShape.createGeometryMask();
    objects.push(_panelMaskShape);
    let scrollOffsetY   = 0;
    let activeCellObjs  = []; 
    let savedLevelData  = [];
    let _emptyTxt       = null;
    const diffFrames = [
      "difficulty_00_btn_001.png",
      "difficulty_01_btn_001.png",
      "difficulty_02_btn_001.png",
      "difficulty_03_btn_001.png",
      "difficulty_04_btn_001.png",
      "difficulty_05_btn_001.png",
      "difficulty_06_btn_001.png",
      "difficulty_07_btn_001.png",
      "difficulty_08_btn_001.png",
      "difficulty_09_btn_001.png",
      "difficulty_10_btn_001.png",
      "difficulty_auto_btn_001.png"
    ];
    const _buildSavedCell = (levelData, rowIdx) => {
      const rowH         = 180;
      const rowCenterY   = _panelBoundaryTop + rowIdx * rowH + rowH / 2 - scrollOffsetY;
      const cellObjs     = [];
      const rx           = listLeft;
      if (rowCenterY + rowH / 2 < _panelBoundaryTop || rowCenterY - rowH / 2 > _panelBoundaryBottom) {
        return cellObjs;
      }
      if (rowIdx > 0) {
        const divY = _panelBoundaryTop + rowIdx * rowH - scrollOffsetY;
        if (divY >= _panelBoundaryTop && divY <= _panelBoundaryBottom) {
          const div = this.add.rectangle(rx + panelW / 2, divY, panelW - 10, 1.5, 0x000000, 0.6)
            .setScrollFactor(0).setDepth(203).setOrigin(0.5, 0.5);
          div.setMask(_panelMask);
          cellObjs.push(div);
        }
      }
      const diffIdx  = Math.min(diffFrames.length - 1, Math.max(0, levelData.difficulty || 0));
      const _diffSizes = {
        "difficulty_00_btn_001.png": { w: 60, h: 85, rotated: false },
        "difficulty_01_btn_001.png": { w: 60, h: 85, rotated: false },
        "difficulty_02_btn_001.png": { w: 86, h: 85, rotated: false },
        "difficulty_03_btn_001.png": { w: 60, h: 84, rotated: false },
        "difficulty_04_btn_001.png": { w: 85, h: 84, rotated: false },
        "difficulty_05_btn_001.png": { w: 76, h: 85, rotated: false },
        "difficulty_06_btn_001.png": { w: 72, h: 90, rotated: false },
        "difficulty_07_btn_001.png": { w: 72, h: 85, rotated: false },
        "difficulty_08_btn_001.png": { w: 72, h: 85, rotated: false },
        "difficulty_09_btn_001.png": { w: 74, h: 90, rotated: false },
        "difficulty_10_btn_001.png": { w: 80, h: 95, rotated: false },
        "difficulty_auto_btn_001.png": { w: 60, h: 85, rotated: false },
      };
      const _diffMeta = _diffSizes[diffFrames[diffIdx]];
      const _targetH  = 85;
      const _maxW     = 90;
      const _scaleW   = _diffMeta ? _diffMeta.w : 90;
      const _scaleH   = _diffMeta ? _diffMeta.h : 85;
      const _scale    = Math.min(_targetH / _scaleH, _maxW / _scaleW);
      const _diffIconExtraScale = { 6: 1.04, 9: 1.04, 10: 1.1 }[diffIdx] || 1;
      const diffIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", diffFrames[diffIdx])
        .setScrollFactor(0).setDepth(204).setOrigin(0.5).setAlpha(1)
        .setDisplaySize(_scaleW * _scale * _diffIconExtraScale, _scaleH * _scale * _diffIconExtraScale);
      if (_diffMeta && _diffMeta.rotated) diffIcon.setAngle(90).setFlipY(true);
      diffIcon.setMask(_panelMask);
      cellObjs.push(diffIcon);
      let coinIcon = null;
      if (levelData.epic >= 3) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin3_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      } else if (levelData.epic === 2) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin2_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      } else if (levelData.epic === 1) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      } else if (levelData.featured) {
        coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_featuredCoin_001.png")
          .setScrollFactor(0).setDepth(203).setOrigin(0.5);
      }
      if (coinIcon) {
        coinIcon.setMask(_panelMask);
        cellObjs.push(coinIcon);
      }
      const nameX = rx + 105;
      const btnX = rx + panelW - 88;
      const _progressKeyId = "online_" + (levelData.id || "0");
      const _bestPercent = parseFloat(localStorage.getItem("bestPercent_" + _progressKeyId) || "0");
      const _hasBest = _bestPercent > 0;
      const _isComplete = _bestPercent >= 100;
      const _bestReserve = _isComplete ? 44 : (_hasBest ? 70 : 0);
      const _maxTextWidth = (btnX - 70 - 15) - nameX - _bestReserve;
      const nameText = this.add.bitmapText(nameX, rowCenterY - 60, "bigFont", levelData.name || "Unknown", 45)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
      this._fitBitmapText(nameText, _maxTextWidth);
      nameText.setMask(_panelMask);
      cellObjs.push(nameText);
      if (_isComplete) {
        const completeIcon = this.add.image(nameX + 5 + nameText.displayWidth + 14, rowCenterY - 60, "GJ_GameSheet03", "GJ_completesIcon_001.png")
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setScale(0.75);
        completeIcon.setMask(_panelMask);
        cellObjs.push(completeIcon);
      } else if (_hasBest) {
        const bestPctText = this.add.bitmapText(nameX + 5+ nameText.displayWidth + 14, rowCenterY - 60, "goldFont", Math.floor(_bestPercent) + "%", 28)
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
        bestPctText.setMask(_panelMask);
        cellObjs.push(bestPctText);
      }
      const authorText = this.add.bitmapText(nameX, rowCenterY - 15, "goldFont", "By " + (levelData.author || "Unknown"), 32)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
      this._fitBitmapText(authorText, _maxTextWidth);
      authorText.setMask(_panelMask);
      cellObjs.push(authorText);
      const _officialGDSongs = [
        "Stereo Madness","Back On Track","Polargeist","Dry Out","Base After Base",
        "Can't Let Go","Jumper","Time Machine","Cycles","xStep","Clutterfunk",
        "Theory of Everything","Electroman Adventures","Clubstep","Electrodynamix",
        "Hexagon Force","Blast Processing","Theory of Everything 2",
        "Geometrical Dominator","Deadlocked","Fingerdash","Dash"
      ];
      const _isOfficialSong = _officialGDSongs.includes(levelData.songName);
      const songText = this.add.bitmapText(nameX, rowCenterY + 28, "bigFont", levelData.songName || "", 28)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setTint(_isOfficialSong ? 0x00d6ff : 0xff79ff);
      this._fitBitmapText(songText, _maxTextWidth);
      songText.setMask(_panelMask);
      cellObjs.push(songText);
      const _statY = rowCenterY + 63;
      const _statGap = 25;
      const _statDefs = [
        { icon: "GJ_timeIcon_001.png",      value: this._getLevelLengthLabel(levelData.length), scale: 0.6 },
        { icon: "GJ_downloadsIcon_001.png", value: this._formatStatCount(levelData.downloads), scale: 0.6 },
        { icon: "GJ_sLikeIcon_001.png",     value: this._formatStatCount(levelData.likes), scale: 0.9 }
      ];
      let _statX = nameX;
      _statDefs.forEach((stat) => {
        const statIcon = this.add.image(_statX, _statY, "GJ_GameSheet03", stat.icon)
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setScale(stat.scale);
        statIcon.setMask(_panelMask);
        cellObjs.push(statIcon);
        const statText = this.add.bitmapText(_statX + statIcon.displayWidth + 8, _statY, "bigFont", stat.value, 26)
          .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
        this._fitBitmapText(statText, _maxTextWidth / 2);
        statText.setMask(_panelMask);
        cellObjs.push(statText);
        _statX += statIcon.displayWidth + 8 + statText.displayWidth + _statGap;
      });
      const btn9 = this.add.nineslice(btnX, rowCenterY, "GJ_button01", null, 140, 60, 20, 20, 20, 20)
        .setScrollFactor(0).setDepth(206).setOrigin(0.5).setInteractive();
      btn9.setMask(_panelMask);
      const btnLbl = this.add.bitmapText(btnX - 2, rowCenterY - 4, "bigFont", "View", 40)
        .setScrollFactor(0).setDepth(207).setOrigin(0.5);
      btnLbl.setMask(_panelMask);
      cellObjs.push(btn9, btnLbl);

      const _btnTargets = [btn9, btnLbl];
      const _baseScale = 1, _pressScale = 1.26;
      btn9.on("pointerdown", () => {
        btn9._pressed = true;
        this.tweens.killTweensOf(_btnTargets, "scale");
        this.tweens.add({ targets: _btnTargets, scale: _pressScale, duration: 300, ease: "Bounce.Out" });
      });
      btn9.on("pointerout", () => {
        if (btn9._pressed) {
          btn9._pressed = false;
          this.tweens.killTweensOf(_btnTargets, "scale");
          this.tweens.add({ targets: _btnTargets, scale: _baseScale, duration: 400, ease: "Bounce.Out" });
        }
      });
      btn9.on("pointerup", () => {
        if (!btn9._pressed) return;
        btn9._pressed = false;
        this.tweens.killTweensOf(_btnTargets);
        btn9.setScale(_baseScale);
        btnLbl.setScale(_baseScale);
        window._selectedLevelData = levelData;
        closeOverlay(false, () => {
          this._openPlayMenu(() => this._openSavedLevelsScene());
        });
      });

      return cellObjs;
    };

    const _rebuildCells = () => {
      for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
      activeCellObjs = [];
      clearRows();
      const totalPages = _getSavedTotalPages();
      if (currentPage >= totalPages) currentPage = 0;
      _updateSavedNav();
      const pageData = savedLevelData.slice(currentPage * savedPerPage, currentPage * savedPerPage + savedPerPage);
      pageData.forEach((levelData, idx) => {
        const cellObjs = _buildSavedCell(levelData, idx);
        activeCellObjs.push(...cellObjs);
        addRow();
      });
    };
    const _updateSavedNav = () => {
      const totalPages = _getSavedTotalPages();
      const hasData = savedLevelData.length > 0;
      pageBtnGroup.setVisible(hasData);
      _updateSavedPageNum(currentPage);
      const start = hasData ? currentPage * savedPerPage + 1 : 0;
      const end   = hasData ? Math.min(savedLevelData.length, (currentPage + 1) * savedPerPage) : 0;
      pageLbl.setText(`${start} to ${end} of ${savedLevelData.length}`);
      pageLbl.setVisible(hasData);
      prevBtn.setVisible(hasData && currentPage > 0);
      nextBtn.setVisible(hasData && currentPage < totalPages - 1);
    };

    const _goToSavedPage = (page) => {
      const totalPages = _getSavedTotalPages();
      currentPage = Math.max(0, Math.min(page, totalPages - 1));
      scrollOffsetY = 0;
      _rebuildCells();
      redrawStripes(scrollOffsetY);
    };

    this._makeBouncyButton(pageBtnGroup, 1, () => {
      const totalPages = _getSavedTotalPages();
      _goToSavedPage((currentPage + 1) % totalPages);
    }, () => true);

    prevBtn.removeAllListeners("pointerup");
    nextBtn.removeAllListeners("pointerup");
    prevBtn.on("pointerup", () => { if (currentPage > 0) _goToSavedPage(currentPage - 1); });
    nextBtn.on("pointerup", () => {
      const totalPages = _getSavedTotalPages();
      if (currentPage < totalPages - 1) _goToSavedPage(currentPage + 1);
    });
    try {
      savedLevelData = JSON.parse(localStorage.getItem("gd_saved_online_levels") || "[]");
      let _neededNormalize = false;
      savedLevelData.forEach(ld => {
        if (typeof ld.id === "string" && ld.id.startsWith("online_")) {
          ld.id = ld.id.replace(/^online_/, "");
          _neededNormalize = true;
        }
      });
      if (_neededNormalize) {
        try { localStorage.setItem("gd_saved_online_levels", JSON.stringify(savedLevelData)); } catch(_e) {}
      }
    } catch(_e) { savedLevelData = []; }

    if (savedLevelData.length === 0) {
      const emptyTxt = this.add.bitmapText(panelCX, panelCY + 10, "bigFont", "You have not downloaded any\n           levels yet!", 38)
        .setScrollFactor(0).setDepth(204).setOrigin(0.5);
      objects.push(emptyTxt);
      _emptyTxt = emptyTxt;
      _updateSavedNav();
    } else {
      const _needsFetch = savedLevelData.filter(ld => {
        const numericId = String(ld.id || "").replace(/^online_/, "");
        return /^\d+$/.test(numericId) && (!ld.author || ld.author === "Unknown" || !ld.songName || ld.songName === "Unknown" || ld.difficulty === 0 || ld.difficulty == null);
      });

      const _doRender = () => {
        _rebuildCells();
      };

      if (_needsFetch.length === 0) {
        _doRender();
      } else {
        Promise.all(_needsFetch.map(levelData => {
          const numericId = String(levelData.id || "").replace(/^online_/, "");
          return fetch(`https://gdbrowser.com/api/level/${numericId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data) {
                if (data.author)   levelData.author   = data.author;
                if (data.songName) levelData.songName = data.songName;
                if (!levelData.customSongID && data.songID) levelData.customSongID = String(data.songID);
                const _diffMap = {
                  "N/A": 0, "Auto": 11, "Easy": 1, "Normal": 2,
                  "Hard": 3, "Harder": 4, "Insane": 5,
                  "Easy Demon": 7, "Medium Demon": 8, "Hard Demon": 6,
                  "Insane Demon": 9, "Extreme Demon": 10
                };
                if (data.difficulty && _diffMap.hasOwnProperty(data.difficulty)) {
                  levelData.difficulty = _diffMap[data.difficulty];
                }
              }
            })
            .catch(() => {});
        })).then(() => {
          try {
            const _savedKey = "gd_saved_online_levels";
            const all = JSON.parse(localStorage.getItem(_savedKey) || "[]");
            for (const ld of savedLevelData) {
              const idx = all.findIndex(sl => sl.id === ld.id);
              if (idx !== -1) {
                all[idx].author       = ld.author;
                all[idx].songName     = ld.songName;
                all[idx].difficulty   = ld.difficulty;
                all[idx].customSongID = ld.customSongID;
              }
            }
            localStorage.setItem(_savedKey, JSON.stringify(all));
          } catch(_e) {}
          _doRender();
        });
      }

      objects.push({ destroy: () => {
        for (const o of activeCellObjs) if (o && o.destroy) o.destroy();
        activeCellObjs = [];
      }});
      const _getSavedPageCount = () => Math.min(savedPerPage, savedLevelData.length - currentPage * savedPerPage);
      const _onWheel = (pointer, gameObjects, deltaX, deltaY) => {
        if (pointer.x < listLeft || pointer.x > listLeft + panelW) return;
        if (pointer.y < listTop  || pointer.y > listTop + panelH) return;
        const maxScroll = Math.max(0, _getSavedPageCount() * 180 - (panelH - 33));
        const newOffset = Math.max(0, Math.min(scrollOffsetY + deltaY * 0.5, maxScroll));
        if (newOffset !== scrollOffsetY) {
          scrollOffsetY = newOffset;
          _rebuildCells();
          redrawStripes(scrollOffsetY);
        }
      };
      this.input.on("wheel", _onWheel);
      objects.push({ destroy: () => this.input.off("wheel", _onWheel) });
      let isDragging = false, dragStartY = 0, dragStartOffset = 0;
      const onDragStart = (pointer) => {
        if (pointer.x < listLeft || pointer.x > listLeft + panelW) return;
        if (pointer.y < listTop  || pointer.y > listTop + panelH) return;
        isDragging = true; dragStartY = pointer.y; dragStartOffset = scrollOffsetY;
      };
      const onDragMove = (pointer) => {
        if (!isDragging || !pointer.isDown) return;
        const maxScroll = Math.max(0, _getSavedPageCount() * 180 - (panelH - 33));
        const newOffset = Math.max(0, Math.min(dragStartOffset + (dragStartY - pointer.y) * 0.5, maxScroll));
        if (newOffset !== scrollOffsetY) {
          scrollOffsetY = newOffset;
          _rebuildCells();
          redrawStripes(scrollOffsetY);
        }
      };
      const onDragEnd = () => { isDragging = false; };
      this.input.on("pointerdown", onDragStart);
      this.input.on("pointermove", onDragMove);
      this.input.on("pointerup",   onDragEnd);
      objects.push({ destroy: () => this.input.off("pointerdown", onDragStart) });
      objects.push({ destroy: () => this.input.off("pointermove", onDragMove) });
      objects.push({ destroy: () => this.input.off("pointerup",   onDragEnd) });
    }
  }

  _closeOnlineLevelsScene() {
    if (this._onlineLevelsOverlay) {
      if (this._closeOnlineLevelsOverlay) {
        this._closeOnlineLevelsOverlay();
      }
      this._onlineLevelsOverlay = null;
    }
  }

  _openSearchResultScene(levelData) {
    if (this._searchResultOverlay) return;

    const sw = screenWidth;
    const sh = screenHeight;
    const shell = this._openListScene(
      "Online Levels",
      180,
      () => { this._searchResultOverlay = null; this._openSearchMenu(); }
    );
    const { objects, listLeft, listTop, panelW, panelH, addRow, closeOverlay } = shell;

    this._searchResultOverlay = shell.overlay;
    this._closeSearchResultOverlay = closeOverlay;

    const _panelBoundaryTop = listTop + 12;
    const _panelBoundaryBottom = listTop + panelH - 22;
    const _panelMaskShape = this.add.graphics().setScrollFactor(0);
    _panelMaskShape.fillStyle(0xffffff);
    _panelMaskShape.fillRect(listLeft, _panelBoundaryTop, panelW, _panelBoundaryBottom - _panelBoundaryTop);
    const _panelMask = _panelMaskShape.createGeometryMask();
    objects.push(_panelMaskShape);

    const _diffFrames = [
      "difficulty_00_btn_001.png",
      "difficulty_01_btn_001.png",
      "difficulty_02_btn_001.png",
      "difficulty_03_btn_001.png",
      "difficulty_04_btn_001.png",
      "difficulty_05_btn_001.png",
      "difficulty_06_btn_001.png",
      "difficulty_07_btn_001.png",
      "difficulty_08_btn_001.png",
      "difficulty_09_btn_001.png",
      "difficulty_10_btn_001.png",
      "difficulty_auto_btn_001.png"
    ];
    const _diffSizes = {
      "difficulty_00_btn_001.png": { w: 60, h: 85, rotated: false },
      "difficulty_01_btn_001.png": { w: 60, h: 85, rotated: false },
      "difficulty_02_btn_001.png": { w: 86, h: 85, rotated: false },
      "difficulty_03_btn_001.png": { w: 60, h: 84, rotated: false },
      "difficulty_04_btn_001.png": { w: 85, h: 84, rotated: false },
      "difficulty_05_btn_001.png": { w: 76, h: 85, rotated: false },
      "difficulty_06_btn_001.png": { w: 72, h: 88, rotated: false },
      "difficulty_07_btn_001.png": { w: 72, h: 85, rotated: false },
      "difficulty_08_btn_001.png": { w: 72, h: 85, rotated: false },
      "difficulty_09_btn_001.png": { w: 74, h: 88, rotated: false },
      "difficulty_10_btn_001.png": { w: 80, h: 91, rotated: false },
      "difficulty_auto_btn_001.png": { w: 60, h: 85, rotated: false },
    };
    const _officialGDSongs = [
      "Stereo Madness","Back On Track","Polargeist","Dry Out","Base After Base",
      "Can't Let Go","Jumper","Time Machine","Cycles","xStep","Clutterfunk",
      "Theory of Everything","Electroman Adventures","Clubstep","Electrodynamix",
      "Hexagon Force","Blast Processing","Theory of Everything 2",
      "Geometrical Dominator","Deadlocked","Fingerdash","Dash"
    ];

    const rowH = 180;
    const rowY = _panelBoundaryTop;
    const rowCenterY = rowY + rowH / 2;
    const rx = listLeft;

    const diffIdx = Math.min(_diffFrames.length - 1, Math.max(0, levelData.difficulty || 0));
    const _diffMeta = _diffSizes[_diffFrames[diffIdx]];
    const _targetH  = 85;
    const _maxW     = 90;
    const _scaleW   = _diffMeta ? _diffMeta.w : 90;
    const _scaleH   = _diffMeta ? _diffMeta.h : 85;
    const _scale    = Math.min(_targetH / _scaleH, _maxW / _scaleW);
    const _diffIconExtraScale = { 6: 1.04, 9: 1.04, 10: 1.1 }[diffIdx] || 1;
    const diffIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", _diffFrames[diffIdx])
      .setScrollFactor(0).setDepth(204).setOrigin(0.5).setAlpha(1)
      .setDisplaySize(_scaleW * _scale * _diffIconExtraScale, _scaleH * _scale * _diffIconExtraScale);
    if (_diffMeta && _diffMeta.rotated) diffIcon.setAngle(90).setFlipY(true);
    diffIcon.setMask(_panelMask);
    objects.push(diffIcon);

    let coinIcon = null;
    if (levelData.epic >= 3) {
      coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin3_001.png")
        .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    } else if (levelData.epic === 2) {
      coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin2_001.png")
        .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    } else if (levelData.epic === 1) {
      coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_epicCoin_001.png")
        .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    } else if (levelData.featured) {
      coinIcon = this.add.image(rx + 52, rowCenterY, "GJ_GameSheet03", "GJ_featuredCoin_001.png")
        .setScrollFactor(0).setDepth(203).setOrigin(0.5);
    }
    if (coinIcon) {
      coinIcon.setMask(_panelMask);
      objects.push(coinIcon);
    }

    const nameX = rx + 105;
    const btnX = rx + panelW - 88;
    const _progressKeyId = "online_" + (levelData.id || "0");
    const _bestPercent = parseFloat(localStorage.getItem("bestPercent_" + _progressKeyId) || "0");
    const _hasBest = _bestPercent > 0;
    const _isComplete = _bestPercent >= 100;
    const _bestReserve = _isComplete ? 44 : (_hasBest ? 70 : 0);
    const _maxTextWidth = (btnX - 70 - 15) - nameX - _bestReserve;
    const nameText = this.add.bitmapText(nameX, rowCenterY - 60, "bigFont", levelData.name || "Unknown", 45)
      .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
    this._fitBitmapText(nameText, _maxTextWidth);
    nameText.setMask(_panelMask);
    objects.push(nameText);
    if (_isComplete) {
      const completeIcon = this.add.image(nameX + 5 + nameText.displayWidth + 14, rowCenterY - 60, "GJ_GameSheet03", "GJ_completesIcon_001.png")
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setScale(0.75);
      completeIcon.setMask(_panelMask);
      objects.push(completeIcon);
    } else if (_hasBest) {
      const bestPctText = this.add.bitmapText(nameX + 5 + nameText.displayWidth + 14, rowCenterY - 60, "goldFont", Math.floor(_bestPercent) + "%", 28)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5)
      bestPctText.setMask(_panelMask);
      objects.push(bestPctText);
    }
    const authorText = this.add.bitmapText(nameX, rowCenterY - 15, "goldFont", "By " + (levelData.author || "Unknown"), 32)
      .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
    this._fitBitmapText(authorText, _maxTextWidth);
    authorText.setMask(_panelMask);
    objects.push(authorText);
    const _isOfficialSong = _officialGDSongs.includes(levelData.songName);
    const songText = this.add.bitmapText(nameX, rowCenterY + 28, "bigFont", levelData.songName || "", 28)
      .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setTint(_isOfficialSong ? 0x00d6ff : 0xff79ff);
    this._fitBitmapText(songText, _maxTextWidth);
    songText.setMask(_panelMask);
    objects.push(songText);
    const _statY = rowCenterY + 63;
    const _statGap = 25;
    const _statDefs = [
      { icon: "GJ_timeIcon_001.png",      value: this._getLevelLengthLabel(levelData.length), scale: 0.6 },
      { icon: "GJ_downloadsIcon_001.png", value: this._formatStatCount(levelData.downloads), scale: 0.6 },
      { icon: "GJ_sLikeIcon_001.png",     value: this._formatStatCount(levelData.likes), scale: 0.9 }
    ];
    let _statX = nameX;
    _statDefs.forEach((stat) => {
      const statIcon = this.add.image(_statX, _statY, "GJ_GameSheet03", stat.icon)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5).setScale(stat.scale);
      statIcon.setMask(_panelMask);
      objects.push(statIcon);
      const statText = this.add.bitmapText(_statX + statIcon.displayWidth + 8, _statY, "bigFont", stat.value, 26)
        .setScrollFactor(0).setDepth(204).setOrigin(0, 0.5);
      this._fitBitmapText(statText, _maxTextWidth / 2);
      statText.setMask(_panelMask);
      objects.push(statText);
      _statX += statIcon.displayWidth + 8 + statText.displayWidth + _statGap;
    });

    const _hasViewedLevel = !!localStorage.getItem("viewedLevel_" + (levelData.id || "0"));
    const _rowBtnFrame = _hasViewedLevel ? "GJ_button01" : "GJ_button02";
    const _rowBtnLabel = _hasViewedLevel ? "View" : "Get It";
    const _rowBtnLabelSize = _hasViewedLevel ? 40 : 30;
    const btn9 = this.add.nineslice(btnX, rowCenterY, _rowBtnFrame, null, 140, 60, 20, 20, 20, 20)
      .setScrollFactor(0).setDepth(206).setOrigin(0.5).setInteractive();
    btn9.setMask(_panelMask);
    const btnLbl = this.add.bitmapText(btnX - 2, rowCenterY - 4, "bigFont", _rowBtnLabel, _rowBtnLabelSize)
      .setScrollFactor(0).setDepth(207).setOrigin(0.5);
    btnLbl.setMask(_panelMask);
    objects.push(btn9, btnLbl);

    const _btnTargets = [btn9, btnLbl];
    const _baseScale = 1, _pressScale = 1.26;
    btn9.on("pointerdown", () => {
      btn9._pressed = true;
      this.tweens.killTweensOf(_btnTargets, "scale");
      this.tweens.add({ targets: _btnTargets, scale: _pressScale, duration: 300, ease: "Bounce.Out" });
    });
    btn9.on("pointerout", () => {
      if (btn9._pressed) {
        btn9._pressed = false;
        this.tweens.killTweensOf(_btnTargets, "scale");
        this.tweens.add({ targets: _btnTargets, scale: _baseScale, duration: 400, ease: "Bounce.Out" });
      }
    });
    btn9.on("pointerup", () => {
      if (!btn9._pressed) return;
      btn9._pressed = false;
      this.tweens.killTweensOf(_btnTargets);
      btn9.setScale(_baseScale);
      btnLbl.setScale(_baseScale);
      window._selectedLevelData = levelData;
      closeOverlay(false, () => {
        this._searchResultOverlay = null;
        this._closeSearchResultOverlay = null;
        this._openPlayMenu(() => this._openSearchResultScene(levelData));
      });
    });

    addRow();
  }

  _closeSearchResultScene() {
    if (this._searchResultOverlay) {
      if (this._closeSearchResultOverlay) {
        this._closeSearchResultOverlay();
      }
      this._searchResultOverlay = null;
    }
  }

  _hideEndLayer(_0x272eb1) {
    if (this._endcoinAwardTimer) {
      for (const timer of this._endcoinAwardTimer) {
        timer?.remove?.(false);
      }
      this._endcoinAwardTimer = null;
    }
    if (!this._endLayerInternal) {
      if (_0x272eb1) {
        _0x272eb1();
      }
      return;
    }
    const _0x1215e0 = {
      p: 0
    };
    this.tweens.add({
      targets: _0x1215e0,
      p: 1,
      duration: 500,
      ease: _0xc1c75 => _0xc1c75 < 0.5 ? Math.pow(_0xc1c75 * 2, 2) / 2 : 1 - Math.pow((1 - _0xc1c75) * 2, 2) / 2,
      onUpdate: () => {
        this._endLayerInternal.y = _0x1215e0.p * -640;
      },
      onComplete: () => {
        this._endLayerInternal.destroy();
        this._endLayerInternal = null;
        if (this._endLayerOverlay) {
          this._endLayerOverlay.destroy();
          this._endLayerOverlay = null;
        }
        if (_0x272eb1) {
          _0x272eb1();
        }
      }
    });
    this.tweens.add({
      targets: this._endLayerOverlay,
      alpha: 0,
      duration: 500
    });
  }
}
