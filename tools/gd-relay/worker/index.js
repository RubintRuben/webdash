// Public read-only GD relay. No accounts, uploads, or arbitrary target URLs.
const UPSTREAM = 'https://www.boomlings.com/database/';
const ORIGINS = new Set(['https://webdash-play-ajtg.onrender.com', 'https://web-dashers.github.io']);
const ENDPOINTS = new Map([
  ['getGJLevels21.php', 60], ['downloadGJLevel22.php', 3600], ['getGJSongInfo.php', 3600]
]);
const FIELDS = new Set(['str', 'type', 'page', 'count', 'len', 'diff', 'demonFilter',
  'star', 'noStar', 'featured', 'original', 'twoPlayer', 'coins', 'epic', 'legendary',
  'mythic', 'song', 'customSong', 'followed', 'onlyCompleted', 'uncompleted',
  'gauntlet', 'levelID', 'songID', 'inc', 'extras', 'local', 'objects', 'total']);
const pending = new Map();
// Workers for Platforms does not grant access to the shared default cache.
// Keep a bounded per-isolate LRU instead; concurrent requests are coalesced.
const entries = new Map();
let cacheBytes = 0;
const reply = (body, status = 200, headers = {}) => new Response(body, {status,
  headers: {'Content-Type':'text/plain; charset=utf-8', 'X-Content-Type-Options':'nosniff', ...headers}});

function validBody(endpoint, params) {
  if (endpoint === 'downloadGJLevel22.php' && !/^[1-9]\d{0,9}$/.test(params.get('levelID') || '')) return false;
  if (endpoint === 'getGJSongInfo.php' && !/^[1-9]\d{0,9}$/.test(params.get('songID') || '')) return false;
  return (params.get('str') || '').length <= 200;
}

async function upstream(endpoint, params, cacheKey, ttl, ctx) {
  const cached = entries.get(cacheKey.url);
  if (cached && cached.expires > Date.now()) {
    entries.delete(cacheKey.url);entries.set(cacheKey.url,cached);
    return reply(cached.data,200,{'X-WebDash-Cache':'HIT'});
  }
  const body = new URLSearchParams({gameVersion:'22', binaryVersion:'47', gdw:'0', secret:'Wmfd2893gb7'});
  for (const [key,value] of params) if (FIELDS.has(key)) body.set(key,value);
  const response = await fetch(UPSTREAM + endpoint, {method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':''}, body:body.toString(),
    redirect:'manual', signal:AbortSignal.timeout(18000)});
  if (!response.ok) return reply('GD upstream temporarily unavailable', 503, {'Retry-After':'60'});
  const data = await response.text();
  // An HTML protection page or incomplete metadata must never masquerade as a level download.
  if (!data || data.length > 32 * 1024 * 1024 || /^\s*(?:<|error code:)/i.test(data) ||
      endpoint === 'downloadGJLevel22.php' && data !== '-1' && !/(?:^|:)4:[A-Za-z0-9_+/=-]+(?=:|$)/.test(data))
    return reply('Invalid GD upstream response', 502, {'Retry-After':'60'});
  const result = reply(data, 200, {'Cache-Control':`public, max-age=${data.startsWith('-') ? 2 : ttl}`, 'X-WebDash-Cache':'MISS'});
  if (cached) { entries.delete(cacheKey.url);cacheBytes-=cached.data.length*2; }
  if (data.length * 2 <= 24 * 1024 * 1024) {
    entries.set(cacheKey.url,{data,expires:Date.now()+(data.startsWith('-')?2:ttl)*1000});
    cacheBytes+=data.length*2;
    while (entries.size > 64 || cacheBytes > 24*1024*1024) {
      const key=entries.keys().next().value;cacheBytes-=entries.get(key).data.length*2;entries.delete(key);
    }
  }
  return result;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = origin && (ORIGINS.has(origin) || /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin));
    const cors = allowed ? {'Access-Control-Allow-Origin':origin, 'Vary':'Origin',
      'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type',
      'Access-Control-Expose-Headers':'X-WebDash-Cache, Retry-After', 'Access-Control-Max-Age':'86400'} : {};
    const finish = response => {
      const output = new Response(response.body, response);
      for (const [key,value] of Object.entries(cors)) output.headers.set(key,value);
      return output;
    };
    if (origin && !allowed) return reply('Origin not allowed',403);
    const url = new URL(request.url);
    if (url.pathname === '/gd-health' || url.pathname === '/')
      return finish(reply(JSON.stringify({ok:true, service:'webdash-gd-read-relay', version:1}),200,{'Content-Type':'application/json'}));
    const endpoint = url.pathname.replace(/^\/(?:gd-api\/)?/,'');
    if (!ENDPOINTS.has(endpoint)) return finish(reply('Not found',404));
    if (request.method === 'OPTIONS') return finish(new Response(null,{status:204}));
    if (request.method !== 'POST') return finish(reply('Use POST',405));
    if (Number(request.headers.get('Content-Length')) > 8192) return finish(reply('Request too large',413));
    try {
      const raw = await request.text();
      if (raw.length > 8192) return finish(reply('Request too large',413));
      const params = new URLSearchParams();
      for (const [key,value] of new URLSearchParams(raw)) if (FIELDS.has(key)) params.set(key,value);
      if (!validBody(endpoint,params)) return finish(reply('Invalid query',400));
      params.sort();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(params.toString())))].map(n=>n.toString(16).padStart(2,'0')).join('');
      const key = new Request(`${url.origin}/cache/${endpoint}/${digest}`);
      if (!pending.has(key.url)) {
        if (pending.size >= 32) return finish(reply('Busy; retry shortly',503,{'Retry-After':'2'}));
        const work = upstream(endpoint,params,key,ENDPOINTS.get(endpoint),ctx)
          .then(async r=>({body:await r.text(),status:r.status,headers:Object.fromEntries(r.headers)}))
          .finally(()=>pending.delete(key.url));
        pending.set(key.url,work);
      }
      const result = await pending.get(key.url);
      return finish(new Response(result.body,result));
    } catch (error) {
      console.error('GD relay failed:', error.name, error.message);
      return finish(reply('GD upstream connection failed',503,{'Retry-After':'30'}));
    }
  }
};
