export const InteractionModes = Object.freeze({
    SELECT: 'select',
    WIRE: 'wire',
    ENDPOINT_EDIT: 'endpoint-edit'
});

const SUPPORTED_MODES = new Set(Object.values(InteractionModes));

function normalizePendingToolType(type) {
    if (type === null || type === undefined || type === '') return null;
    return String(type);
}

function normalizeMobileInteractionMode(mode) {
    return mode === 'wire' ? 'wire' : 'select';
}

function normalizeModeContext(context = {}) {
    return {
        pendingToolType: normalizePendingToolType(context.pendingToolType),
        mobileInteractionMode: normalizeMobileInteractionMode(context.mobileInteractionMode),
        stickyWireTool: !!context.stickyWireTool,
        isWiring: !!context.isWiring,
        isDraggingWireEndpoint: !!context.isDraggingWireEndpoint,
        isTerminalExtending: !!context.isTerminalExtending,
        isRheostatDragging: !!context.isRheostatDragging,
        source: typeof context.source === 'string' && context.source ? context.source : null
    };
}

function assertSupportedMode(mode) {
    if (!SUPPORTED_MODES.has(mode)) {
        throw new RangeError(`Unsupported interaction mode: ${String(mode)}`);
    }
    return mode;
}

function cloneState(state) {
    return {
        mode: state.mode,
        context: { ...state.context },
        version: state.version
    };
}

function isContextEqual(a, b) {
    return a.pendingToolType === b.pendingToolType
        && a.mobileInteractionMode === b.mobileInteractionMode
        && a.stickyWireTool === b.stickyWireTool
        && a.isWiring === b.isWiring
        && a.isDraggingWireEndpoint === b.isDraggingWireEndpoint
        && a.isTerminalExtending === b.isTerminalExtending
        && a.isRheostatDragging === b.isRheostatDragging
        && a.source === b.source;
}

export class InteractionModeStore {
    constructor(initialState = {}) {
        const mode = initialState.mode ?? InteractionModes.SELECT;
        this.state = {
            mode: assertSupportedMode(mode),
            context: normalizeModeContext(initialState.context || initialState),
            version: 0
        };
        this.listeners = new Set();
    }

    getState() {
        return cloneState(this.state);
    }

    setMode(mode, context = {}) {
        const nextMode = assertSupportedMode(mode);
        const nextContext = normalizeModeContext({
            ...this.state.context,
            ...context
        });

        const modeChanged = nextMode !== this.state.mode;
        const contextChanged = !isContextEqual(nextContext, this.state.context);
        if (!modeChanged && !contextChanged) {
            return cloneState(this.state);
        }

        const previous = cloneState(this.state);
        this.state = {
            mode: nextMode,
            context: nextContext,
            version: this.state.version + 1
        };
        const current = cloneState(this.state);

        this.listeners.forEach((listener) => {
            try {
                listener(current, previous);
            } catch (_) {
                // Listener failures must not break interaction state updates.
            }
        });

        return current;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}
