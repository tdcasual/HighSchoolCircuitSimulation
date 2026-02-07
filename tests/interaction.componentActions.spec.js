import { describe, expect, it, vi } from 'vitest';
import * as ComponentActions from '../src/ui/interaction/ComponentActions.js';

describe('ComponentActions.rotateComponent', () => {
    it('rotates component by 90 degrees and refreshes renderer', () => {
        const comp = { id: 'R1', rotation: 90 };
        const context = {
            circuit: {
                getComponent: vi.fn(() => comp),
                rebuildNodes: vi.fn()
            },
            renderer: {
                refreshComponent: vi.fn(),
                updateConnectedWires: vi.fn(),
                setSelected: vi.fn()
            },
            runWithHistory: vi.fn((_, action) => action())
        };

        ComponentActions.rotateComponent.call(context, 'R1');

        expect(comp.rotation).toBe(180);
        expect(context.runWithHistory).toHaveBeenCalledWith('旋转元器件', expect.any(Function));
        expect(context.renderer.refreshComponent).toHaveBeenCalledWith(comp);
        expect(context.renderer.updateConnectedWires).toHaveBeenCalledWith('R1');
        expect(context.renderer.setSelected).toHaveBeenCalledWith('R1', true);
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
    });

    it('does nothing when component does not exist', () => {
        const context = {
            circuit: { getComponent: vi.fn(() => null) },
            runWithHistory: vi.fn()
        };

        ComponentActions.rotateComponent.call(context, 'R404');

        expect(context.runWithHistory).not.toHaveBeenCalled();
    });
});

describe('ComponentActions.toggleSwitch', () => {
    it('toggles normal switch and updates status', () => {
        const comp = { id: 'S1', type: 'Switch', closed: false };
        const context = {
            circuit: { getComponent: vi.fn(() => comp) },
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn()
            },
            runWithHistory: vi.fn((_, action) => action()),
            selectComponent: vi.fn(),
            updateStatus: vi.fn()
        };

        ComponentActions.toggleSwitch.call(context, 'S1');

        expect(comp.closed).toBe(true);
        expect(context.runWithHistory).toHaveBeenCalledWith('切换开关', expect.any(Function));
        expect(context.renderer.refreshComponent).toHaveBeenCalledWith(comp);
        expect(context.renderer.setSelected).toHaveBeenCalledWith('S1', true);
        expect(context.selectComponent).toHaveBeenCalledWith('S1');
        expect(context.updateStatus).toHaveBeenCalledWith('开关已闭合');
    });

    it('toggles SPDT switch position and updates status', () => {
        const comp = { id: 'S2', type: 'SPDTSwitch', position: 'a' };
        const context = {
            circuit: { getComponent: vi.fn(() => comp) },
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn()
            },
            runWithHistory: vi.fn((_, action) => action()),
            selectComponent: vi.fn(),
            updateStatus: vi.fn()
        };

        ComponentActions.toggleSwitch.call(context, 'S2');

        expect(comp.position).toBe('b');
        expect(context.updateStatus).toHaveBeenCalledWith('单刀双掷开关已切换到 下掷');
    });
});
