import { describe, expect, it, vi } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';

describe('RuntimeActionRouter', () => {
    it('loads circuit data through injected collaborators without full app runtime shell', () => {
        const fromJSON = vi.fn();
        const render = vi.fn();
        const clearSelection = vi.fn();
        const refreshComponentOptions = vi.fn();
        const refreshDialGauges = vi.fn();
        const applyChartWorkspace = vi.fn();
        const applyExerciseBoard = vi.fn();
        const updateIdCounterFromExistingImpl = vi.fn();
        const uiBridge = {
            showCircuitLoaded: vi.fn()
        };
        const app = {
            circuit: { fromJSON },
            renderer: { render },
            interaction: { clearSelection },
            chartWorkspace: {
                refreshComponentOptions,
                refreshDialGauges,
                fromJSON: applyChartWorkspace
            },
            exerciseBoard: {
                fromJSON: applyExerciseBoard
            }
        };
        const router = new RuntimeActionRouter(app, {
            uiBridge,
            updateIdCounterFromExistingImpl,
            stopSimulationImpl: vi.fn()
        });
        const data = {
            components: [{ id: 'R1' }],
            wires: [{ id: 'W1' }],
            meta: {
                exerciseBoard: { enabled: true },
                chartWorkspace: { visible: true }
            }
        };

        const summary = router.loadCircuitData(data, { statusText: '已加载测试电路' });

        expect(fromJSON).toHaveBeenCalledWith(data);
        expect(updateIdCounterFromExistingImpl).toHaveBeenCalledWith(['R1', 'W1']);
        expect(render).toHaveBeenCalledTimes(1);
        expect(clearSelection).toHaveBeenCalledTimes(1);
        expect(refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(refreshDialGauges).toHaveBeenCalledTimes(1);
        expect(applyExerciseBoard).toHaveBeenCalledWith({ enabled: true });
        expect(applyChartWorkspace).toHaveBeenCalledWith({ visible: true });
        expect(uiBridge.showCircuitLoaded).toHaveBeenCalledWith({
            data,
            statusText: '已加载测试电路',
            silent: false
        });
        expect(summary).toEqual({ componentCount: 1, wireCount: 1 });
    });

    it('routes simulation start feedback through ui bridge', () => {
        const startSimulation = vi.fn();
        const validateSimulationTopology = vi.fn(() => ({ ok: true }));
        const uiBridge = {
            updateStatus: vi.fn(),
            showSimulationStarted: vi.fn()
        };
        const app = {
            circuit: {
                components: new Map([['V1', { type: 'PowerSource' }]]),
                startSimulation,
                validateSimulationTopology
            },
            chartWorkspace: {}
        };
        const router = new RuntimeActionRouter(app, { uiBridge });

        router.startSimulation();

        expect(validateSimulationTopology).toHaveBeenCalledTimes(1);
        expect(startSimulation).toHaveBeenCalledTimes(1);
        expect(uiBridge.showSimulationStarted).toHaveBeenCalledWith('');
    });
});
