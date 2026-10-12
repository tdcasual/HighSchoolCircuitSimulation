import * as ToolboxBindingsController from './ToolboxBindingsController.js';

export const interactionCoreInputToolboxMethods = {
        bindToolboxEvents() {
            return ToolboxBindingsController.bindToolboxEvents.call(this);
        }
    };
