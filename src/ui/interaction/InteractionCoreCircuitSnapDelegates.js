import * as SnapController from './SnapController.js';

export function installInteractionCoreCircuitSnapDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        snapPoint(x, y, options = {}) {
            return SnapController.snapPoint.call(this, x, y, options);
        }
    });
}
