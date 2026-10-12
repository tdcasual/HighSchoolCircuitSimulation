import { describe, expect, it } from 'vitest';
import { toggleSwitch } from '../src/ui/interaction/ComponentActions.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('closed switch series current unknown', () => {
    it('yields about 0.6 A for 6 V / 10 Ω with a closed switch', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: true });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, sw, 0);
        connectWire(circuit, 'W3', sw, 1, source, 1);

        circuit.isRunning = true;
        circuit.step();

        expect(circuit.lastResults?.valid).toBe(true);
        const current = circuit.lastResults.currents.get('S1');
        expect(current).toBeGreaterThan(0.59);
        expect(current).toBeLessThan(0.61);
        expect(sw.currentValue).toBeGreaterThan(0.59);
        expect(sw.currentValue).toBeLessThan(0.61);
    });

    it('solves two parallel closed switches whose currents sum to the load current', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const s1 = addComponent(circuit, 'Switch', 'S1', { closed: true });
        const s2 = addComponent(circuit, 'Switch', 'S2', { closed: true });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, s1, 0);
        connectWire(circuit, 'W3', resistor, 1, s2, 0);
        connectWire(circuit, 'W4', s1, 1, source, 1);
        connectWire(circuit, 'W5', s2, 1, source, 1);

        circuit.isRunning = true;
        circuit.step();

        expect(circuit.lastResults?.valid).toBe(true);
        const i1 = circuit.lastResults.currents.get('S1');
        const i2 = circuit.lastResults.currents.get('S2');
        expect(Number.isFinite(i1)).toBe(true);
        expect(Number.isFinite(i2)).toBe(true);
        expect(Math.abs(i1)).toBeLessThan(10);
        expect(Math.abs(i2)).toBeLessThan(10);
        expect(i1 + i2).toBeCloseTo(0.6, 2);
    });

    it('after preparing an open switch, toggleSwitch then step yields about 0.6 A', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: false });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, sw, 0);
        connectWire(circuit, 'W3', sw, 1, source, 1);

        circuit.isRunning = true;
        circuit.step();
        expect(circuit.lastResults?.valid).toBe(true);
        expect(Math.abs(circuit.lastResults.currents.get('S1') || 0)).toBeLessThan(1e-6);

        const result = toggleSwitch.call({
            circuit,
            renderer: {
                refreshComponent() {},
                setSelected() {}
            },
            runWithHistory(_label, action) {
                action();
            },
            selectComponent() {},
            updateStatus() {}
        }, 'S1');

        expect(result.ok).toBe(true);
        expect(sw.closed).toBe(true);

        circuit.step();
        expect(circuit.lastResults?.valid).toBe(true);
        const current = circuit.lastResults.currents.get('S1');
        expect(current).toBeGreaterThan(0.59);
        expect(current).toBeLessThan(0.61);
        expect(sw.currentValue).toBeGreaterThan(0.59);
        expect(sw.currentValue).toBeLessThan(0.61);
    });
});
