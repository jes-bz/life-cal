const SETTINGS_KEY = 'life-calendar.settings.v1';
const MANUAL_RUN_KEY = 'life-calendar.manual-run.v1';
const SETTINGS_FIELDS = ['dob', 'device', 'years', 'layout', 'bg', 'lived', 'rest'];
const SHORTCUTS_URL = 'shortcuts://';

function importedSettings(input) {
    if (Array.isArray(input) && input.length === 0) return null;
    // Shortcuts can decode Safari's JSON into a dictionary despite Text coercion.
    let parsed = input;
    if (typeof input === 'string') {
        const text = input.trim();
        if (!text.startsWith('{')) return null;
        try { parsed = JSON.parse(text); }
        catch { throw new Error('Life Calendar settings from the website are not valid JSON.'); }
    } else if (input == null || typeof input !== 'object') {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Life Calendar settings must be a dictionary.');
    }
    const settings = {};
    for (const key of SETTINGS_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) settings[key] = parsed[key];
    }
    return settings;
}

function savedSettings() {
    return Keychain.contains(SETTINGS_KEY) ? JSON.parse(Keychain.get(SETTINGS_KEY)) : null;
}

function websiteURL(settings) {
    if (!settings) return LIFE_CALENDAR_SITE_URL;
    // A fragment restores the editor without sending the settings to the server.
    const fields = SETTINGS_FIELDS.filter(key => settings[key] != null).map(key =>
        encodeURIComponent(key) + '=' + encodeURIComponent(String(settings[key]).replace(/^#/, '')));
    return LIFE_CALENDAR_SITE_URL + '#' + fields.join('&');
}

function inputCommand(input) {
    const command = input == null ? '' : String(input).trim().toLowerCase();
    if (!['', 'refresh', 'settings'].includes(command)) {
        throw new Error('Unsupported Life Calendar input. Configure your wallpaper on the Life Calendar website.');
    }
    return command;
}

async function confirmWallpaper(settings, png) {
    const table = new UITable();
    table.showSeparators = false;
    const heading = new UITableRow();
    heading.height = 64;
    heading.addText('Preview your wallpaper', 'Life Calendar ' + LIFE_CALENDAR_VERSION);
    table.addRow(heading);
    const preview = new UITableRow();
    preview.height = 320;
    preview.addImage(Image.fromData(Data.fromBase64String(png))).centerAligned();
    table.addRow(preview);
    const details = new UITableRow();
    details.height = 64;
    details.addText(getDevice(settings.device).label,
        'Review your design. Settings are saved only when you apply it.');
    table.addRow(details);
    let choice = 'cancel';
    for (const [value, title] of [
        ['apply', 'Apply Wallpaper'], ['edit', 'Edit on Website'], ['cancel', 'Cancel']
    ]) {
        const row = new UITableRow();
        row.height = 52;
        row.addText(title);
        row.dismissOnSelect = true;
        row.onSelect = () => { choice = value; };
        table.addRow(row);
    }
    await table.present();
    return choice;
}

async function preflightLifeCalendar(input) {
    const websiteSettings = importedSettings(input);
    if (websiteSettings) {
        Keychain.set(MANUAL_RUN_KEY, 'pending');
        return 'setup';
    }
    const command = inputCommand(input);
    const saved = savedSettings();
    if (command === 'settings' || !saved) return websiteURL(saved);
    return renderWallpaper(saved);
}

async function executeLifeCalendar(input) {
    if (input === 'finish') {
        const result = Keychain.contains(MANUAL_RUN_KEY) ? Keychain.get(MANUAL_RUN_KEY) : '';
        Keychain.set(MANUAL_RUN_KEY, 'consumed');
        if (result === 'ready') return renderWallpaper(savedSettings());
        if (result.startsWith(LIFE_CALENDAR_SITE_URL)) return result;
        return SHORTCUTS_URL;
    }
    const websiteSettings = importedSettings(input);
    if (!websiteSettings) return await preflightLifeCalendar(input);
    // Shortcuts may make a Siri pass before entering foreground Scriptable.
    if (!config.runsInApp) {
        Keychain.set(MANUAL_RUN_KEY, 'pending');
        return 'setup';
    }
    try {
        const png = renderWallpaper(websiteSettings);
        const choice = await confirmWallpaper(websiteSettings, png);
        let result = SHORTCUTS_URL;
        if (choice === 'apply') {
            Keychain.set(SETTINGS_KEY, JSON.stringify(websiteSettings));
            result = 'ready';
        } else if (choice === 'edit') {
            result = websiteURL(websiteSettings);
        }
        Keychain.set(MANUAL_RUN_KEY, result);
        Safari.open(SHORTCUTS_URL);
        return result;
    } catch (error) {
        Keychain.set(MANUAL_RUN_KEY, SHORTCUTS_URL);
        Safari.open(SHORTCUTS_URL);
        throw error;
    }
}

Script.setShortcutOutput(await executeLifeCalendar(args.shortcutParameter));
