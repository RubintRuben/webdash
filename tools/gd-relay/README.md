# WebDash public GD relay

Live origin: https://webdash-gd-read-relay.peakednote2.chatgpt.site

This Worker forwards three public read endpoints to the fixed Boomlings database
origin: level search, raw level download, and song information. It accepts no GD
account credentials, uploads, or arbitrary upstream URLs. Browser CORS allows the
game's Render origin, its original GitHub Pages origin, and localhost development.

The Worker bounds its cache at 24 MiB / 64 entries and coalesces up to 32 distinct
in-flight requests. Non-browser clients can use the same read endpoints. CORS is
a browser policy, not authentication. Upstream availability and hosting quotas
still apply.

Run `node --test tools/gd-relay/test.mjs` from the repository root.
`node tools/gd-relay/build.mjs` prepares the Worker artifact inside this folder.
The existing Sites project is `appgprj_6af63effad908191b0ea27df726470c7`;
update that project rather than creating another relay.

The frontend build variable `WEBDASH_GD_RELAY_BASE` and backend runtime variable
`WEBDASH_GD_API_BASE` can override the relay origin. The frontend still has
independent fallback routes and circuit breakers for unavailable origins.
