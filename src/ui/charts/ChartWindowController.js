import { createElement } from '../../utils/SafeDOM.js';
import { safeInvoke } from '../../utils/RuntimeSafety.js';
import {
    applyTransform,
    computeNiceTicks,
    computeRangeFromBuffer,
    formatNumberCompact,
    RingBuffer2D,
    stabilizeAutoRangeWindow
} from '../observation/ObservationMath.js';
import {
    evaluateSourceQuantity,
    getQuantitiesForSource,
    getSourceOptions,
    TIME_SOURCE_ID
} from '../observation/ObservationSources.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

function setSelectOptions(selectEl, options, selectedId) {
    if (!selectEl) return null;
    while (selectEl.firstChild) {
        selectEl.removeChild(selectEl.firstChild);
    }
    options.forEach((opt) => {
        const optionEl = createElement('option', {
            textContent: opt.label,
            attrs: { value: opt.id }
        });
        selectEl.appendChild(optionEl);
    });
    const hasSelected = selectedId != null && options.some((opt) => opt.id === selectedId);
    if (hasSelected) {
        selectEl.value = selectedId;
    } else if (options.length > 0) {
        selectEl.value = options[0].id;
    }
    return selectEl.value || null;
}

function isInteractiveTarget(node) {
    if (!node || typeof node.closest !== 'function') return false;
    return !!node.closest('input,select,button,textarea,label,a');
}

export class ChartWindowController {
    constructor(workspace, state) {
        this.workspace = workspace;
        this.state = state;
        this.buffer = new RingBuffer2D(this.state.maxPoints);
        this._needsRedraw = true;
        this._autoRangeWindow = { x: null, y: null };
        this._latestText = '最新: —';
        this._dragSession = null;

        this.elements = {
            root: null,
            header: null,
            canvas: null,
            latest: null,
            title: null,
            xSource: null,
            xQuantity: null,
            ySource: null,
            yQuantity: null,
            controls: null
        };

        this.boundPointerMove = (event) => this.onPointerMove(event);
        this.boundPointerUp = (event) => this.onPointerUp(event);
    }

