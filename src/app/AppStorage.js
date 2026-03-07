function normalizeStorageTarget(entryOrKey, options = {}) {
    if (entryOrKey && typeof entryOrKey === 'object' && typeof entryOrKey.key === 'string') {
        return {
            key: String(entryOrKey.key),
            storageArea: entryOrKey.storageArea === 'session' ? 'session' : 'local'
        };
    }

    return {
        key: String(entryOrKey || ''),
        storageArea: options.storageArea === 'session' ? 'session' : 'local'
    };
}

function resolveStorage(entryOrKey, options = {}, capability = 'getItem') {
    const explicitStorage = options.storage;
    if (explicitStorage && typeof explicitStorage[capability] === 'function') {
        return explicitStorage;
    }

    const target = normalizeStorageTarget(entryOrKey, options);
    const candidate = target.storageArea === 'session'
        ? (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
        : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (candidate && typeof candidate[capability] === 'function') {
        return candidate;
    }
    return null;
}

export function safeGetStorageItem(entryOrKey, options = {}) {
    const target = normalizeStorageTarget(entryOrKey, options);
    const storage = resolveStorage(target, options, 'getItem');
    if (!storage || !target.key) return null;
    try {
        return storage.getItem(target.key);
    } catch (_) {
        return null;
    }
}

export function safeSetStorageItem(entryOrKey, value, options = {}) {
    const target = normalizeStorageTarget(entryOrKey, options);
    const storage = resolveStorage(target, options, 'setItem');
    if (!storage || !target.key) return false;
    try {
        storage.setItem(target.key, String(value));
        return true;
    } catch (_) {
        return false;
    }
}

export function safeRemoveStorageItem(entryOrKey, options = {}) {
    const target = normalizeStorageTarget(entryOrKey, options);
    const storage = resolveStorage(target, options, 'removeItem');
    if (!storage || !target.key) return false;
    try {
        storage.removeItem(target.key);
        return true;
    } catch (_) {
        return false;
    }
}
