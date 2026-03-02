const MODE_DESKTOP = 'desktop';
const MODE_TABLET = 'tablet';
const MODE_COMPACT = 'compact';
const MODE_PHONE = 'phone';

const PHONE_MAX_WIDTH = 680;
const COMPACT_MAX_WIDTH = 900;
const TABLET_MAX_WIDTH = 1200;
const DRAWER_SWIPE_SLOP_PX = 8;
const DRAWER_SWIPE_AXIS_DOMINANCE = 1.2;
const DRAWER_SWIPE_CLOSE_THRESHOLD_PX = 40;

const MODE_CLASS_PREFIX = 'layout-mode-';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function safeAddClass(node, className) {
    safeInvokeMethod(node?.classList, 'add', className);
}

function safeRemoveClass(node, className) {
    safeInvokeMethod(node?.classList, 'remove', className);
}

function safeToggleClass(node, className, force) {
    safeInvokeMethod(node?.classList, 'toggle', className, force);
}

export class ResponsiveLayoutController {
    constructor(app) {
        this.app = app;

        this.body = typeof document !== 'undefined' ? document.body : null;
        this.toolbox = typeof document !== 'undefined' ? document.getElementById('toolbox') : null;
        this.sidePanel = typeof document !== 'undefined' ? document.getElementById('side-panel') : null;
        this.toolboxToggleBtn = typeof document !== 'undefined' ? document.getElementById('btn-toggle-toolbox') : null;
        this.sidePanelToggleBtn = typeof document !== 'undefined' ? document.getElementById('btn-toggle-side-panel') : null;
        this.toolboxCloseBtn = typeof document !== 'undefined' ? document.getElementById('btn-close-toolbox') : null;
        this.sidePanelCloseBtn = typeof document !== 'undefined' ? document.getElementById('btn-close-side-panel') : null;
        this.backdrop = typeof document !== 'undefined' ? document.getElementById('layout-backdrop') : null;

        this.mode = MODE_DESKTOP;
        this.toolboxOpen = false;
        this.sidePanelOpen = false;

        this.boundResize = () => this.updateLayoutMode();
        this.boundKeyDown = (event) => this.onKeyDown(event);
        this.boundBackdropClick = () => this.closeDrawers();
        this.drawerSwipe = null;
        this.boundToolboxToggleClick = (event) => {
            event.preventDefault();
            this.toggleDrawer('toolbox');
        };
        this.boundSidePanelToggleClick = (event) => {
            event.preventDefault();
            this.toggleDrawer('side-panel');
        };
        this.boundToolboxCloseClick = (event) => {
            event.preventDefault();
            this.closeDrawers();
        };
        this.boundSidePanelCloseClick = (event) => {
            event.preventDefault();
            this.closeDrawers();
        };
        this.boundDrawerPointerDown = (event) => this.onDrawerPointerDown(event);
        this.boundDrawerPointerMove = (event) => this.onDrawerPointerMove(event);
        this.boundDrawerPointerUp = (event) => this.onDrawerPointerUp(event);
        this.boundDrawerPointerCancel = (event) => this.onDrawerPointerUp(event);
        this.layoutReadyRafId = null;
        this.layoutReadyPostRafId = null;

        this.initialize();
    }

    initialize() {
        if (typeof window === 'undefined') return;
        safeRemoveClass(this.body, 'layout-ready');
        this.bindEvents();
        this.updateLayoutMode({ force: true });
        this.scheduleLayoutReady();
    }

