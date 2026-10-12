import { SimulationState } from '../simulation/SimulationState.js';

function getAdaptiveSeverity(results = {}) {
    const meta = results?.meta || {};
    const valid = results?.valid !== false;
    const converged = !!(valid && meta.converged !== false);
    const iterations = Number.isFinite(meta.iterations) ? meta.iterations : 0;
    const maxIterations = Number.isFinite(meta.maxIterations) ? meta.maxIterations : 0;
    const nearIterationLimit = maxIterations > 0 && iterations >= Math.max(3, maxIterations - 1);
    if (!converged || nearIterationLimit) {
        return 1_000_000 + iterations;
    }
    return iterations;
}

function noteAdaptive(current, candidate) {
    if (!candidate || getAdaptiveSeverity(current) >= getAdaptiveSeverity(candidate)) {
        return current;
    }
    return candidate;
}

function emptyFrameResult() {
    return { valid: false, voltages: [], currents: new Map(), backendUsed: 'v2' };
}

export class CircuitSimulationLoopService {
    getSimulationSubstepCount(context, stepDt = context?.dt) {
        const dt = Number.isFinite(stepDt) && stepDt > 0
            ? stepDt
            : (Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.01);
        const maxFrequency = context?.getMaxConnectedAcFrequencyHz?.() || 0;
        if (!Number.isFinite(maxFrequency) || maxFrequency <= 0) return 1;

        const samplesPerCycle = Math.max(4, Math.floor(context?.minAcSamplesPerCycle || 40));
        const maxSubsteps = Math.max(1, Math.floor(context?.maxAcSubstepsPerStep || 200));
        const requiredSubsteps = Math.ceil(dt * maxFrequency * samplesPerCycle);
        return Math.max(1, Math.min(maxSubsteps, requiredSubsteps));
    }

    resolveSimulationStepDt(context) {
        if (!context?.enableAdaptiveTimeStep) {
            const baseDt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.01;
            context.currentDt = baseDt;
            return baseDt;
        }
        const bounds = context.getAdaptiveDtBounds();
        const baseDt = Number.isFinite(bounds?.baseDt) && bounds.baseDt > 0 ? bounds.baseDt : 0.01;
        const minDt = Number.isFinite(bounds?.minDt) && bounds.minDt > 0 ? bounds.minDt : baseDt * 0.1;
        const maxDt = Number.isFinite(bounds?.maxDt) && bounds.maxDt > 0 ? bounds.maxDt : baseDt;
        const current = Number.isFinite(context.currentDt) && context.currentDt > 0
            ? context.currentDt
            : baseDt;
        context.currentDt = Math.max(minDt, Math.min(maxDt, current));
        return context.currentDt;
    }

    runStep(context) {
        const backend = context.solverBackend;
        context.solverCircuitDirty = false;
        context.solverPreparedTopologyVersion = context.topologyVersion;

        const stepDt = this.resolveSimulationStepDt(context);
        const substepCount = this.getSimulationSubstepCount(context, stepDt);
        const substepDt = stepDt / substepCount;
        let latestResults = null;
        let adaptiveDecisionResults = null;
        let elapsedDt = 0;

        for (let index = 0; index < substepCount; index++) {
            const startSimTime = context.simTime;
            let result = emptyFrameResult();
            if (backend && typeof backend.solveFrame === 'function') {
                try {
                    result = backend.solveFrame({
                        circuit: context,
                        dt: substepDt,
                        simTime: startSimTime
                    }) || emptyFrameResult();
                } catch (_) {
                    result = emptyFrameResult();
                }
            }
            if (result?.valid) {
                latestResults = result;
                latestResults.backendUsed = 'v2';
                adaptiveDecisionResults = noteAdaptive(result, adaptiveDecisionResults);
                context.simTime += substepDt;
                elapsedDt += substepDt;
                continue;
            }
            latestResults = {
                valid: false,
                voltages: Array.isArray(result?.voltages) ? result.voltages : [],
                currents: result?.currents instanceof Map ? result.currents : new Map(),
                backendUsed: 'v2',
                diagnostics: result?.diagnostics,
                meta: result?.meta
            };
            adaptiveDecisionResults = noteAdaptive(latestResults, adaptiveDecisionResults);
            break;
        }

        if (backend) {
            backend.consecutiveFallbackSteps = 0;
        }

        if (adaptiveDecisionResults) {
            context.updateAdaptiveTimeStep(adaptiveDecisionResults);
        }

        if (!latestResults) {
            latestResults = emptyFrameResult();
        }

        return {
            lastResults: latestResults,
            stepDt,
            substepCount,
            substepDt,
            elapsedDt
        };
    }

