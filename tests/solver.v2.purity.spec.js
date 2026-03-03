import { describe, expect, it } from 'vitest';
import { solveCircuitV2 } from '../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';

describe('SolveCircuitV2 purity contract', () => {
    it('accepts DTO + state + options and does not mutate source-bearing DTO input', () => {
        const leakedSource = { marker: 'legacy-source', touched: false };
        const dto = {
            meta: { version: 2 },
            nodes: [{ id: '0' }, { id: '1' }],
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    nodes: [1, 0],
                    params: { voltage: 3, internalResistance: 2 },
                    source: leakedSource
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    nodes: [1, 0],
                    params: { resistance: 8 }
                }
            ]
        };
        const inputSnapshot = JSON.stringify(dto);
        const sourceSnapshot = JSON.stringify(leakedSource);
        const state = new SimulationStateV2();

        const result = solveCircuitV2(dto, state, { dt: 0.01 });

        expect(result.valid).toBe(true);
        expect(result).toHaveProperty('nextState');
        expect(result).toHaveProperty('diagnostics');
        expect(JSON.stringify(dto)).toBe(inputSnapshot);
        expect(JSON.stringify(leakedSource)).toBe(sourceSnapshot);
    });
});
