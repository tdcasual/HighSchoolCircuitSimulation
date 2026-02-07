import * as PointerSessionManager from './PointerSessionManager.js';
import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';
import * as EventBindingsController from './EventBindingsController.js';

export function installInteractionCoreInputEventDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        bindEvents() {
            return EventBindingsController.bindEvents.call(this);
        },

        bindZoomEvents() {
            return EventBindingsController.bindZoomEvents.call(this);
        },

        bindCanvasEvents() {
            return EventBindingsController.bindCanvasEvents.call(this);
        },

        bindKeyboardEvents() {
            return EventBindingsController.bindKeyboardEvents.call(this);
        },

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
        },

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
        },

        onMouseDown(e) {
            return InteractionOrchestrator.onMouseDown.call(this, e);
        },

        onMouseMove(e) {
            return InteractionOrchestrator.onMouseMove.call(this, e);
        },

        onMouseUp(e) {
            return InteractionOrchestrator.onMouseUp.call(this, e);
        },

        onMouseLeave(e) {
            return InteractionOrchestrator.onMouseLeave.call(this, e);
        },

        onContextMenu(e) {
            return InteractionOrchestrator.onContextMenu.call(this, e);
        },

        onDoubleClick(e) {
            return InteractionOrchestrator.onDoubleClick.call(this, e);
        }
    });
}
