import { updateEntityIdCounterFromExisting } from '../../utils/id/EntityIdCounter.js';
import { safeInvoke } from '../../utils/RuntimeSafety.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

function normalizeIdentifier(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
}

function sortById(a, b) {
    return String(a?.id).localeCompare(String(b?.id));
}

export class HistoryManager {
    constructor(interaction, options = {}) {
        this.interaction = interaction;
        this.undoStack = [];
        this.redoStack = [];
        this.maxEntries = Number.isFinite(options.maxEntries) ? Math.max(1, Math.floor(options.maxEntries)) : 100;
        this.transaction = null;
        this.isRestoring = false;
    }

    captureState() {
        const toJSON = this.interaction?.circuit?.toJSON;
        if (typeof toJSON !== 'function') {
            throw new TypeError('circuit.toJSON is required');
        }
        const json = toJSON.call(this.interaction.circuit) || {};
        const components = Array.isArray(json.components) ? [...json.components] : [];
        const wires = Array.isArray(json.wires) ? [...json.wires] : [];
        const probes = Array.isArray(json.probes) ? [...json.probes] : [];
        components.sort(sortById);
        wires.sort(sortById);
        probes.sort(sortById);
        return {
            meta: {
                version: 3,
                name: json.meta?.name
            },
            components,
            wires,
            probes
        };
    }

    stateKey(state) {
        return JSON.stringify(state);
    }

    getSelectionSnapshot() {
        return {
            componentId: normalizeIdentifier(this.interaction?.selectedComponent),
            wireId: normalizeIdentifier(this.interaction?.selectedWire)
        };
    }

    restoreSelectionSnapshot(snapshot) {
        const compId = normalizeIdentifier(snapshot?.componentId);
        const wireId = normalizeIdentifier(snapshot?.wireId);
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
        const fromJSON = this.interaction?.circuit?.fromJSON;
        if (typeof fromJSON !== 'function') {
            throw new TypeError('circuit.fromJSON is required');
        }
        const payload = {
            meta: {
                version: 3,
                name: state.meta?.name
            },
            components: state.components || [],
            wires: state.wires || [],
            probes: state.probes || []
        };
        fromJSON.call(this.interaction.circuit, payload);

        const app = this.interaction?.app;
        if (typeof app?.stopSimulation === 'function') {
            app.stopSimulation();
        }

        const allIds = [
            ...(state.components || []).map((component) => component.id),
            ...(state.wires || []).map((wire) => wire.id)
        ]
            .map((id) => normalizeIdentifier(id))
            .filter((id) => typeof id === 'string');
        updateEntityIdCounterFromExisting(allIds);

        this.interaction?.renderer?.render?.();
        app?.chartWorkspace?.refreshComponentOptions?.();
        app?.chartWorkspace?.refreshDialGauges?.();
        this.restoreSelectionSnapshot(selection);
    }

    undo() {
        const entry = this.undoStack.pop();
        if (!entry) return;
        this.isRestoring = true;
        try {
            this.applyState(entry.before, entry.selectionBefore);
            this.redoStack.push(entry);
            this.interaction?.updateStatus?.(entry.label ? `撤销：${entry.label}` : '已撤销');
        } catch (error) {
            this.undoStack.push(entry);
            this.interaction?.updateStatus?.(`撤销失败：${error.message}`);
            this.interaction?.logger?.error?.('undo failed', error);
        } finally {
            this.isRestoring = false;
        }
    }

    redo() {
        const entry = this.redoStack.pop();
        if (!entry) return;
        this.isRestoring = true;
        try {
            this.applyState(entry.after, entry.selectionAfter);
            this.undoStack.push(entry);
            this.interaction?.updateStatus?.(entry.label ? `重做：${entry.label}` : '已重做');
        } catch (error) {
            this.redoStack.push(entry);
            this.interaction?.updateStatus?.(`重做失败：${error.message}`);
            this.interaction?.logger?.error?.('redo failed', error);
        } finally {
            this.isRestoring = false;
        }
    }
}
