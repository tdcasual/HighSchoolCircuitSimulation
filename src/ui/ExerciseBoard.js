/**
 * ExerciseBoard.js - 习题板（Markdown + LaTeX）
 * 可拖动/可缩放/可显示隐藏，内容与布局随电路一起保存。
 */

export class ExerciseBoard {
    constructor(app) {
        this.app = app;

        this.panel = document.getElementById('exercise-board-panel');
        this.panelHeader = document.getElementById('exercise-board-header');
        this.editor = document.getElementById('exercise-board-editor');
        this.preview = document.getElementById('exercise-board-preview');
        this.modeBtn = document.getElementById('exercise-board-mode-btn');
        this.hideBtn = document.getElementById('exercise-board-hide-btn');
        this.resizeHandle = document.getElementById('exercise-board-resize-handle');
        this.toolboxToggleBtn = document.getElementById('btn-exercise-board');

        this.viewportPadding = 12;
        this.minPanelWidth = 320;
        this.minPanelHeight = 240;
        this.renderDebounceMs = 280;

        this.state = {
            markdown: '',
            visible: false,
            mode: 'edit', // 'edit' | 'preview'
            layout: null
        };

        this.panelGesture = null;
        this.boundPanelPointerMove = (event) => this.handlePanelPointerMove(event);
        this.boundPanelPointerUp = (event) => this.handlePanelPointerUp(event);

        this._renderTimeout = null;
        this._typesetQueue = Promise.resolve();

        this.initializeLayoutControls();
        this.initializeContentControls();
        this.applyStateToUI();
    }

