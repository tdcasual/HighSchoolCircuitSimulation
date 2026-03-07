import { describe, expect, it, vi } from 'vitest';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';

describe('AppRuntimeV2 runtime diagnostics UI bridge', () => {
    it('surfaces the first fatal diagnostics hint into near-field UI feedback', () => {
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
            },
            updateStatus: vi.fn()
        };

        AppRuntimeV2.prototype.onCircuitUpdate.call(app, results);

        expect(app.renderer.updateValues).toHaveBeenCalledTimes(1);
        expect(app.renderer.updateWireAnimations).toHaveBeenCalledWith(undefined, results);
        expect(app.chartWorkspace.onCircuitUpdate).toHaveBeenCalledWith(results);
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith(expect.stringContaining(diagnostics.summary));
        expect(app.chartWorkspace.setRuntimeStatus).toHaveBeenCalledWith(expect.stringContaining(diagnostics.hints[0]));
        expect(app.updateStatus).toHaveBeenCalledWith(expect.stringContaining(diagnostics.hints[0]));
        expect(app.interaction.showStatusAction).toHaveBeenCalledWith(expect.objectContaining({
            statusText: expect.stringContaining(diagnostics.hints[0])
        }));
    });
});
