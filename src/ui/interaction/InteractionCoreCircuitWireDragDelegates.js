import * as WireInteractions from './WireInteractions.js';

export const interactionCoreCircuitWireDragMethods = {
        startWireDrag(wireId, e) {
            return WireInteractions.startWireDrag.call(this, wireId, e);
        },

        startWireEndpointDrag(wireId, end, e) {
            return WireInteractions.startWireEndpointDrag.call(this, wireId, end, e);
        }
    };
