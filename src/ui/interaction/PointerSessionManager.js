const DESTRUCTIVE_TAP_RULES = Object.freeze({
    touch: Object.freeze({ minPressMs: 140, maxMovePx: 14 }),
    pen: Object.freeze({ minPressMs: 90, maxMovePx: 10 }),
    mouse: Object.freeze({ minPressMs: 0, maxMovePx: 8 })
});

function normalizePointerSample(sample = {}) {
    return {
        pointerType: sample.pointerType || 'mouse',
        clientX: Number.isFinite(sample.clientX) ? sample.clientX : 0,
        clientY: Number.isFinite(sample.clientY) ? sample.clientY : 0,
        timeStamp: Number.isFinite(sample.timeStamp) ? sample.timeStamp : null
    };
}

function cloneWireStartSnapshot(wireStart) {
    if (!wireStart || !Number.isFinite(wireStart.x) || !Number.isFinite(wireStart.y)) {
        return null;
    }
    return {
        x: Number(wireStart.x),
        y: Number(wireStart.y),
        snap: wireStart.snap ? { ...wireStart.snap } : null
    };
}

function resolveSuspendedWireStartPoint(context, wireStartSnapshot) {
    if (!wireStartSnapshot) return null;
    const snap = wireStartSnapshot.snap || null;

    if (snap?.type === 'terminal') {
        const componentId = snap.componentId;
        const terminalIndex = Number(snap.terminalIndex);
        if (typeof componentId === 'string' && Number.isInteger(terminalIndex) && terminalIndex >= 0) {
            const pos = context?.renderer?.getTerminalPosition?.(componentId, terminalIndex);
            if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
                return { x: Number(pos.x), y: Number(pos.y), snap };
            }
        }
        return null;
    }

    if (snap?.type === 'wire-endpoint') {
        const wireId = snap.wireId;
        const end = snap.end;
        const wire = wireId ? context?.circuit?.getWire?.(wireId) : null;
        const point = wire && (end === 'a' || end === 'b') ? wire[end] : null;
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
            return { x: Number(point.x), y: Number(point.y), snap };
        }
        return null;
    }

    if (Number.isFinite(wireStartSnapshot.x) && Number.isFinite(wireStartSnapshot.y)) {
        return {
            x: Number(wireStartSnapshot.x),
            y: Number(wireStartSnapshot.y),
            snap
        };
    }

    return null;
}

function syncInteractionModeStore(context, options = {}) {
    const sync = context?.syncInteractionModeStore;
    if (typeof sync !== 'function') return null;
    try {
        return sync.call(context, options);
    } catch (_) {
        return null;
    }
}

function readInteractionModeStoreState(context) {
    const getter = context?.interactionModeStore?.getState;
    if (typeof getter !== 'function') return null;
    try {
        return getter.call(context.interactionModeStore);
    } catch (_) {
        return null;
    }
}

function suspendWiringForPinch(context) {
    if (!context?.isWiring) return;
    const wireStartSnapshot = cloneWireStartSnapshot(context.wireStart);
    if (!wireStartSnapshot) {
        context.cancelWiring?.();
        return;
    }
    const modeStoreContext = readInteractionModeStoreState(context)?.context || null;
    const pendingToolType = modeStoreContext?.pendingToolType ?? context.pendingToolType ?? null;
    const mobileInteractionMode = modeStoreContext?.mobileInteractionMode ?? context.mobileInteractionMode ?? 'select';
    const stickyWireTool = modeStoreContext?.stickyWireTool ?? context.stickyWireTool;

    context.suspendedWiringSession = {
        wireStart: wireStartSnapshot,
        pendingToolType,
        pendingToolItem: context.pendingToolItem ?? null,
        mobileInteractionMode,
        stickyWireTool: !!stickyWireTool
    };

    context.isWiring = false;
    context.wireStart = null;
    context.ignoreNextWireMouseUp = false;

    if (context.tempWire) {
        context.renderer?.removeTempWire?.(context.tempWire);
        context.tempWire = null;
    }

    context.hideAlignmentGuides?.();
    context.renderer?.clearTerminalHighlight?.();
    syncInteractionModeStore(context, {
        source: 'pointerSession.suspendWiringForPinch',
        context: { isWiring: false }
    });
}

function restoreWiringAfterPinch(context) {
    const session = context?.suspendedWiringSession;
    if (!session || !session.wireStart) return;
    context.suspendedWiringSession = null;

    context.pendingToolType = session.pendingToolType ?? null;
    context.pendingToolItem = session.pendingToolItem ?? null;
    context.mobileInteractionMode = session.mobileInteractionMode || context.mobileInteractionMode || 'select';
    context.stickyWireTool = !!session.stickyWireTool;
    context.syncMobileModeButtons?.();
    syncInteractionModeStore(context, {
        mode: 'wire',
        source: 'pointerSession.restoreWiringAfterPinch',
        context: {
            pendingToolType: context.pendingToolType,
            mobileInteractionMode: context.mobileInteractionMode,
            stickyWireTool: context.stickyWireTool
        }
    });

    const startPoint = resolveSuspendedWireStartPoint(context, session.wireStart);
    if (!startPoint) {
        context.cancelWiring?.();
        context.updateStatus?.('双指缩放后起点已失效，已取消连线');
        return;
    }

    if (typeof context.startWiringFromPoint === 'function') {
        context.startWiringFromPoint(startPoint, null, false);
    } else {
        context.isWiring = true;
        context.wireStart = { x: startPoint.x, y: startPoint.y, snap: startPoint.snap || null };
        context.ignoreNextWireMouseUp = false;
    }
    syncInteractionModeStore(context, {
        mode: 'wire',
        source: 'pointerSession.restoreWiringAfterPinch:start-wiring',
        context: { isWiring: true }
    });
    context.updateStatus?.('导线模式：选择终点');
}

