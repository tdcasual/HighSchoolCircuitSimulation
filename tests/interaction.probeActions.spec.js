import { describe, expect, it, vi } from 'vitest';
import * as ProbeActions from '../src/ui/interaction/ProbeActions.js';

describe('ProbeActions.renameObservationProbe', () => {
    it('renames probe and refreshes dependent views', () => {
        const probe = { id: 'P1', label: 'Old' };
        const context = {
            circuit: {
                getObservationProbe: vi.fn(() => probe)
            },
            runWithHistory: vi.fn((_, action) => action()),
            renderer: { renderWires: vi.fn() },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const ok = ProbeActions.renameObservationProbe.call(context, 'P1', '  New Label  ');

        expect(ok).toBe(true);
        expect(probe.label).toBe('New Label');
        expect(context.runWithHistory).toHaveBeenCalledWith('重命名探针', expect.any(Function));
        expect(context.renderer.renderWires).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.requestRender).toHaveBeenCalledWith({ onlyIfActive: false });
        expect(context.updateStatus).toHaveBeenCalledWith('探针名称已更新');
    });
});

describe('ProbeActions.deleteObservationProbe', () => {
    it('deletes probe and refreshes dependent views', () => {
        const context = {
            circuit: {
                getObservationProbe: vi.fn(() => ({ id: 'P1' })),
                removeObservationProbe: vi.fn()
            },
            runWithHistory: vi.fn((_, action) => action()),
            renderer: { renderWires: vi.fn() },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const ok = ProbeActions.deleteObservationProbe.call(context, 'P1');

        expect(ok).toBe(true);
        expect(context.runWithHistory).toHaveBeenCalledWith('删除探针', expect.any(Function));
        expect(context.circuit.removeObservationProbe).toHaveBeenCalledWith('P1');
        expect(context.renderer.renderWires).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.requestRender).toHaveBeenCalledWith({ onlyIfActive: false });
        expect(context.updateStatus).toHaveBeenCalledWith('已删除探针');
    });
});

describe('ProbeActions.addProbePlot', () => {
    it('activates observation tab and adds plot source', () => {
        const context = {
            circuit: {
                getObservationProbe: vi.fn(() => ({ id: 'P1' }))
            },
            activateSidePanelTab: vi.fn(),
            isObservationTabActive: vi.fn(() => false),
            app: {
                observationPanel: {
                    addPlotForSource: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const ok = ProbeActions.addProbePlot.call(context, 'P1');

        expect(ok).toBe(true);
        expect(context.activateSidePanelTab).toHaveBeenCalledWith('observation');
        expect(context.app.observationPanel.addPlotForSource).toHaveBeenCalledWith('P1');
        expect(context.app.observationPanel.requestRender).toHaveBeenCalledWith({ onlyIfActive: false });
        expect(context.updateStatus).toHaveBeenCalledWith('已添加探针观察图像');
    });
});

describe('ProbeActions.addObservationProbeForWire', () => {
    it('creates wire probe and refreshes observation panel', () => {
        const context = {
            circuit: {
                getWire: vi.fn(() => ({ id: 'W1' })),
                getAllObservationProbes: vi.fn(() => []),
                ensureUniqueObservationProbeId: vi.fn(() => 'probe_1'),
                addObservationProbe: vi.fn((probe) => probe)
            },
            runWithHistory: vi.fn((_, action) => action()),
            renderer: { renderWires: vi.fn() },
            activateSidePanelTab: vi.fn(),
            isObservationTabActive: vi.fn(() => false),
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        ProbeActions.addObservationProbeForWire.call(context, 'W1', 'NodeVoltageProbe');

        expect(context.runWithHistory).toHaveBeenCalledWith('添加节点电压探针', expect.any(Function));
        expect(context.circuit.addObservationProbe).toHaveBeenCalledWith(expect.objectContaining({
            id: 'probe_1',
            type: 'NodeVoltageProbe',
            wireId: 'W1'
        }));
        expect(context.renderer.renderWires).toHaveBeenCalledTimes(1);
        expect(context.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(context.activateSidePanelTab).toHaveBeenCalledWith('observation');
        expect(context.app.observationPanel.requestRender).toHaveBeenCalledWith({ onlyIfActive: false });
        expect(context.updateStatus).toHaveBeenCalledWith('已添加节点电压探针');
    });

    it('optionally auto-adds probe plot to reduce mobile operation steps', () => {
        const context = {
            circuit: {
                getWire: vi.fn(() => ({ id: 'W1' })),
                getAllObservationProbes: vi.fn(() => []),
                ensureUniqueObservationProbeId: vi.fn(() => 'probe_1'),
                addObservationProbe: vi.fn((probe) => probe),
                getObservationProbe: vi.fn((probeId) => (probeId === 'probe_1' ? { id: 'probe_1' } : null))
            },
            runWithHistory: vi.fn((_, action) => action()),
            renderer: { renderWires: vi.fn() },
            activateSidePanelTab: vi.fn(),
            isObservationTabActive: vi.fn(() => false),
            app: {
                observationPanel: {
                    addPlotForSource: vi.fn(),
                    refreshComponentOptions: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = ProbeActions.addObservationProbeForWire.call(
            context,
            'W1',
            'WireCurrentProbe',
            { autoAddPlot: true }
        );

        expect(result).toBe('probe_1');
        expect(context.app.observationPanel.addPlotForSource).toHaveBeenCalledWith('probe_1');
        expect(context.updateStatus).toHaveBeenCalledWith('已添加支路电流探针并加入观察图像');
    });
});
