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
            interactionCount: 5,
            durationMs: 500,
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
        collector.recordTaskResult(MobileFlowTaskIds.ParallelBuild, {
            tapCount: 8,
            interactionCount: 9,
            durationMs: 1000,
            success: false,
            destructiveCancel: true,
            observationConfirmed: false,
            steps: [
                { id: 'place-power-source', completed: true },
                { id: 'place-resistor-a', completed: true },
                { id: 'place-resistor-b', completed: true },
                { id: 'wire-parallel-loop', completed: false },
                { id: 'run-simulation', completed: false }
            ]
        });
        collector.recordTaskResult(MobileFlowTaskIds.ProbeMeasurement, {
            tapCount: 12,
            interactionCount: 13,
            durationMs: 2000,
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
        expect(summary.taskKpi).toMatchObject({
            averageInteractionCount: 9,
            completionRate: 2 / 3,
            observationRate: 2 / 3,
            stepCompletionRate: 13 / 15
        });
    });
});
