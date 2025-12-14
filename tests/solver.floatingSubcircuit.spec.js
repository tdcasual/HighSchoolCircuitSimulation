import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('MNA solver stability with floating subcircuits', () => {
    it('keeps the main powered circuit solvable even when an isolated resistive network exists', () => {
        const circuit = createTestCircuit();

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 10 });

        connectWire(circuit, 'Wmain', source, 0, load, 0);
        connectWire(circuit, 'Wreturn', load, 1, source, 1);

        // Floating subcircuit (no connection to the main ground): two resistors in parallel
        const ra = addComponent(circuit, 'Resistor', 'RA', { resistance: 100 });
        const rb = addComponent(circuit, 'Resistor', 'RB', { resistance: 100 });

        connectWire(circuit, 'WF1', ra, 0, rb, 0);
        connectWire(circuit, 'WF2', ra, 1, rb, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        // Main loop: I = 10V / 10Ω = 1A
        expect(results.currents.get('Rload')).toBeCloseTo(1, 6);

        // Floating resistors: no source, should carry ~0A
        expect(Math.abs(results.currents.get('RA') || 0)).toBeLessThan(1e-9);
        expect(Math.abs(results.currents.get('RB') || 0)).toBeLessThan(1e-9);
    });
});

