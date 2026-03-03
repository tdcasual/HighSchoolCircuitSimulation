import { describe, expect, it } from 'vitest';
import { getComponentHitBox, getTerminalLocalOffset } from '../src/components/geometry/ComponentGeometry.js';

describe('Component geometry helpers', () => {
    it('computes deterministic terminal geometry for rotated two-terminal components', () => {
        expect(getTerminalLocalOffset('Resistor', 0, 0)).toEqual({ x: -30, y: 0 });
        expect(getTerminalLocalOffset('Resistor', 1, 0)).toEqual({ x: 30, y: 0 });

        expect(getTerminalLocalOffset('Resistor', 0, 90)).toEqual({ x: 0, y: -30 });
        expect(getTerminalLocalOffset('Resistor', 1, 90)).toEqual({ x: 0, y: 30 });

        expect(getTerminalLocalOffset('Resistor', 0, 180)).toEqual({ x: 30, y: 0 });
        expect(getTerminalLocalOffset('Resistor', 1, 180)).toEqual({ x: -30, y: 0 });

        expect(getTerminalLocalOffset('Resistor', 0, 270)).toEqual({ x: 0, y: 30 });
        expect(getTerminalLocalOffset('Resistor', 1, 270)).toEqual({ x: 0, y: -30 });
    });

    it('keeps switch hit box at least 44px touch target', () => {
        const box = getComponentHitBox({ type: 'Switch' });
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
    });
});
