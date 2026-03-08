import {
    safeAddEventListener,
    safeClassListToggle,
    safeInvoke,
    safeSetAttribute
} from '../utils/RuntimeSafety.js';

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
        safeAddEventListener(this.button, 'click', this.boundToggle);
        safeAddEventListener(document, 'pointerdown', this.boundDocumentPointerDown);
        safeAddEventListener(document, 'keydown', this.boundDocumentKeyDown);
        safeAddEventListener(this.menu, 'click', (event) => {
            const target = event?.target;
            const menuItem = target && typeof target.closest === 'function'
                ? target.closest('.top-action-more-item')
                : null;
            if (menuItem) {
                if (menuItem.id === 'btn-mobile-ai-assistant') {
                    safeInvoke(this.app, 'openAIPanel');
                }
                this.setOpen(false);
            }
        });
        const closeBtn = document.getElementById('btn-top-action-close');
        if (closeBtn) {
            safeAddEventListener(closeBtn, 'click', this.boundClose);
        }
        this.setSelectionMode('none');
        this.sync();
    }

    isPhoneMode() {
        if (typeof document === 'undefined') return false;
        return safeHasClass(document.body, 'layout-mode-phone');
    }

    setOpen(nextOpen, _options = {}) {
        if (!this.button || !this.menu) return;
        const open = !!nextOpen;
        this.isOpen = open;
        this.menu.hidden = !open;
        safeClassListToggle(this.menu, 'open', open);
        safeSetAttribute(this.button, 'aria-expanded', open ? 'true' : 'false');
    }

    toggle() {
        if (!this.isPhoneMode()) return;
        const nextOpen = !this.isOpen;
        if (nextOpen) {
            this.app?.responsiveLayout?.claimPhoneSurface?.('top-action-menu');
        }
        this.setOpen(nextOpen, {
            source: 'topActionMenu.toggle'
        });
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
        safeSetAttribute(this.button, 'data-selection-mode', normalizedMode);
        if (normalizedMode !== 'none' && this.isOpen) {
            this.setOpen(false);
        }
    }
}
