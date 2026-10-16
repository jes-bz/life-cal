# Life Calendar Worker

This Cloudflare Worker generates the Life Calendar PNG images on the fly.

## Returning to this project

The website at `https://jes.bz/life-cal/` deploys through GitHub Pages on pushes
to `main`. The PNG endpoint at `https://life-cal.jes.bz/` deploys separately:

```bash
cd worker
npm ci
npx wrangler whoami
# If needed: npx wrangler login
npm run deploy
```

`wrangler.toml` enables persisted invocation logs with full sampling. Changes
take effect after deploying. In Cloudflare, open **Workers & Pages →
life-cal-worker → Observability** to inspect new invocations, outcomes, CPU time,
and exceptions. For live output, run `npx wrangler tail` from this directory.
Logs are not retroactive. Invocation logs may include request URLs (including
the birthdate query parameter); custom render logs omit dates and full URLs.

The Worker redirects bare-root visits (including unknown-query-only requests) to
`https://jes.bz/life-cal/`. Configured links still produce PNGs. `/robots.txt`
asks cooperative crawlers not to index the image endpoint. Unknown paths and
invalid inputs return before image generation; HEAD requests never render.

The renderer creates a native-resolution indexed PNG directly (1320 × 2868 by default), using a small fixed-Huffman DEFLATE
encoder that copies repeated scanlines. It does not load Wasm or build SVG. Seven coverage levels for each
foreground color preserve softened square edges; edge pixels can differ slightly
from the previous SVG renderer. The background and full-coverage colors retain
exact RGB values. The UI still previews and downloads images locally using canvas.

The Cache API key includes the visible number of weeks lived, years, colors, and
layout. It ignores parameter order, unknown parameters, and birthdates that produce
the same image. Cached image data lives for up to seven days; the filename is set
per response. Client caching lasts up to one hour, bounded by the next week-change
instant. `X-Calendar-Cache: HIT` or `MISS` identifies the response path.
Cache entries remain local to a Cloudflare data center and may be evicted.

Invocation logs expose CPU time, outcomes, request headers, and status. Structured
`calendar_request` logs add bounded paths, user agents, country, ASN, and location
without custom logging of IPs or birthdates. User agents are claims, not reliable
identity. Compare `calendar_render_start`, `calendar_render_complete`, and
`calendar_cache_hit` with invocation CPU/outcomes. No browser challenges or user
agent blocking are enabled, so iPhone Shortcuts remain supported. Logs only cover
traffic after observability was enabled; exclude our curl verification requests
when assessing usage. Requests to the static GitHub Pages UI are separate from
Worker invocations and are not counted by these logs.

Local verification (Node with TypeScript stripping support):

```bash
node scripts/check-deflate.mjs
node scripts/check-renderer.mjs
node scripts/check-worker.mjs
npx tsc --noEmit --target es2022 --lib es2022 --module esnext --moduleResolution bundler --types @cloudflare/workers-types src/index.ts
```

The renderer checks decode generated PNGs and inspect dimensions and square
interiors across all five device sizes and four layouts at 1, 80, and 120 years. The handler checks routing,
HEAD behavior, cache normalization, per-request filenames, cross-day reuse, and
week-boundary expiry. Local timing is wall time and does not establish Cloudflare
CPU usage; verify production invocation logs after deployment.

Validate configuration and bundle without publishing:

```bash
npx wrangler deploy --dry-run
```

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Login to Cloudflare (if not already logged in):
    ```bash
    npx wrangler login
    ```

3.  Deploy:
    ```bash
    npm run deploy
    ```

## Development

To run locally:
```bash
npm run dev
```

## Integration

Update `WORKER_URL` in `../index.html` with your deployed worker URL (e.g., `https://life-cal-worker.yourname.workers.dev`).
## Performance validation (2026-10-16)

The deployed direct renderer preserves the 1320 × 2868 dimensions. The standard
image is approximately 90 KB versus 137 KB for the original Resvg output. A
native-deflate prototype produced a smaller 16 KB image but still used 46–129 ms
of CPU in the sampled uncached requests. The final scanline-copy encoder trades
some compression efficiency for less repeated pixel processing.

The original default render measured 476 ms CPU. Initial final-deployment widget
renders measured 48–65 ms; one cache hit measured 1 ms. These are a few individual
requests, not a statistical benchmark or proof that free-tier CPU failures are
resolved. Local timing and HTTP 200 responses alone do not establish CPU-budget
compliance. Inspect future invocation outcomes and CPU time before declaring the
issue fixed. No paid resources, bot challenges, or automatic blocking were added.

Device presets are shared with the web UI in `shared/calendar-logic.js`.
`device=duo-outer` selects 1398 × 2034; `duo-inner` selects 1878 × 2670;
`duo-inner-landscape` selects 2670 × 1878; `iphone` selects 1206 × 2622.
Omitted `device` defaults to `max` (1320 × 2868). Unknown device values return 400.
Cache keys include the device. Duo presets reserve 22% of width on the right,
35% of height above the grid, and 6% below it. Duo always uses this fixed layout;
legacy top/bottom/right layout parameters map to the same image and cache key.
These are practical estimates, not Apple's exact Lock Screen bounds.
