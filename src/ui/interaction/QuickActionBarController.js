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

export class QuickActionBarController {
    constructor(interaction) {
        this.interaction = interaction;
        this.container = document.getElementById('canvas-container');
        this.statusBar = document.getElementById('status-bar');
        this.toolbox = document.getElementById('toolbox');
        this.sidePanel = document.getElementById('side-panel');
        this.root = null;
        this.label = null;
        this.actions = null;
        this.boundClick = (event) => this.onActionClick(event);

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

    getStatusBarHeight() {
        const height = Number(this.statusBar?.getBoundingClientRect?.().height);
        return Number.isFinite(height) && height > 0 ? height : 0;
    }

    applyBottomOffset() {
        if (!this.root?.style?.setProperty) return;
        const statusBarHeight = this.getStatusBarHeight();
        const offset = Math.max(44, Math.ceil(statusBarHeight) + 8);
        this.root.style.setProperty('--quick-action-bottom-offset', `${offset}px`);
    }

    isOverlayDrawerOpen() {
        const layout = this.interaction?.app?.responsiveLayout;
        if (!layout?.isOverlayMode?.()) return false;

        if (layout.toolboxOpen || layout.sidePanelOpen) return true;

        const toolboxOpen = !!this.toolbox?.classList?.contains?.('layout-open');
        const sidePanelOpen = !!this.sidePanel?.classList?.contains?.('layout-open');
        return toolboxOpen || sidePanelOpen;
    }

    update() {
        if (!this.root) return;
        this.applyBottomOffset();

        if (!this.isTouchPreferredMode()) {
            this.hide();
            return;
        }
        if (this.isOverlayDrawerOpen()) {
            this.hide();
            return;
        }

        const componentId = this.interaction.selectedComponent;
        const wireId = this.interaction.selectedWire;
        if (componentId) {
            this.renderComponentActions(componentId);
            return;
        }
        if (wireId) {
            this.renderWireActions(wireId);
            return;
        }
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
        this.actions.appendChild(createButton('编辑', 'component-edit'));
        this.actions.appendChild(createButton('旋转', 'component-rotate'));
        this.actions.appendChild(createButton('复制', 'component-duplicate'));
        this.actions.appendChild(createButton('删除', 'component-delete'));
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
        this.actions.appendChild(createButton('分割', 'wire-split-mid'));
        this.actions.appendChild(createButton('电压探针', 'wire-probe-voltage'));
        this.actions.appendChild(createButton('电流探针', 'wire-probe-current'));
        this.actions.appendChild(createButton('删除', 'wire-delete'));
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
        const componentId = this.interaction.selectedComponent;
        const wireId = this.interaction.selectedWire;

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
            case 'wire-split-mid':
                if (wireId) this.splitWireAtMidpoint(wireId);
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
            default:
                break;
        }
        this.update();
    }
}
