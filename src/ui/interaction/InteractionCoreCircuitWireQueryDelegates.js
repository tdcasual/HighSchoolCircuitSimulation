import * as WireInteractions from './WireInteractions.js';
import * as SnapController from './SnapController.js';

export function installInteractionCoreCircuitWireQueryDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        snapPoint(x, y, options = {}) {
            return SnapController.snapPoint.call(this, x, y, options);
        },

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
        },

        splitWireAtPoint(wireId, x, y) {
            return WireInteractions.splitWireAtPoint.call(this, wireId, x, y);
        },

        splitWireAtPointInternal(wireId, x, y, options = {}) {
            return WireInteractions.splitWireAtPointInternal.call(this, wireId, x, y, options);
        }
    });
}
