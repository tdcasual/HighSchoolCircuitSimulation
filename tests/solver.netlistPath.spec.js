import { describe, expect, it, vi } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver netlist DTO path', () => {
    it('lets Circuit prepare solver using netlist DTO input', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 3,
            internalResistance: 2
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const setCircuitSpy = vi.spyOn(circuit.solver, 'setCircuit');
        circuit.ensureSolverPrepared();

        expect(setCircuitSpy).toHaveBeenCalledTimes(1);
        const [netlist] = setCircuitSpy.mock.calls[0];
        expect(netlist.meta).toEqual({ version: 1 });
        expect(Array.isArray(netlist.nodes)).toBe(true);
        expect(Array.isArray(netlist.components)).toBe(true);
        expect(netlist.components[0]).toHaveProperty('source');
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

        circuit.ensureSolverPrepared();
        const results = solveCircuit(circuit, 0);

        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(0.3, 6);
    });
});
