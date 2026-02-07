export function createTraceId(prefix = 'trace') {
    const safePrefix = String(prefix || 'trace').replace(/[^a-zA-Z0-9_-]/g, '-');
    return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emit(logger, level, entry) {
    if (!logger) return false;
    if (typeof logger[level] === 'function') {
        logger[level](entry);
        return true;
    }
    if (typeof logger.log === 'function') {
        logger.log({ level, ...entry });
        return true;
    }
    return false;
}

export function logActionFailure(logger, payload) {
    const entry = {
        source: 'interaction',
        stage: 'action_failed',
        ...payload
    };
    emit(logger, 'error', entry);
    return entry;
}
