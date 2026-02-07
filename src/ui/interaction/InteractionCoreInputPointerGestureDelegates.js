import * as PointerSessionManager from './PointerSessionManager.js';

export function installInteractionCoreInputPointerGestureDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        shouldStartPinchGesture() {
            return PointerSessionManager.shouldStartPinchGesture.call(this);
        },

        getGesturePointers() {
            return PointerSessionManager.getGesturePointers.call(this);
        },

        endPrimaryInteractionForGesture() {
            return PointerSessionManager.endPrimaryInteractionForGesture.call(this);
        },

        startPinchGesture() {
            return PointerSessionManager.startPinchGesture.call(this);
        },

        updatePinchGesture() {
            return PointerSessionManager.updatePinchGesture.call(this);
        },

        endPinchGestureIfNeeded() {
            return PointerSessionManager.endPinchGestureIfNeeded.call(this);
        }
    });
}
