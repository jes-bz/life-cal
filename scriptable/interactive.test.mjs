import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

execFileSync(process.execPath, ['scriptable/build.mjs']);
const source = await readFile(new URL('./interactive.js', import.meta.url), 'utf8');
const functions = source.slice(0, source.lastIndexOf('Script.setShortcutOutput'));
const release = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8'));
const settings = { dob: '2000-01-01', device: 'max', years: 90, layout: 'bottom',
    bg: '#000000', lived: '#ffffff', rest: '#333333' };
const website = { ...settings, dob: '1988-04-03', bg: '#112233' };

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
        LIFE_CALENDAR_VERSION: release.version, LIFE_CALENDAR_SITE_URL: release.siteUrl,
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
for (const [label, input] of [['JSON string', JSON.stringify(website)], ['Safari dictionary', { ...website, ignored: 'drop' }]]) {
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
    await r.preflight(website);
    const link = await r.execute(website);
    assert.equal(new URLSearchParams(new URL(link).hash.slice(1)).get('dob'), website.dob);
    assert.equal(await r.execute('finish'), link);
    assert.deepEqual(r.saved(), settings);
    assert.equal(r.writes(), 0);
});
for (const choice of ['Cancel', null]) {
    test(`${choice || 'closing preview'} exits cleanly without saving or rendering wallpaper output`, async () => {
        const r = runtime(settings, choice);
        await r.preflight(website);
        assert.equal(await r.execute(website), 'shortcuts://');
        assert.equal(await r.execute('finish'), 'shortcuts://');
        assert.deepEqual(r.saved(), settings);
        assert.equal(r.writes(), 0);
    });
}
test('new preview invalidates any previously approved handoff', async () => {
    const r = runtime(settings);
    await r.preflight(website); await r.execute(website);
    await r.preflight(website);
    assert.equal(await r.execute('finish'), 'shortcuts://');
});
test('invalid inputs cannot replace saved settings', async () => {
    const r = runtime(settings);
    await assert.rejects(r.preflight([website]), /dictionary/);
    await assert.rejects(r.preflight('{broken'), /valid JSON/);
    await assert.rejects(r.preflight('unsupported'), /Unsupported/);
    await assert.rejects(r.execute({ device: 'max' }), /Invalid settings/);
    assert.equal(await r.execute('finish'), 'shortcuts://');
    assert.deepEqual(r.saved(), settings);
    assert.equal(r.writes(), 0);
});
