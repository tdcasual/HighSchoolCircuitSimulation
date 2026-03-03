import { createAppCompositionRootV2 } from './AppCompositionRootV2.js';

function hasChartWorkspaceContract(appInstance) {
    return !!appInstance && typeof appInstance === 'object' && !!appInstance.chartWorkspace;
}

function registerBootstrapV2({ createApp, documentRef, windowRef } = {}) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    const win = windowRef || (typeof window !== 'undefined' ? window : null);
    if (!doc || typeof doc.addEventListener !== 'function' || typeof createApp !== 'function') {
        return false;
    }

    try {
        doc.addEventListener('DOMContentLoaded', () => {
            if (!win) return;
            const appInstance = createApp();
            if (!hasChartWorkspaceContract(appInstance)) return;
            win.app = appInstance;
        });
        return true;
    } catch (_) {
        return false;
    }
}

export function bootstrapV2({ register = registerBootstrapV2, AppClass } = {}) {
    if (typeof register !== 'function' || typeof AppClass !== 'function') {
        return false;
    }

    const compositionRoot = createAppCompositionRootV2({ AppClass });
    return !!register({
        createApp: () => compositionRoot.createApp()
    });
}
