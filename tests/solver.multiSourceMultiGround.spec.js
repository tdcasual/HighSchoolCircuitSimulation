import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver multi-source / multi-ground cases', () => {
    it('solves parallel sources with internal resistance and shared load', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 1 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 6, internalResistance: 1 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 6 });

        connectWire(circuit, 'Wpos', v1, 0, v2, 0);
        connectWire(circuit, 'Wneg', v1, 1, v2, 1);
        connectWire(circuit, 'Wload', v1, 0, load, 0);
        connectWire(circuit, 'Wreturn', load, 1, v1, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedV = (12 / 1 + 6 / 1) / (1 / 1 + 1 / 1 + 1 / 6);
        const vTerminal = (results.voltages[v1.nodes[0]] || 0) - (results.voltages[v1.nodes[1]] || 0);
        expect(vTerminal).toBeCloseTo(expectedV, 6);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(expectedV / 6, 6);

        const i1 = results.currents.get('V1') || 0;
        const i2 = results.currents.get('V2') || 0;
        expect(i1 + i2).toBeCloseTo(iLoad, 6);
    });

    it('uses midpoint ground for series sources and resolves signed node voltages', () => {
        const circuit = createTestCircuit();
        const ground = addComponent(circuit, 'Ground', 'GND');
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 7, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 6 });

        connectWire(circuit, 'Wg', v1, 1, ground, 0);
        connectWire(circuit, 'Wseries', v1, 0, v2, 1);
        connectWire(circuit, 'WloadTop', v2, 0, load, 0);
        connectWire(circuit, 'WloadReturn', load, 1, ground, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(ground.nodes[0]).toBe(0);

        const vTop = results.voltages[v2.nodes[0]] || 0;
        const vMid = results.voltages[v1.nodes[1]] || 0;
        expect(vMid).toBeCloseTo(0, 6);
        expect(vTop).toBeCloseTo(12, 6);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(12 / 6, 6);
    });

    it('assigns node 0 to multiple grounds tied to the same node', () => {
        const circuit = createTestCircuit();
        const g1 = addComponent(circuit, 'Ground', 'GND1');
        const g2 = addComponent(circuit, 'Ground', 'GND2');
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 9, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 9 });

        connectWire(circuit, 'Wg1', source, 1, g1, 0);
        connectWire(circuit, 'Wg2', g1, 0, g2, 0);
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, g1, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(g1.nodes[0]).toBe(0);
        expect(g2.nodes[0]).toBe(0);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(1, 6);
    });

    it('keeps floating ground from becoming the global reference', () => {
        const circuit = createTestCircuit();
        const gMain = addComponent(circuit, 'Ground', 'GMAIN');
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'Wg', source, 1, gMain, 0);
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, gMain, 0);

        const gFloat = addComponent(circuit, 'Ground', 'GFLOAT');
        const vFloat = addComponent(circuit, 'PowerSource', 'V2', { voltage: 4, internalResistance: 0 });
        const rFloat = addComponent(circuit, 'Resistor', 'R2', { resistance: 4 });

        connectWire(circuit, 'W3', vFloat, 1, gFloat, 0);
        connectWire(circuit, 'W4', vFloat, 0, rFloat, 0);
        connectWire(circuit, 'W5', rFloat, 1, gFloat, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(gMain.nodes[0]).toBe(0);
        expect(gFloat.nodes[0]).not.toBe(0);

        const iMain = results.currents.get('R1') || 0;
        const iFloat = results.currents.get('R2') || 0;
        expect(iMain).toBeCloseTo(1, 6);
        expect(iFloat).toBeCloseTo(1, 6);
    });
});
