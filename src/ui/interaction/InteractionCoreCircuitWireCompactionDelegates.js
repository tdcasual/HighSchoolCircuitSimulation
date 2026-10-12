import * as WireInteractions from './WireInteractions.js';

export const interactionCoreCircuitWireCompactionMethods = {
        resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
            return WireInteractions.resolveCompactedWireId.call(this, wireId, replacementByRemovedId);
        },

        compactWiresAndRefresh(options = {}) {
            return WireInteractions.compactWiresAndRefresh.call(this, options);
        }
    };