    ensureSolverPrepared() {
        return false;
    }

    getMaxConnectedAcFrequencyHz(context) {
        let maxFrequency = 0;
        for (const [id, comp] of context.components) {
            if (!comp || comp.type !== 'ACVoltageSource') continue;
            const frequency = Number(comp.frequency);
            if (!Number.isFinite(frequency) || frequency <= 0) continue;
            if (!context.isComponentConnected(id)) continue;
            if (frequency > maxFrequency) maxFrequency = frequency;
        }
        return maxFrequency;
    }

    getAdaptiveDtBounds(context) {
        const baseDt = Number.isFinite(context.dt) && context.dt > 0 ? context.dt : 0.01;
        const requestedMin = Number.isFinite(context.minAdaptiveDt) && context.minAdaptiveDt > 0
            ? context.minAdaptiveDt
            : baseDt * 0.1;
        const requestedMax = Number.isFinite(context.maxAdaptiveDt) && context.maxAdaptiveDt > 0
            ? context.maxAdaptiveDt
            : baseDt;
        const minDt = Math.min(requestedMin, requestedMax);
        const maxDt = Math.max(requestedMin, requestedMax);
        return { minDt, maxDt, baseDt };
    }

    resetAdaptiveTimeStepState(context) {
        const { minDt, maxDt, baseDt } = context.getAdaptiveDtBounds();
        context.currentDt = Math.max(minDt, Math.min(maxDt, baseDt));
        context._adaptiveEaseStreak = 0;
    }

    updateAdaptiveTimeStep(context, results) {
        if (!context.enableAdaptiveTimeStep) return;

        const { minDt, maxDt } = context.getAdaptiveDtBounds();
        const shrinkFactorRaw = Number(context.adaptiveDtShrinkFactor);
        const growFactorRaw = Number(context.adaptiveDtGrowFactor);
        const shrinkFactor = Number.isFinite(shrinkFactorRaw) && shrinkFactorRaw > 0
            ? shrinkFactorRaw
            : 0.5;
        const growFactor = Number.isFinite(growFactorRaw) && growFactorRaw > 1
            ? growFactorRaw
            : 1.5;
        const easeIterationThreshold = Math.max(
            1,
            Math.floor(Number.isFinite(context.adaptiveEaseIterationThreshold) ? context.adaptiveEaseIterationThreshold : 2)
        );
        const easeStreakToGrow = Math.max(
            1,
            Math.floor(Number.isFinite(context.adaptiveEaseStreakToGrow) ? context.adaptiveEaseStreakToGrow : 3)
        );

        const meta = results?.meta || {};
        const converged = !!(results?.valid && meta.converged !== false);
        const iterations = Number.isFinite(meta.iterations) ? meta.iterations : 0;
        const maxIterations = Number.isFinite(meta.maxIterations) ? meta.maxIterations : 0;
        const nearIterationLimit = maxIterations > 0 && iterations >= Math.max(3, maxIterations - 1);
        const hardSolve = !converged || nearIterationLimit;

        if (hardSolve) {
            context.currentDt = Math.max(minDt, context.currentDt * shrinkFactor);
            context._adaptiveEaseStreak = 0;
            return;
        }

        const easySolve = iterations > 0 && iterations <= easeIterationThreshold;
        if (easySolve) {
            context._adaptiveEaseStreak += 1;
            if (context._adaptiveEaseStreak >= easeStreakToGrow) {
                context.currentDt = Math.min(maxDt, context.currentDt * growFactor);
                context._adaptiveEaseStreak = 0;
            }
        } else {
            context._adaptiveEaseStreak = 0;
        }

        context.currentDt = Math.max(minDt, Math.min(maxDt, context.currentDt));
    }

