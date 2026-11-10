#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const projectRoot = path.resolve(__dirname, "..");
const resourcesRoot = path.resolve(process.argv[2] || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources");
const atlasNames = [
  "GJ_GameSheet",
  "GJ_GameSheet02",
  "GJ_GameSheet03",
  "GJ_GameSheet04",
  "GJ_GameSheetEditor",
  "GJ_GameSheetGlow",
  // particle_XX art objects (2.2) and particle system textures
  "GJ_ParticleSheet"
].filter(name => !process.env.GD_ATLASES || process.env.GD_ATLASES.split(",").includes(name));

const FRAME_MARGIN = 2;
const MAX_ATLAS_SIZE = 4096;

function xmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function numbers(value, expected, label) {
  const result = (String(value || "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (result.length < expected) throw new Error(`Invalid ${label}: ${value}`);
  return result;
}

function readString(entry, key) {
  return entry.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1] || "";
}

function parsePlist(xml, atlasName) {
  const framesStart = xml.indexOf("<key>frames</key>");
  const metadataStart = xml.indexOf("<key>metadata</key>", framesStart);
  if (framesStart < 0 || metadataStart < 0) throw new Error(`Missing frames/metadata in ${atlasName}`);

  const framesBody = xml.slice(framesStart, metadataStart);
  const framePattern = /<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  const frames = [];
  let match;

  while ((match = framePattern.exec(framesBody))) {
    const name = xmlDecode(match[1]);
    const entry = match[2];
    const [x, y, width, height] = numbers(readString(entry, "textureRect"), 4, `${name} textureRect`);
    const [spriteW, spriteH] = numbers(readString(entry, "spriteSize"), 2, `${name} spriteSize`);
    const [sourceW, sourceH] = numbers(readString(entry, "spriteSourceSize"), 2, `${name} spriteSourceSize`);
    const [offsetX, offsetY] = numbers(readString(entry, "spriteOffset"), 2, `${name} spriteOffset`);
    const rotated = /<key>textureRotated<\/key>\s*<true\s*\/>/.test(entry);
    const trimX = sourceW / 2 + offsetX - spriteW / 2;
    const trimY = sourceH / 2 - offsetY - spriteH / 2;

    frames.push({
      name,
      sourceX: x,
      sourceY: y,
      width,
      height,
      spriteW,
      spriteH,
      sourceW,
      sourceH,
      trimX,
      trimY,
      rotated
    });
  }

  if (!frames.length) throw new Error(`No frames parsed from ${atlasName}`);
  return frames;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function decodeRgbaPng(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error(`${label}: invalid PNG signature`);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`${label}: expected non-interlaced 8-bit RGBA PNG`);
  }

  const encoded = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = encoded[src++];
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = encoded[src++];
      const left = x >= 4 ? pixels[row + x - 4] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[row - stride + x - 4] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = (raw + left) & 255;
      else if (filter === 2) value = (raw + up) & 255;
      else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (raw + paeth(left, up, upperLeft)) & 255;
      else throw new Error(`${label}: unsupported PNG filter ${filter}`);
      pixels[row + x] = value;
    }
  }
  return { width, height, pixels };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return chunk;
}

