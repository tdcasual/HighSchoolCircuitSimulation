function hasChartWorkspaceContract(appInstance) {
    return !!appInstance && typeof appInstance === 'object' && !!appInstance.chartWorkspace;
}

export function registerAppBootstrap(options = {}) {
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
    const createApp = typeof options.createApp === 'function' ? options.createApp : null;
    if (!documentRef || typeof documentRef.addEventListener !== 'function' || !createApp) {
        return false;
    }

    try {
        documentRef.addEventListener('DOMContentLoaded', () => {
            if (!windowRef) return;
            const appInstance = createApp();
            if (!hasChartWorkspaceContract(appInstance)) return;
            windowRef.app = appInstance;
        });
        return true;
    } catch (_) {
        return false;
    }
}
