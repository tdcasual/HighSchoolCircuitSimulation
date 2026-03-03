import { createElement } from '../../utils/SafeDOM.js';
import { safeAddEventListener, safeClassListToggle } from '../../utils/RuntimeSafety.js';
import {
    DEFAULT_SAMPLE_INTERVAL_MS,
    normalizeSampleIntervalMs,
    shouldSampleAtTime
} from '../observation/ObservationState.js';
import { RingBuffer2D } from '../observation/ObservationMath.js';
import { getQuantitiesForSource, PROBE_SOURCE_PREFIX, TIME_SOURCE_ID } from '../observation/ObservationSources.js';
import {
    createDefaultChartWorkspaceState,
    normalizeChartWorkspaceState,
    serializeChartWorkspaceState
} from './ChartWorkspaceState.js';
import { ChartDocumentStore } from './ChartDocumentStore.js';
import { ChartCommandService } from './ChartCommandService.js';
import { ChartSamplingService } from './ChartSamplingService.js';
import { ChartProjectionService } from './ChartProjectionService.js';
import { ChartWindowController } from './ChartWindowController.js';

export class ChartWorkspaceController {
    constructor(app) {
        this.app = app;
        this.circuit = app?.circuit || null;
        this.root = null;
        this.windowLayer = null;
        this.runtimeStatusEl = null;
        this.layoutMode = 'desktop';

        this.store = new ChartDocumentStore(createDefaultChartWorkspaceState({
            sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS
        }));
        this.commandService = new ChartCommandService(this.store, {
            onChange: (reason, state) => this.onDocumentChanged(reason, state),
            resolveDefaultFrame: (index, options) => this.resolveDefaultFrame(index, options)
        });
        this.samplingService = new ChartSamplingService();
        this.projectionService = new ChartProjectionService();

        this.windowControllers = new Map();
        this.seriesBuffers = new Map();
        this.windows = [];
        this.nextZIndex = 1;

        this._renderRaf = 0;
        this._lastSimTime = 0;
        this._lastSampleTime = Number.NEGATIVE_INFINITY;
        this._suppressPersist = false;

        this.ensureRoot();
        if (!this.root || !this.windowLayer) return;
        this.syncControllersWithState(this.store.getState());
        this.requestRender();
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

        const runtimeStatusEl = createElement('div', {
            className: 'chart-workspace-runtime-status',
            textContent: ''
        });
        runtimeStatusEl.style.display = 'none';

        const windowLayer = createElement('div', { className: 'chart-workspace-window-layer' });

        root.appendChild(runtimeStatusEl);
        root.appendChild(windowLayer);

        this.root = root;
        this.runtimeStatusEl = runtimeStatusEl;
        this.windowLayer = windowLayer;

        if (typeof window !== 'undefined') {
            safeAddEventListener(window, 'resize', () => {
                this.applyWindowRects();
                this.requestRender();
            });
        }
    }

    schedulePersist(delayMs = 0) {
        if (this._suppressPersist) return;
        this.app?.scheduleSave?.(delayMs);
    }

    getState() {
        return this.store.getState();
    }

