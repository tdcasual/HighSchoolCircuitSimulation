import { describe, expect, it, vi } from 'vitest';
import {
    handleComponentDragMouseMove,
    handleWiringPreviewMouseMove,
    handleWireDragMouseMove,
    handleWireEndpointDragMouseMove,
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

describe('InteractionOrchestratorMouseMoveHandlers.handleWireEndpointDragMouseMove', () => {
    it('returns false when endpoint dragging is inactive', () => {
        const context = {
            isDraggingWireEndpoint: false
        };

        const handled = handleWireEndpointDragMouseMove.call(context, { clientX: 10, clientY: 20 }, 30, 40);

        expect(handled).toBe(false);
    });

    it('updates endpoint position, detaches terminal ref, and highlights wire segment snap', () => {
        const wire = {
            id: 'W1',
            a: { x: 10, y: 10 },
            b: { x: 90, y: 10 },
            aRef: { componentId: 'R1', terminalIndex: 0 }
        };
        const context = {
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 10, y: 10 },
                affected: [{ wireId: 'W1', end: 'a' }],
                detached: false
            },
            resolvePointerType: vi.fn(() => 'mouse'),
            snapPoint: vi.fn(() => ({ x: 80, y: 20, snap: { type: 'wire-segment', wireId: 'W2' } })),
            circuit: {
                getWire: vi.fn((id) => (id === 'W1' ? wire : null))
            },
            renderer: {
                highlightTerminal: vi.fn(),
                highlightWireNode: vi.fn(),
                clearTerminalHighlight: vi.fn(),
                refreshWire: vi.fn()
            }
        };

        const handled = handleWireEndpointDragMouseMove.call(context, { clientX: 120, clientY: 140 }, 60, 40);

        expect(handled).toBe(true);
        expect(wire.a).toEqual({ x: 80, y: 20 });
        expect(wire.aRef).toBeUndefined();
        expect(context.wireEndpointDrag.detached).toBe(true);
        expect(context.renderer.highlightWireNode).toHaveBeenCalledWith(80, 20);
        expect(context.renderer.highlightTerminal).not.toHaveBeenCalled();
        expect(context.renderer.clearTerminalHighlight).not.toHaveBeenCalled();
        expect(context.renderer.refreshWire).toHaveBeenCalledWith('W1');
    });

    it('applies touch axis-lock and forwards drag speed / excluded terminals into snap options', () => {
        const wire = {
            id: 'W1',
            a: { x: 12, y: 18 },
            b: { x: 96, y: 18 }
        };
        const context = {
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 12, y: 18 },
                affected: [{ wireId: 'W1', end: 'a' }],
                originTerminalKeys: new Set(['R1:0']),
                detached: false,
                axisLock: null,
                axisLockStartTime: 0,
                axisLockWindowMs: 80,
                startClient: { x: 100, y: 100 },
                lastClient: { x: 100, y: 100 },
                lastMoveTimeStamp: 0
            },
            resolvePointerType: vi.fn(() => 'touch'),
            snapPoint: vi.fn(() => ({ x: 84, y: 24, snap: { type: 'wire-segment', wireId: 'W2' } })),
            circuit: {
                getWire: vi.fn((id) => (id === 'W1' ? wire : null))
            },
            renderer: {
                highlightTerminal: vi.fn(),
                highlightWireNode: vi.fn(),
                clearTerminalHighlight: vi.fn(),
                refreshWire: vi.fn()
            },
            touchActionController: {
                cancel: vi.fn()
            }
        };

        const handled = handleWireEndpointDragMouseMove.call(
            context,
            { clientX: 126, clientY: 104, timeStamp: 40 },
            58,
            42
        );

        expect(handled).toBe(true);
        expect(context.wireEndpointDrag.axisLock).toBe('x');
        expect(context.wireEndpointDrag.excludeOriginTerminals).toBe(true);
        const snapCall = context.snapPoint.mock.calls[0];
        expect(snapCall[0]).toBe(58);
        expect(snapCall[1]).toBe(18);
        expect(snapCall[2]).toEqual(expect.objectContaining({
            excludeWireEndpoints: new Set(['W1:a']),
            allowWireSegmentSnap: true,
            excludeWireIds: new Set(['W1']),
            excludeTerminalKeys: new Set(['R1:0']),
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag'
        }));
        expect(snapCall[2].dragSpeedPxPerMs).toBeCloseTo(0.6576, 3);
        expect(context.touchActionController.cancel).toHaveBeenCalledTimes(1);
    });
});

