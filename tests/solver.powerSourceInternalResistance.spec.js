import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('PowerSource internal resistance (Norton model)', () => {
    it('matches I = E / (R + r) and U_terminal = E - I·r', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 1
        });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 11 });

        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        // Expected steady-state loop current.
        expect(results.currents.get('R1')).toBeCloseTo(1, 6);
        expect(results.currents.get('V1')).toBeCloseTo(1, 6);

        // Terminal voltage (node+ - node-) should be 11V.
        const vPlus = results.voltages[source.nodes[0]] || 0;
        const vMinus = results.voltages[source.nodes[1]] || 0;
        expect(vPlus - vMinus).toBeCloseTo(11, 6);
    });
});

