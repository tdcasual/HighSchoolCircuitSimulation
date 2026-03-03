import { createElement } from '../../utils/SafeDOM.js';
import { safeAddEventListener, safeInvoke, safeSetAttribute } from '../../utils/RuntimeSafety.js';
import { formatNumberCompact } from '../observation/ObservationMath.js';
import {
    getQuantitiesForSource,
    getSourceOptions,
    TIME_SOURCE_ID
} from '../observation/ObservationSources.js';
import {
    RESIZE_DIRECTIONS,
    isInteractiveTarget,
    refreshSourceOptions as refreshChartWindowSourceOptions,
    rebuildSeriesControls as rebuildChartWindowSeriesControls
} from './ChartWindowControls.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

export class ChartWindowController {
    constructor(workspace, state) {
        this.workspace = workspace;
        this.state = state;
        this.seriesElements = new Map();
        this._needsRedraw = true;
        this._autoRangeWindow = { x: null, y: null };
        this._latestText = '最新: —';
        this._dragSession = null;
        this._resizeSession = null;
        this._restoreFrame = null;

        this.elements = {
            root: null,
            header: null,
            titleInput: null,
            canvas: null,
            latest: null,
            axisControls: null,
            axisToggleBtn: null,
            xSource: null,
            xQuantity: null,
            legend: null,
            legendBody: null,
            legendToggleBtn: null,
            resizers: null
        };

        this.boundPointerMove = (event) => this.onPointerMove(event);
        this.boundPointerUp = (event) => this.onPointerUp(event);
    }

    mount(parentEl) {
        const root = createElement('section', {
            className: 'chart-window chart-window-v2',
            attrs: {
                'data-chart-window-id': this.state.id
            }
        });

        const header = createElement('div', { className: 'chart-window-header' });
        const titleInput = createElement('input', {
            className: 'chart-window-title',
            attrs: {
                type: 'text',
                value: this.state.title || '',
                placeholder: '图表标题'
            }
        });
        const addSeriesBtn = createElement('button', {
            className: 'chart-window-btn chart-window-btn-primary',
            textContent: '+ 系列',
            attrs: { type: 'button' }
        });
        const axisToggleBtn = createElement('button', {
            className: 'chart-window-btn',
            textContent: this.state.ui?.axisCollapsed ? '展开X设置' : '收起X设置',
            attrs: { type: 'button' }
        });
        const legendToggleBtn = createElement('button', {
            className: 'chart-window-btn',
            textContent: this.state.ui?.legendCollapsed ? '展开图例' : '收起图例',
            attrs: { type: 'button' }
        });
        const closeBtn = createElement('button', {
            className: 'chart-window-btn chart-window-btn-danger',
            textContent: '关闭',
            attrs: { type: 'button' }
        });

        header.appendChild(titleInput);
        header.appendChild(addSeriesBtn);
        header.appendChild(axisToggleBtn);
        header.appendChild(legendToggleBtn);
        header.appendChild(closeBtn);

        const axisControls = createElement('div', { className: 'chart-window-axis-controls' });
        const xSource = createElement('select');
        const xQuantity = createElement('select');
        axisControls.appendChild(this.createControlGroup('共享X来源', xSource));
        axisControls.appendChild(this.createControlGroup('共享X量', xQuantity));

        const canvasWrap = createElement('div', { className: 'chart-window-canvas-wrap' });
        const canvas = createElement('canvas', { className: 'chart-window-canvas' });
        canvasWrap.appendChild(canvas);

        const latest = createElement('div', {
            className: 'chart-window-latest',
            textContent: this._latestText
        });

        const legend = createElement('section', { className: 'chart-window-legend' });
        const legendBody = createElement('div', { className: 'chart-window-legend-body' });
        legend.appendChild(legendBody);

        const resizers = createElement('div', { className: 'chart-window-resizers' });
        RESIZE_DIRECTIONS.forEach((dir) => {
            const handle = createElement('div', {
                className: `chart-window-resizer chart-window-resizer-${dir}`,
                attrs: { 'data-resize-dir': dir }
            });
            safeAddEventListener(handle, 'pointerdown', (event) => this.onResizeHandlePointerDown(event, dir));
            resizers.appendChild(handle);
        });

        root.appendChild(header);
        root.appendChild(axisControls);
        root.appendChild(canvasWrap);
        root.appendChild(latest);
        root.appendChild(legend);
        root.appendChild(resizers);

        this.elements = {
            root,
            header,
            titleInput,
            canvas,
            latest,
            axisControls,
            axisToggleBtn,
            xSource,
            xQuantity,
            legend,
            legendBody,
            legendToggleBtn,
            resizers
        };

        safeAddEventListener(root, 'pointerdown', () => {
            this.workspace.focusWindow(this);
        });
        safeAddEventListener(header, 'pointerdown', (event) => this.onHeaderPointerDown(event));
        safeAddEventListener(header, 'dblclick', (event) => this.onHeaderDoubleClick(event));
        safeAddEventListener(titleInput, 'change', () => {
            this.workspace.commandService.updateChartTitle(this.state.id, titleInput.value);
        });
        safeAddEventListener(addSeriesBtn, 'click', () => {
            this.workspace.addSeriesToChart(this.state.id);
        });
        safeAddEventListener(axisToggleBtn, 'click', () => {
            this.workspace.commandService.toggleChartAxisControls(this.state.id);
        });
        safeAddEventListener(legendToggleBtn, 'click', () => {
            this.workspace.commandService.toggleChartLegend(this.state.id);
        });
        safeAddEventListener(closeBtn, 'click', () => {
            this.workspace.commandService.removeChart(this.state.id);
        });
        safeAddEventListener(xSource, 'change', () => this.onAxisSourceChange());
        safeAddEventListener(xQuantity, 'change', () => this.onAxisQuantityChange());

        parentEl.appendChild(root);

        this.applyRect();
        this.applyLegendState();
        this.refreshSourceOptions();
        this.rebuildSeriesControls();
        this.markDirty();
    }

