import * as WireInteractions from './WireInteractions.js';

export function installInteractionCoreCircuitWireSearchDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        findNearbyWireEndpoint(x, y, threshold, excludeWireId = null, excludeEnd = null, excludeWireEndpoints = null) {
            return WireInteractions.findNearbyWireEndpoint.call(
                this,
                x,
                y,
                threshold,
                excludeWireId,
                excludeEnd,
                excludeWireEndpoints
            );
        },

        findNearbyWireSegment(x, y, threshold, excludeWireId = null) {
            return WireInteractions.findNearbyWireSegment.call(this, x, y, threshold, excludeWireId);
        }
    });
}
