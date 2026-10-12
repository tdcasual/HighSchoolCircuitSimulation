import * as ContextMenuController from './ContextMenuController.js';
import * as ComponentActions from './ComponentActions.js';

export const interactionTailContextMenuMethods = {
        showContextMenu(e, componentId) {
            return ContextMenuController.showContextMenu.call(this, e, componentId);
        },

        showWireContextMenu(e, wireId) {
            return ContextMenuController.showWireContextMenu.call(this, e, wireId);
        },

        showProbeContextMenu(e, probeId, wireId) {
            return ContextMenuController.showProbeContextMenu.call(this, e, probeId, wireId);
        },

        hideContextMenu() {
            return ContextMenuController.hideContextMenu.call(this);
        },

        duplicateComponent(id) {
            return ComponentActions.duplicateComponent.call(this, id);
        }
    };
