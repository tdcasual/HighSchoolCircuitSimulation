import * as InteractionOrchestrator from '../../app/interaction/InteractionOrchestrator.js';

/**
 * 缩放控制事件
 */
export function bindZoomEvents() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.addEventListener('click', () => {
            this.resetView();
        });
        zoomLevel.title = '点击重置视图 (快捷键: H)';
    }
}

/**
 * 画布交互事件
 */
export function bindCanvasEvents() {
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

/**
 * 键盘事件
 */
export function bindKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
        return InteractionOrchestrator.onKeyDown.call(this, e);
    });
}
