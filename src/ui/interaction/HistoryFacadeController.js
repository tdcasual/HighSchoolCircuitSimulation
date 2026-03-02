function hasActiveEditLikeDrag(context) {
    return !!(
        context?.isDraggingWireEndpoint
        || context?.isDraggingWire
        || context?.isDragging
    );
}

function hasOpenHistoryTransaction(context) {
    return !!context?.historyManager?.transaction;
}

function prepareForHistoryNavigation(context) {
    if (!context) return;

    const hadWiring = !!context.isWiring;
    const hadSuspendedWiringSession = !!context.suspendedWiringSession;
    const hadWireModeGesture = !!context.wireModeGesture;
    const hadPointerDownInfo = !!context.pointerDownInfo;
    const hadEditLikeDrag = hasActiveEditLikeDrag(context);
    const hadTerminalExtending = !!context.isTerminalExtending;
    const hadRheostatDragging = !!context.isRheostatDragging;
    const hadOpenTransaction = hasOpenHistoryTransaction(context);

    context.wireModeGesture = null;
    context.pointerDownInfo = null;
    context.suspendedWiringSession = null;

    if (hadWiring) {
        if (typeof context.cancelWiring === 'function') {
            context.cancelWiring();
        } else {
            context.isWiring = false;
            context.wireStart = null;
            context.ignoreNextWireMouseUp = false;
            context.tempWire = null;
        }
    }

    if (hadEditLikeDrag) {
        if (typeof context.onMouseLeave === 'function') {
            context.onMouseLeave({ buttons: 0 });
        } else {
            context.isDraggingWireEndpoint = false;
            context.wireEndpointDrag = null;
            context.isDraggingWire = false;
            context.wireDrag = null;
            context.isDragging = false;
            context.dragTarget = null;
            context.dragGroup = null;
            context.isDraggingComponent = false;
            context.hideAlignmentGuides?.();
            context.renderer?.clearTerminalHighlight?.();
        }
    }

    if (hadTerminalExtending || hadRheostatDragging) {
        context.isTerminalExtending = false;
        context.isRheostatDragging = false;
        if (hadTerminalExtending) {
            context.circuit?.rebuildNodes?.();
        }
        context.hideAlignmentGuides?.();
    }

    const shouldCommitTransaction = hadOpenTransaction
        || hadWiring
        || hadSuspendedWiringSession
        || hadWireModeGesture
        || hadPointerDownInfo
        || hadEditLikeDrag
        || hadTerminalExtending
        || hadRheostatDragging;
    if (!shouldCommitTransaction) return;

    if (typeof context.commitHistoryTransaction === 'function') {
        context.commitHistoryTransaction();
    } else {
        context.historyManager?.commitTransaction?.();
    }
}

export function captureHistoryState() {
    return this.historyManager.captureState();
}

export function historyKey(state) {
    return this.historyManager.stateKey(state);
}

export function getSelectionSnapshot() {
    return this.historyManager.getSelectionSnapshot();
}

export function restoreSelectionSnapshot(snapshot) {
    this.historyManager.restoreSelectionSnapshot(snapshot);
}

export function pushHistoryEntry(entry) {
    this.historyManager.pushEntry(entry);
}

export function runWithHistory(label, action) {
    this.historyManager.runWithHistory(label, action);
}

export function beginHistoryTransaction(label) {
    this.historyManager.beginTransaction(label);
}

export function commitHistoryTransaction() {
    this.historyManager.commitTransaction();
}

export function applyHistoryState(state, selection) {
    this.historyManager.applyState(state, selection);
}

export function undo() {
    prepareForHistoryNavigation(this);
    this.historyManager.undo();
}

export function redo() {
    prepareForHistoryNavigation(this);
    this.historyManager.redo();
}
