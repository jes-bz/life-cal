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
    if (!Object.prototype.hasOwnProperty.call(DEVICES, settings.device)) {
        throw new Error('Unknown device.');
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
    const scene = generateDesign(settings);
    const { width, height } = scene;
    const context = new DrawContext();
    context.size = new Size(width, height);
    context.respectScreenScale = false;
    context.opaque = true;
    context.setFillColor(new Color(settings.bg));
    context.fillRect(new Rect(0, 0, width, height));
    const colors = {};
    for (const mark of scene.marks) {
        const key = mark.color + ':' + mark.opacity;
        const color = colors[key] || (colors[key] = new Color(mark.color, mark.opacity));
        context.setFillColor(color);
        const line = Math.min(mark.size * .2, Math.max(1, mark.size * .12));
        const inset = mark.outline ? line / 2 : 0;
        const rect = new Rect(mark.x + inset, mark.y + inset, mark.size - inset * 2, mark.size - inset * 2);
        if (mark.outline) { context.setStrokeColor(color); context.setLineWidth(line); }
        if (mark.shape === 'circle') {
            if (mark.outline) context.strokeEllipse(rect); else context.fillEllipse(rect);
        } else if (mark.shape === 'rounded') {
            const path = new Path(); path.addRoundedRect(rect, mark.size * .25, mark.size * .25);
            context.addPath(path);
            if (mark.outline) context.strokePath(); else context.fillPath();
        } else {
            if (mark.outline) context.strokeRect(rect); else context.fillRect(rect);
        }
    }
    for (const label of scene.labels) {
        context.setFont(Font.regularMonospacedSystemFont(label.fontSize));
        context.setTextColor(new Color(label.color));
        context.drawTextInRect(label.text, new Rect(label.x, label.y, label.width, label.height));
    }
    return Data.fromPNG(context.getImage()).toBase64String();
}
