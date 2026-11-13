// editable config stuff 

if (window.mainColor == null) {
  window.mainColor = parseInt(localStorage.getItem("iconMainColor") || "04FF00", 16);
}
if (window.secondaryColor == null) {
  window.secondaryColor = parseInt(localStorage.getItem("iconSecondaryColor") || "00FBFF", 16);
}
window.currentPlayer = localStorage.getItem("iconCurrentPlayer") || "player_01";
window.currentShip   = localStorage.getItem("iconCurrentShip")   || "ship_01";
window.currentBall   = localStorage.getItem("iconCurrentBall")   || "player_ball_01";
window.currentWave   = localStorage.getItem("iconCurrentWave")   || "dart_01";
window.currentSpider = localStorage.getItem("iconCurrentSpider") || "spider_01";
window.currentBird   = localStorage.getItem("iconCurrentBird")   || "bird_01";
window.currentSwing  = localStorage.getItem("iconCurrentSwing")  || "swing_01";
const storedUseDirectInternet = localStorage.getItem("gd_useDirectInternet");
window.useDirectInternet = storedUseDirectInternet === null ? true : storedUseDirectInternet === "true";
window.getGdApiBase = function () {
  if (window.useDirectInternet) return "https://www.boomlings.com/database";
  return (window._gdProxyUrl || "").replace(/\/$/, "");
};
window.getGdApiUrl = function (path) {
  const base = window.getGdApiBase();
  if (!base) return null;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};
