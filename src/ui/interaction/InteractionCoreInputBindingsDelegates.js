import * as EventBindingsController from './EventBindingsController.js';

export const interactionCoreInputBindingsMethods = {
        bindEvents() {
            return EventBindingsController.bindEvents.call(this);
        },

        bindZoomEvents() {
            return EventBindingsController.bindZoomEvents.call(this);
        },

        bindCanvasEvents() {
            return EventBindingsController.bindCanvasEvents.call(this);
        },

        bindKeyboardEvents() {
            return EventBindingsController.bindKeyboardEvents.call(this);
        }
    };
