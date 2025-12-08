import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Wire flow heuristics on shared nodes', () => {
    it('still emits a forward direction when both terminals source the same node', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });

        connectWire(circuit, 'Wpos1', source, 0, r1, 0);
        connectWire(circuit, 'Wpos2', source, 0, r2, 0);
        connectWire(circuit, 'Wneg1', r1, 1, source, 1);
        connectWire(circuit, 'Wneg2', r2, 1, source, 1);

        const sharedReturn = connectWire(circuit, 'Wshare', r1, 1, r2, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const info = circuit.getWireCurrentInfo(sharedReturn, results);
        expect(info.current).toBeGreaterThan(0);
        expect(info.flowDirection).toBe(1);
    });
});
