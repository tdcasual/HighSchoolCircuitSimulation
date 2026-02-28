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

function normalizeTaskResult(taskId, result = {}) {
    return {
        id: taskId,
        tapCount: Math.max(0, Math.round(Number(result.tapCount) || 0)),
        durationMs: Math.max(0, Math.round(Number(result.durationMs) || 0)),
        success: !!result.success,
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
    if (tasks.length === 0) {
        return {
            averageTapCount: 0,
            successRate: 0,
            maxTapCount: 0,
            totalDurationMs: 0
        };
    }

    const totalTapCount = tasks.reduce((sum, task) => sum + (Number(task.tapCount) || 0), 0);
    const successCount = tasks.reduce((sum, task) => sum + (task.success ? 1 : 0), 0);
    const maxTapCount = tasks.reduce((max, task) => Math.max(max, Number(task.tapCount) || 0), 0);
    const totalDurationMs = tasks.reduce((sum, task) => sum + (Number(task.durationMs) || 0), 0);

    return {
        averageTapCount: tasks.length > 0 ? totalTapCount / tasks.length : 0,
        successRate: tasks.length > 0 ? successCount / tasks.length : 0,
        maxTapCount,
        totalDurationMs
    };
}
