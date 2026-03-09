import {
    safeAddEventListener,
    safeSetAttribute
} from '../../utils/RuntimeSafety.js';

function safeHasClass(node, className) {
    if (!node || !node.classList || typeof node.classList.contains !== 'function') return false;
    try {
        return node.classList.contains(className);
    } catch (_) {
        return false;
    }
}

export class MobileRestoreEntryController {
    constructor(app, broker) {
        this.app = app;
        this.broker = broker;
        this.button = typeof document !== 'undefined'
            ? document.getElementById('mobile-restore-entry')
            : null;
        this.boundClick = (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            this.handleClick();
        };
        this.unsubscribe = null;

        this.initialize();
    }

    initialize() {
        if (!this.button) return;
        safeAddEventListener(this.button, 'click', this.boundClick);
        if (this.broker && typeof this.broker.subscribe === 'function') {
            this.unsubscribe = this.broker.subscribe(() => this.sync());
        }
        this.sync();
    }

    isPhoneMode() {
        if (typeof document === 'undefined') return false;
        return safeHasClass(document.body, 'layout-mode-phone');
    }

    getCurrentCandidate() {
        if (!this.broker || typeof this.broker.getCurrent !== 'function') return null;
        return this.broker.getCurrent();
    }

    handleClick() {
        const candidate = this.getCurrentCandidate();
        if (!candidate?.action) return false;
        return this.app?.runMobileRestoreAction?.(candidate.action) ?? false;
    }

    sync() {
        if (!this.button) return;
        const candidate = this.isPhoneMode() ? this.getCurrentCandidate() : null;
        this.button.hidden = !candidate;
        this.button.textContent = candidate?.label || '';
        safeSetAttribute(this.button, 'aria-label', candidate?.label || '继续任务');
        safeSetAttribute(this.button, 'title', candidate?.label || '继续任务');
    }

    destroy() {
        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}
