import { describe, expect, it } from 'vitest';
import { CircuitFlowAnalysisService } from '../src/core/services/CircuitFlowAnalysisService.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('CircuitFlowAnalysisService', () => {
    it('computes a wire flow cache for a simple resistive circuit', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        circuit.rebuildNodes();
        const results = solveCircuit(circuit);
        const service = new CircuitFlowAnalysisService();
        const cache = service.computeWireFlowCache(circuit, results);

        expect(cache).toBeInstanceOf(Map);
        expect(cache.get('W1')?.currentMagnitude).toBeGreaterThan(0);
        expect(cache.get('W2')?.currentMagnitude).toBeGreaterThan(0);
    });
});
