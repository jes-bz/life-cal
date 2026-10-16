import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { build } from 'esbuild';
const built=await build({absWorkingDir: new URL('../', import.meta.url).pathname,entryPoints:['src/deflate.ts'],bundle:true,write:false,format:'esm',platform:'neutral'});
const {deflateBands}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`);
let seed=12345;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
for(const length of [1,2,3,4,10,257,258,259,661,1025,8192,32768]) {
 for(const repeat of [1,2,3,17]) {
  for(const mode of ['random','runs','zeros']) {
   const row=Uint8Array.from({length},(_,i)=>mode==='random'?random():mode==='runs'?Math.floor(i/17)%256:0);
   const bands=[{row,repeat},{row:Uint8Array.from([0,255,2]),repeat:3}];
   const expected=Buffer.concat(bands.flatMap(b=>Array.from({length:b.repeat},()=>Buffer.from(b.row))));
   try { assert.deepEqual(inflateSync(deflateBands(bands)),expected); } catch(error) { console.error({length,repeat,mode}); throw error; }
  }
 }
}
assert.deepEqual(inflateSync(deflateBands([])),Buffer.alloc(0));
console.log('145 independent zlib decode/checksum cases passed, including DEFLATE length/distance boundaries.');
