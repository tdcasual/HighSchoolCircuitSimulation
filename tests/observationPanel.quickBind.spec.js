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
});
