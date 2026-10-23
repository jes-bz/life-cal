import { getDevice, generateRectData } from './calendar-logic.js';

export const DESIGN_DEFAULTS = {
    view: 'weeks', grid: 'adaptive', shape: 'square', future: 'dim',
    highlight: 'none', accent: '#f6a64b', screen: 'lock', placement: 'center',
    scale: 100, position: 50, spacing: 25, futureOpacity: 100,
    countdownStart: '', countdownEnd: '', countdownTitle: '', quote: 'none', quoteText: '',
    classicWidth: 'natural', ageLabels: 'none', decades: false, midyear: false, squareLifespan: false
};
export const DESIGN_FIELDS = Object.keys(DESIGN_DEFAULTS);
export function normalizeDesign(input = {}) {
    const s = { ...DESIGN_DEFAULTS, ...input };
    const choices = { quote: ['none', 'daily', 'custom'], view: ['weeks', 'months', 'year', 'combined', 'countdown'], grid: ['adaptive', 'classic'],
        shape: ['square', 'rounded', 'circle'], future: ['dim', 'outline', 'hidden'],
        highlight: ['none', 'color', 'outline', 'larger'], screen: ['lock', 'home'],
        placement: ['center', 'bottom', 'vertical', 'corner'], classicWidth: ['natural', 'wide', 'full'], ageLabels: ['none', '5', '10'] };
    for (const [key, values] of Object.entries(choices)) {
        if (!values.includes(s[key])) throw new Error('Unknown design option: ' + key);
    }
    for (const [key, min, max] of [['scale', 30, 100], ['position', 0, 100], ['spacing', 0, 75], ['futureOpacity', 0, 100]]) {
        s[key] = Number(s[key]);
        if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max) throw new Error('Invalid design value: ' + key);
    }
    if (typeof s.accent !== 'string' || !/^#?[\da-f]{6}$/i.test(s.accent)) throw new Error('Invalid accent color');
    s.accent = '#' + s.accent.replace(/^#/, '');
    for (const key of ['decades', 'midyear', 'squareLifespan']) {
        if (![true, false, 'true', 'false'].includes(s[key])) throw new Error('Invalid design option: ' + key);
        s[key] = s[key] === true || s[key] === 'true';
    }
    for (const [key, limit] of [['countdownTitle', 48], ['quoteText', 140]]) {
        if (typeof s[key] !== 'string' || Array.from(s[key]).length > limit || /[\x00-\x1f\x7f]/.test(s[key])) throw new Error('Invalid text: ' + key);
    }
    if (s.view === 'countdown') countdownRange(s);
    return s;
}
export const COLOR_THEMES = {
    classic: ['#000000', '#ffffff', '#333333', '#f6a64b'],
    paper: ['#f5f0e8', '#795548', '#d8cec0', '#ad572c'],
    midnight: ['#0b1020', '#8ab4f8', '#29334d', '#f6a64b'],
    forest: ['#0d1912', '#a3c9a8', '#2c4432', '#e4be78'],
    graphite: ['#17191c', '#e4e7eb', '#41464e', '#82d9cd'],
    sunset: ['#211315', '#f4b39a', '#573637', '#f5d276'],
    lavender: ['#171322', '#d4c4f5', '#453b58', '#f0b5cd'],
    ocean: ['#071b24', '#9dd9e8', '#234754', '#f0c987']
};
// Original prompts: no quote service, attribution claims, or network requests.
const REFLECTIONS = [
    'Make room for what matters.', 'Give this day your attention.',
    'Spend your time on purpose.', 'Small moments make a life.',
    'Begin with the time you have.', 'Leave space for joy.',
    'Choose one thing worth your time.'
];
function dateDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a real calendar date.');
    const date = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Choose a real calendar date.');
    return date.getTime() / 86400000;
}
function countdownRange(s) {
    const start = dateDay(s.countdownStart), end = dateDay(s.countdownEnd);
    if (end <= start || end - start > 120 * 366) throw new Error('Target date must be after the start date and within 120 years.');
    return { start, end, total: end - start };
}
export function getLifespanSummary(input) {
    const s = normalizeDesign(input);
    if (s.view === 'countdown') { const { total } = countdownRange(s); return { rounded: false, total, side: 0, effectiveYears: 0, unit: 'days' }; }
    const perYear = s.view === 'months' ? 12 : 52;
    const requested = Number(s.years) * perYear;
    const rounded = s.squareLifespan && s.grid === 'adaptive' && s.view !== 'year';
    const side = Math.round(Math.sqrt(requested));
    const total = rounded ? side * side : requested;
    return { rounded, total, side, effectiveYears: total / perYear,
        unit: perYear === 12 ? 'months' : 'weeks' };
}
function civilDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000; }
function timeUnits(s, now, view) {
    if (view === 'countdown') { const range = countdownRange(s); return { total: range.total, current: Math.max(-1, Math.min(range.total, civilDay(now) - range.start)), perYear: 0 }; }
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
        return { total: getLifespanSummary(s).total, current: months, perYear: 12 };
    }
    return { total: getLifespanSummary(s).total, current: Math.floor((civilDay(now) - civilDay(birth)) / 7), perYear: 52 };
}
export function generateDesign(input, now = new Date()) {
    const s = normalizeDesign(input);
    if (!['year', 'countdown'].includes(s.view)) {
        dateDay(s.dob);
        if (!Number.isInteger(Number(s.years)) || Number(s.years) < 1 || Number(s.years) > 120) throw new Error('Choose a lifespan from 1 to 120 whole years.');
    }
    const { width, height } = getDevice(s.device);
    const isDuo = s.device.startsWith('duo-');
    if (isDuo) { s.screen = 'lock'; s.placement = 'center'; s.position = 100; }
    const legacy = isDuo && s.view === 'weeks' && s.grid === 'adaptive' && s.screen === 'lock' &&
        s.placement === 'center' && s.scale === 100 && s.spacing === 25 && !s.squareLifespan && (s.quote === 'none' || (s.quote === 'custom' && !s.quoteText.trim()));
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
    let top = height * (isDuo ? .35 : s.screen === 'home' ? .12 : s.layout === 'top' ? .35 : .25);
    let bottom = height * (isDuo ? .94 : s.screen === 'home' ? .84 : s.layout === 'bottom' ? .80 : .90);
    function textLines(text, y, fontSize, maxLines = 3) {
        const capacity = Math.max(1, Math.floor((right - left) / (fontSize * .64)));
        const lines = []; let line = '';
        for (const word of text.trim().split(/\s+/)) {
            if (!word) continue;
            for (let offset = 0; offset < Array.from(word).length; offset += capacity) {
                const chunk = Array.from(word).slice(offset, offset + capacity).join('');
                if (line && Array.from(line + ' ' + chunk).length > capacity) { lines.push(line); line = ''; }
                line += (line ? ' ' : '') + chunk;
                if (Array.from(line).length >= capacity) { lines.push(line); line = ''; }
            }
        }
        if (line) lines.push(line);
        lines.slice(0, maxLines).forEach((text, index) => labels.push({ text, x: left, y: y + index * fontSize * 1.5,
            width: right - left, height: fontSize * 1.5, fontSize, color: s.lived }));
    }
    const quoteText = s.quote === 'daily' ? REFLECTIONS[((civilDay(now) % REFLECTIONS.length) + REFLECTIONS.length) % REFLECTIONS.length] : s.quote === 'custom' ? s.quoteText : '';
    if (quoteText.trim()) {
        const quoteHeight = width * .12;
        textLines(quoteText, bottom - quoteHeight, width * .018, 4);
        bottom -= quoteHeight + width * .025;
    }
    if (s.view === 'countdown') {
        const range = countdownRange(s);
        const remaining = Math.max(0, range.end - civilDay(now));
        textLines(s.countdownTitle || 'Countdown', top, width * .026, 2);
        textLines(remaining === 0 ? 'Target reached' : remaining + (remaining === 1 ? ' day left' : ' days left'), top + width * .085, width * .022, 1);
        top += width * .15;
    }
    let areaWidth = (right - left) * s.scale / 100;
    if (s.screen === 'home' && s.placement === 'vertical') areaWidth *= .48;
    if (s.screen === 'home' && s.placement === 'corner') areaWidth *= .58;
    const areaHeight = bottom - top;
    const compact = s.screen === 'home' && s.placement === 'corner';
    const panelTop = compact ? top + areaHeight * .5 : top;
    const panelHeight = compact ? areaHeight * .5 : areaHeight;
    function panel(view, panelTop, panelHeight) {
        const { total, current, perYear } = timeUnits(s, now, view);
        const classic = s.grid === 'classic' && !['year', 'countdown'].includes(view);
        const split = classic && view === 'weeks' && s.midyear;
        const decade = classic && s.decades;
        const labelEvery = classic && s.ageLabels !== 'none' ? Number(s.ageLabels) : 0;
        const gutter = labelEvery ? width * .035 : 0;
        const gapRatio = .08 + s.spacing / 100;
        function dimensions(cols) {
            const rows = Math.ceil(total / cols);
            const xUnits = cols + (cols - 1) * gapRatio + (split ? 1 : 0);
            const yUnits = rows + (rows - 1) * gapRatio + (decade ? Math.floor((rows - 1) / 10) : 0);
            const size = Math.min((areaWidth - gutter) / xUnits, panelHeight * s.scale / 100 / yUnits) / 1.05;
            return { cols, rows, size, gridWidth: size * xUnits, gridHeight: size * yUnits };
        }
        const square = s.squareLifespan && !classic && !['year', 'countdown'].includes(view);
        let fitted = dimensions(square ? Math.sqrt(total) : perYear || 19);
        if (!classic && !square) {
            // Prefer a square grid. Only use a wider rectangle when its safe
            // area is too short for a width-filling square; never stretch cells.
            const targetAspect = Math.max(1, (areaWidth - gutter) / (panelHeight * s.scale / 100));
            let bestError = Infinity;
            for (let cols = 1; cols <= total; cols++) {
                const candidate = dimensions(cols);
                const error = Math.abs(Math.log(candidate.gridWidth / candidate.gridHeight / targetAspect));
                if (error < bestError - 1e-10 || (Math.abs(error - bestError) < 1e-10 && candidate.size > fitted.size)) {
                    fitted = candidate;
                    bestError = error;
                }
            }
        }
        // Expand only the horizontal gaps: retain marker size, row height,
        // and the extra half-year gap. The device's safe area stays reserved.
        let extraColumnGap = 0;
        if (classic && s.classicWidth !== 'natural' && fitted.cols > 1) {
            const weight = s.classicWidth === 'wide' ? .5 : 1;
            const spare = Math.max(0, areaWidth - gutter - fitted.gridWidth);
            extraColumnGap = spare * weight / (fitted.cols - 1);
            fitted.gridWidth += spare * weight;
        }
        const { cols, rows, size, gridHeight, gridWidth } = fitted;
        const fraction = s.position / 100;
        const x = s.screen === 'home' && s.placement === 'corner' ? left + gutter :
            left + (right - left - gridWidth - gutter) / 2 + gutter;
        const y = panelTop + (panelHeight - gridHeight) * fraction;
        for (let i = 0; i < total; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            addMark(x + size * (col * (1 + gapRatio) + (split && col >= 26 ? 1 : 0)) + col * extraColumnGap,
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
