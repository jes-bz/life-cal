import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {Miniflare,Log,LogLevel} from '../node_modules/miniflare/dist/src/index.js';
const modules=Object.fromEntries(['worker/shim.mjs','index.js','index_bg.wasm'].map(path=>[path,{type:path.endsWith('.wasm')?'wasm':'esm',contents:readFileSync(new URL('../build/'+path,import.meta.url))}]));
const mf=new Miniflare({workers:[{config:{name:'calendar-test',compatibilityDate:'2024-01-17',manifest:{mainModule:'worker/shim.mjs',modulesRoot:fileURLToPath(new URL('../build/',import.meta.url)),modules}}}],log:new Log(LogLevel.ERROR)});
const call=(query='',method='GET',path='/')=>mf.dispatchFetch(`https://example.com${path}${query}`,{method,redirect:'manual'});
try {
 assert.equal((await call()).status,302);
 assert.equal((await call('?junk=x')).status,302);
 assert.equal((await call('','GET','/unknown')).status,404);
 assert.equal((await call('?years=80','POST')).status,405);
 assert.match(await (await call('','GET','/robots.txt')).text(),/Disallow: \//);
 for(const query of ['?dob=2026-02-30','?years=121','?years=1.1','?bg=fff','?device=bad','?layout=bad'])assert.equal((await call(query)).status,400);
 const head=await call('?dob=1990-01-01','HEAD');
 assert.equal(head.status,200);assert.equal(head.headers.get('Cache-Control'),'no-store');assert.equal((await head.arrayBuffer()).byteLength,0);
 const first=await call('?dob=1990-01-01');
 assert.equal(first.headers.get('X-Calendar-Cache'),'MISS');assert.equal(first.headers.get('X-Calendar-Renderer'),'rust-1');
 const bytes=Buffer.from(await first.arrayBuffer());assert.equal(bytes.readUInt32BE(16),1320);assert.equal(bytes.readUInt32BE(20),2868);
 // waitUntil cache writes finish before checking equivalence.
 const shared=await call('?junk=xyz&dob=1990-01-02');
 assert.equal(shared.headers.get('X-Calendar-Cache'),'HIT');assert.match(shared.headers.get('Content-Disposition'),/1990-01-02/);
 assert.deepEqual(Buffer.from(await shared.arrayBuffer()),bytes);
 const hitHead=await call('?dob=1990-01-01','HEAD');assert.equal(hitHead.headers.get('X-Calendar-Cache'),'HIT');assert.equal((await hitHead.arrayBuffer()).byteLength,0);
 for(const [device,width,height] of [['iphone',1206,2622],['max',1320,2868],['duo-outer',1398,2034],['duo-inner',1878,2670],['duo-inner-landscape',2670,1878]]){
  const r=await call(`?device=${device}&years=120&layout=right&bg=ABCDEF`);assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');const b=Buffer.from(await r.arrayBuffer());assert.equal(b.readUInt32BE(16),width);assert.equal(b.readUInt32BE(20),height);
 }
 const fixed=await call('?device=duo-outer&layout=none');const image=Buffer.from(await fixed.arrayBuffer());
 for(const layout of ['top','bottom','right']){const r=await call(`?device=duo-outer&layout=${layout}`);assert.equal(r.headers.get('X-Calendar-Cache'),'HIT');assert.deepEqual(Buffer.from(await r.arrayBuffer()),image);}
 console.log('Rust Wasm routing, validation, HEAD, PNG dimensions, CORS, normalized cache, filenames, and Duo layouts passed.');
} finally {await mf.dispose();}
