import { describe, expect, it } from 'vitest';
import { CircuitTopologyValidationService } from '../src/core/services/CircuitTopologyValidationService.js';
import { resolveCircuitSourceVoltageAtTime } from '../src/core/services/CircuitSourceVoltageResolver.js';

describe('CircuitTopologyValidationService source voltage delegation', () => {
    it('matches the shared source voltage resolver for timed source checks', () => {
        const service = new CircuitTopologyValidationService();
        const circuit = { simTime: 0.003 };
        const source = {
            type: 'ACVoltageSource',
            rmsVoltage: 6,
            frequency: 120,
            phase: -45,
            offset: 0.2
        };

        const value = service.getSourceInstantVoltageAtTime(circuit, source, circuit.simTime);
        const expected = resolveCircuitSourceVoltageAtTime(source, circuit.simTime);

        expect(value).toBeCloseTo(expected, 12);
    });
});
