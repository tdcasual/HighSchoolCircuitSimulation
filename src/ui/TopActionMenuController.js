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
        this.button.addEventListener('click', this.boundToggle);
        document.addEventListener('pointerdown', this.boundDocumentPointerDown);
        document.addEventListener('keydown', this.boundDocumentKeyDown);
        this.menu.addEventListener('click', (event) => {
            const target = event?.target;
            if (target && target.closest && target.closest('.top-action-more-item')) {
                this.setOpen(false);
            }
        });
        const closeBtn = document.getElementById('btn-top-action-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.boundClose);
        }
        this.setSelectionMode('none');
        this.sync();
    }

    isPhoneMode() {
        if (typeof document === 'undefined') return false;
        return !!document.body?.classList?.contains?.('layout-mode-phone');
    }

    setOpen(nextOpen) {
        if (!this.button || !this.menu) return;
        const open = !!nextOpen;
        this.isOpen = open;
        this.menu.hidden = !open;
        this.menu.classList.toggle('open', open);
        this.button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle() {
        if (!this.isPhoneMode()) return;
        this.setOpen(!this.isOpen);
    }

    onDocumentPointerDown(event) {
        if (!this.isOpen || !this.button || !this.menu) return;
        const target = event?.target;
        if (!target) return;
        if (this.menu.contains(target) || this.button.contains(target)) return;
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
        if (this.button?.setAttribute) {
            this.button.setAttribute('data-selection-mode', normalizedMode);
        }
        if (normalizedMode !== 'none' && this.isOpen) {
            this.setOpen(false);
        }
    }
}
