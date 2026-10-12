import * as HistoryFacadeController from './HistoryFacadeController.js';

export const interactionTailHistoryTransactionMethods = {
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
        }
    };
