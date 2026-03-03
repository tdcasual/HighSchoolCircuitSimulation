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
            new Map(),
            { dt: 0.01, simTime: 0 }
        );

        expect(currents.get('0')).toBeCloseTo(1, 12);
    });
});
