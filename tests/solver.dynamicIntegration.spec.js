import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

function runSteps(circuit, steps) {
    circuit.isRunning = true;
    for (let index = 0; index < steps; index++) {
        circuit.step();
    }
    circuit.isRunning = false;
}

function readCapVoltage(circuit, capacitor) {
    const v1 = circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0;
    const v2 = circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0;
    return v1 - v2;
}

describe('Dynamic integration methods (capacitor/inductor)', () => {
    it('allows capacitor trapezoidal mode and differs from backward-euler after startup step', () => {
        const buildCircuit = (integrationMethod) => {
            const circuit = createTestCircuit();
            circuit.dt = 0.01;
            const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
            addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
            const resistor = circuit.getComponent('R1');
            const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
                capacitance: 0.001,
                integrationMethod
            });

            connectWire(circuit, 'W1', source, 0, resistor, 0);
            connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
            connectWire(circuit, 'W3', capacitor, 1, source, 1);
            return { circuit, capacitor };
        };

        const trapezoidalCase = buildCircuit('trapezoidal');
        runSteps(trapezoidalCase.circuit, 2);
        const vTrap = readCapVoltage(trapezoidalCase.circuit, trapezoidalCase.capacitor);

        const backwardCase = buildCircuit('backward-euler');
        runSteps(backwardCase.circuit, 2);
        const vBe = readCapVoltage(backwardCase.circuit, backwardCase.capacitor);

        expect(vBe).toBeCloseTo(1.7355371901, 6);
        expect(vTrap).toBeCloseTo(1.7748917749, 6);
        expect(vTrap).toBeGreaterThan(vBe);
    });

    it('automatically falls back to backward-euler when a switch is connected', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'trapezoidal'
        });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: false });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);
        // 连接一个开关到电源两端，触发“含开关场景”自动回退
        connectWire(circuit, 'W4', sw, 0, source, 0);
        connectWire(circuit, 'W5', sw, 1, source, 1);

        runSteps(circuit, 2);
        const vCap = readCapVoltage(circuit, capacitor);

        expect(circuit.solver.hasConnectedSwitch).toBe(true);
        expect(vCap).toBeCloseTo(1.7355371901, 6);
    });
});
