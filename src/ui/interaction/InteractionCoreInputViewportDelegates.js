import * as ViewportController from './ViewportController.js';
import * as CoordinateTransforms from './CoordinateTransforms.js';

export function installInteractionCoreInputViewportDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        screenToCanvas(clientX, clientY) {
            return ViewportController.screenToCanvas.call(this, clientX, clientY);
        },

        canvasToComponentLocal(comp, canvasPoint) {
            return CoordinateTransforms.canvasToComponentLocal(comp, canvasPoint);
        },

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
