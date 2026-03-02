import * as ToolPlacementController from './ToolPlacementController.js';

export function installInteractionCoreInputPlacementDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        setPendingToolType(type, item = null, options = {}) {
            return ToolPlacementController.setPendingToolType.call(this, type, item, options);
        },

        clearPendingToolType(options = {}) {
            return ToolPlacementController.clearPendingToolType.call(this, options);
        },

        setMobileInteractionMode(mode = 'select', options = {}) {
            return ToolPlacementController.setMobileInteractionMode.call(this, mode, options);
        },

        setEndpointAutoBridgeMode(mode = 'auto', options = {}) {
            return ToolPlacementController.setEndpointAutoBridgeMode.call(this, mode, options);
        },

        cycleEndpointAutoBridgeMode(options = {}) {
            return ToolPlacementController.cycleEndpointAutoBridgeMode.call(this, options);
        },

        restoreEndpointAutoBridgeMode(options = {}) {
            return ToolPlacementController.restoreEndpointAutoBridgeMode.call(this, options);
        },

        syncMobileModeButtons() {
            return ToolPlacementController.syncMobileModeButtons.call(this);
        },

        syncEndpointAutoBridgeButton() {
            return ToolPlacementController.syncEndpointAutoBridgeButton.call(this);
        },

        getInteractionModeSnapshot() {
            return ToolPlacementController.getInteractionModeSnapshot.call(this);
        },

        placePendingToolAt(clientX, clientY) {
            return ToolPlacementController.placePendingToolAt.call(this, clientX, clientY);
        }
    });
}
