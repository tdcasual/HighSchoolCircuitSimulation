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
});
