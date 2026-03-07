import { summarizeInteractionTelemetry } from './InteractionTelemetry.js';

export const MobileFlowTaskIds = Object.freeze({
    SeriesBuild: 'series-build',
    ParallelBuild: 'parallel-build',
    ProbeMeasurement: 'probe-measurement'
});

const OrderedTaskIds = Object.freeze([
    MobileFlowTaskIds.SeriesBuild,
    MobileFlowTaskIds.ParallelBuild,
    MobileFlowTaskIds.ProbeMeasurement
]);

function normalizeStep(step = {}, index = 0) {
    const fallbackId = `step-${index + 1}`;
    const stepId = typeof step?.id === 'string' && step.id.trim() ? step.id.trim() : fallbackId;
    return {
        id: stepId,
        completed: !!step?.completed,
        note: typeof step?.note === 'string' ? step.note : ''
    };
}

function normalizeTaskResult(taskId, result = {}) {
    const steps = Array.isArray(result.steps)
        ? result.steps.map((step, index) => normalizeStep(step, index))
        : [];
    const inferredRequiredStepCount = steps.length;
    const inferredCompletedStepCount = steps.reduce((count, step) => count + (step.completed ? 1 : 0), 0);
    const explicitRequiredStepCount = Math.max(0, Math.round(Number(result.requiredStepCount) || 0));
    const explicitCompletedStepCount = Math.max(0, Math.round(Number(result.completedStepCount) || 0));
    const requiredStepCount = Math.max(explicitRequiredStepCount, inferredRequiredStepCount);
    const completedStepCount = Math.min(
        requiredStepCount,
        explicitCompletedStepCount > 0 || inferredCompletedStepCount === 0
            ? Math.max(explicitCompletedStepCount, inferredCompletedStepCount)
            : inferredCompletedStepCount
    );
    const tapCount = Math.max(0, Math.round(Number(result.tapCount) || 0));
    const interactionCount = Math.max(0, Math.round(Number(result.interactionCount) || tapCount));

    return {
        id: taskId,
        tapCount,
        interactionCount,
        durationMs: Math.max(0, Math.round(Number(result.durationMs) || 0)),
        success: !!result.success,
        destructiveCancel: !!result.destructiveCancel,
        observationConfirmed: !!result.observationConfirmed,
        requiredStepCount,
        completedStepCount,
        steps,
        note: typeof result.note === 'string' ? result.note : ''
    };
}

export function createMobileFlowMetricsCollector() {
    const taskMap = new Map(
        OrderedTaskIds.map((taskId) => [taskId, normalizeTaskResult(taskId, { success: false })])
    );

    return {
        recordTaskResult(taskId, result = {}) {
            if (!OrderedTaskIds.includes(taskId)) {
                return false;
            }
            taskMap.set(taskId, normalizeTaskResult(taskId, result));
            return true;
        },
        toJSON() {
            return {
                generatedAt: new Date().toISOString(),
                tasks: OrderedTaskIds.map((taskId) => ({ ...taskMap.get(taskId) }))
            };
        }
    };
}

export function summarizeMobileFlowMetrics(report = {}) {
    const tasks = Array.isArray(report.tasks) ? report.tasks : [];
    const emptySynthetic = {
        averageTapCount: 0,
        successRate: 0,
        maxTapCount: 0,
        totalDurationMs: 0
    };
    const emptyTaskKpi = {
        averageInteractionCount: 0,
        completionRate: 0,
        observationRate: 0,
        stepCompletionRate: 0
    };

    if (tasks.length === 0) {
        const behavior = summarizeInteractionTelemetry(tasks);
        return {
            synthetic: emptySynthetic,
            behavior,
            taskKpi: emptyTaskKpi,
            ...emptySynthetic
        };
    }

    const totalTapCount = tasks.reduce((sum, task) => sum + (Number(task.tapCount) || 0), 0);
    const successCount = tasks.reduce((sum, task) => sum + (task.success ? 1 : 0), 0);
    const maxTapCount = tasks.reduce((max, task) => Math.max(max, Number(task.tapCount) || 0), 0);
    const totalDurationMs = tasks.reduce((sum, task) => sum + (Number(task.durationMs) || 0), 0);
    const totalInteractionCount = tasks.reduce((sum, task) => sum + (Number(task.interactionCount) || 0), 0);
    const completionCount = tasks.reduce((sum, task) => {
        const required = Math.max(0, Number(task.requiredStepCount) || 0);
        const completed = Math.max(0, Number(task.completedStepCount) || 0);
        const complete = task.success && (required === 0 || completed >= required);
        return sum + (complete ? 1 : 0);
    }, 0);
    const observationCount = tasks.reduce((sum, task) => sum + (task.observationConfirmed ? 1 : 0), 0);
    const totalRequiredStepCount = tasks.reduce((sum, task) => sum + Math.max(0, Number(task.requiredStepCount) || 0), 0);
    const totalCompletedStepCount = tasks.reduce((sum, task) => {
        return sum + Math.max(0, Number(task.completedStepCount) || 0);
    }, 0);

    const synthetic = {
        averageTapCount: tasks.length > 0 ? totalTapCount / tasks.length : 0,
        successRate: tasks.length > 0 ? successCount / tasks.length : 0,
        maxTapCount,
        totalDurationMs
    };
    const behavior = summarizeInteractionTelemetry(tasks);
    const taskKpi = {
        averageInteractionCount: tasks.length > 0 ? totalInteractionCount / tasks.length : 0,
        completionRate: tasks.length > 0 ? completionCount / tasks.length : 0,
        observationRate: tasks.length > 0 ? observationCount / tasks.length : 0,
        stepCompletionRate: totalRequiredStepCount > 0 ? totalCompletedStepCount / totalRequiredStepCount : 0
    };

    return {
        synthetic,
        behavior,
        taskKpi,
        ...synthetic
    };
}
