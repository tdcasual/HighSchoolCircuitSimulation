import { TransformIds } from './ObservationMath.js';
import { QuantityIds, TIME_SOURCE_ID } from './ObservationSources.js';
import { normalizeObservationUI } from './ObservationPreferences.js';

export const DEFAULT_SAMPLE_INTERVAL_MS = 50;
export const MIN_SAMPLE_INTERVAL_MS = 0;
export const MAX_SAMPLE_INTERVAL_MS = 5000;
export const DEFAULT_MAX_POINTS = 3000;
export const MIN_MAX_POINTS = 100;
export const MAX_MAX_POINTS = 200000;
export const OBSERVATION_TEMPLATE_SCHEMA_VERSION = 1;
export const DEFAULT_OBSERVATION_TEMPLATE_NAME = '未命名模板';

const VALID_TRANSFORM_IDS = new Set(Object.values(TransformIds));
export const ObservationDisplayModes = /** @type {const} */ ({
    Signed: 'signed',
    Magnitude: 'magnitude'
});
const VALID_DISPLAY_MODES = new Set(Object.values(ObservationDisplayModes));

function toFiniteOrNull(value) {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeTemplateName(rawName, fallbackName = DEFAULT_OBSERVATION_TEMPLATE_NAME) {
    const candidate = typeof rawName === 'string' ? rawName.trim() : '';
    const fallback = typeof fallbackName === 'string' && fallbackName.trim()
        ? fallbackName.trim()
        : DEFAULT_OBSERVATION_TEMPLATE_NAME;
    return candidate || fallback;
}

function resolveTemplateName(rawTemplate = {}, fallbackName = DEFAULT_OBSERVATION_TEMPLATE_NAME) {
    const candidates = [
        rawTemplate?.name
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return normalizeTemplateName(candidate, fallbackName);
        }
    }
    return normalizeTemplateName('', fallbackName);
}

export function normalizeSampleIntervalMs(value, fallback = DEFAULT_SAMPLE_INTERVAL_MS) {
    const fallbackNum = Number.isFinite(Number(fallback)) ? Number(fallback) : DEFAULT_SAMPLE_INTERVAL_MS;
    const parsed = Number(value);
    const base = Number.isFinite(parsed) ? parsed : fallbackNum;
    const rounded = Math.round(base);
    return Math.max(MIN_SAMPLE_INTERVAL_MS, Math.min(MAX_SAMPLE_INTERVAL_MS, rounded));
}

export function createDefaultAxisState(options = {}) {
    return {
        sourceId: options.sourceId ?? TIME_SOURCE_ID,
        quantityId: options.quantityId ?? QuantityIds.Time,
        transformId: options.transformId ?? TransformIds.Identity,
        autoRange: options.autoRange !== false,
        min: options.autoRange === false ? toFiniteOrNull(options.min) : null,
        max: options.autoRange === false ? toFiniteOrNull(options.max) : null
    };
}

export function createDefaultPlotState(index = 1, defaultYSourceId = TIME_SOURCE_ID) {
    const ySourceId = defaultYSourceId ?? TIME_SOURCE_ID;
    const yQuantityId = ySourceId === TIME_SOURCE_ID ? QuantityIds.Time : QuantityIds.Current;
    return {
        name: `图像 ${Math.max(1, Math.floor(Number(index) || 1))}`,
        maxPoints: DEFAULT_MAX_POINTS,
        yDisplayMode: ObservationDisplayModes.Signed,
        x: createDefaultAxisState({
            sourceId: TIME_SOURCE_ID,
            quantityId: QuantityIds.Time,
            transformId: TransformIds.Identity,
            autoRange: true
        }),
        y: createDefaultAxisState({
            sourceId: ySourceId,
            quantityId: yQuantityId,
            transformId: TransformIds.Identity,
            autoRange: true
        })
    };
}

export function normalizeAxisState(axisRaw, fallbackAxis) {
    const fallback = fallbackAxis || createDefaultAxisState();
    const sourceId = typeof axisRaw?.sourceId === 'string' && axisRaw.sourceId
        ? axisRaw.sourceId
        : fallback.sourceId;
    const quantityId = typeof axisRaw?.quantityId === 'string' && axisRaw.quantityId
        ? axisRaw.quantityId
        : fallback.quantityId;
    const transformRaw = axisRaw?.transformId;
    const transformId = VALID_TRANSFORM_IDS.has(transformRaw)
        ? transformRaw
        : fallback.transformId;

    const autoRange = typeof axisRaw?.autoRange === 'boolean'
        ? axisRaw.autoRange
        : !!fallback.autoRange;

    let min = toFiniteOrNull(axisRaw?.min);
    let max = toFiniteOrNull(axisRaw?.max);
    if (autoRange) {
        min = null;
        max = null;
    } else if (min != null && max != null && min > max) {
        [min, max] = [max, min];
    }

    return {
        sourceId,
        quantityId,
        transformId,
        autoRange,
        min,
        max
    };
}

