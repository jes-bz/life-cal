# Life Calendar

The hosted `life-cal-worker` service is retired and its sources have been removed. Do not redeploy it or restore its production route. The static site and offline Shortcut are the supported paths.

## Tool behavior

- For Google account work, use the Vivaldi extension browser control, not the
  built-in browser or native desktop control.
- Before editing `jes-bz/site-ops`, account-wide Cloudflare configuration, or
  email, read the applicable connector instructions and verify the exact target.
- When taking a service offline, remove its policy health probes before applying
  allowlist changes; retain the unrelated firewall policy until its rules can be
  reviewed separately.

## Project scope

- `index.html` is the static configuration site, published to
  `https://life-cal.jes.bz/` by GitHub Pages.
- `calendar-logic.js` supplies device presets and baseline geometry.
- `calendar-design.js` supplies shared appearance settings and scene geometry
  for the browser and offline Scriptable renderer.
- `assets/site.css` is plain CSS edited directly, with no framework or build step.
- Keep this repository focused on Life Calendar. Account-wide Cloudflare changes
  and configuration for other websites do not belong here.

## Development and verification

Serve the repository with `python3 -m http.server 8765`. Run:

```sh
node --test scriptable/*.test.mjs
python3 scriptable/verify-release.py --check-recorded
```

Pushing main deploys the static website through `.github/workflows/static.yml`.
Renderer changes require a matching verified Shortcut release before publishing;
keep pending renderer features on a branch until the phone installer is ready.

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
- Keep query strings and birth dates out of logs. Preview, download and automated
  phone rendering run locally.

## Edge protection

Path allowlists are managed in the private `jes-bz/site-ops` repository. Its
`config/sites.json` is the source of truth. The static site's published files
must be allowlisted there before release; uploading them to Pages alone does not
make them accessible through Cloudflare. Successful production Pages deployments
trigger its apply workflow through `.github/workflows/site-policy.yml`. Keep
Cloudflare credentials in `site-ops`; this repository holds only the scoped
`SITE_OPS_DISPATCH_TOKEN` Actions secret.

Do not add Worker routes. Preserve unrelated zone rules, avoid browser challenges
that could interrupt automation, and check `workers.dev` exposure when changing
retirement settings. A deleted service must not remain in policy probe paths.

## Repository hygiene

Remove superseded implementations, dead code, unused dependencies, obsolete
comments, and temporary investigation tooling. Use Git history to recover prior
states; do not retain an old implementation solely as a test reference. Test the
current behavior with independent assertions.

Keep durable project instructions in this file and user-facing guidance in the
READMEs. Do not add task transcripts, migration narratives, account audits, or
one-off benchmark reports to the repository.
