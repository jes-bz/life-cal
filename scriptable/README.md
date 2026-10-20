# Offline iPhone wallpaper

Life Calendar runs locally with Scriptable and one installed Shortcut. The
Shortcut embeds the renderer and guided settings interface. Wallpaper generation
and settings stay on the iPhone; no code download or Photos access is needed
during a refresh.

## Install and use

1. [Install Scriptable from the App Store](https://apps.apple.com/us/app/scriptable/id1405459188), then [add the Life Calendar Shortcut from iCloud](https://www.icloud.com/shortcuts/abb0db6469d14f64b88a3d3e445a0731).
2. In the Shortcut's last **Set Wallpaper Photo** action, select the wallpaper
   you want to update. It updates only the Lock Screen; **Show Preview** and
   **Crop to Subject** are disabled. An unset target can create a new wallpaper.
3. Run the Shortcut once to configure it. First run opens guided setup. Choose your birth
   date, display, life expectancy, widget layout, and color palette, then select
   **Save & Refresh Wallpaper**. Settings are stored using Scriptable's Keychain
   API, outside the distributable Shortcut.
4. Later runs with no input silently refresh the wallpaper. Tap
   [Change Life Calendar settings](shortcuts://run-shortcut?name=Life%20Calendar&input=text&text=settings)
   to open the editor (the Shortcut must be named **Life Calendar**; change the
   link's `name` value if you renamed it). Shortcuts supports passing the
   `settings` text through this URL ([Apple guide](https://support.apple.com/en-au/guide/shortcuts/apd624386f42/ios)).
   The form starts with saved values. Custom hex colors are available under
   **Colors → Custom Colors**; named palettes need no hex input.
5. To schedule refreshes, create a weekly Time of Day automation with
   **Run Immediately**, then add **Run Shortcut** for Life Calendar and leave
   its input empty. On iOS 27, you can attach a Time of Day trigger in the
   Shortcut's **Edit → Automation** section; sharing that Shortcut includes
   the trigger, and it arrives turned off for recipients.

The empty-input path is the same for manual and scheduled launches. It checks
for saved settings: if none exist it opens first-run setup; otherwise it renders
silently. The separate Settings URL passes `settings` to open the editor. First-use
permissions must be approved during a manual test before relying on automation.

Manual setup runs Scriptable in the foreground. **Wait to Return** pauses the
Shortcut until the settings menu completes and Scriptable opens Shortcuts again.
A completion flag prevents a cancelled or incomplete setup from changing the
wallpaper. A background Scriptable action then reads the saved settings and
returns a PNG as Base64 text; Shortcuts decodes it and sets the wallpaper.

## Build and check

From the repository root:

```sh
node --test scriptable/*.test.mjs
python3 scriptable/package.py
shortcuts sign --mode anyone --input 'dist/Life Calendar.unsigned.shortcut' --output 'dist/Life Calendar.shortcut'
```

`build.mjs` bundles the shared `calendar-logic.js` geometry with Scriptable's
native drawing adapter and guided settings flow. The package contains no birth
date or personal wallpaper identifier. Distribute the signed file or an iCloud
Shortcut link. Recipients do not copy code or install a separate Scriptable
script. New code versions require importing a new Shortcut package.

Desktop tests cover geometry combinations, validation, empty-input refresh,
first-run setup, the Settings URL path, cancellation, and consumption of the
foreground completion flag. Native controls, saved settings, background PNG
output, manual wallpaper handoff, and both launch paths have been exercised on
iPhone through Mirroring. The iOS 27 trigger was verified to run empty-input
refreshes and to travel in a shared Shortcut with the trigger disabled after
import. A locked-phone unattended run remains to be checked before relying on
the weekly automation.

The Mac `shortcuts sign` command used in this build does not preserve iOS 27
embedded trigger metadata. To distribute a Shortcut with its trigger attached,
import it first, add the trigger on an iPhone, then share it from Shortcuts.
