import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Motor series armature', () => {
    it('stalls at V/Ra after a real running step', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        });
        const motor = addComponent(circuit, 'Motor', 'M1', { resistance: 5 });
        connectWire(circuit, 'W1', source, 0, motor, 0);
        connectWire(circuit, 'W2', motor, 1, source, 1);

        circuit.isRunning = true;
        circuit.step();

        expect(circuit.lastResults?.valid).toBe(true);
        expect(circuit.lastResults.currents.get('M1')).toBeCloseTo(1.2, 6);
    });
});
