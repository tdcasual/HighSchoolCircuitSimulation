import * as PanelBindingsController from './PanelBindingsController.js';
import * as UIStateController from './UIStateController.js';

export function installInteractionCoreInputPanelStateDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        bindButtonEvents() {
            return PanelBindingsController.bindButtonEvents.call(this);
        },

        bindSidePanelEvents() {
            return PanelBindingsController.bindSidePanelEvents.call(this);
        },

        isObservationTabActive() {
            return UIStateController.isObservationTabActive.call(this);
        }
    });
}
