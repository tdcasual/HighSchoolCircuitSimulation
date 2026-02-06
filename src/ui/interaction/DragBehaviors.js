import { GRID_SIZE, snapToGrid, toCanvasInt } from '../../utils/CanvasCoords.js';

export function registerDragListeners(startEvent, onMove, onUp) {
    const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
    const pointerId = Number.isInteger(startEvent?.pointerId) ? startEvent.pointerId : null;

    if (supportsPointer && pointerId !== null) {
        const moveHandler = (event) => {
            if (event.pointerId !== pointerId) return;
            onMove(event);
        };
        const upHandler = (event) => {
            if (event.pointerId !== pointerId) return;
            cleanup();
            onUp(event);
        };
        const cancelHandler = (event) => {
            if (event.pointerId !== pointerId) return;
            cleanup();
            onUp(event);
        };
        const cleanup = () => {
            document.removeEventListener('pointermove', moveHandler);
            document.removeEventListener('pointerup', upHandler);
            document.removeEventListener('pointercancel', cancelHandler);
        };

        document.addEventListener('pointermove', moveHandler, { passive: false });
        document.addEventListener('pointerup', upHandler);
        document.addEventListener('pointercancel', cancelHandler);
        return cleanup;
    }

    const moveHandler = (event) => onMove(event);
    const upHandler = (event) => {
        cleanup();
        onUp(event);
    };
    const cleanup = () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    return cleanup;
}

/**
 * 端子延长拖动（平滑移动，支持对齐）
 */
