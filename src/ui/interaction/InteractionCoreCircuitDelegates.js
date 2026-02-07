import * as WireInteractions from './WireInteractions.js';
import * as DragBehaviors from './DragBehaviors.js';
import * as ComponentActions from './ComponentActions.js';
import * as SnapController from './SnapController.js';

export function installInteractionCoreCircuitDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        addComponent(type, x, y) {
            return ComponentActions.addComponent.call(this, type, x, y);
        },

        deleteComponent(id) {
            return ComponentActions.deleteComponent.call(this, id);
        },

        deleteWire(id) {
            return ComponentActions.deleteWire.call(this, id);
        },

        rotateComponent(id) {
            return ComponentActions.rotateComponent.call(this, id);
        },

        toggleSwitch(id) {
            return ComponentActions.toggleSwitch.call(this, id);
        },

        startDragging(componentG, e) {
            return DragBehaviors.startDragging.call(this, componentG, e);
        },

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

        resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
            return WireInteractions.resolveCompactedWireId.call(this, wireId, replacementByRemovedId);
        },

        compactWiresAndRefresh(options = {}) {
            return WireInteractions.compactWiresAndRefresh.call(this, options);
        },

        snapPoint(x, y, options = {}) {
            return SnapController.snapPoint.call(this, x, y, options);
        },

        findNearbyWireEndpoint(x, y, threshold, excludeWireId = null, excludeEnd = null, excludeWireEndpoints = null) {
            return WireInteractions.findNearbyWireEndpoint.call(
                this,
                x,
                y,
                threshold,
                excludeWireId,
                excludeEnd,
                excludeWireEndpoints
            );
        },

        findNearbyWireSegment(x, y, threshold, excludeWireId = null) {
            return WireInteractions.findNearbyWireSegment.call(this, x, y, threshold, excludeWireId);
        },

        splitWireAtPoint(wireId, x, y) {
            return WireInteractions.splitWireAtPoint.call(this, wireId, x, y);
        },

        splitWireAtPointInternal(wireId, x, y, options = {}) {
            return WireInteractions.splitWireAtPointInternal.call(this, wireId, x, y, options);
        },

        cancelWiring() {
            return WireInteractions.cancelWiring.call(this);
        },

        registerDragListeners(startEvent, onMove, onUp) {
            return DragBehaviors.registerDragListeners.call(this, startEvent, onMove, onUp);
        },

        startTerminalExtend(componentId, terminalIndex, e) {
            return DragBehaviors.startTerminalExtend.call(this, componentId, terminalIndex, e);
        },

        startRheostatDrag(componentId, e) {
            return DragBehaviors.startRheostatDrag.call(this, componentId, e);
        },

        startParallelPlateCapacitorDrag(componentId, e) {
            return DragBehaviors.startParallelPlateCapacitorDrag.call(this, componentId, e);
        }
    });
}
