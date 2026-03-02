import { describe, it, expect } from 'vitest';
import {
    createDefaultPlotState,
    DEFAULT_SAMPLE_INTERVAL_MS,
    normalizeObservationState,
    normalizeObservationTemplate,
    normalizeObservationTemplateBindings,
    normalizePlotState,
    normalizeSampleIntervalMs,
    ObservationDisplayModes,
    OBSERVATION_LEGACY_SCHEMA_AUDIT,
    OBSERVATION_TEMPLATE_SCHEMA_VERSION,
    shouldSampleAtTime
} from '../src/ui/observation/ObservationState.js';
import { TransformIds } from '../src/ui/observation/ObservationMath.js';
import { QuantityIds, TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

describe('ObservationState', () => {
    it('normalizes sampling interval with bounds', () => {
        expect(normalizeSampleIntervalMs(undefined, DEFAULT_SAMPLE_INTERVAL_MS)).toBe(DEFAULT_SAMPLE_INTERVAL_MS);
        expect(normalizeSampleIntervalMs(-20, DEFAULT_SAMPLE_INTERVAL_MS)).toBe(0);
        expect(normalizeSampleIntervalMs(12.7, DEFAULT_SAMPLE_INTERVAL_MS)).toBe(13);
        expect(normalizeSampleIntervalMs(9000, DEFAULT_SAMPLE_INTERVAL_MS)).toBe(5000);
    });

    it('normalizes plot axis configuration and swaps invalid manual ranges', () => {
        const fallback = createDefaultPlotState(1, 'R1');
        const normalized = normalizePlotState({
            name: '  自定义图像 ',
            maxPoints: 50,
            yDisplayMode: 'invalid-display',
            x: {
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                transformId: 'invalid-transform',
                autoRange: false,
                min: 5,
                max: -1
            },
            y: {
                sourceId: 'R1',
                quantityId: QuantityIds.Current,
                transformId: TransformIds.Abs,
                autoRange: true,
                min: -999,
                max: 999
            }
        }, fallback);

        expect(normalized.name).toBe('自定义图像');
        expect(normalized.maxPoints).toBe(100);
        expect(normalized.yDisplayMode).toBe(ObservationDisplayModes.Signed);
        expect(normalized.x.transformId).toBe(fallback.x.transformId);
        expect(normalized.x.autoRange).toBe(false);
        expect(normalized.x.min).toBe(-1);
        expect(normalized.x.max).toBe(5);
        expect(normalized.y.autoRange).toBe(true);
        expect(normalized.y.min).toBeNull();
        expect(normalized.y.max).toBeNull();
    });

    it('normalizes observation state and keeps at least one plot', () => {
        const state = normalizeObservationState({
            sampleIntervalMs: 33.3,
            plots: []
        }, {
            defaultYSourceId: 'R1',
            defaultPlotCount: 1
        });

        expect(state.sampleIntervalMs).toBe(33);
        expect(state.plots.length).toBe(1);
        expect(state.plots[0].y.sourceId).toBe('R1');
        expect(state.plots[0].y.quantityId).toBe(QuantityIds.Current);
        expect(state.plots[0].yDisplayMode).toBe(ObservationDisplayModes.Signed);
    });

    it('supports time source defaults for y axis', () => {
        const state = normalizeObservationState(null, {
            defaultYSourceId: TIME_SOURCE_ID,
            defaultPlotCount: 1
        });
        expect(state.plots[0].y.sourceId).toBe(TIME_SOURCE_ID);
        expect(state.plots[0].y.quantityId).toBe(QuantityIds.Time);
        expect(state.plots[0].yDisplayMode).toBe(ObservationDisplayModes.Signed);
    });

    it('keeps explicit empty plot list when allowEmptyPlots is enabled', () => {
        const state = normalizeObservationState({
            sampleIntervalMs: 40,
            plots: []
        }, {
            defaultYSourceId: 'R1',
            defaultPlotCount: 1,
            allowEmptyPlots: true
        });
        expect(state.sampleIntervalMs).toBe(40);
        expect(state.plots).toHaveLength(0);
    });

    it('normalizes ui preferences with backward compatibility defaults', () => {
        const state = normalizeObservationState({
            sampleIntervalMs: 40,
            plots: [],
            ui: {
                mode: 'basic',
                collapsedCards: ['plot_1', '', null],
                showGaugeSection: true
            }
        }, {
            defaultYSourceId: 'R1',
            defaultPlotCount: 1
        });

        expect(state.ui.mode).toBe('basic');
        expect(state.ui.showGaugeSection).toBe(true);
        expect(state.ui.collapsedCards).toEqual(['plot_1']);
    });

    it('decides sampling by simulated time and configured interval', () => {
        expect(shouldSampleAtTime(0, Number.NEGATIVE_INFINITY, 50)).toBe(true);
        expect(shouldSampleAtTime(0.02, 0, 50)).toBe(false);
        expect(shouldSampleAtTime(0.051, 0, 50)).toBe(true);
        expect(shouldSampleAtTime(0.001, 0, 0)).toBe(true);
        expect(shouldSampleAtTime(NaN, 0, 50)).toBe(false);
    });

    it('normalizes template bindings and migrates legacy binding field names', () => {
        const bindings = normalizeObservationTemplateBindings([
            { plotIndex: '2', axis: 'Y', sourceId: '  R1 ', quantityId: 'current' },
            { plot: 1, target: 'x', source: TIME_SOURCE_ID, quantity: QuantityIds.Time },
            { plotIndex: -1, axis: 'z', sourceId: '' }
        ]);

        expect(bindings).toEqual([
            { plotIndex: 2, axis: 'y', sourceId: 'R1', quantityId: 'current' },
            { plotIndex: 1, axis: 'x', sourceId: TIME_SOURCE_ID, quantityId: QuantityIds.Time }
        ]);
    });

    it('normalizes observation template schema fields', () => {
        const template = normalizeObservationTemplate({
            name: '  电压模板 ',
            plots: [
                {
                    name: '图A',
                    maxPoints: 2500,
                    y: {
                        sourceId: 'R1',
                        quantityId: QuantityIds.Voltage,
                        transformId: TransformIds.Identity,
                        autoRange: true
                    }
                }
            ],
            ui: {
                mode: 'advanced',
                collapsedCards: ['plot_1', '', null],
                showGaugeSection: false
            },
            bindings: [
                { plotIndex: 0, axis: 'y', sourceId: 'R1', quantityId: QuantityIds.Voltage }
            ]
        });

        expect(template.schemaVersion).toBe(OBSERVATION_TEMPLATE_SCHEMA_VERSION);
        expect(template.name).toBe('电压模板');
        expect(template.plots).toHaveLength(1);
        expect(template.ui.mode).toBe('advanced');
        expect(template.ui.collapsedCards).toEqual(['plot_1']);
        expect(template.ui.showGaugeSection).toBe(false);
        expect(template.bindings).toEqual([
            { plotIndex: 0, axis: 'y', sourceId: 'R1', quantityId: QuantityIds.Voltage }
        ]);
    });

    it('migrates legacy template fields into schema', () => {
        const template = normalizeObservationTemplate({
            templateName: '  老模板 ',
            mode: 'advanced',
            collapsedCards: ['plot_legacy'],
            showGaugeSection: false,
            plots: [],
            plotBindings: [
                { plot: 0, target: 'y', source: 'R2', quantity: QuantityIds.Current }
            ]
        });

        expect(template.name).toBe('老模板');
        expect(template.plots).toEqual([]);
        expect(template.ui.mode).toBe('advanced');
        expect(template.ui.collapsedCards).toEqual(['plot_legacy']);
        expect(template.ui.showGaugeSection).toBe(false);
        expect(template.bindings).toEqual([
            { plotIndex: 0, axis: 'y', sourceId: 'R2', quantityId: QuantityIds.Current }
        ]);
    });

    it('provides legacy schema audit classification for week9 prune', () => {
        expect(OBSERVATION_LEGACY_SCHEMA_AUDIT.mustKeep).toEqual(expect.arrayContaining([
            'templateName',
            'plotBindings',
            'mode/collapsedCards/showGaugeSection'
        ]));
        expect(OBSERVATION_LEGACY_SCHEMA_AUDIT.removable).toEqual(expect.arrayContaining([
            'title',
            'presetName',
            'bindingMap',
            'plot/plotId',
            'target/source/quantity'
        ]));
    });
});
