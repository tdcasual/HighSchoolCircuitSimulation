import * as HistoryFacadeController from './HistoryFacadeController.js';

export const interactionTailHistorySnapshotMethods = {
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
    };
