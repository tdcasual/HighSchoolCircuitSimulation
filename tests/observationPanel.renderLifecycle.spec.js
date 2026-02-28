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
});
