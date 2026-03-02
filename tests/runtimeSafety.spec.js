import { describe, expect, it, vi } from 'vitest';
import {
    safeAddEventListener,
    safeClassListAdd,
    safeClassListRemove,
    safeClassListToggle,
    safeFocus,
    safeInvoke,
    safeRemoveEventListener,
    safeSetAttribute
} from '../src/utils/RuntimeSafety.js';

describe('RuntimeSafety', () => {
    it('safeInvoke returns fallback when target method throws', () => {
        const target = {
            explode: vi.fn(() => {
                throw new Error('boom');
            })
        };

        const result = safeInvoke(target, 'explode', [], 'fallback-value');

        expect(result).toBe('fallback-value');
    });

    it('safeInvoke calls target method with arguments when available', () => {
        const target = {
            sum: vi.fn((a, b) => a + b)
        };

        const result = safeInvoke(target, 'sum', [2, 5], -1);

        expect(result).toBe(7);
        expect(target.sum).toHaveBeenCalledWith(2, 5);
    });

    it('safeSetAttribute never throws and reports success state', () => {
        const node = {
            setAttribute: vi.fn((name) => {
                if (name === 'data-bad') {
                    throw new Error('blocked');
                }
            })
        };

        expect(safeSetAttribute(node, 'data-id', 12)).toBe(true);
        expect(safeSetAttribute(node, 'data-bad', 'x')).toBe(false);
    });

    it('safeClassListToggle never throws and returns boolean', () => {
        const classList = {
            toggle: vi.fn((name, force) => {
                if (name === 'explode') {
                    throw new Error('boom');
                }
                return !!force;
            })
        };
        const node = { classList };

        expect(safeClassListToggle(node, 'active', true)).toBe(true);
        expect(safeClassListToggle(node, 'inactive', false)).toBe(false);
        expect(safeClassListToggle(node, 'explode', true)).toBe(false);
    });

    it('safeClassListAdd/remove return false for invalid classList methods', () => {
        const node = {
            classList: {
                add: {},
                remove: null
            }
        };

        expect(safeClassListAdd(node, 'a')).toBe(false);
        expect(safeClassListRemove(node, 'b')).toBe(false);
    });

    it('safeAddEventListener/safeRemoveEventListener return false when listener methods throw', () => {
        const target = {
            addEventListener: vi.fn(() => {
                throw new Error('denied');
            }),
            removeEventListener: vi.fn(() => {
                throw new Error('denied');
            })
        };
        const handler = vi.fn();

        expect(safeAddEventListener(target, 'click', handler)).toBe(false);
        expect(safeRemoveEventListener(target, 'click', handler)).toBe(false);
    });

    it('safeFocus handles invalid targets without throwing', () => {
        const brokenTarget = {
            focus: vi.fn(() => {
                throw new Error('focus denied');
            })
        };

        expect(safeFocus(null)).toBe(false);
        expect(safeFocus(brokenTarget)).toBe(false);
    });
});
