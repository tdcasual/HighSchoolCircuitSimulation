import { HistoryManager } from './HistoryManager.js';

/**
 * 初始化 InteractionManager 的运行时状态。
 */
export function initializeInteractionState(context, app, options = {}) {
    const HistoryManagerClass = options.HistoryManagerClass || HistoryManager;

    context.app = app;
    context.circuit = app.circuit;
    context.renderer = app.renderer;
    context.svg = app.svg;

    // 交互状态
    context.isDragging = false;
    context.isWiring = false;
    context.isDraggingComponent = false; // 标记是否正在拖动元器件（而不是从工具箱拖放）
    context.dragTarget = null;
    context.dragGroup = null; // 黑箱拖动时的组移动信息
    context.dragOffset = { x: 0, y: 0 };
    context.selectedComponent = null;
    context.selectedWire = null;

    // Undo/Redo history (circuit state snapshots)
    context.historyManager = new HistoryManagerClass(context, { maxEntries: 100 });

    // 连线状态
    context.wireStart = null;
    context.tempWire = null;
    context.ignoreNextWireMouseUp = false;
    context.isDraggingWireEndpoint = false;
    context.wireEndpointDrag = null; // {wireId,end}
    context.isDraggingWire = false;
    context.wireDrag = null; // {wireId,startCanvas,startClient,startA,startB,detached,lastDx,lastDy}

    // 画布平移状态
    context.isPanning = false;
    context.panStart = { x: 0, y: 0 };
    context.viewOffset = { x: 0, y: 0 };
    context.scale = 1;

    // Pointer 统一输入（触屏/鼠标/触控笔）
    context.activePointers = new Map(); // pointerId -> {clientX, clientY, pointerType}
    context.primaryPointerId = null;
    context.pinchGesture = null; // {pointerAId,pointerBId,startScale,startDistance,startCanvasPivot}
    context.blockSinglePointerInteraction = false; // pinch 后需抬起全部手指再恢复单指交互
    context.lastPrimaryPointerType = 'mouse';

    // 工具箱触屏放置（点击工具 -> 点击画布落子）
    context.pendingToolType = null;
    context.pendingToolItem = null;

    // 对齐辅助线
    context.alignmentGuides = null;
    context.snapThreshold = 10; // 吸附阈值（像素）
}
