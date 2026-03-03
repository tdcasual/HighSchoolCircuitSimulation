import { toCanvasInt } from '../../utils/CanvasCoords.js';
import { setInteractionModeContext } from './InteractionModeBridge.js';
import {
    shouldCreateEndpointBridge,
    syncActiveWireStartAfterCompaction
} from './InteractionOrchestratorHelpers.js';

function hasWireIdentifier(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
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
    this.isDraggingWireEndpoint = false;
    this.wireEndpointDrag = null;
    this.renderer.clearTerminalHighlight();

    const affectedIds = Array.isArray(drag?.affected)
        ? drag.affected.map((item) => item?.wireId).filter(hasWireIdentifier)
        : [];
    const scopeWireIds = [drag?.wireId, ...affectedIds].filter(hasWireIdentifier);

    const shouldAutoCreateEndpointBridge = shouldCreateEndpointBridge(this, pointerType)
        && drag?.lastSnap?.type === 'wire-endpoint'
        && hasWireIdentifier(drag?.lastSnap?.wireId)
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
            const originComponentId = originRef?.componentId;
            const originTerminalIndex = Number(originRef?.terminalIndex);
            if (originComponentId !== undefined && originComponentId !== null
                && Number.isInteger(originTerminalIndex)
                && originTerminalIndex >= 0) {
                bridgeWire.aRef = {
                    componentId: String(originComponentId),
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
        && hasWireIdentifier(drag?.lastSnap?.wireId)
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

    const uniqueScopeWireIds = Array.from(new Set(scopeWireIds.filter(hasWireIdentifier)));
    const compacted = this.compactWiresAndRefresh({
        preferredWireId: hasWireIdentifier(drag?.wireId) ? drag.wireId : this.selectedWire,
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
        preferredWireId: hasWireIdentifier(drag?.wireId) ? drag.wireId : this.selectedWire,
        scopeWireIds: hasWireIdentifier(drag?.wireId) ? [drag.wireId] : null
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
