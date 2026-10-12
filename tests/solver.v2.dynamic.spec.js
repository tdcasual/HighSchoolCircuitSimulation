import { describe, expect, it } from 'vitest';
import {
    DynamicIntegrationMethods,
    resolveDynamicIntegrationMethod
} from '../src/v2/simulation/DynamicUpdateV2.js';
import { solveCircuitV2 } from '../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';

function rcDto(integrationMethod, extras = []) {
    return {
        meta: { version: 2 },
        nodes: [{ id: '0' }, { id: '1' }, { id: '2' }],
        components: [
            {
                id: 'V1',
                type: 'PowerSource',
                nodes: [1, 0],
                params: { voltage: 10, internalResistance: 0 }
            },
            {
                id: 'R1',
                type: 'Resistor',
                nodes: [1, 2],
                params: { resistance: 100 }
            },
            {
                id: 'C1',
                type: 'Capacitor',
                nodes: [2, 0],
                params: { capacitance: 0.001, integrationMethod }
            },
            ...extras
        ]
    };
}

function readCapVoltage(result) {
    return (result.voltages[2] || 0) - (result.voltages[0] || 0);
}

describe('SolveCircuitV2 dynamic integration', () => {
    it('uses backward-euler inrush on the first step then trapezoid on the second', () => {
        const dt = 0.01;
        const alpha = dt / (100 * 0.001);
        const vBeFirst = (alpha * 10) / (1 + alpha);
        const iBeFirst = (0.001 * vBeFirst) / dt;

        const beState = new SimulationStateV2();
        const beFirst = solveCircuitV2(rcDto('backward-euler'), beState, { dt });
        expect(beFirst.valid).toBe(true);
        expect(readCapVoltage(beFirst)).toBeCloseTo(vBeFirst, 6);
        expect(beFirst.currents.get('C1')).toBeCloseTo(iBeFirst, 6);

        const trapState = new SimulationStateV2();
        const trapFirst = solveCircuitV2(rcDto('trapezoidal'), trapState, { dt });
        expect(readCapVoltage(trapFirst)).toBeCloseTo(vBeFirst, 6);

        const beSecond = solveCircuitV2(rcDto('backward-euler'), beFirst.nextState, { dt });
        const trapSecond = solveCircuitV2(rcDto('trapezoidal'), trapFirst.nextState, { dt });
        expect(readCapVoltage(beSecond)).toBeCloseTo(1.7355371901, 6);
        expect(readCapVoltage(trapSecond)).toBeCloseTo(1.7748917749, 6);
        expect(readCapVoltage(trapSecond)).toBeGreaterThan(readCapVoltage(beSecond));
    });

    it('falls back to backward-euler when a switch is connected even if trapezoidal is requested', () => {
        const dt = 0.01;
        const dto = rcDto('trapezoidal', [
            {
                id: 'S1',
                type: 'Switch',
                nodes: [1, 0],
                params: { closed: false }
            }
        ]);
        const first = solveCircuitV2(dto, new SimulationStateV2(), { dt });
        const second = solveCircuitV2(dto, first.nextState, { dt });
        expect(readCapVoltage(second)).toBeCloseTo(1.7355371901, 6);
        expect(resolveDynamicIntegrationMethod(
            { type: 'Capacitor', integrationMethod: 'trapezoidal', dynamicHistoryReady: true },
            true,
            { dynamicHistoryReady: true }
        )).toBe(DynamicIntegrationMethods.BackwardEuler);
    });
});
