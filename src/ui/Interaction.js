/**
 * Interaction.js - 交互管理器
 * 处理拖放、连线、选择等用户交互
 */

import { GRID_SIZE, snapToGrid } from '../utils/CanvasCoords.js';
import { HistoryManager } from './interaction/HistoryManager.js';
import * as WireInteractions from './interaction/WireInteractions.js';
import * as DragBehaviors from './interaction/DragBehaviors.js';
import * as SelectionPanelController from './interaction/SelectionPanelController.js';
import * as PropertyPanelController from './interaction/PropertyPanelController.js';
import * as PointerSessionManager from './interaction/PointerSessionManager.js';
import * as ViewportController from './interaction/ViewportController.js';
import * as SnapController from './interaction/SnapController.js';
import * as InteractionOrchestrator from '../app/interaction/InteractionOrchestrator.js';
import * as ComponentActions from './interaction/ComponentActions.js';
import * as ContextMenuController from './interaction/ContextMenuController.js';
import * as ProbeActions from './interaction/ProbeActions.js';
import * as ToolPlacementController from './interaction/ToolPlacementController.js';
import * as PanelBindingsController from './interaction/PanelBindingsController.js';
import * as InputResolver from './interaction/InputResolver.js';
import * as AlignmentGuideController from './interaction/AlignmentGuideController.js';
import * as UIStateController from './interaction/UIStateController.js';
import * as PropertyDialogActions from './interaction/PropertyDialogActions.js';
import * as PropertyDialogController from './interaction/PropertyDialogController.js';
import * as MeasurementReadoutController from './interaction/MeasurementReadoutController.js';

export class InteractionManager {
    constructor(app) {
        this.app = app;
        this.circuit = app.circuit;
        this.renderer = app.renderer;
        this.svg = app.svg;
        
        // 交互状态
        this.isDragging = false;
        this.isWiring = false;
        this.isDraggingComponent = false; // 标记是否正在拖动元器件（而不是从工具箱拖放）
        this.dragTarget = null;
        this.dragGroup = null; // 黑箱拖动时的组移动信息
        this.dragOffset = { x: 0, y: 0 };
        this.selectedComponent = null;
        this.selectedWire = null;

        // Undo/Redo history (circuit state snapshots)
        this.historyManager = new HistoryManager(this, { maxEntries: 100 });

        // 平行板电容探索模式：拖动极板（使用局部 document 监听实现）
        
        // 连线状态
        this.wireStart = null;
        this.tempWire = null;
        this.ignoreNextWireMouseUp = false;
        this.isDraggingWireEndpoint = false;
        this.wireEndpointDrag = null; // {wireId,end}
        this.isDraggingWire = false;
        this.wireDrag = null; // {wireId,startCanvas,startClient,startA,startB,detached,lastDx,lastDy}
        
        // 画布平移状态
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.viewOffset = { x: 0, y: 0 };
        this.scale = 1;

        // Pointer 统一输入（触屏/鼠标/触控笔）
        this.activePointers = new Map(); // pointerId -> {clientX, clientY, pointerType}
        this.primaryPointerId = null;
        this.pinchGesture = null; // {pointerAId,pointerBId,startScale,startDistance,startCanvasPivot}
        this.blockSinglePointerInteraction = false; // pinch 后需抬起全部手指再恢复单指交互
        this.lastPrimaryPointerType = 'mouse';

        // 工具箱触屏放置（点击工具 -> 点击画布落子）
        this.pendingToolType = null;
        this.pendingToolItem = null;
        
        // 对齐辅助线
        this.alignmentGuides = null;
        this.snapThreshold = 10; // 吸附阈值（像素）
        
        // 绑定事件
        this.bindEvents();
    }

    /**
     * 将屏幕坐标转换为画布坐标（考虑平移和缩放）
     */
    screenToCanvas(clientX, clientY) {
        return ViewportController.screenToCanvas.call(this, clientX, clientY);
    }

