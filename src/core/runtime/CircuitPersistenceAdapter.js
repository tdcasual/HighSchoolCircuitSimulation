function resolveStorage(explicitStorage = null) {
    if (explicitStorage) return explicitStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
}

export class CircuitPersistenceAdapter {
    constructor(options = {}) {
        this.storage = options.storage || null;
    }

    loadSolverDebugFlag(options = {}) {
        const key = options.key || 'solver_debug';
        const storage = resolveStorage(options.storage || this.storage);
        if (!storage || typeof storage.getItem !== 'function') return false;
        try {
            return storage.getItem(key) === 'true';
        } catch (_) {
            return false;
        }
    }

    saveSolverDebugFlag(flag, options = {}) {
        const key = options.key || 'solver_debug';
        const storage = resolveStorage(options.storage || this.storage);
        if (!storage || typeof storage.setItem !== 'function') return false;
        try {
            storage.setItem(key, flag ? 'true' : 'false');
            return true;
        } catch (_) {
            return false;
        }
    }
}
