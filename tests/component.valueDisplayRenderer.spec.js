import { describe, expect, it } from 'vitest';
import { formatValue } from '../src/components/render/ComponentValueDisplayRenderer.js';

describe('ComponentValueDisplayRenderer', () => {
    it('formats values with engineering prefixes', () => {
        expect(formatValue(1200, 'V')).toBe('1.20 kV');
        expect(formatValue(2, 'A')).toBe('2.000 A');
        expect(formatValue(0.002, 'A')).toBe('2.00 mA');
        expect(formatValue(0.000002, 'F')).toBe('2.00 μF');
        expect(formatValue(Number.NaN, 'V')).toBe('0 V');
    });
});
