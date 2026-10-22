import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { DESIGN_FIELDS, getLifespanSummary } from '../calendar-design.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

execFileSync(process.execPath, ['scriptable/build.mjs']);
const source = await readFile(new URL('./interactive.js', import.meta.url), 'utf8');
const functions = source.slice(0, source.lastIndexOf('Script.setShortcutOutput'));
const release = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8'));
const [major, minor] = release.version.split('.').map(Number);
const newerMinor = `${major}.${minor + 1}.0`;
const newerMajor = `${major + 1}.0.0`;
const settings = { dob: '2000-01-01', device: 'max', years: 90, layout: 'bottom',
    bg: '#000000', lived: '#ffffff', rest: '#333333' };
const website = { ...settings, dob: '1988-04-03', bg: '#112233' };
const handoff = { ...website, version: release.version };

function runtime(saved, choice = 'Apply Wallpaper', runsInApp = true) {
    const store = new Map();
    if (saved) store.set('life-calendar.settings.v1', JSON.stringify(saved));
    const tables = [], opened = [];
    let settingsWrites = 0;
    class Row {
        cells = [];
        addText(title, subtitle) { this.cells.push({ title, subtitle }); }
        addImage(image) { assert.equal(image, 'IMAGE'); return { centerAligned() {} }; }
    }
    const context = vm.createContext({
        DESIGN_FIELDS, getLifespanSummary, LIFE_CALENDAR_VERSION: release.version, LIFE_CALENDAR_SITE_URL: release.siteUrl,
        config: { runsInApp },
        Safari: { open: url => opened.push(url) },
        Keychain: { contains: key => store.has(key), get: key => store.get(key),
            set: (key, next) => { store.set(key, next); if (key === 'life-calendar.settings.v1') settingsWrites++; } },
        UITableRow: Row,
        UITable: class {
            rows = [];
            addRow(row) { this.rows.push(row); }
            async present() {
                tables.push(this.rows);
                if (choice) {
                    const row = this.rows.find(r => r.cells.some(c => c.title === choice));
                    assert.ok(row, 'Requested preview action exists');
                    assert.equal(row.dismissOnSelect, true);
                    row.onSelect();
                }
            }
        },
        Image: { fromData: () => 'IMAGE' }, Data: { fromBase64String: value => assert.equal(value, 'PNG') },
        renderWallpaper: value => { assert.ok(value?.dob, 'Invalid settings'); return 'PNG'; },
        getDevice: () => ({ label: 'iPhone Max' })
    });
    vm.runInContext(functions, context);
    return { preflight: input => context.preflightLifeCalendar(input), execute: input => context.executeLifeCalendar(input),
        setRunsInApp: value => { context.config.runsInApp = value; }, tables, opened,
        saved: () => store.has('life-calendar.settings.v1') ? JSON.parse(store.get('life-calendar.settings.v1')) : null,
        writes: () => settingsWrites };
}

test('fresh install opens the website without local configuration prompts', async () => {
    const r = runtime(null);
    assert.equal(await r.preflight(null), release.siteUrl);
    assert.equal(await r.execute(null), release.siteUrl);
    assert.deepEqual(r.tables, []);
    assert.equal(r.saved(), null);
});
test('empty input refreshes saved settings silently without navigation or writes', async () => {
    const r = runtime(settings, null, false);
    assert.equal(await r.preflight(null), 'PNG');
    assert.equal(await r.execute('refresh'), 'PNG');
    assert.deepEqual(r.tables, []);
    assert.deepEqual(r.opened, []);
    assert.equal(r.writes(), 0);
});
test('Shortcuts empty-list input follows the same refresh and first-run paths', async () => {
    const configured = runtime(settings, null, false);
    assert.equal(await configured.preflight([]), 'PNG');
    assert.equal(await configured.execute([]), 'PNG');
    assert.deepEqual(configured.tables, []);
    assert.equal(await runtime(null).preflight([]), release.siteUrl);
});
test('settings link restores saved design in the website fragment', async () => {
    const r = runtime(settings);
    const url = new URL(await r.preflight('settings'));
    assert.equal(url.search, '');
    const values = new URLSearchParams(url.hash.slice(1));
    assert.equal(values.get('dob'), settings.dob);
    assert.equal(values.get('bg'), '000000');
    assert.deepEqual(r.tables, []);
});
for (const [label, input] of [['JSON string', JSON.stringify(handoff)], ['Safari dictionary', { ...handoff, ignored: 'drop' }]]) {
    test(`${label} previews only in foreground and saves after Apply`, async () => {
        const r = runtime(settings, 'Apply Wallpaper', false);
        assert.equal(await r.preflight(input), 'setup');
        assert.deepEqual(r.saved(), settings);
        assert.equal(await r.execute(input), 'setup');
        assert.deepEqual(r.tables, []);
        r.setRunsInApp(true);
        assert.equal(await r.execute(input), 'ready');
        assert.deepEqual(r.saved(), website);
        assert.equal(r.writes(), 1);
        assert.match(r.tables[0][0].cells[0].subtitle, new RegExp(release.version.replaceAll('.', '\\.')));
        assert.deepEqual(r.tables[0].filter(row => row.onSelect).map(row => row.cells[0].title),
            ['Apply Wallpaper', 'Edit on Website', 'Cancel']);
        assert.equal(await r.execute('finish'), 'PNG');
        assert.equal(await r.execute('finish'), 'shortcuts://');
    });
}
test('Edit on Website restores the candidate design without overwriting saved settings', async () => {
    const r = runtime(settings, 'Edit on Website');
    await r.preflight(handoff);
    const link = await r.execute(handoff);
    assert.equal(new URLSearchParams(new URL(link).hash.slice(1)).get('dob'), website.dob);
    assert.equal(await r.execute('finish'), link);
    assert.deepEqual(r.saved(), settings);
    assert.equal(r.writes(), 0);
});
for (const choice of ['Cancel', null]) {
    test(`${choice || 'closing preview'} exits cleanly without saving or rendering wallpaper output`, async () => {
        const r = runtime(settings, choice);
        await r.preflight(handoff);
        assert.equal(await r.execute(handoff), 'shortcuts://');
        assert.equal(await r.execute('finish'), 'shortcuts://');
        assert.deepEqual(r.saved(), settings);
        assert.equal(r.writes(), 0);
    });
}
test('new preview invalidates any previously approved handoff', async () => {
    const r = runtime(settings);
    await r.preflight(handoff); await r.execute(handoff);
    await r.preflight(handoff);
    assert.equal(await r.execute('finish'), 'shortcuts://');
});
test('invalid inputs cannot replace saved settings', async () => {
    const r = runtime(settings);
    await assert.rejects(r.preflight([website]), /dictionary/);
    await assert.rejects(r.preflight('{broken'), /valid JSON/);
    await assert.rejects(r.preflight('unsupported'), /Unsupported/);
    await assert.rejects(r.execute({ device: 'max', version: release.version }), /Invalid settings/);
    assert.equal(await r.execute('finish'), 'shortcuts://');
    assert.deepEqual(r.saved(), settings);
    assert.equal(r.writes(), 0);
});

