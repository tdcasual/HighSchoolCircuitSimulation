/**
 * Interaction.js - 交互管理器
 * 处理拖放、连线、选择等用户交互
 */

import { createComponent, ComponentNames, ComponentDefaults, SVGRenderer } from '../components/Component.js';
import {
    createElement,
    createPropertyRow, 
    createHintParagraph,
    createFormGroup,
    createSelectFormGroup,
    createSliderFormGroup,
    createSwitchToggleGroup,
    clearElement
} from '../utils/SafeDOM.js';
import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../utils/Physics.js';
import { GRID_SIZE, snapToGrid, toCanvasInt } from '../utils/CanvasCoords.js';
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

const INTEGRATION_METHOD_OPTIONS = Object.freeze([
    { value: 'auto', label: '自动（默认梯形法）' },
    { value: 'trapezoidal', label: '梯形法' },
    { value: 'backward-euler', label: '后向欧拉' }
]);

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
        // 运行按钮
        document.getElementById('btn-run').addEventListener('click', () => {
            this.app.startSimulation();
        });
        
        // 停止按钮
        document.getElementById('btn-stop').addEventListener('click', () => {
            this.app.stopSimulation();
        });
        
        // 清空按钮
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('确定要清空整个电路吗？')) {
                this.app.clearCircuit();
            }
        });
        
        // 导出按钮
        document.getElementById('btn-export').addEventListener('click', () => {
            this.app.exportCircuit();
        });
        
        // 导入按钮
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('file-import').click();
        });
        
        // 文件选择
        document.getElementById('file-import').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.app.importCircuit(file);
            }
            e.target.value = '';
        });
        
        // 对话框按钮
        document.getElementById('dialog-cancel').addEventListener('click', () => {
            this.hideDialog();
        });
        
        document.getElementById('dialog-ok').addEventListener('click', () => {
            this.applyDialogChanges();
        });
        
        // 点击遮罩关闭对话框
        document.getElementById('dialog-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'dialog-overlay') {
                this.hideDialog();
            }
        });
    }

    /**
     * 右侧面板 Tab 切换
     */
    bindSidePanelEvents() {
        const tabButtons = Array.from(document.querySelectorAll('.panel-tab-btn'));
        const pages = Array.from(document.querySelectorAll('.panel-page'));
        if (tabButtons.length === 0 || pages.length === 0) return;

        const activate = (panelName) => {
            tabButtons.forEach((btn) => {
                const isActive = btn.dataset.panel === panelName;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            pages.forEach((page) => {
                const isActive = page.dataset.panel === panelName;
                page.classList.toggle('active', isActive);
                if (page.id === 'panel-observation') {
                    page.setAttribute('aria-hidden', isActive ? 'false' : 'true');
                }
            });
        };

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const panelName = btn.dataset.panel;
                if (panelName) activate(panelName);
            });
        });

        // 暴露给其他逻辑使用（选择元件时自动跳回属性页）
        this.activateSidePanelTab = activate;
    }

    isObservationTabActive() {
        const observationPage = document.getElementById('panel-observation');
        return !!(observationPage && observationPage.classList.contains('active'));
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
        if (!target || !target.classList) return null;
        if (target.classList.contains('terminal')) return target;
        if (target.classList.contains('terminal-hit-area')) return target;
        return null;
    }

    resolveProbeMarkerTarget(target) {
        if (!target || typeof target.closest !== 'function') return null;
        return target.closest('.wire-probe-marker');
    }

    resolvePointerType(event) {
        const pointerType = event?.pointerType;
        if (pointerType === 'mouse' || pointerType === 'touch' || pointerType === 'pen') {
            return pointerType;
        }
        return this.lastPrimaryPointerType || 'mouse';
    }

    getAdaptiveSnapThreshold(options = {}) {
        return SnapController.getAdaptiveSnapThreshold.call(this, options);
    }

    isWireEndpointTarget(target) {
        if (!target || !target.classList) return false;
        return target.classList.contains('wire-endpoint') || target.classList.contains('wire-endpoint-hit');
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
        const group = createElement('div', { className: 'form-group meter-self-reading-group' });
        group.appendChild(createElement('label', { textContent: '自主读数（右侧表盘）' }));

        const row = createElement('div', { className: 'meter-self-reading-row' });
        const enabled = !!comp.selfReading;
        const toggleBtn = createElement('button', {
            className: 'display-chip' + (enabled ? ' active' : ''),
            textContent: enabled ? '已开启' : '已关闭',
            attrs: {
                type: 'button',
                'aria-pressed': enabled ? 'true' : 'false'
            }
        });
        const openObservationBtn = createElement('button', {
            className: 'plot-clear-btn',
            textContent: '打开观察页',
            attrs: { type: 'button' }
        });

        const syncToggleState = () => {
            const isEnabled = !!comp.selfReading;
            toggleBtn.classList.toggle('active', isEnabled);
            toggleBtn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
            toggleBtn.textContent = isEnabled ? '已开启' : '已关闭';
        };

        toggleBtn.addEventListener('click', () => {
            this.runWithHistory('切换自主读数', () => {
                comp.selfReading = !comp.selfReading;
                this.app.observationPanel?.refreshDialGauges();
                syncToggleState();
                this.app.updateStatus(comp.selfReading ? '已开启自主读数：请在右侧“观察”查看表盘' : '已关闭自主读数');
            });
        });

        openObservationBtn.addEventListener('click', () => {
            if (typeof this.activateSidePanelTab === 'function') {
                this.activateSidePanelTab('observation');
            }
            this.app.observationPanel?.refreshComponentOptions?.();
            this.app.observationPanel?.refreshDialGauges?.();
            this.app.observationPanel?.requestRender?.({ onlyIfActive: false });
        });

        row.appendChild(toggleBtn);
        row.appendChild(openObservationBtn);
        group.appendChild(row);
        group.appendChild(createElement('p', {
            className: 'hint',
            textContent: '开启后会在“观察”页显示独立指针表盘。'
        }));
        return group;
    }

    /**
     * 仅更新属性面板里的“实时测量”等动态值，避免每帧重建 DOM 导致闪烁/输入框失焦
     */
    updateSelectedComponentReadouts(comp) {
        if (!comp) return;

        const currentEl = document.getElementById('measure-current');
        const voltageEl = document.getElementById('measure-voltage');
        const powerEl = document.getElementById('measure-power');

        if (currentEl) currentEl.textContent = `${(comp.currentValue || 0).toFixed(4)} A`;
        if (voltageEl) voltageEl.textContent = `${(comp.voltageValue || 0).toFixed(4)} V`;
        if (powerEl) powerEl.textContent = `${(comp.powerValue || 0).toFixed(4)} W`;

        // 仪表读数行（如果存在）
        const ammeterReading = document.querySelector('.ammeter-reading');
        if (ammeterReading && comp.type === 'Ammeter') {
            ammeterReading.textContent = `${(Math.abs(comp.currentValue) || 0).toFixed(3)} A`;
        }
        const voltmeterReading = document.querySelector('.voltmeter-reading');
        if (voltmeterReading && comp.type === 'Voltmeter') {
            voltmeterReading.textContent = `${(Math.abs(comp.voltageValue) || 0).toFixed(3)} V`;
        }

        // 特殊组件的动态字段
        if (comp.type === 'Rheostat') {
            this.updateRheostatPanelValues(comp);
        }
        if (comp.type === 'ParallelPlateCapacitor') {
            this.updateParallelPlateCapacitorPanelValues(comp);
        }
    }

    /**
     * 仅更新滑动变阻器属性面板的动态值（避免闪烁）
     */
    updateRheostatPanelValues(comp) {
        if (!comp || comp.type !== 'Rheostat') return;
        
        // 重新计算接入电路的电阻
        this.circuit.calculateRheostatActiveResistance(comp);
        
        const currentREl = document.getElementById('rheostat-current-r');
        const positionEl = document.getElementById('rheostat-position');
        
        const directionText = {
            'slider-right-increase': '→增大',
            'slider-right-decrease': '→减小',
            'fixed': '固定',
            'parallel': '并联',
            'disconnected': '-'
        };
        
        if (currentREl && positionEl) {
            // 使用安全的 DOM 操作
            clearElement(currentREl);
            currentREl.appendChild(document.createTextNode(`${(comp.activeResistance || 0).toFixed(1)} Ω `));
            const small = createElement('small', { textContent: directionText[comp.resistanceDirection] || '' });
            currentREl.appendChild(small);
            
            positionEl.textContent = `${(comp.position * 100).toFixed(0)}%`;
        }
    }

    /**
     * 根据平行板电容的物理参数重算电容值，并可选更新图形/面板。
     * 注意：不修改 prevCharge（用于保持“断开后 Q 近似守恒”的演示效果）。
     */
    recomputeParallelPlateCapacitance(comp, options = {}) {
        if (!comp || comp.type !== 'ParallelPlateCapacitor') return;

        const plateLengthPx = 24;
        const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
        const C = computeParallelPlateCapacitance({
            plateArea: comp.plateArea,
            plateDistance: comp.plateDistance,
            dielectricConstant: comp.dielectricConstant,
            overlapFraction
        });
        comp.capacitance = C;

        if (options.updateVisual) {
            const g = this.renderer.componentElements.get(comp.id);
            if (g) {
                SVGRenderer.updateParallelPlateCapacitorVisual(g, comp);
            } else {
                this.renderer.refreshComponent(comp);
            }
        }

        if (options.updatePanel) {
            this.updateParallelPlateCapacitorPanelValues(comp);
        }
    }

    /**
     * 仅更新平行板电容在属性面板中的动态字段
     */
    updateParallelPlateCapacitorPanelValues(comp) {
        if (!comp || comp.type !== 'ParallelPlateCapacitor') return;

        const plateLengthPx = 24;
        const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
        const distanceMm = (comp.plateDistance || 0) * 1000;
        const areaCm2 = (comp.plateArea || 0) * 10000;
        const effAreaCm2 = areaCm2 * overlapFraction;

        const voltage = Math.abs(comp.voltageValue || 0);
        const field = comp.plateDistance ? voltage / comp.plateDistance : 0; // V/m
        const charge = Math.abs(comp.prevCharge ?? (comp.capacitance || 0) * (comp.prevVoltage || 0));

        const capEl = document.getElementById('ppc-readout-capacitance');
        const distanceEl = document.getElementById('ppc-readout-distance');
        const overlapEl = document.getElementById('ppc-readout-overlap');
        const areaEl = document.getElementById('ppc-readout-area');
        const fieldEl = document.getElementById('ppc-readout-field');
        const chargeEl = document.getElementById('ppc-readout-charge');

        const formatCap = (C) => {
            if (!Number.isFinite(C)) return '0 F';
            const absC = Math.abs(C);
            if (absC >= 1e-3) return `${(C * 1e3).toFixed(3)} mF`;
            if (absC >= 1e-6) return `${(C * 1e6).toFixed(3)} μF`;
            if (absC >= 1e-9) return `${(C * 1e9).toFixed(3)} nF`;
            return `${(C * 1e12).toFixed(3)} pF`;
        };

        const formatCharge = (Q) => {
            if (!Number.isFinite(Q)) return '0 C';
            const absQ = Math.abs(Q);
            if (absQ >= 1e-3) return `${(Q * 1e3).toFixed(3)} mC`;
            if (absQ >= 1e-6) return `${(Q * 1e6).toFixed(3)} μC`;
            if (absQ >= 1e-9) return `${(Q * 1e9).toFixed(3)} nC`;
            return `${(Q * 1e12).toFixed(3)} pC`;
        };

        const formatField = (E) => {
            if (!Number.isFinite(E)) return '0 V/m';
            const absE = Math.abs(E);
            if (absE >= 1e6) return `${(E / 1e6).toFixed(3)} MV/m`;
            if (absE >= 1e3) return `${(E / 1e3).toFixed(3)} kV/m`;
            return `${E.toFixed(3)} V/m`;
        };

        if (capEl) capEl.textContent = formatCap(comp.capacitance || 0);
        if (distanceEl) distanceEl.textContent = `${distanceMm.toFixed(3)} mm`;
        if (overlapEl) overlapEl.textContent = `${(overlapFraction * 100).toFixed(1)}%`;
        if (areaEl) areaEl.textContent = `${effAreaCm2.toFixed(2)} cm²`;
        if (fieldEl) fieldEl.textContent = formatField(field);
        if (chargeEl) chargeEl.textContent = formatCharge(charge);

        // 输入框（如果存在）也同步当前值，避免拖动时显示滞后
        const distanceInput = document.getElementById('ppc-input-distance');
        if (distanceInput && document.activeElement !== distanceInput) {
            distanceInput.value = distanceMm.toFixed(3);
        }
    }

    /**
     * 显示属性编辑对话框（使用安全的 DOM 操作防止 XSS）
     */
    showPropertyDialog(id) {
        const comp = this.circuit.getComponent(id);
        if (!comp) return;
        
        this.editingComponent = comp;
        
        const dialog = document.getElementById('dialog-overlay');
        const title = document.getElementById('dialog-title');
        const content = document.getElementById('dialog-content');
        
        title.textContent = `编辑 ${ComponentNames[comp.type]}`;
        
        // 使用安全的 DOM 操作构建对话框内容
        clearElement(content);
        
        switch (comp.type) {
            case 'Ground':
                content.appendChild(createElement('p', { className: 'hint', textContent: '接地元件用于指定 0V 参考节点。' }));
                break;

            case 'PowerSource':
                content.appendChild(createFormGroup('电动势 (V)', {
                    id: 'edit-voltage',
                    value: comp.voltage,
                    min: 0,
                    step: 0.1,
                    unit: 'V'
                }));
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-internal-resistance',
                    value: comp.internalResistance,
                    min: 0,
                    step: 0.1,
                    unit: 'Ω'
                }));
                break;

            case 'ACVoltageSource':
                content.appendChild(createFormGroup('有效值 (V)', {
                    id: 'edit-rms-voltage',
                    value: comp.rmsVoltage,
                    min: 0,
                    step: 0.1,
                    unit: 'V'
                }));
                content.appendChild(createFormGroup('频率 (Hz)', {
                    id: 'edit-frequency',
                    value: comp.frequency,
                    min: 0,
                    step: 0.1,
                    unit: 'Hz'
                }));
                content.appendChild(createFormGroup('相位 (°)', {
                    id: 'edit-phase',
                    value: comp.phase,
                    step: 1,
                    unit: '°'
                }));
                content.appendChild(createFormGroup('偏置 (V)', {
                    id: 'edit-offset',
                    value: comp.offset,
                    step: 0.1,
                    unit: 'V'
                }));
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-internal-resistance',
                    value: comp.internalResistance,
                    min: 0,
                    step: 0.1,
                    unit: 'Ω'
                }));
                break;
                
            case 'Resistor':
                content.appendChild(createFormGroup('电阻值 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                break;

            case 'Diode':
                content.appendChild(createFormGroup('导通压降 Vf (V)', {
                    id: 'edit-forward-voltage',
                    value: Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : 0.7,
                    min: 0,
                    step: 0.01,
                    unit: 'V'
                }));
                content.appendChild(createFormGroup('导通电阻 Ron (Ω)', {
                    id: 'edit-on-resistance',
                    value: Number.isFinite(comp.onResistance) ? comp.onResistance : 1,
                    min: 1e-9,
                    step: 0.01,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('截止电阻 Roff (Ω)', {
                    id: 'edit-off-resistance',
                    value: Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9,
                    min: 1,
                    step: 1000,
                    unit: 'Ω'
                }));
                break;

            case 'LED':
                content.appendChild(createFormGroup('导通压降 Vf (V)', {
                    id: 'edit-forward-voltage',
                    value: Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : 2.0,
                    min: 0,
                    step: 0.01,
                    unit: 'V'
                }));
                content.appendChild(createFormGroup('导通电阻 Ron (Ω)', {
                    id: 'edit-on-resistance',
                    value: Number.isFinite(comp.onResistance) ? comp.onResistance : 2,
                    min: 1e-9,
                    step: 0.01,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('截止电阻 Roff (Ω)', {
                    id: 'edit-off-resistance',
                    value: Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9,
                    min: 1,
                    step: 1000,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('额定电流 If (mA)', {
                    id: 'edit-rated-current',
                    value: (Number.isFinite(comp.ratedCurrent) ? comp.ratedCurrent : 0.02) * 1000,
                    min: 0.1,
                    step: 0.1,
                    unit: 'mA'
                }));
                break;

            case 'Thermistor':
                content.appendChild(createFormGroup('R25 (Ω)', {
                    id: 'edit-r25',
                    value: Number.isFinite(comp.resistanceAt25) ? comp.resistanceAt25 : 1000,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('Beta 常数 (K)', {
                    id: 'edit-beta',
                    value: Number.isFinite(comp.beta) ? comp.beta : 3950,
                    min: 1,
                    step: 10,
                    unit: 'K'
                }));
                content.appendChild(createFormGroup('温度 (°C)', {
                    id: 'edit-temperature-c',
                    value: Number.isFinite(comp.temperatureC) ? comp.temperatureC : 25,
                    min: -100,
                    max: 300,
                    step: 1,
                    unit: '°C'
                }));
                break;

            case 'Photoresistor':
                content.appendChild(createFormGroup('暗态电阻 Rdark (Ω)', {
                    id: 'edit-resistance-dark',
                    value: Number.isFinite(comp.resistanceDark) ? comp.resistanceDark : 100000,
                    min: 0.001,
                    step: 100,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('亮态电阻 Rlight (Ω)', {
                    id: 'edit-resistance-light',
                    value: Number.isFinite(comp.resistanceLight) ? comp.resistanceLight : 500,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createSliderFormGroup('光照强度', {
                    id: 'edit-light-level',
                    valueId: 'light-level-value',
                    value: (Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5) * 100,
                    displayValue: `${Math.round((Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5) * 100)}%`,
                    min: 0,
                    max: 100,
                    step: 1
                }));
                break;

            case 'Relay':
                content.appendChild(createFormGroup('线圈电阻 (Ω)', {
                    id: 'edit-coil-resistance',
                    value: Number.isFinite(comp.coilResistance) ? comp.coilResistance : 200,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('吸合电流 (mA)', {
                    id: 'edit-pullin-current',
                    value: (Number.isFinite(comp.pullInCurrent) ? comp.pullInCurrent : 0.02) * 1000,
                    min: 0.1,
                    step: 0.1,
                    unit: 'mA'
                }));
                content.appendChild(createFormGroup('释放电流 (mA)', {
                    id: 'edit-dropout-current',
                    value: (Number.isFinite(comp.dropOutCurrent) ? comp.dropOutCurrent : 0.01) * 1000,
                    min: 0.1,
                    step: 0.1,
                    unit: 'mA'
                }));
                content.appendChild(createFormGroup('触点导通电阻 (Ω)', {
                    id: 'edit-contact-on-resistance',
                    value: Number.isFinite(comp.contactOnResistance) ? comp.contactOnResistance : 1e-3,
                    min: 1e-9,
                    step: 0.001,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('触点断开电阻 (Ω)', {
                    id: 'edit-contact-off-resistance',
                    value: Number.isFinite(comp.contactOffResistance) ? comp.contactOffResistance : 1e12,
                    min: 1,
                    step: 1000,
                    unit: 'Ω'
                }));
                break;
                
            case 'Rheostat':
                content.appendChild(createFormGroup('最小电阻 (Ω)', {
                    id: 'edit-min-resistance',
                    value: comp.minResistance,
                    min: 0,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('最大电阻 (Ω)', {
                    id: 'edit-max-resistance',
                    value: comp.maxResistance,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createSliderFormGroup('滑块位置', {
                    id: 'edit-position',
                    valueId: 'position-value',
                    value: (comp.position * 100).toFixed(0),
                    displayValue: `${(comp.position * 100).toFixed(0)}%`,
                    min: 0,
                    max: 100,
                    step: 1
                }));
                break;
                
            case 'Bulb':
                content.appendChild(createFormGroup('灯丝电阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('额定功率 (W)', {
                    id: 'edit-rated-power',
                    value: comp.ratedPower,
                    min: 0.001,
                    step: 0.1,
                    unit: 'W'
                }));
                break;
                
            case 'Capacitor':
                content.appendChild(createFormGroup('电容值 (μF)', {
                    id: 'edit-capacitance',
                    value: comp.capacitance * 1000000,
                    min: 0.001,
                    step: 100,
                    unit: 'μF'
                }));
                content.appendChild(createSelectFormGroup('积分方法', {
                    id: 'edit-integration-method',
                    value: comp.integrationMethod || 'auto',
                    options: INTEGRATION_METHOD_OPTIONS
                }, '自动模式会在含开关场景回退为后向欧拉。'));
                break;

            case 'Inductor':
                content.appendChild(createFormGroup('电感值 (H)', {
                    id: 'edit-inductance',
                    value: comp.inductance,
                    min: 1e-6,
                    step: 0.01,
                    unit: 'H'
                }));
                content.appendChild(createFormGroup('初始电流 (A)', {
                    id: 'edit-initial-current',
                    value: comp.initialCurrent || 0,
                    step: 0.01,
                    unit: 'A'
                }));
                content.appendChild(createSelectFormGroup('积分方法', {
                    id: 'edit-integration-method',
                    value: comp.integrationMethod || 'auto',
                    options: INTEGRATION_METHOD_OPTIONS
                }, '自动模式会在含开关场景回退为后向欧拉。'));
                break;

            case 'ParallelPlateCapacitor': {
                content.appendChild(createFormGroup('极板面积 A (cm²)', {
                    id: 'edit-plate-area',
                    value: (comp.plateArea || 0) * 10000,
                    min: 0.01,
                    step: 1,
                    unit: 'cm²'
                }));
                content.appendChild(createFormGroup('极板间距 d (mm)', {
                    id: 'edit-plate-distance',
                    value: (comp.plateDistance || 0) * 1000,
                    min: 0.01,
                    step: 0.1,
                    unit: 'mm'
                }));
                content.appendChild(createFormGroup('相对介电常数 εr', {
                    id: 'edit-dielectric-constant',
                    value: comp.dielectricConstant ?? 1,
                    min: 1,
                    step: 0.1,
                    unit: ''
                }));

                const exploreGroup = createElement('div', { className: 'form-group' });
                exploreGroup.appendChild(createElement('label', { textContent: '探索模式（可拖动极板）' }));
                const checkbox = createElement('input', {
                    id: 'edit-exploration-mode',
                    attrs: { type: 'checkbox' }
                });
                checkbox.checked = !!comp.explorationMode;
                exploreGroup.appendChild(checkbox);
                content.appendChild(exploreGroup);
                break;
            }
                
            case 'Motor':
                content.appendChild(createFormGroup('电枢电阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0.001,
                    step: 0.1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('负载转矩 (N·m)', {
                    id: 'edit-load-torque',
                    value: comp.loadTorque,
                    min: 0,
                    step: 0.001,
                    unit: 'N·m'
                }));
                break;
                
            case 'Switch':
                content.appendChild(createSwitchToggleGroup(comp.closed));
                break;

            case 'SPDTSwitch':
                content.appendChild(createSelectFormGroup('拨杆位置', {
                    id: 'edit-spdt-position',
                    value: comp.position === 'b' ? 'b' : 'a',
                    options: [
                        { value: 'a', label: '上掷 (A)' },
                        { value: 'b', label: '下掷 (B)' }
                    ]
                }));
                content.appendChild(createFormGroup('导通电阻 (Ω)', {
                    id: 'edit-on-resistance',
                    value: Number.isFinite(comp.onResistance) ? comp.onResistance : 1e-9,
                    min: 1e-9,
                    step: 0.001,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('断开支路电阻 (Ω)', {
                    id: 'edit-off-resistance',
                    value: Number.isFinite(comp.offResistance) ? comp.offResistance : 1e12,
                    min: 1,
                    step: 1000,
                    unit: 'Ω'
                }, '数值越大越接近理想断开'));
                break;

            case 'Fuse': {
                content.appendChild(createFormGroup('额定电流 (A)', {
                    id: 'edit-rated-current',
                    value: comp.ratedCurrent ?? 3,
                    min: 0.001,
                    step: 0.1,
                    unit: 'A'
                }));
                content.appendChild(createFormGroup('熔断阈值 I²t (A²·s)', {
                    id: 'edit-i2t-threshold',
                    value: comp.i2tThreshold ?? 1,
                    min: 1e-6,
                    step: 0.1,
                    unit: 'A²·s'
                }));
                content.appendChild(createFormGroup('正常电阻 (Ω)', {
                    id: 'edit-cold-resistance',
                    value: comp.coldResistance ?? 0.05,
                    min: 1e-9,
                    step: 0.001,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('熔断后电阻 (Ω)', {
                    id: 'edit-blown-resistance',
                    value: comp.blownResistance ?? 1e12,
                    min: 1,
                    step: 1000,
                    unit: 'Ω'
                }));

                const blownGroup = createElement('div', { className: 'form-group' });
                blownGroup.appendChild(createElement('label', { textContent: '状态' }));
                const blownInput = createElement('input', {
                    id: 'edit-fuse-blown',
                    attrs: { type: 'checkbox' }
                });
                blownInput.checked = !!comp.blown;
                blownGroup.appendChild(blownInput);
                blownGroup.appendChild(createElement('p', { className: 'hint', textContent: '取消勾选会复位保险丝并清空 I²t 累计值。' }));
                content.appendChild(blownGroup);
                break;
            }
                
            case 'Ammeter':
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0,
                    step: 0.01,
                    unit: 'Ω'
                }, '设为 0 表示理想电流表'));
                content.appendChild(createFormGroup('量程 (A)', {
                    id: 'edit-range',
                    value: comp.range,
                    min: 0.001,
                    step: 0.1,
                    unit: 'A'
                }));
                break;
                
            case 'Voltmeter':
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance === Infinity ? '' : comp.resistance,
                    min: 0,
                    step: 100,
                    unit: 'Ω',
                    placeholder: '留空表示无穷大'
                }, '留空或填 0 表示理想电压表（无穷大内阻）'));
                content.appendChild(createFormGroup('量程 (V)', {
                    id: 'edit-range',
                    value: comp.range,
                    min: 0.001,
                    step: 1,
                    unit: 'V'
                }));
                break;

            case 'BlackBox': {
                const w = Math.max(80, comp.boxWidth || 180);
                const h = Math.max(60, comp.boxHeight || 110);
                content.appendChild(createFormGroup('宽度 (px)', {
                    id: 'edit-box-width',
                    value: w,
                    min: 80,
                    step: 10,
                    unit: 'px'
                }));
                content.appendChild(createFormGroup('高度 (px)', {
                    id: 'edit-box-height',
                    value: h,
                    min: 60,
                    step: 10,
                    unit: 'px'
                }));

                const modeGroup = createElement('div', { className: 'form-group' });
                modeGroup.appendChild(createElement('label', { textContent: '显示模式' }));
                const select = createElement('select', { id: 'edit-box-mode' });
                select.appendChild(createElement('option', { textContent: '透明（观察内部）', attrs: { value: 'transparent' } }));
                select.appendChild(createElement('option', { textContent: '隐藏（黑箱）', attrs: { value: 'opaque' } }));
                select.value = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';
                modeGroup.appendChild(select);
                modeGroup.appendChild(createElement('p', { className: 'hint', textContent: '隐藏模式下会遮挡盒内电路，但电学计算不变。' }));
                content.appendChild(modeGroup);
                break;
            }
        }
        
        dialog.classList.remove('hidden');
        
        // 滑块实时更新
        const positionSlider = document.getElementById('edit-position');
        const positionValue = document.getElementById('position-value');
        if (positionSlider && positionValue) {
            positionSlider.addEventListener('input', () => {
                positionValue.textContent = `${positionSlider.value}%`;
            });
        }

        const lightLevelSlider = document.getElementById('edit-light-level');
        const lightLevelValue = document.getElementById('light-level-value');
        if (lightLevelSlider && lightLevelValue) {
            lightLevelSlider.addEventListener('input', () => {
                lightLevelValue.textContent = `${Math.round(Number(lightLevelSlider.value) || 0)}%`;
            });
        }
        
        // 开关状态切换按钮
        const switchOpen = document.getElementById('switch-open');
        const switchClose = document.getElementById('switch-close');
        if (switchOpen && switchClose) {
            switchOpen.addEventListener('click', () => {
                switchOpen.classList.add('active');
                switchClose.classList.remove('active');
            });
            switchClose.addEventListener('click', () => {
                switchClose.classList.add('active');
                switchOpen.classList.remove('active');
            });
        }
    }

    /**
     * 隐藏对话框
     */
    hideDialog() {
        document.getElementById('dialog-overlay').classList.add('hidden');
        this.editingComponent = null;
    }

    /**
     * 安全解析数值，返回有效值或默认值
     */
    safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
        let result = parseFloat(value);
        if (!Number.isFinite(result)) {
            result = defaultValue;
        }
        if (minValue !== null && result < minValue) {
            result = minValue;
        }
        if (maxValue !== null && result > maxValue) {
            result = maxValue;
        }
        return result;
    }

    /**
     * 获取黑箱内部包含的元器件（按中心点是否落在盒子范围内判断）
     * @param {Object} boxComp
     * @param {Object} options
     * @param {boolean} [options.includeBoxes=false] - 是否包含其它黑箱
     * @returns {string[]} component ids
     */
    getBlackBoxContainedComponentIds(boxComp, options = {}) {
        if (!boxComp || boxComp.type !== 'BlackBox') return [];
        const includeBoxes = !!options.includeBoxes;
        const w = Math.max(80, boxComp.boxWidth || 180);
        const h = Math.max(60, boxComp.boxHeight || 110);
        const left = (boxComp.x || 0) - w / 2;
        const right = (boxComp.x || 0) + w / 2;
        const top = (boxComp.y || 0) - h / 2;
        const bottom = (boxComp.y || 0) + h / 2;

        const ids = [];
        for (const [id, comp] of this.circuit.components) {
            if (!comp || id === boxComp.id) continue;
            if (!includeBoxes && comp.type === 'BlackBox') continue;
            const x = comp.x || 0;
            const y = comp.y || 0;
            if (x >= left && x <= right && y >= top && y <= bottom) {
                ids.push(id);
            }
        }
        return ids;
    }

    /**
     * 应用对话框更改
     */
    applyDialogChanges() {
        if (!this.editingComponent) return;
        
        const comp = this.editingComponent;

        try {
            this.runWithHistory('修改属性', () => {
                switch (comp.type) {
                case 'Ground':
                    break;

                case 'PowerSource':
                    comp.voltage = this.safeParseFloat(
                        document.getElementById('edit-voltage').value, 12, 0, 10000
                    );
                    // 内阻不能为0，会导致矩阵奇异；最小设为极小值
                    let internalR = this.safeParseFloat(
                        document.getElementById('edit-internal-resistance').value, 0.5, 0, 10000
                    );
                    // 如果用户输入0，使用极小值避免求解器奇异
                    comp.internalResistance = internalR < 1e-9 ? 1e-9 : internalR;
                    break;

                case 'ACVoltageSource':
                    comp.rmsVoltage = this.safeParseFloat(
                        document.getElementById('edit-rms-voltage').value, 12, 0, 10000
                    );
                    comp.frequency = this.safeParseFloat(
                        document.getElementById('edit-frequency').value, 50, 0, 1e6
                    );
                    comp.phase = this.safeParseFloat(
                        document.getElementById('edit-phase').value, 0, -36000, 36000
                    );
                    comp.offset = this.safeParseFloat(
                        document.getElementById('edit-offset').value, 0, -1e6, 1e6
                    );
                    let acInternalR = this.safeParseFloat(
                        document.getElementById('edit-internal-resistance').value, 0.5, 0, 10000
                    );
                    comp.internalResistance = acInternalR < 1e-9 ? 1e-9 : acInternalR;
                    break;
                    
                case 'Resistor':
                    // 电阻最小值为极小正数，避免除零
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 100, 1e-9, 1e12
                    );
                    break;

                case 'Diode':
                    comp.forwardVoltage = this.safeParseFloat(
                        document.getElementById('edit-forward-voltage').value, 0.7, 0, 1000
                    );
                    comp.onResistance = this.safeParseFloat(
                        document.getElementById('edit-on-resistance').value, 1, 1e-9, 1e9
                    );
                    comp.offResistance = this.safeParseFloat(
                        document.getElementById('edit-off-resistance').value, 1e9, 1, 1e15
                    );
                    break;

                case 'LED':
                    comp.forwardVoltage = this.safeParseFloat(
                        document.getElementById('edit-forward-voltage').value, 2, 0, 1000
                    );
                    comp.onResistance = this.safeParseFloat(
                        document.getElementById('edit-on-resistance').value, 2, 1e-9, 1e9
                    );
                    comp.offResistance = this.safeParseFloat(
                        document.getElementById('edit-off-resistance').value, 1e9, 1, 1e15
                    );
                    comp.ratedCurrent = this.safeParseFloat(
                        document.getElementById('edit-rated-current').value, 20, 0.1, 100000
                    ) / 1000;
                    break;

                case 'Thermistor':
                    comp.resistanceAt25 = this.safeParseFloat(
                        document.getElementById('edit-r25').value, 1000, 1e-9, 1e15
                    );
                    comp.beta = this.safeParseFloat(
                        document.getElementById('edit-beta').value, 3950, 1, 1e6
                    );
                    comp.temperatureC = this.safeParseFloat(
                        document.getElementById('edit-temperature-c').value, 25, -100, 300
                    );
                    break;

                case 'Photoresistor':
                    comp.resistanceDark = this.safeParseFloat(
                        document.getElementById('edit-resistance-dark').value, 100000, 1e-9, 1e15
                    );
                    comp.resistanceLight = this.safeParseFloat(
                        document.getElementById('edit-resistance-light').value, 500, 1e-9, 1e15
                    );
                    comp.lightLevel = this.safeParseFloat(
                        document.getElementById('edit-light-level').value, 50, 0, 100
                    ) / 100;
                    break;

                case 'Relay':
                    comp.coilResistance = this.safeParseFloat(
                        document.getElementById('edit-coil-resistance').value, 200, 1e-9, 1e15
                    );
                    comp.pullInCurrent = this.safeParseFloat(
                        document.getElementById('edit-pullin-current').value, 20, 0.1, 1e6
                    ) / 1000;
                    comp.dropOutCurrent = this.safeParseFloat(
                        document.getElementById('edit-dropout-current').value, 10, 0.1, 1e6
                    ) / 1000;
                    comp.contactOnResistance = this.safeParseFloat(
                        document.getElementById('edit-contact-on-resistance').value, 1e-3, 1e-9, 1e9
                    );
                    comp.contactOffResistance = this.safeParseFloat(
                        document.getElementById('edit-contact-off-resistance').value, 1e12, 1, 1e15
                    );
                    break;
                    
                case 'Rheostat':
                    comp.minResistance = this.safeParseFloat(
                        document.getElementById('edit-min-resistance').value, 0, 0, 1e12
                    );
                    comp.maxResistance = this.safeParseFloat(
                        document.getElementById('edit-max-resistance').value, 100, comp.minResistance + 0.001, 1e12
                    );
                    comp.position = this.safeParseFloat(
                        document.getElementById('edit-position').value, 50, 0, 100
                    ) / 100;
                    break;
                    
                case 'Bulb':
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 50, 1e-9, 1e12
                    );
                    comp.ratedPower = this.safeParseFloat(
                        document.getElementById('edit-rated-power').value, 5, 0.001, 1e9
                    );
                    break;
                    
                case 'Capacitor':
                    // 电容值以μF输入，转换为F
                    const capValue = this.safeParseFloat(
                        document.getElementById('edit-capacitance').value, 1000, 0.001, 1e12
                    );
                    comp.capacitance = capValue / 1000000;
                    comp.integrationMethod = document.getElementById('edit-integration-method')?.value || 'auto';
                    comp._dynamicHistoryReady = false;
                    break;

                case 'Inductor':
                    comp.inductance = this.safeParseFloat(
                        document.getElementById('edit-inductance').value, 0.1, 1e-9, 1e12
                    );
                    comp.initialCurrent = this.safeParseFloat(
                        document.getElementById('edit-initial-current').value, 0, -1e6, 1e6
                    );
                    comp.prevCurrent = comp.initialCurrent;
                    comp.prevVoltage = 0;
                    comp.integrationMethod = document.getElementById('edit-integration-method')?.value || 'auto';
                    comp._dynamicHistoryReady = false;
                    break;

                case 'ParallelPlateCapacitor': {
                    const areaCm2 = this.safeParseFloat(
                        document.getElementById('edit-plate-area').value,
                        (comp.plateArea || 0.01) * 10000,
                        0.01,
                        1e12
                    );
                    const distanceMm = this.safeParseFloat(
                        document.getElementById('edit-plate-distance').value,
                        (comp.plateDistance || 0.001) * 1000,
                        0.001,
                        1e9
                    );
                    comp.plateArea = areaCm2 / 10000;
                    comp.plateDistance = distanceMm / 1000;
                    comp.dielectricConstant = this.safeParseFloat(
                        document.getElementById('edit-dielectric-constant').value,
                        comp.dielectricConstant ?? 1,
                        1,
                        1e9
                    );
                    const exploreEl = document.getElementById('edit-exploration-mode');
                    comp.explorationMode = !!(exploreEl && exploreEl.checked);

                    this.recomputeParallelPlateCapacitance(comp, { updateVisual: false });
                    break;
                }
                    
                case 'Motor':
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 5, 1e-9, 1e12
                    );
                    comp.loadTorque = this.safeParseFloat(
                        document.getElementById('edit-load-torque').value, 0.01, 0, 1e9
                    );
                    break;
                    
                case 'Switch':
                    // 检查哪个按钮被选中
                    const switchClose = document.getElementById('switch-close');
                    comp.closed = switchClose && switchClose.classList.contains('active');
                    break;

                case 'SPDTSwitch':
                    comp.position = document.getElementById('edit-spdt-position')?.value === 'b' ? 'b' : 'a';
                    comp.onResistance = this.safeParseFloat(
                        document.getElementById('edit-on-resistance').value, 1e-9, 1e-9, 1e9
                    );
                    comp.offResistance = this.safeParseFloat(
                        document.getElementById('edit-off-resistance').value, 1e12, 1, 1e15
                    );
                    break;

                case 'Fuse': {
                    comp.ratedCurrent = this.safeParseFloat(
                        document.getElementById('edit-rated-current').value, 3, 0.001, 1e9
                    );
                    comp.i2tThreshold = this.safeParseFloat(
                        document.getElementById('edit-i2t-threshold').value, 1, 1e-9, 1e12
                    );
                    comp.coldResistance = this.safeParseFloat(
                        document.getElementById('edit-cold-resistance').value, 0.05, 1e-9, 1e9
                    );
                    comp.blownResistance = this.safeParseFloat(
                        document.getElementById('edit-blown-resistance').value, 1e12, 1, 1e15
                    );
                    const blownChecked = !!document.getElementById('edit-fuse-blown')?.checked;
                    if (!blownChecked) {
                        comp.i2tAccum = 0;
                    }
                    comp.blown = blownChecked;
                    break;
                }
                    
                case 'Ammeter':
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 0, 0, 1e12
                    );
                    comp.range = this.safeParseFloat(
                        document.getElementById('edit-range').value, 3, 0.001, 1e9
                    );
                    break;
                    
                case 'Voltmeter':
                    const voltmeterR = document.getElementById('edit-resistance').value;
                    // 空值或0表示理想电压表（无穷大内阻）
                    if (voltmeterR === '' || parseFloat(voltmeterR) <= 0) {
                        comp.resistance = Infinity;
                    } else {
                        comp.resistance = this.safeParseFloat(voltmeterR, Infinity, 0, 1e12);
                    }
                    comp.range = this.safeParseFloat(
                        document.getElementById('edit-range').value, 15, 0.001, 1e9
                    );
                    break;

                case 'BlackBox': {
                    comp.boxWidth = Math.round(this.safeParseFloat(
                        document.getElementById('edit-box-width').value,
                        comp.boxWidth || 180,
                        80,
                        5000
                    ));
                    comp.boxHeight = Math.round(this.safeParseFloat(
                        document.getElementById('edit-box-height').value,
                        comp.boxHeight || 110,
                        60,
                        5000
                    ));
                    const mode = document.getElementById('edit-box-mode')?.value;
                    comp.viewMode = mode === 'opaque' ? 'opaque' : 'transparent';
                    break;
                }
            }

            this.circuit.markSolverCircuitDirty();

            // 刷新渲染
            if (comp.type === 'BlackBox') {
                // 黑箱会影响“内部元件/导线是否显示”，需要全量重绘
                this.renderer.render();
                this.selectComponent(comp.id);
            } else {
                this.renderer.refreshComponent(comp);
                this.renderer.setSelected(comp.id, true);
                // 更新连接到该元器件的导线
                this.renderer.updateConnectedWires(comp.id);
                this.updatePropertyPanel(comp);
            }
            
            this.hideDialog();
            this.updateStatus('属性已更新');
            });
        } catch (error) {
            console.error('Error applying dialog changes:', error);
            this.updateStatus('更新失败：' + error.message);
        }
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
        document.getElementById('status-text').textContent = text;
    }

    /**
     * 检测与其他元器件的对齐
     * @param {string} draggedId - 正在拖动的元器件ID
     * @param {number} x - 当前x坐标
     * @param {number} y - 当前y坐标
     * @returns {Object} 对齐信息
     */
    detectAlignment(draggedId, x, y) {
        const result = {
            snapX: null,
            snapY: null,
            guideLines: []
        };
        
        const threshold = this.snapThreshold;
        
        // 收集所有其他元器件的位置
        const otherPositions = [];
        for (const [id, comp] of this.circuit.components) {
            if (id !== draggedId) {
                otherPositions.push({ x: comp.x, y: comp.y, id });
            }
        }
        
        // 检测水平对齐（y相同）
        for (const other of otherPositions) {
            const diffY = Math.abs(y - other.y);
            if (diffY < threshold) {
                result.snapY = other.y;
                result.guideLines.push({
                    type: 'horizontal',
                    y: other.y,
                    x1: Math.min(x, other.x) - 50,
                    x2: Math.max(x, other.x) + 50
                });
                break;
            }
        }
        
        // 检测垂直对齐（x相同）
        for (const other of otherPositions) {
            const diffX = Math.abs(x - other.x);
            if (diffX < threshold) {
                result.snapX = other.x;
                result.guideLines.push({
                    type: 'vertical',
                    x: other.x,
                    y1: Math.min(y, other.y) - 50,
                    y2: Math.max(y, other.y) + 50
                });
                break;
            }
        }
        
        return result;
    }

    /**
     * 显示对齐辅助线
     */
    showAlignmentGuides(alignment) {
        // 获取或创建辅助线容器
        let guidesGroup = this.svg.querySelector('#alignment-guides');
        if (!guidesGroup) {
            guidesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            guidesGroup.id = 'alignment-guides';
            // 应用与其他图层相同的变换
            guidesGroup.setAttribute('transform', 
                `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
            );
            this.svg.appendChild(guidesGroup);
        }
        
        // 清除旧的辅助线
        guidesGroup.innerHTML = '';
        
        // 绘制新的辅助线
        for (const guide of alignment.guideLines) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'alignment-guide');
            
            if (guide.type === 'horizontal') {
                line.setAttribute('x1', guide.x1);
                line.setAttribute('y1', guide.y);
                line.setAttribute('x2', guide.x2);
                line.setAttribute('y2', guide.y);
            } else {
                line.setAttribute('x1', guide.x);
                line.setAttribute('y1', guide.y1);
                line.setAttribute('x2', guide.x);
                line.setAttribute('y2', guide.y2);
            }
            
            guidesGroup.appendChild(line);
        }
    }

    /**
     * 隐藏对齐辅助线
     */
    hideAlignmentGuides() {
        const guidesGroup = this.svg.querySelector('#alignment-guides');
        if (guidesGroup) {
            guidesGroup.innerHTML = '';
        }
    }
}
