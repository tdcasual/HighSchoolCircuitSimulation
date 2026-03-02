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

export function handlePointerDownInfoMouseMove(e) {
    if (!(this.pointerDownInfo && !this.pointerDownInfo.moved)) {
        return false;
    }

    const pointerType = this.pointerDownInfo.pointerType || this.resolvePointerType(e);
    const threshold = pointerType === 'touch' ? 12 : pointerType === 'pen' ? 10 : 6;
    const moved = Math.hypot(
        (e.clientX || 0) - (this.pointerDownInfo.screenX || 0),
        (e.clientY || 0) - (this.pointerDownInfo.screenY || 0)
    );
    if (moved > threshold) {
        this.pointerDownInfo.moved = true;
        if ((pointerType === 'touch' || pointerType === 'pen') && this.touchActionController?.cancel) {
            this.touchActionController.cancel();
        }
    }
    return true;
}

export function handlePanningMouseMove(e) {
    if (!this.isPanning) {
        return false;
    }

    this.viewOffset = {
        x: e.clientX - this.panStart.x,
        y: e.clientY - this.panStart.y
    };
    this.updateViewTransform();
    return true;
}
