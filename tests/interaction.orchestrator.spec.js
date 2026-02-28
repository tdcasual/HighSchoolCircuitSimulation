import { afterEach, describe, expect, it, vi } from 'vitest';
import * as InteractionOrchestrator from '../src/app/interaction/InteractionOrchestrator.js';
import { ErrorCodes } from '../src/core/errors/ErrorCodes.js';
import { AppError } from '../src/core/errors/AppError.js';

function makeTarget({
    classes = [],
    closestComponent = null,
    closestWireGroup = null
} = {}) {
    return {
        dataset: {},
        classList: {
            contains: (name) => classes.includes(name)
        },
        closest: (selector) => {
            if (selector === '.component') return closestComponent;
            if (selector === '.wire-group') return closestWireGroup;
            return null;
        }
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('InteractionOrchestrator.onMouseDown', () => {
    it('starts panning on middle button', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: null,
            isWiring: false,
            screenToCanvas: vi.fn(() => ({ x: 0, y: 0 })),
            startPanning: vi.fn(),
            startWiringFromPoint: vi.fn(),
            clearSelection: vi.fn(),
            isWireEndpointTarget: vi.fn(() => false)
        };
        const event = {
            button: 1,
            target: makeTarget(),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.startPanning).toHaveBeenCalledWith(event);
        expect(context.clearSelection).not.toHaveBeenCalled();
    });

    it('starts wiring when pending wire tool is active', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: 'Wire',
            isWiring: false,
            screenToCanvas: vi.fn(() => ({ x: 120, y: 80 })),
            startWiringFromPoint: vi.fn(),
            updateStatus: vi.fn(),
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 100,
            clientY: 70,
            target: makeTarget(),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.startWiringFromPoint).toHaveBeenCalledWith({ x: 120, y: 80 }, event, true);
        expect(context.updateStatus).toHaveBeenCalledWith('导线模式：选择终点');
        expect(context.placePendingToolAt).not.toHaveBeenCalled();
    });

    it('starts pending-wire wiring from targeted terminal position', () => {
        const terminalTarget = makeTarget({ classes: ['terminal-hit-area'] });
        const componentGroup = { dataset: { id: 'R1' } };
        terminalTarget.dataset.terminal = '1';
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => terminalTarget),
            pendingToolType: 'Wire',
            isWiring: false,
            screenToCanvas: vi.fn(() => ({ x: 5, y: 6 })),
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 210, y: 310 }))
            },
            startWiringFromPoint: vi.fn(),
            updateStatus: vi.fn(),
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 100,
            clientY: 70,
            target: {
                ...terminalTarget,
                closest: (selector) => {
                    if (selector === '.component') return componentGroup;
                    return null;
                }
            },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.startWiringFromPoint).toHaveBeenCalledWith({ x: 210, y: 310 }, event, true);
        expect(context.screenToCanvas).toHaveBeenCalledTimes(1);
        expect(context.screenToCanvas).toHaveBeenCalledWith(100, 70);
    });

    it('finishes pending-wire wiring to targeted terminal position', () => {
        const terminalTarget = makeTarget({ classes: ['terminal'] });
        const componentGroup = { dataset: { id: 'R2' } };
        terminalTarget.dataset.terminal = '0';
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => terminalTarget),
            pendingToolType: 'Wire',
            isWiring: true,
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 420, y: 180 }))
            },
            screenToCanvas: vi.fn(() => ({ x: 1, y: 2 })),
            finishWiringToPoint: vi.fn(),
            clearPendingToolType: vi.fn(),
            updateStatus: vi.fn(),
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 200,
            clientY: 120,
            target: {
                ...terminalTarget,
                closest: (selector) => {
                    if (selector === '.component') return componentGroup;
                    return null;
                }
            },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.finishWiringToPoint).toHaveBeenCalledWith({ x: 420, y: 180 }, { pointerType: 'mouse' });
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
        expect(context.screenToCanvas).toHaveBeenCalledTimes(1);
        expect(context.screenToCanvas).toHaveBeenCalledWith(200, 120);
    });

    it('cancels pending-wire wiring when finishing on blank area', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: 'Wire',
            stickyWireTool: false,
            isWiring: true,
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 310, y: 210 })),
            snapPoint: vi.fn(() => ({ x: 310, y: 210, snap: { type: 'grid' } })),
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn(),
            clearPendingToolType: vi.fn(),
            updateStatus: vi.fn(),
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 220,
            clientY: 150,
            target: makeTarget(),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.finishWiringToPoint).not.toHaveBeenCalled();
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });

    it('keeps pending wire tool armed in sticky wire mode after finishing attempt', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'touch'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: 'Wire',
            pendingToolItem: { classList: { remove: vi.fn() } },
            stickyWireTool: true,
            isWiring: true,
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 320, y: 220 })),
            snapPoint: vi.fn(() => ({ x: 320, y: 220, snap: { type: 'grid' } })),
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn(),
            clearPendingToolType: vi.fn(),
            updateStatus: vi.fn(),
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 240,
            clientY: 160,
            target: makeTarget(),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).not.toHaveBeenCalled();
        expect(context.pendingToolType).toBe('Wire');
        expect(context.pendingToolItem).toBe(null);
    });

    it('splits wire on ctrl-click', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: null,
            isWiring: false,
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 44, y: 33 })),
            selectWire: vi.fn(),
            splitWireAtPoint: vi.fn(),
            startWireDrag: vi.fn()
        };
        const wireGroup = { dataset: { id: 'W1' } };
        const event = {
            button: 0,
            ctrlKey: true,
            metaKey: false,
            clientX: 120,
            clientY: 70,
            target: makeTarget({
                classes: ['wire'],
                closestWireGroup: wireGroup
            }),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.selectWire).toHaveBeenCalledWith('W1');
        expect(context.splitWireAtPoint).toHaveBeenCalledWith('W1', 44, 33);
        expect(context.startWireDrag).not.toHaveBeenCalled();
    });

    it('starts endpoint drag directly when touching near a wire endpoint', () => {
        const wire = {
            id: 'W1',
            a: { x: 40, y: 50 },
            b: { x: 160, y: 50 }
        };
        const context = {
            resolvePointerType: vi.fn(() => 'touch'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: null,
            isWiring: false,
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 46, y: 52 })),
            getAdaptiveSnapThreshold: vi.fn(() => 24),
            circuit: {
                getWire: vi.fn(() => wire)
            },
            startWireEndpointDrag: vi.fn(),
            splitWireAtPoint: vi.fn(),
            startWireDrag: vi.fn()
        };
        const wireGroup = { dataset: { id: 'W1' } };
        const event = {
            button: 0,
            ctrlKey: false,
            metaKey: false,
            clientX: 120,
            clientY: 70,
            target: makeTarget({
                classes: ['wire-hit-area'],
                closestWireGroup: wireGroup
            }),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.startWireEndpointDrag).toHaveBeenCalledWith('W1', 'a', event);
        expect(context.startWireDrag).not.toHaveBeenCalled();
    });

    it('selects component when tapping terminal outside wire tool mode', () => {
        const terminalTarget = makeTarget({ classes: ['terminal-hit-area'] });
        terminalTarget.dataset.terminal = '1';
        const componentGroup = { dataset: { id: 'R1' } };
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => terminalTarget),
            pendingToolType: null,
            isWiring: false,
            selectedComponent: null,
            selectComponent: vi.fn(),
            startTerminalExtend: vi.fn(),
            startWiringFromPoint: vi.fn(),
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 210, y: 140 }))
            },
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 0, y: 0 })),
            clearSelection: vi.fn()
        };
        const event = {
            button: 0,
            altKey: false,
            clientX: 100,
            clientY: 80,
            target: {
                ...terminalTarget,
                closest: (selector) => (selector === '.component' ? componentGroup : null)
            },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.selectComponent).toHaveBeenCalledWith('R1');
        expect(context.startWiringFromPoint).not.toHaveBeenCalled();
        expect(context.startTerminalExtend).not.toHaveBeenCalled();
    });

    it('uses alt+terminal drag to extend terminal lead', () => {
        const terminalTarget = makeTarget({ classes: ['terminal-hit-area'] });
        terminalTarget.dataset.terminal = '0';
        const componentGroup = { dataset: { id: 'R2' } };
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => terminalTarget),
            pendingToolType: null,
            isWiring: false,
            selectedComponent: 'R2',
            selectComponent: vi.fn(),
            startTerminalExtend: vi.fn(),
            startWiringFromPoint: vi.fn(),
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 12, y: 34 }))
            },
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 0, y: 0 })),
            clearSelection: vi.fn()
        };
        const event = {
            button: 0,
            altKey: true,
            clientX: 100,
            clientY: 80,
            target: {
                ...terminalTarget,
                closest: (selector) => (selector === '.component' ? componentGroup : null)
            },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionOrchestrator.onMouseDown.call(context, event);

        expect(context.startTerminalExtend).toHaveBeenCalledWith('R2', 0, event);
        expect(context.startWiringFromPoint).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestrator.onMouseUp', () => {
    it('ends panning and resets cursor', () => {
        const context = {
            isPanning: true,
            svg: { style: { cursor: 'grabbing' } }
        };
        const event = { target: makeTarget() };

        InteractionOrchestrator.onMouseUp.call(context, event);

        expect(context.isPanning).toBe(false);
        expect(context.svg.style.cursor).toBe('');
    });

    it('finalizes wire endpoint drag transaction', () => {
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                affected: [{ wireId: 'W1', end: 'a' }]
            },
            renderer: { clearTerminalHighlight: vi.fn() },
            selectedWire: 'W1',
            compactWiresAndRefresh: vi.fn(),
            circuit: { rebuildNodes: vi.fn() },
            commitHistoryTransaction: vi.fn()
        };
        const event = { target: makeTarget() };

        InteractionOrchestrator.onMouseUp.call(context, event);

        expect(context.isDraggingWireEndpoint).toBe(false);
        expect(context.wireEndpointDrag).toBe(null);
        expect(context.renderer.clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(context.compactWiresAndRefresh).toHaveBeenCalledWith({
            preferredWireId: 'W1',
            scopeWireIds: ['W1']
        });
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('auto-creates a bridge wire when touch endpoint drag snaps to another endpoint', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1234);
        const addWire = vi.fn();
        const context = {
            isPanning: false,
            endpointAutoBridgeMode: 'on',
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 40, y: 20 },
                primaryOriginRef: { componentId: 'R1', terminalIndex: 0 },
                affected: [{ wireId: 'W1', end: 'a' }],
                lastSnap: { type: 'wire-endpoint', wireId: 'W2', end: 'b' },
                lastPoint: { x: 140, y: 80 }
            },
            resolvePointerType: vi.fn(() => 'touch'),
            renderer: { clearTerminalHighlight: vi.fn(), addWire: vi.fn() },
            selectedWire: 'W1',
            compactWiresAndRefresh: vi.fn(),
            circuit: {
                getWire: vi.fn(() => null),
                addWire,
                rebuildNodes: vi.fn()
            },
            commitHistoryTransaction: vi.fn()
        };
        const event = { target: makeTarget() };

        InteractionOrchestrator.onMouseUp.call(context, event);

        expect(addWire).toHaveBeenCalledTimes(1);
        expect(addWire).toHaveBeenCalledWith({
            id: 'wire_1234',
            a: { x: 40, y: 20 },
            b: { x: 140, y: 80 },
            aRef: { componentId: 'R1', terminalIndex: 0 }
        });
        expect(context.renderer.addWire).toHaveBeenCalledWith({
            id: 'wire_1234',
            a: { x: 40, y: 20 },
            b: { x: 140, y: 80 },
            aRef: { componentId: 'R1', terminalIndex: 0 }
        });
        expect(context.compactWiresAndRefresh).toHaveBeenCalledTimes(1);
        const compactCall = context.compactWiresAndRefresh.mock.calls[0][0];
        expect(compactCall.preferredWireId).toBe('W1');
        expect(compactCall.scopeWireIds).toEqual(expect.arrayContaining(['W1', 'W2', 'wire_1234']));
        expect(compactCall.scopeWireIds).toHaveLength(3);
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('does not auto-create endpoint bridge in desktop auto mode', () => {
        const addWire = vi.fn();
        const context = {
            isPanning: false,
            endpointAutoBridgeMode: 'auto',
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 40, y: 20 },
                primaryOriginRef: { componentId: 'R1', terminalIndex: 0 },
                affected: [{ wireId: 'W1', end: 'a' }],
                lastSnap: { type: 'wire-endpoint', wireId: 'W2', end: 'b' },
                lastPoint: { x: 140, y: 80 }
            },
            resolvePointerType: vi.fn(() => 'touch'),
            renderer: { clearTerminalHighlight: vi.fn(), addWire: vi.fn() },
            selectedWire: 'W1',
            compactWiresAndRefresh: vi.fn(),
            circuit: {
                getWire: vi.fn(() => null),
                addWire,
                rebuildNodes: vi.fn()
            },
            commitHistoryTransaction: vi.fn()
        };
        const event = { target: makeTarget() };

        InteractionOrchestrator.onMouseUp.call(context, event);

        expect(addWire).not.toHaveBeenCalled();
        expect(context.renderer.addWire).not.toHaveBeenCalled();
        expect(context.compactWiresAndRefresh).toHaveBeenCalledWith({
            preferredWireId: 'W1',
            scopeWireIds: ['W1']
        });
    });

    it('cancels wiring when mouseup lands on blank canvas', () => {
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: true,
            ignoreNextWireMouseUp: false,
            resolveTerminalTarget: vi.fn(() => null),
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 120, y: 90 })),
            snapPoint: vi.fn(() => ({ x: 120, y: 90, snap: { type: 'grid' } })),
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn(),
            resolvePointerType: vi.fn(() => 'mouse'),
            updateStatus: vi.fn()
        };

        InteractionOrchestrator.onMouseUp.call(context, {
            target: makeTarget(),
            clientX: 300,
            clientY: 220
        });

        expect(context.finishWiringToPoint).not.toHaveBeenCalled();
        expect(context.snapPoint).toHaveBeenCalledWith(120, 90, {
            allowWireSegmentSnap: true,
            pointerType: 'mouse'
        });
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('未连接到端子/端点，已取消连线');
    });

    it('finishes wiring on nearby wire endpoint when mouseup target misses endpoint dom', () => {
        const snapped = {
            x: 160,
            y: 120,
            snap: { type: 'wire-endpoint', wireId: 'W2', end: 'a' }
        };
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: true,
            ignoreNextWireMouseUp: false,
            resolveTerminalTarget: vi.fn(() => null),
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 158, y: 117 })),
            snapPoint: vi.fn(() => snapped),
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn(),
            resolvePointerType: vi.fn(() => 'touch'),
            updateStatus: vi.fn()
        };

        InteractionOrchestrator.onMouseUp.call(context, {
            target: makeTarget(),
            clientX: 320,
            clientY: 200
        });

        expect(context.snapPoint).toHaveBeenCalledWith(158, 117, {
            allowWireSegmentSnap: true,
            pointerType: 'touch'
        });
        expect(context.finishWiringToPoint).toHaveBeenCalledWith(snapped, { pointerType: 'touch' });
        expect(context.cancelWiring).not.toHaveBeenCalled();
        expect(context.updateStatus).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestrator.onMouseLeave', () => {
    it('cancels dragging state and commits history', () => {
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: true,
            dragTarget: 'R1',
            dragGroup: { boxId: 'B1' },
            isDraggingComponent: true,
            hideAlignmentGuides: vi.fn(),
            circuit: { rebuildNodes: vi.fn() },
            commitHistoryTransaction: vi.fn()
        };
        const event = { target: makeTarget() };

        InteractionOrchestrator.onMouseLeave.call(context, event);

        expect(context.isDragging).toBe(false);
        expect(context.dragTarget).toBe(null);
        expect(context.dragGroup).toBe(null);
        expect(context.isDraggingComponent).toBe(false);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });
});

