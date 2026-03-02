import {
    createElement,
    createHintParagraph,
    createPropertyRow,
    clearElement
} from '../../utils/SafeDOM.js';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function safeHasClass(node, className) {
    const classList = node?.classList;
    if (!classList) return false;
    const result = safeInvokeMethod(classList, 'contains', className);
    return result === true;
}

function safeRemoveClass(node, className) {
    safeInvokeMethod(node?.classList, 'remove', className);
}

function renderDefaultPropertyHint() {
    const content = document.getElementById('property-content');
    if (!content) return;
    clearElement(content);
    safeRemoveClass(content, 'property-content-cards');
    const hint = createElement('p', { className: 'hint', textContent: '选择一个元器件查看和编辑属性' });
    content.appendChild(hint);
}

function isTouchPreferredMode() {
    if (typeof document === 'undefined') return false;
    const body = document.body;
    if (safeHasClass(body, 'layout-mode-compact') || safeHasClass(body, 'layout-mode-phone')) {
        return true;
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        try {
            return window.matchMedia('(pointer: coarse)').matches;
        } catch (_) {
            return false;
        }
    }
    return false;
}

export function clearSelection() {
    // 清除自动隐藏计时器
    if (this.wireAutoHideTimer) {
        clearTimeout(this.wireAutoHideTimer);
        this.wireAutoHideTimer = null;
    }

    this.renderer.clearSelection();
    this.selectedComponent = null;
    this.selectedWire = null;

    renderDefaultPropertyHint();
    this.quickActionBar?.notifyActivity?.();
    this.quickActionBar?.update?.();
}

export function selectComponent(id) {
    this.clearSelection();
    this.selectedComponent = id;
    this.selectedWire = null;
    this.renderer.setSelected(id, true);

    if (typeof this.activateSidePanelTab === 'function' && !this.isObservationTabActive()) {
        this.activateSidePanelTab('properties');
    }

    const comp = this.circuit.getComponent(id);
    if (comp) {
        this.updatePropertyPanel(comp);
    }
    this.quickActionBar?.notifyActivity?.();
    this.quickActionBar?.maybeShowLongPressHint?.();
    this.quickActionBar?.update?.();
}

/**
 * 选择导线（10 秒后自动取消选择）
 */
export function selectWire(id) {
    this.clearSelection();
    this.selectedWire = id;
    this.selectedComponent = null;
    this.renderer.setWireSelected(id, true);

    if (typeof this.activateSidePanelTab === 'function' && !this.isObservationTabActive()) {
        this.activateSidePanelTab('properties');
    }

    // 触屏模式下保持选择态，避免用户困惑；桌面端仍保留自动取消
    if (!isTouchPreferredMode()) {
        this.wireAutoHideTimer = setTimeout(() => {
            if (this.selectedWire === id) {
                this.renderer.setWireSelected(id, false);
                this.selectedWire = null;
                renderDefaultPropertyHint();
                this.quickActionBar?.update?.();
            }
        }, 10000);
    }

    const wire = this.circuit.getWire(id);
    const fmtEnd = (which) => {
        const ref = which === 'a' ? wire?.aRef : wire?.bRef;
        if (ref && ref.componentId !== undefined && ref.componentId !== null) {
            return `${ref.componentId}:${ref.terminalIndex}`;
        }
        const pt = which === 'a' ? wire?.a : wire?.b;
        if (pt && Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.y))) {
            return `(${Math.round(Number(pt.x))},${Math.round(Number(pt.y))})`;
        }
        return '?';
    };
    const length = wire?.a && wire?.b ? Math.hypot(wire.a.x - wire.b.x, wire.a.y - wire.b.y) : 0;

    // 显示导线信息（使用安全的 DOM 操作）
    const content = document.getElementById('property-content');
    if (!content) return;
    clearElement(content);
    safeRemoveClass(content, 'property-content-cards');

    content.appendChild(createPropertyRow('类型', '导线'));
    content.appendChild(createPropertyRow('端点 A', fmtEnd('a')));
    content.appendChild(createPropertyRow('端点 B', fmtEnd('b')));
    content.appendChild(createPropertyRow('长度', `${length.toFixed(1)} px`));
    content.appendChild(createHintParagraph([
        '拖动导线可整体平移（按网格移动）',
        '拖动两端圆点可移动端点（默认仅拖动当前端点，按 Shift 拖动整节点）',
        'Ctrl/Cmd + 点击导线可在该处分割成两段',
        'Shift + 点击空白处可从任意位置开始画导线（允许独立导线）',
        '拖动端子可伸长/缩短元器件引脚'
    ]));
    this.quickActionBar?.notifyActivity?.();
    this.quickActionBar?.maybeShowLongPressHint?.();
    this.quickActionBar?.update?.();
}
