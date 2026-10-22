import { getDevice, generateRectData } from './calendar-logic.js';

export const DESIGN_DEFAULTS = {
    view: 'weeks', grid: 'adaptive', shape: 'square', future: 'dim',
    highlight: 'none', accent: '#f6a64b', screen: 'lock', placement: 'center',
    scale: 100, position: 50, spacing: 25, futureOpacity: 100,
    ageLabels: 'none', decades: false, midyear: false
};
export const DESIGN_FIELDS = Object.keys(DESIGN_DEFAULTS);
export function normalizeDesign(input = {}) {
    const s = { ...DESIGN_DEFAULTS, ...input };
    const choices = { view: ['weeks', 'months', 'year', 'combined'], grid: ['adaptive', 'classic'],
        shape: ['square', 'rounded', 'circle'], future: ['dim', 'outline', 'hidden'],
        highlight: ['none', 'color', 'outline', 'larger'], screen: ['lock', 'home'],
        placement: ['center', 'bottom', 'vertical', 'corner'], ageLabels: ['none', '5', '10'] };
    for (const [key, values] of Object.entries(choices)) {
        if (!values.includes(s[key])) throw new Error('Unknown design option: ' + key);
    }
    for (const [key, min, max] of [['scale', 30, 100], ['position', 0, 100], ['spacing', 0, 75], ['futureOpacity', 0, 100]]) {
        s[key] = Number(s[key]);
        if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max) throw new Error('Invalid design value: ' + key);
    }
    if (typeof s.accent !== 'string' || !/^#?[\da-f]{6}$/i.test(s.accent)) throw new Error('Invalid accent color');
    s.accent = '#' + s.accent.replace(/^#/, '');
    for (const key of ['decades', 'midyear']) {
        if (![true, false, 'true', 'false'].includes(s[key])) throw new Error('Invalid design option: ' + key);
        s[key] = s[key] === true || s[key] === 'true';
    }
    return s;
}
function civilDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000; }
function timeUnits(s, now, view) {
    const birth = new Date(s.dob + 'T00:00:00');
    if (view === 'year') {
        const start = new Date(now.getFullYear(), 0, 1), end = new Date(now.getFullYear() + 1, 0, 1);
        return { total: civilDay(end) - civilDay(start), current: civilDay(now) - civilDay(start), perYear: 0 };
    }
    if (view === 'months') {
        let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
        // Clamp anniversaries to the final day for births on the 29th–31st.
        const anniversary = Math.min(birth.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
        if (now.getDate() < anniversary) months--;
        return { total: s.years * 12, current: months, perYear: 12 };
    }
    return { total: s.years * 52, current: Math.floor((civilDay(now) - civilDay(birth)) / 7), perYear: 52 };
}
export function generateDesign(input, now = new Date()) {
    const s = normalizeDesign(input);
    const { width, height } = getDevice(s.device);
    const isDuo = s.device.startsWith('duo-');
    if (isDuo) { s.screen = 'lock'; s.placement = 'center'; s.position = 100; }
    const legacy = s.view === 'weeks' && s.grid === 'adaptive' && s.screen === 'lock' &&
        s.placement === 'center' && s.scale === 100 && (s.position === 50 || isDuo) && s.spacing === 25 &&
        s.ageLabels === 'none' && !s.decades && !s.midyear;
    const marks = [], labels = [];
    function addMark(x, y, size, index, current) {
        const past = index < current, active = index === current && current >= 0;
        if (!past && !active && s.future === 'hidden') return;
        const accent = active && s.highlight !== 'none';
        const expanded = accent && s.highlight === 'larger' ? 1.35 : 1;
        const extra = size * (expanded - 1) / 2;
        marks.push({ x: x - extra, y: y - extra, size: size * expanded,
            color: accent ? s.accent : past || active ? s.lived : s.rest,
            opacity: past || active ? 1 : s.futureOpacity / 100, shape: s.shape,
            outline: accent ? s.highlight === 'outline' : !past && !active && s.future === 'outline',
            active });
    }
    if (legacy) {
        const current = timeUnits(s, now, 'weeks').current;
        for (const [index, r] of generateRectData({ ...s, width, height, now,
            colorLived: s.lived, colorRest: s.rest }).entries()) {
            // Preserve the existing default image exactly, including week rounding.
            if (s.highlight === 'none' && s.future === 'dim' && s.futureOpacity === 100) {
                marks.push({ ...r, shape: s.shape, opacity: 1, outline: false, active: index === current });
            } else addMark(r.x, r.y, r.size, index, current);
        }
        return { width, height, marks, labels };
    }
    // Duo's permanent right-side controls remain reserved for every design.
    const left = width * .04, right = width * (isDuo ? .74 : .96);
    const top = height * (isDuo ? .35 : s.screen === 'home' ? .12 : s.layout === 'top' ? .35 : .25);
    const bottom = height * (isDuo ? .94 : s.screen === 'home' ? .84 : s.layout === 'bottom' ? .80 : .90);
    let areaWidth = (right - left) * s.scale / 100;
    if (s.screen === 'home' && s.placement === 'vertical') areaWidth *= .48;
    if (s.screen === 'home' && s.placement === 'corner') areaWidth *= .58;
    const areaHeight = bottom - top;
    const compact = s.screen === 'home' && s.placement === 'corner';
    const panelTop = compact ? top + areaHeight * .5 : top;
    const panelHeight = compact ? areaHeight * .5 : areaHeight;
    function panel(view, panelTop, panelHeight) {
        const { total, current, perYear } = timeUnits(s, now, view);
        const classic = s.grid === 'classic' && view !== 'year';
        const split = classic && view === 'weeks' && s.midyear;
        const decade = classic && s.decades;
        const labelEvery = classic && s.ageLabels !== 'none' ? Number(s.ageLabels) : 0;
        const gutter = labelEvery ? width * .035 : 0;
        const gapRatio = .08 + s.spacing / 100;
        let cols = classic ? perYear : view === 'year' ? 19 : view === 'months' ? 24 : 52;
        let size, rows, gridHeight, gridWidth;
        do {
            rows = Math.ceil(total / cols);
            const xUnits = cols + (cols - 1) * gapRatio + (split ? 1 : 0);
            const yUnits = rows + (rows - 1) * gapRatio + (decade ? Math.floor((rows - 1) / 10) : 0);
            size = Math.min((areaWidth - gutter) / xUnits, panelHeight * s.scale / 100 / yUnits) / 1.05;
            gridWidth = size * xUnits; gridHeight = size * yUnits;
            if (classic || view === 'year' || gridWidth >= (areaWidth - gutter) * .80 || cols >= 160) break;
            cols++;
        } while (true);
        const fraction = s.position / 100;
        const x = s.screen === 'home' && s.placement === 'corner' ? left + gutter :
            left + (right - left - gridWidth - gutter) / 2 + gutter;
        const y = panelTop + (panelHeight - gridHeight) * fraction;
        for (let i = 0; i < total; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            addMark(x + size * (col * (1 + gapRatio) + (split && col >= 26 ? 1 : 0)),
                y + size * (row * (1 + gapRatio) + (decade ? Math.floor(row / 10) : 0)), size, i, current);
        }
        if (labelEvery) for (let row = 0; row < rows; row += labelEvery) {
            const fontSize = Math.min(width * .018, size * .9);
            labels.push({ text: String(row), x: x - gutter, y: y + size * (row * (1 + gapRatio) +
                (decade ? Math.floor(row / 10) : 0)), width: gutter * .85, height: size * 1.5, fontSize, color: s.rest });
        }
    }
    if (s.view === 'combined') {
        panel('weeks', panelTop, panelHeight * .66);
        panel('year', panelTop + panelHeight * .72, panelHeight * .28);
    } else panel(s.view, panelTop, panelHeight);
    return { width, height, marks, labels };
}
