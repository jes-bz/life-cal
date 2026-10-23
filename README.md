# Life Calendar Wallpaper

**[Create your free Life Calendar wallpaper →](https://jes.bz/life-cal/)**

Free and open source, with no account, subscription, or paid design tier. Design your life-in-weeks wallpaper in your browser, then let your iPhone keep it updated with offline rendering.

Browser preview and download need no app. Automatic iPhone updates require the free Scriptable app and Life Calendar Shortcut; after installation and configuration, wallpaper refreshes need no image server or network request.

A "Memento Mori" life calendar generator that visualizes your life in weeks. It generates a wallpaper for your phone showing weeks lived versus weeks remaining, helping you stay mindful of your time.

The project consists of:
1.  **Static Website**: An interactive configuration tool to set your birthdate, life expectancy, and colors.
2.  **Offline iPhone Shortcut**: A Scriptable-powered shortcut that generates and updates wallpapers on the device.

The generator is free, with no account or subscription. Browser previews and downloads run locally; automatic iPhone rendering runs on the device. The former hosted image Worker is retired.

## Features

*   **Countdowns**: One calendar for a trip, project, or milestone, with start and target dates and a daily countdown.
*   **Design presets**: Eight visual starting looks combine colors, marker shapes, spacing, and accents while preserving dates and placement. Every option stays editable.
*   **Themes and quotes**: Eight editable color themes, an optional custom quote, or original reflection prompts that rotate on refresh. No quote API.
*   **Interactive Preview**: Visualize your calendar instantly in the browser.
*   **Customizable**: Adjust colors, layout, life expectancy, and display size. New website designs default to one year per row with middle row spacing.
*   **Device Presets**: iPhone / Pro (1206 × 2622), Max (1320 × 2868), Duo outer (1398 × 2034), and Duo inner portrait/landscape (1878 × 2670 / 2670 × 1878). Duo layouts reserve space for right-side controls.
*   **High Resolution**: Native display sizes; the website defaults to iPhone / Pro.
*   **Offline iPhone wallpaper**: Scriptable generates and refreshes the wallpaper locally. See the [iPhone setup guide](scriptable/README.md).

## iPhone Setup

Install [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188), then add the [Life Calendar Shortcut](https://www.icloud.com/shortcuts/3019eb11a8e746d68e6172d13e0c23f1). The [offline setup guide](scriptable/README.md) explains initial setup, changing settings, and scheduling weekly refreshes.

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
