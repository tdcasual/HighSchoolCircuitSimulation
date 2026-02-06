import { describe, it, expect } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';

describe('Circuit topology batch', () => {
    it('defers rebuild until batch ends', () => {
        const circuit = new Circuit();
        const originalRebuild = circuit.rebuildNodes.bind(circuit);
        let rebuildCount = 0;
        circuit.rebuildNodes = (...args) => {
            rebuildCount += 1;
            return originalRebuild(...args);
        };

        circuit.beginTopologyBatch();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });

        expect(rebuildCount).toBe(0);
        expect(circuit.topologyRebuildPending).toBe(true);

        const flushed = circuit.endTopologyBatch();
        expect(flushed).toBe(true);
        expect(rebuildCount).toBe(1);
        expect(circuit.topologyRebuildPending).toBe(false);
        expect(circuit.topologyBatchDepth).toBe(0);
    });

    it('supports nested batch scopes', () => {
        const circuit = new Circuit();
        const originalRebuild = circuit.rebuildNodes.bind(circuit);
        let rebuildCount = 0;
        circuit.rebuildNodes = (...args) => {
            rebuildCount += 1;
            return originalRebuild(...args);
        };

        circuit.beginTopologyBatch();
        circuit.beginTopologyBatch();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });

        expect(circuit.endTopologyBatch()).toBe(false);
        expect(rebuildCount).toBe(0);
        expect(circuit.topologyBatchDepth).toBe(1);

        expect(circuit.endTopologyBatch()).toBe(true);
        expect(rebuildCount).toBe(1);
        expect(circuit.topologyBatchDepth).toBe(0);
    });

    it('still rebuilds immediately outside batch', () => {
        const circuit = new Circuit();
        const originalRebuild = circuit.rebuildNodes.bind(circuit);
        let rebuildCount = 0;
        circuit.rebuildNodes = (...args) => {
            rebuildCount += 1;
            return originalRebuild(...args);
        };

        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        expect(rebuildCount).toBe(1);
    });
});
