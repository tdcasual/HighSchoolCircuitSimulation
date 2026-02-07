import * as WireInteractions from './WireInteractions.js';

export function installInteractionCoreCircuitWireCompactionDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
            return WireInteractions.resolveCompactedWireId.call(this, wireId, replacementByRemovedId);
        },

        compactWiresAndRefresh(options = {}) {
            return WireInteractions.compactWiresAndRefresh.call(this, options);
        }
    });
}
