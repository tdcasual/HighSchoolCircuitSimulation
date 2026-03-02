import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportObservationSnapshot } from '../src/ui/observation/ObservationExportService.js';

function create2dContextStub() {
    return {
        fillStyle: '',
        font: '',
        strokeStyle: '',
        fillRect: vi.fn(),
        fillText: vi.fn(),
        strokeRect: vi.fn(),
        drawImage: vi.fn()
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ObservationExportService.exportObservationSnapshot', () => {
    it('prefers panel.downloadCanvasImage when available', () => {
        const ctx = create2dContextStub();
        const exportCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => ctx)
        };
        const sourceCanvas = { width: 120, height: 60 };

        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => (tagName === 'canvas' ? exportCanvas : { click() {}, remove() {} })),
            body: { appendChild() {} }
        });

        const panel = {
            sampleIntervalMs: 20,
            plots: [{
                name: '图 1',
                x: { sourceId: 'time', quantityId: 'time' },
                y: { sourceId: 'R1', quantityId: 'voltage' },
                elements: { canvas: sourceCanvas }
            }],
            circuit: { components: new Map() },
            renderAll: vi.fn(),
            showTransientStatus: vi.fn(),
            downloadCanvasImage: vi.fn(() => true)
        };

        const ok = exportObservationSnapshot(panel, { exportedAt: new Date('2026-03-02T00:00:00Z') });
        expect(ok).toBe(true);
        expect(panel.downloadCanvasImage).toHaveBeenCalledTimes(1);
        expect(panel.downloadCanvasImage.mock.calls[0][0]).toBe(exportCanvas);
        expect(panel.downloadCanvasImage.mock.calls[0][1]).toMatch(/\.png$/u);
    });

    it('falls back to module download when panel.downloadCanvasImage is missing', () => {
        const ctx = create2dContextStub();
        const exportCanvas = {
            width: 0,
            height: 0,
            toDataURL: vi.fn(() => 'data:image/png;base64,aaa'),
            getContext: vi.fn(() => ctx)
        };
        const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };

        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => {
                if (tagName === 'canvas') return exportCanvas;
                if (tagName === 'a') return anchor;
                return {};
            }),
            body: { appendChild: vi.fn() }
        });

        const panel = {
            sampleIntervalMs: 20,
            plots: [{
                name: '图 1',
                x: { sourceId: 'time', quantityId: 'time' },
                y: { sourceId: 'R1', quantityId: 'voltage' },
                elements: { canvas: { width: 120, height: 60 } }
            }],
            circuit: { components: new Map() },
            renderAll: vi.fn(),
            showTransientStatus: vi.fn()
        };

        const ok = exportObservationSnapshot(panel, { exportedAt: new Date('2026-03-02T00:00:00Z') });
        expect(ok).toBe(true);
        expect(anchor.click).toHaveBeenCalledTimes(1);
        expect(anchor.download).toMatch(/\.png$/u);
    });
});
