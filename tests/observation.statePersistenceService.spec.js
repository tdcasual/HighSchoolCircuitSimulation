import { describe, expect, it, vi } from 'vitest';
import {
    hydrateObservationState,
    serializeObservationState
} from '../src/ui/observation/ObservationStatePersistenceService.js';
import { QuantityIds, TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

describe('ObservationStatePersistenceService', () => {
    it('serializes plot ranges and canonical templates', () => {
        const panel = {
            sampleIntervalMs: 80,
            ui: { mode: 'advanced', collapsedCards: ['plot_1'], showGaugeSection: false },
            plots: [
                {
                    name: '图像 1',
                    maxPoints: 1500,
                    yDisplayMode: 'signed',
                    x: {
                        sourceId: TIME_SOURCE_ID,
                        quantityId: QuantityIds.Time,
                        transformId: 'identity',
                        autoRange: false,
                        min: ' 1.25 ',
                        max: ''
                    },
                    y: {
                        sourceId: 'R1',
                        quantityId: QuantityIds.Voltage,
                        transformId: 'identity',
                        autoRange: false,
                        min: '-2',
                        max: '4.5'
                    }
                }
            ],
            templates: [
                {
                    templateName: '旧字段会被忽略',
                    plots: []
                },
                {
                    name: '模板 A',
                    plots: [
                        {
                            x: { sourceId: TIME_SOURCE_ID, quantityId: QuantityIds.Time, transformId: 'identity', autoRange: true },
                            y: { sourceId: 'R1', quantityId: QuantityIds.Voltage, transformId: 'identity', autoRange: true }
                        }
                    ],
                    ui: { mode: 'basic', collapsedCards: [], showGaugeSection: true }
                }
            ],
            getDefaultComponentId: () => 'R1'
        };

        const serialized = serializeObservationState(panel);
        expect(serialized.sampleIntervalMs).toBe(80);
        expect(serialized.plots[0].x.min).toBe(1.25);
        expect(serialized.plots[0].x.max).toBe(null);
        expect(serialized.plots[0].y.min).toBe(-2);
        expect(serialized.plots[0].y.max).toBe(4.5);
        expect(serialized.templates).toHaveLength(2);
        expect(serialized.templates[0].name).toBe('未命名模板');
        expect(serialized.templates[1].name).toBe('模板 A');
    });

    it('hydrates runtime state and refreshes panel lifecycle hooks', () => {
        const panel = {
            root: {},
            sampleIntervalMs: 50,
            sampleIntervalInput: { value: '' },
            ui: { mode: 'basic', collapsedCards: [], showGaugeSection: true },
            templates: [],
            plots: [],
            nextPlotIndex: 99,
            _lastSampleTime: 1,
            getDefaultComponentId: () => 'R1',
            clearPlotCards: vi.fn(),
            addPlot: vi.fn(),
            refreshComponentOptions: vi.fn(),
            updateModeToggleUI: vi.fn(),
            refreshTemplateControls: vi.fn(),
            applyLayoutModeToAllPlotCards: vi.fn(),
            requestRender: vi.fn()
        };

        hydrateObservationState(panel, {
            sampleIntervalMs: 120,
            ui: { mode: 'advanced' },
            plots: [
                {
                    name: '图像 A',
                    x: { sourceId: TIME_SOURCE_ID, quantityId: QuantityIds.Time },
                    y: { sourceId: 'R1', quantityId: QuantityIds.Current }
                }
            ],
            templatePresets: [
                {
                    name: '模板 B',
                    plots: [],
                    ui: { mode: 'basic' }
                }
            ]
        });

        expect(panel.sampleIntervalMs).toBe(120);
        expect(panel.sampleIntervalInput.value).toBe('120');
        expect(panel.templates).toHaveLength(1);
        expect(panel.templates[0].name).toBe('模板 B');
        expect(panel.clearPlotCards).toHaveBeenCalledTimes(1);
        expect(panel.addPlot).toHaveBeenCalledTimes(1);
        expect(panel.nextPlotIndex).toBe(1);
        expect(panel._lastSampleTime).toBe(Number.NEGATIVE_INFINITY);
        expect(panel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(panel.updateModeToggleUI).toHaveBeenCalledTimes(1);
        expect(panel.refreshTemplateControls).toHaveBeenCalledTimes(1);
        expect(panel.applyLayoutModeToAllPlotCards).toHaveBeenCalledTimes(1);
        expect(panel.requestRender).toHaveBeenCalledWith({ onlyIfActive: true });
    });
});
