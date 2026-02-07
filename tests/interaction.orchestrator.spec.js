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
