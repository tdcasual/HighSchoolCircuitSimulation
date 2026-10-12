import * as UIStateController from './UIStateController.js';

export const interactionTailDialogUtilityMethods = {
        safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
            return UIStateController.safeParseFloat.call(this, value, defaultValue, minValue, maxValue);
        },

        getBlackBoxContainedComponentIds(boxComp, options = {}) {
            return UIStateController.getBlackBoxContainedComponentIds.call(this, boxComp, options);
        }
    };
