import { InteractionModeStore, InteractionModes } from './InteractionModeStore.js';

function captureRuntimeInteractionModeContext(context = {}) {
    return {
        // Legacy runtime wire flags are physically removed.
        // Store initialization always starts from canonical select-mode defaults.
        pendingTool: null,
        mobileMode: 'select',
        wireModeSticky: false,
        wiringActive: false,
        isDraggingWireEndpoint: !!context.isDraggingWireEndpoint,
        isTerminalExtending: !!context.isTerminalExtending,
        isRheostatDragging: !!context.isRheostatDragging
    };
}

function resolveInteractionMode(context = {}) {
    if (context.isDraggingWireEndpoint || context.isTerminalExtending || context.isRheostatDragging) {
        return InteractionModes.ENDPOINT_EDIT;
    }
    if (
        context.pendingTool === 'Wire'
        || context.mobileMode === 'wire'
        || context.wireModeSticky
        || context.wiringActive
    ) {
        return InteractionModes.WIRE;
    }
    return InteractionModes.SELECT;
}

function applyInteractionModeStateToContext(context, state) {
    if (!context || !state) return;
    // Week10: interactionModeStore becomes authoritative for mode context.
    // Do not mirror store context back into legacy runtime flags.
    context.interactionMode = state.mode;
    context.interactionModeSnapshot = state;
}

function ensureInteractionModeStore(context) {
    if (!context) return null;
    if (!(context.interactionModeStore instanceof InteractionModeStore)) {
        const initialContext = captureRuntimeInteractionModeContext(context);
        context.interactionModeStore = new InteractionModeStore({
            mode: resolveInteractionMode(initialContext),
            context: initialContext
        });
    }
    return context.interactionModeStore;
}

export function initializeInteractionModeStore(context) {
    if (!context) return null;
    const store = ensureInteractionModeStore(context);
    if (!store) return null;
    const state = store.getState();
    applyInteractionModeStateToContext(context, state);
    return state;
}

export function syncInteractionModeStore(context, options = {}) {
    if (!context) return null;
    const store = ensureInteractionModeStore(context);
    if (!store) return null;

    const contextOverrides = options.context && typeof options.context === 'object'
        ? options.context
        : {};
    const currentState = store.getState();
    const baseContext = currentState?.context && typeof currentState.context === 'object'
        ? currentState.context
        : captureRuntimeInteractionModeContext(context);
    const modeContext = {
        ...baseContext,
        ...contextOverrides,
        source: typeof options.source === 'string' && options.source ? options.source : null
    };
    const nextMode = typeof options.mode === 'string' && options.mode
        ? options.mode
        : resolveInteractionMode(modeContext);
    const state = store.setMode(nextMode, modeContext);
    applyInteractionModeStateToContext(context, state);
    return state;
}
