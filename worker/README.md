# Life Calendar Worker

The production endpoint is https://life-cal.jes.bz/. The request handler and PNG
renderer are Rust compiled to WebAssembly; workers-rs generates the JavaScript
bridge. This directory contains the source, tests, and production configuration.

- `src/config.rs`: input validation, cache keys, and date/week expiry logic.
- `src/handler.rs`: routing, caching, structured logs, and responses.
- `src/lib.rs`: indexed PNG rasterization, compression, and checksums.
- `src/bin/render.rs`: native renderer used by the PNG checks.
- `scripts/check-renderer.mjs`: decodes PNGs and checks them against browser
  geometry across 180 device/layout/year/color combinations.
- `scripts/check-handler.mjs`: tests the compiled Worker in workerd.

## Development and deployment

From this directory, install the pinned Rust toolchain and build helper, then
install npm dependencies:

```sh
rustup show
cargo install worker-build --version 0.8.7 --locked
npm ci
npm test
npm run dev
```

`rust-toolchain.toml` selects Rust 1.99.1 and the wasm32-unknown-unknown target.
The npm lockfile pins Wrangler 4.151.1. Do not enable Cargo `strip = true`: it
breaks this wasm-bindgen version's catch wrappers.

`npm run build` compiles and bundles without deploying. `npm test` runs that
build, native Rust tests, PNG checks, and HTTP/cache checks in workerd. CI runs
the same command. The browser renders previews and downloads locally in canvas;
`calendar-logic.js` provides its geometry.

Deploy the Worker manually:

```sh
npx wrangler whoami
# Sign in with npx wrangler login if needed.
npm run deploy
```

Pushing main publishes the static UI through GitHub Pages. Worker deployment is
separate and uses this directory's `wrangler.toml`.

## Request behavior

Device presets are iPhone 1206×2622, Max 1320×2868, Duo outer 1398×2034, Duo inner
1878×2670, and inner landscape 2670×1878. Requests without a device use Max; the
website defaults to iPhone. Duo has one fixed layout with 35% top and 6% bottom
margins and a 22% right reservation. The website offers none/top/bottom for regular
iPhones. The image endpoint accepts none/top/bottom/right.

Bare-root or unknown-parameter-only visits redirect to https://jes.bz/life-cal/.
Unknown paths return 404. Invalid dates, colors, years outside 1–120, devices,
and layouts return 400. Non-GET/HEAD image requests return 405. robots.txt asks
cooperative crawlers not to index the image endpoint; it is not bot protection.

## Caching and observability

Workers Cache serves repeated URLs before code executes. Entries expire within
one hour and never past the next weeks-lived change. The in-handler Cache API
normalizes device, layout, colors, years, and visible weeks, ignoring unknown
parameters and parameter order. Image bytes are cached for seven days with a
versioned key; filenames are set for each request. Cache entries can be evicted,
and request quotas still apply to outer cache hits.

`CF-Cache-Status` identifies outer cache behavior. `X-Calendar-Cache` identifies
the in-handler MISS/HIT and is preserved on an outer hit. Direct HEAD misses do
not render or seed an empty image; the outer cache may convert HEAD to GET to
fill an entry.

Invocation logs are fully sampled, with traces sampled at 1%. Query strings are
redacted. Structured logs include bounded user agent and path, country, ASN,
location, verified bot category, and render/cache events. DOBs and IPs are not
custom-logged. User agents do not prove whether a visitor is human. Outer cache
hits do not invoke the Worker.

Use Workers & Pages → life-cal-worker → Observability or `npx wrangler tail`.
CPU measurements from the deployed runtime determine whether uncached rendering
fits the free-tier limit; successful HTTP responses alone do not establish that.

References: [Rust Workers](https://developers.cloudflare.com/workers/languages/rust/),
[Workers Cache](https://developers.cloudflare.com/workers/cache/), and
[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).
