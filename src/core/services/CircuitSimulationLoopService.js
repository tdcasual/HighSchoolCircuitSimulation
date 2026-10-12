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

const SHADOW_REL_TOL = 1e-3;
const SHADOW_ABS_TOL = 1e-6;
const SHADOW_SAMPLE_EVERY_N = 5;
const SHADOW_TIMEOUT_MS = 8;

function numericMismatch(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return true;
    const absolute = Math.abs(left - right);
    const scale = Math.max(Math.abs(left), Math.abs(right));
    const relative = scale === 0 ? 0 : absolute / scale;
    return relative > SHADOW_REL_TOL && absolute > SHADOW_ABS_TOL;
}

function readCurrent(currents, id) {
    if (currents instanceof Map) {
        if (!currents.has(id)) return { has: false, value: undefined };
        return { has: true, value: currents.get(id) };
    }
    if (currents && typeof currents === 'object' && Object.prototype.hasOwnProperty.call(currents, id)) {
        return { has: true, value: currents[id] };
    }
    return { has: false, value: undefined };
}

function countShadowMismatches(v1, v2, context) {
    let count = 0;
    const ids = new Set();
    if (v1?.currents instanceof Map) {
        for (const key of v1.currents.keys()) ids.add(key);
    } else if (v1?.currents && typeof v1.currents === 'object') {
        for (const key of Object.keys(v1.currents)) ids.add(key);
    }
    if (v2?.currents instanceof Map) {
        for (const key of v2.currents.keys()) ids.add(key);
    } else if (v2?.currents && typeof v2.currents === 'object') {
        for (const key of Object.keys(v2.currents)) ids.add(key);
    }
    if (context?.components) {
        for (const id of context.components.keys()) ids.add(id);
    }
    for (const id of ids) {
        const left = readCurrent(v1?.currents, id);
        const right = readCurrent(v2?.currents, id);
        if (!left.has || !right.has) {
            count += 1;
            continue;
        }
        if (numericMismatch(left.value, right.value)) count += 1;
    }
    if (context?.components) {
        for (const [, comp] of context.components) {
            const nodes = Array.isArray(comp?.nodes) ? comp.nodes : [];
            for (let index = 0; index < nodes.length; index += 1) {
                const nodeIndex = nodes[index];
                if (!Number.isInteger(nodeIndex) || nodeIndex < 0) continue;
                const leftHas = Array.isArray(v1?.voltages) && nodeIndex < v1.voltages.length;
                const rightHas = Array.isArray(v2?.voltages) && nodeIndex < v2.voltages.length;
                if (!leftHas || !rightHas) {
                    count += 1;
                    continue;
                }
                if (numericMismatch(v1.voltages[nodeIndex], v2.voltages[nodeIndex])) count += 1;
            }
        }
    }
    return count;
}

function noteAdaptive(current, candidate) {
    if (!candidate || getAdaptiveSeverity(current) >= getAdaptiveSeverity(candidate)) {
        return current;
    }
    return candidate;
}

function commitV1Substep(context, substepDt) {
    const substepResults = context.solver.solve(substepDt, context.simTime);
    if (!substepResults.valid) {
        return { substepResults, elapsedDt: 0 };
    }
    context.simTime += substepDt;
    context.solver.updateDynamicComponents(substepResults.voltages, substepResults.currents);
    context.syncSimulationStateToComponents();
    context.resultProjectionService?.updateFuseState?.(context, substepResults, substepDt);
    return { substepResults, elapsedDt: substepDt };
}

function sampleShadowFrame(backend, context, substepDt, startSimTime) {
    const started = globalThis.performance?.now?.();
    let v2 = null;
    try {
        v2 = backend.solveFrame({
            circuit: context,
            dt: substepDt,
            simTime: startSimTime
        });
    } catch (_) {
        backend.shadowErrorCount = (backend.shadowErrorCount || 0) + 1;
        return null;
    }
    const ended = globalThis.performance?.now?.();
    if (Number.isFinite(started) && Number.isFinite(ended) && (ended - started) > SHADOW_TIMEOUT_MS) {
        backend.shadowErrorCount = (backend.shadowErrorCount || 0) + 1;
        return null;
    }
    return v2;
}

