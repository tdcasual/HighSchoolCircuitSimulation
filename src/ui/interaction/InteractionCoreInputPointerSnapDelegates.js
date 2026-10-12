import * as SnapController from './SnapController.js';
import * as InputResolver from './InputResolver.js';

export const interactionCoreInputPointerSnapMethods = {
        resolvePointerType(event) {
            return InputResolver.resolvePointerType.call(this, event);
        },

        getAdaptiveSnapThreshold(options = {}) {
            return SnapController.getAdaptiveSnapThreshold.call(this, options);
        }
    };
