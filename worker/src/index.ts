
import { initWasm, Resvg } from '@resvg/resvg-wasm';
// @ts-ignore
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
// @ts-ignore
import { generateRectData, CONSTANTS } from '../../shared/calendar-logic.js';

let wasmInitialized = false;

export interface Env {}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (!wasmInitialized) {
            try {
                await initWasm(resvgWasm);
                wasmInitialized = true;
            } catch (err) {
                console.error("Wasm initialization failed:", err);
                return new Response("Internal Server Error: Wasm init failed", { status: 500 });
            }
        }

        const url = new URL(request.url);
        const params = url.searchParams;

        // 1. Parse Params with defaults
        const dob = params.get('dob') || '1990-01-01';
        const years = parseInt(params.get('years') || '80');
        let bg = params.get('bg') || '000000';
        let lived = params.get('lived') || 'ffffff';
        let rest = params.get('rest') || '333333';
        const layout = params.get('layout') || 'none';

        // Fix hex colors if missing #
        if (!bg.startsWith('#')) bg = '#' + bg;
        if (!lived.startsWith('#')) lived = '#' + lived;
        if (!rest.startsWith('#')) rest = '#' + rest;

        const width = CONSTANTS.CANVAS_WIDTH;
        const height = CONSTANTS.CANVAS_HEIGHT;

        // 2. Generate Data using Shared Logic
        const rectsData = generateRectData({
            width,
            height,
            dob,
            years,
            layout,
            colorLived: lived,
            colorRest: rest
        });

        // 3. Generate SVG
        let rects = '';
        for (const r of rectsData) {
            rects += `<rect x="${r.x}" y="${r.y}" width="${r.size}" height="${r.size}" fill="${r.color}" />`;
        }

        const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${bg}" />
    ${rects}
</svg>
`.trim();

        // 4. Convert to PNG using Resvg
        const resvg = new Resvg(svg, {
            fitTo: {
                mode: 'width',
                value: width,
            },
        });

        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        return new Response(pngBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400',
                'Content-Disposition': `inline; filename="life-calendar-${dob}.png"`
            }
        });
    }
};
