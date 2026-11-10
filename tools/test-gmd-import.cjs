// End-to-end file import under localStorage pressure, legacy save migration,
// reload, export and Play. All navigation uses the actual canvas buttons.
// node tools/test-gmd-import.cjs [path/to/level.gmd] [base URL]
// GD_IMPORT_PLAY_ONLY=1 runs import, reload, export and Play without opening the editor.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const zlib = require('node:zlib');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(__dirname, '..');
const inputFile = process.argv[2] || 'C:/Users/GAMER/Downloads/Hyperluminal.gmd';
const base = new URL(process.argv[3] || 'http://127.0.0.1:8790/');
base.searchParams.set('devraf', '1');
const output = path.join(root, 'work/import-qa');
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync(inputFile, 'utf8');
const data = source.match(/<(?:k|key)>k4<\/(?:k|key)>\s*<(?:s|string)>([\s\S]*?)<\/(?:s|string)>/)[1];
const nameXML = source.match(/<(?:k|key)>k2<\/(?:k|key)>\s*<(?:s|string)>([\s\S]*?)<\/(?:s|string)>/)[1];
const unescapeXML = value => value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const decodeData = value => {
  const raw = unescapeXML(value);
  if (raw.includes(';')) return raw;
  return zlib.unzipSync(Buffer.from(raw.replace(/-/g,'+').replace(/_/g,'/'),'base64')).toString();
};
const sourceName = unescapeXML(nameXML);
const decoded = decodeData(data);
// A WHAT-sized source cannot itself fit in legacy localStorage, even once.
// Keep two valid, bounded legacy levels while importing the complete file.
const legacyData = data.length <= 950000 ? data : decoded.slice(0, decoded.lastIndexOf(';', 950000) + 1);
const sourceObjects = decoded.split(';').slice(1).filter(row=>row.trim()).length;
const hash = value => createHash('sha256').update(value).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1320, height: 640 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [], dialogs = [];
    page.on('pageerror', e => { errors.push(e.stack); console.error('PAGEERROR', e.stack); });
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    // Song services are external to this storage test. A missing song must not
    // prevent playing the imported level.
    await page.route('**/getGJSongInfo.php', route => route.fulfill({ body: '-1', contentType: 'text/plain' }));
    if (process.env.GD_IMPORT_BASELINE) {
      await page.route('**/core/game-scene.js?*', route => route.fulfill({ path: path.join(root, 'work/game-scene-before-quota.js'), contentType: 'application/javascript' }));
    }
    async function ready() {
      await page.waitForFunction(() => window.scene?.get('GameScene')?._level);
      await page.waitForTimeout(400); // Let menu transitions finish before input.
    }
    async function click(frame, key) {
      const point = await page.evaluate(({ frame, key }) => {
        const scene = window.scene.get('GameScene');
        const matches = [];
        function find(list) {
          for (const object of list) {
            if (!object.visible) continue;
            if (object.input?.enabled && object.getBounds &&
                (!frame || object.frame?.name === frame) && (!key || object.texture?.key === key)) matches.push(object);
            if (object.list) find(object.list);
          }
        }
        find(scene.children.list);
        if (!matches.length) throw new Error(`Button not found: ${frame || key}`);
        const object = matches[matches.length - 1], bounds = object.getBounds();
        const canvas = scene.game.canvas.getBoundingClientRect();
        return { x: canvas.left + bounds.centerX * canvas.width / scene.scale.width,
          y: canvas.top + bounds.centerY * canvas.height / scene.scale.height };
      }, { frame, key });
      await page.mouse.click(point.x, point.y, { delay: 60 });
      await page.waitForTimeout(400);
    }
    async function myLevels() {
      await click('GJ_creatorBtn_001.png');
      await page.waitForFunction(() => window.scene.get('GameScene')._creatorOverlay);
      await click('GJ_createBtn_001.png');
      await page.waitForFunction(() => window.scene.get('GameScene')._editorOverlay);
    }
    await page.goto(base.href, { waitUntil: 'networkidle' }); await ready();
    // Two existing large levels fit; the third used to exceed Chromium's quota.
    // These records exist only in the test's isolated, disposable browser context.
    await page.evaluate(data => {
      const legacy = [1, 2].map(n => ({ levelName: 'Existing ' + n, createdId: 'local_' + n,
        song: 'Stereo Madness', songId: -1, levelId: 'NA', levelString: data,
        description: '', levelLength: 4, normalBest: 0, practiceBest: 0, status: 'Unverified', version: 1 }));
      localStorage.setItem('created_levels', JSON.stringify(legacy));
    }, legacyData);
    const legacyBytes = await page.evaluate(() => localStorage.getItem('created_levels').length);
    await myLevels();
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
    await click(null, 'import');
    await (await chooserPromise).setFiles(inputFile);
    if (process.env.GD_IMPORT_BASELINE) {
      await page.waitForFunction(() => !window.scene.get('GameScene')._levelViewOverlay);
      await page.waitForTimeout(500);
      assert.ok(dialogs.some(message => /quota/i.test(message)), dialogs.join('\n'));
      console.log('REPRODUCED original quota failure:', dialogs[0]);
      fs.writeFileSync(path.join(output, 'baseline.json'), JSON.stringify({ legacyBytes, dialogs }, null, 2));
      return;
    }
    await page.waitForFunction(() => window.scene.get('GameScene')._levelViewOverlay);
    assert.deepEqual(dialogs, []);
    const persisted = await page.evaluate(async () => {
      const records = JSON.parse(localStorage.getItem('created_levels'));
      return { listBytes: localStorage.getItem('created_levels').length, records,
        payloads: await Promise.all(records.map(level => window.CreatedLevelStore.loadData(level))) };
    });
    assert.equal(persisted.records.length, 3);
    assert.ok(persisted.listBytes < 10000);
    assert.deepEqual(persisted.payloads.map(hash), [hash(legacyData), hash(legacyData), hash(data)]);
    assert.ok(persisted.records.every(level => !level.levelString && level.levelDataKey));
    console.log('PASS actual .gmd file import with two existing large levels; all payloads preserved');
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    await myLevels();
    await page.screenshot({ path: path.join(output, 'saved-levels.png') });
    // The list is sorted newest first. Select the top row's actual View button.
    const viewPoint = await page.evaluate(() => {
      const s = window.scene.get('GameScene'), candidates = [];
      function find(list) { for (const o of list) { if (o.visible && o.input?.enabled && o.texture?.key === 'GJ_button01') candidates.push(o); if (o.list) find(o.list); } }
      find(s.children.list); candidates.sort((a, b) => a.getBounds().centerY - b.getBounds().centerY);
      const b = candidates[0].getBounds(), c = s.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / s.scale.width, y: c.top + b.centerY * c.height / s.scale.height };
    });
    await page.mouse.click(viewPoint.x, viewPoint.y, { delay: 60 });
    await page.waitForFunction(() => window.scene.get('GameScene')._levelViewOverlay);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(output, 'imported-level.png') });
    const downloadPromise = page.waitForEvent('download');
    await click('GJ_shareBtn_001.png');
    const download = await downloadPromise;
    const exported = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(exported.includes('<s>' + nameXML + '</s>'));
    const exportedData=exported.match(/<k>k4<\/k>\s*<s>([\s\S]*?)<\/s>/)[1];
    // .gmd exports store the uncompressed, XML-escaped object string. Compare
    // the complete decoded payload, independent of compression or escaping.
    assert.equal(hash(decodeData(exportedData)), hash(decoded));
    console.log('PASS reload and export from IndexedDB');
    await click('GJ_playBtn2_001.png');
    await page.waitForFunction(count => !window.scene.get('GameScene')._menuActive && window.levelObjects?.length === count, sourceObjects, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const gameplay = await page.evaluate(() => {
      const s = window.scene.get('GameScene');
      return { name: window.currentlevel[1], id: window.currentlevel[2], objects: window.levelObjects.length,
        renderObjects: s._level.gdRenderer.objects.length, menu: s._menuActive, x: s._playerWorldX, time: s._level.gdRenderer.time };
    });
    assert.equal(gameplay.name, sourceName); assert.equal(gameplay.id, 'local_3');
    assert.equal(gameplay.objects, sourceObjects); assert.equal(gameplay.menu, false); assert.ok(Number.isFinite(gameplay.x));
    await page.screenshot({ path: path.join(output, 'playing.png') });
    console.log('PASS Play after reload:', JSON.stringify(gameplay));
    if (process.env.GD_IMPORT_PLAY_ONLY) {
      assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
      fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({legacyBytes,
        listBytes:persisted.listBytes,payloadCount:persisted.records.length,payloadHash:hash(data),
        gameplay,errors,dialogs,editorTested:false},null,2));
      return;
    }
    await page.reload({ waitUntil: 'networkidle' }); await ready(); await myLevels();
    await page.mouse.click(viewPoint.x, viewPoint.y, { delay: 60 });
    await page.waitForFunction(() => window.scene.get('GameScene')._levelViewOverlay);
    await page.waitForTimeout(400);
    await click('GJ_editBtn_001.png');
    try {
      // 130k objects are expanded into editable Phaser sprites here. This
      // takes longer than playback's native batched renderer on Windows.
      await page.waitForFunction(() => window.isEditor && window.scene.get('GameScene')._editorMenuContainer, {}, { timeout: 120000 });
    } catch (error) {
      await page.screenshot({ path: path.join(output, 'editor-failed.png') });
      console.error('EDITOR STATE', await page.evaluate(() => {
        const s = window.scene.get('GameScene'); return { editor: window.isEditor, menu: s._menuActive, autoStart: s.game.registry.get('autoStartGame'), view: !!s._levelViewOverlay, pause: !!s._editorMenuContainer, title: currentlevel, errors: null };
      }), dialogs, errors);
      throw error;
    }
    await click('GJ_pauseBtn_001.png');
    const savePoint = await page.evaluate(() => {
      const s = window.scene.get('GameScene');
      const label = s._editorMenuContainer.list.find(o => o.text === 'Save and Exit');
      const b = label.getBounds(), c = s.game.canvas.getBoundingClientRect();
      return { x: c.left + b.centerX * c.width / s.scale.width, y: c.top + b.centerY * c.height / s.scale.height };
    });
    await page.mouse.click(savePoint.x, savePoint.y, { delay: 60 });
    await page.waitForFunction(() => !window.isEditor && window.scene.get('GameScene')._levelViewOverlay, {}, { timeout: 30000 });
    const editorSave = await page.evaluate(async () => {
      const records = JSON.parse(localStorage.getItem('created_levels'));
      const level = records.find(l => l.createdId === 'local_3');
      return { objects: parseLevel(await window.CreatedLevelStore.loadData(level)).objects.length,
        lastModified: level.lastModified, listBytes: localStorage.getItem('created_levels').length,
        legacy: await window.CreatedLevelStore.loadData(records[0]) };
    });
    assert.equal(editorSave.objects, sourceObjects); assert.ok(editorSave.lastModified);
    assert.ok(editorSave.listBytes < 10000); assert.equal(hash(editorSave.legacy), hash(legacyData));
    delete editorSave.legacy;
    console.log('PASS editor opens and saves the large level; existing level data preserved');
    assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
    const result = { legacyBytes, listBytes: persisted.listBytes, payloadCount: persisted.records.length,
      payloadHash: hash(data), gameplay, editorSave, errors, dialogs, importedVia: 'Creator > Create > Import > file chooser > reload > View > Play' };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
