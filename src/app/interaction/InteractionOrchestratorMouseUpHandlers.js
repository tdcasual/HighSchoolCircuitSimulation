import { restorePendingWireToolAfterAction } from './InteractionOrchestratorHelpers.js';

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
