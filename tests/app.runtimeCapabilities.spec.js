import { describe, expect, it, vi } from 'vitest';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';

describe('AppRuntimeV2 runtime capability gates', () => {
    it('blocks circuit mutation entrypoints in readonly embed mode', () => {
        const updateStatus = vi.fn();
        const actionRouter = {
            startSimulation: vi.fn(),
            clearCircuit: vi.fn(),
            loadCircuitData: vi.fn(),
            importCircuit: vi.fn()
        };
        const app = {
            runtimeOptions: {
                enabled: true,
                mode: 'readonly',
                readOnly: true
            },
            runtimeUiBridge: { updateStatus },
            actionRouter
        };

        expect(AppRuntimeV2.prototype.startSimulation.call(app)).toBe(false);
        expect(AppRuntimeV2.prototype.clearCircuit.call(app)).toBe(false);
        expect(AppRuntimeV2.prototype.loadCircuitData.call(app, { components: [], wires: [] })).toBe(false);
        expect(AppRuntimeV2.prototype.importCircuit.call(app, { name: 'demo.json' })).toBe(false);

        expect(actionRouter.startSimulation).not.toHaveBeenCalled();
        expect(actionRouter.clearCircuit).not.toHaveBeenCalled();
        expect(actionRouter.loadCircuitData).not.toHaveBeenCalled();
        expect(actionRouter.importCircuit).not.toHaveBeenCalled();
        expect(updateStatus).toHaveBeenCalledWith('当前模式不允许修改电路');
    });

    it('blocks storage writes in readonly embed mode', () => {
        const updateStatus = vi.fn();
        const storage = {
            setItem: vi.fn()
        };
        const app = {
            runtimeOptions: {
                enabled: true,
                mode: 'readonly',
                readOnly: true
            },
            runtimeUiBridge: { updateStatus },
            circuitStorageOwnership: { source: 'readonly', sequence: 1 },
            buildSaveData: vi.fn(() => ({ components: [], wires: [] }))
        };

        const saved = AppRuntimeV2.prototype.saveCircuitToStorage.call(app, null, { storage });

        expect(saved).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
        expect(updateStatus).toHaveBeenCalledWith('当前模式不允许修改电路');
    });

    it('only allows classroom level control in classroom embed mode', () => {
        const updateStatus = vi.fn();
        const setPreferredLevel = vi.fn(() => ({
            preferredLevel: 'enhanced',
            activeLevel: 'enhanced',
            supported: true
        }));
        const app = {
            runtimeOptions: {
                enabled: true,
                mode: 'edit',
                readOnly: false
            },
            runtimeUiBridge: { updateStatus },
            classroomMode: {
                activeLevel: 'off',
                setPreferredLevel
            }
        };

        const result = AppRuntimeV2.prototype.setClassroomModeLevel.call(app, 'enhanced');

        expect(result).toEqual({
            preferredLevel: 'off',
            activeLevel: 'off',
            supported: false
        });
        expect(setPreferredLevel).not.toHaveBeenCalled();
        expect(updateStatus).toHaveBeenCalledWith('当前嵌入模式不允许切换课堂模式');
    });
});
