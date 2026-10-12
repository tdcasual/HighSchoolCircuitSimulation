import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 SPDT series VS', () => {
    it('routes current through the selected throw without negating the extra unknown', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const spdt = addComponent(circuit, 'SPDTSwitch', 'SW1', {
            position: 'a',
            onResistance: 1e-9,
            offResistance: 1e12
        });
        const topResistor = addComponent(circuit, 'Resistor', 'Rtop', { resistance: 10 });
        const bottomResistor = addComponent(circuit, 'Resistor', 'Rbottom', { resistance: 20 });

        connectWire(circuit, 'W1', source, 0, spdt, 0);
        connectWire(circuit, 'W2', spdt, 1, topResistor, 0);
        connectWire(circuit, 'W3', topResistor, 1, source, 1);
        connectWire(circuit, 'W4', spdt, 2, bottomResistor, 0);
        connectWire(circuit, 'W5', bottomResistor, 1, source, 1);

        const productionA = solveCircuit(circuit);
        const v2A = solveV2FromCircuit(circuit).result;
        expect(v2A.valid).toBe(true);
        expect(v2A.currents.get('Rtop')).toBeCloseTo(1, 6);
        expect(Math.abs(v2A.currents.get('Rbottom') || 0)).toBeLessThan(1e-6);
        expect(v2A.currents.get('SW1')).toBeCloseTo(1, 6);
        expect(v2A.currents.get('SW1')).toBeCloseTo(productionA.currents.get('SW1'), 6);

        spdt.position = 'b';
        const productionB = solveCircuit(circuit);
        const v2B = solveV2FromCircuit(circuit).result;
        expect(v2B.valid).toBe(true);
        expect(Math.abs(v2B.currents.get('Rtop') || 0)).toBeLessThan(1e-6);
        expect(v2B.currents.get('Rbottom')).toBeCloseTo(0.5, 6);
        expect(v2B.currents.get('SW1')).toBeCloseTo(0.5, 6);
        expect(v2B.currents.get('SW1')).toBeCloseTo(productionB.currents.get('SW1'), 6);
    });
});
