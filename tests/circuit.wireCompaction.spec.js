import { describe, it, expect } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Circuit wire compaction', () => {
    it('merges two collinear opposite segments at a non-terminal junction', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });

        const result = circuit.compactWires();

        expect(result.changed).toBe(true);
        expect(result.removedIds).toContain('W2');
        expect(result.replacementByRemovedId.W2).toBe('W1');
        expect(circuit.getAllWires()).toHaveLength(1);

        const merged = circuit.getWire('W1');
        expect(merged).toBeTruthy();
        expect(merged.a).toEqual({ x: 0, y: 0 });
        expect(merged.b).toEqual({ x: 20, y: 0 });
    });

    it('does not merge through a coordinate occupied by a component terminal', () => {
        const circuit = new Circuit();
        const resistor = createComponent('Resistor', 40, 0, 'R1'); // terminal 0 at x=10,y=0
        circuit.addComponent(resistor);
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });

        const result = circuit.compactWires();

        expect(result.changed).toBe(false);
        expect(circuit.getAllWires()).toHaveLength(2);
    });

    it('does not merge when shared endpoint is terminal-bound', () => {
        const circuit = new Circuit();
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 10, y: 0 },
            bRef: { componentId: 'R1', terminalIndex: 0 }
        });
        circuit.addWire({ id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });

        const result = circuit.compactWires();

        expect(result.changed).toBe(false);
        expect(circuit.getAllWires()).toHaveLength(2);
    });

    it('removes zero-length wires', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 5, y: 5 }, b: { x: 5, y: 5 } });
        circuit.addWire({ id: 'W2', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });

        const result = circuit.compactWires();

        expect(result.changed).toBe(true);
        expect(result.removedIds).toContain('W1');
        expect(circuit.getWire('W1')).toBeUndefined();
        expect(circuit.getWire('W2')).toBeTruthy();
    });

    it('respects scopeWireIds and only compacts related segments', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'A1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        circuit.addWire({ id: 'A2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });
        circuit.addWire({ id: 'B1', a: { x: 0, y: 20 }, b: { x: 10, y: 20 } });
        circuit.addWire({ id: 'B2', a: { x: 10, y: 20 }, b: { x: 20, y: 20 } });

        const result = circuit.compactWires({ scopeWireIds: ['A1', 'A2'] });

        expect(result.changed).toBe(true);
        expect(circuit.getWire('A2')).toBeUndefined();
        expect(circuit.getWire('B1')).toBeTruthy();
        expect(circuit.getWire('B2')).toBeTruthy();
        expect(circuit.getAllWires()).toHaveLength(3);
    });
});
