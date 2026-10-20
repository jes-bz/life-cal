import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

execFileSync(process.execPath, ['scriptable/build.mjs']);
const source = await readFile(new URL('./interactive.js', import.meta.url), 'utf8');
const functions = source.slice(0, source.lastIndexOf('Script.setShortcutOutput'));

function runtime(saved, choices = [], runsInApp = true) {
    const store = new Map();
    if (saved) store.set('life-calendar.settings.v1', JSON.stringify(saved));
    const titles = [];
    let writes = 0;
    const context = vm.createContext({
        config: { runsInApp },
        Safari: { open: url => assert.equal(url, 'shortcuts://') },
        Keychain: { contains: key => store.has(key), get: key => store.get(key),
            set: (key, next) => { store.set(key, next); writes++; } },
        Alert: class {
            addAction() {} addCancelAction() {}
            async presentSheet() {
                titles.push(this.title);
                assert.ok(choices.length, 'Unexpected prompt');
                return choices.shift();
            }
        },
        renderWallpaper: settings => { assert.ok(settings.dob); return 'PNG'; },
        getDevice: () => ({ label: 'iPhone Max' })
    });
    vm.runInContext(functions, context);
    return { run: input => context.runLifeCalendar(input), preflight: input => context.preflightLifeCalendar(input),
        execute: input => context.executeLifeCalendar(input), titles,
        setRunsInApp: value => { context.config.runsInApp = value; },
        saved: () => store.has('life-calendar.settings.v1') ? JSON.parse(store.get('life-calendar.settings.v1')) : null,
        writes: () => writes };
}
const settings = { dob: '2000-01-01', device: 'max', years: 90, layout: 'bottom' };

test('empty input silently refreshes saved settings during preflight', async () => {
    const r = runtime(settings);
    assert.equal(await r.preflight(null), 'PNG');
    assert.deepEqual(r.titles, []);
    assert.equal(r.writes(), 0);
});
test('missing settings sends first run to setup', async () => {
    const r = runtime(null);
    assert.equal(await r.preflight(null), 'setup');
    assert.deepEqual(r.titles, []);
    assert.equal(r.writes(), 1);
});
test('settings input opens the saved settings form', async () => {
    const r = runtime(settings, [5]);
    assert.equal(await r.preflight('settings'), 'setup');
    assert.equal(await r.run('settings'), 'PNG');
    assert.deepEqual(r.titles, ['Change Settings']);
});
test('settings input on first run opens setup', async () => {
    const r = runtime(null);
    assert.equal(await r.preflight('settings'), 'setup');
});
test('website settings are routed to the guided setup without overwriting saved values', async () => {
    const r = runtime(settings, [5]);
    const website = { dob: '1988-04-03', device: 'max', years: 84, layout: 'top',
        bg: '#112233', lived: '#445566', rest: '#778899' };
    const input = JSON.stringify(website);
    assert.equal(await r.preflight(input), 'setup');
    assert.deepEqual(r.saved(), settings);
    assert.equal(await r.run(input), 'PNG');
    assert.deepEqual(r.titles, ['Review Website Settings']);
    assert.deepEqual(r.saved(), website);
});
test('website settings follow the manual Siri handoff before saving', async () => {
    const r = runtime(settings, [5], false);
    const website = { dob: '1988-04-03', device: 'max', years: 84, layout: 'top',
        bg: '#112233', lived: '#445566', rest: '#778899' };
    const input = JSON.stringify(website);
    assert.equal(await r.execute(input), 'setup');
    assert.deepEqual(r.titles, []);
    r.setRunsInApp(true);
    assert.equal(await r.execute(input), 'ready');
    assert.deepEqual(r.titles, ['Review Website Settings']);
    assert.deepEqual(r.saved(), website);
    assert.equal(await r.execute('finish'), 'PNG');
});
test('empty input with saved settings does not open a menu', async () => {
    const r = runtime(settings);
    assert.equal(await r.run(null), 'PNG');
    assert.deepEqual(r.titles, []);
});
test('changing settings saves only when confirmed', async () => {
    const r = runtime(settings, [5]);
    assert.equal(await r.run('settings'), 'PNG');
    assert.deepEqual(r.titles, ['Change Settings']);
    assert.equal(r.saved().dob, settings.dob);
    assert.equal(r.writes(), 1);
});
test('cancelling setup does not save settings or produce wallpaper output', async () => {
    const r = runtime(null, [-1]);
    await assert.rejects(r.run(null), /cancelled/);
    assert.equal(r.saved(), null);
    assert.equal(r.writes(), 0);
});
test('foreground settings handoff must complete before background render and can only be consumed once', async () => {
    const r = runtime(settings, [5]);
    assert.equal(await r.execute('prepare'), 'prepared');
    await assert.rejects(r.execute('finish'), /did not finish/);
    assert.equal(await r.execute('settings'), 'ready');
    assert.equal(await r.execute('finish'), 'PNG');
    await assert.rejects(r.execute('finish'), /did not finish/);
});
test('Siri defers the settings UI to the foreground Scriptable pass', async () => {
    const r = runtime(settings, [5], false);
    assert.equal(await r.execute('settings'), 'setup');
    assert.deepEqual(r.titles, []);

    r.setRunsInApp(true);
    assert.equal(await r.execute('setup'), 'ready');
    assert.deepEqual(r.titles, ['Change Settings']);
    assert.equal(await r.execute('finish'), 'PNG');
});
test('a prepared Siri handoff token opens settings only after entering the app', async () => {
    const r = runtime(settings, [5], false);
    assert.equal(await r.execute('prepare'), 'prepared');
    assert.deepEqual(r.titles, []);

    r.setRunsInApp(true);
    assert.equal(await r.execute('prepared'), 'ready');
    assert.deepEqual(r.titles, ['Change Settings']);
    assert.equal(await r.execute('finish'), 'PNG');
});
test('first-run Siri pass returns setup without presenting an alert', async () => {
    const r = runtime(null, [], false);
    assert.equal(await r.execute(null), 'setup');
    assert.deepEqual(r.titles, []);
    assert.equal(r.saved(), null);
});
test('cancelling a manual run prevents refreshing even when settings exist', async () => {
    const r = runtime(settings, [-1]);
    await r.execute('prepare');
    await assert.rejects(r.execute('settings'), /cancelled/);
    await assert.rejects(r.execute('finish'), /cancelled/);
});