    initializeContentControls() {
        if (this.toolboxToggleBtn) {
            this.toolboxToggleBtn.addEventListener('click', () => this.toggleVisible());
        }

        if (this.hideBtn) {
            this.hideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setVisible(false);
            });
        }

        if (this.modeBtn) {
            this.modeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMode();
            });
        }

        if (this.editor) {
            this.editor.addEventListener('input', () => {
                this.state.markdown = this.editor.value || '';
                if (this.state.mode === 'preview') {
                    this.scheduleRender();
                }
                this.app?.scheduleSave?.();
            });
        }
    }

    initializeLayoutControls() {
        if (!this.panel) return;

        // Ensure we always have a usable starting layout even if the panel is hidden initially.
        if (!this.state.layout) {
            this.state.layout = this.getDefaultPanelLayout();
        }
        this.applyPanelLayout(this.state.layout);

        if (this.panelHeader) {
            this.panelHeader.addEventListener('pointerdown', (e) => this.tryStartPanelDrag(e));
        }

        if (this.resizeHandle) {
            this.resizeHandle.addEventListener('pointerdown', (e) => this.tryStartPanelResize(e));
        }

        window.addEventListener('resize', () => this.constrainPanelToViewport());
    }

    tryStartPanelDrag(event) {
        if (!this.panel) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('#exercise-board-actions')) return;

        event.preventDefault();
        this.startPanelGesture('drag', event);
    }

    tryStartPanelResize(event) {
        if (!this.panel) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        this.startPanelGesture('resize', event);
    }

    startPanelGesture(type, event) {
        if (!this.panel) return;

        const rect = this.panel.getBoundingClientRect();
        this.setPanelAbsolutePosition(rect.left, rect.top);
        const left = parseFloat(this.panel.style.left);
        const top = parseFloat(this.panel.style.top);

        this.panelGesture = {
            type,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: Number.isFinite(left) ? left : rect.left,
            startTop: Number.isFinite(top) ? top : rect.top,
            startWidth: rect.width,
            startHeight: rect.height
        };

        this.panel.classList.add(type === 'drag' ? 'dragging' : 'resizing');
        window.addEventListener('pointermove', this.boundPanelPointerMove, { passive: false });
        window.addEventListener('pointerup', this.boundPanelPointerUp);
        window.addEventListener('pointercancel', this.boundPanelPointerUp);
    }

    handlePanelPointerMove(event) {
        if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;

        event.preventDefault();
        if (this.panelGesture.type === 'drag') {
            this.updatePanelDrag(event);
        } else {
            this.updatePanelResize(event);
        }
    }

    handlePanelPointerUp(event) {
        if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;

        window.removeEventListener('pointermove', this.boundPanelPointerMove);
        window.removeEventListener('pointerup', this.boundPanelPointerUp);
        window.removeEventListener('pointercancel', this.boundPanelPointerUp);

        if (this.panel) {
            this.panel.classList.remove('dragging', 'resizing');
        }

        this.panelGesture = null;
        this.capturePanelLayout();
        this.app?.scheduleSave?.();
    }

    updatePanelDrag(event) {
        if (!this.panel || !this.panelGesture) return;

        const { startX, startY, startLeft, startTop, startWidth, startHeight } = this.panelGesture;
        const bounds = this.getPanelBounds();
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        const maxLeft = Math.max(bounds.minX, bounds.maxX - startWidth);
        const maxTop = Math.max(bounds.minY, bounds.maxY - startHeight);
        const nextLeft = this.clamp(startLeft + dx, bounds.minX, maxLeft);
        const nextTop = this.clamp(startTop + dy, bounds.minY, maxTop);
        this.setPanelAbsolutePosition(nextLeft, nextTop);
    }

    updatePanelResize(event) {
        if (!this.panel || !this.panelGesture) return;

        const { startX, startY, startWidth, startHeight, startLeft, startTop } = this.panelGesture;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const bounds = this.getPanelBounds();

        const availableWidth = Math.max(bounds.maxX - startLeft, 0);
        const availableHeight = Math.max(bounds.maxY - startTop, 0);
        const minWidth = Math.min(this.minPanelWidth, availableWidth || this.minPanelWidth);
        const minHeight = Math.min(this.minPanelHeight, availableHeight || this.minPanelHeight);
        const maxWidth = availableWidth || this.minPanelWidth;
        const maxHeight = availableHeight || this.minPanelHeight;

        const nextWidth = this.clamp(startWidth + dx, minWidth, Math.max(minWidth, maxWidth));
        const nextHeight = this.clamp(startHeight + dy, minHeight, Math.max(minHeight, maxHeight));

        this.panel.style.width = `${nextWidth}px`;
        this.panel.style.height = `${nextHeight}px`;
    }

    setPanelAbsolutePosition(left, top) {
        if (!this.panel) return;
        this.panel.style.left = `${left}px`;
        this.panel.style.top = `${top}px`;
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
    }

    getPanelBounds() {
        const padding = this.viewportPadding;
        return {
            minX: padding,
            minY: padding,
            maxX: window.innerWidth - padding,
            maxY: window.innerHeight - padding
        };
    }

    clamp(value, min, max) {
        if (Number.isNaN(value)) return min;
        if (max < min) max = min;
        return Math.min(Math.max(value, min), max);
    }

    getDefaultPanelLayout() {
        const width = 420;
        const height = 360;

        let reservedLeft = 0;
        const toolbox = document.getElementById('toolbox');
        if (toolbox) {
            const rect = toolbox.getBoundingClientRect();
            if (rect.width > 0) {
                reservedLeft = rect.width + 12;
            }
        }

        let reservedRight = 0;
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) {
            const rect = sidePanel.getBoundingClientRect();
            if (rect.width > 0) {
                reservedRight = rect.width + 12;
            }
        }

        const bounds = this.getPanelBounds();
        const availableWidth = Math.max(bounds.maxX - bounds.minX - reservedLeft - reservedRight, width);
        const left = bounds.minX + reservedLeft + Math.max(0, Math.floor((availableWidth - width) * 0.06));
        const top = bounds.minY + 14;

        return { left, top, width, height };
    }

    applyPanelLayout(layout) {
        if (!this.panel) return;

        const bounds = this.getPanelBounds();
        const availableWidth = Math.max(bounds.maxX - bounds.minX, 0);
        const availableHeight = Math.max(bounds.maxY - bounds.minY, 0);

        const width = this.clamp(
            typeof layout?.width === 'number' ? layout.width : 420,
            availableWidth ? Math.min(this.minPanelWidth, availableWidth) : this.minPanelWidth,
            availableWidth || this.minPanelWidth
        );

        const height = this.clamp(
            typeof layout?.height === 'number' ? layout.height : 360,
            availableHeight ? Math.min(this.minPanelHeight, availableHeight) : this.minPanelHeight,
            availableHeight || this.minPanelHeight
        );

        const maxLeft = Math.max(bounds.minX, bounds.maxX - width);
        const maxTop = Math.max(bounds.minY, bounds.maxY - height);

        const left = this.clamp(
            typeof layout?.left === 'number' ? layout.left : bounds.minX,
            bounds.minX,
            maxLeft
        );

        const top = this.clamp(
            typeof layout?.top === 'number' ? layout.top : bounds.minY,
            bounds.minY,
            maxTop
        );

        this.panel.style.width = `${width}px`;
        this.panel.style.height = `${height}px`;
        this.setPanelAbsolutePosition(left, top);
    }

    capturePanelLayout() {
        if (!this.panel) return;

        const rect = this.panel.getBoundingClientRect();
        const styleLeft = parseFloat(this.panel.style.left);
        const styleTop = parseFloat(this.panel.style.top);
        const styleWidth = parseFloat(this.panel.style.width);
        const styleHeight = parseFloat(this.panel.style.height);

        this.state.layout = {
            left: Number.isFinite(styleLeft) ? styleLeft : rect.left,
            top: Number.isFinite(styleTop) ? styleTop : rect.top,
            width: Number.isFinite(styleWidth) ? styleWidth : rect.width,
            height: Number.isFinite(styleHeight) ? styleHeight : rect.height
        };
    }

    constrainPanelToViewport() {
        if (!this.panel) return;

        this.capturePanelLayout();
        const layout = this.state.layout || this.getDefaultPanelLayout();
        this.applyPanelLayout(layout);
        this.capturePanelLayout();
    }

    toggleVisible() {
        this.setVisible(!this.state.visible);
    }

    setVisible(visible) {
        this.state.visible = !!visible;
        this.applyStateToUI();
        this.app?.scheduleSave?.();
    }

    toggleMode() {
        this.state.mode = this.state.mode === 'edit' ? 'preview' : 'edit';
        this.applyStateToUI();
        this.app?.scheduleSave?.();
    }

    applyStateToUI() {
        if (this.panel) {
            this.panel.classList.toggle('hidden', !this.state.visible);
        }

        if (this.toolboxToggleBtn) {
            this.toolboxToggleBtn.textContent = this.state.visible ? '隐藏习题板' : '习题板';
        }

        const mode = this.state.mode === 'preview' ? 'preview' : 'edit';
        if (this.modeBtn) {
            this.modeBtn.textContent = mode === 'preview' ? '编辑' : '预览';
        }

        if (this.editor) {
            this.editor.value = this.state.markdown || '';
            this.editor.classList.toggle('hidden', mode !== 'edit');
        }

        if (this.preview) {
            this.preview.classList.toggle('hidden', mode !== 'preview');
        }

        if (this.state.visible && mode === 'edit') {
            // Avoid stealing focus on restore; only focus when toggling visible/edit by user.
        }

        if (this.state.visible && mode === 'preview') {
            this.renderNow();
        }
    }

    scheduleRender() {
        clearTimeout(this._renderTimeout);
        this._renderTimeout = setTimeout(() => this.renderNow(), this.renderDebounceMs);
    }

    renderNow() {
        if (!this.preview) return;
        if (this.state.mode !== 'preview') return;

        const text = this.state.markdown || '';
        let html = '';

        if (window.marked?.parse) {
            html = window.marked.parse(text, { breaks: true });
        } else {
            html = this.escapeHtml(text).replace(/\n/g, '<br>');
        }

        this.preview.innerHTML = html;

        if (window.MathJax?.typesetPromise) {
            const target = this.preview;
            this._typesetQueue = this._typesetQueue
                .then(() => window.MathJax.typesetPromise([target]))
                .catch(() => {});
        }
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    toJSON() {
        // Keep layout fresh in case the panel moved without ending a gesture (rare but cheap to refresh).
        this.capturePanelLayout();
        const layout = this.state.layout || this.getDefaultPanelLayout();

        return {
            markdown: this.state.markdown || '',
            visible: !!this.state.visible,
            mode: this.state.mode === 'preview' ? 'preview' : 'edit',
            layout: {
                left: Number.isFinite(layout.left) ? layout.left : 0,
                top: Number.isFinite(layout.top) ? layout.top : 0,
                width: Number.isFinite(layout.width) ? layout.width : 420,
                height: Number.isFinite(layout.height) ? layout.height : 360
            }
        };
    }

    fromJSON(data) {
        const safe = (data && typeof data === 'object') ? data : {};
        const markdown = typeof safe.markdown === 'string' ? safe.markdown : '';
        const visible = typeof safe.visible === 'boolean' ? safe.visible : false;
        const mode = safe.mode === 'preview' ? 'preview' : 'edit';
        const layout = (safe.layout && typeof safe.layout === 'object') ? safe.layout : null;

        this.state.markdown = markdown;
        this.state.visible = visible;
        this.state.mode = mode;

        if (layout) {
            const normalized = {
                left: Number(layout.left),
                top: Number(layout.top),
                width: Number(layout.width),
                height: Number(layout.height)
            };
            const keys = ['left', 'top', 'width', 'height'];
            if (keys.every((k) => Number.isFinite(normalized[k]) && !Number.isNaN(normalized[k]))) {
                this.state.layout = normalized;
            }
        }

        if (!this.state.layout) {
            this.state.layout = this.getDefaultPanelLayout();
        }

        this.applyPanelLayout(this.state.layout);
        this.applyStateToUI();
    }

    reset() {
        this.state.markdown = '';
        this.state.visible = false;
        this.state.mode = 'edit';
        if (!this.state.layout) {
            this.state.layout = this.getDefaultPanelLayout();
            this.applyPanelLayout(this.state.layout);
        }

        if (this.editor) this.editor.value = '';
        if (this.preview) this.preview.innerHTML = '';
        this.applyStateToUI();
    }
}