describe('InteractionOrchestrator.onContextMenu', () => {
    it('opens probe context menu and selects wire', () => {
        const context = {
            resolveProbeMarkerTarget: vi.fn(() => ({
                dataset: { probeId: 'P1', wireId: 'W1' }
            })),
            selectWire: vi.fn(),
            showProbeContextMenu: vi.fn()
        };
        const event = {
            preventDefault: vi.fn(),
            target: makeTarget()
        };

        InteractionOrchestrator.onContextMenu.call(context, event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(context.selectWire).toHaveBeenCalledWith('W1');
        expect(context.showProbeContextMenu).toHaveBeenCalledWith(event, 'P1', 'W1');
    });

    it('opens component context menu when component is targeted', () => {
        const component = { dataset: { id: 'R1' } };
        const context = {
            resolveProbeMarkerTarget: vi.fn(() => null),
            selectComponent: vi.fn(),
            showContextMenu: vi.fn(),
            hideContextMenu: vi.fn()
        };
        const event = {
            preventDefault: vi.fn(),
            target: makeTarget({ closestComponent: component })
        };

        InteractionOrchestrator.onContextMenu.call(context, event);

        expect(context.selectComponent).toHaveBeenCalledWith('R1');
        expect(context.showContextMenu).toHaveBeenCalledWith(event, 'R1');
        expect(context.hideContextMenu).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestrator.onDoubleClick', () => {
    it('renames probe when double-clicking probe marker', () => {
        const context = {
            resolveProbeMarkerTarget: vi.fn(() => ({
                dataset: { probeId: 'P1' }
            })),
            renameObservationProbe: vi.fn(),
            showPropertyDialog: vi.fn()
        };
        const event = { target: makeTarget() };

        InteractionOrchestrator.onDoubleClick.call(context, event);

        expect(context.renameObservationProbe).toHaveBeenCalledWith('P1');
        expect(context.showPropertyDialog).not.toHaveBeenCalled();
    });

    it('opens property dialog when double-clicking component', () => {
        const component = { dataset: { id: 'R2' } };
        const context = {
            resolveProbeMarkerTarget: vi.fn(() => null),
            renameObservationProbe: vi.fn(),
            showPropertyDialog: vi.fn()
        };
        const event = {
            target: makeTarget({ closestComponent: component })
        };

        InteractionOrchestrator.onDoubleClick.call(context, event);

        expect(context.showPropertyDialog).toHaveBeenCalledWith('R2');
        expect(context.renameObservationProbe).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestrator.onMouseMove', () => {
    it('updates view offset during panning', () => {
        const context = {
            isPanning: true,
            panStart: { x: 10, y: 20 },
            viewOffset: { x: 0, y: 0 },
            updateViewTransform: vi.fn()
        };
        const event = { clientX: 35, clientY: 65 };

        InteractionOrchestrator.onMouseMove.call(context, event);

        expect(context.viewOffset).toEqual({ x: 25, y: 45 });
        expect(context.updateViewTransform).toHaveBeenCalledTimes(1);
    });

    it('updates temp wire preview and terminal highlight while wiring', () => {
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 100, y: 120 })),
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: true,
            wireStart: { x: 10, y: 20 },
            tempWire: 'TEMP',
            resolvePointerType: vi.fn(() => 'mouse'),
            snapPoint: vi.fn(() => ({
                x: 130,
                y: 140,
                snap: { type: 'terminal', componentId: 'R1', terminalIndex: 0 }
            })),
            renderer: {
                updateTempWire: vi.fn(),
                highlightTerminal: vi.fn(),
                clearTerminalHighlight: vi.fn()
            }
        };
        const event = { clientX: 300, clientY: 320 };

        InteractionOrchestrator.onMouseMove.call(context, event);

        expect(context.snapPoint).toHaveBeenCalledWith(100, 120, {
            allowWireSegmentSnap: true,
            pointerType: 'mouse'
        });
        expect(context.renderer.updateTempWire).toHaveBeenCalledWith('TEMP', 10, 20, 130, 140);
        expect(context.renderer.highlightTerminal).toHaveBeenCalledWith('R1', 0);
        expect(context.renderer.clearTerminalHighlight).not.toHaveBeenCalled();
    });

    it('cancels touch long-press tracking once component drag intent is detected', () => {
        const context = {
            pointerDownInfo: {
                componentId: 'R1',
                wasSelected: false,
                screenX: 10,
                screenY: 10,
                pointerType: 'touch',
                moved: false
            },
            resolvePointerType: vi.fn(() => 'touch'),
            touchActionController: { cancel: vi.fn() },
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 0, y: 0 })),
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: false
        };

        InteractionOrchestrator.onMouseMove.call(context, {
            clientX: 30,
            clientY: 10
        });

        expect(context.pointerDownInfo.moved).toBe(true);
        expect(context.touchActionController.cancel).toHaveBeenCalledTimes(1);
    });

    it('updates temp wire preview and wire-node highlight for segment snap while wiring', () => {
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 100, y: 120 })),
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
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
        const event = { clientX: 300, clientY: 320 };

        InteractionOrchestrator.onMouseMove.call(context, event);

        expect(context.snapPoint).toHaveBeenCalledWith(100, 120, {
            allowWireSegmentSnap: true,
            pointerType: 'mouse'
        });
        expect(context.renderer.updateTempWire).toHaveBeenCalledWith('TEMP', 10, 20, 131, 141);
        expect(context.renderer.highlightWireNode).toHaveBeenCalledWith(131, 141);
        expect(context.renderer.highlightTerminal).not.toHaveBeenCalled();
        expect(context.renderer.clearTerminalHighlight).not.toHaveBeenCalled();
    });

    it('shows wire-node highlight while dragging endpoint over wire segment', () => {
        const wire = {
            id: 'W1',
            a: { x: 10, y: 10 },
            b: { x: 90, y: 10 },
            aRef: { componentId: 'R1', terminalIndex: 0 }
        };
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 60, y: 40 })),
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
        const event = { clientX: 300, clientY: 320 };

        InteractionOrchestrator.onMouseMove.call(context, event);

        expect(wire.a).toEqual({ x: 80, y: 20 });
        expect(wire.aRef).toBeUndefined();
        expect(context.wireEndpointDrag.detached).toBe(true);
        expect(context.renderer.highlightWireNode).toHaveBeenCalledWith(80, 20);
        expect(context.renderer.highlightTerminal).not.toHaveBeenCalled();
        expect(context.renderer.clearTerminalHighlight).not.toHaveBeenCalled();
        expect(context.renderer.refreshWire).toHaveBeenCalledWith('W1');
    });

    it('passes touch endpoint-drag intent to snapping and touch highlight affordance', () => {
        const wire = {
            id: 'W1',
            a: { x: 12, y: 18 },
            b: { x: 96, y: 18 }
        };
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 58, y: 42 })),
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 12, y: 18 },
                affected: [{ wireId: 'W1', end: 'a' }],
                detached: false
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
            }
        };
        const event = { clientX: 300, clientY: 320 };

        InteractionOrchestrator.onMouseMove.call(context, event);

        expect(context.snapPoint).toHaveBeenCalledWith(58, 42, {
            excludeWireEndpoints: new Set(['W1:a']),
            allowWireSegmentSnap: true,
            excludeWireIds: new Set(['W1']),
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag'
        });
        expect(context.renderer.highlightWireNode).toHaveBeenCalledWith(84, 24, {
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag'
        });
    });

    it('releases origin terminal snap once endpoint drag exceeds touch move threshold', () => {
        const wire = {
            id: 'W1',
            a: { x: 12, y: 18 },
            b: { x: 96, y: 18 },
            aRef: { componentId: 'R1', terminalIndex: 0 }
        };
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 58, y: 42 })),
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 12, y: 18 },
                affected: [{ wireId: 'W1', end: 'a' }],
                originTerminalKeys: new Set(['R1:0']),
                detached: false,
                startClient: { x: 100, y: 100 },
                lastClient: { x: 100, y: 100 },
                lastMoveTimeStamp: 0
            },
            resolvePointerType: vi.fn(() => 'touch'),
            snapPoint: vi.fn(() => ({ x: 84, y: 24, snap: { type: 'grid' } })),
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

        InteractionOrchestrator.onMouseMove.call(context, {
            clientX: 120,
            clientY: 100,
            timeStamp: 40
        });

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
        expect(context.wireEndpointDrag.excludeOriginTerminals).toBe(true);
    });

    it('locks endpoint drag to dominant axis during early touch movement', () => {
        const wire = {
            id: 'W1',
            a: { x: 12, y: 18 },
            b: { x: 96, y: 18 }
        };
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 58, y: 42 })),
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 12, y: 18 },
                affected: [{ wireId: 'W1', end: 'a' }],
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
            }
        };

        InteractionOrchestrator.onMouseMove.call(context, {
            clientX: 126,
            clientY: 104,
            timeStamp: 40
        });

        expect(context.wireEndpointDrag.axisLock).toBe('x');
        const snapCall = context.snapPoint.mock.calls[0];
        expect(snapCall[0]).toBe(58);
        expect(snapCall[1]).toBe(18);
        expect(snapCall[2]).toEqual(expect.objectContaining({
            excludeWireEndpoints: new Set(['W1:a']),
            allowWireSegmentSnap: true,
            excludeWireIds: new Set(['W1']),
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag'
        }));
        expect(snapCall[2].dragSpeedPxPerMs).toBeCloseTo(0.6576, 3);
    });

    it('cancels touch long-press tracking when endpoint drag starts moving', () => {
        const wire = {
            id: 'W1',
            a: { x: 12, y: 18 },
            b: { x: 96, y: 18 }
        };
        const context = {
            isPanning: false,
            screenToCanvas: vi.fn(() => ({ x: 58, y: 42 })),
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                origin: { x: 12, y: 18 },
                affected: [{ wireId: 'W1', end: 'a' }],
                detached: false
            },
            resolvePointerType: vi.fn(() => 'touch'),
            snapPoint: vi.fn(() => ({ x: 84, y: 24, snap: { type: 'wire-segment', wireId: 'W2' } })),
            circuit: {
                getWire: vi.fn((id) => (id === 'W1' ? wire : null))
            },
            touchActionController: { cancel: vi.fn() },
            renderer: {
                highlightTerminal: vi.fn(),
                highlightWireNode: vi.fn(),
                clearTerminalHighlight: vi.fn(),
                refreshWire: vi.fn()
            }
        };

        InteractionOrchestrator.onMouseMove.call(context, { clientX: 300, clientY: 320 });

        expect(context.touchActionController.cancel).toHaveBeenCalledTimes(1);
    });

    it('cancels touch long-press tracking when whole-wire drag crosses move threshold', () => {
        const wire = {
            id: 'W1',
            a: { x: 40, y: 60 },
            b: { x: 120, y: 60 }
        };
        const context = {
            isPanning: false,
            isDraggingWireEndpoint: false,
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
            isDragging: false,
            resolvePointerType: vi.fn(() => 'touch'),
            screenToCanvas: vi.fn(() => ({ x: 56, y: 60 })),
            circuit: {
                getWire: vi.fn(() => wire)
            },
            touchActionController: { cancel: vi.fn() },
            renderer: {
                refreshWire: vi.fn()
            }
        };

        InteractionOrchestrator.onMouseMove.call(context, {
            clientX: 120,
            clientY: 100,
            shiftKey: false
        });

        expect(context.touchActionController.cancel).toHaveBeenCalledTimes(1);
    });
});

