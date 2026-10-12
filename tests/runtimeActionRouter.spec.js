import { describe, expect, it, vi } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';
import { APP_DOCUMENT_FORMAT, APP_DOCUMENT_VERSION } from '../src/app/AppDocument.js';

describe('RuntimeActionRouter', () => {
    function createLoadHarness(overrides = {}) {
        const fromJSON = overrides.fromJSON || vi.fn();
        const stopSimulationImpl = overrides.stopSimulationImpl || vi.fn();
        const beginCircuitStorageOwnership = overrides.beginCircuitStorageOwnership || vi.fn();
        const applyChartWorkspace = vi.fn();
        const applyExerciseBoard = vi.fn();
        const updateIdCounterFromExistingImpl = vi.fn();
        const render = vi.fn();
        const clearSelection = vi.fn();
        const refreshComponentOptions = vi.fn();
        const refreshDialGauges = vi.fn();
        const uiBridge = {
            showCircuitLoaded: vi.fn()
        };
        const app = {
            beginCircuitStorageOwnership,
            logger: { warn: vi.fn(), error: vi.fn() },
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
            stopSimulationImpl
        });
        return {
            router,
            fromJSON,
            stopSimulationImpl,
            beginCircuitStorageOwnership,
            applyChartWorkspace,
            applyExerciseBoard,
            updateIdCounterFromExistingImpl,
            render,
            clearSelection,
            refreshComponentOptions,
            refreshDialGauges,
            uiBridge,
            app
        };
    }

    it('peels UI extras then loads circuit payload after fromJSON succeeds', () => {
        const harness = createLoadHarness();
        const data = {
            components: [{ id: 'R1' }],
            wires: [{ id: 'W1' }],
            meta: {
                version: 3,
                name: '测试电路',
                exerciseBoard: { enabled: true },
                chartWorkspace: { visible: true }
            }
        };

        const summary = harness.router.loadCircuitData(data, {
            statusText: '已加载测试电路',
            storageSource: 'manual-import'
        });

        expect(harness.fromJSON).toHaveBeenCalledTimes(1);
        const circuitPayload = harness.fromJSON.mock.calls[0][0];
        expect(circuitPayload.components).toEqual([{ id: 'R1' }]);
        expect(circuitPayload.wires).toEqual([{ id: 'W1' }]);
        expect(circuitPayload.meta.exerciseBoard).toBeUndefined();
        expect(circuitPayload.meta.chartWorkspace).toBeUndefined();
        expect(circuitPayload.meta.version).toBe(3);
        expect(harness.stopSimulationImpl).toHaveBeenCalledTimes(1);
        expect(harness.beginCircuitStorageOwnership).toHaveBeenCalledWith('manual-import');
        expect(harness.fromJSON.mock.invocationCallOrder[0])
            .toBeLessThan(harness.stopSimulationImpl.mock.invocationCallOrder[0]);
        expect(harness.fromJSON.mock.invocationCallOrder[0])
            .toBeLessThan(harness.beginCircuitStorageOwnership.mock.invocationCallOrder[0]);
        expect(harness.updateIdCounterFromExistingImpl).toHaveBeenCalledWith(['R1', 'W1']);
        expect(harness.render).toHaveBeenCalledTimes(1);
        expect(harness.clearSelection).toHaveBeenCalledTimes(1);
        expect(harness.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(harness.refreshDialGauges).toHaveBeenCalledTimes(1);
        expect(harness.applyExerciseBoard).toHaveBeenCalledWith({ enabled: true });
        expect(harness.applyChartWorkspace).toHaveBeenCalledWith({ visible: true });
        expect(harness.app.logger.warn).toHaveBeenCalled();
        expect(harness.uiBridge.showCircuitLoaded).toHaveBeenCalledWith({
            data: circuitPayload,
            statusText: '已加载测试电路',
            silent: false
        });
        expect(summary).toEqual({ componentCount: 1, wireCount: 1 });
    });

    it('unwraps hscs-app envelope before fromJSON', () => {
        const harness = createLoadHarness();
        const circuit = {
            meta: { version: 3, name: '信封电路' },
            components: [{ id: 'R1' }],
            wires: []
        };
        const data = {
            format: APP_DOCUMENT_FORMAT,
            formatVersion: APP_DOCUMENT_VERSION,
            circuit,
            ui: {
                exerciseBoard: { markdown: '# q' }
            }
        };

        harness.router.loadCircuitData(data);

        expect(harness.fromJSON).toHaveBeenCalledWith(circuit);
        expect(harness.applyExerciseBoard).toHaveBeenCalledWith({ markdown: '# q' });
        expect(harness.stopSimulationImpl).toHaveBeenCalledTimes(1);
    });

    it('does not stop simulation or take ownership when fromJSON fails', () => {
        const fromJSON = vi.fn(() => {
            throw new Error('schema rejected');
        });
        const harness = createLoadHarness({ fromJSON });
        const data = {
            meta: { version: 3, name: '坏图' },
            components: [{ id: 'R1' }],
            wires: []
        };

        expect(() => harness.router.loadCircuitData(data, { storageSource: 'manual-import' })).toThrow(/schema rejected/);
        expect(harness.stopSimulationImpl).not.toHaveBeenCalled();
        expect(harness.beginCircuitStorageOwnership).not.toHaveBeenCalled();
        expect(harness.applyExerciseBoard).not.toHaveBeenCalled();
        expect(harness.render).not.toHaveBeenCalled();
    });

    it('does not stop simulation when parseAppDocument rejects the document', () => {
        const harness = createLoadHarness();

        expect(() => harness.router.loadCircuitData({
            format: 'nope',
            components: [{ id: 'R1' }],
            wires: []
        })).toThrow();
        expect(harness.fromJSON).not.toHaveBeenCalled();
        expect(harness.stopSimulationImpl).not.toHaveBeenCalled();
        expect(harness.beginCircuitStorageOwnership).not.toHaveBeenCalled();
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
