import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Component connection validation', () => {
    it('requires both terminals of a resistor to have wires before marking it connected', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const floating = addComponent(circuit, 'Resistor', 'Rfloat', { resistance: 100 });

        connectWire(circuit, 'Wpos', source, 0, r1, 0);
        connectWire(circuit, 'Wload', r1, 1, source, 1);
        connectWire(circuit, 'Wtap', r1, 1, floating, 0);

        // Force node rebuild to populate connection map.
        circuit.rebuildNodes();
        expect(circuit.isComponentConnected(r1.id)).toBe(true);
        expect(circuit.isComponentConnected(floating.id)).toBe(false);

        connectWire(circuit, 'Wreturn', floating, 1, source, 1);
        circuit.rebuildNodes();
        expect(circuit.isComponentConnected(floating.id)).toBe(true);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
    });
});
