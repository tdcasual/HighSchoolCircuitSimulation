import { describe, expect, it, vi } from 'vitest';
import {
    handleActiveWiringMouseUp,
    handlePointerDownSelectionToggleMouseUp,
    handlePanningMouseUp,
    handleWireEndpointDragMouseUp,
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

describe('InteractionOrchestratorMouseUpHandlers.handleActiveWiringMouseUp', () => {
    it('returns false when wiring mode is inactive', () => {
        const context = {
            isWiring: false
        };
        const event = {
            target: {}
        };

        const handled = handleActiveWiringMouseUp.call(context, event);

        expect(handled).toBe(false);
    });

    it('consumes guarded mouseup without finishing or canceling wiring', () => {
        const context = {
            isWiring: true,
            ignoreNextWireMouseUp: true,
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn()
        };
        const event = {
            target: {}
        };

        const handled = handleActiveWiringMouseUp.call(context, event);

        expect(handled).toBe(true);
        expect(context.ignoreNextWireMouseUp).toBe(false);
        expect(context.finishWiringToPoint).not.toHaveBeenCalled();
        expect(context.cancelWiring).not.toHaveBeenCalled();
    });

    it('finishes wiring when mouseup lands on terminal', () => {
        const componentGroup = { dataset: { id: 'R1' } };
        const target = {
            dataset: {},
            closest: (selector) => (selector === '.component' ? componentGroup : null)
        };
        const context = {
            isWiring: true,
            ignoreNextWireMouseUp: false,
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveTerminalTarget: vi.fn(() => ({ dataset: { terminal: '1' } })),
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 200, y: 80 }))
            },
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn()
        };
        const event = {
            target,
            clientX: 120,
            clientY: 90
        };

        const handled = handleActiveWiringMouseUp.call(context, event);

        expect(handled).toBe(true);
        expect(context.finishWiringToPoint).toHaveBeenCalledWith({ x: 200, y: 80 }, { pointerType: 'mouse' });
        expect(context.cancelWiring).not.toHaveBeenCalled();
    });

    it('cancels wiring when no terminal/endpoint/snap target is found', () => {
        const context = {
            isWiring: true,
            ignoreNextWireMouseUp: false,
            resolvePointerType: vi.fn(() => 'touch'),
            resolveTerminalTarget: vi.fn(() => null),
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 300, y: 180 })),
            snapPoint: vi.fn(() => ({ x: 300, y: 180, snap: { type: 'grid' } })),
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn()
        };
        const event = {
            target: {
                dataset: {},
                closest: () => null
            },
            clientX: 300,
            clientY: 180
        };

        const handled = handleActiveWiringMouseUp.call(context, event);

        expect(handled).toBe(true);
        expect(context.finishWiringToPoint).not.toHaveBeenCalled();
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('未连接到端子/端点，已取消连线');
    });
});

describe('InteractionOrchestratorMouseUpHandlers.handlePointerDownSelectionToggleMouseUp', () => {
    it('returns false when there is no pointer-down selection context', () => {
        const context = {
            clearSelection: vi.fn()
        };
        const event = {
            target: {}
        };

        const handled = handlePointerDownSelectionToggleMouseUp.call(context, event, null);

        expect(handled).toBe(false);
        expect(context.clearSelection).not.toHaveBeenCalled();
    });

    it('clears selection when tapping selected component without movement', () => {
        const pointerDownInfo = {
            componentId: 'R1',
            wasSelected: true,
            moved: false,
            screenX: 100,
            screenY: 80,
            pointerType: 'touch'
        };
        const context = {
            resolvePointerType: vi.fn(() => 'touch'),
            clearSelection: vi.fn()
        };
        const event = {
            clientX: 104,
            clientY: 83,
            target: {
                closest: (selector) => (selector === '.component' ? { dataset: { id: 'R1' } } : null)
            }
        };

        const handled = handlePointerDownSelectionToggleMouseUp.call(context, event, pointerDownInfo);

        expect(handled).toBe(true);
        expect(context.clearSelection).toHaveBeenCalledTimes(1);
        expect(context.pointerDownInfo).toBeNull();
    });

    it('returns false when pointer moved beyond threshold', () => {
        const pointerDownInfo = {
            componentId: 'R1',
            wasSelected: true,
            moved: false,
            screenX: 100,
            screenY: 80,
            pointerType: 'mouse'
        };
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            clearSelection: vi.fn()
        };
        const event = {
            clientX: 140,
            clientY: 120,
            target: {
                closest: (selector) => (selector === '.component' ? { dataset: { id: 'R1' } } : null)
            }
        };

        const handled = handlePointerDownSelectionToggleMouseUp.call(context, event, pointerDownInfo);

        expect(handled).toBe(false);
        expect(context.clearSelection).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestratorMouseUpHandlers.handleWireEndpointDragMouseUp', () => {
    it('returns false when endpoint dragging is not active', () => {
        const context = {
            isDraggingWireEndpoint: false
        };
        const event = { target: {} };

        const handled = handleWireEndpointDragMouseUp.call(context, event);

        expect(handled).toBe(false);
    });

    it('finalizes endpoint drag transaction and compacts wires', () => {
        const context = {
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                affected: [{ wireId: 'W1', end: 'a' }]
            },
            resolvePointerType: vi.fn(() => 'touch'),
            renderer: { clearTerminalHighlight: vi.fn() },
            selectedWire: 'W1',
            compactWiresAndRefresh: vi.fn(),
            circuit: { rebuildNodes: vi.fn() },
            commitHistoryTransaction: vi.fn(),
            pointerDownInfo: { componentId: 'R1' }
        };
        const event = { target: {} };

        const handled = handleWireEndpointDragMouseUp.call(context, event);

        expect(handled).toBe(true);
        expect(context.isDraggingWireEndpoint).toBe(false);
        expect(context.wireEndpointDrag).toBe(null);
        expect(context.renderer.clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(context.compactWiresAndRefresh).toHaveBeenCalledWith({
            preferredWireId: 'W1',
            scopeWireIds: ['W1']
        });
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
        expect(context.pointerDownInfo).toBeNull();
    });
});
