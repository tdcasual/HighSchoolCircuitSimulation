import { describe, expect, it, vi } from 'vitest';
import {
    handlePanningMouseUp,
    handleWireModeGestureMouseUp
} from '../src/app/interaction/InteractionOrchestratorMouseUpHandlers.js';

describe('InteractionOrchestratorMouseUpHandlers.handleWireModeGestureMouseUp', () => {
    it('returns false when no deferred wire-mode gesture exists', () => {
        const context = {
            finishWiringToPoint: vi.fn()
        };
        const event = { clientX: 100, clientY: 120 };

        const handled = handleWireModeGestureMouseUp.call(context, event, null);

        expect(handled).toBe(false);
        expect(context.finishWiringToPoint).not.toHaveBeenCalled();
    });

    it('finishes deferred wiring when gesture represents active wiring', () => {
        const context = {
            finishWiringToPoint: vi.fn(),
            clearPendingToolType: vi.fn(),
            pointerDownInfo: {
                componentId: 'R1'
            }
        };
        const event = { clientX: 10, clientY: 20 };
        const gesture = {
            pointerType: 'touch',
            point: { x: 40, y: 60 },
            wasWiring: true
        };

        const handled = handleWireModeGestureMouseUp.call(context, event, gesture);

        expect(handled).toBe(true);
        expect(context.finishWiringToPoint).toHaveBeenCalledWith({ x: 40, y: 60 }, { pointerType: 'touch' });
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
        expect(context.pointerDownInfo).toBeNull();
    });

    it('starts deferred wiring when gesture represents first tap', () => {
        const context = {
            startWiringFromPoint: vi.fn(),
            updateStatus: vi.fn(),
            pointerDownInfo: {
                componentId: 'R2'
            }
        };
        const event = { clientX: 30, clientY: 50 };
        const gesture = {
            pointerType: 'touch',
            point: { x: 80, y: 100 },
            wasWiring: false
        };

        const handled = handleWireModeGestureMouseUp.call(context, event, gesture);

        expect(handled).toBe(true);
        expect(context.startWiringFromPoint).toHaveBeenCalledWith({ x: 80, y: 100 }, event, true);
        expect(context.updateStatus).toHaveBeenCalledWith('导线模式：选择终点');
        expect(context.pointerDownInfo).toBeNull();
    });
});

describe('InteractionOrchestratorMouseUpHandlers.handlePanningMouseUp', () => {
    it('returns false when panning is not active', () => {
        const context = {
            isPanning: false
        };

        const handled = handlePanningMouseUp.call(context);

        expect(handled).toBe(false);
    });

    it('stops panning and resets cursor', () => {
        const context = {
            isPanning: true,
            svg: { style: { cursor: 'grabbing' } },
            pointerDownInfo: { componentId: 'R3' }
        };

        const handled = handlePanningMouseUp.call(context);

        expect(handled).toBe(true);
        expect(context.isPanning).toBe(false);
        expect(context.svg.style.cursor).toBe('');
        expect(context.pointerDownInfo).toBeNull();
    });
});
