import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

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
});
