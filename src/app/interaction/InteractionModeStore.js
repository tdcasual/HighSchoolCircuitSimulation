export const InteractionModes = Object.freeze({
    SELECT: 'select',
    WIRE: 'wire',
    ENDPOINT_EDIT: 'endpoint-edit'
});

const SUPPORTED_MODES = new Set(Object.values(InteractionModes));

function normalizePendingTool(type) {
    if (type === null || type === undefined || type === '') return null;
    return String(type);
}

function normalizeMobileMode(mode) {
    return mode === 'wire' ? 'wire' : 'select';
}

function normalizeModeContext(context = {}) {
    return {
        pendingTool: normalizePendingTool(context.pendingTool),
        mobileMode: normalizeMobileMode(context.mobileMode),
        wireModeSticky: !!context.wireModeSticky,
        wiringActive: !!context.wiringActive,
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

function createLegacyFlags(context = {}) {
    return Object.freeze({
        pendingToolType: normalizePendingTool(context.pendingTool),
        mobileInteractionMode: normalizeMobileMode(context.mobileMode),
        stickyWireTool: !!context.wireModeSticky,
        isWiring: !!context.wiringActive
    });
}

function createSnapshot(state) {
    const context = Object.freeze({ ...state.context });
    return Object.freeze({
        mode: state.mode,
        context,
        version: state.version,
        legacyFlags: createLegacyFlags(context)
    });
}

function isContextEqual(a, b) {
    return a.pendingTool === b.pendingTool
        && a.mobileMode === b.mobileMode
        && a.wireModeSticky === b.wireModeSticky
        && a.wiringActive === b.wiringActive
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
        this.snapshot = createSnapshot(this.state);
        this.listeners = new Set();
    }

    getState() {
        return this.snapshot;
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
            return this.snapshot;
        }

        const previous = this.snapshot;
        this.state = {
            mode: nextMode,
            context: nextContext,
            version: this.state.version + 1
        };
        this.snapshot = createSnapshot(this.state);
        const current = this.snapshot;

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
