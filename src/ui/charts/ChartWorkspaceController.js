import { createElement } from '../../utils/SafeDOM.js';
import {
    DEFAULT_SAMPLE_INTERVAL_MS,
    normalizeSampleIntervalMs,
    shouldSampleAtTime
} from '../observation/ObservationState.js';
import { getQuantitiesForSource, PROBE_SOURCE_PREFIX, TIME_SOURCE_ID } from '../observation/ObservationSources.js';
import {
    createDefaultChartWindowState,
    normalizeChartWorkspaceState,
    serializeChartWorkspaceState
} from './ChartWorkspaceState.js';
import { ChartWindowController } from './ChartWindowController.js';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

export class ChartWorkspaceController {
    constructor(app) {
        this.app = app;
        this.circuit = app?.circuit || null;
        this.root = null;
        this.windowLayer = null;
        this.toolbar = null;
        this.runtimeStatusEl = null;
        this.sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS;
        this.windows = [];
        this.nextZIndex = 1;
        this._renderRaf = 0;
        this._lastSimTime = 0;
        this._lastSampleTime = Number.NEGATIVE_INFINITY;
        this.layoutMode = 'desktop';

        this.ensureRoot();
        if (!this.root || !this.windowLayer) return;
        this.fromJSON({
            sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
            windows: [createDefaultChartWindowState({ index: 1 })]
        });
    }

    ensureRoot() {
        if (typeof document === 'undefined') return;
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;
        const root = document.getElementById('chart-workspace-root')
            || createElement('div', { id: 'chart-workspace-root' });
        if (!root.parentElement) {
            canvasContainer.appendChild(root);
        }

        root.className = 'chart-workspace-root';
        while (root.firstChild) {
            root.removeChild(root.firstChild);
        }

        const toolbar = createElement('div', { className: 'chart-workspace-toolbar' });
        const addBtn = createElement('button', {
            className: 'chart-workspace-btn',
            textContent: '＋ 图表',
            attrs: { type: 'button', 'data-chart-action': 'add' }
        });
        const clearBtn = createElement('button', {
            className: 'chart-workspace-btn',
            textContent: '清空数据',
            attrs: { type: 'button', 'data-chart-action': 'clear' }
        });
        const sampleLabel = createElement('label', { className: 'chart-workspace-sample-label' });
        sampleLabel.appendChild(createElement('span', { textContent: '采样(ms)' }));
        const sampleInput = createElement('input', {
            className: 'chart-workspace-sample-input',
            attrs: {
                type: 'number',
                min: '0',
                max: '5000',
                step: '1',
                value: String(this.sampleIntervalMs)
            }
        });
        sampleLabel.appendChild(sampleInput);

        toolbar.appendChild(addBtn);
        toolbar.appendChild(clearBtn);
        toolbar.appendChild(sampleLabel);

        const runtimeStatusEl = createElement('div', {
            className: 'chart-workspace-runtime-status',
            textContent: ''
        });
        runtimeStatusEl.style.display = 'none';
        const windowLayer = createElement('div', { className: 'chart-workspace-window-layer' });

        root.appendChild(toolbar);
        root.appendChild(runtimeStatusEl);
        root.appendChild(windowLayer);

        this.root = root;
        this.toolbar = toolbar;
        this.runtimeStatusEl = runtimeStatusEl;
        this.windowLayer = windowLayer;

        safeInvokeMethod(addBtn, 'addEventListener', 'click', () => {
            this.addWindow();
        });
        safeInvokeMethod(clearBtn, 'addEventListener', 'click', () => {
            this.clearAllPlots();
        });
        safeInvokeMethod(sampleInput, 'addEventListener', 'change', () => {
            const next = normalizeSampleIntervalMs(sampleInput.value, this.sampleIntervalMs);
            this.sampleIntervalMs = next;
            sampleInput.value = String(next);
            this.schedulePersist(0);
        });

        if (typeof window !== 'undefined') {
            safeInvokeMethod(window, 'addEventListener', 'resize', () => {
                this.applyWindowRects();
                this.requestRender();
            });
        }
    }

