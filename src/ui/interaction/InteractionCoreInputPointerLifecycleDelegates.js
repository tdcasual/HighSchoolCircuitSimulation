import * as PointerSessionManager from './PointerSessionManager.js';

export function installInteractionCoreInputPointerLifecycleDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        onPointerDown(e) {
            return PointerSessionManager.onPointerDown.call(this, e);
        },

        onPointerMove(e) {
            return PointerSessionManager.onPointerMove.call(this, e);
        },

        onPointerUp(e) {
            return PointerSessionManager.onPointerUp.call(this, e);
        },

        onPointerCancel(e) {
            return PointerSessionManager.onPointerCancel.call(this, e);
        },

        onPointerLeave(e) {
            return PointerSessionManager.onPointerLeave.call(this, e);
        },

        releasePointerCaptureSafe(pointerId) {
            return PointerSessionManager.releasePointerCaptureSafe.call(this, pointerId);
        }
    });
}
