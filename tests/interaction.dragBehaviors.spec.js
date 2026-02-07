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