    schedulePersist(delayMs = 0) {
        this.app?.scheduleSave?.(delayMs);
    }

    setRuntimeStatus(message = '') {
        if (!this.runtimeStatusEl) return;
        const text = String(message || '').trim();
        if (!text) {
            this.runtimeStatusEl.textContent = '';
            this.runtimeStatusEl.style.display = 'none';
            return;
        }
        this.runtimeStatusEl.textContent = text;
        this.runtimeStatusEl.style.display = 'block';
    }

    isWindowDragEnabled() {
        return this.layoutMode !== 'phone';
    }

    onLayoutModeChanged(mode = 'desktop') {
        this.layoutMode = String(mode || 'desktop');
        safeInvokeMethod(this.root?.classList, 'toggle', 'chart-workspace-phone', this.layoutMode === 'phone');
    }

    resolveSourceId(sourceId) {
        if (typeof sourceId !== 'string' || !sourceId.trim()) return TIME_SOURCE_ID;
        const normalized = sourceId.trim();
        if (normalized === TIME_SOURCE_ID) return TIME_SOURCE_ID;
        if (normalized.startsWith(PROBE_SOURCE_PREFIX)) return normalized;
        if (this.circuit?.components?.has?.(normalized)) return normalized;
        if (typeof this.circuit?.getObservationProbe === 'function') {
            const probe = this.circuit.getObservationProbe(normalized);
            if (probe) return `${PROBE_SOURCE_PREFIX}${probe.id}`;
        }
        return TIME_SOURCE_ID;
    }

    getLayerSize() {
        const rect = this.windowLayer?.getBoundingClientRect?.();
        const width = Math.max(320, Math.floor(rect?.width || this.windowLayer?.clientWidth || 1024));
        const height = Math.max(220, Math.floor(rect?.height || this.windowLayer?.clientHeight || 720));
        return { width, height };
    }

    clampRect(rect = {}) {
        const { width: layerWidth, height: layerHeight } = this.getLayerSize();
        const widthRaw = Number(rect.width);
        const heightRaw = Number(rect.height);
        const width = Math.max(280, Math.min(layerWidth, Math.round(Number.isFinite(widthRaw) ? widthRaw : 420)));
        const height = Math.max(200, Math.min(layerHeight, Math.round(Number.isFinite(heightRaw) ? heightRaw : 280)));
        const xRaw = Number(rect.x);
        const yRaw = Number(rect.y);
        const maxX = Math.max(0, layerWidth - Math.min(width, 120));
        const maxY = Math.max(0, layerHeight - 48);
        const x = Math.min(maxX, Math.max(0, Math.round(Number.isFinite(xRaw) ? xRaw : 48)));
        const y = Math.min(maxY, Math.max(0, Math.round(Number.isFinite(yRaw) ? yRaw : 86)));
        return { x, y, width, height };
    }

    addWindow(options = {}) {
        const index = this.windows.length + 1;
        const state = createDefaultChartWindowState({
            index,
            rect: options.rect
        });
        if (options.title) {
            state.title = String(options.title);
        }
        if (options.sourceId) {
            const sourceId = this.resolveSourceId(options.sourceId);
            const quantities = getQuantitiesForSource(sourceId, this.circuit);
            state.series.y.sourceId = sourceId;
            state.series.y.quantityId = options.quantityId
                || quantities[0]?.id
                || state.series.y.quantityId;
        }
        if (options.xSourceId) {
            const xSourceId = this.resolveSourceId(options.xSourceId);
            const quantities = getQuantitiesForSource(xSourceId, this.circuit);
            state.series.x.sourceId = xSourceId;
            state.series.x.quantityId = options.xQuantityId
                || quantities[0]?.id
                || state.series.x.quantityId;
        }

        const controller = this.createWindowController(state);
        this.focusWindow(controller);
        this.refreshComponentOptions();
        this.requestRender();
        this.schedulePersist(0);
        return controller;
    }

