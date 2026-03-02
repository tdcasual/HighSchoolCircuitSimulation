import { toCanvasInt } from '../../utils/CanvasCoords.js';
import { setInteractionModeContext } from './InteractionModeBridge.js';
import {
    restorePendingWireToolAfterAction,
    safeClosest,
    shouldCreateEndpointBridge,
    syncActiveWireStartAfterCompaction
} from './InteractionOrchestratorHelpers.js';

export function handleWireModeGestureMouseUp(e, wireModeGesture) {
    if (!wireModeGesture) {
        return false;
    }

    const pointerType = wireModeGesture.pointerType || this.resolvePointerType(e);
    const gesturePoint = wireModeGesture.point || this.screenToCanvas(e.clientX, e.clientY);
    if (wireModeGesture.wasWiring) {
        if (gesturePoint) {
            this.finishWiringToPoint(gesturePoint, { pointerType });
        } else {
            this.cancelWiring();
            this.updateStatus?.('未连接到端子/端点，已取消连线');
        }
        restorePendingWireToolAfterAction(this);
    } else {
        this.startWiringFromPoint(gesturePoint, e, true);
        this.updateStatus('导线模式：选择终点');
    }
    this.pointerDownInfo = null;
    return true;
}

export function handlePanningMouseUp() {
    if (!this.isPanning) {
        return false;
    }

    this.isPanning = false;
    this.svg.style.cursor = '';
    this.pointerDownInfo = null;
    return true;
}

export function handleActiveWiringMouseUp(e) {
    if (!this.isWiring) {
        return false;
    }

    if (this.ignoreNextWireMouseUp) {
        this.ignoreNextWireMouseUp = false;
        return true;
    }
    const target = e.target;
    const pointerType = this.resolvePointerType(e);
    const terminalTarget = this.resolveTerminalTarget(target);
    if (terminalTarget) {
        const componentG = safeClosest(target, '.component');
        if (componentG) {
            const componentId = componentG.dataset.id;
            const terminalIndex = parseInt(terminalTarget.dataset.terminal);
            const pos = this.renderer.getTerminalPosition(componentId, terminalIndex);
            if (pos) {
                this.finishWiringToPoint(pos, { pointerType });
            } else {
                this.cancelWiring();
            }
        }
        return true;
    } else if (this.isWireEndpointTarget(target)) {
        const wireGroup = safeClosest(target, '.wire-group');
        if (wireGroup) {
            const wireId = wireGroup.dataset.id;
            const end = target.dataset.end;
            const wire = this.circuit.getWire(wireId);
            const pos = wire && (end === 'a' || end === 'b') ? wire[end] : null;
            if (pos) {
                this.finishWiringToPoint(pos, { pointerType });
                return true;
            }
        }
    }

    const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
    const snapped = this.snapPoint(canvasCoords.x, canvasCoords.y, {
        allowWireSegmentSnap: true,
        pointerType
    });
    if (snapped?.snap?.type && snapped.snap.type !== 'grid') {
        this.finishWiringToPoint(snapped, { pointerType });
        return true;
    }

    this.cancelWiring();
    if (typeof this.updateStatus === 'function') {
        this.updateStatus('未连接到端子/端点，已取消连线');
    }
    return true;
}

export function handlePointerDownSelectionToggleMouseUp(e, pointerDownInfo) {
    if (!(pointerDownInfo?.componentId && pointerDownInfo.wasSelected && !pointerDownInfo.moved)) {
        return false;
    }

    const pointerType = pointerDownInfo.pointerType || this.resolvePointerType(e);
    const threshold = pointerType === 'touch' ? 12 : pointerType === 'pen' ? 10 : 6;
    const moved = Math.hypot(
        (e.clientX || 0) - (pointerDownInfo.screenX || 0),
        (e.clientY || 0) - (pointerDownInfo.screenY || 0)
    );
    if (moved <= threshold) {
        const componentG = safeClosest(e.target, '.component');
        const componentId = componentG?.dataset?.id;
        if (componentId && componentId === pointerDownInfo.componentId) {
            this.clearSelection();
            this.pointerDownInfo = null;
            return true;
        }
    }
    return false;
}

