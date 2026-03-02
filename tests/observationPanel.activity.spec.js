import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ObservationPanel.isObservationActive', () => {
    it('returns true when observation page is active', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: {
                    contains: vi.fn(() => true)
                }
            }))
        });

        expect(ObservationPanel.prototype.isObservationActive.call({})).toBe(true);
    });

    it('returns false when classList contains is non-callable', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: {
                    contains: {}
                }
            }))
        });

        expect(() => ObservationPanel.prototype.isObservationActive.call({})).not.toThrow();
        expect(ObservationPanel.prototype.isObservationActive.call({})).toBe(false);
    });
});

describe('ObservationPanel.updatePresetButtonHints', () => {
    it('does not throw when preset button setAttribute throws', () => {
        const ctx = {
            presetButtons: {
                'voltage-time': {
                    setAttribute: vi.fn(() => {
                        throw new TypeError('broken setAttribute');
                    })
                }
            },
            resolveQuickPresetContext: vi.fn(() => ({ sourceId: 'time' }))
        };

        expect(() => ObservationPanel.prototype.updatePresetButtonHints.call(ctx)).not.toThrow();
    });
});