    createControlGroup(labelText, fieldEl) {
        const group = createElement('label', { className: 'chart-window-control-group' });
        group.appendChild(createElement('span', { textContent: labelText }));
        group.appendChild(fieldEl);
        return group;
    }

    dispose() {
        this.cancelPointerSessions();
        safeInvokeMethod(this.elements.root, 'remove');
        this.seriesElements.clear();
    }

    updateState(nextState) {
        this.state = nextState;
        this.applyRect();
        if (this.elements.titleInput) {
            const nextTitle = this.state.title || '';
            if (this.elements.titleInput.value !== nextTitle) {
                this.elements.titleInput.value = nextTitle;
            }
        }
        this.applyLegendState();
        this.refreshSourceOptions();
        this.rebuildSeriesControls();
        this.markDirty();
    }

    applyLegendState() {
        const collapsed = !!this.state.ui?.legendCollapsed;
        safeInvokeMethod(this.elements.root?.classList, 'toggle', 'chart-window-legend-collapsed', collapsed);
        if (this.elements.legendToggleBtn) {
            this.elements.legendToggleBtn.textContent = collapsed ? '展开图例' : '收起图例';
            safeSetAttribute(this.elements.legendToggleBtn, 'aria-expanded', collapsed ? 'false' : 'true');
        }

        const axisCollapsed = !!this.state.ui?.axisCollapsed;
        safeInvokeMethod(this.elements.root?.classList, 'toggle', 'chart-window-axis-collapsed', axisCollapsed);
        if (this.elements.axisToggleBtn) {
            this.elements.axisToggleBtn.textContent = axisCollapsed ? '展开X设置' : '收起X设置';
            safeSetAttribute(this.elements.axisToggleBtn, 'aria-expanded', axisCollapsed ? 'false' : 'true');
        }
    }

    setZIndex(zIndex) {
        this.state.zIndex = Math.max(1, Math.floor(Number(zIndex) || 1));
        if (this.elements.root?.style) {
            this.elements.root.style.zIndex = String(this.state.zIndex);
        }
    }

