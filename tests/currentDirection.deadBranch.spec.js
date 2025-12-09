import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Wire flow on dead branches', () => {
    it('does not propagate trunk current into an open branch wire', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 10 });
        const openSwitch = addComponent(circuit, 'Switch', 'S1', { closed: false });

        const mainWire = connectWire(circuit, 'Wmain', source, 0, load, 0);
        connectWire(circuit, 'WloadReturn', load, 1, source, 1);

        const branchWire = connectWire(circuit, 'Wbranch', openSwitch, 0, load, 0);
        connectWire(circuit, 'WbranchReturn', openSwitch, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const mainInfo = circuit.getWireCurrentInfo(mainWire, results);
        expect(mainInfo.current).toBeGreaterThan(0.9); // ≈1A through the main path

        const branchInfo = circuit.getWireCurrentInfo(branchWire, results);
        expect(branchInfo.current).toBe(0); // open switch branch should carry no current
    });
});