    mount(parentEl) {
        const root = createElement('section', {
            className: 'chart-window',
            attrs: {
                'data-chart-window-id': this.state.id
            }
        });
        root.style.zIndex = String(this.state.zIndex);

        const header = createElement('div', { className: 'chart-window-header' });
        const titleInput = createElement('input', {
            className: 'chart-window-title',
            attrs: {
                type: 'text',
                value: this.state.title || '',
                placeholder: '图表标题'
            }
        });
        const clearBtn = createElement('button', {
            className: 'chart-window-btn',
            textContent: '清空',
            attrs: { type: 'button' }
        });
        const collapseBtn = createElement('button', {
            className: 'chart-window-btn',
            textContent: this.state.uiState?.collapsed ? '展开' : '收起',
            attrs: { type: 'button' }
        });
        const closeBtn = createElement('button', {
            className: 'chart-window-btn chart-window-btn-danger',
            textContent: '关闭',
            attrs: { type: 'button' }
        });

        header.appendChild(titleInput);
        header.appendChild(clearBtn);
        header.appendChild(collapseBtn);
        header.appendChild(closeBtn);

        const canvasWrap = createElement('div', { className: 'chart-window-canvas-wrap' });
        const canvas = createElement('canvas', { className: 'chart-window-canvas' });
        canvasWrap.appendChild(canvas);

        const latest = createElement('div', {
            className: 'chart-window-latest',
            textContent: this._latestText
        });

        const controls = createElement('div', { className: 'chart-window-controls' });
        const xSource = createElement('select');
        const xQuantity = createElement('select');
        const ySource = createElement('select');
        const yQuantity = createElement('select');
        controls.appendChild(this.createControlGroup('X 来源', xSource));
        controls.appendChild(this.createControlGroup('X 量', xQuantity));
        controls.appendChild(this.createControlGroup('Y 来源', ySource));
        controls.appendChild(this.createControlGroup('Y 量', yQuantity));

        root.appendChild(header);
        root.appendChild(canvasWrap);
        root.appendChild(latest);
        root.appendChild(controls);

        this.elements = {
            root,
            header,
            canvas,
            latest,
            title: titleInput,
            xSource,
            xQuantity,
            ySource,
            yQuantity,
            controls,
            collapseBtn
        };

        safeInvokeMethod(root, 'addEventListener', 'pointerdown', () => {
            this.workspace.focusWindow(this);
        });
        safeInvokeMethod(header, 'addEventListener', 'pointerdown', (event) => this.onHeaderPointerDown(event));
        safeInvokeMethod(titleInput, 'addEventListener', 'change', () => {
            this.state.title = String(titleInput.value || '').trim() || this.state.title;
            titleInput.value = this.state.title;
            this.workspace.schedulePersist(0);
        });
        safeInvokeMethod(clearBtn, 'addEventListener', 'click', () => {
            this.clearData();
            this.workspace.requestRender();
        });
        safeInvokeMethod(collapseBtn, 'addEventListener', 'click', () => {
            const next = !this.state.uiState?.collapsed;
            this.state.uiState = {
                ...this.state.uiState,
                collapsed: next
            };
            this.applyCollapsedState();
            this.workspace.schedulePersist(0);
        });
        safeInvokeMethod(closeBtn, 'addEventListener', 'click', () => {
            this.workspace.removeWindow(this.state.id);
        });
        safeInvokeMethod(xSource, 'addEventListener', 'change', () => this.onAxisSourceChange('x'));
        safeInvokeMethod(ySource, 'addEventListener', 'change', () => this.onAxisSourceChange('y'));
        safeInvokeMethod(xQuantity, 'addEventListener', 'change', () => this.onAxisQuantityChange('x'));
        safeInvokeMethod(yQuantity, 'addEventListener', 'change', () => this.onAxisQuantityChange('y'));

        parentEl.appendChild(root);
        this.applyRect();
        this.applyCollapsedState();
        this.refreshSourceOptions();
        this.markDirty();
    }

    createControlGroup(labelText, selectEl) {
        const group = createElement('label', { className: 'chart-window-control-group' });
        const label = createElement('span', { textContent: labelText });
        group.appendChild(label);
        group.appendChild(selectEl);
        return group;
    }

    dispose() {
        this.detachDragListeners();
        safeInvokeMethod(this.elements.root, 'remove');
        this.elements.root = null;
    }

    setZIndex(nextZIndex) {
        this.state.zIndex = Math.max(1, Math.floor(Number(nextZIndex) || 1));
        if (this.elements.root?.style) {
            this.elements.root.style.zIndex = String(this.state.zIndex);
        }
    }

    applyRect() {
        const rect = this.workspace.clampRect(this.state.rect);
        this.state.rect = rect;
        if (!this.elements.root?.style) return;
        this.elements.root.style.left = `${rect.x}px`;
        this.elements.root.style.top = `${rect.y}px`;
        this.elements.root.style.width = `${rect.width}px`;
        this.elements.root.style.height = `${rect.height}px`;
    }

    applyCollapsedState() {
        const collapsed = !!this.state.uiState?.collapsed;
        safeInvokeMethod(this.elements.root?.classList, 'toggle', 'chart-window-collapsed', collapsed);
        if (this.elements.collapseBtn) {
            this.elements.collapseBtn.textContent = collapsed ? '展开' : '收起';
        }
        this.markDirty();
    }

