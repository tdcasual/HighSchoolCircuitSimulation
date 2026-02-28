import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';

const COMPONENT_ACTIONS = Object.freeze([
    Object.freeze({ label: '编辑', id: 'component-edit' }),
    Object.freeze({ label: '复制', id: 'component-duplicate' }),
    Object.freeze({ label: '旋转', id: 'component-rotate' }),
    Object.freeze({ label: '取消选择', id: 'selection-clear' }),
    Object.freeze({ label: '删除', id: 'component-delete' })
]);

const WIRE_ACTIONS = Object.freeze([
    Object.freeze({ label: '电压探针', id: 'wire-probe-voltage' }),
    Object.freeze({ label: '电流探针', id: 'wire-probe-current' }),
    Object.freeze({ label: '分割', id: 'wire-split-point' }),
    Object.freeze({ label: '水平拉直', id: 'wire-straighten-horizontal' }),
    Object.freeze({ label: '垂直拉直', id: 'wire-straighten-vertical' }),
    Object.freeze({ label: '取消选择', id: 'selection-clear' }),
    Object.freeze({ label: '删除', id: 'wire-delete' })
]);

function createButton(label, actionId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-action-btn';
    button.dataset.action = actionId;
    button.textContent = label;
    return button;
}

function ensurePositiveFinite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function projectPointToSegment(a, b, point) {
    if (!a || !b || !point) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return null;
    const tRaw = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
    const t = Math.max(0, Math.min(1, tRaw));
    const projX = toCanvasInt(a.x + dx * t);
    const projY = toCanvasInt(a.y + dy * t);
    const dist = Math.hypot(point.x - projX, point.y - projY);
    return { x: projX, y: projY, dist };
}

function resolveWireAnchorEnd(wire, pointer) {
    const a = normalizeCanvasPoint(wire?.a);
    const b = normalizeCanvasPoint(wire?.b);
    if (!a || !b) return 'a';
    if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return 'a';
    const dA = Math.hypot(pointer.x - a.x, pointer.y - a.y);
    const dB = Math.hypot(pointer.x - b.x, pointer.y - b.y);
    return dA <= dB ? 'a' : 'b';
}

function resolveWireSplitPoint(wire, pointer, threshold) {
    const a = normalizeCanvasPoint(wire?.a);
    const b = normalizeCanvasPoint(wire?.b);
    if (!a || !b) return null;
    if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
    const projected = projectPointToSegment(a, b, pointer);
    if (!projected) return null;
    const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 0;
    if (safeThreshold > 0 && projected.dist > safeThreshold) return null;
    return { x: projected.x, y: projected.y };
}

export class QuickActionBarController {
    constructor(interaction) {
        this.interaction = interaction;
        this.container = document.getElementById('canvas-container');
        this.statusBar = document.getElementById('status-bar');
        this.mobileControls = document.getElementById('canvas-mobile-controls');
        this.toolbox = document.getElementById('toolbox');
        this.sidePanel = document.getElementById('side-panel');
        this.root = null;
        this.label = null;
        this.actions = null;
        this.hint = null;
        this.hintTimer = null;
        this.hintStorageKey = 'ui.longpress_hint_shown_v1';
        this.boundClick = (event) => this.onActionClick(event);
        this.idleTimer = null;
        this.idleHidden = false;
        this.idleHideMs = 8000;
        this.currentSelectionMode = 'none';

        this.initialize();
    }

    initialize() {
        if (!this.container || typeof document === 'undefined') return;
        const root = document.createElement('div');
        root.id = 'quick-action-bar';
        root.className = 'quick-action-bar';
        root.hidden = true;

        const label = document.createElement('div');
        label.className = 'quick-action-label';
        root.appendChild(label);

        const actions = document.createElement('div');
        actions.className = 'quick-action-actions';
        actions.addEventListener('click', this.boundClick);
        root.appendChild(actions);

        this.container.appendChild(root);
        this.root = root;
        this.label = label;
        this.actions = actions;

        const hint = document.createElement('div');
        hint.id = 'mobile-hint';
        hint.className = 'mobile-hint';
        hint.hidden = true;
        this.container.appendChild(hint);
        this.hint = hint;
    }