    applyRect() {
        const frame = this.workspace.clampRect(this.state.frame || {});
        this.state.frame = frame;
        if (!this.elements.root?.style) return;
        this.elements.root.style.left = `${frame.x}px`;
        this.elements.root.style.top = `${frame.y}px`;
        this.elements.root.style.width = `${frame.width}px`;
        this.elements.root.style.height = `${frame.height}px`;
        this.setZIndex(this.state.zIndex);
    }

    onHeaderPointerDown(event) {
        if (!this.workspace.isWindowDragEnabled()) return;
        if (isInteractiveTarget(event?.target)) return;
        const pointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
        if (pointerId == null) return;

        this.cancelPointerSessions();
        this._restoreFrame = null;
        this.workspace.focusWindow(this);
        this._dragSession = {
            pointerId,
            startX: Number(event?.clientX) || 0,
            startY: Number(event?.clientY) || 0,
            originX: this.state.frame?.x || 0,
            originY: this.state.frame?.y || 0,
            pendingFrame: null
        };

        safeInvokeMethod(this.elements.root?.classList, 'add', 'chart-window-dragging');
        safeInvokeMethod(this.elements.header, 'setPointerCapture', pointerId);
        this.attachGlobalPointerListeners();
        event?.preventDefault?.();
    }

    onHeaderDoubleClick(event) {
        if (!this.workspace.isWindowResizeEnabled()) return;
        if (isInteractiveTarget(event?.target)) return;

        if (this._restoreFrame) {
            const restoreFrame = { ...this._restoreFrame };
            this._restoreFrame = null;
            this.workspace.commandService.updateChartFrame(this.state.id, restoreFrame);
            return;
        }

        const current = this.state.frame || {};
        this._restoreFrame = {
            x: Number(current.x) || 0,
            y: Number(current.y) || 0,
            width: Number(current.width) || 320,
            height: Number(current.height) || 240
        };
        const layerSize = this.workspace.getLayerSize?.() || { width: 1024, height: 720 };
        const margin = 12;
        const next = this.workspace.clampRect({
            x: margin,
            y: margin,
            width: Math.max(260, layerSize.width - margin * 2),
            height: Math.max(200, layerSize.height - margin - 44)
        });
        this.workspace.commandService.updateChartFrame(this.state.id, next);
        event?.preventDefault?.();
    }

    onResizeHandlePointerDown(event, direction) {
        if (!this.workspace.isWindowResizeEnabled()) return;
        const pointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
        if (pointerId == null) return;

        this.cancelPointerSessions();
        this._restoreFrame = null;
        this.workspace.focusWindow(this);
        this._resizeSession = {
            pointerId,
            direction: String(direction || 'se'),
            startX: Number(event?.clientX) || 0,
            startY: Number(event?.clientY) || 0,
            originFrame: { ...(this.state.frame || {}) },
            pendingFrame: null
        };

        safeInvokeMethod(this.elements.root?.classList, 'add', 'chart-window-resizing');
        safeInvokeMethod(event?.currentTarget, 'setPointerCapture', pointerId);
        this.attachGlobalPointerListeners();
        event?.preventDefault?.();
        event?.stopPropagation?.();
    }

