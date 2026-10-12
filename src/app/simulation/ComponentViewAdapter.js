/**
 * Copies ViewMap display fields onto live Circuit components.
 * Does not copy nodes / wire.nodeIndex / circuit.nodes.
 *
 * Sunset (do not delete this adapter before Renderer reads ViewMap):
 * 1. Renderer.setViewMap wired; buildValueDisplaySnapshot prefers ViewMap.
 * 2. MeasurementReadoutController / PropertyPanelController / ObservationSources /
 *    ObservationExportService read ViewMap or circuit.lastViewMap.
 * 3. Adapter call-count debug path at 0 for two release cycles can delete.
 * 4. Never delete the adapter before Renderer reads ViewMap (meters go to zero).
 */
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
        // 禁止: comp.nodes = ...; wire.nodeIndex = ...; circuit.nodes = ...
    }
}

export function wrapSolverBackend(backend, runtime) {
    if (!backend || typeof backend.solveFrame !== 'function') {
        return backend;
    }
    const options = runtime?.runtimeOptions;
    const mode = options?.solverBackend;
    if (mode === 'v1' || mode === 'v2' || mode === 'shadow') {
        backend.mode = mode;
    }
    if (options?.shadowThrow) {
        backend.shadowThrow = true;
    }
    const innerSolveFrame = backend.solveFrame.bind(backend);
    backend.solveFrame = (input) => {
        const result = innerSolveFrame(input);
        if (backend.mode === 'v2' && result?.valid) {
            applyViewMapToComponents(input?.circuit, result.viewMap);
            backend.restoreStandby?.(input?.circuit);
        }
        return result;
    };
    return backend;
}
