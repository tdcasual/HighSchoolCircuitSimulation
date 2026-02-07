import * as HistoryFacadeController from './HistoryFacadeController.js';

export function installInteractionTailHistorySnapshotDelegates(InteractionManagerClass) {
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

        applyHistoryState(state, selection) {
            return HistoryFacadeController.applyHistoryState.call(this, state, selection);
        }
    });
}
