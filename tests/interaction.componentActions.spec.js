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

        const result = ComponentActions.rotateComponent.call(context, 'R1');

        expect(comp.rotation).toBe(180);
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'component.rotated',
            payload: expect.objectContaining({
                componentId: 'R1',
                rotation: 180
            })
        }));
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

        const result = ComponentActions.rotateComponent.call(context, 'R404');

        expect(result).toEqual(expect.objectContaining({
            ok: false,
            type: 'component.rotate_not_found'
        }));
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

        const result = ComponentActions.toggleSwitch.call(context, 'S1');

        expect(comp.closed).toBe(true);
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'switch.toggled',
            payload: expect.objectContaining({
                componentId: 'S1',
                componentType: 'Switch',
                closed: true
            })
        }));
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

        const result = ComponentActions.toggleSwitch.call(context, 'S2');

        expect(comp.position).toBe('b');
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'switch.toggled',
            payload: expect.objectContaining({
                componentId: 'S2',
                componentType: 'SPDTSwitch',
                position: 'b'
            })
        }));
        expect(context.updateStatus).toHaveBeenCalledWith('单刀双掷开关已切换到 下掷');
    });

    it('returns failure DTO for unsupported component types', () => {
        const context = {
            circuit: { getComponent: vi.fn(() => ({ id: 'R1', type: 'Resistor' })) },
            runWithHistory: vi.fn(),
            updateStatus: vi.fn()
        };

        const result = ComponentActions.toggleSwitch.call(context, 'R1');

        expect(result).toEqual(expect.objectContaining({
            ok: false,
            type: 'switch.toggle_not_supported'
        }));
        expect(context.runWithHistory).not.toHaveBeenCalled();
    });
});

describe('ComponentActions.addComponent', () => {
    it('creates component and refreshes UI state', () => {
        const context = {
            runWithHistory: vi.fn((_, action) => action()),
            circuit: {
                addComponent: vi.fn()
            },
            renderer: {
                addComponent: vi.fn(() => ({ tag: 'g' }))
            },
            selectComponent: vi.fn(),
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = ComponentActions.addComponent.call(context, 'Resistor', 10.4, 20.6);

        const added = context.circuit.addComponent.mock.calls[0][0];
        expect(added.type).toBe('Resistor');
        expect(added.x).toBe(10);
        expect(added.y).toBe(21);
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'component.added',
            message: expect.stringContaining('已添加')
        }));
        expect(context.runWithHistory).toHaveBeenCalledWith(expect.stringContaining('添加'), expect.any(Function));
        expect(context.renderer.addComponent).toHaveBeenCalledWith(added);
        expect(context.selectComponent).toHaveBeenCalledWith(added.id);
        expect(context.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshDialGauges).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith(expect.stringContaining('已添加'));
    });

    it('returns action result DTO on success', () => {
        const context = {
            runWithHistory: vi.fn((_, action) => action()),
            circuit: {
                addComponent: vi.fn()
            },
            renderer: {
                addComponent: vi.fn(() => ({ tag: 'g' }))
            },
            selectComponent: vi.fn(),
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = ComponentActions.addComponent.call(context, 'Resistor', 30, 40);

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'component.added'
        }));
        expect(result.payload).toEqual(expect.objectContaining({
            componentId: expect.any(String),
            componentType: 'Resistor'
        }));
    });

    it('reports failure when component add throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const context = {
            runWithHistory: vi.fn((_, action) => action()),
            circuit: {
                addComponent: vi.fn(() => {
                    throw new Error('boom');
                })
            },
            renderer: {
                addComponent: vi.fn()
            },
            selectComponent: vi.fn(),
            app: {},
            updateStatus: vi.fn()
        };

        const result = ComponentActions.addComponent.call(context, 'Resistor', 1, 2);

        expect(context.updateStatus).toHaveBeenCalledWith('添加失败: boom');
        expect(result).toEqual(expect.objectContaining({
            ok: false,
            type: 'component.add_failed',
            message: '添加失败: boom'
        }));
    });
});

describe('ComponentActions.deleteComponent', () => {
    it('removes component and refreshes dependent UI', () => {
        const context = {
            runWithHistory: vi.fn((_, action) => action()),
            circuit: { removeComponent: vi.fn() },
            renderer: {
                removeComponent: vi.fn(),
                renderWires: vi.fn()
            },
            clearSelection: vi.fn(),
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = ComponentActions.deleteComponent.call(context, 'R1');

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'component.deleted',
            payload: { componentId: 'R1' },
            message: '已删除元器件'
        }));
        expect(context.runWithHistory).toHaveBeenCalledWith('删除元器件', expect.any(Function));
        expect(context.circuit.removeComponent).toHaveBeenCalledWith('R1');
        expect(context.renderer.removeComponent).toHaveBeenCalledWith('R1');
        expect(context.renderer.renderWires).toHaveBeenCalledTimes(1);
        expect(context.clearSelection).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshDialGauges).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('已删除元器件');
    });
});

describe('ComponentActions.deleteWire', () => {
    it('removes wire and refreshes dependent UI', () => {
        const context = {
            runWithHistory: vi.fn((_, action) => action()),
            circuit: { removeWire: vi.fn() },
            renderer: { removeWire: vi.fn() },
            clearSelection: vi.fn(),
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = ComponentActions.deleteWire.call(context, 'W1');

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'wire.deleted',
            payload: { wireId: 'W1' },
            message: '已删除导线'
        }));
        expect(context.runWithHistory).toHaveBeenCalledWith('删除导线', expect.any(Function));
        expect(context.circuit.removeWire).toHaveBeenCalledWith('W1');
        expect(context.renderer.removeWire).toHaveBeenCalledWith('W1');
        expect(context.clearSelection).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('已删除导线');
    });
});

describe('ComponentActions.duplicateComponent', () => {
    it('creates a duplicated component with fixed offset', () => {
        const context = {
            circuit: {
                getComponent: vi.fn(() => ({
                    id: 'R1',
                    type: 'Resistor',
                    x: 120,
                    y: 80
                }))
            },
            addComponent: vi.fn()
        };

        context.addComponent.mockReturnValue({
            ok: true,
            type: 'component.added',
            payload: { componentId: 'R2' }
        });

        const result = ComponentActions.duplicateComponent.call(context, 'R1');

        expect(context.addComponent).toHaveBeenCalledWith('Resistor', 160, 120);
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            type: 'component.duplicated',
            payload: {
                sourceComponentId: 'R1',
                componentId: 'R2'
            }
        }));
    });

    it('does nothing for missing component', () => {
        const context = {
            circuit: { getComponent: vi.fn(() => null) },
            addComponent: vi.fn()
        };

        const result = ComponentActions.duplicateComponent.call(context, 'R404');

        expect(result).toEqual(expect.objectContaining({
            ok: false,
            type: 'component.duplicate_not_found'
        }));
        expect(context.addComponent).not.toHaveBeenCalled();
    });
});
