import * as WireInteractions from './WireInteractions.js';

export const interactionCoreCircuitWiringFlowMethods = {
        startWiringFromPoint(point, e = null, armMouseUpGuard = false) {
            return WireInteractions.startWiringFromPoint.call(this, point, e, armMouseUpGuard);
        },

        finishWiringToPoint(point, options = {}) {
            return WireInteractions.finishWiringToPoint.call(this, point, options);
        },

        addWireAt(x, y) {
            return WireInteractions.addWireAt.call(this, x, y);
        },

        cancelWiring() {
            return WireInteractions.cancelWiring.call(this);
        }
    };
