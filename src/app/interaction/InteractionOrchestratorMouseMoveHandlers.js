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

export function handleWireEndpointDragMouseMove(e, canvasX, canvasY) {
    if (!(this.isDraggingWireEndpoint && this.wireEndpointDrag)) {
        return false;
    }

    const drag = this.wireEndpointDrag;
    const affected = Array.isArray(drag.affected) && drag.affected.length > 0
        ? drag.affected
        : [{ wireId: drag.wireId, end: drag.end }];
    const pointerType = this.resolvePointerType(e);

    const eventClientX = Number.isFinite(e?.clientX) ? Number(e.clientX) : 0;
    const eventClientY = Number.isFinite(e?.clientY) ? Number(e.clientY) : 0;
    const eventTimeStamp = Number.isFinite(e?.timeStamp) ? Number(e.timeStamp) : null;
    const previousClient = drag.lastClient
        && Number.isFinite(drag.lastClient.x)
        && Number.isFinite(drag.lastClient.y)
        ? drag.lastClient
        : null;
    const previousTimeStamp = Number.isFinite(drag.lastMoveTimeStamp)
        ? Number(drag.lastMoveTimeStamp)
        : null;
    if (previousClient && previousTimeStamp !== null && eventTimeStamp !== null && eventTimeStamp > previousTimeStamp) {
        const dt = eventTimeStamp - previousTimeStamp;
        const movePx = Math.hypot(eventClientX - previousClient.x, eventClientY - previousClient.y);
        drag.lastDragSpeedPxPerMs = movePx / dt;
    }
    drag.lastClient = { x: eventClientX, y: eventClientY };
    if (eventTimeStamp !== null) {
        drag.lastMoveTimeStamp = eventTimeStamp;
    }

    let lockedCanvasX = canvasX;
    let lockedCanvasY = canvasY;
    const startClient = drag.startClient
        && Number.isFinite(drag.startClient.x)
        && Number.isFinite(drag.startClient.y)
        ? drag.startClient
        : null;
    const movedFromStartPx = startClient
        ? Math.hypot(eventClientX - startClient.x, eventClientY - startClient.y)
        : 0;
    if ((pointerType === 'touch' || pointerType === 'pen') && drag.axisLock !== 'none') {
        const lockStartTime = Number.isFinite(drag.axisLockStartTime)
            ? Number(drag.axisLockStartTime)
            : null;
        const lockWindowMs = Number.isFinite(drag.axisLockWindowMs)
            ? Math.max(0, Number(drag.axisLockWindowMs))
            : 80;
        if (!drag.axisLock && startClient && Number.isFinite(startClient.x) && Number.isFinite(startClient.y)) {
            const dx = eventClientX - startClient.x;
            const dy = eventClientY - startClient.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const movedPx = Math.hypot(dx, dy);
            const withinWindow = lockStartTime === null || eventTimeStamp === null
                ? movedPx <= 24
                : (eventTimeStamp - lockStartTime) <= lockWindowMs;

            if (withinWindow && movedPx >= 4) {
                const dominanceRatio = 1.35;
                if (absDx >= absDy * dominanceRatio) {
                    drag.axisLock = 'x';
                } else if (absDy >= absDx * dominanceRatio) {
                    drag.axisLock = 'y';
                }
            } else if (!withinWindow) {
                drag.axisLock = 'none';
            }
        }
        if (drag.axisLock === 'x' && Number.isFinite(drag.origin?.y)) {
            lockedCanvasY = drag.origin.y;
        } else if (drag.axisLock === 'y' && Number.isFinite(drag.origin?.x)) {
            lockedCanvasX = drag.origin.x;
        }
    }

    if (!drag.excludeOriginTerminals && drag.originTerminalKeys instanceof Set && drag.originTerminalKeys.size > 0) {
        const releaseThresholdPx = pointerType === 'touch' ? 12 : pointerType === 'pen' ? 10 : 6;
        if (movedFromStartPx >= releaseThresholdPx) {
            drag.excludeOriginTerminals = true;
        }
    }

    const excludeWireEndpoints = new Set(affected.map((a) => `${a.wireId}:${a.end}`));
    const excludeWireIds = new Set(affected.map((a) => a.wireId));
    const snapOptions = {
        excludeWireEndpoints,
        allowWireSegmentSnap: true,
        excludeWireIds,
        pointerType,
        snapIntent: 'wire-endpoint-drag'
    };
    if (drag.excludeOriginTerminals && drag.originTerminalKeys instanceof Set && drag.originTerminalKeys.size > 0) {
        snapOptions.excludeTerminalKeys = drag.originTerminalKeys;
    }
    if (Number.isFinite(drag.lastDragSpeedPxPerMs)) {
        snapOptions.dragSpeedPxPerMs = drag.lastDragSpeedPxPerMs;
    }
    const snapped = this.snapPoint(lockedCanvasX, lockedCanvasY, snapOptions);
    drag.lastSnap = snapped.snap || null;
    drag.lastPoint = { x: snapped.x, y: snapped.y };

    const originX = Number(drag.origin?.x) || 0;
    const originY = Number(drag.origin?.y) || 0;
    const moved = Math.hypot(snapped.x - originX, snapped.y - originY) > 1e-6;
    if (moved && (pointerType === 'touch' || pointerType === 'pen') && !drag.longPressCancelled) {
        this.touchActionController?.cancel?.();
        drag.longPressCancelled = true;
    }
    if (moved && !drag.detached) {
        // Once movement starts, detach any terminal bindings so the junction can move freely.
        for (const a of affected) {
            const w = this.circuit.getWire(a.wireId);
            if (!w) continue;
            const refKey = a.end === 'a' ? 'aRef' : 'bRef';
            delete w[refKey];
        }
        drag.detached = true;
    }

    const terminalSnap = snapped.snap && snapped.snap.type === 'terminal'
        ? { componentId: snapped.snap.componentId, terminalIndex: snapped.snap.terminalIndex }
        : null;
    const wireSegmentSnap = snapped.snap && snapped.snap.type === 'wire-segment'
        ? { x: snapped.x, y: snapped.y }
        : null;
    const touchHighlightOptions = pointerType === 'touch'
        ? { pointerType, snapIntent: 'wire-endpoint-drag' }
        : null;

    const changedWireIds = new Set();
    for (const a of affected) {
        const w = this.circuit.getWire(a.wireId);
        if (!w || (a.end !== 'a' && a.end !== 'b')) continue;
        w[a.end] = { x: snapped.x, y: snapped.y };

        const refKey = a.end === 'a' ? 'aRef' : 'bRef';
        if (terminalSnap) {
            w[refKey] = { componentId: terminalSnap.componentId, terminalIndex: terminalSnap.terminalIndex };
        } else if (drag.detached) {
            delete w[refKey];
        }

        changedWireIds.add(a.wireId);
    }

    if (terminalSnap) {
        if (touchHighlightOptions) {
            this.renderer.highlightTerminal(terminalSnap.componentId, terminalSnap.terminalIndex, touchHighlightOptions);
        } else {
            this.renderer.highlightTerminal(terminalSnap.componentId, terminalSnap.terminalIndex);
        }
    } else if (wireSegmentSnap && typeof this.renderer.highlightWireNode === 'function') {
        if (touchHighlightOptions) {
            this.renderer.highlightWireNode(wireSegmentSnap.x, wireSegmentSnap.y, touchHighlightOptions);
        } else {
            this.renderer.highlightWireNode(wireSegmentSnap.x, wireSegmentSnap.y);
        }
    } else {
        this.renderer.clearTerminalHighlight();
    }
    for (const id of changedWireIds) {
        this.renderer.refreshWire(id);
    }
    return true;
}
