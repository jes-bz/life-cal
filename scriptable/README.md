# Offline iPhone wallpaper

Configure Life Calendar on the [website](https://jessebrizzi.com/life-cal/). One
installed Shortcut previews a design before applying it, then generates future
wallpapers locally with Scriptable. Refreshes need no network request, Photos
access, or separate script installation.

## Install and use

1. [Install Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188),
   then [add Life Calendar](https://www.icloud.com/shortcuts/3d7d746feebe4870812868da22fffe6e).
   Return to the website after installation. An unconfigured Shortcut opens the
   website; it does not present a second color or settings editor.
2. In the Shortcut's final **Set Wallpaper Photo** action, select the Home Screen or Lock Screen
   wallpaper to update. The website layout preset does not change this destination. Leave **Show Preview** and **Crop to Subject** disabled.
   This wallpaper target belongs to each phone and still needs manual selection.
3. Choose your birth date, display, life expectancy, layout, and colors on the
   website. Named palettes are available alongside custom colors. Tap **Apply to
   iPhone** to open a local wallpaper preview, then **Apply Wallpaper** to save
   the design and refresh the wallpaper. **Cancel** or closing the preview
   leaves saved settings unchanged. **Edit on Website** returns the candidate
   design to the website without saving it.
4. To change a saved design, use **Load saved iPhone design** on the website.
   This runs Life Calendar with the `settings` input and opens the website with
   your saved values. The configuration link is also in the Shortcut's opening
   comment. Settings returned to the site use a URL fragment, which is not sent
   to the web server. The website remembers the last design in this browser's
   local storage; an explicit settings link overrides remembered values.
   Previously shared query-string links still work.
5. For weekly refreshes, enable the included Friday 1:00 AM trigger in
   **Edit → Automation**. It imports disabled. If your iOS version does not
   support embedded triggers, create a weekly Time of Day automation with
   **Run Immediately → Run Shortcut → Life Calendar**, leaving its input empty.
   Approve first-use permissions during a manual run first.

With saved settings, empty-input runs refresh silently, whether tapped manually
or launched on schedule. Time of Day exposes no launch-origin value, so the
Shortcut cannot use a normal tap to show a settings menu while keeping the same
scheduled path silent. No companion Settings shortcut is required.

The website is the only editor. Scriptable stores approved settings in its
Keychain, outside the distributable Shortcut. Website input may arrive as JSON
text or as a dictionary decoded by Shortcuts; both are supported. A foreground
preview hands completion back to Shortcuts. Cancellation and website navigation
exit before image decoding or wallpaper replacement.

Website handoffs include the website version. The Shortcut accepts matching
major/minor versions (for example, 1.1.0 and 1.1.9). A newer major or minor
version stops configuration and offers the update page before saving anything.
An older website page asks you to reopen the current website. Weekly refreshes
use saved settings without checking the network. This protection requires the
version-aware Shortcut; earlier shared versions cannot enforce it retroactively.

## Design options

- Lock Screen safe areas and Home Screen placements: centered, bottom aligned,
  narrow vertical, and compact corner. The optional icon/widget overlay is only
  a preview; it is never included in the downloaded or generated image.
- Life in weeks, life in months, the current year in days (including leap years),
  or a life grid above an enlarged current-year grid.
- Adaptive fitting or classic rows with exactly 52 weeks / 12 months per year.
  Classic grids can show age markers every 5 or 10 years, decade gaps, and a
  half-year gap in week views.
- Square, rounded-square, or circular markers; solid/dim, hollow, or hidden
  future markers; optional current-period color, outline, or larger accent.
- Advanced grid size, vertical position, spacing, and future-marker opacity.

Fit to screen prefers a near-square grid with uniform markers and spacing. It uses
a wider grid only when the available height requires it; classic-only age and
separator settings do not affect the adaptive layout.

The optional full-square lifespan setting rounds the total life weeks (or months)
to the nearest square count, without changing the entered target years. The site
and iPhone preview disclose the effective lifespan. It applies only to adaptive
life views; current-year days and classic year rows retain their exact counts.

There are no custom titles, quotes, or progress text. Duo keeps its fixed
bottom-aligned layout and permanent right-side control space. Design settings
are shared by the browser and Scriptable through `calendar-design.js`.

## Build and release

`release.json` is the release's version, public link, signed payload checksum,
inline-source checksums, and native smoke-test checklist. The version is embedded
in every inline script and shown on the iPhone preview and website. Increment it
before releasing code changes; recipients import the new Shortcut to update.
Keep `WEBSITE_VERSION` in `index.html` equal to the release version. The release
verifier checks this, and the website disables handoffs when cached page code
and release metadata disagree.

From the repository root:

```sh
node --test scriptable/*.test.mjs
python3 scriptable/package.py
```

The package contains no personal birth date or wallpaper target. Geometry is
shared with the website through `calendar-logic.js`. For a new installer, the
Mac can sign the package, but **Mac signing strips iOS embedded triggers**. Edit
an existing scheduled Shortcut in place on the iPhone, or add its trigger on the
phone before sharing. Generate the iCloud link from the phone.

Before recording a release, exercise these paths on the phone:

- Fresh settings state: running the Shortcut opens the website without a local editor.
- Safari's actual **Apply to iPhone** button: preview → Apply Wallpaper completes.
- Cancel and closing the preview: no saved settings or wallpaper changes.
- Edit on Website: the candidate design loads in the site without saving it.
- Empty input: saved settings refresh without a preview or navigation.

Then verify the newly shared download and update all install links together:

```sh
python3 scriptable/verify-release.py 'https://www.icloud.com/shortcuts/NEW_ID' \
  --record --smoke-tested fresh-install,safari-apply,cancel,edit-website,empty-refresh
python3 scriptable/verify-release.py --check-recorded
```

The verifier checks exact scripts, execution contexts, action order and variable
wiring, the cancellation/navigation branch, and the Friday 1:00 AM trigger. It
downloads the signed public payload without re-signing it. Full signed-archive
inspection uses macOS `openssl`, `aea`, and `aa`; the recorded-source check also
runs in CI without those tools. The checklist records tests actually completed,
not inferred results. Locked-phone unattended execution is a separate check and
must not be inferred from desktop tests or a Mirroring run.
