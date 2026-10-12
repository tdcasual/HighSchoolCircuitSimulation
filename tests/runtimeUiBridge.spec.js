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

    it('shows fallback copy from consecutiveFallbackSteps even when last substep used v2', () => {
        const setStatusTextImpl = vi.fn();
        const backend = {
            mode: 'v2',
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
        const mixedResults = {
            valid: true,
            backendUsed: 'v2',
            currents: new Map([['R1', 0.3]])
        };

        bridge.onCircuitUpdate(mixedResults);
        expect(setStatusTextImpl).toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(backend.mode).toBe('v2');
        expect(app.interaction.showStatusAction).not.toHaveBeenCalled();

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        backend.consecutiveFallbackSteps = 50;
        bridge.onCircuitUpdate(mixedResults);
        expect(setStatusTextImpl).toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('已回退');

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        backend.consecutiveFallbackSteps = 51;
        bridge.onCircuitUpdate(mixedResults);
        expect(setStatusTextImpl).toHaveBeenCalledWith('已回退');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(backend.mode).toBe('v2');
    });

    it('restores running copy after fallback recovery and does not rewrite a first clean tick', () => {
        const setStatusTextImpl = vi.fn();
        const backend = {
            mode: 'v2',
            consecutiveFallbackSteps: 0
        };
        const app = {
            circuit: { solverBackend: backend, isRunning: true },
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
        const cleanResults = {
            valid: true,
            backendUsed: 'v2',
            currents: new Map([['R1', 0.3]])
        };

        bridge.onCircuitUpdate(cleanResults);
        expect(setStatusTextImpl).not.toHaveBeenCalled();
        expect(app.chartWorkspace.setRuntimeStatus).not.toHaveBeenCalled();

        backend.consecutiveFallbackSteps = 1;
        bridge.onCircuitUpdate({
            valid: true,
            backendUsed: 'v1',
            currents: new Map([['R1', 0.3]])
        });
        expect(setStatusTextImpl).toHaveBeenCalledWith('仿真已回退到稳定求解器');

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        backend.consecutiveFallbackSteps = 0;
        app.circuit.isRunning = true;
        bridge.onCircuitUpdate(cleanResults);
        expect(setStatusTextImpl).toHaveBeenCalledWith('模拟运行中');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('已回退');
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith('');
        expect(backend.mode).toBe('v2');

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        bridge.onCircuitUpdate(cleanResults);
        expect(setStatusTextImpl).not.toHaveBeenCalled();
        expect(app.chartWorkspace.setRuntimeStatus).not.toHaveBeenCalled();
    });

    it('clears fallback copy on recovery when the circuit is not running', () => {
        const setStatusTextImpl = vi.fn();
        const backend = {
            mode: 'v2',
            consecutiveFallbackSteps: 51
        };
        const app = {
            circuit: { solverBackend: backend, isRunning: false },
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
            valid: true,
            backendUsed: 'v1',
            currents: new Map([['R1', 0.3]])
        });
        expect(setStatusTextImpl).toHaveBeenCalledWith('已回退');

        setStatusTextImpl.mockClear();
        app.chartWorkspace.setRuntimeStatus.mockClear();
        backend.consecutiveFallbackSteps = 0;
        bridge.onCircuitUpdate({
            valid: true,
            backendUsed: 'v2',
            currents: new Map([['R1', 0.3]])
        });
        expect(setStatusTextImpl).toHaveBeenCalledWith('');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('模拟运行中');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('仿真已回退到稳定求解器');
        expect(setStatusTextImpl).not.toHaveBeenCalledWith('已回退');
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith('');
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

    it('attaches a valid v2 ViewMap on the classroom update path and clears it on V1 fallback', () => {
        const viewMap = new Map([
            ['R1', { currentValue: 0, voltageValue: 2.4, powerValue: 0 }]
        ]);
        const renderer = {
            setViewMap: vi.fn(),
            updateValues: vi.fn(),
            updateWireAnimations: vi.fn()
        };
        const app = {
            circuit: { solverBackend: { mode: 'v2', consecutiveFallbackSteps: 0 } },
            renderer,
            chartWorkspace: {
                onCircuitUpdate: vi.fn(),
                setRuntimeStatus: vi.fn()
            },
            interaction: { selectedComponent: null }
        };
        const bridge = new RuntimeUiBridge(app, {
            setStatusTextImpl: vi.fn(),
            setSimulationControlsRunningImpl: vi.fn()
        });

        bridge.onCircuitUpdate({
            valid: true,
            backendUsed: 'v2',
            viewMap,
            currents: new Map([['R1', 0]])
        });
        expect(renderer.setViewMap).toHaveBeenCalledTimes(1);
        expect(renderer.setViewMap).toHaveBeenCalledWith(viewMap);

        renderer.setViewMap.mockClear();
        bridge.onCircuitUpdate({
            valid: true,
            backendUsed: 'v1',
            viewMap,
            currents: new Map([['R1', 0.3]])
        });
        expect(renderer.setViewMap).toHaveBeenCalledWith(null);

        renderer.setViewMap.mockClear();
        bridge.onCircuitUpdate({
            valid: true,
            backendUsed: 'v2',
            viewMap: { R1: { currentValue: 0 } },
            currents: new Map([['R1', 0]])
        });
        expect(renderer.setViewMap).toHaveBeenCalledWith(null);
    });

    it('clears Renderer ViewMap on stop, clear, and load including silent restore', () => {
        const renderer = {
            setViewMap: vi.fn(),
            updateValues: vi.fn(),
            updateWireAnimations: vi.fn()
        };
        const bridge = new RuntimeUiBridge({
            circuit: { components: new Map() },
            renderer
        }, {
            setStatusTextImpl: vi.fn(),
            setSimulationControlsRunningImpl: vi.fn()
        });

        bridge.showSimulationStopped();
        bridge.showCircuitCleared();
        bridge.showCircuitLoaded({
            data: { components: [{ id: 'R1' }] },
            silent: true
        });

        expect(renderer.setViewMap).toHaveBeenCalledTimes(3);
        expect(renderer.setViewMap).toHaveBeenNthCalledWith(1, null);
        expect(renderer.setViewMap).toHaveBeenNthCalledWith(2, null);
        expect(renderer.setViewMap).toHaveBeenNthCalledWith(3, null);
    });
});
