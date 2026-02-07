export class PanelLayoutController {
    constructor(deps = {}) {
        this.deps = deps;
    }

    withPanel(fn, ...args) {
        const panel = this.deps?.panel || this.deps || {};
        return fn.call(panel, ...args);
    }

    initializePanelLayoutControls() {
        return this.withPanel(initializePanelLayoutControlsImpl);
    }

    tryStartPanelDrag(event) {
        return this.withPanel(tryStartPanelDragImpl, event);
    }

    tryStartCollapsedPanelDrag(event) {
        return this.withPanel(tryStartCollapsedPanelDragImpl, event);
    }

    tryStartPanelResize(event) {
        return this.withPanel(tryStartPanelResizeImpl, event);
    }

    startPanelGesture(type, event) {
        return this.withPanel(startPanelGestureImpl, type, event);
    }

    handlePanelPointerMove(event) {
        return this.withPanel(handlePanelPointerMoveImpl, event);
    }

    handlePanelPointerUp(event) {
        return this.withPanel(handlePanelPointerUpImpl, event);
    }

    updatePanelDrag(event) {
        return this.withPanel(updatePanelDragImpl, event);
    }

    updatePanelResize(event) {
        return this.withPanel(updatePanelResizeImpl, event);
    }

    setPanelAbsolutePosition(left, top) {
        return this.withPanel(setPanelAbsolutePositionImpl, left, top);
    }

    getPanelBounds() {
        return this.withPanel(getPanelBoundsImpl);
    }

    initializeIdleBehavior() {
        return this.withPanel(initializeIdleBehaviorImpl);
    }

    markPanelActive() {
        return this.withPanel(markPanelActiveImpl);
    }

    clamp(value, min, max) {
        return this.withPanel(clampImpl, value, min, max);
    }

    isPanelCollapsed() {
        return this.withPanel(isPanelCollapsedImpl);
    }

    getCollapsedPanelSize() {
        return this.withPanel(getCollapsedPanelSizeImpl);
    }

    getCollapsedPanelWidth() {
        return this.withPanel(getCollapsedPanelWidthImpl);
    }

    getCollapsedPanelHeight() {
        return this.withPanel(getCollapsedPanelHeightImpl);
    }

    rememberExpandedPanelSize() {
        return this.withPanel(rememberExpandedPanelSizeImpl);
    }

    syncPanelCollapsedUI() {
        return this.withPanel(syncPanelCollapsedUIImpl);
    }

    setPanelCollapsed(collapsed, options = {}) {
        return this.withPanel(setPanelCollapsedImpl, collapsed, options);
    }

    restorePanelLayout() {
        return this.withPanel(restorePanelLayoutImpl);
    }

    applyPanelLayout(layout) {
        return this.withPanel(applyPanelLayoutImpl, layout);
    }

    getSavedPanelLayout() {
        return this.withPanel(getSavedPanelLayoutImpl);
    }

    savePanelLayout() {
        return this.withPanel(savePanelLayoutImpl);
    }

    getDefaultPanelLayout() {
        return this.withPanel(getDefaultPanelLayoutImpl);
    }

    constrainPanelToViewport() {
        return this.withPanel(constrainPanelToViewportImpl);
    }
}

function initializePanelLayoutControlsImpl() {
    if (!this.panel) return;

    this.boundPanelPointerMove = (event) => this.handlePanelPointerMove(event);
    this.boundPanelPointerUp = (event) => this.handlePanelPointerUp(event);

    this.restorePanelLayout();

    if (this.panelHeader) {
        this.panelHeader.addEventListener('pointerdown', (e) => this.tryStartPanelDrag(e));
    }

    if (this.panel) {
        this.panel.addEventListener('pointerdown', (e) => this.tryStartCollapsedPanelDrag(e));
    }

    if (this.resizeHandle) {
        this.resizeHandle.addEventListener('pointerdown', (e) => this.tryStartPanelResize(e));
    }

    window.addEventListener('resize', () => this.constrainPanelToViewport());
    this.initializeIdleBehavior();
}

