import { describe, expect, it, vi } from 'vitest';
import { HistoryManager } from '../src/ui/interaction/HistoryManager.js';

describe('HistoryManager safety', () => {
    it('captureState does not throw when circuit.toJSON is non-callable', () => {
        const manager = new HistoryManager({
            circuit: {
                toJSON: {}
            }
        });

        expect(() => manager.captureState()).not.toThrow();
        expect(manager.captureState()).toEqual({
            components: [],
            wires: [],
            probes: []
        });
    });

    it('applyState does not throw when circuit.fromJSON is non-callable', () => {
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
        }, null)).not.toThrow();

        expect(interaction.renderer.render).toHaveBeenCalledTimes(1);
        expect(interaction.app.chartWorkspace.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(interaction.app.chartWorkspace.refreshDialGauges).toHaveBeenCalledTimes(1);
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
});