export function handleWireEndpointDragMouseUp(e) {
    if (!this.isDraggingWireEndpoint) {
        return false;
    }

    const drag = this.wireEndpointDrag;
    const pointerType = typeof this.resolvePointerType === 'function'
        ? this.resolvePointerType(e)
        : (this.lastPrimaryPointerType || 'mouse');
    setInteractionModeContext(this, {
        isDraggingWireEndpoint: false
    }, {
        source: 'onMouseUp:endpoint-drag-end'
    });
    this.wireEndpointDrag = null;
    this.renderer.clearTerminalHighlight();

    const affectedIds = Array.isArray(drag?.affected)
        ? drag.affected.map((item) => item?.wireId).filter(Boolean)
        : [];
    const scopeWireIds = [drag?.wireId, ...affectedIds].filter(Boolean);

    const shouldAutoCreateEndpointBridge = shouldCreateEndpointBridge(this, pointerType)
        && drag?.lastSnap?.type === 'wire-endpoint'
        && drag?.lastSnap?.wireId
        && drag?.lastPoint
        && drag?.origin
        && Array.isArray(drag?.affected)
        && drag.affected.length === 1
        && !(drag.lastSnap.wireId === drag.wireId && drag.lastSnap.end === drag.end);
    if (shouldAutoCreateEndpointBridge && typeof this.circuit?.addWire === 'function') {
        const originPoint = {
            x: toCanvasInt(drag.origin.x),
            y: toCanvasInt(drag.origin.y)
        };
        const targetPoint = {
            x: toCanvasInt(drag.lastPoint.x),
            y: toCanvasInt(drag.lastPoint.y)
        };
        const bridgeDist = Math.hypot(targetPoint.x - originPoint.x, targetPoint.y - originPoint.y);
        if (bridgeDist > 1e-6) {
            const ensureUniqueWireId = (baseId = `wire_${Date.now()}`) => {
                if (!this.circuit.getWire(baseId)) return baseId;
                let i = 1;
                while (this.circuit.getWire(`${baseId}_${i}`)) i += 1;
                return `${baseId}_${i}`;
            };
            const bridgeWire = {
                id: ensureUniqueWireId(),
                a: originPoint,
                b: targetPoint
            };
            const originRef = drag.primaryOriginRef;
            const originTerminalIndex = Number(originRef?.terminalIndex);
            if (originRef && typeof originRef.componentId === 'string'
                && Number.isInteger(originTerminalIndex)
                && originTerminalIndex >= 0) {
                bridgeWire.aRef = {
                    componentId: originRef.componentId,
                    terminalIndex: originTerminalIndex
                };
            }
            this.circuit.addWire(bridgeWire);
            this.renderer.addWire?.(bridgeWire);
            scopeWireIds.push(bridgeWire.id);
            scopeWireIds.push(drag.lastSnap.wireId);
        }
    }

    const shouldSplitTargetWire = drag?.lastSnap?.type === 'wire-segment'
        && drag?.lastSnap?.wireId
        && drag?.lastPoint
        && typeof this.splitWireAtPointInternal === 'function';

    if (shouldSplitTargetWire) {
        const targetWireId = drag.lastSnap.wireId;
        if (!affectedIds.includes(targetWireId)) {
            const splitResult = this.splitWireAtPointInternal(
                targetWireId,
                drag.lastPoint.x,
                drag.lastPoint.y
            );
            scopeWireIds.push(targetWireId);
            if (splitResult?.created && splitResult?.newWireId) {
                scopeWireIds.push(splitResult.newWireId);
            }
        }
    }

    const uniqueScopeWireIds = Array.from(new Set(scopeWireIds.filter(Boolean)));
    const compacted = this.compactWiresAndRefresh({
        preferredWireId: drag?.wireId || this.selectedWire,
        scopeWireIds: uniqueScopeWireIds.length > 0 ? uniqueScopeWireIds : null
    });
    syncActiveWireStartAfterCompaction(this, compacted);
    this.circuit.rebuildNodes();
    this.commitHistoryTransaction();
    this.pointerDownInfo = null;
    return true;
}

export function handleWireDragMouseUp() {
    if (!this.isDraggingWire) {
        return false;
    }

    const drag = this.wireDrag;
    this.isDraggingWire = false;
    this.wireDrag = null;
    this.compactWiresAndRefresh({
        preferredWireId: drag?.wireId || this.selectedWire,
        scopeWireIds: drag?.wireId ? [drag.wireId] : null
    });
    this.circuit.rebuildNodes();
    this.commitHistoryTransaction();
    this.pointerDownInfo = null;
    return true;
}

export function handleComponentDragMouseUp() {
    if (!this.isDragging) {
        return false;
    }

    this.isDragging = false;
    this.dragTarget = null;
    this.isDraggingComponent = false;
    this.dragGroup = null;
    this.hideAlignmentGuides();
    this.circuit.rebuildNodes();
    this.commitHistoryTransaction();
    return true;
}
