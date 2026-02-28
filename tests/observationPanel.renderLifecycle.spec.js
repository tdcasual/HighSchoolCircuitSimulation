import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';

describe('ObservationPanel render lifecycle', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('does not schedule duplicate raf renders for batched updates', () => {
        const rafQueue = [];
        const requestAnimationFrame = vi.fn((callback) => {
            rafQueue.push(callback);
            return rafQueue.length;
        });
        vi.stubGlobal('window', { requestAnimationFrame });

        const ctx = {
            _renderRaf: 0,
            renderAll: vi.fn(),
            isObservationActive: () => true
        };

        ObservationPanel.prototype.requestRender.call(ctx, { onlyIfActive: false });
        ObservationPanel.prototype.requestRender.call(ctx, { onlyIfActive: false });

        expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
        expect(rafQueue).toHaveLength(1);
    });

    it('resets raf token after callback and can schedule next frame', () => {
        const rafQueue = [];
        const requestAnimationFrame = vi.fn((callback) => {
            rafQueue.push(callback);
            return rafQueue.length;
        });
        vi.stubGlobal('window', { requestAnimationFrame });

        const ctx = {
            _renderRaf: 0,
            renderAll: vi.fn(),
            isObservationActive: () => true
        };

        ObservationPanel.prototype.requestRender.call(ctx, { onlyIfActive: false });
        expect(rafQueue).toHaveLength(1);

        rafQueue[0]();
        expect(ctx._renderRaf).toBe(0);
        expect(ctx.renderAll).toHaveBeenCalledTimes(1);

        ObservationPanel.prototype.requestRender.call(ctx, { onlyIfActive: false });
        expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
        expect(rafQueue).toHaveLength(2);
    });

    it('skips render scheduling when onlyIfActive is true and panel is hidden', () => {
        const requestAnimationFrame = vi.fn(() => 1);
        vi.stubGlobal('window', { requestAnimationFrame });

        const ctx = {
            _renderRaf: 0,
            renderAll: vi.fn(),
            isObservationActive: () => false
        };

        ObservationPanel.prototype.requestRender.call(ctx, { onlyIfActive: true });

        expect(requestAnimationFrame).not.toHaveBeenCalled();
        expect(ctx._renderRaf).toBe(0);
    });

    it('stabilizes auto-range frame against small jitter and expands on large change', () => {
        const rangeRef = {
            value: { minX: 0, maxX: 10, minY: -5, maxY: 5 }
        };
        const plot = {
            buffer: {
                length: 20,
                getRange: () => rangeRef.value
            },
            x: { autoRange: true, min: null, max: null },
            y: { autoRange: true, min: null, max: null }
        };
        const canvas = { width: 320, height: 200 };

        const frame1 = ObservationPanel.prototype.computePlotFrame.call({}, plot, canvas, 1);
        expect(frame1).toBeTruthy();

        rangeRef.value = { minX: 0.3, maxX: 9.7, minY: -4.7, maxY: 4.7 };
        const frame2 = ObservationPanel.prototype.computePlotFrame.call({}, plot, canvas, 1);
        expect(frame2).toBeTruthy();
        expect(frame2.xMin).toBeCloseTo(frame1.xMin, 3);
        expect(frame2.xMax).toBeCloseTo(frame1.xMax, 3);

        rangeRef.value = { minX: -5, maxX: 13, minY: -8, maxY: 7 };
        const frame3 = ObservationPanel.prototype.computePlotFrame.call({}, plot, canvas, 1);
        expect(frame3.xMin).toBeLessThan(frame2.xMin);
        expect(frame3.xMax).toBeGreaterThan(frame2.xMax);
    });
});
