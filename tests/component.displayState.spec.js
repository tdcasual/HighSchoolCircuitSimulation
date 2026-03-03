import { describe, expect, it, vi } from 'vitest';
import {
    updateAttributeIfChanged,
    updateTextIfChanged
} from '../src/components/display/ComponentDisplayState.js';

describe('Component display state helpers', () => {
    it('updates display text only when value changed', () => {
        const element = { textContent: '10V' };

        const unchanged = updateTextIfChanged(element, '10V');
        const changed = updateTextIfChanged(element, '12V');

        expect(unchanged).toBe(false);
        expect(changed).toBe(true);
        expect(element.textContent).toBe('12V');
    });

    it('uses setAttribute only when attribute value changed', () => {
        const element = {
            getAttribute: vi.fn((name) => (name === 'font-size' ? '13' : null)),
            setAttribute: vi.fn()
        };

        expect(updateAttributeIfChanged(element, 'font-size', 13)).toBe(false);
        expect(updateAttributeIfChanged(element, 'font-size', 15)).toBe(true);
        expect(element.setAttribute).toHaveBeenCalledTimes(1);
        expect(element.setAttribute).toHaveBeenCalledWith('font-size', '15');
    });
});