describe('InteractionOrchestratorMouseMoveHandlers.handleWireDragMouseMove', () => {
    it('returns false when whole-wire drag is inactive', () => {
        const context = {
            isDraggingWire: false
        };

        const handled = handleWireDragMouseMove.call(context, { clientX: 10, clientY: 10 }, 20, 30);

        expect(handled).toBe(false);
    });

    it('cancels touch long-press tracking when drag crosses movement threshold', () => {
        const wire = {
            id: 'W1',
            a: { x: 40, y: 60 },
            b: { x: 120, y: 60 }
        };
        const context = {
            isDraggingWire: true,
            wireDrag: {
                wireId: 'W1',
                startCanvas: { x: 40, y: 60 },
                startClient: { x: 100, y: 100 },
                startA: { x: 40, y: 60 },
                startB: { x: 120, y: 60 },
                detached: false,
                lastDx: 0,
                lastDy: 0
            },
            resolvePointerType: vi.fn(() => 'touch'),
            circuit: {
                getWire: vi.fn(() => wire)
            },
            touchActionController: { cancel: vi.fn() },
            renderer: {
                refreshWire: vi.fn()
            }
        };

        const handled = handleWireDragMouseMove.call(context, {
            clientX: 120,
            clientY: 100,
            shiftKey: false
        }, 56, 60);

        expect(handled).toBe(true);
        expect(context.touchActionController.cancel).toHaveBeenCalledTimes(1);
    });

    it('detaches terminal refs and refreshes wire when translation changes', () => {
        const wire = {
            id: 'W1',
            a: { x: 40, y: 60 },
            b: { x: 120, y: 60 },
            aRef: { componentId: 'R1', terminalIndex: 0 },
            bRef: { componentId: 'R2', terminalIndex: 1 }
        };
        const context = {
            isDraggingWire: true,
            wireDrag: {
                wireId: 'W1',
                startCanvas: { x: 40, y: 60 },
                startClient: { x: 100, y: 100 },
                startA: { x: 40, y: 60 },
                startB: { x: 120, y: 60 },
                detached: false,
                lastDx: 0,
                lastDy: 0
            },
            resolvePointerType: vi.fn(() => 'mouse'),
            circuit: {
                getWire: vi.fn(() => wire)
            },
            renderer: {
                refreshWire: vi.fn()
            }
        };

        const handled = handleWireDragMouseMove.call(context, {
            clientX: 106,
            clientY: 106,
            shiftKey: false
        }, 58, 66);

        expect(handled).toBe(true);
        expect(context.wireDrag.detached).toBe(true);
        expect(wire.aRef).toBeUndefined();
        expect(wire.bRef).toBeUndefined();
        expect(wire.a).toEqual({ x: 58, y: 66 });
        expect(wire.b).toEqual({ x: 138, y: 66 });
        expect(context.renderer.refreshWire).toHaveBeenCalledWith('W1');
    });
});

