import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Adaptive simulation timestep', () => {
    it('reduces internal step size after a failed/non-converged solve', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;
        circuit.enableAdaptiveTimeStep = true;
        circuit.minAdaptiveDt = 0.001;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const originalSolve = circuit.solver.solve.bind(circuit.solver);
        circuit.solver.solve = () => ({
            valid: false,
            voltages: [],
            currents: new Map(),
            meta: {
                converged: false,
                iterations: 40,
                maxIterations: 40
            }
        });

        circuit.isRunning = true;
        circuit.step();
        circuit.isRunning = false;
        circuit.solver.solve = originalSolve;

        expect(circuit.currentDt).toBeCloseTo(0.005, 9);
    });

    it('increases internal step size after repeated easy convergence', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;
        circuit.enableAdaptiveTimeStep = true;
        circuit.currentDt = 0.00125;
        circuit.maxAdaptiveDt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const originalSolve = circuit.solver.solve.bind(circuit.solver);
        circuit.solver.solve = () => ({
            valid: true,
            voltages: [0, 5],
            currents: new Map([
                ['V1', 0.05],
                ['R1', 0.05]
            ]),
            meta: {
                converged: true,
                iterations: 1,
                maxIterations: 40
            }
        });

        circuit.isRunning = true;
        for (let i = 0; i < 6; i++) {
            circuit.step();
        }
        circuit.isRunning = false;
        circuit.solver.solve = originalSolve;

        expect(circuit.currentDt).toBeGreaterThan(0.00125);
        expect(circuit.currentDt).toBeLessThanOrEqual(0.01);
    });
});
