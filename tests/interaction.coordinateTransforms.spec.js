import { describe, expect, it } from 'vitest';
import * as CoordinateTransforms from '../src/ui/interaction/CoordinateTransforms.js';

describe('CoordinateTransforms.canvasToComponentLocal', () => {
    it('maps canvas point to local coordinate with translation only', () => {
        const comp = { x: 100, y: 50, rotation: 0 };
        const local = CoordinateTransforms.canvasToComponentLocal(comp, { x: 130, y: 80 });
        expect(local).toEqual({ x: 30, y: 30 });
    });

    it('maps canvas point to local coordinate with rotation', () => {
        const comp = { x: 0, y: 0, rotation: 90 };
        const local = CoordinateTransforms.canvasToComponentLocal(comp, { x: 10, y: 0 });
        expect(local.x).toBeCloseTo(0, 8);
        expect(local.y).toBeCloseTo(-10, 8);
    });
});
