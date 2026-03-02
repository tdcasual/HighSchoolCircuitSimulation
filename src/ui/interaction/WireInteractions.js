import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';
import { setWiringActive } from '../../app/interaction/InteractionModeBridge.js';

function resolveScaledThreshold(context, screenPx) {
    const scale = Number(context?.scale);
    if (!Number.isFinite(scale) || scale <= 0) return screenPx;
    return screenPx / scale;
}

function resolveLiveWireStart(context) {
    const wireStart = context?.wireStart;
    if (!wireStart) return null;

    const snap = wireStart.snap || null;
    if (snap?.type === 'terminal') {
        const componentId = snap.componentId;
        const terminalIndex = Number(snap.terminalIndex);
        if (componentId && Number.isInteger(terminalIndex) && terminalIndex >= 0) {
            const pos = context?.renderer?.getTerminalPosition?.(componentId, terminalIndex);
            if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
                return {
                    x: toCanvasInt(pos.x),
                    y: toCanvasInt(pos.y),
                    snap
                };
            }
        }
    } else if (snap?.type === 'wire-endpoint') {
        const wireId = snap.wireId;
        const end = snap.end;
        const wire = wireId ? context?.circuit?.getWire?.(wireId) : null;
        const point = wire && (end === 'a' || end === 'b') ? wire[end] : null;
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
            return {
                x: toCanvasInt(point.x),
                y: toCanvasInt(point.y),
                snap
            };
        }
    }

    if (Number.isFinite(wireStart.x) && Number.isFinite(wireStart.y)) {
        return {
            x: toCanvasInt(wireStart.x),
            y: toCanvasInt(wireStart.y),
            snap
        };
    }
    return null;
}

export function addWireAt(x, y) {
    this.runWithHistory('添加导线', () => {
        const cy = toCanvasInt(y);
        const start = { x: toCanvasInt(x - 30), y: cy };
        const end = { x: toCanvasInt(x + 30), y: cy };
        const wire = {
            id: `wire_${Date.now()}`,
            a: start,
            b: end
        };
        this.circuit.addWire(wire);
        this.renderer.addWire(wire);
        this.selectWire(wire.id);
        this.updateStatus('已添加导线');
    });
}

/**
 * 从任意画布点开始连线（Model C）
 */
export function startWiringFromPoint(point, e = null, armMouseUpGuard = false) {
    if (!point) return;

    // 确保清除任何残留的辅助线和高亮
    this.hideAlignmentGuides();
    this.renderer.clearTerminalHighlight();

    const start = this.snapPoint(point.x, point.y, {
        allowWireSegmentSnap: true,
        pointerType: this.resolvePointerType(e)
    });

    setWiringActive(this, true, {
        mode: 'wire',
        source: 'wire.startWiringFromPoint'
    });
    this.wireStart = { x: start.x, y: start.y, snap: start.snap || null };

    // 创建临时导线
    this.tempWire = this.renderer.createTempWire();

    const cursor = e ? this.screenToCanvas(e.clientX, e.clientY) : start;
    this.renderer.updateTempWire(this.tempWire, start.x, start.y, cursor.x, cursor.y);
    this.ignoreNextWireMouseUp = !!armMouseUpGuard;
}

/**
 * 结束连线到某一点（Model C）
 */
