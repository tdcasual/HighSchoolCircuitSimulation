import * as WireInteractions from './WireInteractions.js';

export const interactionCoreCircuitWireSplitMethods = {
        splitWireAtPoint(wireId, x, y) {
            return WireInteractions.splitWireAtPoint.call(this, wireId, x, y);
        },

        splitWireAtPointInternal(wireId, x, y, options = {}) {
            return WireInteractions.splitWireAtPointInternal.call(this, wireId, x, y, options);
        }
    };
