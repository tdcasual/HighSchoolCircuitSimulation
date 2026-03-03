import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ObservationPanel.downloadCanvasImage', () => {
    it('returns false when canvas is invalid', () => {
        vi.stubGlobal('document', {
            createElement: vi.fn(() => ({})),
            body: {}
        });

        expect(ObservationPanel.prototype.downloadCanvasImage.call({}, null)).toBe(false);
    });

    it('does not throw when appendChild/click/remove are non-callable', () => {
        const canvas = {
            toDataURL: vi.fn(() => 'data:image/png;base64,abc')
        };
        const anchor = {
            href: '',
            download: '',
            click: {},
            remove: {}
        };
        vi.stubGlobal('document', {
            createElement: vi.fn(() => anchor),
            body: {
                appendChild: {}
            }
        });

        expect(() => ObservationPanel.prototype.downloadCanvasImage.call({}, canvas, 'x.png')).not.toThrow();
        expect(ObservationPanel.prototype.downloadCanvasImage.call({}, canvas, 'x.png')).toBe(true);
    });
});
