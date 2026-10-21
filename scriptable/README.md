# Offline iPhone wallpaper

Configure Life Calendar on the [website](https://jessebrizzi.com/life-cal/). One
installed Shortcut previews a design before applying it, then generates future
wallpapers locally with Scriptable. Refreshes need no network request, Photos
access, or separate script installation.

## Install and use

1. [Install Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188),
   then [add Life Calendar](https://www.icloud.com/shortcuts/99942882e26b4477ade306f972045ea8).
   Return to the website after installation. An unconfigured Shortcut opens the
   website; it does not present a second color or settings editor.
2. In the Shortcut's final **Set Wallpaper Photo** action, select the Lock Screen
   wallpaper to update. Leave **Show Preview** and **Crop to Subject** disabled.
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
   to the web server. Previously shared query-string links still work.
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

## Build and release

`release.json` is the release's version, public link, signed payload checksum,
inline-source checksums, and native smoke-test checklist. The version is embedded
in every inline script and shown on the iPhone preview and website. Increment it
before releasing code changes; recipients import the new Shortcut to update.

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
