import * as InputResolver from './InputResolver.js';

export function installInteractionCoreInputTargetResolverDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        resolveTerminalTarget(target) {
            return InputResolver.resolveTerminalTarget.call(this, target);
        },

        resolveProbeMarkerTarget(target) {
            return InputResolver.resolveProbeMarkerTarget.call(this, target);
        },

        isWireEndpointTarget(target) {
            return InputResolver.isWireEndpointTarget.call(this, target);
        }
    });
}
