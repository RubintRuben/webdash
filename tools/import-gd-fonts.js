// Copies Geometry Dash's level fonts (gjFont01..59, -hd: two texels per
// point, like the bundled bigFont) into assets/fonts/gd for text objects.
// node tools/import-gd-fonts.js "<GD Resources folder>"
const fs = require("fs"), path = require("path");
const src = process.argv[2] || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources";
const out = path.join(__dirname, "..", "assets", "fonts", "gd");
fs.mkdirSync(out, { recursive: true });
let copied = 0;
for (let i = 1; i <= 99; i++) {
  const name = "gjFont" + String(i).padStart(2, "0");
  const fnt = path.join(src, name + "-hd.fnt"), png = path.join(src, name + "-hd.png");
  if (!fs.existsSync(fnt) || !fs.existsSync(png)) continue;
  fs.copyFileSync(fnt, path.join(out, name + ".fnt"));
  fs.copyFileSync(png, path.join(out, name + ".png"));
  copied++;
}
console.log("copied", copied, "fonts to", out);
