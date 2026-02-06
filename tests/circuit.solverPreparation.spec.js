import { describe, it, expect } from 'vitest';
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
    it('reuses solver preparation across steady simulation steps', () => {
        const circuit = buildSeriesCircuit();
        const originalSetCircuit = circuit.solver.setCircuit.bind(circuit.solver);
        let setCircuitCount = 0;
        circuit.solver.setCircuit = (...args) => {
            setCircuitCount += 1;
            return originalSetCircuit(...args);
        };

        circuit.isRunning = true;
        circuit.step();
        circuit.step();
        circuit.step();
        circuit.isRunning = false;

        expect(setCircuitCount).toBe(1);
        expect(circuit.lastResults?.valid).toBe(true);
    });

    it('re-prepares solver after topology rebuild', () => {
        const circuit = buildSeriesCircuit();
        const originalSetCircuit = circuit.solver.setCircuit.bind(circuit.solver);
        let setCircuitCount = 0;
        circuit.solver.setCircuit = (...args) => {
            setCircuitCount += 1;
            return originalSetCircuit(...args);
        };

        circuit.isRunning = true;
        circuit.step();
        expect(setCircuitCount).toBe(1);

        circuit.rebuildNodes();
        circuit.step();
        circuit.isRunning = false;

        expect(setCircuitCount).toBe(2);
    });

    it('re-prepares solver when marked dirty by parameter updates', () => {
        const circuit = buildSeriesCircuit();
        const originalSetCircuit = circuit.solver.setCircuit.bind(circuit.solver);
        let setCircuitCount = 0;
        circuit.solver.setCircuit = (...args) => {
            setCircuitCount += 1;
            return originalSetCircuit(...args);
        };

        circuit.isRunning = true;
        circuit.step();
        expect(setCircuitCount).toBe(1);

        circuit.markSolverCircuitDirty();
        circuit.step();
        circuit.isRunning = false;

        expect(setCircuitCount).toBe(2);
    });
});
