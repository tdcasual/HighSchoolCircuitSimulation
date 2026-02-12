export function createTraceId(prefix = 'trace') {
    const safePrefix = String(prefix || 'trace').replace(/[^a-zA-Z0-9_-]/g, '-');
    return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const LOG_LEVEL_PRIORITY = Object.freeze({
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
});

const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_LOG_LEVEL_STORAGE_KEY = 'app_log_level';

export function normalizeLogLevel(level, fallback = DEFAULT_LOG_LEVEL) {
    const normalized = String(level || '').trim().toLowerCase();
    if (normalized === 'silent') return 'silent';
    if (normalized === 'error') return 'error';
    if (normalized === 'warn' || normalized === 'warning') return 'warn';
    if (normalized === 'info') return 'info';
    if (normalized === 'debug') return 'debug';
    return String(fallback || DEFAULT_LOG_LEVEL).toLowerCase();
}

function safeGetStorageLevel(storageKey) {
    try {
        if (typeof localStorage === 'undefined') return '';
        return localStorage.getItem(storageKey) || '';
    } catch (_) {
        return '';
    }
}

export function resolveRuntimeLogLevel({
    level,
    storageKey = DEFAULT_LOG_LEVEL_STORAGE_KEY,
    fallbackLevel = DEFAULT_LOG_LEVEL
} = {}) {
    const explicit = normalizeLogLevel(level, '');
    if (explicit && LOG_LEVEL_PRIORITY[explicit] !== undefined) {
        return explicit;
    }
    const storageValue = normalizeLogLevel(safeGetStorageLevel(storageKey), '');
    if (storageValue && LOG_LEVEL_PRIORITY[storageValue] !== undefined) {
        return storageValue;
    }
    return normalizeLogLevel(fallbackLevel, DEFAULT_LOG_LEVEL);
}

function canEmit(activeLevel, targetLevel) {
    return LOG_LEVEL_PRIORITY[targetLevel] <= LOG_LEVEL_PRIORITY[activeLevel];
}

function resolveSinkMethod(sink, level) {
    if (!sink) return null;
    if (level === 'debug' && typeof sink.debug === 'function') return sink.debug.bind(sink);
    if (level === 'info' && typeof sink.info === 'function') return sink.info.bind(sink);
    if (level === 'warn' && typeof sink.warn === 'function') return sink.warn.bind(sink);
    if (level === 'error' && typeof sink.error === 'function') return sink.error.bind(sink);
    if (typeof sink.log === 'function') return sink.log.bind(sink);
    return null;
}

function joinScope(parentScope, childScope) {
    const parent = String(parentScope || '').trim();
    const child = String(childScope || '').trim();
    if (!parent) return child;
    if (!child) return parent;
    return `${parent}:${child}`;
}

function emitRuntimeLog(state, level, args) {
    if (!state || !canEmit(state.level, level)) return;
    const sinkMethod = resolveSinkMethod(state.sink, level);
    if (!sinkMethod) return;

    const payload = Array.isArray(args) ? args : [args];
    if (state.scope) {
        sinkMethod(`[${state.scope}]`, ...payload);
        return;
    }
    sinkMethod(...payload);
}

export function createRuntimeLogger({
    scope = 'app',
    level,
    storageKey = DEFAULT_LOG_LEVEL_STORAGE_KEY,
    fallbackLevel = DEFAULT_LOG_LEVEL,
    sink = console
} = {}) {
    const state = {
        scope: String(scope || '').trim(),
        level: resolveRuntimeLogLevel({ level, storageKey, fallbackLevel }),
        sink: sink || console
    };

    return {
        get scope() {
            return state.scope;
        },
        get level() {
            return state.level;
        },
        setLevel(nextLevel) {
            state.level = normalizeLogLevel(nextLevel, state.level);
            return state.level;
        },
        shouldLog(nextLevel) {
            const targetLevel = normalizeLogLevel(nextLevel, 'info');
            return canEmit(state.level, targetLevel);
        },
        child(childScope) {
            return createRuntimeLogger({
                scope: joinScope(state.scope, childScope),
                level: state.level,
                storageKey,
                fallbackLevel,
                sink: state.sink
            });
        },
        debug(...args) {
            emitRuntimeLog(state, 'debug', args);
        },
        info(...args) {
            emitRuntimeLog(state, 'info', args);
        },
        warn(...args) {
            emitRuntimeLog(state, 'warn', args);
        },
        error(...args) {
            emitRuntimeLog(state, 'error', args);
        },
        log(entry) {
            if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                const levelName = normalizeLogLevel(entry.level, 'info');
                emitRuntimeLog(state, levelName, [entry]);
                return entry;
            }
            emitRuntimeLog(state, 'info', [entry]);
            return entry;
        }
    };
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
