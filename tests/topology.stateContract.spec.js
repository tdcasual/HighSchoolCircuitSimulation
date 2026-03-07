import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';

describe('topology state contract', () => {
    it('exposes version pending and replacement remap metadata from one readable contract', () => {
        const circuit = new Circuit();

        const initial = circuit.getTopologyState();
        expect(initial).toEqual({
            version: 0,
            pending: false,
            replacementByRemovedId: {}
        });

        circuit.beginTopologyBatch();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });

        const pendingState = circuit.getTopologyState();
        expect(pendingState.pending).toBe(true);
        expect(pendingState.version).toBe(0);

        circuit.endTopologyBatch();
        circuit.compactWires();

        const compactedState = circuit.getTopologyState();
        expect(compactedState.pending).toBe(false);
        expect(compactedState.version).toBeGreaterThanOrEqual(1);
        expect(compactedState.replacementByRemovedId).toMatchObject({
            W2: 'W1'
        });
    });
});
