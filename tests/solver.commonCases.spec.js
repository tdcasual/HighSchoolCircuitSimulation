import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver common circuit cases', () => {
    it('keeps divider voltage unchanged with an ideal voltmeter', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const rTop = addComponent(circuit, 'Resistor', 'Rtop', { resistance: 100 });
        const rBottom = addComponent(circuit, 'Resistor', 'Rbottom', { resistance: 100 });
        const vm = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: Infinity, range: 15 });

        connectWire(circuit, 'W1', source, 0, rTop, 0);
        connectWire(circuit, 'W2', rTop, 1, rBottom, 0);
        connectWire(circuit, 'W3', rBottom, 1, source, 1);
        connectWire(circuit, 'W4', vm, 0, rTop, 1);
        connectWire(circuit, 'W5', vm, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const vMid = results.voltages[rTop.nodes[1]] || 0;
        expect(vMid).toBeCloseTo(6, 6);
        expect(results.currents.get('VM1') || 0).toBe(0);
    });

    it('keeps near-zero voltage drop on an ideal ammeter in series', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0, range: 3 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, ammeter, 0);
        connectWire(circuit, 'W2', ammeter, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const iResistor = results.currents.get('R1') || 0;
        const iAmmeter = results.currents.get('A1') || 0;
        expect(iResistor).toBeCloseTo(0.12, 6);
        expect(Math.abs(iAmmeter)).toBeCloseTo(Math.abs(iResistor), 6);

        const vDropAmmeter = (results.voltages[ammeter.nodes[0]] || 0) - (results.voltages[ammeter.nodes[1]] || 0);
        expect(Math.abs(vDropAmmeter)).toBeLessThan(1e-9);
    });

    it('satisfies KCL on a two-branch parallel load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 200 });

        connectWire(circuit, 'W1', source, 0, r1, 0);
        connectWire(circuit, 'W2', source, 0, r2, 0);
        connectWire(circuit, 'W3', r1, 1, source, 1);
        connectWire(circuit, 'W4', r2, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const iR1 = results.currents.get('R1') || 0;
        const iR2 = results.currents.get('R2') || 0;
        const iSource = results.currents.get('V1') || 0;
        expect(iR1).toBeCloseTo(0.12, 6);
        expect(iR2).toBeCloseTo(0.06, 6);
        expect(iSource).toBeCloseTo(iR1 + iR2, 6);
    });

    it('reports invalid for conflicting ideal voltage sources in parallel', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 12, internalResistance: 0 });

        connectWire(circuit, 'W1', v1, 0, v2, 0);
        connectWire(circuit, 'W2', v1, 1, v2, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(false);
    });

    it('does not false-positive short detection on heavy but valid load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0.5 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 0.5 });

        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(12, 6);
    });
});
