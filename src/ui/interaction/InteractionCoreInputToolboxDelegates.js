import * as ToolboxBindingsController from './ToolboxBindingsController.js';

export function installInteractionCoreInputToolboxDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        bindToolboxEvents() {
            return ToolboxBindingsController.bindToolboxEvents.call(this);
        }
    });
}