    onPointerMove(event) {
        const resizeSession = this._resizeSession;
        if (resizeSession && Number(event?.pointerId) === resizeSession.pointerId) {
            const dx = (Number(event?.clientX) || 0) - resizeSession.startX;
            const dy = (Number(event?.clientY) || 0) - resizeSession.startY;
            const origin = resizeSession.originFrame || {};
            const direction = resizeSession.direction || 'se';

            const nextFrame = {
                x: Number(origin.x) || 0,
                y: Number(origin.y) || 0,
                width: Number(origin.width) || 320,
                height: Number(origin.height) || 240
            };

            if (direction.includes('e')) {
                nextFrame.width += dx;
            }
            if (direction.includes('s')) {
                nextFrame.height += dy;
            }
            if (direction.includes('w')) {
                nextFrame.x += dx;
                nextFrame.width -= dx;
            }
            if (direction.includes('n')) {
                nextFrame.y += dy;
                nextFrame.height -= dy;
            }

            const clamped = this.workspace.clampRect(nextFrame);
            resizeSession.pendingFrame = clamped;
            if (this.elements.root?.style) {
                this.elements.root.style.left = `${clamped.x}px`;
                this.elements.root.style.top = `${clamped.y}px`;
                this.elements.root.style.width = `${clamped.width}px`;
                this.elements.root.style.height = `${clamped.height}px`;
            }
            this.markDirty();
            event?.preventDefault?.();
            return;
        }

        const dragSession = this._dragSession;
        if (!dragSession) return;
        if (Number(event?.pointerId) !== dragSession.pointerId) return;

        const dx = (Number(event?.clientX) || 0) - dragSession.startX;
        const dy = (Number(event?.clientY) || 0) - dragSession.startY;

        const nextFrame = this.workspace.clampRect({
            ...this.state.frame,
            x: Math.round(dragSession.originX + dx),
            y: Math.round(dragSession.originY + dy)
        });
        dragSession.pendingFrame = nextFrame;

        if (this.elements.root?.style) {
            this.elements.root.style.left = `${nextFrame.x}px`;
            this.elements.root.style.top = `${nextFrame.y}px`;
        }
        event?.preventDefault?.();
    }

    onPointerUp(event) {
        const resizeSession = this._resizeSession;
        if (resizeSession && Number(event?.pointerId) === resizeSession.pointerId) {
            this._resizeSession = null;
            safeInvokeMethod(this.elements.root?.classList, 'remove', 'chart-window-resizing');
            this.detachDragListeners();
            if (resizeSession.pendingFrame) {
                this.workspace.commandService.updateChartFrame(this.state.id, resizeSession.pendingFrame);
            }
            return;
        }

        const dragSession = this._dragSession;
        if (!dragSession) return;
        if (Number(event?.pointerId) !== dragSession.pointerId) return;

        this._dragSession = null;
        this.detachDragListeners();
        safeInvokeMethod(this.elements.root?.classList, 'remove', 'chart-window-dragging');

        if (dragSession.pendingFrame) {
            this.workspace.commandService.updateChartFrame(this.state.id, dragSession.pendingFrame);
        }
    }

    attachGlobalPointerListeners() {
        if (typeof window === 'undefined') return;
        safeAddEventListener(window, 'pointermove', this.boundPointerMove);
        safeAddEventListener(window, 'pointerup', this.boundPointerUp);
        safeAddEventListener(window, 'pointercancel', this.boundPointerUp);
    }

    cancelPointerSessions() {
        this._dragSession = null;
        this._resizeSession = null;
        safeInvokeMethod(this.elements.root?.classList, 'remove', 'chart-window-dragging');
        safeInvokeMethod(this.elements.root?.classList, 'remove', 'chart-window-resizing');
        this.detachDragListeners();
    }

    detachDragListeners() {
        if (typeof window === 'undefined') return;
        safeInvokeMethod(window, 'removeEventListener', 'pointermove', this.boundPointerMove);
        safeInvokeMethod(window, 'removeEventListener', 'pointerup', this.boundPointerUp);
        safeInvokeMethod(window, 'removeEventListener', 'pointercancel', this.boundPointerUp);
    }

    onAxisSourceChange() {
        const sourceId = this.workspace.resolveSourceId(this.elements.xSource?.value || TIME_SOURCE_ID);
        const quantityOptions = getQuantitiesForSource(sourceId, this.workspace.circuit);
        const quantityId = quantityOptions.some((item) => item.id === this.elements.xQuantity?.value)
            ? this.elements.xQuantity.value
            : (quantityOptions[0]?.id || 't');

        this.workspace.commandService.setChartAxisXBinding(this.state.id, {
            sourceId,
            quantityId
        });
    }

