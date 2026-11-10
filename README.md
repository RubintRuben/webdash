# Webdash

A browser Geometry Dash port built on [Web Dashers](https://github.com/web-dashers/web-dashers.github.io). It uses Phaser/WebGL, a 240 Hz simulation, native GD atlas data, online level search, music/SFX playback, and an Eclipse-style overlay.

Compatibility with the original game is still being improved. The included tests cover native slope bounds, trigger behavior, gameplay modes, audio and rendering regressions.

## Run locally

Python 3.13 is sufficient to serve the game and its download proxy:

```powershell
python tools/webdash-server.py
```

Open http://127.0.0.1:8765/. On Windows, `start-webdash.bat` also starts the game. Reload the browser after updating source files.

## Deploy

See [DEPLOY-RENDER.md](DEPLOY-RENDER.md) for the GitHub → Render setup. The `render.yaml` creates an API on the Free plan and a static frontend on Render's CDN. The frontend remains accessible while the API wakes up; downloads display their status in the game.

## Verify

With Node.js and Python installed:

```powershell
npm run check
npm test
npm run test:server
```

Browser acceptance scripts in `tools/` use Playwright and Chrome. They need a running local QA server; `test-gd-reported-fixes.cjs` accepts its origin in `WD_URL`.

SoundTouchJS is included under MPL-2.0; its license and source attribution are in `assets/scripts/libs/`.
