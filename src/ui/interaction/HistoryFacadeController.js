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
    this.historyManager.undo();
}

export function redo() {
    this.historyManager.redo();
}
