import { updateIdCounterFromExisting } from '../../components/Component.js';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

export class HistoryManager {
    constructor(interaction, options = {}) {
        this.interaction = interaction;
        this.undoStack = [];
        this.redoStack = [];
        this.maxEntries = Number.isFinite(options.maxEntries) ? Math.max(1, Math.floor(options.maxEntries)) : 100;
        this.transaction = null; // { label, beforeState, beforeKey, selectionBefore }
        this.isRestoring = false;
    }

    captureState() {
        const json = safeInvokeMethod(this.interaction?.circuit, 'toJSON') ?? {};
        const components = Array.isArray(json.components) ? [...json.components] : [];
        const wires = Array.isArray(json.wires) ? [...json.wires] : [];
        const probes = Array.isArray(json.probes) ? [...json.probes] : [];
        components.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        wires.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        probes.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return { components, wires, probes };
    }

    stateKey(state) {
        return JSON.stringify(state);
    }

    getSelectionSnapshot() {
        return {
            componentId: this.interaction?.selectedComponent || null,
            wireId: this.interaction?.selectedWire || null
        };
    }

    restoreSelectionSnapshot(snapshot) {
        const compId = snapshot?.componentId;
        const wireId = snapshot?.wireId;
        if (compId && safeInvokeMethod(this.interaction?.circuit, 'getComponent', compId)) {
            safeInvokeMethod(this.interaction, 'selectComponent', compId);
            return;
        }
        if (wireId && safeInvokeMethod(this.interaction?.circuit, 'getWire', wireId)) {
            safeInvokeMethod(this.interaction, 'selectWire', wireId);
            return;
        }
        safeInvokeMethod(this.interaction, 'clearSelection');
    }

    pushEntry(entry) {
        if (!entry) return;
        this.undoStack.push(entry);
        if (this.undoStack.length > this.maxEntries) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    runWithHistory(label, action) {
        if (this.isRestoring) {
            action();
            return;
        }

        const before = this.captureState();
        const beforeKey = this.stateKey(before);
        const selectionBefore = this.getSelectionSnapshot();

        action();

        const after = this.captureState();
        const afterKey = this.stateKey(after);
        const selectionAfter = this.getSelectionSnapshot();

        if (beforeKey !== afterKey) {
            this.pushEntry({ label, before, after, selectionBefore, selectionAfter });
        }
    }

    beginTransaction(label) {
        if (this.isRestoring) return;
        if (this.transaction) return;
        const before = this.captureState();
        this.transaction = {
            label,
            beforeState: before,
            beforeKey: this.stateKey(before),
            selectionBefore: this.getSelectionSnapshot()
        };
    }

    commitTransaction() {
        const tx = this.transaction;
        if (!tx) return;
        this.transaction = null;
        if (this.isRestoring) return;

        const after = this.captureState();
        const afterKey = this.stateKey(after);
        if (tx.beforeKey === afterKey) return;

        this.pushEntry({
            label: tx.label,
            before: tx.beforeState,
            after,
            selectionBefore: tx.selectionBefore,
            selectionAfter: this.getSelectionSnapshot()
        });
    }

    applyState(state, selection) {
        if (!state) return;
        const app = this.interaction?.app;

        // Editing during simulation is error-prone; keep semantics simple.
        if (app?.circuit?.isRunning) {
            safeInvokeMethod(app, 'stopSimulation');
        }

        this.isRestoring = true;
        try {
            safeInvokeMethod(this.interaction?.circuit, 'fromJSON', {
                components: state.components || [],
                wires: state.wires || [],
                probes: state.probes || []
            });

            const allIds = [
                ...(state.components || []).map((component) => component.id),
                ...(state.wires || []).map((wire) => wire.id)
            ].filter(Boolean);
            updateIdCounterFromExisting(allIds);

            safeInvokeMethod(this.interaction?.renderer, 'render');
            safeInvokeMethod(app?.observationPanel, 'refreshComponentOptions');
            safeInvokeMethod(app?.observationPanel, 'refreshDialGauges');

            this.restoreSelectionSnapshot(selection);
        } finally {
            this.isRestoring = false;
        }
    }

    undo() {
        const entry = this.undoStack.pop();
        if (!entry) return;
        this.redoStack.push(entry);
        this.applyState(entry.before, entry.selectionBefore);
        safeInvokeMethod(this.interaction, 'updateStatus', entry.label ? `撤销：${entry.label}` : '已撤销');
    }

    redo() {
        const entry = this.redoStack.pop();
        if (!entry) return;
        this.undoStack.push(entry);
        this.applyState(entry.after, entry.selectionAfter);
        safeInvokeMethod(this.interaction, 'updateStatus', entry.label ? `重做：${entry.label}` : '已重做');
    }
}
