# Life Calendar Worker

The production endpoint is https://life-cal.jes.bz/. Its complete request handler
and PNG renderer are Rust compiled to Wasm in `../worker-rust/`. workers-rs creates
the JavaScript bridge automatically. This directory keeps the production Wrangler
configuration and npm commands. `src/` retains the former JS implementation for
pixel comparisons; Wrangler no longer deploys it.

## Returning to the project

Install Rust through rustup, then install the pinned toolchain and build helper:

```sh
cd worker-rust
rustup show
cargo install worker-build --version 0.8.7 --locked
cd ../worker
npm ci
npx wrangler whoami
# If needed: npx wrangler login
npm test
npm run deploy
```

`rust-toolchain.toml` selects Rust 1.99.1 and the wasm32-unknown-unknown target.
The npm lockfile pins Wrangler 4.151.1, needed for the tested outer cache config.
`npm run build` compiles and bundles without deploying; `npm run dev` serves the
Rust Worker locally. The GitHub Worker check workflow builds Wasm, runs native
boundary/validation tests, compares 180 PNGs, and tests the Wasm handler in workerd.
Worker deployment is manual; pushing main separately publishes the static UI
through GitHub Pages. The website previews and downloads images locally in canvas.

## Links and behavior

Existing Shortcut URLs keep working. Device presets are iPhone 1206×2622, Max
1320×2868, Duo outer 1398×2034, Duo inner 1878×2670, and inner landscape 2670×1878.
Omitting device retains the legacy Max default; the website defaults to iPhone.
Duo layout remains fixed beside the right controls, with 35% top / 6% bottom
margins and 22% right reservation. Regular iPhones retain none/top/bottom/right.

Bare-root or unknown-parameter-only visits redirect to https://jes.bz/life-cal/.
Unknown paths return 404; malformed dates, colors, years outside 1–120, devices,
and layouts return 400. Non-GET/HEAD image requests return 405. robots.txt asks
cooperative crawlers not to index the image endpoint; it is not bot protection.

## Caching and logs

Workers Cache serves repeated URLs before code executes. Its entries are bounded
by Cache-Control, at most one hour and never past the next weeks-lived change.
The in-handler Cache API additionally normalizes device, layout, colors, years,
and visible weeks, ignoring unknown parameters, order and equivalent birthdates.
Those immutable image bytes are cached for seven days, with a versioned key.
The response filename is set for each request, so it cannot leak across birthdays.
Cache entries can be evicted. Request quotas still apply to outer cache hits.

`CF-Cache-Status` identifies outer cache behavior. `X-Calendar-Cache` identifies
in-handler MISS/HIT and is preserved on an outer hit, so do not read it alone.
`X-Calendar-Renderer: rust-1` identifies the renderer. Direct HEAD misses do not
render or seed an empty image; the outer cache may convert HEAD to GET to fill
its entry, as documented by Cloudflare.

Persisted invocation logs are fully sampled, with traces sampled at 1%. Query
strings are redacted from observability logs. Structured request logs retain
bounded user agent, path, country, ASN, location and verified bot category, plus
render/cache events; no custom DOB or IP logging. User agents are claims rather
than proof of human/bot identity. Outer cache hits do not invoke the Worker.

Inspect Workers & Pages → life-cal-worker → Observability, or run
`npx wrangler tail`. Logging is not retroactive. Static website visits are separate
from Worker traffic. No paid plan, bot challenge or automatic blocking is required.

## Performance and rollback

The paired Cloudflare test found identical pixels and 68.7% smaller PNGs. In the
20 pairs with CPU records for both implementations, Rust averaged 27.35 ms versus
31.45 ms for JS, but had a higher median. Neither reliably fit the free 10 ms CPU
allowance; successful HTTP responses are not proof that CPU failures are resolved.
See `../docs/cloudflare-benchmark-2026-10-16.md` for method and limitations.

The pre-Rust production version is `6cfcf20b-5f35-4ccb-a6a0-46e949112f18`.
To restore it if necessary, from this directory:

```sh
npx wrangler rollback 6cfcf20b-5f35-4ccb-a6a0-46e949112f18
```

Rollback affects deployed code. Revert the corresponding source/config changes
before the next normal deploy; separately inspect cache settings and cache state.

Sources: https://developers.cloudflare.com/workers/languages/rust/ and
https://developers.cloudflare.com/workers/cache/
