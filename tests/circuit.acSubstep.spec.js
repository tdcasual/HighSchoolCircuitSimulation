import { describe, expect, it } from 'vitest';
import { createInjectedSolverBackend } from '../src/v2/app/createInjectedSolverBackend.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Circuit AC substep simulation', () => {
    it('uses substeps for connected AC source to avoid phase-locked zero samples', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01; // 10ms, 与 50Hz 周期存在整数关系（原实现易采样到零点）

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

        expect(circuit.getSimulationSubstepCount()).toBeGreaterThan(1);

        circuit.solverBackend = createInjectedSolverBackend();
        circuit.isRunning = true;
        circuit.step();
        circuit.isRunning = false;

        expect(circuit.lastResults?.valid).toBe(true);
        const current = Math.abs(Number(circuit.lastResults.currents.get('R1')));
        expect(current).toBeGreaterThan(1e-3);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
    });

    it('keeps single-step solving when no connected AC source exists', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        expect(circuit.getSimulationSubstepCount()).toBe(1);
    });

    it('does not grow adaptive dt multiple times within a single AC outer step', () => {
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

        expect(circuit.getSimulationSubstepCount(circuit.currentDt)).toBeGreaterThan(1);

        circuit.solverBackend = {
            mode: 'v2',
            solveFrame: () => ({
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
            })
        };

        circuit.isRunning = true;
        circuit.step();
        circuit.isRunning = false;

        expect(circuit.currentDt).toBeCloseTo(0.00125, 12);
    });
});