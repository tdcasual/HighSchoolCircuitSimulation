import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('PowerSource internal resistance (Norton model)', () => {
    it('matches I = E / (R + r) and U_terminal = E - I·r', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 1
        });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 11 });

        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        // Expected steady-state loop current.
        expect(results.currents.get('R1')).toBeCloseTo(1, 6);
        expect(results.currents.get('V1')).toBeCloseTo(1, 6);

        // Terminal voltage (node+ - node-) should be 11V.
        const vPlus = results.voltages[source.nodes[0]] || 0;
        const vMinus = results.voltages[source.nodes[1]] || 0;
        expect(vPlus - vMinus).toBeCloseTo(11, 6);
    });

    it('approaches open-circuit voltage with a very large load', () => {
        const openCircuit = createTestCircuit();
        const openSource = addComponent(openCircuit, 'PowerSource', 'Vopen', {
            voltage: 12,
            internalResistance: 1
        });
        const openLoad = addComponent(openCircuit, 'Resistor', 'Ropen', { resistance: 1e9 });

        connectWire(openCircuit, 'W1', openSource, 0, openLoad, 0);
        connectWire(openCircuit, 'W2', openLoad, 1, openSource, 1);

        const openResults = solveCircuit(openCircuit);
        expect(openResults.valid).toBe(true);

        const openCurrent = Math.abs(openResults.currents.get('Ropen') || 0);
        expect(openCurrent).toBeLessThan(1e-6);

        const vOpenPlus = openResults.voltages[openSource.nodes[0]] || 0;
        const vOpenMinus = openResults.voltages[openSource.nodes[1]] || 0;
        const vOpen = vOpenPlus - vOpenMinus;
        expect(vOpen).toBeCloseTo(12, 6);

        const loadedCircuit = createTestCircuit();
        const loadedSource = addComponent(loadedCircuit, 'PowerSource', 'Vload', {
            voltage: 12,
            internalResistance: 1
        });
        const loadedResistor = addComponent(loadedCircuit, 'Resistor', 'Rload', { resistance: 11 });

        connectWire(loadedCircuit, 'W3', loadedSource, 0, loadedResistor, 0);
        connectWire(loadedCircuit, 'W4', loadedResistor, 1, loadedSource, 1);

        const loadResults = solveCircuit(loadedCircuit);
        expect(loadResults.valid).toBe(true);

        const loadCurrent = Math.abs(loadResults.currents.get('Rload') || 0);
        expect(loadCurrent).toBeCloseTo(1, 6);

        const vLoadPlus = loadResults.voltages[loadedSource.nodes[0]] || 0;
        const vLoadMinus = loadResults.voltages[loadedSource.nodes[1]] || 0;
        const vLoad = vLoadPlus - vLoadMinus;
        expect(vLoad).toBeCloseTo(11, 6);
        expect(vLoad).toBeLessThan(vOpen);
    });
});
