import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Wire short-circuit detection', () => {
    it('flags wires on a node that contains a shorted power source', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });

        // Directly short the source terminals with a wire.
        const wShort = connectWire(circuit, 'Wshort', source, 0, source, 1);

        // Add an unrelated subcircuit to ensure nodeCount >= 2 so the solver returns results.valid=true.
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });
        connectWire(circuit, 'Wn1', r1, 0, r2, 0);
        connectWire(circuit, 'Wn2', r1, 1, r2, 1);

        circuit.rebuildNodes();

        expect(circuit.isWireInShortCircuit(wShort)).toBe(true);

        const originalWarn = console.warn;
        try {
            console.warn = () => {};
            const results = solveCircuit(circuit);
            expect(results.valid).toBe(true);

            const info = circuit.getWireCurrentInfo(wShort, results);
            expect(info).not.toBeNull();
            expect(info.isShorted).toBe(true);
            expect(info.current).toBe(0);
            expect(info.flowDirection).toBe(0);
        } finally {
            console.warn = originalWarn;
        }
    });
});
