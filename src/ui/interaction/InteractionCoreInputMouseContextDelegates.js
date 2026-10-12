import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';

export const interactionCoreInputMouseContextMethods = {
        onContextMenu(e) {
            return InteractionOrchestrator.onContextMenu.call(this, e);
        },

        onDoubleClick(e) {
            return InteractionOrchestrator.onDoubleClick.call(this, e);
        }
    };
