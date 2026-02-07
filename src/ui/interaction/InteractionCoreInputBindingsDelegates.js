import * as EventBindingsController from './EventBindingsController.js';

export function installInteractionCoreInputBindingsDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
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
    });
}
