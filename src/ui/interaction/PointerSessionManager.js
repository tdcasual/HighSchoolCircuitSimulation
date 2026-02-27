export function onPointerDown(e) {
    const pointerType = e.pointerType || 'mouse';
    if (pointerType !== 'mouse') {
        e.preventDefault();
    }
    this.activePointers.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
        pointerType
    });
    if (typeof this.svg.setPointerCapture === 'function') {
        try { this.svg.setPointerCapture(e.pointerId); } catch (_) {}
    }

    this.touchActionController?.onPointerDown?.(e);

    if (this.shouldStartPinchGesture()) {
        this.touchActionController?.cancel?.();
        this.startPinchGesture();
        return;
    }

    if (this.blockSinglePointerInteraction) return;

    if (this.primaryPointerId === null) {
        this.primaryPointerId = e.pointerId;
        this.lastPrimaryPointerType = pointerType;
    }
    if (this.primaryPointerId !== e.pointerId) return;

    this.lastPrimaryPointerType = pointerType;

    this.onMouseDown(e);
}

export function onPointerMove(e) {
    const pointerType = e.pointerType || 'mouse';
    if (pointerType !== 'mouse') {
        e.preventDefault();
    }
    const tracked = this.activePointers.get(e.pointerId);
    if (tracked) {
        tracked.clientX = e.clientX;
        tracked.clientY = e.clientY;
        tracked.pointerType = pointerType;
    }

    this.touchActionController?.onPointerMove?.(e);

    if (this.pinchGesture) {
        this.updatePinchGesture();
        return;
    }

    if (this.blockSinglePointerInteraction) return;
    if (this.primaryPointerId !== e.pointerId) return;
    this.lastPrimaryPointerType = pointerType;
    this.onMouseMove(e);
}

export function onPointerUp(e) {
    const consumedByTouchAction = this.touchActionController?.onPointerUp?.(e) === true;
    if (this.pinchGesture) {
        this.activePointers.delete(e.pointerId);
        this.endPinchGestureIfNeeded();
        this.releasePointerCaptureSafe(e.pointerId);
        if (this.activePointers.size === 0) {
            this.blockSinglePointerInteraction = false;
        }
        return;
    }

    if (consumedByTouchAction) {
        if (this.primaryPointerId === e.pointerId) {
            this.primaryPointerId = null;
        }
        this.activePointers.delete(e.pointerId);
        this.releasePointerCaptureSafe(e.pointerId);
        if (this.activePointers.size === 0) {
            this.blockSinglePointerInteraction = false;
            this.lastPrimaryPointerType = 'mouse';
        }
        return;
    }

    if (!this.blockSinglePointerInteraction && this.primaryPointerId === e.pointerId) {
        this.onMouseUp(e);
        this.primaryPointerId = null;
    }

    this.activePointers.delete(e.pointerId);
    this.releasePointerCaptureSafe(e.pointerId);

    if (this.activePointers.size === 0) {
        this.primaryPointerId = null;
        this.blockSinglePointerInteraction = false;
        this.lastPrimaryPointerType = 'mouse';
    }
}

export function onPointerCancel(e) {
    this.touchActionController?.onPointerCancel?.(e);
    if (this.pinchGesture) {
        this.activePointers.delete(e.pointerId);
        this.endPinchGestureIfNeeded();
    } else if (!this.blockSinglePointerInteraction && this.primaryPointerId === e.pointerId) {
        this.cancelWiring();
        this.onMouseLeave(e);
        this.primaryPointerId = null;
    }

    this.activePointers.delete(e.pointerId);
    this.releasePointerCaptureSafe(e.pointerId);
    if (this.activePointers.size === 0) {
        this.blockSinglePointerInteraction = false;
        this.lastPrimaryPointerType = 'mouse';
    }
}

export function onPointerLeave(e) {
    this.touchActionController?.onPointerCancel?.(e);
    // 使用 pointer capture 时，不在离开画布瞬间终止拖动。
    if (this.pinchGesture) return;
    if ((e.buttons || 0) !== 0) return;
    if (this.primaryPointerId === e.pointerId) {
        this.onMouseLeave(e);
        this.primaryPointerId = null;
    }
    this.activePointers.delete(e.pointerId);
}

