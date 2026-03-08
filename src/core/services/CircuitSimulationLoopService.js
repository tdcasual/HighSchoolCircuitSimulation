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

        for (let index = 0; index < substepCount; index++) {
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
