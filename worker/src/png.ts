import { deflateBands, type Band } from './deflate';

// Small indexed PNG renderer for opaque, axis-aligned calendar squares.
// Seven coverage levels per foreground color retain antialiased edges without
// allocating an RGBA framebuffer or loading an SVG/Wasm rendering engine.
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function chunk(type: string, data: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length + 12);
    const view = new DataView(result.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) result[4 + i] = type.charCodeAt(i);
    result.set(data, 8);
    let crc = 0xffffffff;
    for (let i = 4; i < result.length - 4; i++) crc = crcTable[(crc ^ result[i]) & 255] ^ (crc >>> 8);
    view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0);
    return result;
}
export interface Square { x: number; y: number; size: number; color: string }
export async function renderPng(width: number, height: number, squares: Square[], colors: string[]): Promise<Uint8Array> {
    const rgb = colors.map(hex => [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16)));
    const palette = new Uint8Array(15 * 3);
    palette.set(rgb[0]);
    for (let color = 1; color <= 2; color++) {
        for (let coverage = 1; coverage <= 7; coverage++) {
            const index = (color - 1) * 7 + coverage;
            for (let channel = 0; channel < 3; channel++) {
                palette[index * 3 + channel] = Math.round(rgb[0][channel] + (rgb[color][channel] - rgb[0][channel]) * coverage / 7);
            }
        }
    }
    // Build at most three unique scanlines per nonoverlapping calendar grid
    // row. Margins and square interiors are repeated rows, not pixel buffers.
    const stride = Math.ceil(width / 2) + 1;
    const blank = new Uint8Array(stride);
    const bands: Band[] = [];
    const groups = new Map<number, Square[]>();
    for (const square of squares) {
        const group = groups.get(square.y);
        if (group) group.push(square); else groups.set(square.y, [square]);
    }
    const setPixel = (row: Uint8Array, x: number, value: number) => {
        const index = 1 + (x >>> 1);
        row[index] = x & 1 ? (row[index] & 0xf0) | value : (row[index] & 0x0f) | (value << 4);
    };
    const scanline = (group: Square[], y: number) => {
        const row = new Uint8Array(stride);
        for (const square of group) {
            const base = square.color.toLowerCase() === colors[1].toLowerCase() ? 0 : 7;
            const left = Math.max(0, Math.floor(square.x));
            const right = Math.min(width, Math.ceil(square.x + square.size));
            if (left >= right) continue;
            const vertical = Math.min(y + 1, square.y + square.size) - Math.max(y, square.y);
            const coverage = Math.round(vertical * 7);
            const value = coverage ? base + coverage : 0;
            row.fill(value * 17, 1 + Math.ceil(left / 2), 1 + Math.floor(right / 2));
            if (left & 1) setPixel(row, left, value);
            if (right & 1) setPixel(row, right - 1, value);
            for (const x of [left, right - 1]) {
                const horizontal = Math.min(x + 1, square.x + square.size) - Math.max(x, square.x);
                const edge = Math.round(horizontal * vertical * 7);
                setPixel(row, x, edge ? base + edge : 0);
            }
        }
        return row;
    };
    let cursor = 0;
    for (const [y, group] of [...groups].sort((a, b) => a[0] - b[0])) {
        const top = Math.max(0, Math.floor(y));
        const bottom = Math.min(height, Math.ceil(y + group[0].size));
        if (bottom <= top) continue;
        if (top > cursor) bands.push({ row: blank, repeat: top - cursor });
        bands.push({ row: scanline(group, top), repeat: 1 });
        if (bottom - top > 2) bands.push({ row: scanline(group, top + 1), repeat: bottom - top - 2 });
        if (bottom - top > 1) bands.push({ row: scanline(group, bottom - 1), repeat: 1 });
        cursor = bottom;
    }
    if (cursor < height) bands.push({ row: blank, repeat: height - cursor });
    const compressed = deflateBands(bands);
    const ihdr = new Uint8Array(13);
    const header = new DataView(ihdr.buffer);
    header.setUint32(0, width);
    header.setUint32(4, height);
    ihdr[8] = 4; // bit depth
    ihdr[9] = 3; // indexed color
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', palette), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())];
    const png = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of parts) { png.set(part, offset); offset += part.length; }
    return png;
}
