import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Capacitor with variable capacitance', () => {
    it('preserves charge (Q) when capacitance changes in an open circuit', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: true });
        const cap = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-6 });

        connectWire(circuit, 'W1', source, 0, sw, 0);
        connectWire(circuit, 'W2', sw, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);

        // Step 1: charge to the source voltage.
        const results1 = solveCircuit(circuit);
        expect(results1.valid).toBe(true);
        circuit.solver.updateDynamicComponents(results1.voltages);

        const vCap1 = (results1.voltages[cap.nodes[0]] || 0) - (results1.voltages[cap.nodes[1]] || 0);
        expect(vCap1).toBeCloseTo(10, 6);

        const qStored = cap.prevCharge || 0;
        expect(qStored).toBeCloseTo(1e-6 * 10, 10);

        // Step 2: open the switch (no external current) and change capacitance.
        sw.closed = false;
        cap.capacitance = 0.5e-6;

        const results2 = solveCircuit(circuit);
        expect(results2.valid).toBe(true);

        const vCap2 = (results2.voltages[cap.nodes[0]] || 0) - (results2.voltages[cap.nodes[1]] || 0);
        expect(vCap2).toBeCloseTo(qStored / cap.capacitance, 5);

        // With Q conserved, dQ ≈ 0 so capacitor current should be ~0.
        expect(Math.abs(results2.currents.get('C1') || 0)).toBeLessThan(1e-9);
    });
});
