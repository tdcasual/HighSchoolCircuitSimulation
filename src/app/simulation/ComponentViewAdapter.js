/**
 * Solver-backend wrap for the classroom tick.
 *
 * Classroom runtime is V2-only. runtimeOptions.solverBackend is not copied
 * onto the duck. Display reads ViewMap via resolveComponentViewRecord; wrap
 * does not copy onto live components and does not restore standby. wrap does not copy onto live
 * Do not add circuit.lastViewMap.
 */
export function wrapSolverBackend(backend, runtime) {
    void runtime;
    return backend;
}
