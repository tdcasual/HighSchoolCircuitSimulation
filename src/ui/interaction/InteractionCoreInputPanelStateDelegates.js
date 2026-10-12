import * as PanelBindingsController from './PanelBindingsController.js';
import * as UIStateController from './UIStateController.js';

export const interactionCoreInputPanelStateMethods = {
        bindButtonEvents() {
            return PanelBindingsController.bindButtonEvents.call(this);
        },

        bindSidePanelEvents() {
            return PanelBindingsController.bindSidePanelEvents.call(this);
        },

        isObservationTabActive() {
            return UIStateController.isObservationTabActive.call(this);
        }
    };