export function finishWiringToPoint(point, options = {}) {
    if (!this.wireStart || !point) {
        this.cancelWiring();
        return;
    }

    const liveStart = resolveLiveWireStart(this);
    if (liveStart && this.wireStart) {
        this.wireStart.x = liveStart.x;
        this.wireStart.y = liveStart.y;
        this.wireStart.snap = liveStart.snap || this.wireStart.snap || null;
    }

    const startSource = liveStart || this.wireStart;
    const start = {
        x: toCanvasInt(startSource.x),
        y: toCanvasInt(startSource.y),
        snap: startSource.snap || null
    };
    const end = point && point.snap
        ? { x: toCanvasInt(point.x), y: toCanvasInt(point.y), snap: point.snap || null }
        : this.snapPoint(point.x, point.y, {
            allowWireSegmentSnap: true,
            pointerType: options.pointerType
        });
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist < 1e-6) {
        this.cancelWiring();
        return;
    }

    this.runWithHistory('添加导线', () => {
        this.circuit.beginTopologyBatch();
        try {
            const ensureUniqueWireId = (baseId = `wire_${Date.now()}`) => {
                if (!this.circuit.getWire(baseId)) return baseId;
                let i = 1;
                while (this.circuit.getWire(`${baseId}_${i}`)) i++;
                return `${baseId}_${i}`;
            };

            const splitCreatedIds = [];
            const resolvePointAfterSegmentSplit = (snap, fallbackPoint) => {
                const pointCandidate = {
                    x: toCanvasInt(fallbackPoint.x),
                    y: toCanvasInt(fallbackPoint.y)
                };
                if (!snap || snap.type !== 'wire-segment' || !snap.wireId) {
                    return pointCandidate;
                }

                const splitResult = this.splitWireAtPointInternal(
                    snap.wireId,
                    pointCandidate.x,
                    pointCandidate.y,
                    { ensureUniqueWireId }
                );
                if (splitResult?.created && splitResult?.newWireId) {
                    splitCreatedIds.push(splitResult.newWireId);
                }
                if (splitResult?.point) {
                    return {
                        x: toCanvasInt(splitResult.point.x),
                        y: toCanvasInt(splitResult.point.y)
                    };
                }
                return pointCandidate;
            };

            const startPoint = resolvePointAfterSegmentSplit(start.snap, start);
            const endPoint = resolvePointAfterSegmentSplit(end.snap, end);

            if (Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) < 1e-6) {
                this.cancelWiring();
                return;
            }

            // Auto-route: prefer orthogonal (Manhattan) wiring with a single corner.
            const points = [{ x: startPoint.x, y: startPoint.y }];
            if (startPoint.x !== endPoint.x && startPoint.y !== endPoint.y) {
                const dx = endPoint.x - startPoint.x;
                const dy = endPoint.y - startPoint.y;
                const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
                const corner = horizontalFirst
                    ? { x: endPoint.x, y: startPoint.y }
                    : { x: startPoint.x, y: endPoint.y };
                points.push(corner);
            }
            points.push({ x: endPoint.x, y: endPoint.y });

            const baseId = `wire_${Date.now()}`;
            const createdIds = [];
            for (let i = 0; i < points.length - 1; i++) {
                const a = points[i];
                const b = points[i + 1];
                const segDist = Math.hypot(b.x - a.x, b.y - a.y);
                if (segDist < 1e-6) continue;

                const id = ensureUniqueWireId(i === 0 ? baseId : `${baseId}_${i}`);
                const wire = {
                    id,
                    a: { x: a.x, y: a.y },
                    b: { x: b.x, y: b.y }
                };

                // Bind only the outer endpoints to terminals so wires follow component moves/terminal extension.
                if (i === 0 && this.wireStart.snap && this.wireStart.snap.type === 'terminal') {
                    wire.aRef = {
                        componentId: this.wireStart.snap.componentId,
                        terminalIndex: this.wireStart.snap.terminalIndex
                    };
                }
                if (i === points.length - 2 && end.snap && end.snap.type === 'terminal') {
                    wire.bRef = {
                        componentId: end.snap.componentId,
                        terminalIndex: end.snap.terminalIndex
                    };
                }

                this.circuit.addWire(wire);
                this.renderer.addWire(wire);
                createdIds.push(id);
            }

            let selectedWireId = createdIds.length > 0 ? createdIds[createdIds.length - 1] : null;
            const scopeWireIds = [...splitCreatedIds, ...createdIds];
            if (scopeWireIds.length > 0) {
                const compacted = this.compactWiresAndRefresh({
                    preferredWireId: selectedWireId,
                    scopeWireIds
                });
                selectedWireId = compacted.resolvedWireId || selectedWireId;
            }

            this.cancelWiring();
            if (selectedWireId && this.circuit.getWire(selectedWireId)) {
                this.selectWire(selectedWireId);
            }
            this.updateStatus('已添加导线');
        } finally {
            this.circuit.endTopologyBatch();
        }
    });
}

export function startWireDrag(wireId, e) {
    const wire = this.circuit.getWire(wireId);
    if (!wire || !wire.a || !wire.b) return;

    this.beginHistoryTransaction('移动导线');

    this.isDraggingWire = true;
    this.wireDrag = {
        wireId,
        startCanvas: this.screenToCanvas(e.clientX, e.clientY),
        startClient: { x: e.clientX, y: e.clientY },
        startA: { x: wire.a.x, y: wire.a.y },
        startB: { x: wire.b.x, y: wire.b.y },
        detached: false,
        lastDx: 0,
        lastDy: 0
    };

    this.selectWire(wireId);
    e.preventDefault();
    e.stopPropagation();
}

