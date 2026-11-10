#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const atlasPairs = [
  ["GJ_GameSheet", "GJ_GameSheet-hd.plist"],
  ["GJ_GameSheet02", "GJ_GameSheet02-hd.plist"],
  ["GJ_GameSheet03", "GJ_GameSheet03-hd.plist"],
  ["GJ_GameSheet04", "GJ_GameSheet04-hd.plist"],
  ["GJ_GameSheetEditor", "GJ_GameSheetEditor-hd.plist"],
  ["GJ_GameSheetGlow", "GJ_GameSheetGlow-hd.plist"]
];

function plistFrames(xml) {
  const framesStart = xml.indexOf("<key>frames</key>");
  const metadataStart = xml.indexOf("<key>metadata</key>", framesStart);
  const body = xml.slice(framesStart, metadataStart > framesStart ? metadataStart : undefined);
  const entries = new Map();
  const entryPattern = /<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  let match;
  while ((match = entryPattern.exec(body))) {
    const [, name, entry] = match;
    const readPoint = (key) => {
      const value = entry.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))?.[1] || "";
      return (value.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    };
    const [offsetX = 0, offsetY = 0] = readPoint("spriteOffset");
    const [spriteWidth = 0, spriteHeight = 0] = readPoint("spriteSize");
    const [sourceWidth = spriteWidth, sourceHeight = spriteHeight] = readPoint("spriteSourceSize");
    entries.set(name, { offsetX, offsetY, spriteWidth, spriteHeight, sourceWidth, sourceHeight });
  }
  return entries;
}

function jsonFrameEntries(atlas) {
  if (atlas.frames && !Array.isArray(atlas.frames)) return Object.entries(atlas.frames);
  const result = [];
  for (const texture of atlas.textures || []) {
    for (const frame of texture.frames || []) {
      if (frame?.filename) result.push([frame.filename, frame]);
    }
  }
  return result;
}

let corrected = 0;
let matched = 0;

for (const [atlasName, plistName] of atlasPairs) {
  const jsonPath = path.join(root, "assets", "sheets", `${atlasName}.json`);
  const plistPath = path.join(root, "assets", "atlas-metadata", plistName);
  if (!fs.existsSync(jsonPath) || !fs.existsSync(plistPath)) continue;

  const atlas = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const sourceFrames = plistFrames(fs.readFileSync(plistPath, "utf8"));
  let atlasCorrections = 0;

  for (const [name, frame] of jsonFrameEntries(atlas)) {
    const source = sourceFrames.get(name);
    if (!source || !frame?.frame || !frame?.spriteSourceSize || !frame?.sourceSize) continue;

    const currentSourceWidth = Number(frame.sourceSize.w) || source.sourceWidth;
    const currentSourceHeight = Number(frame.sourceSize.h) || source.sourceHeight;
    const scaleX = source.sourceWidth > 0 ? currentSourceWidth / source.sourceWidth : 1;
    const scaleY = source.sourceHeight > 0 ? currentSourceHeight / source.sourceHeight : 1;
    const cutWidth = Number(frame.frame.w) || 0;
    const cutHeight = Number(frame.frame.h) || 0;

    // GDSplitter removes fully transparent edge pixels while repacking. Keep
    // those tighter cut rectangles, but restore the exact Cocos2d frame
    // centre from spriteOffset. Fractional half-pixels are intentional and
    // prevent paired base/detail/glow sprites from drifting by one pixel.
    const trimX = currentSourceWidth / 2 + source.offsetX * scaleX - cutWidth / 2;
    const trimY = currentSourceHeight / 2 - source.offsetY * scaleY - cutHeight / 2;
    const nextX = Math.round(trimX * 2) / 2;
    const nextY = Math.round(trimY * 2) / 2;

    if (frame.spriteSourceSize.x !== nextX || frame.spriteSourceSize.y !== nextY ||
        frame.spriteSourceSize.w !== cutWidth || frame.spriteSourceSize.h !== cutHeight) {
      frame.spriteSourceSize.x = nextX;
      frame.spriteSourceSize.y = nextY;
      frame.spriteSourceSize.w = cutWidth;
      frame.spriteSourceSize.h = cutHeight;
      frame.trimmed = nextX !== 0 || nextY !== 0 || cutWidth !== currentSourceWidth || cutHeight !== currentSourceHeight;
      atlasCorrections++;
    }
    matched++;
  }

  corrected += atlasCorrections;
  if (atlasCorrections > 0) {
    const indent = Array.isArray(atlas.frames) || Array.isArray(atlas.textures) ? 4 : 2;
    fs.writeFileSync(jsonPath, `${JSON.stringify(atlas, null, indent)}\n`);
  }
  console.log(`${atlasName}: corrected ${atlasCorrections} frame origins`);
}

console.log(`Atlas metadata synchronized: ${corrected} corrections across ${matched} matched frames.`);
