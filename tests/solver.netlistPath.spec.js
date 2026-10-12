import { describe, expect, it } from 'vitest';
import { NetlistBuilder } from '../src/core/simulation/NetlistBuilder.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver netlist DTO path', () => {
    it('builds a netlist DTO without a source key', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 3,
            internalResistance: 2
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const netlist = new NetlistBuilder().build({
            components: Array.from(circuit.components.values()),
            nodes: circuit.nodes
        });

        expect(netlist.meta).toEqual({ version: 1 });
        expect(Array.isArray(netlist.components)).toBe(true);
        expect(netlist.components.some((component) => component.id === 'V1')).toBe(true);
        expect(netlist.components[0]).not.toHaveProperty('source');
    });

    it('solves through netlist DTO path with unchanged electrical result', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 3,
            internalResistance: 2
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const results = solveCircuit(circuit, 0);

        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(0.3, 6);
    });
});
