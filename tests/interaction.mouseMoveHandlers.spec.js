import { describe, expect, it, vi } from 'vitest';
import {
    handlePanningMouseMove,
    handlePointerDownInfoMouseMove,
    handleWireModeGestureMouseMove
} from '../src/app/interaction/InteractionOrchestratorMouseMoveHandlers.js';

describe('InteractionOrchestratorMouseMoveHandlers.handleWireModeGestureMouseMove', () => {
    it('returns false when no deferred wire-mode gesture exists', () => {
        const context = {
            wireModeGesture: null
        };
        const event = { clientX: 100, clientY: 120 };

        const handled = handleWireModeGestureMouseMove.call(context, event);

        expect(handled).toBe(false);
    });

    it('consumes gesture without side effects when movement is below threshold', () => {
        const context = {
            wireModeGesture: {
                kind: 'terminal-extend',
                componentId: 'R1',
                terminalIndex: 0,
                screenX: 100,
                screenY: 100,
                moveThresholdPx: 18,
                wasWiring: true
            },
            startTerminalExtend: vi.fn()
        };

        const handled = handleWireModeGestureMouseMove.call(context, {
            clientX: 110,
            clientY: 100
        });

        expect(handled).toBe(true);
        expect(context.startTerminalExtend).not.toHaveBeenCalled();
        expect(context.wireModeGesture).not.toBeNull();
    });

    it('starts terminal extend and guards next wire mouseup when drag exceeds threshold in wiring state', () => {
        const context = {
            wireModeGesture: {
                kind: 'terminal-extend',
                componentId: 'R1',
                terminalIndex: 0,
                screenX: 100,
                screenY: 100,
                moveThresholdPx: 18,
                wasWiring: true
            },
            startTerminalExtend: vi.fn()
        };

        const handled = handleWireModeGestureMouseMove.call(context, {
            clientX: 122,
            clientY: 100
        });

        expect(handled).toBe(true);
        expect(context.startTerminalExtend).toHaveBeenCalledWith('R1', 0, {
            clientX: 122,
            clientY: 100
        });
        expect(context.ignoreNextWireMouseUp).toBe(true);
        expect(context.wireModeGesture).toBeNull();
    });

    it('does not guard next wire mouseup when endpoint drag actually starts', () => {
        const context = {
            isDraggingWireEndpoint: false,
            wireModeGesture: {
                kind: 'wire-endpoint',
                wireId: 'W1',
                end: 'b',
                screenX: 100,
                screenY: 100,
                moveThresholdPx: 12,
                wasWiring: true
            },
            startWireEndpointDrag: vi.fn(() => {
                context.isDraggingWireEndpoint = true;
            })
        };

        const handled = handleWireModeGestureMouseMove.call(context, {
            clientX: 114,
            clientY: 100
        });

        expect(handled).toBe(true);
        expect(context.startWireEndpointDrag).toHaveBeenCalledWith('W1', 'b', {
            clientX: 114,
            clientY: 100
        });
        expect(context.ignoreNextWireMouseUp).not.toBe(true);
        expect(context.wireModeGesture).toBeNull();
    });
});

describe('InteractionOrchestratorMouseMoveHandlers.handlePointerDownInfoMouseMove', () => {
    it('returns false when pointerDownInfo is absent', () => {
        const context = {
            pointerDownInfo: null
        };

        const handled = handlePointerDownInfoMouseMove.call(context, { clientX: 0, clientY: 0 });

        expect(handled).toBe(false);
    });

    it('marks pointerDownInfo as moved after threshold and cancels long-press on touch', () => {
        const context = {
            pointerDownInfo: {
                pointerType: 'touch',
                moved: false,
                screenX: 100,
                screenY: 100
            },
            touchActionController: {
                cancel: vi.fn()
            }
        };

        const handled = handlePointerDownInfoMouseMove.call(context, {
            clientX: 120,
            clientY: 100
        });

        expect(handled).toBe(true);
        expect(context.pointerDownInfo.moved).toBe(true);
        expect(context.touchActionController.cancel).toHaveBeenCalledTimes(1);
    });
});

describe('InteractionOrchestratorMouseMoveHandlers.handlePanningMouseMove', () => {
    it('returns false when panning is inactive', () => {
        const context = {
            isPanning: false
        };

        const handled = handlePanningMouseMove.call(context, { clientX: 10, clientY: 20 });

        expect(handled).toBe(false);
    });

    it('updates view offset and transform while panning', () => {
        const context = {
            isPanning: true,
            panStart: { x: 10, y: 20 },
            viewOffset: { x: 0, y: 0 },
            updateViewTransform: vi.fn()
        };

        const handled = handlePanningMouseMove.call(context, { clientX: 35, clientY: 65 });

        expect(handled).toBe(true);
        expect(context.viewOffset).toEqual({ x: 25, y: 45 });
        expect(context.updateViewTransform).toHaveBeenCalledTimes(1);
    });
});
