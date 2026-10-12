import { SimulationStateV2 } from '../simulation/SimulationStateV2.js';
import { snapshotCircuitModel } from '../simulation/snapshotCircuitModel.js';
import { runSimulationStepV2 } from './usecases/RunSimulationStepV2.js';

export const DEFAULT_SOLVER_BACKEND_MODE = 'v2';

const ALLOWED_MODES = new Set(['v1', 'v2', 'shadow']);

function normalizeMode(raw) {
    const text = String(raw || '').trim().toLowerCase();
    return ALLOWED_MODES.has(text) ? text : DEFAULT_SOLVER_BACKEND_MODE;
}

function emptySolveResult() {
    return {
        valid: false,
        voltages: [],
        currents: new Map(),
        backendUsed: 'v2'
    };
}

function hasOwn(source, key) {
    return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

function readStateEntry(state, id) {
    if (!state || typeof state.get !== 'function') return null;
    const entry = state.get(id);
    return entry && typeof entry === 'object' ? entry : null;
}

function captureStandby(nextState, circuit) {
    const standby = new Map();
    if (!circuit?.components) return standby;
    for (const [id, comp] of circuit.components) {
        const src = readStateEntry(nextState, id) || {};
        const snap = {};
        if (hasOwn(src, 'dynamicHistoryReady')) {
            snap._dynamicHistoryReady = !!src.dynamicHistoryReady;
        } else if (hasOwn(src, '_dynamicHistoryReady')) {
            snap._dynamicHistoryReady = !!src._dynamicHistoryReady;
        }
        if (hasOwn(src, 'prevVoltage')) snap.prevVoltage = src.prevVoltage;
        if (hasOwn(src, 'prevCharge')) snap.prevCharge = src.prevCharge;
        if (hasOwn(src, 'prevCurrent')) snap.prevCurrent = src.prevCurrent;
        if (hasOwn(src, 'speed')) snap.speed = src.speed;
        if (hasOwn(src, 'backEmf')) snap.backEmf = src.backEmf;
        if (hasOwn(src, 'junctionVoltage')) snap.junctionVoltage = src.junctionVoltage;
        if (hasOwn(src, 'junctionCurrent')) snap.junctionCurrent = src.junctionCurrent;
        if (hasOwn(src, 'conducting')) snap.conducting = src.conducting;
        if (hasOwn(src, 'energized')) snap.energized = src.energized;
        if (hasOwn(src, 'i2tAccum')) snap.i2tAccum = src.i2tAccum;
        if (hasOwn(src, 'blown')) snap.blown = src.blown;
        if (comp?.type === 'Fuse') {
            if (!hasOwn(snap, 'i2tAccum') && Number.isFinite(comp.i2tAccum)) {
                snap.i2tAccum = comp.i2tAccum;
            }
            if (!hasOwn(snap, 'blown') && typeof comp.blown === 'boolean') {
                snap.blown = comp.blown;
            }
        }
        if (Object.keys(snap).length > 0) {
            standby.set(id, snap);
        }
    }
    return standby;
}

function writeStandbyEntry(entry, comp, snap) {
    if (!snap) return false;
    let blownChanged = false;
    if (hasOwn(snap, '_dynamicHistoryReady')) {
        if (entry) entry._dynamicHistoryReady = snap._dynamicHistoryReady;
        if (comp) comp._dynamicHistoryReady = snap._dynamicHistoryReady;
    }
    if (hasOwn(snap, 'prevVoltage')) {
        if (entry) entry.prevVoltage = snap.prevVoltage;
        if (comp) comp.prevVoltage = snap.prevVoltage;
    }
    if (hasOwn(snap, 'prevCharge')) {
        if (entry) entry.prevCharge = snap.prevCharge;
        if (comp) comp.prevCharge = snap.prevCharge;
    }
    if (hasOwn(snap, 'prevCurrent')) {
        if (entry) entry.prevCurrent = snap.prevCurrent;
        if (comp) comp.prevCurrent = snap.prevCurrent;
    }
    if (hasOwn(snap, 'speed')) {
        if (entry) entry.speed = snap.speed;
        if (comp) comp.speed = snap.speed;
    }
    if (hasOwn(snap, 'backEmf')) {
        if (entry) entry.backEmf = snap.backEmf;
        if (comp) comp.backEmf = snap.backEmf;
    }
    if (hasOwn(snap, 'junctionVoltage') && entry) {
        entry.junctionVoltage = snap.junctionVoltage;
    }
    if (hasOwn(snap, 'junctionCurrent') && entry) {
        entry.junctionCurrent = snap.junctionCurrent;
    }
    if (hasOwn(snap, 'conducting')) {
        if (entry) entry.conducting = snap.conducting;
        if (comp) comp.conducting = snap.conducting;
    }
    if (hasOwn(snap, 'energized')) {
        if (entry) entry.energized = snap.energized;
        if (comp) comp.energized = snap.energized;
    }
    if (hasOwn(snap, 'i2tAccum') && comp) {
        comp.i2tAccum = snap.i2tAccum;
    }
    if (hasOwn(snap, 'blown') && comp) {
        if (comp.blown !== snap.blown) blownChanged = true;
        comp.blown = snap.blown;
    }
    return blownChanged;
}

export function createInjectedSolverBackend(options = {}) {
    let simulationState = new SimulationStateV2();
    let shadowState = new SimulationStateV2();
    let cachedSnapshot = null;
    let cachedTopologyVersion = null;
    let cachedStepId = null;
    let standbyById = new Map();

    const backend = {
        mode: normalizeMode(options.mode),
        fallbackCount: 0,
        consecutiveFallbackSteps: 0,
        fellBackThisStep: false,
        shadowThrow: !!options.shadowThrow,
        shadowCompareCount: 0,
        shadowMismatchCount: 0,
        shadowErrorCount: 0,
        shadowWallClockTick: 0
    };

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
        const useShadow = backend.mode === 'shadow';
        const state = useShadow ? shadowState : simulationState;

        try {
            const snapshot = getCachedSnapshot(circuit);
            const step = runSimulationStepV2({
                circuitModel: snapshot,
                simulationState: state,
                options: {
                    dt: stepDt,
                    simTime: stepTime
                }
            });
            const solveResult = step?.solveResult;
            const valid = !!solveResult?.valid;
            if (valid) {
                if (useShadow) {
                    shadowState = step.nextState || shadowState;
                } else {
                    simulationState = step.nextState || simulationState;
                    standbyById = captureStandby(step.nextState, circuit);
                }
            }
            return {
                valid,
                voltages: Array.isArray(solveResult?.voltages) ? solveResult.voltages : [],
                currents: solveResult?.currents instanceof Map ? solveResult.currents : new Map(),
                backendUsed: 'v2',
                nextState: step?.nextState,
                viewMap: step?.projection?.viewMap,
                diagnostics: solveResult?.diagnostics
            };
        } catch (_) {
            return emptySolveResult();
        }
    };

    backend.restoreStandby = function restoreStandby(circuit) {
        if (!circuit?.components || standbyById.size === 0) return;
        const sim = circuit.simulationState;
        let blownChanged = false;
        for (const [id, snap] of standbyById) {
            const comp = circuit.components.get(id);
            const entry = typeof sim?.ensure === 'function' ? sim.ensure(id) : (sim?.get?.(id) || null);
            if (writeStandbyEntry(entry, comp, snap)) {
                blownChanged = true;
            }
        }
        if (blownChanged) {
            circuit.markSolverCircuitDirty?.();
        }
    };

    backend.reset = function reset() {
        simulationState = new SimulationStateV2();
        shadowState = new SimulationStateV2();
        cachedSnapshot = null;
        cachedTopologyVersion = null;
        cachedStepId = null;
        standbyById = new Map();
        backend.fallbackCount = 0;
        backend.consecutiveFallbackSteps = 0;
        backend.fellBackThisStep = false;
        backend.shadowCompareCount = 0;
        backend.shadowMismatchCount = 0;
        backend.shadowErrorCount = 0;
        backend.shadowWallClockTick = 0;
    };

    return backend;
}
