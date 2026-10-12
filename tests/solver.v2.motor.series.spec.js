import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 motor series Ra+E', () => {
    it('stalls at V/Ra with current taken as-is from the extra unknown', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const motor = addComponent(circuit, 'Motor', 'M1', { resistance: 5 });
        connectWire(circuit, 'W1', source, 0, motor, 0);
        connectWire(circuit, 'W2', motor, 1, source, 1);

        const production = solveCircuit(circuit);
        const { result } = solveV2FromCircuit(circuit);

        expect(production.valid).toBe(true);
        expect(result.valid).toBe(true);
        expect(production.currents.get('M1')).toBeCloseTo(1.2, 6);
        expect(result.currents.get('M1')).toBeCloseTo(1.2, 6);
        expect(result.currents.get('M1')).toBeGreaterThan(0);
        expect(result.currents.get('V1')).toBeCloseTo(1.2, 6);
    });
});
