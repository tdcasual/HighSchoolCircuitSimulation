import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Sink-only node direction inference', () => {
    it('keeps return wires pointing toward the downstream sink', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });

        // Series chain with explicit bottom-node wires
        connectWire(circuit, 'top-a', source, 0, r1, 0);
        connectWire(circuit, 'top-b', r1, 1, r2, 0);
        connectWire(circuit, 'bottom-mid', r2, 1, r1, 1);
        const returnWire = connectWire(circuit, 'bottom-return', r1, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const returnInfo = circuit.getWireCurrentInfo(returnWire, results);
        expect(returnInfo.flowDirection).toBe(1);
    });
});
