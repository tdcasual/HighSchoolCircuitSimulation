import { describe, expect, it } from 'vitest';
import { solveCircuitV2 } from '../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { buildV2Dto, getCanonicalSolverCase } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 common electrical cases', () => {
    it('solves source-with-internal-resistance + resistor baseline case', () => {
        const dto = buildV2Dto(getCanonicalSolverCase('series-source-resistor'));

        const result = solveCircuitV2(dto, new SimulationStateV2(), { dt: 0.01 });

        expect(result.valid).toBe(true);
        expect(result.voltages[1]).toBeCloseTo(2.4, 6);
        expect(result.currents.get('R1')).toBeCloseTo(0.3, 6);
    });
});
