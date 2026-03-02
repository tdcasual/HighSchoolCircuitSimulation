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
