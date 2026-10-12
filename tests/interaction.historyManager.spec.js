import { describe, expect, it, vi } from 'vitest';
import { HistoryManager } from '../src/ui/interaction/HistoryManager.js';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';

function createHistoryInteraction(circuit) {
    return {
        circuit,
        renderer: {
            render: vi.fn()
        },
        app: {
            stopSimulation: vi.fn(),
            chartWorkspace: {
                refreshComponentOptions: vi.fn(),
                refreshDialGauges: vi.fn()
            }
        },
        clearSelection: vi.fn(),
        selectComponent: vi.fn(),
        selectWire: vi.fn(),
        updateStatus: vi.fn(),
        logger: { error: vi.fn() }
    };
}

describe('HistoryManager safety', () => {
    it('captureState throws when circuit.toJSON is non-callable', () => {
        const manager = new HistoryManager({
            circuit: {
                toJSON: {}
            }
        });

        expect(() => manager.captureState()).toThrow(/toJSON is required/);
    });

    it('applyState throws when circuit.fromJSON is non-callable', () => {
        const interaction = {
            circuit: {
                fromJSON: {}
            },
            renderer: {
                render: vi.fn()
            },
            app: {
                chartWorkspace: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                }
            },
            clearSelection: vi.fn()
        };
        const manager = new HistoryManager(interaction);

        expect(() => manager.applyState({
            components: [{ id: 'R1' }],
            wires: [{ id: 'W1' }],
            probes: []
        }, null)).toThrow(/fromJSON is required/);
        expect(interaction.renderer.render).not.toHaveBeenCalled();
    });

    it('restores numeric zero component ids from selection snapshots', () => {
        const interaction = {
            circuit: {
                getComponent: vi.fn((id) => (id === '0' ? { id: '0' } : null)),
                getWire: vi.fn(() => null)
            },
            selectComponent: vi.fn(),
            selectWire: vi.fn(),
            clearSelection: vi.fn()
        };
        const manager = new HistoryManager(interaction);

        manager.restoreSelectionSnapshot({ componentId: 0, wireId: null });

        expect(interaction.circuit.getComponent).toHaveBeenCalledWith('0');
        expect(interaction.selectComponent).toHaveBeenCalledWith('0');
        expect(interaction.clearSelection).not.toHaveBeenCalled();
    });

    it('undo after adding a bulb restores a 2-component circuit and snapshots omit timestamp', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('PowerSource', 0, 0, 'V1'));
        circuit.addComponent(createComponent('Resistor', 100, 0, 'R1'));
        const interaction = createHistoryInteraction(circuit);
        const manager = new HistoryManager(interaction);

        manager.runWithHistory('添加灯泡', () => {
            circuit.addComponent(createComponent('Bulb', 200, 0, 'B1'));
        });

        expect(circuit.components.size).toBe(3);
        expect(manager.undoStack).toHaveLength(1);
        const snapshot = manager.undoStack[0].after;
        expect(snapshot.meta.version).toBe(3);
        expect(snapshot.meta.timestamp).toBeUndefined();

        manager.undo();
        expect(circuit.components.size).toBe(2);
        expect(circuit.components.has('B1')).toBe(false);
        expect(circuit.components.has('V1')).toBe(true);
        expect(circuit.components.has('R1')).toBe(true);

        manager.redo();
        expect(circuit.components.size).toBe(3);
        expect(circuit.components.has('B1')).toBe(true);
    });

    it('undo restores parallel-plate distance after a history transaction', () => {
        const circuit = new Circuit();
        const plate = createComponent('ParallelPlateCapacitor', 0, 0, 'C1');
        circuit.addComponent(plate);
        const startDistance = plate.plateDistance;
        const manager = new HistoryManager(createHistoryInteraction(circuit));

        manager.beginTransaction('调节平行板电容');
        plate.plateDistance = 0.003;
        manager.commitTransaction();

        expect(circuit.getComponent('C1').plateDistance).toBeCloseTo(0.003, 9);
        manager.undo();
        expect(circuit.getComponent('C1').plateDistance).toBeCloseTo(startDistance, 9);
    });

    it('runWithHistory does not grow the stack when the action does not change the circuit', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('Resistor', 0, 0, 'R1'));
        const manager = new HistoryManager(createHistoryInteraction(circuit));

        manager.runWithHistory('空操作', () => {});

        expect(manager.undoStack).toHaveLength(0);
    });

    it('undo restores wires deleted with a component', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('PowerSource', 0, 0, 'V1'));
        circuit.addComponent(createComponent('Resistor', 100, 0, 'R1'));
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 0 },
            aRef: { componentId: 'V1', terminalIndex: 1 },
            bRef: { componentId: 'R1', terminalIndex: 0 }
        });
        const manager = new HistoryManager(createHistoryInteraction(circuit));

        manager.runWithHistory('删除电阻', () => {
            circuit.removeComponent('R1');
        });
        expect(circuit.components.has('R1')).toBe(false);
        expect(circuit.wires.has('W1')).toBe(false);

        manager.undo();
        expect(circuit.components.has('R1')).toBe(true);
        expect(circuit.wires.has('W1')).toBe(true);
        expect(circuit.getWire('W1')?.bRef?.componentId).toBe('R1');
    });

    it('failed fromJSON during undo restores the stack and leaves the circuit unchanged', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('Resistor', 0, 0, 'R1'));
        const interaction = createHistoryInteraction(circuit);
        const manager = new HistoryManager(interaction);

        manager.runWithHistory('添加灯泡', () => {
            circuit.addComponent(createComponent('Bulb', 80, 0, 'B1'));
        });
        expect(circuit.components.size).toBe(2);

        const originalFromJSON = circuit.fromJSON.bind(circuit);
        circuit.fromJSON = () => {
            throw new Error('boom');
        };

        manager.undo();

        expect(manager.undoStack).toHaveLength(1);
        expect(manager.redoStack).toHaveLength(0);
        expect(circuit.components.size).toBe(2);
        expect(circuit.components.has('B1')).toBe(true);
        expect(interaction.updateStatus).toHaveBeenCalledWith(expect.stringMatching(/撤销失败/));

        circuit.fromJSON = originalFromJSON;
        manager.undo();
        expect(circuit.components.size).toBe(1);

        circuit.fromJSON = () => {
            throw new Error('boom-redo');
        };
        manager.redo();
        expect(manager.redoStack).toHaveLength(1);
        expect(circuit.components.size).toBe(1);
        expect(interaction.updateStatus).toHaveBeenCalledWith(expect.stringMatching(/重做失败/));
    });
});
