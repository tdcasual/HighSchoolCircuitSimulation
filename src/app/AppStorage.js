function resolveStorage(options = {}) {
    const explicitStorage = options.storage;
    if (explicitStorage && typeof explicitStorage.removeItem === 'function') {
        return explicitStorage;
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        return localStorage;
    }
    return null;
}

export function safeRemoveStorageItem(key, options = {}) {
    const storage = resolveStorage(options);
    if (!storage) return false;
    try {
        storage.removeItem(String(key));
        return true;
    } catch (_) {
        return false;
    }
}
