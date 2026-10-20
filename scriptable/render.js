// Bundled with calendar-logic.js by build.mjs. No network or file access.
function renderWallpaper(input) {
    const options = typeof input === 'string' ? JSON.parse(input) : input;
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new Error('Pass a Life Calendar settings dictionary as the parameter.');
    }
    const settings = Object.assign({
        device: 'iphone', years: 90, layout: 'none',
        bg: '#000000', lived: '#ffffff', rest: '#333333'
    }, options);
    if (typeof settings.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(settings.dob)) {
        throw new Error('Birth date must be YYYY-MM-DD.');
    }
    const birth = new Date(settings.dob + 'T00:00:00.000Z');
    if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== settings.dob) {
        throw new Error('Birth date must be a real calendar date.');
    }
    if (!Object.prototype.hasOwnProperty.call(DEVICES, settings.device)) {
        throw new Error('Unknown device.');
    }
    settings.years = Number(settings.years);
    if (!Number.isInteger(settings.years) || settings.years < 1 || settings.years > 120) {
        throw new Error('Life expectancy must be a whole number from 1 to 120.');
    }
    if (!['none', 'top', 'bottom', 'right'].includes(settings.layout)) {
        throw new Error('Unknown layout.');
    }
    for (const key of ['bg', 'lived', 'rest']) {
        if (typeof settings[key] !== 'string' || !/^#?[a-f\d]{6}$/i.test(settings[key])) {
            throw new Error('Colors must contain six hexadecimal digits.');
        }
        settings[key] = '#' + settings[key].replace(/^#/, '');
    }
    const { width, height } = getDevice(settings.device);
    const context = new DrawContext();
    context.size = new Size(width, height);
    context.respectScreenScale = false;
    context.opaque = true;
    context.setFillColor(new Color(settings.bg));
    context.fillRect(new Rect(0, 0, width, height));
    const colors = {};
    for (const rect of generateRectData({
        ...settings, width, height,
        colorLived: settings.lived, colorRest: settings.rest
    })) {
        if (!colors[rect.color]) colors[rect.color] = new Color(rect.color);
        context.setFillColor(colors[rect.color]);
        context.fillRect(new Rect(rect.x, rect.y, rect.size, rect.size));
    }
    return Data.fromPNG(context.getImage()).toBase64String();
}
