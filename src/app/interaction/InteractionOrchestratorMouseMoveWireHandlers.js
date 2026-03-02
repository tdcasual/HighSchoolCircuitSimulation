import { GRID_SIZE, snapToGrid, toCanvasInt } from '../../utils/CanvasCoords.js';
import { resolveLiveWireStart } from './InteractionOrchestratorHelpers.js';
export { handleWireEndpointDragMouseMove } from './InteractionOrchestratorMouseMoveWireEndpointHandlers.js';

export function handleWireModeGestureMouseMove(e) {
    if (!this.wireModeGesture) {
        return false;
    }

    const gesture = this.wireModeGesture;
    const moved = Math.hypot(
        (e.clientX || 0) - (gesture.screenX || 0),
        (e.clientY || 0) - (gesture.screenY || 0)
    );
    if (moved >= (gesture.moveThresholdPx || 12)) {
        const wasWiring = !!gesture.wasWiring;
        let endpointDragStarted = false;
        if (gesture.kind === 'wire-endpoint') {
            const wasDraggingWireEndpoint = !!this.isDraggingWireEndpoint;
            this.startWireEndpointDrag(gesture.wireId, gesture.end, e);
            endpointDragStarted = !wasDraggingWireEndpoint && !!this.isDraggingWireEndpoint;
        } else if (gesture.kind === 'rheostat-slider-terminal') {
            this.startRheostatDrag(gesture.componentId, e);
        } else {
            this.startTerminalExtend(gesture.componentId, gesture.terminalIndex, e);
        }
        // During weak-merge edit drags in active wiring state, consume this pointer-up
        // so it does not accidentally finalize/cancel the pending wire.
        if (wasWiring && (gesture.kind !== 'wire-endpoint' || !endpointDragStarted)) {
            this.ignoreNextWireMouseUp = true;
        }
        this.wireModeGesture = null;
    }
    return true;
}

export function handleWireDragMouseMove(e, canvasX, canvasY) {
    if (!(this.isDraggingWire && this.wireDrag)) {
        return false;
    }

    const drag = this.wireDrag;
    const wire = this.circuit.getWire(drag.wireId);
    if (!wire || !wire.a || !wire.b) {
        return true;
    }
    const pointerType = this.resolvePointerType(e);

    const dxScreen = e.clientX - (drag.startClient?.x || 0);
    const dyScreen = e.clientY - (drag.startClient?.y || 0);
    const movedScreen = Math.hypot(dxScreen, dyScreen);
    const moveThreshold = 3; // px
    if (movedScreen >= moveThreshold && (pointerType === 'touch' || pointerType === 'pen') && !drag.longPressCancelled) {
        this.touchActionController?.cancel?.();
        drag.longPressCancelled = true;
    }

    const rawDx = canvasX - (drag.startCanvas?.x || 0);
    const rawDy = canvasY - (drag.startCanvas?.y || 0);
    const snappedDx = e.shiftKey ? snapToGrid(rawDx, GRID_SIZE) : toCanvasInt(rawDx);
    const snappedDy = e.shiftKey ? snapToGrid(rawDy, GRID_SIZE) : toCanvasInt(rawDy);

    // Avoid accidental micro-moves: only start applying translation after threshold.
    if (movedScreen < moveThreshold && snappedDx === 0 && snappedDy === 0) {
        return true;
    }

    if (!drag.detached && (snappedDx !== 0 || snappedDy !== 0)) {
        // Dragging a wire segment translates both endpoints; detach any terminal bindings.
        delete wire.aRef;
        delete wire.bRef;
        drag.detached = true;
    }

    if (snappedDx === drag.lastDx && snappedDy === drag.lastDy) {
        return true;
    }
    drag.lastDx = snappedDx;
    drag.lastDy = snappedDy;

    wire.a = { x: (drag.startA?.x || 0) + snappedDx, y: (drag.startA?.y || 0) + snappedDy };
    wire.b = { x: (drag.startB?.x || 0) + snappedDx, y: (drag.startB?.y || 0) + snappedDy };
    this.renderer.refreshWire(drag.wireId);
    return true;
}

export function handleWiringPreviewMouseMove(e, canvasX, canvasY) {
    if (!(this.isWiring && this.wireStart && this.tempWire)) {
        return false;
    }

    const preview = this.snapPoint(canvasX, canvasY, {
        allowWireSegmentSnap: true,
        pointerType: this.resolvePointerType(e)
    });
    const startAnchor = resolveLiveWireStart(this) || this.wireStart;
    if (startAnchor && this.wireStart) {
        this.wireStart.x = startAnchor.x;
        this.wireStart.y = startAnchor.y;
        this.wireStart.snap = startAnchor.snap || this.wireStart.snap || null;
    }
    this.renderer.updateTempWire(this.tempWire, startAnchor.x, startAnchor.y, preview.x, preview.y);
    if (preview.snap?.type === 'terminal') {
        this.renderer.highlightTerminal(preview.snap.componentId, preview.snap.terminalIndex);
    } else if (preview.snap?.type === 'wire-segment' && typeof this.renderer.highlightWireNode === 'function') {
        this.renderer.highlightWireNode(preview.x, preview.y);
    } else {
        this.renderer.clearTerminalHighlight();
    }
    return true;
}
