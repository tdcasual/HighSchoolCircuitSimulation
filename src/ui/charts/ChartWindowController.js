import { createElement } from '../../utils/SafeDOM.js';
import { safeAddEventListener, safeInvoke } from '../../utils/RuntimeSafety.js';
import { RESIZE_DIRECTIONS } from './ChartWindowControls.js';
import { ChartWindowPointerController } from './ChartWindowPointerController.js';
import { ChartWindowBindingController } from './ChartWindowBindingController.js';
import { ChartWindowCanvasView } from './ChartWindowCanvasView.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

export class ChartWindowController {
    constructor(workspace, state, options = {}) {
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

        this.pointerController = options.pointerController || new ChartWindowPointerController(this);
        this.bindingController = options.bindingController || new ChartWindowBindingController(this);
        this.canvasView = options.canvasView || new ChartWindowCanvasView(this);
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

    applyLegendState() {
        return this.bindingController?.applyLegendState?.();
    }

    onHeaderPointerDown(event) {
        return this.pointerController?.onHeaderPointerDown?.(event);
    }

    onHeaderDoubleClick(event) {
        return this.pointerController?.onHeaderDoubleClick?.(event);
    }

    onResizeHandlePointerDown(event, direction) {
        return this.pointerController?.onResizeHandlePointerDown?.(event, direction);
    }

    onPointerMove(event) {
        return this.pointerController?.onPointerMove?.(event);
    }

    onPointerUp(event) {
        return this.pointerController?.onPointerUp?.(event);
    }

    attachGlobalPointerListeners() {
        return this.pointerController?.attachGlobalPointerListeners?.();
    }

    cancelPointerSessions() {
        return this.pointerController?.cancelPointerSessions?.();
    }

    detachDragListeners() {
        return this.pointerController?.detachDragListeners?.();
    }

    onAxisSourceChange() {
        return this.bindingController?.onAxisSourceChange?.();
    }

    onAxisQuantityChange() {
        return this.bindingController?.onAxisQuantityChange?.();
    }

    refreshSourceOptions() {
        return this.bindingController?.refreshSourceOptions?.();
    }

    rebuildSeriesControls() {
        return this.bindingController?.rebuildSeriesControls?.();
    }

    resolveBindingMeaning(binding = {}) {
        return this.bindingController?.resolveBindingMeaning?.(binding);
    }

    resolveAxisMeaningLabels() {
        return this.bindingController?.resolveAxisMeaningLabels?.() || { xLabel: '—', yLabel: '—' };
    }

    clearData() {
        return this.canvasView?.clearData?.();
    }

    markDirty() {
        return this.canvasView?.markDirty?.();
    }

    resizeCanvasToDisplaySize() {
        return this.canvasView?.resizeCanvasToDisplaySize?.();
    }

    render() {
        return this.canvasView?.render?.();
    }
}
