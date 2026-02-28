import { describe, it, expect, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';
import { PROBE_SOURCE_PREFIX, QuantityIds, TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

describe('ObservationPanel quick bind', () => {
    it('resolves raw probe id to prefixed source id', () => {
        const ctx = {
            circuit: {
                components: new Map(),
                getObservationProbe: (id) => (id === 'P1' ? { id: 'P1' } : null)
            }
        };

        const resolved = ObservationPanel.prototype.resolveSourceIdForPlot.call(ctx, 'P1');
        expect(resolved).toBe(`${PROBE_SOURCE_PREFIX}P1`);
    });

    it('falls back to time source for unknown ids', () => {
        const ctx = {
            circuit: {
                components: new Map(),
                getObservationProbe: () => null
            }
        };

        const resolved = ObservationPanel.prototype.resolveSourceIdForPlot.call(ctx, 'Unknown');
        expect(resolved).toBe(TIME_SOURCE_ID);
    });

    it('adds plot config for probe source with valid quantity', () => {
        const addPlot = vi.fn(({ config }) => {
            ctx.plots.push({ config });
        });
        const ctx = {
            nextPlotIndex: 1,
            plots: [],
            addPlot,
            resolveSourceIdForPlot: ObservationPanel.prototype.resolveSourceIdForPlot,
            circuit: {
                components: new Map(),
                getObservationProbe: (id) => (id === 'P1'
                    ? { id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' }
                    : null),
                getObservationProbeBySource: () => null
            }
        };

        const plot = ObservationPanel.prototype.addPlotForSource.call(ctx, 'P1', { quantityId: QuantityIds.Voltage });

        expect(addPlot).toHaveBeenCalledTimes(1);
        expect(ctx.plots).toHaveLength(1);
        expect(ctx.plots[0].config.y.sourceId).toBe(`${PROBE_SOURCE_PREFIX}P1`);
        expect(ctx.plots[0].config.y.quantityId).toBe(QuantityIds.Voltage);
        expect(plot).toEqual(ctx.plots[0]);
    });

    it('normalizes legacy template fields for backward compatibility', () => {
        const ctx = {
            getDefaultComponentId: () => 'R1'
        };

        const templates = ObservationPanel.prototype.normalizeTemplateCollection.call(ctx, [
            {
                templateName: '  旧模板 ',
                mode: 'advanced',
                plots: [],
                plotBindings: [
                    { plot: 0, target: 'y', source: 'R2', quantity: QuantityIds.Current }
                ]
            }
        ]);

        expect(templates).toHaveLength(1);
        expect(templates[0].name).toBe('旧模板');
        expect(templates[0].ui.mode).toBe('advanced');
        expect(templates[0].bindings).toEqual([
            { plotIndex: 0, axis: 'y', sourceId: 'R2', quantityId: QuantityIds.Current }
        ]);
    });

    it('saves and applies template presets', () => {
        const fromJSON = vi.fn();
        const refreshTemplateControls = vi.fn();
        const schedulePersist = vi.fn();
        const showTransientStatus = vi.fn();
        const toJSON = vi.fn(() => ({
            sampleIntervalMs: 50,
            ui: { mode: 'basic', collapsedCards: [], showGaugeSection: true },
            plots: [
                {
                    name: '图像 1',
                    maxPoints: 1000,
                    x: { sourceId: TIME_SOURCE_ID, quantityId: QuantityIds.Time, transformId: 'identity', autoRange: true, min: null, max: null },
                    y: { sourceId: 'R1', quantityId: QuantityIds.Voltage, transformId: 'identity', autoRange: true, min: null, max: null }
                }
            ]
        }));
        const ctx = {
            templates: [],
            sampleIntervalMs: 50,
            getDefaultComponentId: () => 'R1',
            toJSON,
            fromJSON,
            refreshTemplateControls,
            schedulePersist,
            showTransientStatus,
            normalizeTemplateCollection: ObservationPanel.prototype.normalizeTemplateCollection
        };

        const saved = ObservationPanel.prototype.saveCurrentAsTemplate.call(ctx, '  模板A ');
        expect(saved).toBeTruthy();
        expect(ctx.templates).toHaveLength(1);
        expect(ctx.templates[0].name).toBe('模板A');
        expect(refreshTemplateControls).toHaveBeenCalled();

        const applied = ObservationPanel.prototype.applyTemplateByName.call(ctx, '模板A');
        expect(applied).toBe(true);
        expect(fromJSON).toHaveBeenCalledWith(expect.objectContaining({
            sampleIntervalMs: 50,
            templates: ctx.templates
        }));
        expect(showTransientStatus).toHaveBeenCalledWith(expect.stringContaining('已应用模板'));
    });
});
