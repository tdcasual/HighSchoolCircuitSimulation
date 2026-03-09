import { describe, expect, it } from 'vitest';
import { buildSystemMatrixCacheKey } from '../src/core/simulation/SolverMatrixCacheKeyBuilder.js';
import { SimulationState } from '../src/core/simulation/SimulationState.js';

describe('SolverMatrixCacheKeyBuilder', () => {
    it('captures matrix-shaping component state without mutating sources', () => {
        const acSource = {
            id: 'VAC1',
            type: 'ACVoltageSource',
            nodes: [1, 0],
            vsIndex: 0,
            rmsVoltage: 12,
            frequency: 50,
            phase: 0,
            offset: 1,
            internalResistance: 0
        };
        const capacitor = {
            id: 'C1',
            type: 'Capacitor',
            nodes: [1, 0],
            capacitance: 0.001
        };

        const key = buildSystemMatrixCacheKey({
            nodeCount: 2,
            voltageSourceCount: 1,
            gmin: 1e-12,
            dt: 0.001,
            hasConnectedSwitch: false,
            components: [acSource, capacitor],
            resolveDynamicIntegrationMethod: (component) => component.type === 'Capacitor' ? 'trapezoidal' : 'backward-euler'
        });

        expect(key).toContain('type:ACVoltageSource');
        expect(key).toContain('rInt:0.00000000000');
        expect(key).toContain('type:Capacitor');
        expect(key).toContain('method:trapezoidal');
        expect(acSource).not.toHaveProperty('instantaneousVoltage');
    });

    it('incorporates nonlinear junction simulation state into the cache key', () => {
        const simulationState = new SimulationState();
        Object.assign(simulationState.ensure('D1'), {
            junctionVoltage: 0.68,
            junctionCurrent: 0.012
        });

        const key = buildSystemMatrixCacheKey({
            nodeCount: 2,
            voltageSourceCount: 0,
            gmin: 1e-12,
            dt: 0.001,
            hasConnectedSwitch: false,
            components: [{
                id: 'D1',
                type: 'Diode',
                nodes: [1, 0]
            }],
            simulationState,
            resolveDynamicIntegrationMethod: () => 'backward-euler'
        });

        expect(key).toContain('type:Diode');
        expect(key).toContain('vj:0.680000000000');
        expect(key).toContain('ij:0.0120000000000');
    });
});
