// Narrow RFC 1950/1951 encoder for repeated PNG scanlines. Fixed Huffman
// codes, byte runs and preceding-row copies avoid a full framebuffer scan.
export interface Band { row: Uint8Array; repeat: number }
const lengthBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const lengthExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const distanceBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const distanceExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
function reverse(value: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) { result = (result << 1) | (value & 1); value >>>= 1; }
    return result;
}
const literalBits = Uint8Array.from({length:288}, (_, n) => n < 144 ? 8 : n < 256 ? 9 : n < 280 ? 7 : 8);
const literalCodes = Uint16Array.from({length:288}, (_, n) => reverse(n < 144 ? n + 48 : n < 256 ? n - 144 + 400 : n < 280 ? n - 256 : n - 280 + 192, literalBits[n]));
const lengthIndices = Uint8Array.from({length:259}, (_, n) => { let i=0; while (i < 28 && lengthBase[i+1] <= n) i++; return i; });
export function deflateBands(bands: Band[]): Uint8Array {
    const output: number[] = [0x78, 0x01];
    let pending = 0, count = 0;
    const bits = (value: number, size: number) => {
        pending |= value << count;
        count += size;
        while (count >= 8) { output.push(pending & 255); pending >>>= 8; count -= 8; }
    };
    const literal = (value: number) => bits(literalCodes[value], literalBits[value]);
    const match = (length: number, distance: number) => {
        const li = lengthIndices[length];
        literal(257 + li);
        bits(length - lengthBase[li], lengthExtra[li]);
        let di = 0;
        while (di < 29 && distanceBase[di + 1] <= distance) di++;
        bits(reverse(di, 5), 5);
        bits(distance - distanceBase[di], distanceExtra[di]);
    };
    bits(3, 3);
    let a = 1, b = 0;
    for (const {row, repeat} of bands) {
        if (!repeat) continue;
        if (row.length > 32768) throw new Error('Scanline exceeds DEFLATE window');
        let sum = 0, weighted = 0;
        for (let i = 0; i < row.length; i++) { sum += row[i]; weighted += (row.length - i) * row[i]; }
        // Adler-32 for repeated rows without visiting repeated pixels.
        b = (b + ((repeat * row.length) % 65521) * a + repeat * (weighted % 65521) + ((row.length * sum) % 65521) * ((repeat * (repeat - 1) / 2) % 65521)) % 65521;
        a = (a + repeat * sum) % 65521;
        for (let i = 0; i < row.length;) {
            const value = row[i];
            let end = i + 1;
            while (end < row.length && row[end] === value) end++;
            literal(value);
            let remaining = end - i - 1;
            while (remaining >= 3) { const size = Math.min(258, remaining); match(size, 1); remaining -= size; }
            while (remaining-- > 0) literal(value);
            i = end;
        }
        let remaining = row.length * (repeat - 1);
        while (remaining >= 3) { const size = Math.min(258, remaining); match(size, row.length); remaining -= size; }
        for (let i = 0; i < remaining; i++) literal(row[(row.length - (remaining % row.length) + i) % row.length]);
    }
    literal(256);
    if (count) output.push(pending & 255);
    output.push((b >>> 8) & 255, b & 255, (a >>> 8) & 255, a & 255);
    return Uint8Array.from(output);
}