export function normalizePlotState(plotRaw, fallbackPlot) {
    const fallback = fallbackPlot || createDefaultPlotState(1, TIME_SOURCE_ID);
    const nameRaw = typeof plotRaw?.name === 'string' ? plotRaw.name.trim() : '';
    const name = nameRaw || fallback.name;
    const maxPointsRaw = Number(plotRaw?.maxPoints);
    const maxPointsBase = Number.isFinite(maxPointsRaw) ? Math.floor(maxPointsRaw) : fallback.maxPoints;
    const maxPoints = Math.max(MIN_MAX_POINTS, Math.min(MAX_MAX_POINTS, maxPointsBase));
    const yDisplayModeRaw = plotRaw?.yDisplayMode;
    const yDisplayMode = VALID_DISPLAY_MODES.has(yDisplayModeRaw)
        ? yDisplayModeRaw
        : (fallback.yDisplayMode || ObservationDisplayModes.Signed);

    return {
        name,
        maxPoints,
        yDisplayMode,
        x: normalizeAxisState(plotRaw?.x, fallback.x),
        y: normalizeAxisState(plotRaw?.y, fallback.y)
    };
}

export function normalizeObservationState(rawState, options = {}) {
    const defaultYSourceId = options.defaultYSourceId ?? TIME_SOURCE_ID;
    const normalizedDefaultPlotCount = Math.floor(Number(options.defaultPlotCount));
    const defaultPlotCount = Math.max(1, Number.isFinite(normalizedDefaultPlotCount) ? normalizedDefaultPlotCount : 1);
    const hasExplicitPlots = Array.isArray(rawState?.plots);
    const minPlotCount = options.allowEmptyPlots && hasExplicitPlots ? 0 : defaultPlotCount;
    const sampleIntervalMs = normalizeSampleIntervalMs(rawState?.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS);

    const rawPlots = Array.isArray(rawState?.plots) ? rawState.plots : [];
    const plots = rawPlots.map((rawPlot, index) => {
        const fallbackPlot = createDefaultPlotState(index + 1, defaultYSourceId);
        return normalizePlotState(rawPlot, fallbackPlot);
    });

    while (plots.length < minPlotCount) {
        plots.push(createDefaultPlotState(plots.length + 1, defaultYSourceId));
    }

    return {
        sampleIntervalMs,
        plots,
        ui: normalizeObservationUI(rawState?.ui)
    };
}

export function normalizeObservationTemplateBindings(rawBindings) {
    if (!Array.isArray(rawBindings)) return [];
    const normalized = [];

    for (const item of rawBindings) {
        if (!item || typeof item !== 'object') continue;
        const indexRaw = Number(item.plotIndex);
        const plotIndex = Number.isFinite(indexRaw) ? Math.floor(indexRaw) : -1;
        if (plotIndex < 0) continue;

        const axisRaw = String(item.axis ?? '').trim().toLowerCase();
        const axis = axisRaw === 'x' ? 'x' : axisRaw === 'y' ? 'y' : '';
        if (!axis) continue;

        const sourceIdRaw = typeof item.sourceId === 'string' ? item.sourceId : '';
        const sourceId = sourceIdRaw.trim();
        if (!sourceId) continue;

        const quantityRaw = typeof item.quantityId === 'string' ? item.quantityId : '';
        const quantityId = quantityRaw.trim();

        normalized.push({
            plotIndex,
            axis,
            sourceId,
            ...(quantityId ? { quantityId } : {})
        });
    }

    return normalized;
}

export function normalizeObservationTemplate(rawTemplate, options = {}) {
    const template = rawTemplate && typeof rawTemplate === 'object' ? rawTemplate : {};
    const fallbackName = options.defaultName || DEFAULT_OBSERVATION_TEMPLATE_NAME;
    const defaultYSourceId = options.defaultYSourceId ?? TIME_SOURCE_ID;
    const defaultPlotCountRaw = Number(options.defaultPlotCount);
    const defaultPlotCount = Number.isFinite(defaultPlotCountRaw) ? Math.max(1, Math.floor(defaultPlotCountRaw)) : 1;
    const allowEmptyPlots = options.allowEmptyPlots !== false;

    const normalizedState = normalizeObservationState({
        sampleIntervalMs: template?.sampleIntervalMs,
        plots: template?.plots,
        ui: template?.ui
    }, {
        defaultYSourceId,
        defaultPlotCount,
        allowEmptyPlots
    });

    const bindingsRaw = template?.bindings;

    return {
        schemaVersion: OBSERVATION_TEMPLATE_SCHEMA_VERSION,
        name: resolveTemplateName(template, fallbackName),
        plots: normalizedState.plots,
        ui: normalizedState.ui,
        bindings: normalizeObservationTemplateBindings(bindingsRaw)
    };
}

export function shouldSampleAtTime(currentTimeSec, lastSampleTimeSec, sampleIntervalMs) {
    if (!Number.isFinite(currentTimeSec)) return false;
    if (!Number.isFinite(lastSampleTimeSec)) return true;

    const intervalSec = normalizeSampleIntervalMs(sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS) / 1000;
    if (intervalSec <= 0) return true;

    const eps = 1e-12;
    return currentTimeSec + eps >= lastSampleTimeSec + intervalSec;
}