function tryStartPanelDragImpl(event) {
    if (!this.panel) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('#ai-panel-actions')) return;

    event.preventDefault();
    this.startPanelGesture('drag', event);
}

function tryStartCollapsedPanelDragImpl(event) {
    if (!this.panel || !this.isPanelCollapsed()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!event.target.closest('#ai-fab-btn')) return;
    event.preventDefault();
    event.stopPropagation();
    this.startPanelGesture('drag', event);
}

function tryStartPanelResizeImpl(event) {
    if (!this.panel || this.panel.classList.contains('collapsed')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    this.startPanelGesture('resize', event);
}

function startPanelGestureImpl(type, event) {
    const rect = this.panel.getBoundingClientRect();
    const styleLeft = parseFloat(this.panel.style.left);
    const styleTop = parseFloat(this.panel.style.top);
    const startLeft = Number.isFinite(styleLeft) ? styleLeft : rect.left;
    const startTop = Number.isFinite(styleTop) ? styleTop : rect.top;
    this.setPanelAbsolutePosition(startLeft, startTop);
    this.suppressFabClickOnce = false;

    this.panelGesture = {
        type,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft,
        startTop,
        startWidth: rect.width,
        startHeight: rect.height,
        moved: false
    };

    this.panel.classList.add(type === 'drag' ? 'dragging' : 'resizing');
    window.addEventListener('pointermove', this.boundPanelPointerMove);
    window.addEventListener('pointerup', this.boundPanelPointerUp);
    window.addEventListener('pointercancel', this.boundPanelPointerUp);
    this.markPanelActive();
}

function handlePanelPointerMoveImpl(event) {
    if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;

    event.preventDefault();
    this.markPanelActive();
    if (this.panelGesture.type === 'drag') {
        this.updatePanelDrag(event);
    } else {
        this.updatePanelResize(event);
    }
}

function handlePanelPointerUpImpl(event) {
    if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;
    const endedGestureType = this.panelGesture.type;
    const moved = !!this.panelGesture.moved;

    window.removeEventListener('pointermove', this.boundPanelPointerMove);
    window.removeEventListener('pointerup', this.boundPanelPointerUp);
    window.removeEventListener('pointercancel', this.boundPanelPointerUp);
    this.panel.classList.remove('dragging', 'resizing');
    this.panelGesture = null;
    if (endedGestureType === 'resize' && !this.isPanelCollapsed()) {
        this.rememberExpandedPanelSize();
    }
    if (endedGestureType === 'drag' && moved && this.isPanelCollapsed()) {
        this.suppressFabClickOnce = true;
    }
    this.markPanelActive();
    this.savePanelLayout();
}

function updatePanelDragImpl(event) {
    if (!this.panelGesture) return;

    const { startX, startY, startLeft, startTop, startWidth, startHeight } = this.panelGesture;
    const bounds = this.getPanelBounds();
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const maxLeft = Math.max(bounds.minX, bounds.maxX - startWidth);
    const maxTop = Math.max(bounds.minY, bounds.maxY - startHeight);
    const nextLeft = this.clamp(startLeft + dx, bounds.minX, maxLeft);
    const nextTop = this.clamp(startTop + dy, bounds.minY, maxTop);
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.panelGesture.moved = true;
    }
    this.setPanelAbsolutePosition(nextLeft, nextTop);
}

function updatePanelResizeImpl(event) {
    if (!this.panelGesture || !this.panel) return;
    const { startX, startY, startWidth, startHeight, startLeft, startTop } = this.panelGesture;
    const bounds = this.getPanelBounds();
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    const maxWidthByViewport = Math.max(this.minPanelWidth, bounds.maxX - startLeft);
    const maxHeightByViewport = Math.max(this.minPanelHeight, bounds.maxY - startTop);
    const nextWidth = this.clamp(startWidth + dx, this.minPanelWidth, maxWidthByViewport);
    const nextHeight = this.clamp(startHeight + dy, this.minPanelHeight, maxHeightByViewport);

    this.panel.style.width = `${nextWidth}px`;
    this.panel.style.height = `${nextHeight}px`;
    this.expandedPanelWidth = nextWidth;
    this.expandedPanelHeight = nextHeight;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.panelGesture.moved = true;
    }
}

