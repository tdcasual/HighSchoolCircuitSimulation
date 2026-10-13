import { describe, expect, it } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';
import { limitJunctionStep, resolveJunctionParameters, solveJunctionCurrent } from '../src/v2/simulation/JunctionModelV2.js';
import { solveCircuitV2 } from '../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
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

    it('solves LED forward current around Vf=2 V and clamps reverse leakage', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 0 });
        addComponent(circuit, 'LED', 'LED1', { forwardVoltage: 2, onResistance: 2, ratedCurrent: 0.02 });
        addComponent(circuit, 'Resistor', 'R1', { resistance: 50 });
        connectWire(circuit, 'W1', source, 0, 'LED1', 0);
        connectWire(circuit, 'W2', 'LED1', 1, 'R1', 0);
        connectWire(circuit, 'W3', 'R1', 1, source, 1);

        const forward = solveV2FromCircuit(circuit).result;
        expect(forward.valid).toBe(true);
        expect(forward.currents.get('LED1')).toBeGreaterThan(0.01);

        source.voltage = -5;
        const reverse = solveV2FromCircuit(circuit).result;
        expect(reverse.valid).toBe(true);
        expect(Math.abs(reverse.currents.get('LED1') || 0)).toBeLessThan(1e-9);
    });

    it('limitJunctionStep clamps a huge predicted step instead of jumping to vNew', () => {
        const params = resolveJunctionParameters({ type: 'Diode' });
        const limited = limitJunctionStep(10, 0, params);
        expect(Number.isFinite(limited)).toBe(true);
        expect(limited).toBeLessThan(1);
        expect(limited).toBeGreaterThan(0);
    });

    it('starts a default battery wired straight to a default LED', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const led = addComponent(circuit, 'LED', 'D1', {});
        connectWire(circuit, 'W1', source, 0, led, 0);
        connectWire(circuit, 'W2', led, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(0.5);
    });

    it('starts a default battery wired straight to a default diode', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(1);
    });

    it('bisects Shockley plus dialog-minimum series R to the independent forward root', () => {
        const params = resolveJunctionParameters({ type: 'Diode', onResistance: 1e-9 });
        expect(solveJunctionCurrent(0.88297692942, params)).toBeCloseTo(0.05091565244, 8);
        expect(solveJunctionCurrent(-6, params)).toBeCloseTo(-params.saturationCurrent, 12);
    });

    it('starts a default battery, 100 ohm, and a diode at dialog-minimum on-resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        const current = Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0);
        expect(current).toBeGreaterThan(0.04);
        expect(current).toBeLessThan(0.06);
    });

    it('starts a default battery, 100 ohm, and an LED at dialog-minimum on-resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const led = addComponent(circuit, 'LED', 'D1', { onResistance: 1e-9 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, led, 0);
        connectWire(circuit, 'W2', led, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        const current = Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0);
        expect(current).toBeGreaterThan(0.03);
        expect(current).toBeLessThan(0.05);
    });

    it('returns not_converged when Newton hits 40 iterations without settling', () => {
        const result = solveCircuitV2({
            meta: { version: 2 },
            nodes: [{ id: '0' }, { id: '1' }, { id: '2' }],
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    nodes: [1, 0],
                    params: { voltage: 12, internalResistance: 0 }
                },
                {
                    id: 'D1',
                    type: 'Diode',
                    nodes: [1, 2],
                    params: { idealityFactor: 1e-12, forwardVoltage: 0.7, onResistance: 1 }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    nodes: [2, 0],
                    params: { resistance: 100 }
                }
            ]
        }, new SimulationStateV2(), { dt: 0.01 });

        expect(result.valid).toBe(false);
        expect(result.diagnostics.code).toBe('not_converged');
        expect(result.voltages.length).toBeGreaterThan(1);
        expect(result.currents.has('D1')).toBe(true);
    });
});
