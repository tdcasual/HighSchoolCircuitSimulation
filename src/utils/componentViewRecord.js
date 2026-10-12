const VIEW_NUMBERS = [
    'currentValue',
    'voltageValue',
    'powerValue',
    'brightness',
    'speed',
    'backEmf',
    'i2tAccum',
    'prevCharge',
    'prevVoltage',
    'prevCurrent'
];

const VIEW_FLAGS = ['conducting', 'energized', 'blown'];

export function resolveComponentViewRecord(comp, viewMap) {
    if (!comp) return comp;
    if (!(viewMap instanceof Map)) return comp;
    const viewId = comp.id === undefined || comp.id === null ? '' : String(comp.id);
    const view = viewId ? viewMap.get(viewId) : undefined;
    if (view == null || typeof view !== 'object') {
        return {
            ...comp,
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0
        };
    }
    const overlay = { ...comp };
    for (const key of VIEW_NUMBERS) {
        if (view[key] !== undefined) overlay[key] = view[key];
    }
    overlay.voltageSegLeft = view.voltageSegLeft;
    overlay.voltageSegRight = view.voltageSegRight;
    for (const key of VIEW_FLAGS) {
        if (typeof view[key] === 'boolean') overlay[key] = view[key];
    }
    return overlay;
}
