# Life Calendar Wallpaper

[https://jes.bz/life-cal/](https://jes.bz/life-cal/)

A "Memento Mori" life calendar generator that visualizes your life in weeks. It generates a wallpaper for your phone showing weeks lived versus weeks remaining, helping you stay mindful of your time.

The project consists of:
1.  **Static Website**: An interactive configuration tool to set your birthdate, life expectancy, and colors.
2.  **Cloudflare Worker**: A serverless function that generates the PNG wallpaper on-the-fly, enabling automation.

## Features

*   **Interactive Preview**: Visualize your calendar instantly in the browser.
*   **Customizable**: Adjust colors, layout, life expectancy, and display size.
*   **Device Presets**: iPhone / Pro (1206 × 2622), Max (1320 × 2868), Duo outer (1398 × 2034), and Duo inner portrait/landscape (1878 × 2670 / 2670 × 1878). Duo layouts reserve space for right-side controls.
*   **High Resolution**: Native display sizes; the website defaults to iPhone / Pro. Worker requests without a device use Max.
*   **Automation Ready**: Use the Cloudflare Worker to automatically update your wallpaper every week.

## iPhone Automation Guide

You can set up your iPhone to automatically update its lock screen with your Life Calendar every week, keeping the "weeks lived" accurate without manual intervention.

### Prerequisites
*   The **Config Link** for your specific calendar setup.
    *   Go to your deployed website (or run it locally).
    *   Configure your dates and colors.
    *   Click **"Copy Config Link"**.
    *   *Note: You will need the parameters from this URL (everything after the `?`).*

### Step 1: Create the Shortcut

1.  Open the **Shortcuts** app on your iPhone.
2.  Tap the **+** to create a new shortcut.
3.  Add the following 4 actions in order:

    1.  **URL**: Paste your full Worker URL here (e.g., `https://life-cal.jes.bz/?dob=...`).
    2.  **Get Contents of URL**: Set this to get contents of the **Text** from the previous step.
    3.  **Get Images from Input**: Set this to get images from the **Contents of URL**.
    4.  **Set Wallpaper**: 
        *   Set image to **Images**.
        *   Choose "Lock Screen" (and/or Home Screen).
        *   **Important**: Tap the arrow on the "Set Wallpaper" action and turn **OFF** "Show Preview".

![Shortcut Setup](assets/shortcut.png)

### Step 2: Schedule the Automation

1.  Go to the **Automation** tab in the Shortcuts app.
2.  Tap **New Automation** (or the + sign).
3.  Choose **Time of Day**.
4.  Set it to **Weekly** (e.g., every Monday at 9:00 AM).
5.  Select **Run Immediately** (so it doesn't ask for confirmation).
6.  On the next screen, select the Shortcut you created in Step 1.

![Automation Setup](assets/automation.png)

## Display sizes

Choose **Device / Display** before copying a configuration or automation URL. The
preview, manual download, and Worker use the selected size. Existing links without
a `device` parameter keep the original 1320 × 2868 Max output. Device parameters
are `iphone`, `max`, `duo-outer`, `duo-inner`, and `duo-inner-landscape`.

Duo uses one fixed, left-shifted layout centered in the area beside its permanent
right-hand control column. Widget layout options apply only to regular iPhones.
The margins are approximate and should be checked
against your Lock Screen; they do not claim exact system safe-area measurements.
Apple's display dimensions: [Duo](https://www.apple.com/iphone-duo/specs/) and
[iPhone Pro / Max](https://www.apple.com/iphone-18-pro/specs/).
