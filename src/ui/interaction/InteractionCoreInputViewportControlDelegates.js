import * as ViewportController from './ViewportController.js';

export function installInteractionCoreInputViewportControlDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        onWheel(e) {
            return ViewportController.onWheel.call(this, e);
        },

        startPanning(e) {
            return ViewportController.startPanning.call(this, e);
        },

        updateViewTransform() {
            return ViewportController.updateViewTransform.call(this);
        },

        resetView() {
            return ViewportController.resetView.call(this);
        },

        getCircuitBounds() {
            return ViewportController.getCircuitBounds.call(this);
        }
    });
}
