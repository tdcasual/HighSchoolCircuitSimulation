import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstRunGuideController } from '../src/ui/FirstRunGuideController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('FirstRunGuideController safety', () => {
    it('show/hide do not throw when classList and setAttribute methods are non-callable', () => {
        const ctx = {
            overlayEl: {
                classList: {
                    remove: {},
                    add: {}
                },
                setAttribute: {}
            }
        };

        expect(() => FirstRunGuideController.prototype.show.call(ctx)).not.toThrow();
        expect(() => FirstRunGuideController.prototype.hide.call(ctx)).not.toThrow();
    });

    it('ensureOverlay does not throw when overlay listener methods are non-callable', () => {
        const overlay = {
            querySelector: vi.fn(() => null),
            removeEventListener: {},
            addEventListener: {}
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => overlay),
            createElement: vi.fn(),
            body: {
                appendChild: vi.fn()
            }
        });

        const ctx = {
            overlayId: 'first-run-guide-overlay',
            boundOverlayClick: vi.fn(),
            overlayEl: null,
            rememberCheckboxEl: null
        };

        expect(() => FirstRunGuideController.prototype.ensureOverlay.call(ctx)).not.toThrow();
    });
});
