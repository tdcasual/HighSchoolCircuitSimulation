import { describe, expect, it } from 'vitest';
import { DefaultStampRegistryV2 } from '../src/v2/simulation/StampRegistryV2.js';
import { assignVoltageSourceIndices, normalizeComponent } from '../src/v2/simulation/SolveCircuitV2.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

function recordStamp(resistance) {
    const calls = [];
    const record = (name) => (...args) => { calls.push({ name, args }); };
    DefaultStampRegistryV2.get('Ammeter').stamp(
        {
            id: 'A1',
            type: 'Ammeter',
            nodes: [1, 2],
            vsIndex: 0,
            resistance
        },
        {
            stampResistor: record('stampResistor'),
            stampVoltageSource: record('stampVoltageSource'),
            stampCurrentSource: record('stampCurrentSource'),
            stampSeriesVoltageSource: record('stampSeriesVoltageSource')
        },
        { i1: 0, i2: 1, n1: 1, n2: 2, nodeCount: 3, isValidNode: (n) => n >= 0 }
    );
    return calls.map((call) => call.name);
}

describe('SolveCircuitV2 ammeter r<=0 threshold', () => {
    it('stamps an ideal voltage source only when r<=0', () => {
        expect(recordStamp(0)).toEqual(['stampVoltageSource']);
        expect(recordStamp(1e-12)).toEqual(['stampResistor']);
        expect(recordStamp(1e-9)).toEqual(['stampResistor']);
    });

    it('solves r=0 as an ideal series ammeter and r>0 as a resistor', () => {
        const circuitIdeal = createTestCircuit();
        const source = addComponent(circuitIdeal, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        addComponent(circuitIdeal, 'Ammeter', 'A1', { resistance: 0 });
        addComponent(circuitIdeal, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuitIdeal, 'W1', source, 0, 'A1', 0);
        connectWire(circuitIdeal, 'W2', 'A1', 1, 'R1', 0);
        connectWire(circuitIdeal, 'W3', 'R1', 1, source, 1);

        const production = solveCircuit(circuitIdeal);
        const ideal = solveV2FromCircuit(circuitIdeal).result;
        expect(ideal.valid).toBe(true);
        expect(Math.abs(ideal.currents.get('A1'))).toBeCloseTo(0.12, 6);
        expect(ideal.currents.get('A1')).toBeCloseTo(production.currents.get('A1'), 6);

        const circuitResistive = createTestCircuit();
        const src = addComponent(circuitResistive, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        addComponent(circuitResistive, 'Ammeter', 'A1', { resistance: 1 });
        addComponent(circuitResistive, 'Resistor', 'R1', { resistance: 99 });
        connectWire(circuitResistive, 'W1', src, 0, 'A1', 0);
        connectWire(circuitResistive, 'W2', 'A1', 1, 'R1', 0);
        connectWire(circuitResistive, 'W3', 'R1', 1, src, 1);
        const resistive = solveV2FromCircuit(circuitResistive).result;
        expect(resistive.valid).toBe(true);
        expect(resistive.currents.get('A1')).toBeCloseTo(0.12, 6);

        const tiny = normalizeComponent({
            id: 'A1',
            type: 'Ammeter',
            nodes: [1, 0],
            params: { resistance: 1e-12 }
        }, 0);
        const idealComp = normalizeComponent({
            id: 'A0',
            type: 'Ammeter',
            nodes: [1, 0],
            params: { resistance: 0 }
        }, 0);
        assignVoltageSourceIndices([tiny]);
        assignVoltageSourceIndices([idealComp]);
        expect(tiny.vsIndex).toBeUndefined();
        expect(idealComp.vsIndex).toBe(0);
    });
});