export function startWireEndpointDrag(wireId, end, e) {
    const wire = this.circuit.getWire(wireId);
    if (!wire || (end !== 'a' && end !== 'b')) return;

    const origin = wire[end];
    if (!origin) return;

    this.beginHistoryTransaction('移动导线端点');

    // Touch-first behavior: dragging a wire endpoint moves this endpoint by default.
    // Hold Shift to drag the whole junction (all endpoints sharing the same coordinate).
    const keyOf = (pt) => `${toCanvasInt(pt.x)},${toCanvasInt(pt.y)}`;
    const originKey = keyOf(origin);
    const affected = [];
    if (e && e.shiftKey) {
        for (const candidate of this.circuit.getAllWires()) {
            if (!candidate) continue;
            for (const which of ['a', 'b']) {
                const point = candidate[which];
                if (!point) continue;
                if (keyOf(point) === originKey) {
                    affected.push({ wireId: candidate.id, end: which });
                }
            }
        }
        if (affected.length === 0) {
            affected.push({ wireId, end });
        }
    } else {
        affected.push({ wireId, end });
    }

    const originTerminalKeys = new Set();
    let primaryOriginRef = null;
    for (const item of affected) {
        const sourceWire = item.wireId === wireId ? wire : this.circuit.getWire(item.wireId);
        if (!sourceWire) continue;
        const ref = item.end === 'a' ? sourceWire.aRef : sourceWire.bRef;
        if (!primaryOriginRef && item.wireId === wireId && item.end === end && ref) {
            primaryOriginRef = {
                componentId: ref.componentId,
                terminalIndex: ref.terminalIndex
            };
        }
        if (!ref || typeof ref.componentId !== 'string') continue;
        const terminalIndex = Number(ref.terminalIndex);
        if (!Number.isInteger(terminalIndex) || terminalIndex < 0) continue;
        originTerminalKeys.add(`${ref.componentId}:${terminalIndex}`);
    }

    const startClientX = Number.isFinite(e?.clientX) ? Number(e.clientX) : 0;
    const startClientY = Number.isFinite(e?.clientY) ? Number(e.clientY) : 0;
    const startTimeStamp = Number.isFinite(e?.timeStamp) ? Number(e.timeStamp) : null;

    this.isDraggingWireEndpoint = true;
    this.wireEndpointDrag = {
        wireId,
        end,
        origin: { x: origin.x, y: origin.y },
        primaryOriginRef,
        affected,
        originTerminalKeys,
        excludeOriginTerminals: false,
        detached: false,
        axisLock: null,
        axisLockStartTime: startTimeStamp,
        axisLockWindowMs: 80,
        startClient: { x: startClientX, y: startClientY },
        lastClient: { x: startClientX, y: startClientY },
        lastMoveTimeStamp: startTimeStamp,
        lastDragSpeedPxPerMs: null
    };
    this.syncInteractionModeStore?.({
        mode: 'endpoint-edit',
        source: 'wire.startWireEndpointDrag',
        context: { isDraggingWireEndpoint: true }
    });
    this.selectWire(wireId);
    e.preventDefault();
    e.stopPropagation();
}

export function resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
    if (!wireId) return null;
    let current = wireId;
    let guard = 0;
    while (replacementByRemovedId && replacementByRemovedId[current] && guard < 32) {
        current = replacementByRemovedId[current];
        guard += 1;
    }
    return current;
}

export function compactWiresAndRefresh(options = {}) {
    const preferredWireId = options.preferredWireId || this.selectedWire || null;
    const scopeWireIds = options.scopeWireIds || null;
    const result = this.circuit.compactWires({ scopeWireIds });
    const resolvedWireId = this.resolveCompactedWireId(preferredWireId, result.replacementByRemovedId);

    if (result.changed) {
        this.renderer.renderWires();
        if (resolvedWireId && this.circuit.getWire(resolvedWireId)) {
            this.selectWire(resolvedWireId);
        } else if (preferredWireId && !this.circuit.getWire(preferredWireId)) {
            this.selectedWire = null;
        }
        this.app.observationPanel?.refreshComponentOptions();
    }

    return { ...result, resolvedWireId };
}

export function findNearbyWireEndpoint(
    x,
    y,
    threshold,
    excludeWireId = null,
    excludeEnd = null,
    excludeWireEndpoints = null,
    excludeWireIds = null
) {
    let best = null;
    let bestDist = Infinity;

    for (const wire of this.circuit.getAllWires()) {
        if (!wire) continue;
        if (excludeWireIds && excludeWireIds.has(wire.id)) continue;
        for (const end of ['a', 'b']) {
            if (excludeWireEndpoints && excludeWireEndpoints.has(`${wire.id}:${end}`)) continue;
            if (excludeWireId && wire.id === excludeWireId && excludeEnd === end) continue;
            const point = normalizeCanvasPoint(wire[end]);
            if (!point) continue;
            const dist = Math.hypot(x - point.x, y - point.y);
            if (dist < threshold && dist < bestDist) {
                bestDist = dist;
                best = { wireId: wire.id, end, x: point.x, y: point.y };
            }
        }
    }
    return best;
}