describe('InteractionOrchestrator.onKeyDown', () => {
    it('closes dialog on Escape and skips other shortcuts while dialog is open', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => false) }
            })),
            activeElement: null
        });

        const context = {
            hideDialog: vi.fn(),
            clearSelection: vi.fn()
        };
        const event = {
            key: 'Escape',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: false,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(context.hideDialog).toHaveBeenCalledTimes(1);
        expect(context.clearSelection).not.toHaveBeenCalled();
    });

    it('handles Ctrl/Cmd+Z undo shortcut', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            })),
            activeElement: null
        });

        const context = {
            undo: vi.fn(),
            redo: vi.fn()
        };
        const event = {
            key: 'z',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: true,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(context.undo).toHaveBeenCalledTimes(1);
        expect(context.redo).not.toHaveBeenCalled();
    });

    it('deletes selected wire on Delete key', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            })),
            activeElement: null
        });

        const context = {
            selectedComponent: null,
            selectedWire: 'W1',
            deleteWire: vi.fn(),
            deleteComponent: vi.fn()
        };
        const event = {
            key: 'Delete',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: false,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(context.deleteWire).toHaveBeenCalledWith('W1');
        expect(context.deleteComponent).not.toHaveBeenCalled();
    });

    it('surfaces action failure message from DTO on Delete key', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            })),
            activeElement: null
        });

        const context = {
            selectedComponent: null,
            selectedWire: 'W1',
            deleteWire: vi.fn(() => ({
                ok: false,
                type: 'wire.delete_failed',
                message: '删除失败: boom'
            })),
            deleteComponent: vi.fn(),
            updateStatus: vi.fn()
        };
        const event = {
            key: 'Delete',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: false,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(context.updateStatus).toHaveBeenCalledWith('删除失败: boom');
        expect(context.deleteWire).toHaveBeenCalledWith('W1');
        expect(context.deleteComponent).not.toHaveBeenCalled();
    });

    it('maps interaction failure to APP_ERR_* code', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            })),
            activeElement: null
        });

        const failureResult = {
            ok: false,
            type: 'wire.delete_failed',
            message: '删除失败: boom',
            error: new Error('boom')
        };
        const context = {
            selectedComponent: null,
            selectedWire: 'W1',
            deleteWire: vi.fn(() => failureResult),
            deleteComponent: vi.fn(),
            updateStatus: vi.fn()
        };
        const event = {
            key: 'Delete',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: false,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(failureResult.error).toBeInstanceOf(AppError);
        expect(failureResult.error.code).toBe(ErrorCodes.APP_ERR_ACTION_FAILED);
        expect(context.lastActionError.code).toBe(ErrorCodes.APP_ERR_ACTION_FAILED);
    });

    it('logger attaches traceId for action failures', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            })),
            activeElement: null
        });

        const logger = {
            error: vi.fn()
        };
        const failureResult = {
            ok: false,
            type: 'wire.delete_failed',
            message: '删除失败: boom'
        };
        const context = {
            selectedComponent: null,
            selectedWire: 'W1',
            deleteWire: vi.fn(() => failureResult),
            deleteComponent: vi.fn(),
            updateStatus: vi.fn(),
            logger
        };
        const event = {
            key: 'Delete',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: false,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
            source: 'interaction',
            stage: 'action_failed',
            traceId: expect.any(String),
            error: expect.objectContaining({
                code: ErrorCodes.APP_ERR_ACTION_FAILED
            }),
            actionType: 'wire.delete_failed'
        }));
        expect(typeof failureResult.traceId).toBe('string');
        expect(failureResult.traceId.length).toBeGreaterThan(0);
    });

    it('ignores shortcuts when focus is in editable input', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            })),
            activeElement: { tagName: 'INPUT', isContentEditable: false }
        });

        const context = {
            selectedComponent: null,
            selectedWire: 'W1',
            deleteWire: vi.fn()
        };
        const event = {
            key: 'Delete',
            preventDefault: vi.fn(),
            metaKey: false,
            ctrlKey: false,
            shiftKey: false
        };

        InteractionOrchestrator.onKeyDown.call(context, event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(context.deleteWire).not.toHaveBeenCalled();
    });
});
