import { describe, expect, it, vi } from 'vitest';
import { createTestCircuit } from './helpers/circuitTestUtils.js';
import { addWireAt, resolveCompactedWireId } from '../src/ui/interaction/WireInteractions.js';

describe('WireInteractions.addWireAt', () => {
    it('creates unique wire ids when two adds happen at the same timestamp', () => {
        const circuit = createTestCircuit();
        const context = {
            circuit,
            renderer: { addWire: vi.fn() },
            runWithHistory: (_label, fn) => fn(),
            selectWire: vi.fn(),
            updateStatus: vi.fn()
        };

        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);
        try {
            addWireAt.call(context, 100, 100);
            addWireAt.call(context, 120, 100);
        } finally {
            nowSpy.mockRestore();
        }

        const wires = circuit.getAllWires();
        expect(wires).toHaveLength(2);
        expect(new Set(wires.map((wire) => wire.id)).size).toBe(2);
    });
});

describe('WireInteractions.resolveCompactedWireId', () => {
    it('supports numeric wire ids including zero', () => {
        expect(resolveCompactedWireId(0, { 0: 'W9' })).toBe('W9');
        expect(resolveCompactedWireId(0, {})).toBe('0');
    });
});
