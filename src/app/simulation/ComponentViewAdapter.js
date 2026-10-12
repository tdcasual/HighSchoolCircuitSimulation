/**
 * Solver-backend wrap for the classroom tick.
 *
 * Applies runtimeOptions.solverBackend onto the injected duck. Display reads
 * ViewMap via resolveComponentViewRecord; wrap does not copy onto live
 * components and does not restore standby. Do not add circuit.lastViewMap.
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
    return backend;
}
