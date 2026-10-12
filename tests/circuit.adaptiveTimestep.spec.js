import { describe, expect, it } from 'vitest';
import { createInjectedSolverBackend } from '../src/v2/app/createInjectedSolverBackend.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

function attachFrame(circuit, solveFrame) {
    circuit.solverBackend = {
        mode: 'v2',
        solveFrame
    };
}

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

        attachFrame(circuit, () => ({
            valid: false,
            voltages: [],
            currents: new Map(),
            meta: {
                converged: false,
                iterations: 40,
                maxIterations: 40
            }
        }));

        circuit.isRunning = true;
        circuit.step();
        circuit.isRunning = false;

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

        attachFrame(circuit, () => ({
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
        }));

        circuit.isRunning = true;
        for (let i = 0; i < 6; i++) {
            circuit.step();
        }
        circuit.isRunning = false;

        expect(circuit.currentDt).toBeGreaterThan(0.00125);
        expect(circuit.currentDt).toBeLessThanOrEqual(0.01);
    });

    it('grows adaptive dt from shipped V2 solveFrame iteration meta', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;
        circuit.enableAdaptiveTimeStep = true;
        circuit.currentDt = 0.00125;
        circuit.maxAdaptiveDt = 0.01;
        circuit.minAdaptiveDt = 0.001;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        circuit.isRunning = true;
        circuit.step();
        expect(circuit.lastResults?.valid).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeGreaterThan(0);
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.maxIterations).toBeGreaterThan(0);

        for (let i = 0; i < 5; i++) {
            circuit.step();
        }
        circuit.isRunning = false;

        expect(circuit.currentDt).toBeGreaterThan(0.00125);
        expect(circuit.currentDt).toBeLessThanOrEqual(0.01);
    });

    it('integrates fuse I²t with actual elapsed simulation time', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;
        circuit.enableAdaptiveTimeStep = true;
        circuit.currentDt = 0.005;
        circuit.minAdaptiveDt = 0.001;
        circuit.maxAdaptiveDt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const fuse = addComponent(circuit, 'Fuse', 'F1', {
            ratedCurrent: 10,
            i2tThreshold: 1000,
            coldResistance: 0.05,
            blownResistance: 1e12,
            blown: false,
            i2tAccum: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 9.95 });

        connectWire(circuit, 'W1', source, 0, fuse, 0);
        connectWire(circuit, 'W2', fuse, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        circuit.solverBackend = createInjectedSolverBackend();
        circuit.isRunning = true;
        const startSimTime = circuit.simTime;
        circuit.step();
        circuit.isRunning = false;

        const elapsedSimTime = circuit.simTime - startSimTime;
        const current = Math.abs(circuit.lastResults?.currents?.get('F1') || 0);
        const expectedI2t = current * current * elapsedSimTime;
        const view = circuit.lastResults?.viewMap?.get('F1');
        const accumulated = Number.isFinite(view?.i2tAccum) ? view.i2tAccum : fuse.i2tAccum;
        expect(accumulated).toBeCloseTo(expectedI2t, 12);
    });

    it('counts easy-convergence streak once per AC outer step instead of once per substep', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;
        circuit.enableAdaptiveTimeStep = true;
        circuit.currentDt = 0.00125;
        circuit.maxAdaptiveDt = 0.01;

        const acSource = addComponent(circuit, 'ACVoltageSource', 'VAC', {
            rmsVoltage: 10,
            frequency: 50,
            phase: 0,
            offset: 0,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', acSource, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, acSource, 1);

        attachFrame(circuit, () => ({
            valid: true,
            voltages: [0, 10],
            currents: new Map([
                ['VAC', 1],
                ['R1', 1]
            ]),
            meta: {
                converged: true,
                iterations: 1,
                maxIterations: 40
            }
        }));

        circuit.isRunning = true;
        for (let i = 0; i < 3; i += 1) {
            circuit.step();
        }
        circuit.isRunning = false;

        expect(circuit.currentDt).toBeCloseTo(0.001875, 12);
    });
});