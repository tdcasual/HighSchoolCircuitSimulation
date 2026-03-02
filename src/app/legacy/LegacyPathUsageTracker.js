const LEGACY_PATH_USAGE_SYMBOL = Symbol.for('high-school-circuit-simulation.legacy-path-usage');

function resolveTarget(target) {
    if (target && typeof target === 'object') {
        return target;
    }
    return null;
}

function normalizeKey(key) {
    const text = String(key || '').trim();
    return text || null;
}

function resolveUsageMap(target, createIfMissing = false) {
    const holder = resolveTarget(target);
    if (!holder) return null;

    const current = holder[LEGACY_PATH_USAGE_SYMBOL];
    if (current instanceof Map) return current;
    if (!createIfMissing) return null;

    const map = new Map();
    holder[LEGACY_PATH_USAGE_SYMBOL] = map;
    return map;
}

export function recordLegacyPathUsage(target, key, details = null) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return null;

    const map = resolveUsageMap(target, true);
    if (!map) return null;

    const now = Date.now();
    const previous = map.get(normalizedKey);
    const next = {
        key: normalizedKey,
        count: (previous?.count || 0) + 1,
        firstSeenAt: previous?.firstSeenAt || now,
        lastSeenAt: now,
        lastDetails: details && typeof details === 'object' ? { ...details } : null
    };
    map.set(normalizedKey, next);
    return { ...next };
}

export function getLegacyPathUsageSnapshot(target) {
    const map = resolveUsageMap(target, false);
    if (!map) return [];
    return Array.from(map.values())
        .map((entry) => ({ ...entry }))
        .sort((a, b) => a.key.localeCompare(b.key));
}

export function clearLegacyPathUsage(target) {
    const map = resolveUsageMap(target, false);
    if (!map) return 0;
    const size = map.size;
    map.clear();
    return size;
}