    bindEvents() {
        if (typeof window !== 'undefined') {
            safeInvokeMethod(window, 'addEventListener', 'resize', this.boundResize);
            safeInvokeMethod(window, 'addEventListener', 'keydown', this.boundKeyDown);
        }

        if (this.toolboxToggleBtn) {
            safeInvokeMethod(this.toolboxToggleBtn, 'addEventListener', 'click', this.boundToolboxToggleClick);
        }

        if (this.sidePanelToggleBtn) {
            safeInvokeMethod(this.sidePanelToggleBtn, 'addEventListener', 'click', this.boundSidePanelToggleClick);
        }
        if (this.toolboxCloseBtn) {
            safeInvokeMethod(this.toolboxCloseBtn, 'addEventListener', 'click', this.boundToolboxCloseClick);
        }
        if (this.sidePanelCloseBtn) {
            safeInvokeMethod(this.sidePanelCloseBtn, 'addEventListener', 'click', this.boundSidePanelCloseClick);
        }

        if (this.backdrop) {
            safeInvokeMethod(this.backdrop, 'addEventListener', 'click', this.boundBackdropClick);
        }
        if (this.toolbox) {
            safeInvokeMethod(this.toolbox, 'addEventListener', 'pointerdown', this.boundDrawerPointerDown);
            safeInvokeMethod(this.toolbox, 'addEventListener', 'pointermove', this.boundDrawerPointerMove, { passive: false });
            safeInvokeMethod(this.toolbox, 'addEventListener', 'pointerup', this.boundDrawerPointerUp);
            safeInvokeMethod(this.toolbox, 'addEventListener', 'pointercancel', this.boundDrawerPointerCancel);
        }
        if (this.sidePanel) {
            safeInvokeMethod(this.sidePanel, 'addEventListener', 'pointerdown', this.boundDrawerPointerDown);
            safeInvokeMethod(this.sidePanel, 'addEventListener', 'pointermove', this.boundDrawerPointerMove, { passive: false });
            safeInvokeMethod(this.sidePanel, 'addEventListener', 'pointerup', this.boundDrawerPointerUp);
            safeInvokeMethod(this.sidePanel, 'addEventListener', 'pointercancel', this.boundDrawerPointerCancel);
        }
    }

    destroy() {
        this.clearLayoutReadySchedule();
        if (typeof window !== 'undefined') {
            safeInvokeMethod(window, 'removeEventListener', 'resize', this.boundResize);
            safeInvokeMethod(window, 'removeEventListener', 'keydown', this.boundKeyDown);
        }
        if (this.backdrop) {
            safeInvokeMethod(this.backdrop, 'removeEventListener', 'click', this.boundBackdropClick);
        }
        if (this.toolboxToggleBtn) {
            safeInvokeMethod(this.toolboxToggleBtn, 'removeEventListener', 'click', this.boundToolboxToggleClick);
        }
        if (this.sidePanelToggleBtn) {
            safeInvokeMethod(this.sidePanelToggleBtn, 'removeEventListener', 'click', this.boundSidePanelToggleClick);
        }
        if (this.toolboxCloseBtn) {
            safeInvokeMethod(this.toolboxCloseBtn, 'removeEventListener', 'click', this.boundToolboxCloseClick);
        }
        if (this.sidePanelCloseBtn) {
            safeInvokeMethod(this.sidePanelCloseBtn, 'removeEventListener', 'click', this.boundSidePanelCloseClick);
        }
        if (this.toolbox) {
            safeInvokeMethod(this.toolbox, 'removeEventListener', 'pointerdown', this.boundDrawerPointerDown);
            safeInvokeMethod(this.toolbox, 'removeEventListener', 'pointermove', this.boundDrawerPointerMove);
            safeInvokeMethod(this.toolbox, 'removeEventListener', 'pointerup', this.boundDrawerPointerUp);
            safeInvokeMethod(this.toolbox, 'removeEventListener', 'pointercancel', this.boundDrawerPointerCancel);
        }
        if (this.sidePanel) {
            safeInvokeMethod(this.sidePanel, 'removeEventListener', 'pointerdown', this.boundDrawerPointerDown);
            safeInvokeMethod(this.sidePanel, 'removeEventListener', 'pointermove', this.boundDrawerPointerMove);
            safeInvokeMethod(this.sidePanel, 'removeEventListener', 'pointerup', this.boundDrawerPointerUp);
            safeInvokeMethod(this.sidePanel, 'removeEventListener', 'pointercancel', this.boundDrawerPointerCancel);
        }
    }

