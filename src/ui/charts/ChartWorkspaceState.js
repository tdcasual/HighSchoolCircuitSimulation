import {
    DEFAULT_MAX_POINTS,
    DEFAULT_SAMPLE_INTERVAL_MS,
    MAX_MAX_POINTS,
    MIN_MAX_POINTS,
    normalizeSampleIntervalMs
} from '../observation/ObservationState.js';
import { TransformIds } from '../observation/ObservationMath.js';
import { QuantityIds, TIME_SOURCE_ID } from '../observation/ObservationSources.js';

export const CHART_WORKSPACE_SCHEMA_VERSION = 2;

export const SERIES_COLOR_PALETTE = Object.freeze([
    '#1d4ed8',
    '#dc2626',
    '#059669',
    '#ea580c',
    '#7c3aed',
    '#0891b2',
    '#0f766e',
    '#ca8a04'
]);

const VALID_TRANSFORM_IDS = new Set(Object.values(TransformIds));
const VALID_X_MODES = new Set(['shared-x', 'scatter-override']);

let chartIdCounter = 1;
let seriesIdCounter = 1;

function createChartId() {
    const stamp = Date.now();
    const id = `chart_${stamp}_${chartIdCounter}`;
    chartIdCounter += 1;
    return id;
}

function createSeriesId() {
    const stamp = Date.now();
    const id = `series_${stamp}_${seriesIdCounter}`;
    seriesIdCounter += 1;
    return id;
}

function clampMaxPoints(value, fallback = DEFAULT_MAX_POINTS) {
    const parsed = Number(value);
    const base = Number.isFinite(parsed) ? Math.floor(parsed) : Math.floor(Number(fallback) || DEFAULT_MAX_POINTS);
    return Math.max(MIN_MAX_POINTS, Math.min(MAX_MAX_POINTS, base));
}

function normalizeFrame(rawFrame = {}, fallback = {}) {
    const parsedX = Number(rawFrame?.x);
    const parsedY = Number(rawFrame?.y);
    const parsedWidth = Number(rawFrame?.width);
    const parsedHeight = Number(rawFrame?.height);

    const x = Number.isFinite(parsedX) ? parsedX : (Number.isFinite(fallback?.x) ? fallback.x : 48);
    const y = Number.isFinite(parsedY) ? parsedY : (Number.isFinite(fallback?.y) ? fallback.y : 88);
    const width = Number.isFinite(parsedWidth) ? parsedWidth : (Number.isFinite(fallback?.width) ? fallback.width : 460);
    const height = Number.isFinite(parsedHeight) ? parsedHeight : (Number.isFinite(fallback?.height) ? fallback.height : 320);

    return {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        width: Math.max(280, Math.round(width)),
        height: Math.max(200, Math.round(height))
    };
}

export function normalizeChartBinding(rawBinding = {}, fallback = {}) {
    const sourceIdRaw = typeof rawBinding?.sourceId === 'string' ? rawBinding.sourceId.trim() : '';
    const quantityIdRaw = typeof rawBinding?.quantityId === 'string' ? rawBinding.quantityId.trim() : '';
    const transformRaw = rawBinding?.transformId;

    const sourceId = sourceIdRaw || fallback.sourceId || TIME_SOURCE_ID;
    const quantityId = quantityIdRaw || fallback.quantityId || QuantityIds.Time;
    const transformId = VALID_TRANSFORM_IDS.has(transformRaw)
        ? transformRaw
        : (fallback.transformId || TransformIds.Identity);

    return {
        sourceId,
        quantityId,
        transformId
    };
}

function normalizeAxisRangeMode(value, fallback = 'auto') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'manual') return 'manual';
    return fallback === 'manual' ? 'manual' : 'auto';
}

function normalizeOptionalNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function createDefaultChartSeriesState(options = {}) {
    const index = Math.max(1, Math.floor(Number(options.index) || 1));
    const colorFromPalette = SERIES_COLOR_PALETTE[(index - 1) % SERIES_COLOR_PALETTE.length];
    const sourceId = typeof options.sourceId === 'string' && options.sourceId.trim()
        ? options.sourceId.trim()
        : TIME_SOURCE_ID;
    const quantityId = typeof options.quantityId === 'string' && options.quantityId.trim()
        ? options.quantityId.trim()
        : QuantityIds.Time;

    return {
        id: createSeriesId(),
        name: typeof options.name === 'string' && options.name.trim()
            ? options.name.trim()
            : `系列 ${index}`,
        sourceId,
        quantityId,
        transformId: VALID_TRANSFORM_IDS.has(options.transformId)
            ? options.transformId
            : TransformIds.Identity,
        visible: options.visible !== false,
        color: typeof options.color === 'string' && options.color.trim()
            ? options.color.trim()
            : colorFromPalette,
        xMode: VALID_X_MODES.has(options.xMode) ? options.xMode : 'shared-x',
        scatterXBinding: options.xMode === 'scatter-override'
            ? normalizeChartBinding(options.scatterXBinding, {
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                transformId: TransformIds.Identity
            })
            : null
    };
}

function normalizeSeries(rawSeries, index = 1) {
    const fallback = createDefaultChartSeriesState({ index });
    const idText = typeof rawSeries?.id === 'string' ? rawSeries.id.trim() : '';
    const xMode = VALID_X_MODES.has(rawSeries?.xMode) ? rawSeries.xMode : fallback.xMode;

    return {
        ...fallback,
        id: idText || fallback.id,
        name: typeof rawSeries?.name === 'string' && rawSeries.name.trim()
            ? rawSeries.name.trim()
            : fallback.name,
        sourceId: typeof rawSeries?.sourceId === 'string' && rawSeries.sourceId.trim()
            ? rawSeries.sourceId.trim()
            : fallback.sourceId,
        quantityId: typeof rawSeries?.quantityId === 'string' && rawSeries.quantityId.trim()
            ? rawSeries.quantityId.trim()
            : fallback.quantityId,
        transformId: VALID_TRANSFORM_IDS.has(rawSeries?.transformId)
            ? rawSeries.transformId
            : fallback.transformId,
        visible: rawSeries?.visible !== false,
        color: typeof rawSeries?.color === 'string' && rawSeries.color.trim()
            ? rawSeries.color.trim()
            : fallback.color,
        xMode,
        scatterXBinding: xMode === 'scatter-override'
            ? normalizeChartBinding(rawSeries?.scatterXBinding, {
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                transformId: TransformIds.Identity
            })
            : null
    };
}

export function createDefaultChartState(options = {}) {
    const index = Math.max(1, Math.floor(Number(options.index) || 1));
    const fallbackX = 48 + (index - 1) * 24;
    const fallbackY = 88 + (index - 1) * 18;
    const frame = normalizeFrame(options.frame, {
        x: fallbackX,
        y: fallbackY,
        width: 460,
        height: 320
    });

    return {
        id: createChartId(),
        title: typeof options.title === 'string' && options.title.trim()
            ? options.title.trim()
            : `图表 ${index}`,
        frame,
        zIndex: Math.max(1, Math.floor(Number(options.zIndex) || index)),
        maxPoints: clampMaxPoints(options.maxPoints, DEFAULT_MAX_POINTS),
        axis: {
            xBinding: normalizeChartBinding(options.axis?.xBinding, {
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                transformId: TransformIds.Identity
            }),
            xRangeMode: normalizeAxisRangeMode(options.axis?.xRangeMode, 'auto'),
            yRangeMode: normalizeAxisRangeMode(options.axis?.yRangeMode, 'auto'),
            xMin: normalizeOptionalNumber(options.axis?.xMin),
            xMax: normalizeOptionalNumber(options.axis?.xMax),
            yMin: normalizeOptionalNumber(options.axis?.yMin),
            yMax: normalizeOptionalNumber(options.axis?.yMax)
        },
        series: Array.isArray(options.series)
            ? options.series.map((series, seriesIndex) => normalizeSeries(series, seriesIndex + 1))
            : [],
        ui: {
            axisCollapsed: !!options.ui?.axisCollapsed,
            legendCollapsed: !!options.ui?.legendCollapsed
        }
    };
}

export function createDefaultChartWorkspaceState(options = {}) {
    const sampleIntervalMs = normalizeSampleIntervalMs(options.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS);
    return {
        schemaVersion: CHART_WORKSPACE_SCHEMA_VERSION,
        sampleIntervalMs,
        selection: {
            activeChartId: null,
            activeSeriesId: null
        },
        charts: []
    };
}

