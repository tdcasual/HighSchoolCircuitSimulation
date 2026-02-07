import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';

export function installInteractionCoreInputMouseContextDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        onContextMenu(e) {
            return InteractionOrchestrator.onContextMenu.call(this, e);
        },

        onDoubleClick(e) {
            return InteractionOrchestrator.onDoubleClick.call(this, e);
        }
    });
}
