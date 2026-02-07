import * as PointerSessionManager from './PointerSessionManager.js';
import * as ViewportController from './ViewportController.js';
import * as SnapController from './SnapController.js';
import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';
import * as ToolPlacementController from './ToolPlacementController.js';
import * as PanelBindingsController from './PanelBindingsController.js';
import * as InputResolver from './InputResolver.js';
import * as UIStateController from './UIStateController.js';
import * as ToolboxBindingsController from './ToolboxBindingsController.js';
import * as EventBindingsController from './EventBindingsController.js';
import * as CoordinateTransforms from './CoordinateTransforms.js';

export function installInteractionCoreInputDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        screenToCanvas(clientX, clientY) {
            return ViewportController.screenToCanvas.call(this, clientX, clientY);
        },

        canvasToComponentLocal(comp, canvasPoint) {
            return CoordinateTransforms.canvasToComponentLocal(comp, canvasPoint);
        },

        bindEvents() {
            return EventBindingsController.bindEvents.call(this);
        },

        bindZoomEvents() {
            return EventBindingsController.bindZoomEvents.call(this);
        },

        bindToolboxEvents() {
            return ToolboxBindingsController.bindToolboxEvents.call(this);
        },

        bindCanvasEvents() {
            return EventBindingsController.bindCanvasEvents.call(this);
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

        setPendingToolType(type, item = null) {
            return ToolPlacementController.setPendingToolType.call(this, type, item);
        },

        clearPendingToolType(options = {}) {
            return ToolPlacementController.clearPendingToolType.call(this, options);
        },

        placePendingToolAt(clientX, clientY) {
            return ToolPlacementController.placePendingToolAt.call(this, clientX, clientY);
        },

        onWheel(e) {
            return ViewportController.onWheel.call(this, e);
        },

        bindButtonEvents() {
            return PanelBindingsController.bindButtonEvents.call(this);
        },

        bindSidePanelEvents() {
            return PanelBindingsController.bindSidePanelEvents.call(this);
        },

        isObservationTabActive() {
            return UIStateController.isObservationTabActive.call(this);
        },

        bindKeyboardEvents() {
            return EventBindingsController.bindKeyboardEvents.call(this);
        },

        resolveTerminalTarget(target) {
            return InputResolver.resolveTerminalTarget.call(this, target);
        },

        resolveProbeMarkerTarget(target) {
            return InputResolver.resolveProbeMarkerTarget.call(this, target);
        },

        resolvePointerType(event) {
            return InputResolver.resolvePointerType.call(this, event);
        },

        getAdaptiveSnapThreshold(options = {}) {
            return SnapController.getAdaptiveSnapThreshold.call(this, options);
        },

        isWireEndpointTarget(target) {
            return InputResolver.isWireEndpointTarget.call(this, target);
        },

        onMouseDown(e) {
            return InteractionOrchestrator.onMouseDown.call(this, e);
        },

        startPanning(e) {
            return ViewportController.startPanning.call(this, e);
        },

        updateViewTransform() {
            return ViewportController.updateViewTransform.call(this);
        },

        resetView() {
            return ViewportController.resetView.call(this);
        },

        getCircuitBounds() {
            return ViewportController.getCircuitBounds.call(this);
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
