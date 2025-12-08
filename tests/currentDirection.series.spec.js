import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Series branch current direction', () => {
    it('propagates consistently through every ideal wire segment', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });

        const w1 = connectWire(circuit, 'W1', source, 0, r1, 0);
        const w2 = connectWire(circuit, 'W2', r1, 1, r2, 0);
        const w3 = connectWire(circuit, 'W3', r2, 1, source, 1);

        const results = solveCircuit(circuit);

        expect(results.valid).toBe(true);
        const infoBetweenResistors = circuit.getWireCurrentInfo(w2, results);
        expect(infoBetweenResistors.flowDirection).toBe(1);
        expect(infoBetweenResistors.current).toBeGreaterThan(0);
        expect(infoBetweenResistors.current).toBeCloseTo(0.06, 5);

        const infoFromSource = circuit.getWireCurrentInfo(w1, results);
        expect(infoFromSource.flowDirection).toBe(1);
        expect(infoFromSource.current).toBeCloseTo(infoBetweenResistors.current, 5);

        const returnInfo = circuit.getWireCurrentInfo(w3, results);
        expect(returnInfo.flowDirection).toBe(1);
        expect(returnInfo.current).toBeCloseTo(infoBetweenResistors.current, 5);
    });
});
