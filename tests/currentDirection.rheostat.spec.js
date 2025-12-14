import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Rheostat terminal flow analysis', () => {
    it('tracks slider direction changes so that wire animation stays coherent', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const rheo = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 200,
            position: 0.25
        });
        const load = addComponent(circuit, 'Resistor', 'Load', { resistance: 100 });

        const supplyToRheo = connectWire(circuit, 'Wr-source', source, 0, rheo, 0);
        const sliderToLoad = connectWire(circuit, 'Wr-slider', rheo, 2, load, 0);
        const loadToReturn = connectWire(circuit, 'Wr-return', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const forward = circuit.getWireCurrentInfo(supplyToRheo, results);
        const sliderFlow = circuit.getWireCurrentInfo(sliderToLoad, results);
        const returnFlow = circuit.getWireCurrentInfo(loadToReturn, results);

        expect(forward.flowDirection).toBe(1);
        expect(sliderFlow.flowDirection).toBe(1);
        expect(returnFlow.flowDirection).toBe(1);

        expect(forward.current).toBeCloseTo(sliderFlow.current, 5);
        expect(sliderFlow.current).toBeCloseTo(returnFlow.current, 5);
        expect(sliderFlow.current).toBeCloseTo(0.08, 4);
    });

    it('honors minResistance when used as a 2-terminal rheostat (left-slider)', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const rheo = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 10,
            maxResistance: 110,
            position: 0
        });
        const load = addComponent(circuit, 'Resistor', 'Load', { resistance: 100 });

        const supplyToRheo = connectWire(circuit, 'Wr-source', source, 0, rheo, 0);
        const sliderToLoad = connectWire(circuit, 'Wr-slider', rheo, 2, load, 0);
        const loadToReturn = connectWire(circuit, 'Wr-return', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const forward = circuit.getWireCurrentInfo(supplyToRheo, results);
        const sliderFlow = circuit.getWireCurrentInfo(sliderToLoad, results);
        const returnFlow = circuit.getWireCurrentInfo(loadToReturn, results);

        // Expected: I = 12 / (100 + 10) = 0.109090...
        expect(sliderFlow.current).toBeCloseTo(12 / 110, 6);
        expect(forward.current).toBeCloseTo(sliderFlow.current, 8);
        expect(returnFlow.current).toBeCloseTo(sliderFlow.current, 8);
    });
});