    onHeaderPointerDown(event) {
        if (!this.workspace.isWindowDragEnabled()) return;
        if (isInteractiveTarget(event?.target)) return;
        const pointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
        if (pointerId === null) return;

        this.workspace.focusWindow(this);
        this._dragSession = {
            pointerId,
            startX: Number(event?.clientX) || 0,
            startY: Number(event?.clientY) || 0,
            originX: this.state.rect.x,
            originY: this.state.rect.y
        };
        safeInvokeMethod(this.elements.root?.classList, 'add', 'chart-window-dragging');

        const target = this.elements.header;
        safeInvokeMethod(target, 'setPointerCapture', pointerId);
        if (typeof window !== 'undefined') {
            safeInvokeMethod(window, 'addEventListener', 'pointermove', this.boundPointerMove);
            safeInvokeMethod(window, 'addEventListener', 'pointerup', this.boundPointerUp);
            safeInvokeMethod(window, 'addEventListener', 'pointercancel', this.boundPointerUp);
        }
        event?.preventDefault?.();
    }

    onPointerMove(event) {
        const session = this._dragSession;
        if (!session) return;
        if (Number(event?.pointerId) !== session.pointerId) return;
        const dx = (Number(event?.clientX) || 0) - session.startX;
        const dy = (Number(event?.clientY) || 0) - session.startY;
        this.state.rect = this.workspace.clampRect({
            ...this.state.rect,
            x: Math.round(session.originX + dx),
            y: Math.round(session.originY + dy)
        });
        this.applyRect();
        this.markDirty();
        this.workspace.requestRender();
        event?.preventDefault?.();
    }

    onPointerUp(event) {
        const session = this._dragSession;
        if (!session) return;
        if (Number(event?.pointerId) !== session.pointerId) return;
        this._dragSession = null;
        this.detachDragListeners();
        safeInvokeMethod(this.elements.root?.classList, 'remove', 'chart-window-dragging');
        this.workspace.schedulePersist(0);
    }

    detachDragListeners() {
        if (typeof window === 'undefined') return;
        safeInvokeMethod(window, 'removeEventListener', 'pointermove', this.boundPointerMove);
        safeInvokeMethod(window, 'removeEventListener', 'pointerup', this.boundPointerUp);
        safeInvokeMethod(window, 'removeEventListener', 'pointercancel', this.boundPointerUp);
    }

    onAxisSourceChange(axisKey) {
        const isXAxis = axisKey === 'x';
        const sourceSelect = isXAxis ? this.elements.xSource : this.elements.ySource;
        const axisState = isXAxis ? this.state.series.x : this.state.series.y;
        const nextSource = this.workspace.resolveSourceId(sourceSelect?.value);
        axisState.sourceId = nextSource;
        this.refreshQuantityOptions(axisKey);
        this.markDirty();
        this.workspace.requestRender();
        this.workspace.schedulePersist(0);
    }

    onAxisQuantityChange(axisKey) {
        const isXAxis = axisKey === 'x';
        const quantitySelect = isXAxis ? this.elements.xQuantity : this.elements.yQuantity;
        const axisState = isXAxis ? this.state.series.x : this.state.series.y;
        axisState.quantityId = String(quantitySelect?.value || axisState.quantityId || '');
        this.markDirty();
        this.workspace.requestRender();
        this.workspace.schedulePersist(0);
    }

    refreshSourceOptions() {
        const sourceOptions = getSourceOptions(this.workspace.circuit);
        const resolvedX = setSelectOptions(
            this.elements.xSource,
            sourceOptions,
            this.workspace.resolveSourceId(this.state.series.x.sourceId)
        );
        const resolvedY = setSelectOptions(
            this.elements.ySource,
            sourceOptions,
            this.workspace.resolveSourceId(this.state.series.y.sourceId)
        );
        if (resolvedX) this.state.series.x.sourceId = resolvedX;
        if (resolvedY) this.state.series.y.sourceId = resolvedY;
        this.refreshQuantityOptions('x');
        this.refreshQuantityOptions('y');
    }

    refreshQuantityOptions(axisKey) {
        const isXAxis = axisKey === 'x';
        const axisState = isXAxis ? this.state.series.x : this.state.series.y;
        const selectEl = isXAxis ? this.elements.xQuantity : this.elements.yQuantity;
        const quantityOptions = getQuantitiesForSource(axisState.sourceId, this.workspace.circuit);
        const resolvedQuantity = setSelectOptions(selectEl, quantityOptions, axisState.quantityId);
        if (resolvedQuantity) {
            axisState.quantityId = resolvedQuantity;
        } else if (quantityOptions.length > 0) {
            axisState.quantityId = quantityOptions[0].id;
        }
    }

