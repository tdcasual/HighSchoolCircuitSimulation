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

    it('suspends active wiring for pinch gesture instead of canceling it', () => {
        const pendingToolItem = { id: 'wire-btn' };
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: true,
            wireStart: {
                x: 44,
                y: 66,
                snap: { type: 'terminal', componentId: 'R1', terminalIndex: 0 }
            },
            tempWire: 'TEMP-1',
            ignoreNextWireMouseUp: true,
            pendingToolType: 'Wire',
            pendingToolItem,
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            renderer: {
                removeTempWire: vi.fn(),
                clearTerminalHighlight: vi.fn()
            },
            hideAlignmentGuides: vi.fn(),
            cancelWiring: vi.fn()
        };

        PointerSessionManager.endPrimaryInteractionForGesture.call(context);

        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.isWiring).toBe(false);
        expect(context.wireStart).toBe(null);
        expect(context.tempWire).toBe(null);
        expect(context.ignoreNextWireMouseUp).toBe(false);
        expect(context.suspendedWiringSession).toMatchObject({
            wireStart: { x: 44, y: 66, snap: { type: 'terminal', componentId: 'R1', terminalIndex: 0 } },
            pendingToolType: 'Wire',
            pendingToolItem,
            mobileInteractionMode: 'wire',
            stickyWireTool: true
        });
        expect(context.renderer.removeTempWire).toHaveBeenCalledWith('TEMP-1');
        expect(context.renderer.clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
    });

    it('drops terminal and rheostat edit flags when pinch takes over', () => {
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: false,
            isTerminalExtending: true,
            isRheostatDragging: true,
            hideAlignmentGuides: vi.fn(),
            commitHistoryTransaction: vi.fn()
        };

        PointerSessionManager.endPrimaryInteractionForGesture.call(context);

        expect(context.isTerminalExtending).toBe(false);
        expect(context.isRheostatDragging).toBe(false);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
    });

    it('ends panning gesture without throwing when svg root is missing', () => {
        const context = {
            isPanning: true,
            svg: null,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: false
        };

        expect(() => PointerSessionManager.endPrimaryInteractionForGesture.call(context)).not.toThrow();
        expect(context.isPanning).toBe(false);
    });

    it('finalizes terminal-extension transaction when pinch takes over', () => {
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: false,
            isTerminalExtending: true,
            isRheostatDragging: false,
            hideAlignmentGuides: vi.fn(),
            circuit: { rebuildNodes: vi.fn() },
            commitHistoryTransaction: vi.fn()
        };

        PointerSessionManager.endPrimaryInteractionForGesture.call(context);

        expect(context.isTerminalExtending).toBe(false);
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
    });

    it('finalizes rheostat transaction when pinch takes over', () => {
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: false,
            isTerminalExtending: false,
            isRheostatDragging: true,
            hideAlignmentGuides: vi.fn(),
            commitHistoryTransaction: vi.fn()
        };

        PointerSessionManager.endPrimaryInteractionForGesture.call(context);

        expect(context.isRheostatDragging).toBe(false);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('restores suspended wiring when pinch gesture ends and anchor is still valid', () => {
        const pendingToolItem = { id: 'wire-btn' };
        const context = {
            pinchGesture: {
                pointerAId: 1,
                pointerBId: 2
            },
            activePointers: new Map([[2, { clientX: 20, clientY: 30, pointerType: 'touch' }]]),
            suspendedWiringSession: {
                wireStart: {
                    x: 12,
                    y: 18,
                    snap: { type: 'terminal', componentId: 'R2', terminalIndex: 1 }
                },
                pendingToolType: 'Wire',
                pendingToolItem,
                mobileInteractionMode: 'wire',
                stickyWireTool: true
            },
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 80, y: 120 }))
            },
            circuit: {
                getWire: vi.fn(() => null)
            },
            pendingToolType: null,
            pendingToolItem: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            startWiringFromPoint: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn(),
            syncMobileModeButtons: vi.fn()
        };

        PointerSessionManager.endPinchGestureIfNeeded.call(context);

        expect(context.pinchGesture).toBe(null);
        expect(context.suspendedWiringSession).toBe(null);
        expect(context.startWiringFromPoint).toHaveBeenCalledWith({
            x: 80,
            y: 120,
            snap: { type: 'terminal', componentId: 'R2', terminalIndex: 1 }
        }, null, false);
        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.pendingToolType).toBe('Wire');
        expect(context.pendingToolItem).toBe(pendingToolItem);
        expect(context.mobileInteractionMode).toBe('wire');
        expect(context.stickyWireTool).toBe(true);
        expect(context.syncMobileModeButtons).toHaveBeenCalledTimes(1);
    });

    it('cancels suspended wiring when pinch ends but wiring anchor is invalid', () => {
        const context = {
            pinchGesture: {
                pointerAId: 1,
                pointerBId: 2
            },
            activePointers: new Map([[2, { clientX: 20, clientY: 30, pointerType: 'touch' }]]),
            suspendedWiringSession: {
                wireStart: {
                    x: 12,
                    y: 18,
                    snap: { type: 'wire-endpoint', wireId: 'W404', end: 'a' }
                },
                pendingToolType: 'Wire',
                pendingToolItem: null,
                mobileInteractionMode: 'wire',
                stickyWireTool: true
            },
            renderer: {
                getTerminalPosition: vi.fn(() => null)
            },
            circuit: {
                getWire: vi.fn(() => null)
            },
            startWiringFromPoint: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn(),
            syncMobileModeButtons: vi.fn()
        };

        PointerSessionManager.endPinchGestureIfNeeded.call(context);

        expect(context.pinchGesture).toBe(null);
        expect(context.suspendedWiringSession).toBe(null);
        expect(context.startWiringFromPoint).not.toHaveBeenCalled();
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('preserves active wiring on pointer cancel while endpoint edit-drag is active', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 12,
            isWiring: true,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: { wireId: 'W1', affected: [{ wireId: 'W1', end: 'a' }] },
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            activePointers: new Map([[12, { clientX: 10, clientY: 20, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 12 });

        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(context.primaryPointerId).toBe(null);
    });

    it('preserves active wiring on pointer cancel when mode store reports endpoint-edit', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 121,
            isWiring: true,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            wireModeGesture: null,
            interactionModeStore: {
                getState: vi.fn(() => ({
                    mode: 'endpoint-edit',
                    context: {
                        pendingToolType: 'Wire',
                        mobileInteractionMode: 'wire',
                        stickyWireTool: true,
                        isWiring: true,
                        isDraggingWireEndpoint: true,
                        isTerminalExtending: false,
                        isRheostatDragging: false
                    }
                }))
            },
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            activePointers: new Map([[121, { clientX: 11, clientY: 21, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 121 });

        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(context.primaryPointerId).toBe(null);
    });

    it('preserves active wiring on pointer cancel while terminal extension drag is active', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 13,
            isWiring: true,
            isTerminalExtending: true,
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            activePointers: new Map([[13, { clientX: 12, clientY: 24, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 13 });

        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(context.primaryPointerId).toBe(null);
    });

    it('commits terminal-extension transaction on pointer cancel interruption', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 1310,
            isWiring: false,
            isTerminalExtending: true,
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            hideAlignmentGuides: vi.fn(),
            circuit: { rebuildNodes: vi.fn() },
            commitHistoryTransaction: vi.fn(),
            activePointers: new Map([[1310, { clientX: 12, clientY: 24, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 1310 });

        expect(context.isTerminalExtending).toBe(false);
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
    });

    it('clears wire mouseup guard after pointer cancel preserves active wiring', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 131,
            isWiring: true,
            isTerminalExtending: true,
            ignoreNextWireMouseUp: true,
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            activePointers: new Map([[131, { clientX: 10, clientY: 20, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 131 });

        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.ignoreNextWireMouseUp).toBe(false);
    });

    it('preserves active wiring on pointer cancel while rheostat slider drag is active', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 14,
            isWiring: true,
            isRheostatDragging: true,
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            activePointers: new Map([[14, { clientX: 40, clientY: 60, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 14 });

        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(context.primaryPointerId).toBe(null);
    });

    it('commits rheostat transaction on pointer cancel interruption', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 1410,
            isWiring: false,
            isRheostatDragging: true,
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            hideAlignmentGuides: vi.fn(),
            commitHistoryTransaction: vi.fn(),
            activePointers: new Map([[1410, { clientX: 40, clientY: 60, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 1410 });

        expect(context.isRheostatDragging).toBe(false);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('cancels active wiring on pointer cancel when no edit drag is active', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            blockSinglePointerInteraction: false,
            primaryPointerId: 22,
            isWiring: true,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            cancelWiring: vi.fn(),
            onMouseLeave: vi.fn(),
            activePointers: new Map([[22, { clientX: 30, clientY: 40, pointerType: 'touch' }]]),
            releasePointerCaptureSafe: vi.fn(),
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerCancel.call(context, { pointerId: 22 });

        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(context.primaryPointerId).toBe(null);
    });

    it('accepts intentional touch destructive tap with hold and low drift', () => {
        const allow = PointerSessionManager.isIntentionalDestructiveTap(
            { pointerType: 'touch', clientX: 100, clientY: 200, timeStamp: 10 },
            { pointerType: 'touch', clientX: 104, clientY: 206, timeStamp: 180 }
        );
        expect(allow).toBe(true);
    });

    it('rejects accidental touch destructive tap when press is too short', () => {
        const allow = PointerSessionManager.isIntentionalDestructiveTap(
            { pointerType: 'touch', clientX: 100, clientY: 200, timeStamp: 10 },
            { pointerType: 'touch', clientX: 102, clientY: 203, timeStamp: 80 }
        );
        expect(allow).toBe(false);
    });

    it('cleans up primary pointer on leave with pressed buttons when pointer capture is unavailable', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            svg: {
                hasPointerCapture: vi.fn(() => false)
            },
            primaryPointerId: 31,
            onMouseLeave: vi.fn(),
            activePointers: new Map([[31, { clientX: 10, clientY: 20, pointerType: 'mouse' }]])
        };

        PointerSessionManager.onPointerLeave.call(context, {
            pointerId: 31,
            buttons: 1
        });

        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(context.primaryPointerId).toBe(null);
        expect(context.activePointers.has(31)).toBe(false);
    });

    it('keeps interaction active on leave with pressed buttons when pointer capture is held', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            svg: {
                hasPointerCapture: vi.fn(() => true)
            },
            primaryPointerId: 32,
            onMouseLeave: vi.fn(),
            activePointers: new Map([[32, { clientX: 11, clientY: 21, pointerType: 'mouse' }]])
        };

        PointerSessionManager.onPointerLeave.call(context, {
            pointerId: 32,
            buttons: 1
        });

        expect(context.onMouseLeave).not.toHaveBeenCalled();
        expect(context.primaryPointerId).toBe(32);
        expect(context.activePointers.has(32)).toBe(true);
    });

    it('cleans pinch pointer state on leave when pointer capture is unavailable', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: { pointerAId: 41, pointerBId: 42 },
            svg: {
                hasPointerCapture: vi.fn(() => false)
            },
            activePointers: new Map([[41, { clientX: 12, clientY: 18, pointerType: 'touch' }]]),
            endPinchGestureIfNeeded: vi.fn(),
            releasePointerCaptureSafe: vi.fn(),
            blockSinglePointerInteraction: true,
            lastPrimaryPointerType: 'touch'
        };

        PointerSessionManager.onPointerLeave.call(context, {
            pointerId: 41,
            buttons: 1
        });

        expect(context.endPinchGestureIfNeeded).toHaveBeenCalledTimes(1);
        expect(context.releasePointerCaptureSafe).toHaveBeenCalledWith(41);
        expect(context.activePointers.has(41)).toBe(false);
        expect(context.blockSinglePointerInteraction).toBe(false);
        expect(context.lastPrimaryPointerType).toBe('mouse');
    });

    it('releases single-pointer interaction block when last pointer leaves without pinch gesture', () => {
        const context = {
            touchActionController: { onPointerCancel: vi.fn() },
            pinchGesture: null,
            svg: {
                hasPointerCapture: vi.fn(() => false)
            },
            blockSinglePointerInteraction: true,
            primaryPointerId: null,
            lastPrimaryPointerType: 'touch',
            onMouseLeave: vi.fn(),
            activePointers: new Map([[51, { clientX: 6, clientY: 9, pointerType: 'touch' }]])
        };

        PointerSessionManager.onPointerLeave.call(context, {
            pointerId: 51,
            buttons: 0
        });

        expect(context.activePointers.has(51)).toBe(false);
        expect(context.blockSinglePointerInteraction).toBe(false);
        expect(context.lastPrimaryPointerType).toBe('mouse');
    });

    it('does not throw on pointer down when svg is temporarily unavailable', () => {
        const context = {
            activePointers: new Map(),
            svg: null,
            shouldStartPinchGesture: vi.fn(() => false),
            startPinchGesture: vi.fn(),
            blockSinglePointerInteraction: false,
            primaryPointerId: null,
            lastPrimaryPointerType: 'mouse',
            onMouseDown: vi.fn()
        };
        const event = {
            pointerId: 77,
            pointerType: 'mouse',
            clientX: 20,
            clientY: 30,
            preventDefault: vi.fn()
        };

        expect(() => PointerSessionManager.onPointerDown.call(context, event)).not.toThrow();
        expect(context.onMouseDown).toHaveBeenCalledWith(event);
    });

    it('does not throw when releasing pointer capture without svg root', () => {
        expect(() => PointerSessionManager.releasePointerCaptureSafe.call({ svg: null }, 5)).not.toThrow();
    });

    it('updates pinch transform without throwing when svg root is missing', () => {
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
            svg: null,
            scale: 1,
            viewOffset: { x: 0, y: 0 },
            updateViewTransform: vi.fn()
        };

        expect(() => PointerSessionManager.updatePinchGesture.call(context)).not.toThrow();
        expect(context.scale).toBeCloseTo(2, 6);
        expect(context.viewOffset.x).toBeCloseTo(-100, 6);
        expect(context.viewOffset.y).toBeCloseTo(-20, 6);
        expect(context.updateViewTransform).toHaveBeenCalledTimes(1);
    });
});