function setPanelAbsolutePositionImpl(left, top) {
    if (!this.panel) return;
    this.panel.style.left = `${left}px`;
    this.panel.style.top = `${top}px`;
    this.panel.style.right = 'auto';
    this.panel.style.bottom = 'auto';
}

function getPanelBoundsImpl() {
    const sidePanel = document.getElementById('side-panel');
    let reservedRight = 0;
    if (sidePanel) {
        const rect = sidePanel.getBoundingClientRect();
        if (rect.width > 0) {
            reservedRight = rect.width + 12;
        }
    }
    return {
        minX: this.viewportPadding,
        minY: this.viewportPadding,
        maxX: Math.max(this.viewportPadding, window.innerWidth - this.viewportPadding - reservedRight),
        maxY: Math.max(this.viewportPadding, window.innerHeight - this.viewportPadding)
    };
}

function initializeIdleBehaviorImpl() {
    const activate = () => this.markPanelActive();
    ['pointerdown', 'pointermove', 'keydown', 'focusin', 'wheel', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, activate, { passive: true });
    });
    if (this.panel) {
        this.panel.addEventListener('pointerenter', activate);
        this.panel.addEventListener('focusin', activate);
    }
    this.markPanelActive();
}

function markPanelActiveImpl() {
    if (!this.panel) return;
    this.panel.classList.remove('idle');
    if (this.idleTimer) {
        clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
        if (!this.panel) return;
        if (this.panelGesture) return;
        this.panel.classList.add('idle');
    }, this.idleTimeoutMs);
}