function normalizeChart(rawChart, index = 1) {
    const fallback = createDefaultChartState({ index });
    const idText = typeof rawChart?.id === 'string' ? rawChart.id.trim() : '';
    const titleText = typeof rawChart?.title === 'string' ? rawChart.title.trim() : '';
    const zRaw = Number(rawChart?.zIndex);

    const seriesRaw = Array.isArray(rawChart?.series) ? rawChart.series : [];
    const series = seriesRaw.map((item, seriesIndex) => normalizeSeries(item, seriesIndex + 1));

    const axisFallback = fallback.axis;
    const axisRaw = rawChart?.axis || {};
    const xRangeMode = normalizeAxisRangeMode(axisRaw?.xRangeMode, axisFallback.xRangeMode);
    const yRangeMode = normalizeAxisRangeMode(axisRaw?.yRangeMode, axisFallback.yRangeMode);

    let xMin = normalizeOptionalNumber(axisRaw?.xMin);
    let xMax = normalizeOptionalNumber(axisRaw?.xMax);
    let yMin = normalizeOptionalNumber(axisRaw?.yMin);
    let yMax = normalizeOptionalNumber(axisRaw?.yMax);

    if (xRangeMode !== 'manual') {
        xMin = null;
        xMax = null;
    }
    if (yRangeMode !== 'manual') {
        yMin = null;
        yMax = null;
    }

    if (xMin != null && xMax != null && xMin > xMax) {
        [xMin, xMax] = [xMax, xMin];
    }
    if (yMin != null && yMax != null && yMin > yMax) {
        [yMin, yMax] = [yMax, yMin];
    }

    return {
        ...fallback,
        id: idText || fallback.id,
        title: titleText || fallback.title,
        frame: normalizeFrame(rawChart?.frame, fallback.frame),
        zIndex: Number.isFinite(zRaw) ? Math.max(1, Math.floor(zRaw)) : fallback.zIndex,
        maxPoints: clampMaxPoints(rawChart?.maxPoints, fallback.maxPoints),
        axis: {
            xBinding: normalizeChartBinding(axisRaw?.xBinding, axisFallback.xBinding),
            xRangeMode,
            yRangeMode,
            xMin,
            xMax,
            yMin,
            yMax
        },
        series,
        ui: {
            axisCollapsed: !!rawChart?.ui?.axisCollapsed,
            legendCollapsed: !!rawChart?.ui?.legendCollapsed
        }
    };
}

function normalizeSelection(rawSelection, charts = []) {
    const activeChartRaw = typeof rawSelection?.activeChartId === 'string'
        ? rawSelection.activeChartId.trim()
        : '';
    const activeChartId = activeChartRaw && charts.some((chart) => chart.id === activeChartRaw)
        ? activeChartRaw
        : null;

    const selectedChart = activeChartId
        ? charts.find((chart) => chart.id === activeChartId)
        : null;

    const activeSeriesRaw = typeof rawSelection?.activeSeriesId === 'string'
        ? rawSelection.activeSeriesId.trim()
        : '';
    const activeSeriesId = activeSeriesRaw
        && selectedChart
        && selectedChart.series.some((series) => series.id === activeSeriesRaw)
        ? activeSeriesRaw
        : null;

    return {
        activeChartId,
        activeSeriesId
    };
}

export function migrateChartWorkspaceStateV1ToV2(rawState = {}) {
    const rawWindows = Array.isArray(rawState?.windows) ? rawState.windows : [];
    const charts = rawWindows.map((windowState, index) => {
        const fallback = createDefaultChartState({ index: index + 1 });
        const xBinding = normalizeChartBinding(windowState?.series?.x, fallback.axis.xBinding);

        const series = [];
        const yRaw = windowState?.series?.y;
        if (yRaw && typeof yRaw === 'object') {
            const migratedSeries = createDefaultChartSeriesState({
                index: 1,
                sourceId: typeof yRaw.sourceId === 'string' ? yRaw.sourceId : TIME_SOURCE_ID,
                quantityId: typeof yRaw.quantityId === 'string' ? yRaw.quantityId : QuantityIds.Time,
                transformId: yRaw.transformId,
                name: '系列 1'
            });
            series.push(migratedSeries);
        }

        const chart = createDefaultChartState({
            index: index + 1,
            title: windowState?.title,
            frame: windowState?.rect,
            zIndex: windowState?.zIndex,
            maxPoints: windowState?.maxPoints,
            axis: {
                xBinding,
                xRangeMode: 'auto',
                yRangeMode: 'auto'
            },
            series,
            ui: {
                axisCollapsed: false,
                legendCollapsed: !!windowState?.uiState?.collapsed
            }
        });

        return chart;
    });

    charts.sort((a, b) => a.zIndex - b.zIndex);

    return {
        schemaVersion: CHART_WORKSPACE_SCHEMA_VERSION,
        sampleIntervalMs: normalizeSampleIntervalMs(rawState?.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS),
        selection: {
            activeChartId: charts[0]?.id || null,
            activeSeriesId: charts[0]?.series?.[0]?.id || null
        },
        charts
    };
}

