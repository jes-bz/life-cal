# Life Calendar

## Project scope

- `index.html` is the static configuration site, published to
  `https://jessebrizzi.com/life-cal/` by GitHub Pages.
- `calendar-logic.js` supplies browser preview and download geometry. It
  is also used by the PNG tests; the production Worker does not import it.
- `calendar-design.js` supplies shared appearance settings and scene geometry
  for the browser and offline Scriptable renderer.
- `worker/` contains the Rust request handler, PNG renderer, tests, npm commands,
  and production Wrangler configuration for `https://life-cal.jes.bz/`.
- Keep this repository focused on Life Calendar. Account-wide Cloudflare changes
  and configuration for other websites do not belong here.

## Development and verification

From `worker/`:

```sh
rustup show
cargo install worker-build --version 0.8.7 --locked
npm ci
npm test
cargo fmt --check
```

Use the checked-in Rust toolchain, Cargo lockfile, and npm lockfile. `npm test`
compiles and packages Wasm, runs Rust unit tests, decodes PNGs across 180
configurations, and exercises HTTP/cache behavior in workerd. The PNG checks
cover browser geometry, colors, fractional edges, antialiasing, and Duo margins.

`npm run dev` serves the Worker locally; `npm run build` performs a dry run.
`npm run deploy` deploys the production Worker. Pushing main deploys the static
website separately through `.github/workflows/static.yml`.

Do not set Cargo `strip = true`; it breaks the pinned wasm-bindgen catch wrappers.

## Behavior to preserve

- Keep native image resolutions and the fixed, left-shifted Duo layout. Duo
  always reserves its right-side controls; it has no layout toggle.
- The website defaults to iPhone / Pro and offers Standard, Top Widgets, and
  Bottom Widgets for regular iPhones. Image requests without a device use Max.
- Preserve accepted image parameters and unattended iPhone Shortcut URLs.
- Preview and manual download run locally in canvas, without Worker requests.
- Adaptive offline/browser grids prefer a square when it fits, with uniform
  markers and spacing. Classic-only options must not affect adaptive geometry.
  Keep the browser design-module cache version aligned with `release.json`.
- Keep bounded input validation ahead of rendering and avoid rendering on direct
  HEAD cache misses.
- Preserve normalized image cache keys, per-request filenames, and client cache
  expiry at the next weeks-lived change. Verify caching when changing geometry.
- Keep query strings and birth dates out of custom logs. Observability settings
  and cache configuration live in `worker/wrangler.toml`.
- Verify CPU performance in Cloudflare when optimizing the Worker. Local timing
  and HTTP success do not establish compliance with the free-tier CPU limit.

## Edge protection

The `jes.bz` zone has a Single Redirect rule with ref
`life_cal_redirect_bare_root` in the `http_request_dynamic_redirect` phase.
GET/HEAD requests to `life-cal.jes.bz/` with an empty query string receive a 302
directly to `https://jessebrizzi.com/life-cal/`, before Worker execution.
Requests with any query string continue to the Worker so parameter validation,
encoded parameter names, and image links retain their behavior.

Path allowlists are managed in the private `jes-bz/site-ops` repository.
Its `config/sites.json` is the source of truth for the image endpoint's allowed
paths. Unsupported paths are blocked before Worker execution.
The static site's published files are also allowlisted there. Add new root-level
JavaScript or metadata files to its Life Calendar source inventory before release;
uploading them to Pages alone does not make them accessible through Cloudflare.
Successful production Pages deployments trigger its apply workflow through
`.github/workflows/site-policy.yml`. Keep Cloudflare credentials in `site-ops`;
this repository holds only the scoped `SITE_OPS_DISPATCH_TOKEN` Actions secret.

This is zone configuration, managed separately from Wrangler. Before adding a
Worker route, update the policy in `site-ops` and apply its workflow. Scope edits to the image
hostname and preserve unrelated zone rules. Do not introduce browser challenges
that break unattended Shortcuts. Confirm workers.dev and preview exposure before
changing deployment settings; zone rules do not protect those hostnames.

## Repository hygiene

Remove superseded implementations, dead code, unused dependencies, obsolete
comments, and temporary investigation tooling. Use Git history to recover prior
states; do not retain an old implementation solely as a test reference. Test the
current behavior with independent assertions.

Keep durable project instructions in this file and user-facing guidance in the
READMEs. Do not add task transcripts, migration narratives, account audits, or
one-off benchmark reports to the repository.
