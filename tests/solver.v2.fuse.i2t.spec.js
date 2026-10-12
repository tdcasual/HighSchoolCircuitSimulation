import { describe, expect, it } from 'vitest';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 fuse I²t', () => {
    it('defaults the threshold to ratedCurrent²·0.2 and blows on the next solve', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const fuse = addComponent(circuit, 'Fuse', 'F1', {
            ratedCurrent: 1,
            coldResistance: 0.05,
            blownResistance: 1e12,
            blown: false,
            i2tAccum: 0
        });
        delete fuse.i2tThreshold;
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 2 });

        connectWire(circuit, 'W1', source, 0, fuse, 0);
        connectWire(circuit, 'W2', fuse, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        let state = new SimulationStateV2();
        const first = solveV2FromCircuit(circuit, { dt: 0.01, state });
        expect(first.result.valid).toBe(true);
        // 10 V / ~2.05 Ω → I ≈ 4.88 A, I²·dt ≈ 0.24 ≥ 0.2, but this matrix still uses cold R.
        expect(first.result.currents.get('F1')).toBeGreaterThan(4);
        expect(first.result.nextState.get('F1').blown).toBe(true);
        expect(first.result.nextState.get('F1').i2tAccum).toBeGreaterThanOrEqual(0.2);

        const second = solveV2FromCircuit(circuit, { dt: 0.01, state: first.result.nextState });
        expect(second.result.valid).toBe(true);
        expect(Math.abs(second.result.currents.get('F1') || 0)).toBeLessThan(1e-6);
    });

    it('treats i2tThreshold=0 as unset and uses the rated-current default', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const fuse = addComponent(circuit, 'Fuse', 'F1', {
            ratedCurrent: 1,
            i2tThreshold: 0,
            coldResistance: 0.05,
            blown: false
        });
        addComponent(circuit, 'Resistor', 'R1', { resistance: 2 });
        connectWire(circuit, 'W1', source, 0, fuse, 0);
        connectWire(circuit, 'W2', fuse, 1, 'R1', 0);
        connectWire(circuit, 'W3', 'R1', 1, source, 1);

        const { result } = solveV2FromCircuit(circuit, { dt: 0.01 });
        expect(result.nextState.get('F1').blown).toBe(true);
    });
});
