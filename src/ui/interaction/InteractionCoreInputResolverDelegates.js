import * as SnapController from './SnapController.js';
import * as InputResolver from './InputResolver.js';

export function installInteractionCoreInputResolverDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        resolveTerminalTarget(target) {
            return InputResolver.resolveTerminalTarget.call(this, target);
        },

        resolveProbeMarkerTarget(target) {
            return InputResolver.resolveProbeMarkerTarget.call(this, target);
        },

        resolvePointerType(event) {
            return InputResolver.resolvePointerType.call(this, event);
        },

        getAdaptiveSnapThreshold(options = {}) {
            return SnapController.getAdaptiveSnapThreshold.call(this, options);
        },

        isWireEndpointTarget(target) {
            return InputResolver.isWireEndpointTarget.call(this, target);
        }
    });
}
