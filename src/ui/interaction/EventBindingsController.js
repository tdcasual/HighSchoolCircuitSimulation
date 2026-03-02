import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

/**
 * 绑定所有事件
 */
export function bindEvents() {
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
export function bindZoomEvents() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        safeInvokeMethod(zoomLevel, 'addEventListener', 'click', () => {
            this.resetView();
        });
        zoomLevel.title = '点击重置视图 (快捷键: H)';
    }
}

/**
 * 画布交互事件
 */
export function bindCanvasEvents() {
    if (!this.svg || typeof this.svg.addEventListener !== 'function') return;

    const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
    if (supportsPointer) {
        safeInvokeMethod(this.svg, 'addEventListener', 'pointerdown', (e) => this.onPointerDown(e), { passive: false });
        safeInvokeMethod(this.svg, 'addEventListener', 'pointermove', (e) => this.onPointerMove(e), { passive: false });
        safeInvokeMethod(this.svg, 'addEventListener', 'pointerup', (e) => this.onPointerUp(e));
        safeInvokeMethod(this.svg, 'addEventListener', 'pointercancel', (e) => this.onPointerCancel(e));
        safeInvokeMethod(this.svg, 'addEventListener', 'pointerleave', (e) => this.onPointerLeave(e));
    } else {
        // 鼠标按下
        safeInvokeMethod(this.svg, 'addEventListener', 'mousedown', (e) => this.onMouseDown(e));
        // 鼠标移动
        safeInvokeMethod(this.svg, 'addEventListener', 'mousemove', (e) => this.onMouseMove(e));
        // 鼠标释放
        safeInvokeMethod(this.svg, 'addEventListener', 'mouseup', (e) => this.onMouseUp(e));
        // 鼠标离开
        safeInvokeMethod(this.svg, 'addEventListener', 'mouseleave', (e) => this.onMouseLeave(e));
    }

    // 右键菜单 - 禁用默认菜单
    safeInvokeMethod(this.svg, 'addEventListener', 'contextmenu', (e) => {
        e.preventDefault();
        this.onContextMenu(e);
    });

    // 双击编辑
    safeInvokeMethod(this.svg, 'addEventListener', 'dblclick', (e) => this.onDoubleClick(e));

    // 滚轮缩放
    safeInvokeMethod(this.svg, 'addEventListener', 'wheel', (e) => this.onWheel(e), { passive: false });
}

/**
 * 键盘事件
 */
export function bindKeyboardEvents() {
    safeInvokeMethod(document, 'addEventListener', 'keydown', (e) => {
        return InteractionOrchestrator.onKeyDown.call(this, e);
    });
}