export function normalizeChartWorkspaceState(rawState = {}) {
    const looksLikeV1 = Array.isArray(rawState?.windows) || Number(rawState?.schemaVersion) === 1;
    if (looksLikeV1) {
        return normalizeChartWorkspaceState(migrateChartWorkspaceStateV1ToV2(rawState));
    }

    const base = createDefaultChartWorkspaceState(rawState);
    const chartsRaw = Array.isArray(rawState?.charts) ? rawState.charts : [];
    const charts = chartsRaw.map((item, index) => normalizeChart(item, index + 1));

    const dedupedCharts = [];
    const seenChartIds = new Set();
    for (const chart of charts) {
        if (!chart?.id || seenChartIds.has(chart.id)) continue;
        seenChartIds.add(chart.id);

        const seenSeriesIds = new Set();
        chart.series = chart.series.filter((series) => {
            if (!series?.id || seenSeriesIds.has(series.id)) return false;
            seenSeriesIds.add(series.id);
            return true;
        });

        dedupedCharts.push(chart);
    }

    dedupedCharts.sort((a, b) => a.zIndex - b.zIndex);
    dedupedCharts.forEach((chart, index) => {
        if (!Number.isFinite(chart.zIndex) || chart.zIndex < 1) {
            chart.zIndex = index + 1;
        }
    });

    const selection = normalizeSelection(rawState?.selection, dedupedCharts);

    return {
        ...base,
        schemaVersion: CHART_WORKSPACE_SCHEMA_VERSION,
        sampleIntervalMs: normalizeSampleIntervalMs(rawState?.sampleIntervalMs, base.sampleIntervalMs),
        selection,
        charts: dedupedCharts
    };
}

export function serializeChartWorkspaceState(rawState = {}) {
    const normalized = normalizeChartWorkspaceState(rawState);
    return {
        schemaVersion: CHART_WORKSPACE_SCHEMA_VERSION,
        sampleIntervalMs: normalized.sampleIntervalMs,
        selection: {
            activeChartId: normalized.selection.activeChartId,
            activeSeriesId: normalized.selection.activeSeriesId
        },
        charts: normalized.charts.map((chart) => ({
            id: chart.id,
            title: chart.title,
            frame: {
                x: chart.frame.x,
                y: chart.frame.y,
                width: chart.frame.width,
                height: chart.frame.height
            },
            zIndex: chart.zIndex,
            maxPoints: chart.maxPoints,
            axis: {
                xBinding: { ...chart.axis.xBinding },
                xRangeMode: chart.axis.xRangeMode,
                yRangeMode: chart.axis.yRangeMode,
                xMin: chart.axis.xRangeMode === 'manual' ? chart.axis.xMin : null,
                xMax: chart.axis.xRangeMode === 'manual' ? chart.axis.xMax : null,
                yMin: chart.axis.yRangeMode === 'manual' ? chart.axis.yMin : null,
                yMax: chart.axis.yRangeMode === 'manual' ? chart.axis.yMax : null
            },
            series: chart.series.map((series) => ({
                id: series.id,
                name: series.name,
                sourceId: series.sourceId,
                quantityId: series.quantityId,
                transformId: series.transformId,
                visible: !!series.visible,
                color: series.color,
                xMode: series.xMode,
                scatterXBinding: series.xMode === 'scatter-override' && series.scatterXBinding
                    ? { ...series.scatterXBinding }
                    : null
            })),
            ui: {
                axisCollapsed: !!chart.ui?.axisCollapsed,
                legendCollapsed: !!chart.ui?.legendCollapsed
            }
        }))
    };
}

// Backward-export alias for older tests/import sites.
export function createDefaultChartWindowState(options = {}) {
    return createDefaultChartState(options);
}
