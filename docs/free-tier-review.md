# Keeping Life Calendar free

Review date: October 16, 2026. Recommendations only, except the separately
requested default-device change, which is published.

## Evidence and limits of this review

The website is static GitHub Pages content. Preview and manual PNG download use
canvas locally; neither requires the image Worker. The image Worker supports
persistent image URLs and iPhone automation.

The log query covered the last 24 hours through 12:48 p.m. New York time, but
logging only began around 11:24 a.m. It returned 18 invocation records: 17 curl
requests consistent with our verification and one Gort user-agent request for
robots.txt, apparently a crawler. All 18 recorded outcomes were successful.
This cannot identify the source of the previous day's failures, establish the
number of actual users, or measure visits to the separate static website.

Recorded uncached renders on recent direct-PNG versions used 48–76 ms CPU;
recorded cache hits used 1 ms. A previous Resvg default image used 476 ms. These
are individual requests across versions and configurations, not a controlled
before/after benchmark. Cloudflare documents a 10 ms free HTTP CPU allowance,
with some runtime flexibility. HTTP 200 therefore does not prove a request fits
the allowance: https://developers.cloudflare.com/workers/platform/limits/

A local Node CPU profile exercised 600 renders across all five device presets
and 80/90/120 years. After warmup, geometry took about 0.043 ms at p50 and
0.076 ms at p95; encoding took about 2.32 ms at p50 and 3.19 ms at p95. The
largest local CPU sample categories were PNG chunk/checksum creation, DEFLATE,
bit writing, and scanline construction. Local timings are not Cloudflare CPU
measurements, and the profile is not evidence of production cold-start behavior.

## Five recommendations, in priority order

### 1. Set a measured CPU budget for uncached PNG generation

Impact: critical. Effort: medium to high. No change to image resolution.

The remaining first-render cost is the principal free-tier risk. A cache cannot
serve an image that failed before it was generated. Focus further work on
worker/src/png.ts and worker/src/deflate.ts; the profile does not support spending
more time on coordinate rounding as the main optimization.

Benchmark pre-encoded repeated scanline/DEFLATE templates, precomputed code and
distance tables, fewer temporary arrays, and incremental or combined checksums.
The indexed PNG design separates colors into PLTE, so encoded geometry can be
reused across different color choices. Some partial-row data still varies with
weeks lived; do not assume the entire image is one immutable template.

Acceptance: successful uncached requests for every device, age boundary, and
layout, including fresh isolates. Aim below 5 ms CPU to leave room for routing,
validation, logging, and cache work within the 10 ms allowance. Treat that as a
target to prove, not a promised result. Automate decoder/pixel checks in CI and
retain a small, bounded deployed CPU smoke check as a release gate. The current
GitHub workflow deploys Pages without running the existing verification scripts.

### 2. Add caching before Worker execution, with normalized content URLs

Impact: high for repeated images and geographically spread users. Effort: medium.

The current caches.default lookup happens inside fetch(), so hits still invoke
the Worker. Its entries are local to the data center. Cloudflare now documents
Workers Cache, which can serve responses before code executes, includes tiered
caching and request collapsing, and has no separate cache price. Cache hits still
count at the normal Workers request rate; this does not remove the free request
quota. Sources:
https://developers.cloudflare.com/workers/cache/
https://developers.cloudflare.com/workers/runtime-apis/cache/

Evaluate it on the actual free account before adopting it. The installed
Wrangler is 4.54.0 and its schema does not include this cache configuration;
use a tested dependency upgrade rather than inserting unsupported config.

Use a lightweight configuration URL that redirects to a canonical image URL
containing renderer version, device, layout, visible week count, years, and
colors. Strip irrelevant parameters and omit DOB from the image identity.
The image is then immutable and can have a long edge TTL. The configuration
redirect must expire at the next relevant week change. This avoids relying on
the current one-hour freshness limit for a configuration URL.

Important integration check: Workers Cache can convert a cold HEAD into a GET
and shares their cache entry. Revisit the current HEAD no-render behavior and
ensure probes cannot accidentally seed a bodyless image response. A HIT header
alone is insufficient proof: verify that the invocation count does not increase.
This improves reuse, but does not solve unique first renders.

