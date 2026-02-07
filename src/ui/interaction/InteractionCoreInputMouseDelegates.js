import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';

export function installInteractionCoreInputMouseDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
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
        },

        onContextMenu(e) {
            return InteractionOrchestrator.onContextMenu.call(this, e);
        },

        onDoubleClick(e) {
            return InteractionOrchestrator.onDoubleClick.call(this, e);
        }
    });
}
