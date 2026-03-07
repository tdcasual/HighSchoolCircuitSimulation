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
            interactionCount: 7,
            durationMs: 980,
            success: true,
            observationConfirmed: true,
            steps: [
                { id: 'place-power-source', completed: true },
                { id: 'place-resistor', completed: true },
                { id: 'wire-series-loop', completed: true },
                { id: 'run-simulation', completed: true },
                { id: 'observe-readout', completed: true }
            ]
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
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.SeriesBuild)?.interactionCount).toBe(7);
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.SeriesBuild)?.completedStepCount).toBe(5);
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.SeriesBuild)?.requiredStepCount).toBe(5);
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.SeriesBuild)?.observationConfirmed).toBe(true);
        expect(report.tasks.find((task) => task.id === MobileFlowTaskIds.ParallelBuild)?.success).toBe(false);
    });

    it('builds summary with average taps and success rate', () => {
        const collector = createMobileFlowMetricsCollector();
        collector.recordTaskResult(MobileFlowTaskIds.SeriesBuild, { tapCount: 5, interactionCount: 6, durationMs: 800, success: true, observationConfirmed: true, steps: [
            { id: 'place-power-source', completed: true },
            { id: 'place-resistor', completed: true },
            { id: 'wire-series-loop', completed: true },
            { id: 'run-simulation', completed: true },
            { id: 'observe-readout', completed: true }
        ] });
        collector.recordTaskResult(MobileFlowTaskIds.ParallelBuild, { tapCount: 7, interactionCount: 8, durationMs: 1200, success: true, observationConfirmed: false, steps: [
            { id: 'place-power-source', completed: true },
            { id: 'place-resistor-a', completed: true },
            { id: 'place-resistor-b', completed: true },
            { id: 'wire-parallel-loop', completed: true },
            { id: 'run-simulation', completed: true }
        ] });
        collector.recordTaskResult(MobileFlowTaskIds.ProbeMeasurement, { tapCount: 9, interactionCount: 10, durationMs: 1400, success: false, observationConfirmed: true, steps: [
            { id: 'place-power-source', completed: true },
            { id: 'place-resistor', completed: true },
            { id: 'wire-series-loop', completed: true },
            { id: 'run-simulation', completed: false },
            { id: 'observe-readout', completed: false }
        ] });

        const summary = summarizeMobileFlowMetrics(collector.toJSON());

        expect(summary.averageTapCount).toBeCloseTo(7, 6);
        expect(summary.successRate).toBeCloseTo(2 / 3, 6);
        expect(summary.maxTapCount).toBe(9);
        expect(summary.taskKpi).toMatchObject({
            averageInteractionCount: 8,
            completionRate: 2 / 3,
            observationRate: 2 / 3,
            stepCompletionRate: 13 / 15
        });
    });
});
