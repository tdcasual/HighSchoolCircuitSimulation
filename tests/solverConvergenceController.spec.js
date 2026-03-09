import { describe, expect, it } from 'vitest';
import { SolverConvergenceController } from '../src/core/simulation/SolverConvergenceController.js';

describe('SolverConvergenceController', () => {
    it('shapes invalid stateful results with convergence metadata', () => {
        const controller = new SolverConvergenceController();
        const plan = controller.buildPlan([{ id: 'D1', type: 'Diode' }]);
        const state = controller.createSolveState(plan);

        state.completedIterations = plan.maxIterations;

        const result = controller.finalizeResult({ state, plan });

        expect(result.valid).toBe(false);
        expect(result.meta.converged).toBe(false);
        expect(result.meta.hasStateful).toBe(true);
        expect(result.meta.maxIterations).toBe(40);
        expect(result.meta.invalidReason).toBe('not_converged');
    });

    it('detects a near-short on a finite-resistance source from solved outputs', () => {
        const controller = new SolverConvergenceController();
        const detected = controller.detectPowerSourceShortCircuits({
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    nodes: [1, 0],
                    internalResistance: 1,
                    voltage: 10,
                    _isShorted: false
                }
            ],
            voltages: [0, 0.05],
            currents: new Map([['V1', 9.8]]),
            getSourceInstantVoltage: (component) => component.voltage
        });

        expect(detected).toBe(true);
    });
});
