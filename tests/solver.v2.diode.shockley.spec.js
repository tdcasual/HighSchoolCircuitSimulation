import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 Shockley junction', () => {
    it('keeps diode I-V transition continuous around the forward knee', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0.7, internalResistance: 0 });
        const diode = addComponent(circuit, 'Diode', 'D1');
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const readCurrentAt = (voltage) => {
            source.voltage = voltage;
            const { result } = solveV2FromCircuit(circuit);
            expect(result.valid).toBe(true);
            return Math.abs(result.currents.get('D1') || 0);
        };

        const iLow = readCurrentAt(0.69);
        const iHigh = readCurrentAt(0.71);

        expect(iLow).toBeGreaterThan(0);
        expect(iHigh).toBeGreaterThan(iLow);
        expect(iHigh / iLow).toBeLessThan(1e4);
    });

    it('limits reverse diode leakage to microamp-level instead of ohmic reverse conduction', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const diode = addComponent(circuit, 'Diode', 'D1');
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, diode, 1);
        connectWire(circuit, 'W2', diode, 0, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const production = solveCircuit(circuit);
        const { result } = solveV2FromCircuit(circuit);
        expect(result.valid).toBe(true);
        expect(production.valid).toBe(true);

        const reverseCurrent = Math.abs(result.currents.get('D1') || 0);
        expect(reverseCurrent).toBeGreaterThan(0);
        expect(reverseCurrent).toBeLessThan(1e-9);
        expect(reverseCurrent).toBeCloseTo(Math.abs(production.currents.get('D1') || 0), 12);
    });
});