/**
 * 查找附近导线线段上的最近点（用于显式分割）
 */
export function findNearbyWireSegment(x, y, threshold, excludeWireId = null) {
    let best = null;
    let bestDist = Infinity;
    const endpointProximity = resolveScaledThreshold(this, 3);

    for (const wire of this.circuit.getAllWires()) {
        if (!wire || !wire.a || !wire.b) continue;
        if (excludeWireId && wire.id === excludeWireId) continue;

        const a = normalizeCanvasPoint(wire.a);
        const b = normalizeCanvasPoint(wire.b);
        if (!a || !b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-9) continue;

        const tRaw = ((x - a.x) * dx + (y - a.y) * dy) / len2;
        const t = Math.max(0, Math.min(1, tRaw));
        const projXRaw = a.x + dx * t;
        const projYRaw = a.y + dy * t;
        const projX = toCanvasInt(projXRaw);
        const projY = toCanvasInt(projYRaw);
        const dist = Math.hypot(x - projXRaw, y - projYRaw);
        if (dist >= threshold || dist >= bestDist) continue;

        // 贴近端点的情况交给端点吸附处理
        const distToA = Math.hypot(projXRaw - a.x, projYRaw - a.y);
        const distToB = Math.hypot(projXRaw - b.x, projYRaw - b.y);
        if (distToA < endpointProximity || distToB < endpointProximity) continue;

        bestDist = dist;
        best = { wireId: wire.id, x: projX, y: projY };
    }

    return best;
}

/**
 * 在指定位置分割导线为两段
 */
export function splitWireAtPoint(wireId, x, y) {
    const wire = this.circuit.getWire(wireId);
    if (!wire || !wire.a || !wire.b) return;

    this.runWithHistory('分割导线', () => {
        const result = this.splitWireAtPointInternal(wireId, x, y);
        if (result?.created) {
            this.updateStatus('导线已分割');
        }
    });
}

/**
 * 分割导线内部实现（不记录历史）。
 */
export function splitWireAtPointInternal(wireId, x, y, options = {}) {
    const wire = this.circuit.getWire(wireId);
    if (!wire || !wire.a || !wire.b) return null;

    const makeId = typeof options.ensureUniqueWireId === 'function'
        ? options.ensureUniqueWireId
        : (baseId = `wire_${Date.now()}`) => {
            if (!this.circuit.getWire(baseId)) return baseId;
            let i = 1;
            while (this.circuit.getWire(`${baseId}_${i}`)) i++;
            return `${baseId}_${i}`;
        };

    const a = normalizeCanvasPoint(wire.a);
    const b = normalizeCanvasPoint(wire.b);
    if (!a || !b) return null;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return null;

    // Project click point to the segment for stable split placement.
    const tRaw = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    const t = Math.max(0, Math.min(1, tRaw));
    const splitRaw = {
        x: a.x + dx * t,
        y: a.y + dy * t
    };
    const split = {
        x: toCanvasInt(splitRaw.x),
        y: toCanvasInt(splitRaw.y)
    };

    if (a.x === b.x) {
        split.x = a.x;
        splitRaw.x = a.x;
    }
    if (a.y === b.y) {
        split.y = a.y;
        splitRaw.y = a.y;
    }

    const closeThreshold = resolveScaledThreshold(this, 5);
    const tooClose =
        Math.hypot(splitRaw.x - a.x, splitRaw.y - a.y) < closeThreshold ||
        Math.hypot(splitRaw.x - b.x, splitRaw.y - b.y) < closeThreshold;
    if (tooClose) {
        return { created: false, point: split };
    }

    const oldB = { x: b.x, y: b.y };
    const oldBRef = wire.bRef ? { ...wire.bRef } : null;
    wire.b = { x: split.x, y: split.y };
    delete wire.bRef;
    this.renderer.refreshWire(wireId);

    const newWire = {
        id: makeId(`wire_${Date.now()}`),
        a: { x: split.x, y: split.y },
        b: oldB
    };
    if (oldBRef) newWire.bRef = oldBRef;

    this.circuit.addWire(newWire);
    this.renderer.addWire(newWire);
    return { created: true, point: split, newWireId: newWire.id };
}

/**
 * 取消连线
 */
export function cancelWiring() {
    setWiringActive(this, false, {
        source: 'wire.cancelWiring'
    });
    this.wireStart = null;
    this.ignoreNextWireMouseUp = false;
    this.suspendedWiringSession = null;
    if (this.tempWire) {
        this.renderer.removeTempWire(this.tempWire);
        this.tempWire = null;
    }
    // 确保清除辅助线和高亮
    this.hideAlignmentGuides();
    this.renderer.clearTerminalHighlight();
}