    /**
     * 将画布坐标转换为元器件局部坐标（考虑旋转）
     */
    canvasToComponentLocal(comp, canvasPoint) {
        const dx = canvasPoint.x - (comp.x || 0);
        const dy = canvasPoint.y - (comp.y || 0);
        const rotation = (comp.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
    }

    /**
     * 绑定所有事件
     */
    bindEvents() {
        // 工具箱拖放
        this.bindToolboxEvents();
        
        // SVG画布事件
        this.bindCanvasEvents();
        
        // 按钮事件
        this.bindButtonEvents();

        // 右侧面板 Tab 切换
        this.bindSidePanelEvents();
        
        // 键盘事件
        this.bindKeyboardEvents();
        
        // 缩放显示点击重置
        this.bindZoomEvents();
    }

    /**
     * 缩放控制事件
     */
    bindZoomEvents() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.addEventListener('click', () => {
                this.resetView();
            });
            zoomLevel.title = '点击重置视图 (快捷键: H)';
        }
    }

    /**
     * 工具箱拖放事件
     */
    bindToolboxEvents() {
        const toolItems = document.querySelectorAll('.tool-item');
        const validTypes = ['Ground', 'PowerSource', 'ACVoltageSource', 'Resistor', 'Diode', 'LED', 'Thermistor', 'Photoresistor', 'Rheostat', 'Bulb', 'Capacitor', 'Inductor', 'ParallelPlateCapacitor', 'Motor', 'Switch', 'SPDTSwitch', 'Relay', 'Fuse', 'Ammeter', 'Voltmeter', 'BlackBox', 'Wire'];
        
        // 标记是否正在从工具箱拖放
        this.isToolboxDrag = false;
        
        toolItems.forEach(item => {
            // 开始拖动
            item.addEventListener('dragstart', (e) => {
                const type = item.dataset.type;
                if (!type || !validTypes.includes(type)) {
                    console.error('Invalid component type:', type);
                    e.preventDefault();
                    return;
                }
                // 使用特定的 MIME 类型避免与其他拖放混淆
                e.dataTransfer.setData('application/x-circuit-component', type);
                e.dataTransfer.effectAllowed = 'copy';
                item.classList.add('dragging');
                this.isToolboxDrag = true;
                console.log('Toolbox drag started:', type);
            });
            
            // 结束拖动
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                this.isToolboxDrag = false;
            });

            // 触屏/笔记本平板模式：点击工具后在画布点击放置
            item.addEventListener('click', (e) => {
                const type = item.dataset.type;
                if (!type || !validTypes.includes(type)) return;
                e.preventDefault();
                e.stopPropagation();
                this.setPendingToolType(type, item);
            });
        });
        
        // 只绑定到 SVG 画布，不绑定到 container（避免双重触发）
        const handleDragOver = (e) => {
            // 只接受工具箱的拖放
            if (e.dataTransfer.types.includes('application/x-circuit-component')) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
            }
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 如果正在拖动画布上的元器件，不创建新元器件
            if (this.isDraggingComponent) {
                console.log('Ignoring drop: dragging existing component');
                return;
            }
            
            // 只接受工具箱的拖放
            const type = e.dataTransfer.getData('application/x-circuit-component');
            console.log('Drop event, type:', type);
            
            // 验证类型
            if (!type || !validTypes.includes(type)) {
                console.log('Invalid component type, ignoring drop:', type);
                return;
            }
            
            // 计算相对于SVG的位置（考虑缩放和平移）
            const rect = this.svg.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            // 转换为画布坐标
            const canvasX = (screenX - this.viewOffset.x) / this.scale;
            const canvasY = (screenY - this.viewOffset.y) / this.scale;
            const x = snapToGrid(canvasX, GRID_SIZE);
            const y = snapToGrid(canvasY, GRID_SIZE);
            
            if (type === 'Wire') {
                if (typeof this.addWireAt === 'function') {
                    this.addWireAt(x, y);
                } else {
                    // Fallback (should not happen): create a short wire segment at the drop point.
                    const wire = {
                        id: `wire_${Date.now()}`,
                        a: { x: x - 30, y },
                        b: { x: x + 30, y }
                    };
                    this.circuit.addWire(wire);
                    this.renderer.addWire(wire);
                    this.selectWire(wire.id);
                    this.updateStatus('已添加导线');
                }
            } else {
                this.addComponent(type, x, y);
            }
            this.clearPendingToolType({ silent: true });
        };
        
        // 只绑定到 SVG 元素
        this.svg.addEventListener('dragover', handleDragOver);
        this.svg.addEventListener('drop', handleDrop);
    }

    /**
     * 画布交互事件
     */
    bindCanvasEvents() {
        const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
        if (supportsPointer) {
            this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
            this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
            this.svg.addEventListener('pointerup', (e) => this.onPointerUp(e));
            this.svg.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
            this.svg.addEventListener('pointerleave', (e) => this.onPointerLeave(e));
        } else {
            // 鼠标按下
            this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
            // 鼠标移动
            this.svg.addEventListener('mousemove', (e) => this.onMouseMove(e));
            // 鼠标释放
            this.svg.addEventListener('mouseup', (e) => this.onMouseUp(e));
            // 鼠标离开
            this.svg.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        }
        
        // 右键菜单 - 禁用默认菜单
        this.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onContextMenu(e);
        });
        
        // 双击编辑
        this.svg.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        
        // 滚轮缩放
        this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }

    onPointerDown(e) {
        return PointerSessionManager.onPointerDown.call(this, e);
    }

    onPointerMove(e) {
        return PointerSessionManager.onPointerMove.call(this, e);
    }

    onPointerUp(e) {
        return PointerSessionManager.onPointerUp.call(this, e);
    }

    onPointerCancel(e) {
        return PointerSessionManager.onPointerCancel.call(this, e);
    }

    onPointerLeave(e) {
        return PointerSessionManager.onPointerLeave.call(this, e);
    }

    releasePointerCaptureSafe(pointerId) {
        return PointerSessionManager.releasePointerCaptureSafe.call(this, pointerId);
    }

    shouldStartPinchGesture() {
        return PointerSessionManager.shouldStartPinchGesture.call(this);
    }

    getGesturePointers() {
        return PointerSessionManager.getGesturePointers.call(this);
    }

    endPrimaryInteractionForGesture() {
        return PointerSessionManager.endPrimaryInteractionForGesture.call(this);
    }

    startPinchGesture() {
        return PointerSessionManager.startPinchGesture.call(this);
    }

    updatePinchGesture() {
        return PointerSessionManager.updatePinchGesture.call(this);
    }

    endPinchGestureIfNeeded() {
        return PointerSessionManager.endPinchGestureIfNeeded.call(this);
    }

    setPendingToolType(type, item = null) {
        return ToolPlacementController.setPendingToolType.call(this, type, item);
    }

    clearPendingToolType(options = {}) {
        return ToolPlacementController.clearPendingToolType.call(this, options);
    }

    placePendingToolAt(clientX, clientY) {
        return ToolPlacementController.placePendingToolAt.call(this, clientX, clientY);
    }
    
    /**
     * 滚轮缩放处理
     */
    onWheel(e) {
        return ViewportController.onWheel.call(this, e);
    }

    /**
     * 按钮事件
     */
    bindButtonEvents() {
        return PanelBindingsController.bindButtonEvents.call(this);
    }

    /**
     * 右侧面板 Tab 切换
     */
    bindSidePanelEvents() {
        return PanelBindingsController.bindSidePanelEvents.call(this);
    }

    isObservationTabActive() {
        return UIStateController.isObservationTabActive.call(this);
    }

    /**
     * 键盘事件
     */
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            return InteractionOrchestrator.onKeyDown.call(this, e);
        });
    }

    resolveTerminalTarget(target) {
        return InputResolver.resolveTerminalTarget.call(this, target);
    }

    resolveProbeMarkerTarget(target) {
        return InputResolver.resolveProbeMarkerTarget.call(this, target);
    }

    resolvePointerType(event) {
        return InputResolver.resolvePointerType.call(this, event);
    }

    getAdaptiveSnapThreshold(options = {}) {
        return SnapController.getAdaptiveSnapThreshold.call(this, options);
    }

    isWireEndpointTarget(target) {
        return InputResolver.isWireEndpointTarget.call(this, target);
    }

    /**
     * 鼠标按下事件
     */
    onMouseDown(e) {
        return InteractionOrchestrator.onMouseDown.call(this, e);
    }

    /**
     * 开始画布平移
     */
    startPanning(e) {
        return ViewportController.startPanning.call(this, e);
    }
    
    /**
     * 更新画布视图变换
     */
    updateViewTransform() {
        return ViewportController.updateViewTransform.call(this);
    }
    
    /**
     * 重置视图
     */
    resetView() {
        return ViewportController.resetView.call(this);
    }

    /**
     * 计算当前电路在“画布坐标系”中的包围盒，用于居中/适配视图。
     * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
     */
    getCircuitBounds() {
        return ViewportController.getCircuitBounds.call(this);
    }

    /**
     * 鼠标移动事件
     */
    onMouseMove(e) {
        return InteractionOrchestrator.onMouseMove.call(this, e);
    }

    /**
     * 鼠标释放事件
     */
    onMouseUp(e) {
        return InteractionOrchestrator.onMouseUp.call(this, e);
    }

    /**
     * 鼠标离开事件
     */
    onMouseLeave(e) {
        return InteractionOrchestrator.onMouseLeave.call(this, e);
    }

    /**
     * 右键菜单事件
     */
	    onContextMenu(e) {
	        return InteractionOrchestrator.onContextMenu.call(this, e);
	    }

    /**
     * 双击事件
     */
    onDoubleClick(e) {
        return InteractionOrchestrator.onDoubleClick.call(this, e);
    }

    /**
     * 添加元器件
     */
    addComponent(type, x, y) {
        return ComponentActions.addComponent.call(this, type, x, y);
    }

    /**
     * 删除元器件
     */
    deleteComponent(id) {
        return ComponentActions.deleteComponent.call(this, id);
    }

    /**
     * 删除导线
     */
    deleteWire(id) {
        return ComponentActions.deleteWire.call(this, id);
    }

    /**
     * 旋转元器件
     */
    rotateComponent(id) {
        return ComponentActions.rotateComponent.call(this, id);
    }

    /**
     * 切换开关状态
     */
    toggleSwitch(id) {
        return ComponentActions.toggleSwitch.call(this, id);
    }

    /**
     * 开始拖动
     */
    startDragging(componentG, e) {
        return DragBehaviors.startDragging.call(this, componentG, e);
    }

    /**
     * 从任意画布点开始连线（Model C）
     * @param {{x:number,y:number}} point
     * @param {MouseEvent|PointerEvent|null} e
     * @param {boolean} armMouseUpGuard
     */
    startWiringFromPoint(point, e = null, armMouseUpGuard = false) {
        return WireInteractions.startWiringFromPoint.call(this, point, e, armMouseUpGuard);
    }

    /**
     * 结束连线到某一点（Model C）
     * @param {{x:number,y:number}} point
     */
    finishWiringToPoint(point, options = {}) {
        return WireInteractions.finishWiringToPoint.call(this, point, options);
    }

    /**
     * 从工具箱创建一条独立导线（Model C）
     */
    addWireAt(x, y) {
        return WireInteractions.addWireAt.call(this, x, y);
    }

    /**
     * 拖动整条导线（Model C）
     */
    startWireDrag(wireId, e) {
        return WireInteractions.startWireDrag.call(this, wireId, e);
    }

    /**
     * 拖动导线端点（Model C）
     */
    startWireEndpointDrag(wireId, end, e) {
        return WireInteractions.startWireEndpointDrag.call(this, wireId, end, e);
    }

    resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
        return WireInteractions.resolveCompactedWireId.call(this, wireId, replacementByRemovedId);
    }

    compactWiresAndRefresh(options = {}) {
        return WireInteractions.compactWiresAndRefresh.call(this, options);
    }

    /**
     * 吸附点：优先吸附到端子/导线端点，可选吸附到导线中段，否则吸附到网格
     */
    snapPoint(x, y, options = {}) {
        return SnapController.snapPoint.call(this, x, y, options);
    }

	    findNearbyWireEndpoint(x, y, threshold, excludeWireId = null, excludeEnd = null, excludeWireEndpoints = null) {
	        return WireInteractions.findNearbyWireEndpoint.call(
                this,
                x,
                y,
                threshold,
                excludeWireId,
                excludeEnd,
                excludeWireEndpoints
            );
	    }

    /**
     * 查找附近导线线段上的最近点（用于显式分割）
     */
    findNearbyWireSegment(x, y, threshold, excludeWireId = null) {
        return WireInteractions.findNearbyWireSegment.call(this, x, y, threshold, excludeWireId);
    }

    /**
     * 在指定位置分割导线为两段
     */
    splitWireAtPoint(wireId, x, y) {
        return WireInteractions.splitWireAtPoint.call(this, wireId, x, y);
    }

    /**
     * 分割导线内部实现（不记录历史）。
     */
    splitWireAtPointInternal(wireId, x, y, options = {}) {
        return WireInteractions.splitWireAtPointInternal.call(this, wireId, x, y, options);
    }

    /**
     * 取消连线
     */
    cancelWiring() {
        return WireInteractions.cancelWiring.call(this);
    }

    registerDragListeners(startEvent, onMove, onUp) {
        return DragBehaviors.registerDragListeners.call(this, startEvent, onMove, onUp);
    }

    /**
     * 端子延长拖动（平滑移动，支持对齐）
     */
    startTerminalExtend(componentId, terminalIndex, e) {
        return DragBehaviors.startTerminalExtend.call(this, componentId, terminalIndex, e);
    }

    /**
     * 滑动变阻器拖动
     */
    startRheostatDrag(componentId, e) {
        return DragBehaviors.startRheostatDrag.call(this, componentId, e);
    }

    /**
     * 平行板电容探索模式：拖动右侧极板
     * - 左右拖动：改变板间距 d
     * - 上下拖动：改变重叠面积（通过纵向错位近似）
     */
    startParallelPlateCapacitorDrag(componentId, e) {
        return DragBehaviors.startParallelPlateCapacitorDrag.call(this, componentId, e);
    }

    /**
     * 选择元器件
     */
    selectComponent(id) {
        return SelectionPanelController.selectComponent.call(this, id);
    }

    /**
     * 选择导线（10 秒后自动取消选择）
     */
    selectWire(id) {
        return SelectionPanelController.selectWire.call(this, id);
    }
    
    /**
     * 查找附近的端点
     * @param {number} x - x坐标
     * @param {number} y - y坐标  
     * @param {number} threshold - 距离阈值
     * @returns {Object|null} 端点信息 {componentId, terminalIndex} 或 null
     */
    findNearbyTerminal(x, y, threshold) {
        return SnapController.findNearbyTerminal.call(this, x, y, threshold);
    }

    /**
     * 清除选择
     */
    clearSelection() {
        return SelectionPanelController.clearSelection.call(this);
    }

    /**
     * 更新属性面板（使用安全的 DOM 操作防止 XSS）
     */
    updatePropertyPanel(comp) {
        return PropertyPanelController.updatePropertyPanel.call(this, comp);
    }

    createMeterSelfReadingControl(comp) {
        return MeasurementReadoutController.createMeterSelfReadingControl.call(this, comp);
    }

    /**
     * 仅更新属性面板里的“实时测量”等动态值，避免每帧重建 DOM 导致闪烁/输入框失焦
     */
    updateSelectedComponentReadouts(comp) {
        return MeasurementReadoutController.updateSelectedComponentReadouts.call(this, comp);
    }

    /**
     * 仅更新滑动变阻器属性面板的动态值（避免闪烁）
     */
    updateRheostatPanelValues(comp) {
        return MeasurementReadoutController.updateRheostatPanelValues.call(this, comp);
    }

    /**
     * 根据平行板电容的物理参数重算电容值，并可选更新图形/面板。
     * 注意：不修改 prevCharge（用于保持“断开后 Q 近似守恒”的演示效果）。
     */
    recomputeParallelPlateCapacitance(comp, options = {}) {
        return MeasurementReadoutController.recomputeParallelPlateCapacitance.call(this, comp, options);
    }

    /**
     * 仅更新平行板电容在属性面板中的动态字段
     */
    updateParallelPlateCapacitorPanelValues(comp) {
        return MeasurementReadoutController.updateParallelPlateCapacitorPanelValues.call(this, comp);
    }

    /**
     * 显示属性编辑对话框（使用安全的 DOM 操作防止 XSS）
     */
    showPropertyDialog(id) {
        return PropertyDialogController.showPropertyDialog.call(this, id);
    }

    /**
     * 隐藏对话框
     */
    hideDialog() {
        return UIStateController.hideDialog.call(this);
    }

    /**
     * 安全解析数值，返回有效值或默认值
     */
    safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
        return UIStateController.safeParseFloat.call(this, value, defaultValue, minValue, maxValue);
    }

    /**
     * 获取黑箱内部包含的元器件（按中心点是否落在盒子范围内判断）
     * @param {Object} boxComp
     * @param {Object} options
     * @param {boolean} [options.includeBoxes=false] - 是否包含其它黑箱
     * @returns {string[]} component ids
     */
    getBlackBoxContainedComponentIds(boxComp, options = {}) {
        return UIStateController.getBlackBoxContainedComponentIds.call(this, boxComp, options);
    }

    /**
     * 应用对话框更改
     */
    applyDialogChanges() {
        return PropertyDialogActions.applyDialogChanges.call(this);
    }

    /**
     * 显示元器件上下文菜单
     */
    showContextMenu(e, componentId) {
        return ContextMenuController.showContextMenu.call(this, e, componentId);
    }
    
    /**
     * 显示导线上下文菜单
     */
    showWireContextMenu(e, wireId) {
        return ContextMenuController.showWireContextMenu.call(this, e, wireId);
    }

    showProbeContextMenu(e, probeId, wireId) {
        return ContextMenuController.showProbeContextMenu.call(this, e, probeId, wireId);
    }

    renameObservationProbe(probeId, nextLabel = null) {
        return ProbeActions.renameObservationProbe.call(this, probeId, nextLabel);
    }

    deleteObservationProbe(probeId) {
        return ProbeActions.deleteObservationProbe.call(this, probeId);
    }

    addProbePlot(probeId) {
        return ProbeActions.addProbePlot.call(this, probeId);
    }

    addObservationProbeForWire(wireId, probeType) {
        return ProbeActions.addObservationProbeForWire.call(this, wireId, probeType);
    }
    
    /**
     * 隐藏上下文菜单
     */
    hideContextMenu() {
        return ContextMenuController.hideContextMenu.call(this);
    }
    
    /**
     * 上下文菜单关闭处理器
     */
    hideContextMenuHandler = () => {
        this.hideContextMenu();
    }
    
    /**
     * 复制元器件
     */
    duplicateComponent(id) {
        return ComponentActions.duplicateComponent.call(this, id);
    }

    /**
     * =========================
     * Undo / Redo history
     * =========================
     */
    captureHistoryState() {
        return this.historyManager.captureState();
    }

    historyKey(state) {
        return this.historyManager.stateKey(state);
    }

    getSelectionSnapshot() {
        return this.historyManager.getSelectionSnapshot();
    }

    restoreSelectionSnapshot(snapshot) {
        this.historyManager.restoreSelectionSnapshot(snapshot);
    }

    pushHistoryEntry(entry) {
        this.historyManager.pushEntry(entry);
    }

    runWithHistory(label, action) {
        this.historyManager.runWithHistory(label, action);
    }

    beginHistoryTransaction(label) {
        this.historyManager.beginTransaction(label);
    }

    commitHistoryTransaction() {
        this.historyManager.commitTransaction();
    }

    applyHistoryState(state, selection) {
        this.historyManager.applyState(state, selection);
    }

    undo() {
        this.historyManager.undo();
    }

    redo() {
        this.historyManager.redo();
    }

    /**
     * 更新状态栏
     */
    updateStatus(text) {
        return UIStateController.updateStatus.call(this, text);
    }

    /**
     * 检测与其他元器件的对齐
     * @param {string} draggedId - 正在拖动的元器件ID
     * @param {number} x - 当前x坐标
     * @param {number} y - 当前y坐标
     * @returns {Object} 对齐信息
     */
    detectAlignment(draggedId, x, y) {
        return AlignmentGuideController.detectAlignment.call(this, draggedId, x, y);
    }

    /**
     * 显示对齐辅助线
     */
    showAlignmentGuides(alignment) {
        return AlignmentGuideController.showAlignmentGuides.call(this, alignment);
    }

    /**
     * 隐藏对齐辅助线
     */
    hideAlignmentGuides() {
        return AlignmentGuideController.hideAlignmentGuides.call(this);
    }
}
