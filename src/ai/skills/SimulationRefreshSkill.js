/**
 * SimulationRefreshSkill.js
 * Run a non-intrusive one-shot solve to refresh component readouts.
 */

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export const SimulationRefreshSkill = {
    name: 'simulation_refresh',

    run(input = {}, context = {}) {
        const circuit = input.circuit || context.circuit;
        if (!circuit) {
            return {
                ok: false,
                refreshed: false,
                valid: false,
                reason: '缺少电路对象'
            };
        }

        try {
            if (typeof circuit.rebuildNodes === 'function') {
                circuit.rebuildNodes();
            }
            if (typeof circuit.ensureSolverPrepared === 'function') {
                circuit.ensureSolverPrepared();
            }

            const dt = Math.max(1e-6, safeNumber(circuit.dt, 0.01));
            const simTime = safeNumber(circuit.simTime, 0);
            const backend = circuit.solverBackend;
            const useBackend = !!backend && backend.mode !== 'v1' && typeof backend.solveFrame === 'function';
            const solver = circuit.solver;
            if (!useBackend && (!solver || typeof solver.solve !== 'function')) {
                return {
                    ok: false,
                    refreshed: false,
                    valid: false,
                    reason: '求解器不可用'
                };
            }

            const results = useBackend
                ? backend.solveFrame({ circuit, dt, simTime })
                : solver.solve(dt, simTime);
            circuit.lastResults = results;

            if (results && typeof results === 'object' && !results.runtimeDiagnostics) {
                if (typeof circuit.attachRuntimeDiagnostics === 'function') {
                    circuit.attachRuntimeDiagnostics(results, simTime);
                } else if (typeof circuit.collectRuntimeDiagnostics === 'function') {
                    results.runtimeDiagnostics = circuit.collectRuntimeDiagnostics(results, simTime);
                }
            }

            if (!useBackend && results?.valid && typeof solver.updateDynamicComponents === 'function') {
                solver.updateDynamicComponents(results.voltages, results.currents);
                circuit.simTime = simTime + dt;
            }

            return {
                ok: !!results?.valid,
                refreshed: true,
                valid: !!results?.valid,
                reason: results?.valid ? 'ok' : '求解失败'
            };
        } catch (error) {
            return {
                ok: false,
                refreshed: false,
                valid: false,
                reason: `刷新失败: ${error.message}`
            };
        }
    }
};
