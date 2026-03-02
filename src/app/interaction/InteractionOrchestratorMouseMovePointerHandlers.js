import { toCanvasInt } from '../../utils/CanvasCoords.js';

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
