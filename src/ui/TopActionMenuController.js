function safeNodeContains(node, target) {
    if (!node || typeof node.contains !== 'function') return false;
    try {
        return node.contains(target);
    } catch (_) {
        return false;
    }
}

function safeHasClass(node, className) {
    if (!node || !node.classList || typeof node.classList.contains !== 'function') return false;
    try {
        return node.classList.contains(className);
    } catch (_) {
        return false;
    }
}

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function safeToggleClass(node, className, force) {
    safeInvokeMethod(node?.classList, 'toggle', className, force);
}

export class TopActionMenuController {
    constructor(app) {
        this.app = app;
        this.button = typeof document !== 'undefined'
            ? document.getElementById('btn-top-action-more')
            : null;
        this.menu = typeof document !== 'undefined'
            ? document.getElementById('top-action-more-menu')
            : null;
        this.isOpen = false;
        this.selectionMode = 'none';

        this.boundToggle = (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            this.toggle();
        };
        this.boundClose = (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            this.setOpen(false);
        };
        this.boundDocumentPointerDown = (event) => this.onDocumentPointerDown(event);
        this.boundDocumentKeyDown = (event) => this.onDocumentKeyDown(event);

        this.initialize();
    }

    initialize() {
        if (!this.button || !this.menu) return;
        safeInvokeMethod(this.button, 'addEventListener', 'click', this.boundToggle);
        safeInvokeMethod(document, 'addEventListener', 'pointerdown', this.boundDocumentPointerDown);
        safeInvokeMethod(document, 'addEventListener', 'keydown', this.boundDocumentKeyDown);
        safeInvokeMethod(this.menu, 'addEventListener', 'click', (event) => {
            const target = event?.target;
            const menuItem = target && typeof target.closest === 'function'
                ? target.closest('.top-action-more-item')
                : null;
            if (menuItem) {
                this.setOpen(false);
            }
        });
        const closeBtn = document.getElementById('btn-top-action-close');
        if (closeBtn) {
            safeInvokeMethod(closeBtn, 'addEventListener', 'click', this.boundClose);
        }
        this.setSelectionMode('none');
        this.sync();
    }

    isPhoneMode() {
        if (typeof document === 'undefined') return false;
        return safeHasClass(document.body, 'layout-mode-phone');
    }

    setOpen(nextOpen) {
        if (!this.button || !this.menu) return;
        const open = !!nextOpen;
        this.isOpen = open;
        this.menu.hidden = !open;
        safeToggleClass(this.menu, 'open', open);
        safeInvokeMethod(this.button, 'setAttribute', 'aria-expanded', open ? 'true' : 'false');
    }

    toggle() {
        if (!this.isPhoneMode()) return;
        this.setOpen(!this.isOpen);
    }

    onDocumentPointerDown(event) {
        if (!this.isOpen || !this.button || !this.menu) return;
        const target = event?.target;
        if (!target) return;
        if (safeNodeContains(this.menu, target) || safeNodeContains(this.button, target)) return;
        this.setOpen(false);
    }

    onDocumentKeyDown(event) {
        if (!this.isOpen) return;
        if (event?.key !== 'Escape') return;
        this.setOpen(false);
    }

    sync() {
        if (!this.isPhoneMode()) {
            this.setOpen(false);
        }
    }

    setSelectionMode(mode = 'none') {
        const normalizedMode = mode === 'component' || mode === 'wire' ? mode : 'none';
        this.selectionMode = normalizedMode;
        safeInvokeMethod(this.button, 'setAttribute', 'data-selection-mode', normalizedMode);
        if (normalizedMode !== 'none' && this.isOpen) {
            this.setOpen(false);
        }
    }
}