async function fetchGdRoute(url, options, timeoutMs, nativeOnly = false) {
  const connection = new AbortController();
  const timer = setTimeout(() => connection.abort(), timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, connection.signal]) : connection.signal;
  try { return await (nativeOnly && window._gdNativeFetch || fetch)(url, { ...options, signal }); }
  finally { clearTimeout(timer); }
}
// Each API route owns its timeout and circuit breaker. Do not nest the old
// four-worker fetch wrapper inside one 12-second timeout: its first stalled
// worker used to cancel every subsequent attempt, including healthy routes.
const gdApiRouteFailures = new Map();
window.fetchGdApi = async function (path, options = {}) {
  const suffix = '/' + path.replace(/^\//, '');
  const relay = window.WEBDASH_GD_RELAY_BASE?.replace(/\/$/, '');
  const relayUrl = relay ? relay + suffix : null;
  const directUrl = window.useDirectInternet ? window.getGdApiUrl(path) : null;
  const proxyBase = (window._gdProxyUrl || "").replace(/\/$/, "");
  const proxyUrl = proxyBase ? `${proxyBase}${path.startsWith("/") ? "" : "/"}${path}` : null;
  const legacy = (window._gdProxyHosts || []).map(base => base + suffix);
  const urls = [...new Set([relayUrl, directUrl, proxyUrl, ...legacy].filter(Boolean))];
  const backend = window.getGdBackendBase?.();
  const backendUrl = backend && /^\/?(getGJLevels21|downloadGJLevel22|getGJSongInfo)\.php$/.test(path)
    && !(window._gdBackendDeniedUntil > Date.now()) ? backend + '/gd-api/' + path.replace(/^\//, '') : null;
  if (backendUrl) urls.push(backendUrl);
  let lastError = null;
  for (const url of urls) {
    if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');
    const route = new URL(url).origin;
    if ((gdApiRouteFailures.get(route) || 0) > Date.now()) continue;
    if (url === backendUrl) {
      try { if (!await window.ensureGdBackend(options.signal)) continue; }
      catch (error) { if (options.signal?.aborted) throw error; lastError = error; continue; }
    }
    try {
      const response = await fetchGdRoute(url, { ...options,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...options.headers } }, url === backendUrl ? 65000 : 20000, true);
      if (response.ok) { gdApiRouteFailures.delete(route); return response; }
      gdApiRouteFailures.set(route, Date.now() + (response.status === 429 ? 300000 : 60000));
      lastError = new Error(`HTTP ${response.status}`);
      if (response.headers.get('X-WebDash-Upstream-Error') === 'GDNetworkDenied:1005') {
        window._gdBackendDeniedUntil = Date.now() + 300000;
        lastError = new Error('The GD server currently blocks this hosting network.');
        lastError.code = 'GD_NETWORK_DENIED';
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
      gdApiRouteFailures.set(route, Date.now() + (url === directUrl ? 300000 : 60000));
      lastError = error;
    }
  }
  if (lastError?.code === 'GD_NETWORK_DENIED') window.GDDownloads?.error('Online levels unavailable', 'The GD server blocks this hosting network and the alternate routes could not be reached. Please retry.');
  throw lastError || new Error("No GD API endpoint available");
};
window.getGdAudioUrl = function (songUrl) {
  if (window.useDirectInternet) return songUrl;
  const proxyBase = (window._gdProxyUrl || "").replace(/\/$/, "");
  return proxyBase ? `${proxyBase}/audio-proxy?url=${encodeURIComponent(songUrl)}` : songUrl;
};
window.fetchGdAudio = async function (songUrl, options = {}) {
  const directUrl = window.useDirectInternet ? songUrl : null;
  const proxyBase = (window._gdProxyUrl || "").replace(/\/$/, "");
  const proxyUrl = proxyBase ? `${proxyBase}/audio-proxy?url=${encodeURIComponent(songUrl)}` : null;
  const urls = [...new Set([directUrl, proxyUrl].filter(Boolean))];
  const backend = window.getGdBackendBase?.();
  const backendUrl = backend && /^https:\/\/(?:[^/]+\.ngfiles\.com|geometrydash(?:files|content)\.b-cdn\.net)\//.test(songUrl)
    ? backend + '/gd-audio?url=' + encodeURIComponent(songUrl) : null;
  if (backendUrl) urls.push(backendUrl);
  let lastError = null;
  for (const url of urls) {
    if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');
    try {
      if (url === backendUrl && !await window.ensureGdBackend(options.signal)) continue;
      // Bound connection setup, while allowing a large song to keep streaming.
      // The caller's abort signal continues to cancel its response body.
      const response = await fetchGdRoute(url, options, 20000);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error("No audio endpoint available");
};
window.fetchGdSongAudio = async function (songId, options = {}) {
  const id = Number(songId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid song ID');
  if (id >= 10000000) return window.fetchGdAudio(`https://geometrydashfiles.b-cdn.net/music/${id}.ogg`, options);
  {
    try {
      const response = await fetchGdRoute(`https://fetchsongid.lasokar.workers.dev/?id=${id}`, options, 15000);
      if (response.ok) return response;
    } catch (error) { if (options.signal?.aborted) throw error; }
  }
  const response = await window.fetchGdApi('/getGJSongInfo.php', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `songID=${id}&secret=Wmfd2893gb7`, signal: options.signal
  });
  const fields = (await response.text()).split('~|~'), index = fields.indexOf('10');
  if (index < 0 || !fields[index + 1]) throw new Error('Song audio URL unavailable');
  return window.fetchGdAudio(decodeURIComponent(fields[index + 1]), options);
};
// PlayLayer::getCurrentPercent (Steam 512300) uses the saved verification
// tick count (GMD k95 / API 57) when present, including speed changes.
function gdLevelPercent(progressTicks, verificationFrames, worldX, endX) {
  const value = verificationFrames > 0
    ? Math.fround(Math.fround(Math.fround(progressTicks) / Math.fround(verificationFrames)) * 100)
    : endX > 0 ? worldX / endX * 100 : 0;
  return Math.min(100, Math.max(0, value));
}
window.currentlevel = [
	"stereo_madness", // internal level name
	"Stereo Madness", // proper level name
	"level_1",        // level id in assets/levels
	["RobTop", "Forever Bound"]   // person who made the song
];
// Click feedback is independent of the audio pulse and never changes hitboxes.
window.orbClickScale = 1.35;
window.orbClickShrinkTime = 250;
window.orbParticleSize = 3.5;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('id')) {
  window.levelID = urlParams.get('id');
}

// -------------------------------

function hexToHexadecimal(str) {
  return parseInt(str, 16);
}

function hexadecimalToHex(num) {
  return num.toString(16).padStart(6, '0');
}

let screenWidth = 1138;
const screenHeight = 640;
const a = 60;
const o = 180;
let centerX = screenWidth / 2 - 150;
function l(screenWidth) {
  this.screenWidth = screenWidth;
  centerX = screenWidth / 2 - 150;
}
const u = 1 / 240;
const SpeedPortal = {
  HALF: 9.30222544655,
  ONE_TIMES: 11.540004,
  TWO_TIMES: 14.3488938625,
  THREE_TIMES: 17.3333393414,
  FOUR_TIMES: 21.3333407279
}
let playerSpeed = SpeedPortal.ONE_TIMES;
const d = 0.9;
const p = 1.916398;
const f = 600;
const g = a;
const jumpPadType = "jump_pad";
const jumpRingType = "jump_ring";
const T = 460;
function b(y) {
  return T - y;
}
let S = Phaser.BlendModes.ADD;
let E = Phaser.BlendModes.NORMAL;

const fs = 1000;
const gs = 1001;

const atlasList = [
  "GJ_WebSheet",
  "GJ_GameSheet",
  "GJ_GameSheet02",
  "GJ_GameSheet03",
  "GJ_GameSheet04",
  "GJ_GameSheetEditor",
  "GJ_GameSheetGlow",
  "GJ_GameSheetIcons",
  "GJ_LaunchSheet",
  "player_ball_00",
  "player_dart_00",
  "GJ_ParticleSheet-uhd",
  "GJ_ParticleSheet",
  "PixelSheet_01-hd",
  "FireSheet_01-hd",
  "Wavesheet",
];

function getAtlasFrame(scene, frameName) {
  if (typeof frameName !== 'string' || !frameName) return null;
  if (frameName.startsWith("player_")) {
    const playerAtlasPriority = ["GJ_GameSheet03", "GJ_GameSheet", "GJ_GameSheet02", "GJ_GameSheet04", "GJ_GameSheetEditor", "GJ_GameSheetGlow", "GJ_GameSheetIcons", "GJ_WebSheet", "GJ_LaunchSheet", "player_ball_00", "player_dart_00"];
    for (let atlasName of playerAtlasPriority) {
      if (scene.textures.exists(atlasName)) {
        if (scene.textures.get(atlasName).has(frameName)) {
          return {
            atlas: atlasName,
            frame: frameName
          };
        }
      }
    }
  }
  for (let atlasName of atlasList) {
    if (scene.textures.exists(atlasName)) {
      if (scene.textures.get(atlasName).has(frameName)) {
        return {
          atlas: atlasName,
          frame: frameName
        };
      }
    }
  }
  return null;
}
function addImageToScene(scene, x, y, textureName) {
  let textureInfo = getAtlasFrame(scene, textureName);
  if (textureInfo) {
    return scene.add.image(x, y, textureInfo.atlas, textureInfo.frame);
  } else if (scene.textures.exists(textureName)) {
    return scene.add.image(x, y, textureName);
  } else {
    return null;
  }
}
