import * as HistoryFacadeController from './HistoryFacadeController.js';
import * as UIStateController from './UIStateController.js';

export function installInteractionTailHistoryNavigationDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        undo() {
            return HistoryFacadeController.undo.call(this);
        },

        redo() {
            return HistoryFacadeController.redo.call(this);
        },

        updateStatus(text) {
            return UIStateController.updateStatus.call(this, text);
        },

        showStatusAction(options = {}) {
            return UIStateController.showStatusAction.call(this, options);
        },

        clearStatusAction() {
            return UIStateController.clearStatusAction.call(this);
        }
    });
}
