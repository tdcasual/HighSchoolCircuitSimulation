import { afterEach, describe, expect, it, vi } from 'vitest';
import { TouchActionController } from '../src/ui/interaction/TouchActionController.js';

function makeTargetWithComponent(componentId = 'R1') {
    const componentGroup = { dataset: { id: componentId } };
    return {
        closest: vi.fn((selector) => {
            if (selector === '.component') return componentGroup;
            return null;
        })
    };
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('TouchActionController', () => {
    it('opens component context menu on long press', () => {
        vi.useFakeTimers();
        const interaction = {
            blockSinglePointerInteraction: false,
            pendingToolType: null,
            isWiring: false,
            resolveProbeMarkerTarget: vi.fn(() => null),
            endPrimaryInteractionForGesture: vi.fn(),
            selectComponent: vi.fn(),
            showContextMenu: vi.fn()
        };
        const controller = new TouchActionController(interaction, { longPressDelayMs: 420 });
        const event = {
            pointerType: 'touch',
            pointerId: 7,
            clientX: 120,
            clientY: 260,
            target: makeTargetWithComponent('R_comp')
        };

        controller.onPointerDown(event);
        vi.advanceTimersByTime(420);

        expect(interaction.endPrimaryInteractionForGesture).toHaveBeenCalledTimes(1);
        expect(interaction.selectComponent).toHaveBeenCalledWith('R_comp');
        expect(interaction.showContextMenu).toHaveBeenCalledTimes(1);

        const consumed = controller.onPointerUp({ pointerId: 7 });
        expect(consumed).toBe(true);
    });

    it('cancels long press when pointer moves too far', () => {
        vi.useFakeTimers();
        const interaction = {
            blockSinglePointerInteraction: false,
            pendingToolType: null,
            isWiring: false,
            resolveProbeMarkerTarget: vi.fn(() => null),
            endPrimaryInteractionForGesture: vi.fn(),
            selectComponent: vi.fn(),
            showContextMenu: vi.fn()
        };
        const controller = new TouchActionController(interaction, { longPressDelayMs: 420, moveTolerancePx: 10 });
        const event = {
            pointerType: 'touch',
            pointerId: 9,
            clientX: 40,
            clientY: 50,
            target: makeTargetWithComponent('R2')
        };

        controller.onPointerDown(event);
        controller.onPointerMove({
            pointerId: 9,
            clientX: 90,
            clientY: 95
        });
        vi.advanceTimersByTime(500);

        expect(interaction.showContextMenu).not.toHaveBeenCalled();
        expect(controller.onPointerUp({ pointerId: 9 })).toBe(false);
    });
});
