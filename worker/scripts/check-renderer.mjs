import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';
const built = await build({absWorkingDir: new URL('../', import.meta.url).pathname,entryPoints:['src/png.ts'],bundle:true,write:false,format:'esm',platform:'neutral'});
const {renderPng} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`);
import { generateRectData, DEVICES } from '../../shared/calendar-logic.js';

function decode(png) {
    assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    let palette, width, height;
    const data = [];
    for (let offset = 8; offset < png.length;) {
        const view = new DataView(png.buffer, png.byteOffset + offset);
        const length = view.getUint32(0);
        const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
        const body = png.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = new DataView(body.buffer, body.byteOffset).getUint32(0);
            height = new DataView(body.buffer, body.byteOffset).getUint32(4);
            assert.equal(body[8], 4); assert.equal(body[9], 3);
        }
        if (type === 'PLTE') palette = body;
        if (type === 'IDAT') data.push(body);
        offset += length + 12;
    }
    const raw = inflateSync(Buffer.concat(data));
    const stride = Math.ceil(width / 2) + 1;
    assert.equal(raw.length, stride * height);
    for (let y = 0; y < height; y++) assert.equal(raw[y * stride], 0);
    return { width, height, pixel(x, y) {
        const byte = raw[y * stride + 1 + (x >>> 1)];
        const index = x & 1 ? byte & 15 : byte >>> 4;
        assert.ok(index < 15);
        return [...palette.subarray(index * 3, index * 3 + 3)];
    }};
}
let width = 1320, height = 2868;
for (const [device, dimensions] of Object.entries(DEVICES)) for (const years of [1, 80, 120]) for (const layout of ['none', 'top', 'bottom', 'right']) {
    ({width, height} = dimensions);
    const colors = ['#102030', '#abcdef', '#2468ac'];
    const squares = generateRectData({ width, height, dob: '1990-01-01', years, layout, device, colorLived: colors[1], colorRest: colors[2] });
    const reservedRight = width * (layout === 'right' ? 0.32 : device.startsWith('duo-') ? 0.22 : 0);
    for (const square of squares) {
        assert.ok(square.x >= 0 && square.y >= 0);
        assert.ok(square.x + square.size <= width - reservedRight + 0.02);
        assert.ok(square.y + square.size <= height + 0.02);
    }
    const image = decode(await renderPng(width, height, squares, colors));
    assert.equal(image.width, width); assert.equal(image.height, height);
    assert.deepEqual(image.pixel(0, 0), [16,32,48]);
    for (const square of squares) {
        const x = Math.ceil(square.x) + 1, y = Math.ceil(square.y) + 1;
        if (y < height && x < width) {
            const expected = square.color === colors[1] ? [171,205,239] : [36,104,172];
            assert.deepEqual(image.pixel(x, y), expected);
        }
    }
}
// Exercise clipping and the two nibbles of a packed pixel byte independently.
const tiny = decode(await renderPng(5, 3, [{x:1,y:1,size:2,color:'#ffffff'}], ['#000000','#ffffff','#333333']));
assert.deepEqual(tiny.pixel(0,1), [0,0,0]);
assert.deepEqual(tiny.pixel(1,1), [255,255,255]);
assert.deepEqual(tiny.pixel(2,1), [255,255,255]);
assert.deepEqual(tiny.pixel(3,1), [0,0,0]);
width = 1320; height = 2868;
const squares = generateRectData({width,height,dob:'1990-01-01',years:80,layout:'none',colorLived:'#ffffff',colorRest:'#333333'});
const times=[];
for(let i=0;i<6;i++) { const start=performance.now(); const png=await renderPng(width,height,squares,['#000000','#ffffff','#333333']); times.push(performance.now()-start); assert.ok(png.length < 150000); }
console.log('60 device/layout/year combinations and packed-pixel checks passed.');
console.log('Renderer wall time (ms, local Node; not Cloudflare CPU):', times.map(n=>n.toFixed(2)).join(', '));