    clearLayoutReadySchedule() {
        if (typeof window === 'undefined') return;
        if (this.layoutReadyRafId !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(this.layoutReadyRafId);
        }
        if (this.layoutReadyPostRafId !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(this.layoutReadyPostRafId);
        }
        this.layoutReadyRafId = null;
        this.layoutReadyPostRafId = null;
    }

    markLayoutReady() {
        safeAddClass(this.body, 'layout-ready');
    }

    scheduleLayoutReady() {
        this.clearLayoutReadySchedule();
        if (typeof window === 'undefined') return;
        if (typeof window.requestAnimationFrame !== 'function') {
            this.markLayoutReady();
            return;
        }
        this.layoutReadyRafId = window.requestAnimationFrame(() => {
            this.layoutReadyRafId = null;
            this.layoutReadyPostRafId = window.requestAnimationFrame(() => {
                this.layoutReadyPostRafId = null;
                this.markLayoutReady();
            });
        });
    }

    onDrawerPointerDown(event) {
        if (!this.isOverlayMode()) return;
        const pointerType = event?.pointerType || '';
        if (pointerType !== 'touch' && pointerType !== 'pen') return;
        const targetClosest = typeof event?.target?.closest === 'function'
            ? event.target.closest.bind(event.target)
            : null;
        const headerSelector = event.currentTarget?.id === 'toolbox'
            ? '.toolbox-header'
            : '.side-panel-header';
        const header = targetClosest ? targetClosest(headerSelector) : null;
        if (!header) return;
        const interactiveTarget = targetClosest
            ? targetClosest('button, [role="button"], input, select, textarea, a')
            : null;
        if (interactiveTarget) return;
        const targetId = event.currentTarget?.id === 'toolbox' ? 'toolbox' : 'side-panel';
        this.drawerSwipe = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            target: targetId,
            mode: this.mode,
            drawerEl: event.currentTarget,
            prevTransition: event.currentTarget?.style?.transition || '',
            axisLock: null
        };
        if (this.drawerSwipe.drawerEl?.style) {
            this.drawerSwipe.drawerEl.style.transition = 'none';
        }
        if (typeof event.currentTarget?.setPointerCapture === 'function') {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch (_) {}
        }
    }

    onDrawerPointerMove(event) {
        if (!this.drawerSwipe) return;
        if (event.pointerId !== this.drawerSwipe.pointerId) return;
        const dx = (event.clientX || 0) - (this.drawerSwipe.startX || 0);
        const dy = (event.clientY || 0) - (this.drawerSwipe.startY || 0);
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const isPhoneModeSwipe = this.drawerSwipe.mode === MODE_PHONE;
        if (!this.drawerSwipe.axisLock) {
            if (absX < DRAWER_SWIPE_SLOP_PX && absY < DRAWER_SWIPE_SLOP_PX) {
                return;
            }
            const dominantX = absX >= absY * DRAWER_SWIPE_AXIS_DOMINANCE;
            const dominantY = absY >= absX * DRAWER_SWIPE_AXIS_DOMINANCE;
            if (isPhoneModeSwipe && dominantY) {
                this.drawerSwipe.axisLock = 'y';
            } else if (!isPhoneModeSwipe && dominantX) {
                this.drawerSwipe.axisLock = 'x';
            } else {
                return;
            }
        }

        if (isPhoneModeSwipe && this.drawerSwipe.axisLock !== 'y') {
            return;
        }
        if (!isPhoneModeSwipe && this.drawerSwipe.axisLock !== 'x') {
            return;
        }

        const threshold = DRAWER_SWIPE_CLOSE_THRESHOLD_PX;
        const drawerEl = this.drawerSwipe.drawerEl;
        if (drawerEl?.style) {
            if (isPhoneModeSwipe) {
                const dragY = Math.max(0, dy);
                safeInvokeMethod(drawerEl.style, 'setProperty', '--drawer-drag-y', `${dragY}px`);
            } else if (this.drawerSwipe.target === 'toolbox') {
                const dragX = Math.min(0, dx);
                safeInvokeMethod(drawerEl.style, 'setProperty', '--drawer-drag-x', `${dragX}px`);
            } else if (this.drawerSwipe.target === 'side-panel') {
                const dragX = Math.max(0, dx);
                safeInvokeMethod(drawerEl.style, 'setProperty', '--drawer-drag-x', `${dragX}px`);
            }
        }
        if (event.cancelable) {
            event.preventDefault();
        }

        if (this.drawerSwipe.mode === MODE_PHONE) {
            if (dy > threshold && absY > absX) {
                this.closeDrawers();
                this.onDrawerPointerUp(event);
            }
            return;
        }

        if (this.drawerSwipe.target === 'toolbox') {
            if (dx < -threshold && absX > absY) {
                this.closeDrawers();
                this.onDrawerPointerUp(event);
            }
            return;
        }

        if (this.drawerSwipe.target === 'side-panel') {
            if (dx > threshold && absX > absY) {
                this.closeDrawers();
                this.onDrawerPointerUp(event);
            }
        }
    }

    onDrawerPointerUp(event) {
        if (!this.drawerSwipe) return;
        const pointerId = this.drawerSwipe.pointerId;
        const currentTarget = event?.currentTarget;
        const drawerEl = this.drawerSwipe.drawerEl;
        const prevTransition = this.drawerSwipe.prevTransition;
        this.drawerSwipe = null;
        if (drawerEl?.style) {
            drawerEl.style.transition = prevTransition;
            safeInvokeMethod(drawerEl.style, 'removeProperty', '--drawer-drag-x');
            safeInvokeMethod(drawerEl.style, 'removeProperty', '--drawer-drag-y');
        }
        if (typeof currentTarget?.releasePointerCapture === 'function') {
            try {
                currentTarget.releasePointerCapture(pointerId);
            } catch (_) {}
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
            this.app?.observationPanel?.onLayoutModeChanged?.(this.mode);
            this.app?.aiPanel?.constrainPanelToViewport?.();
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
        this.app?.observationPanel?.onLayoutModeChanged?.(nextMode);
        this.app?.aiPanel?.constrainPanelToViewport?.();
    }

    applyBodyModeClass(mode) {
        [MODE_DESKTOP, MODE_TABLET, MODE_COMPACT, MODE_PHONE].forEach((layoutMode) => {
            safeRemoveClass(this.body, `${MODE_CLASS_PREFIX}${layoutMode}`);
        });
        safeAddClass(this.body, `${MODE_CLASS_PREFIX}${mode}`);
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
        safeInvokeMethod(button, 'setAttribute', 'aria-expanded', expanded ? 'true' : 'false');
    }

    syncLayoutUI() {
        const overlay = this.isOverlayMode();

        safeToggleClass(this.toolbox, 'layout-open', overlay && this.toolboxOpen);

        safeToggleClass(this.sidePanel, 'layout-open', overlay && this.sidePanelOpen);

        this.setToggleButtonState(this.toolboxToggleBtn, overlay && this.toolboxOpen, !overlay);
        this.setToggleButtonState(this.sidePanelToggleBtn, overlay && this.sidePanelOpen, !overlay);

        const shouldShowBackdrop = overlay && (this.toolboxOpen || this.sidePanelOpen);
        if (this.backdrop) {
            this.backdrop.hidden = !shouldShowBackdrop;
            safeInvokeMethod(this.backdrop, 'setAttribute', 'aria-hidden', shouldShowBackdrop ? 'false' : 'true');
            safeToggleClass(this.backdrop, 'active', shouldShowBackdrop);
        }

        this.app?.topActionMenu?.sync?.();
        this.app?.interaction?.syncMobileModeButtons?.();
        this.app?.interaction?.quickActionBar?.update?.();
    }
}

export const ResponsiveLayoutModes = Object.freeze({
    MODE_DESKTOP,
    MODE_TABLET,
    MODE_COMPACT,
    MODE_PHONE
});
