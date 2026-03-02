import { describe, expect, it, vi } from 'vitest';
import * as DragBehaviors from '../src/ui/interaction/DragBehaviors.js';

describe('DragBehaviors.startDragging', () => {
    it('initializes drag state and offset for regular component', () => {
        const comp = { id: 'R1', type: 'Resistor', x: 100, y: 80 };
        const context = {
            circuit: {
                getComponent: vi.fn(() => comp)
            },
            beginHistoryTransaction: vi.fn(),
            screenToCanvas: vi.fn(() => ({ x: 130, y: 95 })),
            selectComponent: vi.fn(),
            isDragging: false,
            dragTarget: null,
            isDraggingComponent: false,
            dragGroup: { boxId: 'legacy' },
            dragOffset: { x: 0, y: 0 }
        };
        const componentGroup = { dataset: { id: 'R1' } };
        const event = { clientX: 300, clientY: 220 };

        DragBehaviors.startDragging.call(context, componentGroup, event);

        expect(context.isDragging).toBe(true);
        expect(context.dragTarget).toBe('R1');
        expect(context.isDraggingComponent).toBe(true);
        expect(context.dragGroup).toBe(null);
        expect(context.beginHistoryTransaction).toHaveBeenCalledWith('移动元器件');
        expect(context.dragOffset).toEqual({ x: 30, y: 15 });
        expect(context.selectComponent).toHaveBeenCalledWith('R1');
    });

    it('builds drag group metadata for black box components', () => {
        const box = { id: 'B1', type: 'BlackBox', x: 40, y: 20 };
        const wires = [
            { id: 'W1', a: { x: 10, y: 10 }, b: { x: 200, y: 200 } },
            { id: 'W2', a: { x: 300, y: 300 }, b: { x: 20, y: 20 } },
            { id: 'W3', a: { x: 500, y: 500 }, b: { x: 600, y: 600 } }
        ];
        const context = {
            circuit: {
                getComponent: vi.fn(() => box),
                getAllWires: vi.fn(() => wires)
            },
            renderer: {
                isPointInsideBlackBox: vi.fn((pt) => pt.x < 100 && pt.y < 100)
            },
            getBlackBoxContainedComponentIds: vi.fn(() => ['B1', 'R2']),
            beginHistoryTransaction: vi.fn(),
            screenToCanvas: vi.fn(() => ({ x: 55, y: 45 })),
            selectComponent: vi.fn(),
            isDragging: false,
            dragTarget: null,
            isDraggingComponent: false,
            dragGroup: null,
            dragOffset: { x: 0, y: 0 }
        };
        const componentGroup = { dataset: { id: 'B1' } };
        const event = { clientX: 111, clientY: 222 };

        DragBehaviors.startDragging.call(context, componentGroup, event);

        expect(context.getBlackBoxContainedComponentIds).toHaveBeenCalledWith(box, { includeBoxes: true });
        expect(context.dragGroup.boxId).toBe('B1');
        expect(context.dragGroup.componentIds).toEqual(['B1', 'R2']);
        expect(context.dragGroup.connectedWireIds).toEqual(['W1', 'W2']);
        expect(context.dragGroup.wireEndpointMask.get('W1')).toEqual({ aInside: true, bInside: false });
        expect(context.dragGroup.wireEndpointMask.get('W2')).toEqual({ aInside: false, bInside: true });
        expect(context.dragGroup.wireEndpointMask.has('W3')).toBe(false);
        expect(context.selectComponent).toHaveBeenCalledWith('B1');
    });
});

