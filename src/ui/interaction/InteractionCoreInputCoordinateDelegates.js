import * as ViewportController from './ViewportController.js';
import * as CoordinateTransforms from './CoordinateTransforms.js';

export function installInteractionCoreInputCoordinateDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        screenToCanvas(clientX, clientY) {
            return ViewportController.screenToCanvas.call(this, clientX, clientY);
        },

        canvasToComponentLocal(comp, canvasPoint) {
            return CoordinateTransforms.canvasToComponentLocal(comp, canvasPoint);
        }
    });
}
