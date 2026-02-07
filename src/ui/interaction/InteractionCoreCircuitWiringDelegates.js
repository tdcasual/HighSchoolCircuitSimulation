import * as WireInteractions from './WireInteractions.js';

export function installInteractionCoreCircuitWiringDelegates(InteractionManagerClass) {
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

        cancelWiring() {
            return WireInteractions.cancelWiring.call(this);
        }
    });
}
