import { describe, expect, it } from 'vitest';
import {
    MobileFlowTaskIds,
    createMobileFlowMetricsCollector,
    summarizeMobileFlowMetrics
} from '../src/core/metrics/MobileFlowMetrics.js';

describe('mobile flow metrics collector', () => {
    it('collects tap counts and duration by task in stable order', () => {
        const collector = createMobileFlowMetricsCollector();

        collector.recordTaskResult(MobileFlowTaskIds.SeriesBuild, {
            tapCount: 6,
            durationMs: 980,
            success: true
        });
        collector.recordTaskResult(MobileFlowTaskIds.ProbeMeasurement, {
            tapCount: 8,
            durationMs: 1220,
            success: true
        });

        const report = collector.toJSON();

        expect(report.tasks.map((task) => task.id)).toEqual([
            MobileFlowTaskIds.SeriesBuild,
            MobileFlowTaskIds.ParallelBuild,
            MobileFlowTaskIds.ProbeMeasurement
        ]);
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.SeriesBuild)?.tapCount).toBe(6);
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.ParallelBuild)?.success).toBe(false);
    });

    it('builds summary with average taps and success rate', () => {
        const collector = createMobileFlowMetricsCollector();
        collector.recordTaskResult(MobileFlowTaskIds.SeriesBuild, { tapCount: 5, durationMs: 800, success: true });
        collector.recordTaskResult(MobileFlowTaskIds.ParallelBuild, { tapCount: 7, durationMs: 1200, success: true });
        collector.recordTaskResult(MobileFlowTaskIds.ProbeMeasurement, { tapCount: 9, durationMs: 1400, success: false });

        const summary = summarizeMobileFlowMetrics(collector.toJSON());

        expect(summary.averageTapCount).toBeCloseTo(7, 6);
        expect(summary.successRate).toBeCloseTo(2 / 3, 6);
        expect(summary.maxTapCount).toBe(9);
    });
});
