import { safeAddEventListener, safeInvoke } from '../../utils/RuntimeSafety.js';
import { isInteractiveTarget } from './ChartWindowControls.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

export class ChartWindowPointerController {
    constructor(controller) {
        this.controller = controller;
    }

    onHeaderPointerDown(event) {
        const controller = this.controller;
        if (!controller.workspace.isWindowDragEnabled()) return;
        if (isInteractiveTarget(event?.target)) return;
        const pointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
        if (pointerId == null) return;

        this.cancelPointerSessions();
        controller._restoreFrame = null;
        controller.workspace.focusWindow(controller);
        controller._dragSession = {
            pointerId,
            startX: Number(event?.clientX) || 0,
            startY: Number(event?.clientY) || 0,
            originX: controller.state.frame?.x || 0,
            originY: controller.state.frame?.y || 0,
            pendingFrame: null
        };

        safeInvokeMethod(controller.elements.root?.classList, 'add', 'chart-window-dragging');
        safeInvokeMethod(controller.elements.header, 'setPointerCapture', pointerId);
        this.attachGlobalPointerListeners();
        event?.preventDefault?.();
    }

    onHeaderDoubleClick(event) {
        const controller = this.controller;
        if (!controller.workspace.isWindowResizeEnabled()) return;
        if (isInteractiveTarget(event?.target)) return;

        if (controller._restoreFrame) {
            const restoreFrame = { ...controller._restoreFrame };
            controller._restoreFrame = null;
            controller.workspace.commandService.updateChartFrame(controller.state.id, restoreFrame);
            return;
        }

        const current = controller.state.frame || {};
        controller._restoreFrame = {
            x: Number(current.x) || 0,
            y: Number(current.y) || 0,
            width: Number(current.width) || 320,
            height: Number(current.height) || 240
        };
        const layerSize = controller.workspace.getLayerSize?.() || { width: 1024, height: 720 };
        const margin = 12;
        const next = controller.workspace.clampRect({
            x: margin,
            y: margin,
            width: Math.max(260, layerSize.width - margin * 2),
            height: Math.max(200, layerSize.height - margin - 44)
        });
        controller.workspace.commandService.updateChartFrame(controller.state.id, next);
        event?.preventDefault?.();
    }

    onResizeHandlePointerDown(event, direction) {
        const controller = this.controller;
        if (!controller.workspace.isWindowResizeEnabled()) return;
        const pointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
        if (pointerId == null) return;

        this.cancelPointerSessions();
        controller._restoreFrame = null;
        controller.workspace.focusWindow(controller);
        controller._resizeSession = {
            pointerId,
            direction: String(direction || 'se'),
            startX: Number(event?.clientX) || 0,
            startY: Number(event?.clientY) || 0,
            originFrame: { ...(controller.state.frame || {}) },
            pendingFrame: null
        };

        safeInvokeMethod(controller.elements.root?.classList, 'add', 'chart-window-resizing');
        safeInvokeMethod(event?.currentTarget, 'setPointerCapture', pointerId);
        this.attachGlobalPointerListeners();
        event?.preventDefault?.();
        event?.stopPropagation?.();
    }

    onPointerMove(event) {
        const controller = this.controller;
        const resizeSession = controller._resizeSession;
        if (resizeSession && Number(event?.pointerId) === resizeSession.pointerId) {
            const dx = (Number(event?.clientX) || 0) - resizeSession.startX;
            const dy = (Number(event?.clientY) || 0) - resizeSession.startY;
            const origin = resizeSession.originFrame || {};
            const direction = resizeSession.direction || 'se';

            const nextFrame = {
                x: Number(origin.x) || 0,
                y: Number(origin.y) || 0,
                width: Number(origin.width) || 320,
                height: Number(origin.height) || 240
            };

            if (direction.includes('e')) nextFrame.width += dx;
            if (direction.includes('s')) nextFrame.height += dy;
            if (direction.includes('w')) {
                nextFrame.x += dx;
                nextFrame.width -= dx;
            }
            if (direction.includes('n')) {
                nextFrame.y += dy;
                nextFrame.height -= dy;
            }

            const clamped = controller.workspace.clampRect(nextFrame);
            resizeSession.pendingFrame = clamped;
            if (controller.elements.root?.style) {
                controller.elements.root.style.left = `${clamped.x}px`;
                controller.elements.root.style.top = `${clamped.y}px`;
                controller.elements.root.style.width = `${clamped.width}px`;
                controller.elements.root.style.height = `${clamped.height}px`;
            }
            controller._needsRedraw = true;
            event?.preventDefault?.();
            return;
        }

        const dragSession = controller._dragSession;
        if (!dragSession) return;
        if (Number(event?.pointerId) !== dragSession.pointerId) return;

        const dx = (Number(event?.clientX) || 0) - dragSession.startX;
        const dy = (Number(event?.clientY) || 0) - dragSession.startY;

        const nextFrame = controller.workspace.clampRect({
            ...controller.state.frame,
            x: Math.round(dragSession.originX + dx),
            y: Math.round(dragSession.originY + dy)
        });
        dragSession.pendingFrame = nextFrame;

        if (controller.elements.root?.style) {
            controller.elements.root.style.left = `${nextFrame.x}px`;
            controller.elements.root.style.top = `${nextFrame.y}px`;
        }
        event?.preventDefault?.();
    }

    onPointerUp(event) {
        const controller = this.controller;
        const resizeSession = controller._resizeSession;
        if (resizeSession && Number(event?.pointerId) === resizeSession.pointerId) {
            controller._resizeSession = null;
            safeInvokeMethod(controller.elements.root?.classList, 'remove', 'chart-window-resizing');
            this.detachDragListeners();
            if (resizeSession.pendingFrame) {
                controller.workspace.commandService.updateChartFrame(controller.state.id, resizeSession.pendingFrame);
            }
            return;
        }

        const dragSession = controller._dragSession;
        if (!dragSession) return;
        if (Number(event?.pointerId) !== dragSession.pointerId) return;

        controller._dragSession = null;
        this.detachDragListeners();
        safeInvokeMethod(controller.elements.root?.classList, 'remove', 'chart-window-dragging');

        if (dragSession.pendingFrame) {
            controller.workspace.commandService.updateChartFrame(controller.state.id, dragSession.pendingFrame);
        }
    }

    attachGlobalPointerListeners() {
        const controller = this.controller;
        if (typeof window === 'undefined') return;
        safeAddEventListener(window, 'pointermove', controller.boundPointerMove);
        safeAddEventListener(window, 'pointerup', controller.boundPointerUp);
        safeAddEventListener(window, 'pointercancel', controller.boundPointerUp);
    }

    cancelPointerSessions() {
        const controller = this.controller;
        controller._dragSession = null;
        controller._resizeSession = null;
        safeInvokeMethod(controller.elements.root?.classList, 'remove', 'chart-window-dragging');
        safeInvokeMethod(controller.elements.root?.classList, 'remove', 'chart-window-resizing');
        this.detachDragListeners();
    }

    detachDragListeners() {
        const controller = this.controller;
        if (typeof window === 'undefined') return;
        safeInvokeMethod(window, 'removeEventListener', 'pointermove', controller.boundPointerMove);
        safeInvokeMethod(window, 'removeEventListener', 'pointerup', controller.boundPointerUp);
        safeInvokeMethod(window, 'removeEventListener', 'pointercancel', controller.boundPointerUp);
    }
}
