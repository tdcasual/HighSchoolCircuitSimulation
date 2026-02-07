import * as WireInteractions from './WireInteractions.js';

export function installInteractionCoreCircuitWireSplitDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        splitWireAtPoint(wireId, x, y) {
            return WireInteractions.splitWireAtPoint.call(this, wireId, x, y);
        },

        splitWireAtPointInternal(wireId, x, y, options = {}) {
            return WireInteractions.splitWireAtPointInternal.call(this, wireId, x, y, options);
        }
    });
}
