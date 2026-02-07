import { describe, expect, it, vi } from 'vitest';
import * as InteractionOrchestrator from '../src/ui/interaction/InteractionOrchestrator.js';

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

describe('InteractionOrchestrator.onMouseDown', () => {
    it('starts panning on middle button', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            resolveProbeMarkerTarget: vi.fn(() => null),
            resolveTerminalTarget: vi.fn(() => null),
            pendingToolType: null,
            isWiring: false,
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
