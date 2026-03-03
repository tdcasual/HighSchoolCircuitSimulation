function normalizePendingTool(type) {
    if (type === null || type === undefined || type === '') return null;
    return String(type);
}

function createModeBridgeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeMobileMode(mode) {
    return mode === 'wire' ? 'wire' : 'select';
}

function normalizeContextPatch(patch = {}) {
    const next = {};
    if ('pendingTool' in patch) {
        next.pendingTool = normalizePendingTool(patch.pendingTool);
    }
    if ('mobileMode' in patch) {
        next.mobileMode = normalizeMobileMode(patch.mobileMode);
    }
    if ('wireModeSticky' in patch) {
        next.wireModeSticky = !!patch.wireModeSticky;
    }
    if ('wiringActive' in patch) {
        next.wiringActive = !!patch.wiringActive;
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

function normalizeModeContextSnapshot(raw = {}) {
    return {
        pendingTool: normalizePendingTool(raw.pendingTool),
        mobileMode: normalizeMobileMode(raw.mobileMode),
        wireModeSticky: !!raw.wireModeSticky,
        wiringActive: !!raw.wiringActive,
        isDraggingWireEndpoint: !!raw.isDraggingWireEndpoint,
        isTerminalExtending: !!raw.isTerminalExtending,
        isRheostatDragging: !!raw.isRheostatDragging
    };
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
        return normalizeModeContextSnapshot(state.context);
    }
    // runtime mode fields are legacy; absence of store must not read them.
    return normalizeModeContextSnapshot();
}

export function readInteractionModeContextV2(context = null) {
    const state = readModeStoreState(context);
    if (!state || !state.context || typeof state.context !== 'object') {
        throw createModeBridgeError(
            'V2_MODE_CONTEXT_REQUIRED',
            'v2 runtime requires interaction mode store context'
        );
    }
    return normalizeModeContextSnapshot(state.context);
}

export function setInteractionModeContext(context, patch = {}, options = {}) {
    if (!context) return null;
    const normalizedPatch = normalizeContextPatch(patch);
    return syncModeStore(context, normalizedPatch, options) || readModeStoreState(context);
}

export function setInteractionModeContextV2(context, patch = {}, options = {}) {
    if (!context) {
        throw createModeBridgeError('V2_CONTEXT_REQUIRED', 'v2 runtime requires interaction context');
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'pendingToolType')) {
        throw createModeBridgeError(
            'V2_LEGACY_ALIAS_FORBIDDEN',
            'v2 runtime forbids legacy mode alias "pendingToolType"'
        );
    }
    const normalizedPatch = normalizeContextPatch(patch);
    const syncedState = syncModeStore(context, normalizedPatch, options);
    if (!syncedState) {
        throw createModeBridgeError(
            'V2_MODE_STORE_SYNC_FAILED',
            'v2 runtime requires mode store sync and does not allow legacy fallback'
        );
    }
    return syncedState;
}

export function setWireToolContext(context, wireToolPatch = {}, options = {}) {
    return setInteractionModeContext(context, {
        pendingTool: wireToolPatch.pendingTool,
        mobileMode: wireToolPatch.mobileMode,
        wireModeSticky: wireToolPatch.wireModeSticky
    }, options);
}

export function setWiringActive(context, wiringActive, options = {}) {
    return setInteractionModeContext(context, { wiringActive: !!wiringActive }, options);
}
