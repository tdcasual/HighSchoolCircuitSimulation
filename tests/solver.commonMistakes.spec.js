import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver common wiring mistakes', () => {
    it('treats a series voltmeter as an open circuit (near-zero current)', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const voltmeter = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: Infinity, range: 15 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, voltmeter, 0);
        connectWire(circuit, 'W3', voltmeter, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const iResistor = results.currents.get('R1') || 0;
        const iVoltmeter = results.currents.get('VM1') || 0;
        expect(Math.abs(iResistor)).toBeLessThan(1e-9);
        expect(Math.abs(iVoltmeter)).toBeLessThan(1e-9);
    });

    it('flags a parallel ammeter as a near-short across the source', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0.5 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0, range: 3 });

        // Load across the source.
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        // Ammeter mistakenly wired in parallel across the source.
        connectWire(circuit, 'W3', source, 0, ammeter, 0);
        connectWire(circuit, 'W4', ammeter, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(true);

        const iAmmeter = Math.abs(results.currents.get('A1') || 0);
        const iLoad = Math.abs(results.currents.get('R1') || 0);
        expect(iAmmeter).toBeCloseTo(24, 2);
        expect(iLoad).toBeLessThan(1e-3);
    });

    it('accounts for ammeter internal resistance in series', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 1, range: 3 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, ammeter, 0);
        connectWire(circuit, 'W2', ammeter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedCurrent = 12 / 101;
        const iLoad = results.currents.get('R1') || 0;
        const iAmmeter = results.currents.get('A1') || 0;
        expect(iLoad).toBeCloseTo(expectedCurrent, 6);
        expect(iAmmeter).toBeCloseTo(expectedCurrent, 6);

        const vDropAmmeter = (results.voltages[ammeter.nodes[0]] || 0) - (results.voltages[ammeter.nodes[1]] || 0);
        expect(Math.abs(vDropAmmeter)).toBeCloseTo(expectedCurrent * ammeter.resistance, 6);
    });

    it('shows divider sag when voltmeter has finite resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const rTop = addComponent(circuit, 'Resistor', 'Rtop', { resistance: 100 });
        const rBottom = addComponent(circuit, 'Resistor', 'Rbottom', { resistance: 100 });
        const voltmeter = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: 200, range: 15 });

        connectWire(circuit, 'W1', source, 0, rTop, 0);
        connectWire(circuit, 'W2', rTop, 1, rBottom, 0);
        connectWire(circuit, 'W3', rBottom, 1, source, 1);
        connectWire(circuit, 'W4', voltmeter, 0, rTop, 1);
        connectWire(circuit, 'W5', voltmeter, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const rBottomLoaded = (100 * 200) / (100 + 200);
        const expectedMid = 12 * (rBottomLoaded / (100 + rBottomLoaded));
        const vMid = results.voltages[rTop.nodes[1]] || 0;
        expect(vMid).toBeCloseTo(expectedMid, 6);

        const iVoltmeter = Math.abs(results.currents.get('VM1') || 0);
        expect(iVoltmeter).toBeGreaterThan(0.02);
    });

    it('keeps current near zero when a series switch is left open', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: false });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, sw, 0);
        connectWire(circuit, 'W2', sw, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const iLoad = Math.abs(results.currents.get('R1') || 0);
        expect(iLoad).toBeLessThan(1e-9);
    });

    it('bypasses the load when a parallel switch is closed', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const limiter = addComponent(circuit, 'Resistor', 'Rlim', { resistance: 10 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 100 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: true });

        connectWire(circuit, 'W1', source, 0, limiter, 0);
        connectWire(circuit, 'W2', limiter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);
        connectWire(circuit, 'W4', limiter, 1, sw, 0);
        connectWire(circuit, 'W5', sw, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const expectedCurrent = source.voltage / limiter.resistance;
        const iLimiter = Math.abs(results.currents.get('Rlim') || 0);
        const iLoad = Math.abs(results.currents.get('Rload') || 0);
        const vNode = results.voltages[limiter.nodes[1]] || 0;
        expect(iLimiter).toBeCloseTo(expectedCurrent, 6);
        expect(iLoad).toBeLessThan(1e-3);
        expect(Math.abs(vNode)).toBeLessThan(1e-3);
    });

    it('routes current through a parallel ammeter and starves the load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const limiter = addComponent(circuit, 'Resistor', 'Rlim', { resistance: 10 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 100 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0, range: 3 });

        connectWire(circuit, 'W1', source, 0, limiter, 0);
        connectWire(circuit, 'W2', limiter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);
        connectWire(circuit, 'W4', limiter, 1, ammeter, 0);
        connectWire(circuit, 'W5', ammeter, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const expectedCurrent = source.voltage / limiter.resistance;
        const iLimiter = Math.abs(results.currents.get('Rlim') || 0);
        const iLoad = Math.abs(results.currents.get('Rload') || 0);
        const iAmmeter = Math.abs(results.currents.get('A1') || 0);
        expect(iLimiter).toBeCloseTo(expectedCurrent, 6);
        expect(iAmmeter).toBeCloseTo(expectedCurrent, 6);
        expect(iLoad).toBeLessThan(1e-3);
    });

    it('reduces current when a finite-resistance voltmeter is placed in series', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const voltmeter = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: 1000, range: 15 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, voltmeter, 0);
        connectWire(circuit, 'W2', voltmeter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedCurrent = source.voltage / (voltmeter.resistance + load.resistance);
        const iLoad = results.currents.get('R1') || 0;
        const iVoltmeter = results.currents.get('VM1') || 0;
        expect(iLoad).toBeCloseTo(expectedCurrent, 6);
        expect(iVoltmeter).toBeCloseTo(expectedCurrent, 6);

        const vDropVm = (results.voltages[voltmeter.nodes[0]] || 0)
            - (results.voltages[voltmeter.nodes[1]] || 0);
        expect(Math.abs(vDropVm)).toBeCloseTo(expectedCurrent * voltmeter.resistance, 6);
    });
});

