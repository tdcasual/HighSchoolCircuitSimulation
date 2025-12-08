import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Equipotential bus propagation', () => {
    it('keeps every chained segment aligned from the source to distant sinks', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });
        const r3 = addComponent(circuit, 'Resistor', 'R3', { resistance: 100 });

        // Positive bus (top wires) drawn left-to-right just like in the UI
        connectWire(circuit, 'Wpos0', source, 0, r1, 0);
        const wpos1 = connectWire(circuit, 'Wpos1', r1, 0, r2, 0);
        const wpos2 = connectWire(circuit, 'Wpos2', r2, 0, r3, 0);

        // Negative bus (bottom wires) drawn right-to-left (current should flow toward the battery)
        connectWire(circuit, 'Wneg0', r1, 1, source, 1);
        const wneg1 = connectWire(circuit, 'Wneg1', r2, 1, r1, 1);
        const wneg2 = connectWire(circuit, 'Wneg2', r3, 1, r2, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const busForward = circuit.getWireCurrentInfo(wpos1, results);
        const busFarForward = circuit.getWireCurrentInfo(wpos2, results);
        expect(busForward.flowDirection).toBe(1);
        expect(busFarForward.flowDirection).toBe(1);

        const busReturnNear = circuit.getWireCurrentInfo(wneg1, results);
        const busReturnFar = circuit.getWireCurrentInfo(wneg2, results);
        expect(busReturnNear.flowDirection).toBe(1);
        expect(busReturnFar.flowDirection).toBe(1);
    });
});
