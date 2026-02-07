import * as WireInteractions from './WireInteractions.js';
import * as SnapController from './SnapController.js';

export function installInteractionCoreCircuitWireDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        startWiringFromPoint(point, e = null, armMouseUpGuard = false) {
            return WireInteractions.startWiringFromPoint.call(this, point, e, armMouseUpGuard);
        },

        finishWiringToPoint(point, options = {}) {
            return WireInteractions.finishWiringToPoint.call(this, point, options);
        },

        addWireAt(x, y) {
            return WireInteractions.addWireAt.call(this, x, y);
        },

        startWireDrag(wireId, e) {
            return WireInteractions.startWireDrag.call(this, wireId, e);
        },

        startWireEndpointDrag(wireId, end, e) {
            return WireInteractions.startWireEndpointDrag.call(this, wireId, end, e);
        },

        resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
            return WireInteractions.resolveCompactedWireId.call(this, wireId, replacementByRemovedId);
        },

        compactWiresAndRefresh(options = {}) {
            return WireInteractions.compactWiresAndRefresh.call(this, options);
        },

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
        },

        cancelWiring() {
            return WireInteractions.cancelWiring.call(this);
        }
    });
}