describe('DragBehaviors auxiliary edit drags', () => {
    it('tracks terminal extension drag lifecycle for pointer-cancel guards', () => {
        const comp = { id: 'R1', type: 'Resistor', rotation: 0 };
        let onUpHandler = null;
        const context = {
            circuit: {
                getComponent: vi.fn(() => comp),
                rebuildNodes: vi.fn()
            },
            beginHistoryTransaction: vi.fn(),
            scale: 1,
            registerDragListeners: vi.fn((_event, _onMove, onUp) => {
                onUpHandler = onUp;
                return vi.fn();
            }),
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            hideAlignmentGuides: vi.fn(),
            commitHistoryTransaction: vi.fn(),
            updateStatus: vi.fn(),
            isTerminalExtending: false
        };
        const event = {
            clientX: 100,
            clientY: 120,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        DragBehaviors.startTerminalExtend.call(context, 'R1', 0, event);
        expect(context.isTerminalExtending).toBe(true);
        expect(typeof onUpHandler).toBe('function');

        onUpHandler();
        expect(context.isTerminalExtending).toBe(false);
    });

    it('tracks rheostat slider drag lifecycle for pointer-cancel guards', () => {
        const comp = { id: 'RH1', type: 'Rheostat', rotation: 0, position: 0.5 };
        let onUpHandler = null;
        const context = {
            circuit: {
                getComponent: vi.fn(() => comp)
            },
            beginHistoryTransaction: vi.fn(),
            commitHistoryTransaction: vi.fn(),
            registerDragListeners: vi.fn((_event, _onMove, onUp) => {
                onUpHandler = onUp;
                return vi.fn();
            }),
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            updateRheostatPanelValues: vi.fn(),
            updatePropertyPanel: vi.fn(),
            isRheostatDragging: false
        };
        const event = {
            clientX: 50,
            clientY: 60,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        DragBehaviors.startRheostatDrag.call(context, 'RH1', event);
        expect(context.isRheostatDragging).toBe(true);
        expect(context.beginHistoryTransaction).toHaveBeenCalledTimes(1);
        expect(typeof onUpHandler).toBe('function');

        onUpHandler();
        expect(context.isRheostatDragging).toBe(false);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('stops applying terminal extension move updates once drag is externally suspended', () => {
        const comp = {
            id: 'R1',
            type: 'Resistor',
            rotation: 0,
            terminalExtensions: { 0: { x: 0, y: 0 } }
        };
        let onMoveHandler = null;
        const context = {
            circuit: {
                getComponent: vi.fn(() => comp),
                rebuildNodes: vi.fn()
            },
            beginHistoryTransaction: vi.fn(),
            scale: 1,
            registerDragListeners: vi.fn((_event, onMove) => {
                onMoveHandler = onMove;
                return vi.fn();
            }),
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            hideAlignmentGuides: vi.fn(),
            commitHistoryTransaction: vi.fn(),
            updateStatus: vi.fn(),
            isTerminalExtending: false
        };
        const startEvent = {
            clientX: 100,
            clientY: 100,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        DragBehaviors.startTerminalExtend.call(context, 'R1', 0, startEvent);
        expect(context.isTerminalExtending).toBe(true);
        expect(typeof onMoveHandler).toBe('function');

        context.isTerminalExtending = false;
        onMoveHandler({ clientX: 140, clientY: 100 });

        expect(comp.terminalExtensions[0]).toEqual({ x: 0, y: 0 });
        expect(context.renderer.refreshComponent).not.toHaveBeenCalled();
    });

    it('stops applying rheostat slider move updates once drag is externally suspended', () => {
        const comp = { id: 'RH2', type: 'Rheostat', rotation: 0, position: 0.5 };
        let onMoveHandler = null;
        const context = {
            circuit: {
                getComponent: vi.fn(() => comp)
            },
            registerDragListeners: vi.fn((_event, onMove) => {
                onMoveHandler = onMove;
                return vi.fn();
            }),
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            updateRheostatPanelValues: vi.fn(),
            updatePropertyPanel: vi.fn(),
            isRheostatDragging: false
        };
        const startEvent = {
            clientX: 60,
            clientY: 60,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        DragBehaviors.startRheostatDrag.call(context, 'RH2', startEvent);
        expect(context.isRheostatDragging).toBe(true);
        expect(typeof onMoveHandler).toBe('function');

        context.isRheostatDragging = false;
        onMoveHandler({ clientX: 120, clientY: 60 });

        expect(comp.position).toBe(0.5);
        expect(context.renderer.refreshComponent).not.toHaveBeenCalled();
    });
});

describe('DragBehaviors.registerDragListeners', () => {
    it('does not throw in pointer path when document add/removeEventListener are non-callable', () => {
        vi.stubGlobal('window', { PointerEvent: function PointerEvent() {} });
        vi.stubGlobal('document', {
            addEventListener: {},
            removeEventListener: {}
        });

        expect(() => DragBehaviors.registerDragListeners(
            { pointerId: 3 },
            vi.fn(),
            vi.fn()
        )).not.toThrow();
    });

    it('does not throw in mouse fallback path when document add/removeEventListener are non-callable', () => {
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {
            addEventListener: {},
            removeEventListener: {}
        });

        expect(() => DragBehaviors.registerDragListeners(
            {},
            vi.fn(),
            vi.fn()
        )).not.toThrow();
    });
});
