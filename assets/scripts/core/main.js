function checkForAutoLoad() {
  const assetsLoaded = localStorage.getItem('webdash_assets_loaded') === 'true';
  const lastLoadTime = parseInt(localStorage.getItem('webdash_last_load_time') || '0');
  const now = Date.now();
  const hoursSinceLoad = (now - lastLoadTime) / (1000 * 60 * 60);
  if (assetsLoaded && hoursSinceLoad < 24 && window.gameCache.isCacheValid()) {
    const stats = window.gameCache.getCacheStats();
    if (stats.validEntries > 50) {
      console.log('auto loading from cache');
      return true;
    }
  }
  return false;
}
if (window.gameCache) {
  window.gameCache.init();
  const canAutoLoad = checkForAutoLoad();
  if (canAutoLoad) {
    const autoLoadIndicator = document.createElement('div');
    autoLoadIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #00ff00;
      color: #000;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial;
      font-size: 12px;
      z-index: 9999;
    `;
    autoLoadIndicator.textContent = 'turbo loading';
    document.body.appendChild(autoLoadIndicator);
    setTimeout(() => {
      if (autoLoadIndicator.parentNode) {
        autoLoadIndicator.parentNode.removeChild(autoLoadIndicator);
      }
    }, 3000);
  }
}
const phaserConfig = {
  type: Phaser.AUTO,
  width: screenWidth,
  height: screenHeight,
  // Preserve the smooth high-resolution presentation of the native game.
  // Atlas seams are addressed per frame after loading, not by pixelating all
  // game art with nearest-neighbour filtering.
  pixelArt: false,
  resolution: Math.max(1, window.devicePixelRatio || 1),
  fps: {
    // The fixed 240 Hz simulation already absorbs render-frame jitter.
    // Phaser's moving average drops long frame times and lets real audio
    // run ahead of the level after stutters.
    smoothStep: false
  },
  backgroundColor: "#000000",
  parent: document.body,
  input: {
    windowEvents: false
  },
  render: {
    antialias: true,
    antialiasGL: true,
    // Rounding separate player layers to different source pixels makes the
    // ship/cube appear to vibrate while the camera moves. UV inset handling
    // already fixes atlas seams, so retain sub-pixel layer alignment here.
    roundPixels: false,
    powerPreference: "high-performance"
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene]
};
new Phaser.Game(phaserConfig);

window.clearGameCache = () => {
  if (window.gameCache) {
    window.gameCache.clearCache();
    localStorage.removeItem('webdash_assets_loaded');
    localStorage.removeItem('webdash_last_load_time');
    console.log('Game cache cleared');
    location.reload();
  }
};

window.getCacheInfo = () => {
  if (window.gameCache) {
    return window.gameCache.getCacheStats();
  }
  return null;
};
