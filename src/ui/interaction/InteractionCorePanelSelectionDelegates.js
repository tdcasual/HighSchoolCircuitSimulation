import * as SelectionPanelController from './SelectionPanelController.js';
import * as SnapController from './SnapController.js';

export function installInteractionCorePanelSelectionDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        selectComponent(id) {
            return SelectionPanelController.selectComponent.call(this, id);
        },

        selectWire(id) {
            return SelectionPanelController.selectWire.call(this, id);
        },

        findNearbyTerminal(x, y, threshold, excludeTerminalKeys = null) {
            return SnapController.findNearbyTerminal.call(this, x, y, threshold, excludeTerminalKeys);
        },

        clearSelection() {
            return SelectionPanelController.clearSelection.call(this);
        }
    });
}
