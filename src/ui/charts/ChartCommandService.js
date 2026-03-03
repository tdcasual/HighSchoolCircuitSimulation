import {
    createDefaultChartSeriesState,
    createDefaultChartState,
    normalizeChartBinding,
    normalizeChartWorkspaceState,
    SERIES_COLOR_PALETTE
} from './ChartWorkspaceState.js';
import { TIME_SOURCE_ID } from '../observation/ObservationSources.js';

function clampZIndex(charts = []) {
    const sorted = charts
        .slice()
        .sort((a, b) => (Number(a?.zIndex) || 0) - (Number(b?.zIndex) || 0));
    sorted.forEach((chart, index) => {
        chart.zIndex = index + 1;
    });
}

function findChart(state, chartId) {
    if (!state || !Array.isArray(state.charts)) return null;
    return state.charts.find((item) => item.id === chartId) || null;
}

function resolveActiveChartId(state, fallbackChartId = null) {
    const activeId = state?.selection?.activeChartId || null;
    if (activeId && findChart(state, activeId)) return activeId;
    if (fallbackChartId && findChart(state, fallbackChartId)) return fallbackChartId;
    return state?.charts?.[0]?.id || null;
}

function resolveNextSeriesColor(chart) {
    const seriesCount = Array.isArray(chart?.series) ? chart.series.length : 0;
    return SERIES_COLOR_PALETTE[seriesCount % SERIES_COLOR_PALETTE.length];
}

export class ChartCommandService {
    constructor(store, options = {}) {
        this.store = store;
        this.onChange = typeof options.onChange === 'function' ? options.onChange : null;
        this.resolveDefaultFrame = typeof options.resolveDefaultFrame === 'function'
            ? options.resolveDefaultFrame
            : null;
    }

    emit(reason, state) {
        if (!this.onChange) return;
        this.onChange(reason, state);
    }

    update(reason, mutator) {
        const state = this.store.update(mutator);
        this.emit(reason, state);
        return state;
    }

    replaceDocument(nextState) {
        const state = this.store.replace(nextState);
        this.emit('replace-document', state);
        return state;
    }

    setSampleIntervalMs(sampleIntervalMs) {
        return this.update('set-sample-interval', (draft) => {
            draft.sampleIntervalMs = sampleIntervalMs;
            return draft;
        });
    }

    addChart(options = {}) {
        const baseState = this.store.getState();
        const index = (baseState?.charts?.length || 0) + 1;
        const defaultFrame = this.resolveDefaultFrame
            ? this.resolveDefaultFrame(index, options)
            : options.frame;
        const chart = createDefaultChartState({
            index,
            frame: defaultFrame,
            title: options.title,
            maxPoints: options.maxPoints,
            axis: options.axis
        });
        if (Array.isArray(options.series) && options.series.length > 0) {
            chart.series = options.series.map((item, seriesIndex) => createDefaultChartSeriesState({
                ...item,
                index: seriesIndex + 1,
                color: item?.color || SERIES_COLOR_PALETTE[seriesIndex % SERIES_COLOR_PALETTE.length]
            }));
        }

        this.update('add-chart', (draft) => {
            draft.charts.push(chart);
            clampZIndex(draft.charts);
            draft.selection.activeChartId = chart.id;
            draft.selection.activeSeriesId = chart.series[0]?.id || null;
            return draft;
        });

        return chart.id;
    }

    removeChart(chartId) {
        return this.update('remove-chart', (draft) => {
            const index = draft.charts.findIndex((chart) => chart.id === chartId);
            if (index < 0) return draft;
            draft.charts.splice(index, 1);
            clampZIndex(draft.charts);
            const nextActiveChartId = resolveActiveChartId(draft);
            draft.selection.activeChartId = nextActiveChartId;
            const nextActiveChart = findChart(draft, nextActiveChartId);
            draft.selection.activeSeriesId = nextActiveChart?.series?.[0]?.id || null;
            return draft;
        });
    }

