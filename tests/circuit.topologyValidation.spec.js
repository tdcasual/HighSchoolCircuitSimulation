import { describe, expect, it } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

function addDummyPower(circuit) {
    const source = addComponent(circuit, 'PowerSource', 'Vdummy', { voltage: 6, internalResistance: 0 });
    const load = addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 100 });
    connectWire(circuit, 'Wdummy1', source, 0, load, 0);
    connectWire(circuit, 'Wdummy2', load, 1, source, 1);
}

function addParallelCapacitors(circuit, host, terminalA, terminalB) {
    const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
    const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });
    connectWire(circuit, 'Wc1a', host, terminalA, c1, 0);
    connectWire(circuit, 'Wc1b', c1, 1, host, terminalB);
    connectWire(circuit, 'Wc2a', host, terminalA, c2, 0);
    connectWire(circuit, 'Wc2b', c2, 1, host, terminalB);
    return { c1, c2 };
}

describe('Simulation topology validation', () => {
    it('detects conflicting parallel ideal voltage sources before simulation starts', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 12, internalResistance: 0 });

        connectWire(circuit, 'W1', v1, 0, v2, 0);
        connectWire(circuit, 'W2', v1, 1, v2, 1);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(false);
        expect(report.error?.code).toBe('TOPO_CONFLICTING_IDEAL_SOURCES');
        expect(report.error?.message || '').toContain('理想电压源');
    });

    it('allows start when two capacitors share a relay coil that already damps', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const relay = addComponent(circuit, 'Relay', 'K1', {
            coilResistance: 200,
            pullInCurrent: 0.01,
            dropOutCurrent: 0.005,
            contactOnResistance: 1e-3,
            contactOffResistance: 1e12,
            energized: false
        });
        const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
        const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });
        connectWire(circuit, 'W1', source, 0, relay, 0);
        connectWire(circuit, 'W2', relay, 1, source, 1);
        connectWire(circuit, 'Wc1a', relay, 0, c1, 0);
        connectWire(circuit, 'Wc1b', c1, 1, relay, 1);
        connectWire(circuit, 'Wc2a', relay, 0, c2, 0);
        connectWire(circuit, 'Wc2b', c2, 1, relay, 1);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(circuit.componentProvidesResistiveDamping(relay)).toBe(true);
    });

    it('still flags a capacitor loop across released relay contacts', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'Vcoil', {
            voltage: 6,
            internalResistance: 0
        });
        const relay = addComponent(circuit, 'Relay', 'K1', {
            coilResistance: 200,
            pullInCurrent: 0.01,
            dropOutCurrent: 0.005,
            contactOnResistance: 1e-3,
            contactOffResistance: 1e12,
            energized: false
        });
        const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
        const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });
        connectWire(circuit, 'W1', source, 0, relay, 0);
        connectWire(circuit, 'W2', relay, 1, source, 1);
        connectWire(circuit, 'Wc1a', relay, 2, c1, 0);
        connectWire(circuit, 'Wc1b', c1, 1, relay, 3);
        connectWire(circuit, 'Wc2a', relay, 2, c2, 0);
        connectWire(circuit, 'Wc2b', c2, 1, relay, 3);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(false);
        expect(report.error?.code).toBe('TOPO_CAPACITOR_LOOP_NO_RESISTANCE');
    });

    it('detects capacitor-only loop without resistive damping', () => {
        const circuit = createTestCircuit();
        const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
        const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });

        connectWire(circuit, 'W1', c1, 0, c2, 0);
        connectWire(circuit, 'W2', c1, 1, c2, 1);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(false);
        expect(report.error?.code).toBe('TOPO_CAPACITOR_LOOP_NO_RESISTANCE');
    });

    it('reports floating subcircuit as warning while keeping simulation allowed', () => {
        const circuit = createTestCircuit();
        const vMain = addComponent(circuit, 'PowerSource', 'Vmain', { voltage: 10, internalResistance: 0 });
        const rMain = addComponent(circuit, 'Resistor', 'Rmain', { resistance: 10 });
        connectWire(circuit, 'W1', vMain, 0, rMain, 0);
        connectWire(circuit, 'W2', rMain, 1, vMain, 1);

        const vFloat = addComponent(circuit, 'PowerSource', 'Vfloat', { voltage: 5, internalResistance: 0 });
        const rFloat = addComponent(circuit, 'Resistor', 'Rfloat', { resistance: 5 });
        connectWire(circuit, 'W3', vFloat, 0, rFloat, 0);
        connectWire(circuit, 'W4', rFloat, 1, vFloat, 1);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(Array.isArray(report.warnings)).toBe(true);
        expect(report.warnings.some((warning) => warning.code === 'TOPO_FLOATING_SUBCIRCUIT')).toBe(true);
    });

    it('allows start when two capacitors share the SPDT throw that is on', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const sw = addComponent(circuit, 'SPDTSwitch', 'S1', {
            position: 'b',
            onResistance: 1e-3,
            offResistance: 1e12
        });
        addParallelCapacitors(circuit, sw, 0, 2);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('still flags a capacitor loop across the SPDT throw that is off', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const sw = addComponent(circuit, 'SPDTSwitch', 'S1', {
            position: 'b',
            onResistance: 1e-3,
            offResistance: 1e12
        });
        addParallelCapacitors(circuit, sw, 0, 1);

        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(false);
        expect(report.error?.code).toBe('TOPO_CAPACITOR_LOOP_NO_RESISTANCE');
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(false);
    });

    it('allows start when two capacitors share a left-slider rheostat arm', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const rheostat = addComponent(circuit, 'Rheostat', 'RH1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        });
        addParallelCapacitors(circuit, rheostat, 0, 2);

        expect(rheostat.connectionMode).toBe('left-slider');
        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('allows start when two capacitors share a right-slider rheostat arm', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const rheostat = addComponent(circuit, 'Rheostat', 'RH1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        });
        addParallelCapacitors(circuit, rheostat, 1, 2);

        expect(rheostat.connectionMode).toBe('right-slider');
        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('allows start when two capacitors share the slider arm of an all-mode rheostat', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const rheostat = addComponent(circuit, 'Rheostat', 'RH1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        });
        const rightLoad = addComponent(circuit, 'Resistor', 'Rright', { resistance: 50 });
        connectWire(circuit, 'Wright1', rheostat, 1, rightLoad, 0);
        connectWire(circuit, 'Wright2', rightLoad, 1, rheostat, 2);
        addParallelCapacitors(circuit, rheostat, 0, 2);

        expect(rheostat.connectionMode).toBe('all');
        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('allows start when two capacitors share a default inductor', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const inductor = addComponent(circuit, 'Inductor', 'L1', { inductance: 0.1 });
        addParallelCapacitors(circuit, inductor, 0, 1);

        expect(circuit.componentProvidesResistiveDamping(inductor)).toBe(true);
        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('allows start when two capacitors share an ideal ammeter', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0 });
        addParallelCapacitors(circuit, ammeter, 0, 1);

        expect(circuit.componentProvidesResistiveDamping(ammeter)).toBe(true);
        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(true);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });

    it('still flags a capacitor loop across an ideal voltmeter', () => {
        const circuit = createTestCircuit();
        addDummyPower(circuit);
        const voltmeter = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: Infinity });
        addParallelCapacitors(circuit, voltmeter, 0, 1);

        expect(circuit.componentProvidesResistiveDamping(voltmeter)).toBe(false);
        const report = circuit.validateSimulationTopology(0);
        expect(report.ok).toBe(false);
        expect(report.error?.code).toBe('TOPO_CAPACITOR_LOOP_NO_RESISTANCE');
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(false);
    });
});