    createWindowController(state) {
        const normalizedState = {
            ...state,
            rect: this.clampRect(state.rect)
        };
        const controller = new ChartWindowController(this, normalizedState);
        controller.setZIndex(this.nextZIndex++);
        controller.mount(this.windowLayer);
        this.windows.push(controller);
        return controller;
    }

    removeWindow(windowId) {
        const index = this.windows.findIndex((item) => item.state.id === windowId);
        if (index < 0) return;
        const [removed] = this.windows.splice(index, 1);
        removed?.dispose?.();
        this.requestRender();
        this.schedulePersist(0);
    }

    focusWindow(targetWindow) {
        if (!targetWindow) return;
        if (targetWindow.state.zIndex >= this.nextZIndex - 1) return;
        targetWindow.setZIndex(this.nextZIndex++);
        this.schedulePersist(0);
    }

    applyWindowRects() {
        this.windows.forEach((windowController) => {
            windowController.state.rect = this.clampRect(windowController.state.rect);
            windowController.applyRect();
            windowController.markDirty();
        });
    }

    refreshComponentOptions() {
        this.windows.forEach((windowController) => windowController.refreshSourceOptions());
    }

    refreshDialGauges() {
        // 保留统一接口，当前图表工作区不再展示独立表盘。
    }

    addPlotForSource(sourceId, options = {}) {
        const quantityId = options.quantityId || null;
        this.addWindow({
            sourceId,
            quantityId
        });
    }

    clearAllPlots() {
        this.windows.forEach((windowController) => windowController.clearData());
        this.requestRender();
    }

    requestRender() {
        if (this._renderRaf) return;
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
        this._renderRaf = window.requestAnimationFrame(() => {
            this._renderRaf = 0;
            this.renderAll();
        });
    }

    renderAll() {
        this.windows.forEach((windowController) => windowController.render());
    }

    onCircuitUpdate(results) {
        if (!this.root) return;
        const currentTime = Number.isFinite(this.circuit?.simTime) ? this.circuit.simTime : 0;
        if (currentTime + 1e-9 < this._lastSimTime) {
            this.clearAllPlots();
            this._lastSampleTime = Number.NEGATIVE_INFINITY;
        }
        this._lastSimTime = currentTime;

        if (!results || !results.valid) {
            if (this.circuit?.isRunning) {
                this.setRuntimeStatus('当前解无效，图表采样已暂停。');
            } else {
                this.setRuntimeStatus('');
            }
            return;
        }
        this.setRuntimeStatus('');

        const shouldSample = shouldSampleAtTime(currentTime, this._lastSampleTime, this.sampleIntervalMs);
        if (shouldSample) {
            const valueCache = new Map();
            this.windows.forEach((windowController) => {
                windowController.sample(valueCache);
            });
            this._lastSampleTime = currentTime;
        }
        this.requestRender();
    }

    toJSON() {
        return serializeChartWorkspaceState({
            sampleIntervalMs: this.sampleIntervalMs,
            windows: this.windows.map((windowController) => windowController.serializeState())
        });
    }

    fromJSON(rawState = {}) {
        const normalized = normalizeChartWorkspaceState(rawState);
        this.sampleIntervalMs = normalizeSampleIntervalMs(normalized.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS);
        const sampleInput = this.toolbar?.querySelector?.('.chart-workspace-sample-input');
        if (sampleInput) {
            sampleInput.value = String(this.sampleIntervalMs);
        }

        this.windows.forEach((windowController) => windowController.dispose());
        this.windows = [];
        this.nextZIndex = 1;

        normalized.windows.forEach((windowState) => {
            this.createWindowController(windowState);
        });

        this.refreshComponentOptions();
        this.requestRender();
    }
}
