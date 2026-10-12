import { describe, expect, it } from 'vitest';
import { DefaultStampRegistryV2 } from '../src/v2/simulation/StampRegistryV2.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

function recordRheostat(mode) {
    const calls = [];
    const record = (name) => (...args) => { calls.push({ name, args }); };
    DefaultStampRegistryV2.get('Rheostat').stamp(
        {
            id: 'RH1',
            type: 'Rheostat',
            nodes: [1, 2, 3],
            minResistance: 0,
            maxResistance: 100,
            position: 0.5,
            connectionMode: mode
        },
        { stampResistor: record('stampResistor') },
        {
            n1: 1,
            n2: 2,
            i1: 0,
            i2: 1,
            nodeCount: 4,
            isValidNode: (n) => Number.isInteger(n) && n >= 0
        }
    );
    return calls;
}

describe('SolveCircuitV2 rheostat slider-only', () => {
    it('keeps slider-only as a distinct mode string and does not stamp', () => {
        expect(recordRheostat('slider-only')).toEqual([]);
        expect(recordRheostat('none')).toEqual([]);
        expect(recordRheostat('left-slider')).toEqual([
            { name: 'stampResistor', args: [0, 2, 50] }
        ]);
    });

    it('round-trips slider-only through topology and solves with zero rheostat current', () => {
        const circuit = createTestCircuit();
        addComponent(circuit, 'Ground', 'GND', {}, { x: 100, y: 220 });
        addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        }, { x: 100, y: 100 });
        addComponent(circuit, 'Rheostat', 'RH1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        }, { x: 300, y: 100 });
        connectWire(circuit, 'W1', 'V1', 0, 'RH1', 2);
        connectWire(circuit, 'W2', 'V1', 1, 'GND', 0);

        const { dto, result } = solveV2FromCircuit(circuit);
        const rh = dto.components.find((item) => item.id === 'RH1');
        expect(rh.params.connectionMode).toBe('slider-only');
        expect(rh.params.connectionMode).not.toBe('none');
        expect(result.valid).toBe(true);
        expect(result.currents.get('RH1')).toBe(0);
    });
});
