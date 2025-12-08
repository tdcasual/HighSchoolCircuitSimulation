import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Parallel branches maintain direction hints without voltage drop', () => {
    it('keeps arrow directions correct even when wires share the same potential', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const fastBranch = addComponent(circuit, 'Resistor', 'Rfast', { resistance: 100 });
        const slowBranch = addComponent(circuit, 'Resistor', 'Rslow', { resistance: 200 });

        const wPosFast = connectWire(circuit, 'WposF', source, 0, fastBranch, 0);
        const wPosSlow = connectWire(circuit, 'WposS', source, 0, slowBranch, 0);
        const wNegFast = connectWire(circuit, 'WnegF', fastBranch, 1, source, 1);
        const wNegSlow = connectWire(circuit, 'WnegS', slowBranch, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const fastForward = circuit.getWireCurrentInfo(wPosFast, results);
        const slowForward = circuit.getWireCurrentInfo(wPosSlow, results);
        const fastReturn = circuit.getWireCurrentInfo(wNegFast, results);
        const slowReturn = circuit.getWireCurrentInfo(wNegSlow, results);

        expect(fastForward.flowDirection).toBe(1);
        expect(slowForward.flowDirection).toBe(1);
        expect(fastReturn.flowDirection).toBe(1);
        expect(slowReturn.flowDirection).toBe(1);

        expect(fastForward.current).toBeGreaterThan(0);
        expect(slowForward.current).toBeGreaterThan(0);
        expect(Math.abs(fastForward.current - fastReturn.current)).toBeLessThan(1e-6);
        expect(Math.abs(slowForward.current - slowReturn.current)).toBeLessThan(1e-6);
    });
});
