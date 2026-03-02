/**
 * ExerciseBoard.js - 习题板（Markdown + LaTeX）
 * 可拖动/可缩放/可显示隐藏，内容与布局随电路一起保存。
 */

import {
    safeAddEventListener,
    safeClassListAdd,
    safeClassListRemove,
    safeClassListToggle,
    safeFocus,
    safeInvoke,
    safeRemoveEventListener
} from '../utils/RuntimeSafety.js';

function safeNodeContains(node, target) {
    return !!safeInvoke(node, 'contains', [target], false);
}

function safeHasClass(node, className) {
    return !!safeInvoke(node?.classList, 'contains', [className], false);
}

function safeToggleClass(node, className, force) {
    return safeClassListToggle(node, className, force);
}

function safeAddClass(node, ...classNames) {
    if (!classNames.length) return false;
    let allApplied = true;
    classNames.forEach((className) => {
        allApplied = safeClassListAdd(node, className) && allApplied;
    });
    return allApplied;
}

function safeRemoveClass(node, ...classNames) {
    if (!classNames.length) return false;
    let allRemoved = true;
    classNames.forEach((className) => {
        allRemoved = safeClassListRemove(node, className) && allRemoved;
    });
    return allRemoved;
}

function safeGetBoundingClientRect(node, fallback = null) {
    const rect = safeInvoke(node, 'getBoundingClientRect');
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const left = Number.isFinite(rect?.left) ? rect.left : (Number.isFinite(fb.left) ? fb.left : 0);
    const top = Number.isFinite(rect?.top) ? rect.top : (Number.isFinite(fb.top) ? fb.top : 0);
    const width = Number.isFinite(rect?.width) ? rect.width : (Number.isFinite(fb.width) ? fb.width : 0);
    const height = Number.isFinite(rect?.height) ? rect.height : (Number.isFinite(fb.height) ? fb.height : 0);
    return { left, top, width, height };
}

export class ExerciseBoard {
    constructor(app) {
        this.app = app;

        this.panel = document.getElementById('exercise-board-panel');
        this.panelHeader = document.getElementById('exercise-board-header');
        this.toolbar = document.getElementById('exercise-board-toolbar');
        this.editor = document.getElementById('exercise-board-editor');
        this.preview = document.getElementById('exercise-board-preview');
        this.previewInner = document.getElementById('exercise-board-preview-inner');
        this.modeBtn = document.getElementById('exercise-board-mode-btn');
        this.hideBtn = document.getElementById('exercise-board-hide-btn');
        this.resizeHandle = document.getElementById('exercise-board-resize-handle');
        this.toolboxToggleBtn = document.getElementById('btn-exercise-board');
        this.settingsBtn = document.getElementById('exercise-board-settings-btn');
        this.settingsPanel = document.getElementById('exercise-board-settings');
        this.fontSizeInput = document.getElementById('exercise-board-font-size');
        this.fontSizeValue = document.getElementById('exercise-board-font-size-value');
        this.lineHeightInput = document.getElementById('exercise-board-line-height');
        this.lineHeightValue = document.getElementById('exercise-board-line-height-value');
        this.editorFontSelect = document.getElementById('exercise-board-editor-font');
        this.proseWidthToggle = document.getElementById('exercise-board-prose-width');
        this.settingsResetBtn = document.getElementById('exercise-board-settings-reset-btn');

        this.viewportPadding = 12;
        this.minPanelWidth = 320;
        this.minPanelHeight = 240;
        this.renderDebounceMs = 280;

        this.defaultTypography = {
            fontSizePx: 14,
            lineHeight: 1.7,
            editorFont: 'mono', // 'mono' | 'prose'
            proseWidth: true
        };

        this.state = {
            markdown: '',
            visible: false,
            mode: 'edit', // 'edit' | 'split' | 'preview'
            layout: null,
            typography: { ...this.defaultTypography }
        };

        this.panelGesture = null;
        this.boundPanelPointerMove = (event) => this.handlePanelPointerMove(event);
        this.boundPanelPointerUp = (event) => this.handlePanelPointerUp(event);
        this.boundDocumentPointerDown = (event) => this.handleDocumentPointerDown(event);

        this._renderTimeout = null;
        this._typesetQueue = Promise.resolve();

        this.initializeLayoutControls();
        this.initializeContentControls();
        this.applyStateToUI();
    }

