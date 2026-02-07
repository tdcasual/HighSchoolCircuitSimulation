import * as HistoryFacadeController from './HistoryFacadeController.js';
import * as UIStateController from './UIStateController.js';

export function installInteractionTailHistoryDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        captureHistoryState() {
            return HistoryFacadeController.captureHistoryState.call(this);
        },

        historyKey(state) {
            return HistoryFacadeController.historyKey.call(this, state);
        },

        getSelectionSnapshot() {
            return HistoryFacadeController.getSelectionSnapshot.call(this);
        },

        restoreSelectionSnapshot(snapshot) {
            HistoryFacadeController.restoreSelectionSnapshot.call(this, snapshot);
        },

        pushHistoryEntry(entry) {
            HistoryFacadeController.pushHistoryEntry.call(this, entry);
        },

        runWithHistory(label, action) {
            return HistoryFacadeController.runWithHistory.call(this, label, action);
        },

        beginHistoryTransaction(label) {
            return HistoryFacadeController.beginHistoryTransaction.call(this, label);
        },

        commitHistoryTransaction() {
            return HistoryFacadeController.commitHistoryTransaction.call(this);
        },

        applyHistoryState(state, selection) {
            return HistoryFacadeController.applyHistoryState.call(this, state, selection);
        },

        undo() {
            return HistoryFacadeController.undo.call(this);
        },

        redo() {
            return HistoryFacadeController.redo.call(this);
        },

        updateStatus(text) {
            return UIStateController.updateStatus.call(this, text);
        }
    });
}