for (const version of [release.version.split('.').slice(0, 2).join('.') + '.9', release.version]) {
    test(`patch-compatible handoff ${version} previews normally`, async () => {
        const r = runtime(settings);
        assert.equal(await r.execute({ ...website, version }), 'ready');
        assert.deepEqual(r.saved(), website);
    });
}
for (const version of [newerMinor, newerMajor, '0.0.0', 'invalid', null]) {
    test(`incompatible handoff ${version} blocks before settings or wallpaper writes`, async () => {
        const r = runtime(settings, 'Open update page', false);
        const input = { ...website, version };
        assert.equal(await r.preflight(input), 'setup');
        assert.equal(await r.execute(input), 'setup');
        assert.equal(r.tables.length, 0);
        r.setRunsInApp(true);
        const result = await r.execute(input);
        assert.equal(new URLSearchParams(new URL(result).hash.slice(1)).get('update'), '1');
        assert.equal(await r.execute('finish'), result);
        assert.deepEqual(r.saved(), settings);
        assert.equal(r.writes(), 0);
        assert.equal(r.tables[0][0].cells[0].title,
            ['0.0.0', null].includes(version) ? 'Reopen the website' : 'Shortcut update required');
    });
}
test('canceling an update exits cleanly and invalidates an earlier approval', async () => {
    const r = runtime(settings, 'Cancel');
    await r.preflight({ ...website, version: newerMajor });
    assert.equal(await r.execute({ ...website, version: newerMajor }), 'shortcuts://');
    assert.equal(await r.execute('finish'), 'shortcuts://');
    assert.deepEqual(r.saved(), settings);
});

test('appearance fields survive apply and saved-design website round trip', async () => {
    const appearance = { view:'combined', grid:'classic', shape:'circle', future:'outline', highlight:'larger',
        accent:'#123456', screen:'home', placement:'corner', scale:70, position:100, spacing:40,
        futureOpacity:35, ageLabels:'10', decades:true, midyear:true };
    const r = runtime(settings);
    await r.execute({ ...handoff, ...appearance, ignored:'drop' });
    assert.deepEqual(r.saved(), { ...website, ...appearance });
    const url = new URL(await r.preflight('settings'));
    const values = new URLSearchParams(url.hash.slice(1));
    for (const [key,value] of Object.entries(appearance)) assert.equal(values.get(key), String(value).replace(/^#/, ''));
    assert.equal(values.has('version'), false);
    assert.equal(values.has('ignored'), false);
});

test('rounded lifespan is disclosed before Apply and persists without changing target years', async () => {
    const r = runtime(settings);
    const input = {...handoff, years:90, grid:'adaptive', squareLifespan:true};
    await r.execute(input);
    assert.equal(r.saved().years,90);
    assert.equal(r.saved().squareLifespan,true);
    assert.ok(r.tables[0].some(row => row.cells.some(cell => cell.subtitle?.includes('88.9 years · 68 × 68'))));
    const restored = new URL(await r.execute('settings'));
    assert.equal(new URLSearchParams(restored.hash.slice(1)).get('squareLifespan'), 'true');
});
