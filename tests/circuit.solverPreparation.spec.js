import { describe, it, expect, vi } from 'vitest';
import { createInjectedSolverBackend } from '../src/v2/app/createInjectedSolverBackend.js';
import { createTestCircuit, addComponent, connectWire } from './helpers/circuitTestUtils.js';

function buildSeriesCircuit() {
    const circuit = createTestCircuit();
    const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 9, internalResistance: 0.5 });
    const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
    connectWire(circuit, 'W1', source, 1, resistor, 0);
    connectWire(circuit, 'W2', resistor, 1, source, 0);
    return circuit;
}

describe('Circuit solver preparation caching', () => {
    it('runs v2 steps without V1 setCircuit', () => {
        const circuit = buildSeriesCircuit();
        circuit.solverBackend = createInjectedSolverBackend();
        const setCircuit = vi.spyOn(circuit.solver, 'setCircuit');

        circuit.prepareSimulation();
        circuit.step();
        circuit.step();
        circuit.step();
        circuit.haltSimulation();

        expect(setCircuit).not.toHaveBeenCalled();
        expect(circuit.lastResults?.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('stays on v2 after topology rebuild', () => {
        const circuit = buildSeriesCircuit();
        circuit.solverBackend = createInjectedSolverBackend();
        const setCircuit = vi.spyOn(circuit.solver, 'setCircuit');

        circuit.prepareSimulation();
        circuit.step();
        circuit.rebuildNodes();
        circuit.step();
        circuit.haltSimulation();

        expect(setCircuit).not.toHaveBeenCalled();
        expect(circuit.lastResults?.valid).toBe(true);
    });

    it('stays on v2 after markSolverCircuitDirty', () => {
        const circuit = buildSeriesCircuit();
        circuit.solverBackend = createInjectedSolverBackend();
        const setCircuit = vi.spyOn(circuit.solver, 'setCircuit');

        circuit.prepareSimulation();
        circuit.step();
        circuit.markSolverCircuitDirty();
        circuit.step();
        circuit.haltSimulation();

        expect(setCircuit).not.toHaveBeenCalled();
        expect(circuit.lastResults?.valid).toBe(true);
    });
});
