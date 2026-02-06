import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire } from './helpers/circuitTestUtils.js';

describe('Circuit terminal position cache', () => {
    it('reuses cached terminal positions when topology changes only in wires', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1');
        const resistor = addComponent(circuit, 'Resistor', 'R1');
        connectWire(circuit, 'W1', source, 1, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 0);

        const firstPos = circuit.terminalWorldPosCache.get('R1')?.get(0);
        expect(firstPos).toBeTruthy();

        circuit.addWire({ id: 'W3', a: { x: 400, y: 400 }, b: { x: 500, y: 400 } });
        const secondPos = circuit.terminalWorldPosCache.get('R1')?.get(0);

        expect(secondPos).toBe(firstPos);
    });

    it('invalidates cached terminal positions when component geometry changes', () => {
        const circuit = createTestCircuit();
        const resistor = addComponent(circuit, 'Resistor', 'R1', {}, { x: 100, y: 100 });

        const firstPos = circuit.terminalWorldPosCache.get('R1')?.get(0);
        expect(firstPos).toBeTruthy();

        resistor.x += 40;
        circuit.rebuildNodes();

        const secondPos = circuit.terminalWorldPosCache.get('R1')?.get(0);
        expect(secondPos).toBeTruthy();
        expect(secondPos).not.toBe(firstPos);
        expect(secondPos.x).toBe(firstPos.x + 40);
        expect(secondPos.y).toBe(firstPos.y);
    });

    it('clears component cache entries when component is removed', () => {
        const circuit = createTestCircuit();
        addComponent(circuit, 'Resistor', 'R1');
        expect(circuit.terminalWorldPosCache.get('R1')).toBeTruthy();

        circuit.removeComponent('R1');
        expect(circuit.terminalWorldPosCache.get('R1')).toBeUndefined();
        expect(circuit.componentTerminalTopologyKeys.get('R1')).toBeUndefined();
    });
});