    focusChart(chartId) {
        return this.update('focus-chart', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            const maxZ = draft.charts.reduce((acc, item) => Math.max(acc, Number(item?.zIndex) || 0), 0);
            chart.zIndex = Math.max(1, maxZ + 1);
            clampZIndex(draft.charts);
            draft.selection.activeChartId = chart.id;
            if (!chart.series.some((series) => series.id === draft.selection.activeSeriesId)) {
                draft.selection.activeSeriesId = chart.series[0]?.id || null;
            }
            return draft;
        });
    }

    updateChartTitle(chartId, title) {
        const nextTitle = String(title || '').trim();
        return this.update('update-chart-title', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            if (nextTitle) {
                chart.title = nextTitle;
            }
            return draft;
        });
    }

    updateChartFrame(chartId, frame) {
        return this.update('update-chart-frame', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart || !frame || typeof frame !== 'object') return draft;
            chart.frame = {
                ...chart.frame,
                ...frame
            };
            return draft;
        });
    }

    toggleChartLegend(chartId, force = null) {
        return this.update('toggle-chart-legend', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            const next = force == null
                ? !chart.ui?.legendCollapsed
                : !!force;
            chart.ui = {
                ...chart.ui,
                legendCollapsed: next
            };
            return draft;
        });
    }

    setChartAxisXBinding(chartId, bindingPatch = {}) {
        return this.update('set-chart-axis-x-binding', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            chart.axis = {
                ...chart.axis,
                xBinding: normalizeChartBinding({
                    ...chart.axis?.xBinding,
                    ...bindingPatch
                }, chart.axis?.xBinding)
            };
            return draft;
        });
    }

    setChartRangeMode(chartId, axisKey, mode) {
        const axisMode = mode === 'manual' ? 'manual' : 'auto';
        const axisField = axisKey === 'x' ? 'xRangeMode' : 'yRangeMode';
        return this.update('set-chart-range-mode', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            chart.axis = {
                ...chart.axis,
                [axisField]: axisMode
            };
            if (axisMode !== 'manual') {
                if (axisKey === 'x') {
                    chart.axis.xMin = null;
                    chart.axis.xMax = null;
                } else {
                    chart.axis.yMin = null;
                    chart.axis.yMax = null;
                }
            }
            return draft;
        });
    }

    setChartRangeValue(chartId, axisKey, minValue, maxValue) {
        const minRaw = Number(minValue);
        const maxRaw = Number(maxValue);
        return this.update('set-chart-range-value', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            if (axisKey === 'x') {
                chart.axis.xMin = Number.isFinite(minRaw) ? minRaw : null;
                chart.axis.xMax = Number.isFinite(maxRaw) ? maxRaw : null;
                if (
                    chart.axis.xMin != null
                    && chart.axis.xMax != null
                    && chart.axis.xMin > chart.axis.xMax
                ) {
                    [chart.axis.xMin, chart.axis.xMax] = [chart.axis.xMax, chart.axis.xMin];
                }
            } else {
                chart.axis.yMin = Number.isFinite(minRaw) ? minRaw : null;
                chart.axis.yMax = Number.isFinite(maxRaw) ? maxRaw : null;
                if (
                    chart.axis.yMin != null
                    && chart.axis.yMax != null
                    && chart.axis.yMin > chart.axis.yMax
                ) {
                    [chart.axis.yMin, chart.axis.yMax] = [chart.axis.yMax, chart.axis.yMin];
                }
            }
            return draft;
        });
    }

    addSeries(chartId, options = {}) {
        const state = this.store.getState();
        const chart = findChart(state, chartId);
        if (!chart) return null;

        const series = createDefaultChartSeriesState({
            index: chart.series.length + 1,
            sourceId: options.sourceId,
            quantityId: options.quantityId,
            transformId: options.transformId,
            name: options.name,
            xMode: options.xMode,
            scatterXBinding: options.scatterXBinding,
            color: options.color || resolveNextSeriesColor(chart)
        });

        this.update('add-series', (draft) => {
            const draftChart = findChart(draft, chartId);
            if (!draftChart) return draft;
            draftChart.series.push(series);
            draft.selection.activeChartId = draftChart.id;
            draft.selection.activeSeriesId = series.id;
            return draft;
        });

        return series.id;
    }

    removeSeries(chartId, seriesId) {
        return this.update('remove-series', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            const index = chart.series.findIndex((series) => series.id === seriesId);
            if (index < 0) return draft;
            chart.series.splice(index, 1);
            if (draft.selection.activeSeriesId === seriesId) {
                draft.selection.activeSeriesId = chart.series[0]?.id || null;
            }
            draft.selection.activeChartId = chart.id;
            return draft;
        });
    }

    updateSeries(chartId, seriesId, patch = {}) {
        return this.update('update-series', (draft) => {
            const chart = findChart(draft, chartId);
            if (!chart) return draft;
            const series = chart.series.find((item) => item.id === seriesId);
            if (!series) return draft;

            if (typeof patch.name === 'string') {
                const nextName = patch.name.trim();
                if (nextName) series.name = nextName;
            }

            if (typeof patch.sourceId === 'string' && patch.sourceId.trim()) {
                series.sourceId = patch.sourceId.trim();
            }
            if (typeof patch.quantityId === 'string' && patch.quantityId.trim()) {
                series.quantityId = patch.quantityId.trim();
            }
            if (typeof patch.transformId === 'string') {
                series.transformId = patch.transformId;
            }
            if (typeof patch.visible === 'boolean') {
                series.visible = patch.visible;
            }
            if (typeof patch.color === 'string' && patch.color.trim()) {
                series.color = patch.color.trim();
            }
            if (typeof patch.xMode === 'string') {
                series.xMode = patch.xMode === 'scatter-override' ? 'scatter-override' : 'shared-x';
            }

            if (series.xMode === 'scatter-override') {
                series.scatterXBinding = normalizeChartBinding(
                    patch.scatterXBinding || series.scatterXBinding,
                    series.scatterXBinding || {
                        sourceId: TIME_SOURCE_ID,
                        quantityId: 't',
                        transformId: 'identity'
                    }
                );
            } else {
                series.scatterXBinding = null;
            }

            draft.selection.activeChartId = chart.id;
            draft.selection.activeSeriesId = series.id;
            return draft;
        });
    }

    normalizeDocument() {
        const state = normalizeChartWorkspaceState(this.store.getState());
        this.store.replace(state);
        this.emit('normalize-document', state);
        return state;
    }
}
