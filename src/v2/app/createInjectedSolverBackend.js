import { SimulationStateV2 } from '../simulation/SimulationStateV2.js';
import { snapshotCircuitModel } from '../simulation/snapshotCircuitModel.js';
import { runSimulationStepV2 } from './usecases/RunSimulationStepV2.js';

export const DEFAULT_SOLVER_BACKEND_MODE = 'v2';

function emptySolveResult() {
    return {
        valid: false,
        voltages: [],
        currents: new Map(),
        backendUsed: 'v2'
    };
}

export function createInjectedSolverBackend(options = {}) {
    let simulationState = new SimulationStateV2();
    let cachedSnapshot = null;
    let cachedTopologyVersion = null;
    let cachedStepId = null;

    const backend = {
        mode: DEFAULT_SOLVER_BACKEND_MODE,
        fallbackCount: 0,
        consecutiveFallbackSteps: 0
    };
    void options;

    function getCachedSnapshot(circuit) {
        const topologyVersion = Number.isInteger(circuit?.topologyVersion) ? circuit.topologyVersion : 0;
        const stepId = Number.isInteger(circuit?.simulationStepId) ? circuit.simulationStepId : -1;
        const dirty = !!circuit?.solverCircuitDirty;
        const running = !!circuit?.isRunning;
        if (
            running
            && !dirty
            && cachedSnapshot
            && cachedTopologyVersion === topologyVersion
            && cachedStepId === stepId
        ) {
            return cachedSnapshot;
        }
        cachedSnapshot = snapshotCircuitModel(circuit);
        cachedTopologyVersion = topologyVersion;
        cachedStepId = stepId;
        return cachedSnapshot;
    }

    backend.solveFrame = function solveFrame({ circuit, dt, simTime } = {}) {
        if (!circuit) return emptySolveResult();
        const stepDt = Number.isFinite(dt) && dt > 0
            ? dt
            : (Number.isFinite(circuit.dt) && circuit.dt > 0 ? circuit.dt : 0.01);
        const stepTime = Number.isFinite(simTime) ? simTime : (Number.isFinite(circuit.simTime) ? circuit.simTime : 0);

        try {
            const snapshot = getCachedSnapshot(circuit);
            const step = runSimulationStepV2({
                circuitModel: snapshot,
                simulationState,
                options: {
                    dt: stepDt,
                    simTime: stepTime
                }
            });
            const solveResult = step?.solveResult;
            const valid = !!solveResult?.valid;
            if (valid) {
                simulationState = step.nextState || simulationState;
            }
            return {
                valid,
                voltages: Array.isArray(solveResult?.voltages) ? solveResult.voltages : [],
                currents: solveResult?.currents instanceof Map ? solveResult.currents : new Map(),
                backendUsed: 'v2',
                nextState: step?.nextState,
                viewMap: step?.projection?.viewMap,
                diagnostics: solveResult?.diagnostics,
                meta: solveResult?.meta
            };
        } catch (_) {
            return emptySolveResult();
        }
    };

    backend.reset = function reset() {
        simulationState = new SimulationStateV2();
        cachedSnapshot = null;
        cachedTopologyVersion = null;
        cachedStepId = null;
        backend.fallbackCount = 0;
        backend.consecutiveFallbackSteps = 0;
    };

    return backend;
}