function recordShadowCompare(backend, context, v1, v2) {
    if (!v2) return;
    backend.shadowCompareCount = (backend.shadowCompareCount || 0) + 1;
    const mismatches = countShadowMismatches(v1, v2, context);
    if (mismatches > 0) {
        backend.shadowMismatchCount = (backend.shadowMismatchCount || 0) + 1;
        if (backend.shadowThrow) {
            throw new Error('solver shadow mismatch');
        }
    }
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
        context.ensureSolverPrepared();
        context.solver.debugMode = context.debugMode;

        const stepDt = this.resolveSimulationStepDt(context);
        const substepCount = this.getSimulationSubstepCount(context, stepDt);
        const substepDt = stepDt / substepCount;
        let latestResults = null;
        let adaptiveDecisionResults = null;
        let elapsedDt = 0;
        const backend = context.solverBackend;
        const mode = backend?.mode;
        const useV1 = !backend || mode === 'v1';
        const shadowTick = !useV1 && mode === 'shadow'
            ? (Number(backend.shadowWallClockTick) || 0)
            : 0;
        let stepHadFallback = false;

        for (let index = 0; index < substepCount; index++) {
            if (useV1) {
                const substepResults = context.solver.solve(substepDt, context.simTime);
                latestResults = substepResults;
                if (!adaptiveDecisionResults || getAdaptiveSeverity(substepResults) >= getAdaptiveSeverity(adaptiveDecisionResults)) {
                    adaptiveDecisionResults = substepResults;
                }

                if (!substepResults.valid) {
                    break;
                }

                context.simTime += substepDt;
                elapsedDt += substepDt;
                context.solver.updateDynamicComponents(substepResults.voltages, substepResults.currents);
                context.syncSimulationStateToComponents();
                context.resultProjectionService?.updateFuseState?.(context, substepResults, substepDt);
                continue;
            }

            const startSimTime = context.simTime;
            if (mode === 'v2') {
                let result;
                try {
                    result = backend.solveFrame({
                        circuit: context,
                        dt: substepDt,
                        simTime: startSimTime
                    });
                } catch (_) {
                    result = { valid: false, voltages: [], currents: new Map() };
                }
                if (result?.valid) {
                    latestResults = result;
                    latestResults.backendUsed = 'v2';
                    adaptiveDecisionResults = noteAdaptive(result, adaptiveDecisionResults);
                    context.simTime += substepDt;
                    elapsedDt += substepDt;
                    continue;
                }
                backend.restoreStandby?.(context);
                context.solver.setCircuit(Array.from(context.components.values()), context.nodes);
                const committed = commitV1Substep(context, substepDt);
                latestResults = committed.substepResults;
                latestResults.backendUsed = 'v1';
                backend.fallbackCount = (backend.fallbackCount || 0) + 1;
                stepHadFallback = true;
                elapsedDt += committed.elapsedDt;
                adaptiveDecisionResults = noteAdaptive(committed.substepResults, adaptiveDecisionResults);
                if (!committed.substepResults.valid) {
                    break;
                }
                backend.commitStandbyFromCircuit?.(context);
                continue;
            }

            const sampleShadow = mode === 'shadow'
                && (shadowTick % SHADOW_SAMPLE_EVERY_N === 0)
                && index === 0;
            let shadowV2 = null;
            if (sampleShadow) {
                shadowV2 = sampleShadowFrame(backend, context, substepDt, startSimTime);
            }
            const committed = commitV1Substep(context, substepDt);
            latestResults = committed.substepResults;
            adaptiveDecisionResults = noteAdaptive(committed.substepResults, adaptiveDecisionResults);
            elapsedDt += committed.elapsedDt;
            if (sampleShadow) {
                recordShadowCompare(backend, context, committed.substepResults, shadowV2);
            }
            if (!committed.substepResults.valid) {
                break;
            }
        }

        if (mode === 'shadow') {
            backend.shadowWallClockTick = shadowTick + 1;
        }

        if (mode === 'v2') {
            if (stepHadFallback) {
                backend.consecutiveFallbackSteps = (backend.consecutiveFallbackSteps || 0) + 1;
            } else {
                backend.consecutiveFallbackSteps = 0;
            }
        }

        if (adaptiveDecisionResults) {
            context.updateAdaptiveTimeStep(adaptiveDecisionResults);
        }

        if (!latestResults) {
            latestResults = { voltages: [], currents: new Map(), valid: false };
        }

        return {
            lastResults: latestResults,
            stepDt,
            substepCount,
            substepDt,
            elapsedDt
        };
    }
}
