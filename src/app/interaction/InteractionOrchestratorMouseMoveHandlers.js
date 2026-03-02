import { GRID_SIZE, snapToGrid, toCanvasInt } from '../../utils/CanvasCoords.js';
import { resolveLiveWireStart } from './InteractionOrchestratorHelpers.js';

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

export function handleComponentDragMouseMove(_e, canvasX, canvasY) {
    if (!(this.isDragging && this.dragTarget)) {
        return false;
    }

    const comp = this.circuit.getComponent(this.dragTarget);
    if (!comp) {
        return false;
    }

    // 计算新位置（不强制对齐网格，实现平滑移动）
    let newX = canvasX - this.dragOffset.x;
    let newY = canvasY - this.dragOffset.y;

    // 检测与其他元器件的对齐
    const alignment = this.detectAlignment(comp.id, newX, newY);

    // 应用吸附
    if (alignment.snapX !== null) {
        newX = alignment.snapX;
    }
    if (alignment.snapY !== null) {
        newY = alignment.snapY;
    }

    // Normalize to integer pixels to avoid hidden rounding in node connectivity.
    newX = toCanvasInt(newX);
    newY = toCanvasInt(newY);

    // 黑箱：整体移动（包含盒内元件与盒内导线端点）
    if (comp.type === 'BlackBox' && this.dragGroup && this.dragGroup.boxId === comp.id) {
        const dx = newX - (comp.x || 0);
        const dy = newY - (comp.y || 0);

        comp.x = newX;
        comp.y = newY;

        // 移动盒内元件
        for (const id of this.dragGroup.componentIds) {
            const inner = this.circuit.getComponent(id);
            if (!inner) continue;
            inner.x = toCanvasInt((inner.x || 0) + dx);
            inner.y = toCanvasInt((inner.y || 0) + dy);
            this.renderer.updateComponentTransform(inner);
        }

        // 移动与黑箱组相关的导线端点（按拖动开始时的 inside mask）
        for (const wireId of this.dragGroup.connectedWireIds) {
            const wire = this.circuit.getWire(wireId);
            const mask = this.dragGroup.wireEndpointMask?.get(wireId);
            if (!wire || !mask) continue;
            if (mask.aInside && wire.a) {
                wire.a = {
                    x: toCanvasInt((wire.a.x || 0) + dx),
                    y: toCanvasInt((wire.a.y || 0) + dy)
                };
            }
            if (mask.bInside && wire.b) {
                wire.b = {
                    x: toCanvasInt((wire.b.x || 0) + dx),
                    y: toCanvasInt((wire.b.y || 0) + dy)
                };
            }
        }

        // 更新黑箱自身 transform
        this.renderer.updateComponentTransform(comp);

        // 刷新与组相关的导线（含外部连接）
        for (const wireId of this.dragGroup.connectedWireIds) {
            this.renderer.refreshWire(wireId);
        }
    } else {
        // 普通元器件：更新位置
        comp.x = newX;
        comp.y = newY;
        this.renderer.updateComponentPosition(comp);
    }

    // 显示对齐辅助线
    this.showAlignmentGuides(alignment);
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
