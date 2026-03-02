import {
    DEFAULT_MAX_POINTS,
    DEFAULT_SAMPLE_INTERVAL_MS,
    MAX_MAX_POINTS,
    MIN_MAX_POINTS,
    normalizeAxisState,
    normalizeSampleIntervalMs
} from '../observation/ObservationState.js';
import { QuantityIds, TIME_SOURCE_ID } from '../observation/ObservationSources.js';

export const CHART_WORKSPACE_SCHEMA_VERSION = 1;

function createWindowId() {
    return `chart_window_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeRect(rawRect = {}, fallback = {}) {
    const parsedX = Number(rawRect?.x);
    const parsedY = Number(rawRect?.y);
    const parsedWidth = Number(rawRect?.width);
    const parsedHeight = Number(rawRect?.height);
    const x = Number.isFinite(parsedX) ? parsedX : (Number.isFinite(fallback.x) ? fallback.x : 48);
    const y = Number.isFinite(parsedY) ? parsedY : (Number.isFinite(fallback.y) ? fallback.y : 88);
    const widthBase = Number.isFinite(parsedWidth) ? parsedWidth : (Number.isFinite(fallback.width) ? fallback.width : 420);
    const heightBase = Number.isFinite(parsedHeight) ? parsedHeight : (Number.isFinite(fallback.height) ? fallback.height : 280);
    return {
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        width: Math.max(280, Math.round(widthBase)),
        height: Math.max(200, Math.round(heightBase))
    };
}

export function createDefaultChartWindowState(options = {}) {
    const normalizedIndex = Math.max(1, Math.floor(Number(options.index) || 1));
    return {
        id: createWindowId(),
        title: `图表 ${normalizedIndex}`,
        rect: normalizeRect(options.rect, {
            x: 48 + (normalizedIndex - 1) * 28,
            y: 88 + (normalizedIndex - 1) * 20,
            width: 420,
            height: 280
        }),
        zIndex: Math.max(1, normalizedIndex),
        maxPoints: DEFAULT_MAX_POINTS,
        series: {
            x: normalizeAxisState({
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                autoRange: true
            }),
            y: normalizeAxisState({
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                autoRange: true
            })
        },
        uiState: {
            collapsed: false
        }
    };
}

function normalizeWindow(windowRaw, index = 1) {
    const fallback = createDefaultChartWindowState({ index });
    const idText = typeof windowRaw?.id === 'string' ? windowRaw.id.trim() : '';
    const titleText = typeof windowRaw?.title === 'string' ? windowRaw.title.trim() : '';
    const z = Number(windowRaw?.zIndex);
    const maxPointsRaw = Number(windowRaw?.maxPoints);
    const maxPointsBase = Number.isFinite(maxPointsRaw) ? Math.floor(maxPointsRaw) : fallback.maxPoints;
    return {
        ...fallback,
        id: idText || fallback.id,
        title: titleText || fallback.title,
        rect: normalizeRect(windowRaw?.rect, fallback.rect),
        zIndex: Number.isFinite(z) ? Math.max(1, Math.floor(z)) : fallback.zIndex,
        maxPoints: Math.max(MIN_MAX_POINTS, Math.min(MAX_MAX_POINTS, maxPointsBase)),
        series: {
            x: normalizeAxisState(windowRaw?.series?.x, fallback.series.x),
            y: normalizeAxisState(windowRaw?.series?.y, fallback.series.y)
        },
        uiState: {
            collapsed: !!windowRaw?.uiState?.collapsed
        }
    };
}

export function normalizeChartWorkspaceState(rawState = {}) {
    const rawWindows = Array.isArray(rawState?.windows) ? rawState.windows : [];
    const windows = rawWindows.map((item, index) => normalizeWindow(item, index + 1));
    return {
        schemaVersion: CHART_WORKSPACE_SCHEMA_VERSION,
        sampleIntervalMs: normalizeSampleIntervalMs(rawState?.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS),
        windows
    };
}

export function serializeChartWorkspaceState(rawState = {}) {
    const normalized = normalizeChartWorkspaceState(rawState);
    return {
        schemaVersion: CHART_WORKSPACE_SCHEMA_VERSION,
        sampleIntervalMs: normalized.sampleIntervalMs,
        windows: normalized.windows.map((windowState) => ({
            id: windowState.id,
            title: windowState.title,
            rect: {
                x: windowState.rect.x,
                y: windowState.rect.y,
                width: windowState.rect.width,
                height: windowState.rect.height
            },
            zIndex: windowState.zIndex,
            maxPoints: windowState.maxPoints,
            series: {
                x: { ...windowState.series.x },
                y: { ...windowState.series.y }
            },
            uiState: {
                collapsed: !!windowState.uiState?.collapsed
            }
        }))
    };
}
