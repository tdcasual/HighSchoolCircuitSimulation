import { limitJunctionStep, resolveJunctionParameters } from './JunctionModel.js';

const IDEAL_SOURCE_RESISTANCE_EPS = 1e-9;

export class SolverConvergenceController {
    setLogger(logger) {
        this.logger = logger || null;
    }

    createZeroResult({
        nodeCount,
        components,
        resultPostprocessor,
        dt,
        debugMode,
        resolveDynamicIntegrationMethod,
        getSourceInstantVoltage,
        simulationState,
        componentRegistry
    }) {
        const voltages = Array.from({ length: nodeCount }, () => 0);
        const { currents } = resultPostprocessor.apply({
            components,
            voltages,
            x: [],
            nodeCount,
            dt,
            debugMode,
            resolveDynamicIntegrationMethod,
            getSourceInstantVoltage,
            simulationState,
            registry: componentRegistry
        });

        return {
            voltages,
            currents,
            valid: true,
            meta: {
                converged: true,
                iterations: 0,
                maxIterations: 0
            }
        };
    }

    buildPlan(components = []) {
        const hasJunction = components.some((comp) => comp?.type === 'Diode' || comp?.type === 'LED');
        const hasRelay = components.some((comp) => comp?.type === 'Relay');
        const hasStateful = hasJunction || hasRelay;

        return {
            hasJunction,
            hasRelay,
            hasStateful,
            maxIterations: hasStateful ? 40 : 1,
            junctionTolerance: 1e-6
        };
    }

    createSolveState(plan = {}) {
        return {
            solvedVoltages: [],
            solvedCurrents: new Map(),
            solvedValid: false,
            converged: !plan.hasStateful,
            completedIterations: 0,
            invalidReason: '',
            maxJunctionDelta: 0,
            lastJunctionDelta: 0
        };
    }

    recordIteration(state, iterationIndex) {
        state.completedIterations = iterationIndex + 1;
    }

    recordSolvedState(state, voltages, currents) {
        state.solvedVoltages = voltages;
        state.solvedCurrents = currents;
        state.solvedValid = true;
    }

    markInvalid(state, reason) {
        state.invalidReason = reason;
        state.solvedValid = false;
    }

    settleIteration(state, plan, {
        voltages,
        currents,
        updateJunctionLinearizationState,
        updateRelayEnergizedStates,
        resetMatrixFactorizationCache
    } = {}) {
        if (!plan.hasStateful) {
            state.converged = true;
            return true;
        }

        let relayStateChanged = false;
        let junctionStateChanged = false;
        if (plan.hasJunction) {
            const junctionUpdate = updateJunctionLinearizationState?.(voltages, currents) || { changed: false, maxVoltageDelta: 0 };
            junctionStateChanged = junctionUpdate.changed;
            state.lastJunctionDelta = Number.isFinite(junctionUpdate.maxVoltageDelta)
                ? junctionUpdate.maxVoltageDelta
                : 0;
            state.maxJunctionDelta = Math.max(state.maxJunctionDelta, state.lastJunctionDelta);
        }
        if (plan.hasRelay) {
            relayStateChanged = !!updateRelayEnergizedStates?.(currents);
        }

        const junctionConverged = !plan.hasJunction || state.lastJunctionDelta <= plan.junctionTolerance;
        if (junctionConverged && !relayStateChanged) {
            state.converged = true;
            return true;
        }

        if (junctionStateChanged || relayStateChanged) {
            resetMatrixFactorizationCache?.();
        }

        return false;
    }

    finalizeResult({ state, plan }) {
        const valid = state.solvedValid && (!plan.hasStateful || state.converged);
        return {
            voltages: state.solvedVoltages,
            currents: state.solvedCurrents,
            valid,
            meta: {
                converged: !plan.hasStateful || state.converged,
                iterations: state.completedIterations,
                maxIterations: plan.maxIterations,
                hasStateful: plan.hasStateful,
                maxJunctionDelta: state.maxJunctionDelta,
                invalidReason: state.invalidReason || (valid ? '' : 'not_converged')
            }
        };
    }

