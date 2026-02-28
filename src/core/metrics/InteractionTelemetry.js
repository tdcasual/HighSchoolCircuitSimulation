function toFiniteMs(value) {
    const numeric = Math.round(Number(value) || 0);
    return Math.max(0, numeric);
}

function computeNearestRankPercentile(sortedValues = [], percentile = 0.5) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
        return 0;
    }
    const p = Math.min(1, Math.max(0, Number(percentile) || 0));
    const rank = Math.max(1, Math.ceil(p * sortedValues.length));
    return sortedValues[Math.min(sortedValues.length - 1, rank - 1)] || 0;
}

export function summarizeInteractionTelemetry(tasks = []) {
    const normalizedTasks = Array.isArray(tasks) ? tasks : [];
    if (normalizedTasks.length === 0) {
        return {
            medianDurationMs: 0,
            p90DurationMs: 0,
            destructiveCancelRate: 0
        };
    }

    const durations = normalizedTasks
        .map((task) => toFiniteMs(task?.durationMs))
        .sort((left, right) => left - right);
    const destructiveCancelCount = normalizedTasks.reduce((count, task) => {
        return count + (task?.destructiveCancel ? 1 : 0);
    }, 0);

    return {
        medianDurationMs: computeNearestRankPercentile(durations, 0.5),
        p90DurationMs: computeNearestRankPercentile(durations, 0.9),
        destructiveCancelRate: normalizedTasks.length > 0
            ? destructiveCancelCount / normalizedTasks.length
            : 0
    };
}
