import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';

export const interactionCoreInputMouseFlowMethods = {
        syncInteractionModeStore(options = {}) {
            return InteractionOrchestrator.syncInteractionModeStore(this, options);
        },

        onMouseDown(e) {
            return InteractionOrchestrator.onMouseDown.call(this, e);
        },

        onMouseMove(e) {
            return InteractionOrchestrator.onMouseMove.call(this, e);
        },

        onMouseUp(e) {
            return InteractionOrchestrator.onMouseUp.call(this, e);
        },

        onMouseLeave(e) {
            return InteractionOrchestrator.onMouseLeave.call(this, e);
        }
    };
