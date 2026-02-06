import { describe, expect, it } from 'vitest';
import {
    computeValueDisplayRowOffsets,
    resolveValueDisplayAnchor
} from '../src/components/Component.js';

describe('Value display layout helpers', () => {
    it('keeps single visible row closest to component', () => {
        const offsets = computeValueDisplayRowOffsets(['voltage'], 15);
        expect(offsets).toEqual({ voltage: 0 });
    });

    it('stacks multiple rows upward in fixed semantic order', () => {
        const offsets = computeValueDisplayRowOffsets(['current', 'power', 'voltage'], 15);
        expect(offsets.power).toBe(-30);
        expect(offsets.voltage).toBe(-15);
        expect(offsets.current).toBe(0);
    });

    it('ignores unsupported row names', () => {
        const offsets = computeValueDisplayRowOffsets(['energy', 'current'], 15);
        expect(offsets).toEqual({ current: 0 });
    });

    it('uses default anchor for regular components', () => {
        const anchor = resolveValueDisplayAnchor({ type: 'Resistor' });
        expect(anchor).toEqual({ x: 0, y: -14 });
    });

    it('computes dynamic anchor for black box by box height', () => {
        const anchor = resolveValueDisplayAnchor({
            type: 'BlackBox',
            boxHeight: 140
        });
        expect(anchor).toEqual({ x: 0, y: -76 });
    });
});