    clearData() {
        this.buffer.clear();
        this._latestText = '最新: —';
        if (this.elements.latest) {
            this.elements.latest.textContent = this._latestText;
        }
        this.markDirty();
    }

    markDirty() {
        this._needsRedraw = true;
    }

    sample(valueCache = null) {
        const xAxis = this.state.series.x;
        const yAxis = this.state.series.y;
        const xRaw = this.getSampleValue(xAxis.sourceId, xAxis.quantityId, valueCache);
        const yRaw = this.getSampleValue(yAxis.sourceId, yAxis.quantityId, valueCache);
        const x = applyTransform(xRaw, xAxis.transformId);
        const y = applyTransform(yRaw, yAxis.transformId);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        this.buffer.push(x, y);
        this._latestText = `最新: x=${formatNumberCompact(x)}, y=${formatNumberCompact(y)}`;
        if (this.elements.latest) {
            this.elements.latest.textContent = this._latestText;
        }
        this.markDirty();
    }

    getSampleValue(sourceId, quantityId, valueCache = null) {
        if (!(valueCache instanceof Map)) {
            return evaluateSourceQuantity(this.workspace.circuit, sourceId, quantityId);
        }
        const key = `${sourceId || ''}\u0000${quantityId || ''}`;
        if (valueCache.has(key)) {
            return valueCache.get(key);
        }
        const value = evaluateSourceQuantity(this.workspace.circuit, sourceId, quantityId);
        valueCache.set(key, value);
        return value;
    }

