class Collider {
  constructor(objType, xPos, yPos, width, height, rotation = 0) {
    this.type = objType;
    this.x = xPos;
    this.y = yPos;
    this.w = width;
    this.h = height;
    this.activated = false;
    this.rotationDegrees = rotation;
    this.slopeAngleDeg = 0;
    this.slopeDir = 1;
    this.slopeIsFilled = false;
    this.slopeFlipY = false;
    this.hypoAx = 0; this.hypoAy = 0;
    this.hypoBx = 0; this.hypoBy = 0;
    this.rightAx = 0; this.rightAy = 0;
    this.slopeSolidBelow = true;
  }
  getSlopeSurfaceY(worldX, extrapolate = false) {
    if (this.type !== slopeType) return null;
    const ax = this.x + this.hypoAx, ay = this.y + this.hypoAy;
    const bx = this.x + this.hypoBx, by = this.y + this.hypoBy;
    const lo = ax <= bx ? { x: ax, y: ay } : { x: bx, y: by };
    const hi = ax <= bx ? { x: bx, y: by } : { x: ax, y: ay };
    if (hi.x - lo.x < 0.01) return null;
    if (!extrapolate && (worldX < lo.x || worldX > hi.x)) return null;
    const t = (worldX - lo.x) / (hi.x - lo.x);
    return lo.y + t * (hi.y - lo.y);
  }
  getSlopeAngleRad() {
    if (this.type !== slopeType) return 0;
    return Math.atan2(this.hypoBy - this.hypoAy, this.hypoBx - this.hypoAx);
  }
  rotateSlope(degrees) {
    if (this.type !== slopeType) return;
    for (const [x, y] of [["hypoAx", "hypoAy"], ["hypoBx", "hypoBy"], ["rightAx", "rightAy"]]) {
      const point = rotateSlopePoint(this[x], this[y], degrees);
      this[x] = point.x; this[y] = point.y;
    }
    this.slopeRotation = (this.slopeRotation || 0) + degrees;
    this.w = 2 * Math.max(Math.abs(this.hypoAx), Math.abs(this.hypoBx), Math.abs(this.rightAx));
    this.h = 2 * Math.max(Math.abs(this.hypoAy), Math.abs(this.hypoBy), Math.abs(this.rightAy));
    const dx = this.hypoBx - this.hypoAx;
    this.slopeSolidBelow = Math.abs(dx) < 0.01 ? this.rightAx < this.hypoAx
      : this.rightAy < this.hypoAy + (this.rightAx - this.hypoAx) / dx * (this.hypoBy - this.hypoAy);
    this.slopeFlipY = !this.slopeSolidBelow;
    this.slopeUphill = dx * (this.hypoBy - this.hypoAy) > 0;
    this.slopeDir = this.slopeUphill ? 1 : -1;
    this.slopeAngleDeg = Math.abs(Math.atan(Math.tan(this.getSlopeAngleRad()))) * 180 / Math.PI;
    this.slopeType = _gdSlopeType(this.slopeEffectiveFlipX, this.slopeEditorFlipY, this.slopeRotation);
    this.gdSolidAbove = _gdSlopeSolidAbove(this.slopeType);
    this.gdWallOnLeft = _gdSlopeWallOnLeft(this.slopeType);
  }
  transformShape(a, b, c, d) {
    if (this.type === slopeType) {
      let x = this.hypoAx, y = this.hypoAy;
      this.hypoAx = a * x + c * y; this.hypoAy = b * x + d * y;
      x = this.hypoBx; y = this.hypoBy;
      this.hypoBx = a * x + c * y; this.hypoBy = b * x + d * y;
      x = this.rightAx; y = this.rightAy;
      this.rightAx = a * x + c * y; this.rightAy = b * x + d * y;
      this.rotateSlope(0);
      return;
    }
    if (!this.shape) {
      const theta = -(this.rotationDegrees || 0) * Math.PI / 180, co = Math.cos(theta), si = Math.sin(theta);
      this.shape = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
        x *= this.w / 2; y *= this.h / 2;
        return [co * x - si * y, si * x + co * y];
      });
    }
    // A new shape array each time: checkpoints keep the previous one.
    const old = this.shape, shape = new Array(old.length);
    let w = 0, h = 0;
    for (let i = 0; i < old.length; i++) {
      const x = old[i][0], y = old[i][1], nx = a * x + c * y, ny = b * x + d * y;
      shape[i] = [nx, ny];
      if (Math.abs(nx) > w) w = Math.abs(nx);
      if (Math.abs(ny) > h) h = Math.abs(ny);
    }
    this.shape = shape;
    this.w = 2 * w;
    this.h = 2 * h;
    if (this.hitbox_radius !== undefined) {
      this._circleBaseRadius ??= this.hitbox_radius;
      const m = this.circleMatrix || [1, 0, 0, 1];
      this.circleMatrix = [a * m[0] + c * m[1], b * m[0] + d * m[1], a * m[2] + c * m[3], b * m[2] + d * m[3]];
      const [m0, m1, m2, m3] = this.circleMatrix;
      const trace = m0 * m0 + m1 * m1 + m2 * m2 + m3 * m3;
      const determinant = (m0 * m3 - m1 * m2) ** 2;
      this.hitbox_radius = this._circleBaseRadius * Math.sqrt((trace + Math.sqrt(Math.max(0, trace * trace - 4 * determinant))) / 2);
    }
  }
  // Separating axis test against the player's rectangle: its two axes,
  // then each shape edge normal. Zero rotation keeps an axis-aligned box.
  shapeOverlapsRect(x, y, halfW, halfH, rotation = 0) {
    const shape = this.shape;
    if (!shape) return true;
    const n = shape.length, rx = x - this.x, ry = y - this.y;
    const co = Math.cos(rotation), si = Math.sin(rotation);
    for (let k = -2; k < n; k++) {
      let ax, ay;
      if (k === -2) { ax = co; ay = si; }
      else if (k === -1) { ax = -si; ay = co; }
      else { const p = shape[k], q = shape[(k + 1) % n]; ax = q[1] - p[1]; ay = p[0] - q[0]; }
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = shape[i][0] * ax + shape[i][1] * ay;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const center = rx * ax + ry * ay;
      const radius = halfW * Math.abs(ax * co + ay * si) + halfH * Math.abs(-ax * si + ay * co);
      if (center + radius < lo || center - radius > hi) return false;
    }
    return true;
  }
  shapeVerticalRange(left, right) {
    if (!this.shape) return null;
    let polygon = this.shape.map(([x, y]) => [x + this.x, y + this.y]);
    for (const [edge, direction] of [[left, 1], [right, -1]]) {
      const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const insideP = (p[0] - edge) * direction >= 0, insideQ = (q[0] - edge) * direction >= 0;
        if (insideP) clipped.push(p);
        if (insideP !== insideQ) {
          const t = (edge - p[0]) / (q[0] - p[0]);
          clipped.push([edge, p[1] + t * (q[1] - p[1])]);
        }
      }
      polygon = clipped;
      if (!polygon.length) return null;
    }
    return { lower: Math.min(...polygon.map(p => p[1])), upper: Math.max(...polygon.map(p => p[1])) };
  }
  // Mirrors GameObject::slopeYPos(CCRect) from the native game.  A slope is
  // not sampled under the centre of the player: its uphill/downhill and
  // floor/ceiling direction select the leading edge of the player's rect.
  // Sampling the centre was the source of the visible clipping followed by a
  // corrective launch on descending slopes.
  getSlopeSurfaceYForPlayer(leftX, rightX) {
    if (this.type !== slopeType) return null;
    // gdSolidAbove describes the triangle's flat cap, not the solid side
    // of its diagonal. Select the supporting edge from the actual vertices.
    const floorTop = !!this.slopeSolidBelow;
    const uphill = (this.hypoBx - this.hypoAx) * (this.hypoBy - this.hypoAy) > 0;
    const contactX = uphill
      ? (floorTop ? rightX : leftX)
      : (floorTop ? leftX : rightX);
    const lo = this.x + Math.min(this.hypoAx, this.hypoBx);
    const hi = this.x + Math.max(this.hypoAx, this.hypoBx);
    if (rightX < lo || leftX > hi) return null;
    return this.getSlopeSurfaceY(Math.max(lo, Math.min(hi, contactX)));
  }
  usesFloorLanding(gravityFlipped) {
    return this.isSolidBelowSurface(gravityFlipped);
  }
  isSolidBelowSurface(gravityFlipped) {
    return this.slopeSolidBelow !== gravityFlipped;
  }
  isSlopeSolidAt(worldX, worldY, gravityFlipped = false) {
    if (this.type !== slopeType) return false;
    const halfW = this.w / 2;
    const halfH = this.h / 2;
    const left = this.x - halfW;
    const right = this.x + halfW;
    const bboxBottom = this.y - halfH;
    const bboxTop = this.y + halfH;
    if (worldX < left || worldX > right || worldY < bboxBottom || worldY > bboxTop) {
      return false;
    }
    if (this.slopeIsFilled) {
      return true;
    }
    const surfaceY = this.getSlopeSurfaceY(worldX);
    if (surfaceY === null) return false;
    return this.isSolidBelowSurface(gravityFlipped) ? worldY < surfaceY : worldY > surfaceY;
  }
  getSlopeBackWallSide(gravityFlipped = false) {
    let leftWall = this.slopeDir > 0;
    if (!this.isSolidBelowSurface(gravityFlipped)) leftWall = !leftWall;
    return leftWall ? "left" : "right";
  }
}
const ldm_object = new Set([
  503,505,504,1888,1887,1012,1013,1011,1886,1762,1763,1761,1269,1760,1270,1271,1274,1272,1273,1764,1765,1766,1767,1769,1292,1758,1291,1293,1759,1051,1058,1060,1752,1050,1052,1059,1061
]);
// Objects whose visuals are still produced by the sprite path in gameplay
// (collectibles with their own pickup animation and AnimDesc monsters).
// Monster descriptor poses are submitted to native batches after animation.
const _GD_LEGACY_VISUAL_IDS = new Set([142, 1329, 914, 918, 919, 1327, 1328, 1584, 2012]);
// EffectGameObject::triggerObject: enter effect trigger -> effect id stored in
// GJBaseGameLayer::m_enterChannelMap / m_exitChannelMap.
const _GD_ENTER_EFFECT_IDS = Object.freeze({
  22: -2, 23: -6, 24: -5, 25: -7, 26: -8, 27: -3, 28: -4,
  55: -11, 56: -10, 57: -9, 58: -12, 59: -13, 1915: -14
});
 
function _decodeTextObjectString(value) {
  if (value === undefined || value === null) return "";
  const raw = String(value);
  if (raw === "") return "";
  try {
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(raw)) return raw;
    let base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (err) {
    return raw;
  }
}
 
function _encodeTextObjectString(value) {
  const bytes = new TextEncoder().encode(String(value ?? ""));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
 
// Command durations (move, follow): GroupCommandObject2::step keeps a
// command without an eased offset running forever at exactly -1.
function commandDuration(value) {
  const d = Number(value);
  return d === -1 ? -1 : Math.max(0, d || 0);
}

function parseObject(objectString) {
  let objectParts = objectString.split(",");
  let objectData = {};
  for (let index = 0; index + 1 < objectParts.length; index += 2) {
    let key = objectParts[index];
    let value = objectParts[index + 1];
    objectData[key] = value;
  }
  let objectId = parseInt(objectData[1] || "0", 10);
  const rawGroupValues = [];
  const addRawGroups = (rawValue) => {
    String(rawValue ?? "")
      .split(".")
      .map(value => parseInt(value, 10))
      .filter(value => Number.isFinite(value) && value > 0)
      .forEach(value => rawGroupValues.push(value));
  };
  addRawGroups(objectData[33]);
  addRawGroups(objectData[57]);
  const groupString = [...new Set(rawGroupValues)].join(".");
  if (objectId === 0) {
    return null;
  } else {
    return {
      id: objectId,
      x: parseFloat(objectData[2] || "0"),
      y: parseFloat(objectData[3] || "0"),
      flipX: objectData[4] === "1",
      flipY: objectData[5] === "1",
      rot: parseFloat(objectData[6] || "0"),
      rotationX: parseFloat(objectData[131] ?? objectData[6] ?? "0"),
      rotationY: parseFloat(objectData[132] ?? objectData[6] ?? "0"),
      // objectFromVector (Steam 29ad03..29aeca) prefers the separate
      // 128/129 scales. Legacy 32 is used only when neither axis is set;
      // multiplying both representations doubles a saved edit's scale.
      scale: (Number(objectData[128]) || Number(objectData[129])) ? 1 : (parseFloat(objectData[32]) || 1),
      // Saved zero axes are absent overrides in objectFromVector; they do
      // not flatten the object (nor suppress a valid legacy uniform scale).
      scaleX: parseFloat(objectData[128]) || 1,
      scaleY: parseFloat(objectData[129]) || 1,
      editorLayer: parseInt(objectData[20] || "0", 10),
      zLayer: parseInt(objectData[24] || "0", 10),
      zOrder: parseInt(objectData[25] || "0", 10),
      editorLayer2: parseInt(objectData[61] || "0", 10),
      groups: groupString,
      // Key 34 is only the editor's Group Parent toggle. The parent table
      // comes from 274 (GJBaseGameLayer::loadGroupParentsFromString, installed
      // 32ceb0): every listed group gets this object as parent, whether or not
      // it is a member; a '+' entry is promoted to the front. Parenthood does
      // not add group membership.
      toggleGroupParent: objectData[34] === "1",
      groupParents: [...new Set(String(objectData[274] ?? "").split(".")
        .map(value => parseInt(value, 10))
        .filter(value => Number.isFinite(value) && value > 0))],
      groupParentsPrimary: String(objectData[274] ?? "").split(".")
        .filter(value => value.startsWith("+")).map(value => parseInt(value, 10)),
      hasAreaParent: objectData[279] === "1",
      // Per-object editor flags.  Do not collapse these into the definition:
      // they are serialized on GameObject and can differ between two copies of
      // the same object in a level.
      targetColor: parseInt(objectData[23] || "0", 10),
      customColorType: parseInt(objectData[497] || "0", 10),
      dontEnter: objectData[67] === "1",
      dontFade: objectData[64] === "1",
      noEffects: objectData[116] === "1",
      noParticles: objectData[507] === "1",
      noAudioScale: objectData[372] === "1",
      noTouch: objectData[121] === "1",
      highDetail: objectData[103] === "1",
      passable: objectData[134] === "1",
      hidden: objectData[135] === "1",
      nonStickX: objectData[136] === "1",
      nonStickY: objectData[289] === "1",
      ice: objectData[137] === "1",
      gripSlope: objectData[193] === "1",
      scaleStick: objectData[356] === "1",
      extraSticky: objectData[495] === "1",
      dontBoostY: objectData[496] === "1",
      dontBoostX: objectData[509] === "1",
      extendedCollision: objectData[511] === "1",
      linkedGroup: parseInt(objectData[108] || "0", 10),
      noGlow: objectData[96] === "1",
      color1: parseInt(objectData[21] || "0", 10),
      color2: parseInt(objectData[22] || "0", 10),
      text: _decodeTextObjectString(objectData[31] ?? objectData["31"] ?? ""),
      gameMode: parseInt(objectData['kA2'] ?? '0', 10),
      miniMode: parseInt(objectData['kA3'] ?? '0', 10),
      speed: parseInt(objectData['kA4'] ?? '0', 10),
      dualMode: parseInt(objectData['kA8'] ?? '0', 10),
      mirrored: parseInt(objectData['kA28'] ?? '0', 10),
      flipGravity: '1' === (objectData['kA11'] ?? '0'),
      _raw: objectData
    };
  }
}
function parseLevel(levelString) {
  let decompressedString = null;
  try{
    decompressedString = function (compressedString) {
      let getBase64 = function (compressedString) {
        // The supplied official 22.txt carries one trailing NUL byte. It is
        // outside the Base64 payload and must not make atob reject an
        // otherwise valid level string.
        let lessCluttered = String(compressedString ?? "").replace(/\0/g, "").replace(/-/g, "+").replace(/_/g, "/");
        while (lessCluttered.length % 4 != 0) {
          lessCluttered += "=";
        }
        return lessCluttered;
      }(compressedString.trim());
      let decryptedString = atob(getBase64);
      let rawBytes = new Uint8Array(decryptedString.length);
      for (let byteStr = 0; byteStr < decryptedString.length; byteStr++) {
        rawBytes[byteStr] = decryptedString.charCodeAt(byteStr);
      }
      let inflatedBytes = pako.inflate(rawBytes);
      return new TextDecoder().decode(inflatedBytes);
    }(levelString);
  } catch(InvalidCharacterError) {
    decompressedString = levelString;
  }
  let stringParts = decompressedString.split(";");
  let settings = stringParts.length > 0 ? stringParts[0] : "";
  let objects = [];
  for (let id = 1; id < stringParts.length; id++) {
    if (stringParts[id].length === 0) {
      continue;
    }
    let object = parseObject(stringParts[id]);
    if (object) {
      objects.push(object);
    }
  }
  return {
    settings: settings,
    objects: objects
  };
 
}

function getObjectVisualScale(levelObj, objectDef = null) {
  const savedScale = (value, fallback = 1) => {
    const number = Number(value);
    return Number.isFinite(number) && number !== 0 ? number : fallback;
  };
  const uniform = savedScale(levelObj?.scale);
  // PixelSheet is stored at twice the logical resolution used by the GD
  // world. Native GameObject::setupPixelScale supplies this factor through
  // m_pixelScaleX/Y before it applies the per-object 128/129 stretch.
  const pixelScale = objectDef?.type === "pixel" || /^PixelSheet_/i.test(String(objectDef?.spritesheet || ""))
    ? 0.5
    : 1;
  return {
    x: pixelScale * uniform * savedScale(levelObj?.scaleX),
    y: pixelScale * uniform * savedScale(levelObj?.scaleY)
  };
}

// GD's layer values are an enum, not an arbitrary numeric depth. In
// particular Default (0) is in front of B1 (3), and PortalBack (4) is the
// layer between them. Sorting the raw integers made foreground/background
// objects cross over each other in decorated levels.
const _GD_Z_LAYER_INDEX = Object.freeze({
  "-5": 0, // B5
  "-3": 1, // B4
  "-1": 2, // B3
  "1": 3,  // B2
  "3": 4,  // B1
  "4": 5,  // PortalBack
  "0": 6,  // Default
  "5": 7,  // T1
  "7": 8,  // T2
  "9": 9,  // T3
  "11": 10 // T4
});
function getGDZDepth(zLayer, zOrder = 0, localOrder = 0) {
  const normalizedLayer = Number.isFinite(Number(zLayer)) ? Number(zLayer) : 0;
  const layerIndex = _GD_Z_LAYER_INDEX[String(normalizedLayer)] ?? _GD_Z_LAYER_INDEX["0"];
  const order = Number.isFinite(Number(zOrder)) ? Number(zOrder) : 0;
  const local = Number.isFinite(Number(localOrder)) ? Number(localOrder) : 0;
  return layerIndex * 10000 + order + local * 0.001;
}
function setSpriteObjectScale(sprite, multiplier = 1) {
  if (!sprite) return;
  const legacy = Number.isFinite(Number(sprite._eeObjectScale)) ? Number(sprite._eeObjectScale) : 1;
  const scaleX = Number.isFinite(Number(sprite._eeObjectScaleX)) ? Number(sprite._eeObjectScaleX) : legacy;
  const scaleY = Number.isFinite(Number(sprite._eeObjectScaleY)) ? Number(sprite._eeObjectScaleY) : legacy;
  sprite.setScale(scaleX * multiplier, scaleY * multiplier);
}

// The original game stores the large monsters as a collection of ordinary
// sprites, then drives the pieces with the pose data from *_AnimDesc.plist.
// Keeping that source data instead of inventing a sine-wave animation is
// important here: the jaws, eyes and glow layers all have different pivots.
const _BEAST_ANIMATION_DEFS = Object.freeze({
  918:  { cacheKey: "GJBeast01_AnimDesc", clip: "GJBeast01_bite" },
  919:  { cacheKey: "BlackSludge_AnimDesc", clip: "BlackSludge_loop" },
  1327: { cacheKey: "GJBeast02_AnimDesc", clip: "GJBeast02_idle01" },
  1328: { cacheKey: "GJBeast03_AnimDesc", clip: "GJBeast03_idle01" },
  1584: { cacheKey: "GJBeast04_AnimDesc", clip: "GJBeast04_idle01" },
  2012: { cacheKey: "GJBeast05_AnimDesc", clip: "GJBeast05_idle01" }
});

// AnimatedGameObject::setupChildSprites (Steam 644cc0). These are the
// colourable artwork under the black masks, independent of optional glow.
const _BEAST_COLOR_PARTS = Object.freeze({
  918: ["GJBeast01_01_001.png", "GJBeast01_02_001.png"],
  1327: ["GJBeast02_01_001.png"], 1328: ["GJBeast03_01_001.png"],
  1584: ["GJBeast04_01_001.png", "GJBeast04_02_001.png", "GJBeast04_04_001.png"],
  2012: ["GJBeast05_02_001.png"]
});

// AnimatedGameObject::animationForID in the supplied 2.2081 executable
// selects these animation keys for the legacy Animate Trigger (object 1585).
// Undefined entries deliberately do nothing: that is what the native switch
// does for unsupported animation IDs instead of falling back to an unrelated
// clip.
const _BEAST_TRIGGER_CLIPS = Object.freeze({
  918: [
    "GJBeast01_bite",
    "GJBeast01_attack01",
    "GJBeast01_attack01_end",
    null,
    "GJBeast01_idle01"
  ],
  1584: [
    "GJBeast04_idle01",
    "GJBeast04_idle02",
    "GJBeast04_idle03",
    "GJBeast04_attack01",
    "GJBeast04_attack02",
    "GJBeast04_attack02_end",
    "GJBeast04_sleep",
    "GJBeast04_sleep_loop",
    "GJBeast04_sleep_end",
    "GJBeast04_attack02_loop"
  ],
  2012: [
    "GJBeast05_idle01",
    "GJBeast05_idle02",
    "GJBeast05_toAttack01",
    "GJBeast05_attack01",
    "GJBeast05_attack02",
    "GJBeast05_toAttack03",
    "GJBeast05_attack03",
    "GJBeast05_idle03",
    "GJBeast05_fromAttack03"
  ]
});

const _beastDescriptorCache = new Map();

function _plistValue(node) {
  if (!node) return null;
  if (node.tagName === "string" || node.tagName === "integer" || node.tagName === "real") {
    return node.textContent || "";
  }
  if (node.tagName !== "dict") return null;

  const value = {};
  const children = Array.from(node.children || []);
  for (let i = 0; i + 1 < children.length; i += 2) {
    if (children[i].tagName !== "key") continue;
    value[children[i].textContent || ""] = _plistValue(children[i + 1]);
  }
  return value;
}

function _plistPoint(value, fallback = 0) {
  const parts = String(value ?? "").match(/-?(?:\d+\.?\d*|\.\d+)/g) || [];
  return {
    x: Number.isFinite(Number(parts[0])) ? Number(parts[0]) : fallback,
    y: Number.isFinite(Number(parts[1])) ? Number(parts[1]) : fallback
  };
}

function _parseBeastDescriptor(xmlText) {
  if (typeof DOMParser === "undefined" || !xmlText) return null;
  // The desktop resources begin with a harmless CRLF before the XML declaration.
  // DOMParser is stricter than the original plist loader, so normalize it here.
  const documentNode = new DOMParser().parseFromString(String(xmlText).replace(/^\s+/, ""), "application/xml");
  if (documentNode.querySelector("parsererror")) return null;
  const root = _plistValue(documentNode.querySelector("plist > dict"));
  const poses = root?.animationContainer;
  if (!poses || typeof poses !== "object") return null;

  const clips = {};
  for (const [poseName, poseData] of Object.entries(poses)) {
    const clipMatch = poseName.match(/^(.*)_([0-9]+)\.png$/);
    if (!clipMatch || !poseData || typeof poseData !== "object") continue;
    const pieces = Object.entries(poseData)
      .sort(([a], [b]) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
      .map(([, part]) => {
        const position = _plistPoint(part?.position);
        const scale = _plistPoint(part?.scale, 1);
        const flipped = _plistPoint(part?.flipped);
        return {
          texture: String(part?.texture || ""),
          tag: String(part?.tag || ""),
          x: position.x,
          y: position.y,
          scaleX: scale.x,
          scaleY: scale.y,
          flipX: !!flipped.x,
          flipY: !!flipped.y,
          rotation: Number(part?.rotation) || 0,
          z: Number(part?.zValue) || 0
        };
      })
      .filter(part => part.texture);
    if (!pieces.length) continue;
    const clipName = clipMatch[1];
    (clips[clipName] ||= []).push({ index: Number(clipMatch[2]), pieces });
  }

  for (const frames of Object.values(clips)) frames.sort((a, b) => a.index - b.index);
  return clips;
}

function _getBeastDescriptor(scene, cacheKey) {
  if (_beastDescriptorCache.has(cacheKey)) return _beastDescriptorCache.get(cacheKey);
  const parsed = _parseBeastDescriptor(scene?.cache?.text?.get(cacheKey));
  _beastDescriptorCache.set(cacheKey, parsed);
  return parsed;
}

function getBackgroundTextureIndex(backgroundSetting) {
  const parsedBackgroundId = parseInt(String(backgroundSetting ?? "1"), 10);
  const gdBackgroundId = isNaN(parsedBackgroundId) || parsedBackgroundId <= 1 ? 1 : parsedBackgroundId;
  return gdBackgroundId - 1;
}
 
function getBackgroundDisplayId(backgroundSetting) {
  const parsedBackgroundId = parseInt(String(backgroundSetting ?? "1"), 10);
  const gdBackgroundId = isNaN(parsedBackgroundId) || parsedBackgroundId <= 1 ? 1 : parsedBackgroundId;
  return String(gdBackgroundId).padStart(2, "0");
}
 
function getGroundTextureId(groundSetting) {
  const parsedGroundId = parseInt(String(groundSetting ?? "1"), 10);
  const textureIndex = isNaN(parsedGroundId) || parsedGroundId <= 1 ? 0 : parsedGroundId - 1;
  return String(textureIndex).padStart(2, "0");
}
 
const solidType = "solid";
const hazardType = "hazard";
const decoType = "deco";
const coinType = "coin";
const portalType = "portal";
const padType = "pad";
const ringType = "ring";
const triggerType = "trigger";
const speedType = "speed";
const slopeType = "slope";
// These two early colour triggers are present in the official 17th and 18th
// levels, but are absent from the generated object catalogue. They use the
// same serialised fields as the legacy colour trigger parser below, so retain
// them as real triggers rather than dropping the objects during level load.
const _LEGACY_TRIGGER_OBJECT_DEFS = Object.freeze({
  717: { type: triggerType },
  718: { type: triggerType }
});
const _SLOPE_DATA = {
  289:{gw:1,gh:1,angle:45,sq:false,dir:1}, 291:{gw:2,gh:1,angle:22.5,sq:false,dir:-1},
  294:{gw:1,gh:1,angle:45,sq:false},295:{gw:2,gh:1,angle:22.5,sq:false},
  296:{gw:0.367,gh:0.433,angle:45,sq:true},297:{gw:0.967,gh:0.45,angle:45,sq:true},
  299:{gw:1,gh:1,angle:45,sq:false},301:{gw:2,gh:1,angle:22.5,sq:false},
  305:{gw:1,gh:1,angle:45,sq:false},307:{gw:2,gh:1,angle:22.5,sq:false},
  349:{gw:1,gh:1,angle:45,sq:false},351:{gw:2,gh:1,angle:22.5,sq:false},
  673:{gw:1,gh:1,angle:45,sq:false},674:{gw:2,gh:1,angle:22.5,sq:false},
  309:{gw:1,gh:1,angle:45,sq:false},311:{gw:2,gh:1,angle:22.5,sq:false},
  315:{gw:1,gh:1,angle:45,sq:false},317:{gw:2,gh:1,angle:22.5,sq:false},
  321:{gw:1,gh:1,angle:45,sq:false},323:{gw:2,gh:1,angle:22.5,sq:false},
  324:{gw:1,gh:1,angle:45,sq:true},325:{gw:1,gh:1,angle:45,sq:true},
  326:{gw:1,gh:1,angle:45,sq:false},327:{gw:2,gh:1,angle:22.5,sq:false},
  328:{gw:0.733,gh:0.733,angle:45,sq:true},329:{gw:1.433,gh:0.733,angle:22.5,sq:true},
  331:{gw:1,gh:1,angle:45,sq:false},333:{gw:2,gh:1,angle:22.5,sq:false},
  337:{gw:1,gh:1,angle:45,sq:false},339:{gw:2,gh:1,angle:22.5,sq:false},
  343:{gw:1,gh:1,angle:45,sq:false},345:{gw:2,gh:1,angle:22.5,sq:false},
  353:{gw:1,gh:1,angle:45,sq:false},355:{gw:2,gh:1,angle:22.5,sq:false},
  358:{gw:1,gh:1,angle:45,sq:true},
  363:{gw:1,gh:1,angle:45,sq:false},364:{gw:2,gh:1,angle:22.5,sq:false},
  366:{gw:1,gh:1,angle:45,sq:false},367:{gw:2,gh:1,angle:22.5,sq:false},
  371:{gw:1,gh:1,angle:45,sq:false},372:{gw:2,gh:1,angle:22.5,sq:false},
  483:{gw:1,gh:1,angle:45,sq:false},484:{gw:2,gh:1,angle:22.5,sq:false},
  492:{gw:1,gh:1,angle:45,sq:false},493:{gw:2,gh:1,angle:22.5,sq:false},
  651:{gw:1,gh:1,angle:45,sq:false},652:{gw:2,gh:1,angle:22.5,sq:false},
  665:{gw:1,gh:1,angle:45,sq:false},666:{gw:2,gh:1,angle:22.5,sq:false},
  681:{gw:1,gh:1,angle:45,sq:false},682:{gw:2,gh:1,angle:22.5,sq:false},
  683:{gw:1,gh:1,angle:45,sq:false},684:{gw:2,gh:1,angle:22.5,sq:false},
  685:{gw:0.85,gh:0.85,angle:45,sq:false},686:{gw:1.85,gh:0.933,angle:22.5,sq:false},
  687:{gw:1,gh:1,angle:45,sq:false},688:{gw:2,gh:1,angle:22.5,sq:false},
  689:{gw:1,gh:1,angle:45,sq:false},690:{gw:2,gh:1,angle:22.5,sq:false},
  691:{gw:1,gh:1,angle:45,sq:false},692:{gw:2,gh:1,angle:22.5,sq:false},
  693:{gw:1,gh:1,angle:45,sq:false},694:{gw:2,gh:1,angle:22.5,sq:false},
  695:{gw:1,gh:1,angle:45,sq:false},696:{gw:2,gh:1,angle:22.5,sq:false},
  697:{gw:1,gh:1,angle:45,sq:false},698:{gw:2,gh:1,angle:22.5,sq:false},
  699:{gw:0.85,gh:0.85,angle:45,sq:false},700:{gw:1.85,gh:0.933,angle:22.5,sq:false},
  701:{gw:1,gh:1,angle:45,sq:false},702:{gw:2,gh:1,angle:22.5,sq:false},
  703:{gw:1,gh:1,angle:45,sq:false},704:{gw:2,gh:1,angle:22.5,sq:false},
  705:{gw:0.767,gh:0.767,angle:45,sq:false},706:{gw:1.733,gh:0.883,angle:22.5,sq:false},
  707:{gw:1,gh:1,angle:45,sq:false},708:{gw:2,gh:1,angle:22.5,sq:false},
  709:{gw:1,gh:1,angle:45,sq:false},710:{gw:2,gh:1,angle:22.5,sq:false},
  711:{gw:1,gh:1,angle:45,sq:false},712:{gw:2,gh:1,angle:22.5,sq:false},
  713:{gw:1,gh:1,angle:45,sq:false},714:{gw:2,gh:1,angle:22.5,sq:false},
  715:{gw:1,gh:1,angle:45,sq:false},716:{gw:2,gh:1,angle:22.5,sq:false},
  726:{gw:1,gh:1,angle:45,sq:false},727:{gw:2,gh:1,angle:22.5,sq:false},
  728:{gw:1,gh:1,angle:45,sq:false},729:{gw:2,gh:1,angle:22.5,sq:false},
  730:{gw:1,gh:1,angle:45,sq:false},731:{gw:2,gh:1,angle:22.5,sq:false},
  732:{gw:1,gh:1,angle:45,sq:false},733:{gw:2,gh:1,angle:22.5,sq:false},
  762:{gw:0.617,gh:0.583,angle:45,sq:false},763:{gw:1.283,gh:0.6,angle:22.5,sq:false},
  764:{gw:1,gh:1,angle:45,sq:true},765:{gw:1,gh:1,angle:45,sq:true},766:{gw:1,gh:1,angle:45,sq:true},
  771:{gw:0.617,gh:0.583,angle:45,sq:false},772:{gw:1.283,gh:0.6,angle:22.5,sq:false},
  773:{gw:0.9,gh:0.817,angle:45,sq:true},774:{gw:1,gh:0.85,angle:45,sq:true},775:{gw:0.867,gh:0.35,angle:22.5,sq:true},
  826:{gw:1,gh:1,angle:45,sq:false},827:{gw:1,gh:1,angle:45,sq:false},
  828:{gw:2,gh:1,angle:22.5,sq:false},829:{gw:2,gh:1,angle:22.5,sq:false},
  830:{gw:1,gh:1,angle:45,sq:true},831:{gw:1,gh:1,angle:45,sq:true},832:{gw:1,gh:1,angle:45,sq:true},833:{gw:1,gh:1,angle:45,sq:true},
  877:{gw:1,gh:1,angle:45,sq:false},878:{gw:2,gh:1,angle:22.5,sq:false},
  886:{gw:1,gh:1,angle:45,sq:false},887:{gw:2,gh:1,angle:22.5,sq:false},
  888:{gw:1,gh:1,angle:45,sq:false},889:{gw:2,gh:1,angle:22.5,sq:false},
  895:{gw:1,gh:1,angle:45,sq:false},896:{gw:2,gh:1,angle:22.5,sq:false},
  960:{gw:0.617,gh:0.583,angle:45,sq:false},961:{gw:1.283,gh:0.6,angle:22.5,sq:false},
  964:{gw:1,gh:1,angle:45,sq:true},965:{gw:1,gh:1,angle:45,sq:true},966:{gw:1,gh:1,angle:45,sq:true},
  969:{gw:0.617,gh:0.583,angle:45,sq:false},970:{gw:1.283,gh:0.6,angle:22.5,sq:false},
  971:{gw:0.9,gh:0.817,angle:45,sq:true},972:{gw:1,gh:0.85,angle:45,sq:true},973:{gw:0.867,gh:0.35,angle:22.5,sq:true},
  1014:{gw:1,gh:1,angle:45,sq:false},1015:{gw:2,gh:1,angle:22.5,sq:false},
  1016:{gw:1,gh:1,angle:45,sq:true},1017:{gw:1.008,gh:1,angle:45,sq:true},1018:{gw:1,gh:0.517,angle:22.5,sq:true},
  1033:{gw:0.617,gh:0.583,angle:45,sq:false},1034:{gw:1.283,gh:0.6,angle:22.5,sq:false},
  1035:{gw:1,gh:1,angle:45,sq:true},1036:{gw:1,gh:1,angle:45,sq:true},
  1037:{gw:0.617,gh:0.583,angle:45,sq:false},1038:{gw:1.283,gh:0.6,angle:22.5,sq:false},
  1039:{gw:1,gh:1,angle:45,sq:true},1040:{gw:1,gh:1,angle:45,sq:true},
  1041:{gw:1,gh:1,angle:45,sq:false},1042:{gw:2,gh:1,angle:22.5,sq:false},
  1043:{gw:1,gh:1,angle:45,sq:false},1044:{gw:2,gh:1,angle:22.5,sq:false},
  1091:{gw:1,gh:1,angle:45,sq:false},1092:{gw:2,gh:1,angle:22.5,sq:false},
  1093:{gw:1,gh:1,angle:45,sq:true},1094:{gw:1,gh:1,angle:45,sq:true},1108:{gw:2,gh:1,angle:22.5,sq:false},
  1187:{gw:0.767,gh:0.767,angle:45,sq:false},1188:{gw:1.517,gh:0.767,angle:22.5,sq:false},
  1189:{gw:1,gh:1,angle:45,sq:true},1190:{gw:1,gh:1,angle:45,sq:true},
  1198:{gw:1,gh:1,angle:45,sq:false},1199:{gw:2,gh:1,angle:22.5,sq:false},
  1200:{gw:0.267,gh:0.267,angle:45,sq:true},1201:{gw:0.517,gh:0.267,angle:22.5,sq:true},
  1256:{gw:1,gh:1,angle:45,sq:false},1257:{gw:2,gh:1,angle:22.5,sq:false},
  1258:{gw:1,gh:1,angle:45,sq:false},1259:{gw:2,gh:1,angle:22.5,sq:false},
  1305:{gw:0.617,gh:0.583,angle:45,sq:false},1306:{gw:1.3,gh:0.6,angle:22.5,sq:false},
  1307:{gw:0.683,gh:0.6,angle:45,sq:true},1308:{gw:1,gh:0.617,angle:45,sq:true},1309:{gw:0.267,gh:0.117,angle:22.5,sq:true},
  1316:{gw:0.617,gh:0.583,angle:45,sq:false},1317:{gw:1.3,gh:0.6,angle:22.5,sq:false},
  1318:{gw:0.683,gh:0.6,angle:45,sq:true},1319:{gw:1,gh:0.617,angle:45,sq:true},1320:{gw:0.267,gh:0.117,angle:22.5,sq:true},
  1325:{gw:1,gh:1,angle:45,sq:true},1326:{gw:1,gh:1,angle:45,sq:true},
  1338:{gw:1,gh:1,angle:45,sq:false},1339:{gw:2,gh:1,angle:22.5,sq:false},
  1341:{gw:1,gh:1,angle:45,sq:false},1342:{gw:2,gh:1,angle:22.5,sq:false},
  1344:{gw:1,gh:1,angle:45,sq:false},1345:{gw:2,gh:1,angle:22.5,sq:false},
  1717:{gw:1,gh:1,angle:45,sq:false},1718:{gw:2,gh:1,angle:22.5,sq:false},
  1723:{gw:1,gh:1,angle:45,sq:false},1724:{gw:2,gh:1,angle:22.5,sq:false},
  1743:{gw:1,gh:1,angle:45,sq:false},1744:{gw:2,gh:1,angle:22.5,sq:false},
  1745:{gw:1,gh:1,angle:45,sq:false},1746:{gw:2,gh:1,angle:22.5,sq:false},
  1747:{gw:1,gh:1,angle:45,sq:false},1748:{gw:2,gh:1,angle:22.5,sq:false},
  1749:{gw:1,gh:1,angle:45,sq:false},1750:{gw:2,gh:1,angle:22.5,sq:false},
  1758:{gw:1,gh:1,angle:45,sq:false},1759:{gw:2,gh:1,angle:22.5,sq:false},
  1760:{gw:1,gh:1,angle:45,sq:false},1761:{gw:2,gh:1,angle:22.5,sq:false},
  1762:{gw:1,gh:1,angle:45,sq:false},1763:{gw:2,gh:1,angle:22.5,sq:false},
  1773:{gw:2,gh:1,angle:22.5,sq:false},1774:{gw:2,gh:1,angle:22.5,sq:false},
  1775:{gw:2,gh:1,angle:22.5,sq:false},1776:{gw:2,gh:1,angle:22.5,sq:false},
  1785:{gw:2,gh:1,angle:22.5,sq:false},1786:{gw:2,gh:1,angle:22.5,sq:false},
  1787:{gw:2,gh:1,angle:22.5,sq:false},1788:{gw:2,gh:1,angle:22.5,sq:false},
  1789:{gw:2,gh:1,angle:22.5,sq:false},1790:{gw:2,gh:1,angle:22.5,sq:false},
  1791:{gw:2,gh:1,angle:22.5,sq:false},1792:{gw:2,gh:1,angle:22.5,sq:false},
  1794:{gw:2,gh:1,angle:22.5,sq:false},1796:{gw:2,gh:1,angle:22.5,sq:false},
  1798:{gw:2,gh:1,angle:22.5,sq:false},1800:{gw:2,gh:1,angle:22.5,sq:false},
  1802:{gw:2,gh:1,angle:22.5,sq:false},1804:{gw:2,gh:1,angle:22.5,sq:false},
  1806:{gw:2,gh:1,angle:22.5,sq:false},1808:{gw:2,gh:1,angle:22.5,sq:false},
  1810:{gw:2,gh:1,angle:22.5,sq:false},
  1899:{gw:1,gh:1,angle:45,sq:false},1900:{gw:2,gh:1,angle:22.5,sq:false},
  1901:{gw:0.367,gh:0.433,angle:45,sq:true},1902:{gw:0.967,gh:0.45,angle:45,sq:true},
  1906:{gw:1,gh:1,angle:45,sq:false},1907:{gw:2,gh:1,angle:22.5,sq:false},
};
 
function _resolveSlopeDir(objectDef, flipX, objId) {
  // GD derives m_slopeDirection from the object's flips and rotation alone:
  // every unflipped, unrotated slope rises towards +X (the native sprites,
  // drawn by gd-render, all do). The name-based mirroring below belonged to
  // the old Web Dash sheet, whose 60x30 sprites were drawn the other way.
  if (window.GD_OBJECTS?.[objId]?.t === 25) return flipX ? -1 : 1;
  const frames = [];
  if (objectDef) {
    if (objectDef.frame) frames.push(objectDef.frame);
    if (objectDef.children) {
      for (const child of objectDef.children) {
        if (child.frame) frames.push(child.frame);
      }
    }
  }
  const text = frames.join(" ");
  let dir = _SLOPE_DATA[objId]?.dir || 1;

  if (/slope_02[^0-9]|slope_04|slope_06|slope_02[bcd]_|pit_0[14]_slope_02|plank_01_slope_02|slope_square_02|slope_square_04|slope_square_05/.test(text)) {
    dir = -1;
  }
  
  if (flipX) dir = -dir;
  return dir;
}
 
function _resolveSlopeOrientation(objectDef, levelObj) {
  let dir = _resolveSlopeDir(objectDef, levelObj.flipX, levelObj.id);
  let flipY = !!levelObj.flipY;
  const rot90 = Math.round((((levelObj.rot || 0) % 360) + 360) % 360 / 90) % 4;
  if (rot90 === 1) {
    const nextDir = flipY ? 1 : -1;
    flipY = dir < 0;
    dir = nextDir;
  } else if (rot90 === 2) {
    dir = -dir;
    flipY = !flipY;
  } else if (rot90 === 3) {
    const nextDir = flipY ? -1 : 1;
    flipY = !(dir < 0);
    dir = nextDir;
  }
  return { dir, flipY };
}
 
function _gdSlopeType(flipX, flipY, rotationDegrees) {
  const rot = (parseInt(rotationDegrees, 10) || 0) % 360;
  const fx = !!flipX, fy = !!flipY;
  const r0 = rot === 0;
  const r180 = Math.abs(rot) === 180;
  const r90 = rot === 90 || rot === -270;
  const r270 = rot === -90 || rot === 270;
  if (!fx && !fy) return r0 ? 0 : r90 ? 4 : r180 ? 3 : r270 ? 5 : null;
  if (!fx && fy)  return r0 ? 1 : r90 ? 7 : r180 ? 2 : r270 ? 6 : null;
  if (fx && !fy)  return r0 ? 2 : r90 ? 6 : r180 ? 1 : r270 ? 7 : null;
  return            r0 ? 3 : r90 ? 5 : r180 ? 0 : r270 ? 4 : null;
}

function _gdSlopeSolidAbove(type) {
  return type !== null && type < 7 && ((0x6a >> type) & 1) !== 0;
}
function _gdSlopeWallOnLeft(type) {
  return type !== null && (((type - 2) >>> 0) < 3 || type === 6);
}

const _SLOPE_DECO_RANGES = [
  [681, 708], [713, 716], [730, 763], [771, 772], [826, 829], [877, 878],
  [888, 961], [969, 970], [1014, 1015], [1033, 1034], [1037, 1038],
  [1041, 1092], [1108, 1188], [1198, 1199], [1256, 1306], [1316, 1317],
  [1758, 1900]
];

function _isDecorationSlopeId(id) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return false;
  for (const [lo, hi] of _SLOPE_DECO_RANGES) {
    if (n >= lo && n <= hi) return true;
  }
  return false;
}

function rotateSlopePoint(localX, localY, rotDeg) {
  const theta = -rotDeg * Math.PI / 180;
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  return { x: localX * cosT - localY * sinT, y: localX * sinT + localY * cosT };
}

function _createSlopeCollider(levelObj, objectDef, worldX, worldY) {
  const slopeData = _SLOPE_DATA[levelObj.id];
  if (!slopeData) return null;
  if (slopeData.sq) return null;
  if (_isDecorationSlopeId(levelObj.id)) return null;
  const objectScale = getObjectVisualScale(levelObj);
  const native = window.GD_OBJECTS?.[levelObj.id];
  // getObjectRect clamps a negative saved axis to zero after positioning
  // its rectangle using that signed size. It is not an absolute-size ramp.
  // GRIEF uses these signed scales extensively for non-colliding artwork.
  const signedHW = (native?.w > 0 ? native.w : slopeData.gw * a / 2) * objectScale.x;
  const signedHH = (native?.h > 0 ? native.h : slopeData.gh * a / 2) * objectScale.y;
  const hw0 = Math.max(0, signedHW), hh0 = Math.max(0, signedHH);
  let vRight = { x: hw0, y: -hh0 };
  let vLo = { x: -hw0, y: -hh0 };
  let vHi = { x: hw0, y: hh0 };
  const intrinsicFlipX = _resolveSlopeDir(objectDef, false, levelObj.id) < 0;
  // Native determineSlopeDirection reads editor flips and rotation. Signed
  // scale mirrors the sprite, but is not another editor flip for collision:
  // the supplied binary reports direction 0 for all four +/- scale pairs.
  const effectiveFlipX = !!levelObj.flipX !== intrinsicFlipX;
  const effectiveFlipY = !!levelObj.flipY;
  const fx = effectiveFlipX ? -1 : 1;
  const fy = effectiveFlipY ? -1 : 1;
  const flip = pt => ({ x: pt.x * fx, y: pt.y * fy });
  vRight = flip(vRight); vLo = flip(vLo); vHi = flip(vHi);
  const rotDeg = levelObj.rotationX ?? levelObj.rot ?? 0;
  vRight = rotateSlopePoint(vRight.x, vRight.y, rotDeg);
  vLo = rotateSlopePoint(vLo.x, vLo.y, rotDeg);
  vHi = rotateSlopePoint(vHi.x, vHi.y, rotDeg);
  const xs = [vRight.x, vLo.x, vHi.x];
  const ys = [vRight.y, vLo.y, vHi.y];
  const w = 2 * Math.max(...xs.map(Math.abs));
  const h = 2 * Math.max(...ys.map(Math.abs));
  const quarter = Math.abs(Math.round(rotDeg / 90)) % 2 === 1;
  const offsetX = Math.max(0, -(quarter ? signedHH : signedHW));
  const offsetY = Math.max(0, -(quarter ? signedHW : signedHH));
  const collider = new Collider(slopeType, worldX + offsetX, worldY + offsetY, w, h, 0);
  collider.objid = levelObj.id;
  collider.slopeIsHazard = !!window.GDRender?.hasFlag(native, "slopeIsHazard");
  collider.hypoAx = vLo.x; collider.hypoAy = vLo.y;
  collider.hypoBx = vHi.x; collider.hypoBy = vHi.y;
  collider.rightAx = vRight.x; collider.rightAy = vRight.y;
  collider.slopeEffectiveFlipX = effectiveFlipX;
  collider.slopeEditorFlipY = effectiveFlipY;
  collider.slopeRotation = rotDeg;
  collider._initialSlopeGeometry = Object.fromEntries(["hypoAx", "hypoAy", "hypoBx", "hypoBy", "rightAx", "rightAy", "slopeRotation", "w", "h"].map(k => [k, collider[k]]));
  const hypoDx = vHi.x - vLo.x;
  collider.slopeSolidBelow = Math.abs(hypoDx) < 0.01
    ? vRight.x < vLo.x
    : vRight.y < (vLo.y + ((vRight.x - vLo.x) / hypoDx) * (vHi.y - vLo.y));
  collider.slopeIsFilled = slopeData.sq;
  // Use the same geometry-derived flags as Rotate and reset. Looking only
  // at endpoint Y reverses m_slopeUphill when the endpoint X order reverses
  // (mirrored slopes and -90/180 turns), so first load disagreed with reset.
  collider.rotateSlope(0);
  return collider;
}

const flyPortal = "fly";
const cubePortal = "cube";
const portalWaveType = "portal_wave";
const portalUfoType = "portal_ufo";
const allObjects = window.allobjects();
// The 2.2 green portal teleports to a group rather than a paired exit.
// The legacy art catalogue classified it as decoration.
if (allObjects[2902]) Object.assign(allObjects[2902], {type: portalType, sub:'teleport'});
// The older native capture contains colour-sprite setup and animation tracks
// which run after construction and are absent from some GD_OBJECTS trees.
window.GD_OBJECT_VISUALS = allObjects;
for (const [objId, objectDef] of Object.entries(allObjects || {})) {
  if (!objectDef || typeof objectDef !== "object") continue;
  if (objectDef.glow === true || (objectDef.glow_frame && objectDef.glow_frame !== "none")) {
    objectDef.glow = true;
  }
}
// Legacy colour triggers still used by the official 1.9-era levels were
// missing from the generated object catalogue, so they never reached the
// trigger parser at all.
for (const legacyColorId of [717, 718]) {
  if (!allObjects[legacyColorId]) {
    allObjects[legacyColorId] = {
      type: triggerType,
      frame: "edit_eTintCol01Btn_001.png",
      editorFrame: "edit_eTintCol01Btn_001.png",
      spritesheet: "GJ_GameSheet02-uhd",
      gridW: 1,
      gridH: 1,
      can_color: false,
      glow_frame: "none"
    };
  }
}
if (!allObjects[745]) {
  allObjects[745] = {
    "can_color": false,
    "default_base_color_channel": 0,
    "frame": "portal_16_front_001.png",
    "glow_frame": "portal_16_front_glow_001.png",
    "gridH": 2.866666555404663,
    "gridW": 1.1333333253860474,
    "spritesheet": "GJ_GameSheet02-uhd",
    "type": "portal",
    "z": 10,
    "portalParticle": true,
    "portalParticleColor": 0xffff00
  };
}
if (!allObjects[1331]) {
  allObjects[1331] = {
    "can_color": false,
    "default_base_color_channel": 0,
    "frame": "portal_17_front_001.png",
    "glow_frame": "portal_17_front_glow_001.png",
    "gridH": 2.866666555404663,
    "gridW": 1.1333333253860474,
    "spritesheet": "GJ_GameSheet02-uhd",
    "type": "portal",
    "z": 10,
    "portalParticle": true,
    "portalParticleColor": 0x00ffff
  };
}
const _speedPortalIds = [200, 201, 202, 203, 1334];
for (const _spId of _speedPortalIds) {
  if (!allObjects[_spId] || allObjects[_spId].type !== "speed") {
    allObjects[_spId] = Object.assign({
      gridW: 1,
      gridH: 1,
    }, allObjects[_spId] || {}, { type: "speed" });
  }
}

const GD_SPEED_PIXELS_PER_SECOND = {
  HALF: 502.38,
  ONE_TIMES: 623.16,
  TWO_TIMES: 774.84,
  THREE_TIMES: 936.0,
  FOUR_TIMES: 1152.0
};

function getSpeedPixelsPerSecondFromKey(speedKey) {
  const speedValues = [
    GD_SPEED_PIXELS_PER_SECOND.ONE_TIMES,
    GD_SPEED_PIXELS_PER_SECOND.HALF,
    GD_SPEED_PIXELS_PER_SECOND.TWO_TIMES,
    GD_SPEED_PIXELS_PER_SECOND.THREE_TIMES,
    GD_SPEED_PIXELS_PER_SECOND.FOUR_TIMES
  ];
  const parsed = parseInt(speedKey ?? 0, 10);
  return speedValues[parsed] ?? GD_SPEED_PIXELS_PER_SECOND.ONE_TIMES;
}

function getSpeedPixelsPerSecondForPortalId(id) {
  const speedMap = {
    200: GD_SPEED_PIXELS_PER_SECOND.HALF,
    201: GD_SPEED_PIXELS_PER_SECOND.ONE_TIMES,
    202: GD_SPEED_PIXELS_PER_SECOND.TWO_TIMES,
    203: GD_SPEED_PIXELS_PER_SECOND.THREE_TIMES,
    1334: GD_SPEED_PIXELS_PER_SECOND.FOUR_TIMES
  };
  return speedMap[parseInt(id ?? 0, 10)] ?? null;
}

function getSpeedPortalValueForId(id) {
  const speedMap = {
    200: SpeedPortal.HALF,
    201: SpeedPortal.ONE_TIMES,
    202: SpeedPortal.TWO_TIMES,
    203: SpeedPortal.THREE_TIMES,
    1334: SpeedPortal.FOUR_TIMES
  };
  return speedMap[parseInt(id ?? 0, 10)] ?? null;
}

// LevelTools' route is shared by music seeking and Start Pos effect loading.
// It follows trigger channels and the travel axis, including reverse, warp and
// teleport events. It never runs player collision or invents player input.
class GDLevelTimeline {
  constructor(objects, startSpeedKey = 0) {
    this.segments = [];
    const speedKeys = {200:1,201:0,202:2,203:3,1334:4};
    const speeds = [311.5801086425781,251.1600799560547,387.4201354980469,468.0001525878906,576.0001831054688];
    const directions = {1:[0,1],2:[0,-1],3:[-1,0],4:[1,0]};
    const channels = new Map(), groups = new Map();
    for (const obj of objects) {
      for (const g of String(obj?.groups || '').split('.')) if (+g > 0 && !groups.has(+g)) groups.set(+g,obj);
      if (!obj || !([1917,1935,2900,2902].includes(obj.id) || obj.id in speedKeys)) continue;
      const r = obj._raw || {};
      if (r[62] === '1' || r[11] === '1' && [1917,1935,2900].includes(obj.id)) continue;
      const channel = +r[170] || 0;
      if (!channels.has(channel)) channels.set(channel,[]);
      channels.get(channel).push({obj, order:+r[115] || 0, used:false});
    }
    let x=0,y=0,u=[1,0],channel=0,speed=speeds[startSpeedKey] || speeds[0],warp=1,time=0,order=0;
    const position = (obj) => {
      const def=window.GD_OBJECTS?.[obj.id], sx=(obj.scale || 1)*(obj.scaleX || 1),sy=(obj.scale || 1)*(obj.scaleY || 1);
      const angle=-(obj.rot || 0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      let px=obj.x,py=obj.y+90;
      if (obj.id in speedKeys || obj.id===2902) {
        const ox=(def?.bo?.[0] || 0)*sx*(obj.flipX?-1:1),oy=(def?.bo?.[1] || 0)*sy*(obj.flipY?-1:1);
        px+=ox*c-oy*s;py+=ox*s+oy*c;
        const halfX=(Math.abs(c*(def?.w || 0)*sx)+Math.abs(s*(def?.h || 0)*sy))/2+15;
        const halfY=(Math.abs(s*(def?.w || 0)*sx)+Math.abs(c*(def?.h || 0)*sy))/2+15;
        px-=u[0]*halfX;py-=u[1]*halfY;
      }
      return [Math.max(0,px),Math.max(0,py)];
    };
    // Each authored event is consumed once, including channels re-entered later.
    const count=[...channels.values()].reduce((n,list)=>n+list.length,0);
    for(let i=0;i<=count;i++) {
      let next=null,point=null,progress=Infinity;
      for(const candidate of channels.get(channel) || []) {
        if(candidate.used) continue;
        const p=position(candidate.obj), d=(p[0]-x)*u[0]+(p[1]-y)*u[1];
        if(!next || candidate.order<next.order || candidate.order===next.order && d<progress) {next=candidate;point=p;progress=d;}
      }
      const distance=next?Math.max(0,progress):Infinity,velocity=speed*warp;
      const duration=distance/velocity;
      this.segments.push({time,end:time+duration,x,y,ux:u[0],uy:u[1],channel,order,speed:velocity,warp,event:next?.obj || null});
      if(!next) break;
      time+=duration;
      const oldU=u;
      // A turn writes both coordinates; other events only advance travel.
      x+=u[0]*distance;y+=u[1]*distance;
      next.used=true;order=next.order;
      const obj=next.obj,r=obj._raw || {};
      if(obj.id in speedKeys) speed=speeds[speedKeys[obj.id]];
      else if(obj.id===1917) u=[-u[0],-u[1]];
      else if(obj.id===1935) warp=Math.max(.01,+r[120] || 1);
      else if(obj.id===2900) {
        if(r[172]!=='1') {
          const type=_gdSlopeType(!!obj.flipX,!!obj.flipY,obj.rot || 0);
          const defaults=[4,4,3,3,2,1,1,2];
          u=directions[+r[167]] || directions[defaults[type ?? 0]];
        }
        if(Math.abs(oldU[1])!==Math.abs(u[1])) {x=point[0];y=point[1];}
        if(r[171]==='1') {channel=+r[173] || 0;order=0;}
      } else if(obj.id===2902) {
        const target=groups.get(+r[51]);
        if(target) {
          if(r[352]!=='1') x+=target.x-point[0];
          if(r[353]!=='1') y+=target.y+90-point[1];
        }
      }
    }
  }
  timeForPosition(worldX,worldY=0,channel=0,order=0) {
    const x=worldX/2,y=worldY/2+90;
    for(const s of this.segments) {
      if(s.channel!==channel || s.order<order) continue;
      const distance=(x-s.x)*s.ux+(y-s.y)*s.uy;
      if(distance>=-1e-6 && s.time+distance/s.speed<=s.end+1e-6) return Math.max(0,s.time+distance/s.speed);
    }
    return 0;
  }
  positionAt(time) {
    const s=this.segments.find(s=>time<s.end-1e-9) || this.segments[this.segments.length-1];
    const distance=Math.max(0,time-s.time)*s.speed;
    return {x:(s.x+s.ux*distance)*2,y:(s.y+s.uy*distance-90)*2,channel:s.channel,ux:s.ux,uy:s.uy,warp:s.warp};
  }
}
function calculateSongOffsetForX(targetX, startSpeedKey = 0, sourceObjects = null) {
  return new GDLevelTimeline(Array.isArray(sourceObjects)?sourceObjects:[],startSpeedKey).timeForPosition(Math.max(0,+targetX || 0));
}
window.calculateGeometryDashSongOffsetForX = calculateSongOffsetForX;

const objsWithGlow = [1, 2, 3, 4, 6, 7, 83, 84, 1332, 67, 8, 39, 103, 392, 35, 36, 40, 140, 141, 62, 65, 66, 68, 195, 196, 1022, 1594];
for (let obj of objsWithGlow) {
  if (allObjects[obj]) {
    allObjects[obj].glow = true;
  }
}

window._animatedSprites = [];
window._animTimer = 0;
const SECRET_COIN_OBJECT_ID = 142;
const USER_COIN_OBJECT_ID = 1329;
const SECRET_COIN_MAX_PER_LEVEL = 3;
const SECRET_COIN_ANIM_FRAMES = [
  "secretCoin_b_01_001.png",
  "secretCoin_b_01_002.png",
  "secretCoin_b_01_003.png",
  "secretCoin_b_01_004.png"
];
const USER_COIN_ANIM_FRAMES = [
  "secretCoin_2_b_01_001.png",
  "secretCoin_2_b_01_002.png",
  "secretCoin_2_b_01_003.png",
  "secretCoin_2_b_01_004.png"
];
function getObjectFromId(id) {
  return allObjects[id] || null;
}

// GJBaseGameLayer's collision cells: 100 native points (37a0 = 0.01f; web
// units are doubled). An object's cell keeps the unrounded product, so one
// exactly on a 100-point line lies in the lower cell (native wide-portal
// controls: centres 400/1000/4500/7000/10500 sit in cells 3/9/44/69/104).
// The player's cell is checkCollisions' float mulss + cvttss2si.
function gdCollisionCell(webCoordinate) {
  return Math.max(0, Math.trunc(Math.fround((Number(webCoordinate) || 0) / 2) * Math.fround(0.01)));
}
function gdPlayerCollisionCell(webCoordinate) {
  return Math.max(0, Math.trunc(Math.fround(Math.fround((Number(webCoordinate) || 0) / 2) * Math.fround(0.01))));
}

window.LevelObject = class LevelObject {
  constructor(scene, cameraXRef) {
    this._scene = scene;
    this._cameraXRef = cameraXRef;
    this.additiveContainer = scene.add.container(0, 0).setDepth(-1);
    this.container = scene.add.container(0, 0);
    this.topContainer = scene.add.container(0, 0).setDepth(13);
    // Gameplay draws level objects with the GD batch-node renderer; the
    // editor keeps its sprite based path.
    this.gdRenderer = (!window.isEditor && window.GDRenderer && window.GD_OBJECTS && scene.game.renderer.type === Phaser.WEBGL)
      ? new window.GDRenderer(scene)
      : null;
    this.gdObjects = {};
    this.shaderState = this.gdRenderer && window.GDShaderState ? new window.GDShaderState(this) : null;
    this.cameraState = this.gdRenderer && window.GDCameraState ? new window.GDCameraState(this) : null;
    this.gameplayState = window.GDGameplayState ? new window.GDGameplayState(this) : null;
    this.logicState = window.GDLogicState ? new window.GDLogicState(this) : null;
    this._logicTriggers = [];
    this._logicTriggerIdx = 0;
    this.keyframeState = this.gdRenderer && window.GDKeyframeState ? new window.GDKeyframeState(this) : null;
    this._keyframeTriggers = [];
    this._keyframeTriggerIdx = 0;
    this.gradientState = this.gdRenderer && window.GDGradientState ? new window.GDGradientState(this) : null;
    if (this.gdRenderer) this.gdRenderer.gradientState = this.gradientState;
    this._gradientTriggers = [];
    this._gradientTriggerIdx = 0;
    this._gameplayTriggers = [];
    this._gameplayTriggerIdx = 0;
    this._shaderTriggers = [];
    this._shaderTriggerIdx = 0;
    this._cameraTriggers = [];
    this._cameraTriggerIdx = 0;
    // Area Move/Rotate/Scale/Fade/Tint and Edit Area triggers (gd-area.js).
    this.areaState = this.gdRenderer && window.GDAreaState ? new window.GDAreaState(this) : null;
    if (this.gdRenderer) this.gdRenderer.areaState = this.areaState;
    this.enterState = this.gdRenderer && window.GDEnterState ? new window.GDEnterState(this) : null;
    if (this.gdRenderer) this.gdRenderer.enterState = this.enterState;
    this._areaTriggers = [];
    this._areaTriggerIdx = 0;
    this.advFollowState = this.gdRenderer && window.GDAdvancedFollowState ? new window.GDAdvancedFollowState(this) : null;
    this._advFollowTriggers = [];
    this._advFollowTriggerIdx = 0;
    this._gameplayChannel = 0;
    this._channelDirections = { 0: { x: 1, y: 0 } };
    this._initialChannelDirections = structuredClone(this._channelDirections);
    this._channelCursors = {};
    this._channelLists = new Map();
    if (this.gdRenderer) {
      // B layers sit below the player (z 59 in GD's object layer), T layers
      // above it but below the ground.
      this.gdRenderer.createLayers(0.5, 11);
      this._gdPostUpdate = (time, delta) => this._syncGDRenderer(delta);
      scene.events.on("postupdate", this._gdPostUpdate);
      scene.events.once("shutdown", () => {
        scene.events.off("postupdate", this._gdPostUpdate);
        this.gdRenderer.destroy();
      });
    }
    this.objects = [];
    this.endXPos = 0;
    this._groundY = 0;
    this._ceilingY = null;
    this._flyGroundActive = false;
    this._groundAnimFrom = 0;
    this._groundAnimTo = 0;
    this._groundAnimTime = 0;
    this._groundAnimDuration = 0;
    this._groundAnimating = false;
    this._groundTargetValue = 0;
    this._flyFloorY = 0;
    this._flyCeilingY = null;
    this._flyVisualOnly = false;
    this._flyVisualFloorInset = 0;
    this._flyVisualCeilingInset = 0;
    this.flyCameraTarget = null;
    this._colorTriggers = [];
    this._colorTriggerIdx = 0;
    this._touchColorTriggerActivated = new Set();
    this._touchSpawnTriggerActivated = new Set();
    this._touchMoveTriggerActivated = new Set();
    this._audioScaleSprites = [];
    this._editorTriggerVisuals = [];
    this._deferredTriggerVisuals = [];
    this._orbSprites = [];
    this._coinSprites = [];
    this._secretCoinRunCollected = new Set();
    this._secretCoinCompleted = new Set();
    this._secretCoinSlotCount = 0;
    this._userCoinRunCollected = new Set();
    this._userCoinCompleted = new Set();
    this._userCoinSlotCount = 0;
    this._sawSprites = [];
    this._beastAnimations = [];
    this._beastAnimationClock = 0;
    this._animationTriggers = [];
    this._animationTriggerIdx = 0;
    this._touchAnimationTriggerActivated = new Set();
    this._glowSpriteKeys = new Set();
    this._enterEffectTriggers = [];
    this._enterEffectTriggerIdx = 0;
    this._activeEnterEffect = 0;
    this._activeExitEffect = 0;
    this._moveTriggers = [];
    this._moveTriggerIdx = 0;
    this._activeMoveTweens = [];
    this._followTriggers = [];
    this._followTriggerIdx = 0;
    this._activeFollowTweens = [];
    this._scaleTriggers = [];
    this._scaleTriggerIdx = 0;
    this._activeScaleTweens = [];
    this._alphaTriggers = [];
    this._alphaTriggerIdx = 0;
    this._activeAlphaTweens = [];
    this._toggleTriggers = [];
    this._toggleTriggerIdx = 0;
    this._touchToggleTriggerActivated = new Set();
    this._shakeTriggers = [];
    this._shakeTriggerIdx = 0;
    this._stopTriggers = [];
    this._stopTriggerIdx = 0;
    this._touchStopTriggerActivated = new Set();
    this._rotateTriggers = [];
    this._rotateTriggerIdx = 0;
    this._activeRotateTweens = [];
    this._pulseTriggers = [];
    this._pulseTriggerIdx = 0;
    this._activePulses = [];
    this._spawnTriggers = [];
    this._spawnTriggerIdx = 0;
    this._activeSpawnDelays = [];
    this._spawnActivated = new Set();
    this._spawnIndexCache = null;
    this._spawnClock = 0;
    this._spawnStepOf = new Map();
    this._spawnLoopCount = 0;
    this._countTriggers = [];
    this._endTriggers = [];
    this._endTriggerIdx = 0;
    this._countTriggerIdx = 0;
    this._itemCounts = new Map();
    this._counterLabels = [];
    this._collectedPickups = new Set();
    this._countWatchers = [];
    this._touchAdditional = new Set();
    this._colorChannelSprites = {};
    this._colorChannelsNeedFullApply = true;
    this._ground2Tint = 0xffffff;
    this._groupSprites = {};
    this._resetobject = {};
    this._resetremovedobject = {};
    this._groupOffsets = {};
    this._groupOpacity = {};
    this._groupEnabled = {};
    this._groupColliders = {};
    const level = this;
    if (this.gdRenderer) this.gdRenderer.groupState = {
      opacity: id => this._groupOpacity[id] ?? 1,
      enabled: id => this._groupEnabled[id] !== false,
      // The live maps (replaced on reset/restore), for the renderer's loops.
      get opacityMap() { return level._groupOpacity; },
      get enabledMap() { return level._groupEnabled; }
    };
    this._sections = [];
    this._sectionContainers = [];
    this._collisionSections = [];
    this._nearbyBuffer = [];
    this._visMinSec = -1;
    this._visMaxSec = -1;
    this._groundStartScreenY = b(0);
    this._ceilingStartScreenY = 0;
    this._activeStartPosIndex = -1; 
    this._startPositions = [];
    this._debugIdTextsList = [];
    this._buildGround();
    scene.events.once("create", () => {
      // Older levels can hide the real player behind authored artwork
      // without any 2.2 camera/shader commands (WHAT does this at x=-29).
      // Hide Player and Options use the same camera visibility filters.
      if (this._cameraTriggers.length || this._shaderTriggers.length || this._gradientTriggers.length ||
          this._logicTriggers.some(t => [1612, 1613, 2899].includes(t.id))) this.cameraState?.attach();
      if (this._shaderTriggers.length) this.shaderState?.attach();
    });
  }
  getStartPositions() {
      return this._startPositions.slice().sort((a, b) => a.x - b.x);
  }

  // Runs after GameScene.update: mirrors the camera/shake/mirror state the
  // scene applied to the sprite containers into the GD renderer.
  _syncGDRenderer(frameDelta) {
    const renderer = this.gdRenderer;
    const scene = this._scene;
    if (!renderer || !scene) return;
    const simulationDelta = Number(scene._gdRenderDeltaMs) || 0;
    scene._gdRenderDeltaMs = 0;
    const container = this.container;
    const visible = !!container?.visible && !scene._menuActive;
    renderer.setVisible(visible);
    if (!visible) return;
    renderer.colorManager = scene._colorManager;
    const cameraX = Number(scene._cameraX) || 0;
    const cameraY = Number(scene._cameraY) || 0;
    const mirror = Number.isFinite(container.scaleX) ? container.scaleX : 1;
    const cx = screenWidth / 2;
    let shakeX = 0;
    if (Math.abs(mirror) > 1e-4) shakeX = cx + (container.x - cx) / mirror + cameraX;
    const shakeY = (Number(container.y) || 0) - cameraY;
    renderer.camera.mirror = mirror;
    renderer.camera.mirrorCenter = cx;
    renderer.setCamera(cameraX, cameraY, shakeX, shakeY);
    this.cameraState?.syncRendererBounds(renderer);
    // applyTimeWarp changes the native CC scheduler's time scale (0x33efa0).
    // Accumulate the actual fixed steps: the warp can change within one
    // rendered frame, and high refresh rates can render without a new tick.
    const editorDelta = window.isEditor ? (Number(frameDelta) || Number(scene.game?.loop?.delta) || 16.67) : 0;
    const dt = scene._paused ? 0 : (simulationDelta || editorDelta) / 1000;
    renderer.update(dt);
  }

  _breakblock(linkedObjectId) {
    if (!Number.isInteger(linkedObjectId)) return false;
    this._liveObjectIds?.delete(linkedObjectId);
    this.gdRenderer?.removeObject(this.gdObjects[linkedObjectId]);
    delete this.gdObjects[linkedObjectId];

    const spriteList = this.objectSprites?.[linkedObjectId];
    if (Array.isArray(spriteList)) {
      for (const sprite of [...spriteList]) {
        if (!sprite) continue;
        if (sprite._eeIsGlowSprite && Array.isArray(this._glowSprites)) {
          const glowIdx = this._glowSprites.indexOf(sprite);
          if (glowIdx !== -1) this._glowSprites.splice(glowIdx, 1);
        }
        if (typeof sprite.destroy === "function") {
          sprite.destroy();
        }
      }
      delete this.objectSprites[linkedObjectId];
    }

    if (Array.isArray(this._glowSprites)) {
      for (const glow of [...this._glowSprites]) {
        if (glow && glow._eeObjectId === linkedObjectId) {
          if (typeof glow.destroy === "function") glow.destroy();
          const glowIdx = this._glowSprites.indexOf(glow);
          if (glowIdx !== -1) this._glowSprites.splice(glowIdx, 1);
        }
      }
    }

    if (this._glowSpriteKeys) {
      const remainingGlowKeys = new Set();
      for (const glow of this._glowSprites || []) {
        if (!glow || !glow.texture || !glow.frame) continue;
        const key = `${glow._eeWorldX ?? glow.x}:${glow._eeBaseY ?? glow.y}:${glow.texture.key}/${glow.frame.name || glow.frame.textureFrame || glow.frame.key || glow.frame}`;
        if (key) remainingGlowKeys.add(key);
      }
      this._glowSpriteKeys = remainingGlowKeys;
    }

    const collidersToRemove = [];
    for (const collider of this.objects || []) {
      if (collider && collider._eeObjectId === linkedObjectId) {
        collidersToRemove.push(collider);
      }
    }

    for (const collider of collidersToRemove) {
      if (!collider) continue;
      this._removeCollisionFromSections(collider);

      const objectsIdx = this.objects.indexOf(collider);
      if (objectsIdx !== -1) this.objects.splice(objectsIdx, 1);

      const groupIds = Array.isArray(collider._eeGroups) ? collider._eeGroups : [];
      for (const groupId of groupIds) {
        const groupColliders = this._groupColliders?.[groupId];
        if (Array.isArray(groupColliders)) {
          const groupIdx = groupColliders.indexOf(collider);
          if (groupIdx !== -1) groupColliders.splice(groupIdx, 1);
          if (!groupColliders.length) delete this._groupColliders[groupId];
        }
      }
    }

    const restoreLevelObj = this._resetobject?.[linkedObjectId];
    if (restoreLevelObj) {
      this._resetremovedobject[linkedObjectId] = restoreLevelObj;
      delete this._resetobject[linkedObjectId];
    }

    return true;
  }

  _resetremovedobjects() {
    if (!this._resetremovedobject || !Object.keys(this._resetremovedobject).length) {
      return;
    }

    const entries = Object.entries(this._resetremovedobject);
    this._resetremovedobject = {};
    for (const [, levelObj] of entries) {
      if (!levelObj) continue;
      if (parseInt(levelObj.id ?? 0, 10) !== 143) continue;
      this._spawnObject(levelObj);
    }
  }

  getStartTimeline() {
    return this._startTimeline ||= new GDLevelTimeline(this._sourceLevelObjects || [],+this._baseSettingsMap?.kA4 || 0);
  }
  getSongOffsetForX(targetX, options = {}) {
    const timeline=options.sourceObjects || options.startSpeedKey!==undefined
      ? new GDLevelTimeline(options.sourceObjects || this._sourceLevelObjects || [],options.startSpeedKey ?? this._baseSettingsMap?.kA4 ?? 0)
      : this.getStartTimeline();
    return timeline.timeForPosition(targetX,options.y || 0,options.channel || 0,options.order || 0);
  }

  _isTriggerSpawnTriggered(levelObj) {
    return String(levelObj?._raw?.[62] ?? levelObj?._raw?.["62"] ?? "0") === "1";
  }

  _getTeleportPortalYOffset(levelObj) {
    const raw = levelObj?._raw || {};
    const hasOffset = raw[54] !== undefined || raw["54"] !== undefined;
    const parsed = parseFloat(hasOffset ? (raw[54] ?? raw["54"]) : 90);
    return Number.isFinite(parsed) ? parsed : 90;
  }

  _normalizeTeleportPortals(levelObjects) {
    if (!Array.isArray(levelObjects)) return [];

    const normalized = [];
    const standaloneExitPortals = [];

    for (const obj of levelObjects) {
      if (!obj) continue;
      if (parseInt(obj.id ?? 0, 10) === 749) {
        standaloneExitPortals.push(obj);
      } else {
        normalized.push(obj);
      }
    }

    for (const exitObj of standaloneExitPortals) {
      const exitX = parseFloat(exitObj.x ?? exitObj._raw?.[2] ?? exitObj._raw?.["2"] ?? 0) || 0;
      let enterObj = null;
      let bestDistance = Infinity;

      for (const candidate of normalized) {
        if (!candidate || parseInt(candidate.id ?? 0, 10) !== 747) continue;
        const candidateX = parseFloat(candidate.x ?? candidate._raw?.[2] ?? candidate._raw?.["2"] ?? 0) || 0;
        const distance = Math.abs(candidateX - exitX);
        if (distance < bestDistance) {
          bestDistance = distance;
          enterObj = candidate;
        }
      }

      if (enterObj) {
        const enterY = parseFloat(enterObj.y ?? enterObj._raw?.[3] ?? enterObj._raw?.["3"] ?? 0) || 0;
        const exitY = parseFloat(exitObj.y ?? exitObj._raw?.[3] ?? exitObj._raw?.["3"] ?? enterY) || enterY;
        const yOffset = exitY - enterY;
        enterObj._raw = enterObj._raw || {};
        enterObj._raw[54] = String(yOffset);
        enterObj._raw["54"] = String(yOffset);
      }
    }

    return normalized.filter(Boolean);
  }

  _getLevelObjectGroupIds(levelObj) {
    const values = [];
    const addRawGroups = (rawGroups) => {
      String(rawGroups ?? "")
        .split(".")
        .map(value => parseInt(value, 10))
        .filter(value => Number.isFinite(value) && value > 0)
        .forEach(value => values.push(value));
    };

    addRawGroups(levelObj?._raw?.[33] ?? levelObj?._raw?.["33"]);
    addRawGroups(levelObj?._raw?.[57] ?? levelObj?._raw?.["57"]);
    addRawGroups(levelObj?.groups);

    return [...new Set(values)];
  }

  _parseSingleTriggerGroupId(value, fallback = 0) {
    const parts = String(value ?? "")
      .split(/[,.]/)
      .map(part => parseInt(part.trim(), 10))
      .filter(groupId => Number.isFinite(groupId) && groupId > 0);
    return parts.length ? parts[0] : fallback;
  }

  _parseRotateTriggerGroups(raw) {
    const targetRaw = raw?.[51] ?? raw?.["51"] ?? 0;
    const centerRaw = raw?.[71] ?? raw?.["71"] ?? 0;
    const targetParts = String(targetRaw ?? "")
      .split(/[,.]/)
      .map(part => parseInt(part.trim(), 10))
      .filter(groupId => Number.isFinite(groupId) && groupId > 0);
    const centerParts = String(centerRaw ?? "")
      .split(/[,.]/)
      .map(part => parseInt(part.trim(), 10))
      .filter(groupId => Number.isFinite(groupId) && groupId > 0);
    const targetGroup = targetParts.length ? targetParts[0] : 0;
    const centerGroup = centerParts.length ? centerParts[0] : 0;
    return { targetGroup, centerGroup };
  }

  _makeTriggerBase(levelObj, linkedObjectId) {
    return {
      uid: linkedObjectId,
      x: levelObj.x * 2,
      y: levelObj.y * 2,
      touchTriggered: levelObj._raw?.[11] === "1",
      multiTriggered: levelObj._raw?.[87] === "1",
      spawnTriggered: this._isTriggerSpawnTriggered(levelObj),
      channel: Number(levelObj._raw?.[170]) || 0,
      controlId: Number(levelObj._raw?.[534]) || 0,
      groups: this._getLevelObjectGroupIds(levelObj)
    };
  }

  _triggerHasGroup(trigger, groupId) {
    const target = parseInt(groupId ?? 0, 10);
    return target > 0 && Array.isArray(trigger?.groups) && trigger.groups.includes(target);
  }
  // Native meets the X triggers by their whole X, then by creation, and stops at
  // the first still ahead: within one X unit a later trigger waits for an earlier
  // one further on (native LIMBO X34193 waits for X34193.5).
  _triggerGates() {
    if (this._triggerGateMap) return this._triggerGateMap;
    const gates = this._triggerGateMap = new Map(), units = new Map();
    for (const name of ["_colorTriggers", "_enterEffectTriggers", "_moveTriggers", "_followTriggers", "_scaleTriggers", "_alphaTriggers",
      "_toggleTriggers", "_animationTriggers", "_shakeTriggers", "_stopTriggers", "_rotateTriggers", "_pulseTriggers", "_spawnTriggers",
      "_countTriggers", "_shaderTriggers", "_cameraTriggers", "_gradientTriggers", "_gameplayTriggers", "_areaTriggers", "_advFollowTriggers",
      "_endTriggers", "_keyframeTriggers", "_logicTriggers"]) {
      for (const trig of this[name] || []) {
        if (trig.spawnTriggered || trig.touchTriggered || !Number.isFinite(trig.x)) continue;
        const unit = Math.floor(trig.x / 2);
        if (!units.has(unit)) units.set(unit, []);
        units.get(unit).push(trig);
      }
    }
    for (const list of units.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => (a.uid ?? 0) - (b.uid ?? 0));
      let far = -Infinity;
      for (const trig of list) {
        far = Math.max(far, trig.x);
        if (far > trig.x) gates.set(trig, far);
      }
    }
    return gates;
  }
  *_orderedTriggers(listName, indexName, playerX, playerY = this._scene?._state?.y || 0) {
    const channel = this._gameplayChannel;
    const direction = this._channelDirections[channel] || { x: 1, y: 0 };
    const gates = direction.x === 1 && !direction.y ? this._triggerGates() : null;
    const key = `${listName}:${channel}:${direction.x}:${direction.y}`;
    let list = this._channelLists.get(key);
    if (!list) {
      list = this[listName].filter(trig => (trig.channel || 0) === channel);
      if (gates) list.sort((a, b) => Math.floor(a.x / 2) - Math.floor(b.x / 2) || (a.uid ?? 0) - (b.uid ?? 0));
      else list.sort((a, b) => ((a.x - b.x) * direction.x + ((a.y || 0) - (b.y || 0)) * direction.y));
      this._channelLists.set(key, list);
    }
    const cursors = this._channelCursors[indexName] ||= {};
    let index = channel === 0 ? this[indexName] : (cursors[channel] || 0);
    const progress = playerX * direction.x + playerY * direction.y;
    while (index < list.length) {
      const trig = list[index];
      if ((gates?.get(trig) ?? trig.x) * direction.x + (trig.y || 0) * direction.y > progress + 1e-8) break;
      index++;
      if (channel === 0) this[indexName] = index; else cursors[channel] = index;
      if (trig.spawnTriggered || trig.touchTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      yield trig;
      if (this._gameplayChannel !== channel) break;
      // A spawned command can flush earlier commands from another category,
      // which can itself re-enter this list. Resume at the shared cursor so
      // an outer iterator cannot activate the same command a second time.
      index = Math.max(index, channel === 0 ? this[indexName] : (cursors[channel] || 0));
    }
  }
  // Touch-activated (and not spawn-activated) triggers of a list, cached:
  // scanning every trigger of a list each frame costs milliseconds in levels
  // with tens of thousands of triggers.
  // Touch triggers near player x. GD tests them through its collision
  // sections; testing every touch trigger of a list at 240 Hz is the slow
  // path. Ungrouped triggers never move, so they are bucketed by the X range
  // of their (scaled, rotated) activation rectangle; grouped ones can be
  // moved anywhere and are always tested. Level order is preserved.
  _touchCandidates(list, px) {
    if (!Array.isArray(list)) return [];
    const cache = this._touchListCache ||= new WeakMap();
    let entry = cache.get(list);
    if (!entry || entry.length !== list.length) {
      const items = list.filter(trig => trig && trig.touchTriggered && !trig.spawnTriggered);
      const dynamic = [], buckets = new Map();
      items.forEach((trig, index) => {
        trig._touchOrder = index;
        const node = this.gdObjects?.[trig.uid];
        if (node && node.groups?.length) { dynamic.push(trig); return; }
        const x = node ? node.x * 2 : Number(trig.x) || 0;
        const reach = node ? (Math.abs(node.scaleX) + Math.abs(node.scaleY)) * 30 + 90 : 90;
        for (let sec = Math.floor((x - reach) / 400), last = Math.floor((x + reach) / 400); sec <= last; sec++) {
          let bucket = buckets.get(sec);
          if (!bucket) buckets.set(sec, bucket = []);
          bucket.push(trig);
        }
      });
      entry = { length: list.length, items, dynamic, buckets, out: [], section: null };
      cache.set(list, entry);
    }
    if (!Number.isFinite(px) || entry.items.length < 48) return entry.items;
    const section = Math.floor(px / 400);
    if (entry.section === section) return entry.out;
    const out = entry.out, bucket = entry.buckets.get(section);
    out.length = 0;
    for (const trig of entry.dynamic) out.push(trig);
    if (bucket) for (const trig of bucket) out.push(trig);
    if (entry.dynamic.length && bucket?.length) out.sort((a, b) => a._touchOrder - b._touchOrder);
    entry.section = section;
    return out;
  }

  _touchesTrigger(trig, x, y, halfSize) {
    const node = this.gdObjects[trig.uid];
    if (node?.levelObj.noTouch || (window.enableLDM && node?.highDetail)) return false;
    const live = node && this.gdRenderer ? this.gdRenderer.livePosition(node) : null;
    // moveObjects (3369c5): a touch trigger, like a speed portal (2c8), keeps its X.
    const tx = trig.x;
    const ty = live ? live.y * 2 : (trig.y || 0);
    const scene = this._scene;
    const state = scene?._isDual && scene._state2?.y === y ? scene._state2 : scene?._state;
    const playerHalf = state ? (state.isWave ? (state.isMini ? 6 : 10) : Math.fround((state.isSpider ? 27 : 30) * (state.isMini ? Math.fround(0.6) : 1))) : Math.max(0, halfSize - 30);
    if (!node) return Math.abs(x - tx) <= playerHalf + 30 && Math.abs(y - ty) <= playerHalf + 30;
    // Touch triggers are placed GameObjects: independent scale, saved angles,
    // and group transforms affect their 30-point activation rectangle too.
    const rx = -node.rotationX * Math.PI / 180, ry = -node.rotationY * Math.PI / 180;
    const ax = Math.cos(ry) * node.scaleX * 30, ay = Math.sin(ry) * node.scaleX * 30;
    const bx = -Math.sin(rx) * node.scaleY * 30, by = Math.cos(rx) * node.scaleY * 30;
    const m = node.affine;
    const ux = m[0] * ax + m[2] * ay, uy = m[1] * ax + m[3] * ay;
    const vx = m[0] * bx + m[2] * by, vy = m[1] * bx + m[3] * by;
    const dx = x - tx, dy = y - ty;
    if (Math.abs(dx) > Math.abs(ux) + Math.abs(vx) + playerHalf ||
        Math.abs(dy) > Math.abs(uy) + Math.abs(vy) + playerHalf) return false;
    for (const [nx, ny] of [[-uy, ux], [-vy, vx]]) {
      const reach = Math.abs(ux * nx + uy * ny) + Math.abs(vx * nx + vy * ny) + playerHalf * (Math.abs(nx) + Math.abs(ny));
      if (Math.abs(dx * nx + dy * ny) > reach) return false;
    }
    return true;
  }

  fastForwardTriggers(targetX, colorManager) {
    const triggers = this._colorTriggers.sort((a, b) => a.x - b.x);

    for (let trigger of triggers) {
      if (trigger.touchTriggered || !this._isTriggerSaveObjectLive(trigger.uid)) continue;
      if (trigger.x <= targetX) {
        colorManager.triggerColor(trigger.index, trigger.color, 0, trigger.colorOptions);
      } else {
        break;
      }
    }
  }
  loadLevel(levelData) {
    let {
      objects: levelObjects,
      settings: settingslist
    } = parseLevel(levelData);
    levelObjects = this._normalizeTeleportPortals(levelObjects);
    let secretCoinCount = 0;
    let userCoinCount = 0;
    const isOfficialLevel = this._isOfficialLevel();
    levelObjects = levelObjects.filter(levelObj => {
      const objectId = parseInt(levelObj?.id ?? 0, 10);
      if (objectId === SECRET_COIN_OBJECT_ID && !isOfficialLevel) return false;
      if (objectId === USER_COIN_OBJECT_ID && isOfficialLevel) return false;
      if (objectId === USER_COIN_OBJECT_ID) {
        if (userCoinCount >= SECRET_COIN_MAX_PER_LEVEL) return false;
        userCoinCount++;
        return true;
      }
      if (objectId !== SECRET_COIN_OBJECT_ID) return true;
      if (secretCoinCount >= SECRET_COIN_MAX_PER_LEVEL) return false;
      secretCoinCount++;
      return true;
    });
    window._animatedSprites.length = 0;
    this._secretCoinRunCollected.clear();
    this._secretCoinCompleted = this._loadSecretCoinProgress();
    this._secretCoinSlotCount = 0;
    this._userCoinRunCollected.clear();
    this._userCoinCompleted = window.isEditor ? new Set() : this._loadUserCoinProgress();
    this._userCoinSlotCount = 0;
    this._sourceLevelObjects = levelObjects;
    this._startTimeline = null;
    this._collisionQuery = null;
    // Objects are built before _setUpSettings. Read their font from this
    // level's header, otherwise a level change inherits the previous font.
    this._fontIndex = Number(settingslist.match(/(?:^|,)kA18,([^,]*)/)?.[1]) || 0;
    this._spawnLevelObjects(levelObjects);
    this._setUpSettings(settingslist);
    window.levelObjects = levelObjects;
    window.settingslist = settingslist;
  }

  _isOfficialLevel() {
    const levelId = window.currentlevel?.[2];
    return !!levelId && Array.isArray(window.allLevels) && window.allLevels.some(level => level?.[2] === levelId);
  }

  _isStoredUserLevel() {
    return String(window.currentlevel?.[2] || "").startsWith("local_");
  }

  _secretCoinProgressKey() {
    return `gd_secretCoins_${window.currentlevel?.[2] || "level_1"}`;
  }

  _userCoinProgressKey() {
    return `gd_userCoins_${window.currentlevel?.[2] || "level_1"}`;
  }

  _loadSecretCoinProgress() {
    if (!this._isOfficialLevel()) return new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(this._secretCoinProgressKey()) || "[]");
      return new Set(Array.isArray(saved) ? saved.slice(0, SECRET_COIN_MAX_PER_LEVEL).map(String) : []);
    } catch (_error) {
      return new Set();
    }
  }

  _loadUserCoinProgress() {
    if (window.isEditor || this._isOfficialLevel()) return new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(this._userCoinProgressKey()) || "[]");
      return new Set(Array.isArray(saved) ? saved.slice(0, SECRET_COIN_MAX_PER_LEVEL).map(String) : []);
    } catch (_error) {
      return new Set();
    }
  }

  resetUserCoinsForEditor() {
    this._userCoinRunCollected.clear();
    this._userCoinCompleted.clear();
    for (const sprite of this._coinSprites) {
      if (sprite?._userCoinId === undefined) continue;
      this._setUserCoinAnimation(sprite, false);
      sprite.setVisible(true).setAlpha(1);
    }
    for (const collider of this.objects) {
      if (collider?.userCoinId !== undefined) {
        collider._userCoinCompleted = false;
        collider.activated = false;
      }
    }
  }

  resetCoinsForEditorCompletion() {
    this._editorEndSecretCoinSlots = new Set(
      this._coinSprites
        .filter(sprite => sprite?._secretCoinSlot !== undefined && this._secretCoinRunCollected.has(String(sprite._secretCoinId)))
        .map(sprite => sprite._secretCoinSlot)
        .filter(slot => Number.isInteger(slot))
    );
    this._editorEndUserCoinSlots = new Set(
      this._coinSprites
        .filter(sprite => sprite?._userCoinSlot !== undefined && this._userCoinRunCollected.has(String(sprite._userCoinId)))
        .map(sprite => sprite._userCoinSlot)
        .filter(slot => Number.isInteger(slot))
    );
    this._secretCoinRunCollected.clear();
    this._userCoinRunCollected.clear();
    this._secretCoinCompleted.clear();
    this._userCoinCompleted.clear();
    for (const sprite of this._coinSprites) {
      if (sprite?._secretCoinId !== undefined) this._setSecretCoinAnimation(sprite, false);
      if (sprite?._userCoinId !== undefined) this._setUserCoinAnimation(sprite, false);
      if (sprite) sprite.setVisible(true).setAlpha(1);
    }
    for (const collider of this.objects) {
      if (collider?.secretCoinId !== undefined || collider?.userCoinId !== undefined) {
        collider._secretCoinCompleted = false;
        collider._userCoinCompleted = false;
        collider.activated = false;
      }
    }
  }

  _setSecretCoinAnimation(sprite, collected) {
    if (!sprite) return;
    sprite._animFrames = collected ? SECRET_COIN_ANIM_FRAMES : [
      "secretCoin_01_001.png",
      "secretCoin_01_002.png",
      "secretCoin_01_003.png",
      "secretCoin_01_004.png"
    ];
    sprite._animIdx = 0;
    const frameInfo = getAtlasFrame(this._scene, sprite._animFrames[0]);
    if (frameInfo) sprite.setTexture(frameInfo.atlas, frameInfo.frame);
    sprite._secretCoinCompleted = !!collected;
  }

  _setUserCoinAnimation(sprite, collected) {
    if (!sprite) return;
    sprite._animFrames = collected ? USER_COIN_ANIM_FRAMES : [
      "secretCoin_2_01_001.png",
      "secretCoin_2_01_002.png",
      "secretCoin_2_01_003.png",
      "secretCoin_2_01_004.png"
    ];
    sprite._animIdx = 0;
    const frameInfo = getAtlasFrame(this._scene, sprite._animFrames[0]);
    if (frameInfo) sprite.setTexture(frameInfo.atlas, frameInfo.frame);
    sprite._userCoinCompleted = !!collected;
  }

  tryCollectSecretCoin(collider) {
    if (collider?.secretCoinId === undefined || this._secretCoinCompleted.has(String(collider.secretCoinId))) return false;
    if (this._secretCoinRunCollected.size >= SECRET_COIN_MAX_PER_LEVEL) return false;
    this._secretCoinRunCollected.add(String(collider.secretCoinId));
    return true;
  }

  tryCollectUserCoin(collider) {
    if (collider?.userCoinId === undefined || this._userCoinCompleted.has(String(collider.userCoinId))) return false;
    if (this._userCoinRunCollected.size >= SECRET_COIN_MAX_PER_LEVEL) return false;
    this._userCoinRunCollected.add(String(collider.userCoinId));
    return true;
  }

  commitSecretCoins() {
    if (!this._isOfficialLevel()) return;
    const saved = this._loadSecretCoinProgress();
    const newlyCollected = [...this._secretCoinRunCollected]
      .filter(id => !saved.has(id))
      .slice(0, SECRET_COIN_MAX_PER_LEVEL - saved.size);
    for (const id of newlyCollected) saved.add(id);
    if (!newlyCollected.length) return;

    localStorage.setItem(this._secretCoinProgressKey(), JSON.stringify([...saved].slice(0, SECRET_COIN_MAX_PER_LEVEL)));
    const collectedSlots = this._coinSprites
      .filter(sprite => sprite?._secretCoinId !== undefined && saved.has(String(sprite._secretCoinId)))
      .map(sprite => sprite._secretCoinSlot)
      .filter(slot => Number.isInteger(slot))
      .slice(0, SECRET_COIN_MAX_PER_LEVEL);
    localStorage.setItem(`${this._secretCoinProgressKey()}_slots`, JSON.stringify(collectedSlots));
    this._secretCoinCompleted = saved;
    this._scene._totalsecretcoins = (this._scene._totalsecretcoins || 0) + newlyCollected.length;
    window._totalsecretcoins = this._scene._totalsecretcoins;
    localStorage.setItem("gd_totalsecretcoins", String(this._scene._totalsecretcoins));
    for (const sprite of this._coinSprites) {
      if (sprite?._secretCoinId !== undefined && saved.has(String(sprite._secretCoinId))) {
        this._setSecretCoinAnimation(sprite, true);
        sprite.setVisible(true).setAlpha(1);
      }
    }
  }

  commitUserCoins() {
    if (window.isEditor || this._isOfficialLevel() || this._isStoredUserLevel()) return;
    const saved = this._loadUserCoinProgress();
    const newlyCollected = [...this._userCoinRunCollected]
      .filter(id => !saved.has(id))
      .slice(0, SECRET_COIN_MAX_PER_LEVEL - saved.size);
    for (const id of newlyCollected) saved.add(id);
    if (!newlyCollected.length) return;

    localStorage.setItem(this._userCoinProgressKey(), JSON.stringify([...saved].slice(0, SECRET_COIN_MAX_PER_LEVEL)));
    const collectedSlots = this._coinSprites
      .filter(sprite => sprite?._userCoinId !== undefined && saved.has(String(sprite._userCoinId)))
      .map(sprite => sprite._userCoinSlot)
      .filter(slot => Number.isInteger(slot))
      .slice(0, SECRET_COIN_MAX_PER_LEVEL);
    localStorage.setItem(`${this._userCoinProgressKey()}_slots`, JSON.stringify(collectedSlots));
    this._userCoinCompleted = saved;
    this._scene._totalusercoins = (this._scene._totalusercoins || 0) + newlyCollected.length;
    window._totalusercoins = this._scene._totalusercoins;
    localStorage.setItem("gd_totalusercoins", String(this._scene._totalusercoins));
    for (const sprite of this._coinSprites) {
      if (sprite?._userCoinId !== undefined && saved.has(String(sprite._userCoinId))) {
        this._setUserCoinAnimation(sprite, true);
        sprite.setVisible(true).setAlpha(1);
      }
    }
  }
  _setUpSettings(settingsStr) {
    this._initialColors = {};
    this._backgroundId = null;
    this._groundId = null;
    this._collisionRowsEnabled = false;
    if (!settingsStr) return;
    let pairs = settingsStr.split(",");
    window.settingsMap = {};
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      settingsMap[pairs[i]] = pairs[i + 1];
    }
    this._baseSettingsMap={...settingsMap};
    this.maxGameplayY = settingsMap.kA37 === '1' || settingsMap.kA22 === '1'
      ? ((this._highestObjectNativeY ?? 1200) + 300) * 2 : 5400;
    this._collisionRowsEnabled = settingsMap.kA37 === '1' || settingsMap.kA22 === '1';
    let colorStr = settingsMap["kS38"];
    window._backgroundId = getBackgroundDisplayId(settingsMap["kA6"]);
    window._groundId = getGroundTextureId(settingsMap["kA7"]);
    // ColorAction::setupFromMap: 1-3 colour, 4 player colour, 5 blending,
    // 6 channel, 8 enables 7 (opacity), 9 copy channel, 10 copy HSV,
    // 17 copy opacity. Keys 11-16 only describe an in-progress fade of a
    // saved state; a level start uses the stored colour itself.
    const parseColorProps = (str) => {
      const props = String(str || "").split("_");
      const cp = {};
      for (let j = 0; j + 1 < props.length; j += 2) cp[parseInt(props[j], 10)] = props[j + 1];
      return cp;
    };
    const definitionFromProps = (cp) => {
      const toInt = (v, d) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : d;
      };
      const copyOpacity = toInt(cp[17], 0) !== 0;
      let opacity = 1;
      if (toInt(cp[8], 0) >= 1 && cp[7] !== undefined) {
        const parsed = parseFloat(cp[7]);
        opacity = Number.isFinite(parsed) ? parsed : 0;
      }
      const blendingValue = parseFloat(cp[5] ?? "0");
      return {
        r: toInt(cp[1], 0) & 255,
        g: toInt(cp[2], 0) & 255,
        b: toInt(cp[3], 0) & 255,
        playerColor: toInt(cp[4], 0),
        blending: Number.isFinite(blendingValue) && blendingValue !== 0,
        opacity,
        copyID: toInt(cp[9], 0),
        copyHSV: cp[10] ? parseGdHSV(cp[10]) : null,
        copyOpacity
      };
    };
    if (colorStr) {
      for (const entry of colorStr.split("|")) {
        if (!entry) continue;
        const cp = parseColorProps(entry);
        const channelId = parseInt(cp[6], 10);
        if (!Number.isFinite(channelId) || channelId <= 0 || channelId > 1101) continue;
        this._initialColors[channelId] = definitionFromProps(cp);
      }
    }
    // LevelSettingsObject::objectFromDict legacy colour keys (1.x/2.0 levels).
    // The line colour is always blended in that format.
    const legacyKeys = [
      ["kS29", 1000], ["kS30", 1001], ["kS31", 1002], ["kS32", 1004],
      ["kS33", 1], ["kS34", 2], ["kS35", 3], ["kS36", 4], ["kS37", 1003]
    ];
    for (const [key, channelId] of legacyKeys) {
      if (settingsMap[key] === undefined || this._initialColors[channelId]) continue;
      const definition = definitionFromProps(parseColorProps(settingsMap[key]));
      if (channelId === 1002) {
        definition.blending = true;
        definition.forceBlending = true;
      }
      this._initialColors[channelId] = definition;
    }
  }
  _buildGround() {
    if (window.isEditor) return; // not dealing with ts rn
    const scene = this._scene;
    window._groundId = window._groundId ? window._groundId : "00";
    
    const groundFrame = scene.textures.getFrame("groundSquare_" + window._groundId + "_001.png");
    this._tileW = groundFrame ? groundFrame.width : 1012;
    this._groundTiles = [];
    this._ceilingTiles = [];
    this._ground2Tiles = [];
    this._ceiling2Tiles = [];
    const ground2TexKey = "groundSquare_" + window._groundId + "_2_001.png";
    const hasGround2 = scene.textures.exists(ground2TexKey);
    let tileCount = Math.ceil(screenWidth / this._tileW) + 2;
    let groundY = b(0);
    const startX = -centerX;
    for (let i = 0; i < tileCount; i++) {
      let tileX = startX + i * this._tileW;
      let groundTile = scene.add.image(0, groundY, "groundSquare_" + window._groundId + "_001.png");
      groundTile.setOrigin(0, 0);
      groundTile.setTint(17578);
      groundTile.setDepth(20);
      groundTile._worldX = tileX;
      this._groundTiles.push(groundTile);
      if (hasGround2) {
        let ground2Tile = scene.add.image(0, groundY, ground2TexKey);
        ground2Tile.setOrigin(0, 0);
        ground2Tile.setTint(this._ground2Tint);
        ground2Tile.setDepth(20.5);
        ground2Tile._worldX = tileX;
        this._ground2Tiles.push(ground2Tile);
      }
      let ceilingTile = scene.add.image(0, groundY, "groundSquare_" + window._groundId + "_001.png");
      ceilingTile.setOrigin(0, 1);
      ceilingTile.setFlipY(true);
      ceilingTile.setTint(17578);
      ceilingTile.setDepth(20);
      ceilingTile.setVisible(false);
      ceilingTile._worldX = tileX;
      this._ceilingTiles.push(ceilingTile);
      if (hasGround2) {
        let ceiling2Tile = scene.add.image(0, groundY, ground2TexKey);
        ceiling2Tile.setOrigin(0, 1);
        ceiling2Tile.setFlipY(true);
        ceiling2Tile.setTint(this._ground2Tint);
        ceiling2Tile.setDepth(20.5);
        ceiling2Tile.setVisible(false);
        ceiling2Tile._worldX = tileX;
        this._ceiling2Tiles.push(ceiling2Tile);
      }
    }
    this._maxGroundWorldX = startX + (tileCount - 1) * this._tileW;
    const floorLineFrame = scene.textures.getFrame("GJ_WebSheet", "floorLine_01_001.png");
    const floorLineWidth = floorLineFrame ? floorLineFrame.width : 888;
    const floorLineScale = screenWidth / floorLineWidth;
    this._groundLine = scene.add.image(screenWidth / 2, groundY - 1, "GJ_WebSheet", "floorLine_01_001.png").setOrigin(0.5, 0).setScale(floorLineScale, 1).setBlendMode(S).setDepth(21).setScrollFactor(0);
    this._ceilingLine = scene.add.image(screenWidth / 2, groundY + 1, "GJ_WebSheet", "floorLine_01_001.png").setOrigin(0.5, 1).setScale(floorLineScale, 1).setFlipY(true).setBlendMode(S).setDepth(21).setScrollFactor(0).setVisible(false);
    const shadowAlpha = 100 / 255;
    this._groundShadowL = scene.add.image(-1, groundY, "GJ_WebSheet", "groundSquareShadow_001.png").setOrigin(0, 0).setScrollFactor(0).setDepth(22).setAlpha(shadowAlpha).setScale(0.7, 1).setBlendMode(E);
    this._groundShadowR = scene.add.image(screenWidth + 1, groundY, "GJ_WebSheet", "groundSquareShadow_001.png").setOrigin(1, 0).setScrollFactor(0).setDepth(22).setAlpha(shadowAlpha).setScale(0.7, 1).setFlipX(true).setBlendMode(E);
    this._ceilingShadowL = scene.add.image(-1, groundY, "GJ_WebSheet", "groundSquareShadow_001.png").setOrigin(0, 1).setScrollFactor(0).setDepth(22).setAlpha(shadowAlpha).setScale(0.7, 1).setFlipY(true).setBlendMode(E).setVisible(false);
    this._ceilingShadowR = scene.add.image(screenWidth + 1, groundY, "GJ_WebSheet", "groundSquareShadow_001.png").setOrigin(1, 1).setScrollFactor(0).setDepth(22).setAlpha(shadowAlpha).setScale(0.7, 1).setFlipX(true).setFlipY(true).setBlendMode(E).setVisible(false);
    // GJGroundLayer spans the screen horizontally but sits at its world
    // height: a static or offset camera moves it vertically like any object.
    for (const part of [...this._groundTiles, ...this._ceilingTiles, ...this._ground2Tiles, ...this._ceiling2Tiles,
      this._groundLine, this._ceilingLine, this._groundShadowL, this._groundShadowR, this._ceilingShadowL, this._ceilingShadowR]) {
      part?.setScrollFactor?.(0, 1);
    }
  }
  applyGroundTexture() {
    if (window.isEditor) return; // not dealing with ts rn
    const gId = window._groundId || "00";
    const texKey = "groundSquare_" + gId + "_001.png";
    if (!this._scene.textures.exists(texKey)) return;
    const groundFrame = this._scene.textures.getFrame(texKey);
    this._tileW = groundFrame ? groundFrame.width : this._tileW;
    for (let tile of this._groundTiles) {
      tile.setTexture(texKey);
    }
    for (let tile of this._ceilingTiles) {
      tile.setTexture(texKey);
    }

    const ground2TexKey = "groundSquare_" + gId + "_2_001.png";
    const hasGround2 = this._scene.textures.exists(ground2TexKey);
    this._ground2Tiles = this._ground2Tiles || [];
    this._ceiling2Tiles = this._ceiling2Tiles || [];

    if (hasGround2) {
      for (let i = 0; i < this._groundTiles.length; i++) {
        const groundTile = this._groundTiles[i];
        const ceilingTile = this._ceilingTiles[i];
        if (!groundTile || !ceilingTile) continue;

        if (!this._ground2Tiles[i]) {
          const ground2Tile = this._scene.add.image(groundTile.x || 0, groundTile.y || b(0), ground2TexKey);
          ground2Tile.setOrigin(0, 0);
          ground2Tile.setTint(this._ground2Tint);
          ground2Tile.setDepth(20.5);
          ground2Tile._worldX = groundTile._worldX;
          this._ground2Tiles[i] = ground2Tile;
        } else {
          this._ground2Tiles[i].setTexture(ground2TexKey);
          this._ground2Tiles[i].setTint(this._ground2Tint);
        }
        this._ground2Tiles[i].setVisible(true);

        if (!this._ceiling2Tiles[i]) {
          const ceiling2Tile = this._scene.add.image(ceilingTile.x || 0, ceilingTile.y || b(0), ground2TexKey);
          ceiling2Tile.setOrigin(0, 1);
          ceiling2Tile.setFlipY(true);
          ceiling2Tile.setTint(this._ground2Tint);
          ceiling2Tile.setDepth(20.5);
          ceiling2Tile.setVisible(false);
          ceiling2Tile._worldX = ceilingTile._worldX;
          this._ceiling2Tiles[i] = ceiling2Tile;
        } else {
          this._ceiling2Tiles[i].setTexture(ground2TexKey);
          this._ceiling2Tiles[i].setFlipY(true);
          this._ceiling2Tiles[i].setTint(this._ground2Tint);
        }
        this._ceiling2Tiles[i].setVisible(false);
      }
    } else {
      for (let tile of this._ground2Tiles || []) {
        if (tile) tile.setVisible(false);
      }
      for (let tile of this._ceiling2Tiles || []) {
        if (tile) tile.setVisible(false);
      }
    }
  }
  resizeScreen() {
    var newTile;
    var newCeilingTile;
    const scene = this._scene;
    const tileWidth = this._tileW;
    const requiredTileCount = Math.ceil(screenWidth / tileWidth) + 2;
    const groundY = b(0);
    while (this._groundTiles.length < requiredTileCount) {
      const newTileX = this._maxGroundWorldX + tileWidth;
      let newGroundTile = scene.add.image(0, groundY, "groundSquare_" + window._groundId + "_001.png");
      newGroundTile.setOrigin(0, 0).setTint(((newTile = this._groundTiles[0]) == null ? undefined : newTile.tintTopLeft) || 17578).setDepth(20);
      newGroundTile._worldX = newTileX;
      this._groundTiles.push(newGroundTile);
      const ground2TexKey = "groundSquare_" + window._groundId + "_2_001.png";
      if (scene.textures.exists(ground2TexKey)) {
        let newGround2Tile = scene.add.image(0, groundY, ground2TexKey);
        newGround2Tile.setOrigin(0, 0).setTint(this._ground2Tint).setDepth(20.5);
        newGround2Tile._worldX = newTileX;
        this._ground2Tiles.push(newGround2Tile);
      }
      let newCeilingTile = scene.add.image(0, groundY, "groundSquare_" + window._groundId + "_001.png");
      newCeilingTile.setOrigin(0, 1).setFlipY(true).setTint(((newCeilingTile = this._groundTiles[0]) == null ? undefined : newCeilingTile.tintTopLeft) || 17578).setDepth(20).setVisible(false);
      newCeilingTile._worldX = newTileX;
      this._ceilingTiles.push(newCeilingTile);
      if (scene.textures.exists(ground2TexKey)) {
        let newCeiling2Tile = scene.add.image(0, groundY, ground2TexKey);
        newCeiling2Tile.setOrigin(0, 1).setFlipY(true).setTint(this._ground2Tint).setDepth(20.5).setVisible(false);
        newCeiling2Tile._worldX = newTileX;
        this._ceiling2Tiles.push(newCeiling2Tile);
      }
      this._maxGroundWorldX = newTileX;
    }
    const floorLineFrame = this._scene.textures.getFrame("GJ_WebSheet", "floorLine_01_001.png");
    const floorLineScale = screenWidth / (floorLineFrame ? floorLineFrame.width : 888);
    this._groundLine.x = screenWidth / 2;
    this._groundLine.setScale(floorLineScale, 1);
    this._ceilingLine.x = screenWidth / 2;
    this._ceilingLine.setScale(floorLineScale, 1);
    this._groundShadowR.x = screenWidth + 1;
    this._ceilingShadowR.x = screenWidth + 1;
  }
  // GJBaseGameLayer's ground placement (Steam 348360) in screen pixels from
  // the bottom edge, y up: the floor's top edge and the ceiling's bottom
  // edge. The corridor is a fixed number of screen points (the mode's band,
  // 1 + winH/2 - h/2 from each edge once the 0.5 s transition v is done)
  // whatever the camera zoom; out of a corridor the floor is the projected
  // world ground (y = 91, web +2) and the ceiling sits just off screen.
  _gdGroundLayout() {
    const scene = this._scene, cs = this.cameraState;
    if (!cs || !scene) return null;
    const W = scene.scale?.width || screenWidth, H = scene.scale?.height || 640;
    const view = cs.view(W, H, scene._cameraX || 0, scene._cameraY || 0);
    const zoom = view.zoom, v = this._flyGroundActive ? Math.max(0, Math.min(1, this._groundTargetValue || 0)) : 0;
    const h = Number.isFinite(this._gdBandHeight) ? this._gdBandHeight : 0;
    const camBottom = view.y - H / (2 * zoom);
    const groundProj = (2 - camBottom) * zoom;
    // Outside the flight corridor this is the actual world ground. Clamping
    // it to the screen edge pulls an offscreen floor back into a rotated
    // static camera (native-free-ground-high / native-free-ground-low).
    const bottom = v > 0 ? Math.max(-2 + (2 + H / 2 - h / 2 + 2) * v, groundProj) : groundProj;
    const top = H + 2 + ((H / 2 + h / 2 - 2) - (H + 2)) * v;
    return { W, H, view, zoom, v, h, camBottom, bottom, top };
  }
  // getBottomCorner / getTopCorner (Steam 31a980 / 31aa60), web units y up.
  _gdBand() {
    const scene = this._scene, frame = (scene?._physicsFrame ?? 0) + ":" + (this._groundTargetValue || 0) + ":" + (scene?._cameraY || 0);
    if (this._gdBandCache?.key === frame && this._gdBandCache.floorY === this._flyFloorY) return this._gdBandCache;
    const cs = this.cameraState, h = this._flyCeilingY - this._flyFloorY;
    let floor = this._flyFloorY, ceil = this._flyCeilingY;
    if (cs) {
      const view = cs.view(scene.scale?.width || screenWidth, scene.scale?.height || 640, scene._cameraX || 0, scene._cameraY || 0);
      const zoom = view.zoom;
      if (!this._gdBandLocked && cs.values.staticY > 0 && cs.targets?.y) {
        // Branch A: the ground sprites' screen positions, back in the world.
        const L = this._gdGroundLayout();
        floor = Math.max(0, L.camBottom + (L.bottom - 2) / zoom);
        ceil = L.camBottom + (L.top + 2) / zoom;
      } else if (zoom !== 1 || cs.values.offsetY) {
        // Branch B: the band keeps its centre (with the camera offset) and
        // spans h screen points, h / zoom in the world.
        floor = Math.max(0, this._flyFloorY + h / 2 - h / (2 * zoom) + (cs.values.offsetY || 0));
        ceil = floor + h / zoom;
      }
    }
    return (this._gdBandCache = { key: frame, floorY: this._flyFloorY, floor, ceil });
  }
  updateGroundTiles(cameraY = 0) {
    const scene = this._scene;
    if (this.cameraState?.camera && !scene?._menuActive && !window.isEditor && this._groundLine) return this._updateGDGround();
    const cameraX = this._cameraXRef.value;
    const tileWidth = this._tileW;
    let leftTileIndex;
    let rightTileIndex;
    let maxWorldX = this._maxGroundWorldX || -Infinity;
    const ceilingActive = !this._flyGroundActive && this._flyCeilingY !== null;
    if (this._flyVisualOnly && this._flyCeilingY !== null) {
      leftTileIndex = b(0) + cameraY;
      rightTileIndex = b(this._flyCeilingY) + cameraY;
    } else if (this._flyGroundActive && this._groundTargetValue > 0.001) {
      let groundTarget = this._groundTargetValue;
      const visualFloorInset = Number.isFinite(Number(this._flyVisualFloorInset)) ? Number(this._flyVisualFloorInset) : 0;
      const visualCeilingInset = Number.isFinite(Number(this._flyVisualCeilingInset)) ? Number(this._flyVisualCeilingInset) : 0;
      let targetGroundY = 620 - visualFloorInset;
      let targetCeilingY = 20 + visualCeilingInset;
      let groundScreenY = b(0) + cameraY;
      let ceilingScreenY = 0;
      leftTileIndex = groundScreenY + (targetGroundY - groundScreenY) * groundTarget;
      rightTileIndex = ceilingScreenY + (targetCeilingY - ceilingScreenY) * groundTarget;
      if (leftTileIndex > groundScreenY) {
        leftTileIndex = groundScreenY;
      }
    } else {
      leftTileIndex = b(0) + cameraY;
      rightTileIndex = ceilingActive ? 20 : 0;
    }
    const ground2TexKey = "groundSquare_" + (window._groundId || "00") + "_2_001.png";
    const hasGround2 = this._scene.textures.exists(ground2TexKey);
    for (let i = 0; i < this._groundTiles.length; i++) {
      let groundTile = this._groundTiles[i];
      let ceilingTile = this._ceilingTiles[i];
      if (groundTile._worldX + tileWidth <= cameraX) {
        groundTile._worldX = maxWorldX + tileWidth;
        ceilingTile._worldX = groundTile._worldX;
        maxWorldX = groundTile._worldX;
        this._maxGroundWorldX = maxWorldX;
      }
      let tileScreenX = groundTile._worldX - cameraX;
      groundTile.x = tileScreenX;
      groundTile.y = leftTileIndex;
      const ground2Tile = this._ground2Tiles?.[i];
      if (ground2Tile) {
        ground2Tile.x = tileScreenX;
        ground2Tile.y = leftTileIndex;
        ground2Tile.setVisible(hasGround2);
      }
      ceilingTile.x = tileScreenX;
      ceilingTile.y = rightTileIndex;
      const ceilingVisibleForTile = this._flyGroundActive && this._groundTargetValue > 0 || ceilingActive;
      ceilingTile.setVisible(ceilingVisibleForTile);
      const ceiling2Tile = this._ceiling2Tiles?.[i];
      if (ceiling2Tile) {
        ceiling2Tile.x = tileScreenX;
        ceiling2Tile.y = rightTileIndex;
        ceiling2Tile.setVisible(hasGround2 && ceilingVisibleForTile);
      }
    }
    this._groundLine.y = leftTileIndex;
    if (this._flyGroundActive && this._groundTargetValue > 0 || ceilingActive) {
      this._ceilingLine.y = rightTileIndex;
      this._ceilingLine.setVisible(true);
    } else {
      this._ceilingLine.setVisible(false);
    }
    this._groundShadowL.y = leftTileIndex;
    this._groundShadowR.y = leftTileIndex;
    let ceilingVisible = this._flyGroundActive && this._groundTargetValue > 0 || ceilingActive;
    this._ceilingShadowL.y = rightTileIndex;
    this._ceilingShadowR.y = rightTileIndex;
    this._ceilingShadowL.setVisible(ceilingVisible);
    this._ceilingShadowR.setVisible(ceilingVisible);
  }
  shiftGroundTiles(shiftAmount) {
    for (let i = 0; i < this._groundTiles.length; i++) {
      this._groundTiles[i]._worldX += shiftAmount;
      this._ceilingTiles[i]._worldX += shiftAmount;
      if (this._ground2Tiles?.[i]) this._ground2Tiles[i]._worldX += shiftAmount;
      if (this._ceiling2Tiles?.[i]) this._ceiling2Tiles[i]._worldX += shiftAmount;
    }
    this._maxGroundWorldX += shiftAmount;
  }
  resetGroundTiles(cameraX) {
    const tileWidth = this._tileW;
    for (let i = 0; i < this._groundTiles.length; i++) {
      this._groundTiles[i]._worldX = cameraX + i * tileWidth;
      this._ceilingTiles[i]._worldX = cameraX + i * tileWidth;
      if (this._ground2Tiles?.[i]) this._ground2Tiles[i]._worldX = cameraX + i * tileWidth;
      if (this._ceiling2Tiles?.[i]) this._ceiling2Tiles[i]._worldX = cameraX + i * tileWidth;
    }
    this._maxGroundWorldX = cameraX + (this._groundTiles.length - 1) * tileWidth;
    this.resetGroundState();
  }
  resetGroundState() {
    this._flyGroundActive = false;
    this._groundTargetValue = 0;
    this._groundAnimating = false;
    this._groundY = 0;
    this._ceilingY = null;
    this._flyCeilingY = null;
    this._flyVisualOnly = false;
    this._flyVisualFloorInset = 0;
    this._flyVisualCeilingInset = 0;
    this.flyCameraTarget = null;
  }
  _computeFlyBounds(centerY, height = f, isPortal = false) {
    let floorY;
    if (isPortal) {
      floorY = centerY - f / 2;
    } else {
      floorY = centerY - height / 2;
    }
    floorY = Math.floor(floorY / a) * a;
    floorY = Math.max(0, floorY);
    return {
      floorY: floorY,
      ceilingY: floorY + height
    };
  }
  setFlyMode(enabled, centerY, height = f, visualOnly = false, cameraHeight = height) {
    // updateDualGround (31a583..31a66a) retracts the ground layers in
    // Free Mode, including spider/ball. Keeping a visual corridor here
    // clips scenery with fixed black bands even though physics is free.
    if (enabled) {
      const bandUp = !!this._flyGroundActive;
      let bounds = this._computeFlyBounds(centerY, height, visualOnly);
      this._flyFloorY = bounds.floorY;
      this._flyCeilingY = bounds.ceilingY;
      this._flyVisualOnly = visualOnly;
      this._gdBandHeight = bounds.ceilingY - bounds.floorY;
      // updateDualGround (Steam 31a690): with a static camera Y the corridor
      // leaves the camera alone and its bounds follow the ground sprites.
      this._gdBandLocked = !(this.cameraState?.values.staticY > 0 && this.cameraState.targets?.y);
      const cameraSpan = Number.isFinite(Number(cameraHeight)) ? Number(cameraHeight) : height;
      const defaultFlySpan = Number.isFinite(Number(typeof f !== "undefined" ? f : cameraSpan)) ? Number(typeof f !== "undefined" ? f : cameraSpan) : cameraSpan;
      const visualSpanShrink = Math.max(0, defaultFlySpan - cameraSpan);
      this._flyVisualFloorInset = visualOnly ? 0 : visualSpanShrink / 2;
      this._flyVisualCeilingInset = visualOnly ? 0 : visualSpanShrink / 2;
      if (visualOnly) {
        this._flyGroundActive = true;
      } else {
        this._flyGroundActive = true;
      }
      let flyCenter = this._flyFloorY + cameraSpan / 2;
      this.flyCameraTarget = flyCenter - 320 + o;
      if (this.flyCameraTarget < 0) {
        this.flyCameraTarget = 0;
      }
      this._bandMove = { to: this.flyCameraTarget, from: null, time: 0, duration: bandUp || this._scene?._isDual ? 0.4 : 0.5 };
      let currentCameraY = this._scene && this._scene._cameraY || 0;
      this._groundStartScreenY = b(0) + currentCameraY;
      this._ceilingStartScreenY = 0;
      this._groundAnimFrom = this._groundTargetValue;
      this._groundAnimTo = this.cameraState?.freeMode ? 0 : 1;
      this._groundAnimTime = 0;
      this._groundAnimDuration = this._groundAnimTo ? (this._scene?._isDual ? 0.4 : 0.5) : (this._scene?._isDual ? 0.32 : 0.4);
      this._groundAnimating = true;
    } else {
      this.flyCameraTarget = null;
      this._flyCeilingY = null;
      this._flyFloorY = null;
      this._flyVisualOnly = false;
      this._flyVisualFloorInset = 0;
      this._flyVisualCeilingInset = 0;
      if (this._flyGroundActive) {
        this._groundAnimFrom = this._groundTargetValue;
        this._groundAnimTo = 0;
        this._groundAnimTime = 0;
        this._groundAnimDuration = this._scene?._isDual ? 0.32 : 0.4;
        this._groundAnimating = true;
        this._flyGroundActive = false;
      } else {
        this._groundAnimating = false;
        this._groundTargetValue = 0;
      }
    }
  }
  stepGroundAnimation(deltaTime) {
    if (!this._groundAnimating) {
      return;
    }
    this._groundAnimTime += deltaTime;
    let progress = this._groundAnimDuration > 0 ? Math.min(this._groundAnimTime / this._groundAnimDuration, 1) : 1;
    // Ground-value command 25: enter uses Ease In Out / rate 2;
    // leaving the corridor (including Free Mode) uses rate 1.5.
    const eased = Easing.sample(1, this._groundAnimTo ? 2 : 1.5, progress);
    this._groundTargetValue = this._groundAnimFrom + (this._groundAnimTo - this._groundAnimFrom) * eased;
    if (progress >= 1) {
      this._groundAnimating = false;
      this._groundTargetValue = this._groundAnimTo;
      if (this._groundAnimTo === 0 && !this.cameraState?.freeMode) {
        this._flyGroundActive = false;
      }
    }
  }
  settleStartGround() {
    // A Start Position creates the corridor at its destination before the
    // first rendered frame; only entering a portal animates it into view.
    if (this._groundAnimating) {
      this._groundTargetValue = this._groundAnimTo;
      this._groundAnimFrom = this._groundAnimTo;
      this._groundAnimTime = this._groundAnimDuration;
      this._groundAnimating = false;
      if (this._groundAnimTo === 0 && !this.cameraState?.freeMode) this._flyGroundActive = false;
    }
    this._bandMove = null;
  }
  getFloorY() {
    // Free Mode removes the moving flight corridor, not the level's base
    // ground. EVOLUTION's ball section has an authored ceiling at y=240
    // and relies on the base ground below; -Infinity dropped the ball out
    // of the level immediately on entering its free-camera portal.
    if (this.cameraState?.freeMode) return 0;
    if (this._flyGroundActive) {
      if (this._flyVisualOnly) {
        return 0;
      }
      if (this._flyCeilingY === null || this._flyFloorY === null) return this._flyFloorY;
      return this._gdBand().floor;
    } else {
      return 0;
    }
  }
  getCeilingY() {
    if (this.cameraState?.freeMode) return null;
    if (this._flyCeilingY !== null) {
      if (!this._flyGroundActive || this._flyVisualOnly || this._flyFloorY === null) return this._flyCeilingY;
      return this._gdBand().ceil;
    } else {
      return null;
    }
  }
  // The ground layers in the GD layout: positions computed in screen space
  // (_gdGroundLayout) and placed so the zoomed, rotated world camera shows
  // them there; tiles follow the world horizontally.
  _updateGDGround() {
    const L = this._gdGroundLayout(), cam = this.cameraState.camera;
    const { W, H, zoom } = L;
    const cx = W / 2, cy = H / 2, sx = cam.scrollX || 0, sy = cam.scrollY || 0;
    const rot = Math.abs(L.view.rotation || 0);
    // pre-camera half extents that cover the view under rotation
    const halfW = (Math.abs(Math.cos(rot)) * W + Math.abs(Math.sin(rot)) * H) / (2 * zoom) + 4;
    const toY = screenY => cy + (screenY - cy) / zoom + sy;
    const floorY = toY(H - L.bottom), ceilY = toY(H - L.top);
    const ceilingVisible = L.v > 0;
    const scene = this._scene, cameraX = this._cameraXRef.value, tileW = this._tileW;
    const left = cameraX + cx + sx - halfW, right = cameraX + cx + sx + halfW;
    const first = Math.floor(left / tileW), count = Math.ceil((right - first * tileW) / tileW) + 1;
    const ground2TexKey = "groundSquare_" + (window._groundId || "00") + "_2_001.png";
    const hasGround2 = scene.textures.exists(ground2TexKey);
    const texKey = "groundSquare_" + (window._groundId || "00") + "_001.png";
    const tint = this._groundTiles[0]?.tintTopLeft ?? 17578;
    while (this._groundTiles.length < count) {
      this._groundTiles.push(scene.add.image(0, 0, texKey).setOrigin(0, 0).setTint(tint).setDepth(20));
      this._ceilingTiles.push(scene.add.image(0, 0, texKey).setOrigin(0, 1).setFlipY(true).setTint(tint).setDepth(20).setVisible(false));
      if (hasGround2) {
        this._ground2Tiles.push(scene.add.image(0, 0, ground2TexKey).setOrigin(0, 0).setTint(this._ground2Tint).setDepth(20.5));
        this._ceiling2Tiles.push(scene.add.image(0, 0, ground2TexKey).setOrigin(0, 1).setFlipY(true).setTint(this._ground2Tint).setDepth(20.5).setVisible(false));
      }
      this.cameraState._filterKey = null;
    }
    const place = (tile, i, y, visible) => {
      if (!tile) return;
      if (tile.scrollFactorX !== 1) tile.setScrollFactor(1, 1);
      const on = visible && i < count;
      tile.setVisible(on);
      if (!on) return;
      tile.x = (first + i) * tileW - cameraX; tile.y = y;
    };
    for (let i = 0; i < this._groundTiles.length; i++) {
      place(this._groundTiles[i], i, floorY, true);
      place(this._ground2Tiles?.[i], i, floorY, hasGround2);
      place(this._ceilingTiles[i], i, ceilY, ceilingVisible);
      place(this._ceiling2Tiles?.[i], i, ceilY, hasGround2 && ceilingVisible);
    }
    const lineFrame = scene.textures.getFrame("GJ_WebSheet", "floorLine_01_001.png");
    const lineScale = (2 * halfW) / (lineFrame ? lineFrame.width : 888);
    for (const [line, y, visible] of [[this._groundLine, floorY, true], [this._ceilingLine, ceilY, ceilingVisible]]) {
      if (line.scrollFactorX !== 1) line.setScrollFactor(1, 1);
      line.x = cx + sx; line.y = y; line.setScale(lineScale, 1); line.setVisible(visible);
    }
    for (const [shadow, x, y, visible] of [[this._groundShadowL, cx + sx - halfW + 4 - 1, floorY, true], [this._groundShadowR, cx + sx + halfW - 4 + 1, floorY, true],
      [this._ceilingShadowL, cx + sx - halfW + 4 - 1, ceilY, ceilingVisible], [this._ceilingShadowR, cx + sx + halfW - 4 + 1, ceilY, ceilingVisible]]) {
      if (shadow.scrollFactorX !== 1) shadow.setScrollFactor(1, 1);
      shadow.x = x; shadow.y = y; shadow.setVisible(visible);
    }
  }
  _applyVisualProps(scene, sprite, frameName, objectData, colorData = null) {
    if (!sprite) {
      return;
    }
    sprite._eeSourceFrame = frameName;
    let {
      dx: offsetX,
      dy: offsetY
    } = function (scene, frameName) {
      let textureInfo = getAtlasFrame(scene, frameName);
      if (!textureInfo) {
        return {
          dx: 0,
          dy: 0
        };
      }
      let frame = scene.textures.get(textureInfo.atlas).get(textureInfo.frame);
      if (!frame) {
        return {
          dx: 0,
          dy: 0
        };
      }
      // The Phaser atlas parser retains the original source size and trim
      // rectangle. Its Image renderer uses those values itself; applying a
      // second source offset here moves composite pieces apart.
      return {
        dx: 0,
        dy: 0
      };
    }(scene, frameName);
    const visualScale = getObjectVisualScale(objectData, colorData);
    if (objectData.flipX) {
      sprite.setFlipX(true);
      offsetX = -offsetX;
    }
    if (objectData.flipY) {
      sprite.setFlipY(true);
      offsetY = -offsetY;
    }
    // Atlas trim offsets live in unscaled sprite space. Scale them before
    // rotating so scaled decorations and their glow remain on the same pivot.
    offsetX *= visualScale.x;
    offsetY *= visualScale.y;
    const rawRotation = Number(objectData?.rot);
    let totalRotation = (Number(sprite.getData("gjBaseRotationDeg")) || 0) + (Number.isFinite(rawRotation) ? rawRotation : 0);
    if (totalRotation !== 0) {
      sprite.setAngle(totalRotation);
      let rad = totalRotation * Math.PI / 180;
      let cosR = Math.cos(rad);
      let sinR = Math.sin(rad);
      let rx = offsetX * cosR - offsetY * sinR;
      let ry = offsetX * sinR + offsetY * cosR;
      offsetX = rx;
      offsetY = ry;
    }
    sprite.x += offsetX;
    sprite.y += offsetY;
    sprite.setScale(visualScale.x, visualScale.y);
    // Keep the old uniform field for effects that intentionally use a single
    // factor, while reset/enter effects retain the actual X/Y stretch.
    sprite._eeObjectScale = Math.sqrt(Math.abs(visualScale.x * visualScale.y));
    sprite._eeObjectScaleX = visualScale.x;
    sprite._eeObjectScaleY = visualScale.y;
    // can_color belongs to the individual definition part.  A composite
    // object can have a non-colourable parent and colourable children (or the
    // reverse), so the registration code must not inherit this from the root.
    const isBlackVisual = colorData?.color_channel === "black" || colorData?.black === true;
    sprite._eeCanColor = !isBlackVisual && colorData?.can_color !== false;
    if (objectData?.hidden || objectData?._raw?.[135] === "1") {
      sprite._eeHidden = true;
      sprite.setVisible(false);
    }
    sprite._eeHighDetail = !!(objectData?.highDetail || objectData?._raw?.[103] === "1");
    if (window.enableLDM && sprite._eeHighDetail) {
      sprite.setVisible(false);
    }
    sprite._eeDontEnter = !!objectData?.dontEnter;
    sprite._eeDontFade = !!objectData?.dontFade;
    sprite._eeNoEffects = !!objectData?.noEffects;
    sprite._eeNoParticles = !!objectData?.noParticles;
    sprite._eeNoAudioScale = !!objectData?.noAudioScale;
    if (colorData) {
      const blackDefault = isBlackVisual || colorData.tint === 0;
      if (colorData.tint !== undefined) {
        sprite.setTint(colorData.tint);
      }
      if (blackDefault) {
        sprite.setTint(0);
        sprite._isBlack = true;
        sprite._canColor = !isBlackVisual && colorData.can_color === true;
        sprite._blackDefault = sprite._canColor && !(Number(objectData?.color1) > 0);
      }
    }
    // Group pulses temporarily replace tint. Keep the source tint so a
    // non-channelled child returns to its authored colour when the pulse ends.
    sprite._eeStaticTint = sprite.tintTopLeft ?? 0xffffff;
  }
  _addVisualSprite(sprite, objectData = null) {
    if (sprite) {
      if (objectData && objectData.blend === "additive") {
        sprite.setBlendMode(S);
        sprite._eeLayer = 0;
      } else if (objectData && objectData._portalFront) {
        sprite._eeLayer = 2;
      } else if (objectData && objectData.z !== undefined && objectData.z < 0) {
        sprite._eeLayer = 0;
      } else {
        sprite._eeLayer = 1;
      }
    }
  }
  _getGlowFrameName(frameName, objectData = null, objectDef = null) {
    const glowSource = objectDef || objectData || {};
    if (glowSource.glow_frame && glowSource.glow_frame !== "none") {
      return glowSource.glow_frame;
    } else if (objectData && objectData.glow_frame && objectData.glow_frame !== "none") {
      return objectData.glow_frame;
    } else if (frameName && frameName.endsWith("_001.png")) {
      return frameName.replace("_001.png", "_glow_001.png");
    } else {
      return null;
    }
  }
  _hasGlow(objectDef = null, objectData = null) {
    if (objectData?.noGlow || objectData?._raw?.[96] === "1") return false;
    const source = objectDef || objectData || {};
    if (!source) return false;
    return !!(
      source.glow === true ||
      (source.glow_frame && source.glow_frame !== "none") ||
      (source._raw && source._raw.glow_frame && source._raw.glow_frame !== "none")
    );
  }
  _isGlowVisible = () => {
      return !window.enableLDM && window.showGlow !== false && (!window.isEditor || window.showEditorGlow);
  };
  _getGlowAlphaMultiplier = () => {
      const override = Number(window.glowOpacity);
      return Number.isFinite(override) ? Math.max(0, Math.min(1, override)) : 0.24;
  };
  _updateGlowVisibility = () => {
      if (!this._glowSprites) return;
      const glowVisible = this._isGlowVisible();
      for (const glow of this._glowSprites) {
          glow.setVisible(glowVisible && !glow._eeHidden && !(window.enableLDM && glow._eeHighDetail));
      }
  };
  _addGlowSprite(scene, x, y, frameName, objectData, worldX, colorData = null, objectDef = null) {
    const beastColor = !!objectDef?._beastColor;
    let glowFrameName = this._getGlowFrameName(frameName, objectData, objectDef);
    if (!glowFrameName || glowFrameName === frameName) {
      return;
    }
    const rotation = Number.isFinite(objectData?.rot) ? Number(objectData.rot) : 0;
    const glowKey = `${worldX ?? x}:${y}:${glowFrameName}:${Number(Math.round(rotation * 1000))}`;
    if (this._glowSpriteKeys.has(glowKey)) {
      return;
    }
    // A definition can retain an old `glow_frame` name even when modern GD
    // ships the glow baked into the normal artwork. Never let a missing
    // companion frame fall through to a different texture; only render a
    // separate glow where the exact frame is present in the loaded atlases.
    if (!this._textureHasFrame(scene, glowFrameName)) return null;

    let glowSprite = addImageToScene(scene, x, y, glowFrameName);
    if (glowSprite) {
      this._glowSpriteKeys.add(glowKey);
      const sourceColorData = colorData || objectDef;
      // The main geometry may be a permanently black mask while its separate
      // glow frame follows the object's base channel. Do not inherit the
      // mask-only `color_channel: black` flag onto that glow frame.
      let glowColorData = sourceColorData?.color_channel === "black" || sourceColorData?.black === true
        ? { ...sourceColorData, color_channel: undefined, black: false }
        : sourceColorData;
      if (beastColor) glowColorData = { ...glowColorData, tint: 0xffffff, black: false, can_color: true };
      this._applyVisualProps(scene, glowSprite, glowFrameName, objectData, glowColorData);
      const blackDefault = glowColorData?.black === true || glowColorData?.tint === 0;
      if (glowColorData?.tint !== undefined) {
        glowSprite.setTint(glowColorData.tint);
      }
      if (blackDefault) {
        glowSprite.setTint(0);
        glowSprite._isBlack = true;
        glowSprite._canColor = glowColorData.can_color === true;
        glowSprite._blackDefault = glowSprite._canColor && !(Number(objectData?.color1) > 0);
      }
      glowSprite.setBlendMode(beastColor ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
      // The group-opacity path applies the glow multiplier. Keeping it in
      // the sprite alpha as well compounded it on every reset/alpha update.
      glowSprite.setAlpha(1);
      glowSprite._eeOrigAlpha = 1;
      glowSprite._eeLayer = 0;
      if (!this._glowSprites) {
        this._glowSprites = [];
      }
      if (!beastColor) this._glowSprites.push(glowSprite);
      glowSprite._eeIsGlowSprite = !beastColor;
      glowSprite._eeBeastColorSprite = beastColor;
      glowSprite.setVisible((beastColor || this._isGlowVisible()) && !glowSprite._eeHidden && !(window.enableLDM && glowSprite._eeHighDetail));
      if (worldX !== undefined) {
        glowSprite._eeWorldX = glowSprite.x;
        glowSprite._eeBaseY = glowSprite.y;
      }
      return glowSprite;
    }
    return null;
  }
  _textureHasFrame(scene, frameName) {
    if (!frameName) return false;
    if (typeof getAtlasFrame === "function" && getAtlasFrame(scene, frameName)) return true;
    return !!(scene?.textures?.exists && scene.textures.exists(frameName));
  }
  _getTriggerFrameName(scene, objectDef, levelObj) {
    const candidates = [];
    if (objectDef?.frame) candidates.push(objectDef.frame);
    if (objectDef?.randomFrames && objectDef.randomFrames.length) candidates.push(objectDef.randomFrames[0]);
    if (objectDef?.editorFrame) candidates.push(objectDef.editorFrame);
    if (objectDef?.icon) candidates.push(objectDef.icon);

    const id = parseInt(levelObj?.id ?? 0, 10);
    if (Number.isFinite(id) && id > 0) {
      candidates.push(
        `trigger_${id}_001.png`,
        `edit_trigger_${id}_001.png`,
        `edit_e${id}_001.png`,
        `object_${id}_001.png`
      );
    }

    for (const frameName of candidates) {
      if (this._textureHasFrame(scene, frameName)) return frameName;
    }
    return candidates.find(Boolean) || null;
  }
  _getTriggerTargetLabel(levelObj) {
    const raw = levelObj?._raw || {};
    const id = parseInt(levelObj?.id ?? 0, 10);
    const colorChannelLabel = (channelId) => {
      const parsed = parseInt(channelId ?? 0, 10);
      const labels = {
        1000: "BG",
        1001: "G1",
        1002: "L",
        1003: "3DL",
        1004: "Obj",
        1009: "G2",
        1013: "MG"
      };
      return labels[parsed] || String(Math.max(0, Number.isFinite(parsed) ? parsed : 0));
    };
    const readInt = (key, fallback = 0) => {
      const parsed = parseInt(raw[key] ?? raw[String(key)] ?? fallback, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const targetLabel = () => String(Math.max(0, this._parseSingleTriggerGroupId(raw[51] ?? raw["51"], 0)));

    if (id === 29) return "BG";
    if (id === 30) return "G1";

    const colorTriggerIds = new Set([105, 744, 899, 900, 915]);
    if (colorTriggerIds.has(id)) return colorChannelLabel(readInt(23, 1));
    if ([901, 1007, 1268].includes(id)) return targetLabel();

    if (id === 1346) return targetLabel();

    if (id === 1006) return targetLabel();

    return "";
  }
  _setTriggerEditorVisualVisible(visual, visible) {
    if (!visual) return;
    if (visual.container?.setVisible) visual.container.setVisible(visible);
  }
  _spawnTriggerEditorVisual(levelObj, objectDef, linkedObjectId) {
    const scene = this._scene;
    if (!scene || !this.topContainer || !levelObj) return;
    // Trigger markers only exist in the editor. During play they would be
    // five hidden Phaser objects per trigger (hundreds of thousands in big
    // levels), so they are built the first time the editor shows them.
    if (!window.isEditor) {
      (this._deferredTriggerVisuals ||= []).push([levelObj, objectDef, linkedObjectId]);
      return;
    }

    const worldX = levelObj.x * 2;
    const baseY = b(levelObj.y * 2);
    const isStartPositionTrigger = [31, 34].includes(parseInt(levelObj.id ?? 0, 10));
    const triggerContainer = scene.add.container(worldX, 0);
    triggerContainer.setDepth(995);
    triggerContainer._eeLayer = 2;
    triggerContainer._eeWorldX = worldX;
    triggerContainer._eeBaseY = baseY;
    triggerContainer._eeZDepth = 995;
    triggerContainer._eeEditorTrigger = true;
    triggerContainer._eeObjectId = linkedObjectId;
    triggerContainer._eeEditorLayer = parseInt(levelObj.editorLayer ?? levelObj._raw?.[20] ?? levelObj._raw?.["20"] ?? 0, 10) || 0;
    triggerContainer._eeEditorLayer2 = parseInt(levelObj.editorLayer2 ?? levelObj._raw?.[61] ?? levelObj._raw?.["61"] ?? 0, 10) || 0;

    const isTouchTrigger = objectDef?.type === triggerType && String(levelObj?._raw?.[11] ?? levelObj?._raw?.["11"] ?? "0") === "1";
    const isSpawnTriggeredTrigger = objectDef?.type === triggerType && this._isTriggerSpawnTriggered(levelObj);
    let lineGfx = null;
    let hitboxGfx = null;
    if (!isStartPositionTrigger) {
      lineGfx = scene.add.graphics();
      lineGfx.lineStyle(2, 0x1dffff, 1);
      lineGfx.lineBetween(0, -50000, 0, 50000);
      lineGfx._eeEditorTriggerLine = true;
      lineGfx.setVisible(!isTouchTrigger && !isSpawnTriggeredTrigger);

      hitboxGfx = scene.add.graphics();
      hitboxGfx.lineStyle(2, 0x1dffff, 1);
      hitboxGfx.strokeRect(-30, baseY - 30, 60, 60);
      hitboxGfx._eeEditorTriggerHitbox = true;
      hitboxGfx.setVisible(isTouchTrigger && !isSpawnTriggeredTrigger);
    }

    const frameName = this._getTriggerFrameName(scene, objectDef, levelObj);
    let triggerSprite = null;
    if (frameName && this._textureHasFrame(scene, frameName)) {
      triggerSprite = addImageToScene(scene, 0, baseY, frameName);
      if (triggerSprite) {
        this._applyVisualProps(scene, triggerSprite, frameName, levelObj, objectDef);
        triggerSprite.setAlpha(0.95);
        triggerSprite._eeEditorTriggerSprite = true;
      }
    }

    const labelText = this._getTriggerTargetLabel(levelObj);
    const labelY = baseY + 10;
    let label = null;
    if (labelText) {
      if (scene.cache?.bitmapFont?.has && scene.cache.bitmapFont.has("bigFont")) {
        label = scene.add.bitmapText(0, labelY, "bigFont", labelText, 56).setOrigin(0.5).setScale(0.55);
      } else {
        label = scene.add.text(0, labelY, labelText, {
          fontFamily: "Pusab, Arial, sans-serif",
          fontSize: "40px",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 6
        }).setOrigin(0.5);
      }
      if (label?.setTint) label.setTint(0xffffff);
      label._eeEditorTriggerLabel = true;
    }

    const parts = [];
    if (lineGfx) parts.push(lineGfx);
    if (hitboxGfx) parts.push(hitboxGfx);
    if (triggerSprite) parts.push(triggerSprite);
    if (label) parts.push(label);
    triggerContainer.add(parts);

    const tintTargets = [triggerSprite, label].filter(Boolean);
    triggerContainer.setTint = (tint) => {
      for (const target of tintTargets) {
        if (target?.setTint) target.setTint(tint);
      }
      return triggerContainer;
    };
    triggerContainer.clearTint = () => {
      for (const target of tintTargets) {
        if (target?.clearTint) target.clearTint();
      }
      if (label?.setTint) label.setTint(0xffffff);
      return triggerContainer;
    };
    triggerContainer.setFlipX = (value) => {
      if (triggerSprite?.setFlipX) triggerSprite.setFlipX(value);
      triggerContainer.flipX = !!value;
      return triggerContainer;
    };
    triggerContainer.setFlipY = (value) => {
      if (triggerSprite?.setFlipY) triggerSprite.setFlipY(value);
      triggerContainer.flipY = !!value;
      return triggerContainer;
    };
    triggerContainer._eeTriggerSprite = triggerSprite;
    triggerContainer._eeTriggerLabel = label;
    triggerContainer._eeTriggerLine = lineGfx;
    triggerContainer._eeTriggerHitbox = hitboxGfx;
    triggerContainer.getBounds = () => {
      const boundsTarget = triggerSprite || label;
      if (boundsTarget?.getBounds) return boundsTarget.getBounds();
      return new Phaser.Geom.Rectangle(triggerContainer.x - 20, baseY - 20, 40, 40);
    };

    this.topContainer.add(triggerContainer);
    const visual = { container: triggerContainer, line: lineGfx, hitbox: hitboxGfx, sprite: triggerSprite, label, saveObj: levelObj };
    this._editorTriggerVisuals.push(visual);
    this._setTriggerEditorVisualVisible(visual, !!window.isEditor);

    if (Number.isInteger(linkedObjectId)) {
      if (!this.objectSprites[linkedObjectId]) this.objectSprites[linkedObjectId] = [];
      this.objectSprites[linkedObjectId].push(triggerContainer);
    }
  }
  updateTriggerEditorVisuals() {
    const visible = !!window.isEditor;
    if (!this._editorTriggerVisuals) return;
    if (visible && this._deferredTriggerVisuals?.length) {
      const pending = this._deferredTriggerVisuals;
      this._deferredTriggerVisuals = [];
      for (const [levelObj, objectDef, linkedObjectId] of pending) {
        if (levelObj._eeObjectId !== linkedObjectId) continue;
        this._spawnTriggerEditorVisual(levelObj, objectDef, linkedObjectId);
      }
    }
    // During play these markers stay hidden. Revisit them only after leaving
    // the editor or changing the visual list, rather than on every 240 Hz tick.
    if (!visible && this._hiddenTriggerVisuals === this._editorTriggerVisuals &&
        this._hiddenTriggerVisualCount === this._editorTriggerVisuals.length) return;
    for (const visual of this._editorTriggerVisuals) {
      const saveObj = visual?.saveObj;
      const isTouchTrigger = saveObj && String(saveObj?._raw?.[11] ?? saveObj?._raw?.["11"] ?? "0") === "1";
      const isSpawnTriggeredTrigger = saveObj && this._isTriggerSpawnTriggered(saveObj);
      if (visual?.line?.setVisible) visual.line.setVisible(!isTouchTrigger && !isSpawnTriggeredTrigger);
      if (visual?.hitbox?.setVisible) visual.hitbox.setVisible(!!isTouchTrigger && !isSpawnTriggeredTrigger);
      this._setTriggerEditorVisualVisible(visual, visible);
    }
    this._hiddenTriggerVisuals = visible ? null : this._editorTriggerVisuals;
    this._hiddenTriggerVisualCount = this._editorTriggerVisuals.length;
  }
  _getTextObjectText(levelObj, objectDef = null) {
    const raw = levelObj?._raw || {};
    const textValue = levelObj?.text ?? _decodeTextObjectString(raw[31] ?? raw["31"] ?? objectDef?.defaultText ?? "A");
    return String(textValue ?? "");
  }

  // Level Settings > Font (kA18): 0 is bigFont, n is gjFontNN.
  _levelFontKey() {
    const index = Math.max(0, Math.min(59, this._fontIndex ?? (parseInt(window.settingsMap?.kA18 || "0", 10) || 0)));
    return index > 0 ? "gjFont" + String(index).padStart(2, "0") : "bigFont";
  }
  _ensureLevelFont(key) {
    const scene = this._scene;
    if (key === "bigFont" || !scene?.load || scene.cache?.bitmapFont?.has(key)) return;
    const loads = window.__gdFontLoads ||= {};
    if (loads[key]) { if (!loads[key].includes(this)) loads[key].push(this); return; }
    const waiting = loads[key] = [this];
    // Restarting a scene cancels its loader. Do not leave future levels
    // attached to an abandoned font request (their text stays pending).
    const cancel = () => {
      if (loads[key] === waiting) delete loads[key];
      scene.load.off?.("complete", finish);
    };
    const finish = () => {
      scene.events?.off?.("shutdown", cancel);
      if (loads[key] !== waiting) return;
      const data = scene.cache.text.get(key + "Fnt");
      if (data && scene.textures.exists(key) && typeof loadFont === "function" && !scene.cache.bitmapFont.has(key)) loadFont(scene, key, data);
      const levels = loads[key] || []; delete loads[key];
      for (const level of levels) level.gdRenderer?.fontLoaded(key);
    };
    scene.load.image(key, `assets/fonts/gd/${key}.png`);
    scene.load.text(key + "Fnt", `assets/fonts/gd/${key}.fnt`);
    scene.load.once("complete", finish);
    scene.events?.once?.("shutdown", cancel);
    if (!scene.load.isLoading()) scene.load.start();
  }

  _spawnTextObject(levelObj, objectDef, linkedObjectId) {
    const scene = this._scene;
    if (!scene || !levelObj) return null;

    const worldX = levelObj.x * 2;
    const worldY = b(levelObj.y * 2);
    const rawText = this._getTextObjectText(levelObj, objectDef);
    const baseSize = Number.isFinite(Number(objectDef?.textSize)) ? Number(objectDef.textSize) : 36;
    const textSize = Math.max(1, Math.round(baseSize));
    let textSprite = null;

    if (scene.cache?.bitmapFont?.has && scene.cache.bitmapFont.has("bigFont")) {
      textSprite = scene.add.bitmapText(worldX, worldY, "bigFont", rawText, textSize).setOrigin(0.5);
    } else {
      textSprite = scene.add.text(worldX, worldY, rawText, {
        fontFamily: "Pusab, Arial, sans-serif",
        fontSize: `${textSize}px`,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6
      }).setOrigin(0.5);
    }

    const textScale = getObjectVisualScale(levelObj);
    textSprite.setScale(textScale.x * (levelObj.flipX ? -1 : 1), textScale.y * (levelObj.flipY ? -1 : 1));
    textSprite.setAngle(levelObj.rot || 0);

    const zLayer = Number(levelObj.zLayer) || Number(objectDef?.default_z_layer) || 0;
    const zOrder = Number(levelObj.zOrder) || Number(objectDef?.default_z_order) || 0;
    const zDepth = getGDZDepth(zLayer, zOrder);
    textSprite.setDepth(zDepth);
    textSprite._eeLayer = 1;
    textSprite._eeWorldX = worldX;
    textSprite._eeBaseY = worldY;
    textSprite._eeOrigWorldX = worldX;
    textSprite._eeOrigBaseY = worldY;
    textSprite._eeZDepth = zDepth;
    textSprite._eeOrigAlpha = 1;
    textSprite._eeTextObject = true;
    textSprite._eeObjectId = linkedObjectId;
    textSprite._eeEditorLayer = parseInt(levelObj.editorLayer ?? levelObj._raw?.[20] ?? levelObj._raw?.["20"] ?? 0, 10) || 0;
    textSprite._eeEditorLayer2 = parseInt(levelObj.editorLayer2 ?? levelObj._raw?.[61] ?? levelObj._raw?.["61"] ?? 0, 10) || 0;

    const colorChannel = parseInt(levelObj.color1 || objectDef?.default_base_color_channel || 0, 10) || 0;
    if (colorChannel > 0 && objectDef?.can_color !== false) {
      const mainHSVEnabled = String(levelObj._raw?.[41] ?? levelObj._raw?.["41"] ?? "0") === "1";
      if (mainHSVEnabled && levelObj._raw?.[43] && typeof parseGdHSV === "function") {
        textSprite._eeHSV = parseGdHSV(levelObj._raw[43]);
      }
      textSprite._eeColorChannel = colorChannel;
      if (!this._colorChannelSprites[colorChannel]) this._colorChannelSprites[colorChannel] = [];
      this._colorChannelSprites[colorChannel].push(textSprite);
    }

    if (levelObj.groups) {
      const groupIds = [...new Set(String(levelObj.groups).split(".").map(Number).filter(n => n > 0))];
      if (groupIds.length) {
        textSprite._eeGroups = groupIds;
        textSprite._origWorldX = worldX;
        textSprite._origBaseY = worldY;
        textSprite._eeMoveBaseWorldX = worldX;
        textSprite._eeMoveBaseBaseY = worldY;
        textSprite._eeInitialWorldX = worldX;
        textSprite._eeInitialBaseY = worldY;
        textSprite._eeInitialRotationRad = textSprite.rotation || 0;
        for (const groupId of groupIds) {
          if (!this._groupSprites[groupId]) this._groupSprites[groupId] = [];
          this._groupSprites[groupId].push(textSprite);
        }
      }
    }

    this._addToSection(textSprite);

    if (Number.isInteger(linkedObjectId)) {
      if (!this.objectSprites[linkedObjectId]) this.objectSprites[linkedObjectId] = [];
      this.objectSprites[linkedObjectId].push(textSprite);
    }

    return textSprite;
  }

  _spawnTeleportExitPortalVisual(scene, enterObj, enterDef, linkedObjectId, registerObjectSprite, registerToGroups, registerColor, objZDepth, col1) {
    if (parseInt(enterObj?.id ?? 0, 10) !== 747) return;

    const offsetY = this._getTeleportPortalYOffset(enterObj);
    const exitDefSource = getObjectFromId(749) || allObjects[749] || enterDef;
    if (!exitDefSource) return;

    const frameName = exitDefSource.frame || enterDef?.frame;
    if (!frameName) return;

    const enterX = parseFloat(enterObj.x ?? enterObj._raw?.[2] ?? enterObj._raw?.["2"] ?? 0) || 0;
    const enterY = parseFloat(enterObj.y ?? enterObj._raw?.[3] ?? enterObj._raw?.["3"] ?? 0) || 0;
    const exitY = enterY + offsetY;
    const exitRot = parseFloat(enterObj.rot ?? enterObj._raw?.[6] ?? enterObj._raw?.["6"] ?? 0) || 0;
    const worldX = enterX * 2;
    const worldY = exitY * 2;
    const baseY = b(worldY);
    const exitZOrder = Number(enterObj.zOrder) || Number(exitDefSource.default_z_order) || 0;

    const exitLevelObj = {
      ...enterObj,
      id: 749,
      y: exitY,
      rot: exitRot,
      flipX: true,
      _generatedTeleportExit: true,
      _raw: {
        ...(enterObj._raw || {}),
        1: "749",
        "1": "749",
        2: String(enterX),
        "2": String(enterX),
        3: String(exitY),
        "3": String(exitY),
        4: "1",
        "4": "1",
        6: String(exitRot),
        "6": String(exitRot)
      }
    };

    const exitDef = { ...exitDefSource, _portalFront: true, _generatedTeleportExit: true };
    let portalBackSprite = null;

    if (frameName.includes("_front_")) {
      const backFrame = frameName.replace("_front_", "_back_");
      portalBackSprite = addImageToScene(scene, worldX, baseY, backFrame);
      if (portalBackSprite) {
        this._applyVisualProps(scene, portalBackSprite, backFrame, exitLevelObj, exitDefSource);
        portalBackSprite._eeLayer = 1;
        portalBackSprite._eeWorldX = portalBackSprite.x;
        portalBackSprite._eeBaseY = portalBackSprite.y;
        portalBackSprite._eeZDepth = getGDZDepth(4, exitZOrder) - 0.004;
        portalBackSprite._eeOrigAlpha = 1;
        portalBackSprite._eeGeneratedTeleportExit = true;
        this._addToSection(portalBackSprite);
        registerToGroups(portalBackSprite, worldX, baseY);
        registerColor(portalBackSprite, col1);
        registerObjectSprite(portalBackSprite);
      }
    }

    const sprite = addImageToScene(scene, worldX, baseY, frameName);
    if (!sprite) return;

    this._applyVisualProps(scene, sprite, frameName, exitLevelObj, exitDefSource);
    if (portalBackSprite) {
      portalBackSprite.x = sprite.x;
      portalBackSprite.y = sprite.y;
      portalBackSprite._eeWorldX = sprite.x;
      portalBackSprite._eeBaseY = sprite.y;
      portalBackSprite._origWorldX = sprite.x;
      portalBackSprite._origBaseY = sprite.y;
      portalBackSprite._eeMoveBaseWorldX = sprite.x;
      portalBackSprite._eeMoveBaseBaseY = sprite.y;
      portalBackSprite._eeInitialWorldX = sprite.x;
      portalBackSprite._eeInitialBaseY = sprite.y;
    }
    this._addVisualSprite(sprite, exitDef);
    sprite._eeWorldX = sprite.x;
    sprite._eeBaseY = sprite.y;
    sprite._eeZDepth = objZDepth + 0.004;
    sprite._eeOrigAlpha = 1;
    sprite._eeGeneratedTeleportExit = true;
    registerColor(sprite, col1);
    this._addToSection(sprite);
    registerToGroups(sprite, worldX, baseY);
    registerObjectSprite(sprite);
  }

  _spawnObject(levelObj) {
  this.objectSprites = this.objectSprites || [];

  const scene = this._scene;
  const objectDef = getObjectFromId(levelObj.id) || _LEGACY_TRIGGER_OBJECT_DEFS[Number(levelObj?.id)];

  if (parseInt(levelObj?.id ?? 0, 10) === 749 && !levelObj?._generatedTeleportExit) {
    return objectDef || allObjects[749] || null;
  }
  if (window.enableLDM && ldm_object.has(parseInt(levelObj?.id ?? 0, 10))) {
    return null;
  }

  if (objectDef && objectDef.type === triggerType && ![2065, 2069, 3645].includes(levelObj.id)) {
    if (this._nextObjectId === undefined) {
      this._nextObjectId = 0;
    }
    const linkedObjectId = this._nextObjectId++;
    levelObj._eeObjectId = linkedObjectId;
    if (levelObj._raw) delete levelObj._raw._eeObjectId;
    const triggerBase = this._makeTriggerBase(levelObj, linkedObjectId);
    if (window.GD_SHADER_IDS?.has(levelObj.id)) {
      this._shaderTriggers.push({ ...triggerBase, id: levelObj.id, x: levelObj.x * 2, y: levelObj.y * 2, raw: { ...levelObj._raw } });
    }
    if (window.GD_CAMERA_IDS?.has(levelObj.id)) {
      this._cameraTriggers.push({ ...triggerBase, id: levelObj.id, x: levelObj.x * 2, y: levelObj.y * 2, raw: { ...levelObj._raw } });
    }
    if (levelObj.id === 2903) this._gradientTriggers.push({ ...triggerBase, id: levelObj.id, raw: { ...levelObj._raw } });
    if (window.GD_AREA_IDS?.has(levelObj.id)) this._areaTriggers.push(window.GDAreaState.parse(triggerBase, levelObj));
    if (levelObj.id === 3016 && window.GDAdvancedFollowState) this._advFollowTriggers.push(window.GDAdvancedFollowState.parse(triggerBase, levelObj));
    if (levelObj.id === 3662 && this.gdRenderer) this.gdRenderer.linkedVisibilityGroups.add(Math.max(0, Math.min(9999, Number(levelObj._raw?.[51]) || 0)));
    if (levelObj.id === 2900) this._gameplayTriggers.push({ ...triggerBase, id: levelObj.id, raw: { ...levelObj._raw } });
    if (window.GD_LOGIC_IDS?.has(levelObj.id)) this._logicTriggers.push({ ...triggerBase, id: levelObj.id, raw: { ...levelObj._raw } });
    if (levelObj.id === 3600) this._endTriggers.push({ ...triggerBase, id: levelObj.id, raw: { ...levelObj._raw } });
    if (levelObj.id === 3032) this.keyframeState?.add(levelObj, linkedObjectId);
    if (levelObj.id === 3033) this._keyframeTriggers.push({ ...triggerBase, id: levelObj.id, raw: { ...levelObj._raw } });

    if (levelObj.id === 29 || levelObj.id === 30) {
      this._colorTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        y: levelObj.y * 2,
        uid: linkedObjectId,
        touchTriggered: String(levelObj._raw?.[11] ?? levelObj._raw?.["11"] ?? "0") === "1",
        index: levelObj.id === 29 ? 1000 : 1001,
        color: {
          r: parseInt(levelObj._raw[7] ?? 255, 10),
          g: parseInt(levelObj._raw[8] ?? 255, 10),
          b: parseInt(levelObj._raw[9] ?? 255, 10)
        },
        colorOptions: {
          opacity: parseFloat(levelObj._raw[35] ?? 1),
          blending: levelObj._raw[17] === "1",
          copyOpacity: levelObj._raw[60] === "1",
          legacyHSV: levelObj._raw[210] === "1",
          copyColorId: parseInt(levelObj._raw[50] ?? 0, 10) || 0,
          copyHSV: levelObj._raw[49] && typeof parseGdHSV === "function" ? parseGdHSV(levelObj._raw[49]) : null,
          playerColor: levelObj._raw[15] === "1" ? 1 : (levelObj._raw[16] === "1" ? 2 : 0)
        },
        duration: parseFloat(levelObj._raw[10] ?? 0),
        tintGround: levelObj._raw[14] === "1"
      });
    }

    if (window.GDEnterState && ((levelObj.id >= 3017 && levelObj.id <= 3021) || levelObj.id === 3023)) {
      this._enterEffectTriggers.push(window.GDEnterState.parse(triggerBase, levelObj));
    } else if (objectDef.enterEffect || _GD_ENTER_EFFECT_IDS[levelObj.id] !== undefined) {
      const raw = levelObj._raw || {};
      this._enterEffectTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        effect: objectDef.enterEffect,
        gdEffect: _GD_ENTER_EFFECT_IDS[levelObj.id] ?? -2,
        gdChannel: parseInt(raw[344] ?? "0", 10) || 0,
        gdMode: parseInt(raw[217] ?? "0", 10) || 0
      });
    }

    if (levelObj.id === 901) {
      const _raw = levelObj._raw;
      this._moveTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        y: levelObj.y * 2,
        touchTriggered: String(_raw?.[11] ?? _raw?.["11"] ?? "0") === "1",
        duration: parseFloat(_raw[10] ?? 0),
        easingType: parseInt(_raw[30] ?? 0, 10),
        easingRate: parseFloat(_raw[85] ?? 2),
        targetGroup: parseInt(_raw[51] ?? 0, 10),
        offsetX: parseFloat(_raw[28] ?? 0) * 2,
        offsetY: parseFloat(_raw[29] ?? 0) * 2,
        lockX: String(_raw?.[58] ?? _raw?.["58"] ?? "0") === "1",
        lockY: String(_raw?.[59] ?? _raw?.["59"] ?? "0") === "1",
        lockCameraX: _raw[141] === "1",
        lockCameraY: _raw[142] === "1",
        // GroupCommandObject2::runMoveCommand: a zero mod means 1.
        moveModX: Number(_raw[143]) || 1,
        moveModY: Number(_raw[144]) || 1,
        // Move to a target (100) or along a direction (394), from the
        // reference object of group 395 (else 51) to group 71 or a player.
        useTarget: _raw[100] === "1",
        targetAxis: Number(_raw[101]) || 0,
        targetPosGroup: Number(_raw[71]) || 0,
        targetCenterGroup: Number(_raw[395]) || 0,
        targetP1: _raw[138] === "1",
        targetP2: _raw[200] === "1",
        directionMode: _raw[394] === "1",
        directionDistance: Number(_raw[396]) || 0,
        dynamicMode: _raw[397] === "1",
        silent: _raw[544] === "1"
      });
    }
    if (levelObj.id === 1814) {
      const raw = levelObj._raw;
      this._followTriggers.push({ ...triggerBase, x: levelObj.x * 2, y: levelObj.y * 2,
        playerY: true, targetGroup: Number(raw[51]) || 0, speed: Number(raw[90]) || 0,
        delay: Math.max(0, Number(raw[91]) || 0), offset: (Number(raw[92]) || 0) * 6,
        maxSpeed: Math.max(0, Number(raw[105]) || 0) * 2, duration: commandDuration(raw[10]) });
    }
    if (levelObj.id === 1347) {
      const raw = levelObj._raw;
      this._followTriggers.push({ ...triggerBase, x: levelObj.x * 2, y: levelObj.y * 2,
        targetGroup: Number(raw[51]) || 0, sourceGroup: Number(raw[71]) || 0,
        modX: Number(raw[72] ?? 1), modY: Number(raw[73] ?? 1), duration: commandDuration(raw[10]) });
    }
    if (levelObj.id === 2067) {
      const raw = levelObj._raw;
      this._scaleTriggers.push({ ...triggerBase, x: levelObj.x * 2, y: levelObj.y * 2,
        targetGroup: Number(raw[51]) || 0, centerGroup: Number(raw[71]) || 0,
        scaleX: Number(raw[150] ?? 1), scaleY: Number(raw[151] ?? 1),
        divideX: raw[153] === "1", divideY: raw[154] === "1", onlyMove: raw[133] === "1",
        relativeRotation: raw[452] === "1", relativeScale: raw[577] === "1",
        duration: Math.max(0, Number(raw[10]) || 0), easingType: Number(raw[30]) || 0, easingRate: Number(raw[85] ?? 2) });
    }

    if (levelObj.id === 1007) {
      const _raw = levelObj._raw;
      this._alphaTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        duration: parseFloat(_raw[10] ?? 0),
        targetGroup: parseInt(_raw[51] ?? 0, 10),
        targetOpacity: Math.max(0, Math.min(1, parseFloat(_raw[35] ?? 1)))
      });
    }

    if (levelObj.id === 1049) {
      const _raw = levelObj._raw;
      this._toggleTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        y: levelObj.y * 2,
        touchTriggered: String(_raw?.[11] ?? _raw?.["11"] ?? "0") === "1",
        targetGroup: parseInt(_raw[51] ?? 0, 10),
        activate: String(_raw?.[56] ?? _raw?.["56"] ?? "0") === "1"
      });
    }

    if (levelObj.id === 1520) {
      const _raw = levelObj._raw;
      this._shakeTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        duration: Math.max(0, parseFloat(_raw[10] ?? 0) || 0),
        strength: Math.max(0, parseFloat(_raw[75] ?? 0) || 0)
      });
    }

    if (levelObj.id === 1616) {
      const _raw = levelObj._raw;
      this._stopTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        y: levelObj.y * 2,
        touchTriggered: String(_raw?.[11] ?? _raw?.["11"] ?? "0") === "1",
        targetGroup: parseInt(_raw[51] ?? 0, 10),
        targetControlId: _raw[535] === "1",
        command: [1, 2].includes(Number(_raw[580])) ? Number(_raw[580]) : 0
      });
    }

    if (levelObj.id === 1585) {
      const _raw = levelObj._raw;
      this._animationTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        y: levelObj.y * 2,
        touchTriggered: String(_raw?.[11] ?? _raw?.["11"] ?? "0") === "1",
        targetGroup: this._parseSingleTriggerGroupId(_raw?.[51] ?? _raw?.["51"], 0),
        animationId: parseInt(_raw?.[76] ?? _raw?.["76"] ?? 0, 10)
      });
    }

    const legacyColorChannels = {
      104: 1002, // line
      105: 1004, // object
      221: 1,
      717: 2,
      718: 3,
      743: 4,
      744: 1003 // 3D line
    };
    if ([104, 105, 221, 717, 718, 743, 744, 899, 900, 915].includes(levelObj.id)) {
      const _raw = levelObj._raw;
      const targetChannel = parseInt(
        _raw[23] ?? _raw["23"] ?? legacyColorChannels[levelObj.id] ?? objectDef.colorIdx ?? 0,
        10
      );
      if (targetChannel > 0) {
        this._colorTriggers.push({
          ...triggerBase,
          x: levelObj.x * 2,
          y: levelObj.y * 2,
          uid: linkedObjectId,
          touchTriggered: String(_raw?.[11] ?? _raw?.["11"] ?? "0") === "1",
          index: targetChannel,
          color: {
            r: parseInt(_raw[7] ?? 255, 10),
            g: parseInt(_raw[8] ?? 255, 10),
            b: parseInt(_raw[9] ?? 255, 10)
          },
          colorOptions: {
            opacity: parseFloat(_raw[35] ?? 1),
            blending: _raw[17] === "1",
            copyOpacity: _raw[60] === "1",
            legacyHSV: _raw[210] === "1",
            copyColorId: parseInt(_raw[50] ?? 0, 10) || 0,
            copyHSV: _raw[49] && typeof parseGdHSV === "function" ? parseGdHSV(_raw[49]) : null,
            playerColor: _raw[15] === "1" ? 1 : (_raw[16] === "1" ? 2 : 0)
          },
          duration: parseFloat(_raw[10] ?? 0),
          tintGround: _raw[14] === "1",
          opacity: parseFloat(_raw[35] ?? 1)
        });
      }
    }

    if (levelObj.id === 1346) {
      const _raw = levelObj._raw;
      const rotateGroups = this._parseRotateTriggerGroups(_raw);
      this._rotateTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        targetGroup: rotateGroups.targetGroup,
        degrees: parseFloat(_raw[68] ?? 0),
        duration: parseFloat(_raw[10] ?? 0),
        easingType: parseInt(_raw[30] ?? 0, 10),
        easingRate: parseFloat(_raw[85] ?? 2),
        lockRotation: _raw[70] === "1",
        times360: parseInt(_raw[69] ?? 0, 10),
        useTarget: _raw[100] === "1",
        targetRotationMode: _raw[394] === "1",
        targetRotationGroup: Number(_raw[401]) || 0,
        rotationOffset: Number(_raw[402]) || 0,
        dynamicMode: _raw[397] === "1",
        dynamicEasing: Math.max(1, Number(_raw[403]) || 1),
        targetP1: _raw[138] === "1",
        targetP2: _raw[200] === "1",
        directionBounds: [516, 517, 518, 519].map(key => Number(_raw[key]) || 0),
        centerGroup: rotateGroups.centerGroup
      });
    }

    if (levelObj.id === 1006) {
      const _raw = levelObj._raw;
      const targetType = parseInt(_raw[52] ?? 0, 10);
      this._pulseTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        targetGroup: targetType === 1 ? parseInt(_raw[51] ?? 0, 10) : 0,
        targetChannel: targetType === 0 ? parseInt(_raw[51] ?? 0, 10) : 0,
        targetType: targetType,
        color: {
          r: parseInt(_raw[7] ?? 255, 10),
          g: parseInt(_raw[8] ?? 255, 10),
          b: parseInt(_raw[9] ?? 255, 10)
        },
        hsvMode: _raw[48] === "1",
        hsv: _raw[49] && typeof parseGdHSV === "function" ? parseGdHSV(_raw[49]) : null,
        copyColorId: parseInt(_raw[50] ?? 0, 10) || 0,
        mainOnly: _raw[65] === "1",
        detailOnly: _raw[66] === "1",
        exclusive: _raw[86] === "1",
        fadeIn: parseFloat(_raw[45] ?? 0),
        hold: parseFloat(_raw[46] ?? 0),
        fadeOut: parseFloat(_raw[47] ?? 0)
      });
    }

    if (levelObj.id === 1268) {
      const _raw = levelObj._raw;
      this._spawnTriggers.push({
        ...triggerBase,
        x: levelObj.x * 2,
        y: levelObj.y * 2,
        touchTriggered: String(_raw?.[11] ?? _raw?.["11"] ?? "0") === "1",
        targetGroup: parseInt(_raw[51] ?? 0, 10),
        delay: Math.max(0, parseFloat(_raw[63] ?? 0) || 0),
        randomDelay: Math.max(0, parseFloat(_raw[556] ?? _raw["556"] ?? 0) || 0),
        ordered: _raw[441] === "1",
        remapKeys: String(_raw[442] || "").split(".").map(Number)
      });
    }

    if ([1611, 1811, 1817].includes(levelObj.id)) {
      const raw = levelObj._raw;
      this._countTriggers.push({
        ...triggerBase, id: levelObj.id,
        itemId: parseInt(raw[80] ?? 0, 10),
        count: (parseInt(raw[77] ?? 0, 10) || 0) * (raw[78] === "1" ? -1 : 1),
        comparison: parseInt(raw[88] ?? 0, 10),
        multiActivate: raw[104] === "1", override: raw[139] === "1",
        targetGroup: parseInt(raw[51] ?? 0, 10), activate: raw[56] === "1"
      });
    }

    if ([31, 34].includes(levelObj.id)) {
      this._startPositions.push({
        x: 2 * levelObj.x,
        y: 2 * levelObj.y,
        gameMode: levelObj.gameMode,
        miniMode: levelObj.miniMode,
        speed: levelObj.speed,
        dualMode: levelObj.dualMode,
        mirrored: levelObj.mirrored,
        gravityFlipped: levelObj.flipGravity,
        raw: { ...levelObj._raw }
      });
    }

    if (levelObj.id === 1615 && this.gdRenderer) {
      const fontKey = this._levelFontKey();
      this._ensureLevelFont(fontKey);
      const label = this.gdRenderer.addLabel(levelObj, "0", fontKey);
      label.linkedId = linkedObjectId; this.gdObjects[linkedObjectId] = label;
      this._counterLabels.push({ object: label, itemId: Number(levelObj._raw[80]) || 0 });
      return objectDef;
    }
    if (objectDef.textObject && this.gdRenderer && !scene?._editorPlaytestActive) {
      const fontKey = this._levelFontKey();
      this._ensureLevelFont(fontKey);
      const text = this.gdRenderer.addText(levelObj, this._getTextObjectText(levelObj, objectDef), fontKey);
      text.linkedId = linkedObjectId; this.gdObjects[linkedObjectId] = text;
      return objectDef;
    }
    if (objectDef.textObject) {
      this._spawnTextObject(levelObj, objectDef, linkedObjectId);
      return objectDef;
    }

    // Camera guides and trigger objects can be group centres or follow
    // targets. Keep their invisible transform nodes in the runtime graph.
    if (this.gdRenderer) {
      const helper = this.gdRenderer.addObject({ ...levelObj, _gdInvisible: true });
      if (helper) { helper.linkedId = linkedObjectId; this.gdObjects[linkedObjectId] = helper; }
    }
    this._spawnTriggerEditorVisual(levelObj, objectDef, linkedObjectId);
    return objectDef;
  }

  if (this._nextObjectId === undefined) {
    this._nextObjectId = 0;
  }
  const linkedObjectId = this._nextObjectId++;
  this._liveObjectIds?.add(linkedObjectId);
  levelObj._eeObjectId = linkedObjectId;
  if (levelObj._raw) delete levelObj._raw._eeObjectId;
  this._resetobject[linkedObjectId] = levelObj;
  let hasCollisionEntry = false;

  const worldX = levelObj.x * 2;
  const worldY = levelObj.y * 2;
  const sawPivotY = b(worldY);

  if (worldX > this._lastObjectX) {
    this._lastObjectX = worldX;
  }

  let frameName = objectDef ? objectDef.frame : null;
  if (objectDef && objectDef.randomFrames) {
    frameName = objectDef.randomFrames[Math.floor(Math.random() * objectDef.randomFrames.length)];
  }

  const objectId = parseInt(levelObj.id ?? 0, 10);
  const isEditorOnlyFrame = (candidate) =>
    /^(?:invisibleOutline|edit_)/i.test(String(candidate || ""));
  // Collision/editor-helper objects retain their colliders below, but their
  // editor art must never leak into gameplay.
  const isGameplayInvisibleObject = !window.isEditor && (
    !!objectDef?.editorFrame ||
    isEditorOnlyFrame(frameName)
  );
  if (isGameplayInvisibleObject) frameName = null;
  let gdObj = null;
  if (this.gdRenderer && !scene?._editorPlaytestActive && !_GD_LEGACY_VISUAL_IDS.has(objectId)) {
    gdObj = this.gdRenderer.addObject(isGameplayInvisibleObject ? { ...levelObj, _gdInvisible: true } : levelObj);
    if (gdObj) {
      gdObj.linkedId = linkedObjectId;
      this.gdObjects[linkedObjectId] = gdObj;
      if (objectId === 747) {
        // The paired exit is generated art, not another saved/physical
        // object. Draw both portals in the shared batches so authored masks,
        // blend order and Area effects also apply to the exit.
        const exitY = levelObj.y + this._getTeleportPortalYOffset(levelObj);
        const exit = this.gdRenderer.addObject({ ...levelObj, id: 749, y: exitY,
          flipX: !levelObj.flipX, groupParents: [], groupParentsPrimary: [], _generatedTeleportExit: true,
          _raw: { ...levelObj._raw, 1: "749", 3: String(exitY), 4: levelObj.flipX ? "0" : "1" } });
        if (exit) {
          exit.linkedId = linkedObjectId;
          exit.companionOf = gdObj;
          gdObj.teleportExit = exit;
        }
      }
    }
  }
  const secretCoinSlot = objectId === SECRET_COIN_OBJECT_ID ? this._secretCoinSlotCount++ : null;
  const userCoinSlot = objectId === USER_COIN_OBJECT_ID ? this._userCoinSlotCount++ : null;
  const sawObjectIds = new Set([183, 184, 185, 186, 187, 188, 397, 398, 399, 678, 679, 680, 740, 741, 742, 1619, 1620, 1708, 1709, 1710, 1734, 1735, 1736, 85, 86, 87, 97, 137, 138, 139, 154, 155, 156, 180, 181, 182, 1019, 1020, 1021, 1058, 1059, 1060, 1061, 1752, 396, 395, 222, 223, 224, 997, 998, 999, 1000, 1055, 1056, 1057, 394, 375, 376, 377, 378, 677, 676, 675]);
  const fastSawObjectIds = new Set([186, 187, 188, 89, 88, 98, 183, 185, 184, 397, 398, 399, 678, 679, 680, 740, 741, 742, 1619, 1620, 1705, 1706, 1707, 1708, 1709, 1710, 1734, 1735, 1736]);
  const isSawObjectId = sawObjectIds.has(objectId);
  const isFastSawObjectId = fastSawObjectIds.has(objectId);
  const isDecorativeSawObject = objectDef?.type === decoType && frameName?.includes("sawblade");
  const sawBaseSpeed = (isFastSawObjectId ? 0.0063 : 0.0032) * (isDecorativeSawObject ? 1.15 : 1);

  const registerObjectSprite = (spr) => {
    if (!spr) return;
    spr._eeObjectId = linkedObjectId;
    spr._eeEditorLayer = parseInt(levelObj.editorLayer ?? levelObj._raw?.[20] ?? levelObj._raw?.["20"] ?? 0, 10) || 0;
    spr._eeEditorLayer2 = parseInt(levelObj.editorLayer2 ?? levelObj._raw?.[61] ?? levelObj._raw?.["61"] ?? 0, 10) || 0;
    if (!this.objectSprites[linkedObjectId]) this.objectSprites[linkedObjectId] = [];
    this.objectSprites[linkedObjectId].push(spr);
  };

  const registerAnimatedSprite = (spr, visualDef) => {
    if (!spr || !visualDef?.animFrames?.length) return;
    spr._animFrames = visualDef.animFrames;
    spr._animInterval = visualDef.animInterval || 100;
    spr._animIdx = 0;
    spr._animScene = scene;
    window._animatedSprites.push(spr);
  };

  const issawsprite = (spr) => {
    if (!spr) return;
    // Geometry Dash rotates a placed saw at a stable rate. Random direction,
    // phase and speed made identical attempts render differently and caused
    // paired glow/overlay sprites to drift apart.
    spr._Sawrotationspeed = sawBaseSpeed;
    spr._eeBaseSawRotationSpeed = sawBaseSpeed;
    spr._SawRandom1 = undefined;
    spr._SawRandom2 = 0;
    if (!Number.isFinite(spr._eeInitialSawRotation)) {
      spr._eeInitialSawRotation = Number.isFinite(spr.rotation) ? spr.rotation : 0;
    }
    // Multi-sprite saws and rotating decorations are one rigid object in GD.
    // Keep every trimmed atlas part on the placed object's shared pivot instead
    // of rotating each child around its own (often corner-shifted) texture origin.
    if (!Number.isFinite(spr._eeSawPivotX)) {
      spr._eeSawPivotX = worldX;
      spr._eeSawPivotY = sawPivotY;
      spr._eeSawInitialPivotX = worldX;
      spr._eeSawInitialPivotY = sawPivotY;
      const sawWorldX = Number.isFinite(Number(spr._eeWorldX)) ? Number(spr._eeWorldX) : (Number(spr.x) || worldX);
      const sawBaseY = Number.isFinite(Number(spr._eeBaseY)) ? Number(spr._eeBaseY) : (Number(spr.y) || sawPivotY);
      spr._eeSawLocalX = sawWorldX - worldX;
      spr._eeSawLocalY = sawBaseY - sawPivotY;
      spr._eeSawGroupRotation = 0;
    }
    spr._eeSawStartTime = window._animTimer || 0;
    if (!spr._eeSawRegistered) {
      spr._eeSawRegistered = true;
      this._sawSprites.push(spr);
    }
  };

  if (frameName && !gdObj) {
    const spriteWorldX = worldX;
    const baseY = b(worldY);
    const isPortalFront =
      (objectDef.type === portalType || objectDef.type === speedType) &&
      frameName.includes("_front_");

    const zLayer = Number.isFinite(Number(levelObj.zLayer)) && Number(levelObj.zLayer) !== 0
      ? Number(levelObj.zLayer)
      : (objectDef.default_z_layer !== undefined ? objectDef.default_z_layer : 0);
    const zOrd = Number.isFinite(Number(levelObj.zOrder)) && Number(levelObj.zOrder) !== 0
      ? Number(levelObj.zOrder)
      : (objectDef.default_z_order !== undefined ? objectDef.default_z_order : 0);
    const objZDepth = getGDZDepth(zLayer, zOrd);

    let col1 = levelObj.color1 || (objectDef.default_base_color_channel !== undefined ? objectDef.default_base_color_channel : 0);
    if (col1 === 0 && (objectDef.type === solidType || objectDef.type === hazardType)) col1 = 1;

    const col2 = levelObj.color2 || (objectDef.default_detail_color_channel !== undefined ? objectDef.default_detail_color_channel : -1);
    const canColor = objectDef.can_color !== false;

    const registerColor = (spr, ch, forceParentColor = false, colorKind = "base") => {
      if (!spr || spr._cantColor || (spr._isBlack && !spr._canColor)) return;
      if (ch > 0 && ((spr._eeCanColor ?? canColor) || spr._canColor) && spr) {
        spr._eeColorChannel = ch;
        spr._eeColorKind = colorKind;
        if (!this._colorChannelSprites[ch]) this._colorChannelSprites[ch] = [];
        this._colorChannelSprites[ch].push(spr);
        this._colorChannelsNeedFullApply = true;
        if (forceParentColor && spr._SawColor === undefined) {
          spr._SawColor = ch;
        }
      }
    };

    const objectHSV = (enabledKey, valueKey) => {
      if (String(levelObj._raw?.[enabledKey] ?? levelObj._raw?.[String(enabledKey)] ?? "0") !== "1") return null;
      const encoded = levelObj._raw?.[valueKey] ?? levelObj._raw?.[String(valueKey)];
      return encoded && typeof parseGdHSV === "function" ? parseGdHSV(encoded) : null;
    };
    const mainHSV = objectHSV(41, 43);
    const detailHSV = objectHSV(42, 44);
    const registerColorWithHSV = (spr, channel, forceParentColor, hsv, colorKind = "base") => {
      registerColor(spr, channel, forceParentColor, colorKind);
      if (spr && hsv) spr._eeHSV = hsv;
    };

    const objectGroups = String(levelObj.groups ?? "")
      .split(".").map(Number).filter(n => Number.isFinite(n) && n > 0);
    const objGids = [...new Set(objectGroups)];

    const registerToGroups = (spr, baseWorldX, baseBaseY) => {
      if (!objGids.length || !spr) return;
      baseWorldX = Number.isFinite(Number(spr.x)) ? Number(spr.x) : baseWorldX;
      baseBaseY = Number.isFinite(Number(spr.y)) ? Number(spr.y) : baseBaseY;
      const uniqueObjGids = [...new Set(objGids.map(gid => parseInt(gid, 10)).filter(gid => Number.isFinite(gid) && gid > 0))];
      spr._eeGroups = uniqueObjGids;
      spr._origWorldX = baseWorldX;
      spr._origBaseY = baseBaseY;
      spr._eeMoveBaseWorldX = baseWorldX;
      spr._eeMoveBaseBaseY = baseBaseY;
      if (spr._eeInitialWorldX === undefined) spr._eeInitialWorldX = baseWorldX;
      if (spr._eeInitialBaseY === undefined) spr._eeInitialBaseY = baseBaseY;
      if (spr._eeInitialRotationRad === undefined) spr._eeInitialRotationRad = spr.rotation || 0;
      if (spr._eeInitialScaleX === undefined) spr._eeInitialScaleX = spr.scaleX;
      if (spr._eeInitialScaleY === undefined) spr._eeInitialScaleY = spr.scaleY;
      for (const gid of uniqueObjGids) {
        if (!this._groupSprites[gid]) this._groupSprites[gid] = [];
        this._groupSprites[gid].push(spr);
      }
    };

    let portalBackSprite = null;
    if (isPortalFront) {
      const backFrame = frameName.replace("_front_", "_back_");
      portalBackSprite = addImageToScene(scene, spriteWorldX, baseY, backFrame);
      if (portalBackSprite) {
        this._applyVisualProps(scene, portalBackSprite, backFrame, levelObj, objectDef);
        portalBackSprite._eeLayer = 1;
        portalBackSprite._eeWorldX = portalBackSprite.x;
        portalBackSprite._eeBaseY = portalBackSprite.y;
        portalBackSprite._eeZDepth = getGDZDepth(4, zOrd) - 0.005;
        portalBackSprite._eeOrigAlpha = 1;
        this._addToSection(portalBackSprite);
        registerToGroups(portalBackSprite, worldX, baseY);
        registerColorWithHSV(portalBackSprite, col1, false, mainHSV);
        registerObjectSprite(portalBackSprite);
      }
    }

    let orbGlow = null;
    const beastColor = _BEAST_COLOR_PARTS[objectId]?.includes(frameName);
    if (frameName && (beastColor || this._hasGlow(objectDef, levelObj))) {
      orbGlow = this._addGlowSprite(scene, spriteWorldX, baseY, frameName, levelObj, worldX, null,
        beastColor ? { ...objectDef, _beastColor: true } : objectDef);
      if (orbGlow) {
        orbGlow._eeZDepth = objZDepth - 0.003;
        orbGlow._eeOrigAlpha = orbGlow.alpha ?? 1;
        // `_addGlowSprite` intentionally leaves section insertion to this
        // call site: the final Z value must exist before the container sorts
        // the sprite.  Inserting first trapped every glow at depth 0.
        this._addToSection(orbGlow);
        // PlayLayer::updateVisibility (50dfbf/50e8d0) colours the animated
        // outlines from the background sprite with HSV S -0.3 / V +0.4.
        // This is distinct from the Light BG channel's -0.2 / +0.2 rule.
        registerColorWithHSV(orbGlow, beastColor ? 1000 : col1, false, beastColor
          ? { h: 0, s: -0.3, v: 0.4, absoluteSaturation: true, absoluteBrightness: true } : mainHSV);
        registerToGroups(orbGlow, worldX, baseY);
        registerObjectSprite(orbGlow);
      }
    }

    const visualDef = isPortalFront ? { ...objectDef, _portalFront: true } : objectDef;
    const sprite = addImageToScene(scene, spriteWorldX, baseY, frameName);

    if (sprite) {
      // Animated objects default to black through channel 1010, but their
      // main artwork still follows a placed base channel and group pulses.
      // A permanent black mask here erased FernanFinal's coloured sludge.
      const animatedMain = !!_BEAST_ANIMATION_DEFS[objectId] && objectDef.black === true;
      this._applyVisualProps(scene, sprite, frameName, levelObj,
        animatedMain ? { ...objectDef, black: false, tint: 0 } : objectDef);
      if (portalBackSprite) {
        portalBackSprite.x = sprite.x;
        portalBackSprite.y = sprite.y;
        portalBackSprite._eeWorldX = sprite.x;
        portalBackSprite._eeBaseY = sprite.y;
        portalBackSprite._origWorldX = sprite.x;
        portalBackSprite._origBaseY = sprite.y;
        portalBackSprite._eeMoveBaseWorldX = sprite.x;
        portalBackSprite._eeMoveBaseBaseY = sprite.y;
        portalBackSprite._eeInitialWorldX = sprite.x;
        portalBackSprite._eeInitialBaseY = sprite.y;
      }
      this._addVisualSprite(sprite, visualDef);
      sprite._eeWorldX = sprite.x;
      sprite._eeBaseY = sprite.y;
      sprite._eeZDepth = objZDepth;
      sprite._eeOrigAlpha = 1;
      if (isSawObjectId) {
        sprite._isSaw = true;
        const isDecorativeSaw = objectDef?.type === decoType && frameName?.includes("sawblade");
        if (sprite._Sawrotationspeed === undefined) {
          const base = isFastSawObjectId ? 0.0063 : 0.0032;
          const boostedBase = isDecorativeSaw ? base * 1.15 : base;
          sprite._Sawrotationspeed = (Math.random() < 0.5 ? -1 : 1) * (boostedBase + (Math.random() * boostedBase * 0.2 - boostedBase * 0.1));
        }
        sprite._SawRandom1 = Math.random() * Math.PI * 2;
        sprite._SawRandom2 = isDecorativeSaw ? (isFastSawObjectId ? 0.00075 : 0.00045) : (isFastSawObjectId ? 0.00065 : 0.0004);
        sprite._Sawoffset = 0;
        issawsprite(sprite);
      }
      registerColorWithHSV(sprite, col1, !!isSawObjectId, mainHSV);
      this._addToSection(sprite);
      registerObjectSprite(sprite);

      if (objGids && objGids.length) {
        sprite._eeGroups = objGids;
        registerToGroups(sprite, sprite._eeWorldX, sprite._eeBaseY);
      }

      registerAnimatedSprite(sprite, objectDef);

      if (objectDef && objectDef.type === padType) {
        if (this.objects && this.objects.length) {
          const lastCollider = this.objects[this.objects.length - 1];
          if (lastCollider && lastCollider._padParticleEmitter) {
            sprite._padParticleEmitter = lastCollider._padParticleEmitter;
            lastCollider._padParticleEmitter._padSprite = sprite;
          }
        }
      }

      if (objectDef && objectDef.type === ringType) {
        const orbBaseScaleX = 0.75 * (sprite._eeObjectScaleX || 1);
        const orbBaseScaleY = 0.75 * (sprite._eeObjectScaleY || 1);
        sprite.setScale(orbBaseScaleX, orbBaseScaleY);
        sprite._eeOrbBaseScale = Math.sqrt(orbBaseScaleX * orbBaseScaleY);
        sprite._eeOrbBaseScaleX = orbBaseScaleX;
        sprite._eeOrbBaseScaleY = orbBaseScaleY;
        sprite._eeAudioScale = true;
        sprite._orbId = levelObj.id;
        this._orbSprites.push(sprite);
        if (frameName.indexOf("dropRing") >= 0 || frameName.indexOf("gravJumpRing") >= 0) {
          sprite._isSaw = true;
          if (isFastSawObjectId) sprite._Sawrotationspeed = 0.0065;
          issawsprite(sprite);
        }

        if (orbGlow) {
          orbGlow.setScale(orbBaseScaleX, orbBaseScaleY);
          orbGlow._eeOrbBaseScale = Math.sqrt(orbBaseScaleX * orbBaseScaleY);
          orbGlow._eeOrbBaseScaleX = orbBaseScaleX;
          orbGlow._eeOrbBaseScaleY = orbBaseScaleY;
          orbGlow._eeAudioScale = true;
          orbGlow._orbId = levelObj.id;
          this._orbSprites.push(orbGlow);
        }
      }

      if (objectDef && objectDef.type === coinType) {
        sprite._coinWorldX = worldX;
        sprite._coinWorldY = worldY;
        sprite._coinBaseScale = sprite.scaleX || 1;
        if (objectId === SECRET_COIN_OBJECT_ID) {
          sprite._secretCoinId = linkedObjectId;
          sprite._secretCoinSlot = secretCoinSlot;
          this._setSecretCoinAnimation(sprite, this._secretCoinCompleted.has(String(linkedObjectId)));
        }
        if (objectId === USER_COIN_OBJECT_ID) {
          sprite._userCoinId = linkedObjectId;
          sprite._userCoinSlot = userCoinSlot;
          this._setUserCoinAnimation(sprite, this._userCoinCompleted.has(String(linkedObjectId)));
        }
        this._coinSprites.push(sprite);
      }

      if (orbGlow && (isSawObjectId || frameName.indexOf("sawblade") >= 0)) {
        orbGlow._isSaw = true;
        if (sprite._Sawrotationspeed !== undefined) {
          orbGlow._Sawrotationspeed = sprite._Sawrotationspeed;
          orbGlow._SawRandom1 = sprite._SawRandom1;
          orbGlow._SawRandom2 = sprite._SawRandom2;
        } else {
          const isDecorativeSaw = objectDef?.type === decoType && frameName?.includes("sawblade");
          const base = isFastSawObjectId ? 0.0065 : 0.0034;
          const boostedBase = isDecorativeSaw ? base * 1.15 : base;
          orbGlow._Sawrotationspeed = (Math.random() < 0.5 ? -1 : 1) * (boostedBase + (Math.random() * boostedBase * 0.2 - boostedBase * 0.1));
          orbGlow._SawRandom1 = Math.random() * Math.PI * 2;
          orbGlow._SawRandom2 = isDecorativeSaw ? (isFastSawObjectId ? 0.00075 : 0.00045) : (isFastSawObjectId ? 0.00065 : 0.0004);
        }
        orbGlow._Sawoffset = orbGlow.rotation - sprite.rotation;
        issawsprite(orbGlow);
      }

      if (frameName.indexOf("sawblade") >= 0) {
        sprite.setTint(0x000000);
        sprite._isBlack = true;
        sprite._isSaw = true;
        const isDecorativeSaw = objectDef?.type === decoType && frameName?.includes("sawblade");
        if (isFastSawObjectId || isDecorativeSaw) {
          const targetSpeed = (isFastSawObjectId ? 0.0065 : 0.0034) * (isDecorativeSaw ? 1.15 : 1);
          sprite._Sawrotationspeed = targetSpeed;
        }
        issawsprite(sprite);

        const sawMirror = addImageToScene(scene, spriteWorldX, baseY, frameName);
          if (sawMirror) {
          this._applyVisualProps(scene, sawMirror, frameName, levelObj, objectDef);
          sawMirror.setTint(0x000000);
          sawMirror._isBlack = true;
          sawMirror.rotation = sprite.rotation + Math.PI;
          // sawblade frames contain one half of a cog.  The mirror is turned
          // 180 degrees around the object pivot, so its trim displacement has
          // to be turned around that pivot too.  Rotating only the texture
          // leaves both halves on the same side and makes the saw wobble.
          sawMirror.x = spriteWorldX * 2 - sawMirror.x;
          sawMirror.y = baseY * 2 - sawMirror.y;
          sawMirror._isSaw = true;
          sawMirror._eeZDepth = sprite._eeZDepth;
          sawMirror._eeLayer = sprite._eeLayer ?? 1;
          sawMirror._eeBehindParent = true;
          if (sprite._Sawrotationspeed !== undefined) {
            sawMirror._Sawrotationspeed = sprite._Sawrotationspeed;
            sawMirror._SawRandom1 = sprite._SawRandom1;
            sawMirror._SawRandom2 = sprite._SawRandom2;
            sawMirror._Sawoffset = sawMirror.rotation - sprite.rotation;
          } else {
            const base = isFastSawObjectId ? 0.0065 : 0.0034;
            const boostedBase = isDecorativeSaw ? base * 1.15 : base;
            sawMirror._Sawrotationspeed = (Math.random() < 0.5 ? -1 : 1) * (boostedBase + (Math.random() * boostedBase * 0.2 - boostedBase * 0.1));
            sawMirror._SawRandom1 = Math.random() * Math.PI * 2;
            sawMirror._SawRandom2 = isDecorativeSaw ? (isFastSawObjectId ? 0.00075 : 0.00045) : (isFastSawObjectId ? 0.0007 : 0.0004);
          }
          registerColorWithHSV(sawMirror, col1, true, mainHSV);
          sawMirror._eeWorldX = sawMirror.x;
          sawMirror._eeBaseY = sawMirror.y;
          this._addToSection(sawMirror);
          this._addVisualSprite(sawMirror);
          issawsprite(sawMirror);
          registerToGroups(sawMirror, worldX, baseY);
          registerObjectSprite(sawMirror);
        }
      }
    }

    if (frameName && objectDef && (objectDef.type === solidType || objectDef.type === hazardType)) {
      const overlayFrame = frameName.replace("_001.png", "_2_001.png");
      const overlaySprite = getAtlasFrame(scene, overlayFrame) ? addImageToScene(scene, spriteWorldX, baseY, overlayFrame) : null;

      if (overlaySprite) {
        this._applyVisualProps(scene, overlaySprite, overlayFrame, levelObj, objectDef);
        this._addVisualSprite(overlaySprite);
        overlaySprite._eeWorldX = overlaySprite.x;
        overlaySprite._eeBaseY = overlaySprite.y;
        overlaySprite._eeZDepth = objZDepth + 0.002;
        overlaySprite._eeOrigAlpha = 1;

        let oc2 = col2;
        if (oc2 <= 0) oc2 = 2;
        registerColorWithHSV(overlaySprite, oc2, false, detailHSV, "detail");

        this._addToSection(overlaySprite);
        registerToGroups(overlaySprite, worldX, baseY);
        registerObjectSprite(overlaySprite);
      }
    }

    // Invisible/helper objects still create their collision entry below, but
    // neither their root art nor a glow/child layer belongs in gameplay.
    if (!isGameplayInvisibleObject && objectDef?.children) {
      for (const childDef of objectDef.children) {
        // A few collision/helper definitions use a normal root frame but keep
        // their editor outline as a child.  Filtering only the root leaked the
        // D/H/F-style helper art into normal play.
        if (!window.isEditor && isEditorOnlyFrame(childDef?.frame)) {
          continue;
        }
        const isEditorGuideChild = !!(window.isEditor && (childDef.portalGuide || childDef.orbGuide));
        if (isEditorGuideChild) {
          continue;
        }

        let childDx = childDef.dx || 0;
        let childDy = childDef.dy || 0;

        if (childDef.localDx !== undefined || childDef.localDy !== undefined) {
          let localDx = childDef.localDx || 0;
          let localDy = childDef.localDy || 0;
          const inheritedScale = getObjectVisualScale(levelObj, objectDef);
          localDx *= inheritedScale.x;
          localDy *= inheritedScale.y;

          if (levelObj.flipX) {
            localDx = -localDx;
          }
          if (levelObj.flipY) {
            localDy = -localDy;
          }

          const rot = (levelObj.rot || 0) * Math.PI / 180;
          childDx = localDx * Math.cos(rot) - localDy * Math.sin(rot);
          childDy = localDx * Math.sin(rot) + localDy * Math.cos(rot);
        }

        const childWorldX = worldX + childDx;
        const childBaseY = baseY + childDy;
        const childSprite = addImageToScene(scene, spriteWorldX + childDx, baseY + childDy, childDef.frame);

        if (childSprite) {
          const parentScale = getObjectVisualScale(levelObj, objectDef);
          const flipX = !!levelObj.flipX !== (parentScale.x < 0);
          const flipY = !!levelObj.flipY !== (parentScale.y < 0);
          let childrotated = (levelObj.rot || 0) + (childDef.rot || 0);

          if (flipX !== flipY) {
            childrotated = (levelObj.rot || 0) - (childDef.rot || 0);
          }

          if (childDef.frame === "portal_01_extra_2_001.png" || childDef.frame === "portal_02_extra_2_001.png") {
            childrotated = 0;
          } 
          else if (childDef.frame === "blockOutline_14new_001.png" || childDef.frame === "blockOutline_15new_001.png") {
            let childRotOffset = 0;
            if (childDef.frame === "blockOutline_14new_001.png") childRotOffset = -45;
            else if (childDef.frame === "blockOutline_15new_001.png") childRotOffset = -26.565;
            if (flipX) childRotOffset = -childRotOffset;
            if (flipY) childRotOffset = -childRotOffset;
            childrotated += childRotOffset;
          }

          const ownChildScale = Number(childDef.scale);
          const childScale = Number.isFinite(ownChildScale) && ownChildScale > 0 ? ownChildScale : 1;
          const childObjectData = {
            ...levelObj,
            rot: childrotated,
            // Parent stretching applies to the child's local position and
            // sprite. Store the resulting X/Y scale directly so the uniform
            // value is not multiplied a second time in _applyVisualProps.
            scale: 1,
            scaleX: parentScale.x * childScale,
            scaleY: parentScale.y * childScale
          };
          const childIsBlackMask = objectDef.black === true &&
            (childDef.black === true || childDef.color_channel === "black" || childDef.tint === 0);
          const animatedMain = childIsBlackMask && !!_BEAST_ANIMATION_DEFS[objectId] && childDef.color_channel !== "black";
          const childVisualDef = {
            ...childDef,
            black: childIsBlackMask && !animatedMain,
            // Child records inherit their owning GameObject's colourability
            // unless the resource explicitly overrides it.  Leaving this
            // undefined made fixed-colour components of non-colourable
            // objects react to a placed detail channel.
            can_color: childIsBlackMask && !animatedMain
              ? false
              : (childDef.can_color ?? objectDef.can_color ?? true)
          };
          this._applyVisualProps(scene, childSprite, childDef.frame, childObjectData, childVisualDef);
          // The original beast's eye is its secondary-colour sprite, not a
          // permanently white part (native setupChildSprites 644e50).
          const beastEye = objectId === 918 && childDef.frame === "GJBeast01_03_001.png";
          childSprite._cantColor = !beastEye && (childDef.Cant_Color === true || childDef.cant_color === true);
          
          const showguide = childDef.portalGuide ? (!window.isEditor && window.enablePortalGuide !== false) : true;
          const showguide2 = childDef.orbGuide ? (!window.isEditor && window.enableOrbGuide !== false) : true;
          childSprite.setVisible(showguide && showguide2);
          if (childDef.portalGuide) childSprite._eePortalGuide = true;
          if (childDef.orbGuide) childSprite._eeOrbGuide = true;

          if (childDef.audioScale && !levelObj.noAudioScale) {
            childSprite.setScale(0.1);
            childSprite.setAlpha(0.9);
            childSprite._eeAudioScale = true;
            this._audioScaleSprites.push(childSprite);
          }

          const bortalstuff = childDef.portalGuide ? { ...childDef, _portalFront: true } : childDef;
          if (objectId === 15 || objectId === 16 || objectId === 17) {
            childSprite._rodballchild = true;
            childSprite._Rodobjectid = objectId;
          }
          if ((childDef.z !== undefined ? childDef.z : -1) < 0) {
            childSprite._eeLayer = 1;
            childSprite._eeBehindParent = true;
          } else {
            this._addVisualSprite(childSprite, bortalstuff);
          }

          childSprite._eeWorldX = childSprite.x;
          childSprite._eeBaseY = childSprite.y;
          const guidelayer = childDef.portalGuide ? 0 : ((childDef.z !== undefined ? childDef.z : -1));
          childSprite._eeZDepth = objZDepth + guidelayer;
          childSprite._eeOrigAlpha = 1;
          if (isSawObjectId) {
            childSprite._isSaw = true;
              if (sprite._Sawrotationspeed !== undefined) {
                childSprite._Sawrotationspeed = sprite._Sawrotationspeed;
                childSprite._SawRandom1 = sprite._SawRandom1;
                childSprite._SawRandom2 = sprite._SawRandom2;
              }
            childSprite._Sawoffset = childSprite.rotation - (sprite.rotation || 0);
            issawsprite(childSprite);
          }
          // A *_color frame is GD's secondary/detail sprite. Object
          // definitions do not redundantly spell this out for every child,
          // but the native GameObject keeps it in m_detailActionSprite.
          const childIsDetail = childDef.color_channel === "detail" ||
            (!!_BEAST_ANIMATION_DEFS[objectId] && !childIsBlackMask) ||
            (childDef.color_channel !== "base" && /(?:_color(?:2)?_|_2_)/i.test(String(childDef.frame || "")));
          const childColor = childDef.color_channel === "black"
            ? 0
            : (childIsDetail ? col2 : col1);
          const childHSV = childIsDetail ? detailHSV : mainHSV;
          registerColorWithHSV(childSprite, childColor, !!isSawObjectId, childHSV, childIsDetail ? "detail" : "base");
          this._addToSection(childSprite);
          registerToGroups(childSprite, childWorldX, childBaseY);
          registerObjectSprite(childSprite);
          registerAnimatedSprite(childSprite, childDef);

          const beastColor = _BEAST_COLOR_PARTS[objectId]?.includes(childDef.frame);
          const childGlowEnabled = beastColor || this._hasGlow(childDef, childObjectData) || this._hasGlow(objectDef, levelObj);
          if (childGlowEnabled) {
            const childGlowSprite = this._addGlowSprite(scene, spriteWorldX + childDx, baseY + childDy, childDef.frame, childObjectData, childWorldX, null,
              beastColor ? { ...childVisualDef, _beastColor: true } : childVisualDef);
            if (childGlowSprite) {
              childGlowSprite.rotation = childSprite.rotation;
              childGlowSprite.x = childSprite.x;
              childGlowSprite.y = childSprite.y;
              childGlowSprite._eeZDepth = childSprite._eeZDepth - 0.003;
              childGlowSprite._eeOrigAlpha = childGlowSprite.alpha ?? 1;
              childGlowSprite._eeWorldX = childGlowSprite.x;
              childGlowSprite._eeBaseY = childGlowSprite.y;
              childGlowSprite._eeLayer = childSprite._eeLayer ?? 1;
              childGlowSprite._eeBehindParent = true;
              childGlowSprite._cantColor = childDef.Cant_Color === true || childDef.cant_color === true;
              this._addToSection(childGlowSprite);
              if (isSawObjectId) {
                childGlowSprite._isSaw = true;
                if (sprite._Sawrotationspeed !== undefined) {
                  childGlowSprite._Sawrotationspeed = sprite._Sawrotationspeed;
                  childGlowSprite._SawRandom1 = sprite._SawRandom1;
                  childGlowSprite._SawRandom2 = sprite._SawRandom2;
                } else {
                  const base = isFastSawObjectId ? 0.0065 : 0.0034;
                  childGlowSprite._Sawrotationspeed = (Math.random() < 0.5 ? -1 : 1) * (base + (Math.random() * base * 0.2 - base * 0.1));
                  childGlowSprite._SawRandom1 = Math.random() * Math.PI * 2;
                  childGlowSprite._SawRandom2 = isFastSawObjectId ? 0.00065 : 0.0004;
                }
                childGlowSprite._Sawoffset = childGlowSprite.rotation - (sprite.rotation || 0);
                issawsprite(childGlowSprite);
              }
              // The animated outlines use Light BG independently of the eye's
              // secondary channel. Measured on all five native beast types.
              registerColorWithHSV(childGlowSprite, beastColor ? 1000 : childColor, false, beastColor
                ? { h: 0, s: -0.3, v: 0.4, absoluteSaturation: true, absoluteBrightness: true } : childHSV, childIsDetail ? "detail" : "base");
              registerToGroups(childGlowSprite, childWorldX, childBaseY);
              registerObjectSprite(childGlowSprite);
            }
          }

          if (objectDef && objectDef.type === ringType && childDef.orbGuide) {
            const guideScaleX = 0.75 * (childSprite._eeObjectScaleX || 1);
            const guideScaleY = 0.75 * (childSprite._eeObjectScaleY || 1);
            childSprite.setScale(guideScaleX, guideScaleY);
            childSprite._eeObjectScale = Math.sqrt(guideScaleX * guideScaleY);
            childSprite._eeObjectScaleX = guideScaleX;
            childSprite._eeObjectScaleY = guideScaleY;
            childSprite._eeOrbBaseScale = Math.sqrt(guideScaleX * guideScaleY);
            childSprite._eeOrbBaseScaleX = guideScaleX;
            childSprite._eeOrbBaseScaleY = guideScaleY;
            childSprite._orbId = levelObj.id;
            childSprite._eeOrbGuide = true;
            childSprite._OrbGuideGrav = !!(childDef.frame && /grav(?:ring|JumpRing)/.test(childDef.frame));
            childSprite._OrbGuideRotation = childSprite.rotation || 0;
            this._orbSprites.push(childSprite);
          }

          if (frameName.indexOf("sawblade") >= 0) {
            childSprite.setTint(0x000000);
            childSprite._isBlack = true;
            childSprite._isSaw = true;
            if (sprite._Sawrotationspeed !== undefined) {
              childSprite._Sawrotationspeed = sprite._Sawrotationspeed;
              childSprite._SawRandom1 = sprite._SawRandom1;
              childSprite._SawRandom2 = sprite._SawRandom2;
            }
            issawsprite(childSprite);

            const childMirror = addImageToScene(scene, spriteWorldX + childDx, baseY + childDy, childDef.frame);
              if (childMirror) {
              this._applyVisualProps(scene, childMirror, childDef.frame, childObjectData, childVisualDef);
              childMirror.setTint(0x000000);
              childMirror._isBlack = true;
              childMirror.rotation = childSprite.rotation + Math.PI;
              childMirror.x = (spriteWorldX + childDx) * 2 - childMirror.x;
              childMirror.y = (baseY + childDy) * 2 - childMirror.y;
              childMirror._isSaw = true;
              childMirror._eeZDepth = childSprite._eeZDepth;
              childMirror._eeLayer = childSprite._eeLayer ?? 1;
              childMirror._eeBehindParent = true;
              if (childSprite._Sawrotationspeed !== undefined) {
                childMirror._Sawrotationspeed = childSprite._Sawrotationspeed;
                childMirror._SawRandom1 = childSprite._SawRandom1;
                childMirror._SawRandom2 = childSprite._SawRandom2;
              }
              childMirror._Sawoffset = childMirror.rotation - childSprite.rotation;
              
              registerColorWithHSV(childMirror, col1, true, mainHSV);
              childMirror._eeWorldX = childMirror.x;
              childMirror._eeBaseY = childMirror.y;
              this._addToSection(childMirror);
              issawsprite(childMirror);
              registerToGroups(childMirror, childWorldX, childBaseY);
              registerObjectSprite(childMirror);
            }
          }
        }
      }
    }
    if (parseInt(levelObj.id ?? 0, 10) === 747) {
      this._spawnTeleportExitPortalVisual(scene, levelObj, objectDef, linkedObjectId, registerObjectSprite, registerToGroups, registerColor, objZDepth, col1);
    }
  }

  if (objectDef && objectDef.portalParticle && !gdObj?.ambientParticleSystem && frameName && !levelObj.hidden && !levelObj.noParticles && !levelObj.noEffects && !window.enableLDM && !window.isEditor && !scene?._editorPlaytestActive) {
    const particleWorldX = worldX;
    const particleWorldY = b(worldY);
    const radiusFactor = 2;
    const particleX = particleWorldX - radiusFactor * 5;
    const particleY = particleWorldY;
    const portalRot = (levelObj.rot || 0) * Math.PI / 180;

    const source = {
      getRandomPoint: p => {
        const angle = (Math.random() * 190 + 85) * Math.PI / 180;
        const dist = radiusFactor * 20 + Math.random() * 40 * radiusFactor;
        const rx = Math.cos(angle) * dist;
        const ry = Math.sin(angle) * dist;
        p.x = rx * Math.cos(portalRot) - ry * Math.sin(portalRot);
        p.y = rx * Math.sin(portalRot) + ry * Math.cos(portalRot);
        return p;
      }
    };

    const maxDistance = 20;
    const particles = scene.add.particles(particleX, particleY, "GJ_WebSheet", {
      frame: "square.png",
      lifespan: {
        min: 200,
        max: 1000
      },
      speed: 0,
      scale: {
        start: 0.75,
        end: 0.125
      },
      alpha: {
        start: 0.5,
        end: 0
      },
      tint: objectDef.portalParticleColor,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 20,
      maxParticles: 0,
      emitting: true,
      emitZone: {
        type: "random",
        source: source
      },
      emitCallback: particle => {
        const vx = -particle.x;
        const vy = -particle.y;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        const lifeSeconds = particle.life / 1000;
        const speed = (len - maxDistance) / (lifeSeconds || 0.3);
        particle.velocityX = vx / len * speed;
        particle.velocityY = vy / len * speed;
      }
    });

    particles.setDepth(14);
    particles._eeLayer = 2;
    particles._eeWorldX = worldX;
    particles._eeBaseY = particleY;
    particles._eeOrigAlpha = 1;
    particles._eeHighDetail = !!levelObj.highDetail;
    // Portal particles are part of the placed object's group, just like its
    // art. Toggle/alpha/move commands must not leave an independent emitter.
    particles._eeGroups = String(levelObj.groups || "").split(".").map(Number).filter(n => n > 0);
    particles._origWorldX = particles._eeMoveBaseWorldX = particles._eeInitialWorldX = particles.x;
    particles._origBaseY = particles._eeMoveBaseBaseY = particles._eeInitialBaseY = particles.y;
    particles._eeInitialRotationRad = particles.rotation || 0;
    particles._eeInitialScaleX = particles.scaleX;
    particles._eeInitialScaleY = particles.scaleY;
    for (const group of particles._eeGroups) (this._groupSprites[group] ||= []).push(particles);
    registerObjectSprite(particles);
    this._addToSection(particles);
    (this._legacyEmitters ||= []).push(particles);
  }

  if (objectDef) {
    const signedColliderScale = getObjectVisualScale(levelObj);
    const colliderScale = { x: Math.abs(signedColliderScale.x), y: Math.abs(signedColliderScale.y) };
    const registerCollider = col => {
      // Independent saved X/Y rotations form a skewed rectangle in cocos.
      // Reading only property 6 left these hitboxes upright although the art
      // was tilted (including long invisible Damage Squares).
      if (col.type !== slopeType && col.type !== solidType && (levelObj._raw?.[131] !== undefined || levelObj._raw?.[132] !== undefined)) {
        const rx = -(levelObj.rotationX || 0) * Math.PI / 180;
        const ry = -(levelObj.rotationY || 0) * Math.PI / 180;
        col.rotationDegrees = 0;
        if(col.type === 'force_field')col._forceRotationOffset=levelObj.rotationX||0;
        col.transformShape(Math.cos(ry), Math.sin(ry), -Math.sin(rx), Math.cos(rx));
        col._eeInitialShape = col.shape;
        col._eeInitialCircleMatrix = col.circleMatrix;
      }
      col._baseX = col.x;
      col._baseY = col.y;
      col._baseRotationDegrees = col.rotationDegrees || 0;
      col._origBaseX = col.x;
      col._origBaseY = col.y;
      col._origRotationDegrees = col.rotationDegrees || 0;
      col._eeMoveBaseX = col.x;
      col._eeMoveBaseY = col.y;
      col._eeInitialBaseX = col.x;
      col._eeInitialBaseY = col.y;
      col._eeInitialRotationDegrees = col.rotationDegrees || 0;
      col._eeInitialOrbRotation = col.orbRotation;
      col._eeInitialWidth = col.w; col._eeInitialHeight = col.h;
      col._eeInitialRadius = col.hitbox_radius;
      col._eeObjectId = linkedObjectId;
      col._eeLevelObject = levelObj;
      col.multiActivate = levelObj._raw?.[99] === "1";
      col._eeEditorLayer = parseInt(levelObj.editorLayer ?? levelObj._raw?.[20] ?? levelObj._raw?.["20"] ?? 0, 10) || 0;
      col._eeEditorLayer2 = parseInt(levelObj.editorLayer2 ?? levelObj._raw?.[61] ?? levelObj._raw?.["61"] ?? 0, 10) || 0;
      // Collision-relevant GameObject editor flags must travel with a moved or
      // group-parented collider too; keeping them only on the parsed object
      // makes slope/solid behaviour silently revert after a trigger moves it.
      col.passable = !!levelObj.passable;
      col.noTouch = !!levelObj.noTouch;
      col.nonStickX = !!levelObj.nonStickX;
      col.nonStickY = !!levelObj.nonStickY;
      col.ice = !!levelObj.ice;
      col.gripSlope = !!levelObj.gripSlope;
      col.scaleStick = !!levelObj.scaleStick;
      col.extraSticky = !!levelObj.extraSticky;
      col.dontBoostX = !!levelObj.dontBoostX;
      col.dontBoostY = !!levelObj.dontBoostY;
      col.linkedGroup = levelObj.linkedGroup || 0;
      col.extendedCollision = !!levelObj.extendedCollision;

      if (!this.objectSprites[linkedObjectId]) {
        this.objectSprites[linkedObjectId] = [];
      }

      const objectGroups = levelObj.groups ? levelObj.groups.split(".").map(Number) : [];
      const cgids = [...new Set(objectGroups
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0))];
      if (cgids.length) {
        col._eeGroups = cgids;
        for (const cgid of cgids) {
          if (!this._groupColliders[cgid]) this._groupColliders[cgid] = [];
          this._groupColliders[cgid].push(col);
        }
      }
    };

    const slopeCollider = _createSlopeCollider(levelObj, objectDef, worldX, worldY);
    if ([2069, 3645].includes(objectId)) {
      const force = new Collider("force_field", worldX, worldY,
        60 * colliderScale.x, 60 * colliderScale.y, levelObj.rot || 0);
      force.forceId = Number(levelObj._raw?.[530]) || 0;
      if (objectId === 3645) force.hitbox_radius = 30 * Math.max(colliderScale.x, colliderScale.y);
      registerCollider(force);
      this.objects.push(force);
      hasCollisionEntry = true;
      this._addCollisionToSection(force);
    } else if ([1755, 1813, 1829, 1859, 2866].includes(objectId)) {
      const modifier = new Collider("collision_modifier", worldX, worldY,
        60 * colliderScale.x, 60 * colliderScale.y, levelObj.rot || 0);
      modifier.modifierId = objectId;
      registerCollider(modifier);
      this.objects.push(modifier);
      hasCollisionEntry = true;
      this._addCollisionToSection(modifier);
    } else if (slopeCollider) {
      registerCollider(slopeCollider);
      this.objects.push(slopeCollider);
      hasCollisionEntry = true;
      this._addCollisionToSection(slopeCollider);
    } else if (objectDef.type === solidType && objectDef.gridW > 0 && objectDef.gridH > 0) {
      const native = window.GD_OBJECTS?.[levelObj.id];
      const signedW = (native?.w > 0 ? native.w * (native.ws ?? 1) * 2 : objectDef.gridW * a) * signedColliderScale.x;
      const signedH = (native?.h > 0 ? native.h * (native.hs ?? 1) * 2 : objectDef.gridH * a) * signedColliderScale.y;
      // getObjectRect positions with the signed size; CCRect then clamps
      // negative extents to zero. Mirroring art is not a full-size solid.
      const quarter = Math.abs(Math.abs(Math.fround(levelObj.rot || 0)) - 180) === 90;
      const dx = Math.min(0, quarter ? signedH : signedW) / -2;
      const dy = Math.min(0, quarter ? signedW : signedH) / -2;
      const collider = new Collider(solidType, worldX + dx, worldY + dy, Math.max(0, signedW), Math.max(0, signedH), levelObj.rot || 0);
      collider.objid = levelObj.id;
      registerCollider(collider);
      this.objects.push(collider);
      hasCollisionEntry = true;
      this._addCollisionToSection(collider);
    } else if (objectDef.type === hazardType) {
      let hitW = 0;
      let hitH = 0;

      if (
        objectDef.spriteW > 0 &&
        objectDef.spriteH > 0 &&
        objectDef.hitboxScaleX !== undefined &&
        objectDef.hitboxScaleY !== undefined
      ) {
        hitW = objectDef.spriteW * objectDef.hitboxScaleX * 2;
        hitH = objectDef.spriteH * objectDef.hitboxScaleY * 2;
      } else if (objectDef.gridW > 0 && objectDef.gridH > 0) {
        hitW = objectDef.gridW * 12;
        hitH = objectDef.gridH * 24;
      }

      const native = window.GD_OBJECTS?.[levelObj.id];
      // The legacy catalogue labels the invisible Damage Square as a
      // circle. Native editor collision shapes carry an explicit radius
      // only for circles; stretching a square must not create a huge disc.
      const nativeHelper = native && /^edit_/.test(native.f || "");
      const radius = nativeHelper ? native.r : (native?.r ?? objectDef.hitbox_radius);
      const hasHitboxRadius = radius !== undefined && radius !== null && radius > 0;
      const worldHitboxRadius = hasHitboxRadius ? radius * 2 : 0;
      if (!hasHitboxRadius && native?.w > 0 && native?.h > 0) {
        hitW = native.w * (native.ws ?? 1) * 2;
        hitH = native.h * (native.hs ?? 1) * 2;
      }

      if (hasHitboxRadius && hitW === 0) {
        hitW = worldHitboxRadius * 2;
        hitH = worldHitboxRadius * 2;
      }

      const signedW = hitW * signedColliderScale.x, signedH = hitH * signedColliderScale.y;
      hitW *= colliderScale.x;
      hitH *= colliderScale.y;

      if (hitW > 0 && hitH > 0) {
        const quarter = Math.abs(Math.abs(Math.fround(levelObj.rot || 0)) - 180) === 90;
        const dx = hasHitboxRadius ? 0 : Math.min(0, quarter ? signedH : signedW) / -2;
        const dy = hasHitboxRadius ? 0 : Math.min(0, quarter ? signedW : signedH) / -2;
        const collider = new Collider(hazardType, worldX + dx, worldY + dy,
          hasHitboxRadius ? hitW : Math.max(0, signedW), hasHitboxRadius ? hitH : Math.max(0, signedH), levelObj.rot || 0);
        if (hasHitboxRadius) collider.hitbox_radius = worldHitboxRadius * Math.max(colliderScale.x, colliderScale.y);
        registerCollider(collider);
        this.objects.push(collider);
        hasCollisionEntry = true;
        this._addCollisionToSection(collider);
      }
    } else if (objectDef.type === portalType) {
      const native = window.GD_OBJECTS?.[levelObj.id];
      const content = native && this.gdRenderer?.frames.get(native.f);
      const portalW = (native?.w > 0 ? native.w * (native.ws ?? 1) * 2 : content?.cw > 0 ? content.cw * (native.ws ?? 1) * 2 : objectDef.gridW * a) * colliderScale.x;
      const portalH = (native?.h > 0 ? native.h * (native.hs ?? 1) * 2 : content?.ch > 0 ? content.ch * (native.hs ?? 1) * 2 : objectDef.gridH * a) * colliderScale.y;
      const portalSub = objectDef.sub || {
        10: "gravity_flip",
        11: "gravity_normal",
        12: "cube",
        13: "fly",
        45: "mirrora",
        46: "mirrorb",
        47: "ball",
        660: "wave",
        111: "ufo",
        745: "robot",
        1331: "spider",
        747: "teleport",
        286: "dual_on",
        287: "dual_off"
      }[levelObj.id];

      const portalColliderType = levelObj.id === 1933 ? "portal_swing" : {
        gravity_flip: "portal_gravity_down",
        gravity_normal: "portal_gravity_up",
        gravity_toggle: "portal_gravity_toggle",
        [flyPortal]: "portal_fly",
        fly: "portal_fly",
        [cubePortal]: "portal_cube",
        cube: "portal_cube",
        ball: "portal_ball",
        wave: portalWaveType,
        ufo: portalUfoType,
        robot: "portal_robot",
        spider: "portal_spider",
        teleport: "portal_teleport",
        mirrora: "portal_mirror_on",
        mirrorb: "portal_mirror_off",
        shrink: "portal_mini_on",
        grow: "portal_mini_off",
        dual_on: "portal_dual_on",
        dual_off: "portal_dual_off"
      }[portalSub] || null;

      if (portalColliderType) {
        const portalRot = parseFloat(levelObj.rot || 0) || 0;
        const portalRotRad = portalRot * Math.PI / 180;
        const isTeleportPortal = portalColliderType === "portal_teleport";
        // The teleport portal's native collision offset is 12 GD units,
        // stored in the extracted definition's boxOffset, not 15.
        // A flipped portal turns its offset with it (native Dash X13035: flip X at 90 degrees).
        const hitboxShift = isTeleportPortal ? -(window.GD_OBJECTS?.[levelObj.id]?.bo?.[0] ?? 15) * 2 * colliderScale.x * (levelObj.flipX ? -1 : 1) : 0;
        const colliderX = worldX - Math.cos(portalRotRad) * hitboxShift;
        const colliderY = worldY + Math.sin(portalRotRad) * hitboxShift;
        const collider = new Collider(portalColliderType, colliderX, colliderY, portalW, portalH, portalRot);
        collider.particleColor = objectDef.portalParticleColor;
        collider.portalX = worldX;
        collider.portalY = worldY;
        if (isTeleportPortal) {
          collider.teleportToGroup = objectId === 2902;
          const yOffset = this._getTeleportPortalYOffset(levelObj);
          collider.teleportTargetX = worldX;
          collider.teleportTargetY = worldY + yOffset * 2;
          collider.teleportYOffset = yOffset * 2;
        }
        registerCollider(collider);
        this.objects.push(collider);
        hasCollisionEntry = true;
        this._addCollisionToSection(collider);
      }
    } else if (objectDef.type === padType) {
      // firstSetup copies the untrimmed content size (28b03c..28b04e),
      // then customSetup may override it. The spider pad's native
      // getObjectRect is 28.5x11 (catalogue w/h), not the 15-high content.
      const native = window.GD_OBJECTS?.[levelObj.id];
      const content = native && this.gdRenderer?.frames.get(native.f);
      const padW = (native?.w > 0 ? native.w * (native.ws ?? 1) * 2 : content?.cw > 0 ? content.cw * (native.ws ?? 1) * 2 : objectDef.gridW * a) * colliderScale.x;
      const padH = (native?.h > 0 ? native.h * (native.hs ?? 1) * 2 : content?.ch > 0 ? content.ch * (native.hs ?? 1) * 2 : objectDef.gridH * a) * colliderScale.y;
      const padObj = new Collider(jumpPadType, worldX, worldY, padW, padH, levelObj.rot || 0);
      padObj.padId = levelObj.id;
      registerCollider(padObj);
      this.objects.push(padObj);
      hasCollisionEntry = true;
      this._addCollisionToSection(padObj);
      const _padId = parseInt(levelObj.id ?? 0, 10);
      if ([35, 67, 140, 1332, 3005].includes(_padId) && !gdObj && !levelObj.noParticles && !levelObj.noEffects && !window.enableLDM && !window.isEditor && !scene?._editorPlaytestActive) {
        const _padW = objectDef.gridW * a * colliderScale.x;
        let _padTint = 0xffffff;
        if (levelObj.color1 > 0 && scene._colorManager) {
          _padTint = scene._colorManager.getHex(levelObj.color1);
        } else if (_padId === 35) {
          _padTint = 0xffcc00;
        } else if (_padId === 67) {
          _padTint = 0x00ffff;
        } else if (_padId === 1332) {
          _padTint = 0xff3344;
        } else if (_padId === 140) {
          _padTint = 0xff33aa;
        } else if (_padId === 3005) {
          _padTint = 0xa833ff;
        }
        const rotDeg = ((levelObj.rot || 0) % 360 + 360) % 360;
        const isUpsideDown = normRot => normRot === 180 || (levelObj.flipY && normRot === 0);
        let minAngle = 255, maxAngle = 285;
        let gravY = -500, gravX = 0;
        let offsetY = -2, offsetX = 0;
        if (isUpsideDown(rotDeg)) {
          minAngle = 60;
          maxAngle = 120;
          gravY = 500;
          offsetY = 2;
        } else if (rotDeg === 90) {
          minAngle = -30;
          maxAngle = 30;
          gravY = 0;
          gravX = 500;
          offsetX = 2;
        } else if (rotDeg === 270) {
          minAngle = 150;
          maxAngle = 210;
          gravY = 0;
          gravX = -500;
          offsetX = -2;
        }
        const _padEmitter = scene.add.particles(worldX + offsetX, b(worldY) + offsetY, "GJ_WebSheet", {
          frame: "square.png",
          lifespan: { min: 250, max: 450 },
          speed: { min: 180, max: 220 },
          angle: { min: minAngle, max: maxAngle },
          x: rotDeg === 90 || rotDeg === 270 ? 0 : { min: -_padW / 2, max: _padW / 2 },
          y: rotDeg === 90 || rotDeg === 270 ? { min: -_padW / 2, max: _padW / 2 } : 0,
          scale: { start: 0.5, end: 0 },
          alpha: { start: 0.85, end: 0 },
          gravityX: gravX,
          gravityY: gravY,
          frequency: 24,
          tint: _padTint,
          blendMode: Phaser.BlendModes.ADD,
          emitting: true
        });
        _padEmitter.setDepth(12);
        _padEmitter.setScrollFactor(1);
        padObj._padParticleEmitter = _padEmitter;
        padObj.emitters = [_padEmitter];
        (this._legacyEmitters ||= []).push(_padEmitter);
        if (levelObj.color1 > 0) {
          if (!this._colorChannelSprites[levelObj.color1]) this._colorChannelSprites[levelObj.color1] = [];
          this._colorChannelSprites[levelObj.color1].push(_padEmitter);
        }
        const objGids = levelObj.groups ? String(levelObj.groups).split(".").map(Number).filter(n => n > 0) : null;
        if (objGids && objGids.length) {
          _padEmitter._eeGroups = objGids;
          for (const gid of objGids) {
            if (!this._groupSprites[gid]) this._groupSprites[gid] = [];
            this._groupSprites[gid].push(_padEmitter);
          }
        }
        this.topContainer.add(_padEmitter);
      }
    } else if (objectDef.type === ringType) {
      const native = window.GD_OBJECTS?.[levelObj.id];
      const orbW = (native?.w > 0 ? native.w * (native.ws ?? 1) * 2 : objectDef.gridW * a) * colliderScale.x;
      const orbH = (native?.h > 0 ? native.h * (native.hs ?? 1) * 2 : objectDef.gridH * a) * colliderScale.y;
      const orbObj = new Collider(jumpRingType, worldX, worldY, orbW, orbH, levelObj.rot || 0);
      orbObj.orbId = levelObj.id;
      // GameObject key 99, m_isMultiActivate: the ring is never marked used
      orbObj.multiActivate = levelObj._raw?.[99] === "1";
      // startDashing (4f3c6b..4f3ccf) reads object rotation, adds 180
      // for Flip X and for reflected node axes. Sprite Flip Y does not
      // reflect this world-space heading (Orbit's 20-degree green dash).
      const axes = Math.abs(Number(levelObj.rotationX ?? levelObj.rot ?? 0) - Number(levelObj.rotationY ?? levelObj.rot ?? 0));
      orbObj.orbRotation = (levelObj.rot || 0) + (levelObj.flipX ? 180 : 0) + (axes > 179 ? 180 : 0);
      orbObj._dashHoldTicks = 0;
      registerCollider(orbObj);
      this.objects.push(orbObj);
      hasCollisionEntry = true;
      this._addCollisionToSection(orbObj);
    } else if (objectDef.type === coinType || window.GD_OBJECTS?.[objectId]?.t === 30) {
      const native=window.GD_OBJECTS?.[objectId];
      const coinW = (native?.w > 0 ? native.w*(native.ws??1)*2 : (objectDef.gridW || 1)*a) * colliderScale.x;
      const coinH = (native?.h > 0 ? native.h*(native.hs??1)*2 : (objectDef.gridH || 1)*a) * colliderScale.y;
      const coinObj = new Collider(coinType, worldX, worldY, coinW, coinH, levelObj.rot || 0);
      coinObj.coinId = levelObj.id;
      if (objectId === SECRET_COIN_OBJECT_ID) {
        coinObj.secretCoinId = linkedObjectId;
        coinObj.secretCoinSlot = secretCoinSlot;
        coinObj._secretCoinCompleted = this._secretCoinCompleted.has(String(linkedObjectId));
      }
      if (objectId === USER_COIN_OBJECT_ID) {
        coinObj.userCoinId = linkedObjectId;
        coinObj.userCoinSlot = userCoinSlot;
        coinObj._userCoinCompleted = this._userCoinCompleted.has(String(linkedObjectId));
      }
      registerCollider(coinObj);
      this.objects.push(coinObj);
      hasCollisionEntry = true;
      this._addCollisionToSection(coinObj);
    } else if (objectDef.type === speedType) {
      // Speed changes are Modifier contacts with their extracted native
      // content rectangle too. The legacy grid used 30x90 for 200/201/202,
      // shifting both horizontal activation and contacts at tall scaled gates.
      const native = window.GD_OBJECTS?.[levelObj.id];
      const speedW = (native?.w > 0 ? native.w * (native.ws ?? 1) * 2 : (objectDef.gridW || 1) * a) * colliderScale.x;
      const speedH = (native?.h > 0 ? native.h * (native.hs ?? 1) * 2 : (objectDef.gridH || 1) * a) * colliderScale.y;
      const speedObj = new Collider(speedType, worldX, worldY, speedW, speedH, levelObj.rot || 0);
      speedObj.portalY = worldY;

      const speedMap = {
        200: SpeedPortal.HALF,
        201: SpeedPortal.ONE_TIMES,
        202: SpeedPortal.TWO_TIMES,
        203: SpeedPortal.THREE_TIMES,
        1334: SpeedPortal.FOUR_TIMES
      };

      speedObj.speedValue = speedMap[levelObj.id] ?? SpeedPortal.ONE_TIMES;
      speedObj.speedId = levelObj.id;
      registerCollider(speedObj);
      this.objects.push(speedObj);
      hasCollisionEntry = true;
      this._addCollisionToSection(speedObj);
    }

    if (!hasCollisionEntry) {
      this.objects.push({
        type: objectDef.type || decoType,
        activated: false,
        x: 0,
        y: 0
      });
    }

    this._registerBeastAnimation(levelObj, linkedObjectId);
  }

  return objectDef;
}

  _registerBeastAnimation(levelObj, linkedObjectId) {
    const beastDef = _BEAST_ANIMATION_DEFS[Number(levelObj?.id)];
    const sprites = this.objectSprites?.[linkedObjectId];
    if (!beastDef || !Array.isArray(sprites) || !sprites.length) return;

    const descriptor = _getBeastDescriptor(this._scene, beastDef.cacheKey);
    const prefix = beastDef.cacheKey.replace(/_AnimDesc$/, "");
    const settings = this._scene.cache?.json?.get("GDBeastSettings")?.[prefix];
    const defaultClip = settings?.defaultAnimation ? prefix + "_" + settings.defaultAnimation : beastDef.clip;
    const frames = descriptor?.[defaultClip];
    if (!Array.isArray(frames) || !frames.length) return;

    // A description identifies a part by its source texture and tag. The level
    // object can contain duplicate textures (the sludge has two arms), so use
    // one sprite per texture occurrence in its original creation order.
    const available = new Map();
    for (const sprite of sprites) {
      if (!sprite?.active || sprite._eeIsGlowSprite || sprite._eeBeastColorSprite || !sprite._eeSourceFrame) continue;
      const list = available.get(sprite._eeSourceFrame) || [];
      list.push(sprite);
      available.set(sprite._eeSourceFrame, list);
    }

    const parts = [];
    const firstPose = frames[0].pieces;
    const claimedCompanions = new Set();
    for (let poseIndex = 0; poseIndex < firstPose.length; poseIndex++) {
      const posePart = firstPose[poseIndex];
      const candidate = available.get(posePart.texture)?.shift();
      if (!candidate) continue;
      const glowFrame = posePart.texture.replace(/_001\.png$/, "_glow_001.png");
      const companion = sprites.find(sprite =>
        (sprite?._eeIsGlowSprite || sprite?._eeBeastColorSprite) &&
        sprite._eeSourceFrame === glowFrame &&
        !claimedCompanions.has(sprite)
      );
      if (companion) claimedCompanions.add(companion);
      const companions = companion ? [companion] : [];
      if (Number(levelObj.id) === 918 && posePart.tag === "1") {
        const eye = sprites.find(sprite => sprite._eeSourceFrame === "GJBeast01_03_001.png");
        if (eye) { eye._eeBeastEye = true; companions.push(eye); }
      }
      parts.push({
        sprite: candidate,
        companions,
        poseIndex,
        defaultPose: posePart,
        tag: posePart.tag
      });
    }
    if (!parts.length) return;

    const objectScale = getObjectVisualScale(levelObj, getObjectFromId(levelObj?.id));
    const objectDef = getObjectFromId(levelObj?.id);
    const zLayer = Number.isFinite(Number(levelObj?.zLayer)) && Number(levelObj.zLayer) !== 0
      ? Number(levelObj.zLayer)
      : (objectDef?.default_z_layer ?? 0);
    const zOrder = Number.isFinite(Number(levelObj?.zOrder)) && Number(levelObj.zOrder) !== 0
      ? Number(levelObj.zOrder)
      : (objectDef?.default_z_order ?? 0);
    this._beastAnimations.push({
      frames,
      parts,
      objectId: Number(levelObj?.id),
      cacheKey: beastDef.cacheKey,
      prefix, settings,
      defaultClip,
      clip: defaultClip,
      groups: this._getLevelObjectGroupIds(levelObj),
      referencePose: firstPose,
      pivotX: Number(levelObj.x) * 2,
      pivotY: b(Number(levelObj.y) * 2),
      baseZDepth: getGDZDepth(zLayer, zOrder),
      // Descriptor positions are in logical sprite units.  The initial
      // sprite scale already carries the same object transform, so animation
      // offsets need these independent axes too.  A single scale tore a
      // stretched beast's jaw/body apart during the pose update.
      scaleX: Number.isFinite(objectScale.x) && objectScale.x !== 0 ? objectScale.x : 1,
      scaleY: Number.isFinite(objectScale.y) && objectScale.y !== 0 ? objectScale.y : 1,
      rotation: Number(levelObj?.rot) || 0,
      flipX: !!levelObj?.flipX,
      flipY: !!levelObj?.flipY,
      speed: levelObj._raw?.[122] === "1" ? Math.max(0, Number(levelObj._raw[107] ?? 1)) : 1,
      frameDuration: Number(settings?.animations?.[settings.defaultAnimation]?.delay || .05) * 1000,
      looped: settings?.animations?.[settings.defaultAnimation]?.looped !== false,
      randomState: (Math.random() * 0x100000000) >>> 0
    });
    const registered = this._beastAnimations[this._beastAnimations.length - 1];
    registered.frameDuration = registered.speed > 0 ? registered.frameDuration / registered.speed : Infinity;
    // updateObjectAnimation (6457b1) seeks the default animation to a random
    // normalized phase when activating a previously idle native monster.
    registered.defaultStartTime = -Math.random() * registered.frames.length * (Number.isFinite(registered.frameDuration) ? registered.frameDuration : 0);
    registered.startTime = registered.defaultStartTime;
    if (this.gdRenderer && !this._scene?._editorPlaytestActive) {
      const animation = this._beastAnimations[this._beastAnimations.length - 1];
      const node = this.gdRenderer.addObject({ ...levelObj, _gdInvisible: true }, {
        bc: objectDef.default_base_color_channel || 0, dc: -1,
        zl: zLayer, zo: zOrder, pm: objectDef.spritesheet?.includes("FireSheet") ? 3 : 0,
        n: [null, 0, 0, 0.5, 0.5, 1, 1, 0, 0, 0, 4, 255, 0xffffff, null, []]
      });
      node.linkedId = linkedObjectId; this.gdObjects[linkedObjectId] = node;
      animation.node = node;
      animation.sprites = sprites;
      this.gdRenderer.spriteAnimations.push({ node, animation });
      // Retain visible/alpha/pose state for the animator, but draw each piece
      // exactly once through the shared native renderer.
      for (const sprite of sprites) sprite.renderWebGL = () => {};
    }
  }

  _setBeastClip(beast, clip, clock, transition = false) {
    const frames = _getBeastDescriptor(this._scene, beast.cacheKey)?.[clip];
    if (!frames?.length) return false;
    const config = beast.settings?.animations?.[clip.slice(beast.prefix.length + 1)];
    const from = transition && beast.lastPose && !beast._culled ? structuredClone(beast.lastPose) : null;
    beast.clip = clip; beast.frames = frames; beast.referencePose = frames[0].pieces;
    beast.frameDuration = beast.speed > 0 ? Number(config?.delay || .05) * 1000 / beast.speed : Infinity;
    beast.looped = config?.looped !== false;
    beast.transition = from ? { from, start: clock, duration: 50 } : null;
    beast.startTime = clock + (from ? 50 : 0);
    return true;
  }

  _nextBeastClip(beast) {
    // AnimatedGameObject::animationFinished (645b00): one-shot attacks enter
    // their authored hold loops, and endings return to the default motion.
    const name = beast.clip.slice(beast.prefix.length + 1);
    let next = beast.settings?.defaultAnimation || "idle01";
    if (beast.objectId === 918 && name === "attack01") next = "attack01_loop";
    else if (beast.objectId === 1584 && name === "attack02") next = "attack02_loop";
    else if (beast.objectId === 1584 && name === "sleep") next = "sleep_loop";
    else if (beast.objectId === 2012 && name === "toAttack01") next = "attack01";
    else if (beast.objectId === 2012 && name === "toAttack03") next = "attack03";
    else if ([1327,1328,1584,2012].includes(beast.objectId) && name === "idle01") {
      beast.randomState = (Math.imul(beast.randomState, 214013) + 2531011) >>> 0;
      if (((beast.randomState >>> 16) & 32767) / 32767 > (beast.objectId === 1584 ? .8 : .75)) next = "idle02";
    }
    return beast.prefix + "_" + next;
  }

  updateBeastAnimations(elapsedMs) {
    if (!this._beastAnimations?.length) return;
    const clock = Math.max(0, Number(elapsedMs) || 0);
    this._beastAnimationClock = clock;
    for (const animation of this._beastAnimations) {
      for (let transitions = 0; !animation.looped && clock >= animation.startTime + animation.frames.length * animation.frameDuration && transitions < 256; transitions++) {
        const end = animation.startTime + animation.frames.length * animation.frameDuration;
        if (!this._setBeastClip(animation, this._nextBeastClip(animation), end)) break;
      }
      const frameCount = animation.frames.length;
      if (!frameCount) continue;
      const framePosition = Math.max(0, clock - (animation.startTime || 0)) / animation.frameDuration;
      const frameIndex = Math.floor(framePosition) % frameCount;
      let pose = animation.frames[frameIndex]?.pieces;
      let nextPose = pose, tween = 0;
      if (animation.transition) {
        tween = Math.max(0, Math.min(1, (clock - animation.transition.start) / animation.transition.duration));
        if (tween < 1) { pose = animation.transition.from; nextPose = animation.frames[0]?.pieces; }
        else animation.transition = null;
      }
      if (!pose || !nextPose) continue;
      // Descriptor frames are immutable. Only an actual clip transition needs
      // interpolated copies; _setBeastClip detaches its transition source.
      animation.lastPose = nextPose === pose ? pose : pose.map((part, i) => {
        const next = nextPose.find(p => p.tag === part.tag) || nextPose[i] || part;
        const delta = ((next.rotation - part.rotation + 180) % 360 + 360) % 360 - 180;
        return { ...part, x: part.x + (next.x - part.x) * tween, y: part.y + (next.y - part.y) * tween,
          rotation: part.rotation + delta * tween, scaleX: part.scaleX + (next.scaleX - part.scaleX) * tween,
          scaleY: part.scaleY + (next.scaleY - part.scaleY) * tween };
      });

      const rotationRadians = animation.rotation * Math.PI / 180;
      const cos = Math.cos(rotationRadians);
      const sin = Math.sin(rotationRadians);
      const flipX = animation.flipX ? -1 : 1;
      const flipY = animation.flipY ? -1 : 1;
      // Cocos stores pose Y and rotation in an upwards-positive coordinate
      // system; Phaser's display coordinates are downwards-positive.
      const rotationSign = animation.flipX !== animation.flipY ? 1 : -1;

      // Off-screen animations are not drawn; skip their per-part pose work.
      const firstSprite = animation.parts[0]?.sprite;
      if (!this.gdRenderer?.spriteAnimations?.length && firstSprite?.parentContainer?.visible === false) continue;
      // Every part shares the object's groups: one offset per animation.
      const groupOffset = firstSprite ? this._getCombinedGroupOffset(firstSprite) : { x: 0, y: 0 };
      animation.poseOffset = groupOffset;
      // Cull against the renderer's (zoom- and rotation-aware) view in GD
      // units. Hidden parts cost Phaser nothing on any of its cameras.
      const view = this.gdRenderer?.camera;
      if (view && view.w) {
        const point = animation.node && this.gdRenderer.livePosition(animation.node);
        let gx = point ? point.x : (animation.pivotX + groupOffset.x) / 2;
        let gy = point ? point.y : (T - animation.pivotY - groupOffset.y) / 2;
        const area = {};
        if (animation.node && this.areaState?.active) this.areaState.forObject(animation.node, gx, gy, area);
        gx += area.dx || 0; gy += area.dy || 0;
        const af = animation.node?.affine;
        const stretch = af ? Math.max(1, Math.hypot(af[0], af[1]), Math.hypot(af[2], af[3])) : 1;
        const areaStretch = area.linearActive ? Math.max(1, Math.hypot(...area.linear)) : Math.max(1, Math.abs(area.sx || 1), Math.abs(area.sy || 1));
        const reach = (animation._reach ||= 160 * Math.max(1, Math.abs(animation.scaleX), Math.abs(animation.scaleY))) * stretch * areaStretch;
        const visible = gx + reach >= view.x && gx - reach <= view.x + view.w && gy + reach >= view.y && gy - reach <= view.y + view.h;
        if (!visible) {
          if (!animation._culled) {
            animation._culled = true;
            for (const part of animation.parts) {
              part.sprite?.setVisible?.(false);
              for (const companion of part.companions || []) companion?.setVisible?.(false);
            }
          }
          continue;
        }
        if (animation._culled) {
          animation._culled = false;
          for (const part of animation.parts) for (const companion of part.companions || []) companion?.setVisible?.(true);
        }
      }
      for (const part of animation.parts) {
        const sprite = part.sprite;
        const lookupPiece = (pieces) => {
          let byTag = pieces._eeByTag;
          if (!byTag) {
            byTag = new Map();
            for (const piece of pieces) if (!byTag.has(piece.tag)) byTag.set(piece.tag, piece);
            Object.defineProperty(pieces, "_eeByTag", { value: byTag, enumerable: false });
          }
          return byTag.get(part.tag) || pieces[part.poseIndex];
        };
        const reference = lookupPiece(animation.referencePose || []) || part.defaultPose;
        const target = lookupPiece(pose);
        const nextTarget = lookupPiece(nextPose);
        if (!sprite?.active || !reference) continue;
        if (!target || !nextTarget) {
          sprite.setVisible?.(false);
          for (const companion of part.companions || []) companion?.setVisible?.(false);
          continue;
        }
        sprite.setVisible?.(true);

        if (sprite._eeCurrentBeastFrame !== target.texture) {
          const frameInfo = getAtlasFrame(this._scene, target.texture);
          if (frameInfo) {
            sprite.setTexture(frameInfo.atlas, frameInfo.frame);
            sprite._eeCurrentBeastFrame = target.texture;
          }
        }

        const targetX = target.x + (nextTarget.x - target.x) * tween;
        const targetY = target.y + (nextTarget.y - target.y) * tween;
        const angleDelta = ((nextTarget.rotation - target.rotation + 180) % 360 + 360) % 360 - 180;
        const targetRotation = target.rotation + angleDelta * tween;
        const targetScaleX = target.scaleX + (nextTarget.scaleX - target.scaleX) * tween;
        const targetScaleY = target.scaleY + (nextTarget.scaleY - target.scaleY) * tween;
        // AnimDesc positions are absolute offsets from the AnimatedGameObject
        // pivot. Using deltas on top of the hand-authored fallback child
        // offsets left the first pose wrong (most visibly the detached jaw).
        const localX = targetX * 2 * animation.scaleX * flipX;
        const localY = -targetY * 2 * animation.scaleY * flipY;
        const offsetX = localX * cos - localY * sin;
        const offsetY = localX * sin + localY * cos;

        sprite.x = animation.pivotX + offsetX + groupOffset.x;
        sprite.y = animation.pivotY + offsetY + groupOffset.y;
        sprite._eeWorldX = sprite.x;
        sprite._eeBaseY = sprite.y;
        sprite.rotation = (animation.rotation + rotationSign * targetRotation) * Math.PI / 180;
        sprite.setScale(
          animation.scaleX * targetScaleX,
          animation.scaleY * targetScaleY
        );
        sprite.setFlipX?.(animation.flipX !== !!target.flipX);
        sprite.setFlipY?.(animation.flipY !== !!target.flipY);

        // The descriptor's zValue determines which animated piece is in
        // front (for example a beast jaw versus its face).  Preserve the
        // placed object's overall Z layer and adjust only this local order.
        const desiredZDepth = animation.baseZDepth + (Number(target.z) || 0) * 0.01;
        if (sprite._eeZDepth !== desiredZDepth) {
          sprite._eeZDepth = desiredZDepth;
          if (sprite.parentContainer) this._insertSpriteByZ(sprite.parentContainer, sprite);
        }

        for (const companion of part.companions || []) {
          if (!companion?.active) continue;
          const nextGlowFrame = target.texture.replace(/_001\.png$/, "_glow_001.png");
          if (!companion._eeBeastEye && companion._eeCurrentBeastFrame !== nextGlowFrame) {
            const frameInfo = getAtlasFrame(this._scene, nextGlowFrame);
            if (frameInfo) {
              companion.setTexture(frameInfo.atlas, frameInfo.frame);
              companion._eeCurrentBeastFrame = nextGlowFrame;
            }
          }
          companion.x = sprite.x;
          companion.y = sprite.y;
          companion._eeWorldX = sprite.x;
          companion._eeBaseY = sprite.y;
          companion.rotation = sprite.rotation;
          companion.setScale(sprite.scaleX, sprite.scaleY);
          companion.setFlipX?.(sprite.flipX); companion.setFlipY?.(sprite.flipY);
          companion.setVisible((companion._eeBeastColorSprite || companion._eeBeastEye || this._isGlowVisible()) && !companion._eeHidden && !(window.enableLDM && companion._eeHighDetail));
          const companionDepth = companion._eeBeastColorSprite ? animation.baseZDepth - .1 + (Number(target.z) || 0) * .001
            : desiredZDepth + (companion._eeBeastEye ? .003 : -.003);
          if (companion._eeZDepth !== companionDepth) {
            companion._eeZDepth = companionDepth;
            if (companion.parentContainer) this._insertSpriteByZ(companion.parentContainer, companion);
          }
        }
      }
    }
  }

  _spawnLevelObjects(_0x35f1ae) {
    for (const obj of _0x35f1ae) if (obj.id === 2900 && obj._raw?.[172] !== "1") {
      const raw = obj._raw || {}, target = raw[171] === "1" ? (Number(raw[173]) || 0) : (Number(raw[170]) || 0);
      const angle = -(Number(obj.rot) || 0) * Math.PI / 180;
      const dx = Math.cos(angle) * (obj.flipX ? -1 : 1), dy = Math.sin(angle) * (obj.flipY ? -1 : 1);
      this._channelDirections[target] = { x: Math.abs(dx) < 1e-8 ? 0 : dx, y: Math.abs(dy) < 1e-8 ? 0 : dy };
    }
    this._initialChannelDirections = structuredClone(this._channelDirections);
    const unknownObjectIds = new Set();
    this._liveObjectIds = new Set();
    this._lastObjectX = 0;
    this._nextObjectId = 0;
    // calculateMaxGameplayY (344e20): dynamic levels scan every authored
    // object position, with a 1200-native-unit minimum and 390-unit margin.
    // Native object/player Y includes the 90-unit ground origin.
    let highestNativeY = 1200;

    for (const levelObj of _0x35f1ae) {
      highestNativeY = Math.max(highestNativeY, (Number(levelObj.y) || 0) + 90);
      const objectDef = this._spawnObject(levelObj);
      if (Number.isInteger(levelObj._eeObjectId)) this._liveObjectIds.add(levelObj._eeObjectId);
      if (!objectDef) {
        unknownObjectIds.add(levelObj.id);
      }
    }

    this._highestObjectNativeY = highestNativeY;
    this.maxGameplayY = (2790 - 90) * 2;

    unknownObjectIds.size;
    if (unknownObjectIds.size > 0) {
    }

    const colTypeCounts = {};
    for (const obj of this.objects) {
      colTypeCounts[obj.type] = (colTypeCounts[obj.type] || 0) + 1;
    }

    this.gdRenderer?.finalize();
    if (this.gdRenderer) this.gdRenderer.keyframeFrames = !!window.isEditor || !!this.keyframeState?.nodes.length;
    // addUIObject removes the object from the native world/collision
    // sections (32ecf9). UI may contain any object type, including solids;
    // it must not leave its old, now invisible collision in the level.
    for (const collider of this.objects) {
      collider._eeUIObject = !!this.gdObjects[collider._eeObjectId]?.isUIObject;
      if (collider._eeUIObject) this._removeCollisionFromSections(collider);
    }
    this._colorTriggers.sort((a, b) => a.x - b.x);
    this._enterEffectTriggers.sort((a, b) => a.x - b.x);
    this._moveTriggers.sort((a, b) => a.x - b.x);
    this._followTriggers.sort((a, b) => a.x - b.x);
    this._scaleTriggers.sort((a, b) => a.x - b.x);
    this._alphaTriggers.sort((a, b) => a.x - b.x);
    this._toggleTriggers.sort((a, b) => a.x - b.x);
    this._animationTriggers.sort((a, b) => a.x - b.x);
    this._shakeTriggers.sort((a, b) => a.x - b.x);
    this._stopTriggers.sort((a, b) => a.x - b.x);
    this._rotateTriggers.sort((a, b) => a.x - b.x);
    this._pulseTriggers.sort((a, b) => a.x - b.x);
    this._spawnTriggers.sort((a, b) => a.x - b.x);
    this._countTriggers.sort((a, b) => a.x - b.x);
    this._shaderTriggers.sort((a, b) => a.x - b.x);
    this._cameraTriggers.sort((a, b) => a.x - b.x);
    this._gradientTriggers.sort((a, b) => a.x - b.x);
    this._areaTriggers.sort((a, b) => a.x - b.x);
    this._advFollowTriggers.sort((a, b) => a.x - b.x);
    this._endTriggers.sort((a, b) => a.x - b.x);
    this._keyframeTriggers.sort((a, b) => a.x - b.x);

    for (let si = 0; si < this._sectionContainers.length; si++) {
      const sc = this._sectionContainers[si];
      if (sc) {
        if (sc.normal && sc.normal.list && sc.normal.list.length > 1) sc.normal.sort("depth");
        if (sc.additive && sc.additive.list && sc.additive.list.length > 1) sc.additive.sort("depth");
      }
    }

    this.endXPos = Math.max(screenWidth + 1200, this._lastObjectX + 680);

    if (window.createObjectIds) {
      const scene = this._scene;
      const worldContainer = this.container || this._container;

      if (worldContainer) {
        this._debugIdTextsList = [];

        _0x35f1ae.forEach((levelObj, index) => {
          if (!levelObj || levelObj.id === undefined) return;

          if (window.enableLDM && ldm_object.has(parseInt(levelObj.id, 10))) return;

          const worldX = levelObj.x * 2;
          const textY = typeof b === 'function' ? b(levelObj.y * 2) : levelObj.y * 2;

          const idText = scene.add.text(worldX, textY, String(levelObj.id), {
            fontFamily: 'monospace',
            fontSize: '30px',
            fill: '#00ff00', 
            stroke: '#000000',
            strokeThickness: 3
          });
          idText.setOrigin(0.5);
          idText.setDepth(999); 
          idText.setVisible(window.showObjectIds && !window.enableLDM);

          worldContainer.add(idText);

          idText.preUpdate = () => {
            idText.x = worldX;
            idText.y = textY;
          };

          scene.sys.updateList.add(idText);
          this._debugIdTextsList.push(idText);

          if (!this.objectSprites[index]) this.objectSprites[index] = [];
          this.objectSprites[index].push(idText);
        });
      }
    }
  }
  createEndPortal(_0x41fbdb) {
    if (window.isEditor) return; // not dealing with ts rn
    var _0x400605;
    if (this.endXPos <= 0) {
      return;
    }
    const _0x3b56d4 = this.endXPos;
    const _0x1c3aea = b(240);
    const _0x46064b = Math.round(16);
    this._endPortalContainer = _0x41fbdb.add.container(_0x3b56d4, _0x1c3aea);
    for (let _0x2a327c = 0; _0x2a327c < _0x46064b; _0x2a327c++) {
      const _0xacf7ef = _0x41fbdb.add.image(0, (_0x2a327c - Math.floor(_0x46064b / 2)) * a, "GJ_WebSheet", "square_02_001.png").setAngle(-90);
      this._endPortalContainer.add(_0xacf7ef);
    }
    this.container.add(this._endPortalContainer);
    this._endPortalShine = _0x41fbdb.add.image(_0x3b56d4 - 58, _0x1c3aea, "GJ_WebSheet", "gradientBar.png");
    const _0x3e25a9 = ((_0x400605 = _0x41fbdb.textures.getFrame("GJ_WebSheet", "gradientBar.png")) == null ? undefined : _0x400605.height) || 64;
    this._endPortalShine.setBlendMode(S);
    this._endPortalShine.setTint(window.mainColor);
    this._endPortalShine.setScale(1, 960 / _0x3e25a9);
    this.additiveContainer.add(this._endPortalShine);
    if (window.enableLDM) {
      this._endPortalGameY = 240;
      return;
    }
    const _0x58cedb = _0x3b56d4 - 30;
    const _0x4f52b7 = {
      getRandomPoint: _0x4f04dd => {
        const _0x53ec71 = (85 + Math.random() * 190) * Math.PI / 180;
        const _0x42e60c = 320 + (Math.random() * 2 - 1) * 80;
        _0x4f04dd.x = Math.cos(_0x53ec71) * _0x42e60c;
        _0x4f04dd.y = Math.sin(_0x53ec71) * _0x42e60c;
        return _0x4f04dd;
      }
    };
    this._endPortalEmitter = _0x41fbdb.add.particles(_0x58cedb, _0x1c3aea, "GJ_WebSheet", {
      frame: "square.png",
      lifespan: {
        min: 200,
        max: 1000
      },
      speed: 0,
      scale: {
        start: 0.75,
        end: 0.125
      },
      alpha: {
        start: 1,
        end: 0
      },
      tint: window.mainColor,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 10,
      maxParticles: 100,
      emitting: true,
      emitZone: {
        type: "random",
        source: _0x4f52b7
      },
      emitCallback: _0x2daff4 => {
        const _0x5e30d8 = -_0x2daff4.x;
        const _0x17ba71 = -_0x2daff4.y;
        const _0x3c5c52 = Math.sqrt(_0x5e30d8 * _0x5e30d8 + _0x17ba71 * _0x17ba71) || 1;
        const _0x279521 = (_0x3c5c52 - 20) / (_0x2daff4.life / 1000 || 0.3);
        _0x2daff4.velocityX = _0x5e30d8 / _0x3c5c52 * _0x279521;
        _0x2daff4.velocityY = _0x17ba71 / _0x3c5c52 * _0x279521;
      }
    });
    this._endPortalEmitter.setDepth(14);
    this.topContainer.add(this._endPortalEmitter);
    this._endPortalGameY = 240;
  }
  updateEndPortalY(_0x26f0ab, _0x43c4d1) {
    if (!this._endPortalContainer) {
      return;
    }
    const _0x50aa7d = 140 + _0x26f0ab;
    let _0x1be4c3;
    _0x1be4c3 = _0x43c4d1 ? _0x50aa7d : Math.max(240, _0x50aa7d);
    const _0x32e645 = b(_0x1be4c3);
    this._endPortalContainer.y = _0x32e645;
    this._endPortalShine.y = _0x32e645;
    if (this._endPortalEmitter) {
      this._endPortalEmitter.y = _0x32e645;
    }
    this._endPortalGameY = _0x1be4c3;
  }
  _isTriggerSaveObjectLive(uid) {
    if (!Number.isInteger(uid) || !Array.isArray(window.levelObjects)) return true;
    const node = this.gdObjects?.[uid];
    if (node) {
      // Trigger scans call this for every trigger at 240 Hz: no closure.
      if (!node.enabled || node.removed || (window.enableLDM && node.highDetail)) return false;
      const groups = node.groups, enabled = this._groupEnabled;
      for (let i = 0; i < groups.length; i++) if (enabled[groups[i]] === false) return false;
    }
    if (!window.isEditor && !this._scene?._editorPlaytestActive && this._liveObjectIds) return this._liveObjectIds.has(uid);
    return window.levelObjects.some(obj => obj && Number.isInteger(obj._eeObjectId) && obj._eeObjectId === uid);
  }

  checkColorTriggers(_0x2b00ce) {
    let _0x24b030 = [];
    for (const _0x39c924 of this._orderedTriggers("_colorTriggers", "_colorTriggerIdx", _0x2b00ce)) {
      if (this._isTriggerSaveObjectLive(_0x39c924.uid) && !_0x39c924.touchTriggered && !_0x39c924.spawnTriggered) {
        _0x24b030.push(_0x39c924);
      }
    }
    return _0x24b030;
  }
  checkTouchColorTriggers(playerX, playerY) {
    const triggered = [];
    const px = Number(playerX) || 0;
    const py = Number(playerY) || 0;
    this._touchColorTriggerActivated ||= new Set();

    const playerHalfSize = (typeof playerSize === "number" ? playerSize : 20);
    const halfHitbox = 30 + playerHalfSize;

    for (const trig of this._touchCandidates(this._colorTriggers, px)) {
      if (!trig || !trig.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      const uid = trig.uid ?? `${trig.x},${trig.y},${trig.index}`;
      if (this._touchColorTriggerActivated.has(uid)) continue;
      if (this._touchesTrigger(trig, px, py, halfHitbox)) {
        this._touchColorTriggerActivated.add(uid);
        triggered.push(trig);
      }
    }

    return triggered;
  }
  resetColorTriggers() {
    this._colorTriggerIdx = 0;
    this._touchColorTriggerActivated = new Set();
  }
  _getSectionIndexForWorldX(worldX) {
    return Math.max(0, Math.floor((Number(worldX) || 0) / 400));
  }
  _ensureSectionContainer(sectionIndex) {
    if (!this._sectionContainers[sectionIndex]) {
      const sectionContainer = {
        additive: this._scene.add.container(0, 0),
        normal: this._scene.add.container(0, 0)
      };
      const sectionVisible = this._visMinSec === undefined || this._visMinSec < 0 || (sectionIndex >= this._visMinSec && sectionIndex <= this._visMaxSec);
      sectionContainer.additive.visible = sectionVisible;
      sectionContainer.normal.visible = sectionVisible;
      this.additiveContainer.add(sectionContainer.additive);
      this.container.add(sectionContainer.normal);
      this._sectionContainers[sectionIndex] = sectionContainer;
    }
    return this._sectionContainers[sectionIndex];
  }
  _insertSpriteByZ(container, sprite) {
    if (!container || !sprite) return;
    const depth = Number.isFinite(Number(sprite._eeZDepth)) ? Number(sprite._eeZDepth) : 0;
    sprite.depth = depth;
    if (!Number.isFinite(sprite._eeRenderSequence)) {
      this._eeRenderSequence = (this._eeRenderSequence || 0) + 1;
      sprite._eeRenderSequence = this._eeRenderSequence;
    }
    if (sprite.parentContainer === container) {
      container.remove(sprite, false);
    } else if (sprite.parentContainer) {
      sprite.parentContainer.remove(sprite, false);
    }
    const children = container.list || [];
    const index = children.findIndex(candidate => {
      const candidateDepth = Number.isFinite(Number(candidate?._eeZDepth)) ? Number(candidate._eeZDepth) : 0;
      if (candidateDepth !== depth) return candidateDepth > depth;
      return (candidate?._eeRenderSequence || 0) > sprite._eeRenderSequence;
    });
    if (index < 0) container.add(sprite);
    else container.addAt(sprite, index);
  }
  _addToSection(sliderWidth) {
    const _0x4ac40a = this._getSectionIndexForWorldX(sliderWidth._eeWorldX);
    this._sections[_0x4ac40a] ||= [];
    this._sections[_0x4ac40a].push(sliderWidth);
    sliderWidth._eeSectionIndex = _0x4ac40a;
    const _0x14d5f7 = sliderWidth._eeLayer !== undefined ? sliderWidth._eeLayer : 1;
    // Layer 11 is globally above ordinary level content.  Additive blending
    // only changes blending; it must not split render order into another
    // container, otherwise normal/additive parts of one composite cross over.
    if (_0x14d5f7 === 2 || Number(sliderWidth._eeZDepth) >= getGDZDepth(11)) {
      this._insertSpriteByZ(this.topContainer, sliderWidth);
      return;
    }
    const _0x2157d3 = this._ensureSectionContainer(_0x4ac40a);
    this._insertSpriteByZ(_0x2157d3.normal, sliderWidth);
  }
  _refreshSpriteSection(sprite) {
    if (!sprite || sprite._eeWorldX === undefined) return;
    const nextSection = this._getSectionIndexForWorldX(sprite._eeWorldX);
    let prevSection = Number.isInteger(sprite._eeSectionIndex) ? sprite._eeSectionIndex : -1;
    if (prevSection < 0 && Array.isArray(this._sections)) {
      for (let i = 0; i < this._sections.length; i++) {
        const section = this._sections[i];
        if (Array.isArray(section) && section.includes(sprite)) {
          prevSection = i;
          break;
        }
      }
    }
    const layer = sprite._eeLayer !== undefined ? sprite._eeLayer : 1;
    const isTop = layer === 2 || Number(sprite._eeZDepth) >= getGDZDepth(11);
    if (prevSection === nextSection) {
      sprite._eeSectionIndex = nextSection;
      const target = isTop ? this.topContainer : this._ensureSectionContainer(nextSection).normal;
      // Already in place: removing and re-inserting by z is O(container) per move.
      if (sprite.parentContainer !== target) this._insertSpriteByZ(target, sprite);
      return;
    }
    if (prevSection >= 0 && Array.isArray(this._sections?.[prevSection])) {
      const section = this._sections[prevSection];
      const idx = section.indexOf(sprite);
      if (idx !== -1) section.splice(idx, 1);
    }
    this._sections[nextSection] ||= [];
    if (!this._sections[nextSection].includes(sprite)) this._sections[nextSection].push(sprite);
    sprite._eeSectionIndex = nextSection;

    if (isTop) {
      this._insertSpriteByZ(this.topContainer, sprite);
      return;
    }

    const sectionContainer = this._ensureSectionContainer(nextSection);
    this._insertSpriteByZ(sectionContainer.normal, sprite);
  }
  _getCollisionSectionIndices(collider) {
    // GJBaseGameLayer::checkCollisions uses 100 native points per cell
    // (37a0 = float .01), independently of the visual-section width.
    const sectionWidth = 200;
    const centerX = Number(collider?.x) || 0;
    let horizontalExtent = 0;

    // In the native layer, changing `m_hasExtendedCollision` removes and
    // re-adds the object to its collision sections.  A centre-only section
    // registration misses the ends of a deliberately stretched/rotated
    // object.  Keep ordinary objects in their one fast section, but register
    // an Extended Collision object's full horizontal AABB.
    if (collider?.extendedCollision) {
      if (Number.isFinite(Number(collider.hitbox_radius))) {
        horizontalExtent = Math.max(0, Number(collider.hitbox_radius));
      } else {
        const halfW = Math.max(0, Number(collider.w) || 0) / 2;
        const halfH = Math.max(0, Number(collider.h) || 0) / 2;
        const radians = (Number(collider.rotationDegrees) || 0) * Math.PI / 180;
        horizontalExtent = collider.shape || collider.type === slopeType ? halfW
          : Math.abs(Math.cos(radians)) * halfW + Math.abs(Math.sin(radians)) * halfH;
      }
    }

    const first = gdCollisionCell(centerX - horizontalExtent);
    const last = Math.max(first, gdCollisionCell(centerX + horizontalExtent));
    const sections = [];
    for (let index = first; index <= last; index++) sections.push(index);
    return sections;
  }
  _removeCollisionFromSections(collider) {
    if (!collider) return;
    this._collisionQueryVersion=(this._collisionQueryVersion || 0)+1;
    const known = Array.isArray(collider._eeCollisionSectionIndices)
      ? collider._eeCollisionSectionIndices
      : (Number.isInteger(collider._eeCollisionSectionIndex) ? [collider._eeCollisionSectionIndex] : []);
    for (const index of known) {
      const section = this._collisionSections?.[index];
      if (!Array.isArray(section)) continue;
      const entry = section.indexOf(collider);
      if (entry !== -1) section.splice(entry, 1);
    }
    collider._eeCollisionSectionIndices = [];
    collider._eeCollisionSectionIndex = undefined;
  }
  _addCollisionToSection(collider) {
    // No Touch is a static placed-object flag. Keep its transform for group
    // actions, but do not put decorative geometry into gameplay queries.
    if (!collider || collider._eeUIObject || collider.noTouch) return;
    this._collisionQueryVersion=(this._collisionQueryVersion || 0)+1;
    const indices = this._getCollisionSectionIndices(collider);
    for (const index of indices) {
      this._collisionSections[index] ||= [];
      if (!this._collisionSections[index].includes(collider)) {
        this._collisionSections[index].push(collider);
        this._collisionSections[index]._gdCollisionOrderDirty = true;
      }
    }
    collider._eeCollisionSectionIndices = indices;
    // Retain the legacy field for code that needs a stable home section.
    collider._eeCollisionSectionIndex = indices[0] ?? 0;
  }
  _refreshCollisionSection(collider) {
    if (!collider || collider._eeUIObject || collider.noTouch) return;
    // Without Y rows, candidates are object references and remain valid
    // while those objects move inside their existing X sections.
    if(this._collisionRowsEnabled) this._collisionQueryVersion=(this._collisionQueryVersion || 0)+1;
    // Fast path: an ordinary collider stays in its single section.
    if (!collider.extendedCollision) {
      const known = collider._eeCollisionSectionIndices;
      if (Array.isArray(known) && known.length === 1 &&
          known[0] === gdCollisionCell(Number(collider.x) || 0)) return;
    }
    const previous = Array.isArray(collider._eeCollisionSectionIndices)
      ? collider._eeCollisionSectionIndices
      : (Number.isInteger(collider._eeCollisionSectionIndex) ? [collider._eeCollisionSectionIndex] : []);
    const next = this._getCollisionSectionIndices(collider);
    const unchanged = previous.length === next.length && previous.every((value, index) => value === next[index]);
    if (unchanged) return;
    this._removeCollisionFromSections(collider);
    this._addCollisionToSection(collider);
  }
  _setSectionVisible(_0x2b0fa1, _0x488507) {
    const _0x141e9c = this._sectionContainers[_0x2b0fa1];
    if (_0x141e9c) {
      _0x141e9c.additive.visible = _0x488507;
      _0x141e9c.normal.visible = _0x488507;
    }
  }
  // Phaser updates every emitter each frame, visible or not. Emitters far
  // outside the view leave the update list until the view comes back.
  _cullLegacyEmitters() {
    const emitters = this._legacyEmitters;
    if (!emitters?.length) return;
    if ((this._emitterCullTick = (this._emitterCullTick || 0) + 1) % 6 !== 1) return;
    const cam = this.gdRenderer?.camera;
    const minX = cam ? cam.x * 2 - 900 : (this._cameraXRef?.value || 0) - 900;
    const maxX = cam ? (cam.x + cam.w) * 2 + 900 : (this._cameraXRef?.value || 0) + screenWidth + 900;
    for (const emitter of emitters) {
      if (!emitter?.scene) continue;
      const x = Number.isFinite(emitter._eeWorldX) ? emitter._eeWorldX : emitter.x;
      const near = x >= minX && x <= maxX;
      // Phaser's emitter renderer sets its pipeline and transform and draws
      // every frozen particle, on every camera. Far emitters are not rendered
      // at all. This must not use their visibility: a restart shows every
      // section object again (resetEnterEffectTriggers), which left hundreds
      // of far portal emitters drawing each frame.
      if (!emitter._eeCullRender) {
        const willRender = emitter.willRender;
        emitter.willRender = function (camera) { return !this._eeFar && willRender.call(this, camera); };
        emitter._eeCullRender = true;
      }
      emitter._eeFar = !near;
      if (near === (emitter._eeUpdating !== false)) continue;
      emitter._eeUpdating = near;
      if (near) emitter.addToUpdateList?.(); else emitter.removeFromUpdateList?.();
    }
  }
  updateVisibility(_0xa5f1e1) {
    this.updateTriggerEditorVisuals();
    this._cullLegacyEmitters();
    if (window.enableLDM) {
      try {
        if (this._endPortalEmitter && typeof this._endPortalEmitter.stop === 'function') {
          this._endPortalEmitter.stop();
        }
      } catch (e) {}
      try {
        if (Array.isArray(this._sections)) {
          for (const sec of this._sections) {
            if (!Array.isArray(sec)) continue;
            for (const obj of sec) {
              if (!obj) continue;
              try {
                if (typeof obj.stop === 'function') obj.stop();
                if (obj.emitters && Array.isArray(obj.emitters)) {
                  for (const em of obj.emitters) {
                    try { if (typeof em.stop === 'function') em.stop(); } catch (e) {}
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
      try { if (this._glowSprites) for (const g of this._glowSprites) g.setVisible(false); } catch(e) {}
    }
    const _0x1dce22 = this._sectionContainers.length - 1;
    if (_0x1dce22 < 0) {
      return;
    }
    let cd = Number(window.cullDistance);
    if (!Number.isFinite(cd)) cd = 3;
    cd = Math.max(0, Math.min(3, Math.floor(cd)));

    let particleScale, sliderHeight;
    if (cd === 3) {
      particleScale = Math.max(0, Math.floor((_0xa5f1e1 - 200) / 400));
      sliderHeight = Math.min(_0x1dce22, Math.floor((_0xa5f1e1 + screenWidth + 200) / 400));
    } else if (cd === 0) {
      particleScale = _0x1dce22 + 1;
      sliderHeight = -1;
    } else {
      const rightEdgeX = _0xa5f1e1 + screenWidth;
      const centerSection = Math.max(0, Math.floor(rightEdgeX / 400));
      const rangeRadius = cd;
      particleScale = Math.max(0, centerSection - rangeRadius);
      sliderHeight = Math.min(_0x1dce22, centerSection + rangeRadius);
    }
    const _0x1800fc = this._visMinSec;
    const _0xc31046 = this._visMaxSec;
    if (_0x1800fc < 0) {
      for (let _0x47dbe1 = 0; _0x47dbe1 <= _0x1dce22; _0x47dbe1++) {
        this._setSectionVisible(_0x47dbe1, _0x47dbe1 >= particleScale && _0x47dbe1 <= sliderHeight);
      }
      this._visMinSec = particleScale;
      this._visMaxSec = sliderHeight;
      return;
    }
    if (particleScale !== _0x1800fc || sliderHeight !== _0xc31046) {
      if (particleScale > _0x1800fc) {
        for (let _0x7da5df = _0x1800fc; _0x7da5df <= Math.min(particleScale - 1, _0xc31046); _0x7da5df++) {
          this._setSectionVisible(_0x7da5df, false);
        }
      }
      if (sliderHeight < _0xc31046) {
        for (let _0x5b2d47 = Math.max(sliderHeight + 1, _0x1800fc); _0x5b2d47 <= _0xc31046; _0x5b2d47++) {
          this._setSectionVisible(_0x5b2d47, false);
        }
      }
      if (particleScale < _0x1800fc) {
        for (let _0x3caab6 = particleScale; _0x3caab6 <= Math.min(_0x1800fc - 1, sliderHeight); _0x3caab6++) {
          this._setSectionVisible(_0x3caab6, true);
        }
      }
      if (sliderHeight > _0xc31046) {
        for (let _0x347412 = Math.max(_0xc31046 + 1, particleScale); _0x347412 <= sliderHeight; _0x347412++) {
          this._setSectionVisible(_0x347412, true);
        }
      }
      this._visMinSec = particleScale;
      this._visMaxSec = sliderHeight;
    }
  }
  updateObjectDebugIds() {
    if (window.showObjectIds && !window.enableLDM) {
      if (this._debugIdTextsList && this._debugIdTextsList.length > 0) {
        for (const idText of this._debugIdTextsList) {
          if (idText) idText.setVisible(true);
        }
      }
    } else {
      if (this._debugIdTextsList && this._debugIdTextsList.length > 0 ) {
        for (const idText of this._debugIdTextsList) {
          if (idText) idText.setVisible(false);
        }
      }
    }
  }
  getNearbySectionObjects(_0x2e85c7, worldY = null) {
    const _0x55d1b7 = gdPlayerCollisionCell(_0x2e85c7);
    const _0x31c345 = Math.max(0, _0x55d1b7 - 1);
    const _0x5f1907 = Math.min(this._collisionSections.length - 1, _0x55d1b7 + 1);
    const _0x28a7c0 = this._nearbyBuffer;
    // checkCollisions (31b530..31b799) visits X cells, then Y cells,
    // then each cell's creation-ID-sorted objects. Native Y includes the
    // 90-point base-ground offset that saved/web coordinates omit.
    // The Y multiplier (37a4) is 0 unless the level is platformer or has a
    // dynamic height (344d58..344d7f): ordinary levels have one row, so a
    // tall object is met at any height (native stretched-portal control).
    const useRows = this._collisionRowsEnabled && Number.isFinite(worldY);
    const row = useRows ? gdPlayerCollisionCell(worldY + 180) : 0;
    const firstRow = useRows ? Math.max(0, row - 1) : 0;
    const lastRow = useRows ? row + 1 : 0;
    const version=this._collisionQueryVersion || 0,cache=this._collisionQuery;
    if(cache && cache.version===version && cache.cell===_0x55d1b7 && cache.row===row && cache.useRows===useRows) return _0x28a7c0;
    this._collisionQuery={version,cell:_0x55d1b7,row,useRows};
    _0x28a7c0.length=0;
    const seen=new Set();
    for (let _0xe2cbfa = _0x31c345; _0xe2cbfa <= _0x5f1907; _0xe2cbfa++) {
      const _0x2171db = this._collisionSections[_0xe2cbfa];
      if (_0x2171db) {
        if (_0x2171db._gdCollisionOrderDirty) {
          _0x2171db.sort((a,b)=>(a._eeObjectId ?? Number.MAX_SAFE_INTEGER)-(b._eeObjectId ?? Number.MAX_SAFE_INTEGER));
          _0x2171db._gdCollisionOrderDirty = false;
        }
        for (let cellRow = firstRow; cellRow <= lastRow; cellRow++) {
        for (let _0x5cdca9 = 0; _0x5cdca9 < _0x2171db.length; _0x5cdca9++) {
          const collider = _0x2171db[_0x5cdca9];
          if (!collider || seen.has(collider)) continue;
          if (useRows) {
            let extent = 0;
            if (collider.extendedCollision) {
              if (collider.hitbox_radius != null) extent = Math.max(0, Number(collider.hitbox_radius) || 0);
              else {
                const radians = (collider.rotationDegrees || 0) * Math.PI / 180;
                extent = collider.shape || collider.type === slopeType ? collider.h / 2
                  : Math.abs(Math.sin(radians)) * collider.w / 2 + Math.abs(Math.cos(radians)) * collider.h / 2;
              }
            }
            const low = gdCollisionCell(collider.y + 180 - extent);
            const high = Math.max(low, gdCollisionCell(collider.y + 180 + extent));
            if (cellRow < low || cellRow > high) continue;
          }
          seen.add(collider);
          _0x28a7c0.push(collider);
        }
        }
      }
    }
    return _0x28a7c0;
  }
  checkEnterEffectTriggers(_0x5d0838) {
    for (const _0x937c72 of this._orderedTriggers("_enterEffectTriggers", "_enterEffectTriggerIdx", _0x5d0838)) {
      if (!_0x937c72.spawnTriggered && !_0x937c72.touchTriggered && this._isTriggerSaveObjectLive(_0x937c72.uid)) this._activateEnterEffect(_0x937c72);
    }
  }
  _activateEnterEffect(trig) {
    if (trig.gdEffect === -15) { this.enterState?.trigger(trig); return; }
    this._activeEnterEffect = trig.effect;
    this._activeExitEffect = trig.effect;
    this.gdRenderer?.setEnterEffect(trig.gdChannel, trig.gdEffect, trig.gdMode);
  }
  _getMoveTriggerPlayerPosition() {
    const scene = this._scene || {};
    const point = scene._localPhysicsActive ? this.gameplayState.toWorld(scene._playerWorldX, scene._state.y)
      : { x: scene._playerWorldX ?? this._cameraXRef?._v ?? 0, y: scene._state?.y ?? 0 };
    const playerX = Number(point.x) || 0;
    const playerY = Number(point.y) || 0;
    let cameraX = Number(this._cameraXRef?.value ?? this._cameraXRef?._v ?? scene._cameraX ?? 0) || 0;
    let cameraY = Number(scene._cameraY ?? 0) || 0;
    // Lock to Camera follows the real view (static camera, offset, zoom),
    // not the player-following camera underneath it. GD adds the movement of
    // the view centre (GJBaseGameLayer::updateCameraBGArt: previous position +
    // half the visible size at the previous zoom, minus the same now).
    if (this.cameraState?.cameraPosition && scene.scale) {
      const pos = this.cameraState.cameraPosition();
      if (Number.isFinite(pos.cx) && Number.isFinite(pos.cy)) { cameraX = pos.cx; cameraY = pos.cy; }
    }
    return { x: playerX, y: playerY, playerX, playerY, cameraX, cameraY };
  }


  // De-duplicated group member lists, cached per list until its length
  // changes (moves call these for every group, every frame).
  _uniqueMembers(list) {
    const cache = this._uniqueMemberCache ||= new WeakMap();
    let entry = cache.get(list);
    if (!entry || entry.length !== list.length) {
      entry = { length: list.length, items: [...new Set(list)].filter(Boolean) };
      cache.set(list, entry);
    }
    return entry.items;
  }

  _getUniqueGroupSprites(groupId) {
    const sprites = this._groupSprites?.[groupId];
    if (!sprites || !sprites.length) return [];
    const unique = this._uniqueMembers(sprites);
    return unique.every(spr => spr.active) ? unique : unique.filter(spr => spr.active);
  }

  _getUniqueGroupColliders(groupId) {
    const colliders = this._groupColliders?.[groupId];
    if (!colliders || !colliders.length) return [];
    return this._uniqueMembers(colliders);
  }

  _getObjectGroupIds(obj) {
    const groups = Array.isArray(obj?._eeGroups) ? obj._eeGroups : [];
    if (obj && obj._eeGroupIdsSource === groups && obj._eeGroupIdsLength === groups.length) return obj._eeGroupIds;
    const ids = [...new Set(groups.map(gid => parseInt(gid, 10)).filter(gid => Number.isFinite(gid) && gid > 0))];
    if (obj) { obj._eeGroupIdsSource = groups; obj._eeGroupIdsLength = groups.length; obj._eeGroupIds = ids; }
    return ids;
  }

  _getCombinedGroupOffset(obj, result = { x: 0, y: 0 }) {
    result.x = 0; result.y = 0;
    const offsets = this._groupOffsets;
    if (!offsets) return result;
    const ids = this._getObjectGroupIds(obj);
    for (let i = 0; i < ids.length; i++) {
      const off = offsets[ids[i]];
      if (!off) continue;
      result.x += off.x;
      result.y += off.y;
    }
    return result;
  }

  _ensureSpriteMoveBase(spr) {
    if (!spr) return;
    if (spr._eeMoveBaseWorldX === undefined) {
      spr._eeMoveBaseWorldX = Number.isFinite(Number(spr._origWorldX)) ? Number(spr._origWorldX) : (Number.isFinite(Number(spr._eeInitialWorldX)) ? Number(spr._eeInitialWorldX) : Number(spr.x) || 0);
    }
    if (spr._eeMoveBaseBaseY === undefined) {
      spr._eeMoveBaseBaseY = Number.isFinite(Number(spr._origBaseY)) ? Number(spr._origBaseY) : (Number.isFinite(Number(spr._eeInitialBaseY)) ? Number(spr._eeInitialBaseY) : Number(spr.y) || 0);
    }
    spr._origWorldX = spr._eeMoveBaseWorldX;
    spr._origBaseY = spr._eeMoveBaseBaseY;
  }

  _applyGroupedSpriteMoveOffset(spr) {
    if (!spr || !spr.active) return;
    this._ensureSpriteMoveBase(spr);
    const off = this._getCombinedGroupOffset(spr);
    spr.x = spr._eeMoveBaseWorldX + off.x;
    spr.y = spr._eeMoveBaseBaseY + off.y;
    spr._eeWorldX = spr.x;
    spr._eeBaseY = spr.y;
    this._refreshSpriteSection(spr);
    if (spr._coinWorldX !== undefined) {
      spr._coinWorldX = spr.x / 2;
    }
    if (spr._coinWorldY !== undefined) {
      spr._coinWorldY = (460 - spr.y) / 2;
    }
  }

  _syncSpriteMoveBaseFromCurrent(spr) {
    if (!spr || !spr.active) return;
    const off = this._getCombinedGroupOffset(spr);
    const wx = spr._eeWorldX !== undefined ? spr._eeWorldX : spr.x;
    const wy = spr._eeBaseY !== undefined ? spr._eeBaseY : spr.y;
    spr._eeMoveBaseWorldX = wx - off.x;
    spr._eeMoveBaseBaseY = wy - off.y;
    spr._origWorldX = spr._eeMoveBaseWorldX;
    spr._origBaseY = spr._eeMoveBaseBaseY;
  }

  _ensureColliderMoveBase(col) {
    if (!col) return;
    if (col._eeMoveBaseX === undefined) {
      col._eeMoveBaseX = Number.isFinite(Number(col._origBaseX)) ? Number(col._origBaseX) : (Number.isFinite(Number(col._eeInitialBaseX)) ? Number(col._eeInitialBaseX) : Number(col.x) || 0);
    }
    if (col._eeMoveBaseY === undefined) {
      col._eeMoveBaseY = Number.isFinite(Number(col._origBaseY)) ? Number(col._origBaseY) : (Number.isFinite(Number(col._eeInitialBaseY)) ? Number(col._eeInitialBaseY) : Number(col.y) || 0);
    }
    col._origBaseX = col._eeMoveBaseX;
    col._origBaseY = col._eeMoveBaseY;
  }

  _applyGroupedColliderMoveOffset(col) {
    if (!col) return;
    this._recordColliderMotion(col);
    this._ensureColliderMoveBase(col);
    const off = this._getCombinedGroupOffset(col, this._offsetTmp || (this._offsetTmp = { x: 0, y: 0 }));
    col.x = col._eeMoveBaseX + off.x;
    col.y = col._eeMoveBaseY - off.y;
    col._baseX = col.x;
    col._baseY = col.y;
    this._refreshCollisionSection(col);
  }
  _recordColliderMotion(col) {
    const scene = this._scene;
    if (!scene?._fixedTickActive || col._gdMotionFrame === scene._physicsFrame) return;
    col._gdMotionFrame = scene._physicsFrame;
    col._gdPreviousX = col.x; col._gdPreviousY = col.y;
  }

  _syncColliderMoveBaseFromCurrent(col) {
    if (!col) return;
    const off = this._getCombinedGroupOffset(col, this._offsetTmp || (this._offsetTmp = { x: 0, y: 0 }));
    col._eeMoveBaseX = col.x - off.x;
    col._eeMoveBaseY = col.y + off.y;
    col._origBaseX = col._eeMoveBaseX;
    col._origBaseY = col._eeMoveBaseY;
  }

  // GD's own rand() (the LCG behind GJBaseGameLayer::getGroupParent), seeded
  // from the clock on every level reset like PlayLayer::resetLevel.
  _gdRandom() {
    if (this._gdRandSeed === undefined) this._gdRandSeed = Date.now() | 0;
    this._gdRandSeed = (Math.imul(this._gdRandSeed, 0x343fd) + 0x269ec3) | 0;
    const value = ((this._gdRandSeed >>> 16) & 0x7fff) / 32767;
    return value === 1 ? 0 : value;
  }

  // GJBaseGameLayer::tryGetGroupParent: the group's parent object, else the
  // group's only object. getGroupParent (random) then falls back to a random
  // member; move targets use it when the level enables 2.2 changes (kA40).
  _moveGroupParent(groupId, random = false) {
    groupId = Number(groupId);
    const list = this.gdRenderer?.groups.get(groupId);
    if (!list?.length) return this.gdRenderer?.groupParent(groupId) || null;
    const cache = this._groupParentsCache ||= new Map();
    let entry = cache.get(groupId);
    if (!entry || entry.list !== list || entry.length !== list.length || entry.version !== this.gdRenderer.membershipVersion) {
      const members = list.filter(obj => !obj.companionOf);
      entry = { list, length: list.length, version: this.gdRenderer.membershipVersion, members,
        parent: this.gdRenderer.groupParent(groupId) };
      cache.set(groupId, entry);
    }
    const { members, parent } = entry;
    if (parent) return parent;
    if (members.length === 1) return members[0];
    return random && members.length ? members[Math.floor(members.length * this._gdRandom())] : null;
  }

  // The offset (GD units, y up) of a Move trigger in target or direction mode,
  // as GJBaseGameLayer computes it when the trigger fires: target position
  // (group 71, or player 1/2) minus the reference object (group 395, else the
  // moved group 51). Direction mode keeps only the direction, scaled to 396;
  // target mode 101 = 1/2 keeps only X/Y. Missing ends give no movement.
  // The two objects a target/direction move measures between; dynamic moves
  // keep the pair chosen when they fire.
  _moveTargetEnds(trig) {
    const random = trig.dynamicMode || String(window.settingsMap?.kA40 ?? "0") === "1";
    const center = this._moveGroupParent(trig.targetCenterGroup > 0 ? trig.targetCenterGroup : trig.targetGroup, random);
    const scene = this._scene || {};
    const target = trig.targetP1 || trig.targetP2
      ? (!trig.targetP1 && scene._state2 ? "p2" : "p1")
      : this._moveGroupParent(trig.targetPosGroup, random);
    // Commands store stable renderer indices, not object copies. Practice
    // snapshots clone command state; a copied GDObj would stop following the
    // live group's subsequent moves after restoring a checkpoint.
    return { center: center?.index ?? null,
      target: target === center ? null : typeof target === "string" ? target : target?.index ?? null };
  }

  _moveTargetDelta(trig, ends = this._moveTargetEnds(trig)) {
    // Live positions include group moves the renderer has not applied yet;
    // dynamic moves read them every tick, so a full flush here would apply
    // every pending group translation at 240 Hz.
    const renderer = this.gdRenderer;
    const centerObj = renderer?.objects[ends.center];
    const realPosition = (object, out) => {
      renderer.livePosition(object, out);
      const area = this._moveAreaTmp ||= {};
      this.areaState?.forObject(object, out.x, out.y, area);
      out.x += area.dx || 0; out.y += area.dy || 0;
      return out;
    };
    const center = centerObj ? realPosition(centerObj, this._moveCenterTmp ||= {}) : null;
    let target = null;
    if (ends.target === "p2") {
      const scene = this._scene || {};
      target = { x: (scene._secondaryWorldX ?? scene._playerWorldX ?? 0) / 2, y: (scene._state2?.y || 0) / 2 };
    } else if (ends.target === "p1") {
      const pos = this._getMoveTriggerPlayerPosition();
      target = { x: pos.playerX / 2, y: pos.playerY / 2 };
    } else if (ends.target !== null) {
      const object = renderer?.objects[ends.target];
      if (object) target = realPosition(object, this._moveTargetTmp ||= {});
    }
    if (!center || !target) return { x: 0, y: 0 };
    let dx = target.x - center.x, dy = target.y - center.y;
    if (trig.directionMode) {
      const length = Math.hypot(dx, dy);
      dx = length > 0 ? dx / length * trig.directionDistance : 0;
      dy = length > 0 ? dy / length * trig.directionDistance : 0;
    }
    if (trig.useTarget) {
      if (trig.targetAxis === 1) dy = 0;
      else if (trig.targetAxis === 2) dx = 0;
    }
    return { x: dx, y: dy };
  }

  // positionActivated: an X or touch activation from this tick's collision
  // phase. Native first steps such a command one physics tick later than a
  // command a Spawn trigger creates (synthetic native control, 2026-10-27:
  // linear, zero-duration and touch moves; spawn delays 0 and 0.05 match).
  _startMoveTriggerTween(trig, positionActivated = false) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    const pos = this._getMoveTriggerPlayerPosition();
    // Lock to Player adds GJEffectManager::m_playerVelocity, the movement of
    // the previous step: a position-activated lock also carries the movement
    // of its activation tick (native MK2 lock at X8699 leads by one 0.5x step).
    const scene = this._scene || {}, tickStart = scene._tickStart;
    if (positionActivated && (trig.lockX || trig.lockY) && tickStart && tickStart.frame === scene._physicsFrame) {
      const start = scene._localPhysicsActive ? this.gameplayState.toWorld(tickStart.x, tickStart.y) : tickStart;
      pos.playerX = Number(start.x) || 0; pos.playerY = Number(start.y) || 0;
    }
    const targetMode = !!(trig.useTarget || trig.directionMode);
    let offsetX = trig.offsetX, offsetY = trig.offsetY, ends = null;
    if (targetMode) {
      ends = this._moveTargetEnds(trig);
      if (trig.dynamicMode && (ends.center === null || ends.target === null)) return;
      const delta = this._moveTargetDelta(trig, ends);
      offsetX = delta.x * 2; offsetY = delta.y * 2;
    }
    if (!this._groupOffsets[trig.targetGroup]) {
      this._groupOffsets[trig.targetGroup] = { x: 0, y: 0 };
    }
    // Silent moves teleport the group at once (no command).
    if (trig.silent && !(targetMode && trig.dynamicMode)) {
      if (offsetX || offsetY) this._translateGroup(trig.targetGroup, offsetX, -offsetY);
      return;
    }
    this._activeMoveTweens.push({
      trig,
      elapsed: 0,
      prevProgress: 0,
      prevPlayerX: pos.playerX,
      prevPlayerY: pos.playerY,
      prevCameraX: pos.cameraX,
      prevCameraY: pos.cameraY,
      offsetX, offsetY, targetMode, ends,
      // Resolved by stepCameraLockMoves once this frame's camera is known.
      camPending: !targetMode && !!(trig.lockCameraX || trig.lockCameraY),
      spawned: !!(trig.spawnTriggered || trig.touchTriggered),
      bornPhysicsFrame: scene._fixedTickActive ? scene._physicsFrame : null,
      skipStep: positionActivated,
    });
  }

  checkMoveTriggers(playerX) {
    for (const trig of this._orderedTriggers("_moveTriggers", "_moveTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._startMoveTriggerTween(trig, true);
    }
  }

  checkTouchMoveTriggers(playerX, playerY) {
    const px = Number(playerX) || 0;
    const py = Number(playerY) || 0;
    this._touchMoveTriggerActivated ||= new Set();

    const playerHalfSize = (typeof playerSize === "number" ? playerSize : 20);
    const halfHitbox = 30 + playerHalfSize;

    for (const trig of this._touchCandidates(this._moveTriggers, px)) {
      if (!trig || !trig.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      const uid = trig.uid ?? `${trig.x},${trig.y},${trig.targetGroup}`;
      if (this._touchMoveTriggerActivated.has(uid)) continue;
      if (this._touchesTrigger(trig, px, py, halfHitbox)) {
        this._touchMoveTriggerActivated.add(uid);
        this._startMoveTriggerTween(trig, true);
      }
    }
  }

  // deferCamera: the caller runs stepCameraLockMoves after the camera update,
  // which applies the Lock to Camera part of each move.
  stepMoveTriggers(dt, deferCamera = false) {
    const batch = this._beginMoveBatch();
    try { this._stepMoveTriggers(dt, deferCamera); } finally { this._endMoveBatch(batch); }
  }
  _stepMoveTriggers(dt, deferCamera) {
    let i = 0;
    while (i < this._activeMoveTweens.length) {
      const anim = this._activeMoveTweens[i];
      const { trig } = anim;
      if (anim.done || anim.paused) { i++; continue; }
      if (anim.skipStep) { anim.skipStep = false; i++; continue; }
      // Spawn-created commands wait until the next effect step. Most are
      // created after Move processing; a nested zero-delay Spawn reached
      // through Count can arrive before it and must keep the same phase.
      if (anim.spawned && anim.bornPhysicsFrame !== null && anim.bornPhysicsFrame === this._scene?._physicsFrame) { i++; continue; }
      // Target and direction moves clear every lock (GJBaseGameLayer).
      const targetMode = !!anim.targetMode;
      const lockX = !targetMode && trig.lockX, lockY = !targetMode && trig.lockY;
      const lockCameraX = !targetMode && trig.lockCameraX, lockCameraY = !targetMode && trig.lockCameraY;
      const deferCam = deferCamera && (lockCameraX || lockCameraY);
      if (!deferCamera) anim.camPending = false;
      const dur = trig.duration > 0 ? trig.duration : 0;
      // GroupCommandObject2::step: a command with no eased offset (zero, or
      // replaced by a lock on that axis) never finishes at duration -1.
      const endless = trig.duration === -1 && (targetMode && trig.dynamicMode || !targetMode &&
        (!trig.offsetX || lockX || lockCameraX) && (!trig.offsetY || lockY || lockCameraY));

      anim.elapsed += dt;
      const progress = endless ? 0 : dur > 0 ? Math.min(anim.elapsed / dur, 1) : 1;
      const prevProgress = anim.prevProgress;

      const curSample = Easing.sample(trig.easingType, trig.easingRate, progress);
      const prevSample = Easing.sample(trig.easingType, trig.easingRate, prevProgress);
      const amount = curSample - prevSample;

      anim.prevProgress = progress;

      const followPos = (lockX || lockY || lockCameraX || lockCameraY) ? this._getMoveTriggerPlayerPosition() : null;
      const modX = trig.moveModX || 1, modY = trig.moveModY || 1;
      const cameraDX = deferCam ? 0 : (followPos?.cameraX - anim.prevCameraX) * modX;
      const cameraDY = deferCam ? 0 : -(followPos?.cameraY - anim.prevCameraY) * modY;
      let offsetX = anim.offsetX ?? trig.offsetX, offsetY = anim.offsetY ?? trig.offsetY, share = amount;
      if (targetMode && trig.dynamicMode) {
        // Dynamic mode re-aims every step: cover this step's share of what
        // is left between the reference object and the target.
        this._flushMoveBatch();
        const delta = this._moveTargetDelta(trig, anim.ends || undefined), left = 1 - prevSample;
        offsetX = delta.x * 2; offsetY = delta.y * 2;
        share = endless ? 1 : Math.abs(left) > 1e-9 ? amount / left : 1;
      }
      const deltaX = lockX
        ? (followPos.playerX - anim.prevPlayerX) * modX
        : (lockCameraX ? cameraDX : (offsetX * share));
      const deltaY = lockY
        ? -(followPos.playerY - anim.prevPlayerY) * modY
        : (lockCameraY ? cameraDY : -(offsetY * share));
      if (followPos) {
        anim.prevPlayerX = followPos.playerX;
        anim.prevPlayerY = followPos.playerY;
        if (!deferCam) {
          anim.prevCameraX = followPos.cameraX;
          anim.prevCameraY = followPos.cameraY;
        }
      }

      this._recordMoveDelta(trig.targetGroup, deltaX, deltaY);
      this._translateGroup(trig.targetGroup, deltaX, deltaY);

      if (progress >= 1) {
        if (deferCam) { anim.done = true; i++; } else this._activeMoveTweens.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  // The Lock to Camera part of active moves, after this frame's camera update.
  // GD steps at 240 Hz: GJEffectManager::prepareMoveActions adds the camera
  // movement measured by the previous step's updateCamera, and a move only
  // runs from the step after the one that created it. A camera trigger placed
  // before the move (an earlier step) is therefore never added to it, while
  // the camera's ordinary movement from the move's own step on is.
  stepCameraLockMoves() {
    const batch = this._beginMoveBatch();
    try { this._stepCameraLockMoves(); } finally { this._endMoveBatch(batch); }
  }
  _stepCameraLockMoves() {
    const scene = this._scene || {};
    const pos = this._getMoveTriggerPlayerPosition();
    const cur = { x: pos.cameraX, y: pos.cameraY };
    const last = this._camLockLast || cur;
    const playerX = Number(scene._playerWorldX) || 0;
    const lastPlayerX = this._camLockLastPlayerX ?? playerX;
    const jumpX = this.cameraState?.jumpX ?? null;
    for (let i = 0; i < this._activeMoveTweens.length;) {
      const anim = this._activeMoveTweens[i], trig = anim.trig;
      if (anim.paused || anim.targetMode || !(trig.lockCameraX || trig.lockCameraY)) { i++; continue; }
      if (anim.camPending) {
        anim.camPending = false;
        let start = last;
        if (jumpX !== null && (anim.spawned || jumpX <= trig.x)) start = cur;
        else if (jumpX === null && !anim.spawned && playerX > lastPlayerX) {
          const frac = Math.max(0, Math.min(1, (trig.x - lastPlayerX) / (playerX - lastPlayerX)));
          start = { x: last.x + (cur.x - last.x) * frac, y: last.y + (cur.y - last.y) * frac };
        }
        anim.prevCameraX = start.x;
        anim.prevCameraY = start.y;
      }
      const modX = trig.moveModX || 1, modY = trig.moveModY || 1;
      const deltaX = trig.lockCameraX ? (cur.x - anim.prevCameraX) * modX : 0;
      const deltaY = trig.lockCameraY ? -(cur.y - anim.prevCameraY) * modY : 0;
      anim.prevCameraX = cur.x;
      anim.prevCameraY = cur.y;
      if (deltaX || deltaY) {
        this._recordMoveDelta(trig.targetGroup, deltaX, deltaY);
        this._translateGroup(trig.targetGroup, deltaX, deltaY);
      }
      if (anim.done) this._activeMoveTweens.splice(i, 1); else i++;
    }
    this._camLockLast = cur;
    this._camLockLastPlayerX = playerX;
    if (this.cameraState) this.cameraState.jumpX = null;
  }

  resetMoveTriggers() {
    this._moveTriggerIdx = 0;
    this._activeMoveTweens = [];
    this._followTriggerIdx = 0;
    this._activeFollowTweens = [];
    this._moveDeltas?.clear();
    this._followPlayerHistory = null;
    this._followPlayerClock = 0;
    this._followPlayerSample = 0;
    this._followPlayerHead = 0;
    this._touchMoveTriggerActivated = new Set();
    this._groupOffsets = {};
    this._camLockLast = null;
    this._camLockLastPlayerX = null;
    this._gdRandSeed = Date.now() | 0;

    const seenSprites = new Set();
    for (const gid in this._groupSprites) {
      for (const spr of this._groupSprites[gid]) {
        if (!spr || !spr.active || seenSprites.has(spr)) continue;
        seenSprites.add(spr);
        const baseX = spr._eeInitialWorldX !== undefined ? spr._eeInitialWorldX : (spr._origWorldX ?? spr.x);
        const baseY = spr._eeInitialBaseY !== undefined ? spr._eeInitialBaseY : (spr._origBaseY ?? spr.y);
        spr._eeMoveBaseWorldX = baseX;
        spr._eeMoveBaseBaseY = baseY;
        spr._origWorldX = baseX;
        spr._origBaseY = baseY;
        spr.x = baseX;
        spr.y = baseY;
        spr._eeWorldX = baseX;
        spr._eeBaseY = baseY;
        this._refreshSpriteSection(spr);
      }
    }

    const seenColliders = new Set();
    for (const gid in this._groupColliders) {
      for (const col of this._groupColliders[gid]) {
        if (!col || seenColliders.has(col)) continue;
        seenColliders.add(col);
        const baseX = col._eeInitialBaseX !== undefined ? col._eeInitialBaseX : (col._origBaseX ?? col.x);
        const baseY = col._eeInitialBaseY !== undefined ? col._eeInitialBaseY : (col._origBaseY ?? col.y);
        col._eeMoveBaseX = baseX;
        col._eeMoveBaseY = baseY;
        col._origBaseX = baseX;
        col._origBaseY = baseY;
        col.x = baseX;
        col.y = baseY;
        col._baseX = baseX;
        col._baseY = baseY;
        this._refreshCollisionSection(col);
      }
    }
  }

  _startAlphaTriggerTween(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    const currentOpacity = this._groupOpacity[trig.targetGroup] ?? 1;
    this._activeAlphaTweens.push({
      trig,
      elapsed: 0,
      startOpacity: currentOpacity,
    });
  }

  _translateKeyframeGroup(group, dx, dy, parentGroup = 0) {
    // An omitted keyframe parent means world-space movement, even if
    // separate Rotate/Scale commands have transformed the artwork.
    if (!parentGroup) { this._translateGroup(group, dx * 2, -dy * 2); return; }
    const renderer = this.gdRenderer, members = renderer?.groups.get(group);
    if (!members?.length) { this._translateGroup(group, dx * 2, -dy * 2); return; }
    // Keyframe art transforms are independent tracks. Only other group
    // commands form the outer coordinate frame for a keyframe translation.
    const displacement = obj => {
      const m = obj._keyframeOuterAffine;
      return m ? { x: m[0] * dx + m[2] * dy, y: m[1] * dx + m[3] * dy } : { x: dx, y: dy };
    };
    const first = displacement(members[0]);
    if (members.every(obj => {
      const d = displacement(obj); return Math.abs(d.x - first.x) < 1e-9 && Math.abs(d.y - first.y) < 1e-9;
    })) { this._translateGroup(group, first.x * 2, -first.y * 2); return; }
    renderer.flushMovesFor(group);
    for (const obj of members) {
      const d = displacement(obj); obj.offX += d.x; obj.offY += d.y; renderer._queueIndex(obj);
    }
    for (const spr of this._getUniqueGroupSprites(group)) {
      if (!spr?.active) continue;
      const obj = this.gdObjects[spr._eeObjectId], d = obj ? displacement(obj) : { x: dx, y: dy };
      spr.x = spr._eeWorldX = (spr._eeWorldX ?? spr.x) + d.x * 2;
      spr.y = spr._eeBaseY = (spr._eeBaseY ?? spr.y) - d.y * 2;
      this._syncSpriteMoveBaseFromCurrent(spr); this._refreshSpriteSection(spr);
    }
    for (const col of this._getUniqueGroupColliders(group)) {
      const obj = this.gdObjects[col._eeObjectId], d = obj ? displacement(obj) : { x: dx, y: dy };
      this._recordColliderMotion(col); col.x += d.x * 2; col.y += d.y * 2;
      this._syncColliderMoveBaseFromCurrent(col); this._refreshCollisionSection(col);
    }
  }

  _startRotateTriggerTween(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    const targetMode = trig.useTarget || trig.targetRotationMode;
    let ends = targetMode ? this._rotateTargetEnds(trig) : null;
    if (ends && (ends.center === null || ends.object === null || ends.target === null)) {
      if (trig.dynamicMode && trig.duration !== 0) return;
      ends = null;
    }
    const totalDeg = ends ? this._rotateTargetDelta(trig, ends) : trig.degrees + (trig.times360 * 360);
    this._activeRotateTweens.push({
      trig,
      ends,
      elapsed: 0,
      prevProgress: 0,
      totalRad: totalDeg * Math.PI / 180,
    });
  }

  _rotateTargetEnds(trig) {
    const center = this._moveGroupParent(trig.centerGroup || trig.targetGroup);
    const object = this._moveGroupParent(trig.targetGroup);
    const target = trig.targetP1 || trig.targetP2
      ? (!trig.targetP1 && this._scene?._state2 ? "p2" : "p1")
      : this._moveGroupParent(trig.targetRotationGroup);
    return { center: center?.index ?? null, object: object?.index ?? null,
      target: typeof target === "string" ? target : target?.index ?? null,
      bounds: (trig.directionBounds || []).map(group => this._moveGroupParent(group)?.index ?? null) };
  }

  _rotateTargetDelta(trig, ends) {
    const renderer = this.gdRenderer;
    const position = index => {
      if (typeof index === "string") {
        const s = this._scene || {}, secondary = index === "p2";
        return { x: (secondary ? s._secondaryWorldX ?? s._playerWorldX ?? 0 : s._playerWorldX ?? 0) / 2,
          y: (secondary ? s._state2?.y ?? 0 : s._state?.y ?? 0) / 2 };
      }
      const obj = renderer?.objects[index];
      if (!obj) return null;
      const pos = renderer.livePosition(obj), area = {};
      this.areaState?.forObject(obj, pos.x, pos.y, area);
      return { x: pos.x + (area.dx || 0), y: pos.y + (area.dy || 0) };
    };
    const rotation = index => {
      if (typeof index === "string") {
        const player = index === "p2" ? this._scene?._player2 : this._scene?._player;
        const frame = this.gameplayState?.frameForPlayer(player);
        return (frame?.visualAngle(player?._rotation || 0) ?? player?._rotation ?? 0) * 180 / Math.PI;
      }
      const obj = renderer?.objects[index];
      if (!obj) return 0;
      const pos = renderer.livePosition(obj), area = {};
      this.areaState?.forObject(obj, pos.x, pos.y, area);
      const matrix = this.areaState?._beginLinear(obj, area);
      // CCNode::getRotation returns its X rotation, measured by the local
      // Y axis. Mirroring changes the scale sign, not that stored angle.
      const sign = (obj.flipY ? -1 : 1) * Math.sign(obj.scaleY * obj.extraScaleY * area.sy || 1);
      return matrix ? Math.atan2(matrix[2] * sign, matrix[3] * sign) * 180 / Math.PI : obj.rot + obj.rotOff;
    };
    const center = position(ends.center), object = position(ends.object), target = position(ends.target);
    if (!center || !object || !target) return 0;
    const bearing = (point, fallback) => Math.hypot(point.x - center.x, point.y - center.y) < .01
      ? fallback : 90 - Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
    const current = ends.center === ends.object ? rotation(ends.object) : bearing(object, rotation(ends.object));
    if (trig.useTarget) for (let i = 0; i < (ends.bounds?.length || 0); i++) {
      if (ends.bounds[i] === null) continue;
      const bound = position(ends.bounds[i]);
      if (!bound) continue;
      const key = i % 2 ? "y" : "x";
      target[key] = i < 2 ? Math.max(target[key], bound[key]) : Math.min(target[key], bound[key]);
    }
    const desired = ends.center === ends.target ? 0 : trig.useTarget ? bearing(target, 0) : rotation(ends.target);
    let delta = desired - current + trig.rotationOffset;
    if (delta < -180) delta += Math.ceil(Math.abs(delta) / 360 - .5) * 360;
    else if (delta > 180) delta -= Math.ceil(Math.abs(delta) / 360 - .5) * 360;
    return delta;
  }
  _translateGroup(group, dx, dy) {
    if (!dx && !dy) return;
    const off = this._groupOffsets[group] ||= { x: 0, y: 0 };
    off.x += dx; off.y += dy;
    // Like GJEffectManager's per-group move nodes, moves inside a batch are
    // summed per group and applied to the group's objects once.
    const batch = this._moveBatch;
    if (batch) {
      const pending = batch.get(group);
      if (pending) { pending.x += dx; pending.y += dy; } else batch.set(group, { x: dx, y: dy });
      return;
    }
    this._applyGroupTranslation(group, dx, dy);
  }
  _applyGroupTranslation(group, dx, dy) {
    // Physics and legacy sprites use two pixels per GD point, with screen Y down.
    this.gdRenderer?.moveGroup(group, dx / 2, -dy / 2);
    for (const spr of this._getUniqueGroupSprites(group)) this._applyGroupedSpriteMoveOffset(spr);
    for (const col of this._getUniqueGroupColliders(group)) this._translateCollider(col, dx, dy);
  }
  // A group move adds its delta to each member collider, as GD moves objects
  // by position deltas. That keeps col = move base + summed group offsets
  // (the invariant _applyGroupedColliderMoveOffset rebuilds from scratch)
  // without re-summing every group of every member on each 240 Hz step.
  _translateCollider(col, dx, dy) {
    if (!col) return;
    if (col._eeMoveBaseX === undefined || col._eeMoveBaseY === undefined) { this._applyGroupedColliderMoveOffset(col); return; }
    this._recordColliderMotion(col);
    if (col.type !== "speed") col.x += dx;
    col.y -= dy;
    col._baseX = col.x; col._baseY = col.y;
    this._refreshCollisionSection(col);
  }
  _beginMoveBatch() {
    if (this._moveBatch) return false;
    this._moveBatch = new Map();
    return true;
  }
  _flushMoveBatch() {
    const batch = this._moveBatch;
    if (!batch?.size) return;
    this._moveBatch = new Map();
    for (const [group, delta] of batch) this._applyGroupTranslation(group, delta.x, delta.y);
  }
  _endMoveBatch(owner) {
    if (!owner) return;
    this._flushMoveBatch();
    this._moveBatch = null;
  }
  _startFollowTrigger(trig) {
    if (!this._isTriggerSaveObjectLive(trig.uid) || !trig.targetGroup || trig.targetGroup === trig.sourceGroup) return;
    // A new coefficient replaces this target/source relationship. Different
    // source groups can still drive separate components of the same target.
    // Stacking every update makes authored 3D rigs accumulate hundreds of
    // old projection coefficients (EVOLUTION updates them along the route).
    if (!trig.playerY) this._activeFollowTweens = this._activeFollowTweens.filter(active =>
      active.trig.playerY || active.trig.targetGroup !== trig.targetGroup || active.trig.sourceGroup !== trig.sourceGroup);
    const source = !trig.playerY ? this._followSource(trig.sourceGroup) : null;
    const point = source ? this.gdRenderer.livePosition(source, {}) : null;
    this._activeFollowTweens.push({ trig, elapsed: 0, sourceIndex: source?.index ?? null,
      previousX: point?.x ?? null, previousY: point?.y ?? null });
  }
  _followSource(group) {
    return this._moveGroupParent(group);
  }
  // Command deltas are the fallback for groups without a single source
  // object (or an explicit group parent). Singleton sources are sampled
  // below so moves through shared groups and chained Follows are retained.
  _recordMoveDelta(group, dx, dy) {
    if (!dx && !dy) return;
    const deltas = this._moveDeltas ||= new Map();
    const d = deltas.get(group);
    if (d) { d.x += dx; d.y += dy; } else deltas.set(group, { x: dx, y: dy });
  }
  checkFollowTriggers(playerX) {
    for (const trig of this._orderedTriggers("_followTriggers", "_followTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._startFollowTrigger(trig);
    }
  }
  stepFollowTriggers(dt) {
    // The native follow history has 200 slots and quantizes delay to 0.01 s.
    // Keep it independently of active commands: a newly started delayed
    // follow can refer to the player's earlier movement.
    const playerY = this._scene?._state?.y ?? 0;
    this._followPlayerHistory ||= new Array(200).fill(null);
    this._followPlayerClock = (this._followPlayerClock || 0) + dt;
    this._followPlayerSample ||= 0;
    this._followPlayerHead ||= 0;
    const sample = Math.floor((this._followPlayerClock + 1e-9) * 100);
    while (this._followPlayerSample < sample) {
      this._followPlayerHistory[this._followPlayerHead] = playerY;
      this._followPlayerHead = (this._followPlayerHead + 1) % 200;
      this._followPlayerSample++;
    }
    // processMoveActionsStep: the player follows come first, and the group
    // follows read what they moved (native LIMBO X68055 follows a Follow Player Y).
    for (let i = 0; i < this._activeFollowTweens.length;) {
      const active = this._activeFollowTweens[i], { trig } = active;
      if (active.paused || !trig.playerY) { i++; continue; }
      {
        const lag = Math.min(199, Math.round(trig.delay / Math.fround(.01)));
        const y = trig.delay > 0 ? this._followPlayerHistory[(this._followPlayerHead - 1 - lag + 400) % 200] : playerY;
        const endless = trig.duration === -1;
        if (y !== null) this._stepPlayerFollowY(trig, y, endless ? dt : Math.min(dt, Math.max(0, trig.duration - active.elapsed)));
        active.elapsed += dt;
        if (!endless && active.elapsed >= trig.duration) this._activeFollowTweens.splice(i, 1); else i++;
      }
    }
    // Original-engine shared-group fixture: a source in groups 1+3 moves
    // through group 3; Follow 2<-1 and Follow 4<-2 both move with it. Reading
    // only Move commands addressed to group 1 loses the entire displacement.
    // Resolve Follow dependencies before sampling their live source object.
    const byTarget = new Map(), visiting = new Set(), stepped = new Set();
    for (const active of this._activeFollowTweens) if (!active.trig.playerY) {
      const group = active.trig.targetGroup;
      if (!byTarget.has(group)) byTarget.set(group, []);
      byTarget.get(group).push(active);
    }
    const step = active => {
      const { trig } = active;
      if (active.paused || stepped.has(active) || visiting.has(active)) return;
      visiting.add(active);
      for (const upstream of byTarget.get(trig.sourceGroup) || []) step(upstream);
      const source = active.sourceIndex !== null ? this.gdRenderer?.objects[active.sourceIndex] : this._followSource(trig.sourceGroup);
      const point = source ? this.gdRenderer.livePosition(source, {}) : null;
      let delta = this._moveDeltas?.get(trig.sourceGroup);
      if (point) {
        delta = active.previousX === null || active.previousX === undefined ? null
          : { x: (point.x - active.previousX) * 2, y: -(point.y - active.previousY) * 2 };
        active.previousX = point.x; active.previousY = point.y;
        active.sourceIndex = source.index;
      }
      const endless = trig.duration === -1;
      const fraction = endless ? 1 : dt > 0 ? Math.max(0, Math.min(1, (trig.duration - active.elapsed) / dt)) : 1;
      if (delta) this._translateGroup(trig.targetGroup, delta.x * trig.modX * fraction, delta.y * trig.modY * fraction);
      active.elapsed += dt;
      visiting.delete(active); stepped.add(active);
    };
    for (const active of this._activeFollowTweens) if (!active.trig.playerY) step(active);
    this._activeFollowTweens = this._activeFollowTweens.filter(active => active.paused || active.trig.duration === -1 || active.elapsed < active.trig.duration);
    // Camera-lock moves run after this (stepCameraLockMoves) and are read
    // by the next step's follows, as GD adds the previous step's camera move.
    this._moveDeltas?.clear();
  }
  _stepPlayerFollowY(trig, y, dt) {
    // processPlayerFollowActions, installed GD 336a50: each member approaches
    // the delayed player position, rather than translating the whole group
    // by a shared delta. Speed clamps dt*60*speed to [0,1]; Max Speed clamps
    // that member's movement per step. The saved offset uses 10 per block.
    const fraction = Math.max(0, Math.min(1, dt * 60 * trig.speed));
    const limit = trig.maxSpeed > 0 ? trig.maxSpeed * dt * 60 : Infinity;
    const delta = current => Math.max(-limit, Math.min(limit, (y + trig.offset - current) * fraction));
    const renderer = this.gdRenderer;
    renderer?.flushMovesFor(trig.targetGroup);
    let moved = null;
    for (const obj of renderer?.groups.get(trig.targetGroup) || []) {
      const dy = delta((obj.y + obj.offY) * 2);
      moved ??= dy;
      if (!dy) continue;
      obj.offY += dy / 2;
      renderer._indexObject(obj);
    }
    for (const col of this._getUniqueGroupColliders(trig.targetGroup)) {
      const dy = delta(col.y);
      if (!dy) continue;
      this._recordColliderMotion(col);
      col.y += dy; col._baseY = col.y;
      this._syncColliderMoveBaseFromCurrent(col); this._refreshCollisionSection(col);
    }
    for (const spr of this._getUniqueGroupSprites(trig.targetGroup)) {
      if (!spr?.active) continue;
      const dy = delta(460 - (spr._eeBaseY ?? spr.y));
      if (!dy) continue;
      spr.y = spr._eeBaseY = (spr._eeBaseY ?? spr.y) - dy;
      this._syncSpriteMoveBaseFromCurrent(spr); this._refreshSpriteSection(spr);
    }
    if (moved) this._recordMoveDelta(trig.targetGroup, 0, -moved);
  }
  _scaleReference(trig) {
    if (!trig.centerGroup) return null;
    const parent = this._moveGroupParent(trig.centerGroup);
    const center = parent ? this.gdRenderer.livePosition(parent) : this.gdRenderer?.groupCenter(trig.centerGroup);
    if (!center) return null;
    const ref = parent || this.gdRenderer.groups.get(trig.centerGroup)?.find(o => !o.companionOf);
    let scaleX = 1, scaleY = 1;
    if (ref && trig.relativeScale) {
      // triggerScaleCommand 3272e0 divides each current scale by its saved
      // placed scale (488/3dc, 48c/3e0). Include Area's current transform,
      // but retain the unmodified centre position for the command's pivot.
      const area = {};
      this.areaState.forObject(ref, center.x, center.y, area);
      const m = this.areaState._beginLinear(ref, area);
      scaleX = Math.hypot(m[0], m[1]) / Math.abs(ref.scaleX || 1);
      scaleY = Math.hypot(m[2], m[3]) / Math.abs(ref.scaleY || 1);
    }
    return { ...center, rotation: ref ? ref.rot + ref.rotOff : 0, scaleX, scaleY };
  }
  _startScaleTrigger(trig) {
    if (!this._isTriggerSaveObjectLive(trig.uid) || !trig.targetGroup) return;
    const center = this._scaleReference(trig);
    if (trig.centerGroup && !center) return;
    const factor = (value, divide, reference) => {
      let f = divide ? (value ? 1 / value : 1) : value;
      if (!Number.isFinite(f)) f = 1;
      return trig.relativeScale && reference > 0 ? 1 + (f - 1) / reference : f;
    };
    this._activeScaleTweens.push({ trig, elapsed: 0, prevX: 1, prevY: 1,
      factorX: factor(trig.scaleX, trig.divideX, center?.scaleX), factorY: factor(trig.scaleY, trig.divideY, center?.scaleY) });
  }
  checkScaleTriggers(playerX) {
    for (const trig of this._orderedTriggers("_scaleTriggers", "_scaleTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._startScaleTrigger(trig);
    }
  }
  stepScaleTriggers(dt) {
    // Scales of one group about one centre commute (same axes), so a step's
    // tweens of a group combine into one pass over its members and colliders
    // -- pulsing levels run several at once on groups of thousands. Order is
    // kept wherever it matters: a tween never merges across one on an
    // overlapping group, and pending scales apply before a centre that one
    // of them moves is read.
    const ops = [];
    for (let i = 0; i < this._activeScaleTweens.length;) {
      const active = this._activeScaleTweens[i], { trig } = active;
      if (active.paused) { i++; continue; }
      active.elapsed += dt;
      const progress = trig.duration ? Math.min(1, active.elapsed / trig.duration) : 1;
      const sample = Easing.sample(trig.easingType, trig.easingRate, progress);
      // processTransformActions (33566e..3356xx) clamps both command samples
      // to magnitude .01 before dividing. A .001 shrink followed by x100
      // therefore restores full size, rather than leaving a tenth-size hitbox.
      const clamp = value => Math.abs(value) < .01 ? (value < 0 ? -.01 : .01) : value;
      const x = clamp(1 + (active.factorX - 1) * sample), y = clamp(1 + (active.factorY - 1) * sample);
      const dx = x / (active.prevX || 1e-12), dy = y / (active.prevY || 1e-12);
      // (A scale about the same centre object leaves that object in place.)
      if (trig.centerGroup && ops.some(op => op.trig.centerGroup !== trig.centerGroup &&
          this._scaleGroupsShare(op.trig.targetGroup, trig.centerGroup))) this._applyScaleOps(ops);
      const center = this._scaleReference(trig);
      if (!trig.centerGroup || center) this._queueScale(ops, trig, dx, dy, center);
      active.prevX = x; active.prevY = y;
      if (progress === 1) this._activeScaleTweens.splice(i, 1); else i++;
    }
    this._applyScaleOps(ops);
  }
  _scaleGroupsShare(a, b) {
    const r = this.gdRenderer;
    return !r || r.groupOverlaps(a).has(b);
  }
  _queueScale(ops, trig, fx, fy, center) {
    for (let j = ops.length - 1; j >= 0; j--) {
      const op = ops[j], t = op.trig;
      if (t.targetGroup === trig.targetGroup && t.centerGroup === trig.centerGroup && t.onlyMove === trig.onlyMove &&
          t.relativeRotation === trig.relativeRotation &&
          (op.center === center || (op.center && center && op.center.x === center.x && op.center.y === center.y && op.center.rotation === center.rotation))) {
        op.fx *= fx; op.fy *= fy;
        return;
      }
      if (this._scaleGroupsShare(t.targetGroup, trig.targetGroup)) break;
    }
    ops.push({ trig, fx, fy, center });
  }
  _applyScaleOps(ops) {
    for (const op of ops) this._applyGroupScale(op.trig, op.fx, op.fy, op.center);
    ops.length = 0;
  }
  _applyGroupScale(trig, fx, fy, center) {
    this.gdRenderer?.scaleGroup(trig.targetGroup, fx, fy, center, trig.onlyMove, trig.relativeRotation, trig.axesRotation, !!trig._keyframeTransform);
    const matrix = rotation => {
      const angle = -rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      return [c * c * fx + s * s * fy, c * s * (fx - fy), s * s * fx + c * c * fy];
    };
    for (const spr of this._getUniqueGroupSprites(trig.targetGroup)) {
      if (!spr?.active) continue;
      const [a, b, d] = matrix(trig.relativeRotation ? (trig.axesRotation ?? center?.rotation ?? (spr.rotation || 0) * 180 / Math.PI) : 0);
      if (center) {
        const dx = (spr._eeWorldX ?? spr.x) - center.x * 2, dy = 460 - (spr._eeBaseY ?? spr.y) - center.y * 2;
        spr.x = spr._eeWorldX = center.x * 2 + a * dx + b * dy;
        spr.y = spr._eeBaseY = 460 - (center.y * 2 + b * dx + d * dy);
        this._syncSpriteMoveBaseFromCurrent(spr);
      }
      if (!trig.onlyMove) { spr.scaleX *= fx; spr.scaleY *= fy; }
      this._refreshSpriteSection(spr);
    }
    for (const col of this._getUniqueGroupColliders(trig.targetGroup)) {
      this._recordColliderMotion(col);
      const [a, b, d] = matrix(trig.relativeRotation ? (trig.axesRotation ?? center?.rotation ?? col.rotationDegrees) : 0);
      if (center) {
        const dx = col.x - center.x * 2, dy = col.y - center.y * 2;
        col.x = center.x * 2 + a * dx + b * dy; col.y = center.y * 2 + b * dx + d * dy;
        this._syncColliderMoveBaseFromCurrent(col);
      }
      if (!trig.onlyMove) col.transformShape(a, b, b, d);
      this._refreshCollisionSection(col);
    }
  }

  _screenYToCollisionY(screenY) {
    if (typeof b === "function") return b(screenY);
    return 460 - (Number(screenY) || 0);
  }


  _applyRotateTriggerColliderDelta(col, deltaRot, centerX = null, centerY = null, lockRotation = false) {
    if (!col) return;
    this._recordColliderMotion(col);
    const hasCenter = Number.isFinite(centerX) && Number.isFinite(centerY);
    if (hasCenter) {
      const collisionCenterX = Number(centerX) || 0;
      const collisionCenterY = this._screenYToCollisionY(Number(centerY) || 0);
      // rotateObjects (334de0) turns through cocos float transforms and adds
      // the float difference to the double position: its rounding accumulates
      // over a long spin and moves blocks apart (native LIMBO X18836).
      const f = Math.fround, cx = f(collisionCenterX / 2), cy = f(collisionCenterY / 2 + 90);
      const rad = f(-f(f(deltaRot * 180 / Math.PI) * f(0.01745329252))), co = f(Math.cos(rad)), si = f(Math.sin(rad));
      const nativeX = col.x / 2, nativeY = col.y / 2 + 90, px = f(nativeX), py = f(nativeY), qx = f(px - cx), qy = f(py - cy);
      col.x = (nativeX + f(f(f(f(qx * co) - f(qy * si)) + cx) - px)) * 2;
      col.y = (nativeY + f(f(f(f(qx * si) + f(qy * co)) + cy) - py) - 90) * 2;
      col._baseX = col.x;
      col._baseY = col.y;
      this._syncColliderMoveBaseFromCurrent(col);
    }
    if (!lockRotation && (col.noTouch || (col.type !== solidType && col.type !== slopeType))) {
      const deltaDeg = deltaRot * 180 / Math.PI;
      col.rotationDegrees = (Number(col.rotationDegrees) || 0) + deltaDeg;
      if (col.orbRotation !== undefined) col.orbRotation = Math.fround(col.orbRotation + deltaDeg);
      col.rotateSlope(deltaDeg);
      if (col.shape) col.transformShape(Math.cos(deltaRot), -Math.sin(deltaRot), Math.sin(deltaRot), Math.cos(deltaRot));
      col._baseRotationDegrees = col.rotationDegrees;
      if (col._origRotationDegrees !== undefined) col._origRotationDegrees = col.rotationDegrees;
    }
    this._refreshCollisionSection(col);
  }

  _startPulseTrigger(trig) {
    if (window.enableLDM) return;
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    if (trig.exclusive) {
      this._activePulses = this._activePulses.filter(active => {
        const other = active?.trig;
        if (!other) return false;
        const keep = other.targetType !== trig.targetType ||
          (trig.targetType === 1
            ? other.targetGroup !== trig.targetGroup
            : other.targetChannel !== trig.targetChannel);
        if (!keep) active.manager?.removePulse(active.action);
        return keep;
      });
    }
    const totalDur = trig.fadeIn + trig.hold + trig.fadeOut;
    this._activePulses.push({ trig, elapsed: 0, totalDuration: totalDur > 0 ? totalDur : 0.01 });
  }

  _queueSpawnTrigger(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    const targetGroup = parseInt(trig.targetGroup ?? 0, 10);
    if (!Number.isFinite(targetGroup) || targetGroup <= 0) return;
    // SpawnTriggerGameObject stores the saved delay as float; the queued
    // SpawnTriggerAction then accumulates a float dt in a double timer.
    const baseDelay = Math.max(0, Math.fround(Number(trig.delay) || 0));
    const randomDelay = Math.max(0, Math.fround(Number(trig.randomDelay) || 0));
    const randomizedDelay = randomDelay > 0
      ? Math.max(0, baseDelay + ((Math.random() * 2) - 1) * randomDelay)
      : baseDelay;
    // A nested spawnGroupTriggered calls spawnGroup directly for zero delay.
    // Keeping it behind the parent's remaining commands makes WHAT's
    // upward ship acceleration read the old counter for an entire tick.
    // Position/touch activations reach the effect phase later this tick;
    // keep those queued so their Moves do not start before native's phase.
    if (trig.spawnTriggered && !(randomizedDelay > 0)) {
      this._activateSpawnedGroup(targetGroup, this._scene?._colorManager, !!trig.ordered, trig);
      return;
    }
    this._pushSpawnItem({
      targetGroup,
      ordered: !!trig.ordered,
      delay: randomizedDelay,
      elapsed: this._spawnEventOvershoot || 0,
      trig
    });
  }

  // Native updateSpawnTriggers visits its vector in insertion order. Two
  // actions becoming due in one step retain that order even if their
  // fractional overshoots differ (notably Pause followed by a self-spawn).
  // A delayed spawn created while the queue is being processed is a new
  // SpawnTriggerAction: GJEffectManager::updateSpawnTriggers steps it from the
  // next physics step on, so a 0.0001 s self-spawn loop runs once per step
  // instead of hitting the once-per-step group guard (Skeletal's intro hold).
  _pushSpawnItem(item) {
    const queue = this._activeSpawnDelays;
    if (!this._spawnProcessing) { queue.push(item); return; }
    if (item.delay > 0) { (this._spawnDeferred ||= []).push(item); return; }
    queue.push(item);
  }

  // The native group's object array is sorted by placed X, including
  // ordinary (non-Ordered) spawning. WHAT's 380/404 controller arrays were
  // read directly with tryGetGroup (32bf10): Count must precede Pickup at
  // X8391.9/8392.9 even though Pickup occurs first in the saved file.
  _spawnIndex() {
    if (this._spawnIndexCache) return this._spawnIndexCache;
    const index = new Map();
    const orderedOrigins = new Map();
    const lists = [["color", this._colorTriggers], ["enter", this._enterEffectTriggers], ["move", this._moveTriggers],
      ["follow", this._followTriggers], ["scale", this._scaleTriggers], ["alpha", this._alphaTriggers],
      ["toggle", this._toggleTriggers], ["animation", this._animationTriggers], ["shake", this._shakeTriggers],
      ["stop", this._stopTriggers], ["rotate", this._rotateTriggers], ["pulse", this._pulseTriggers],
      ["spawn", this._spawnTriggers], ["count", this._countTriggers], ["shader", this._shaderTriggers],
      ["camera", this._cameraTriggers], ["gradient", this._gradientTriggers], ["gameplay", this._gameplayTriggers],
      ["area", this._areaTriggers], ["advfollow", this._advFollowTriggers],
      ["end", this._endTriggers], ["keyframe", this._keyframeTriggers], ["logic", this._logicTriggers]];
    for (const [kind, list] of lists) {
      for (const trig of Array.isArray(list) ? list : []) {
        if (!trig || !Array.isArray(trig.groups)) continue;
        for (const group of new Set(trig.groups)) {
          if (!(group > 0)) continue;
          // spawnObjectsInOrder (3225fc..322653) takes its origin from
          // the first eligible trigger, before spawnObject checks Spawn
          // Triggered. A normal position trigger can therefore delay the
          // group's spawned commands (Troll Madness's group 740).
          const x = trig.x / 2;
          if (Number.isFinite(x) && (!orderedOrigins.has(group) || x < orderedOrigins.get(group))) orderedOrigins.set(group, x);
          if (!trig.spawnTriggered) continue;
          let entries = index.get(group);
          if (!entries) index.set(group, entries = []);
          entries.push({ trig, kind });
        }
      }
    }
    for (const entries of index.values()) entries.sort((a, b) => a.trig.x - b.trig.x || (a.trig.uid ?? 0) - (b.trig.uid ?? 0));
    this._spawnOrderedOrigins = orderedOrigins;
    return this._spawnIndexCache = index;
  }

  _spawnRemapContext(source) {
    const inherited = source?._spawnRemap || [];
    const values = source?.remapKeys;
    if (!values || values.length < 2) return inherited;
    const pairs = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      if (values[i] > 0 && Number.isFinite(values[i + 1])) pairs.push([values[i], values[i + 1]]);
    }
    // Native SpawnTriggerGameObject::changeRemap prepends its own mapping
    // to the caller's mappings. Each layer applies once, in that order.
    return pairs.length ? [pairs, ...inherited] : inherited;
  }

  _remapSpawnedTrigger(trig, kind, context) {
    if (!context?.length) return trig;
    const remap = value => {
      for (const pairs of context) {
        const match = pairs.find(pair => pair[0] === Number(value));
        if (match) value = match[1];
      }
      return value;
    };
    const cache = this._spawnRemappedTriggers ||= new Map();
    const cacheKey = `${kind}:${trig.uid}:${JSON.stringify(context)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const copy = { ...trig, _spawnRemap: context };
    // GJBaseGameLayer::processAreaActions/remap (Steam 322a40..32451f)
    // remaps IDs, never object membership, coordinates or animation values.
    for (const field of ["targetGroup", "centerGroup", "sourceGroup", "targetPosGroup", "targetCenterGroup", "targetRotationGroup", "itemId",
      "target", "center", "follow", "controlId", "effectID", "gdChannel", "targetChannel", "animationId"]) {
      if (copy[field] > 0) copy[field] = remap(copy[field]);
    }
    if (copy.directionBounds) copy.directionBounds = copy.directionBounds.map(remap);
    if (trig.raw) {
      copy.raw = { ...trig.raw };
      for (const key of [51, 71, 80, 95, 534, 76, 401, 516, 517, 518, 519, 395,
        203, 204, 205, 206, 209, 225, 344, 343, 392, 455, 457, 416, 432]) {
        if (Number(copy.raw[key]) > 0) copy.raw[key] = String(remap(copy.raw[key]));
      }
    }
    cache.set(cacheKey, copy);
    return copy;
  }

  _activateSpawnedTrigger(trig, kind, colorManager, remapContext = null) {
    if (remapContext?.length) trig = this._remapSpawnedTrigger(trig, kind, remapContext);
    if (!this._isTriggerSaveObjectLive(trig.uid)) return;
    if (!trig.multiTriggered && this._spawnActivated.has(trig.uid)) return;
    this._spawnActivated.add(trig.uid);
    switch (kind) {
      case "color": colorManager?.triggerColor?.(trig.index, trig.color, trig.duration, trig.colorOptions); break;
      case "enter":
        this._activateEnterEffect(trig);
        break;
      case "move": this._startMoveTriggerTween(trig); break;
      case "follow": this._startFollowTrigger(trig); break;
      case "scale": this._startScaleTrigger(trig); break;
      case "alpha": this._startAlphaTriggerTween(trig); break;
      case "toggle": this._applyToggleTrigger(trig); break;
      case "animation": this._playAnimationTrigger(trig); break;
      case "shake": this._scene?._startLevelShake?.(trig); break;
      case "stop": this._applyStopTrigger(trig); break;
      case "rotate": this._startRotateTriggerTween(trig); break;
      case "pulse": this._startPulseTrigger(trig); break;
      case "spawn": this._queueSpawnTrigger(trig); break;
      case "count": this._activateCountTrigger(trig); break;
      case "shader": this.shaderState?.trigger(trig); break;
      case "camera": this.cameraState?.trigger(trig); break;
      case "gradient": this.gradientState?.trigger(trig); break;
      case "area": this.areaState?.trigger(trig); break;
      case "advfollow": this.advFollowState?.trigger(trig); break;
      case "gameplay": this.gameplayState?.trigger(trig); break;
      case "end": this._activateEndTrigger(trig); break;
      case "keyframe": this.keyframeState?.trigger(trig); break;
      case "logic": this.logicState?.trigger(trig); break;
    }
  }

  checkSpawnTriggers(playerX) {
    for (const trig of this._orderedTriggers("_spawnTriggers", "_spawnTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._queueSpawnTrigger(trig);
    }
  }

  // GJBaseGameLayer::spawnGroup. A group spawns at most once per 240 Hz
  // physics step (a repeat in the same step only counts towards the 10000
  // loop limit, which then stops all spawning), so a spawn loop without delay
  // cannot run away. Spawn Ordered (441, spawnObjectsInOrder) fires the
  // group's first trigger at once and every later one after its X distance
  // from it at normal speed (311.58 units per second).
  _activateSpawnedGroup(groupId, colorManager, ordered = false, sourceTrig = null) {
    this._flushEarlierViewTriggers(sourceTrig);
    const targetGroup = parseInt(groupId ?? 0, 10);
    // Native spawnGroup checks the effect manager's group-toggle bit before
    // dispatching, including already queued self-spawns (32239b..3223c4).
    if (!Number.isFinite(targetGroup) || targetGroup <= 0 || this._groupEnabled[targetGroup] === false || this._spawnLoopHalted) return;
    const remapContext = this._spawnRemapContext(sourceTrig);
    const spawnKey = remapContext.length ? `${targetGroup}:${JSON.stringify(remapContext)}` : targetGroup;
    const overshoot = this._spawnEventOvershoot || 0;
    const step = this._scene?._fixedTickActive ? this._scene._physicsFrame
      : Math.floor(((this._spawnClock || 0) - overshoot) * 240 + 1e-6);
    if (this._spawnStepOf.get(spawnKey) === step) {
      if (++this._spawnLoopCount > 10000) this._spawnLoopHalted = true;
      return;
    }
    this._spawnStepOf.set(spawnKey, step);
    this.gdRenderer?.triggerAnimationGroup(targetGroup);
    let entries = this._spawnIndex().get(targetGroup);
    if (!entries) return;
    if (ordered) {
      // spawnObjectsInOrder orders by the saved X position, independently
      // of the level file's insertion order. A copied ending can precede
      // the scene's first command in the file (Skeletal's cannon sequence).
      const cache = this._spawnOrderedIndexCache ||= new Map();
      let sorted = cache.get(entries);
      if (!sorted) {
        sorted = entries.slice().sort((a, b) => a.trig.x - b.trig.x || (a.trig.uid ?? 0) - (b.trig.uid ?? 0));
        cache.set(entries, sorted);
      }
      entries = sorted;
    }
    let firstX = ordered ? (this._spawnOrderedOrigins?.get(targetGroup) ?? null) : null;
    for (const entry of entries) {
      if (ordered) {
        const x = entry.trig.x / 2;
        if (firstX === null) firstX = x;
        else {
          const delay = (x - firstX) / 311.5801086425781;
          if (delay - overshoot > 0) {
            this._pushSpawnItem({ entry, delay, elapsed: overshoot, trig: sourceTrig || entry.trig, remapContext });
            continue;
          }
        }
      }
      this._activateSpawnedTrigger(entry.trig, entry.kind, colorManager, remapContext);
      if (this._spawnLoopHalted) return;
    }
  }

  activateCustomRing(collider) {
    const raw = collider?._eeLevelObject?._raw || {};
    const targetGroup = Number(raw[51]) || 0;
    // activateCustomRing (325950) selects spawnGroup or toggleGroupTriggered.
    // The latter also spawns the enabled group (32b7f0), not just its art.
    if (raw[504] === "1") this._activateSpawnedGroup(targetGroup, this._scene?._colorManager);
    else this._toggleGroupTriggered(targetGroup, raw[56] === "1", {uid:collider._eeObjectId});
  }

  checkTouchSpawnTriggers(playerX, playerY) {
    const px = Number(playerX) || 0;
    const py = Number(playerY) || 0;
    this._touchSpawnTriggerActivated ||= new Set();

    const playerHalfSize = (typeof playerSize === "number" ? playerSize : 20);
    const halfHitbox = 30 + playerHalfSize;

    for (const trig of this._touchCandidates(this._spawnTriggers, px)) {
      if (!trig || !trig.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      const uid = trig.uid ?? `${trig.x},${trig.y},${trig.targetGroup}`;
      if (this._touchSpawnTriggerActivated.has(uid)) continue;
      if (this._touchesTrigger(trig, px, py, halfHitbox)) {
        this._touchSpawnTriggerActivated.add(uid);
        this._queueSpawnTrigger(trig);
      }
    }
  }

  stepSpawnTriggers(dt, colorManager) {
    // Advance each pending timer once per frame. Triggers created by a spawn
    // start at that event's time, so a chain cannot gain dt at every link.
    this._spawnClock = (this._spawnClock || 0) + dt;
    const queue = this._activeSpawnDelays;
    if (!queue.length) return;
    const actionDt = Math.fround(dt), initial = new Set(queue);
    this._spawnProcessing = true;
    this._spawnHead = 0;
    let budget = 200000;
    try {
      while (this._spawnHead < queue.length && budget-- > 0) {
        const item = queue[this._spawnHead];
        this._spawnHead++;
        if (!item.paused && initial.has(item)) item.elapsed += actionDt;
        if (item.paused || item.elapsed < item.delay) {
          (this._spawnDeferred ||= []).push(item);
          continue;
        }
        if (this._spawnLoopHalted) continue;
        this._spawnEventOvershoot = item.elapsed - item.delay;
        try {
          if (item.entry) this._activateSpawnedTrigger(item.entry.trig, item.entry.kind, colorManager, item.remapContext);
          else this._activateSpawnedGroup(item.targetGroup, colorManager, item.ordered, item.trig);
        } finally { this._spawnEventOvershoot = 0; }
      }
    } finally {
      queue.splice(0, this._spawnHead);
      this._spawnProcessing = false;
      this._spawnHead = 0;
      if (this._spawnDeferred?.length) { queue.push(...this._spawnDeferred); this._spawnDeferred.length = 0; }
    }
  }

  resetSpawnTriggers() {
    this._spawnActivated.clear();
    this._spawnEventOvershoot = 0;
    this._spawnClock = 0;
    this._spawnStepOf = new Map();
    this._spawnLoopCount = 0;
    this._spawnLoopHalted = false;
    this._spawnIndexCache = null;
    this._spawnOrderedIndexCache = null;
    this._spawnRemappedTriggers = new Map();
    this._spawnTriggerIdx = 0;
    this._activeSpawnDelays = [];
    this._spawnDeferred = [];
    this._touchSpawnTriggerActivated = new Set();
    this._countTriggerIdx = 0;
    this._endTriggerIdx = 0;
    // Persistent Item ids keep their value through a death.
    const persistent = this.logicState?.persistentItems?.() || new Map();
    this._itemCounts.clear();
    for (const [id, value] of persistent) this._itemCounts.set(id, value);
    this._keyframeTriggerIdx = 0;
    this.keyframeState?.reset();
    this._collectedPickups.clear();
    this._refreshCounterLabels();
    for (const obj of this.gdRenderer?.objects || []) if (window.GD_OBJECTS?.[obj.id]?.t === 30) obj.enabled = true;
    this._countWatchers = [];
    this._touchAdditional.clear();
  }

  _activateCountTrigger(trig) {
    if (!this._isTriggerSaveObjectLive(trig.uid)) return;
    if (trig.id === 1817) {
      const value = this._itemCounts.get(trig.itemId) || 0;
      this._itemCounts.set(trig.itemId, trig.override ? trig.count : value + trig.count);
      this._refreshCounterLabels(trig.itemId);
      this._evaluateCountWatchers();
    } else if (trig.id === 1811) {
      const value = this._itemCounts.get(trig.itemId) || 0;
      const matches = trig.comparison === 1 ? value > trig.count : trig.comparison === 2 ? value < trig.count : value === trig.count;
      if (matches) this._toggleGroupTriggered(trig.targetGroup, trig.activate, trig);
    } else {
      this._countWatchers.push({ trig, matched: false });
      this._evaluateCountWatchers();
    }
  }

  _evaluateCountWatchers() {
    this._countWatchers = this._countWatchers.filter(watcher => {
      if (watcher.paused) return true;
      const value = this._itemCounts.get(watcher.trig.itemId) || 0;
      const matches = value === watcher.trig.count;
      if (matches && !watcher.matched) this._toggleGroupTriggered(watcher.trig.targetGroup, watcher.trig.activate, watcher.trig);
      watcher.matched = matches;
      return !matches || watcher.trig.multiActivate;
    });
  }

  _refreshCounterLabels(itemId) {
    for (const label of this._counterLabels) if (itemId === undefined || itemId === label.itemId)
      this.gdRenderer?.setLabelText(label.object, String(this._itemCounts.get(label.itemId) || 0));
  }

  collectPickup(collider) {
    if (window.GD_OBJECTS?.[Number(collider?.coinId)]?.t !== 30) return false;
    const raw = collider._eeLevelObject?._raw || {}, uid = collider._eeObjectId;
    if (this._collectedPickups.has(uid)) return true;
    this._collectedPickups.add(uid);
    this.gdRenderer?.animatePickup(this.gdObjects[uid]);
    const pickupItem = raw[79] === "1" || raw[381] === "1";
    if (pickupItem) {
      const itemId = Number(raw[80]) || 0;
      const points = raw[383] === undefined ? 1 : Number(raw[383]);
      const delta = (Number.isFinite(points) ? points : 1) * (raw[78] === "1" ? -1 : 1);
      this._itemCounts.set(itemId, (this._itemCounts.get(itemId) || 0) + delta);
      this._refreshCounterLabels(itemId); this._evaluateCountWatchers();
    }
    // EffectGameObject's Pickup Item (381) and Toggle Trigger (382) are
    // independent. Troll Madness's keys use both: their target advances a
    // Sequence as well as incrementing the item counter.
    if (raw[382] === "1" || !pickupItem) {
      this._toggleGroupTriggered(Number(raw[51]) || 0, raw[56] === "1", { uid });
    }
    const obj = this.gdObjects[uid];
    if (obj) obj.enabled = false;
    return true;
  }

  checkCountTriggers(playerX) {
    for (const trig of this._orderedTriggers("_countTriggers", "_countTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._activateCountTrigger(trig);
    }
  }

  _activateEndTrigger(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    this.gdRenderer?.flushMoves();
    const raw = trig.raw, target = this._moveGroupParent(Number(raw[71]) || 0);
    const position = target ? { x: (target.x + target.offX) * 2, y: (target.y + target.offY) * 2 }
      : { x: trig.x, y: trig.y };
    this._scene?._endFromTrigger?.({ ...position, noEffects: raw[460] === "1", noSFX: raw[461] === "1", instant: raw[487] === "1" });
    const spawnGroup = Number(raw[51]) || 0;
    if (spawnGroup > 0) this._activateSpawnedGroup(spawnGroup, this._scene?._colorManager);
  }

  checkEndTriggers(playerX) {
    for (const trig of this._orderedTriggers("_endTriggers", "_endTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._activateEndTrigger(trig);
    }
  }

  checkKeyframeTriggers(playerX) {
    for (const trig of this._orderedTriggers("_keyframeTriggers", "_keyframeTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this.keyframeState?.trigger(trig);
    }
  }

  checkAdditionalTouchTriggers(playerX, playerY) {
    this.checkTouchEnterEffectTriggers(playerX, playerY);
    const halfHitbox = 30 + (typeof playerSize === "number" ? playerSize : 20);
    const actions = [
      [this._alphaTriggers, trig => this._startAlphaTriggerTween(trig)],
      [this._rotateTriggers, trig => this._startRotateTriggerTween(trig)],
      [this._pulseTriggers, trig => this._startPulseTrigger(trig)],
      [this._shakeTriggers, trig => this._scene?._startLevelShake?.(trig)],
      [this._countTriggers, trig => this._activateCountTrigger(trig)],
      [this._shaderTriggers, trig => this.shaderState?.trigger(trig)],
      [this._followTriggers, trig => this._startFollowTrigger(trig)],
      [this._scaleTriggers, trig => this._startScaleTrigger(trig)],
      [this._cameraTriggers, trig => this.cameraState?.trigger(trig)],
      [this._gradientTriggers, trig => this.gradientState?.trigger(trig)],
      [this._areaTriggers, trig => this.areaState?.trigger(trig)],
      [this._advFollowTriggers, trig => this.advFollowState?.trigger(trig)],
      [this._gameplayTriggers, trig => this.gameplayState?.trigger(trig)],
      [this._endTriggers, trig => this._activateEndTrigger(trig)],
      [this._keyframeTriggers, trig => this.keyframeState?.trigger(trig)],
      // Collision State blocks report enter/exit themselves (GDLogicState).
      [this._logicTriggers, trig => { if (trig.id !== 3640) this.logicState?.trigger(trig); }]
    ];
    for (const [list, activate] of actions) for (const trig of this._touchCandidates(list, Number(playerX))) {
      if (!trig.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      if (this._touchAdditional.has(trig.uid)) continue;
      if (this._touchesTrigger(trig, playerX, playerY, halfHitbox)) {
        this._touchAdditional.add(trig.uid);
        activate(trig);
      }
    }
  }

  checkTouchEnterEffectTriggers(playerX, playerY) {
    const halfHitbox = 30 + (typeof playerSize === "number" ? playerSize : 20);
    for (const trig of this._touchCandidates(this._enterEffectTriggers, Number(playerX))) {
      if (!trig.touchTriggered || trig.spawnTriggered || this._touchAdditional.has(trig.uid) || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      if (this._touchesTrigger(trig, playerX, playerY, halfHitbox)) {
        this._touchAdditional.add(trig.uid); this._activateEnterEffect(trig);
      }
    }
  }

  _playAnimationTrigger(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid)) return;
    const targetGroup = parseInt(trig.targetGroup ?? 0, 10);
    const animationId = parseInt(trig.animationId ?? 0, 10);
    if (!Number.isFinite(targetGroup) || targetGroup <= 0 || !Number.isFinite(animationId)) return;
    this.gdRenderer?.triggerAnimationGroup(targetGroup);

    for (const beast of this._beastAnimations || []) {
      if (!Array.isArray(beast.groups) || !beast.groups.includes(targetGroup)) continue;
      const clip = _BEAST_TRIGGER_CLIPS[beast.objectId]?.[animationId];
      if (!clip) continue;
      const frames = _getBeastDescriptor(this._scene, beast.cacheKey)?.[clip];
      if (!Array.isArray(frames) || !frames.length) continue;

      this._setBeastClip(beast, clip, this._beastAnimationClock, true);
    }
  }

  checkAnimationTriggers(playerX) {
    for (const trig of this._orderedTriggers("_animationTriggers", "_animationTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._playAnimationTrigger(trig);
    }
  }

  checkTouchAnimationTriggers(playerX, playerY) {
    const px = Number(playerX) || 0;
    const py = Number(playerY) || 0;
    const halfHitbox = 30 + (typeof playerSize === "number" ? playerSize : 20);

    for (const trig of this._touchCandidates(this._animationTriggers, Number(playerX))) {
      if (!trig?.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      const uid = trig.uid ?? `${trig.x},${trig.y},${trig.targetGroup},${trig.animationId}`;
      if (this._touchAnimationTriggerActivated.has(uid)) continue;
      if (this._touchesTrigger(trig, px, py, halfHitbox)) {
        this._touchAnimationTriggerActivated.add(uid);
        this._playAnimationTrigger(trig);
      }
    }
  }

  resetAnimationTriggers() {
    this._animationTriggerIdx = 0;
    this._touchAnimationTriggerActivated = new Set();
    this._beastAnimationClock = 0;
    for (const beast of this._beastAnimations || []) {
      if (!beast.defaultClip) continue;
      const frames = _getBeastDescriptor(this._scene, beast.cacheKey)?.[beast.defaultClip];
      if (!Array.isArray(frames) || !frames.length) continue;
      this._setBeastClip(beast, beast.defaultClip, beast.defaultStartTime || 0);
    }
  }

  _applyToggleTrigger(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid) || trig.targetGroup <= 0) return;
    this._groupEnabled[trig.targetGroup] = !!trig.activate;
    const sprites = this._getUniqueGroupSprites(trig.targetGroup);
    for (const spr of sprites) {
      const baseAlpha = spr._eeOrigAlpha ?? 1;
      if (typeof spr.setAlpha === "function") {
        spr.setAlpha(baseAlpha * this._getGroupOpacityForSprite(spr));
      }
      if (spr._padParticleEmitter?.setVisible) {
        spr._padParticleEmitter.setVisible(this._getGroupOpacityForSprite(spr) > 0.01);
      }
    }
    for (const col of this._getUniqueGroupColliders(trig.targetGroup)) {
      const groups = this._getObjectGroupIds(col);
      col._eeDisabled = groups.some(gid => this._groupEnabled[gid] === false);
    }
  }

  checkToggleTriggers(playerX) {
    for (const trig of this._orderedTriggers("_toggleTriggers", "_toggleTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._applyToggleTrigger(trig);
    }
  }

  checkTouchToggleTriggers(playerX, playerY) {
    const px = Number(playerX) || 0;
    const py = Number(playerY) || 0;
    const halfHitbox = 30 + (typeof playerSize === "number" ? playerSize : 20);
    for (const trig of this._touchCandidates(this._toggleTriggers, px)) {
      if (!trig?.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      const uid = trig.uid ?? `${trig.x},${trig.y},${trig.targetGroup}`;
      if (this._touchToggleTriggerActivated.has(uid)) continue;
      if (this._touchesTrigger(trig, px, py, halfHitbox)) {
        this._touchToggleTriggerActivated.add(uid);
        this._applyToggleTrigger(trig);
      }
    }
  }

  resetToggleTriggers() {
    this._toggleTriggerIdx = 0;
    this._touchToggleTriggerActivated = new Set();
    this._groupEnabled = {};
    const seenSprites = new Set();
    for (const gid in this._groupSprites) {
      for (const spr of this._groupSprites[gid]) {
        if (!spr || !spr.active || seenSprites.has(spr)) continue;
        seenSprites.add(spr);
        const baseAlpha = spr._eeOrigAlpha ?? 1;
        if (spr.setAlpha) spr.setAlpha(baseAlpha * this._getGroupOpacityForSprite(spr));
      }
    }
    for (const gid in this._groupColliders) {
      for (const col of this._groupColliders[gid]) if (col) col._eeDisabled = false;
    }
  }

  checkShakeTriggers(playerX) {
    for (const trig of this._orderedTriggers("_shakeTriggers", "_shakeTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && this._isTriggerSaveObjectLive(trig.uid)) {
        this._scene?._startLevelShake?.(trig);
      }
    }
  }

  resetShakeTriggers() {
    this._shakeTriggerIdx = 0;
  }

  _applyStopTrigger(trig) {
    if (!trig || !this._isTriggerSaveObjectLive(trig.uid) || trig.targetGroup <= 0) return;
    const target = trig.targetGroup;
    const command = trig.command || 0;
    // EffectGameObject properties 534/535 select a command's Control ID.
    // A Stop using this ID must not cancel every action moving that group.
    const controlMatch = trig.targetControlId ? active => Number(active?.controlId ?? active?.raw?.[534] ?? 0) === target : null;
    const keepRunning = item => {
      const activeTrigger = item?.trig;
      if (!activeTrigger) return true;
      if (controlMatch) return !controlMatch(activeTrigger);
      return !this._triggerHasGroup(activeTrigger, target) && activeTrigger.targetGroup !== target;
    };
    // A Count trigger waiting for its value is an action too (native MK2 X45568).
    if (!command) this._countWatchers = (this._countWatchers || []).filter(keepRunning);
    if (command === 1 || command === 2) {
      // TriggerControlGameObject property 580: Pause retains the action and
      // its elapsed time; Resume releases it. It does not restart the trigger.
      // Native controlActionsForTrigger (368bc0) sets SpawnTriggerAction's
      // disabled byte independently of its finished byte.
      const lists = [this._activeMoveTweens, this._activeFollowTweens, this._activeScaleTweens,
        this._activeAlphaTweens, this._activeRotateTweens, this._activePulses,
        this.keyframeState?.active, this.cameraState?.tweens];
      for (const list of lists) for (const item of list || []) if (!keepRunning(item)) {
        item.paused = command === 1;
        if (item.action) item.action.paused = item.paused;
      }
      const pending = this._activeSpawnDelays;
      for (let i = this._spawnProcessing ? this._spawnHead : 0; i < pending.length; i++)
        if (!keepRunning(pending[i])) pending[i].paused = command === 1;
      for (const item of this._spawnDeferred || []) if (!keepRunning(item)) item.paused = command === 1;
      for (const watcher of this._countWatchers || []) if (!keepRunning(watcher)) watcher.paused = command === 1;
      this.areaState?.controlGroup?.(target, command, controlMatch);
      this.advFollowState?.controlGroup?.(target, command, controlMatch);
      this.logicState?.controlGroup?.(target, command, controlMatch);
      this.gradientState?.controlGroup?.(target, command, controlMatch);
      return;
    }
    this._activeMoveTweens = this._activeMoveTweens.filter(keepRunning);
    this._activeFollowTweens = this._activeFollowTweens.filter(keepRunning);
    if (this.keyframeState) this.keyframeState.active = this.keyframeState.active.filter(keepRunning);
    this._activeScaleTweens = this._activeScaleTweens.filter(keepRunning);
    this.areaState?.stopGroup(target, controlMatch);
    this.advFollowState?.stopGroup(target, controlMatch);
    this.logicState?.stopGroup(target, controlMatch);
    this.gradientState?.stopGroup(target, controlMatch);
    if (this.cameraState) this.cameraState.tweens = this.cameraState.tweens.filter(keepRunning);
    this._activeAlphaTweens = this._activeAlphaTweens.filter(keepRunning);
    this._activeRotateTweens = this._activeRotateTweens.filter(keepRunning);
    this._activePulses = this._activePulses.filter(item => {
      if (keepRunning(item)) return true;
      item.manager?.removePulse(item.action);
      return false;
    });
    // A Stop can itself be dispatched from this queue. Keep the queue and
    // its consumed prefix intact: replacing it resurrected every consumed
    // multi-trigger entry on the next tick and detached newly queued spawns
    // from the active dispatcher. Only unconsumed entries can be cancelled.
    const pending = this._activeSpawnDelays;
    for (let i = pending.length - 1, first = this._spawnProcessing ? this._spawnHead : 0; i >= first; i--)
      if (!keepRunning(pending[i])) pending.splice(i, 1);
    if (this._spawnDeferred) this._spawnDeferred = this._spawnDeferred.filter(keepRunning);
    // GJShaderState::tweenValue creates its tweens with unique/control id -1,
    // so a Stop trigger never reaches a running shader fade.
  }

  checkStopTriggers(playerX, playerY) {
    for (const trig of this._orderedTriggers("_stopTriggers", "_stopTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._applyStopTrigger(trig);
    }
    const px = Number(playerX) || 0;
    const py = Number(playerY) || 0;
    const halfHitbox = 30 + (typeof playerSize === "number" ? playerSize : 20);
    for (const trig of this._touchCandidates(this._stopTriggers, px)) {
      if (!trig?.touchTriggered || trig.spawnTriggered || !this._isTriggerSaveObjectLive(trig.uid)) continue;
      const uid = trig.uid ?? `${trig.x},${trig.y},${trig.targetGroup}`;
      if (this._touchStopTriggerActivated.has(uid)) continue;
      if (this._touchesTrigger(trig, px, py, halfHitbox)) {
        this._touchStopTriggerActivated.add(uid);
        this._applyStopTrigger(trig);
      }
    }
  }

  resetStopTriggers() {
    this._stopTriggerIdx = 0;
    this._touchStopTriggerActivated = new Set();
  }

  checkAlphaTriggers(playerX) {
    for (const trig of this._orderedTriggers("_alphaTriggers", "_alphaTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._startAlphaTriggerTween(trig);
    }
  }

  stepAlphaTriggers(dt) {
    let i = 0;
    while (i < this._activeAlphaTweens.length) {
      const anim = this._activeAlphaTweens[i];
      if (anim.paused) { i++; continue; }
      const { trig } = anim;
      const dur = trig.duration > 0 ? trig.duration : 0;

      anim.elapsed += dt;
      const progress = dur > 0 ? Math.min(anim.elapsed / dur, 1) : 1;

      const newOpacity = anim.startOpacity + (trig.targetOpacity - anim.startOpacity) * progress;
      this._groupOpacity[trig.targetGroup] = Math.max(0, Math.min(1, newOpacity));

      if (progress >= 1) {
        this._activeAlphaTweens.splice(i, 1);
      } else {
        i++;
      }
    }

    for (const gid in this._groupOpacity) {
      const sprites = this._groupSprites[gid];
      if (!sprites) continue;
      const op = this._groupOpacity[gid];
      for (const spr of sprites) {
        if (!spr || !spr.active) continue;
        if (spr._eeActive) continue;
        const baseAlpha = spr._eeOrigAlpha ?? 1;
        const targetAlpha = baseAlpha * this._getGroupOpacityForSprite(spr);
        if (typeof spr.setAlpha === "function") spr.setAlpha(targetAlpha);
        if (spr._padParticleEmitter) {
          if (typeof spr._padParticleEmitter.setAlpha === "function") spr._padParticleEmitter.setAlpha(targetAlpha);
          if (typeof spr._padParticleEmitter.setVisible === "function") spr._padParticleEmitter.setVisible(targetAlpha > 0.01);
        }
      }
    }
  }

  resetAlphaTriggers() {
    this._alphaTriggerIdx = 0;
    this._activeAlphaTweens = [];
    this._groupOpacity = {};
    for (const gid in this._groupSprites) {
      for (const spr of this._groupSprites[gid]) {
        if (!spr || !spr.active) continue;
        if (spr._eeActive) continue;
        const baseAlpha = spr._eeOrigAlpha ?? 1;
        const targetAlpha = baseAlpha * (spr._eeIsGlowSprite ? this._getGlowAlphaMultiplier() : 1);
        if (typeof spr.setAlpha === "function") spr.setAlpha(targetAlpha);
        if (spr._padParticleEmitter) {
          if (typeof spr._padParticleEmitter.setAlpha === "function") spr._padParticleEmitter.setAlpha(1);
          if (typeof spr._padParticleEmitter.setVisible === "function") spr._padParticleEmitter.setVisible(true);
        }
      }
    }
  }

  checkRotateTriggers(playerX) {
    for (const trig of this._orderedTriggers("_rotateTriggers", "_rotateTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._startRotateTriggerTween(trig);
    }
  }

  // getCenterObject (32c200): the group's parent, else its only object. A larger
  // group has no centre, and the target only turns in place (334753 -> 334b79).
  _getRotateTriggerCenter(groupId) {
    const parent = this._moveGroupParent(groupId);
    if (!parent) return null;
    const center = this.gdRenderer.livePosition(parent);
    return { x: center.x * 2, y: b(center.y * 2) };
  }

  stepRotateTriggers(dt) {
    for (let i = 0; i < this._activeRotateTweens.length;) {
      const anim = this._activeRotateTweens[i];
      if (anim.paused) { i++; continue; }
      const { trig } = anim;
      anim.elapsed += dt;
      const dynamic = !!(anim.ends && trig.dynamicMode && trig.duration !== 0);
      const progress = trig.duration === -1 && dynamic ? 0 : trig.duration > 0 ? Math.min(anim.elapsed / trig.duration, 1) : 1;
      const deltaRot = dynamic ? this._rotateTargetDelta(trig, anim.ends) / trig.dynamicEasing * Math.PI / 180 :
        (Easing.sample(trig.easingType, trig.easingRate, progress) -
          Easing.sample(trig.easingType, trig.easingRate, anim.prevProgress)) * anim.totalRad;
      anim.prevProgress = progress;
      const center = trig.centerGroup > 0 ? this._getRotateTriggerCenter(trig.centerGroup) : null;
      {
        const c = Math.cos(deltaRot), s = Math.sin(deltaRot);
        // An orbiting single object moves like a Move trigger would: a Follow of
        // its group takes the same step (Troll Madness: the spike leaping over you).
        const members = center ? this.gdRenderer?.groups.get(trig.targetGroup) : null;
        const orbiter = members?.length === 1 ? members[0] : null;
        const before = orbiter ? { ...this.gdRenderer.livePosition(orbiter) } : null;
        this.gdRenderer?.rotateGroup(trig.targetGroup, deltaRot,
          center ? { x: center.x / 2, y: b(center.y) / 2 } : null, !!trig.lockRotation);
        if (orbiter) {
          const after = this.gdRenderer.livePosition(orbiter);
          this._recordMoveDelta(trig.targetGroup, (after.x - before.x) * 2, -(after.y - before.y) * 2);
        }
        for (const spr of this._getUniqueGroupSprites(trig.targetGroup)) {
          if (!spr?.active) continue;
          if (center) {
            const dx = (spr._eeWorldX ?? spr.x) - center.x;
            const dy = (spr._eeBaseY ?? spr.y) - center.y;
            spr.x = spr._eeWorldX = center.x + dx * c - dy * s;
            spr.y = spr._eeBaseY = center.y + dx * s + dy * c;
            if (Number.isFinite(spr._eeSawPivotX)) {
              const px = spr._eeSawPivotX - center.x, py = spr._eeSawPivotY - center.y;
              spr._eeSawPivotX = center.x + px * c - py * s;
              spr._eeSawPivotY = center.y + px * s + py * c;
            }
            this._syncSpriteMoveBaseFromCurrent(spr);
            this._refreshSpriteSection(spr);
          }
          if (!trig.lockRotation) {
            spr.rotation += deltaRot;
            if (Number.isFinite(spr._eeSawPivotX)) spr._eeSawGroupRotation = (spr._eeSawGroupRotation || 0) + deltaRot;
          }
        }
        for (const col of this._getUniqueGroupColliders(trig.targetGroup)) {
          this._applyRotateTriggerColliderDelta(col, deltaRot, center?.x, center?.y, !!trig.lockRotation);
        }
      }
      if (progress >= 1) this._activeRotateTweens.splice(i, 1); else i++;
    }
  }

  resetRotateTriggers() {
    this._rotateTriggerIdx = 0;
    this._activeRotateTweens = [];
    const seenSprites = new Set();
    for (const gid in this._groupSprites) {
      for (const spr of this._groupSprites[gid]) {
        if (!spr || !spr.active || seenSprites.has(spr)) continue;
        seenSprites.add(spr);
        if (spr._eeInitialWorldX !== undefined) {
          spr.x = spr._eeInitialWorldX;
          spr._eeWorldX = spr._eeInitialWorldX;
          spr._origWorldX = spr._eeInitialWorldX;
          spr._eeMoveBaseWorldX = spr._eeInitialWorldX;
        }
        if (spr._eeInitialBaseY !== undefined) {
          spr.y = spr._eeInitialBaseY;
          spr._eeBaseY = spr._eeInitialBaseY;
          spr._origBaseY = spr._eeInitialBaseY;
          spr._eeMoveBaseBaseY = spr._eeInitialBaseY;
        }
        if (spr._eeInitialRotationRad !== undefined) spr.rotation = spr._eeInitialRotationRad;
        if (Number.isFinite(spr._eeSawInitialPivotX) && Number.isFinite(spr._eeSawInitialPivotY)) {
          spr._eeSawPivotX = spr._eeSawInitialPivotX;
          spr._eeSawPivotY = spr._eeSawInitialPivotY;
          spr._eeSawGroupRotation = 0;
        }
        this._refreshSpriteSection(spr);
      }
    }

    const seenColliders = new Set();
    for (const gid in this._groupColliders) {
      for (const col of this._groupColliders[gid]) {
        if (!col || seenColliders.has(col)) continue;
        seenColliders.add(col);
        if (col._eeInitialBaseX !== undefined) {
          col.x = col._eeInitialBaseX;
          col._baseX = col._eeInitialBaseX;
          col._origBaseX = col._eeInitialBaseX;
          col._eeMoveBaseX = col._eeInitialBaseX;
        }
        if (col._eeInitialBaseY !== undefined) {
          col.y = col._eeInitialBaseY;
          col._baseY = col._eeInitialBaseY;
          col._origBaseY = col._eeInitialBaseY;
          col._eeMoveBaseY = col._eeInitialBaseY;
        }
        if (col._eeInitialRotationDegrees !== undefined) {
          col.rotationDegrees = col._eeInitialRotationDegrees;
          col._baseRotationDegrees = col._eeInitialRotationDegrees;
          col._origRotationDegrees = col._eeInitialRotationDegrees;
        }
        if (col._eeInitialOrbRotation !== undefined) col.orbRotation = col._eeInitialOrbRotation;
        if (col._initialSlopeGeometry) {
          Object.assign(col, col._initialSlopeGeometry);
          col.rotateSlope(0);
        }
        this._refreshCollisionSection(col);
      }
    }
  }

  checkPulseTriggers(playerX) {
    if (window.enableLDM) return;
    for (const trig of this._orderedTriggers("_pulseTriggers", "_pulseTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered) this._startPulseTrigger(trig);
    }
  }
  checkShaderTriggers(playerX, playerY) {
    for (const trig of this._orderedTriggers("_shaderTriggers", "_shaderTriggerIdx", playerX, playerY)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && this._isTriggerSaveObjectLive(trig.uid)) this.shaderState?.trigger(trig);
    }
    for (const trig of this._orderedTriggers("_gradientTriggers", "_gradientTriggerIdx", playerX, playerY)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && this._isTriggerSaveObjectLive(trig.uid)) this.gradientState?.trigger(trig);
    }
  }
  checkLogicTriggers(playerX) {
    for (const trig of this._orderedTriggers("_logicTriggers", "_logicTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && trig.id !== 3640 && this._isTriggerSaveObjectLive(trig.uid)) this.logicState?.trigger(trig);
    }
  }

  // GJBaseGameLayer::toggleGroupTriggered: toggles the group and, when it
  // activates, also spawns it (Count, Instant Count, Pickup, Touch, Collision,
  // On Death, Toggle Block, collectibles).
  _toggleGroupTriggered(group, activate, trig = null) {
    const targetGroup = Number(group) || 0;
    if (targetGroup <= 0) return;
    this._flushEarlierViewTriggers(trig);
    this._applyToggleTrigger({ uid: trig?.uid, targetGroup, activate: !!activate });
    if (activate) this._activateSpawnedGroup(targetGroup, this._scene?._colorManager, false, trig);
  }

  // The X of every trigger the start of a level meets, when this level has more
  // than one trigger channel (null otherwise).
  startTriggerXs(playerX, force = false) {
    const lists = ["_colorTriggers", "_enterEffectTriggers", "_moveTriggers", "_followTriggers", "_scaleTriggers", "_spawnTriggers",
      "_countTriggers", "_endTriggers", "_keyframeTriggers", "_animationTriggers", "_toggleTriggers", "_shakeTriggers", "_stopTriggers",
      "_alphaTriggers", "_rotateTriggers", "_pulseTriggers", "_shaderTriggers", "_gradientTriggers", "_logicTriggers", "_cameraTriggers",
      "_areaTriggers", "_advFollowTriggers", "_gameplayTriggers"].map(name => this[name] || []);
    const channels = lists.some(list => list.some(trig => trig.channel)) ||
      (this._gameplayTriggers || []).some(trig => trig.raw?.[171] === "1");
    if (!channels && !force) return null;
    const xs = new Set();
    for (const list of lists) for (const trig of list) if (trig.x <= playerX && !trig.spawnTriggered && !trig.touchTriggered) xs.add(trig.x);
    return [...xs].sort((a, b) => a - b);
  }
  checkGameplayTriggers(playerX, playerY) {
    this.gameplayState?.flush();
    // A turn may enter a new channel whose first command is already due.
    for (let changes = 0; changes < 16; changes++) {
      const channel = this._gameplayChannel;
      for (const trig of this._orderedTriggers("_gameplayTriggers", "_gameplayTriggerIdx", playerX, playerY)) this.gameplayState?.trigger(trig);
      if (channel === this._gameplayChannel) break;
    }
  }
  checkAreaTriggers(playerX) {
    for (const trig of this._orderedTriggers("_areaTriggers", "_areaTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && this._isTriggerSaveObjectLive(trig.uid)) this.areaState?.trigger(trig);
    }
    for (const trig of this._orderedTriggers("_advFollowTriggers", "_advFollowTriggerIdx", playerX)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && this._isTriggerSaveObjectLive(trig.uid)) this.advFollowState?.trigger(trig);
    }
  }
  _flushEarlierViewTriggers(source) {
    if (!source || source.spawnTriggered || source.touchTriggered || !Number.isFinite(source.x)) return;
    // Trigger categories have separate cursors. Before an X/Y-activated
    // command spawns a view change, consume the ordinary camera/shader commands
    // strictly earlier on the same channel. Otherwise the later category
    // pass overwrites the spawned state (Skeletal's intro camera and shader
    // range: the gameplay lens otherwise blacks out every logo).
    // Spawn-layout coordinates and touch rectangles are not activation order.
    const direction = this._channelDirections[this._gameplayChannel] || { x: 1, y: 0 };
    const x = source.x - direction.x * .0001, y = (source.y || 0) - direction.y * .0001;
    this.checkCameraTriggers(x, y);
    this.checkShaderTriggers(x, y);
    // Song edits before a Count/Spawn must run before the spawned audio.
    // Skeletal first restores channel zero, then mutes it for its logos.
    this.checkLogicTriggers(x);
  }
  checkCameraTriggers(playerX, playerY) {
    for (const trig of this._orderedTriggers("_cameraTriggers", "_cameraTriggerIdx", playerX, playerY)) {
      if (!trig.spawnTriggered && !trig.touchTriggered && this._isTriggerSaveObjectLive(trig.uid)) this.cameraState?.trigger(trig);
    }
  }
  stepPulseTriggers(dt, colorManager) {
    for (let i = 0; i < this._activePulses.length;) {
      const pulse = this._activePulses[i];
      if (pulse.paused) { i++; continue; }
      if (!pulse.action && colorManager?.addPulse) {
        const trig = pulse.trig;
        pulse.manager = colorManager;
        pulse.action = colorManager.addPulse({
          targetID: trig.targetType === 1 ? trig.targetGroup : trig.targetChannel,
          targetGroup: trig.targetType === 1, color: trig.color,
          fadeIn: trig.fadeIn, hold: trig.hold, fadeOut: trig.fadeOut,
          hsvMode: trig.hsvMode, hsv: trig.hsv, copyID: trig.copyColorId,
          exclusive: trig.exclusive, mainOnly: trig.mainOnly, detailOnly: trig.detailOnly
        });
      }
      pulse.elapsed += dt;
      if (pulse.elapsed >= pulse.totalDuration) this._activePulses.splice(i, 1); else i++;
    }
  }

  _applyLegacyGroupPulses(colorManager) {
    if (!colorManager?.colorForGroup) return;
    const seen = new Set();
    for (const [id, sprites] of Object.entries(this._groupSprites)) {
      const pulsed = colorManager.hasGroupPulse(Number(id));
      for (const spr of sprites) {
        if (!spr?.active || seen.has(spr) || (!pulsed && !spr._eePulsed)) continue;
        seen.add(spr);
        if (spr._eeBeastColorSprite || spr._cantColor || (spr._isBlack && !spr._canColor) || !spr.setTint) continue;
        const channel = spr._isSaw && spr._SawColor !== undefined ? spr._SawColor : spr._eeColorChannel;
        const tint = spr._eeStaticTint ?? 0xffffff;
        const base = channel > 0 ? colorManager.getFinal(channel) : [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
        let color = base.slice();
        let active = false;
        for (const gid of this._getObjectGroupIds(spr)) {
          if (!colorManager.hasGroupPulse(gid)) continue;
          colorManager.colorForGroup(gid, color, spr._eeColorKind !== "detail", color);
          active = true;
        }
        if (spr._eeHSV) color = gdTransformColorRGB(...color, spr._eeHSV);
        spr.setTint((color[0] << 16) | (color[1] << 8) | color[2]);
        spr._eePulsed = active;
      }
    }
  }

  resetPulseTriggers() {
    for (const pulse of this._activePulses) pulse.manager?.removePulse(pulse.action);
    this._pulseTriggerIdx = 0;
    this._activePulses = [];
  }

  applyColorChannels(colorManager, forceAll = false) {
    const canConsumeDirty = typeof colorManager?.consumeDirtyChannels === "function";
    const fullApply = forceAll || this._colorChannelsNeedFullApply || !canConsumeDirty;
    const channelIds = fullApply
      ? Object.keys(this._colorChannelSprites)
      : colorManager.consumeDirtyChannels();
    // A full pass already covers every channel. Clear the accumulated dirty
    // set so the following frame does not repeat the same O(sprite-count)
    // work after a level load or respawn.
    if (fullApply && canConsumeDirty) colorManager.consumeDirtyChannels();
    this._colorChannelsNeedFullApply = false;
    this._applyLegacyGroupPulses(colorManager);
    if (!channelIds.length) return;
    for (const chId of channelIds) {
      const sprites = this._colorChannelSprites[chId];
      if (!sprites || !sprites.length) continue;
      const channel = parseInt(chId, 10);
      for (const spr of sprites) {
        if (!spr || !spr.active) continue;
        if (spr._cantColor) continue;
        if (spr._eePulsed) continue;
        if (spr._eeAudioScale) continue;
        if (spr._isSaw && spr._SawColor !== undefined) {
          const sawColor = colorManager.getColor(spr._SawColor);
          const transformedSawColor = spr._eeHSV && typeof transformGdHSVColor === "function"
            ? transformGdHSVColor(sawColor, spr._eeHSV)
            : sawColor;
          const sawHex = (transformedSawColor.r << 16) | (transformedSawColor.g << 8) | transformedSawColor.b;
          spr.setTint(sawHex);
          continue;
        }
        if (spr._isSaw) continue;
        if (spr._isBlack && !spr._canColor) continue;
        if (spr._blackDefault && typeof colorManager.hasColor === "function" && !colorManager.hasColor(chId)) continue;
        if (typeof spr.setTint === "function") {
          const baseColor = colorManager.getColor(channel);
          const transformedColor = spr._eeHSV && typeof transformGdHSVColor === "function"
            ? transformGdHSVColor(baseColor, spr._eeHSV)
            : baseColor;
          spr.setTint((transformedColor.r << 16) | (transformedColor.g << 8) | transformedColor.b);
        }
      }
    }
  }
  resetEnterEffectTriggers() {
    this._enterEffectTriggerIdx = 0;
    this.enterState?.reset();
    if (this.gdRenderer) {
      this.gdRenderer.enterMap.fill(-2);
      this.gdRenderer.exitMap.fill(-2);
    }
    this._activeEnterEffect = 0;
    this._activeExitEffect = 0;
    for (let _0x17a21d = 0; _0x17a21d < this._sections.length; _0x17a21d++) {
      this._setSectionVisible(_0x17a21d, true);
      const _0x14a035 = this._sections[_0x17a21d];
      if (_0x14a035) {
        for (let _0x13e116 = 0; _0x13e116 < _0x14a035.length; _0x13e116++) {
          const visMinSection = _0x14a035[_0x13e116];
          visMinSection._eeActive = false;
          const showtheportalthing = !visMinSection._eePortalGuide || (!window.isEditor && window.enablePortalGuide !== false);
          const showtheorbthing = !visMinSection._eeOrbGuide || (!window.isEditor && window.enableOrbGuide !== false);
          visMinSection.visible = showtheportalthing && showtheorbthing && !visMinSection._eeHidden && !(window.enableLDM && visMinSection._eeHighDetail);
          visMinSection.x = visMinSection._eeWorldX;
          visMinSection.y = visMinSection._eeBaseY;
          if (!visMinSection._eeAudioScale) setSpriteObjectScale(visMinSection);
          visMinSection.setAlpha(this._getGroupOpacityForSprite(visMinSection));
        }
      }
    }
  }
  _getGroupOpacityForSprite(spr) {
    const groups = spr && spr._eeGroups;
    let op = 1;
    if (groups && groups.length) {
      for (const gid of groups) {
        if (this._groupEnabled[gid] === false) return 0;
        const g = this._groupOpacity[gid];
        if (g !== undefined && g < op) op = g;
      }
    }
    if (spr && spr._eeIsGlowSprite) {
      op *= this._getGlowAlphaMultiplier();
    }
    return op;
  }

  applyEnterEffects(_0x2f36ed) {
    const _0x221c93 = 400;
    const _0xa24372 = 140;
    const _0x5e9f2a = 200;
    const _0x29a51b = _0x2f36ed;
    const _0x548004 = _0x2f36ed + screenWidth;
    const _0x49c6d8 = _0x2f36ed + screenWidth / 2;
    const _0x2d8f53 = Math.max(0, Math.floor((_0x29a51b - _0xa24372) / _0x221c93));
    const _0x2b19db = Math.min(this._sections.length - 1, Math.floor((_0x548004 + _0xa24372) / _0x221c93));
    for (let _0x1bd44f = _0x2d8f53; _0x1bd44f <= _0x2b19db; _0x1bd44f++) {
      const _0x2cff29 = this._sections[_0x1bd44f];
      if (!_0x2cff29) {
        continue;
      }
      const _0x20a3bb = _0x1bd44f * _0x221c93;
      const _0x8f9d56 = _0x20a3bb >= _0x29a51b + _0xa24372 && _0x20a3bb + _0x221c93 <= _0x548004 - _0xa24372;
      for (let _0x54aba7 = 0; _0x54aba7 < _0x2cff29.length; _0x54aba7++) {
        const effectSprite = _0x2cff29[_0x54aba7];
        if (effectSprite._eeNoEffects || effectSprite._eeDontEnter) {
          effectSprite._eeActive = false;
          effectSprite.x = effectSprite._eeWorldX;
          effectSprite.y = effectSprite._eeBaseY;
          if (!effectSprite._eeAudioScale) setSpriteObjectScale(effectSprite);
          effectSprite.setAlpha(this._getGroupOpacityForSprite(effectSprite));
          continue;
        }
        if (_0x8f9d56) {
          if (effectSprite._eeActive) {
            effectSprite._eeActive = false;
            effectSprite.y = effectSprite._eeBaseY;
            effectSprite.x = effectSprite._eeWorldX;
            if (!effectSprite._eeAudioScale) setSpriteObjectScale(effectSprite);
            effectSprite.setAlpha(this._getGroupOpacityForSprite(effectSprite));
          }
          continue;
        }
        const _0xeded99 = effectSprite._eeWorldX;
        const _0x1b2883 = _0xeded99 > _0x49c6d8;
        let _0x289aa2;
        _0x289aa2 = _0x1b2883 ? Math.max(0, Math.min(1, (_0x548004 - _0xeded99) / _0xa24372)) : Math.max(0, Math.min(1, (_0xeded99 - _0x29a51b) / _0xa24372));
        if (_0x289aa2 >= 1) {
          if (effectSprite._eeActive) {
            effectSprite._eeActive = false;
            effectSprite.y = effectSprite._eeBaseY;
            effectSprite.x = effectSprite._eeWorldX;
            if (!effectSprite._eeAudioScale) setSpriteObjectScale(effectSprite);
            effectSprite.setAlpha(this._getGroupOpacityForSprite(effectSprite));
          }
          continue;
        }
        effectSprite._eeActive = true;
        const _0x453353 = _0x1b2883 ? this._activeEnterEffect : this._activeExitEffect;
        const _0x20804e = 1 - _0x289aa2;
        let _0x50e6d9 = effectSprite._eeBaseY;
        let _0x17437c = effectSprite._eeWorldX;
        let _0x2128bf = _0x289aa2;
        let _0x127ace = 1;
        switch (_0x453353) {
          case 0:
            break;
          case 1:
            _0x50e6d9 = effectSprite._eeBaseY + _0x5e9f2a * _0x20804e;
            break;
          case 2:
            _0x50e6d9 = effectSprite._eeBaseY - _0x5e9f2a * _0x20804e;
            break;
          case 3:
            _0x17437c = effectSprite._eeWorldX - _0x5e9f2a * _0x20804e;
            break;
          case 4:
            _0x17437c = effectSprite._eeWorldX + _0x5e9f2a * _0x20804e;
            break;
          case 5:
            if (!effectSprite._eeAudioScale) {
              _0x127ace = _0x289aa2;
            }
            break;
          case 6:
            if (!effectSprite._eeAudioScale) {
              _0x127ace = 1 + _0x20804e * 0.75;
            }
        }
        if (effectSprite.x !== _0x17437c) {
          effectSprite.x = _0x17437c;
        }
        if (effectSprite.y !== _0x50e6d9) {
          effectSprite.y = _0x50e6d9;
        }
        const _eeFinalAlpha = (effectSprite._eeDontFade ? 1 : _0x2128bf) * this._getGroupOpacityForSprite(effectSprite);
        if (effectSprite.alpha !== _eeFinalAlpha) {
          effectSprite.alpha = _eeFinalAlpha;
        }
        if (!effectSprite._eeAudioScale) setSpriteObjectScale(effectSprite, _0x127ace);
      }
    }
  }
  setGroundColor(_0x3958eb) {
    if (window.isEditor) return; // not dealing with ts rn
    for (let _0x46c21a of this._groundTiles) {
      _0x46c21a.setTint(_0x3958eb);
    }
    for (let _0x251562 of this._ceilingTiles) {
      _0x251562.setTint(_0x3958eb);
    }
  }
  // GJBaseGameLayer::updateColor, channel 1002: the floor/ceiling line takes
  // the colour and GJGroundLayer::updateLineBlend uses additive blending while
  // the channel blends (so a black blending line is invisible, as in GD).
  setLineColor(hex, blending) {
    if (window.isEditor) return;
    const mode = blending ? S : E;
    for (const line of [this._groundLine, this._ceilingLine]) {
      if (!line) continue;
      if (line._gdLineHex !== hex) { line.setTint(hex); line._gdLineHex = hex; }
      if (line._gdLineBlend !== mode) { line.setBlendMode(mode); line._gdLineBlend = mode; }
    }
  }
  setGround2Color(_0x3958eb) {
    if (window.isEditor) return; // not dealing with ts rn
    this._ground2Tint = _0x3958eb;
    for (let _0x46c21a of this._ground2Tiles || []) {
      _0x46c21a.setTint(_0x3958eb);
    }
    for (let _0x251562 of this._ceiling2Tiles || []) {
      _0x251562.setTint(_0x3958eb);
    }
  }
  updateAudioScale(_0x337bf7, cameraX = -Infinity, viewportWidth = Infinity) {
    const _meterValue = Number.isFinite(Number(_0x337bf7)) ? Number(_0x337bf7) : 0;
    if (this.gdRenderer) this.gdRenderer.audioScale = _meterValue;
    const _maxaudioScale = 1.5; //added this cuz god DAMN whe the game lags they get big.
    const _targetAudioScale = Math.min(_maxaudioScale, Math.max(0, _meterValue));
    const _hasFiniteViewport = Number.isFinite(cameraX) && Number.isFinite(viewportWidth);
    const _minVisibleX = _hasFiniteViewport ? cameraX - 200 : -Infinity;
    const _maxVisibleX = _hasFiniteViewport ? cameraX + viewportWidth + 200 : Infinity;
    for (let _0x24afdb of this._audioScaleSprites) {
      if (!_0x24afdb || !_0x24afdb.active) continue;
      const _worldX = _0x24afdb._eeWorldX;
      if (Number.isFinite(_worldX) && (_worldX < _minVisibleX || _worldX > _maxVisibleX)) continue;
      if (_0x24afdb._eeLastAudioScale !== _targetAudioScale) {
        _0x24afdb.setScale(_targetAudioScale);
        _0x24afdb._eeLastAudioScale = _targetAudioScale;
      }
    }
    const _now = Date.now();
    const _clickMult = window.orbClickScale || 1.0;
    const _shrinkMs = window.orbClickShrinkTime || 250;
    for (let _0xOrbSpr of this._orbSprites) {
      if (!_0xOrbSpr || !_0xOrbSpr.active) continue;
      const _worldX = _0xOrbSpr._eeWorldX;
      if (Number.isFinite(_worldX) && (_worldX < _minVisibleX || _worldX > _maxVisibleX)) continue;
      const _orbRestScale = Number.isFinite(_0xOrbSpr._eeOrbBaseScale) ? _0xOrbSpr._eeOrbBaseScale : 0.75;
      const _baseScale = Math.min(_maxaudioScale * Math.max(1, _orbRestScale), _orbRestScale * (1 + _meterValue * 0.2));
      let _targetScale = _baseScale;
      if (_0xOrbSpr._hitTime) {
        const _elapsed = _now - _0xOrbSpr._hitTime;
        if (_elapsed < 80) {
          const _t = _elapsed / 80;
          _targetScale = _baseScale + (_baseScale * (_clickMult - 1)) * _t;
        } else if (_elapsed < 80 + _shrinkMs) {
          const _t = (_elapsed - 80) / _shrinkMs;
          const _peak = _baseScale * _clickMult;
          _targetScale = _peak + (_baseScale - _peak) * _t;
        } else {
          _0xOrbSpr._hitTime = null;
        }
      }
      if (_0xOrbSpr._eeLastOrbScale !== _targetScale) {
        const restScale = Math.max(0.0001, _orbRestScale);
        const multiplier = _targetScale / restScale;
        const restScaleX = Number.isFinite(Number(_0xOrbSpr._eeOrbBaseScaleX))
          ? Number(_0xOrbSpr._eeOrbBaseScaleX) : _orbRestScale;
        const restScaleY = Number.isFinite(Number(_0xOrbSpr._eeOrbBaseScaleY))
          ? Number(_0xOrbSpr._eeOrbBaseScaleY) : _orbRestScale;
        _0xOrbSpr.setScale(restScaleX * multiplier, restScaleY * multiplier);
        _0xOrbSpr._eeLastOrbScale = _targetScale;
      }
    }
  }
  resetVisibility() {
    this._visMinSec = -1;
    this._visMaxSec = -1;
  }
  _setRodframe(attemptNumber = 1) {
    const frames = ["rod_ball_01_001.png", "rod_ball_02_001.png", "rod_ball_03_001.png"];
    const frameName = frames[Math.floor(Math.random() * frames.length)];
    this.gdRenderer?.setRodFrame(frameName);

    for (const spriteList of this.objectSprites || []) {
      if (!Array.isArray(spriteList)) continue;
      for (const sprite of spriteList) {
        if (!sprite || !sprite._rodballchild || sprite._Rodobjectid === undefined) continue;
        const frameInfo = typeof getAtlasFrame === "function" ? getAtlasFrame(this._scene, frameName) : null;
        if (frameInfo) {
          sprite.setTexture(frameInfo.atlas, frameInfo.frame);
        } else if (this._scene?.textures?.exists?.(frameName)) {
          sprite.setTexture(frameName);
        } else {
          continue;
        }
        sprite._rodcurrentframe = frameName;
      }
    }
  }
  captureRuntimeState(colorManager = this._scene?._colorManager) {
    const keys = ["_groupOffsets", "_groupOpacity", "_groupEnabled", "_itemCounts", "_collectedPickups", "_countWatchers", "_gameplayChannel", "_channelCursors", "_channelDirections",
      "_spawnActivated", "_touchAdditional", "_activeMoveTweens", "_activeFollowTweens", "_followPlayerHistory", "_followPlayerClock", "_followPlayerSample", "_followPlayerHead", "_activeScaleTweens", "_activeAlphaTweens", "_activeRotateTweens",
      "_activeSpawnDelays", "_activeEnterEffect", "_activeExitEffect", "_gdRandSeed", "_camLockLast", "_camLockLastPlayerX", "_spawnClock", "_spawnStepOf", "_spawnLoopCount", "_spawnLoopHalted"];
    for (const key of Object.keys(this)) if (/TriggerIdx$|^_touch.*Activated$/.test(key)) keys.push(key);
    const properties = Object.fromEntries(keys.map(key => [key, this[key]]));
    const pulses = this._activePulses.map(({ manager, ...pulse }) => pulse);
    const data = structuredClone({ properties, pulses, colors: colorManager ? { ...colorManager } : null,
      renderer: this.gdRenderer?.captureRuntimeState(false), shader: this.shaderState?.capture(), gradient: this.gradientState?.capture(), area: this.areaState?.capture(), enter: this.enterState?.capture(), advFollow: this.advFollowState?.capture(), camera: this.cameraState?.capture(), gameplay: this.gameplayState?.capture(), keyframe: this.keyframeState?.capture(), logic: this.logicState?.capture(), animationClock: window._animTimer || 0,
      beastAnimationClock: this._beastAnimationClock || 0,
      beasts: this._beastAnimations?.map(beast => ({ clip: beast.clip, startTime: beast.startTime || 0, transition: beast.transition, randomState: beast.randomState })) });
    const pick = (object, fields) => Object.fromEntries(fields.filter(key => object[key] !== undefined).map(key => [key, object[key]]));
    const sprites = [...new Set(Object.values(this._groupSprites).flat())].filter(spr => spr?.active)
      .map(spr => [spr, pick(spr, ["x", "y", "rotation", "scaleX", "scaleY", "_eeWorldX", "_eeBaseY", "_origWorldX", "_origBaseY",
        "_eeMoveBaseWorldX", "_eeMoveBaseBaseY", "_eeSawPivotX", "_eeSawPivotY", "_eeSawGroupRotation"])]);
    // The level's collider list is already unique. Expanding every group
    // duplicates heavily grouped artwork before Set removes it again.
    const colliders = this.objects.filter(col => col._eeGroups?.length)
      .map(col => [col, pick(col, ["x", "y", "rotationDegrees", "orbRotation", "_baseX", "_baseY", "_baseRotationDegrees",
        "_origBaseX", "_origBaseY", "_origRotationDegrees", "_eeMoveBaseX", "_eeMoveBaseY", "_eeDisabled",
        "hypoAx", "hypoAy", "hypoBx", "hypoBy", "rightAx", "rightAy", "slopeRotation", "w", "h", "shape", "circleMatrix", "_circleBaseRadius", "hitbox_radius",
        "_gdMotionFrame", "_gdPreviousX", "_gdPreviousY"])]);
    return { data, sprites, colliders, removedObjects: Object.values(this._resetremovedobject) };
  }

  restoreRuntimeState(snapshot, colorManager = this._scene?._colorManager) {
    if (!snapshot?.data) return;
    // Clone again: dying twice at one checkpoint must restore the same state.
    const data = structuredClone(snapshot.data);
    Object.assign(this, data.properties);
    this._channelLists.clear();
    this._triggerGateMap = null;
    for (const levelObj of snapshot.removedObjects || []) {
      if (this._resetobject[levelObj._eeObjectId]) this._breakblock(levelObj._eeObjectId);
    }
    if (data.colors && colorManager) colorManager.restoreRuntimeState(data.colors);
    this._activePulses = data.pulses.map(pulse => ({ ...pulse, manager: colorManager }));
    if (data.renderer) this.gdRenderer?.restoreRuntimeState(data.renderer);
    for (const obj of this.gdRenderer?.objects || []) if (window.GD_OBJECTS?.[obj.id]?.t === 30) obj.enabled = !this._collectedPickups.has(obj.linkedId);
    this._refreshCounterLabels();
    if (data.shader) this.shaderState?.restore(data.shader);
    if (data.gradient) this.gradientState?.restore(data.gradient);
    if (data.area) this.areaState?.restore(data.area);
    this.enterState?.restore(data.enter);
    if (data.advFollow) this.advFollowState?.restore(data.advFollow);
    if (data.camera) this.cameraState?.restore(data.camera);
    if (data.gameplay) this.gameplayState?.restore(data.gameplay);
    this.keyframeState?.restore(data.keyframe);
    if (data.logic) this.logicState?.restore(data.logic);
    for (const [spr, state] of snapshot.sprites) {
      if (!spr?.active) continue;
      Object.assign(spr, state);
      this._refreshSpriteSection(spr);
    }
    const liveColliders = new Set(this.objects);
    let collidersByObject;
    for (const [savedCol, state] of snapshot.colliders) {
      if (!liveColliders.has(savedCol) && !collidersByObject)
        collidersByObject = new Map(this.objects.map(col => [col._eeLevelObject, col]));
      const col = liveColliders.has(savedCol) ? savedCol : collidersByObject.get(savedCol._eeLevelObject);
      if (!col) continue;
      // Cleared, not deleted: delete turns the collider into a slow
      // dictionary-mode object for every later physics tick.
      col._gdMotionFrame = undefined; col._gdPreviousX = undefined; col._gdPreviousY = undefined;
      Object.assign(col, state);
      if (col._initialSlopeGeometry) col.rotateSlope(0);
      this._refreshCollisionSection(col);
    }
    window._animTimer = data.animationClock;
    for (let i = 0; i < (data.beasts?.length || 0); i++) {
      const beast = this._beastAnimations[i], saved = data.beasts[i];
      if (!beast) continue;
      const frames = _getBeastDescriptor(this._scene, beast.cacheKey)?.[saved.clip];
      if (!frames?.length) continue;
      this._setBeastClip(beast, saved.clip, saved.startTime);
      beast.transition = saved.transition; beast.randomState = saved.randomState;
    }
    this.applyColorChannels(colorManager, true);
    this.updateBeastAnimations(data.beastAnimationClock ?? data.animationClock);
  }

  resetObjects() {
    this._resetremovedobjects();
    this.gdRenderer?.reset();
    this.shaderState?.reset();
    this.gradientState?.reset();
    this.keyframeState?.reset();
    this.areaState?.reset();
    this.enterState?.reset();
    this.advFollowState?.reset();
    this.cameraState?.reset();
    this.gameplayState?.reset();
    this.logicState?.reset();
    this._logicTriggerIdx = 0;
    this._gameplayTriggerIdx = 0;
    this._shaderTriggerIdx = 0;
    this._gradientTriggerIdx = 0;
    this._cameraTriggerIdx = 0;
    this._areaTriggerIdx = 0;
    this._advFollowTriggerIdx = 0;
    this._gameplayChannel = 0;
    this._channelCursors = {};
    this._channelDirections = structuredClone(this._initialChannelDirections);
    this._channelLists.clear();
    this._triggerGateMap = null;
    this._scaleTriggerIdx = 0;
    this._activeScaleTweens = [];
    for (const spr of new Set(Object.values(this._groupSprites).flat())) {
      if (spr._eeInitialScaleX !== undefined) spr.scaleX = spr._eeInitialScaleX;
      if (spr._eeInitialScaleY !== undefined) spr.scaleY = spr._eeInitialScaleY;
    }
    for (let _0x3d473e of this.objects) {
      if (!_0x3d473e) {
        continue;
      }
      _0x3d473e._gdMotionFrame = undefined; _0x3d473e._gdPreviousX = undefined; _0x3d473e._gdPreviousY = undefined;
      if (_0x3d473e._eeInitialWidth !== undefined) {
        _0x3d473e.w = _0x3d473e._eeInitialWidth;
        _0x3d473e.h = _0x3d473e._eeInitialHeight;
        if (_0x3d473e._eeInitialRadius !== undefined) _0x3d473e.hitbox_radius = _0x3d473e._eeInitialRadius;
        _0x3d473e.shape = undefined; _0x3d473e.circleMatrix = undefined; _0x3d473e._circleBaseRadius = undefined;
        if (_0x3d473e._eeInitialShape) _0x3d473e.shape = _0x3d473e._eeInitialShape;
        if (_0x3d473e._eeInitialCircleMatrix) _0x3d473e.circleMatrix = _0x3d473e._eeInitialCircleMatrix;
        if (_0x3d473e._initialSlopeGeometry) { Object.assign(_0x3d473e, _0x3d473e._initialSlopeGeometry); _0x3d473e.rotateSlope(0); }
      }
      _0x3d473e.activated = false;
      if (_0x3d473e._activatedByPlayer) {
        _0x3d473e._activatedByPlayer = undefined;
      }
      if (_0x3d473e._dashHoldTicks !== undefined) {
        _0x3d473e._dashHoldTicks = 0;
      }
      if (_0x3d473e._dashHoldTicksByPlayer) {
        _0x3d473e._dashHoldTicksByPlayer = undefined;
      }
      if (_0x3d473e.secretCoinId !== undefined) {
        _0x3d473e.activated = false;
      }
      if (_0x3d473e.userCoinId !== undefined) {
        _0x3d473e.activated = false;
      }
      if (_0x3d473e._padParticleEmitter) {
        if (typeof _0x3d473e._padParticleEmitter.start === "function") {
          _0x3d473e._padParticleEmitter.start();
        }
      }
    }
    this._secretCoinRunCollected.clear();
    this._userCoinRunCollected.clear();
    for (let _0x5c5d9a of this._audioScaleSprites) {
      _0x5c5d9a.setScale(0.1);
    }
        for (const objectSpriteList of this.objectSprites || []) {
      if (!objectSpriteList) continue;
      for (const sprite of objectSpriteList) {
        if (sprite && sprite._isPortalGuide && sprite._portalOriginalFrame) {
          const originalFrameInfo = getAtlasFrame(this._scene, sprite._portalOriginalFrame);
          if (originalFrameInfo) {
            sprite.setTexture(originalFrameInfo.atlas, originalFrameInfo.frame);
          }
          sprite._portalGuideActive = false;
        }
      }
    }
    for (let _cs of this._coinSprites) {
      if (_cs) {
        this._scene?.tweens?.killTweensOf(_cs);
        _cs.setVisible(true);
        _cs.setAlpha(1);
        _cs.setScale(_cs._coinBaseScale || 1);
        if (_cs._coinWorldY !== undefined) {
          _cs.y = b(_cs._coinWorldY);
        }
      }
    }
  }
}
