import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { DEVICES, generateRectData, getWeeksLived } from '../../calendar-logic.js';

function decode(png) {
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    let palette, width, height;
    const data = [];
    for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset);
        const type = png.toString('ascii', offset + 4, offset + 8);
        const body = png.subarray(offset + 8, offset + 8 + length);
        assert.equal(body.length, length);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            assert.deepEqual([...body.subarray(8)], [4, 3, 0, 0, 0]);
        }
        if (type === 'PLTE') palette = body;
        if (type === 'IDAT') data.push(body);
        offset += length + 12;
    }
    assert.equal(palette.length, 45);
    const raw = inflateSync(Buffer.concat(data));
    const stride = Math.ceil(width / 2) + 1;
    assert.equal(raw.length, stride * height);
    for (let y = 0; y < height; y++) assert.equal(raw[y * stride], 0);
    return {
        width,
        height,
        pixel(x, y) {
            const byte = raw[y * stride + 1 + (x >>> 1)];
            const index = x & 1 ? byte & 15 : byte >>> 4;
            assert.ok(index < 15);
            return [...palette.subarray(index * 3, index * 3 + 3)];
        }
    };
}

const render = fileURLToPath(new URL('../target/release/render', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'life-cal-renderer-'));
const output = join(directory, 'calendar.png');
const dob = '1990-01-01';
const now = new Date('2026-10-17T12:00:00Z');
const weeks = getWeeksLived(dob, now);
const palettes = [
    ['#000000', '#ffffff', '#333333'],
    ['#abcdef', '#123456', '#fedcba'],
    ['#112233', '#aabbcc', '#aabbcc']
];
let count = 0;
try {
    for (const [device, { width, height }] of Object.entries(DEVICES)) {
        for (const years of [1, 80, 120]) {
            for (const layout of ['none', 'top', 'bottom', 'right']) {
                for (const colors of palettes) {
                    const squares = generateRectData({
                        width, height, device, years, layout, dob, now,
                        colorLived: colors[1], colorRest: colors[2]
                    });
                    execFileSync(render, [device, String(years), String(weeks), layout, output, ...colors]);
                    const image = decode(readFileSync(output));
                    assert.equal(image.width, width);
                    assert.equal(image.height, height);
                    const rgb = colors.map(color => [0, 2, 4].map(i => parseInt(color.slice(i + 1, i + 3), 16)));
                    assert.deepEqual(image.pixel(0, 0), rgb[0]);
                    assert.deepEqual(image.pixel(width - 1, height - 1), rgb[0]);
                    const rightInset = width * (device.startsWith('duo-') ? 0.22 : layout === 'right' ? 0.32 : 0);
                    for (const square of squares) {
                        assert.ok(square.x >= 0 && square.y >= 0);
                        assert.ok(square.x + square.size <= width - rightInset + 0.02);
                        assert.ok(square.y + square.size <= height + 0.02);
                        const x = Math.ceil(square.x) + 1;
                        const y = Math.ceil(square.y) + 1;
                        const foreground = square.color === colors[1] ? rgb[1] : rgb[2];
                        assert.deepEqual(image.pixel(x, y), foreground);
                        assert.deepEqual(image.pixel(Math.floor(square.x) - 1, y), rgb[0]);
                        const left = Math.floor(square.x);
                        const right = Math.ceil(square.x + square.size) - 1;
                        const top = Math.floor(square.y);
                        const bottom = Math.ceil(square.y + square.size) - 1;
                        // Boundary pixels cover fractions of a square, quantized to seven levels.
                        for (const [px, py] of [
                            [left, top], [right, top], [left, bottom], [right, bottom],
                            [left, y], [right, y], [x, top], [x, bottom]
                        ]) {
                            const horizontal = Math.min(px + 1, square.x + square.size) - Math.max(px, square.x);
                            const vertical = Math.min(py + 1, square.y + square.size) - Math.max(py, square.y);
                            const coverage = Math.round(horizontal * vertical * 7);
                            const expected = rgb[0].map((bg, channel) =>
                                Math.round(bg + (foreground[channel] - bg) * coverage / 7));
                            assert.deepEqual(image.pixel(px, py), expected);
                        }
                    }
                    if (device.startsWith('duo-')) {
                        const bottom = Math.max(...squares.map(square => square.y + square.size));
                        assert.ok(Math.abs(bottom - height * 0.94) < 0.02);
                    }
                    count++;
                }
            }
        }
    }
} finally {
    rmSync(directory, { recursive: true, force: true });
}
console.log(`${count} PNG device/layout/year/color cases passed: native sizes, browser geometry, colors, gaps, and Duo margins.`);
