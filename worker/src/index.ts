
import { renderPng } from './png';
// @ts-ignore
import { generateRectData, DEVICES, getDevice, getWeeksLived } from '../../shared/calendar-logic.js';

export interface Env {}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        console.log({
            event: 'calendar_request', path: url.pathname.slice(0, 200), method: request.method,
            userAgent: request.headers.get('user-agent')?.slice(0, 300),
            colo: request.cf?.colo, country: request.cf?.country,
            asn: request.cf?.asn, verifiedBotCategory: request.cf?.verifiedBotCategory
        });
        if (url.pathname === '/robots.txt') {
            return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' } });
        }
        if (url.pathname !== '/') return new Response('Not Found', { status: 404 });
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
        }
        const params = url.searchParams;
        if (!['dob', 'years', 'bg', 'lived', 'rest', 'layout', 'device'].some(key => params.has(key))) {
            return Response.redirect('https://jes.bz/life-cal/', 302);
        }

        // 1. Parse Params with defaults
        const dob = params.get('dob') || '1990-01-01';
        const years = Number(params.get('years') || '80');
        let bg = params.get('bg') || '000000';
        let lived = params.get('lived') || 'ffffff';
        let rest = params.get('rest') || '333333';
        const layout = params.get('layout') || 'none';
        const device = params.get('device') || 'max';

        // Reject malformed/unbounded inputs before allocating rectangles.
        const birth = new Date(dob);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(birth.getTime()) ||
            birth.toISOString().slice(0, 10) !== dob ||
            !Number.isInteger(years) || years < 1 || years > 120 ||
            !['none', 'top', 'bottom', 'right'].includes(layout) || !Object.hasOwn(DEVICES, device) ||
            ![bg, lived, rest].every(color => /^#?[0-9a-fA-F]{6}$/.test(color))) {
            return new Response('Invalid calendar parameters', { status: 400 });
        }

        // Fix hex colors if missing #
        if (!bg.startsWith('#')) bg = '#' + bg;
        if (!lived.startsWith('#')) lived = '#' + lived;
        if (!rest.startsWith('#')) rest = '#' + rest;

        const now = new Date();
        const weeks = getWeeksLived(dob, now);
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const nextChange = now.getTime() >= birth.getTime()
            ? birth.getTime() + weeks * weekMs + 1
            : birth.getTime() - (weeks - 1) * weekMs;
        // Client caches must expire when the date-dependent image changes.
        const clientTtl = Math.max(0, Math.min(3600, Math.floor((nextChange - now.getTime()) / 1000)));

        // Ignore unknown parameters and parameter order so cache-busting junk cannot
        // force a render. Weeks lived identifies the actual image state across days.
        const cacheUrl = new URL('/', url.origin);
        cacheUrl.search = new URLSearchParams({
            v: '5', device, weeks: String(Math.min(weeks, years * 52)),
            years: String(years), bg: bg.toLowerCase(), lived: lived.toLowerCase(),
            rest: rest.toLowerCase(), layout
        }).toString();
        const cacheKey = new Request(cacheUrl.toString());
        const cache = caches.default;
        const cached = await cache.match(cacheKey);
        if (cached) {
            const response = new Response(request.method === 'HEAD' ? null : cached.body, cached);
            response.headers.set('X-Calendar-Cache', 'HIT');
            response.headers.set('Cache-Control', `public, max-age=${clientTtl}`);
            response.headers.set('Content-Disposition', `inline; filename="life-calendar-${dob}.png"`);
            console.log({ event: 'calendar_cache_hit' });
            return response;
        }
        // HEAD probes must not trigger an expensive PNG render.
        if (request.method === 'HEAD') {
            return new Response(null, { headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } });
        }

        console.log({ event: 'calendar_render_start', years, layout, device });
        const { width, height } = getDevice(device);

        // 2. Generate Data using Shared Logic
        const rectsData = generateRectData({
            width,
            height,
            dob,
            years,
            layout,
            colorLived: lived,
            colorRest: rest,
            now,
            device
        });

        const pngBuffer = await renderPng(width, height, rectsData, [bg, lived, rest]);

        const response = new Response(pngBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': `public, max-age=${clientTtl}`,
                'Content-Disposition': `inline; filename="life-calendar-${dob}.png"`
            }
        });
        const stored = response.clone();
        stored.headers.set('Cache-Control', 'public, max-age=604800');
        stored.headers.delete('Content-Disposition');
        ctx.waitUntil(cache.put(cacheKey, stored).catch(err => {
            console.error('Calendar cache write failed', err);
        }));
        response.headers.set('X-Calendar-Cache', 'MISS');
        console.log({ event: 'calendar_render_complete', bytes: pngBuffer.byteLength });
        return response;
    }
};
