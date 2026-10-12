import * as InputResolver from './InputResolver.js';

export const interactionCoreInputTargetResolverMethods = {
        resolveTerminalTarget(target) {
            return InputResolver.resolveTerminalTarget.call(this, target);
        },

        resolveProbeMarkerTarget(target) {
            return InputResolver.resolveProbeMarkerTarget.call(this, target);
        },

        isWireEndpointTarget(target) {
            return InputResolver.isWireEndpointTarget.call(this, target);
        }
    };
