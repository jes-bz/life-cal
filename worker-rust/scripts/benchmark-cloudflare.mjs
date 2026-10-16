import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
function decode(b){const parts=[];let palette;for(let at=8;at<b.length;){const n=b.readUInt32BE(at),k=b.toString('ascii',at+4,at+8);if(k==='PLTE')palette=b.subarray(at+8,at+8+n);if(k==='IDAT')parts.push(b.subarray(at+8,at+8+n));at+=n+12;}return {palette,raw:inflateSync(Buffer.concat(parts))};}
const rows=[],start=Date.now();let comparisons=0;
const [jsUrl,rustUrl,output]=process.argv.slice(2);
if(!jsUrl||!rustUrl||!output)throw Error('Usage: node benchmark-cloudflare.mjs <JS test URL> <Rust test URL> <output.json>');
const bases={js:jsUrl,rust:rustUrl};
for(let round=0;round<5;round++)for(const device of ['iphone','max','duo-outer','duo-inner','duo-inner-landscape']){
 const query=new URLSearchParams({device,years:round===4?'120':'90',dob:'1990-01-01',layout:['none','top','bottom','right','none'][round],bg:(0x101000+rows.length).toString(16),lived:'ffffff',rest:'333333'}).toString();
 const images={};
 for(const variant of round%2?['rust','js']:['js','rust']){
  const t=performance.now(),r=await fetch(bases[variant]+'?'+query),b=Buffer.from(await r.arrayBuffer());
  rows.push({variant,round,device,query,status:r.status,bytes:b.length,wallMs:Math.round(performance.now()-t),cache:r.headers.get('cf-cache-status'),render:r.headers.get('x-calendar-cache'),ray:r.headers.get('cf-ray')});
  if(r.status===200){assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(r.headers.get('x-calendar-cache'),'MISS');images[variant]=decode(b);}
 }
 if(images.js&&images.rust){assert.deepEqual(images.js.palette,images.rust.palette);assert.deepEqual(images.js.raw,images.rust.raw);comparisons++;}
}
const repeats=[];
for(const row of rows.filter(r=>r.round===4)) {const r=await fetch(bases[row.variant]+'?'+row.query);await r.arrayBuffer();repeats.push({variant:row.variant,device:row.device,status:r.status,cache:r.headers.get('cf-cache-status'),render:r.headers.get('x-calendar-cache')});}
const result={start,end:Date.now(),comparisons,rows,repeats};
fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({start,end:result.end,comparisons,requests:rows.length,statuses:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),repeats},null,2));