export function startTerminalExtend(componentId, terminalIndex, e) {
    const comp = this.circuit.getComponent(componentId);
    if (!comp) return;

    this.beginHistoryTransaction('调整端子长度');

    // 初始化端子延长数据
    if (!comp.terminalExtensions) {
        comp.terminalExtensions = {};
    }
    if (!comp.terminalExtensions[terminalIndex]) {
        comp.terminalExtensions[terminalIndex] = { x: 0, y: 0 };
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const startExtX = comp.terminalExtensions[terminalIndex].x;
    const startExtY = comp.terminalExtensions[terminalIndex].y;
    const rotation = (comp.rotation || 0) * Math.PI / 180;
    let cleanupDrag = null;

    const onMove = (moveE) => {
        // 计算鼠标移动向量（屏幕坐标，考虑缩放）
        const dx = (moveE.clientX - startX) / this.scale;
        const dy = (moveE.clientY - startY) / this.scale;

        // 将移动向量转换到元器件本地坐标系
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const localDx = dx * cos - dy * sin;
        const localDy = dx * sin + dy * cos;

        // 计算新的延长偏移（平滑移动，不强制对齐网格）
        let newExtX = startExtX + localDx;
        let newExtY = startExtY + localDy;

        // 与网格轻微吸附，便于对齐
        const snapThreshold = 8;
        const gridX = snapToGrid(newExtX, GRID_SIZE);
        const gridY = snapToGrid(newExtY, GRID_SIZE);
        if (Math.abs(newExtX - gridX) < snapThreshold) newExtX = gridX;
        if (Math.abs(newExtY - gridY) < snapThreshold) newExtY = gridY;

        // 检测与水平/垂直方向的对齐
        if (Math.abs(newExtY) < snapThreshold) newExtY = 0;
        if (Math.abs(newExtX) < snapThreshold) newExtX = 0;

        // Normalize to integer pixels to keep topology stable.
        comp.terminalExtensions[terminalIndex] = { x: toCanvasInt(newExtX), y: toCanvasInt(newExtY) };

        // 重新渲染元器件
        this.renderer.refreshComponent(comp);
        this.renderer.setSelected(componentId, true);

        // 更新连接到该元器件的所有导线
        this.renderer.updateConnectedWires(componentId);
    };

    const onUp = () => {
        if (typeof cleanupDrag === 'function') cleanupDrag();
        this.hideAlignmentGuides();
        // 端子位置会影响坐标拓扑，需重建节点
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
        this.updateStatus('端子位置已调整');
    };

    cleanupDrag = this.registerDragListeners(e, onMove, onUp);

    e.preventDefault();
    e.stopPropagation();
}

/**
 * 滑动变阻器拖动
 */
export function startRheostatDrag(componentId, e) {
    const comp = this.circuit.getComponent(componentId);
    if (!comp || comp.type !== 'Rheostat') return;

    // 记录初始位置和初始position
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosition = comp.position;
    const rotation = (comp.rotation || 0) * Math.PI / 180;
    let cleanupDrag = null;

    const onMove = (moveE) => {
        // 计算鼠标移动向量
        const dx = moveE.clientX - startX;
        const dy = moveE.clientY - startY;

        // 将鼠标移动向量旋转到元器件本地坐标系
        // 元器件旋转了rotation角度，所以鼠标移动要反向旋转
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const localDx = dx * cos - dy * sin;

        // 根据本地X方向移动距离计算新位置
        const width = 70; // 滑动范围（像素）
        const positionDelta = localDx / width;
        const position = Math.max(0, Math.min(1, startPosition + positionDelta));
        comp.position = position;

        // 重新渲染元器件
        this.renderer.refreshComponent(comp);
        this.renderer.setSelected(componentId, true);

        // 更新连接到该元器件的所有导线（特别是连接到滑动触点的导线）
        this.renderer.updateConnectedWires(componentId);

        // 只更新属性面板中的动态值，避免整体刷新导致闪烁
        this.updateRheostatPanelValues(comp);
    };

    const onUp = () => {
        if (typeof cleanupDrag === 'function') cleanupDrag();
        // 拖动结束后完整刷新一次属性面板
        this.updatePropertyPanel(comp);
    };

    cleanupDrag = this.registerDragListeners(e, onMove, onUp);
}

/**
 * 平行板电容探索模式：拖动右侧极板
 * - 左右拖动：改变板间距 d
 * - 上下拖动：改变重叠面积（通过纵向错位近似）
 */
export function startParallelPlateCapacitorDrag(componentId, e) {
    const comp = this.circuit.getComponent(componentId);
    if (!comp || comp.type !== 'ParallelPlateCapacitor' || !comp.explorationMode) return;

    // 选中以便同步右侧面板
    if (this.selectedComponent !== componentId) {
        this.selectComponent(componentId);
    }

    const plateLengthPx = 24;
    const pxPerMm = 10;
    const minGapPx = 6;
    const maxGapPx = 30;

    const startCanvas = this.screenToCanvas(e.clientX, e.clientY);
    const startLocal = this.canvasToComponentLocal(comp, startCanvas);

    const startDistanceMm = (comp.plateDistance ?? 0.001) * 1000;
    const startGapPx = Math.min(maxGapPx, Math.max(minGapPx, startDistanceMm * pxPerMm));
    const startOffsetY = comp.plateOffsetYPx ?? 0;
    let cleanupDrag = null;

    const onMove = (moveE) => {
        const canvas = this.screenToCanvas(moveE.clientX, moveE.clientY);
        const local = this.canvasToComponentLocal(comp, canvas);
        const dx = local.x - startLocal.x;
        const dy = local.y - startLocal.y;

        const gapPx = Math.min(maxGapPx, Math.max(minGapPx, startGapPx + dx));
        const distanceMm = gapPx / pxPerMm;
        comp.plateDistance = distanceMm / 1000;
        comp.plateOffsetYPx = Math.min(plateLengthPx, Math.max(-plateLengthPx, startOffsetY + dy));

        this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
        this.renderer.setSelected(componentId, true);
    };

    const onUp = () => {
        if (typeof cleanupDrag === 'function') cleanupDrag();
        this.updateStatus('已调整平行板电容参数');
    };

    cleanupDrag = this.registerDragListeners(e, onMove, onUp);

    e.preventDefault();
    e.stopPropagation();
}
