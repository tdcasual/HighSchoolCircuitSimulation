function ensureRuntimeContract(appInstance) {
    if (!appInstance || typeof appInstance !== 'object') {
        throw new Error('AppCompositionRootV2 requires app instance object');
    }
    if (!appInstance.chartWorkspace) {
        appInstance.chartWorkspace = {
            windows: []
        };
    }
    if (typeof appInstance.openAIPanel !== 'function') {
        appInstance.openAIPanel = async () => null;
    }
    return appInstance;
}

export function createAppCompositionRootV2({ AppClass } = {}) {
    if (typeof AppClass !== 'function') {
        throw new Error('AppCompositionRootV2 requires AppClass constructor');
    }

    return {
        createApp() {
            const instance = new AppClass();
            return ensureRuntimeContract(instance);
        }
    };
}