    initializeContentControls() {
        if (this.toolboxToggleBtn) {
            safeAddEventListener(this.toolboxToggleBtn, 'click', () => this.toggleVisible());
        }

        if (this.hideBtn) {
            safeAddEventListener(this.hideBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setVisible(false);
            });
        }

        if (this.modeBtn) {
            safeAddEventListener(this.modeBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMode();
            });
        }

        if (this.settingsBtn) {
            safeAddEventListener(this.settingsBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSettings();
            });
        }

        if (this.settingsPanel) {
            // Prevent drag gesture / outside click close from firing when interacting inside settings.
            safeAddEventListener(this.settingsPanel, 'pointerdown', (e) => {
                e.stopPropagation();
            });
        }

        // Typography controls
        if (this.fontSizeInput) {
            safeAddEventListener(this.fontSizeInput, 'input', () => {
                const next = Math.floor(Number(this.fontSizeInput.value));
                if (!Number.isFinite(next)) return;
                this.setTypography({ fontSizePx: Math.max(10, Math.min(next, 40)) });
            });
        }
        if (this.lineHeightInput) {
            safeAddEventListener(this.lineHeightInput, 'input', () => {
                const next = Number(this.lineHeightInput.value);
                if (!Number.isFinite(next)) return;
                this.setTypography({ lineHeight: Math.max(1.0, Math.min(next, 3.0)) });
            });
        }
        if (this.editorFontSelect) {
            safeAddEventListener(this.editorFontSelect, 'change', () => {
                const val = this.editorFontSelect.value === 'prose' ? 'prose' : 'mono';
                this.setTypography({ editorFont: val });
            });
        }
        if (this.proseWidthToggle) {
            safeAddEventListener(this.proseWidthToggle, 'change', () => {
                this.setTypography({ proseWidth: !!this.proseWidthToggle.checked });
            });
        }
        if (this.settingsResetBtn) {
            safeAddEventListener(this.settingsResetBtn, 'click', (e) => {
                e.preventDefault();
                this.setTypography({ ...this.defaultTypography });
            });
        }

        if (this.editor) {
            safeAddEventListener(this.editor, 'input', () => {
                this.state.markdown = this.editor.value || '';
                if (this.state.mode === 'preview' || this.state.mode === 'split') {
                    this.scheduleRender();
                }
                this.app?.scheduleSave?.();
            });

            safeAddEventListener(this.editor, 'keydown', (e) => this.handleEditorKeyDown(e));
        }

        if (this.toolbar) {
            safeAddEventListener(this.toolbar, 'click', (e) => this.handleToolbarClick(e));
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
            safeAddEventListener(this.panelHeader, 'pointerdown', (e) => this.tryStartPanelDrag(e));
        }

        if (this.resizeHandle) {
            safeAddEventListener(this.resizeHandle, 'pointerdown', (e) => this.tryStartPanelResize(e));
        }

        safeAddEventListener(window, 'resize', () => this.constrainPanelToViewport());
    }

    tryStartPanelDrag(event) {
        if (!this.panel) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const hitActions = typeof event?.target?.closest === 'function'
            ? event.target.closest('#exercise-board-actions')
            : null;
        if (hitActions) return;

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

        const rect = safeGetBoundingClientRect(this.panel, {
            left: parseFloat(this.panel.style?.left),
            top: parseFloat(this.panel.style?.top),
            width: parseFloat(this.panel.style?.width),
            height: parseFloat(this.panel.style?.height)
        });
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

        safeAddClass(this.panel, type === 'drag' ? 'dragging' : 'resizing');
        safeAddEventListener(window, 'pointermove', this.boundPanelPointerMove, { passive: false });
        safeAddEventListener(window, 'pointerup', this.boundPanelPointerUp);
        safeAddEventListener(window, 'pointercancel', this.boundPanelPointerUp);
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

        safeRemoveEventListener(window, 'pointermove', this.boundPanelPointerMove);
        safeRemoveEventListener(window, 'pointerup', this.boundPanelPointerUp);
        safeRemoveEventListener(window, 'pointercancel', this.boundPanelPointerUp);

        if (this.panel) {
            safeRemoveClass(this.panel, 'dragging', 'resizing');
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
            const rect = safeGetBoundingClientRect(toolbox);
            if (rect.width > 0) {
                reservedLeft = rect.width + 12;
            }
        }

        let reservedRight = 0;
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) {
            const rect = safeGetBoundingClientRect(sidePanel);
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

        const rect = safeGetBoundingClientRect(this.panel);
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
        if (!this.state.visible) {
            this.setSettingsOpen(false);
        }
        this.applyStateToUI();
        this.app?.scheduleSave?.();
    }

    toggleMode() {
        const current = this.normalizeMode(this.state.mode);
        const next = current === 'edit' ? 'split' : current === 'split' ? 'preview' : 'edit';
        this.state.mode = next;
        this.applyStateToUI();
        this.app?.scheduleSave?.();
    }

    applyStateToUI() {
        if (this.panel) {
            safeToggleClass(this.panel, 'hidden', !this.state.visible);
        }

        if (this.toolboxToggleBtn) {
            this.toolboxToggleBtn.textContent = this.state.visible ? '隐藏习题板' : '习题板';
        }

        const mode = this.normalizeMode(this.state.mode);
        if (this.modeBtn) {
            // Show the NEXT mode label (click target), so the user learns the cycle naturally.
            // edit -> split -> preview -> edit
            this.modeBtn.textContent = mode === 'edit' ? '分屏' : mode === 'split' ? '预览' : '编辑';
        }

        if (this.editor) {
            this.editor.value = this.state.markdown || '';
            safeToggleClass(this.editor, 'hidden', mode === 'preview');
        }

        if (this.preview) {
            safeToggleClass(this.preview, 'hidden', mode === 'edit');
        }

        if (this.toolbar) {
            safeToggleClass(this.toolbar, 'hidden', mode === 'preview');
        }

        if (this.panel) {
            safeToggleClass(this.panel, 'split', mode === 'split');
        }

        this.applyTypographyToUI();

        if (this.state.visible && mode === 'edit') {
            // Avoid stealing focus on restore; only focus when toggling visible/edit by user.
        }

        if (this.state.visible && (mode === 'preview' || mode === 'split')) {
            this.renderNow();
        }
    }

    normalizeMode(mode) {
        if (mode === 'preview' || mode === 'split' || mode === 'edit') return mode;
        return 'edit';
    }

    /**
     * 显示/排版设置面板
     */
    toggleSettings() {
        const canInspectOpen = typeof this.settingsPanel?.classList?.contains === 'function';
        const isOpen = !!(this.settingsPanel && canInspectOpen && !safeHasClass(this.settingsPanel, 'hidden'));
        this.setSettingsOpen(!isOpen);
    }

    setSettingsOpen(open) {
        if (!this.settingsPanel) return;
        safeToggleClass(this.settingsPanel, 'hidden', !open);
        if (open) {
            safeAddEventListener(document, 'pointerdown', this.boundDocumentPointerDown);
        } else {
            safeRemoveEventListener(document, 'pointerdown', this.boundDocumentPointerDown);
        }
    }

    handleDocumentPointerDown(event) {
        if (!this.settingsPanel || safeHasClass(this.settingsPanel, 'hidden')) return;
        const target = event.target;
        if (!target) return;
        if (safeNodeContains(this.settingsPanel, target)) return;
        if (safeNodeContains(this.settingsBtn, target)) return;
        this.setSettingsOpen(false);
    }

    /**
     * 更新排版设置并应用到 UI（并随电路一起保存）
     */
    setTypography(patch) {
        const current = this.state.typography && typeof this.state.typography === 'object'
            ? this.state.typography
            : { ...this.defaultTypography };
        const next = { ...current, ...(patch || {}) };
        // normalize
        next.fontSizePx = Number.isFinite(next.fontSizePx) ? Math.max(10, Math.min(Math.floor(next.fontSizePx), 40)) : this.defaultTypography.fontSizePx;
        next.lineHeight = Number.isFinite(next.lineHeight) ? Math.max(1.0, Math.min(Number(next.lineHeight), 3.0)) : this.defaultTypography.lineHeight;
        next.editorFont = next.editorFont === 'prose' ? 'prose' : 'mono';
        next.proseWidth = !!next.proseWidth;
        this.state.typography = next;
        this.applyTypographyToUI();
        this.app?.scheduleSave?.();
    }

    applyTypographyToUI() {
        if (!this.panel) return;
        const t = this.state.typography && typeof this.state.typography === 'object'
            ? this.state.typography
            : this.defaultTypography;

        this.panel.style.setProperty('--ex-font-size', `${t.fontSizePx || this.defaultTypography.fontSizePx}px`);
        this.panel.style.setProperty('--ex-line-height', String(t.lineHeight || this.defaultTypography.lineHeight));

        safeToggleClass(this.panel, 'prose-width-off', !t.proseWidth);
        safeToggleClass(this.panel, 'editor-font-prose', t.editorFont === 'prose');
        safeToggleClass(this.panel, 'editor-font-mono', t.editorFont !== 'prose');

        if (this.fontSizeInput) this.fontSizeInput.value = String(t.fontSizePx || this.defaultTypography.fontSizePx);
        if (this.fontSizeValue) this.fontSizeValue.textContent = `${t.fontSizePx || this.defaultTypography.fontSizePx}px`;
        if (this.lineHeightInput) this.lineHeightInput.value = String(t.lineHeight || this.defaultTypography.lineHeight);
        if (this.lineHeightValue) this.lineHeightValue.textContent = Number(t.lineHeight || this.defaultTypography.lineHeight).toFixed(2);
        if (this.editorFontSelect) this.editorFontSelect.value = t.editorFont === 'prose' ? 'prose' : 'mono';
        if (this.proseWidthToggle) this.proseWidthToggle.checked = !!t.proseWidth;
    }

    scheduleRender() {
        clearTimeout(this._renderTimeout);
        this._renderTimeout = setTimeout(() => this.renderNow(), this.renderDebounceMs);
    }

    renderNow() {
        if (!this.preview) return;
        const mode = this.normalizeMode(this.state.mode);
        if (mode !== 'preview' && mode !== 'split') return;

        const text = this.state.markdown || '';
        let html = '';

        const markedApi = typeof window !== 'undefined' ? window.marked : null;
        const parsedHtml = safeInvoke(markedApi, 'parse', [text, { breaks: true }]);
        if (typeof parsedHtml === 'string') {
            html = parsedHtml;
        } else {
            html = this.escapeHtml(text).replace(/\n/g, '<br>');
        }

        if (this.previewInner) {
            this.previewInner.innerHTML = html;
        } else {
            this.preview.innerHTML = html;
        }

        const mathJax = typeof window !== 'undefined' ? window.MathJax : null;
        if (typeof mathJax?.typesetPromise === 'function') {
            const target = this.preview;
            this._typesetQueue = this._typesetQueue
                .then(() => safeInvoke(mathJax, 'typesetPromise', [[target]]))
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
        const typography = this.state.typography && typeof this.state.typography === 'object'
            ? this.state.typography
            : { ...this.defaultTypography };

        return {
            markdown: this.state.markdown || '',
            visible: !!this.state.visible,
            mode: this.normalizeMode(this.state.mode),
            typography: {
                fontSizePx: Number(typography.fontSizePx ?? this.defaultTypography.fontSizePx),
                lineHeight: Number(typography.lineHeight ?? this.defaultTypography.lineHeight),
                editorFont: typography.editorFont === 'prose' ? 'prose' : 'mono',
                proseWidth: !!typography.proseWidth
            },
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
        const mode = safe.mode === 'preview' ? 'preview' : safe.mode === 'split' ? 'split' : 'edit';
        const layout = (safe.layout && typeof safe.layout === 'object') ? safe.layout : null;
        const typography = (safe.typography && typeof safe.typography === 'object') ? safe.typography : null;

        this.state.markdown = markdown;
        this.state.visible = visible;
        this.state.mode = this.normalizeMode(mode);
        if (typography) {
            this.state.typography = {
                fontSizePx: Number(typography.fontSizePx ?? this.defaultTypography.fontSizePx),
                lineHeight: Number(typography.lineHeight ?? this.defaultTypography.lineHeight),
                editorFont: typography.editorFont === 'prose' ? 'prose' : 'mono',
                proseWidth: typography.proseWidth !== false
            };
        } else {
            this.state.typography = { ...this.defaultTypography };
        }

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
        this.state.typography = { ...this.defaultTypography };
        if (!this.state.layout) {
            this.state.layout = this.getDefaultPanelLayout();
            this.applyPanelLayout(this.state.layout);
        }

        if (this.editor) this.editor.value = '';
        if (this.previewInner) {
            this.previewInner.innerHTML = '';
        } else if (this.preview) {
            this.preview.innerHTML = '';
        }
        this.applyStateToUI();
    }

    /**
     * Toolbar action dispatcher (edit-time helpers).
     */
    handleToolbarClick(event) {
        const btn = typeof event?.target?.closest === 'function'
            ? event.target.closest('button[data-ex-action]')
            : null;
        const action = btn?.dataset?.exAction;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();

        switch (action) {
            case 'bold':
                this.wrapSelection('**', '**', '加粗文字');
                break;
            case 'italic':
                this.wrapSelection('*', '*', '斜体文字');
                break;
            case 'inline-code':
                this.wrapSelection('`', '`', 'code');
                break;
            case 'quote':
                this.prefixSelectedLines('> ');
                break;
            case 'ul':
                this.prefixSelectedLines('- ');
                break;
            case 'ol':
                this.prefixSelectedLines('1. ');
                break;
            case 'math-inline':
                this.wrapSelection('$', '$', 'x');
                break;
            case 'math-block':
                this.insertMathBlock();
                break;
            case 'link':
                this.insertLink();
                break;
            default:
                break;
        }
    }

    handleEditorKeyDown(event) {
        if (!event || !this.editor) return;

        // Escape closes the panel while editing (does not conflict with main canvas hotkeys,
        // because Interaction.js intentionally ignores shortcuts while editing inputs).
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.setVisible(false);
            return;
        }

        // Indent/outdent (Markdown friendly)
        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) {
                this.outdentSelection('  ');
            } else {
                this.indentSelection('  ');
            }
            return;
        }

        const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');
        const mod = isMac ? event.metaKey : event.ctrlKey;
        if (!mod) return;

        const key = String(event.key || '').toLowerCase();
        if (key === 'b') {
            event.preventDefault();
            this.wrapSelection('**', '**', '加粗文字');
        } else if (key === 'i') {
            event.preventDefault();
            this.wrapSelection('*', '*', '斜体文字');
        } else if (key === 'k') {
            event.preventDefault();
            this.insertLink();
        } else if (key === '`') {
            event.preventDefault();
            this.wrapSelection('`', '`', 'code');
        } else if (key === 'enter') {
            event.preventDefault();
            this.toggleMode();
        }
    }

    /**
     * Wrap current selection (or insert placeholder).
     */
    wrapSelection(prefix, suffix, placeholder) {
        if (!this.editor) return;
        const el = this.editor;
        const value = el.value || '';
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const selected = value.slice(start, end);
        const content = selected || (placeholder || '');

        const nextValue = value.slice(0, start) + prefix + content + suffix + value.slice(end);
        el.value = nextValue;
        const innerStart = start + prefix.length;
        const innerEnd = innerStart + content.length;
        el.selectionStart = innerStart;
        el.selectionEnd = innerEnd;
        safeFocus(el);

        this.onEditorProgrammaticChange();
    }

    prefixSelectedLines(prefix) {
        if (!this.editor) return;
        const el = this.editor;
        const value = el.value || '';
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;

        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const endProbe = end > 0 && value[end - 1] === '\n' ? end - 1 : end;
        let blockEnd = value.indexOf('\n', endProbe);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(lineStart, blockEnd);
        const lines = block.split('\n');
        const nextBlock = lines.map((l) => prefix + l).join('\n');

        el.value = value.slice(0, lineStart) + nextBlock + value.slice(blockEnd);
        el.selectionStart = start + prefix.length;
        el.selectionEnd = end + prefix.length * lines.length;
        safeFocus(el);

        this.onEditorProgrammaticChange();
    }

    indentSelection(indent) {
        this.prefixSelectedLines(indent);
    }

    outdentSelection(indent = '  ') {
        if (!this.editor) return;
        const el = this.editor;
        const value = el.value || '';
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;

        const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const endProbe = end > 0 && value[end - 1] === '\n' ? end - 1 : end;
        let blockEnd = value.indexOf('\n', endProbe);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(lineStart, blockEnd);
        const lines = block.split('\n');

        let removedTotal = 0;
        let removedFirstLine = 0;
        const nextLines = lines.map((line, idx) => {
            let removed = 0;
            if (line.startsWith(indent)) {
                removed = indent.length;
            } else if (line.startsWith('\t')) {
                removed = 1;
            } else {
                // remove up to indent.length leading spaces
                while (removed < indent.length && line[removed] === ' ') removed += 1;
            }
            if (idx === 0) removedFirstLine = removed;
            removedTotal += removed;
            return line.slice(removed);
        });

        const nextBlock = nextLines.join('\n');
        el.value = value.slice(0, lineStart) + nextBlock + value.slice(blockEnd);
        el.selectionStart = Math.max(lineStart, start - removedFirstLine);
        el.selectionEnd = Math.max(el.selectionStart, end - removedTotal);
        safeFocus(el);

        this.onEditorProgrammaticChange();
    }

    insertMathBlock() {
        if (!this.editor) return;
        const el = this.editor;
        const value = el.value || '';
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const selected = value.slice(start, end);
        const content = selected || 'x';
        const insertion = `\n$$\n${content}\n$$\n`;

        const nextValue = value.slice(0, start) + insertion + value.slice(end);
        el.value = nextValue;
        const innerStart = start + 4; // "\n$$\n"
        const innerEnd = innerStart + content.length;
        el.selectionStart = innerStart;
        el.selectionEnd = innerEnd;
        safeFocus(el);

        this.onEditorProgrammaticChange();
    }

    insertLink() {
        if (!this.editor) return;
        const el = this.editor;
        const value = el.value || '';
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const selected = value.slice(start, end);
        const label = selected || '链接文本';
        const url = 'https://';
        const insertion = `[${label}](${url})`;

        const nextValue = value.slice(0, start) + insertion + value.slice(end);
        el.value = nextValue;

        // Select URL portion for quick replacement
        const urlStart = start + 3 + label.length; // [label](
        const urlEnd = urlStart + url.length;
        el.selectionStart = urlStart;
        el.selectionEnd = urlEnd;
        safeFocus(el);

        this.onEditorProgrammaticChange();
    }

    onEditorProgrammaticChange() {
        if (!this.editor) return;
        this.state.markdown = this.editor.value || '';
        if (this.state.mode === 'preview' || this.state.mode === 'split') {
            this.scheduleRender();
        }
        this.app?.scheduleSave?.();
    }
}
