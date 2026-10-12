/**
 * Solver-backend wrap for the classroom tick.
 *
 * Sunset (do not delete wrapSolverBackend before KD20 fallback is gone):
 * 1. Renderer.setViewMap wired via RuntimeUiBridge.onCircuitUpdate on valid v2;
 *    cleared on V1/fallback/stop/clear/load. buildValueDisplaySnapshot prefers ViewMap.
 * 2. MeasurementReadoutController / PropertyPanelController / ObservationSources /
 *    ObservationExportService prefer ViewMap (renderer.viewMap or lastResults.viewMap)
 *    and fall back to live fields. CircuitExplainer uses the same overlay helper.
 * 3. wrapSolverBackend restores standby on valid v2. It does not copy ViewMap onto
 *    live components. Do not add circuit.lastViewMap.
 * 4. Never delete the adapter before Renderer reads ViewMap (meters go to zero)
 *    and those other readers leave live fields.
 */
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
            backend.restoreStandby?.(input?.circuit);
        }
        return result;
    };
    return backend;
}
