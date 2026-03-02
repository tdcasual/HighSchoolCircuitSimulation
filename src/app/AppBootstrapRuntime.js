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
            windowRef.app = createApp();
        });
        return true;
    } catch (_) {
        return false;
    }
}
