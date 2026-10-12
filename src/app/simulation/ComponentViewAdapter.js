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

function hasOwn(source, key) {
    return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

function readNextStateEntry(nextState, id) {
    if (!nextState || typeof nextState.get !== 'function') return null;
    const entry = nextState.get(id);
    return entry && typeof entry === 'object' ? entry : null;
}

function copyDynamicsToV1Standby(circuit, result) {
    if (!circuit?.components) return;
    const sim = circuit.simulationState;
    const nextState = result?.nextState;
    let blownChanged = false;
    for (const [id, comp] of circuit.components) {
        const src = readNextStateEntry(nextState, id);
        if (!src) continue;
        const entry = typeof sim?.ensure === 'function' ? sim.ensure(id) : null;
        if (hasOwn(src, 'dynamicHistoryReady')) {
            const ready = !!src.dynamicHistoryReady;
            if (entry) entry._dynamicHistoryReady = ready;
            comp._dynamicHistoryReady = ready;
        }
        if (hasOwn(src, 'prevVoltage')) {
            if (entry) entry.prevVoltage = src.prevVoltage;
            comp.prevVoltage = src.prevVoltage;
        }
        if (hasOwn(src, 'prevCharge')) {
            if (entry) entry.prevCharge = src.prevCharge;
            comp.prevCharge = src.prevCharge;
        }
        if (hasOwn(src, 'prevCurrent')) {
            if (entry) entry.prevCurrent = src.prevCurrent;
            comp.prevCurrent = src.prevCurrent;
        }
        if (hasOwn(src, 'speed')) {
            if (entry) entry.speed = src.speed;
            comp.speed = src.speed;
        }
        if (hasOwn(src, 'backEmf')) {
            if (entry) entry.backEmf = src.backEmf;
            comp.backEmf = src.backEmf;
        }
        if (hasOwn(src, 'junctionVoltage') && entry) {
            entry.junctionVoltage = src.junctionVoltage;
        }
        if (hasOwn(src, 'junctionCurrent') && entry) {
            entry.junctionCurrent = src.junctionCurrent;
        }
        if (hasOwn(src, 'conducting')) {
            if (entry) entry.conducting = src.conducting;
            comp.conducting = src.conducting;
        }
        if (hasOwn(src, 'energized')) {
            if (entry) entry.energized = src.energized;
            comp.energized = src.energized;
        }
        if (hasOwn(src, 'i2tAccum')) {
            comp.i2tAccum = src.i2tAccum;
        }
        if (hasOwn(src, 'blown')) {
            if (comp.blown !== src.blown) blownChanged = true;
            comp.blown = src.blown;
        }
    }
    if (blownChanged) {
        circuit.markSolverCircuitDirty?.();
    }
}

function applySolverBackendRuntimeOptions(backend, runtime) {
    const options = runtime?.runtimeOptions;
    if (!backend || !options) return;
    const mode = options.solverBackend;
    if (mode === 'v1' || mode === 'v2' || mode === 'shadow') {
        backend.mode = mode;
    }
    if (options.shadowThrow) {
        backend.shadowThrow = true;
    }
}

export function wrapSolverBackend(backend, runtime) {
    if (!backend || typeof backend.solveFrame !== 'function') {
        return backend;
    }
    applySolverBackendRuntimeOptions(backend, runtime);
    const innerSolveFrame = backend.solveFrame.bind(backend);
    backend.solveFrame = (input) => {
        const result = innerSolveFrame(input);
        if (backend.mode === 'v2' && result?.valid) {
            applyViewMapToComponents(input?.circuit, result.viewMap);
            copyDynamicsToV1Standby(input?.circuit, result);
        }
        return result;
    };
    return backend;
}
