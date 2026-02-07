/**
 * AILogService.js
 * Runtime trace/event logging for AI panel diagnostics.
 */

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function truncateText(value, maxLength = 240) {
    const text = String(value ?? '');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

function safeNow(nowFn = Date.now) {
    try {
        return Number(nowFn()) || Date.now();
    } catch (_) {
        return Date.now();
    }
}

function normalizeLevel(level) {
    const normalized = String(level || 'info').toLowerCase().trim();
    if (normalized === 'error') return 'error';
    if (normalized === 'warn' || normalized === 'warning') return 'warn';
    return 'info';
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeValue(value, depth = 0) {
    if (depth > 4) return '[max-depth]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return truncateText(value, 500);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Error) {
        return {
            name: value.name || 'Error',
            message: truncateText(value.message || ''),
            stack: truncateText(value.stack || '', 800)
        };
    }
    if (Array.isArray(value)) {
        const limit = 20;
        const items = value.slice(0, limit).map(item => sanitizeValue(item, depth + 1));
        if (value.length > limit) {
            items.push(`[truncated:${value.length - limit}]`);
        }
        return items;
    }
    if (isPlainObject(value)) {
        const output = {};
        const entries = Object.entries(value).slice(0, 30);
        for (const [key, item] of entries) {
            output[key] = sanitizeValue(item, depth + 1);
        }
        if (Object.keys(value).length > entries.length) {
            output.__truncated__ = Object.keys(value).length - entries.length;
        }
        return output;
    }
    return truncateText(String(value), 500);
}

export class AILogService {
    constructor({
        storageKey = 'ai_runtime_logs_v1',
        maxEntries = 1200,
        nowFn = Date.now
    } = {}) {
        this.storageKey = String(storageKey || 'ai_runtime_logs_v1');
        this.maxEntries = Math.max(100, safeNumber(maxEntries, 1200));
        this.nowFn = nowFn;
        this.sessionId = `session-${Math.random().toString(36).slice(2, 8)}-${safeNow(this.nowFn).toString(36)}`;
        this.sequence = 0;
        this.entries = this.loadFromStorage();
    }

    safeGetStorage() {
        try {
            if (typeof localStorage === 'undefined') return null;
            return localStorage;
        } catch (_) {
            return null;
        }
    }

    loadFromStorage() {
        const storage = this.safeGetStorage();
        if (!storage) return [];
        try {
            const raw = storage.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(item => item && typeof item === 'object');
        } catch (_) {
            return [];
        }
    }

    persist() {
        const storage = this.safeGetStorage();
        if (!storage) return;
        try {
            storage.setItem(this.storageKey, JSON.stringify(this.entries));
        } catch (_) {
            // ignore storage failures
        }
    }

    nextId(prefix = 'log') {
        this.sequence += 1;
        return `${prefix}-${safeNow(this.nowFn).toString(36)}-${this.sequence.toString(36)}`;
    }

    trimEntries() {
        const overflow = this.entries.length - this.maxEntries;
        if (overflow > 0) {
            this.entries.splice(0, overflow);
        }
    }

    log({
        level = 'info',
        source = 'ai',
        stage = 'event',
        traceId = '',
        message = '',
        data = null
    } = {}) {
        const entry = {
            id: this.nextId('event'),
            timestamp: safeNow(this.nowFn),
            level: normalizeLevel(level),
            source: String(source || 'ai'),
            stage: String(stage || 'event'),
            traceId: String(traceId || ''),
            message: truncateText(message || ''),
            data: sanitizeValue(data)
        };
        this.entries.push(entry);
        this.trimEntries();
        this.persist();
        return entry;
    }

    createTrace(type = 'chat', context = {}) {
        const traceId = this.nextId(`trace-${String(type || 'chat').replace(/[^a-zA-Z0-9_-]/g, '-')}`);
        this.log({
            level: 'info',
            source: 'trace',
            stage: 'start',
            traceId,
            message: `${type} started`,
            data: context
        });
        return traceId;
    }

    finishTrace(traceId, status = 'success', context = {}) {
        const normalized = String(status || 'success');
        const level = normalized === 'error' ? 'error' : (normalized === 'warning' ? 'warn' : 'info');
        return this.log({
            level,
            source: 'trace',
            stage: 'finish',
            traceId,
            message: `trace finished: ${normalized}`,
            data: {
                status: normalized,
                ...sanitizeValue(context)
            }
        });
    }

    getEntries(limit = 300) {
        const safeLimit = Math.max(1, safeNumber(limit, 300));
        return this.entries.slice(-safeLimit).map(item => ({ ...item }));
    }

    getSummary() {
        const total = this.entries.length;
        let errorCount = 0;
        let warnCount = 0;
        let lastError = null;
        let lastTraceId = '';
        let lastTimestamp = 0;
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            const entry = this.entries[index];
            if (!entry) continue;
            if (!lastTimestamp) {
                lastTimestamp = safeNumber(entry.timestamp, 0);
            }
            if (!lastTraceId && entry.traceId) {
                lastTraceId = entry.traceId;
            }
            if (entry.level === 'error') {
                errorCount += 1;
                if (!lastError) {
                    lastError = {
                        timestamp: entry.timestamp,
                        source: entry.source,
                        stage: entry.stage,
                        message: entry.message || '',
                        traceId: entry.traceId || ''
                    };
                }
            } else if (entry.level === 'warn') {
                warnCount += 1;
            }
        }
        return {
            sessionId: this.sessionId,
            total,
            errorCount,
            warnCount,
            lastTimestamp,
            lastTraceId,
            lastError
        };
    }

    exportPayload(limit = 2000) {
        return {
            version: 1,
            exportedAt: safeNow(this.nowFn),
            sessionId: this.sessionId,
            summary: this.getSummary(),
            entries: this.getEntries(limit)
        };
    }

    clear() {
        this.entries = [];
        this.persist();
    }
}