export function releasePointerCaptureSafe(pointerId) {
    if (typeof this.svg.releasePointerCapture !== 'function') return;
    try {
        if (this.svg.hasPointerCapture && this.svg.hasPointerCapture(pointerId)) {
            this.svg.releasePointerCapture(pointerId);
        }
    } catch (_) {}
}

export function shouldStartPinchGesture() {
    if (this.activePointers.size < 2) return false;
    let nonMouse = 0;
    for (const p of this.activePointers.values()) {
        if (p.pointerType !== 'mouse') nonMouse += 1;
    }
    return nonMouse >= 2;
}

export function getGesturePointers() {
    const entries = [];
    for (const [pointerId, p] of this.activePointers.entries()) {
        if (p.pointerType === 'mouse') continue;
        entries.push({ pointerId, ...p });
        if (entries.length >= 2) break;
    }
    return entries.length >= 2 ? entries : null;
}

export function endPrimaryInteractionForGesture() {
    if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = '';
    }

    if (this.isDraggingWireEndpoint) {
        const drag = this.wireEndpointDrag;
        this.isDraggingWireEndpoint = false;
        this.wireEndpointDrag = null;
        const affectedIds = Array.isArray(drag?.affected)
            ? drag.affected.map((item) => item?.wireId).filter(Boolean)
            : [];
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: affectedIds
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }

    if (this.isDraggingWire) {
        const drag = this.wireDrag;
        this.isDraggingWire = false;
        this.wireDrag = null;
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: drag?.wireId ? [drag.wireId] : null
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }

    if (this.isDragging) {
        this.isDragging = false;
        this.dragTarget = null;
        this.isDraggingComponent = false;
        this.dragGroup = null;
        this.hideAlignmentGuides();
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }

    if (this.isWiring) {
        this.cancelWiring();
    }
}

export function startPinchGesture() {
    const pointers = this.getGesturePointers();
    if (!pointers) return;

    this.touchActionController?.cancel?.();
    this.endPrimaryInteractionForGesture();

    const [p1, p2] = pointers;
    const dx = p2.clientX - p1.clientX;
    const dy = p2.clientY - p1.clientY;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 1e-6) return;

    const midClientX = (p1.clientX + p2.clientX) / 2;
    const midClientY = (p1.clientY + p2.clientY) / 2;
    const pivot = this.screenToCanvas(midClientX, midClientY);

    this.pinchGesture = {
        pointerAId: p1.pointerId,
        pointerBId: p2.pointerId,
        startScale: this.scale,
        startDistance: Math.max(distance, 1),
        startCanvasPivot: pivot
    };

    this.primaryPointerId = null;
    this.blockSinglePointerInteraction = true;
}

export function updatePinchGesture() {
    if (!this.pinchGesture) return;

    const p1 = this.activePointers.get(this.pinchGesture.pointerAId);
    const p2 = this.activePointers.get(this.pinchGesture.pointerBId);
    if (!p1 || !p2) return;

    const dx = p2.clientX - p1.clientX;
    const dy = p2.clientY - p1.clientY;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const midClientX = (p1.clientX + p2.clientX) / 2;
    const midClientY = (p1.clientY + p2.clientY) / 2;

    const ratio = distance / this.pinchGesture.startDistance;
    const minScale = 0.1;
    const maxScale = 4;
    const nextScale = Math.min(Math.max(this.pinchGesture.startScale * ratio, minScale), maxScale);

    const rect = this.svg.getBoundingClientRect();
    const midX = midClientX - rect.left;
    const midY = midClientY - rect.top;

    this.scale = nextScale;
    this.viewOffset.x = midX - this.pinchGesture.startCanvasPivot.x * this.scale;
    this.viewOffset.y = midY - this.pinchGesture.startCanvasPivot.y * this.scale;
    this.updateViewTransform();
}

export function endPinchGestureIfNeeded() {
    if (!this.pinchGesture) return;
    const p1 = this.activePointers.has(this.pinchGesture.pointerAId);
    const p2 = this.activePointers.has(this.pinchGesture.pointerBId);
    if (p1 && p2) return;
    this.pinchGesture = null;
}
