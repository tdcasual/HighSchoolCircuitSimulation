import * as UIStateController from './UIStateController.js';
import * as PropertyDialogActions from './PropertyDialogActions.js';
import * as PropertyDialogController from './PropertyDialogController.js';

export function installInteractionTailDialogDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        showPropertyDialog(id) {
            return PropertyDialogController.showPropertyDialog.call(this, id);
        },

        hideDialog() {
            return UIStateController.hideDialog.call(this);
        },

        safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
            return UIStateController.safeParseFloat.call(this, value, defaultValue, minValue, maxValue);
        },

        getBlackBoxContainedComponentIds(boxComp, options = {}) {
            return UIStateController.getBlackBoxContainedComponentIds.call(this, boxComp, options);
        },

        applyDialogChanges() {
            return PropertyDialogActions.applyDialogChanges.call(this);
        }
    });
}
