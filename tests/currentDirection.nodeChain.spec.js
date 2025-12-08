import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Node-level topology propagation', () => {
    it('keeps wires on the same node flowing consistently even when chained through sinks', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'VS', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });

        connectWire(circuit, 'w-pos-1', source, 0, r1, 0);
        const chained = connectWire(circuit, 'w-pos-chain', r1, 1, r2, 0);
        connectWire(circuit, 'w-neg-1', r1, 1, source, 1);
        connectWire(circuit, 'w-neg-chain', r2, 1, r1, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const chainInfo = circuit.getWireCurrentInfo(chained, results);
        expect(chainInfo.current).toBeGreaterThan(0);
        expect(chainInfo.flowDirection).toBe(1);
    });
});
