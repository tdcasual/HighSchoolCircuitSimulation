import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Dynamic components steady-state behavior', () => {
    it('capacitor current decays to ~0 at DC steady state', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        circuit.isRunning = true;
        for (let i = 0; i < 200; i++) {
            circuit.step();
        }

        const vCap = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        const iCap = Math.abs(circuit.lastResults?.currents?.get('C1') || 0);
        expect(vCap).toBeGreaterThan(9.9);
        expect(iCap).toBeLessThan(1e-3);
        circuit.isRunning = false;
    });

    it('restarts capacitor transient from a clean slate after clear', () => {
        const buildRcCircuit = (circuit) => {
            const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
            const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
            const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });

            connectWire(circuit, 'W1', source, 0, resistor, 0);
            connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
            connectWire(circuit, 'W3', capacitor, 1, source, 1);

            return { capacitor };
        };

        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const firstRun = buildRcCircuit(circuit);
        circuit.isRunning = true;
        circuit.step();
        const initialCurrent = Number(circuit.lastResults?.currents?.get('C1') || 0);
        const initialVoltage = Number(
            (circuit.lastResults?.voltages?.[firstRun.capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[firstRun.capacitor.nodes[1]] || 0)
        );
        circuit.isRunning = false;

        circuit.clear();
        circuit.dt = 0.01;

        const secondRun = buildRcCircuit(circuit);
        circuit.isRunning = true;
        circuit.step();
        const restartedCurrent = Number(circuit.lastResults?.currents?.get('C1') || 0);
        const restartedVoltage = Number(
            (circuit.lastResults?.voltages?.[secondRun.capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[secondRun.capacitor.nodes[1]] || 0)
        );
        circuit.isRunning = false;

        expect(restartedCurrent).toBeCloseTo(initialCurrent, 9);
        expect(restartedVoltage).toBeCloseTo(initialVoltage, 9);
    });

    it('inductor approaches DC steady-state current with near-zero voltage drop', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', { inductance: 1, initialCurrent: 0 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        circuit.isRunning = true;
        for (let i = 0; i < 300; i++) {
            circuit.step();
        }

        const iInductor = Math.abs(circuit.lastResults?.currents?.get('L1') || 0);
        const vInductor = (circuit.lastResults?.voltages?.[inductor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[inductor.nodes[1]] || 0);
        expect(iInductor).toBeCloseTo(1, 2);
        expect(Math.abs(vInductor)).toBeLessThan(1e-3);
        circuit.isRunning = false;
    });
});
