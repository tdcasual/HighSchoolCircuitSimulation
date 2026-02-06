import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Wire short-circuit detection', () => {
    it('computes finite short current for a source with internal resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0.5 });

        // Directly short the source terminals with a wire.
        const wShort = connectWire(circuit, 'Wshort', source, 0, source, 1);

        // Add an unrelated subcircuit to ensure nodeCount >= 2 so the solver returns results.valid=true.
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });
        connectWire(circuit, 'Wn1', r1, 0, r2, 0);
        connectWire(circuit, 'Wn2', r1, 1, r2, 1);

        circuit.rebuildNodes();

        const originalWarn = console.warn;
        try {
            console.warn = () => {};
            const results = solveCircuit(circuit);
            expect(results.valid).toBe(true);

            const sourceCurrent = results.currents.get(source.id) || 0;
            expect(sourceCurrent).toBeCloseTo(24, 3);

            const info = circuit.getWireCurrentInfo(wShort, results);
            expect(info).not.toBeNull();
            expect(info.isShorted).toBe(true);
            expect(info.current).toBeGreaterThan(20);
            expect(Math.abs(info.flowDirection)).toBe(1);
        } finally {
            console.warn = originalWarn;
        }
    });

    it('detects external low-resistance short path as short circuit', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0.5 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: true });

        const w1 = connectWire(circuit, 'W1', source, 0, sw, 0);
        const w2 = connectWire(circuit, 'W2', source, 1, sw, 1);

        circuit.rebuildNodes();
        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(true);

        const sourceCurrent = Math.abs(results.currents.get(source.id) || 0);
        expect(sourceCurrent).toBeGreaterThan(20);

        const info1 = circuit.getWireCurrentInfo(w1, results);
        const info2 = circuit.getWireCurrentInfo(w2, results);
        expect(info1.isShorted).toBe(true);
        expect(info2.isShorted).toBe(true);
        expect(info1.current).toBeGreaterThan(20);
        expect(info2.current).toBeGreaterThan(20);
    });

    it('does not zero/short-mark unrelated wires on the same node', () => {
        const circuit = createTestCircuit();
        const sourceMain = addComponent(circuit, 'PowerSource', 'Vmain', { voltage: 12, internalResistance: 0.5 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 100 });
        const sourceShorted = addComponent(circuit, 'PowerSource', 'Vshort', { voltage: 3, internalResistance: 0.5 });

        const wMainIn = connectWire(circuit, 'WmainIn', sourceMain, 0, load, 0);
        connectWire(circuit, 'WmainOut', load, 1, sourceMain, 1);
        connectWire(circuit, 'WshortLoop', sourceShorted, 0, sourceShorted, 1);
        connectWire(circuit, 'Wjoin', sourceShorted, 0, sourceMain, 0);

        circuit.rebuildNodes();
        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const info = circuit.getWireCurrentInfo(wMainIn, results);
        expect(info).not.toBeNull();
        expect(info.isShorted).toBe(false);
        expect(info.current).toBeGreaterThan(0.05);
    });
});
