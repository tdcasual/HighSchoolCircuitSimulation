import { describe, expect, it } from 'vitest';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

function buildFuseCircuit({ ratedCurrent, loadResistance, i2tThreshold }) {
    const circuit = createTestCircuit();
    circuit.dt = 0.01;
    const source = addComponent(circuit, 'PowerSource', 'V1', {
        voltage: 10,
        internalResistance: 0
    });
    const fuseProps = {
        ratedCurrent,
        coldResistance: 0.05,
        blownResistance: 1e12,
        blown: false,
        i2tAccum: 0
    };
    if (i2tThreshold === undefined) {
        // leave unset so DynamicUpdateV2 uses rated²·0.2
    } else {
        fuseProps.i2tThreshold = i2tThreshold;
    }
    const fuse = addComponent(circuit, 'Fuse', 'F1', fuseProps);
    if (i2tThreshold === undefined) {
        delete fuse.i2tThreshold;
    }
    addComponent(circuit, 'Resistor', 'R1', { resistance: loadResistance });
    connectWire(circuit, 'W1', source, 0, fuse, 0);
    connectWire(circuit, 'W2', fuse, 1, 'R1', 0);
    connectWire(circuit, 'W3', 'R1', 1, source, 1);
    return circuit;
}

describe('SolveCircuitV2 fuse I²t', () => {
    it('defaults the threshold to ratedCurrent²·0.2 and does not blow below it', () => {
        // rated=2 → squared default 0.8, linear default 0.4. I²·dt sits in (0.4, 0.8).
        const circuit = buildFuseCircuit({ ratedCurrent: 2, loadResistance: 1.28 });
        const first = solveV2FromCircuit(circuit, { dt: 0.01, state: new SimulationStateV2() });
        expect(first.result.valid).toBe(true);

        const current = first.result.currents.get('F1');
        const expectedAccum = current * current * 0.01;
        expect(current).toBeGreaterThan(6.32);
        expect(current).toBeLessThan(8.94);
        expect(expectedAccum).toBeGreaterThan(0.4);
        expect(expectedAccum).toBeLessThan(0.8);
        expect(first.result.nextState.get('F1').i2tAccum).toBeCloseTo(expectedAccum, 8);
        expect(first.result.nextState.get('F1').blown).toBe(false);
    });

    it('blows on the next solve once I²t crosses ratedCurrent²·0.2', () => {
        const circuit = buildFuseCircuit({ ratedCurrent: 2, loadResistance: 1.05 });
        const first = solveV2FromCircuit(circuit, { dt: 0.01, state: new SimulationStateV2() });
        expect(first.result.valid).toBe(true);

        const current = first.result.currents.get('F1');
        const expectedAccum = current * current * 0.01;
        expect(expectedAccum).toBeGreaterThan(0.8);
        expect(first.result.currents.get('F1')).toBeGreaterThan(8.94);
        expect(first.result.nextState.get('F1').blown).toBe(true);
        expect(first.result.nextState.get('F1').i2tAccum).toBeCloseTo(expectedAccum, 8);

        const second = solveV2FromCircuit(circuit, { dt: 0.01, state: first.result.nextState });
        expect(second.result.valid).toBe(true);
        expect(Math.abs(second.result.currents.get('F1') || 0)).toBeLessThan(1e-6);
    });

    it('treats i2tThreshold=0 as unset and uses the rated-current default', () => {
        const circuit = buildFuseCircuit({
            ratedCurrent: 2,
            loadResistance: 1.28,
            i2tThreshold: 0
        });
        const first = solveV2FromCircuit(circuit, { dt: 0.01, state: new SimulationStateV2() });
        expect(first.result.valid).toBe(true);

        const current = first.result.currents.get('F1');
        const expectedAccum = current * current * 0.01;
        expect(expectedAccum).toBeGreaterThan(0.4);
        expect(expectedAccum).toBeLessThan(0.8);
        expect(first.result.nextState.get('F1').i2tAccum).toBeCloseTo(expectedAccum, 8);
        expect(first.result.nextState.get('F1').blown).toBe(false);
    });
});
