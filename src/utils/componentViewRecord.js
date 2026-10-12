export function resolveComponentViewRecord(comp, viewMap) {
    if (!comp) return comp;
    const viewId = comp.id === undefined || comp.id === null ? '' : String(comp.id);
    const view = viewMap instanceof Map && viewId
        ? viewMap.get(viewId)
        : undefined;
    if (view == null || typeof view !== 'object') return comp;
    return {
        ...comp,
        currentValue: view.currentValue,
        voltageValue: view.voltageValue,
        powerValue: view.powerValue,
        voltageSegLeft: view.voltageSegLeft,
        voltageSegRight: view.voltageSegRight,
        brightness: view.brightness != null ? view.brightness : comp.brightness
    };
}
