import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDesign, normalizeDesign, getLifespanSummary } from '../calendar-design.js';
import { generateRectData, DEVICES } from '../calendar-logic.js';
const now = new Date(2024, 1, 29, 12);
const base = { device: 'iphone', dob: '2000-01-01', years: 90, layout: 'none', lived: '#ffffff', rest: '#333333' };
const scene = options => generateDesign({ ...base, ...options }, now);
test('Duo default retains its fixed geometry and colors', () => {
    const { width, height } = DEVICES['duo-outer'];
    const original = generateRectData({ ...base, device: 'duo-outer', width, height, now, colorLived: base.lived, colorRest: base.rest });
    assert.deepEqual(scene({device: 'duo-outer'}).marks.map(({ x, y, size, color }) => ({ x, y, size, color })), original);
});
test('classic week rows are exactly one year, with decade and half-year separators', () => {
    const { marks, labels } = scene({ grid: 'classic', midyear: true, decades: true, ageLabels: '10' });
    assert.equal(marks.length, 90 * 52);
    assert.equal(marks[0].y, marks[51].y);
    assert.ok(marks[52].y > marks[51].y);
    assert.ok(marks[26].x - marks[25].x > marks[25].x - marks[24].x);
    assert.ok(marks[520].y - marks[468].y > marks[468].y - marks[416].y);
    assert.deepEqual(labels.map(l => l.text), ['0','10','20','30','40','50','60','70','80']);
});
test('leap-year view and combined view contain correct units and one current marker per panel', () => {
    const year = scene({ view: 'year', highlight: 'color' });
    assert.equal(year.marks.length, 366);
    assert.equal(year.marks.findIndex(m => m.active), 59);
    const combined = scene({ view: 'combined', highlight: 'color' });
    assert.equal(combined.marks.length, 4680 + 366);
    assert.equal(combined.marks.filter(m => m.active).length, 2);
    assert.ok(combined.marks[4680].y > Math.max(...combined.marks.slice(0,4680).map(m=>m.y+m.size)));
});
test('life months use completed month anniversaries, clamped at month end', () => {
    const s = scene({ view: 'months', grid: 'classic', dob: '2024-01-31' });
    assert.equal(s.marks.length, 90 * 12);
    assert.equal(s.marks.findIndex(m => m.active), 1);
    assert.equal(s.marks[0].y, s.marks[11].y);
});
test('future outline, visibility, opacity and current accent are independent', () => {
    const options = { view: 'year', highlight: 'color', accent: '#123456' };
    const outlined = scene({ ...options, future: 'outline', futureOpacity: 25 });
    assert.equal(outlined.marks[59].color, '#123456');
    assert.equal(outlined.marks[59].outline, false);
    assert.equal(outlined.marks[60].outline, true);
    assert.equal(outlined.marks[60].opacity, .25);
    assert.equal(scene({ ...options, future: 'hidden' }).marks.length, 60);
});
test('every new layout stays inside native safe areas including the Duo control inset', () => {
    for (const device of Object.keys(DEVICES)) for (const view of ['weeks','months','year','combined'])
    for (const placement of ['center','bottom','vertical','corner']) for (const grid of ['adaptive','classic']) {
        const s = scene({ device, view, placement, grid, screen:'home', position:100, spacing:75,
            scale:100, highlight:'larger', midyear:true, decades:true, ageLabels:'5' });
        const { width, height } = DEVICES[device];
        for (const m of s.marks) {
            assert.ok(m.size > 0 && m.x >= 0 && m.y >= 0, JSON.stringify({device,view,placement,grid,m}));
            assert.ok(m.x + m.size <= width * (device.startsWith('duo-') ? .78 : 1));
            assert.ok(m.y + m.size <= height);
        }
    }
});
test('invalid appearance values fail before rendering', () => {
    for (const value of [{shape:'triangle'}, {scale:0}, {position:101}, {futureOpacity:-1}, {spacing:Infinity},
        {accent:'red'}, {midyear:'yes'}, {view:'unknown'}]) assert.throws(() => normalizeDesign(value));
});

test('adaptive grid is near square and fills width when a square fits', () => {
    for (const device of ['iphone', 'max']) for (const layout of ['none', 'top', 'bottom']) {
        const { marks, width } = scene({ device, layout, grid:'adaptive', highlight:'color' });
        const cols = marks.findIndex(m => m.y !== marks[0].y);
        const rows = Math.ceil(marks.length / cols);
        assert.ok(Math.abs(cols - rows) <= 1);
        assert.ok(cols >= 68 && cols <= 69);
        const w = Math.max(...marks.map(m => m.x + m.size)) - marks[0].x;
        const h = marks.at(-1).y + marks.at(-1).size - marks[0].y;
        assert.ok(Math.abs(w / h - 1) < .03);
        assert.ok(w > width * .85);
    }
});
test('disabled classic options do not affect adaptive geometry', () => {
    for (const device of Object.keys(DEVICES)) {
        assert.deepEqual(scene({device}), scene({device,ageLabels:'10',decades:true,midyear:true}));
    }
});
test('adaptive grid widens only to fit a short panel without stretching markers', () => {
    const {marks,width,height} = scene({view:'year',device:'duo-inner-landscape'});
    const cols = marks.findIndex(m => m.y !== marks[0].y);
    assert.ok(cols > Math.ceil(Math.sqrt(marks.length)));
    for (const mark of marks) {
        assert.ok(mark.size > 0 && mark.x + mark.size <= width && mark.y + mark.size <= height);
    }
});

