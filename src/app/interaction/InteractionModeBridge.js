function normalizePendingToolType(type) {
    if (type === null || type === undefined || type === '') return null;
    return String(type);
}

function normalizeMobileInteractionMode(mode) {
    return mode === 'wire' ? 'wire' : 'select';
}

function normalizeContextPatch(patch = {}) {
    const next = {};
    if ('pendingToolType' in patch) {
        next.pendingToolType = normalizePendingToolType(patch.pendingToolType);
    }
    if ('mobileInteractionMode' in patch) {
        next.mobileInteractionMode = normalizeMobileInteractionMode(patch.mobileInteractionMode);
    }
    if ('stickyWireTool' in patch) {
        next.stickyWireTool = !!patch.stickyWireTool;
    }
    if ('isWiring' in patch) {
        next.isWiring = !!patch.isWiring;
    }
    if ('isDraggingWireEndpoint' in patch) {
        next.isDraggingWireEndpoint = !!patch.isDraggingWireEndpoint;
    }
    if ('isTerminalExtending' in patch) {
        next.isTerminalExtending = !!patch.isTerminalExtending;
    }
    if ('isRheostatDragging' in patch) {
        next.isRheostatDragging = !!patch.isRheostatDragging;
    }
    return next;
}

function applyRuntimeContextPatch(context, patch = {}) {
    if (!context || !patch || typeof patch !== 'object') return;
    if ('pendingToolType' in patch) {
        context.pendingToolType = patch.pendingToolType;
    }
    if ('mobileInteractionMode' in patch) {
        context.mobileInteractionMode = patch.mobileInteractionMode;
    }
    if ('stickyWireTool' in patch) {
        context.stickyWireTool = patch.stickyWireTool;
    }
    if ('isWiring' in patch) {
        context.isWiring = patch.isWiring;
    }
    if ('isDraggingWireEndpoint' in patch) {
        context.isDraggingWireEndpoint = patch.isDraggingWireEndpoint;
    }
    if ('isTerminalExtending' in patch) {
        context.isTerminalExtending = patch.isTerminalExtending;
    }
    if ('isRheostatDragging' in patch) {
        context.isRheostatDragging = patch.isRheostatDragging;
    }
}

function readModeStoreState(context) {
    const getState = context?.interactionModeStore?.getState;
    if (typeof getState !== 'function') return null;
    try {
        return getState.call(context.interactionModeStore);
    } catch (_) {
        return null;
    }
}

export function readInteractionModeState(context = null) {
    return readModeStoreState(context);
}

function syncModeStore(context, patch = {}, options = {}) {
    const sync = context?.syncInteractionModeStore;
    if (typeof sync !== 'function') return null;
    try {
        const syncOptions = {
            source: typeof options.source === 'string' && options.source ? options.source : 'interaction.mode-bridge'
        };
        if (typeof options.mode === 'string' && options.mode) {
            syncOptions.mode = options.mode;
        }
        if (patch && Object.keys(patch).length > 0) {
            syncOptions.context = patch;
        }
        return sync.call(context, syncOptions);
    } catch (_) {
        return null;
    }
}

export function readInteractionModeContext(context = null) {
    const state = readModeStoreState(context);
    if (state?.context && typeof state.context === 'object') {
        return { ...state.context };
    }
    return {
        pendingToolType: normalizePendingToolType(context?.pendingToolType),
        mobileInteractionMode: normalizeMobileInteractionMode(context?.mobileInteractionMode),
        stickyWireTool: !!context?.stickyWireTool,
        isWiring: !!context?.isWiring,
        isDraggingWireEndpoint: !!context?.isDraggingWireEndpoint,
        isTerminalExtending: !!context?.isTerminalExtending,
        isRheostatDragging: !!context?.isRheostatDragging
    };
}

export function setInteractionModeContext(context, patch = {}, options = {}) {
    if (!context) return null;
    const normalizedPatch = normalizeContextPatch(patch);
    applyRuntimeContextPatch(context, normalizedPatch);
    return syncModeStore(context, normalizedPatch, options) || readModeStoreState(context);
}

export function setWireToolContext(context, wireToolPatch = {}, options = {}) {
    return setInteractionModeContext(context, {
        pendingToolType: wireToolPatch.pendingToolType,
        mobileInteractionMode: wireToolPatch.mobileInteractionMode,
        stickyWireTool: wireToolPatch.stickyWireTool
    }, options);
}

export function setWiringActive(context, isWiring, options = {}) {
    return setInteractionModeContext(context, { isWiring: !!isWiring }, options);
}
