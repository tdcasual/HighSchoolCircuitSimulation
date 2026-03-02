import { GRID_SIZE, snapToGrid, toCanvasInt } from '../../utils/CanvasCoords.js';
import { getTerminalLocalPosition } from '../../utils/TerminalGeometry.js';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function resolveTerminalDragAxis(comp, terminalIndex) {
    if (!comp) return { x: 1, y: 0 };

    // Ignore existing extension when deriving the terminal's native direction.
    const ext = comp.terminalExtensions && typeof comp.terminalExtensions === 'object'
        ? comp.terminalExtensions
        : {};
    const probeComp = {
        ...comp,
        terminalExtensions: {
            ...ext,
            [terminalIndex]: { x: 0, y: 0 }
        }
    };
    const baseLocal = getTerminalLocalPosition(probeComp, terminalIndex);
    if (!baseLocal) return { x: 1, y: 0 };

    const absX = Math.abs(baseLocal.x);
    const absY = Math.abs(baseLocal.y);
    if (absX >= absY && absX > 0) return { x: Math.sign(baseLocal.x) || 1, y: 0 };
    if (absY > 0) return { x: 0, y: Math.sign(baseLocal.y) || 1 };
    return { x: 1, y: 0 };
}

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
            safeInvokeMethod(document, 'removeEventListener', 'pointermove', moveHandler);
            safeInvokeMethod(document, 'removeEventListener', 'pointerup', upHandler);
            safeInvokeMethod(document, 'removeEventListener', 'pointercancel', cancelHandler);
        };

        safeInvokeMethod(document, 'addEventListener', 'pointermove', moveHandler, { passive: false });
        safeInvokeMethod(document, 'addEventListener', 'pointerup', upHandler);
        safeInvokeMethod(document, 'addEventListener', 'pointercancel', cancelHandler);
        return cleanup;
    }

    const moveHandler = (event) => onMove(event);
    const upHandler = (event) => {
        cleanup();
        onUp(event);
    };
    const cleanup = () => {
        safeInvokeMethod(document, 'removeEventListener', 'mousemove', moveHandler);
        safeInvokeMethod(document, 'removeEventListener', 'mouseup', upHandler);
    };

    safeInvokeMethod(document, 'addEventListener', 'mousemove', moveHandler);
    safeInvokeMethod(document, 'addEventListener', 'mouseup', upHandler);
    return cleanup;
}

/**
 * 开始拖动元器件
 */
export function startDragging(componentG, e) {
    const id = componentG.dataset.id;
    const comp = this.circuit.getComponent(id);
    if (!comp) return;

    this.isDragging = true;
    this.dragTarget = id;
    this.isDraggingComponent = true;
    this.dragGroup = null;

    this.beginHistoryTransaction('移动元器件');

    // 使用统一的坐标转换，计算鼠标相对于元器件中心的偏移
    const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
    this.dragOffset = {
        x: canvasCoords.x - comp.x,
        y: canvasCoords.y - comp.y
    };

    // 黑箱：准备整体移动信息（盒内元件 + 与盒相关的导线端点）
    if (comp.type === 'BlackBox') {
        const componentIds = this.getBlackBoxContainedComponentIds(comp, { includeBoxes: true });
        const connectedWireIds = new Set();
        const wireEndpointMask = new Map(); // wireId -> {aInside,bInside}
        const inside = (pt) => this.renderer.isPointInsideBlackBox(pt, comp);

        for (const wire of this.circuit.getAllWires()) {
            const aInside = !!(wire?.a && inside(wire.a));
            const bInside = !!(wire?.b && inside(wire.b));
            if (aInside || bInside) {
                connectedWireIds.add(wire.id);
                wireEndpointMask.set(wire.id, { aInside, bInside });
            }
        }

        this.dragGroup = {
            boxId: comp.id,
            componentIds,
            connectedWireIds: Array.from(connectedWireIds),
            wireEndpointMask
        };
    }

    this.selectComponent(id);
}

/**
 * 端子延长拖动（平滑移动，支持对齐）
 */
export function startTerminalExtend(componentId, terminalIndex, e) {
    const comp = this.circuit.getComponent(componentId);
    if (!comp) return;

    this.beginHistoryTransaction('调整端子长度');
    this.isTerminalExtending = true;

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
    const dragAxis = resolveTerminalDragAxis(comp, terminalIndex);
    const startAxisScalar = startExtX * dragAxis.x + startExtY * dragAxis.y;
    const rotation = (comp.rotation || 0) * Math.PI / 180;
    let cleanupDrag = null;

    const onMove = (moveE) => {
        if (!this.isTerminalExtending) return;
        // 计算鼠标移动向量（屏幕坐标，考虑缩放）
        const dx = (moveE.clientX - startX) / this.scale;
        const dy = (moveE.clientY - startY) / this.scale;

        // 将移动向量转换到元器件本地坐标系
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const localDx = dx * cos - dy * sin;
        const localDy = dx * sin + dy * cos;

        // 仅沿端子原生方向伸缩，保证端子延长始终为直线。
        let newAxisScalar = startAxisScalar + localDx * dragAxis.x + localDy * dragAxis.y;

        // 与网格轻微吸附，便于长度对齐
        const snapThreshold = 8;
        const gridScalar = snapToGrid(newAxisScalar, GRID_SIZE);
        if (Math.abs(newAxisScalar - gridScalar) < snapThreshold) newAxisScalar = gridScalar;
        if (Math.abs(newAxisScalar) < snapThreshold) newAxisScalar = 0;

        const newExtX = newAxisScalar * dragAxis.x;
        const newExtY = newAxisScalar * dragAxis.y;

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
        this.isTerminalExtending = false;
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
    this.beginHistoryTransaction?.('调节滑动变阻器');
    this.isRheostatDragging = true;

    // 记录初始位置和初始position
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosition = comp.position;
    const rotation = (comp.rotation || 0) * Math.PI / 180;
    let cleanupDrag = null;

    const onMove = (moveE) => {
        if (!this.isRheostatDragging) return;
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
        this.isRheostatDragging = false;
        // 拖动结束后完整刷新一次属性面板
        this.updatePropertyPanel(comp);
        this.commitHistoryTransaction?.();
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
