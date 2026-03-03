import {
    computeNiceTicks,
    computeRangeFromBuffer,
    stabilizeAutoRangeWindow
} from '../observation/ObservationMath.js';

function normalizeRange(minValue, maxValue) {
    let min = Number(minValue);
    let max = Number(maxValue);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min > max) [min, max] = [max, min];
    if (min === max) {
        const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
        min -= pad;
        max += pad;
    }
    return { min, max };
}

function resolveAxisWindow(axisRangeMode, rawMin, rawMax, autoWindow) {
    if (axisRangeMode === 'manual') {
        const normalized = normalizeRange(rawMin, rawMax);
        return normalized || autoWindow || null;
    }
    return autoWindow;
}

function resolveSeriesForRange(chart) {
    if (!chart || !Array.isArray(chart.series)) return [];
    const visibleSeries = chart.series.filter((series) => series.visible !== false);
    if (visibleSeries.length > 0) return visibleSeries;
    return chart.series;
}

export class ChartProjectionService {
    aggregateRange(chart, seriesBuffers) {
        const candidates = resolveSeriesForRange(chart);
        if (candidates.length <= 0) return null;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let hasPoint = false;

        for (const series of candidates) {
            const buffer = seriesBuffers?.get?.(series.id);
            const range = computeRangeFromBuffer(buffer);
            if (!range) continue;
            minX = Math.min(minX, range.minX);
            maxX = Math.max(maxX, range.maxX);
            minY = Math.min(minY, range.minY);
            maxY = Math.max(maxY, range.maxY);
            hasPoint = true;
        }

        if (!hasPoint) return null;
        return { minX, maxX, minY, maxY };
    }

    computeFrame({
        chart,
        seriesBuffers,
        autoRangeWindow,
        width,
        height,
        dpr
    } = {}) {
        if (!chart || !seriesBuffers) return null;
        const canvasW = Math.max(1, Number(width) || 1);
        const canvasH = Math.max(1, Number(height) || 1);
        const pixelRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;

        const padL = 46 * pixelRatio;
        const padR = 12 * pixelRatio;
        const padT = 14 * pixelRatio;
        const padB = 28 * pixelRatio;
        const innerW = Math.max(1, canvasW - padL - padR);
        const innerH = Math.max(1, canvasH - padT - padB);

        const aggregate = this.aggregateRange(chart, seriesBuffers);
        if (!aggregate) return null;

        const prevWindow = autoRangeWindow && typeof autoRangeWindow === 'object'
            ? autoRangeWindow
            : { x: null, y: null };

        const nextAutoX = stabilizeAutoRangeWindow(
            { min: aggregate.minX, max: aggregate.maxX },
            prevWindow.x,
            {
                paddingRatio: 0.03,
                expandRatio: 0.02,
                shrinkDeadbandRatio: 0.14,
                shrinkSmoothing: 0.2
            }
        );
        const nextAutoY = stabilizeAutoRangeWindow(
            { min: aggregate.minY, max: aggregate.maxY },
            prevWindow.y,
            {
                paddingRatio: 0.05,
                expandRatio: 0.025,
                shrinkDeadbandRatio: 0.16,
                shrinkSmoothing: 0.2
            }
        );

        const xWindow = resolveAxisWindow(
            chart?.axis?.xRangeMode,
            chart?.axis?.xMin,
            chart?.axis?.xMax,
            nextAutoX
        );
        const yWindow = resolveAxisWindow(
            chart?.axis?.yRangeMode,
            chart?.axis?.yMin,
            chart?.axis?.yMax,
            nextAutoY
        );

        if (!xWindow || !yWindow) return null;

        const normalizedX = normalizeRange(xWindow.min, xWindow.max);
        const normalizedY = normalizeRange(yWindow.min, yWindow.max);
        if (!normalizedX || !normalizedY) return null;

        const xTicks = computeNiceTicks(normalizedX.min, normalizedX.max, 5);
        const yTicks = computeNiceTicks(normalizedY.min, normalizedY.max, 5);

        const xSpan = Math.max(1e-12, normalizedX.max - normalizedX.min);
        const ySpan = Math.max(1e-12, normalizedY.max - normalizedY.min);

        return {
            w: canvasW,
            h: canvasH,
            dpr: pixelRatio,
            padL,
            padR,
            padT,
            padB,
            innerW,
            innerH,
            xMin: normalizedX.min,
            xMax: normalizedX.max,
            yMin: normalizedY.min,
            yMax: normalizedY.max,
            xTicks,
            yTicks,
            xToPx: (xValue) => padL + ((xValue - normalizedX.min) / xSpan) * innerW,
            yToPx: (yValue) => padT + (1 - (yValue - normalizedY.min) / ySpan) * innerH,
            nextAutoRangeWindow: {
                x: nextAutoX,
                y: nextAutoY
            }
        };
    }
}
