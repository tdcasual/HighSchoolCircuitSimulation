import { describe, expect, it } from 'vitest';
import { CircuitTopologyValidationService } from '../src/core/services/CircuitTopologyValidationService.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('CircuitTopologyValidationService', () => {
    it('detects conflicting ideal voltage sources on the same node pair', () => {
        const circuit = createTestCircuit();
        const source1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 0 });
        const source2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 6, internalResistance: 0 });

        connectWire(circuit, 'W1', source1, 0, source2, 0);
        connectWire(circuit, 'W2', source1, 1, source2, 1);
        circuit.rebuildNodes();

        const service = new CircuitTopologyValidationService();
        const error = service.detectConflictingIdealSources(circuit, 0);

        expect(error?.code).toBe('TOPO_CONFLICTING_IDEAL_SOURCES');
        expect(error?.details?.sourceIds).toEqual(['V1', 'V2']);
    });
});