    onAxisQuantityChange() {
        const sourceId = this.workspace.resolveSourceId(this.elements.xSource?.value || TIME_SOURCE_ID);
        const quantityId = String(this.elements.xQuantity?.value || 't');
        this.workspace.commandService.setChartAxisXBinding(this.state.id, {
            sourceId,
            quantityId
        });
    }

    refreshSourceOptions() {
        refreshChartWindowSourceOptions(this);
    }

    rebuildSeriesControls() {
        rebuildChartWindowSeriesControls(this);
    }

    resolveBindingMeaning(binding = {}) {
        const sourceId = this.workspace.resolveSourceId?.(binding.sourceId || TIME_SOURCE_ID) || TIME_SOURCE_ID;
        const quantityId = String(binding.quantityId || 't');
        const sourceOptions = getSourceOptions(this.workspace.circuit);
        const source = sourceOptions.find((item) => item.id === sourceId);
        const sourceLabelRaw = source?.label || sourceId;
        const sourceLabel = sourceLabelRaw.split(' · ')[0] || sourceLabelRaw;

        const quantityOptions = getQuantitiesForSource(sourceId, this.workspace.circuit);
        const quantity = quantityOptions.find((item) => item.id === quantityId) || quantityOptions[0] || null;
        const quantityText = quantity?.label || quantityId;
        const withUnit = quantity?.unit && !quantityText.includes(`(${quantity.unit})`)
            ? `${quantityText} (${quantity.unit})`
            : quantityText;

        if (sourceId === TIME_SOURCE_ID) {
            return withUnit;
        }
        return `${sourceLabel} · ${withUnit}`;
    }

    resolveAxisMeaningLabels() {
        const xLabel = this.resolveBindingMeaning(this.state.axis?.xBinding);
        const visibleSeries = (this.state.series || []).filter((series) => series.visible !== false);
        const seriesList = visibleSeries.length > 0 ? visibleSeries : (this.state.series || []);
        if (seriesList.length <= 0) {
            return {
                xLabel,
                yLabel: '—'
            };
        }
        if (seriesList.length === 1) {
            const series = seriesList[0];
            return {
                xLabel,
                yLabel: this.resolveBindingMeaning({
                    sourceId: series.sourceId,
                    quantityId: series.quantityId,
                    transformId: series.transformId
                })
            };
        }

        const meanings = seriesList.map((series) => this.resolveBindingMeaning({
            sourceId: series.sourceId,
            quantityId: series.quantityId,
            transformId: series.transformId
        }));
        const uniqueMeaningCount = new Set(meanings).size;
        return {
            xLabel,
            yLabel: uniqueMeaningCount === 1
                ? `${meanings[0]}（${seriesList.length}条系列）`
                : `多系列（${seriesList.length}条）`
        };
    }

    clearData() {
        const seriesBuffers = this.workspace.getChartSeriesBuffers(this.state.id);
        if (!(seriesBuffers instanceof Map)) return;
        for (const buffer of seriesBuffers.values()) {
            buffer?.clear?.();
        }
        this._autoRangeWindow = { x: null, y: null };
        this._latestText = '最新: —';
        if (this.elements.latest) {
            this.elements.latest.textContent = this._latestText;
        }
        this.markDirty();
    }

    markDirty() {
        this._needsRedraw = true;
    }

