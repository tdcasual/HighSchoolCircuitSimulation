import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildObservationExportMetadata,
    downloadCanvasImage
} from '../src/ui/observation/ObservationExportService.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ObservationExportService', () => {
    it('preserves numeric zero source ids in fallback metadata labels', () => {
        const panel = {
            sampleIntervalMs: 50,
            plots: [
                {
                    name: '图像 1',
                    x: { sourceId: 0, quantityId: 't' },
                    y: { sourceId: 0, quantityId: 'I' }
                }
            ],
            circuit: {
                components: new Map()
            }
        };

        const lines = buildObservationExportMetadata(panel, {
            exportedAt: new Date('2026-03-03T00:00:00.000Z')
        });

        expect(lines).toContain('X: 0 · t');
        expect(lines).toContain('Y: 0 · I');
    });

    it('returns false when download anchor cannot click', () => {
        const canvas = {
            toDataURL: () => 'data:image/png;base64,abc'
        };
        vi.stubGlobal('document', {
            body: {
                appendChild: () => {}
            },
            createElement: () => ({})
        });

        const ok = downloadCanvasImage({}, canvas, 'export.png');
        expect(ok).toBe(false);
    });
});
