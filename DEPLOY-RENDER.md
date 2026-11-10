# Web Dashers indítása Renderen

[Éles játékoldal](https://webdash-play-ajtg.onrender.com/)

**Ismert korlát (2026-11-10):** a GD szervere Cloudflare 1005 hibával tiltja a Render hálózatát. Emiatt az online pályakeresés/letöltés és a GD-s zenei metaadatok jelenleg nem érhetők el innen. A beépített pályák, GMD-import és közvetlen könyvtári zene/SFX letöltés használható. Az API öt percig szünetelteti a tiltott kéréseket; a felület jelzi az okot. A feloldáshoz a GD oldalán engedélyezés vagy engedélyezett API-szolgáltatás szükséges.

A konfiguráció két szolgáltatást hoz létre:

- `webdash-play`: ingyenes Static Site, a játék fájljait CDN szolgálja ki.
- `webdash-api`: ingyenes Python Web Service a pályakereséshez és hangletöltésekhez.

A játék a látogatók böngészőjében fut. A szerver a GD-adatokat és a hangokat továbbítja, az azonos letöltéseket összevonja, és lemezen gyorsítótárazza. Emiatt húsz játékos nem jelent húsz szerveren futó játékot.

## Indítás

1. Töltsd fel a projektet egy **saját GitHub repositoryba**. A ZIP tartalmát töltsd fel, a `render.yaml` a repository gyökerében legyen. A `.git`, `work` és `dist` mappát hagyd ki.
2. Nyisd meg a [Render Dashboardot](https://dashboard.render.com/), majd **New → Blueprint**. Kapcsold hozzá a GitHub-fiókodat, és válaszd ki ezt a repositoryt.
3. Ellenőrizd, hogy a `webdash-api` csomagja **Free**, majd indítsd el a Blueprintet. A `webdash-play` Static Site eleve ingyenes. A barátaidnak a **webdash-play** létrejött `onrender.com` címét küldd el.

Engedélyezett, GD-formátummal kompatibilis API esetén a backend `WEBDASH_GD_API_BASE` környezeti változója annak HTTPS-alapcímére állítható, majd a szolgáltatás újraindítható. Alapértéke `https://www.boomlings.com/database`. Csak jogosult adatforrást állíts be.

A Blueprint automatikusan átadja az API címét a frontendnek. A Static Site build parancsa `python tools/build-web.py`, a publikált mappa `dist`. A backend indítóparancsa `python tools/webdash-server.py --production`, health check útvonala `/gd-health`. Nincs telepítendő Python-csomag.

Ha a frontend buildje hiányzó API-címet jelez, ellenőrizd, hogy a `webdash-api` már létrejött, majd futtasd újra a Blueprint syncet és a frontend deployt. Kézi konfigurációnál a frontend `WEBDASH_API_BASE` változója az API teljes HTTPS-címe legyen, majd buildeld újra a frontendet.

## Mit jelent a Free csomag?

A Render jelenlegi szabályai szerint a backend 15 perc tétlenség után leáll, és az ébresztése körülbelül egy perc lehet. A játék felülete a külön Static Site-ról eközben is elérhető. A letöltés megvárja a szervert, és felül jelzi az ébredést, majd a zenék és SFX-fájlok betöltését.

Helyi tesztben 20 egyidejű azonos, 1 MiB-os letöltés egyetlen külső kérést használt. A különböző letöltések legfeljebb 6 külső kérést futtatnak egyszerre; a cache 384 MiB, a fájlméret felső határa 48 MiB. Ez a helyi ellenőrzés még nem Renderen mért kapacitásígéret. A tényleges sebesség a Free géptől, a külső GD-szervertől, a letöltések méretétől és a havi adatforgalmi kerettől is függ.

Az éles Render-szolgáltatáson 2026-11-10-én 20 párhuzamos, egyenként 141 028 bájtos SFX-letöltés 1,88 másodperc alatt sikerült: 1 külső letöltés, 10 összevont kérés és 9 cache-találat. Ez a letöltési próba nem jelent húsz különböző pálya teljes játékterhelésére vonatkozó garanciát.

A lemezes cache újraindításkor elveszhet, és újraépül. A havi ingyenes üzemidő és adatforgalom aktuális keretét a Dashboard mutatja. [Render Free dokumentáció](https://render.com/docs/free).

## Helyi indítás és ellenőrzés

Python 3.13 és Node.js mellett:

```powershell
npm start
npm run check
npm test
npm run test:server
```

A helyi cím `http://127.0.0.1:8765/`. A `start-webdash.bat` is használható. Kódfrissítés után a böngészőben `Ctrl+F5` szükséges.

Az önálló statikus buildhez állítsd be a valós API-címet:

```powershell
$env:WEBDASH_API_BASE = 'https://SAJAT-API.onrender.com'
npm run build
```

A build mindig újra létrehozza a projekt `dist` mappáját. A natív GD, a videók és a helyi mérési fájlok nem kerülnek bele.