test('full-square rounding chooses nearest marker count across supported years', () => {
    for (let years=1;years<=120;years++) for (const view of ['weeks','months','combined']) {
        const options = {...base,years,view,grid:'adaptive',squareLifespan:true};
        const summary = getLifespanSummary(options);
        const perYear = view === 'months' ? 12 : 52;
        const target = years * perYear;
        assert.ok(Number.isInteger(Math.sqrt(summary.total)));
        assert.ok(Math.abs(summary.total-target) <= Math.abs((summary.side-1)**2-target));
        assert.ok(Math.abs(summary.total-target) <= Math.abs((summary.side+1)**2-target));
        const marks = generateDesign(options,now).marks.slice(0,summary.total);
        assert.equal(marks.length,summary.total);
        assert.equal(marks.findIndex(m=>m.y!==marks[0].y),summary.side);
        assert.equal(marks.at(-1).x,marks[summary.side-1].x);
    }
    assert.deepEqual(getLifespanSummary({...base,squareLifespan:true}),
        {rounded:true,total:4624,side:68,effectiveYears:4624/52,unit:'weeks'});
});
test('rounding is opt-in and inactive for classic grids and current-year days', () => {
    assert.equal(scene({}).marks.length,90*52);
    for (const options of [{grid:'classic'},{view:'year'}]) {
        assert.deepEqual(scene(options),scene({...options,squareLifespan:true}));
        assert.equal(getLifespanSummary({...base,...options,squareLifespan:true}).rounded,false);
    }
    assert.equal(normalizeDesign({squareLifespan:'true'}).squareLifespan,true);
    assert.throws(()=>normalizeDesign({squareLifespan:'yes'}));
});

test('classic row width spreads columns without stretching markers or moving years', () => {
    for (const view of ['weeks', 'months', 'combined']) {
        const options = { grid: 'classic', view, midyear: true, decades: true, ageLabels: '10' };
        const scenes = ['natural', 'wide', 'full'].map(classicWidth => scene({...options, classicWidth}));
        const cols = view === 'months' ? 12 : 52;
        const span = s => s.marks[cols - 1].x + s.marks[cols - 1].size - s.marks[0].x;
        assert.ok(span(scenes[0]) < span(scenes[1]));
        assert.ok(span(scenes[1]) < span(scenes[2]));
        for (const current of scenes) {
            assert.equal(current.marks.length, scenes[0].marks.length);
            for (let i=0; i<current.marks.length; i++) {
                assert.equal(current.marks[i].size, scenes[0].marks[i].size);
                assert.equal(current.marks[i].y, scenes[0].marks[i].y);
            }
            assert.equal(current.marks[0].y, current.marks[cols-1].y);
        }
        assert.ok(Math.abs(span(scenes[2]) - 1206 * (.92 - .035)) < .001);
    }
});
test('classic width options do not affect adaptive or current-year geometry', () => {
    for (const options of [{grid:'adaptive'}, {grid:'classic',view:'year'}]) {
        for (const classicWidth of ['wide','full']) assert.deepEqual(scene({...options,classicWidth}),scene(options));
    }
    assert.throws(()=>normalizeDesign({classicWidth:'stretch'}));
});


test('countdown uses calendar days across leap day and ignores classic-only settings', () => {
    const countdown = { view: 'countdown', countdownStart: '2024-02-28', countdownEnd: '2024-03-02', countdownTitle: 'A milestone' };
    const result = scene(countdown);
    assert.equal(result.marks.length, 3);
    assert.equal(result.marks.findIndex(mark => mark.active), 1);
    assert.ok(result.labels.some(label => label.text === '2 days left'));
    assert.deepEqual(scene({ ...countdown, grid: 'classic', midyear: true, decades: true, ageLabels: '5', classicWidth: 'full', squareLifespan: true }), result);
    const before = generateDesign({ ...base, ...countdown }, new Date(2024, 1, 27));
    assert.equal(before.marks.filter(mark => mark.active).length, 0);
    assert.ok(before.marks.every(mark => mark.color === base.rest));
    const done = generateDesign({ ...base, ...countdown }, new Date(2024, 2, 2));
    assert.ok(done.labels.some(label => label.text === 'Target reached'));
    assert.ok(done.marks.every(mark => mark.color === base.lived));
    assert.equal(done.marks.filter(mark => mark.active).length, 0);
});
test('countdown validates real dates, ordering and bounded duration', () => {
    for (const dates of [['2024-02-30','2024-03-02'], ['2024-03-02','2024-03-02'], ['2024-03-02','2024-03-01'], ['1900-01-01','2026-01-01']]) {
        assert.throws(() => scene({view:'countdown',countdownStart:dates[0],countdownEnd:dates[1]}));
    }
});
test('custom quotes wrap within each device safe area and stay separate from markers', () => {
    for (const device of Object.keys(DEVICES)) {
        const result = scene({ device, quote:'custom', quoteText:'A'.repeat(140), position:100 });
        const maxX = result.width * (device.startsWith('duo-') ? .74 : .96);
        assert.ok(result.labels.length >= 2);
        for (const label of result.labels) {
            assert.ok(label.x >= 0 && label.x + label.width <= maxX + .001);
            assert.ok(label.y + label.height <= result.height * .94);
            assert.ok(Math.max(...result.marks.map(mark => mark.y + mark.size)) < label.y);
        }
    }
    assert.throws(() => scene({quoteText:'A'.repeat(141)}));
    assert.throws(() => scene({countdownTitle:'A'.repeat(49)}));
});
test('daily reflections are deterministic within a local day and rotate on refresh', () => {
    const options = {...base, view:'year', quote:'daily'};
    const first = generateDesign(options, new Date(2024, 1, 29, 0));
    const later = generateDesign(options, new Date(2024, 1, 29, 23));
    const next = generateDesign(options, new Date(2024, 2, 1, 0));
    assert.deepEqual(first.labels, later.labels);
    assert.notDeepEqual(first.labels.map(label=>label.text), next.labels.map(label=>label.text));
});
