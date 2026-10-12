import { describe, expect, it } from 'vitest';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 AC RMS', () => {
    it('matches production instantaneous current and RMS over one cycle', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.001;
        const source = addComponent(circuit, 'ACVoltageSource', 'VAC', {
            rmsVoltage: 10,
            frequency: 50,
            phase: 0,
            offset: 0,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const samples = [];
        let state = new SimulationStateV2();
        const period = 1 / 50;
        const dt = 0.001;
        for (let simTime = 0; simTime < period; simTime += dt) {
            const production = solveCircuit(circuit, simTime);
            const v2 = solveV2FromCircuit(circuit, { dt, simTime, state });
            state = v2.result.nextState;
            expect(v2.result.valid).toBe(true);
            expect(v2.result.currents.get('R1')).toBeCloseTo(production.currents.get('R1'), 6);
            samples.push(v2.result.currents.get('R1') || 0);
        }

        const meanSquare = samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
        const rms = Math.sqrt(meanSquare);
        expect(rms).toBeCloseTo(1, 2);
    });
});
