import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

execFileSync(process.execPath, ['scriptable/build.mjs']);
const source = await readFile(new URL('../dist/life-calendar-scriptable.js', import.meta.url), 'utf8');

function run(parameter) {
    const draws = [], labels = [];
    let context;
    let output;
    class Rect {
        constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
    }
    const globals = {
        args: { shortcutParameter: parameter },
        Script: { setShortcutOutput(value) { output = value; } },
        Size: class { constructor(width, height) { Object.assign(this, { width, height }); } },
        Rect,
        Color: class { constructor(hex, opacity = 1) { this.hex = hex; this.opacity = opacity; } },
        Path: class { addRoundedRect(rect) { this.rect = rect; } },
        Font: { regularMonospacedSystemFont: size => size },
        DrawContext: class {
            constructor() { context = this; }
            setFillColor(color) { this.color = color.hex; }
            fillRect(rect) { draws.push({ ...rect, color: this.color }); }
            setStrokeColor(color) { this.color = color.hex; }
            setLineWidth() {}
            fillEllipse(rect) { this.fillRect(rect); }
            strokeEllipse(rect) { this.fillRect(rect); }
            strokeRect(rect) { this.fillRect(rect); }
            addPath(path) { this.path = path; }
            fillPath() { this.fillRect(this.path.rect); }
            strokePath() { this.fillRect(this.path.rect); }
            setFont() {} setTextColor() {} drawTextInRect(text, rect) { labels.push({text, ...rect}); }
            getImage() { return this; }
        },
        Data: { fromPNG(image) {
            assert.equal(image, context);
            return { toBase64String: () => 'PNG-output-contract' };
        } }
    };
    vm.runInNewContext(source + '\nScript.setShortcutOutput(renderWallpaper(args.shortcutParameter));', globals, { timeout: 3000 });
    return { draws, labels, context, output };
}

test('native sizes, bounded geometry, week counts, and text output across devices/layouts', () => {
    const devices = {
        iphone: [1206, 2622], max: [1320, 2868],
        'duo-outer': [1398, 2034], 'duo-inner': [1878, 2670],
        'duo-inner-landscape': [2670, 1878]
    };
    for (const [device, [width, height]] of Object.entries(devices)) {
        for (const layout of ['none', 'top', 'bottom', 'right']) {
            for (const years of [1, 90, 120]) {
                const { draws, context, output } = run({ dob: '2000-01-01', device, layout, years });
                assert.equal(context.size.width, width);
                assert.equal(context.size.height, height);
                assert.equal(context.respectScreenScale, false);
                assert.equal(context.opaque, true);
                assert.equal(output, 'PNG-output-contract');
                assert.equal(draws.length, 1 + years * 52);
                assert.deepEqual(draws[0], { x: 0, y: 0, width, height, color: '#000000' });
                for (const r of draws.slice(1)) {
                    assert.ok(r.width > 0 && r.height > 0);
                    assert.ok(r.x >= 0 && r.x + r.width <= width);
                    assert.ok(r.y >= 0 && r.y + r.height <= height);
                }
            }
        }
    }
});

test('Duo reserves right controls regardless of layout choice', () => {
    const baseline = run({ dob: '2000-01-01', device: 'duo-outer' }).draws;
    const alternate = run({ dob: '2000-01-01', device: 'duo-outer', layout: 'top' }).draws;
    assert.deepEqual(alternate, baseline);
    assert.ok(Math.max(...baseline.slice(1).map(r => r.x + r.width)) < 1398 * 0.78);
});

test('accepts JSON parameters and normalizes colors', () => {
    const { draws } = run(JSON.stringify({ dob: '2000-01-01', bg: '123abc', lived: 'abcdef' }));
    assert.equal(draws[0].color, '#123abc');
    assert.equal(draws[1].color, '#abcdef');
});

test('rejects malformed settings before allocating a drawing context', () => {
    for (const input of [null, [], {}, { dob: '2025-02-29' }, { dob: 'bad' },
        { dob: '2000-01-01', years: 121 }, { dob: '2000-01-01', years: 1.5 },
        { dob: '2000-01-01', device: 'unknown' }, { dob: '2000-01-01', bg: 'red' },
        { dob: '2000-01-01', layout: 'unknown' }]) {
        assert.throws(() => run(input));
    }
});

test('all native marker paths render with bounds and normalization intact', () => {
    for (const shape of ['circle', 'rounded', 'square']) for (const future of ['dim', 'outline', 'hidden']) {
        const { draws } = run({ dob: '2000-01-01', grid: 'classic', shape, future,
            view: 'combined', highlight: 'larger', decades: true, midyear: true, ageLabels: '10' });
        assert.ok(draws.length > 365);
        for (const r of draws) assert.ok(r.width > 0 && r.height > 0);
    }
});


test('native renderer supports countdowns and wrapped quotes without a birth date', () => {
    const result = run({view:'countdown', countdownStart:'2026-01-01', countdownEnd:'2027-01-01', countdownTitle:'A milestone', quote:'custom', quoteText:'#Remember & reflect'});
    assert.equal(result.draws.length, 366);
    assert.ok(result.labels.some(label => label.text === 'A milestone'));
    assert.ok(result.labels.some(label => label.text === '#Remember & reflect'));
    assert.equal(result.output, 'PNG-output-contract');
});
