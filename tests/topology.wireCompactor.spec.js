import { describe, expect, it } from 'vitest';
import { WireCompactor } from '../src/core/topology/WireCompactor.js';

describe('WireCompactor', () => {
    it('merges collinear opposite wire segments', () => {
        const compactor = new WireCompactor();
        const wires = new Map([
            ['W1', { id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }],
            ['W2', { id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } }]
        ]);

        const result = compactor.compact({
            components: new Map(),
            wires
        });

        expect(result.changed).toBe(true);
        expect(result.removedIds.length).toBe(1);
        expect(wires.size).toBe(1);
    });

    it('keeps numeric zero ids when filtering scoped wires', () => {
        const compactor = new WireCompactor();
        const wires = new Map([
            ['0', { id: '0', a: { x: 5, y: 5 }, b: { x: 5, y: 5 } }],
            ['W1', { id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }]
        ]);

        const result = compactor.compact({
            components: new Map(),
            wires,
            scopeWireIds: new Set([0])
        });

        expect(result.changed).toBe(true);
        expect(result.removedIds).toContain('0');
        expect(wires.has('0')).toBe(false);
        expect(wires.has('W1')).toBe(true);
    });
});
