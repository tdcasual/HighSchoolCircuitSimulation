import {
    initializeInteractionModeStore as initializeInteractionModeStoreViaStateMachine,
    syncInteractionModeStore as syncInteractionModeStoreViaStateMachine
} from './InteractionModeStateMachine.js';
import { readInteractionModeContext } from './InteractionModeBridge.js';
import {
    safeClosest,
} from './InteractionOrchestratorHelpers.js';
import {
    handleFallbackSurfaceMouseDown as handleFallbackSurfaceMouseDownViaHandlers,
    handlePendingToolMouseDown as handlePendingToolMouseDownViaHandlers,
    handleSurfaceTargetMouseDown as handleSurfaceTargetMouseDownViaHandlers,
    handleWireTargetMouseDown as handleWireTargetMouseDownViaHandlers
} from './InteractionOrchestratorMouseDownHandlers.js';
import {
    handleActiveWiringMouseUp as handleActiveWiringMouseUpViaHandlers,
    handleComponentDragMouseUp as handleComponentDragMouseUpViaHandlers,
    handlePointerDownSelectionToggleMouseUp as handlePointerDownSelectionToggleMouseUpViaHandlers,
    handlePanningMouseUp as handlePanningMouseUpViaHandlers,
    handleWireDragMouseUp as handleWireDragMouseUpViaHandlers,
    handleWireEndpointDragMouseUp as handleWireEndpointDragMouseUpViaHandlers,
    handleWireModeGestureMouseUp as handleWireModeGestureMouseUpViaHandlers
} from './InteractionOrchestratorMouseUpHandlers.js';
import {
    handleComponentDragMouseMove as handleComponentDragMouseMoveViaHandlers,
    handlePanningMouseMove as handlePanningMouseMoveViaHandlers,
    handleWireDragMouseMove as handleWireDragMouseMoveViaHandlers,
    handlePointerDownInfoMouseMove as handlePointerDownInfoMouseMoveViaHandlers,
    handleWireEndpointDragMouseMove as handleWireEndpointDragMouseMoveViaHandlers,
    handleWiringPreviewMouseMove as handleWiringPreviewMouseMoveViaHandlers,
    handleWireModeGestureMouseMove as handleWireModeGestureMouseMoveViaHandlers
} from './InteractionOrchestratorMouseMoveHandlers.js';
import { handleMouseLeave as handleMouseLeaveViaHandlers } from './InteractionOrchestratorMouseLeaveHandlers.js';
import {
    onContextMenu as onContextMenuViaTail,
    onDoubleClick as onDoubleClickViaTail,
    onKeyDown as onKeyDownViaTail
} from './InteractionOrchestratorTailHandlers.js';

export function initializeInteractionModeStore(context) {
    return initializeInteractionModeStoreViaStateMachine(context);
}

export function syncInteractionModeStore(context, options = {}) {
    return syncInteractionModeStoreViaStateMachine(context, options);
}

export function onMouseDown(e) {
    // 阻止默认的拖拽行为，防止触发drop事件创建重复元器件
    e.preventDefault();
    e.stopPropagation();
    this.lastPrimaryPointerType = this.resolvePointerType(e);
    this.lastPointerScreen = { x: e.clientX, y: e.clientY };
    this.lastPointerCanvas = this.screenToCanvas(e.clientX, e.clientY);
    this.quickActionBar?.notifyActivity?.();
    this.pointerDownInfo = null;
    this.wireModeGesture = null;
    this.hideContextMenu?.();
    this.app?.topActionMenu?.setOpen?.(false);

    const target = e.target;
    const probeMarker = this.resolveProbeMarkerTarget(target);
    const terminalTarget = this.resolveTerminalTarget(target);
    const componentGroup = safeClosest(target, '.component');

    if (handlePendingToolMouseDownViaHandlers.call(this, e, {
        target,
        terminalTarget,
        componentGroup
    })) {
        return;
    }

    // 右键或中键 - 直接开始拖动画布
    if (e.button === 1 || e.button === 2) {
        this.startPanning(e);
        return;
    }

    // 如果正在连线模式，点击非端子/非节点的地方应该取消连线
    // 点击端子或节点会在 onMouseUp 中处理
    const modeContext = readInteractionModeContext(this);
    if (modeContext.wiringActive) {
        // 连线模式下的 mousedown 不做特殊处理，让 mouseup 来处理
        return;
    }

    if (handleSurfaceTargetMouseDownViaHandlers.call(this, e, {
        target,
        probeMarker,
        terminalTarget,
        componentGroup
    })) {
        return;
    }

    if (handleWireTargetMouseDownViaHandlers.call(this, e, {
        target
    })) {
        return;
    }

    handleFallbackSurfaceMouseDownViaHandlers.call(this, e);
}

export function onMouseMove(e) {
    this.quickActionBar?.notifyActivity?.();
    handlePointerDownInfoMouseMoveViaHandlers.call(this, e);

    if (handleWireModeGestureMouseMoveViaHandlers.call(this, e)) {
        return;
    }

    // 画布平移（使用屏幕坐标）
    if (handlePanningMouseMoveViaHandlers.call(this, e)) {
        return;
    }

    // 其他操作使用画布坐标
    const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
    const canvasX = canvasCoords.x;
    const canvasY = canvasCoords.y;

    // 拖动导线端点（Model C）
    if (handleWireEndpointDragMouseMoveViaHandlers.call(this, e, canvasX, canvasY)) {
        return;
    }

    // 拖动整条导线（平移，保持线段形状）
    if (handleWireDragMouseMoveViaHandlers.call(this, e, canvasX, canvasY)) {
        return;
    }

    handleComponentDragMouseMoveViaHandlers.call(this, e, canvasX, canvasY);
    handleWiringPreviewMouseMoveViaHandlers.call(this, e, canvasX, canvasY);
}

export function onMouseUp(e) {
    this.quickActionBar?.notifyActivity?.();
    const pointerDownInfo = this.pointerDownInfo;
    const wireModeGesture = this.wireModeGesture;
    this.wireModeGesture = null;

    if (handleWireModeGestureMouseUpViaHandlers.call(this, e, wireModeGesture)) {
        return;
    }

    // 结束画布平移
    if (handlePanningMouseUpViaHandlers.call(this)) {
        return;
    }

    if (handleWireEndpointDragMouseUpViaHandlers.call(this, e)) {
        return;
    }

    if (handleWireDragMouseUpViaHandlers.call(this)) {
        return;
    }

    handleComponentDragMouseUpViaHandlers.call(this);

    if (handlePointerDownSelectionToggleMouseUpViaHandlers.call(this, e, pointerDownInfo)) {
        return;
    }

    if (handleActiveWiringMouseUpViaHandlers.call(this, e)) {
        return;
    }

    this.pointerDownInfo = null;
}

export function onMouseLeave(_e) {
    return handleMouseLeaveViaHandlers.call(this, _e);
}

export function onContextMenu(e) {
    return onContextMenuViaTail.call(this, e);
}

export function onDoubleClick(e) {
    return onDoubleClickViaTail.call(this, e);
}

export function onKeyDown(e) {
    return onKeyDownViaTail.call(this, e);
}
