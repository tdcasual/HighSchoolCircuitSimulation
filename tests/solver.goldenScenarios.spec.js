import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver golden scenarios', () => {
    it('matches the expected node voltages/currents on an unbalanced bridge', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 200 });
        const r3 = addComponent(circuit, 'Resistor', 'R3', { resistance: 150 });
        const r4 = addComponent(circuit, 'Resistor', 'R4', { resistance: 100 });
        const r5 = addComponent(circuit, 'Resistor', 'R5', { resistance: 120 });

        connectWire(circuit, 'W1', source, 0, r1, 0);
        connectWire(circuit, 'W2', r1, 1, r2, 0);
        connectWire(circuit, 'W3', r2, 1, source, 1);
        connectWire(circuit, 'W4', source, 0, r3, 0);
        connectWire(circuit, 'W5', r3, 1, r4, 0);
        connectWire(circuit, 'W6', r4, 1, source, 1);
        connectWire(circuit, 'W7', r1, 1, r5, 0);
        connectWire(circuit, 'W8', r5, 1, r3, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        expect(results.currents.get('R1')).toBeCloseTo(0.0486486486, 6);
        expect(results.currents.get('R2')).toBeCloseTo(0.0356756757, 6);
        expect(results.currents.get('R3')).toBeCloseTo(0.0428108108, 6);
        expect(results.currents.get('R4')).toBeCloseTo(0.0557837838, 6);
        expect(results.currents.get('R5')).toBeCloseTo(0.0129729730, 6);
        expect(results.currents.get('V1')).toBeCloseTo(0.0914594595, 6);

        const vMidLeft = results.voltages[r1.nodes[1]] || 0;
        const vMidRight = results.voltages[r3.nodes[1]] || 0;
        expect(vMidLeft).toBeCloseTo(7.1351351351, 6);
        expect(vMidRight).toBeCloseTo(5.5783783784, 6);
    });

    it('captures voltmeter loading in a divider', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });
        const vm = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: 100, range: 15 });

        connectWire(circuit, 'W1', source, 0, r1, 0);
        connectWire(circuit, 'W2', r1, 1, r2, 0);
        connectWire(circuit, 'W3', r2, 1, source, 1);
        connectWire(circuit, 'W4', vm, 0, r1, 1);
        connectWire(circuit, 'W5', vm, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const vMid = results.voltages[r1.nodes[1]] || 0;
        expect(vMid).toBeCloseTo(4, 6);
        expect(results.currents.get('R1')).toBeCloseTo(0.08, 6);
        expect(results.currents.get('R2')).toBeCloseTo(0.04, 6);
        expect(results.currents.get('VM1')).toBeCloseTo(0.04, 6);
        expect(results.currents.get('V1')).toBeCloseTo(0.08, 6);
    });

    it('supports series-aiding sources', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 4, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', v1, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, v2, 1);
        connectWire(circuit, 'W3', v2, 0, v1, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(1, 6);
    });

    it('supports series-opposing sources', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 4, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', v1, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, v2, 0);
        connectWire(circuit, 'W3', v2, 1, v1, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(0.2, 6);
    });

    it('follows backward-Euler charging profile for RC transient', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        const expectedVoltages = [
            0.9090909091,
            1.7748917749,
            2.5582354154,
            3.2669748996,
            3.9082153854
        ];

        circuit.isRunning = true;
        for (let index = 0; index < expectedVoltages.length; index++) {
            circuit.step();
            expect(circuit.lastResults?.valid).toBe(true);
            const vCap = (circuit.lastResults?.voltages[capacitor.nodes[0]] || 0) - (circuit.lastResults?.voltages[capacitor.nodes[1]] || 0);
            expect(vCap).toBeCloseTo(expectedVoltages[index], 6);
        }
        circuit.isRunning = false;
    });

});
