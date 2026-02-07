import * as ToolPlacementController from './ToolPlacementController.js';
import * as PanelBindingsController from './PanelBindingsController.js';
import * as UIStateController from './UIStateController.js';
import * as ToolboxBindingsController from './ToolboxBindingsController.js';

export function installInteractionCoreInputToolPanelDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        bindToolboxEvents() {
            return ToolboxBindingsController.bindToolboxEvents.call(this);
        },

        setPendingToolType(type, item = null) {
            return ToolPlacementController.setPendingToolType.call(this, type, item);
        },

        clearPendingToolType(options = {}) {
            return ToolPlacementController.clearPendingToolType.call(this, options);
        },

        placePendingToolAt(clientX, clientY) {
            return ToolPlacementController.placePendingToolAt.call(this, clientX, clientY);
        },

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