function clampImpl(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function isPanelCollapsedImpl() {
    return !!this.panel?.classList?.contains('collapsed');
}

function getCollapsedPanelSizeImpl() {
    return Math.max(40, Number(this.collapsedPanelSize) || 52);
}

function getCollapsedPanelWidthImpl() {
    return this.getCollapsedPanelSize();
}

function getCollapsedPanelHeightImpl() {
    return this.getCollapsedPanelSize();
}

function rememberExpandedPanelSizeImpl() {
    if (!this.panel || this.isPanelCollapsed()) return;
    const measuredWidth = this.panel.offsetWidth || this.expandedPanelWidth || 420;
    const measuredHeight = this.panel.offsetHeight || this.expandedPanelHeight || 420;
    this.expandedPanelWidth = Math.max(this.minPanelWidth, measuredWidth);
    this.expandedPanelHeight = Math.max(this.minPanelHeight, measuredHeight);
}

function syncPanelCollapsedUIImpl() {
    const collapsed = this.isPanelCollapsed();
    if (this.toggleBtn) {
        this.toggleBtn.textContent = collapsed ? '展开' : '最小化';
        this.toggleBtn.title = collapsed ? '展开面板' : '最小化面板';
        if (typeof this.toggleBtn.setAttribute === 'function') {
            this.toggleBtn.setAttribute('aria-label', this.toggleBtn.title);
            this.toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        }
    }
    if (this.fabBtn) {
        this.fabBtn.setAttribute('aria-hidden', String(!collapsed));
        this.fabBtn.setAttribute('title', collapsed ? '展开 AI 助手' : 'AI 助手');
    }
}

function setPanelCollapsedImpl(collapsed, options = {}) {
    if (!this.panel) return;
    const { persist = true, constrain = true } = options;
    const shouldCollapse = !!collapsed;
    const currentlyCollapsed = this.isPanelCollapsed();

    if (shouldCollapse === currentlyCollapsed) {
        this.syncPanelCollapsedUI();
        if (persist) this.savePanelLayout();
        return;
    }

    if (shouldCollapse) {
        this.rememberExpandedPanelSize();
        this.panel.classList.add('collapsed');
        this.panel.style.width = `${this.getCollapsedPanelWidth()}px`;
        this.panel.style.height = `${this.getCollapsedPanelHeight()}px`;
    } else {
        this.panel.classList.remove('collapsed');
        const bounds = this.getPanelBounds();
        const availableWidth = Math.max(bounds.maxX - bounds.minX, 0);
        const availableHeight = Math.max(bounds.maxY - bounds.minY, 0);
        const restoredWidth = this.clamp(
            this.expandedPanelWidth || 420,
            availableWidth ? Math.min(this.minPanelWidth, availableWidth) : this.minPanelWidth,
            availableWidth || this.minPanelWidth
        );
        const restoredHeight = this.clamp(
            this.expandedPanelHeight || 420,
            availableHeight ? Math.min(this.minPanelHeight, availableHeight) : this.minPanelHeight,
            availableHeight || this.minPanelHeight
        );
        this.panel.style.width = `${restoredWidth}px`;
        this.panel.style.height = `${restoredHeight}px`;
        this.expandedPanelWidth = restoredWidth;
        this.expandedPanelHeight = restoredHeight;
    }

    this.syncPanelCollapsedUI();
    this.markPanelActive();
    if (constrain) {
        this.constrainPanelToViewport();
    } else if (persist) {
        this.savePanelLayout();
    }
}

function restorePanelLayoutImpl() {
    const saved = this.getSavedPanelLayout();
    const layout = saved || this.getDefaultPanelLayout();
    this.applyPanelLayout(layout);
}

function applyPanelLayoutImpl(layout) {
    if (!this.panel) return;
    const bounds = this.getPanelBounds();
    const baseExpandedWidth = Math.max(this.minPanelWidth, this.panel.offsetWidth || 420);
    const baseExpandedHeight = Math.max(this.minPanelHeight, this.panel.offsetHeight || 420);
    const currentCollapsed = this.isPanelCollapsed();
    const shouldCollapse = typeof layout.collapsed === 'boolean' ? layout.collapsed : currentCollapsed;

    const expandedWidth = this.clamp(
        typeof layout.expandedWidth === 'number'
            ? layout.expandedWidth
            : (typeof layout.width === 'number' ? layout.width : baseExpandedWidth),
        this.minPanelWidth,
        Math.max(this.minPanelWidth, bounds.maxX - bounds.minX)
    );
    const expandedHeight = this.clamp(
        typeof layout.expandedHeight === 'number'
            ? layout.expandedHeight
            : (typeof layout.height === 'number' ? layout.height : baseExpandedHeight),
        this.minPanelHeight,
        Math.max(this.minPanelHeight, bounds.maxY - bounds.minY)
    );

    this.expandedPanelWidth = expandedWidth;
    this.expandedPanelHeight = expandedHeight;

    const effectiveWidth = shouldCollapse ? this.getCollapsedPanelWidth() : expandedWidth;
    const effectiveHeight = shouldCollapse ? this.getCollapsedPanelHeight() : expandedHeight;
    const maxLeft = Math.max(bounds.minX, bounds.maxX - effectiveWidth);
    const maxTop = Math.max(bounds.minY, bounds.maxY - effectiveHeight);
    const left = this.clamp(
        typeof layout.left === 'number' ? layout.left : (bounds.maxX - effectiveWidth - this.defaultRightOffset),
        bounds.minX,
        maxLeft
    );
    const top = this.clamp(
        typeof layout.top === 'number' ? layout.top : (bounds.maxY - effectiveHeight - this.defaultBottomOffset),
        bounds.minY,
        maxTop
    );

    this.panel.classList.toggle('collapsed', shouldCollapse);
    this.panel.style.width = `${effectiveWidth}px`;
    this.panel.style.height = `${effectiveHeight}px`;
    this.setPanelAbsolutePosition(left, top);
    this.syncPanelCollapsedUI();
}

function getSavedPanelLayoutImpl() {
    try {
        const raw = localStorage.getItem(this.layoutStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            left: Number(parsed.left),
            top: Number(parsed.top),
            width: Number(parsed.width),
            height: Number(parsed.height),
            expandedWidth: Number(parsed.expandedWidth),
            expandedHeight: Number(parsed.expandedHeight),
            collapsed: !!parsed.collapsed
        };
    } catch (error) {
        console.warn('Failed to load AI panel layout:', error);
        return null;
    }
}

function savePanelLayoutImpl() {
    if (!this.panel) return;
    try {
        const rect = this.panel.getBoundingClientRect();
        const styleLeft = parseFloat(this.panel.style.left);
        const styleTop = parseFloat(this.panel.style.top);
        if (!this.isPanelCollapsed()) {
            this.rememberExpandedPanelSize();
        }
        const payload = {
            left: Number.isFinite(styleLeft) ? styleLeft : rect.left,
            top: Number.isFinite(styleTop) ? styleTop : rect.top,
            width: rect.width,
            height: rect.height,
            expandedWidth: Number.isFinite(this.expandedPanelWidth) ? this.expandedPanelWidth : Math.max(this.minPanelWidth, rect.width),
            expandedHeight: Number.isFinite(this.expandedPanelHeight) ? this.expandedPanelHeight : Math.max(this.minPanelHeight, rect.height),
            collapsed: this.isPanelCollapsed()
        };
        localStorage.setItem(this.layoutStorageKey, JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to save AI panel layout:', error);
    }
}

function getDefaultPanelLayoutImpl() {
    const measuredWidth = this.panel?.offsetWidth || 420;
    const measuredHeight = this.panel?.offsetHeight || 420;
    const width = Number.isFinite(this.expandedPanelWidth)
        ? this.expandedPanelWidth
        : (this.isPanelCollapsed() ? 420 : measuredWidth);
    const isCollapsed = this.isPanelCollapsed();
    const expandedHeight = Number.isFinite(this.expandedPanelHeight)
        ? this.expandedPanelHeight
        : (isCollapsed ? 420 : measuredHeight);
    const widthForPosition = isCollapsed ? this.getCollapsedPanelWidth() : width;
    const heightForPosition = isCollapsed ? this.getCollapsedPanelHeight() : expandedHeight;
    let reservedRight = 0;
    const sidePanel = document.getElementById('side-panel');
    if (sidePanel) {
        const rect = sidePanel.getBoundingClientRect();
        if (rect.width > 0) {
            reservedRight = rect.width + 12;
        }
    }
    const left = Math.max(this.viewportPadding, window.innerWidth - widthForPosition - this.defaultRightOffset - reservedRight);
    const top = Math.max(this.viewportPadding, window.innerHeight - heightForPosition - this.defaultBottomOffset);
    return { left, top, width, height: expandedHeight, expandedWidth: width, expandedHeight, collapsed: isCollapsed };
}

function constrainPanelToViewportImpl() {
    if (!this.panel) return;
    const rect = this.panel.getBoundingClientRect();
    const styleLeft = parseFloat(this.panel.style.left);
    const styleTop = parseFloat(this.panel.style.top);
    const styleWidth = parseFloat(this.panel.style.width);
    const styleHeight = parseFloat(this.panel.style.height);
    const collapsed = this.isPanelCollapsed();
    if (!collapsed) {
        this.rememberExpandedPanelSize();
    }
    const measuredExpandedWidth = Number.isFinite(this.expandedPanelWidth)
        ? this.expandedPanelWidth
        : (Number.isFinite(styleWidth) ? styleWidth : rect.width);
    const measuredExpandedHeight = Number.isFinite(this.expandedPanelHeight)
        ? this.expandedPanelHeight
        : (Number.isFinite(styleHeight) ? styleHeight : rect.height);
    this.applyPanelLayout({
        left: Number.isFinite(styleLeft) ? styleLeft : rect.left,
        top: Number.isFinite(styleTop) ? styleTop : rect.top,
        width: measuredExpandedWidth,
        height: measuredExpandedHeight,
        expandedWidth: measuredExpandedWidth,
        expandedHeight: measuredExpandedHeight,
        collapsed
    });
    this.savePanelLayout();
}
