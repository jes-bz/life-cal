import {generateRectData,DEVICES,getWeeksLived} from '../../shared/calendar-logic.js';
import {build} from '../../worker/node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bundled=await build({entryPoints:[root+'worker/src/png.ts'],bundle:true,format:'esm',write:false});
const {renderPng}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const output=fileURLToPath(new URL('../target/pixel-check.png',import.meta.url));
function decode(bytes){let palette;const chunks=[];for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at),kind=bytes.toString('ascii',at+4,at+8),data=bytes.subarray(at+8,at+8+length);if(kind==='PLTE')palette=data;if(kind==='IDAT')chunks.push(data);at+=length+12;}return {palette,raw:inflateSync(Buffer.concat(chunks))};}
let count=0;
for(const [device,{width,height}] of Object.entries(DEVICES))for(const years of [1,80,120])for(const layout of ['none','top','bottom','right'])for(const colors of [['#000000','#ffffff','#333333'],['#abcdef','#123456','#fedcba'],['#112233','#aabbcc','#aabbcc']]){
 const dob='1990-01-01',weeks=getWeeksLived(dob);
 const squares=generateRectData({width,height,device,years,layout,dob,colorLived:colors[1],colorRest:colors[2]});
 const js=decode(Buffer.from(await renderPng(width,height,squares,colors)));
 execFileSync(root+'worker-rust/target/release/render',[device,String(years),String(weeks),layout,output,...colors]);
 const rust=decode(fs.readFileSync(output));
 try {assert.deepEqual(rust.palette,js.palette);assert.deepEqual(rust.raw,js.raw);}catch(error){console.error({device,years,layout});throw error;}
 count++;
}
console.log(`${count} Rust PNGs match the existing JavaScript renderer pixel-for-pixel, including all Duo and widget layouts.`);
