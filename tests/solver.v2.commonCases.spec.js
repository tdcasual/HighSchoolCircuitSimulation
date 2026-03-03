import { describe, expect, it } from 'vitest';
import { solveCircuitV2 } from '../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';

describe('SolveCircuitV2 common electrical cases', () => {
    it('solves source-with-internal-resistance + resistor baseline case', () => {
        const dto = {
            meta: { version: 2 },
            nodes: [{ id: '0' }, { id: '1' }],
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    nodes: [1, 0],
                    params: {
                        voltage: 3,
                        internalResistance: 2
                    }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    nodes: [1, 0],
                    params: {
                        resistance: 8
                    }
                }
            ]
        };

        const result = solveCircuitV2(dto, new SimulationStateV2(), { dt: 0.01 });

        expect(result.valid).toBe(true);
        expect(result.voltages[1]).toBeCloseTo(2.4, 6);
        expect(result.currents.get('R1')).toBeCloseTo(0.3, 6);
    });
});
