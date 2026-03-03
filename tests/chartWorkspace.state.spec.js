import { describe, expect, it } from 'vitest';
import {
    CHART_WORKSPACE_SCHEMA_VERSION,
    createDefaultChartSeriesState,
    createDefaultChartState,
    createDefaultChartWorkspaceState,
    migrateChartWorkspaceStateV1ToV2,
    normalizeChartWorkspaceState,
    serializeChartWorkspaceState
} from '../src/ui/charts/ChartWorkspaceState.js';

describe('ChartWorkspaceState v2', () => {
    it('creates empty workspace by default (no chart windows)', () => {
        const state = createDefaultChartWorkspaceState();

        expect(state.schemaVersion).toBe(CHART_WORKSPACE_SCHEMA_VERSION);
        expect(state.charts).toEqual([]);
        expect(state.selection.activeChartId).toBe(null);
    });

    it('creates chart state with shared x-axis and zero series by default', () => {
        const chart = createDefaultChartState({ index: 2 });

        expect(chart.id).toMatch(/^chart_/);
        expect(chart.title).toBe('图表 2');
        expect(chart.series).toEqual([]);
        expect(chart.axis.xBinding.sourceId).toBe('__time__');
        expect(chart.axis.xBinding.quantityId).toBe('t');
        expect(chart.ui.axisCollapsed).toBe(false);
        expect(chart.ui.legendCollapsed).toBe(false);
    });

    it('creates series state with shared-x mode and color from palette', () => {
        const series = createDefaultChartSeriesState({ index: 3, sourceId: 'R1', quantityId: 'I' });

        expect(series.id).toMatch(/^series_/);
        expect(series.xMode).toBe('shared-x');
        expect(series.sourceId).toBe('R1');
        expect(series.quantityId).toBe('I');
        expect(series.color).toBeTruthy();
    });

    it('migrates legacy v1 window schema to v2 charts', () => {
        const migrated = migrateChartWorkspaceStateV1ToV2({
            sampleIntervalMs: 42,
            windows: [
                {
                    id: 'w1',
                    title: '旧图表',
                    rect: { x: 10, y: 20, width: 360, height: 240 },
                    zIndex: 5,
                    maxPoints: 1500,
                    series: {
                        x: { sourceId: '__time__', quantityId: 't', transformId: 'identity' },
                        y: { sourceId: 'R1', quantityId: 'I', transformId: 'identity' }
                    },
                    uiState: { collapsed: true }
                }
            ]
        });

        expect(migrated.schemaVersion).toBe(CHART_WORKSPACE_SCHEMA_VERSION);
        expect(migrated.charts).toHaveLength(1);
        expect(migrated.charts[0].title).toBe('旧图表');
        expect(migrated.charts[0].axis.xBinding.sourceId).toBe('__time__');
        expect(migrated.charts[0].series).toHaveLength(1);
        expect(migrated.charts[0].series[0].sourceId).toBe('R1');
        expect(migrated.charts[0].ui.legendCollapsed).toBe(true);
    });

    it('normalizes state and removes duplicated chart ids', () => {
        const normalized = normalizeChartWorkspaceState({
            schemaVersion: 2,
            sampleIntervalMs: 27.8,
            charts: [
                {
                    id: 'chart_a',
                    title: 'A',
                    series: [{ id: 's1', sourceId: 'R1', quantityId: 'I' }],
                    ui: {
                        axisCollapsed: true,
                        legendCollapsed: false
                    }
                },
                {
                    id: 'chart_a',
                    title: 'B',
                    series: [{ id: 's2', sourceId: 'R2', quantityId: 'U' }]
                }
            ],
            selection: {
                activeChartId: 'chart_a',
                activeSeriesId: 's1'
            }
        });

        expect(normalized.schemaVersion).toBe(CHART_WORKSPACE_SCHEMA_VERSION);
        expect(normalized.sampleIntervalMs).toBe(28);
        expect(normalized.charts).toHaveLength(1);
        expect(normalized.selection.activeChartId).toBe('chart_a');
        expect(normalized.selection.activeSeriesId).toBe('s1');
        expect(normalized.charts[0].ui.axisCollapsed).toBe(true);
        expect(normalized.charts[0].ui.legendCollapsed).toBe(false);
    });

    it('serializes v2 schema without legacy windows key', () => {
        const serialized = serializeChartWorkspaceState({
            schemaVersion: 2,
            charts: [
                {
                    id: 'chart_a',
                    title: 'A',
                    frame: { x: 10, y: 10, width: 300, height: 200 },
                    zIndex: 1,
                    maxPoints: 3000,
                    axis: {
                        xBinding: { sourceId: '__time__', quantityId: 't', transformId: 'identity' },
                        xRangeMode: 'auto',
                        yRangeMode: 'auto'
                    },
                    series: [
                        {
                            id: 's1',
                            name: 'I(R1)',
                            sourceId: 'R1',
                            quantityId: 'I',
                            transformId: 'identity',
                            visible: true,
                            color: '#1d4ed8',
                            xMode: 'shared-x',
                            scatterXBinding: null
                        }
                    ],
                    ui: {
                        axisCollapsed: true,
                        legendCollapsed: false
                    }
                }
            ],
            selection: {
                activeChartId: 'chart_a',
                activeSeriesId: 's1'
            }
        });

        expect(serialized.schemaVersion).toBe(CHART_WORKSPACE_SCHEMA_VERSION);
        expect(serialized).not.toHaveProperty('windows');
        expect(serialized.charts).toHaveLength(1);
        expect(serialized.charts[0].series).toHaveLength(1);
        expect(serialized.charts[0].ui.axisCollapsed).toBe(true);
        expect(serialized.charts[0].ui.legendCollapsed).toBe(false);
    });

    it('preserves numeric zero source ids by normalizing to string', () => {
        const normalized = normalizeChartWorkspaceState({
            schemaVersion: 2,
            charts: [
                {
                    id: 'chart_z',
                    title: 'Z',
                    axis: {
                        xBinding: {
                            sourceId: 0,
                            quantityId: 't',
                            transformId: 'identity'
                        },
                        xRangeMode: 'auto',
                        yRangeMode: 'auto'
                    },
                    series: [
                        {
                            id: 's0',
                            name: 'S0',
                            sourceId: 0,
                            quantityId: 'I',
                            transformId: 'identity',
                            visible: true,
                            color: '#1d4ed8',
                            xMode: 'shared-x',
                            scatterXBinding: null
                        }
                    ],
                    ui: {
                        axisCollapsed: false,
                        legendCollapsed: false
                    }
                }
            ],
            selection: {
                activeChartId: 'chart_z',
                activeSeriesId: 's0'
            }
        });

        expect(normalized.charts).toHaveLength(1);
        expect(normalized.charts[0].axis.xBinding.sourceId).toBe('0');
        expect(normalized.charts[0].series[0].sourceId).toBe('0');
    });
});