describe('InteractionOrchestratorMouseMoveHandlers.handleComponentDragMouseMove', () => {
    it('returns false when component dragging is inactive', () => {
        const context = {
            isDragging: false
        };

        const handled = handleComponentDragMouseMove.call(context, { clientX: 10, clientY: 10 }, 20, 30);

        expect(handled).toBe(false);
    });

    it('updates normal component position with alignment snap and guide rendering', () => {
        const component = { id: 'R1', type: 'Resistor', x: 10, y: 20 };
        const context = {
            isDragging: true,
            dragTarget: 'R1',
            dragOffset: { x: 5, y: 7 },
            circuit: {
                getComponent: vi.fn(() => component)
            },
            detectAlignment: vi.fn(() => ({ snapX: null, snapY: 50 })),
            renderer: {
                updateComponentPosition: vi.fn()
            },
            showAlignmentGuides: vi.fn()
        };

        const handled = handleComponentDragMouseMove.call(context, { clientX: 30, clientY: 40 }, 25.4, 35.2);

        expect(handled).toBe(true);
        expect(component.x).toBe(20);
        expect(component.y).toBe(50);
        expect(context.renderer.updateComponentPosition).toHaveBeenCalledWith(component);
        expect(context.showAlignmentGuides).toHaveBeenCalledWith({ snapX: null, snapY: 50 });
    });

    it('moves blackbox group components and masked wire endpoints together', () => {
        const box = { id: 'B1', type: 'BlackBox', x: 40, y: 20 };
        const inner = { id: 'R2', type: 'Resistor', x: 60, y: 40 };
        const wire = {
            id: 'W1',
            a: { x: 70, y: 80 },
            b: { x: 140, y: 80 }
        };
        const context = {
            isDragging: true,
            dragTarget: 'B1',
            dragOffset: { x: 20, y: 10 },
            dragGroup: {
                boxId: 'B1',
                componentIds: ['R2'],
                connectedWireIds: ['W1'],
                wireEndpointMask: new Map([['W1', { aInside: true, bInside: false }]])
            },
            circuit: {
                getComponent: vi.fn((id) => {
                    if (id === 'B1') return box;
                    if (id === 'R2') return inner;
                    return null;
                }),
                getWire: vi.fn((id) => (id === 'W1' ? wire : null))
            },
            detectAlignment: vi.fn(() => ({ snapX: null, snapY: null })),
            renderer: {
                updateComponentTransform: vi.fn(),
                updateComponentPosition: vi.fn(),
                refreshWire: vi.fn()
            },
            showAlignmentGuides: vi.fn()
        };

        const handled = handleComponentDragMouseMove.call(context, { clientX: 200, clientY: 120 }, 100, 70);

        expect(handled).toBe(true);
        expect(box.x).toBe(80);
        expect(box.y).toBe(60);
        expect(inner.x).toBe(100);
        expect(inner.y).toBe(80);
        expect(wire.a).toEqual({ x: 110, y: 120 });
        expect(wire.b).toEqual({ x: 140, y: 80 });
        expect(context.renderer.updateComponentTransform).toHaveBeenCalledWith(inner);
        expect(context.renderer.updateComponentTransform).toHaveBeenCalledWith(box);
        expect(context.renderer.refreshWire).toHaveBeenCalledWith('W1');
        expect(context.renderer.updateComponentPosition).not.toHaveBeenCalled();
        expect(context.showAlignmentGuides).toHaveBeenCalledWith({ snapX: null, snapY: null });
    });
});

describe('InteractionOrchestratorMouseMoveHandlers.handleWiringPreviewMouseMove', () => {
    it('returns false when wiring preview is inactive', () => {
        const context = {
            isWiring: false,
            wireStart: null,
            tempWire: null
        };

        const handled = handleWiringPreviewMouseMove.call(context, { clientX: 10, clientY: 20 }, 30, 40);

        expect(handled).toBe(false);
    });

    it('updates temp wire and wire-node highlight for segment snap', () => {
        const context = {
            isWiring: true,
            wireStart: { x: 10, y: 20 },
            tempWire: 'TEMP',
            resolvePointerType: vi.fn(() => 'mouse'),
            snapPoint: vi.fn(() => ({
                x: 131,
                y: 141,
                snap: { type: 'wire-segment', wireId: 'W2' }
            })),
            renderer: {
                updateTempWire: vi.fn(),
                highlightTerminal: vi.fn(),
                highlightWireNode: vi.fn(),
                clearTerminalHighlight: vi.fn()
            }
        };

        const handled = handleWiringPreviewMouseMove.call(context, { clientX: 300, clientY: 320 }, 100, 120);

        expect(handled).toBe(true);
        expect(context.snapPoint).toHaveBeenCalledWith(100, 120, {
            allowWireSegmentSnap: true,
            pointerType: 'mouse'
        });
        expect(context.renderer.updateTempWire).toHaveBeenCalledWith('TEMP', 10, 20, 131, 141);
        expect(context.renderer.highlightWireNode).toHaveBeenCalledWith(131, 141);
        expect(context.renderer.highlightTerminal).not.toHaveBeenCalled();
        expect(context.renderer.clearTerminalHighlight).not.toHaveBeenCalled();
    });
});
