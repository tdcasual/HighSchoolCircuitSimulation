import * as SnapController from './SnapController.js';

export const interactionCoreCircuitSnapMethods = {
        snapPoint(x, y, options = {}) {
            return SnapController.snapPoint.call(this, x, y, options);
        }
    };
