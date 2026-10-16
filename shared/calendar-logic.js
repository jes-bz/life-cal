
/**
 * Constants for the calendar layout
 */
export const CONSTANTS = {
    CANVAS_WIDTH: 1320,
    CANVAS_HEIGHT: 2868,
    BASE_TOP_PCT: 0.25,
    BASE_BOTTOM_PCT: 0.10,
    TOP_WIDGET_ADDITION: 0.10,
    BOTTOM_WIDGET_ADDITION: 0.10,
    MARGIN_X_PCT: 0.04,
    GAP: 5,
    DEFAULT_COLS: 52
};

/** Native wallpaper sizes; Max preserves existing links.
 * Sources: apple.com/iphone-duo/specs/ and apple.com/iphone-18-pro/specs/
 */
export const DEVICES = {
    iphone: { label: 'iPhone / Pro', width: 1206, height: 2622 },
    max: { label: 'iPhone Max', width: 1320, height: 2868 },
    'duo-outer': { label: 'iPhone Duo · outer', width: 1398, height: 2034 },
    'duo-inner': { label: 'iPhone Duo · inner (portrait)', width: 1878, height: 2670 },
    'duo-inner-landscape': { label: 'iPhone Duo · inner (landscape)', width: 2670, height: 1878 }
};
export function getDevice(name = 'max') {
    return Object.hasOwn(DEVICES, name) ? DEVICES[name] : DEVICES.max;
}

/**
 * Calculates the weeks lived since birth.
 * @param {string} dob - Date of birth (YYYY-MM-DD)
 * @returns {number} Weeks lived
 */
export function getWeeksLived(dob, now = new Date()) {
    const birth = new Date(dob);
    const diffTime = Math.abs(now.getTime() - birth.getTime());
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
}

/**
 * Calculates the grid layout parameters.
 * @param {object} params
 * @param {number} params.width - Canvas/View width
 * @param {number} params.height - Canvas/View height
 * @param {string} params.dob - Date of birth
 * @param {number} params.years - Life expectancy in years
 * @param {string} params.layout - Layout mode ('none', 'top', 'bottom')
 * @returns {object} Layout calculations
 */
export function calculateLayout({ width, height, dob, years, layout, device = 'max', now = new Date() }) {
    const totalWeeks = years * 52;
    const livedWeeks = getWeeksLived(dob, now);

    const isDuo = device.startsWith('duo-');
    if (isDuo) layout = 'none'; // Duo always has the same right-side controls.
    let topPct = isDuo ? 0.35 : CONSTANTS.BASE_TOP_PCT;
    let bottomPct = isDuo ? 0.06 : CONSTANTS.BASE_BOTTOM_PCT;
    const rightInset = width * (layout === 'right' ? 0.32 : isDuo ? 0.22 : 0);

    if (layout === 'top') {
        topPct += CONSTANTS.TOP_WIDGET_ADDITION;
    } else if (layout === 'bottom') {
        bottomPct += CONSTANTS.BOTTOM_WIDGET_ADDITION;
    }

    const safeZoneTop = height * topPct;
    const safeZoneBottom = height * bottomPct;

    const marginX = width * CONSTANTS.MARGIN_X_PCT;
    const availableWidth = width - (marginX * 2) - rightInset;
    const gap = CONSTANTS.GAP;

    // Find the minimum columns needed to fit vertically
    let minFitCols = 0;
    let c = 52;

    // Safety break at 200
    while (c < 200) {
        const cellSize = (availableWidth - (gap * (c - 1))) / c;
        const rows = Math.ceil(totalWeeks / c);
        const gridHeight = (cellSize * rows) + (gap * (rows - 1));

        const extraTopH = 5 * (cellSize + gap);
        const extraBottomH = 6 * (cellSize + gap);

        const requiredHeight = gridHeight + (isDuo ? 0 : extraTopH + extraBottomH);
        const availableHeight = height - safeZoneTop - safeZoneBottom;

        if (requiredHeight <= availableHeight + 1) {
            minFitCols = c;
            break;
        }
        c++;
    }

    const cols = minFitCols || CONSTANTS.DEFAULT_COLS;
    const cellSize = (availableWidth - (gap * (cols - 1))) / cols;
    const rows = Math.ceil(totalWeeks / cols);
    const extraTopH = 0 * (cellSize + gap); 
    
    const finalGridWidth = (cellSize * cols) + (gap * (cols - 1));
    
    const gridHeight = (cellSize * rows) + (gap * (rows - 1));
    const startY = isDuo ? height - safeZoneBottom - gridHeight : safeZoneTop + extraTopH;
    const startX = (width - rightInset - finalGridWidth) / 2;

    return {
        cols,
        rows,
        cellSize,
        gap,
        startX,
        startY,
        totalWeeks,
        livedWeeks
    };
}

/**
 * Generates the data for all week rectangles.
 * @param {object} params - Same as calculateLayout, plus colors
 * @param {string} params.colorLived - Hex color for lived weeks
 * @param {string} params.colorRest - Hex color for remaining weeks
 * @returns {Array<{x: number, y: number, size: number, color: string}>} Array of rect objects
 */
export function generateRectData(params) {
    const layout = calculateLayout(params);
    const { cols, cellSize, gap, startX, startY, totalWeeks, livedWeeks } = layout;
    const { colorLived, colorRest } = params;

    // Every square in a column/row shares coordinates and size. Round once
    // per column/row instead of repeating string conversions for every week.
    const xs = Array.from({ length: cols }, (_, i) => Number((startX + i * (cellSize + gap)).toFixed(2)));
    const ys = Array.from({ length: Math.ceil(totalWeeks / cols) }, (_, i) => Number((startY + i * (cellSize + gap)).toFixed(2)));
    const size = Number(cellSize.toFixed(2));
    const rects = [];
    let currentWeek = 0;

    for (let i = 0; i < totalWeeks; i++) {
        currentWeek++;

        const colIndex = i % cols;
        const rowIndex = Math.floor(i / cols);

        rects.push({
            x: xs[colIndex],
            y: ys[rowIndex],
            size,
            color: currentWeek <= livedWeeks ? colorLived : colorRest
        });
    }

    return rects;
}