    updateJunctionLinearizationState({ components = [], simulationState, voltages, currents }) {
        let changed = false;
        let maxVoltageDelta = 0;

        for (const comp of components) {
            if (!comp || (comp.type !== 'Diode' && comp.type !== 'LED')) continue;
            const entry = simulationState && comp.id ? simulationState.ensure(comp.id) : null;
            const nAnode = comp.nodes?.[0];
            const nCathode = comp.nodes?.[1];
            if (nAnode == null || nCathode == null || nAnode < 0 || nCathode < 0) continue;

            const vAk = (voltages[nAnode] || 0) - (voltages[nCathode] || 0);
            const previousLinearization = Number.isFinite(entry?.junctionVoltage)
                ? entry.junctionVoltage
                : (Number.isFinite(comp.junctionVoltage) ? comp.junctionVoltage : 0);
            const params = resolveJunctionParameters(comp);
            const nextLinearization = limitJunctionStep(vAk, previousLinearization, params);
            const junctionCurrent = Number(currents?.get(comp.id)) || 0;
            const displayCurrentThreshold = Math.max(1e-4, params.referenceCurrent * 0.02);
            const nextConducting = junctionCurrent >= displayCurrentThreshold
                || vAk >= params.forwardVoltage * 0.95;

            const delta = Math.abs(nextLinearization - previousLinearization);
            maxVoltageDelta = Math.max(maxVoltageDelta, delta);
            if (delta > 1e-9) {
                changed = true;
            }

            if (entry) {
                entry.junctionVoltage = nextLinearization;
                entry.junctionCurrent = junctionCurrent;
                entry.conducting = nextConducting;
            }
            comp.junctionVoltage = nextLinearization;
            comp.junctionCurrent = junctionCurrent;
            comp.conducting = nextConducting;
        }

        return { changed, maxVoltageDelta };
    }

    updateRelayEnergizedStates({ components = [], simulationState, currents }) {
        let changed = false;
        for (const comp of components) {
            if (!comp || comp.type !== 'Relay') continue;
            const entry = simulationState && comp.id ? simulationState.ensure(comp.id) : null;
            const pullIn = Math.max(1e-9, Number(comp.pullInCurrent) || 0.02);
            const dropOutRaw = Math.max(1e-9, Number(comp.dropOutCurrent) || pullIn * 0.5);
            const dropOut = Math.min(dropOutRaw, pullIn);
            const coilCurrentAbs = Math.abs(Number(currents?.get(comp.id)) || 0);

            const currentEnergized = entry && typeof entry.energized === 'boolean'
                ? entry.energized
                : !!comp.energized;
            const nextEnergized = currentEnergized
                ? coilCurrentAbs >= dropOut
                : coilCurrentAbs >= pullIn;

            if (entry) {
                entry.energized = nextEnergized;
            }
            if (nextEnergized !== !!comp.energized) {
                changed = true;
            }
            comp.energized = nextEnergized;
        }
        return changed;
    }

    detectPowerSourceShortCircuits({ components = [], voltages = [], currents, getSourceInstantVoltage }) {
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        const shortCurrentRatio = 0.95;
        const lowVoltageRatio = 0.05;
        const lowVoltageAbs = 0.05;

        for (const comp of components) {
            if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
            const n1 = comp.nodes?.[0];
            const n2 = comp.nodes?.[1];
            if (!isValidNode(n1) || !isValidNode(n2)) continue;

            if (comp._isShorted) {
                return true;
            }

            const internalResistance = Number(comp.internalResistance);
            if (!(Number.isFinite(internalResistance) && internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS)) {
                continue;
            }

            const sourceVoltage = getSourceInstantVoltage?.(comp) || 0;
            const sourceVoltageAbs = Math.abs(sourceVoltage);
            if (!(sourceVoltageAbs > 0)) continue;
            const shortCurrent = sourceVoltageAbs / internalResistance;
            if (!(shortCurrent > 0)) continue;

            const sourceCurrent = Math.abs(currents?.get(comp.id) || 0);
            const terminalVoltage = Math.abs((voltages[n1] || 0) - (voltages[n2] || 0));
            const voltageTol = Math.max(lowVoltageAbs, sourceVoltageAbs * lowVoltageRatio);
            if (sourceCurrent >= shortCurrent * shortCurrentRatio && terminalVoltage <= voltageTol) {
                return true;
            }
        }

        return false;
    }
}