    isTouchPreferredMode() {
        if (typeof document === 'undefined') return false;
        const body = document.body;
        if (body?.classList?.contains('layout-mode-compact') || body?.classList?.contains('layout-mode-phone')) {
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

    clearActions() {
        if (!this.actions) return;
        this.actions.innerHTML = '';
    }

    hide() {
        if (!this.root) return;
        this.root.hidden = true;
        this.clearActions();
        if (this.label) this.label.textContent = '';
    }

    clearHintTimer() {
        if (this.hintTimer) {
            clearTimeout(this.hintTimer);
            this.hintTimer = null;
        }
    }

    hideHint() {
        if (!this.hint) return;
        this.clearHintTimer();
        this.hint.hidden = true;
        this.hint.classList.remove('show');
        this.hint.textContent = '';
    }

    showHint(message, durationMs = 2600) {
        if (!this.hint) return;
        this.clearHintTimer();
        this.hint.textContent = message;
        this.hint.hidden = false;
        this.hint.classList.add('show');
        this.hintTimer = setTimeout(() => {
            this.hideHint();
        }, durationMs);
    }

    hasShownHint() {
        if (typeof window === 'undefined') return true;
        try {
            return window.localStorage?.getItem(this.hintStorageKey) === '1';
        } catch (_) {
            return true;
        }
    }

    markHintShown() {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage?.setItem(this.hintStorageKey, '1');
        } catch (_) {}
    }

    maybeShowLongPressHint() {
        if (!this.isTouchPreferredMode()) return;
        if (this.hasShownHint()) return;
        const pointerType = this.interaction?.lastPrimaryPointerType || 'touch';
        if (pointerType === 'mouse') return;
        this.showHint('提示：长按元器件/导线可打开更多操作');
        this.markHintShown();
    }

    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    resetIdleState() {
        this.clearIdleTimer();
        this.idleHidden = false;
    }

    scheduleIdleHide() {
        if (this.idleHideMs <= 0) return;
        this.clearIdleTimer();
        this.idleTimer = setTimeout(() => {
            if (!this.root) return;
            if (!this.isTouchPreferredMode()) return;
            if (this.interaction?.selectedComponent || this.interaction?.selectedWire) {
                this.idleHidden = true;
                this.update();
            }
        }, this.idleHideMs);
    }

    notifyActivity() {
        if (!this.isTouchPreferredMode()) return;
        if (this.idleHidden) {
            this.idleHidden = false;
            this.update();
            return;
        }
        this.scheduleIdleHide();
    }

    getStatusBarHeight() {
        const height = Number(this.statusBar?.getBoundingClientRect?.().height);
        return Number.isFinite(height) && height > 0 ? height : 0;
    }

    getMobileControlsHeight() {
        if (typeof document === 'undefined') return 0;
        const body = document.body;
        if (!body?.classList?.contains?.('layout-mode-phone')) return 0;
        if (this.mobileControls?.hidden) return 0;
        const height = Number(this.mobileControls?.getBoundingClientRect?.().height);
        return Number.isFinite(height) && height > 0 ? height : 0;
    }

    applyBottomOffset() {
        if (!this.root?.style?.setProperty) return;
        const statusBarHeight = this.getStatusBarHeight();
        const mobileControlsHeight = this.getMobileControlsHeight();
        const offset = Math.max(44, Math.ceil(statusBarHeight) + Math.ceil(mobileControlsHeight) + 8);
        this.root.style.setProperty('--quick-action-bottom-offset', `${offset}px`);
        if (this.container?.style?.setProperty) {
            this.container.style.setProperty('--quick-action-bottom-offset', `${offset}px`);
        }
    }

    isOverlayDrawerOpen() {
        const layout = this.interaction?.app?.responsiveLayout;
        if (!layout?.isOverlayMode?.()) return false;

        if (layout.toolboxOpen || layout.sidePanelOpen) return true;

        const toolboxOpen = !!this.toolbox?.classList?.contains?.('layout-open');
        const sidePanelOpen = !!this.sidePanel?.classList?.contains?.('layout-open');
        return toolboxOpen || sidePanelOpen;
    }

    resolveSelectionState() {
        const componentId = this.interaction?.selectedComponent || null;
        const wireId = this.interaction?.selectedWire || null;
        const hasComponent = componentId
            ? this.interaction?.circuit?.getComponent?.(componentId)
            : null;
        const hasWire = wireId
            ? this.interaction?.circuit?.getWire?.(wireId)
            : null;

        if (componentId && !hasComponent) {
            this.interaction.selectedComponent = null;
        }
        if (wireId && !hasWire) {
            this.interaction.selectedWire = null;
        }

        if (hasComponent) {
            return { mode: 'component', componentId };
        }
        if (hasWire) {
            return { mode: 'wire', wireId };
        }
        return { mode: 'none', componentId: null, wireId: null };
    }

    syncSelectionMode(mode) {
        this.currentSelectionMode = mode;
        this.interaction?.app?.topActionMenu?.setSelectionMode?.(mode);
    }

    update() {
        if (!this.root) return;
        this.applyBottomOffset();

        if (!this.isTouchPreferredMode()) {
            this.resetIdleState();
            this.setMobileControlsCondensed(false);
            this.syncSelectionMode('none');
            this.hide();
            return;
        }
        if (this.isOverlayDrawerOpen()) {
            this.resetIdleState();
            this.setMobileControlsCondensed(false);
            this.syncSelectionMode('none');
            this.hide();
            return;
        }

        const selection = this.resolveSelectionState();
        if (this.idleHidden) {
            this.setMobileControlsCondensed(false);
            this.syncSelectionMode('none');
            this.hide();
            return;
        }
        if (selection.mode === 'component' && selection.componentId) {
            this.syncSelectionMode('component');
            this.renderComponentActions(selection.componentId);
            this.setMobileControlsCondensed(true);
            this.scheduleIdleHide();
            return;
        }
        if (selection.mode === 'wire' && selection.wireId) {
            this.syncSelectionMode('wire');
            this.renderWireActions(selection.wireId);
            this.setMobileControlsCondensed(true);
            this.scheduleIdleHide();
            return;
        }
        this.resetIdleState();
        this.setMobileControlsCondensed(false);
        this.syncSelectionMode('none');
        this.hide();
    }

    renderComponentActions(componentId) {
        const comp = this.interaction.circuit?.getComponent?.(componentId);
        if (!comp) {
            this.hide();
            return;
        }
        this.root.hidden = false;
        if (this.label) {
            this.label.textContent = `元件 ${comp.label || componentId}`;
        }
        this.clearActions();
        COMPONENT_ACTIONS.forEach((action) => {
            this.actions.appendChild(createButton(action.label, action.id));
        });
    }

    renderWireActions(wireId) {
        const wire = this.interaction.circuit?.getWire?.(wireId);
        if (!wire) {
            this.hide();
            return;
        }

        this.root.hidden = false;
        if (this.label) {
            this.label.textContent = `导线 ${wireId}`;
        }
        this.clearActions();
        WIRE_ACTIONS.forEach((action) => {
            this.actions.appendChild(createButton(action.label, action.id));
        });
    }

    setMobileControlsCondensed(active) {
        if (typeof document === 'undefined') return;
        const body = document.body;
        if (!body?.classList) return;
        body.classList.toggle('mobile-controls-condensed', !!active);
    }

    getLastPointerCanvas() {
        const point = this.interaction?.lastPointerCanvas;
        if (!point) return null;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
        return { x: point.x, y: point.y };
    }

    getWireActionThreshold() {
        if (typeof this.interaction?.getAdaptiveSnapThreshold === 'function') {
            const pointerType = this.interaction?.lastPrimaryPointerType || 'touch';
            return this.interaction.getAdaptiveSnapThreshold({ pointerType });
        }
        return 15;
    }

    splitWireAtBestPoint(wireId) {
        const wire = this.interaction.circuit?.getWire?.(wireId);
        if (!wire?.a || !wire?.b) return;
        const pointer = this.getLastPointerCanvas();
        const threshold = this.getWireActionThreshold();
        const splitPoint = pointer ? resolveWireSplitPoint(wire, pointer, threshold) : null;
        if (splitPoint) {
            this.interaction.splitWireAtPoint?.(wireId, splitPoint.x, splitPoint.y);
            return;
        }
        this.splitWireAtMidpoint(wireId);
    }

    straightenWire(wireId, mode) {
        const interaction = this.interaction;
        const wire = interaction.circuit?.getWire?.(wireId);
        if (!wire?.a || !wire?.b) return;
        const pointer = this.getLastPointerCanvas();
        const anchorEnd = resolveWireAnchorEnd(wire, pointer);
        const label = mode === 'vertical' ? '导线垂直拉直' : '导线水平拉直';
        const run = typeof interaction.runWithHistory === 'function'
            ? (fn) => interaction.runWithHistory(label, fn)
            : (fn) => fn();

        run(() => {
            const w = interaction.circuit.getWire(wireId);
            if (!w || !w.a || !w.b) return;
            const fixed = anchorEnd === 'a' ? w.a : w.b;
            const moveEnd = anchorEnd === 'a' ? 'b' : 'a';
            const moving = w[moveEnd];
            if (!moving) return;

            if (mode === 'vertical') {
                w[moveEnd] = { x: toCanvasInt(fixed.x), y: toCanvasInt(moving.y) };
            } else {
                w[moveEnd] = { x: toCanvasInt(moving.x), y: toCanvasInt(fixed.y) };
            }

            const refKey = moveEnd === 'a' ? 'aRef' : 'bRef';
            delete w[refKey];

            interaction.renderer.refreshWire(wireId);
            interaction.circuit.rebuildNodes();
            interaction.updateStatus?.(mode === 'vertical' ? '已垂直拉直导线' : '已水平拉直导线');
        });
    }

    splitWireAtMidpoint(wireId) {
        const wire = this.interaction.circuit?.getWire?.(wireId);
        if (!wire?.a || !wire?.b) return;
        const x = (ensurePositiveFinite(wire.a.x) + ensurePositiveFinite(wire.b.x)) / 2;
        const y = (ensurePositiveFinite(wire.a.y) + ensurePositiveFinite(wire.b.y)) / 2;
        this.interaction.splitWireAtPoint?.(wireId, x, y);
    }

    onActionClick(event) {
        const button = event?.target?.closest?.('button[data-action]');
        if (!button) return;
        const actionId = button.dataset.action;
        const selection = this.resolveSelectionState();
        const mode = selection.mode;
        const componentId = selection.componentId;
        const wireId = selection.wireId;

        if (actionId.startsWith('component-') && mode !== 'component') return;
        if (actionId.startsWith('wire-') && mode !== 'wire') return;

        switch (actionId) {
            case 'component-edit':
                if (componentId) this.interaction.showPropertyDialog?.(componentId);
                break;
            case 'component-rotate':
                if (componentId) this.interaction.rotateComponent?.(componentId);
                break;
            case 'component-duplicate':
                if (componentId) this.interaction.duplicateComponent?.(componentId);
                break;
            case 'component-delete':
                if (componentId) this.interaction.deleteComponent?.(componentId);
                break;
            case 'wire-split-point':
                if (wireId) this.splitWireAtBestPoint(wireId);
                break;
            case 'wire-straighten-horizontal':
                if (wireId) this.straightenWire(wireId, 'horizontal');
                break;
            case 'wire-straighten-vertical':
                if (wireId) this.straightenWire(wireId, 'vertical');
                break;
            case 'wire-probe-voltage':
                if (wireId) this.interaction.addObservationProbeForWire?.(wireId, 'NodeVoltageProbe');
                break;
            case 'wire-probe-current':
                if (wireId) this.interaction.addObservationProbeForWire?.(wireId, 'WireCurrentProbe');
                break;
            case 'wire-delete':
                if (wireId) this.interaction.deleteWire?.(wireId);
                break;
            case 'selection-clear':
                this.interaction.clearSelection?.();
                break;
            default:
                break;
        }
        this.update();
    }
}
