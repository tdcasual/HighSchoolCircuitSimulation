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

    it('shows fallback copy on a valid V1 substep fallback and sticks after 50 wall-clock steps', () => {
        const setStatusTextImpl = vi.fn();
        const backend = {
            mode: 'v2',
            fellBackThisStep: true,
            consecutiveFallbackSteps: 1
        };
        const app = {
            circuit: { solverBackend: backend },
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
        const results = {
            valid: true,
            backendUsed: 'v1',
            currents: new Map([['R1', 0.3]])
        };

        bridge.onCircuitUpdate(results);
        expect(setStatusTextImpl).toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(backend.mode).toBe('v2');
        expect(app.interaction.showStatusAction).not.toHaveBeenCalled();

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        backend.consecutiveFallbackSteps = 50;
        bridge.onCircuitUpdate(results);
        expect(setStatusTextImpl).toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('已回退');

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        backend.consecutiveFallbackSteps = 51;
        bridge.onCircuitUpdate(results);
        expect(setStatusTextImpl).toHaveBeenCalledWith('已回退');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(backend.mode).toBe('v2');

        setStatusTextImpl.mockClear();
        backend.fellBackThisStep = false;
        backend.consecutiveFallbackSteps = 0;
        bridge.onCircuitUpdate({
            valid: true,
            backendUsed: 'v2',
            currents: new Map([['R1', 0.3]])
        });
        expect(setStatusTextImpl).not.toHaveBeenCalled();
        expect(backend.mode).toBe('v2');
    });

    it('does not replace fatal diagnostics with fallback copy', () => {
        const setStatusTextImpl = vi.fn();
        const diagnostics = {
            code: 'SINGULAR_MATRIX',
            fatal: true,
            summary: '电路方程不可解（矩阵奇异），请检查拓扑与元件参数。',
            hints: ['确认电路至少存在一个参考地并形成闭合回路。']
        };
        const app = {
            circuit: {
                solverBackend: {
                    mode: 'v2',
                    fellBackThisStep: true,
                    consecutiveFallbackSteps: 51
                }
            },
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

        bridge.onCircuitUpdate({
            valid: false,
            backendUsed: 'v1',
            runtimeDiagnostics: diagnostics
        });

        expect(setStatusTextImpl).toHaveBeenCalledWith(expect.stringContaining(diagnostics.summary));
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('已回退');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('仿真已回退到稳定求解器');
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
