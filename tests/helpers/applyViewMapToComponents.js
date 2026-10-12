/** Test-only copy of ViewMap display fields onto live components. */
export function applyViewMapToComponents(circuit, viewMap) {
    if (!circuit?.components || !viewMap || typeof viewMap[Symbol.iterator] !== 'function') {
        return;
    }
    for (const [id, view] of viewMap) {
        const comp = circuit.components.get(id);
        if (!comp || !view || typeof view !== 'object') continue;
        comp.currentValue = view.currentValue;
        comp.voltageValue = view.voltageValue;
        comp.powerValue = view.powerValue;
        comp.voltageSegLeft = view.voltageSegLeft;
        comp.voltageSegRight = view.voltageSegRight;
        if (view.brightness != null) comp.brightness = view.brightness;
        if (view.conducting != null) comp.conducting = view.conducting;
        if (view.energized != null) comp.energized = view.energized;
        if (view.speed != null) comp.speed = view.speed;
        if (view.backEmf != null) comp.backEmf = view.backEmf;
        if (view.blown != null) comp.blown = view.blown;
        if (view.i2tAccum != null) comp.i2tAccum = view.i2tAccum;
    }
}