describe('Rheostat connection modes', () => {
    it('uses R2 when wired as right-slider', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const rheo = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.25,
            connectionMode: 'right-slider'
        });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 25 });

        connectWire(circuit, 'W1', source, 0, rheo, 2);
        connectWire(circuit, 'W2', rheo, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedCurrent = 12 / (75 + 25);
        const iLoad = Math.abs(results.currents.get('R1') || 0);
        const iRheo = Math.abs(results.currents.get('Rh1') || 0);
        expect(iLoad).toBeCloseTo(expectedCurrent, 6);
        expect(iRheo).toBeCloseTo(expectedCurrent, 6);
    });

    it('keeps left-right mode current independent of slider position', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const rheo = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.1,
            connectionMode: 'left-right'
        });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, rheo, 0);
        connectWire(circuit, 'W2', rheo, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        const resultsA = solveCircuit(circuit);
        const expectedCurrent = 12 / 200;
        const iLoadA = Math.abs(resultsA.currents.get('R1') || 0);
        expect(iLoadA).toBeCloseTo(expectedCurrent, 6);

        rheo.position = 0.9;
        const resultsB = solveCircuit(circuit);
        const iLoadB = Math.abs(resultsB.currents.get('R1') || 0);
        expect(iLoadB).toBeCloseTo(expectedCurrent, 6);
    });

    it('produces the expected divider voltage in all-terminal mode', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const rheo = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.25,
            connectionMode: 'all'
        });
        const probe = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: Infinity, range: 15 });

        connectWire(circuit, 'W1', source, 0, rheo, 0);
        connectWire(circuit, 'W2', source, 1, rheo, 1);
        connectWire(circuit, 'W3', rheo, 2, probe, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const vSlider = results.voltages[rheo.nodes[2]] || 0;
        expect(vSlider).toBeCloseTo(9, 6);
    });
});
