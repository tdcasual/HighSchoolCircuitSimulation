import { describe, expect, it } from 'vitest';
import { MNASolver } from '../src/core/simulation/MNASolver.js';
import { resolveCircuitSourceVoltageAtTime } from '../src/core/services/CircuitSourceVoltageResolver.js';

describe('MNASolver source voltage delegation', () => {
    it('matches the shared source voltage resolver and updates instantaneousVoltage', () => {
        const solver = new MNASolver();
        solver.simTime = 0.002;
        const source = {
            type: 'ACVoltageSource',
            rmsVoltage: 8,
            frequency: 50,
            phase: 30,
            offset: 0.5
        };

        const value = solver.getSourceInstantVoltage(source);
        const expected = resolveCircuitSourceVoltageAtTime(source, solver.simTime);

        expect(value).toBeCloseTo(expected, 12);
        expect(source.instantaneousVoltage).toBeCloseTo(expected, 12);
    });
});
