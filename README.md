# Life Calendar Wallpaper

**[Create your free Life Calendar wallpaper →](https://jes.bz/life-cal/)**

No account or subscription. Customize in your browser, download an image, or install the iPhone Shortcut for local automatic updates.

A "Memento Mori" life calendar generator that visualizes your life in weeks. It generates a wallpaper for your phone showing weeks lived versus weeks remaining, helping you stay mindful of your time.

The project consists of:
1.  **Static Website**: An interactive configuration tool to set your birthdate, life expectancy, and colors.
2.  **Offline iPhone Shortcut**: A Scriptable-powered shortcut that generates and updates wallpapers on the device.

The generator is free, with no account or subscription. Browser previews and downloads run locally; automatic iPhone rendering runs on the device. The former hosted image Worker is retired.

## Features

*   **Interactive Preview**: Visualize your calendar instantly in the browser.
*   **Customizable**: Adjust colors, layout, life expectancy, and display size.
*   **Device Presets**: iPhone / Pro (1206 × 2622), Max (1320 × 2868), Duo outer (1398 × 2034), and Duo inner portrait/landscape (1878 × 2670 / 2670 × 1878). Duo layouts reserve space for right-side controls.
*   **High Resolution**: Native display sizes; the website defaults to iPhone / Pro.
*   **Offline iPhone wallpaper**: Scriptable generates and refreshes the wallpaper locally. See the [iPhone setup guide](scriptable/README.md).

## iPhone Setup

Install [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188), then add the [Life Calendar Shortcut](https://www.icloud.com/shortcuts/899c4796262a4b6fb81ba8839ffa740c). The [offline setup guide](scriptable/README.md) explains initial setup, changing settings, and scheduling weekly refreshes.

## Display sizes

Choose **Device / Display** to update the preview, download a wallpaper, or create
a preview link. Existing links without a `device` parameter keep the original
1320 × 2868 Max output. Device parameters are `iphone`, `max`, `duo-outer`,
`duo-inner`, and `duo-inner-landscape`.

Duo uses one fixed, left-shifted layout centered in the area beside its permanent
right-hand control column. Widget layout options apply only to regular iPhones.
The margins are approximate and should be checked
against your Lock Screen; they do not claim exact system safe-area measurements.
Apple's display dimensions: [Duo](https://www.apple.com/iphone-duo/specs/) and
[iPhone Pro / Max](https://www.apple.com/iphone-18-pro/specs/).

## Development

The site uses plain CSS, browser JavaScript modules, and system fonts. There is no framework, package installation, or CSS compilation step. Edit `assets/site.css` directly.

```sh
python3 -m http.server 8765
node --test scriptable/*.test.mjs
python3 scriptable/verify-release.py --check-recorded
```

The release verifier checks that the shared iPhone installer matches the source. Renderer changes need a new verified Shortcut release before publication.
