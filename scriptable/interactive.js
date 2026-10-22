const SETTINGS_KEY = 'life-calendar.settings.v1';
const MANUAL_RUN_KEY = 'life-calendar.manual-run.v1';
const SETTINGS_FIELDS = ['dob', 'device', 'years', 'layout', 'bg', 'lived', 'rest', ...DESIGN_FIELDS];
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
    return { settings, version: parsed.version == null ? '1.0.0' : parsed.version };
}

function compatibleVersion(version) {
    return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) &&
        version.split('.').slice(0, 2).join('.') === LIFE_CALENDAR_VERSION.split('.').slice(0, 2).join('.');
}

async function confirmUpdate(version, settings) {
    const installed = LIFE_CALENDAR_VERSION.split('.').map(Number);
    const incoming = typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version)
        ? version.split('.').map(Number) : null;
    const olderWebsite = incoming && (incoming[0] < installed[0] ||
        (incoming[0] === installed[0] && incoming[1] < installed[1]));
    const table = new UITable();
    const heading = new UITableRow();
    heading.height = 140;
    heading.addText(olderWebsite ? 'Reopen the website' : 'Shortcut update required',
        'Installed: ' + LIFE_CALENDAR_VERSION + '. Website: ' + String(version) +
        (olderWebsite ? '. This website page is older than your Shortcut. Reopen the current website before applying this design.' :
            '. Reinstall Life Calendar from the website before applying this design.') +
        ' Your saved design has not changed.');
    table.addRow(heading);
    let result = SHORTCUTS_URL;
    for (const title of ['Open update page', 'Cancel']) {
        const row = new UITableRow();
        row.addText(title);
        row.dismissOnSelect = true;
        row.onSelect = () => {
            if (title === 'Open update page') result = websiteURL(settings) + '&update=1';
        };
        table.addRow(row);
    }
    await table.present();
    return result;
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
    const lifespan = getLifespanSummary(settings);
    details.height = lifespan.rounded ? 96 : 64;
    details.addText(getDevice(settings.device).label,
        lifespan.rounded
            ? `Target: ${settings.years} years. Rounded to ${lifespan.effectiveYears.toFixed(1)} years · ${lifespan.side} × ${lifespan.side}. Saved only when you apply.`
            : 'Review your design. Settings are saved only when you apply it.');
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
    const handoff = importedSettings(input);
    if (handoff) {
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
    const handoff = importedSettings(input);
    if (!handoff) return await preflightLifeCalendar(input);
    // Shortcuts may make a Siri pass before entering foreground Scriptable.
    if (!config.runsInApp) {
        Keychain.set(MANUAL_RUN_KEY, 'pending');
        return 'setup';
    }
    try {
        const websiteSettings = handoff.settings;
        if (!compatibleVersion(handoff.version)) {
            const result = await confirmUpdate(handoff.version, websiteSettings);
            Keychain.set(MANUAL_RUN_KEY, result);
            Safari.open(SHORTCUTS_URL);
            return result;
        }
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