### 3. Offer optional on-device automation

Impact: highest potential reduction in server dependence. Effort: medium.

Keep the existing simple URL-based automation, but offer a local alternative for
people who want their wallpaper to update without depending on the image server.
Scriptable can run JavaScript from Siri Shortcuts and has native DrawContext
image generation:
https://scriptable.app/
https://docs.scriptable.app/drawcontext/

Export a configured script that generates the full-resolution wallpaper on the
phone, returns an image to Shortcuts, and leaves Set Wallpaper to the Shortcut.
DOB can remain local. This is an architecture option to prototype, not a claim
that the unattended workflow has been verified on a physical iPhone or Duo.

Tradeoff: a one-time app install, script trust/setup instructions, and additional
support burden. It should be optional. Do not present Safari's Run JavaScript on
Web Page action as an interchangeable unattended background renderer.

### 4. Protect expensive cache misses and validate inputs consistently

Impact: high resilience against abuse; moderate effort.

Valid, unique combinations of dates/colors/devices bypass reuse and can force
unlimited rendering attempts even though each parameter is individually valid.
Apply a conservative render budget only after cache lookup. Continue serving
cached images when that budget is reached. Respond with 429 and Retry-After to
new render attempts rather than challenging every request or breaking existing
Shortcuts. Keep robots.txt as a courtesy, not a security control.

Cloudflare's rate-limit binding is fast but approximate and local to each
location; it cannot promise a hard global daily budget:
https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

Avoid tight IP-only limits: mobile networks and privacy relays share addresses.
A more involved design could issue per-installation tokens during setup, combined
with a generous aggregate render ceiling. Tokens do not alone stop someone from
creating more installations, and global accounting would add state/complexity.

Share bounded validation between the UI and Worker. index.html currently parses
query-string years without checking 1–120 before generating rectangles, whereas
the Worker rejects out-of-range input. A crafted share link can therefore ask
the browser to allocate an enormous number of squares. Also validate layout,
colors, and DOB consistently before drawing or copying links.

Track invocation outcome, CPU, cache status, renderer version, and coarse traffic
source without adding DOB to custom logs. Invocation URLs currently contain DOB;
consider supported query-string redaction. Use data to decide whether blocking is
needed; today's sample does not justify assuming all traffic is bots.

### 5. Make the existing static generator self-contained and offline-capable

Impact: reliable free manual usage even if the Worker is unavailable. Effort: low
to medium; no server-side rendering needed.

index.html loads Tailwind's runtime CDN, Font Awesome, and Google Fonts. Compile
and ship the small amount of CSS actually used, replace the few icons with local
SVGs, and self-host or use system fonts. Add a versioned offline shell/cache for
HTML, CSS, shared/calendar-logic.js, and guide assets. Preserve the current local
canvas rendering and downloads. Show a clear manual-download fallback if an
image-server link fails.

Do not precache or send private configuration URLs or generated wallpapers to a
third-party service. Ensure service-worker upgrades invalidate old shared code
so browser and Worker layout versions stay in agreement.

Acceptance: after an initial load, airplane-mode reopening, editing, previewing,
and saving a PNG work; browsing and downloading never contact the Worker.
This does not make URL-based background automation offline—that is recommendation
3. Keep the site on static hosting rather than introducing an SSR framework.

## Options I would defer

Persistent KV image storage could improve cross-location reuse, but it would
introduce another quota and would not fix first-render CPU. The free tier has
100,000 reads/day, 1,000 writes/day and 1 GB storage; exceeding a quota causes
operations to fail. At roughly 90–132 KB per image, storage holds only on the
order of 8,000–11,000 image states before expiry/cleanup. Start with cache-before-
Worker and a reliable cold renderer rather than making KV mandatory.
https://developers.cloudflare.com/kv/platform/limits/

JPEG is not the first priority. The profile points to work done during encoding,
not evidence of a download bandwidth bottleneck, and the design has sharp edges
and few colors. Any alternate format needs CPU and visual comparison at the same
native resolution.