    onDocumentChanged(_reason, state) {
        this.syncControllersWithState(state);
        this.schedulePersist(0);
        this.requestRender();
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

    isWindowResizeEnabled() {
        return this.layoutMode !== 'phone';
    }

    onLayoutModeChanged(mode = 'desktop') {
        this.layoutMode = String(mode || 'desktop');
        safeClassListToggle(this.root, 'chart-workspace-phone', this.layoutMode === 'phone');
        this.applyWindowRects();
        this.requestRender();
    }

    resolveSourceId(sourceId) {
        if (sourceId === undefined || sourceId === null) return TIME_SOURCE_ID;
        const normalized = String(sourceId).trim();
        if (!normalized) return TIME_SOURCE_ID;
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

    resolveDefaultFrame(index = 1, options = {}) {
        if (this.layoutMode === 'phone') {
            return this.resolvePhoneDefaultFrame(index, options);
        }
        const { width: layerWidth, height: layerHeight } = this.getLayerSize();
        const preferredWidth = Math.min(Math.max(340, Math.round(layerWidth * 0.44)), 620);
        const preferredHeight = Math.min(Math.max(240, Math.round(layerHeight * 0.4)), 460);
        const frame = {
            x: 36 + (index - 1) * 26,
            y: 72 + (index - 1) * 20,
            width: options?.frame?.width ?? preferredWidth,
            height: options?.frame?.height ?? preferredHeight
        };
        return this.clampRect({ ...frame, ...(options?.frame || {}) });
    }

    resolvePhoneDefaultFrame(index = 1, options = {}) {
        const { width: layerWidth, height: layerHeight } = this.getLayerSize();
        const horizontalPadding = 8;
        const topPadding = 8;
        const bottomReserve = this.getPhoneBottomAvoidancePx();
        const maxWidth = Math.max(240, layerWidth - horizontalPadding * 2);
        const preferredWidthRaw = Number(options?.frame?.width);
        const preferredWidth = Number.isFinite(preferredWidthRaw)
            ? Math.round(preferredWidthRaw)
            : Math.round(layerWidth - horizontalPadding * 2);
        const width = Math.max(240, Math.min(maxWidth, preferredWidth));
        const x = Math.max(0, Math.round((layerWidth - width) / 2));

        const availableHeight = Math.max(180, layerHeight - topPadding - bottomReserve);
        const preferredHeightRaw = Number(options?.frame?.height);
        const preferredHeight = Number.isFinite(preferredHeightRaw)
            ? Math.round(preferredHeightRaw)
            : Math.min(360, Math.round(layerHeight * 0.42));
        const height = Math.max(180, Math.min(availableHeight, preferredHeight));

        const frame = {
            x,
            y: topPadding + (index - 1) * 16,
            width,
            height
        };
        return this.clampRect({ ...frame, ...(options?.frame || {}) });
    }

    getPhoneBottomAvoidancePx() {
        if (this.layoutMode !== 'phone' || typeof document === 'undefined') {
            return 44;
        }
        const layerRect = this.windowLayer?.getBoundingClientRect?.();
        if (!layerRect) {
            return 120;
        }

        const controls = document.getElementById('canvas-mobile-controls');
        const querySelector = typeof document.querySelector === 'function'
            ? document.querySelector.bind(document)
            : null;
        const simToggle = document.getElementById('btn-mobile-sim-toggle')
            || querySelector?.('.mobile-sim-toggle');
        const candidates = [controls, simToggle];

        let reserve = 44;
        candidates.forEach((element) => {
            const rect = element?.getBoundingClientRect?.();
            if (!rect) return;
            if (rect.bottom <= layerRect.top || rect.top >= layerRect.bottom) return;
            const overlapReserve = Math.round(layerRect.bottom - rect.top + 8);
            reserve = Math.max(reserve, overlapReserve);
        });
        return Math.max(44, reserve);
    }

    clampRect(rect = {}) {
        const { width: layerWidth, height: layerHeight } = this.getLayerSize();
        const widthRaw = Number(rect.width);
        const heightRaw = Number(rect.height);
        const width = Math.max(240, Math.min(layerWidth, Math.round(Number.isFinite(widthRaw) ? widthRaw : 420)));
        const bottomReserve = this.layoutMode === 'phone' ? this.getPhoneBottomAvoidancePx() : 44;
        const maxHeight = this.layoutMode === 'phone'
            ? Math.max(180, layerHeight - bottomReserve - 8)
            : layerHeight;
        const height = Math.max(180, Math.min(maxHeight, Math.round(Number.isFinite(heightRaw) ? heightRaw : 300)));
        const xRaw = Number(rect.x);
        const yRaw = Number(rect.y);
        const maxX = Math.max(0, layerWidth - Math.min(width, 120));
        const maxY = this.layoutMode === 'phone'
            ? Math.max(0, layerHeight - bottomReserve - height)
            : Math.max(0, layerHeight - 44);
        const x = Math.min(maxX, Math.max(0, Math.round(Number.isFinite(xRaw) ? xRaw : 48)));
        const y = Math.min(maxY, Math.max(0, Math.round(Number.isFinite(yRaw) ? yRaw : 86)));
        return { x, y, width, height };
    }

    syncControllersWithState(state) {
        if (!this.windowLayer) return;
        const charts = Array.isArray(state?.charts) ? state.charts : [];
        const staleIds = new Set(this.windowControllers.keys());

        charts.forEach((chart) => {
            if (!chart?.id) return;
            this.syncBuffersForChart(chart);
            let controller = this.windowControllers.get(chart.id);
            if (!controller) {
                controller = new ChartWindowController(this, chart);
                controller.mount(this.windowLayer);
                this.windowControllers.set(chart.id, controller);
            } else {
                controller.updateState(chart);
            }
            staleIds.delete(chart.id);
        });

        staleIds.forEach((chartId) => {
            const controller = this.windowControllers.get(chartId);
            controller?.dispose?.();
            this.windowControllers.delete(chartId);
            this.seriesBuffers.delete(chartId);
        });

        const activeChartId = state?.selection?.activeChartId || null;
        this.windowControllers.forEach((controller) => {
            const focused = controller?.state?.id === activeChartId;
            safeClassListToggle(controller?.elements?.root, 'chart-window-active', focused);
        });

        this.windows = Array.from(this.windowControllers.values())
            .sort((a, b) => (a.state?.zIndex || 0) - (b.state?.zIndex || 0));
        this.nextZIndex = charts.reduce((acc, chart) => Math.max(acc, Number(chart?.zIndex) || 0), 0) + 1;
    }

    syncBuffersForChart(chart) {
        if (!chart?.id) return;
        let chartBuffers = this.seriesBuffers.get(chart.id);
        if (!(chartBuffers instanceof Map)) {
            chartBuffers = new Map();
            this.seriesBuffers.set(chart.id, chartBuffers);
        }

        const validSeriesIds = new Set();
        const maxPoints = Math.max(100, Number(chart.maxPoints) || 3000);
        (chart.series || []).forEach((series) => {
            if (!series?.id) return;
            validSeriesIds.add(series.id);
            const current = chartBuffers.get(series.id);
            if (current instanceof RingBuffer2D && current.capacity === maxPoints) {
                return;
            }
            chartBuffers.set(series.id, new RingBuffer2D(maxPoints));
        });

        for (const seriesId of chartBuffers.keys()) {
            if (validSeriesIds.has(seriesId)) continue;
            chartBuffers.delete(seriesId);
        }
    }

    getChartSeriesBuffers(chartId) {
        const existing = this.seriesBuffers.get(chartId);
        if (existing instanceof Map) return existing;
        const map = new Map();
        this.seriesBuffers.set(chartId, map);
        return map;
    }

    getSeriesBuffer(chartId, seriesId, maxPoints = 3000) {
        if (!chartId || !seriesId) return null;
        const chartBuffers = this.getChartSeriesBuffers(chartId);
        const expectedCapacity = Math.max(100, Math.floor(Number(maxPoints) || 3000));
        const current = chartBuffers.get(seriesId);
        if (current instanceof RingBuffer2D && current.capacity === expectedCapacity) {
            return current;
        }
        const next = new RingBuffer2D(expectedCapacity);
        chartBuffers.set(seriesId, next);
        return next;
    }

    addChart(options = {}) {
        const providedOptions = options && typeof options === 'object' ? options : {};
        let addOptions = providedOptions;
        const legendSpecified = Object.prototype.hasOwnProperty.call(providedOptions.ui || {}, 'legendCollapsed');
        if (this.layoutMode === 'phone' && !legendSpecified) {
            addOptions = {
                ...providedOptions,
                ui: {
                    ...(providedOptions.ui || {}),
                    legendCollapsed: true
                }
            };
        }

        const chartId = this.commandService.addChart(addOptions);
        return this.windowControllers.get(chartId) || null;
    }

    addWindow(options = {}) {
        return this.addChart(options);
    }

    addSeriesToChart(chartId, options = {}) {
        const targetChartId = chartId || this.getState()?.selection?.activeChartId;
        if (!targetChartId) return null;

        const hasSourceId = options?.sourceId !== undefined
            && options?.sourceId !== null
            && String(options.sourceId).trim() !== '';
        const sourceId = hasSourceId ? this.resolveSourceId(options.sourceId) : null;
        let quantityId = options.quantityId || null;
        if (sourceId && !quantityId) {
            quantityId = getQuantitiesForSource(sourceId, this.circuit)[0]?.id || null;
        }

        return this.commandService.addSeries(targetChartId, {
            sourceId,
            quantityId,
            xMode: options.xMode,
            scatterXBinding: options.scatterXBinding,
            transformId: options.transformId,
            name: options.name,
            color: options.color
        });
    }

    addSeriesForSource(sourceId, options = {}) {
        const resolvedSourceId = this.resolveSourceId(sourceId);
        const quantities = getQuantitiesForSource(resolvedSourceId, this.circuit);
        const quantityId = options.quantityId || quantities[0]?.id || null;

        let targetChartId = options.chartId || this.getState()?.selection?.activeChartId;
        if (!targetChartId || !this.windowControllers.has(targetChartId)) {
            const chart = this.addChart();
            targetChartId = chart?.state?.id || null;
        }
        if (!targetChartId) return null;

        const seriesId = this.commandService.addSeries(targetChartId, {
            sourceId: resolvedSourceId,
            quantityId,
            xMode: options.xMode,
            scatterXBinding: options.scatterXBinding,
            transformId: options.transformId,
            name: options.name,
            color: options.color
        });
        this.commandService.focusChart(targetChartId);
        return seriesId;
    }

    addPlotForSource(sourceId, options = {}) {
        return this.addSeriesForSource(sourceId, options);
    }

    removeWindow(windowId) {
        this.commandService.removeChart(windowId);
    }

    focusWindow(targetWindow) {
        const chartId = targetWindow?.state?.id;
        if (!chartId) return;
        this.commandService.focusChart(chartId);
    }

    applyWindowRects() {
        this.commandService.update('clamp-chart-frames', (draft) => {
            draft.charts.forEach((chart) => {
                chart.frame = this.clampRect(chart.frame);
            });
            return draft;
        });
    }

    refreshComponentOptions() {
        this.windowControllers.forEach((controller) => controller.refreshSourceOptions());
    }

    refreshDialGauges() {
        // 预留兼容接口：当前图表工作区不显示独立表盘。
    }

    clearAllPlots() {
        this.windowControllers.forEach((controller) => controller.clearData());
        this._lastSampleTime = Number.NEGATIVE_INFINITY;
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
        this.windowControllers.forEach((controller) => controller.render());
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

        const sampleIntervalMs = normalizeSampleIntervalMs(
            this.getState()?.sampleIntervalMs,
            DEFAULT_SAMPLE_INTERVAL_MS
        );

        const shouldSample = shouldSampleAtTime(currentTime, this._lastSampleTime, sampleIntervalMs);
        if (shouldSample) {
            const charts = this.getState()?.charts || [];
            this.samplingService.sampleCharts({
                circuit: this.circuit,
                charts,
                getSeriesBuffer: (chartId, seriesId, maxPoints) => this.getSeriesBuffer(chartId, seriesId, maxPoints)
            });
            this.windowControllers.forEach((controller) => controller.markDirty());
            this._lastSampleTime = currentTime;
        }

        this.requestRender();
    }

    toJSON() {
        return serializeChartWorkspaceState(this.getState());
    }

    fromJSON(rawState = {}) {
        const normalized = normalizeChartWorkspaceState(rawState);
        this._suppressPersist = true;
        this.commandService.replaceDocument(normalized);
        this._suppressPersist = false;
        this.requestRender();
    }
}
