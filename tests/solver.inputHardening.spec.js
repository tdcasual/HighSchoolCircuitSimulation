import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver input hardening', () => {
    it('does not throw when PowerSource.internalResistance is non-numeric', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        source.internalResistance = 'bad-value';
        expect(() => solveCircuit(circuit)).not.toThrow();
    });

    it('does not throw when Ammeter.resistance is non-numeric', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'W1', source, 0, ammeter, 0);
        connectWire(circuit, 'W2', ammeter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        ammeter.resistance = 'oops';
        expect(() => solveCircuit(circuit)).not.toThrow();
    });
});
