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
});
