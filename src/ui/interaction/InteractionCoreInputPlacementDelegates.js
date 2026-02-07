import * as ToolPlacementController from './ToolPlacementController.js';

export function installInteractionCoreInputPlacementDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        setPendingToolType(type, item = null) {
            return ToolPlacementController.setPendingToolType.call(this, type, item);
        },

        clearPendingToolType(options = {}) {
            return ToolPlacementController.clearPendingToolType.call(this, options);
        },

        placePendingToolAt(clientX, clientY) {
            return ToolPlacementController.placePendingToolAt.call(this, clientX, clientY);
        }
    });
}
