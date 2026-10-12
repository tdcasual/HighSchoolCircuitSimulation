import { describe, expect, it } from 'vitest';
import { ResultPostprocessorV2 } from '../src/v2/simulation/ResultPostprocessorV2.js';

describe('ResultPostprocessorV2', () => {
    it('keeps explicit numeric zero component ids when computing currents', () => {
        const currents = ResultPostprocessorV2.computeCurrents(
            [
                {
                    id: 0,
                    type: 'Resistor',
                    nodes: [1, 0],
                    resistance: 10
                }
            ],
            [0, 10],
            { dt: 0.01, simTime: 0 }
        );

        expect(currents.get('0')).toBeCloseTo(1, 12);
    });

    it('reports zero current for a resistor with a dangling terminal', () => {
        const currents = ResultPostprocessorV2.computeCurrents(
            [
                {
                    id: 'R1',
                    type: 'Resistor',
                    nodes: [1, -1],
                    resistance: 100
                }
            ],
            [0, 12],
            { dt: 0.01, simTime: 0 }
        );

        expect(currents.get('R1')).toBe(0);
    });

    it('uses the extra unknown as-is for a closed switch instead of deltaV/1e-9', () => {
        const currents = ResultPostprocessorV2.computeCurrents(
            [
                {
                    id: 'S1',
                    type: 'Switch',
                    nodes: [1, 0],
                    closed: true,
                    vsIndex: 0
                }
            ],
            [0, 1e-9],
            { dt: 0.01, simTime: 0, solveVector: [0, 0.6], nodeCount: 2 }
        );

        expect(currents.get('S1')).toBeCloseTo(0.6, 12);
    });

    it('negates ideal source and ammeter extra unknowns but not motor', () => {
        const solveVector = [0, 1.2, 0.3, 0.4];
        const currents = ResultPostprocessorV2.computeCurrents(
            [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    nodes: [1, 0],
                    internalResistance: 0,
                    vsIndex: 0
                },
                {
                    id: 'A1',
                    type: 'Ammeter',
                    nodes: [1, 0],
                    resistance: 0,
                    vsIndex: 1
                },
                {
                    id: 'M1',
                    type: 'Motor',
                    nodes: [1, 0],
                    resistance: 5,
                    vsIndex: 2
                }
            ],
            [0, 6],
            { dt: 0.01, simTime: 0, solveVector, nodeCount: 2 }
        );

        expect(currents.get('V1')).toBeCloseTo(-1.2, 12);
        expect(currents.get('A1')).toBeCloseTo(-0.3, 12);
        expect(currents.get('M1')).toBeCloseTo(0.4, 12);
    });
});