    resizeCanvasToDisplaySize() {
        const canvas = this.elements.canvas;
        if (!canvas) return;
        const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
            ? window.devicePixelRatio
            : 1;
        const rect = canvas.getBoundingClientRect?.();
        const cssWidth = Math.max(1, Math.round(rect?.width || canvas.clientWidth || this.state.rect.width));
        const cssHeight = Math.max(1, Math.round(rect?.height || canvas.clientHeight || 180));
        const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
        const targetHeight = Math.max(1, Math.round(cssHeight * dpr));
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            this.markDirty();
        }
    }

    computeFrame(dpr) {
        const canvas = this.elements.canvas;
        if (!canvas) return null;
        const w = canvas.width;
        const h = canvas.height;
        const padL = 46 * dpr;
        const padR = 12 * dpr;
        const padT = 14 * dpr;
        const padB = 28 * dpr;
        const innerW = Math.max(1, w - padL - padR);
        const innerH = Math.max(1, h - padT - padB);

        const range = computeRangeFromBuffer(this.buffer);
        if (!range) return null;
        const xWindow = stabilizeAutoRangeWindow({ min: range.minX, max: range.maxX }, this._autoRangeWindow.x, {
            paddingRatio: 0.03,
            expandRatio: 0.02,
            shrinkDeadbandRatio: 0.14,
            shrinkSmoothing: 0.2
        });
        const yWindow = stabilizeAutoRangeWindow({ min: range.minY, max: range.maxY }, this._autoRangeWindow.y, {
            paddingRatio: 0.05,
            expandRatio: 0.025,
            shrinkDeadbandRatio: 0.16,
            shrinkSmoothing: 0.2
        });
        this._autoRangeWindow = { x: xWindow, y: yWindow };
        if (!xWindow || !yWindow) return null;

        let xMin = xWindow.min;
        let xMax = xWindow.max;
        let yMin = yWindow.min;
        let yMax = yWindow.max;
        if (xMin === xMax) {
            const pad = xMin === 0 ? 1 : Math.abs(xMin) * 0.1;
            xMin -= pad;
            xMax += pad;
        }
        if (yMin === yMax) {
            const pad = yMin === 0 ? 1 : Math.abs(yMin) * 0.1;
            yMin -= pad;
            yMax += pad;
        }
        const xTicks = computeNiceTicks(xMin, xMax, 5);
        const yTicks = computeNiceTicks(yMin, yMax, 5);

        return {
            w,
            h,
            padL,
            padR,
            padT,
            padB,
            innerW,
            innerH,
            xMin,
            xMax,
            yMin,
            yMax,
            xTicks,
            yTicks
        };
    }

    render() {
        if (!this._needsRedraw) return;
        const canvas = this.elements.canvas;
        if (!canvas) return;
        this.resizeCanvasToDisplaySize();

        const ctx = canvas.getContext?.('2d');
        if (!ctx) return;
        const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
            ? window.devicePixelRatio
            : 1;
        const frame = this.computeFrame(dpr);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!frame || this.buffer.length <= 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = `${12 * dpr}px sans-serif`;
            ctx.fillText('暂无数据，运行模拟后开始采样', 22 * dpr, 26 * dpr);
            this._needsRedraw = false;
            return;
        }

        const { padL, padT, innerW, innerH, xMin, xMax, yMin, yMax, xTicks, yTicks } = frame;
        const xToPx = (x) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
        const yToPx = (y) => padT + (1 - (y - yMin) / (yMax - yMin)) * innerH;

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = Math.max(1, dpr);
        xTicks.forEach((tick) => {
            const x = xToPx(tick);
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + innerH);
            ctx.stroke();
        });
        yTicks.forEach((tick) => {
            const y = yToPx(tick);
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + innerW, y);
            ctx.stroke();
        });

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + innerH);
        ctx.lineTo(padL + innerW, padT + innerH);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.font = `${11 * dpr}px sans-serif`;
        xTicks.forEach((tick) => {
            const px = xToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), px - 10 * dpr, padT + innerH + 18 * dpr);
        });
        yTicks.forEach((tick) => {
            const py = yToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), 4 * dpr, py + 4 * dpr);
        });

        const maxDrawPoints = Math.max(220, Math.floor(innerW / Math.max(dpr, 1)) * 2);
        const pointCount = this.buffer.length;
        const step = pointCount > maxDrawPoints ? Math.ceil(pointCount / maxDrawPoints) : 1;

        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 2 * dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false;
        this.buffer.forEachSampled(step, (x, y) => {
            const px = xToPx(x);
            const py = yToPx(y);
            if (!Number.isFinite(px) || !Number.isFinite(py)) return;
            if (!started) {
                started = true;
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        });
        if (started) {
            ctx.stroke();
        }

        this._needsRedraw = false;
    }

    serializeState() {
        return {
            id: this.state.id,
            title: this.state.title,
            rect: {
                x: this.state.rect.x,
                y: this.state.rect.y,
                width: this.state.rect.width,
                height: this.state.rect.height
            },
            zIndex: this.state.zIndex,
            maxPoints: this.state.maxPoints,
            series: {
                x: { ...this.state.series.x },
                y: { ...this.state.series.y }
            },
            uiState: {
                collapsed: !!this.state.uiState?.collapsed
            }
        };
    }

    configureYAxis(sourceId, quantityId = null) {
        const nextSource = this.workspace.resolveSourceId(sourceId);
        this.state.series.y.sourceId = nextSource;
        this.refreshSourceOptions();
        if (quantityId && this.elements.yQuantity) {
            this.state.series.y.quantityId = quantityId;
            this.elements.yQuantity.value = quantityId;
        }
        this.markDirty();
    }

    configureXAxis(sourceId, quantityId = null) {
        const nextSource = this.workspace.resolveSourceId(sourceId || TIME_SOURCE_ID);
        this.state.series.x.sourceId = nextSource;
        this.refreshSourceOptions();
        if (quantityId && this.elements.xQuantity) {
            this.state.series.x.quantityId = quantityId;
            this.elements.xQuantity.value = quantityId;
        }
        this.markDirty();
    }
}
