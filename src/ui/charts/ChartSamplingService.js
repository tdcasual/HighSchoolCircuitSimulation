import { applyTransform } from '../observation/ObservationMath.js';
import { evaluateSourceQuantity } from '../observation/ObservationSources.js';

function getValueCacheKey(sourceId, quantityId) {
    return `${sourceId || ''}\u0000${quantityId || ''}`;
}

export class ChartSamplingService {
    evaluateBinding(circuit, binding, valueCache) {
        const sourceId = binding?.sourceId;
        const quantityId = binding?.quantityId;
        if (!sourceId || !quantityId) return null;

        if (valueCache instanceof Map) {
            const cacheKey = getValueCacheKey(sourceId, quantityId);
            if (valueCache.has(cacheKey)) {
                return valueCache.get(cacheKey);
            }
            const value = evaluateSourceQuantity(circuit, sourceId, quantityId);
            valueCache.set(cacheKey, value);
            return value;
        }

        return evaluateSourceQuantity(circuit, sourceId, quantityId);
    }

    resolveSeriesXBinding(chart, series) {
        if (series?.xMode === 'scatter-override' && series?.scatterXBinding) {
            return series.scatterXBinding;
        }
        return chart?.axis?.xBinding || null;
    }

    sampleCharts({
        circuit,
        charts,
        getSeriesBuffer
    } = {}) {
        if (!circuit || !Array.isArray(charts) || typeof getSeriesBuffer !== 'function') {
            return null;
        }

        const valueCache = new Map();
        const latestByChart = new Map();

        for (const chart of charts) {
            if (!chart || !Array.isArray(chart.series) || chart.series.length <= 0) continue;

            const latestSeries = [];
            for (const series of chart.series) {
                if (!series?.id) continue;

                const yRaw = this.evaluateBinding(circuit, {
                    sourceId: series.sourceId,
                    quantityId: series.quantityId
                }, valueCache);
                const y = applyTransform(yRaw, series.transformId);

                const xBinding = this.resolveSeriesXBinding(chart, series);
                const xRaw = this.evaluateBinding(circuit, xBinding, valueCache);
                const x = applyTransform(xRaw, xBinding?.transformId);

                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

                const buffer = getSeriesBuffer(chart.id, series.id, chart.maxPoints);
                if (!buffer || typeof buffer.push !== 'function') continue;
                buffer.push(x, y);
                latestSeries.push({
                    seriesId: series.id,
                    x,
                    y
                });
            }

            if (latestSeries.length > 0) {
                latestByChart.set(chart.id, latestSeries);
            }
        }

        return latestByChart;
    }
}
