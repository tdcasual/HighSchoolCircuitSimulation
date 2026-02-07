import { describe, expect, it, vi } from 'vitest';
import * as PointerSessionManager from '../src/ui/interaction/PointerSessionManager.js';

describe('PointerSessionManager', () => {
    it('routes primary pointer down to mouse handler', () => {
        const context = {
            activePointers: new Map(),
            svg: {
                setPointerCapture: vi.fn()
            },
            shouldStartPinchGesture: vi.fn(() => false),
            startPinchGesture: vi.fn(),
            blockSinglePointerInteraction: false,
            primaryPointerId: null,
            lastPrimaryPointerType: 'mouse',
            onMouseDown: vi.fn()
        };
        const event = {
            pointerId: 11,
            pointerType: 'mouse',
            clientX: 100,
            clientY: 120,
            preventDefault: vi.fn()
        };

        PointerSessionManager.onPointerDown.call(context, event);

        expect(context.activePointers.get(11)).toEqual({
            clientX: 100,
            clientY: 120,
            pointerType: 'mouse'
        });
        expect(context.primaryPointerId).toBe(11);
        expect(context.onMouseDown).toHaveBeenCalledWith(event);
        expect(context.startPinchGesture).not.toHaveBeenCalled();
    });

    it('starts pinch gesture when second non-mouse pointer appears', () => {
        const context = {
            activePointers: new Map([[1, { clientX: 10, clientY: 10, pointerType: 'touch' }]]),
            svg: {
                setPointerCapture: vi.fn()
            },
            shouldStartPinchGesture: vi.fn(() => true),
            startPinchGesture: vi.fn(),
            blockSinglePointerInteraction: false,
            primaryPointerId: null,
            lastPrimaryPointerType: 'touch',
            onMouseDown: vi.fn()
        };
        const event = {
            pointerId: 2,
            pointerType: 'touch',
            clientX: 40,
            clientY: 70,
            preventDefault: vi.fn()
        };

        PointerSessionManager.onPointerDown.call(context, event);

        expect(context.startPinchGesture).toHaveBeenCalledTimes(1);
        expect(context.onMouseDown).not.toHaveBeenCalled();
    });

    it('updates scale and offset during pinch gesture', () => {
        const context = {
            pinchGesture: {
                pointerAId: 1,
                pointerBId: 2,
                startScale: 1,
                startDistance: 100,
                startCanvasPivot: { x: 50, y: 60 }
            },
            activePointers: new Map([
                [1, { clientX: 0, clientY: 0, pointerType: 'touch' }],
                [2, { clientX: 0, clientY: 200, pointerType: 'touch' }]
            ]),
            svg: {
                getBoundingClientRect: () => ({ left: 10, top: 20 })
            },
            scale: 1,
            viewOffset: { x: 0, y: 0 },
            updateViewTransform: vi.fn()
        };

        PointerSessionManager.updatePinchGesture.call(context);

        expect(context.scale).toBeCloseTo(2, 6);
        expect(context.viewOffset.x).toBeCloseTo(-110, 6);
        expect(context.viewOffset.y).toBeCloseTo(-40, 6);
        expect(context.updateViewTransform).toHaveBeenCalledTimes(1);
    });
});
