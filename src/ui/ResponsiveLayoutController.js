const MODE_DESKTOP = 'desktop';
const MODE_TABLET = 'tablet';
const MODE_COMPACT = 'compact';
const MODE_PHONE = 'phone';

const PHONE_MAX_WIDTH = 680;
const COMPACT_MAX_WIDTH = 900;
const TABLET_MAX_WIDTH = 1200;

const MODE_CLASS_PREFIX = 'layout-mode-';

export class ResponsiveLayoutController {
    constructor(app) {
        this.app = app;

        this.body = typeof document !== 'undefined' ? document.body : null;
        this.toolbox = typeof document !== 'undefined' ? document.getElementById('toolbox') : null;
        this.sidePanel = typeof document !== 'undefined' ? document.getElementById('side-panel') : null;
        this.toolboxToggleBtn = typeof document !== 'undefined' ? document.getElementById('btn-toggle-toolbox') : null;
        this.sidePanelToggleBtn = typeof document !== 'undefined' ? document.getElementById('btn-toggle-side-panel') : null;
        this.backdrop = typeof document !== 'undefined' ? document.getElementById('layout-backdrop') : null;

        this.mode = MODE_DESKTOP;
        this.toolboxOpen = false;
        this.sidePanelOpen = false;

        this.boundResize = () => this.updateLayoutMode();
        this.boundKeyDown = (event) => this.onKeyDown(event);
        this.boundBackdropClick = () => this.closeDrawers();
        this.boundToolboxToggleClick = (event) => {
            event.preventDefault();
            this.toggleDrawer('toolbox');
        };
        this.boundSidePanelToggleClick = (event) => {
            event.preventDefault();
            this.toggleDrawer('side-panel');
        };

        this.initialize();
    }

    initialize() {
        if (typeof window === 'undefined') return;
        this.bindEvents();
        this.updateLayoutMode({ force: true });
    }

    bindEvents() {
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.boundResize);
            window.addEventListener('keydown', this.boundKeyDown);
        }

        if (this.toolboxToggleBtn) {
            this.toolboxToggleBtn.addEventListener('click', this.boundToolboxToggleClick);
        }

        if (this.sidePanelToggleBtn) {
            this.sidePanelToggleBtn.addEventListener('click', this.boundSidePanelToggleClick);
        }

        if (this.backdrop) {
            this.backdrop.addEventListener('click', this.boundBackdropClick);
        }
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.boundResize);
            window.removeEventListener('keydown', this.boundKeyDown);
        }
        if (this.backdrop) {
            this.backdrop.removeEventListener('click', this.boundBackdropClick);
        }
        if (this.toolboxToggleBtn) {
            this.toolboxToggleBtn.removeEventListener('click', this.boundToolboxToggleClick);
        }
        if (this.sidePanelToggleBtn) {
            this.sidePanelToggleBtn.removeEventListener('click', this.boundSidePanelToggleClick);
        }
    }

    resolveLayoutMode(width = typeof window !== 'undefined' ? window.innerWidth : TABLET_MAX_WIDTH + 1) {
        const safeWidth = Number(width) || 0;
        if (safeWidth <= PHONE_MAX_WIDTH) return MODE_PHONE;
        if (safeWidth <= COMPACT_MAX_WIDTH) return MODE_COMPACT;
        if (safeWidth <= TABLET_MAX_WIDTH) return MODE_TABLET;
        return MODE_DESKTOP;
    }

    isOverlayMode(mode = this.mode) {
        return mode === MODE_COMPACT || mode === MODE_PHONE;
    }

    updateLayoutMode(options = {}) {
        const { force = false } = options;
        const nextMode = this.resolveLayoutMode();
        const changed = nextMode !== this.mode;
        if (!force && !changed) {
            this.syncLayoutUI();
            return;
        }

        this.mode = nextMode;
        this.applyBodyModeClass(nextMode);

        if (this.isOverlayMode(nextMode)) {
            this.toolboxOpen = false;
            this.sidePanelOpen = false;
        } else {
            this.toolboxOpen = true;
            this.sidePanelOpen = true;
        }

        this.syncLayoutUI();
    }

    applyBodyModeClass(mode) {
        if (!this.body || !this.body.classList) return;

        [MODE_DESKTOP, MODE_TABLET, MODE_COMPACT, MODE_PHONE].forEach((layoutMode) => {
            this.body.classList.remove(`${MODE_CLASS_PREFIX}${layoutMode}`);
        });
        this.body.classList.add(`${MODE_CLASS_PREFIX}${mode}`);
    }

    toggleDrawer(target) {
        if (!this.isOverlayMode()) return;

        if (target === 'toolbox') {
            this.toolboxOpen = !this.toolboxOpen;
            if (this.toolboxOpen) this.sidePanelOpen = false;
        } else if (target === 'side-panel') {
            this.sidePanelOpen = !this.sidePanelOpen;
            if (this.sidePanelOpen) this.toolboxOpen = false;
        }

        this.syncLayoutUI();
    }

    closeDrawers() {
        if (!this.isOverlayMode()) return;
        this.toolboxOpen = false;
        this.sidePanelOpen = false;
        this.syncLayoutUI();
    }

    onKeyDown(event) {
        if (!this.isOverlayMode()) return;
        if (event?.key !== 'Escape') return;
        this.closeDrawers();
    }

    setToggleButtonState(button, expanded, hidden) {
        if (!button) return;
        button.hidden = !!hidden;
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    syncLayoutUI() {
        const overlay = this.isOverlayMode();

        if (this.toolbox?.classList) {
            this.toolbox.classList.toggle('layout-open', overlay && this.toolboxOpen);
        }

        if (this.sidePanel?.classList) {
            this.sidePanel.classList.toggle('layout-open', overlay && this.sidePanelOpen);
        }

        this.setToggleButtonState(this.toolboxToggleBtn, overlay && this.toolboxOpen, !overlay);
        this.setToggleButtonState(this.sidePanelToggleBtn, overlay && this.sidePanelOpen, !overlay);

        const shouldShowBackdrop = overlay && (this.toolboxOpen || this.sidePanelOpen);
        if (this.backdrop) {
            this.backdrop.hidden = !shouldShowBackdrop;
            this.backdrop.setAttribute('aria-hidden', shouldShowBackdrop ? 'false' : 'true');
            if (this.backdrop.classList) {
                this.backdrop.classList.toggle('active', shouldShowBackdrop);
            }
        }

        this.app?.topActionMenu?.sync?.();
        this.app?.interaction?.quickActionBar?.update?.();
    }
}

export const ResponsiveLayoutModes = Object.freeze({
    MODE_DESKTOP,
    MODE_TABLET,
    MODE_COMPACT,
    MODE_PHONE
});
