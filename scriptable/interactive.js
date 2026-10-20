const SETTINGS_KEY = 'life-calendar.settings.v1';
const MANUAL_RUN_KEY = 'life-calendar.manual-run.v1';

async function choose(title, labels, message = '') {
    const alert = new Alert();
    alert.title = title;
    alert.message = message;
    for (const label of labels) alert.addAction(label);
    alert.addCancelAction('Cancel');
    const index = await alert.presentSheet();
    if (index < 0) throw new Error('Life Calendar cancelled. No wallpaper was changed.');
    return index;
}

async function editSettings(previous) {
    const settings = Object.assign({
        device: 'iphone', years: 90, layout: 'none',
        bg: '#000000', lived: '#ffffff', rest: '#333333'
    }, previous);
    const layouts = { none: 'Standard', top: 'Top Widgets', bottom: 'Bottom Widgets' };
    while (true) {
        const row = await choose(previous ? 'Change Settings' : 'Set Up Life Calendar', [
            `Birth Date: ${settings.dob || 'Choose a date'}`,
            `Display: ${getDevice(settings.device).label}`,
            `Life Expectancy: ${settings.years} years`,
            `Layout: ${settings.device.startsWith('duo-') ? 'Fixed Duo layout' : layouts[settings.layout]}`,
            'Colors', 'Save & Refresh Wallpaper'
        ], 'Settings stay on your phone. Choose a setting to change it, then Save & Refresh Wallpaper.');
        if (row === 0) {
            const picker = new DatePicker();
            picker.maximumDate = new Date();
            picker.initialDate = new Date((settings.dob || '2000-01-01') + 'T12:00:00');
            const date = await picker.pickDate();
            settings.dob = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0')].join('-');
        } else if (row === 1) {
            const names = Object.keys(DEVICES);
            settings.device = names[await choose('Choose Display', names.map(n => DEVICES[n].label))];
        } else if (row === 2) {
            const alert = new Alert();
            alert.title = 'Life Expectancy';
            alert.message = 'Choose a whole number of years from 1 to 120.';
            alert.addTextField('Years', String(settings.years)).setNumberPadKeyboard();
            alert.addAction('Done');
            alert.addCancelAction('Cancel');
            if (await alert.presentAlert() >= 0) {
                const years = Number(alert.textFieldValue(0));
                if (Number.isInteger(years) && years >= 1 && years <= 120) settings.years = years;
            }
        } else if (row === 3) {
            if (!settings.device.startsWith('duo-')) {
                const names = Object.keys(layouts);
                settings.layout = names[await choose('Widget Layout', Object.values(layouts))];
            }
        } else if (row === 4) {
            const palettes = [
                ['Classic', '#000000', '#ffffff', '#333333'],
                ['Warm Paper', '#f5f0e8', '#795548', '#d8cec0'],
                ['Midnight Blue', '#0b1020', '#8ab4f8', '#29334d'],
                ['Forest', '#0d1912', '#a3c9a8', '#2c4432']
            ];
            const selected = await choose('Colors', [...palettes.map(p => p[0]), 'Custom Colors…'],
                `Current: ${settings.bg} / ${settings.lived} / ${settings.rest}`);
            if (selected < palettes.length) {
                [, settings.bg, settings.lived, settings.rest] = palettes[selected];
            } else {
                const alert = new Alert();
                alert.title = 'Custom Colors';
                alert.message = 'Six hex digits for background, weeks lived, and weeks remaining.';
                for (const key of ['bg', 'lived', 'rest']) alert.addTextField(key, settings[key]);
                alert.addAction('Done');
                alert.addCancelAction('Cancel');
                if (await alert.presentAlert() >= 0) {
                    const values = [0, 1, 2].map(i => alert.textFieldValue(i));
                    if (values.every(v => /^#?[a-f\d]{6}$/i.test(v))) {
                        [settings.bg, settings.lived, settings.rest] = values;
                    }
                }
            }
        } else if (settings.dob) {
            // Validate and render before replacing the saved configuration.
            const png = renderWallpaper(settings);
            Keychain.set(SETTINGS_KEY, JSON.stringify(settings));
            return png;
        }
    }
}

async function runLifeCalendar(input) {
    const command = input == null ? '' : String(input).trim().toLowerCase();
    if (!['', 'refresh', 'settings'].includes(command)) {
        throw new Error('Unsupported Life Calendar input. Leave it empty or use settings to change settings.');
    }
    const saved = Keychain.contains(SETTINGS_KEY) ? JSON.parse(Keychain.get(SETTINGS_KEY)) : null;
    if (command === 'settings') return await editSettings(saved);
    if (!saved) return await editSettings(null);
    // Empty input is the normal unattended refresh path. The settings URL
    // explicitly passes "settings" to open the guided editor.
    return renderWallpaper(saved);
}

async function preflightLifeCalendar(input) {
    const command = input == null ? '' : String(input).trim().toLowerCase();
    if (!['', 'refresh', 'settings'].includes(command)) {
        throw new Error('Unsupported Life Calendar input. Leave it empty or use settings to change settings.');
    }
    const saved = Keychain.contains(SETTINGS_KEY) ? JSON.parse(Keychain.get(SETTINGS_KEY)) : null;
    if (command === 'settings' || !saved) {
        Keychain.set(MANUAL_RUN_KEY, 'pending');
        return 'setup';
    }
    return renderWallpaper(saved);
}

async function executeLifeCalendar(input) {
    const originalInput = input;
    let command = input == null ? '' : String(input).trim().toLowerCase();
    if (command === 'prepare') {
        Keychain.set(MANUAL_RUN_KEY, 'pending');
        return 'prepared';
    }
    if (command === 'finish') {
        if (!Keychain.contains(MANUAL_RUN_KEY) || Keychain.get(MANUAL_RUN_KEY) !== 'ready') {
            throw new Error('Life Calendar setup was cancelled or did not finish. No wallpaper was changed.');
        }
        Keychain.set(MANUAL_RUN_KEY, 'consumed');
        return await runLifeCalendar('refresh');
    }
    if (command === 'refresh') return await runLifeCalendar('refresh');

    const saved = Keychain.contains(SETTINGS_KEY) ? JSON.parse(Keychain.get(SETTINGS_KEY)) : null;
    const setupRequested = command === 'settings' || command === 'setup' ||
        command === 'prepared' || (!command && !saved);

    // Shortcuts may invoke this inline action once in Siri before the
    // runInApp action. Never present Scriptable UI from that Siri pass.
    // Return a small handoff token; the foreground pass opens the editor.
    if (setupRequested && !config.runsInApp) {
        Keychain.set(MANUAL_RUN_KEY, 'pending');
        return 'setup';
    }

    // Accept the output of the Siri handoff as the foreground editor request.
    if (command === 'setup' || command === 'prepared') command = 'settings';
    try {
        await runLifeCalendar(command === 'settings' ? 'settings' : originalInput);
        Keychain.set(MANUAL_RUN_KEY, 'ready');
        Safari.open('shortcuts://');
        return 'ready';
    } catch (error) {
        Keychain.set(MANUAL_RUN_KEY, 'cancelled');
        Safari.open('shortcuts://');
        throw error;
    }
}

Script.setShortcutOutput(await executeLifeCalendar(args.shortcutParameter));
