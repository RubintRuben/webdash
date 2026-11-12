// Geometry Dash 2.2081 object renderer.
//
// The original game keeps every GameObject (a CCSprite with child sprites) in
// a CCSpriteBatchNode chosen by GJBaseGameLayer::parentForZLayer from the
// object's z layer, whether its colour channel blends, and which sprite
// sheet it uses. Within one batch node the sprites are drawn by z order and
// then by the order in which they were added. This file reproduces that
// structure with a single WebGL vertex stream, so the draw order, blending
// and colouring follow the native game instead of a per-section container.
//
// Object data (sprite trees, default colours, layers, flags) is generated from
// the native code in assets/scripts/game/gd-objects.js.
(function () {
  "use strict";

  const GD_FLAGS = {};
  (window.GD_OBJECT_FLAGS || []).forEach((name, index) => { GD_FLAGS[name] = 2 ** index; });
  const hasFlag = (def, name) => !!def && GD_FLAGS[name] !== undefined && Math.floor((def.fl || 0) / GD_FLAGS[name]) % 2 === 1;
  const savedScale = value => Number.isFinite(Number(value)) && Number(value) !== 0 ? Number(value) : 1;

  // CCSpriteBatchNode z order inside GJBaseGameLayer::m_objectLayer
  // (GJBaseGameLayer::setupLayers). "B" = the blending variant.
  const LAYER_Z = {
    B5: { game: -1220, gameB: -1240, fire: -1320, fireB: -1340, game2: -1360, game2B: -1380, pixel: -1400, pixelB: -1420, particle: -1430, particleB: -1432, glow: -1480 },
    B4: { game: -920, gameB: -940, fire: -1020, fireB: -1040, game2: -1060, game2B: -1080, pixel: -1100, pixelB: -1120, particle: -1130, particleB: -1132, glow: -1180 },
    B3: { game: -620, gameB: -640, fire: -720, fireB: -740, game2: -760, game2B: -780, pixel: -800, pixelB: -820, particle: -830, particleB: -832, glow: -880 },
    B2: { game: -320, gameB: -340, fire: -420, fireB: -440, game2: -460, game2B: -480, pixel: -500, pixelB: -520, particle: -530, particleB: -532, glow: -580 },
    B1: { game: -20, gameB: -40, fire: -120, fireB: -140, game2: -160, game2B: -180, pixel: -200, pixelB: -220, particle: -224, particleB: -226, glow: -280 },
    B0: { game2: -5, gameB: -10, fireB: -110, game2B: -150, pixelB: -190, particleB: -195 },
    T1: { game: 360, gameB: 340, fire: 260, fireB: 240, game2: 220, game2B: 200, pixel: 180, pixelB: 160, particle: 154, particleB: 150, glow: 120 },
    T2: { game: 660, gameB: 640, fire: 560, fireB: 540, game2: 520, game2B: 500, pixel: 480, pixelB: 460, particle: 454, particleB: 450, glow: 410 },
    T3: { game: 960, gameB: 940, fire: 860, fireB: 840, game2: 820, game2B: 800, pixel: 780, pixelB: 760, particle: 754, particleB: 750, glow: 710 },
    T4: { game: 1340, gameB: 1320, fire: 1220, fireB: 1200, game2: 1160, game2B: 1140, pixel: 1100, pixelB: 1080, particle: 1070, particleB: 1066, glow: 1010 },
    T5: { gameB: 1360, fireB: 1240, game2B: 1180, pixelB: 1120, particleB: 1074 }
  };
  const PLAYER_Z = 59;

  const BATCHES = [];
  const BATCH_INDEX = {};
  for (const layer of Object.keys(LAYER_Z)) {
    for (const kind of Object.keys(LAYER_Z[layer])) {
      BATCHES.push({ key: layer + ":" + kind, z: LAYER_Z[layer][kind], blend: kind === "glow" || kind.endsWith("B") });
    }
  }
  // BG/MG gradients are siblings of the native background/middleground,
  // outside m_objectLayer. Their parent-local orders (-54/-14) cannot be
  // mixed with the batch orders inside m_objectLayer: that would cover B5
  // through B1 artwork. getGradientLayerZLayer (32b460) maps both to -1600;
  // stable batch order keeps BG before MG when flattening the hierarchy.
  const GRADIENT_Z = [0, -1600, -1600, -1201, -901, -601, -301, 38, 61, 399, 699, 999, 1399, 46, 56, 1400];
  for (let i = 0; i < GRADIENT_Z.length; i++) BATCHES.push({ key: "gradient:" + i, z: GRADIENT_Z[i], blend: false });
  BATCHES.sort((a, b) => a.z - b.z);
  BATCHES.forEach((batch, index) => { BATCH_INDEX[batch.key] = index; batch.index = index; });
  const FIRST_ABOVE_PLAYER = BATCHES.findIndex(batch => batch.z >= PLAYER_Z);
  const CELL = 100, CLASS_REACH = [40, 120, 400], LAZY_DRIFT = 50, PS_BIN = 256;
  // Dense table layouts (see GDRenderer._buildTables).
  const OS_STRIDE = 36, OD_STRIDE = 12, PT_STRIDE = 30;
  const OF_DETAIL = 1, OF_IGNOREFADE = 2, OF_DONTFADE = 4, OF_NOAUDIO = 8, OF_RING = 16, OF_FAST = 32, OF_AUDIO = 256,
    OF_CUSTOMAUDIO = 512, OF_CUSTOMGLOW = 1024, OF_GLOWLBG = 2048, OF_CANTGLOW = 4096, OF_BLACK = 8192,
    OF_CSBLACK = 16384, OF_ZLAYERREL = 32768, OF_CUSTOMSPRITE = 65536;
  const DF_DRAWABLE = 1, DF_HIGHDETAIL = 2, DF_EFFECT = 4, DF_RING = 8, DF_UI = 16;
  // Above player, screen-space, outside the world shader; bit 7 marks GD
  // UI coordinates (bits 4..6 are already the gradient blend mode).
  const UI_DRAW_FLAGS = 2 | 4 | 8 | 128;
  const cellKey = (x, y) => (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(y / CELL) + 32768);
  // Flags _prepareObject reads for every object every frame, resolved once
  // per definition.
  const PREPARE_FLAGS = ["isInvisibleBlock", "intrinsicDontFade", "isSolidColorBlock", "usesAudioScale", "customAudioScale",
    "customGlowColor", "glowColorIsLBG", "cantColorGlow", "isObjectBlack", "isColorSpriteBlack", "colorZLayerRelated", "customSpriteColor"];
  const prepareFlags = def => {
    if (def._prepareFlags) return def._prepareFlags;
    const flags = {};
    for (const name of PREPARE_FLAGS) flags[name] = hasFlag(def, name);
    Object.defineProperty(def, "_prepareFlags", { value: flags, enumerable: false });
    return flags;
  };

  const KIND_FOR_PARENT_MODE = { 0: "game", 1: "game2", 2: "game", 3: "fire", 4: "game", 6: "pixel", 8: "particle" };
  const KIND_INDEX = { game: 0, game2: 1, fire: 2, pixel: 3, particle: 4, glow: 5 };
  const KINDS = ["game", "game2", "fire", "pixel", "particle", "glow"];

  // GJBaseGameLayer::parentForZLayer
  function layerFor(zl, blend, kind) {
    if (kind === "glow") {
      return zl <= -5 ? "B5" : zl <= -3 ? "B4" : zl <= -1 ? "B3" : zl <= 1 ? "B2" : zl <= 4 ? "B1" : zl <= 5 ? "T1" : zl <= 7 ? "T2" : zl <= 9 ? "T3" : "T4";
    }
    if (zl <= -5) return "B5";
    if (zl <= -3) return "B4";
    if (zl <= -1) return "B3";
    if (zl <= 1) return "B2";
    if (zl <= 3) return "B1";
    if (zl <= 4) return (blend || kind === "game2") ? "B0" : "T1";
    if (zl <= 5) return "T1";
    if (zl <= 7) return "T2";
    if (zl <= 9) return "T3";
    if (zl <= 11 || !blend) return "T4";
    return "T5";
  }
  function batchFor(zl, blend, kind) {
    if (kind === "glow") return BATCH_INDEX[layerFor(zl, false, "glow") + ":glow"];
    const layer = layerFor(zl, blend, kind);
    const key = layer + ":" + kind + (blend ? "B" : "");
    if (BATCH_INDEX[key] !== undefined) return BATCH_INDEX[key];
    const fallback = layer + ":game" + (blend ? "B" : "");
    if (BATCH_INDEX[fallback] !== undefined) return BATCH_INDEX[fallback];
    return BATCH_INDEX[(blend ? "T1:gameB" : "T1:game")];
  }

  // ---------------------------------------------------------------- frames
  const ATLAS_PRIORITY = [
    "GJ_GameSheet", "GJ_GameSheet02", "GJ_GameSheetGlow", "FireSheet_01-hd", "PixelSheet_01-hd",
    "GJ_ParticleSheet-uhd", "GJ_GameSheet03", "GJ_GameSheet04", "GJ_GameSheetEditor", "Wavesheet", "GJ_WebSheet"
  ];
  // Pixel sizes of the GD -hd sheets are 2 px per point; a few auxiliary
  // atlases were exported at a different scale.
  // The "GJ_ParticleSheet-uhd" key holds the -hd sheet imported from the game
  // (tools/import-gd-atlases.js), like the other GJ sheets: 2 px per point.
  const ATLAS_SCALE = { "PixelSheet_01-hd": 0.5 };

  class FrameCache {
    constructor(scene) {
      this.scene = scene;
      this.map = new Map();
      this.textures = [];
      this.textureIndex = new Map();
    }
    textureSlot(key) {
      if (this.textureIndex.has(key)) return this.textureIndex.get(key);
      const slot = this.textures.length;
      this.textures.push(key);
      this.textureIndex.set(key, slot);
      return slot;
    }
    get(name) {
      if (!name) return null;
      let info = this.map.get(name);
      if (info !== undefined) return info;
      info = null;
      const textures = this.scene.textures;
      for (const key of ATLAS_PRIORITY) {
        if (!textures.exists(key)) continue;
        const texture = textures.get(key);
        if (!texture.has(name)) continue;
        const frame = texture.get(name);
        const scale = (ATLAS_SCALE[key] || 1) / 2; // atlas px -> GD points
        const sss = frame.data?.spriteSourceSize || { x: 0, y: 0, w: frame.cutWidth, h: frame.cutHeight };
        const srcW = frame.realWidth || frame.cutWidth;
        const srcH = frame.realHeight || frame.cutHeight;
        info = {
          key,
          slot: this.textureSlot(key),
          u0: frame.u0, v0: frame.v0, u1: frame.u1, v1: frame.v1,
          // trimmed quad size and position inside the untrimmed content box,
          // in GD points, with the y axis pointing up (cocos2d convention)
          w: frame.cutWidth * scale,
          h: frame.cutHeight * scale,
          cw: srcW * scale,
          ch: srcH * scale,
          ox: (sss.x || 0) * scale,
          oy: (srcH - (sss.y || 0) - frame.cutHeight) * scale
        };
        break;
      }
      this.map.set(name, info);
      return info;
    }
  }

  // One shape for every part, frame info and draw item: the per-frame loops
  // read them by the thousand, and differing shapes make those reads slow.
  function makeInfo(src) {
    return { key: src.key, slot: src.slot, u0: src.u0, v0: src.v0, u1: src.u1, v1: src.v1,
      w: src.w, h: src.h, cw: src.cw ?? src.w, ch: src.ch ?? src.h, ox: src.ox || 0, oy: src.oy || 0 };
  }
  function makePart(src) {
    return { info: src.info, qx: src.qx || 0, qy: src.qy || 0, flipX: !!src.flipX, flipY: !!src.flipY,
      vertexMods: src.vertexMods || null, portalGuide: !!src.portalGuide, upright: !!src.upright,
      matrix: src.matrix || [1, 0, 0, 1, 0, 0], rotLocal: src.rotLocal || null, role: src.role ?? 3,
      detail: !!src.detail, tag: src.tag || 0, fixedColor: src.fixedColor || [255, 255, 255],
      fixedOpacity: src.fixedOpacity ?? 1, opacityModifyRGB: src.opacityModifyRGB !== false };
  }
  function makeItem(part) {
    return { part, m: [0, 0, 0, 0, 0, 0], color: null, opacity: 0, sortKey: 0, batch: 0,
      positions: null, colors: null, above: null, screen: false, gradientBlend: -1, overlay: false };
  }

  // ------------------------------------------------------------- matrices
  // Affine [a, b, c, d, tx, ty]: x' = a*x + c*y + tx, y' = b*x + d*y + ty.
  function nodeToParent(px, py, rotX, rotY, sx, sy, ax, ay) {
    const rx = -rotX * Math.PI / 180;
    const ry = -rotY * Math.PI / 180;
    const cx = Math.cos(rx), sxn = Math.sin(rx);
    const cy = Math.cos(ry), syn = Math.sin(ry);
    const a = cy * sx, b = syn * sx, c = -sxn * sy, d = cx * sy;
    return [a, b, c, d, px - (a * ax + c * ay), py - (b * ax + d * ay)];
  }
  function mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
    ];
  }
  function mulInto(m, n, out) {
    out[0] = m[0] * n[0] + m[2] * n[1]; out[1] = m[1] * n[0] + m[3] * n[1];
    out[2] = m[0] * n[2] + m[2] * n[3]; out[3] = m[1] * n[2] + m[3] * n[3];
    out[4] = m[0] * n[4] + m[2] * n[5] + m[4]; out[5] = m[1] * n[4] + m[3] * n[5] + m[5];
  }

  // ------------------------------------------------------------- objects
  const ROLE_MAIN = 0, ROLE_DETAIL = 1, ROLE_CHILD = 2, ROLE_FIXED = 3, ROLE_GLOW = 4;

  // Compile a GD sprite tree into an ordered list of drawable parts whose
  // matrices are relative to the object's own origin (before the object's
  // position/rotation/scale is applied).
  function compileTree(frames, node, parentMatrix, out, ctx, depth, inDetail, parentIsRoot, parentSpins) {
    if (!node) return;
    const [frame, px, py, ax, ay, sx, sy, rotX, z, tag, flags, opacity, color, rotY, children] = node;
    const info = frames.get(frame);
    const cw = info ? info.cw : 0;
    const ch = info ? info.ch : 0;
    const isRoot = depth === 0;
    if (isRoot && (flags & 4)) ctx.mainChildFrame = frame;
    const local = nodeToParent(isRoot ? 0 : px, isRoot ? 0 : py, isRoot ? 0 : rotX, isRoot ? 0 : (rotY ?? rotX),
      sx, sy, ax * cw, ay * ch);
    const matrix = parentMatrix ? mul(parentMatrix, local) : local;
    const isColorSprite = (flags & 16) !== 0;
    const detail = inDetail || isColorSprite;
    let role;
    if (ctx.glow) role = ROLE_GLOW;
    else if (isRoot || (parentIsRoot && frame === ctx.mainChildFrame)) role = ROLE_MAIN;
    else if (isColorSprite || inDetail) role = ROLE_DETAIL;
    else if (parentIsRoot) role = ROLE_CHILD;
    else role = ROLE_FIXED;
    const ordered = (children || []).map((c, i) => ({ c, i })).sort((p, q) => (p.c[8] - q.c[8]) || (p.i - q.i));
    const childrenSpin = isRoot || isColorSprite;
    for (const { c } of ordered) if (c[8] < 0) compileTree(frames, c, matrix, out, ctx, depth + 1, detail, isRoot, childrenSpin);
    const hidden = (flags & 4) !== 0 || (flags & 8) !== 0;
    if (info && !hidden) {
      out.push({
        info,
        // node-local quad, cocos CCSprite::setTextureRect with flips
        qx: (flags & 1) ? cw - info.ox - info.w : info.ox,
        qy: (flags & 2) ? ch - info.oy - info.h : info.oy,
        flipX: (flags & 1) !== 0,
        flipY: (flags & 2) !== 0,
        vertexMods: node.vertexMods || null,
        portalGuide: !!node.portalGuide,
        upright: !!node.upright,
        matrix,
        // pieces that a rotate action spins: the direct children of the
        // object/colour sprite/glow, rotated around their own anchor
        rotLocal: (!isRoot && parentSpins) ? { px, py, ax: ax * cw, ay: ay * ch, sx, sy, baseRotX: rotX, baseRotY: rotY ?? rotX, parentMatrix } : null,
        role,
        detail,
        tag,
        fixedColor: [(color >> 16) & 255, (color >> 8) & 255, color & 255],
        fixedOpacity: opacity / 255
      });
    }
    for (const { c } of ordered) if (c[8] >= 0) compileTree(frames, c, matrix, out, ctx, depth + 1, detail, isRoot, childrenSpin);
  }

  function walkTree(node, visit) {
    visit(node);
    for (const child of node[14] || []) walkTree(child, visit);
  }

  // GJBaseGameLayer::addPortalHelpers (installed build 3501e0): these
  // sprites are added after the constructor capture. The second symbol is
  // counter-rotated by the layer, while its position follows the portal.
  function completePortalTree(frames, tree, def, legacy, id) {
    const root = frames.get(tree[0]);
    if (!root || !legacy?.children?.some(c => c.portalGuide)) return;
    const front = /^portal_\d+_front_001\.png$/.test(def.f || "");
    const offset = [10, 11, 2926].includes(Number(id)) ? 19 : 17;
    for (const child of legacy.children.filter(c => c.portalGuide)) {
      if (!frames.get(child.frame)) continue;
      const symbol = child.frame.includes("_extra_2_");
      const x = front ? offset - (symbol ? ([10, 11, 2926].includes(Number(id)) ? 1.5 : 2) : 0) : 0;
      // addPortalHelpers runs with the trimmed sprite size, before the
      // GameObject restores its original content size. E.g. spider front:
      // 33.5/2+17=33.75, while its final content width is 44.5 points.
      const node = [child.frame, root.w / 2 + x, root.h / 2, 0.5, 0.5,
        1, 1, 0, symbol ? 101 : 100, symbol ? 0 : 91, 0, 255, 0xffffff, null, []];
      node.portalGuide = true; node.upright = symbol || !front;
      (tree[14] ||= []).push(node);
    }
  }

  // setupCustomSprites uses CCSprite::setTl/TrVertexMod for these slopes.
  // The constructor capture omits those fields (and the hidden colour
  // container). Values below are from the supplied Steam executable, RVA
  // 2b87c9..2b96ab; libcocos2d::updateTransform also clips the UVs vertically.
  function completeSlopeTree(frames, tree, id) {
    const simple = {
      1769: [1, 0], 1770: [0, 1], 1771: [0, 1], 1772: [1, 0],
      1777: [0, 0.95], 1778: [0.85, 0], 1779: [1, -0.15], 1780: [0.05, 1],
      1781: [0, 1], 1782: [1, 0], 1783: [1, 0], 1784: [0, 1],
      1793: [1, 0], 1795: [1, 0], 1799: [1, 0], 1801: [1, 0],
      1803: [0, 1], 1805: [0, 1], 1807: [0, 1], 1809: [0, 1]
    };
    if (simple[id]) {
      tree.vertexMods = simple[id].map(Math.fround).concat(0, 0);
      for (const child of tree[14] || []) if (child[10] & 16) {
        child.vertexMods = [...tree.vertexMods];
        if (id === 1807) child.vertexMods[0] = Math.fround(0.1);
      }
      return;
    }
    const pairs = {
      1773: [[1, 0.5], [0.5, 0]], 1774: [[1, 0.5], [0.5, 0]],
      1775: [[0, 0.5], [0.5, 1]], 1776: [[0, 0.5], [0.5, 1]],
      1785: [[0.9, 0.45], [0.45, 0]], 1786: [[1, 0.5], [0.6, 0.1]],
      1787: [[0.05, 0.5], [0.5, 0.9]], 1788: [[0, 0.4], [0.5, 1]],
      1789: [[1, 0.5], [0.5, 0]], 1790: [[1, 0.5], [0.5, 0]],
      1791: [[0, 0.5], [0.5, 1]], 1792: [[0, 0.5], [0.5, 1]],
      1794: [[1, 0.5], [0.5, 0]], 1796: [[1, 0.5], [0.5, 0]],
      1800: [[1, 0.5], [0.5, 0]], 1802: [[1, 0.5], [0.5, 0]],
      1804: [[0, 0.5], [0.5, 1]], 1806: [[0, 0.5], [0.5, 1]],
      1808: [[0, 0.5], [0.6, 1]], 1810: [[0, 0.5], [0.5, 1]],
      2052: [[1, 0.5], [0.5, 0]]
    };
    const pair = pairs[id];
    if (!pair) return;
    const children = tree[14].filter(n => !(n[10] & 16));
    if (children.length !== 2) return;
    children.forEach((child, i) => { child.vertexMods = pair[i].map(Math.fround).concat(0, 0); });
    if (id >= 1773 && id <= 1776 || id >= 1785 && id <= 1788) return;
    const colorRoot = structuredClone(tree);
    colorRoot[1] = frames.get(tree[0]).cw / 2;
    colorRoot[2] = frames.get(tree[0]).ch / 2;
    colorRoot[8] = 100;
    colorRoot[10] = 4 | 16;
    colorRoot[14] = [];
    for (let i = 0; i < children.length; i++) {
      // These variants deliberately omit the left colour piece.
      if ([1790, 1796, 2052].includes(id) && i === 0) continue;
      const child = structuredClone(children[i]);
      const frame = child[0].replace(/_(\d+)\.png$/, "_color_$1.png");
      if (!frames.get(frame)) continue;
      child[0] = frame; child[8] = -1;
      if ([1789, 1794].includes(id) && i === 1) child.vertexMods[1] = Math.fround(0.1);
      if ([1790, 1796, 2052].includes(id) && i === 1) child.vertexMods[1] = Math.fround(0.2);
      if ([1791, 1792].includes(id) && i === 0) child.vertexMods[0] = Math.fround(0.1);
      if (id === 1792 && i === 1) child.vertexMods[0] = Math.fround(0.77);
      if (id === 1808 && i === 1) child.vertexMods[0] = Math.fround(0.8);
      colorRoot[14].push(child);
    }
    tree[14] = children.concat([colorRoot]);
  }

  // addColorSprite/setupAnimation execute after createWithKey. Some constructor
  // captures have dc set but no colour node. Reconstruct it from the separate
  // native visual capture, retaining its layer, local position and rotation.
  function completeSpriteTree(frames, def, legacy) {
    const tree = structuredClone(def.n);
    if (!tree[0] && def.f && !/^edit_/.test(def.f) && frames.get(def.f)) tree[0] = def.f;
    let hasDetail = false;
    walkTree(tree, node => { hasDetail ||= !!(node[10] & 16); });
    if (!(def.dc >= 0) || hasDetail) return tree;
    const root = frames.get(tree[0]);
    if (!root) return tree;
    let overlays = (legacy?.children || []).filter(c => c.tint === 52224 && frames.get(c.frame));
    if (!overlays.length) {
      const main = tree[0] || "";
      const candidates = [main.replace(/_(\d+)\.png$/, "_color_$1.png"),
        main.replace(/_looped_(\d+)\.png$/, "_2_looped_$1.png"),
        main.replace(/_(\d+)\.png$/, "_2_$1.png")];
      const frame = candidates.find(f => f !== main && frames.get(f));
      if (frame) {
        // Several animated families have no debug tint in the legacy
        // capture, but retain the native colour sprite's order and pose.
        // Its -100 layer belongs behind the main animation (Dash's burst
        // and torches); putting it at +100 paints over the bright centre.
        const captured = legacy?.children?.find(child => child.frame === frame);
        overlays = [{ ...captured, frame, z: captured?.z ?? 100 }];
      }
    }
    for (const overlay of overlays) {
      // If setupCustomSprites already attached it, assign its channel in place.
      let existing = null;
      walkTree(tree, node => { if (node !== tree && node[0] === overlay.frame && node[7] === (overlay.rot || 0)) existing ||= node; });
      if (existing) { existing[10] |= 16; continue; }
      // The fire-sheet EnhancedGameObject colour animation is half resolution.
      // Native setupAnimation nests its frame player at scale 2 (e.g.
      // Fire_01_2_looped and fire_b_02_2). A flat scale-1 reconstruction
      // shrank the coloured flame inside the full-sized outer animation.
      // Pixel-sheet animations use full-resolution colour frames; doubling
      // those makes Dash's candle flame and its pixels twice their native size.
      const scale = (Number(overlay.scale) > 0 ? Number(overlay.scale) : 1) * (def.t === 7 && def.ct === 4 && def.pm === 3 ? 2 : 1);
      // localDx/Dy in allObjects are web world units (2 per GD point).
      (tree[14] ||= []).unshift([overlay.frame, root.cw / 2 + (overlay.localDx || 0) / 2,
        root.ch / 2 - (overlay.localDy || 0) / 2, 0.5, 0.5, scale, scale,
        overlay.rot || 0, overlay.z ?? 100, overlay.rot || 0, 16, 255, 0xffffff, null, []]);
    }
    return tree;
  }

  function parseGroups(levelObj) {
    const ids = [];
    const add = raw => String(raw ?? "").split(".").forEach(v => { const n = parseInt(v, 10); if (n > 0) ids.push(n); });
    add(levelObj?._raw?.[33]);
    add(levelObj?._raw?.[57]);
    add(levelObj?.groups);
    return [...new Set(ids)];
  }

  const LEGACY_COLOR = { 1: 1005, 2: 1006, 3: 1, 4: 2, 5: 1007, 6: 3, 7: 4, 8: 1003 };

  class GDObj {
    constructor(levelObj, def, index) {
      // Hot fields first: V8 lays fields out in declaration order, and the
      // culling, transform and preparation loops read these for thousands of
      // scattered objects per frame, so keeping them in adjacent cache lines
      // matters. (Values are assigned properly below.)
      this.index = index; this.x = 0; this.y = 0; this.offX = 0; this.offY = 0;
      this._enabled = true; this._hidden = false; this._removed = false; this._enterType = -1; this._exitType = -1;
      this._ringHitTime = undefined; this._renderer = null;
      this.radius = 0; this._affineRadiusScale = 1; this._rank = 0; this._class = undefined; this._cell = undefined;
      this._cellIdx = 0; this.groups = null; this._accRefs = null; this._snap = null; this._snapEpoch = -1;
      this._indexDirty = false;
      this._keyframeOuterAffine = null; this.affine = null; this.enabled = true; this.hidden = false; this.removed = false; this.highDetail = false;
      this.particleSystem = undefined; this._px = 0; this._py = 0; this.zOrder = 0; this.arrival = index;
      this.parts = undefined; this.glowParts = undefined; this.animation = undefined; this._F = null;
      this.baseID = 0; this.detailID = -1; this.zLayer = 0; this.kind = "game"; this.hasDetail = false;
      this.rot = 0; this.rotOff = 0; this.rotationX = 0; this.rotationY = 0; this.scaleX = 1; this.scaleY = 1;
      this.flipX = false; this.flipY = false; this.extraScaleX = 1; this.extraScaleY = 1;
      this.enterType = -1; this.exitType = -1; this.enterChannel = 0; this.fadeMargin = 0;
      this.ignoreFade = false; this.ignoreEnter = false; this.rotSpeed = 0;
      this._rotationMatrix = null; this._matrixRotX = 0; this._matrixRotY = 0; this._objectMatrix = null;
      this._main = null; this._detail = null; this._items = null; this._glowItems = null;
      this.baseHSV = null; this.detailHSV = null; this._hsvMain = null; this._hsvDetail = null;
      this.ringHitTime = undefined; this.noAudioScale = false; this.isRing = false;
      this._bco = 0; this._om = 1;
      this._cacheable = undefined; this._emitted = null; this._affVer = 0; this._cEpoch = -1; this._cPx = 0; this._cPy = 0;
      this._cAff = -1; this._cOp = -1; this._cVb = 0; this._cVd = 0; this._cVg = 0;
      // Assigned conditionally below or by the level: declared here so every
      // object keeps one hidden class (five made the hot loops megamorphic).
      this.baseColorSet = 0; this.detailColorSet = 0; this.linkedId = undefined;
      const raw = levelObj._raw || {};
      this.levelObj = levelObj;
      this.def = def;
      this.index = index;
      this.arrival = index;
      this.id = levelObj.id;
      this.x = levelObj.x;
      this.y = levelObj.y;
      this.rot = Number(levelObj.rot) || 0;
      // GameObject::getSaveString writes either 6 (equal angles), or the two
      // independent cocos rotation axes 131/132. These are absolute angles.
      this.rotationX = Number(levelObj.rotationX ?? raw[131] ?? this.rot) || 0;
      this.rotationY = Number(levelObj.rotationY ?? raw[132] ?? this.rot) || 0;
      const uniform = savedScale(levelObj.scale);
      this.scaleX = uniform * savedScale(levelObj.scaleX);
      this.scaleY = uniform * savedScale(levelObj.scaleY);
      this.flipX = !!levelObj.flipX;
      this.flipY = !!levelObj.flipY;
      this.zLayer = Number(levelObj.zLayer) || def.zl || 0;
      this.zOrder = Number(levelObj.zOrder) || def.zo || 0;
      this.kind = KIND_FOR_PARENT_MODE[def.pm] || "game";
      // GameObject::objectFromVector colour ids
      const clampId = v => (v > 1101 ? 1101 : v);
      this.baseID = def.bc || 0;
      this.detailID = def.dc >= 0 ? def.dc : -1;
      const legacy = parseInt(raw[19] ?? "0", 10);
      if (legacy > 0 && LEGACY_COLOR[legacy]) {
        if (this.detailID >= 0) this.detailColorSet = LEGACY_COLOR[legacy];
        else this.baseColorSet = LEGACY_COLOR[legacy];
      } else {
        const c1 = parseInt(raw[21] ?? "0", 10);
        if (c1 > 0) this.baseColorSet = clampId(c1);
        const c2 = parseInt(raw[22] ?? "0", 10);
        if (c2 > 0 && this.detailID >= 0) this.detailColorSet = clampId(c2);
      }
      if (this.baseColorSet) this.baseID = this.baseColorSet;
      if (this.detailColorSet) this.detailID = this.detailColorSet;
      this.baseHSV = raw[41] === "1" && raw[43] ? parseGdHSV(raw[43]) : null;
      this.detailHSV = raw[42] === "1" && raw[44] ? parseGdHSV(raw[44]) : null;
      if (this.baseHSV && gdIsDefaultHSV(this.baseHSV)) this.baseHSV = null;
      if (this.detailHSV && gdIsDefaultHSV(this.detailHSV)) this.detailHSV = null;
      this.groups = parseGroups(levelObj);
      this.hidden = raw[135] === "1";
      this.noGlow = raw[96] === "1" || hasFlag(def, "hasNoGlow");
      this.ignoreFade = raw[64] === "1" || hasFlag(def, "ignoreFade");
      this.ignoreEnter = raw[67] === "1" || hasFlag(def, "ignoreEnter");
      this.highDetail = raw[103] === "1";
      this.enterChannel = Math.max(0, Math.min(100, parseInt(raw[343] ?? "0", 10) || 0));
      this.noAudioScale = raw[372] === "1";
      this.isRing = window.GD_OBJECT_VISUALS?.[this.id]?.type === "ring";
      // runtime
      this.offX = 0; this.offY = 0; this.rotOff = 0;
      this.extraScaleX = 1; this.extraScaleY = 1;
      this.affine = [1, 0, 0, 1];
      this.enabled = true;
      this.enterType = -1; this.exitType = -1; this.enterAngle = 0; this.enterFlag = false;
      this.rotSpeed = 0;
      this.transformVersion = 0;
      // Every field the renderer assigns later, declared here so all objects
      // share one hidden class (megamorphic property access was the largest
      // single cost of the per-frame loops in big levels).
      // (undefined where code tests for an absent field)
      this.parts = undefined; this.hasDetail = false; this.glowParts = undefined; this.rotatingParts = false;
      this.animation = undefined; this.animationOffset = 0; this.animationSpeed = 1; this.animationInterval = 0.1;
      this.singleFrame = 0; this.offsetAnimation = false; this.animateOnTrigger = false;
      this.animationTriggered = false; this.animationStart = 0;
      this.particleSystem = undefined; this.ambientParticleSystem = undefined;
      this.radius = 0; this.fadeMargin = 0; this.removed = false;
      this.companion = undefined; this.companionOf = undefined; this.teleportExit = undefined;
      this.isText = false; this.textFont = undefined; this.labelText = undefined; this.labelPending = undefined;
      this.ringHitTime = undefined;
      this._class = undefined; this._cell = undefined; this._cellIdx = 0; this._wide = false;
      this._radiusAffine = null; this._affineRadiusScale = 1; this._rank = 0;
      this._snap = null; this._snapEpoch = -1; this._accRefs = null;
      this._main = null; this._detail = null; this._lighter = null;
      this._items = null; this._glowItems = null; this._frameItems = null;
      this._rotationMatrix = null; this._matrixRotX = 0; this._matrixRotY = 0; this._objectMatrix = null;
      this._eeGroupIdsSource = null; this._eeGroupIdsLength = 0; this._eeGroupIds = null;
      this._px = 0; this._py = 0; this._hsvMain = null; this._hsvDetail = null;
      this._F = null; this._bco = def.bco > 0 ? def.bco : 0; this._om = def.om || 1;
    }
  }

  // State the renderer's dense tables mirror: assigning it (from anywhere)
  // updates the object's OD flags.
  for (const name of ["enabled", "hidden", "removed", "enterType", "exitType", "ringHitTime"]) {
    const field = "_" + name;
    Object.defineProperty(GDObj.prototype, name, {
      get() { return this[field]; },
      set(value) { if (this[field] !== value) { this[field] = value; if (this._renderer) this._renderer._odFlags(this); } },
      configurable: true
    });
  }

  // ---------------------------------------------------------------- shader
  const VS = `
    attribute vec2 aPos; attribute vec2 aUV; attribute float aTex; attribute vec4 aCol;
    uniform vec2 uRes; uniform mat3 uView;
    varying vec2 vUV; varying float vTex; varying vec4 vCol;
    void main() {
      vUV = aUV; vTex = aTex; vCol = aCol;
      vec2 pos = (uView * vec3(aPos, 1.0)).xy;
      gl_Position = vec4(pos.x / uRes.x * 2.0 - 1.0, 1.0 - pos.y / uRes.y * 2.0, 0.0, 1.0);
    }`;
  const FS = `
    precision mediump float;
    varying vec2 vUV; varying float vTex; varying vec4 vCol;
    uniform sampler2D uT0, uT1, uT2, uT3, uT4, uT5, uT6, uT7;
    void main() {
      vec4 t;
      if (vTex < 0.5) t = texture2D(uT0, vUV);
      else if (vTex < 1.5) t = texture2D(uT1, vUV);
      else if (vTex < 2.5) t = texture2D(uT2, vUV);
      else if (vTex < 3.5) t = texture2D(uT3, vUV);
      else if (vTex < 4.5) t = texture2D(uT4, vUV);
      else if (vTex < 5.5) t = texture2D(uT5, vUV);
      else if (vTex < 6.5) t = texture2D(uT6, vUV);
      else t = texture2D(uT7, vUV);
      gl_FragColor = t * vCol;
    }`;

  const QUADS_PER_DRAW = 16384; // 16-bit indices; larger scenes use several draws.
  const FLOATS_PER_VERTEX = 6;

  class GDRenderer {
    constructor(scene) {
      this.scene = scene;
      this.frames = new FrameCache(scene);
      this.objects = [];
      this.collisionBlocks = new Map();
      this.collisionBlockGroups = new Map();
      this.grids = [new Map(), new Map(), new Map()];
      this.wideObjects = new Set();
      this._byRank = [];
      this._pendingIndices = [];
      this._tablesReady = false;
      this._fastMain = [255, 255, 255]; this._fastDetail = [255, 255, 255];
      this._fastLighter = [255, 255, 255]; this._fastFixed = [255, 255, 255];
      this.legacyPrepare = false;
      this._rankBuf = new Uint32Array(0);
      this._ranksDirty = true;
      this._batchCache = new Map();
      this._accX = new Float64Array(1024); this._accY = new Float64Array(1024);
      this._syncX = new Float64Array(1024); this._syncY = new Float64Array(1024);
      this._dirty = new Uint8Array(1024);
      this._snapX = null; this._snapY = null;
      this._dirtyGroups = new Set();
      this._moveVersion = 1;
      this._overlaps = new Map();
      this._channels = [];
      this._channelStamp = 0;

      this.groups = new Map();
      this.uiObjects = new Set();
      // Group id -> parent object (GJBaseGameLayer m_parentGroupsDict front).
      this.parents = new Map();
      this.membershipVersion = 0;
      this.particleSystems = [];
      this.spawnedParticleSystems = [];
      this.pickupEffects = []; this.pickupRandom = new Map();
      // Keyframe translations read the frame other group commands built
      // (_keyframeOuterAffine). A level without keyframe nodes (the level
      // sets this after loading) does not keep it for every rotated object.
      this.keyframeFrames = true;
      // Sleeping emitters by X bin, and the awake ones (indices into
      // particleSystems, in order). See _particleList.
      this._psBins = new Map(); this._psOn = null; this._psCount = 0; this._psWoken = []; this._psFrame = 0;
      this.animationCache = new Map();
      this.spriteTreeCache = new Map();
      this.partsCache = new Map();
      this.glowPartsCache = new Map();
      this.localBoundsCache = new Map();
      this.sectionSize = 100;
      this.enterMap = new Array(101).fill(-2);
      this.exitMap = new Array(101).fill(-2);
      this.linkedVisibilityGroups = new Set();
      this.camera = { x: 0, y: 0, w: 569, h: 320, shakeX: 0, shakeY: 0 };
      this.colorManager = null;
      this.groupState = null;
      this.time = 0;
      this.audioScale = 0.1;
      this.buckets = BATCHES.map(() => []);
      this._qb = new Array(BATCHES.length).fill(null);
      this.debugItems = !!GDRenderer.debugItems;
      this.ranges = [];
      this.quadCount = 0;
      this.spriteAnimations = [];
      this.enabled = true;
      this._gl = null;
      this._ready = false;
      this._tmp3 = [0, 0, 0];
      this._tmpPosition = { x: 0, y: 0 };
    }

    // ------------------------------------------------------------- objects
    addObject(levelObj, explicitDef = null) {
      const defs = window.GD_OBJECTS || {};
      const def = explicitDef || defs[levelObj.id];
      if (!def || !def.n) return null;
      const obj = new GDObj(levelObj, def, this.objects.length);
      obj.pickupBob = def.t === 30 && obj.id !== 1614 && levelObj._raw?.[116] !== '1';
      obj._renderer = this;
      // Invisible helpers can still be the centre of a rotate/move trigger.
      obj.hidden ||= hasFlag(def, "isInvisible") || !!levelObj._gdInvisible;
      let parts = this.partsCache.get(def);
      const legacy = !explicitDef ? window.GD_OBJECT_VISUALS?.[levelObj.id] : null;
      let tree = this.spriteTreeCache.get(def);
      if (!tree) {
        tree = completeSpriteTree(this.frames, def, legacy);
        if (!explicitDef) {
          completeSlopeTree(this.frames, tree, levelObj.id);
          completePortalTree(this.frames, tree, def, legacy, levelObj.id);
        }
        this.spriteTreeCache.set(def, tree);
      }
      if (!parts) {
        parts = [];
        compileTree(this.frames, tree, null, parts, { glow: false }, 0, false, false);
        this.partsCache.set(def, parts);
      }
      obj.parts = parts;
      obj.hasDetail = parts.some(p => p.detail);
      const sequence = /^(.*)_(\d+)\.png$/.exec(def.f || "");
      if (sequence && (def.e?.ca || legacy?.animFrames?.length)) {
        let animation = this.animationCache.get(def);
        if (!animation) {
          animation = [];
          let track = legacy?.animFrames?.map(f => !def.f.includes("_color_") ? f.replace("_color_", "_") : f);
          if (!track?.length) {
            track = [];
            for (let i = 1; i <= 999; i++) {
              const frame = sequence[1] + "_" + String(i).padStart(3, "0") + ".png";
              if (!this.frames.get(frame)) break;
              track.push(frame);
            }
          }
          // Some native captures record the colour sprite's animation track
          // (Fire_01_2_looped), while def.f names the outer sprite. Keep both
          // families and advance their suffix together in that case.
          const firstFamily = track[0]?.replace(/_\d+\.png$/, "");
          let childTrack = false;
          walkTree(tree, node => {
            if (node !== tree && node[0]?.replace(/_\d+\.png$/, "") === firstFamily && firstFamily !== sequence[1]) childTrack = true;
          });
          for (const frame of track) {
            if (!this.frames.get(frame)) continue;
            const suffix = /_(\d+)\.png$/.exec(frame)[1];
            const family = childTrack ? sequence[1] : /^(.*)_\d+\.png$/.exec(frame)[1];
            const rootFrame = family + "_" + suffix + ".png";
            const frameDef = { ...def, f: rootFrame, n: structuredClone(def.n) };
            const fixedRoot = !!(def.n[10] & 4) && !!def.n[14]?.length;
            if (!fixedRoot) frameDef.n[0] = rootFrame;
            const frameTree = completeSpriteTree(this.frames, frameDef, legacy);
            walkTree(frameTree, node => {
              if (!node[0] || (fixedRoot && node === frameTree)) return;
              const name = node[0].startsWith(sequence[1] + "_") ? family + node[0].slice(sequence[1].length) : node[0];
              const next = name.replace(/_\d+\.png$/, "_" + suffix + ".png");
              if (this.frames.get(next)) node[0] = next;
            });
            const frameParts = [];
            compileTree(this.frames, frameTree, null, frameParts, { glow: false }, 0, false, false);
            animation.push(frameParts);
          }
          this.animationCache.set(def, animation);
        }
        if (animation.length) {
          obj.animation = animation;
          const randomStart = levelObj._raw?.[106] !== undefined ? levelObj._raw[106] === "1" : !!def.e?.rs;
          obj.animationOffset = randomStart ? Math.floor(Math.random() * animation.length) : 0;
          obj.animationSpeed = levelObj._raw?.[122] === "1" ? Number(levelObj._raw?.[107] ?? 1) : 1;
          obj.animationInterval = (legacy?.animInterval || 100) / 1000;
          obj.singleFrame = Math.max(0, Number(levelObj._raw?.[462]) || 0);
          obj.offsetAnimation = levelObj._raw?.[592] === "1";
          obj.animateOnTrigger = levelObj._raw?.[123] === "1";
          obj.animationTriggered = false;
          obj.animationStart = 0;
          obj.parts = animation[0];
          obj.hasDetail = obj.parts.some(p => p.detail);
        }
      }
      // Particle emitters use the secondary channel as their end colour even
      // though their editor placeholder has no drawable detail sprite.
      if (!obj.hasDetail && obj.id !== 2065) obj.detailID = -1;
      obj.glowParts = [];
      if (def.g && !obj.noGlow) {
        let glow = this.glowPartsCache.get(def);
        if (!glow) {
          glow = [];
          compileTree(this.frames, def.g, null, glow, { glow: true }, 0, false, false);
          this.glowPartsCache.set(def, glow);
        }
        obj.glowParts = glow;
      }
      obj.rotatingParts = parts.some(p => p.rotLocal) || obj.glowParts.some(p => p.rotLocal);
      if (def.e && def.e.ra && obj.rotatingParts && levelObj._raw?.[98] !== "1") {
        const dir = Math.random() > 0.5 ? 1 : -1;
        // EnhancedGameObject::createRotateAction: nonzero property 97 is an
        // absolute angular speed; zero retains the object's random direction.
        obj.rotSpeed = Number(levelObj._raw?.[97]) || def.e.ra * dir;
      }
      // Sprite geometry is shared by all instances of a definition.
      const r = Math.max(this._localRadius(obj.animation || parts, !!obj.animation), this._localRadius(obj.glowParts));
      obj.radius = r * Math.max(Math.abs(obj.scaleX), Math.abs(obj.scaleY)) + 2;
      if (levelObj.id === 2065 && window.GDParticleSystem && levelObj._raw?.[145]) {
        obj.particleSystem = new window.GDParticleSystem(this, obj, levelObj._raw[145]);
        this.particleSystems.push(obj.particleSystem);
      }
      if (window.GDParticleSystem && window.cocosParticlePreset && levelObj._raw?.[507] !== "1" && levelObj._raw?.[116] !== "1") {
        // GameObject::customSetup (28eb0c..28ed45) gives every pad the
        // original bumpEffect system. Sharing the object transform also
        // keeps its particles in the world camera and its authored groups.
        const isPad = [8, 9, 10, 34, 44].includes(def.t);
        const preset = obj.isRing ? "ringEffect" : isPad ? "bumpEffect" :
          def.t === 30 && obj.id !== 1614 ? "keyEffect" : [1582, 1583].includes(Number(obj.id)) ? "fireballEffect" : null;
        const data = preset && window.cocosParticlePreset(preset);
        if (data) {
          // GameObject::customSetup overrides the plist's colours per ring
          // type. Values checked against the supplied exe's float vectors.
          const colours = {
            9: [[255, 0, 255], [255, 0, 255]], 10: [[0, 255, 255], [0, 255, 255]],
            34: [[255, 50, 50], [255, 0, 0]], 44: [[255, 0, 255], [100, 25, 255]],
            11: [[255, 200, 50], [255, 100, 25]], 12: [[255, 100, 255], [255, 0, 175]],
            13: [[0, 255, 255], [0, 125, 255]], 35: [[255, 100, 25], [255, 0, 0]],
            37: [[0, 255, 0], [0, 0, 0]], 38: [[255, 0, 0], [0, 0, 0]],
            43: [[255, 0, 255], [100, 0, 255]]
          }[def.t];
          if (colours) for (const [i, key] of ["R", "G", "B"].entries()) {
            data["StartColor" + key] = colours[0][i] / 255;
            data["EndColor" + key] = colours[1][i] / 255;
          }
          if (obj.isRing) data.StartColorA = data.EndColorA = 1;
          // Teleport Ring customSetup (28f37a..28f3b6) removes radial
          // acceleration and orbiting. Its squares contract in straight rays.
          if (Number(obj.id) === 3027) data.RadialAccel = data.RadialAccelVar = data.RotatePerSecond = data.RotatePerSecondVar = 0;
          const system = new window.GDParticleSystem(this, obj, data);
          // commonInteractiveSetup (Steam 293f60..293f9d).
          if (preset === 'keyEffect') { system.offsetY = -5; data.PositionType = 2; system.data.PositionType = 2; }
          system.ambient = true;
          system.useObjectColor = hasFlag(def, "particleUseObjectColor");
          if (system.useObjectColor) { data.StartColorA = 1; data.EndColorA = 0; system.data = data; }
          obj.ambientParticleSystem = system;
          this.particleSystems.push(system);
        }
        if (/^portal_\d+_front_001\.png$/.test(def.f || '')) {
          // GameObject::customSetup 28f858..290545. The old Phaser emitter
          // used guessed hues, sizes and straight lines for every portal.
          const type = def.t;
          const preset = ({ 4: '01', 3: '02', 6: '03', 5: '04', 15: '01',
            17: '08', 18: '09', 23: '09', 24: '09' })[type] || '02';
          const data = window.cocosParticlePreset('portalEffect' + preset);
          if (data) {
            const colors = {
              14: [[255,150,0],[255,150,0]], 16: [[255,255,0],[255,100,0]],
              19: [[255,200,0],[255,100,0]], 23: [[255,200,0],[255,100,0]],
              24: [[0,200,255],[0,100,255]], 26: [[0,200,255],[0,100,255]],
              27: [[150,150,150],[50,50,75]], 28: [[0,255,255],[0,100,150]],
              33: [[200,0,255],[200,0,255]], 41: [[255,255,0],[255,200,0]],
              42: [[0,255,0],[0,255,0]]
            }[type];
            if (colors) {
              for (const [i,key] of ['R','G','B'].entries()) {
                data['StartColor'+key] = colors[0][i]/255;
                data['EndColor'+key] = colors[1][i]/255;
              }
              data.StartColorA = data.EndColorA = 1;
            }
            if (type === 27) data.StartSize = 12;
            const system = new window.GDParticleSystem(this, obj, data);
            system.offsetX = -5; system.ambient = true;
            obj.ambientParticleSystem = system;
            this.particleSystems.push(system);
          }
        }
      }
      // GameObject::getObjectTextureRect fade margin
      const content = def.n && this.frames.get(def.n[0]);
      let w = (content ? content.cw : 30) * Math.abs(obj.scaleX);
      let h = (content ? content.ch : 30) * Math.abs(obj.scaleY);
      const rotNorm = ((obj.rot % 360) + 360) % 360;
      if (rotNorm % 90 === 0 && rotNorm % 180 !== 0) { const t = w; w = h; h = t; }
      else if (rotNorm % 180 !== 0) { w = Math.hypot(w, h); }
      obj.fadeMargin = w > 30 ? w * 0.5 - 15 : 0;
      this.objects.push(obj);
      if (obj.id === 1816) {
        const id = Number(levelObj._raw?.[80]) || 0;
        let blocks = this.collisionBlocks.get(id);
        if (!blocks) this.collisionBlocks.set(id, blocks = []);
        blocks.push(obj);
        for (const group of obj.groups) {
          let list = this.collisionBlockGroups.get(group);
          if (!list) this.collisionBlockGroups.set(group, list = []);
          list.push(obj);
        }
        obj._collisionBoxDirty = true;
        obj._initialCollisionBox = this.collisionBox(obj);
      }
      this._ranksDirty = true;
      this.membershipVersion++;
      for (const id of obj.groups) {
        if (!this.groups.has(id)) this.groups.set(id, []);
        this.groups.get(id).push(obj);
      }
      const parentOf = levelObj.groupParents;
      if (parentOf?.length) for (const id of parentOf) {
        if (!this.parents.has(id) || levelObj.groupParentsPrimary?.includes(id)) this.parents.set(id, obj);
      }
      this._indexObject(obj);
      if (!explicitDef) this._addCompanionObjects(levelObj, obj);
      return obj;
    }

    _localRadius(parts, animation = false) {
      if (!parts.length) return 0;
      if (this.localBoundsCache.has(parts)) return this.localBoundsCache.get(parts);
      let r = 0;
      for (const p of animation ? parts.flat() : parts) {
        const m = p.matrix;
        for (const x of [p.qx, p.qx + p.info.w]) for (const y of [p.qy, p.qy + p.info.h]) {
          r = Math.max(r, Math.hypot(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]));
        }
      }
      this.localBoundsCache.set(parts, r);
      return r;
    }

    addLabel(levelObj, text = "0", fontKey = "bigFont") {
      const def = { ...(window.GD_OBJECTS?.[levelObj.id] || {}), dc: -1,
        n: [null, 0, 0, 0.5, 0.5, 1, 1, 0, 0, 0, 4, 255, 0xffffff, null, []] };
      const obj = this.addObject(levelObj, def);
      obj.textFont = fontKey;
      this.setLabelText(obj, text);
      return obj;
    }

    // TextGameObject::updateTextObject: CCLabelBMFont::createBatched with the
    // level's font (gjFontNN, or bigFont), centred on the object; the letters
    // are the object's own sprites, so they take its scale, rotation, colour
    // channel and groups.
    addText(levelObj, text, fontKey = "bigFont") {
      const def = { ...(window.GD_OBJECTS?.[levelObj.id] || {}), dc: -1,
        n: [null, 0, 0, 0.5, 0.5, 1, 1, 0, 0, 0, 4, 255, 0xffffff, null, []] };
      const obj = this.addObject(levelObj, def);
      obj.textFont = fontKey;
      obj.isText = true;
      this.setLabelText(obj, text);
      return obj;
    }

    // A level font loaded after the objects were built.
    fontLoaded(fontKey) {
      for (const obj of this.objects) {
        if (obj.textFont !== fontKey || obj.labelPending === undefined) continue;
        const text = obj.labelPending; obj.labelPending = undefined; obj.labelText = undefined;
        this.setLabelText(obj, text);
      }
    }

    setLabelText(obj, text) {
      if (!obj || obj.labelText === String(text) && obj.labelPending === undefined) return;
      const font = this.scene.cache?.bitmapFont?.get(obj.textFont || "bigFont");
      if (!font) { obj.labelPending = String(text); obj.parts = []; return; }
      // Counters may update after the font enters the cache but before its
      // completion callback. The rendered value supersedes the old pending
      // text; replaying that stale text later also reset WHAT's counters.
      obj.labelPending = undefined;
      const raw = obj.levelObj._raw || {}, chars = font.data.chars;
      const kerning = Number(raw[488]) || 0;
      const height = font.data.lineHeight;
      const lines = obj.isText ? String(text).split(/\r?\n/) : [String(text)];
      const alignment = obj.isText ? 0 : Number(raw[391]) || 0;
      const anchor = alignment === 1 ? 0 : alignment === 2 ? 1 : 0.5;
      const top = lines.length * height * 0.5;
      const parts = [];
      let widest = 0;
      lines.forEach((line, row) => {
        const glyphs = []; let width = 0, previous = null;
        for (const char of line) {
          let code = char.codePointAt(0);
          // CCLabelBMFont::createFontChars in the supplied cocos DLL retries
          // missing a..z glyphs as A..Z. Several level fonts only ship caps.
          if (!chars[code] && code >= 97 && code <= 122) code -= 32;
          const glyph = chars[code];
          if (!glyph) continue;
          width += (glyph.kerning?.[previous] || 0);
          glyphs.push({ glyph, x: width });
          width += glyph.xAdvance + kerning; previous = code;
        }
        width = Math.max(0, width - kerning);
        widest = Math.max(widest, width);
        const lineTop = top - row * height;
        // The bundled fonts are the native -hd fonts: two texels per GD point.
        for (const { glyph: g, x } of glyphs) parts.push(makePart({
          info: makeInfo({ key: font.texture, slot: this.frames.textureSlot(font.texture),
            w: g.width / 2, h: g.height / 2, cw: g.width / 2, ch: g.height / 2,
            u0: g.u0, v0: g.v0, u1: g.u1, v1: g.v1 }),
          matrix: [1, 0, 0, 1, (x + g.xOffset - width * anchor) / 2,
            (lineTop - g.yOffset - g.height) / 2],
          role: ROLE_MAIN, detail: false, tag: 0, fixedOpacity: 1, fixedColor: [255, 255, 255]
        }));
      });
      obj.parts = parts;
      obj.labelText = String(text);
      obj._items = null; obj._emitted = null;
      obj.radius = Math.hypot(widest, top * 2) / 2 * Math.max(Math.abs(obj.scaleX), Math.abs(obj.scaleY)) + 2;
      this._indexObject(obj);
    }

    // PlayLayer::addObject creates a separate decoration (object id 38) for
    // the back half of every portal: z layer PortalBack (4), the front's z
    // order - 100, drawn from the GJ_GameSheet02 batch. The front itself is
    // moved to z order 12.
    _addCompanionObjects(levelObj, obj) {
      // PlayLayer::addObject (50ccc7) creates an independent pulse ball at
      // the top of every rod. It is absent from the constructor sprite tree.
      if ([15,16,17].includes(obj.id)) {
        const frame='rod_ball_01_001.png',rise={15:31,16:23.25,17:16.25}[obj.id];
        const theta=-(obj.rot || 0)*Math.PI/180,dy=rise*obj.scaleY*(obj.flipY?-1:1);
        const base=obj.baseID===1004?1005:obj.baseID;
        const ballDef={f:frame,t:7,zl:obj.zLayer,zo:obj.zOrder,bc:base,dc:-1,pm:0,ct:0,
          fl:GD_FLAGS.usesAudioScale,om:1,n:[frame,0,0,.5,.5,1,1,0,0,0,0,255,0xffffff,null,[]]};
        const placed={...levelObj,x:obj.x-Math.sin(theta)*dy,y:obj.y+Math.cos(theta)*dy,
          _raw:{...levelObj._raw,19:'0',21:'0',22:'0'}};
        const ball=this.addObject(placed,ballDef);
        if(ball) {ball._rodBall=true;ball._rodFrames=[];ball.companionOf=obj;}
        return;
      }
      const frame = obj.def.f || "";
      const m = /^portal_(\d+)_front_001\.png$/.exec(frame);
      if (!m) return;
      const backFrame = "portal_" + m[1] + "_back_001.png";
      if (!this.frames.get(backFrame)) return;
      const frontZ = Number(levelObj.zOrder) || obj.def.zo || 0;
      const backDef = {
        f: backFrame, t: 7, zl: 4, zo: frontZ - 100, bc: 0, dc: -1, pm: 1, ct: 0, fl: 0,
        n: [backFrame, 0, 0, 0.5, 0.5, 1, 1, 0, 0, 0, 0, 255, 0xffffff, null, []]
      };
      const backLevelObj = Object.assign({}, levelObj, { zLayer: 0, zOrder: 0, _raw: Object.assign({}, levelObj._raw || {}, { 21: "0", 22: "0", 19: "0", 41: "0", 42: "0" }) });
      const back = this.addObject(backLevelObj, backDef);
      if (back) {
        back.zLayer = 4;
        back.zOrder = frontZ - 100;
        back.companionOf = obj;
        obj.companion = back;
      }
      if (!(Number(levelObj.zOrder) > 0) && !(Number(levelObj.zOrder) < 0)) obj.zOrder = 12;
    }

    setRodFrame(frame) {
      const info=this.frames.get(frame);if(!info)return;
      for(const obj of this.objects) if(obj._rodBall) {
        let parts=obj._rodFrames[frame];
        if(!parts) {
          parts=[];const tree=[frame,0,0,.5,.5,1,1,0,0,0,0,255,0xffffff,null,[]];
          compileTree(this.frames,tree,null,parts,{glow:false},0,false,false);
          obj._rodFrames[frame]=parts;
        }
        obj.parts=parts;obj.radius=this._localRadius(parts);this._indexObject(obj);
      }
      this._ranksDirty=true;
    }

    finalize() {
      this.positionUIObjects();
      for (const grid of this.grids) grid.clear();
      this.wideObjects.clear();
      for (const obj of this.objects) { obj._class = undefined; obj._cell = undefined; obj._wide = false; this._indexObject(obj); }
      // Native CCSpriteBatchNode keeps creation order for equal Z. Spatial
      // activation/collision sections do not replace it (also with Dynamic
      // Level Height). Keep overlapping decoration stable within each batch.
      this._rankObjects();
    }

    // GJBaseGameLayer::positionUIObjects (Steam 32edb0). UI settings are
    // applied when the level is built, regardless of their X position or
    // trigger groups. Reparenting preserves the layout around the centre
    // group, using the native 480 x 320 reference canvas for edge anchors.
    // Subsequent group actions operate in the UI layer's local coordinates.
    positionUIObjects() {
      if (window.isEditor) return;
      const width = (typeof screenWidth !== "undefined" ? screenWidth : 1138) / 2;
      const height = (typeof screenHeight !== "undefined" ? screenHeight : 640) / 2;
      const anchor = (p, c, ref, relative, span, half, middle, low, high) => {
        if (!ref || ref === (middle === 2 ? 1 : 5)) ref = p >= c ? high : low;
        const scale = relative ? span / (half * 2) : 1;
        if (ref === middle) return span / 2 + (p - c) * scale;
        if (ref === low) return (p - (c - half)) * scale;
        if (ref === high) return span + (p - (c + half)) * scale;
        return p;
      };
      const add = (obj, x, y) => {
        if (obj.isUIObject || obj.removed) return;
        obj.isUIObject = true;
        // Reparenting does not remove the saved Hide flag. The virtual call
        // at 32ed06 is deactivateObject(true), not setVisible(true). Native
        // setup (29d9b9) keeps hidden sprites disabled when UI activates them.
        obj.x = x; obj.y = y;
        this.uiObjects.add(obj);
        this._odFlags(obj);
      };
      for (const settings of this.objects) {
        if (settings.id !== 3613 || settings.removed) continue;
        const raw = settings.levelObj._raw || {};
        const members = this.groups.get(Number(raw[51]));
        const centerGroup = Number(raw[71]);
        const centerMembers = (this.groups.get(centerGroup) || []).filter(o => !o.companionOf && !o.removed);
        const center = this.groupParent(centerGroup) || (centerMembers.length === 1 ? centerMembers[0] : null);
        if (!members?.length || !center) continue;
        const c = this.livePosition(center);
        const project = obj => {
          const p = this.livePosition(obj);
          return { x: anchor(p.x, c.x, Number(raw[385]) || 0, raw[387] === "1", width, 240, 2, 3, 4),
            y: anchor(p.y, c.y, Number(raw[386]) || 0, raw[388] === "1", height, 160, 6, 7, 8) };
        };
        const parent = this.groupParent(Number(raw[51]));
        if (parent) {
          if (parent.isUIObject) continue;
          const p = this.livePosition(parent), q = project(parent), dx = q.x - p.x, dy = q.y - p.y;
          for (const obj of members) add(obj, obj.x + dx, obj.y + dy);
        } else {
          for (const obj of members) {
            if (obj.isUIObject) continue;
            const p = project(obj);
            add(obj, p.x - obj.offX, p.y - obj.offY);
          }
        }
      }
    }

    // Draw order inside a batch is (z order, arrival). Objects are prepared
    // in that global order, so every batch receives its quads already
    // sorted. The rank also indexes the dense tables below.
    _rankObjects() {
      // Pending moves belong to the old tables: apply them first. Objects
      // that join afterwards start from the current cumulative values, so
      // they do not inherit earlier moves (GD moves current members).
      if (this._tablesReady && this._dirtyGroups.size) this.flushMoves();
      const order = this.objects.slice().sort((a, b) => (a.zOrder * 1048576 + a.arrival) - (b.zOrder * 1048576 + b.arrival));
      order.forEach((obj, rank) => { obj._rank = rank; });
      this._byRank = order;
      this._rankBuf = new Uint32Array(order.length);
      this._ranksDirty = false;
      this._buildTables();
      this._pendingIndices.length = 0;
      for (const grid of this.grids) grid.clear();
      this.wideObjects.clear();
      for (const obj of order) { obj._class = undefined; obj._cell = undefined; obj._wide = false; this._indexObject(obj); }
    }

    // Dense, rank-ordered object data for the per-frame loops (culling and
    // the fast preparation path): reading thousands of large scattered
    // objects every frame was the main cost of big levels.
    //   _os  static, OS_STRIDE per rank    _od  dynamic, OD_STRIDE per rank
    //   _pt  part table, PT_STRIDE per part (shared by objects of one def)
    //   _pl  part id lists                 _groupTable  group id lists
    _buildTables() {
      const order = this._byRank, n = order.length;
      const os = new Float64Array(n * OS_STRIDE), od = new Float64Array(n * OD_STRIDE);
      const partIds = new Map(), partObjs = [], pt = [], lists = new Map(), pl = [], gl = [], hsv = [], hsvIds = new Map();
      const groupSets = new Map();
      const partId = part => {
        let id = partIds.get(part);
        if (id !== undefined) return id;
        id = partObjs.length; partIds.set(part, id); partObjs.push(part);
        const info = part.info;
        let u0 = info.u0, u1 = info.u1, v0 = info.v0, v1 = info.v1;
        if (part.flipX) { const t = u0; u0 = u1; u1 = t; }
        if (part.flipY) { const t = v0; v0 = v1; v1 = t; }
        const m = part.matrix, mods = part.vertexMods;
        pt.push(info.slot, part.qx, part.qy, part.qx + info.w, part.qy + info.h, u0, u1, v0, v1,
          m[0], m[1], m[2], m[3], m[4], m[5], part.role, part.tag, part.detail ? 1 : 0,
          part.fixedColor[0], part.fixedColor[1], part.fixedColor[2], part.fixedOpacity,
          (part.upright ? 1 : 0) | (part.portalGuide ? 2 : 0) | (mods && mods.some(Boolean) ? 4 : 0),
          info.cw / 2, info.ch / 2, info.h, mods ? mods[0] || 0 : 0, mods ? mods[1] || 0 : 0, mods ? mods[2] || 0 : 0, mods ? mods[3] || 0 : 0);
        return id;
      };
      const listOf = parts => {
        let entry = lists.get(parts);
        if (!entry) {
          entry = [pl.length, parts.length];
          for (const part of parts) pl.push(partId(part));
          lists.set(parts, entry);
        }
        return entry;
      };
      const hsvId = value => {
        if (!value) return -1;
        let id = hsvIds.get(value);
        if (id === undefined) { id = hsv.length; hsv.push(value); hsvIds.set(value, id); }
        return id;
      };
      for (let r = 0; r < n; r++) {
        const obj = order[r], F = obj._F || (obj._F = prepareFlags(obj.def)), s = r * OS_STRIDE;
        // Rings (orb click scale, audio pulse) keep the general path too.
        const fast = !obj.animation && !obj.rotSpeed && !obj.pickupBob && obj.textFont === undefined && !obj.isText && obj.labelText === undefined && !F.isInvisibleBlock && !obj.isRing && !!obj.parts;
        const flags = (obj.hasDetail ? OF_DETAIL : 0) | (obj.ignoreFade ? OF_IGNOREFADE : 0) | (F.intrinsicDontFade ? OF_DONTFADE : 0) | (obj.noAudioScale ? OF_NOAUDIO : 0) |
          (obj.isRing ? OF_RING : 0) | (fast ? OF_FAST : 0) | (F.usesAudioScale ? OF_AUDIO : 0) | (F.customAudioScale ? OF_CUSTOMAUDIO : 0) |
          (F.customGlowColor ? OF_CUSTOMGLOW : 0) | (F.glowColorIsLBG ? OF_GLOWLBG : 0) | (F.cantColorGlow ? OF_CANTGLOW : 0) |
          (F.isObjectBlack ? OF_BLACK : 0) | (F.isColorSpriteBlack ? OF_CSBLACK : 0) | (F.colorZLayerRelated ? OF_ZLAYERREL : 0) |
          (F.customSpriteColor ? OF_CUSTOMSPRITE : 0);
        const rx = -obj.rotationX * Math.PI / 180, ry = -obj.rotationY * Math.PI / 180;
        os[s] = obj.baseID; os[s + 1] = obj.detailID; os[s + 2] = obj.zLayer; os[s + 3] = obj.zOrder * 1048576 + obj.arrival;
        os[s + 4] = KIND_INDEX[obj.kind] ?? 0; os[s + 5] = flags;
        os[s + 6] = obj.scaleX * (obj.flipX ? -1 : 1); os[s + 7] = obj.scaleY * (obj.flipY ? -1 : 1);
        os[s + 8] = Math.cos(ry); os[s + 9] = Math.sin(ry); os[s + 10] = -Math.sin(rx); os[s + 11] = Math.cos(rx);
        os[s + 12] = obj.fadeMargin; os[s + 13] = obj.enterChannel; os[s + 14] = obj._bco; os[s + 15] = obj._om;
        os[s + 16] = obj.def.amin || 0; os[s + 17] = obj.def.amax || 0;
        if (fast) {
          const p = listOf(obj.parts), g = obj.glowParts?.length ? listOf(obj.glowParts) : [0, 0];
          os[s + 18] = p[0]; os[s + 19] = p[1]; os[s + 20] = g[0]; os[s + 21] = g[1];
        }
        os[s + 22] = gl.length; os[s + 23] = obj.groups.length;
        for (const g of obj.groups) gl.push(g);
        if (obj.groups.length) {
          const setKey = obj.groups.join(",");
          let setId = groupSets.get(setKey);
          if (setId === undefined) groupSets.set(setKey, setId = groupSets.size);
          os[s + 35] = setId;
        }
        os[s + 24] = hsvId(obj.baseHSV); os[s + 25] = hsvId(obj.detailHSV);
        // Batches for the four (main, detail) blending states: the z layer
        // rules of addMainSpriteToParent / addColorSpriteToParent.
        for (let combo = 0; combo < 4; combo++) {
          const blendBase = (combo & 2) !== 0, blendDetail = (combo & 1) !== 0, zRel = F.colorZLayerRelated;
          let mainLayer = obj.zLayer;
          if (blendBase && obj.hasDetail && !blendDetail && !zRel) mainLayer += 1;
          const separateDetail = obj.hasDetail && blendBase !== blendDetail;
          let detailLayer = obj.zLayer;
          if (separateDetail && blendDetail && zRel) detailLayer += 1;
          os[s + 26 + combo] = this._batch(mainLayer, blendBase, obj.kind);
          os[s + 30 + combo] = separateDetail ? this._batch(detailLayer, blendDetail, obj.kind) : os[s + 26 + combo];
        }
        os[s + 34] = this._batch(obj.zLayer, false, "glow");
        const d = r * OD_STRIDE;
        od[d + 8] = os[s + 22]; od[d + 9] = os[s + 23]; od[d + 10] = flags; od[d + 11] = obj.fadeMargin + 70;
      }
      this._os = os; this._od = od;
      this._pt = Float64Array.from(pt); this._ptParts = partObjs;
      this._pl = Int32Array.from(pl); this._groupTable = Int32Array.from(gl);
      this._hsvTable = hsv; this._hm = new Float64Array(n * 12).fill(-1);
      this._cp = new Float64Array(n * 2);
      let maxGroup = 0;
      for (const g of gl) if (g > maxGroup) maxGroup = g;
      if (maxGroup >= this._accX.length) this._growGroups(maxGroup);
      this._snapX = new Float64Array(gl.length); this._snapY = new Float64Array(gl.length);
      this._syncedAt = new Uint32Array(n);
      for (let k = 0; k < gl.length; k++) { this._snapX[k] = this._accX[gl[k]]; this._snapY[k] = this._accY[gl[k]]; }
      this._tablesReady = true;
      for (const obj of order) { this._record(obj); this._odFlags(obj); }
    }

    // OD flags from the object's state (kept current by its accessors).
    // Bits 8-12 and 13-17 hold the negated enter and exit types (0 for a
    // type outside -1..-31).
    _odFlags(obj) {
      if (!this._tablesReady || this._ranksDirty || this._byRank[obj._rank] !== obj) return;
      const et = obj._enterType, xt = obj._exitType;
      this._od[obj._rank * OD_STRIDE + 7] = ((et <= -1 && et >= -31 ? -et : 0) << 8) | ((xt <= -1 && xt >= -31 ? -xt : 0) << 13) |
        (obj._enabled && !obj._hidden && !obj._removed && !obj.particleSystem ? DF_DRAWABLE : 0) | (obj.highDetail ? DF_HIGHDETAIL : 0) |
        ((obj._enterType !== -1 && obj._enterType !== -15) || (obj._exitType !== -1 && obj._exitType !== -15) ? DF_EFFECT : 0) | (obj._ringHitTime !== undefined ? DF_RING : 0) |
        (obj.isUIObject ? DF_UI : 0);
    }

    // Dense culling record: live x, y (as of the object's last update),
    // reach and affine.
    _record(obj, reach = obj.radius * obj._affineRadiusScale) {
      if (!this._tablesReady || this._ranksDirty || this._byRank[obj._rank] !== obj) return;
      const od = this._od, i = obj._rank * OD_STRIDE, m = obj.affine;
      od[i] = obj.x + obj.offX; od[i + 1] = obj.y + obj.offY; od[i + 2] = reach;
      od[i + 3] = m[0]; od[i + 4] = m[1]; od[i + 5] = m[2]; od[i + 6] = m[3];
    }

    // Culling index: a 2D grid of CELL-sized cells per reach class, so the
    // visible test walks only cells near the view (enlarged by the largest
    // reach of the class) instead of whole-height X sections with a 400
    // point margin. Objects reaching further than 400 points stay in
    // wideObjects and are always tested.
    _indexObject(obj) {
      if (obj.particleSystem || obj.ambientParticleSystem) this._wakeObjectParticles(obj);
      obj._indexDirty = false;
      const m = obj.affine;
      if (obj._radiusAffine !== m) {
        obj._affineRadiusScale = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3]);
        obj._radiusAffine = m;
      }
      const reach = obj.radius * obj._affineRadiusScale;
      // Before the first ranking the grid is not built (_rankObjects
      // indexes every object once the tables exist).
      if (!this._tablesReady || this._ranksDirty) return;
      this._record(obj, reach);
      const cls = reach <= CLASS_REACH[0] ? 0 : reach <= CLASS_REACH[1] ? 1 : reach <= CLASS_REACH[2] ? 2 : 3;
      if (cls === 3) {
        if (obj._class !== 3) { this._unsection(obj); obj._class = 3; obj._cell = undefined; obj._wide = true; this.wideObjects.add(obj); }
        return;
      }
      const key = cellKey(obj.x + obj.offX, obj.y + obj.offY);
      if (obj._class === cls && obj._cell === key) return;
      this._unsection(obj);
      const grid = this.grids[cls];
      let list = grid.get(key);
      if (!list) grid.set(key, list = []);
      obj._cellIdx = list.length;
      list.push(obj._rank);
      obj._class = cls; obj._cell = key; obj._wide = false;
    }

    // Several physics ticks can transform the same artwork before one
    // draw. Keep its position/affine live, but rebuild the visibility index
    // only once, after those transforms and before walking the grid.
    _queueIndex(obj) {
      if (obj.particleSystem || obj.ambientParticleSystem) this._wakeObjectParticles(obj);
      if (obj._indexDirty) return;
      obj._indexDirty = true;
      this._pendingIndices.push(obj);
    }

    _flushIndices() {
      const pending = this._pendingIndices;
      for (let i = 0; i < pending.length; i++) {
        const obj = pending[i];
        if (!obj._indexDirty) continue;
        if (obj.removed) { obj._indexDirty = false; continue; }
        this._indexObject(obj);
      }
      pending.length = 0;
    }

    // Order inside a cell does not matter (draw order comes from the sort
    // ranks), so removal swaps the last entry into the hole.
    _unsection(obj) {
      const cls = obj._class;
      if (cls === 3) { this.wideObjects.delete(obj); obj._class = undefined; obj._wide = false; return; }
      if (cls === undefined) return;
      const grid = this.grids[cls], list = grid.get(obj._cell);
      obj._class = undefined;
      if (!list) return;
      let index = obj._cellIdx;
      if (list[index] !== obj._rank) index = list.indexOf(obj._rank);
      if (index >= 0) {
        const last = list.pop();
        if (last !== obj._rank) { list[index] = last; this._byRank[last]._cellIdx = index; }
      }
      if (!list.length) grid.delete(obj._cell);
    }

    // Group translations are summed per group (`_accX/_accY`, cumulative
    // since the attempt began) and reach an object when something reads it,
    // at the latest when the frame is drawn: the effect manager moves groups
    // at 240 Hz, but objects are drawn once per frame. For every group
    // membership (aligned with the dense group table) the object keeps the
    // cumulative value it has already taken (`_snapX/_snapY`), so bringing
    // one group's members up to date never touches the members of the other
    // groups they share, and a live position needs only the dense tables.
    moveGroup(id, dx, dy) {
      if (!this._tablesReady || this._ranksDirty) this._rankObjects();
      if (id >= this._accX.length) this._growGroups(id);
      this._accX[id] += dx; this._accY[id] += dy;
      if (dx || dy) for (const obj of this.collisionBlockGroups.get(id) || []) obj._collisionBoxDirty = true;
      this._moveVersion = (this._moveVersion + 1) >>> 0;
      if (!this._moveVersion) { this._moveVersion = 1; this._syncedAt.fill(0); }
      if (!this._dirty[id]) { this._dirty[id] = 1; this._dirtyGroups.add(id); }
    }

    _growGroups(id) {
      const n = Math.max(id + 1, this._accX.length * 2, 1024);
      for (const key of ["_accX", "_accY", "_syncX", "_syncY"]) { const a = new Float64Array(n); a.set(this[key]); this[key] = a; }
      const dirty = new Uint8Array(n); dirty.set(this._dirty); this._dirty = dirty;
    }

    // Group opacity and toggle state as dense arrays by group id, refreshed
    // once per frame from the level's maps: the cull and the fast path read
    // them for every candidate's groups, and integer-keyed object lookups
    // cost more than the rest of the test.
    _syncGroupState() {
      const gs = this.groupState;
      if (!gs) return;
      const n = this._dirty.length;
      if (!this._gOp || this._gOp.length < n) {
        // Preserve the level's opacity through products and byte rounding.
        // Float32 can move a half-byte boundary (e.g. 1 - 0.9) by one byte.
        this._gOp = new Float64Array(n).fill(1); this._gOff = new Uint8Array(n); this._gTouched = [];
      }
      const gOp = this._gOp, gOff = this._gOff, touched = this._gTouched;
      for (let i = 0; i < touched.length; i++) { const g = touched[i]; gOp[g] = 1; gOff[g] = 0; }
      touched.length = 0;
      const op = gs.opacityMap, en = gs.enabledMap;
      for (const k in op) {
        const v = op[k], g = +k;
        if (v !== 1 && v !== undefined && g < n) { gOp[g] = v; touched.push(g); }
      }
      for (const k in en) {
        const g = +k;
        if (en[k] === false && g < n) { gOff[g] = 1; touched.push(g); }
      }
      // Groups with an active colour pulse (GJEffectManager group pulses).
      if (!this._gPulse || this._gPulse.length < n) this._gPulse = new Uint8Array(n);
      const gPulse = this._gPulse, pulseList = this._gPulseList || (this._gPulseList = []);
      for (let i = 0; i < pulseList.length; i++) gPulse[pulseList[i]] = 0;
      pulseList.length = 0;
      const pulses = this.colorManager?._groupPulses;
      if (pulses?.size) for (const [g, list] of pulses) if (list && list.length && g < n) { gPulse[g] = 1; pulseList.push(g); }
    }

    // Apply every translation of obj's groups it has not taken yet.
    _syncObject(obj) {
      const r = obj._rank;
      if (!this._tablesReady || this._byRank[r] !== obj) return;
      // One synchronization consumes all dirty memberships. Overlapping
      // moved groups often request the same object again without a new
      // translation; those requests must not scan its memberships twice.
      if (this._syncedAt[r] === this._moveVersion) return;
      this._syncedAt[r] = this._moveVersion;
      const od = this._od, d = r * OD_STRIDE, count = od[d + 9];
      if (!count) return;
      const g0 = od[d + 8], gt = this._groupTable, dirty = this._dirty, ax = this._accX, ay = this._accY, sx = this._snapX, sy = this._snapY;
      let dx = 0, dy = 0;
      for (let k = g0, end = g0 + count; k < end; k++) {
        const g = gt[k];
        if (!dirty[g]) continue;
        dx += ax[g] - sx[k]; dy += ay[g] - sy[k];
        sx[k] = ax[g]; sy[k] = ay[g];
      }
      if (dx === 0 && dy === 0) return;
      obj.offX += dx; obj.offY += dy;
      if (obj.particleSystem || obj.ambientParticleSystem) this._wakeObjectParticles(obj);
      // A translation keeps the affine (and so the wide flag): only a
      // section change needs the index.
      if (obj._class !== 3 && cellKey(obj.x + obj.offX, obj.y + obj.offY) !== obj._cell) this._queueIndex(obj);
      od[d] = obj.x + obj.offX; od[d + 1] = obj.y + obj.offY;
    }

    _cleanGroup(id) {
      this._dirty[id] = 0; this._syncX[id] = this._accX[id]; this._syncY[id] = this._accY[id];
    }

    flushMoves() {
      const dirty = this._dirtyGroups;
      for (const id of dirty) {
        const members = this.groups.get(id);
        if (members) for (let i = 0; i < members.length; i++) this._syncObject(members[i]);
      }
      // Every member now holds the cumulative value: the groups are clean.
      for (const id of dirty) this._cleanGroup(id);
      dirty.clear();
      this._flushIndices();
    }

    // The per-frame flush. A large group that has drifted less than
    // LAZY_DRIFT since its members were last all brought up to date stays
    // deferred: objects that may be visible are read through their live
    // position and the culling walk is widened by the possible error, so
    // only groups that moved far, and the visible objects, are touched.
    _lazyFlush() {
      const dirty = this._dirtyGroups;
      let deferred = 0;
      for (const id of dirty) {
        const members = this.groups.get(id), n = members ? members.length : 0;
        if (n > 8 && Math.abs(this._accX[id] - this._syncX[id]) < LAZY_DRIFT && Math.abs(this._accY[id] - this._syncY[id]) < LAZY_DRIFT) { deferred++; continue; }
        for (let i = 0; i < n; i++) this._syncObject(members[i]);
        this._cleanGroup(id);
        dirty.delete(id);
      }
      return deferred;
    }

    // Bring every object of group `id` up to date. Only needed when a group
    // sharing an object with `id` has moved since the last full flush.
    flushMovesFor(id) {
      const dirty = this._dirtyGroups;
      if (!dirty.size) return;
      const overlaps = this.groupOverlaps(id);
      let needed = false;
      if (dirty.size < overlaps.size) { for (const g of dirty) if (overlaps.has(g)) { needed = true; break; } }
      else for (const g of overlaps) if (dirty.has(g)) { needed = true; break; }
      if (!needed) return;
      const members = this.groups.get(id);
      if (members) for (let i = 0; i < members.length; i++) this._syncObject(members[i]);
    }

    // Every group sharing an object with group `id` (including `id`).
    groupOverlaps(id) {
      let overlaps = this._overlaps.get(id);
      if (!overlaps || overlaps.version !== this.membershipVersion) {
        overlaps = new Set([id]);
        for (const obj of this.groups.get(id) || []) for (const g of obj.groups) overlaps.add(g);
        overlaps.version = this.membershipVersion;
        this._overlaps.set(id, overlaps);
      }
      return overlaps;
    }

    // Pending translation of the object at rank r (dense tables only), into
    // _pdx/_pdy in one pass over its memberships.
    _pending(r) {
      const od = this._od, d = r * OD_STRIDE, count = od[d + 9], g0 = od[d + 8], gt = this._groupTable, dirty = this._dirty;
      let x = 0, y = 0;
      for (let k = g0, end = g0 + count; k < end; k++) {
        const g = gt[k];
        if (dirty[g]) { x += this._accX[g] - this._snapX[k]; y += this._accY[g] - this._snapY[k]; }
      }
      this._pdx = x; this._pdy = y;
    }
    _pendingX(r) {
      const od = this._od, d = r * OD_STRIDE, count = od[d + 9], g0 = od[d + 8], gt = this._groupTable, dirty = this._dirty;
      let x = 0;
      for (let k = g0, end = g0 + count; k < end; k++) { const g = gt[k]; if (dirty[g]) x += this._accX[g] - this._snapX[k]; }
      return x;
    }
    _pendingY(r) {
      const od = this._od, d = r * OD_STRIDE, count = od[d + 9], g0 = od[d + 8], gt = this._groupTable, dirty = this._dirty;
      let y = 0;
      for (let k = g0, end = g0 + count; k < end; k++) { const g = gt[k]; if (dirty[g]) y += this._accY[g] - this._snapY[k]; }
      return y;
    }

    // An object's current position including moves not yet applied.
    livePosition(obj, out = {}) {
      let x = obj.x + obj.offX, y = obj.y + obj.offY;
      if (this._dirtyGroups.size && obj.groups.length && this._tablesReady && this._byRank[obj._rank] === obj) {
        x += this._pendingX(obj._rank); y += this._pendingY(obj._rank);
      }
      out.x = x; out.y = y;
      return out;
    }

    // Collision blocks keep a cached physical rectangle. Move invalidates
    // every member (339201); rotation invalidates Dynamic members only.
    // checkCollisionBlocks (320450) also tests the rotated quadrilaterals
    // after the broad-phase rectangle, rather than treating their AABBs as
    // solid corners.
    collisionBox(obj) {
      const p = this.livePosition(obj), af = obj.affine;
      const area = {};
      this.areaState?.active && this.areaState.forObject(obj, p.x, p.y, area);
      const affected = !!(area.dx || area.dy || area.rot || area.linearActive || area.sx !== undefined && (area.sx !== 1 || area.sy !== 1));
      if (obj._collisionBox && !obj._collisionBoxDirty && !affected && !obj._collisionHadArea && obj.levelObj._raw?.[94] !== '1') return obj._collisionBox;
      // Area moves/rotations change the native object's physical transform,
      // including invisible Collision blocks (Aperture's wave controller).
      const m = affected ? this.areaState._beginLinear(obj, area) : mul(af, nodeToParent(0, 0, obj.rotationX, obj.rotationY,
        obj.scaleX * (obj.flipX ? -1 : 1), obj.scaleY * (obj.flipY ? -1 : 1), 0, 0));
      p.x += area.dx || 0; p.y += area.dy || 0;
      const points = [[-15,-15],[15,-15],[15,15],[-15,15]].map(([x,y]) =>
        [p.x + m[0]*x + m[2]*y, p.y + m[1]*x + m[3]*y]);
      const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
      obj._collisionBoxDirty = false;
      obj._collisionHadArea = affected;
      return obj._collisionBox = { x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys), points };
    }

    // A new attempt or a checkpoint: objects hold absolute offsets again.
    _resetMoves() {
      this._accX.fill(0); this._accY.fill(0); this._syncX.fill(0); this._syncY.fill(0); this._dirty.fill(0);
      this._syncedAt?.fill(0);
      if (this._snapX) { this._snapX.fill(0); this._snapY.fill(0); }
      this._dirtyGroups.clear();
      for (const blocks of this.collisionBlocks.values()) for (const obj of blocks) {
        obj._collisionBox = obj._initialCollisionBox; obj._collisionBoxDirty = false; obj._collisionHadArea = false;
      }
    }

    removeObject(obj) {
      if (!obj || obj.removed) return;
      obj.removed = true;
      obj.enabled = false;
      if (obj.id === 1816) {
        const id = Number(obj.levelObj._raw?.[80]) || 0, blocks = this.collisionBlocks.get(id);
        const index = blocks?.indexOf(obj) ?? -1;
        if (index >= 0) blocks.splice(index, 1);
        if (!blocks?.length) this.collisionBlocks.delete(id);
      }
      this.membershipVersion++;
      if (obj.id === 3662) {
        const group = Math.max(0, Math.min(9999, Number(obj.levelObj._raw?.[51]) || 0));
        if (!this.objects.some(o => !o.removed && o.id === 3662 && Math.max(0, Math.min(9999, Number(o.levelObj._raw?.[51]) || 0)) === group)) this.linkedVisibilityGroups.delete(group);
        if (!this.linkedVisibilityGroups.size) this._linkedUnits = null;
      }
      this._unsection(obj);
      obj._cell = undefined;
      for (const id of obj.groups) {
        const members = this.groups.get(id);
        const index = members?.indexOf(obj) ?? -1;
        if (index >= 0) members.splice(index, 1);
      }
      if (obj.companion) this.removeObject(obj.companion);
      if (obj.teleportExit) this.removeObject(obj.teleportExit);
    }

    // The parent registered for a group (setGroupParent appends, a '+' entry
    // promotes); a removed parent leaves the group without one.
    groupParent(id) {
      const parent = this.parents.get(id);
      return parent && !parent.removed ? parent : null;
    }

    groupCenter(id) {
      const members = this.groups.get(id);
      if (!members?.length) return null;
      let x = 0, y = 0, count = 0;
      // Reading a camera/rotation target must not force an entire shared
      // scenery group to materialize its pending translations four times per
      // rendered frame. Include those translations in this read instead.
      for (const obj of members) {
        if (obj.companionOf) continue;
        if (this._dirtyGroups.size) { const pos = this.livePosition(obj, this._tmpPosition); x += pos.x; y += pos.y; }
        else { x += obj.x + obj.offX; y += obj.y + obj.offY; }
        count++;
      }
      return count ? { x: x / count, y: y / count } : null;
    }

    triggerAnimationGroup(id) {
      for (const obj of this.groups.get(Number(id)) || []) {
        const raw = obj.levelObj._raw || {};
        if (raw[123] !== "1") continue;
        const active = obj.enabled && !obj.removed && (!this.groupState || obj.groups.every(g => this.groupState.enabled(g)));
        const camera = this.camera, radius = obj.radius * Math.hypot(...obj.affine);
        const { x, y } = this.livePosition(obj);
        const visible = active && x + radius >= camera.x - 120 && x - radius <= camera.x + camera.w + 120 &&
          y + radius >= camera.y - 120 && y - radius <= camera.y + camera.h + 120;
        if (raw[214] === "1" && !visible) continue;
        obj.animationStart = null;
        obj.animationTriggered = true;
        if (obj.particleSystem) {
          if (visible) obj.particleSystem.trigger();
          else obj.particleSystem.pendingTrigger = true;
        }
      }
    }

    activateRing(obj) {
      if (!obj?.isRing || obj.levelObj.noEffects) return;
      obj.ringHitTime = this.time;
    }

    rotateGroup(id, radians, center, lockRotation, keyframe = false) {
      this.flushMovesFor(id);
      const c = Math.cos(radians), s = Math.sin(radians);
      const degrees = radians * 180 / Math.PI;
      for (const obj of this.groups.get(id) || []) {
        if (obj.id === 1816 && obj.levelObj._raw?.[94] === '1') obj._collisionBoxDirty = true;
        if (center) {
          const dx = obj.x + obj.offX - center.x, dy = obj.y + obj.offY - center.y;
          obj.offX = center.x + dx * c + dy * s - obj.x;
          obj.offY = center.y - dx * s + dy * c - obj.y;
        }
        if (!lockRotation) {
          obj.rotOff += degrees;
          const m = obj.affine, a = m[0], b = m[1], d = m[2], e = m[3];
          // Left multiplication by an orthogonal rotation preserves the
          // radius norm. Reuse the matrix and its cached radius instead of
          // allocating a matrix for every decoration at every physics tick.
          m[0] = c * a + s * b; m[1] = -s * a + c * b;
          m[2] = c * d + s * e; m[3] = -s * d + c * e;
          if (!keyframe && this.keyframeFrames) {
            const e = obj._keyframeOuterAffine ||= [1, 0, 0, 1], a = e[0], b = e[1], d = e[2], f = e[3];
            e[0] = c * a + s * b; e[1] = -s * a + c * b;
            e[2] = c * d + s * f; e[3] = -s * d + c * f;
          }
          obj._affVer++;
        }
        this._queueIndex(obj);
      }
    }

    scaleGroup(id, fx, fy, center, onlyMove, relativeRotation, axesRotation = null, keyframe = false) {
      this.flushMovesFor(id);
      for (const obj of this.groups.get(id) || []) {
        if (obj.id === 1816) obj._collisionBoxDirty = true;
        let a = fx, b = 0, d = fy;
        if (relativeRotation) {
          const angle = -(axesRotation ?? center?.rotation ?? obj.rot + obj.rotOff) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
          a = c * c * fx + s * s * fy; b = c * s * (fx - fy); d = s * s * fx + c * c * fy;
        }
        if (center) {
          const dx = obj.x + obj.offX - center.x, dy = obj.y + obj.offY - center.y;
          obj.offX = center.x + a * dx + b * dy - obj.x;
          obj.offY = center.y + b * dx + d * dy - obj.y;
        }
        if (!onlyMove) {
          const m = obj.affine;
          const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
          m[0] = a * m0 + b * m1; m[1] = b * m0 + d * m1;
          m[2] = a * m2 + b * m3; m[3] = b * m2 + d * m3;
          if (!keyframe && this.keyframeFrames) {
            const e = obj._keyframeOuterAffine ||= [1, 0, 0, 1], e0 = e[0], e1 = e[1], e2 = e[2], e3 = e[3];
            e[0] = a * e0 + b * e1; e[1] = b * e0 + d * e1;
            e[2] = a * e2 + b * e3; e[3] = b * e2 + d * e3;
          }
          obj._radiusAffine = null; obj._affVer++;
          obj.extraScaleX *= fx; obj.extraScaleY *= fy;
        }
        this._queueIndex(obj);
      }
    }

    animatePickup(obj) {
      if (!obj || !obj.parts?.length || obj.hidden || !obj.enabled || obj.removed || obj.levelObj._raw?.[116] === "1" || !this._groupsEnabled(obj)) return;
      this.colorManager ||= this.scene?._colorManager;
      if (!this.colorManager) return;
      const point = this.livePosition(obj, {}), pieces = [];
      const write = this._writePart;
      try {
        this._writePart = (batch, key, part, matrix, color, opacity) => {
          if (opacity > 0) pieces.push({ batch, key, part, matrix: [...matrix], color: color.slice(), opacity });
        };
        this._prepareObject(obj, point.x, point.y, false);
      } finally { this._writePart = write; }
      if (!pieces.length) return;
      const key = `${Math.trunc(point.x)},${Math.trunc(point.y + 90)}`;
      let random = this.pickupRandom.get(key);
      if (!random) this.pickupRandom.set(key, random = [Math.random() * 2 - 1, Math.random()]);
      const coin = obj.id === 1614;
      if (coin) for (const piece of pieces) for (const family of ['', 'color_', 'highlight_']) {
        if (piece.part.info !== this.frames.get(`smallCoin_01_${family}001.png`)) continue;
        piece.animation = [1,2,3,4].map(n => this.frames.get(`smallCoin_0${n}_${family}001.png`));
        piece.coinLayer = family === 'highlight_' ? 'highlight' : family === 'color_' ? 'color' : 'main';
      }
      this.pickupEffects.push({ start: this.time, x: point.x, y: point.y, random, pieces, coin });
      // playPickupAnimation (2a765c): numbered coins use coinPickupEffect,
      // other collectibles use glassDestroy01, coloured by their main sprite.
      if(obj.levelObj._raw?.[507]!=='1'&&!window.noParticles){
        const preset=coin?'coinPickupEffect':'glassDestroy01',data=window.cocosParticlePreset?.(preset);
        if(data&&window.GDParticleSystem){
          const main=pieces.find(p=>p.part.role===ROLE_MAIN)||pieces[0];
          for(const [i,c] of ['R','G','B'].entries())data['StartColor'+c]=data['EndColor'+c]=main.color[i]/255;
          data.StartColorA=main.opacity;data.EndColorA=0;
          const object=new GDObj({id:2065,x:point.x,y:point.y,_raw:{}},window.GD_OBJECTS[2065],-1);
          object.groups=[];object.zLayer=5;object.arrival=obj.arrival;
          const system=new window.GDParticleSystem(this,object,data);system.presetName=preset;
          system.snapshotOpacity=1;system.snapshotBlend=true;system.trigger();this.spawnedParticleSystems.push(system);
        }
      }
    }
    _drawPickupEffects() {
      // GameObject::playPickupAnimation (2a7350 / 2a850f): 0.6 s
      // Bezier, 20/30/65/115/10 GD offsets, fade at .45 for .15 s.
      for (let i = this.pickupEffects.length - 1; i >= 0; i--) {
        const effect = this.pickupEffects[i], t = Math.max(0, (this.time - effect.start) / .6);
        if (t >= 1) { this.pickupEffects.splice(i, 1); continue; }
        const q = 1 - t, [rx, ry] = effect.random, lift = 1 + .1 * ry;
        const dx = (3 * q * t * t + t * t * t) * (effect.coin ? 30 : 20) * rx;
        const dy = 3 * q * q * t * (effect.coin ? 54 : 65) * lift +
          3 * q * t * t * (effect.coin ? 108 : 115) * lift - (effect.coin ? 48 : 40) * t * t * t;
        const angle = (effect.coin ? 0 : ry * 40 * t * Math.PI / 180), c = Math.cos(angle), s = Math.sin(angle);
        const root = [c, s, -s, c, effect.x + dx - c * effect.x + s * effect.y,
          effect.y + dy - s * effect.x - c * effect.y];
        const age = this.time - effect.start;
        const opacity = Math.min(1, Math.max(0, (.6 - age) / (effect.coin ? .2 : .15)));
        for (const piece of effect.pieces) {
          const info = piece.animation?.[Math.floor(age / .05) % 4];
          const part = info ? makePart({ ...piece.part, info,
            qx: piece.part.qx + info.ox - piece.part.info.ox, qy: piece.part.qy + info.oy - piece.part.info.oy }) : piece.part;
          const matrix = mul(root, piece.matrix);
          if (info) { const dx = (info.cw - piece.part.info.cw) / 2, dy = (info.ch - piece.part.info.ch) / 2;
            matrix[4] -= matrix[0] * dx + matrix[2] * dy; matrix[5] -= matrix[1] * dx + matrix[3] * dy; }
          let color = piece.color, alpha = opacity;
          if (piece.coinLayer) {
            // Native 2a7b7e..2a7c3a: the collected coin flashes pale yellow,
            // tints back over .3 s and reveals its highlight. Its two child
            // sprites then fade independently over .3 s (2a7eb2 / 2a8019).
            const tint = Math.min(1, age / .3);
            if (piece.coinLayer === 'highlight') alpha = age < .3 ? tint : Math.max(0, (.6 - age) / .3);
            else {
              color = piece.color.map((v, i) => Math.trunc((i === 2 ? 200 : 255) * (1 - tint) + v * tint));
              if (piece.coinLayer === 'color') alpha = Math.min(1, Math.max(0, (.6 - age) / .3));
            }
          }
          this._writePart(piece.batch, piece.key, part, matrix, color, piece.opacity * alpha);
        }
      }
    }

    breakBlock(obj) {
      if (!obj || obj.hidden || obj.levelObj._raw?.[116] === "1" || obj.levelObj._raw?.[507] === "1") return;
      const data = window.cocosParticlePreset?.('glassDestroy01');
      if (!data || !window.GDParticleSystem) return;
      const point = this.livePosition(obj, {});
      const object = new GDObj({ id:2065, x:point.x, y:point.y, _raw:{} }, window.GD_OBJECTS[2065], -1);
      object.groups = []; object.zLayer = 5; object.arrival = obj.arrival;
      const system = new window.GDParticleSystem(this, object, data);
      system.presetName = 'glassDestroy01'; system.snapshotOpacity = 1; system.snapshotBlend = true;
      system.trigger(); this.spawnedParticleSystems.push(system);
    }

    deathParticles(point, color, scale = .9) {
      const data = window.cocosParticlePreset?.('explodeEffect');
      if (!data || !window.GDParticleSystem) return false;
      for (const [i, channel] of ['R','G','B'].entries()) data['StartColor' + channel] = color[i] / 255;
      const object = new GDObj({ id:2065, x:point.x, y:point.y, _raw:{} }, window.GD_OBJECTS[2065], -1);
      object.groups = []; object.zLayer = 5;
      object.scaleX = object.scaleY = scale;
      const system = new window.GDParticleSystem(this, object, data);
      system.presetName = 'explodeEffect'; system.snapshotOpacity = 1; system.snapshotBlend = true;
      system.trigger(); this.spawnedParticleSystems.push(system);
      return true;
    }

    // Spawned systems belong to the play layer, not the template's groups.
    // A declared/sole group parent preserves the template layout around it;
    // an ambiguous template group emits all systems at the requested point.
    spawnParticles(groupId, position, rotation = 0, scale = 1) {
      if (!window.GDParticleSystem) return;
      if (scale === 0) scale = 1;
      const members = (this.groups.get(groupId) || []).filter(o => !o.removed && !o.companionOf);
      const parent = this.groupParent(groupId) || (members.length === 1 ? members[0] : null);
      const origin = parent ? this.livePosition(parent) : null;
      const angle = -rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      this._channelStamp++; // Colour triggers earlier in this tick may have changed the template.
      for (const source of this.groups.get(groupId) || []) {
        if (source.removed || source.id !== 2065 || !source.particleSystem || (window.enableLDM && source.highDetail)) continue;
        this._syncObject(source);
        const object = new GDObj(source.levelObj, source.def, -1);
        const dx = origin ? source.x + source.offX - origin.x : 0, dy = origin ? source.y + source.offY - origin.y : 0;
        object.x = position.x + (c * dx - s * dy) * scale;
        object.y = position.y + (s * dx + c * dy) * scale;
        object.groups = []; object.arrival = source.arrival;
        object.rotationX = source.rotationX + rotation; object.rotationY = source.rotationY + rotation;
        object.scaleX = source.scaleX * scale; object.scaleY = source.scaleY * scale;
        object.affine = source.affine.slice();
        const system = new window.GDParticleSystem(this, object, source.particleSystem.data);
        // The native method clamps infinite duration to a single burst and
        // marks the new CCParticleSystem for automatic removal when empty.
        if (system.data.Duration < 0) system.data.Duration = 0;
        if (object.levelObj._raw?.[146] === "1" || object.levelObj._raw?.[147] === "1") {
          system.snapshotColor = this._colorForMode(source, source.baseID, true, [255, 255, 255]).slice();
          system.snapshotEndColor = this._colorForMode(source, source.detailID, false, [255, 255, 255]).slice();
        }
        system.snapshotOpacity = 1;
        system.snapshotBlend = system.objectBlend(source);
        system.trigger(); this.spawnedParticleSystems.push(system);
      }
    }

    captureRuntimeState(detach = true) {
      this.flushMoves();
      this._settleParticleClocks();
      const state = {
        time: this.time, pickupEffects: this.pickupEffects, enterMap: this.enterMap.slice(), exitMap: this.exitMap.slice(),
        particles: this.particleSystems.map(p => [p.object.index, { particles: p.particles, elapsed: p.elapsed, accumulator: p.accumulator, started: p.started, triggered: p.triggered, pendingTrigger: p.pendingTrigger }]),
        spawnedParticles: this.spawnedParticleSystems.map(p => ({
          source: p.object.levelObj._eeObjectId, preset: p.presetName, data: p.data,
          object: { x: p.object.x, y: p.object.y, rotationX: p.object.rotationX, rotationY: p.object.rotationY,
            scaleX: p.object.scaleX, scaleY: p.object.scaleY, affine: p.object.affine },
          state: { particles: p.particles, elapsed: p.elapsed, accumulator: p.accumulator, started: p.started, triggered: p.triggered,
            snapshotColor: p.snapshotColor, snapshotEndColor: p.snapshotEndColor, snapshotOpacity: p.snapshotOpacity, snapshotBlend: p.snapshotBlend }
        })),
        sparseObjects: true, packedObjects: this._captureObjectRuntime()

      };
      // LevelObject detaches the whole checkpoint once. Cloning thousands
      // of live particles here as well stalls the same checkpoint twice.
      return detach ? structuredClone(state) : state;
    }

    _runtimeObjectChanged(o) {
      const a=o.affine;
      return o.offX!==0||o.offY!==0||o.rotOff!==0||o.extraScaleX!==1||o.extraScaleY!==1||!o.enabled||
        o.enterType!==-1||o.exitType!==-1||!!o.enterFlag||!!o.animationTriggered||!!o.animationStart||
        o.ringHitTime!==undefined||!!o._keyframeOuterAffine||a[0]!==1||a[1]!==0||a[2]!==0||a[3]!==1;
    }
    _resetRuntimeObject(o) {
      o.offX=0;o.offY=0;o.rotOff=0;o.extraScaleX=o.extraScaleY=1;
      o.enabled=!o.removed;o.enterType=o.exitType=-1;o.enterFlag=false;o.enterAngle=undefined;
      o.affine=[1,0,0,1];o._keyframeOuterAffine=null;o.animationTriggered=false;o.animationStart=0;o.ringHitTime=undefined;
      o._affVer++;this._indexObject(o);
    }
    _captureObjectRuntime() {
      // Typed columns avoid hundreds of thousands of small arrays (and their
      // second structuredClone traversal) when a practice marker is placed.
      const objects = this.objects.filter(o => !o.removed && this._runtimeObjectChanged(o));
      const indices = new Uint32Array(objects.length), flags = new Uint8Array(objects.length), values = new Float64Array(objects.length * 20);
      for (let i=0; i<objects.length; i++) {
        const o=objects[i], n=i*20, outer=o._keyframeOuterAffine;
        indices[i]=o.index;flags[i]=(o.enabled?1:0)|(o.enterFlag?2:0)|(o.animationTriggered?4:0)|(outer?8:0)|(outer?.length===6?16:0)|(o.animationStart===null?32:0);
        values[n]=o.offX;values[n+1]=o.offY;values[n+2]=o.rotOff;values[n+3]=o.extraScaleX;values[n+4]=o.extraScaleY;
        values[n+5]=o.enterType;values[n+6]=o.exitType;values[n+7]=o.enterAngle;
        values[n+8]=o.animationStart;values[n+9]=o.ringHitTime;
        for(let j=0;j<4;j++)values[n+10+j]=o.affine[j];
        if(outer)for(let j=0;j<outer.length;j++)values[n+14+j]=outer[j];
      }
      return {indices,flags,values};
    }
    _restoreObjectRuntime(packed) {
      const {indices,flags,values}=packed;
      for(let i=0;i<indices.length;i++) {
        let o=this.objects[indices[i]];
        if(o?.removed)o=this.objects.find(c=>!c.removed&&c.levelObj===o.levelObj);
        if(!o)continue;
        const n=i*20,f=flags[i];
        o.offX=values[n];o.offY=values[n+1];o.rotOff=values[n+2];o.extraScaleX=values[n+3];o.extraScaleY=values[n+4];
        o.enabled=!!(f&1);o.enterType=values[n+5];o.exitType=values[n+6];o.enterAngle=Number.isNaN(values[n+7])?undefined:values[n+7];o.enterFlag=!!(f&2);
        o.animationTriggered=!!(f&4);o.animationStart=f&32?null:Number.isNaN(values[n+8])?undefined:values[n+8];o.ringHitTime=Number.isNaN(values[n+9])?undefined:values[n+9];
        o.affine=Array.from(values.subarray(n+10,n+14));o._keyframeOuterAffine=f&8?Array.from(values.subarray(n+14,n+14+(f&16?6:4))):null;
        o._affVer++;this._indexObject(o);
      }
    }

    restoreRuntimeState(state) {
      this.pickupEffects = structuredClone(state.pickupEffects || []);
      this._wakeAllParticles(-Infinity);
      this._resetMoves();
      // A snapshot omits default scenery. Also undo changes made AFTER that
      // snapshot, including when restoring it repeatedly without a reset.
      if(state.sparseObjects) for(const o of this.objects)
        if(!o.removed&&this._runtimeObjectChanged(o))this._resetRuntimeObject(o);
      this.time = state.time;
      this.enterMap = state.enterMap.slice(); this.exitMap = state.exitMap.slice();
      this.spawnedParticleSystems.length = 0;
      for (const saved of state.spawnedParticles || []) {
        const source = saved.preset ? { levelObj:{id:2065,_raw:{}}, def:window.GD_OBJECTS[2065], arrival:0 }
          : this.objects.find(o => o.levelObj._eeObjectId === saved.source && o.id === 2065 && !o.removed);
        if (!source) continue;
        const object = new GDObj(source.levelObj, source.def, -1);
        Object.assign(object, structuredClone(saved.object)); object.groups = []; object.arrival = source.arrival;
        const system = new window.GDParticleSystem(this, object, saved.data);
        Object.assign(system, structuredClone(saved.state)); system.presetName = saved.preset;
        this.spawnedParticleSystems.push(system);
      }
      for (const [index, data] of state.particles || []) {
        const object = this.objects[index];
        const system = object?.particleSystem || object?.ambientParticleSystem;
        if (system) Object.assign(system, structuredClone(data));
      }
      if(state.packedObjects)this._restoreObjectRuntime(state.packedObjects);
      for (const entry of state.objects || []) {
        let obj = this.objects[entry[0]];
        if (obj?.removed) obj = this.objects.find(candidate => !candidate.removed && candidate.levelObj === obj.levelObj);
        if (!obj) continue;
        [, obj.offX, obj.offY, obj.rotOff, obj.extraScaleX, obj.extraScaleY,
          obj.enabled, obj.enterType, obj.exitType, obj.enterAngle, obj.enterFlag, obj.affine, obj.animationTriggered, obj.animationStart, obj.ringHitTime, obj._keyframeOuterAffine] = entry;
        obj._keyframeOuterAffine = obj._keyframeOuterAffine?.slice() || null;
        obj.affine = obj.affine ? obj.affine.slice() : [1, 0, 0, 1];
        obj._affVer++;
        this._indexObject(obj);
      }
    }

    reset() {
      this.pickupEffects.length = 0;
      this._wakeAllParticles(-Infinity);
      this._resetMoves();
      this.enterMap.fill(-2);
      this.exitMap.fill(-2);
      this.time = 0;
      this.spawnedParticleSystems.length = 0;
      for (const obj of this.objects) {
        obj.offX = 0; obj.offY = 0; obj.rotOff = 0;
        obj.extraScaleX = 1; obj.extraScaleY = 1;
        obj.affine = [1, 0, 0, 1]; obj._keyframeOuterAffine = null; obj._affVer++;
        obj.animationTriggered = false; obj.animationStart = 0;
        obj.ringHitTime = undefined;
        obj.enabled = !obj.removed;
        obj.particleSystem?.reset();
        obj.ambientParticleSystem?.reset();
        obj.enterType = -1; obj.exitType = -1; obj.enterFlag = false;
        this._indexObject(obj);
      }
    }

    setEnterEffect(channel, effect, mode) {
      const ch = Math.max(0, Math.min(100, channel | 0));
      if (mode === 0 || mode === 1) this.enterMap[ch] = effect;
      if (mode === 0 || mode === 2) this.exitMap[ch] = effect;
    }

    // ------------------------------------------------------------ colours
    // GameObject::colorForMode
    _colorForMode(obj, id, isMain, out, F = prepareFlags(obj.def)) {
      const cm = this.colorManager;
      let base;
      if (id <= 0) base = WHITE;
      else if (id === 1012) {
        const src = obj.baseID > 0 && obj.baseID !== 1012 ? this._channelColor(obj.baseID) : WHITE;
        base = gdTransformColorRGB(src[0], src[1], src[2], LIGHTER_HSV, this._lighterTmp || (this._lighterTmp = [0, 0, 0]));
      } else base = this._channelColor(id);
      let pulsed = false;
      if (obj.groups.length && cm._groupPulses?.size !== 0) {
        const treatAsMain = isMain ? !F.customSpriteColor : false;
        if (isMain || obj.detailID !== 1012) {
          for (const g of obj.groups) if (cm.hasGroupPulse(g)) {
            if (!pulsed) { out[0] = base[0]; out[1] = base[1]; out[2] = base[2]; pulsed = true; }
            cm.colorForGroup(g, out, treatAsMain, out);
          }
        }
      }
      const hsv = isMain ? obj.baseHSV : obj.detailHSV;
      if (pulsed) {
        if (hsv) gdTransformColorRGB(out[0], out[1], out[2], hsv, out);
        return out;
      }
      if (!hsv) { out[0] = base[0]; out[1] = base[1]; out[2] = base[2]; return out; }
      // HSV of an unchanged channel colour: reuse the previous result.
      const memo = isMain ? (obj._hsvMain || (obj._hsvMain = [-1, -1, -1, 0, 0, 0])) : (obj._hsvDetail || (obj._hsvDetail = [-1, -1, -1, 0, 0, 0]));
      if (memo[0] !== base[0] || memo[1] !== base[1] || memo[2] !== base[2]) {
        memo[0] = base[0]; memo[1] = base[1]; memo[2] = base[2];
        const t = gdTransformColorRGB(base[0], base[1], base[2], hsv, this._hsvTmp || (this._hsvTmp = [0, 0, 0]));
        memo[3] = t[0]; memo[4] = t[1]; memo[5] = t[2];
      }
      out[0] = memo[3]; out[1] = memo[4]; out[2] = memo[5];
      return out;
    }
    // Per-frame channel cache: final colour, sprite opacity factor, blending.
    _channelEntry(id) {
      let e = this._channels[id];
      if (!e) e = this._channels[id] = { stamp: -1, color: [255, 255, 255], opacity: 1, blend: false, version: 0 };
      if (e.stamp !== this._channelStamp) {
        const cm = this.colorManager, c = cm.getFinal(id), col = e.color;
        const op = id <= 0 || !cm.getOpacity ? 255 : Math.trunc(cm.getOpacity(id)) & 255;
        const opacity = id <= 0 ? 1 : op < 250 ? op * 0.004 : 1, blend = id > 0 && !!cm.getBlending?.(id);
        if (col[0] !== c[0] || col[1] !== c[1] || col[2] !== c[2] || e.opacity !== opacity || e.blend !== blend) {
          col[0] = c[0]; col[1] = c[1]; col[2] = c[2]; e.opacity = opacity; e.blend = blend; e.version++;
        }
        e.stamp = this._channelStamp;
      }
      return e;
    }
    _channelColor(id) { return this._channelEntry(id).color; }
    _channelBlend(id) { return this._channelEntry(id).blend; }
    _channelOpacity(id) {
      if (id <= 0) return 1;
      return this._channelEntry(id).opacity;
    }
    _groupOpacity(obj) {
      const gs = this.groupState, groups = obj.groups;
      if (!gs || !groups.length) return 1;
      const map = gs.opacityMap;
      let v = 1;
      for (let i = 0; i < groups.length; i++) {
        const o = map ? (map[groups[i]] ?? 1) : gs.opacity(groups[i]);
        if (o !== 1) v *= o;
      }
      return v;
    }

    // ---------------------------------------------------- enter effects
    // PlayLayer::applyEnterEffect
    _applyEnterEffect(obj, effect, isEnter, posX, posY) {
      const cam = this.camera;
      let f = isEnter ? (cam.x + cam.w - posX) : (posX - cam.x);
      f = Math.max(0, Math.min(1, f / 70));
      const done = obj.ignoreEnter || f === 1;
      let type = isEnter ? obj.enterType : obj.exitType;
      const result = { dx: 0, dy: 0, scale: 1 };
      if (type === -1 || (effect === -14 && type !== effect)) {
        if (done) { obj.enterFlag = true; return result; }
        type = effect;
        if (isEnter) obj.enterType = effect; else obj.exitType = effect;
        const centerY = cam.y + cam.h * 0.5;
        if (effect === -13 || effect === -12) {
          obj.enterAngle = posY > centerY ? 180 : 0;
          if (effect === -13) obj.enterAngle += 180;
        } else if (effect === -11) {
          obj.enterAngle = (Math.random() * 2 - 1) * 180;
        } else if (effect === -10) {
          obj.enterAngle = posY > centerY ? -135 : -45;
        } else if (effect === -9) {
          obj.enterAngle = posY > centerY ? 135 : 45;
        }
      }
      const k = 1 - f;
      switch (type) {
        case -13: case -12: case -11: case -10: case -9: {
          const ang = (obj.enterAngle - 90) * 0.01745329238474369;
          result.dx = Math.cos(ang) * k * 100;
          result.dy = Math.sin(ang) * k * 100;
          break;
        }
        case -8: result.dx = k * 100; break;
        case -7: result.dx = k * -100; break;
        case -6: result.dy = k * -100; break;
        case -5: result.dy = k * 100; break;
        case -4: result.scale = k * 0.75 + 1; break;
        case -3: result.scale = f; break;
        default: break;
      }
      if (f === 0) {
        obj.enterFlag = true;
        if (isEnter) obj.enterType = -1; else obj.exitType = -1;
      }
      return result;
    }

    // ------------------------------------------------------------ frame
    // Port of the per-object part of PlayLayer::updateVisibility.
    update(dt) {
      const prof = window.__gdRenderProfile, t0 = prof ? performance.now() : 0;
      if (!this.enabled || !this.colorManager) { this.flushMoves(); return; }
      if (this._ranksDirty) this._rankObjects();
      if (this.linkedVisibilityGroups.size) this._syncLinkedVisibility();
      const deferred = this._dirtyGroups.size ? this._lazyFlush() : 0;
      this._channelStamp = (this._channelStamp || 0) + 1;
      this._syncGroupState();
      const area = this.areaState && this.areaState.active ? this.areaState : null;
      const areaRank = area ? this._syncAreaRanks(area) : null;
      if (prof) prof.flush = (prof.flush || 0) + performance.now() - t0;
      this.time += dt;
      const bg = this.colorManager.getFinal(1000);
      this._plainLBG = gdTransformColorRGB(bg[0], bg[1], bg[2], PLAIN_LBG_HSV, this._plainLBG || [0, 0, 0]);
      const cam = this.camera;
      this.clearFrame();
      const minX = cam.x - 120, maxX = cam.x + cam.w + 120;
      const minY = cam.y - 120, maxY = cam.y + cam.h + 120;
      const ldm = !!window.enableLDM;
      const showGlow = !ldm && window.showGlow !== false;
      this._guidesHidden = !!(window.isEditor || window.enablePortalGuide === false);
      const enabledMap = this.groupState?.enabledMap || null;
      // Let already emitted particles age even after their source leaves its
      // section. Visibility culling must never freeze a free particle trail.
      const systems = this.particleSystems, on = this._particleList(dt, area);
      let kept = 0;
      for (let i = 0; i < on.length; i++) {
        const system = systems[on[i]], obj = system.object;
        if (deferred && obj.groups.length) this._syncObject(obj);
        // An offscreen emitter can fill the view (large spawn areas, long
        // trails, warped clouds): the reach bounds its transformed emission
        // area, and only a near emitter gets the exact test.
        const pose = system.emitterPose();
        const reach = system.viewReach(pose) + 220;
        const ex = pose.x, ey = pose.y;
        const particleCam = system.viewCamera();
        const near = ex + reach >= particleCam.x && ex - reach <= particleCam.x + particleCam.w && ey + reach >= particleCam.y && ey - reach <= particleCam.y + particleCam.h;
        if (!near && !system.particles.length) {
          system.idle(dt);
          if (area || obj.isUIObject || !this._sleepParticles(system, ex, reach + obj.groups.length * LAZY_DRIFT)) on[kept++] = on[i];
          continue;
        }
        on[kept++] = on[i];
        // Custom particle objects have an invisible editor placeholder even
        // while their particles are visible. Only ambient object effects
        // inherit the drawable object's runtime visibility.
        const active = obj.enabled && (!system.ambient || !obj.hidden) && !obj.removed && !system.hiddenObject &&
          !window.noParticles && !(system.ambient && (system.noEffects || ldm)) &&
          !(ldm && obj.highDetail) && this._groupsEnabled(obj, enabledMap);
        system.update(dt, near && active && this._groupOpacity(obj) * this._channelOpacity(obj.baseID) >= 0.2 && system.intersectsView(particleCam, 220, pose));
        if (active) system.draw(pose);
      }
      on.length = kept;
      for (let i = this.spawnedParticleSystems.length - 1; i >= 0; i--) {
        const system = this.spawnedParticleSystems[i];
        // Spawn commands run even outside the view. Their independent clock
        // must not pause when the template is hidden, toggled or moved.
        system.step(dt);
        if (system.elapsed >= system.data.Duration && !system.particles.length) this.spawnedParticleSystems.splice(i, 1);
        else if (!window.noParticles) system.draw();
      }
      this._flushIndices();
      const t1 = prof ? performance.now() : 0;
      if (prof) prof.particles = (prof.particles || 0) + t1 - t0;
      const ranks = this._rankBuf;
      let count = 0;
      const live = this._tmpLive || (this._tmpLive = { x: 0, y: 0 });
      const od = this._od, os = this._os, cp = this._cp, gl = this._groupTable, byRank = this._byRank;
      const gOff = this._gOff;
      // A deferred object can be up to LAZY_DRIFT per deferred group away
      // from its recorded position; allow two such groups. Area moves can
      // carry an object into the view from as far as their distance.
      const slack = deferred ? 2 * LAZY_DRIFT : 0, areaSlack = area ? area.maxMove() : 0;
      const stamp = this._candStamp && this._candStamp.length >= byRank.length ? this._candStamp : (this._candStamp = new Uint32Array(byRank.length));
      const tag = this._candTag = ((this._candTag || 0) + 1) >>> 0 || 1;
      // The grid and the wide set hold every object once: their walk skips
      // the duplicate test (one more cache miss per visited object). UI,
      // Area and Link Visible additions come after it and test the stamp.
      const consider = (r, extra = 0, linked = false, unique = false) => {
        if (!unique && stamp[r] === tag) return;
        // Dense fields only: most visited objects are rejected here, and
        // reading the object itself would cost a cache miss each.
        const d = r * OD_STRIDE, df = od[d + 7], ui = (df & DF_UI) !== 0, reach = od[d + 2] + extra, ra = reach + slack;
        let px = od[d], py = od[d + 1];
        if (!ui && !linked && (px + ra < minX || px - ra > maxX || py + ra < minY || py - ra > maxY)) return;
        if (!(df & DF_DRAWABLE) || (ldm && (df & DF_HIGHDETAIL))) return;
        const groupCount = od[d + 9];
        if (groupCount) {
          if (gOff) {
            const g0 = od[d + 8];
            for (let k = 0; k < groupCount; k++) if (gOff[gl[g0 + k]]) return;
          } else if (this.groupState && !this._groupsEnabled(byRank[r], null)) return;
          if (deferred) {
            this._pending(r);
            px += this._pdx; py += this._pdy;
            if (!ui && !linked && (px + reach < minX || px - reach > maxX || py + reach < minY || py - reach > maxY)) return;
          }
        }
        cp[r * 2] = px; cp[r * 2 + 1] = py;
        stamp[r] = tag;
        ranks[count++] = r;
      };
      for (let cls = 0; cls < 3; cls++) {
        const grid = this.grids[cls];
        if (!grid.size) continue;
        const reach = CLASS_REACH[cls] + slack;
        const cx0 = Math.floor((minX - reach) / CELL), cx1 = Math.floor((maxX + reach) / CELL);
        const cy0 = Math.floor((minY - reach) / CELL), cy1 = Math.floor((maxY + reach) / CELL);
        if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > grid.size) {
          // A very wide view: walking the occupied cells is cheaper.
          for (const [key, list] of grid) {
            const cx = Math.floor(key / 65536) - 32768, cy = key % 65536 - 32768;
            if (cx < cx0 || cx > cx1 || cy < cy0 || cy > cy1) continue;
            for (let i = 0; i < list.length; i++) consider(list[i], 0, false, true);
          }
          continue;
        }
        for (let cx = cx0; cx <= cx1; cx++) {
          const column = (cx + 32768) * 65536 + 32768;
          for (let cy = cy0; cy <= cy1; cy++) {
            const list = grid.get(column + cy);
            if (list) for (let i = 0; i < list.length; i++) consider(list[i], 0, false, true);
          }
        }
      }
      for (const obj of this.wideObjects) consider(obj._rank, 0, false, true);
      // UI objects have left the world sections; camera position, zoom and
      // rotation must never cull a logo fixed to the screen.
      for (const obj of this.uiObjects) if (!obj.removed) consider(obj._rank);
      // Members of area-moved groups can be carried into the view.
      if (areaSlack) for (const group of area.moveGroups()) for (const obj of this.groups.get(group) || []) {
        if (byRank[obj._rank] === obj) consider(obj._rank, areaSlack);
      }
      if (this._linkedUnits) for (let i = 0; i < count; i++) {
        const unit = this._linkedUnits[byRank[ranks[i]].index];
        if (!unit || unit.stamp === tag) continue;
        unit.stamp = tag;
        for (const obj of unit.objects) if (!obj.removed) consider(obj._rank, 0, true);
      }
      // Every object sits in exactly one cell (or the wide set), so the
      // candidates are unique; the native typed-array sort restores the
      // global draw order.
      const t2 = prof ? performance.now() : 0;
      if (prof) { prof.cull = (prof.cull || 0) + t2 - t1; prof.candidates = (prof.candidates || 0) + count; prof.frames = (prof.frames || 0) + 1; }
      const order = ranks.subarray(0, count);
      order.sort();
      const cx0 = cam.x, cx1 = cam.x + cam.w;
      const enterState = this.enterState;
      const customEnter = enterState && (enterState.channels[0].size || enterState.channels[1].size);
      let fast = 0;
      for (let i = 0; i < count; i++) {
        const r = order[i], px = cp[r * 2], py = cp[r * 2 + 1], d = r * OD_STRIDE;
        const flags = od[d + 10], margin = od[d + 11];
        const enter = customEnter && enterState.needsPrepare(byRank[r], px) ? enterState : null;
        const df = od[d + 7], ui = (df & DF_UI) !== 0;
        this._objectDrawFlags = ui ? UI_DRAW_FLAGS : 0;
        const dense = !ui && (flags & OF_FAST) && !(df & DF_RING) && !this.legacyPrepare;
        const fade = dense && (df & DF_EFFECT) ? (!enter && !(areaRank && areaRank[r]) ? this._enterFade(r, df, px, flags) : -1) : 255;
        if (dense && fade >= 0 && ((df & DF_EFFECT) || enter || (flags & OF_IGNOREFADE) || (px - margin >= cx0 && px + margin <= cx1))) {
          this._fastPrepare(r, px, py, showGlow, areaRank && areaRank[r] ? area : null, enter, fade);
          fast++;
        } else if (!ui && (flags & OF_FAST) && !(df & (DF_EFFECT | DF_RING)) && !(flags & (OF_IGNOREFADE | OF_DONTFADE)) && !enter &&
            !(areaRank && areaRank[r]) && !this.legacyPrepare && this._fadedOut(r, px)) {
          // Past the edge fade: nothing to draw (see _fadedOut).
        } else this._prepareObject(byRank[r], px, py, showGlow);
      }
      this._objectDrawFlags = 0;
      const t3 = prof ? performance.now() : 0;
      if (prof) { prof.prepare = (prof.prepare || 0) + t3 - t2; prof.fast = (prof.fast || 0) + fast; }
      this._drawSpriteAnimations();
      this._drawPickupEffects();
      this.gradientState?.draw(this);
      // Object quads arrive in draw order; particles and gradients add their
      // own, and _buildVertices orders a batch that is not already sorted.
      const t4 = prof ? performance.now() : 0;
      this._buildVertices();
      if (prof) { prof.gradSort = (prof.gradSort || 0) + t4 - t3; prof.build = (prof.build || 0) + performance.now() - t4; prof.quads = (prof.quads || 0) + this.quadCount; }
    }

    // ------------------------------------------------- sleeping emitters
    // An emitter without particles whose emission area is far from the view
    // only advances its clock each frame. Thousands of them (LIMBO) cost more
    // than the visible scene, mostly in cache misses. Such an emitter waits
    // in the X bins its padded area covers, owing its clock; the view
    // reaching one of those bins, a transform of its object (sync, index) or
    // a reset wakes it, and it pays the clock it owes. The pad covers the
    // deferred group moves its object has not taken yet (< LAZY_DRIFT each).
    _particleList(dt, area) {
      const all = this.particleSystems;
      this._psFrame++;
      if (!this._psOn || this._psCount !== all.length) {
        const on = this._psOn = [];
        for (let i = 0; i < all.length; i++) { all[i]._psIndex = i; if (!all[i]._asleep) on.push(i); }
        this._psCount = all.length; this._psWoken.length = 0;
      }
      const bins = this._psBins;
      if (bins.size) {
        const owed = this.time - dt;
        if (area) this._wakeAllParticles(owed);
        else {
          const cam = this.camera;
          for (let b = Math.floor(cam.x / PS_BIN), end = Math.floor((cam.x + cam.w) / PS_BIN); b <= end; b++) {
            const sleepers = bins.get(b);
            if (sleepers) while (sleepers.length) this._wakeParticles(sleepers[sleepers.length - 1], owed);
          }
        }
      }
      const woken = this._psWoken;
      if (woken.length) {
        // Keep the original order: it is the draw order of equal keys.
        woken.sort((a, b) => a - b);
        const on = this._psOn, merged = new Array(on.length + woken.length);
        let i = 0, j = 0, k = 0;
        while (i < on.length && j < woken.length) merged[k++] = on[i] < woken[j] ? on[i++] : woken[j++];
        while (i < on.length) merged[k++] = on[i++];
        while (j < woken.length) merged[k++] = woken[j++];
        this._psOn = merged; woken.length = 0;
      }
      return this._psOn;
    }
    _sleepParticles(system, x, pad) {
      if (system._wakeHold > this._psFrame) return false;
      const b0 = Math.floor((x - pad) / PS_BIN), b1 = Math.floor((x + pad) / PS_BIN);
      if (b1 - b0 > 32) return false;
      const bins = this._psBins;
      for (let b = b0; b <= b1; b++) {
        let list = bins.get(b);
        if (!list) bins.set(b, list = []);
        list.push(system);
      }
      system._asleep = true; system._bin0 = b0; system._bin1 = b1; system._clock = this.time;
      return true;
    }
    // owed: the time up to which the frames it slept through have passed.
    _wakeParticles(system, owed) {
      if (!system._asleep) return;
      system._asleep = false;
      const bins = this._psBins;
      for (let b = system._bin0; b <= system._bin1; b++) {
        const list = bins.get(b);
        if (!list) continue;
        const i = list.indexOf(system);
        if (i >= 0) { list[i] = list[list.length - 1]; list.pop(); }
        if (!list.length) bins.delete(b);
      }
      if (owed > system._clock) system.idle(owed - system._clock);
      this._psWoken.push(system._psIndex);
    }
    // A moving emitter stays awake for 60 frames instead of waking each tick.
    _wakeObjectParticles(obj) {
      const a = obj.particleSystem, b = obj.ambientParticleSystem;
      if (a) this._holdParticles(a);
      if (b) this._holdParticles(b);
    }
    _holdParticles(system) {
      if (system.renderer !== this) return;
      system._wakeHold = this._psFrame + 60;
      if (system._asleep) this._wakeParticles(system, this.time);
    }
    _wakeAllParticles(owed) {
      for (const list of this._psBins.values()) while (list.length) this._wakeParticles(list[list.length - 1], owed);
    }
    // A snapshot reads every clock.
    _settleParticleClocks() {
      for (const list of this._psBins.values()) for (const system of list) {
        if (this.time > system._clock) { system.idle(this.time - system._clock); system._clock = this.time; }
      }
    }

    // Legacy skeletal animations still calculate their poses as Phaser
    // sprites. Submit those poses to the native batches so fire-sheet beasts
    // can interleave with lava and decorations at their authored Z layer.
    _drawSpriteAnimations() {
      for (const { node, animation } of this.spriteAnimations) {
        if (animation._culled || !node.enabled || node.removed || node.levelObj.hidden ||
            (window.enableLDM && node.highDetail) || node.groups.some(g => this.groupState && !this.groupState.enabled(g))) continue;
        const point = this.livePosition(node), af = node.affine;
        const area = {};
        this.areaState?.active && this.areaState.forObject(node, point.x, point.y, area);
        // Keep the native hierarchy: object transform, then the part's pose.
        // The legacy sprites also participate in Move/Enter effects, which
        // can overwrite their pose positions and scales later in the tick.
        // Flattening those sprites detached jaws/eyes and lost the shear of
        // a rotated jaw inside a stretched or reflected monster.
        const root = area.linearActive ? [...area.linear] : mul(af, nodeToParent(0, 0, node.rotationX + (area.rot || 0), node.rotationY + (area.rot || 0),
          node.scaleX * (area.sx ?? 1) * (node.flipX ? -1 : 1), node.scaleY * (area.sy ?? 1) * (node.flipY ? -1 : 1), 0, 0));
        root[4] = point.x + (area.dx || 0); root[5] = point.y + (area.dy || 0);
        const pose = animation.lastPose || animation.referencePose;
        const sprites = [];
        for (const part of animation.parts) {
          const target = pose?.find(p => p.tag === part.tag) || pose?.[part.poseIndex];
          if (!target) continue;
          for (const sprite of [part.sprite, ...(part.companions || [])]) sprites.push({ sprite, target });
        }
        sprites.sort((a, b) => a.sprite._eeZDepth - b.sprite._eeZDepth);
        for (const { sprite, target } of sprites) {
          if (!sprite.active || !sprite.visible || !(sprite.alpha > 0)) continue;
          const info = this.frames.get(sprite.frame?.name);
          if (!info) continue;
          // The eye and several jaws have transparent source margins.
          // Their trimmed atlas rectangle must retain its content-box offset,
          // just as compileTree does for ordinary sprite children.
          const part = makePart({ info, qx: info.ox, qy: info.oy });
          // Beast 01's separate outline follows position/rotation, retaining
          // its own unit scale (native CCSpritePart delegate, 644dd4..644e41).
          const fixedOutline = node.id === 918 && sprite._eeBeastColorSprite;
          const local = nodeToParent(target.x, target.y, target.rotation, target.rotation,
            (fixedOutline ? 1 : target.scaleX) * (target.flipX ? -1 : 1), (fixedOutline ? 1 : target.scaleY) * (target.flipY ? -1 : 1),
            info.cw / 2, info.ch / 2);
          // The eye is a child centred on the head, and the colour pieces
          // mirror their animated part. All share that part's exact centre.
          const matrix = mul(root, local);
          const tint = sprite.tintTopLeft, color = [(tint >>> 16) & 255, (tint >>> 8) & 255, tint & 255];
          if (area.tints && !sprite._eeBeastColorSprite) {
            const main = color.slice(), detail = color.slice();
            this.areaState.applyTints(node, area, main, detail, true);
            const selected = sprite._eeColorKind === 'detail' ? detail : main;
            color.splice(0, 3, ...selected);
          }
          const blend = sprite.blendMode === Phaser.BlendModes.ADD;
          const kind = sprite._eeIsGlowSprite ? "glow" : node.kind;
          this._writePart(this._batch(node.zLayer, blend, kind), node.zOrder * 1048576 + node.arrival,
            part, matrix, color, sprite.alpha * (area.op ?? 1));
        }
      }
    }

    // Ranks of objects in groups an active area effect targets: they take the
    // general path, which applies the area state (gd-area.js).
    _syncAreaRanks(area) {
      const n = this._byRank.length;
      if (this._areaRankVersion === area.version && this._areaRankOrder === this._byRank && this._areaRank) return this._areaRank;
      const ranks = this._areaRank && this._areaRank.length >= n ? this._areaRank : new Uint8Array(n);
      ranks.fill(0);
      for (const group of area.byGroup.keys()) for (const obj of this.groups.get(group) || []) {
        if (this._byRank[obj._rank] === obj) ranks[obj._rank] = 1;
      }
      this._areaRank = ranks; this._areaRankVersion = area.version; this._areaRankOrder = this._byRank;
      return ranks;
    }

    _groupsEnabled(obj, enabledMap) {
      if (!enabledMap) return !this.groupState || obj.groups.every(id => this.groupState.enabled(id));
      const groups = obj.groups;
      for (let i = 0; i < groups.length; i++) if (enabledMap[groups[i]] === false) return false;
      return true;
    }

    // Link Visible (3662) is a load-time declaration, independent of the
    // trigger's X/touch/spawn flags. Native setup 33a090 merges declarations
    // that share an object; visibility collection 33fdb0 then includes every
    // enabled member when any member is in view. Membership, not opacity or
    // collision state, is shared. Keep the normal global draw order.
    _syncLinkedVisibility() {
      if (this._linkedVersion === this.membershipVersion) return;
      this._linkedVersion = this.membershipVersion;
      const parent = new Int32Array(this.objects.length).fill(-1);
      const root = i => { let p = i; while (parent[p] !== p) p = parent[p]; while (i !== p) { const n = parent[i]; parent[i] = p; i = n; } return p; };
      for (const group of this.linkedVisibilityGroups) {
        let first = -1;
        for (const obj of this.groups.get(group) || []) {
          if (obj.removed) continue;
          const i = obj.index;
          if (parent[i] < 0) parent[i] = i;
          if (first < 0) first = i; else parent[root(i)] = root(first);
        }
      }
      const units = new Map(), byIndex = new Array(this.objects.length);
      for (let i = 0; i < parent.length; i++) if (parent[i] >= 0) {
        const p = root(i); let unit = units.get(p);
        if (!unit) units.set(p, unit = { objects: [], stamp: 0 });
        unit.objects.push(this.objects[i]); byIndex[i] = unit;
      }
      this._linkedUnits = byIndex;
    }

    // _colorForMode for the fast path: the same rules, reading the tables.
    _fastColor(r, id, isMain, out, flags, entry) {
      const cm = this.colorManager, s = r * OS_STRIDE, os = this._os;
      let base;
      if (id <= 0) base = WHITE;
      else if (id === 1012) {
        const baseID = os[s];
        const src = baseID > 0 && baseID !== 1012 ? this._channelColor(baseID) : WHITE;
        base = gdTransformColorRGB(src[0], src[1], src[2], LIGHTER_HSV, this._lighterTmp || (this._lighterTmp = [0, 0, 0]));
      } else base = entry ? entry.color : this._channelColor(id);
      const groupCount = os[s + 23], gPulse = this._gPulse;
      const hsvIndex = os[s + (isMain ? 24 : 25)];
      if (groupCount && gPulse && this._gPulseList.length) {
        const treatAsMain = isMain ? !(flags & OF_CUSTOMSPRITE) : false;
        if (isMain || os[s + 1] !== 1012) {
          const gl = this._groupTable, g0 = os[s + 22];
          let any = false;
          for (let k = 0; k < groupCount; k++) if (gPulse[gl[g0 + k]]) { any = true; break; }
          if (any) {
            // Objects sharing a group set, channel, HSV and role pulse to
            // the same colour this frame: compute it once.
            if (this._pulseStamp !== this._channelStamp) { (this._pulseMemo || (this._pulseMemo = new Map())).clear(); this._pulseStamp = this._channelStamp; }
            const idKey = id === 1012 ? 1102 + os[s] : id;
            const key = hsvIndex < 16383 ? ((os[s + 35] * 4096 + idKey) * 16384 + hsvIndex + 1) * 4 + (isMain ? 2 : 0) + (treatAsMain ? 1 : 0) : -1;
            let c = key >= 0 ? this._pulseMemo.get(key) : undefined;
            if (!c) {
              out[0] = base[0]; out[1] = base[1]; out[2] = base[2];
              for (let k = 0; k < groupCount; k++) {
                const g = gl[g0 + k];
                if (gPulse[g]) cm.colorForGroup(g, out, treatAsMain, out);
              }
              if (hsvIndex >= 0) gdTransformColorRGB(out[0], out[1], out[2], this._hsvTable[hsvIndex], out);
              c = [out[0], out[1], out[2]];
              if (key >= 0) this._pulseMemo.set(key, c);
            }
            out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
            return out;
          }
        }
      }
      if (hsvIndex < 0) { out[0] = base[0]; out[1] = base[1]; out[2] = base[2]; return out; }
      const hm = this._hm, h = r * 12 + (isMain ? 0 : 6);
      if (hm[h] !== base[0] || hm[h + 1] !== base[1] || hm[h + 2] !== base[2]) {
        hm[h] = base[0]; hm[h + 1] = base[1]; hm[h + 2] = base[2];
        const t = gdTransformColorRGB(base[0], base[1], base[2], this._hsvTable[hsvIndex], this._hsvTmp || (this._hsvTmp = [0, 0, 0]));
        hm[h + 3] = t[0]; hm[h + 4] = t[1]; hm[h + 5] = t[2];
      }
      out[0] = hm[h + 3]; out[1] = hm[h + 4]; out[2] = hm[h + 5];
      return out;
    }

    _fastGroupOpacity(r) {
      const os = this._os, s = r * OS_STRIDE, count = os[s + 23];
      const gOp = this._gOp;
      if (!gOp || !count) return 1;
      const gt = this._groupTable, g0 = os[s + 22];
      let v = 1;
      for (let k = g0, end = g0 + count; k < end; k++) {
        const o = gOp[gt[k]];
        if (o !== 1) v *= o;
      }
      return v;
    }

    // _prepareObject using dense tables, including Area and custom Enter
    // effects. Rings, animation, rotating parts and labels use the general
    // path. Both paths preserve the same transform/colour/opacity order.
    _fastPrepare(r, px, py, showGlow, areaState = null, enterState = null, fade = 255) {
      const os = this._os, od = this._od, s = r * OS_STRIDE, d = r * OD_STRIDE;
      const flags = os[s + 5], hasDetail = (flags & OF_DETAIL) !== 0;
      let k = 1;
      if (!(flags & OF_NOAUDIO) && (flags & OF_AUDIO)) {
        const meter = this.audioScale;
        k = (flags & OF_RING) && !window.isEditor ? Math.min(1.2, meter + 0.3)
          : (flags & OF_CUSTOMAUDIO) ? os[s + 16] + (os[s + 17] - os[s + 16]) * (meter - 0.1) : meter;
      }
      if (!areaState && !enterState) {
        // The cull keeps a margin for effects that move art; without them,
        // art entirely outside the view (and its shake) is clipped. The
        // reach bounds the parts and glow at the object's largest axis scale
        // and the affine's norm; skewed axes stretch up to sqrt(2) more.
        const cam = this.camera, reach = od[d + 2] * 1.5 * Math.max(1, Math.abs(k)) + 4 + Math.abs(cam.shakeX) + Math.abs(cam.shakeY);
        if (px + reach < cam.x || px - reach > cam.x + cam.w || py + reach < cam.y || py - reach > cam.y + cam.h) return;
      }
      const baseID = os[s], detailID = os[s + 1];
      const main = this._fastMain, detail = this._fastDetail;
      const eb = baseID > 0 ? this._channelEntry(baseID) : null;
      this._fastColor(r, baseID, true, main, flags, eb);
      const groupOpacity = os[s + 23] ? this._fastGroupOpacity(r) : 1;
      let mainOpacity = (eb ? eb.opacity : 1) * groupOpacity;
      let detailOpacity = 1, blendDetail = false;
      const blendBase = eb ? eb.blend : false;
      if (hasDetail) {
        const ed = detailID > 0 ? this._channelEntry(detailID) : null;
        this._fastColor(r, detailID, false, detail, flags, ed);
        detailOpacity = (ed ? ed.opacity : 1) * groupOpacity;
        blendDetail = detailID === 1012 ? blendBase : (ed ? ed.blend : false);
      }
      // Area effects (as in _prepareObject).
      const obj = areaState || enterState ? this._byRank[r] : null;
      const area = areaState && areaState.forObject(obj, px, py, this._areaOut || (this._areaOut = {})) ? this._areaOut : null;
      if (area) {
        if (area.tints) areaState.applyTints(obj, area, main, detail, hasDetail);
        if (area.op !== 1) { mainOpacity *= area.op; detailOpacity *= area.op; }
        px += area.dx; py += area.dy;
      }
      let enter = null;
      if (enterState) {
        const isEnter = obj.enterType !== -1 && obj.enterType !== -15 ? true : obj.exitType !== -1 && obj.exitType !== -15 ? false : px > this.camera.x + this.camera.w / 2;
        enter = enterState.forObject(obj, isEnter, px, main, detail, this._enterOut || (this._enterOut = {}));
        const enterOp = Math.trunc(enter.op * 255) / 255;
        mainOpacity *= enterOp; detailOpacity *= enterOp;
        px += enter.dx; py += enter.dy;
      }
      // An entrance's edge fade (see _enterFade), applied as setOpacity does.
      if (fade !== 255) { const op = fade / 255; mainOpacity *= op; detailOpacity *= op; }
      const separateDetail = hasDetail && blendBase !== blendDetail;
      const combo = (blendBase ? 2 : 0) | (blendDetail ? 1 : 0);
      // transform
      let sx = k === 1 ? os[s + 6] : os[s + 6] * k, sy = k === 1 ? os[s + 7] : os[s + 7] * k;
      let r0 = os[s + 8], r1 = os[s + 9], r2 = os[s + 10], r3 = os[s + 11];
      if (enter) { sx *= enter.sx; sy *= enter.sy; }
      if (area) { sx *= area.sx; sy *= area.sy; }
      const effectRot = (area?.rot || 0) + (enter?.rot || 0);
      if (effectRot) {
        const rx = -(obj.rotationX + effectRot) * Math.PI / 180, ry = -(obj.rotationY + effectRot) * Math.PI / 180;
        r0 = Math.cos(ry); r1 = Math.sin(ry); r2 = -Math.sin(rx); r3 = Math.cos(rx);
      }
      const a = r0 * sx, b = r1 * sx, c = r2 * sy, dd = r3 * sy;
      const f0 = od[d + 3], f1 = od[d + 4], f2 = od[d + 5], f3 = od[d + 6];
      let m0 = f0 * a + f2 * b, m1 = f1 * a + f3 * b, m2 = f0 * c + f2 * dd, m3 = f1 * c + f3 * dd;
      if (area?.linearActive) {
        const m = GDAreaState.renderLinear(area, k * (enter?.sx ?? 1), k * (enter?.sy ?? 1), enter?.rot || 0,
          this._areaLinear || (this._areaLinear = [0, 0, 0, 0]));
        [m0, m1, m2, m3] = m;
      }
      const mainIsBlackBlend = blendBase && main[0] === 0 && main[1] === 0 && main[2] === 0;
      const baseOp = mainOpacity;
      const mainSpriteOp = mainIsBlackBlend ? 0 : baseOp;
      const detailIsBlackBlend = blendDetail && detail[0] === 0 && detail[1] === 0 && detail[2] === 0;
      const detailSpriteOp = detailIsBlackBlend ? 0 : detailOpacity;
      const bco = os[s + 14];
      const childOp = bco > 0 ? bco * baseOp : baseOp;
      const sortKey = os[s + 3];
      const mainBatch = os[s + 26 + combo], detailBatch = os[s + 30 + combo];
      const isObjectBlack = (flags & OF_BLACK) !== 0, isColorSpriteBlack = (flags & OF_CSBLACK) !== 0;
      const guidesHidden = this._guidesHidden, pt = this._pt, pl = this._pl;
      let lighter = null;
      const p0 = os[s + 18], pn = os[s + 19];
      for (let i = 0; i < pn; i++) {
        const id = pl[p0 + i], t = id * PT_STRIDE;
        if ((pt[t + 22] & 2) && guidesHidden) continue;
        const role = pt[t + 15], tag = pt[t + 16];
        let color, opacity;
        if (role === ROLE_MAIN) { color = isObjectBlack ? BLACK : main; opacity = mainSpriteOp; }
        else if (role === ROLE_DETAIL) { color = isColorSpriteBlack ? BLACK : detail; opacity = detailSpriteOp; }
        else if (role === ROLE_CHILD) {
          if (tag === 2) {
            if (!lighter) lighter = gdTransformColorRGB(main[0], main[1], main[2], LIGHTER_HSV, this._fastLighter);
            color = lighter;
          } else if (!isColorSpriteBlack || tag === 997) color = main;
          else color = BLACK;
          opacity = tag === 997 ? baseOp : childOp;
        } else {
          const fc = this._fastFixed; fc[0] = pt[t + 18]; fc[1] = pt[t + 19]; fc[2] = pt[t + 20];
          color = fc; opacity = baseOp * pt[t + 21];
        }
        if (opacity <= 0.0005) continue;
        this._fastQuad(pt[t + 17] && separateDetail ? detailBatch : mainBatch, sortKey, id, m0, m1, m2, m3, px, py, color, opacity);
      }
      const g0 = os[s + 20], gn = os[s + 21];
      if (showGlow && gn) {
        let glowColor = main;
        if (flags & OF_CUSTOMGLOW) glowColor = (flags & OF_GLOWLBG) ? this._channelColor(1007) : this._plainLBG;
        if (flags & OF_CANTGLOW) glowColor = WHITE;
        const glowOp = ((flags & OF_CUSTOMGLOW) ? baseOp : (mainIsBlackBlend ? 0 : baseOp)) * os[s + 15];
        if (glowOp > 0.0005) {
          const glowBatch = os[s + 34];
          for (let i = 0; i < gn; i++) {
            const id = pl[g0 + i];
            if ((pt[id * PT_STRIDE + 22] & 2) && guidesHidden) continue;
            this._fastQuad(glowBatch, sortKey, id, m0, m1, m2, m3, px, py, glowColor, glowOp);
          }
        }
      }
    }

    // One part quad: node matrix = object matrix x part matrix, with the
    // upright and vertex-modifier rules of _emitPart/_writePart.
    _fastQuad(bi, key, id, o0, o1, o2, o3, o4, o5, color, opacity) {
      const pt = this._pt, t = id * PT_STRIDE;
      const p0 = pt[t + 9], p1 = pt[t + 10], p2 = pt[t + 11], p3 = pt[t + 12], p4 = pt[t + 13], p5 = pt[t + 14];
      let a = o0 * p0 + o2 * p1, nb = o1 * p0 + o3 * p1, c = o0 * p2 + o2 * p3, d = o1 * p2 + o3 * p3;
      let tx = o0 * p4 + o2 * p5 + o4, ty = o1 * p4 + o3 * p5 + o5;
      const pflags = pt[t + 22];
      if (pflags & 1) {
        const cx = pt[t + 23], cy = pt[t + 24];
        const px = a * cx + c * cy + tx, py = nb * cx + d * cy + ty;
        const ux = Math.hypot(a, nb), uy = Math.hypot(c, d);
        a = ux; nb = 0; c = 0; d = uy;
        tx = px - ux * cx; ty = py - uy * cy;
      }
      const b = this._quad(bi, key, pt[t], 0), q = b.n - 1, F = b.f, U = b.u, o = q * 16, uo = q * 6;
      const x0 = pt[t + 1], y0 = pt[t + 2], x1 = pt[t + 3], y1 = pt[t + 4];
      const u0 = pt[t + 5], u1 = pt[t + 6], v0 = pt[t + 7], v1 = pt[t + 8];
      const al = Math.max(0, Math.min(255, Math.round(opacity * 255)));
      const rgbOpacity = opacity;
      const col = ((al << 24) | (Math.round(color[2] * rgbOpacity) << 16) | (Math.round(color[1] * rgbOpacity) << 8) | Math.round(color[0] * rgbOpacity)) >>> 0;
      if (pflags & 4) {
        const h = pt[t + 25];
        for (let k = 0; k < 4; k++) {
          const top = k < 2, lx = k & 1 ? x1 : x0, uu = k & 1 ? u1 : u0;
          let ly = top ? y1 : y0, vv = top ? v0 : v1;
          const mod = pt[t + 26 + k];
          if (mod) {
            ly += (top ? -1 : 1) * h * mod;
            if (!top || mod >= 0) vv += (top ? 1 : -1) * (v1 - v0) * mod;
          }
          const p = o + k * 4;
          F[p] = a * lx + c * ly + tx; F[p + 1] = nb * lx + d * ly + ty; F[p + 2] = uu; F[p + 3] = vv;
          U[uo + k] = col;
        }
      } else {
        F[o] = a * x0 + c * y1 + tx; F[o + 1] = nb * x0 + d * y1 + ty; F[o + 2] = u0; F[o + 3] = v0;
        F[o + 4] = a * x1 + c * y1 + tx; F[o + 5] = nb * x1 + d * y1 + ty; F[o + 6] = u1; F[o + 7] = v0;
        F[o + 8] = a * x0 + c * y0 + tx; F[o + 9] = nb * x0 + d * y0 + ty; F[o + 10] = u0; F[o + 11] = v1;
        F[o + 12] = a * x1 + c * y0 + tx; F[o + 13] = nb * x1 + d * y0 + ty; F[o + 14] = u1; F[o + 15] = v1;
        U[uo] = col; U[uo + 1] = col; U[uo + 2] = col; U[uo + 3] = col;
      }
      if (this.debugItems) this.buckets[bi].push({ part: this._ptParts[id], m: [a, nb, c, d, tx, ty], color: color.slice(0, 3), opacity, sortKey: key,
        positions: null, colors: null, above: null, screen: false, gradientBlend: -1, overlay: false });
    }

    _prepareObject(obj, px, py, showGlow) {
      if (obj.animation) {
        if (obj.animateOnTrigger && !obj.animationTriggered) return;
        if (obj.animateOnTrigger && obj.animationStart === null) obj.animationStart = this.time;
        const count = obj.animation.length;
        const elapsed = obj.animateOnTrigger ? Math.max(0, this.time - obj.animationStart) : this.time;
        const frame = Math.floor(elapsed / obj.animationInterval * Math.abs(obj.animationSpeed));
        if (obj.animateOnTrigger && frame >= count) { obj.animationTriggered = false; return; }
        const offset = obj.offsetAnimation ? obj.singleFrame : obj.animateOnTrigger ? 0 : obj.animationOffset;
        const phase = (frame + offset) % count;
        const index = obj.singleFrame && !obj.offsetAnimation ? Math.min(count - 1, obj.singleFrame - 1)
          : obj.animationSpeed < 0 ? count - phase - 1 : phase;
        obj.parts = obj.animation[index];
      }
      const cm = this.colorManager;
      const def = obj.def;
      const F = obj._F || (obj._F = prepareFlags(def));
      const main = obj._main || (obj._main = [255, 255, 255]);
      const detail = obj._detail || (obj._detail = [255, 255, 255]);
      // Area effects (gd-area.js): offsets, rotation, scale, opacity, tints.
      const areaState = this.areaState;
      const area = areaState && areaState.active && this._areaRank && this._areaRank[obj._rank] &&
        areaState.forObject(obj, px, py, this._areaOut || (this._areaOut = {})) ? this._areaOut : null;
      // Colours wait for the edge fade: a third of the candidates are fully
      // faded out. A custom Enter effect reads them first.
      let colored = false;
      // GameObject::shouldBlendColor
      const blendBase = obj.baseID > 0 && this._channelBlend(obj.baseID);
      let blendDetail = false;
      if (obj.hasDetail) blendDetail = obj.detailID === 1012 ? blendBase : (obj.detailID > 0 && this._channelBlend(obj.detailID));
      // GameObject::addMainSpriteToParent / addColorSpriteToParent
      let mainLayer = obj.zLayer;
      if (blendBase && obj.hasDetail && !blendDetail && !F.colorZLayerRelated) mainLayer += 1;
      const separateDetail = obj.hasDetail && blendBase !== blendDetail;
      let detailLayer = obj.zLayer;
      if (separateDetail && blendDetail && F.colorZLayerRelated) detailLayer += 1;
      // --- fade / enter effects (PlayLayer::updateVisibility)
      const cam = this.camera;
      const visualX = px + (area?.dx || 0), visualY = py + (area?.dy || 0);
      let fade = 255;
      let glowFade = null;
      let effectOffset = null;
      if (obj.isUIObject) {
        // UI sprites are outside PlayLayer::updateVisibility's edge fades.
      } else if (F.isInvisibleBlock) {
        // PlayLayer::updateInvisibleBlock and its updateVisibility arguments.
        // Geode bindings 2.2074; also checked against the supplied Steam exe.
        // These blocks retain 5% outline / 15% glow near the player, becoming
        // visible farther away and fading again at the viewport boundary.
        const x = visualX + (visualX > cam.x + cam.w * 0.5 ? -obj.fadeMargin : obj.fadeMargin);
        const leftBound = cam.w * 0.5 - 75, rightBound = leftBound + 110;
        const right = x > cam.x + cam.w * 0.5;
        const relative = Math.max(0, Math.min(1, right ? (cam.x + cam.w - x) * 0.02 : (x - cam.x) / 70));
        const factor = Math.max(0, Math.min(1, x > cam.x + rightBound
          ? (x - cam.x - rightBound) / Math.max(1, cam.w - rightBound - 90)
          : (cam.x + leftBound - x) / Math.max(1, leftBound - 30)));
        fade = Math.trunc(Math.min(relative, factor * 0.95 + 0.05) * 255);
        glowFade = Math.trunc(Math.min(relative, factor * 0.85 + 0.15) * 255) / 255;
      } else {
        let isEnter;
        let current;
        if (obj.enterType !== -1 && obj.enterType !== -15) { isEnter = true; current = obj.enterType; }
        else if (obj.exitType !== -1 && obj.exitType !== -15) { isEnter = false; current = obj.exitType; }
        else { isEnter = visualX > cam.x + cam.w * 0.5; current = -1; }
        const effect = (isEnter ? this.enterMap : this.exitMap)[obj.enterChannel];
        if (effect === -15) {
          this._objectColors(obj, F, main, detail, area); colored = true;
          effectOffset = this.enterState?.forObject(obj, isEnter, visualX, main, detail, this._enterOut || (this._enterOut = {}));
          if (effectOffset) fade = Math.trunc(effectOffset.op * 255);
        } else if (obj.ignoreFade || effect === -14) {
          fade = 255;
        } else if (F.intrinsicDontFade && !(F.isSolidColorBlock && (blendBase || blendDetail)) &&
                   (current === -2 || current === -1) && effect === -2) {
          fade = 255;
          effectOffset = this._applyEnterEffect(obj, effect, isEnter, visualX, visualY);
        } else {
          const margin = obj.fadeMargin;
          let d = isEnter ? (cam.x + cam.w - (visualX - margin)) : ((visualX + margin) - cam.x);
          d = Math.max(0, Math.min(1, d / 70));
          fade = Math.trunc(d * 255);
          effectOffset = this._applyEnterEffect(obj, effect, isEnter, visualX, visualY);
        }
      }
      // Zero opacity skips every part and glow (glowFade is zero with fade).
      // An orb's click pulse still has to expire.
      if (fade === 0 && obj.ringHitTime === undefined) return;
      if (!colored) this._objectColors(obj, F, main, detail, area);
      let mainOpacity = this._channelOpacity(obj.baseID);
      const groupOpacity = this._groupOpacity(obj);
      mainOpacity *= groupOpacity;
      let detailOpacity = 1;
      if (obj.hasDetail) detailOpacity = this._channelOpacity(obj.detailID) * groupOpacity;
      if (area && area.op !== 1) { mainOpacity *= area.op; detailOpacity *= area.op; }
      // --- transform
      let ox = visualX, oy = visualY, esx = obj.scaleX, esy = obj.scaleY, audioScale = 1, ringScale = 1;
      if (!obj.noAudioScale && F.usesAudioScale) {
        const meter = this.audioScale;
        // Native customAudioScale: min + (max-min) * (audioScale - 0.1).
        // The object's hitbox never changes with the visual audio scale.
        const pulse = obj.isRing && !window.isEditor ? Math.min(1.2, meter + 0.3)
          : F.customAudioScale ? def.amin + (def.amax - def.amin) * (meter - 0.1) : meter;
        audioScale = pulse; esx *= pulse; esy *= pulse;
      }
      if (effectOffset) {
        ox += effectOffset.dx; oy += effectOffset.dy;
        esx *= effectOffset.sx ?? effectOffset.scale; esy *= effectOffset.sy ?? effectOffset.scale;
      }
      if (area) { esx *= area.sx; esy *= area.sy; }
      if (obj.ringHitTime !== undefined) {
        const elapsed = Math.max(0, this.time - obj.ringHitTime);
        const release = (window.orbClickShrinkTime || 250) / 1000;
        if (elapsed < 0.08 + release) {
          const phase = elapsed < 0.08 ? elapsed / 0.08 : 1 - (elapsed - 0.08) / release;
          const pulse = 1 + ((window.orbClickScale || 1) - 1) * phase;
          ringScale = pulse; esx *= pulse; esy *= pulse;
        } else obj.ringHitTime = undefined;
      }
      const effectRot = (area?.rot || 0) + (effectOffset?.rot || 0);
      const rotX = obj.rotationX + effectRot, rotY = obj.rotationY + effectRot;
      if (!obj._rotationMatrix || obj._matrixRotX !== rotX || obj._matrixRotY !== rotY) {
        const rx = -rotX * Math.PI / 180, ry = -rotY * Math.PI / 180;
        obj._rotationMatrix = [Math.cos(ry), Math.sin(ry), -Math.sin(rx), Math.cos(rx)];
        obj._matrixRotX = rotX; obj._matrixRotY = rotY;
      }
      const rot = obj._rotationMatrix, af = obj.affine;
      const sx = esx * (obj.flipX ? -1 : 1), sy = esy * (obj.flipY ? -1 : 1);
      const a = rot[0] * sx, b = rot[1] * sx, c = rot[2] * sy, d = rot[3] * sy;
      const objMatrix = obj._objectMatrix || (obj._objectMatrix = [0, 0, 0, 0, 0, 0]);
      objMatrix[0] = af[0] * a + af[2] * b; objMatrix[1] = af[1] * a + af[3] * b;
      objMatrix[2] = af[0] * c + af[2] * d; objMatrix[3] = af[1] * c + af[3] * d;
      if (area?.linearActive) GDAreaState.renderLinear(area,
        audioScale * ringScale * (effectOffset?.sx ?? effectOffset?.scale ?? 1),
        audioScale * ringScale * (effectOffset?.sy ?? effectOffset?.scale ?? 1), effectOffset?.rot || 0, objMatrix);
      objMatrix[4] = ox; objMatrix[5] = oy;
      if (obj.pickupBob && !window.isEditor) {
        // The interactive artwork floats inside its fixed collision object.
        // Native 30d71f..30d7bb: MoveBy(-3)/MoveBy(+3), .6 s each,
        // both EaseInOut(1.5), repeated by the shared interactive node.
        const cycle = ((this.time % 1.2) + 1.2) % 1.2;
        const phase = Easing.sample(1, 1.5, (cycle % .6) / .6);
        const bob = cycle < .6 ? -3 * phase : -3 + 3 * phase;
        objMatrix[4] += objMatrix[2] * bob;
        objMatrix[5] += objMatrix[3] * bob;
      }
      // GameObject::setOpacity
      const op = fade / 255;
      const baseOp = op * mainOpacity;
      const mainIsBlackBlend = blendBase && main[0] === 0 && main[1] === 0 && main[2] === 0;
      const mainSpriteOp = mainIsBlackBlend ? 0 : baseOp;
      const detailIsBlackBlend = blendDetail && detail[0] === 0 && detail[1] === 0 && detail[2] === 0;
      const detailSpriteOp = detailIsBlackBlend ? 0 : op * detailOpacity;
      const bco = obj._bco;
      const childOp = bco > 0 ? bco * baseOp : baseOp;
      const rotAngle = obj.rotSpeed ? this.time * obj.rotSpeed : 0;
      const sortKey = obj.zOrder * 1048576 + obj.arrival;
      const mainBatch = this._batch(mainLayer, blendBase, obj.kind);
      const detailBatch = separateDetail ? this._batch(detailLayer, blendDetail, obj.kind) : mainBatch;
      const isObjectBlack = F.isObjectBlack, isColorSpriteBlack = F.isColorSpriteBlack;
      const guidesHidden = this._guidesHidden;
      let lighter = null;
      const parts = obj.parts;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.portalGuide && guidesHidden) continue;
        let color, opacity;
        switch (part.role) {
          case ROLE_MAIN:
            color = isObjectBlack ? BLACK : main;
            opacity = mainSpriteOp;
            break;
          case ROLE_DETAIL:
            color = isColorSpriteBlack ? BLACK : detail;
            opacity = detailSpriteOp;
            break;
          case ROLE_CHILD:
            if (part.tag === 2) {
              if (!lighter) lighter = gdTransformColorRGB(main[0], main[1], main[2], LIGHTER_HSV, obj._lighter || (obj._lighter = [255, 255, 255]));
              color = lighter;
            } else if (!isColorSpriteBlack || part.tag === 997) color = main;
            else color = BLACK;
            opacity = part.tag === 997 ? baseOp : childOp;
            break;
          default:
            color = part.fixedColor;
            opacity = baseOp * part.fixedOpacity;
            break;
        }
        if (opacity <= 0.0005) continue;
        this._emitPart(part, part.detail && separateDetail ? detailBatch : mainBatch, color, opacity, objMatrix, rotAngle, sortKey);
      }
      if (showGlow && obj.glowParts.length) {
        // glow colour/opacity
        let glowColor = main;
        if (F.customGlowColor) glowColor = F.glowColorIsLBG ? cm.getFinal(1007) : this._plainLBG;
        if (F.cantColorGlow) glowColor = WHITE;
        if (glowFade !== null) {
          glowColor = this._plainLBG;
          const opacity = fade / 255;
          if (opacity > 0.8) {
            const bg = cm.getFinal(1000);
            const target = bg[0] + bg[1] + bg[2] >= 150 ? WHITE : cm.getFinal(1007);
            const mix = (1 - (opacity - 0.8) / 0.2) * 0.3 + 0.7;
            glowColor = glowColor.map((v, i) => Math.trunc(v * mix + target[i] * (1 - mix)));
          }
        }
        const glowOp = (glowFade !== null ? glowFade * mainOpacity
          : (F.customGlowColor ? baseOp : (mainIsBlackBlend ? 0 : baseOp))) * obj._om;
        if (glowOp > 0.0005) {
          const glowBatch = this._batch(obj.zLayer, false, "glow");
          const glowParts = obj.glowParts;
          for (let i = 0; i < glowParts.length; i++) {
            const part = glowParts[i];
            if (part.portalGuide && guidesHidden) continue;
            this._emitPart(part, glowBatch, glowColor, glowOp, objMatrix, rotAngle, sortKey);
          }
        }
      }
    }

    // Main/detail colour (GameObject::colorForMode) with Area tints.
    _objectColors(obj, F, main, detail, area) {
      this._colorForMode(obj, obj.baseID, true, main, F);
      if (obj.hasDetail) this._colorForMode(obj, obj.detailID, false, detail, F);
      if (area?.tints) this.areaState.applyTints(obj, area, main, detail, obj.hasDetail);
    }

    // The edge fade (0-255) the general path gives an object that keeps the
    // entrance it took, or -1 when that path must run. Past the 70 unit ramp
    // of the edge it entered from, any move/scale entrance is at rest; the
    // default (-2) entrance has no offset inside the ramp either. Its own
    // fraction f stays above zero there, so applyEnterEffect changes no
    // state. Custom (-15) entrances, and intrinsic Don't Fade objects inside
    // the ramp, stay general.
    _enterFade(r, df, px, flags) {
      const et = -((df >> 8) & 31), xt = -((df >> 13) & 31);
      if (!et || !xt || et === -15 || xt === -15) return -1;
      const isEnter = et !== -1;
      if (!isEnter && xt === -1) return -1;
      const s = r * OS_STRIDE, cam = this.camera, fm = this._os[s + 12];
      const effect = (isEnter ? this.enterMap : this.exitMap)[this._os[s + 13]];
      if (effect === -15) return -1;
      if ((flags & OF_IGNOREFADE) || effect === -14) return 255;
      const f = isEnter ? cam.x + cam.w - px : px - cam.x;
      let d = isEnter ? (cam.x + cam.w - (px - fm)) : ((px + fm) - cam.x);
      if (f >= 70 && d >= 70) return 255;
      if (f <= 0 || (isEnter ? et : xt) !== -2 || (flags & OF_DONTFADE)) return -1;
      d = Math.max(0, Math.min(1, d / 70));
      return Math.trunc(d * 255);
    }

    // A candidate without an entrance, beyond the screen edge on the side
    // the general path fades it towards: zero opacity, and applyEnterEffect
    // only sets and clears its type in the same call (f is 0 there). Margin
    // culling adds about a sixth of the candidates in this state.
    _fadedOut(r, px) {
      const s = r * OS_STRIDE, fm = this._os[s + 12], cam = this.camera, isEnter = px > cam.x + cam.w * 0.5;
      const effect = (isEnter ? this.enterMap : this.exitMap)[this._os[s + 13]];
      if (effect === -15 || effect === -14) return false;
      return isEnter ? px - fm >= cam.x + cam.w : px + fm <= cam.x;
    }

    // batchFor, memoised: it builds string keys.
    _batch(zl, blend, kind) {
      const key = (zl * 2 + (blend ? 1 : 0)) * 8 + (KIND_INDEX[kind] ?? 7);
      const cache = this._batchCache || (this._batchCache = new Map());
      let batch = cache.get(key);
      if (batch === undefined) cache.set(key, batch = batchFor(zl, blend, kind));
      return batch;
    }

    _emitPart(part, batch, color, opacity, objMatrix, rotAngle, sortKey) {
      let m = part.matrix;
      if (rotAngle && part.rotLocal) {
        const L = part.rotLocal;
        // The sprite transform supplies the starting angles. Tags also carry
        // colour roles (997), so they cannot serve as angular offsets.
        const local = nodeToParent(L.px, L.py, L.baseRotX + rotAngle, L.baseRotY + rotAngle, L.sx, L.sy, L.ax, L.ay);
        m = L.parentMatrix ? mul(L.parentMatrix, local) : local;
      }
      const n = this._nodeTmp || (this._nodeTmp = [0, 0, 0, 0, 0, 0]);
      mulInto(objMatrix, m, n);
      if (part.upright) {
        const cx = part.info.cw / 2, cy = part.info.ch / 2;
        const px = n[0] * cx + n[2] * cy + n[4], py = n[1] * cx + n[3] * cy + n[5];
        const ux = Math.hypot(n[0], n[1]), uy = Math.hypot(n[2], n[3]);
        n[0] = ux; n[1] = 0; n[2] = 0; n[3] = uy;
        n[4] = px - ux * cx; n[5] = py - uy * cy;
      }
      this._writePart(batch, sortKey, part, n, color, opacity);
    }

    // ----------------------------------------------------------- quad writer
    // Quads go straight into per-batch typed arrays (world-space corners,
    // UVs, packed premultiplied colours, texture slot, sort key), written in
    // draw order; _buildVertices assembles the vertex stream from them.
    // With debugItems set (tests), every quad is also recorded as an
    // item-like entry in this.buckets.
    _batchStore(bi) {
      let b = this._qb[bi];
      if (!b) b = this._qb[bi] = { n: 0, cap: 0, f: null, u: null, k: null, last: -Infinity, unsorted: false };
      return b;
    }
    clearFrame() {
      for (const b of this._qb) if (b) { b.n = 0; b.last = -Infinity; b.unsorted = false; }
      if (this.debugItems) for (const bucket of this.buckets) bucket.length = 0;
    }
    // Reserve one quad in batch bi; the quad index is store.n - 1.
    _quad(bi, key, slot, flags) {
      const b = this._qb[bi] || this._batchStore(bi);
      if (b.n === b.cap) {
        const cap = Math.max(256, b.cap * 2);
        const f = new Float64Array(cap * 16), u = new Uint32Array(cap * 6), k = new Float64Array(cap);
        if (b.f) { f.set(b.f); u.set(b.u); k.set(b.k); }
        b.f = f; b.u = u; b.k = k; b.cap = cap;
      }
      const q = b.n++;
      b.k[q] = key;
      if (key < b.last) b.unsorted = true; else b.last = key;
      b.u[q * 6 + 4] = slot; b.u[q * 6 + 5] = flags;
      return b;
    }
    // A sprite part with its final node matrix n = [a, b, c, d, tx, ty];
    // colour [r, g, b] and opacity as GameObject::setOpacity leaves them.
    _writePart(bi, key, part, n, color, opacity) {
      const info = part.info;
      const b = this._quad(bi, key, info.slot, this._objectDrawFlags || 0), q = b.n - 1, F = b.f, U = b.u, o = q * 16, uo = q * 6;
      const x0 = part.qx, y0 = part.qy, x1 = part.qx + info.w, y1 = part.qy + info.h;
      let u0 = info.u0, u1 = info.u1, v0 = info.v0, v1 = info.v1;
      if (part.flipX) { const t = u0; u0 = u1; u1 = t; }
      if (part.flipY) { const t = v0; v0 = v1; v1 = t; }
      const mods = part.vertexMods;
      const a = n[0], nb = n[1], c = n[2], d = n[3], tx = n[4], ty = n[5];
      const al = Math.max(0, Math.min(255, Math.round(opacity * 255)));
      const rgbOpacity = part.opacityModifyRGB === false ? 1 : opacity;
      const col = ((al << 24) | (Math.round(color[2] * rgbOpacity) << 16) | (Math.round(color[1] * rgbOpacity) << 8) | Math.round(color[0] * rgbOpacity)) >>> 0;
      // corners: (x0,y1) top-left, (x1,y1) top-right, (x0,y0) bottom-left, (x1,y0) bottom-right
      for (let k = 0; k < 4; k++) {
        const top = k < 2, lx = k & 1 ? x1 : x0, uu = k & 1 ? u1 : u0;
        let ly = top ? y1 : y0, vv = top ? v0 : v1;
        const mod = mods ? mods[k] || 0 : 0;
        if (mod) {
          ly += (top ? -1 : 1) * info.h * mod;
          if (!top || mod >= 0) vv += (top ? 1 : -1) * (v1 - v0) * mod;
        }
        const p = o + k * 4;
        F[p] = a * lx + c * ly + tx; F[p + 1] = nb * lx + d * ly + ty; F[p + 2] = uu; F[p + 3] = vv;
        U[uo + k] = col;
      }
      if (this.debugItems) this.buckets[bi].push({ part, m: n.slice(0, 6), color: color.slice(0, 3), opacity, sortKey: key,
        positions: null, colors: null, above: this._objectDrawFlags ? true : null, screen: !!this._objectDrawFlags, gradientBlend: -1, overlay: !!this._objectDrawFlags });
    }
    // Explicit corners (gradients): positions [[x, y] x4], colours
    // [[r, g, b, a] x4]; flags carry the range overrides (_rangeFlags).
    _writeCorners(bi, key, part, positions, colors, flags) {
      const info = part.info;
      const b = this._quad(bi, key, info.slot, flags), q = b.n - 1, F = b.f, U = b.u, o = q * 16, uo = q * 6;
      for (let k = 0; k < 4; k++) {
        const p = o + k * 4;
        F[p] = positions[k][0]; F[p + 1] = positions[k][1];
        F[p + 2] = k & 1 ? info.u1 : info.u0; F[p + 3] = k < 2 ? info.v0 : info.v1;
        const vc = colors[k];
        U[uo + k] = ((vc[3] << 24) | (vc[2] << 16) | (vc[1] << 8) | vc[0]) >>> 0;
      }
    }
    // An item-like record {part, m, color, opacity, sortKey, positions?,
    // colors?, above?, screen?, gradientBlend?, overlay?}.
    pushItem(bi, item) {
      if (item.positions) {
        this._writeCorners(bi, item.sortKey || 0, item.part, item.positions, item.colors || [[255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255]],
          this._rangeFlags(item.above, item.screen, item.overlay, item.gradientBlend));
        if (this.debugItems) this.buckets[bi].push(item);
      } else this._writePart(bi, item.sortKey || 0, item.part, item.m, item.color, item.opacity);
    }
    _rangeFlags(above, screen, overlay, gradientBlend) {
      return (above === true ? 2 : above === false ? 1 : 0) | (screen ? 4 : 0) | (overlay ? 8 : 0) | (((gradientBlend ?? -1) + 1) << 4);
    }

    _sortedOrder(b) {
      let order = this._orderBuf;
      if (!order || order.length < b.n) order = this._orderBuf = new Array(Math.max(1024, b.n * 2));
      const keys = b.k, idx = order.slice(0, b.n);
      for (let i = 0; i < b.n; i++) idx[i] = i;
      idx.sort((x, y) => (keys[x] - keys[y]) || (x - y));
      return idx;
    }

    _buildVertices() {
      let needed = 0;
      for (const b of this._qb) if (b) needed += b.n;
      if (!this._vbuf || needed > this._quadCapacity) {
        this._quadCapacity = Math.max(QUADS_PER_DRAW, 2 ** Math.ceil(Math.log2(Math.max(1, needed))));
        this._vbuf = new ArrayBuffer(this._quadCapacity * 4 * FLOATS_PER_VERTEX * 4);
        this._vf = new Float32Array(this._vbuf);
        this._vu = new Uint32Array(this._vbuf);
      }
      const vf = this._vf, vu = this._vu;
      const cam = this.camera;
      const mirror = Number.isFinite(cam.mirror) ? cam.mirror : 1;
      const mirrored = mirror !== 1;
      const mc = cam.mirrorCenter || 0;
      const sx0 = cam.screenX, sy0 = cam.screenY, gy = cam.screenGroundY;
      const textures = this.frames.textures;
      // texture slot -> sampler index inside the current range (-1: none)
      let slotOf = this._slotOf;
      if (!slotOf || slotOf.length < textures.length + 1) slotOf = this._slotOf = new Int16Array(Math.max(64, textures.length * 2)).fill(-1);
      let q = 0;
      this.ranges.length = 0;
      let current = null;
      const closeRange = () => { if (current) for (const slot of current.slotIds) slotOf[slot] = -1; };
      for (let bi = 0; bi < BATCHES.length; bi++) {
        const b = this._qb[bi];
        if (!b || !b.n) continue;
        const blend = BATCHES[bi].blend, defaultAbove = bi >= FIRST_ABOVE_PLAYER, nativeZ = BATCHES[bi].z;
        const order = b.unsorted ? this._sortedOrder(b) : null;
        const F = b.f, U = b.u;
        for (let j = 0; j < b.n; j++) {
          const qi = order ? order[j] : j, uo = qi * 6, fo = qi * 16;
          const slot = U[uo + 4], flags = U[uo + 5];
          const ab = flags & 3, itemAbove = ab ? ab === 2 : defaultAbove, screen = (flags & 4) !== 0, overlay = (flags & 8) !== 0;
          const gradientBlend = ((flags >> 4) & 7) - 1;
          if (!current || current.nativeZ !== nativeZ || current.blend !== blend || current.above !== itemAbove || current.screen !== screen || current.gradientBlend !== gradientBlend || current.overlay !== overlay ||
              (slotOf[slot] < 0 && current.textures.length === 8)) {
            closeRange();
            current = { start: q, count: 0, nativeZ, blend, above: itemAbove, screen, gradientBlend, overlay, textures: [], slotIds: [] };
            this.ranges.push(current);
          }
          let textureSlot = slotOf[slot];
          if (textureSlot < 0) {
            textureSlot = slotOf[slot] = current.textures.length;
            current.textures.push(textures[slot]);
            current.slotIds.push(slot);
          }
          const base = q * 4 * FLOATS_PER_VERTEX;
          for (let k = 0; k < 4; k++) {
            const p = fo + k * 4, wx = F[p], wy = F[p + 1];
            const o2 = base + k * FLOATS_PER_VERTEX;
            vf[o2] = flags & 128 ? wx * 2 : screen ? wx : mirrored ? mc + mirror * (wx * 2 - sx0 - mc) : wx * 2 - sx0;
            vf[o2 + 1] = flags & 128 ? (typeof screenHeight !== "undefined" ? screenHeight : 640) - wy * 2 : screen ? wy : gy - wy * 2 + sy0;
            vf[o2 + 2] = F[p + 2];
            vf[o2 + 3] = F[p + 3];
            vf[o2 + 4] = textureSlot;
            vu[o2 + 5] = U[uo + k];
          }
          q++;
          current.count++;
        }
      }
      closeRange();
      this.quadCount = q;
      // The upload generation follows rebuilt vertex data, including a
      // paused preview/checkpoint rebuild that does not move the camera.
      this._frameId = (this._frameId || 0) + 1;
    }

    // ------------------------------------------------------------ WebGL
    _initGL(renderer) {
      const gl = renderer.gl;
      this._gl = gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
      this._prog = prog;
      this._loc = {
        aPos: gl.getAttribLocation(prog, "aPos"),
        aUV: gl.getAttribLocation(prog, "aUV"),
        aTex: gl.getAttribLocation(prog, "aTex"),
        aCol: gl.getAttribLocation(prog, "aCol"),
        uRes: gl.getUniformLocation(prog, "uRes"),
        uView: gl.getUniformLocation(prog, "uView"),
        uT: [0, 1, 2, 3, 4, 5, 6, 7].map(i => gl.getUniformLocation(prog, "uT" + i))
      };
      this._vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
      this._gpuVertexBytes = this._vbuf.byteLength;
      gl.bufferData(gl.ARRAY_BUFFER, this._gpuVertexBytes, gl.DYNAMIC_DRAW);
      const idx = new Uint16Array(QUADS_PER_DRAW * 6);
      for (let i = 0, v = 0; i < QUADS_PER_DRAW * 6; i += 6, v += 4) {
        idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2;
        idx[i + 3] = v + 2; idx[i + 4] = v + 1; idx[i + 5] = v + 3;
      }
      this._ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      this._ready = true;
    }

    _glTexture(key) {
      const texture = this.scene.textures.get(key);
      const source = texture && texture.source && texture.source[0];
      const wrapper = source && source.glTexture;
      if (!wrapper) return null;
      return wrapper.webGLTexture || wrapper;
    }

    render(renderer, above, view = null, overlay = false, shaderBand = null, minZ = -Infinity, maxZ = Infinity) {
      if (!this.enabled || !this.quadCount) return;
      if (!this._ready) this._initGL(renderer);
      const gl = this._gl;
      gl.useProgram(this._prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
      if (this._vbuf.byteLength > this._gpuVertexBytes) {
        this._gpuVertexBytes = this._vbuf.byteLength;
        gl.bufferData(gl.ARRAY_BUFFER, this._gpuVertexBytes, gl.DYNAMIC_DRAW);
        this._uploadedFrame = null;
      }
      if (!this._uploadedFrame || this._uploadedFrame !== this._frameId) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._vf.subarray(0, this.quadCount * 4 * FLOATS_PER_VERTEX));
        this._uploadedFrame = this._frameId;
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
      const L = this._loc;
      const stride = FLOATS_PER_VERTEX * 4;
      gl.enableVertexAttribArray(L.aPos);
      gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(L.aUV);
      gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(L.aTex);
      gl.vertexAttribPointer(L.aTex, 1, gl.FLOAT, false, stride, 16);
      gl.enableVertexAttribArray(L.aCol);
      gl.vertexAttribPointer(L.aCol, 4, gl.UNSIGNED_BYTE, true, stride, 20);
      gl.uniform2f(L.uRes, renderer.width, renderer.height);
      gl.uniformMatrix3fv(L.uView, false, view ? [view.a, view.b, 0, view.c, view.d, 0, view.e, view.f, 1] : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      gl.enable(gl.BLEND);
      for (const range of this.ranges) {
        if (range.above !== above || range.overlay !== overlay || !range.count) continue;
        if (range.nativeZ < minZ || range.nativeZ >= maxZ) continue;
        if (shaderBand !== null && this.shaderState?.bandForZ(range.nativeZ) !== shaderBand) continue;
        gl.uniformMatrix3fv(L.uView, false, view && !range.screen ? [view.a, view.b, 0, view.c, view.d, 0, view.e, view.f, 1] : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
        for (let i = 0; i < 8; i++) {
          gl.activeTexture(gl.TEXTURE0 + i);
          const key = range.textures[i] || range.textures[0];
          gl.bindTexture(gl.TEXTURE_2D, this._glTexture(key));
          gl.uniform1i(L.uT[i], i);
        }
        if (range.gradientBlend === 0) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        else if (range.gradientBlend === 1) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else if (range.gradientBlend === 2) gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        else if (range.gradientBlend === 3) gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR);
        // CCSprite::setBlendFunc (cocos 4e000) only changes the blend pair;
        // it retains the texture's opacityModifyRGB setting. Particle quads
        // explicitly choose their own setting when their part is created.
        else if (range.blend) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        for (let drawn = 0; drawn < range.count; drawn += QUADS_PER_DRAW) {
          const count = Math.min(QUADS_PER_DRAW, range.count - drawn);
          const offset = (range.start + drawn) * 4 * stride;
          gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, stride, offset);
          gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, stride, offset + 8);
          gl.vertexAttribPointer(L.aTex, 1, gl.FLOAT, false, stride, offset + 16);
          gl.vertexAttribPointer(L.aCol, 4, gl.UNSIGNED_BYTE, true, stride, offset + 20);
          gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);
        }
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.disableVertexAttribArray(L.aTex);
      gl.disableVertexAttribArray(L.aCol);
    }

    createLayers(depthBelow, depthAbove) {
      const renderer = this;
      const make = (above, depth, minZ = -Infinity, maxZ = Infinity) => {
        const ext = this.scene.add.extern();
        ext.render = function (glRenderer, camera, matrix) { renderer.render(glRenderer, above, matrix, false, camera._gdShaderBand ?? null, minZ, maxZ); };
        ext.setDepth(depth);
        return ext;
      };
      this.belowLayer = make(false, depthBelow, -Infinity, 39);
      // Native trail order is 39, icon order 59. In particular the B1 top
      // gradients (46/56) must cover the trail while staying behind the icon.
      this.middleLayer = make(false, 7.1, 39);
      this.aboveLayer = make(true, Math.max(depthAbove, 12.9));
      // Gradient layer 15 belongs to the screen layer, outside the world
      // camera and its shader. It covers the ground and retains HUD order.
      this.overlayLayer = this.scene.add.extern().setDepth(14.5);
      this.overlayLayer.render = function (glRenderer) { renderer.render(glRenderer, true, null, true); };
    }

    destroy() {
      this.enabled = false; this.quadCount = 0;
      this.belowLayer?.destroy?.(); this.middleLayer?.destroy?.(); this.aboveLayer?.destroy?.();
      this.overlayLayer?.destroy?.(); this.overlayLayer = null;
      this.belowLayer = null; this.middleLayer = null; this.aboveLayer = null;
      if (this._gl && this._ready) {
        this._gl.deleteBuffer(this._vbo);
        this._gl.deleteBuffer(this._ibo);
        this._gl.deleteProgram(this._prog);
      }
      this._ready = false;
      this.objects.length = 0;
      this.collisionBlocks.clear();
      this.collisionBlockGroups.clear();
      this.groups.clear();
      this.uiObjects.clear();
      this.parents.clear();
      for (const grid of this.grids) grid.clear();
      this.wideObjects.clear();
      this.particleSystems.length = 0;
      this.spawnedParticleSystems.length = 0;
      this._psBins.clear(); this._psOn = null; this._psCount = 0; this._psWoken.length = 0;
      this.animationCache.clear();
      this.spriteTreeCache.clear();
      this.partsCache.clear(); this.glowPartsCache.clear();
      this.localBoundsCache.clear();
      this._vbuf = null; this._vf = null; this._vu = null;
    }

    setVisible(visible) {
      this.enabled = !!visible;
      if (this.belowLayer) this.belowLayer.setVisible(!!visible);
      if (this.middleLayer) this.middleLayer.setVisible(!!visible);
      if (this.aboveLayer) this.aboveLayer.setVisible(!!visible);
      if (this.overlayLayer) this.overlayLayer.setVisible(!!visible);
    }

    // camera in world pixels (GD units * 2), matching the old containers
    setCamera(cameraX, cameraY, shakeX = 0, shakeY = 0) {
      this.camera.shakeX = shakeX / 2; this.camera.shakeY = shakeY / 2;
      this.camera.screenX = cameraX - shakeX;
      this.camera.screenY = cameraY + shakeY;
      this.camera.screenGroundY = 460;
      this.camera.x = cameraX / 2;
      this.camera.y = (cameraY - 180) / 2;
      this.camera.w = (typeof screenWidth !== "undefined" ? screenWidth : 1138) / 2;
      this.camera.h = (typeof screenHeight !== "undefined" ? screenHeight : 640) / 2;
    }
  }

  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];
  const PLAIN_LBG_HSV = { h: 0, s: -0.2, v: 0.2, absoluteSaturation: true, absoluteBrightness: true };
  const LIGHTER_HSV = { h: 0, s: 0.65, v: 0.15, absoluteSaturation: false, absoluteBrightness: true };

  window.GDRenderer = GDRenderer;
  window.GDRender = { BATCHES, layerFor, batchFor, hasFlag, GD_FLAGS, makeInfo, makePart, makeItem, uiDrawFlags: UI_DRAW_FLAGS,
    gradientZ: GRADIENT_Z, gradientBatch: GRADIENT_Z.map((_, i) => BATCH_INDEX["gradient:" + i]) };
})();
