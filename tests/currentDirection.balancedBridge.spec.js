import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Wire flow on balanced bridge ties', () => {
    it('shows zero current on a bridge wire between equipotential midpoints', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0.5
        });

        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });
        const r3 = addComponent(circuit, 'Resistor', 'R3', { resistance: 100 });
        const r4 = addComponent(circuit, 'Resistor', 'R4', { resistance: 100 });

        // Two identical series strings in parallel. The midpoint tie between the two right resistors
        // (r2.0 <-> r4.0) connects equipotential points, so its current should be 0.
        connectWire(circuit, 'Wp1', source, 0, r1, 0);
        connectWire(circuit, 'Wp2', source, 0, r3, 0);

        const wMidTop = connectWire(circuit, 'WmidTop', r1, 1, r2, 0);
        const wMidBot = connectWire(circuit, 'WmidBot', r3, 1, r4, 0);
        const wBridge = connectWire(circuit, 'Wbridge', r2, 0, r4, 0);

        connectWire(circuit, 'Wn1', r2, 1, source, 1);
        connectWire(circuit, 'Wn2', r4, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedBranchCurrent = results.currents.get('R1') || 0;
        expect(expectedBranchCurrent).toBeGreaterThan(0);

        const topInfo = circuit.getWireCurrentInfo(wMidTop, results);
        const botInfo = circuit.getWireCurrentInfo(wMidBot, results);
        const bridgeInfo = circuit.getWireCurrentInfo(wBridge, results);

        expect(topInfo.current).toBeCloseTo(expectedBranchCurrent, 6);
        expect(botInfo.current).toBeCloseTo(expectedBranchCurrent, 6);
        expect(topInfo.flowDirection).toBe(1);
        expect(botInfo.flowDirection).toBe(1);

        expect(bridgeInfo.current).toBe(0);
        expect(bridgeInfo.flowDirection).toBe(0);
    });
});

