import { describe, expect, it } from 'vitest';
import {
    buildSystemMatrixCacheKey,
    factorize,
    solveWithFactorization
} from '../src/v2/simulation/LinearAlgebraV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';

describe('LinearAlgebraV2', () => {
    it('includes junction voltage and integration method in the LU cache key', () => {
        const diode = { id: 'D1', type: 'Diode', nodes: [1, 0] };
        const capacitor = {
            id: 'C1',
            type: 'Capacitor',
            nodes: [1, 0],
            capacitance: 0.001
        };
        const stateA = new SimulationStateV2();
        stateA.ensure(diode);
        stateA.applyPatch('D1', { junctionVoltage: 0 });
        const stateB = new SimulationStateV2();
        stateB.ensure(diode);
        stateB.applyPatch('D1', { junctionVoltage: 0.7 });

        const keyVj0 = buildSystemMatrixCacheKey({
            nodeCount: 2,
            voltageSourceCount: 0,
            components: [diode],
            simulationState: stateA
        });
        const keyVjKnee = buildSystemMatrixCacheKey({
            nodeCount: 2,
            voltageSourceCount: 0,
            components: [diode],
            simulationState: stateB
        });
        expect(keyVj0).toContain('vj:');
        expect(keyVj0).not.toBe(keyVjKnee);

        const keyBe = buildSystemMatrixCacheKey({
            nodeCount: 2,
            voltageSourceCount: 0,
            dt: 0.01,
            components: [capacitor],
            resolveDynamicIntegrationMethod: () => 'backward-euler'
        });
        const keyTrap = buildSystemMatrixCacheKey({
            nodeCount: 2,
            voltageSourceCount: 0,
            dt: 0.01,
            components: [capacitor],
            resolveDynamicIntegrationMethod: () => 'trapezoidal'
        });
        expect(keyBe).toContain('method:backward-euler');
        expect(keyTrap).toContain('method:trapezoidal');
        expect(keyBe).not.toBe(keyTrap);
    });

    it('reuses one factorization for unchanged A with a different right-hand side', () => {
        const A = [
            [2, -1],
            [-1, 2]
        ];
        const factorization = factorize(A);
        expect(factorization).toBeTruthy();

        const x1 = solveWithFactorization(factorization, [1, 0]);
        const x2 = solveWithFactorization(factorization, [0, 1]);
        expect(x1[0]).toBeCloseTo(2 / 3, 12);
        expect(x1[1]).toBeCloseTo(1 / 3, 12);
        expect(x2[0]).toBeCloseTo(1 / 3, 12);
        expect(x2[1]).toBeCloseTo(2 / 3, 12);

        const again = solveWithFactorization(factorization, [1, 0]);
        expect(again).toEqual(x1);
    });
});
