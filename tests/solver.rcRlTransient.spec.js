import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('RC/RL transient recurrence (backward-euler)', () => {
    it('matches RC charging recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        const alpha = circuit.dt / (resistor.resistance * capacitor.capacitance);
        let vExpected = 0;

        circuit.isRunning = true;
        circuit.step();
        vExpected = (vExpected + alpha * source.voltage) / (1 + alpha);
        const v1 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v1).toBeCloseTo(vExpected, 6);

        circuit.step();
        vExpected = (vExpected + alpha * source.voltage) / (1 + alpha);
        const v2 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v2).toBeCloseTo(vExpected, 6);
        circuit.isRunning = false;
    });

    it('matches RC discharging recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        const alpha = circuit.dt / (resistor.resistance * capacitor.capacitance);
        let vExpected = 10;
        capacitor.prevCharge = capacitor.capacitance * vExpected;
        capacitor.prevVoltage = vExpected;

        circuit.isRunning = true;
        circuit.step();
        vExpected = vExpected / (1 + alpha);
        const v1 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v1).toBeCloseTo(vExpected, 6);

        circuit.step();
        vExpected = vExpected / (1 + alpha);
        const v2 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v2).toBeCloseTo(vExpected, 6);
        circuit.isRunning = false;
    });

    it('matches RL current rise recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 0.1,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        const alpha = (circuit.dt * resistor.resistance) / inductor.inductance;
        const beta = (circuit.dt * source.voltage) / inductor.inductance;
        let iExpected = 0;

        circuit.isRunning = true;
        circuit.step();
        iExpected = (iExpected + beta) / (1 + alpha);
        expect(inductor.currentValue).toBeCloseTo(iExpected, 6);

        circuit.step();
        iExpected = (iExpected + beta) / (1 + alpha);
        expect(inductor.currentValue).toBeCloseTo(iExpected, 6);
        circuit.isRunning = false;
    });

    it('matches RL current decay recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 0.1,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        const alpha = (circuit.dt * resistor.resistance) / inductor.inductance;
        let iExpected = 1;
        inductor.prevCurrent = iExpected;
        inductor.prevVoltage = 0;

        circuit.isRunning = true;
        circuit.step();
        iExpected = iExpected / (1 + alpha);
        expect(inductor.currentValue).toBeCloseTo(iExpected, 6);

        circuit.step();
        iExpected = iExpected / (1 + alpha);
        expect(inductor.currentValue).toBeCloseTo(iExpected, 6);
        circuit.isRunning = false;
    });
});
