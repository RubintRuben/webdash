import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker/index.js';
const cache = new Map();
globalThis.caches = {default:{match:async k=>cache.get(k.url)?.clone(),put:async(k,r)=>cache.set(k.url,r)}};
const waits=[];const ctx={waitUntil:p=>waits.push(p)};
const call=(path,body,origin='https://webdash-play-ajtg.onrender.com')=>worker.fetch(new Request('https://relay.example/'+path,{method:'POST',headers:{Origin:origin},body}),{},ctx);
test('only public read endpoints and known origins are admitted',async()=>{
  assert.equal((await call('uploadGJLevel21.php','')).status,404);
  assert.equal((await call('getGJLevels21.php','str=test','https://unrelated.example')).status,403);
  assert.equal((await call('downloadGJLevel22.php','levelID=https://example.com')).status,400);
});
test('raw download, metadata rejection, coalescing and per-origin cached replies',async()=>{
  let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://www.boomlings.com/database/downloadGJLevel22.php');assert.equal(new URLSearchParams(options.body).get('accountID'),null);return new Response('1:123:2:Level:4:H4sIAAAA_:5:1');};
  const [a,b]=await Promise.all([call('downloadGJLevel22.php','levelID=123&accountID=secret'),call('downloadGJLevel22.php','levelID=123')]);
  assert.equal(calls,1);assert.match(await a.text(),/:4:H4s/);assert.equal(b.status,200);
  await Promise.all(waits);
  const cached=await call('downloadGJLevel22.php','levelID=123','http://localhost:8790');
  assert.equal(cached.headers.get('Access-Control-Allow-Origin'),'http://localhost:8790');assert.equal(calls,1);
  globalThis.fetch=async()=>new Response('{"id":124,"name":"metadata only"}');
  assert.equal((await call('downloadGJLevel22.php','levelID=124')).status,502);
});
