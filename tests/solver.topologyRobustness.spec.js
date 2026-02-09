import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver topology robustness', () => {
    it('solves parallel sources with internal resistance and finite circulating current', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 1 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 6, internalResistance: 1 });

        connectWire(circuit, 'Wpos', v1, 0, v2, 0);
        connectWire(circuit, 'Wneg', v1, 1, v2, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const vTerminal = (results.voltages[v1.nodes[0]] || 0) - (results.voltages[v1.nodes[1]] || 0);
        const expectedV = (12 / 1 + 6 / 1) / (1 / 1 + 1 / 1);
        expect(vTerminal).toBeCloseTo(expectedV, 6);

        const i1 = results.currents.get('V1') || 0;
        const i2 = results.currents.get('V2') || 0;
        expect(i1).toBeCloseTo(3, 6);
        expect(i2).toBeCloseTo(-3, 6);
        expect(i1 + i2).toBeCloseTo(0, 6);
    });

    it('keeps the main circuit solvable with a floating ideal source loop', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'Vmain', { voltage: 10, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'Rmain', { resistance: 10 });

        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        const floatingSource = addComponent(circuit, 'PowerSource', 'Vfloat', { voltage: 5, internalResistance: 0 });
        const floatingLoad = addComponent(circuit, 'Resistor', 'Rfloat', { resistance: 5 });

        connectWire(circuit, 'W3', floatingSource, 0, floatingLoad, 0);
        connectWire(circuit, 'W4', floatingLoad, 1, floatingSource, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const mainCurrent = results.currents.get('Rmain') || 0;
        expect(mainCurrent).toBeCloseTo(1, 6);

        const floatingCurrent = results.currents.get('Rfloat') || 0;
        expect(floatingCurrent).toBeCloseTo(1, 6);
    });

    it('prefers connected Ground as reference over isolated Ground components', () => {
        const circuit = createTestCircuit();
        const groundConnected = addComponent(circuit, 'Ground', 'GND1');
        const groundIsolated = addComponent(circuit, 'Ground', 'GND2');
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'Wg', source, 1, groundConnected, 0);
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, groundConnected, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        expect(groundConnected.nodes[0]).toBe(0);
        expect(source.nodes[1]).toBe(0);
        expect(groundIsolated.nodes[0]).toBe(-1);
        expect(results.currents.get('R1')).toBeCloseTo(1, 6);
    });

    it('keeps dangling terminals at -1 and avoids phantom current', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'Rmain', { resistance: 100 });
        const dangling = addComponent(circuit, 'Resistor', 'Rdang', { resistance: 50 });

        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        connectWire(circuit, 'W3', source, 0, dangling, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        expect(dangling.nodes[0]).toBeGreaterThanOrEqual(0);
        expect(dangling.nodes[1]).toBe(-1);
        expect(Math.abs(results.currents.get('Rdang') || 0)).toBeLessThan(1e-9);
        expect(results.currents.get('Rmain')).toBeCloseTo(0.12, 6);
    });
});
