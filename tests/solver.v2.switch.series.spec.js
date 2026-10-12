import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 closed switch series VS', () => {
    it('yields about 0.6 A for 6 V / 10 Ω without using deltaV/1e-9', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: true });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, sw, 0);
        connectWire(circuit, 'W3', sw, 1, source, 1);

        const production = solveCircuit(circuit);
        const { result } = solveV2FromCircuit(circuit);

        expect(production.valid).toBe(true);
        expect(result.valid).toBe(true);
        expect(result.currents.get('S1')).toBeGreaterThan(0.59);
        expect(result.currents.get('S1')).toBeLessThan(0.61);
        expect(result.currents.get('S1')).toBeCloseTo(production.currents.get('S1'), 6);
        expect(result.currents.get('R1')).toBeCloseTo(0.6, 6);
    });

    it('solves two parallel closed switches whose currents sum to the load current', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        addComponent(circuit, 'Switch', 'S1', { closed: true });
        addComponent(circuit, 'Switch', 'S2', { closed: true });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, 'S1', 0);
        connectWire(circuit, 'W3', resistor, 1, 'S2', 0);
        connectWire(circuit, 'W4', 'S1', 1, source, 1);
        connectWire(circuit, 'W5', 'S2', 1, source, 1);

        const { result } = solveV2FromCircuit(circuit);
        expect(result.valid).toBe(true);
        const i1 = result.currents.get('S1');
        const i2 = result.currents.get('S2');
        expect(Number.isFinite(i1)).toBe(true);
        expect(Number.isFinite(i2)).toBe(true);
        expect(Math.abs(i1)).toBeLessThan(10);
        expect(Math.abs(i2)).toBeLessThan(10);
        expect(i1 + i2).toBeCloseTo(0.6, 2);
    });

    it('open switch stamps a huge resistor and carries ~0 A', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        addComponent(circuit, 'Switch', 'S1', { closed: false });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, 'S1', 0);
        connectWire(circuit, 'W3', 'S1', 1, source, 1);

        const { result } = solveV2FromCircuit(circuit);
        expect(result.valid).toBe(true);
        expect(Math.abs(result.currents.get('S1') || 0)).toBeLessThan(1e-6);
    });
});
