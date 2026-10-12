import { describe, expect, it } from 'vitest';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { DefaultStampRegistryV2 } from '../src/v2/simulation/StampRegistryV2.js';
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

    it('falls back to a resistor stamp of Ra when vsIndex is absent', () => {
        const calls = [];
        const record = (name) => (...args) => { calls.push({ name, args }); };
        const motor = {
            id: 'M1',
            type: 'Motor',
            nodes: [1, 0],
            resistance: 5,
            vsIndex: undefined
        };
        DefaultStampRegistryV2.get('Motor').stamp(
            motor,
            {
                stampResistor: record('stampResistor'),
                stampSeriesVoltageSource: record('stampSeriesVoltageSource')
            },
            { i1: 0, i2: null, n1: 1, n2: 0, nodeCount: 2, isValidNode: (n) => n >= 0 }
        );
        expect(calls).toEqual([{ name: 'stampResistor', args: [0, null, 5] }]);

        const current = DefaultStampRegistryV2.get('Motor').current(
            motor,
            { voltage: (node) => (node === 1 ? 6 : 0), solveVector: [], nodeCount: 2 },
            { n1: 1, n2: 0, nodeCount: 2 }
        );
        expect(current).toBeCloseTo(1.2, 12);
    });

    it('raises backEmf and drops current after a few dt steps', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        addComponent(circuit, 'Motor', 'M1', {
            resistance: 5,
            loadTorque: 0
        });
        connectWire(circuit, 'W1', source, 0, 'M1', 0);
        connectWire(circuit, 'W2', 'M1', 1, source, 1);

        let state = new SimulationStateV2();
        const first = solveV2FromCircuit(circuit, { dt: 0.01, state });
        expect(first.result.currents.get('M1')).toBeCloseTo(1.2, 6);
        expect(first.result.nextState.get('M1').backEmf).toBeGreaterThan(0);

        let nextState = first.result.nextState;
        for (let step = 0; step < 8; step += 1) {
            const stepped = solveV2FromCircuit(circuit, { dt: 0.01, state: nextState });
            nextState = stepped.result.nextState;
        }
        expect(nextState.get('M1').backEmf).toBeGreaterThan(first.result.nextState.get('M1').backEmf);
        const later = solveV2FromCircuit(circuit, { dt: 0.01, state: nextState });
        expect(later.result.currents.get('M1')).toBeGreaterThan(0);
        expect(later.result.currents.get('M1')).toBeLessThan(1.2);
    });
});
