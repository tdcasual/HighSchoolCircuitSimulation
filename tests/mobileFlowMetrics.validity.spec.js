import { describe, expect, it } from 'vitest';
import {
    MobileFlowTaskIds,
    createMobileFlowMetricsCollector,
    summarizeMobileFlowMetrics
} from '../src/core/metrics/MobileFlowMetrics.js';

describe('mobile flow KPI validity tiers', () => {
    it('reports synthetic and behavior tiers separately', () => {
        const collector = createMobileFlowMetricsCollector();

        collector.recordTaskResult(MobileFlowTaskIds.SeriesBuild, {
            tapCount: 4,
            durationMs: 500,
            success: true
        });
        collector.recordTaskResult(MobileFlowTaskIds.ParallelBuild, {
            tapCount: 8,
            durationMs: 1000,
            success: false,
            destructiveCancel: true
        });
        collector.recordTaskResult(MobileFlowTaskIds.ProbeMeasurement, {
            tapCount: 12,
            durationMs: 2000,
            success: true
        });

        const summary = summarizeMobileFlowMetrics(collector.toJSON());

        expect(summary.synthetic).toMatchObject({
            averageTapCount: 8,
            successRate: 2 / 3
        });
        expect(summary.behavior).toMatchObject({
            medianDurationMs: 1000,
            p90DurationMs: 2000,
            destructiveCancelRate: 1 / 3
        });
    });
});