    resizeCanvasToDisplaySize() {
        const canvas = this.elements.canvas;
        if (!canvas) return;
        const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
            ? window.devicePixelRatio
            : 1;
        const rect = canvas.getBoundingClientRect?.();
        const cssWidth = Math.max(1, Math.round(rect?.width || canvas.clientWidth || this.state.frame?.width || 320));
        const cssHeight = Math.max(1, Math.round(rect?.height || canvas.clientHeight || 180));
        const targetW = Math.max(1, Math.round(cssWidth * dpr));
        const targetH = Math.max(1, Math.round(cssHeight * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            this.markDirty();
        }
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

        const seriesBuffers = this.workspace.getChartSeriesBuffers(this.state.id);
        const frame = this.workspace.projectionService.computeFrame({
            chart: this.state,
            seriesBuffers,
            autoRangeWindow: this._autoRangeWindow,
            width: canvas.width,
            height: canvas.height,
            dpr
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!frame) {
            ctx.fillStyle = '#64748b';
            ctx.font = `${12 * dpr}px sans-serif`;
            ctx.fillText('暂无数据，运行模拟后开始采样', 20 * dpr, 24 * dpr);
            this._latestText = '最新: —';
            if (this.elements.latest) {
                this.elements.latest.textContent = this._latestText;
            }
            this._needsRedraw = false;
            return;
        }

        this._autoRangeWindow = frame.nextAutoRangeWindow || this._autoRangeWindow;

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = Math.max(1, dpr);
        frame.xTicks.forEach((tick) => {
            const x = frame.xToPx(tick);
            ctx.beginPath();
            ctx.moveTo(x, frame.padT);
            ctx.lineTo(x, frame.padT + frame.innerH);
            ctx.stroke();
        });
        frame.yTicks.forEach((tick) => {
            const y = frame.yToPx(tick);
            ctx.beginPath();
            ctx.moveTo(frame.padL, y);
            ctx.lineTo(frame.padL + frame.innerW, y);
            ctx.stroke();
        });

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.beginPath();
        ctx.moveTo(frame.padL, frame.padT);
        ctx.lineTo(frame.padL, frame.padT + frame.innerH);
        ctx.lineTo(frame.padL + frame.innerW, frame.padT + frame.innerH);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.font = `${11 * dpr}px sans-serif`;
        frame.xTicks.forEach((tick) => {
            const px = frame.xToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), px - 10 * dpr, frame.padT + frame.innerH + 18 * dpr);
        });
        frame.yTicks.forEach((tick) => {
            const py = frame.yToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), 4 * dpr, py + 4 * dpr);
        });

        const axisMeaning = this.resolveAxisMeaningLabels();
        ctx.fillStyle = '#1f2937';
        ctx.font = `${11 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`X: ${axisMeaning.xLabel}`, frame.padL + frame.innerW / 2, canvas.height - 6 * dpr);

        ctx.save();
        ctx.translate(12 * dpr, frame.padT + frame.innerH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Y: ${axisMeaning.yLabel}`, 0, 0);
        ctx.restore();

        const visibleSeries = (this.state.series || []).filter((series) => series.visible !== false);
        const drawSeries = visibleSeries.length > 0 ? visibleSeries : (this.state.series || []);

        let latestPoint = null;
        drawSeries.forEach((series) => {
            const buffer = seriesBuffers?.get?.(series.id);
            if (!buffer || buffer.length <= 0) return;

            const maxDrawPoints = Math.max(220, Math.floor(frame.innerW / Math.max(dpr, 1)) * 2);
            const pointCount = buffer.length;
            const step = pointCount > maxDrawPoints ? Math.ceil(pointCount / maxDrawPoints) : 1;

            ctx.strokeStyle = series.color || '#1d4ed8';
            ctx.lineWidth = 2 * dpr;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();

            let started = false;
            buffer.forEachSampled(step, (x, y) => {
                const px = frame.xToPx(x);
                const py = frame.yToPx(y);
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

            const last = buffer.getPoint?.(buffer.length - 1);
            if (last && Number.isFinite(last.x) && Number.isFinite(last.y)) {
                latestPoint = {
                    seriesName: series.name,
                    x: last.x,
                    y: last.y
                };
            }
        });

        if (latestPoint) {
            this._latestText = `最新(${latestPoint.seriesName}): x=${formatNumberCompact(latestPoint.x)}, y=${formatNumberCompact(latestPoint.y)}`;
        } else {
            this._latestText = '最新: —';
        }
        if (this.elements.latest) {
            this.elements.latest.textContent = this._latestText;
        }

        this._needsRedraw = false;
    }
}
