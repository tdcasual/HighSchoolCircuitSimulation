import * as WireInteractions from './WireInteractions.js';

export const interactionCoreCircuitWireSearchMethods = {
        findNearbyWireEndpoint(
            x,
            y,
            threshold,
            excludeWireId = null,
            excludeEnd = null,
            excludeWireEndpoints = null,
            excludeWireIds = null
        ) {
            return WireInteractions.findNearbyWireEndpoint.call(
                this,
                x,
                y,
                threshold,
                excludeWireId,
                excludeEnd,
                excludeWireEndpoints,
                excludeWireIds
            );
        },

        findNearbyWireSegment(x, y, threshold, excludeWireId = null) {
            return WireInteractions.findNearbyWireSegment.call(this, x, y, threshold, excludeWireId);
        }
    };