export function isIntentionalDestructiveTap(pointerStart = null, pointerEnd = null, options = {}) {
    const start = normalizePointerSample(pointerStart || pointerEnd || {});
    const end = normalizePointerSample(pointerEnd || pointerStart || {});
    const pointerType = end.pointerType || start.pointerType || 'mouse';
    const rule = DESTRUCTIVE_TAP_RULES[pointerType] || DESTRUCTIVE_TAP_RULES.mouse;
    const maxMovePx = Number.isFinite(options.maxMovePx) ? options.maxMovePx : rule.maxMovePx;
    const minPressMs = Number.isFinite(options.minPressMs) ? options.minPressMs : rule.minPressMs;

    const movePx = Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY);
    if (movePx > maxMovePx) return false;

    if (pointerType === 'mouse') return true;

    if (!Number.isFinite(start.timeStamp) || !Number.isFinite(end.timeStamp)) {
        return false;
    }
    const pressMs = Math.max(0, end.timeStamp - start.timeStamp);
    return pressMs >= minPressMs;
}

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
    const setPointerCapture = this?.svg?.setPointerCapture;
    if (typeof setPointerCapture === 'function') {
        try { setPointerCapture.call(this.svg, e.pointerId); } catch (_) {}
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
        const hadTerminalExtending = !!this.isTerminalExtending;
        const hadRheostatDragging = !!this.isRheostatDragging;
        const modeStoreState = readInteractionModeStoreState(this);
        const modeStoreContext = modeStoreState?.context || null;
        const storeReportsEditLikeDrag = !!(
            modeStoreState?.mode === 'endpoint-edit'
            || modeStoreContext?.isDraggingWireEndpoint
            || modeStoreContext?.isTerminalExtending
            || modeStoreContext?.isRheostatDragging
        );
        const hasEditLikeDrag = !!(
            this.isDraggingWireEndpoint
            || this.isDraggingWire
            || this.isDragging
            || hadTerminalExtending
            || hadRheostatDragging
            || this.wireModeGesture
            || storeReportsEditLikeDrag
        );
        if (this.isWiring && !hasEditLikeDrag) {
            this.cancelWiring();
        }
        this.onMouseLeave(e);
        if (hadTerminalExtending) {
            this.hideAlignmentGuides?.();
            this.circuit?.rebuildNodes?.();
            this.commitHistoryTransaction?.();
        } else if (hadRheostatDragging) {
            this.hideAlignmentGuides?.();
            this.commitHistoryTransaction?.();
        }
        if (this.isWiring) {
            this.ignoreNextWireMouseUp = false;
        }
        this.isTerminalExtending = false;
        this.isRheostatDragging = false;
        syncInteractionModeStore(this, { source: 'pointerSession.onPointerCancel' });
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
    if (this.pinchGesture) {
        let hasCapture = false;
        try {
            hasCapture = !!this.svg?.hasPointerCapture?.(e.pointerId);
        } catch (_) {
            hasCapture = false;
        }
        if (hasCapture) return;

        this.activePointers.delete(e.pointerId);
        this.endPinchGestureIfNeeded();
        this.releasePointerCaptureSafe(e.pointerId);
        if (this.activePointers.size === 0) {
            this.blockSinglePointerInteraction = false;
            this.lastPrimaryPointerType = 'mouse';
        }
        return;
    }
    if ((e.buttons || 0) !== 0) {
        let hasCapture = false;
        try {
            hasCapture = !!this.svg?.hasPointerCapture?.(e.pointerId);
        } catch (_) {
            hasCapture = false;
        }
        if (hasCapture) return;
    }
    if (this.primaryPointerId === e.pointerId) {
        this.onMouseLeave(e);
        this.primaryPointerId = null;
    }
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
        this.primaryPointerId = null;
        this.blockSinglePointerInteraction = false;
        this.lastPrimaryPointerType = 'mouse';
    }
}

export function releasePointerCaptureSafe(pointerId) {
    const svg = this?.svg;
    const releasePointerCapture = svg?.releasePointerCapture;
    if (typeof releasePointerCapture !== 'function') return;
    try {
        const hasPointerCapture = svg?.hasPointerCapture;
        if (typeof hasPointerCapture === 'function' && hasPointerCapture.call(svg, pointerId)) {
            releasePointerCapture.call(svg, pointerId);
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
        if (this?.svg?.style) {
            this.svg.style.cursor = '';
        }
    }

    const hadTerminalExtending = !!this.isTerminalExtending;
    const hadRheostatDragging = !!this.isRheostatDragging;
    this.isTerminalExtending = false;
    this.isRheostatDragging = false;
    if (hadTerminalExtending) {
        this.hideAlignmentGuides?.();
        this.circuit?.rebuildNodes?.();
        this.commitHistoryTransaction?.();
    } else if (hadRheostatDragging) {
        this.hideAlignmentGuides?.();
        this.commitHistoryTransaction?.();
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

    suspendWiringForPinch(this);
    syncInteractionModeStore(this, { source: 'pointerSession.endPrimaryInteractionForGesture' });
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

    const rect = this?.svg?.getBoundingClientRect?.() || { left: 0, top: 0 };
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
    restoreWiringAfterPinch(this);
}