function encodeRgbaPng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const dst = y * (stride + 1);
    scanlines[dst] = 0;
    pixels.copy(scanlines, dst + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function packFrames(frames, atlasName) {
  const rectangles = frames.map(frame => ({
    frame,
    width: frame.width + FRAME_MARGIN * 2,
    height: frame.height + FRAME_MARGIN * 2
  })).sort((a, b) => b.height - a.height || b.width - a.width || a.frame.name.localeCompare(b.frame.name));

  const maxWidth = Math.max(...rectangles.map(rect => rect.width));
  const candidates = [512, 768, 1024, 1280, 1536, 1792, 2048, 2560, 3072, 3584, 4096]
    .filter(width => width >= maxWidth && width <= MAX_ATLAS_SIZE);
  let best = null;

  for (const atlasWidth of candidates) {
    const shelves = [];
    const placements = [];
    let usedHeight = 0;
    let usedWidth = 0;
    let failed = false;
    for (const rect of rectangles) {
      let bestShelf = null;
      let bestWaste = Infinity;
      for (const shelf of shelves) {
        if (rect.height <= shelf.height && shelf.x + rect.width <= atlasWidth) {
          const waste = shelf.height - rect.height;
          if (waste < bestWaste) {
            bestWaste = waste;
            bestShelf = shelf;
          }
        }
      }
      if (!bestShelf) {
        if (usedHeight + rect.height > MAX_ATLAS_SIZE) {
          failed = true;
          break;
        }
        bestShelf = { x: 0, y: usedHeight, height: rect.height };
        shelves.push(bestShelf);
        usedHeight += rect.height;
      }
      placements.push({ ...rect, x: bestShelf.x, y: bestShelf.y });
      bestShelf.x += rect.width;
      usedWidth = Math.max(usedWidth, bestShelf.x);
    }
    if (failed) continue;
    const width = Math.ceil(usedWidth / 4) * 4;
    const height = Math.ceil(usedHeight / 4) * 4;
    const score = width * height;
    if (!best || score < best.score) best = { placements, width, height, score };
  }

  if (!best) throw new Error(`${atlasName}: frames do not fit in a ${MAX_ATLAS_SIZE}px atlas`);
  return best;
}

function copyFrame(source, target, targetWidth, placement) {
  const frame = placement.frame;
  const innerX = placement.x + FRAME_MARGIN;
  const innerY = placement.y + FRAME_MARGIN;

  // TexturePacker stores rotated Cocos frames clockwise. Read them back into
  // their logical, upright orientation before Phaser ever sees the atlas.
  const sourcePixel = (logicalX, logicalY) => {
    const sx = frame.rotated
      ? frame.sourceX + frame.height - 1 - logicalY
      : frame.sourceX + logicalX;
    const sy = frame.rotated
      ? frame.sourceY + logicalX
      : frame.sourceY + logicalY;
    if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) {
      throw new Error(`${frame.name}: source pixel outside atlas (${sx}, ${sy})`);
    }
    return (sy * source.width + sx) * 4;
  };

  // Copy the logical frame plus a one-pixel extrusion. The remaining outer
  // margin is transparent, so linear WebGL sampling can never reach a yellow
  // or otherwise unrelated neighbouring sprite.
  for (let y = -1; y <= frame.height; y++) {
    const logicalY = Math.max(0, Math.min(frame.height - 1, y));
    for (let x = -1; x <= frame.width; x++) {
      const logicalX = Math.max(0, Math.min(frame.width - 1, x));
      const src = sourcePixel(logicalX, logicalY);
      const dst = ((innerY + y) * targetWidth + innerX + x) * 4;
      source.pixels.copy(target, dst, src, src + 4);
    }
  }

  return { innerX, innerY };
}

function importAtlas(atlasName) {
  const plistSource = path.join(resourcesRoot, `${atlasName}-hd.plist`);
  const pngSource = path.join(resourcesRoot, `${atlasName}-hd.png`);
  const jsonTarget = path.join(projectRoot, "assets", "sheets", `${atlasName}.json`);
  const pngTarget = path.join(projectRoot, "assets", "sheets", `${atlasName}.png`);

  if (!fs.existsSync(plistSource) || !fs.existsSync(pngSource)) {
    throw new Error(`Missing original Geometry Dash atlas: ${plistSource} / ${pngSource}`);
  }

  const frames = parsePlist(fs.readFileSync(plistSource, "utf8"), atlasName);
  const source = decodeRgbaPng(fs.readFileSync(pngSource), `${atlasName}-hd.png`);
  const packed = packFrames(frames, atlasName);
  const pixels = Buffer.alloc(packed.width * packed.height * 4);
  const jsonFrames = {};

  for (const placement of packed.placements) {
    const frame = placement.frame;
    const { innerX, innerY } = copyFrame(source, pixels, packed.width, placement);
    jsonFrames[frame.name] = {
      frame: { x: innerX, y: innerY, w: frame.width, h: frame.height },
      rotated: false,
      trimmed: frame.trimX !== 0 || frame.trimY !== 0 || frame.spriteW !== frame.sourceW || frame.spriteH !== frame.sourceH,
      spriteSourceSize: { x: frame.trimX, y: frame.trimY, w: frame.spriteW, h: frame.spriteH },
      sourceSize: { w: frame.sourceW, h: frame.sourceH },
      extruded: true
    };
  }

  const atlas = {
    frames: jsonFrames,
    meta: {
      app: "Web Dashers exact GD atlas normalizer",
      version: "2.0",
      image: `${atlasName}.png`,
      format: "RGBA8888",
      size: { w: packed.width, h: packed.height },
      scale: "1",
      source: `${atlasName}-hd.png`,
      padding: FRAME_MARGIN,
      rotationNormalized: true
    }
  };

  fs.writeFileSync(jsonTarget, `${JSON.stringify(atlas, null, 2)}\n`);
  fs.writeFileSync(pngTarget, encodeRgbaPng(packed.width, packed.height, pixels));
  const formerlyRotated = frames.filter(frame => frame.rotated).length;
  console.log(`${atlasName}: ${frames.length} frames, ${formerlyRotated} rotations normalized, ${packed.width}x${packed.height}`);
}

for (const atlasName of atlasNames) importAtlas(atlasName);
console.log(`Imported and normalized ${atlasNames.length} Geometry Dash HD atlases from ${resourcesRoot}`);