    prepareSimulation(context) {
        if (context.isRunning) return;

        context.isRunning = true;
        context.simTime = 0;
        context.resetAdaptiveTimeStepState();
        context.resetSimulationState();

        for (const [_id, comp] of context.components) {
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                comp.prevVoltage = 0;
                comp.prevCharge = 0;
                comp.prevCurrent = 0;
                comp._dynamicHistoryReady = false;
            }
            if (comp.type === 'Inductor') {
                const initialCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
                comp.prevCurrent = initialCurrent;
                comp.prevVoltage = 0;
                comp._dynamicHistoryReady = false;
            }
            if (comp.type === 'Motor') {
                comp.speed = 0;
                comp.backEmf = 0;
            }
            if (comp.type === 'Fuse' && !comp.blown) {
                comp.i2tAccum = 0;
            }
            if (comp.type === 'Diode' || comp.type === 'LED') {
                comp.conducting = false;
                if (comp.type === 'LED') {
                    comp.brightness = 0;
                }
            }
            if (comp.type === 'Relay') {
                comp.energized = false;
            }
        }

        context.solverCircuitDirty = false;
        context.solverPreparedTopologyVersion = context.topologyVersion;
    }

    resetSimulationState(context) {
        context.simulationState = new SimulationState();
        context.simulationState.resetForComponents(Array.from(context.components.values()));
        context.solverBackend?.reset?.();
    }

    syncSimulationStateToComponents(context) {
        if (!context?.simulationState || typeof context.simulationState.get !== 'function') return;
        for (const comp of context.components.values()) {
            const entry = context.simulationState.get(comp.id);
            if (!entry) continue;
            if (comp.type === 'Diode' || comp.type === 'LED') {
                comp.conducting = !!entry.conducting;
            }
            if (comp.type === 'Relay') {
                comp.energized = !!entry.energized;
            }
            if (comp.type === 'Motor') {
                if (Number.isFinite(entry.backEmf)) {
                    comp.backEmf = entry.backEmf;
                }
                if (Number.isFinite(entry.speed)) {
                    comp.speed = entry.speed;
                }
            }
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor' || comp.type === 'Inductor') {
                if (Number.isFinite(entry.prevCurrent)) comp.prevCurrent = entry.prevCurrent;
                if (Number.isFinite(entry.prevVoltage)) comp.prevVoltage = entry.prevVoltage;
                if (Number.isFinite(entry.prevCharge)) comp.prevCharge = entry.prevCharge;
                if (typeof entry._dynamicHistoryReady === 'boolean') {
                    comp._dynamicHistoryReady = entry._dynamicHistoryReady;
                }
            }
        }
    }

    haltSimulation(context) {
        context.isRunning = false;
    }

    resetRuntimeCaches(context) {
        context.haltSimulation();
        context.nodes = [];
        context.netlist = null;
        context.lastResults = null;
        context.simTime = 0;
        context.currentDt = context.dt;
        context._adaptiveEaseStreak = 0;
        context.terminalConnectionMap = new Map();
        context._wireFlowCache = { version: null, map: new Map() };
        context.shortedPowerNodes = new Set();
        context.shortedSourceIds = new Set();
        context.shortedWireIds = new Set();
        context.shortCircuitCacheVersion = null;
        context.topologyBatchDepth = 0;
        context.topologyRebuildPending = false;
        context.topologyVersion = 0;
        context.topologyReplacementByRemovedId = {};
        context.simulationStepId = 0;
        context.solverPreparedTopologyVersion = -1;
        context.solverCircuitDirty = true;
        context.componentTerminalTopologyKeys = new Map();
        context.terminalWorldPosCache = new Map();
        context.simulationState = new SimulationState();
        context.solverBackend?.reset?.();
    }
}
