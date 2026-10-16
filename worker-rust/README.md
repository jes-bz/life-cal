# Life Calendar in Rust

This crate contains the production Worker request handler and native-resolution
PNG renderer. The production config and deploy commands are in `../worker/`;
see its README for setup, tests, observability, caching and rollback.

- `src/config.rs`: bounded validation, normalized keys, date/week expiry logic.
- `src/handler.rs`: routing, Cache API, structured logs and responses.
- `src/lib.rs`: indexed PNG rasterization, miniz_oxide compression and CRCs.
- `scripts/check-handler.mjs`: exercises the compiled Wasm in workerd.
- `scripts/check-pixels.mjs`: independently decodes and compares 180 PNGs against
  the former JavaScript renderer across device/year/layout/color combinations.

The browser continues using `shared/calendar-logic.js`. Keep the pixel comparison
as a release gate when changing either layout implementation. Rust unit tests
cover date boundaries, future dates, input validation and cache equivalence.

`wrangler.toml` here is an isolated probe with no production routes, retained for
experiments. Running Wrangler here deploys `life-cal-rust-probe`, not production.
Delete temporary probes when finished. Production uses `worker/wrangler.toml`.

Rust is pinned by rust-toolchain.toml and Cargo.lock. Install worker-build 0.8.7
with `cargo install worker-build --version 0.8.7 --locked`. Do not enable Cargo
`strip = true`: it breaks this wasm-bindgen version's catch wrappers.

The pre-release benchmark is recorded in `../docs/cloudflare-benchmark-2026-10-16.md`.
The language switch improves image size but does not guarantee requests fit the
free CPU allowance. Cloudflare runtime CPU/outcome measurements remain necessary.
