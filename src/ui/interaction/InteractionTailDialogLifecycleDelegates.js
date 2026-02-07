import * as PropertyDialogActions from './PropertyDialogActions.js';
import * as PropertyDialogController from './PropertyDialogController.js';
import * as UIStateController from './UIStateController.js';

export function installInteractionTailDialogLifecycleDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        showPropertyDialog(id) {
            return PropertyDialogController.showPropertyDialog.call(this, id);
        },

        hideDialog() {
            return UIStateController.hideDialog.call(this);
        },

        applyDialogChanges() {
            return PropertyDialogActions.applyDialogChanges.call(this);
        }
    });
}
