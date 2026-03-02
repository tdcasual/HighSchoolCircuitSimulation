import { describe, expect, it, vi } from 'vitest';
import { handleSurfaceTargetMouseDown } from '../src/app/interaction/InteractionOrchestratorMouseDownHandlers.js';

function makeTarget({
    classes = [],
    closestComponent = null,
    closestWireGroup = null,
    dataset = {}
} = {}) {
    return {
        dataset,
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

describe('InteractionOrchestratorMouseDownHandlers.handleSurfaceTargetMouseDown', () => {
    it('selects probe wire when clicking a probe marker', () => {
        const context = {
            selectWire: vi.fn()
        };
        const event = { button: 0, target: makeTarget() };
        const probeMarker = { dataset: { wireId: 'W1' } };

        const handled = handleSurfaceTargetMouseDown.call(context, event, {
            target: event.target,
            probeMarker,
            terminalTarget: null,
            componentGroup: null
        });

        expect(handled).toBe(true);
        expect(context.selectWire).toHaveBeenCalledWith('W1');
    });

    it('starts terminal extension on ctrl/cmd terminal drag', () => {
        const componentGroup = { dataset: { id: 'R1' } };
        const terminalTarget = { dataset: { terminal: '1' } };
        const target = makeTarget({ closestComponent: componentGroup });
        const context = {
            selectedComponent: null,
            selectComponent: vi.fn(),
            startTerminalExtend: vi.fn()
        };
        const event = {
            button: 0,
            ctrlKey: true,
            metaKey: false,
            target
        };

        const handled = handleSurfaceTargetMouseDown.call(context, event, {
            target,
            probeMarker: null,
            terminalTarget,
            componentGroup
        });

        expect(handled).toBe(true);
        expect(context.selectComponent).toHaveBeenCalledWith('R1');
        expect(context.startTerminalExtend).toHaveBeenCalledWith('R1', 1, event);
    });

    it('toggles switch when switch blade is clicked', () => {
        const componentGroup = { dataset: { id: 'S1' } };
        const target = makeTarget({
            classes: ['switch-blade'],
            closestComponent: componentGroup
        });
        const context = {
            toggleSwitch: vi.fn(() => ({ ok: true }))
        };
        const event = {
            button: 0,
            target
        };

        const handled = handleSurfaceTargetMouseDown.call(context, event, {
            target,
            probeMarker: null,
            terminalTarget: null,
            componentGroup
        });

        expect(handled).toBe(true);
        expect(context.toggleSwitch).toHaveBeenCalledWith('S1');
    });

    it('starts component dragging when clicking component body', () => {
        const componentGroup = { dataset: { id: 'R2' } };
        const target = makeTarget({ closestComponent: componentGroup });
        const context = {
            selectedComponent: 'R2',
            resolvePointerType: vi.fn(() => 'mouse'),
            startDragging: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 120,
            clientY: 80,
            target
        };

        const handled = handleSurfaceTargetMouseDown.call(context, event, {
            target,
            probeMarker: null,
            terminalTarget: null,
            componentGroup
        });

        expect(handled).toBe(true);
        expect(context.startDragging).toHaveBeenCalledWith(componentGroup, event);
        expect(context.pointerDownInfo).toMatchObject({
            componentId: 'R2',
            wasSelected: true,
            screenX: 120,
            screenY: 80,
            pointerType: 'mouse',
            moved: false
        });
    });

    it('returns false when no surface-specific handler matches', () => {
        const target = makeTarget();
        const context = {
            isWireEndpointTarget: vi.fn(() => false),
            startWireEndpointDrag: vi.fn()
        };
        const event = {
            button: 0,
            target
        };

        const handled = handleSurfaceTargetMouseDown.call(context, event, {
            target,
            probeMarker: null,
            terminalTarget: null,
            componentGroup: null
        });

        expect(handled).toBe(false);
        expect(context.startWireEndpointDrag).not.toHaveBeenCalled();
    });
});
