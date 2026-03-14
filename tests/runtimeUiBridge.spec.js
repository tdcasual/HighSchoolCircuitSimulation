import { describe, expect, it, vi } from 'vitest';
import { RuntimeUiBridge } from '../src/app/RuntimeUiBridge.js';

describe('RuntimeUiBridge', () => {
    it('projects runtime diagnostics into near-field UI without full app runtime shell', () => {
        const diagnostics = {
            code: 'SINGULAR_MATRIX',
            fatal: true,
            summary: '电路方程不可解（矩阵奇异），请检查拓扑与元件参数。',
            hints: ['确认电路至少存在一个参考地并形成闭合回路。']
        };
        const results = {
            valid: false,
            runtimeDiagnostics: diagnostics
        };
        const setStatusTextImpl = vi.fn();
        const app = {
            circuit: {},
            renderer: {
                updateValues: vi.fn(),
                updateWireAnimations: vi.fn()
            },
            chartWorkspace: {
                onCircuitUpdate: vi.fn(),
                setRuntimeStatus: vi.fn()
            },
            interaction: {
                selectedComponent: null,
                showStatusAction: vi.fn()
            }
        };
        const bridge = new RuntimeUiBridge(app, {
            setStatusTextImpl,
            setSimulationControlsRunningImpl: vi.fn()
        });

        bridge.onCircuitUpdate(results);

        expect(app.renderer.updateValues).toHaveBeenCalledTimes(1);
        expect(app.renderer.updateWireAnimations).toHaveBeenCalledWith(undefined, results);
        expect(app.chartWorkspace.onCircuitUpdate).toHaveBeenCalledWith(results);
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith(expect.stringContaining(diagnostics.summary));
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith(expect.stringContaining(diagnostics.hints[0]));
        expect(setStatusTextImpl).toHaveBeenCalledWith(expect.stringContaining(diagnostics.hints[0]));
        expect(app.interaction.showStatusAction).toHaveBeenCalledWith(expect.objectContaining({
            statusText: expect.stringContaining(diagnostics.hints[0])
        }));
    });

    it('toggles guided empty state visibility from circuit component presence', () => {
        const emptyState = {
            hidden: true,
            dataset: {},
            setAttribute: vi.fn()
        };
        const canvasContainer = {
            classList: {
                toggle: vi.fn()
            }
        };
        const app = {
            circuit: {
                components: new Map()
            }
        };
        const bridge = new RuntimeUiBridge(app, {
            setStatusTextImpl: vi.fn(),
            setSimulationControlsRunningImpl: vi.fn()
        });

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'workbench-empty-state': emptyState,
                'canvas-container': canvasContainer
            }[id] || null))
        });

        expect(bridge.syncWorkbenchEmptyState()).toBe(true);
        expect(emptyState.hidden).toBe(false);
        expect(emptyState.dataset.state).toBe('empty');
        expect(emptyState.setAttribute).toHaveBeenCalledWith('aria-hidden', 'false');
        expect(canvasContainer.classList.toggle).toHaveBeenCalledWith('canvas-empty', true);

        app.circuit.components = new Map([['R1', { id: 'R1' }]]);
        expect(bridge.syncWorkbenchEmptyState()).toBe(false);
        expect(emptyState.hidden).toBe(true);
        expect(emptyState.dataset.state).toBe('ready');
        expect(emptyState.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
        expect(canvasContainer.classList.toggle).toHaveBeenCalledWith('canvas-empty', false);
    });

    it('syncs empty state when circuit load or clear feedback is shown', () => {
        const bridge = new RuntimeUiBridge({
            circuit: {
                components: new Map()
            }
        }, {
            setStatusTextImpl: vi.fn(),
            setSimulationControlsRunningImpl: vi.fn()
        });
        const syncSpy = vi.spyOn(bridge, 'syncWorkbenchEmptyState').mockReturnValue(true);

        bridge.showCircuitCleared();
        bridge.showCircuitLoaded({
            data: {
                components: [{ id: 'R1' }]
            }
        });

        expect(syncSpy).toHaveBeenCalledTimes(2);
    });
});
