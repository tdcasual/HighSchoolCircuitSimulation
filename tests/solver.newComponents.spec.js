import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../src/utils/Physics.js';

describe('New component models (Ground / AC source / Inductor / SPDT / Fuse / Diode / LED / Thermistor / Photoresistor)', () => {
    it('uses explicit Ground as reference node (node 0)', () => {
        const circuit = createTestCircuit();
        const ground = addComponent(circuit, 'Ground', 'GND');
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', source, 1, ground, 0);
        connectWire(circuit, 'W2', source, 0, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, ground, 0);

        expect(ground.nodes[0]).toBe(0);
        expect(source.nodes[1]).toBe(0);

        const results = solveCircuit(circuit, 0);
        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(1, 6);
    });

    it('solves ideal AC voltage source using instantaneous value', () => {
        const circuit = createTestCircuit();
        const acSource = addComponent(circuit, 'ACVoltageSource', 'VAC', {
            rmsVoltage: 10,
            frequency: 50,
            phase: 90,
            offset: 0,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', acSource, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, acSource, 1);

        const results = solveCircuit(circuit, 0);
        const expectedPeak = 10 * Math.sqrt(2);
        const expectedCurrent = expectedPeak / 10;

        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(expectedCurrent, 6);
        expect(results.currents.get('VAC')).toBeCloseTo(expectedCurrent, 6);

        const vPlus = results.voltages[acSource.nodes[0]] || 0;
        const vMinus = results.voltages[acSource.nodes[1]] || 0;
        expect(vPlus - vMinus).toBeCloseTo(expectedPeak, 6);
    });

    it('supports AC source with internal resistance via Norton equivalent', () => {
        const circuit = createTestCircuit();
        const acSource = addComponent(circuit, 'ACVoltageSource', 'VAC', {
            rmsVoltage: 10,
            frequency: 50,
            phase: 90,
            offset: 0,
            internalResistance: 2
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });

        connectWire(circuit, 'W1', acSource, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, acSource, 1);

        const results = solveCircuit(circuit, 0);
        const expectedPeak = 10 * Math.sqrt(2);
        const expectedCurrent = expectedPeak / (8 + 2);
        const expectedTerminalVoltage = expectedCurrent * 8;

        expect(results.valid).toBe(true);
        expect(results.currents.get('R1')).toBeCloseTo(expectedCurrent, 6);
        expect(results.currents.get('VAC')).toBeCloseTo(expectedCurrent, 6);

        const vPlus = results.voltages[acSource.nodes[0]] || 0;
        const vMinus = results.voltages[acSource.nodes[1]] || 0;
        expect(vPlus - vMinus).toBeCloseTo(expectedTerminalVoltage, 6);
    });

    it('follows backward-Euler RL recurrence for inductor current', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 1,
            initialCurrent: 0
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        const expectedCurrents = [
            0.0909090909,
            0.1774891775,
            0.2558235415,
            0.3266974900,
            0.3908215385
        ];

        circuit.isRunning = true;
        for (const expectedCurrent of expectedCurrents) {
            circuit.step();
            expect(circuit.lastResults?.valid).toBe(true);
            expect(inductor.currentValue).toBeCloseTo(expectedCurrent, 6);
            expect(inductor.prevCurrent).toBeCloseTo(expectedCurrent, 6);
        }
        circuit.isRunning = false;
    });

    it('resets inductor state from initialCurrent at simulation start', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 1,
            initialCurrent: 0.5,
            prevCurrent: 999
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        circuit.startSimulation();
        circuit.stopSimulation();

        // i1 = (V + (L/dt)*i0) / (R + L/dt)
        // where i0 = initialCurrent = 0.5
        const expectedFirstStepCurrent = (10 + (1 / circuit.dt) * 0.5) / (10 + (1 / circuit.dt));
        circuit.isRunning = true;
        circuit.step();
        circuit.isRunning = false;

        expect(inductor.currentValue).toBeCloseTo(expectedFirstStepCurrent, 6);
    });

    it('routes SPDT switch current through the selected throw', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const spdt = addComponent(circuit, 'SPDTSwitch', 'SW1', {
            position: 'a',
            onResistance: 1e-9,
            offResistance: 1e12
        });
        const topResistor = addComponent(circuit, 'Resistor', 'Rtop', { resistance: 10 });
        const bottomResistor = addComponent(circuit, 'Resistor', 'Rbottom', { resistance: 20 });

        connectWire(circuit, 'W1', source, 0, spdt, 0);
        connectWire(circuit, 'W2', spdt, 1, topResistor, 0);
        connectWire(circuit, 'W3', topResistor, 1, source, 1);
        connectWire(circuit, 'W4', spdt, 2, bottomResistor, 0);
        connectWire(circuit, 'W5', bottomResistor, 1, source, 1);

        let results = solveCircuit(circuit, 0);
        expect(results.valid).toBe(true);
        expect(results.currents.get('Rtop')).toBeCloseTo(1, 6);
        expect(Math.abs(results.currents.get('Rbottom') || 0)).toBeLessThan(1e-6);
        expect(results.currents.get('SW1')).toBeCloseTo(1, 6);

        spdt.position = 'b';
        results = solveCircuit(circuit, 0);
        expect(results.valid).toBe(true);
        expect(Math.abs(results.currents.get('Rtop') || 0)).toBeLessThan(1e-6);
        expect(results.currents.get('Rbottom')).toBeCloseTo(0.5, 6);
        expect(results.currents.get('SW1')).toBeCloseTo(0.5, 6);
    });

    it('blows fuse when accumulated I²t exceeds threshold', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        });
        const fuse = addComponent(circuit, 'Fuse', 'F1', {
            ratedCurrent: 1,
            i2tThreshold: 0.2,
            coldResistance: 0.05,
            blownResistance: 1e12,
            blown: false,
            i2tAccum: 0
        });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 1 });

        connectWire(circuit, 'W1', source, 0, fuse, 0);
        connectWire(circuit, 'W2', fuse, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        circuit.isRunning = true;
        circuit.step();
        expect(fuse.blown).toBe(true);
        expect((fuse.i2tAccum || 0)).toBeGreaterThanOrEqual(0.2);

        circuit.step();
        const fuseCurrent = Math.abs(circuit.lastResults?.currents?.get('F1') || 0);
        expect(fuseCurrent).toBeLessThan(1e-6);
        circuit.isRunning = false;
    });

    it('iterates diode state to forward conduction', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const diode = addComponent(circuit, 'Diode', 'D1', {
            forwardVoltage: 0.7,
            onResistance: 1,
            offResistance: 1e9,
            conducting: false
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, diode, 0); // + to anode
        connectWire(circuit, 'W2', diode, 1, resistor, 0); // cathode to load
        connectWire(circuit, 'W3', resistor, 1, source, 1); // load return to -

        const results = solveCircuit(circuit, 0);
        const expectedCurrent = (5 - 0.7) / (100 + 1);

        expect(results.valid).toBe(true);
        expect(diode.conducting).toBe(true);
        expect(results.currents.get('D1')).toBeCloseTo(expectedCurrent, 6);
        expect(results.currents.get('R1')).toBeCloseTo(expectedCurrent, 6);
    });

    it('keeps diode in cutoff under reverse bias', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const diode = addComponent(circuit, 'Diode', 'D1', {
            forwardVoltage: 0.7,
            onResistance: 1,
            offResistance: 1e9,
            conducting: false
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, diode, 1); // + to cathode (reverse)
        connectWire(circuit, 'W2', diode, 0, resistor, 0); // anode to load
        connectWire(circuit, 'W3', resistor, 1, source, 1); // load return to -

        const results = solveCircuit(circuit, 0);
        const diodeCurrent = results.currents.get('D1') || 0;

        expect(results.valid).toBe(true);
        expect(diode.conducting).toBe(false);
        expect(Math.abs(diodeCurrent)).toBeLessThan(1e-6);
    });

    it('solves LED forward conduction and updates brightness', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 3,
            internalResistance: 0
        });
        const led = addComponent(circuit, 'LED', 'LED1', {
            forwardVoltage: 2.0,
            onResistance: 2,
            offResistance: 1e9,
            ratedCurrent: 0.02,
            conducting: false
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, led, 0);
        connectWire(circuit, 'W2', led, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const results = solveCircuit(circuit, 0);
        const expectedCurrent = (3 - 2) / (100 + 2);

        expect(results.valid).toBe(true);
        expect(led.conducting).toBe(true);
        expect(results.currents.get('LED1')).toBeCloseTo(expectedCurrent, 6);

        circuit.isRunning = true;
        circuit.step();
        circuit.isRunning = false;
        expect(led.brightness).toBeCloseTo(Math.min(1, expectedCurrent / 0.02), 6);
    });

    it('keeps LED off under reverse bias', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const led = addComponent(circuit, 'LED', 'LED1', {
            forwardVoltage: 2.0,
            onResistance: 2,
            offResistance: 1e9,
            ratedCurrent: 0.02,
            conducting: false
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, led, 1);
        connectWire(circuit, 'W2', led, 0, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const results = solveCircuit(circuit, 0);

        expect(results.valid).toBe(true);
        expect(led.conducting).toBe(false);
        expect(Math.abs(results.currents.get('LED1') || 0)).toBeLessThan(1e-6);
    });

    it('solves thermistor branch using Beta model resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const thermistor = addComponent(circuit, 'Thermistor', 'RT1', {
            resistanceAt25: 1000,
            beta: 3950,
            temperatureC: 25
        });

        connectWire(circuit, 'W1', source, 0, thermistor, 0);
        connectWire(circuit, 'W2', thermistor, 1, source, 1);

        const results = solveCircuit(circuit, 0);
        const resistance = computeNtcThermistorResistance(thermistor);
        const expectedCurrent = 5 / resistance;

        expect(results.valid).toBe(true);
        expect(results.currents.get('RT1')).toBeCloseTo(expectedCurrent, 8);
    });

    it('decreases thermistor resistance and increases current at higher temperature', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const thermistor = addComponent(circuit, 'Thermistor', 'RT1', {
            resistanceAt25: 1000,
            beta: 3950,
            temperatureC: 25
        });

        connectWire(circuit, 'W1', source, 0, thermistor, 0);
        connectWire(circuit, 'W2', thermistor, 1, source, 1);

        const coolResults = solveCircuit(circuit, 0);
        const coolCurrent = coolResults.currents.get('RT1') || 0;

        thermistor.temperatureC = 75;
        const hotResults = solveCircuit(circuit, 0);
        const hotCurrent = hotResults.currents.get('RT1') || 0;

        const coolR = computeNtcThermistorResistance({ ...thermistor, temperatureC: 25 });
        const hotR = computeNtcThermistorResistance({ ...thermistor, temperatureC: 75 });

        expect(coolResults.valid).toBe(true);
        expect(hotResults.valid).toBe(true);
        expect(hotR).toBeLessThan(coolR);
        expect(Math.abs(hotCurrent)).toBeGreaterThan(Math.abs(coolCurrent));
    });

    it('solves photoresistor current from light level', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const ldr = addComponent(circuit, 'Photoresistor', 'LDR1', {
            resistanceDark: 100000,
            resistanceLight: 500,
            lightLevel: 0.5
        });

        connectWire(circuit, 'W1', source, 0, ldr, 0);
        connectWire(circuit, 'W2', ldr, 1, source, 1);

        const results = solveCircuit(circuit, 0);
        const resistance = computePhotoresistorResistance(ldr);
        const expectedCurrent = 5 / resistance;

        expect(results.valid).toBe(true);
        expect(results.currents.get('LDR1')).toBeCloseTo(expectedCurrent, 8);
    });

    it('decreases photoresistor resistance and increases current as light grows', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const ldr = addComponent(circuit, 'Photoresistor', 'LDR1', {
            resistanceDark: 100000,
            resistanceLight: 500,
            lightLevel: 0.1
        });

        connectWire(circuit, 'W1', source, 0, ldr, 0);
        connectWire(circuit, 'W2', ldr, 1, source, 1);

        const dimResults = solveCircuit(circuit, 0);
        const dimCurrent = dimResults.currents.get('LDR1') || 0;

        ldr.lightLevel = 0.9;
        const brightResults = solveCircuit(circuit, 0);
        const brightCurrent = brightResults.currents.get('LDR1') || 0;

        const dimR = computePhotoresistorResistance({ ...ldr, lightLevel: 0.1 });
        const brightR = computePhotoresistorResistance({ ...ldr, lightLevel: 0.9 });

        expect(dimResults.valid).toBe(true);
        expect(brightResults.valid).toBe(true);
        expect(brightR).toBeLessThan(dimR);
        expect(Math.abs(brightCurrent)).toBeGreaterThan(Math.abs(dimCurrent));
    });
});
