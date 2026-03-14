import { describe, expect, it, vi } from 'vitest';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';

describe('AppRuntimeV2 workbench empty-state sync', () => {
    it('binds circuit mutations to empty-state synchronization', () => {
        const app = {
            circuit: {
                addComponent: vi.fn(() => 'added'),
                removeComponent: vi.fn(() => 'removed'),
                clear: vi.fn(() => 'cleared'),
                fromJSON: vi.fn(() => 'loaded')
            },
            runtimeUiBridge: {
                syncWorkbenchEmptyState: vi.fn(() => true)
            }
        };

        AppRuntimeV2.prototype.bindWorkbenchEmptyStateToCircuit.call(app);

        expect(app.circuit.addComponent({})).toBe('added');
        expect(app.circuit.removeComponent('R1')).toBe('removed');
        expect(app.circuit.clear()).toBe('cleared');
        expect(app.circuit.fromJSON({ components: [], wires: [] })).toBe('loaded');
        expect(app.runtimeUiBridge.syncWorkbenchEmptyState).toHaveBeenCalledTimes(4);
    });

    it('proxies syncWorkbenchEmptyState through the runtime ui bridge', () => {
        const syncWorkbenchEmptyState = vi.fn(() => false);
        const app = {
            runtimeUiBridge: {
                syncWorkbenchEmptyState
            }
        };

        const result = AppRuntimeV2.prototype.syncWorkbenchEmptyState.call(app);

        expect(result).toBe(false);
        expect(syncWorkbenchEmptyState).toHaveBeenCalledTimes(1);
    });
});
