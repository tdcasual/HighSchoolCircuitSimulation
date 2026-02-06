/**
 * ObservationPanel.js - 右侧“观察”面板
 * 支持配置 X/Y 观察量，并以 Canvas 绘制函数/参数曲线。
 */

import { createElement, clearElement } from '../utils/SafeDOM.js';
import { applyTransform, computeNiceTicks, computeRangeFromBuffer, formatNumberCompact, RingBuffer2D, TransformIds, TransformOptions } from './observation/ObservationMath.js';
import { evaluateSourceQuantity, getQuantitiesForSource, getSourceOptions, QuantityIds, TIME_SOURCE_ID } from './observation/ObservationSources.js';
import { createDefaultPlotState, DEFAULT_SAMPLE_INTERVAL_MS, normalizeObservationState, normalizeSampleIntervalMs, ObservationDisplayModes, shouldSampleAtTime } from './observation/ObservationState.js';

function setSelectOptions(selectEl, options, selectedId) {
    if (!selectEl) return null;
    clearElement(selectEl);
    options.forEach((opt) => {
        const optionEl = createElement('option', { textContent: opt.label, attrs: { value: opt.id } });
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

function createSelectGroup(labelText, selectId, hintText = null) {
    const group = createElement('div', { className: 'form-group' });
    group.appendChild(createElement('label', { textContent: labelText }));
    const select = createElement('select', { id: selectId });
    group.appendChild(select);
    if (hintText) {
        group.appendChild(createElement('p', { className: 'hint', textContent: hintText }));
    }
    return group;
}

function parseOptionalNumber(inputValue) {
    if (inputValue == null) return null;
    const trimmed = String(inputValue).trim();
    if (!trimmed) return null;
    const v = Number(trimmed);
    return Number.isFinite(v) ? v : null;
}

export class ObservationPanel {
    constructor(app) {
        this.app = app;
        this.circuit = app.circuit;
        this.root = document.getElementById('observation-root');
        this.plots = [];
        this.gauges = new Map(); // componentId -> gauge state
        this.nextPlotIndex = 1;
        this.sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS;
        this._renderRaf = 0;
        this._lastSimTime = 0;
        this._lastSampleTime = Number.NEGATIVE_INFINITY;

        if (!this.root) return;

        this.initializeUI();
        this.bindTabRefresh();

        window.addEventListener('resize', () => {
            for (const plot of this.plots) {
                plot._needsRedraw = true;
            }
            for (const gauge of this.gauges.values()) {
                gauge._needsRedraw = true;
            }
            this.requestRender({ onlyIfActive: true });
        });
    }

    schedulePersist(delayMs = 0) {
        this.app.scheduleSave?.(delayMs);
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

    initializeUI() {
        clearElement(this.root);

        const header = createElement('div', { className: 'observation-header' });
        header.appendChild(createElement('h3', { textContent: '观察与函数图像' }));

        const actions = createElement('div', { className: 'observation-actions' });
        const addBtn = createElement('button', {
            className: 'control-btn',
            textContent: '＋ 添加图像',
            attrs: { type: 'button' }
        });
        const clearBtn = createElement('button', {
            className: 'control-btn',
            textContent: '清空数据',
            attrs: { type: 'button' }
        });
        const removeAllBtn = createElement('button', {
            className: 'control-btn stop',
            textContent: '删除全部图像',
            attrs: { type: 'button' }
        });
        actions.appendChild(addBtn);
        actions.appendChild(clearBtn);
        actions.appendChild(removeAllBtn);
        header.appendChild(actions);

        this.root.appendChild(header);

        this.root.appendChild(createElement('p', {
            className: 'hint',
            textContent: '运行模拟后将持续采样并绘制：y(x) 为参数曲线；也可将 X 设为时间 t 绘制波形。'
        }));

        this.runtimeStatusEl = createElement('p', {
            className: 'hint observation-runtime-status',
            textContent: ''
        });
        this.runtimeStatusEl.style.display = 'none';
        this.root.appendChild(this.runtimeStatusEl);

        const sampleGroup = createElement('div', { className: 'form-group' });
        sampleGroup.appendChild(createElement('label', { textContent: '采样间隔 (ms)' }));
        const sampleInput = createElement('input', {
            attrs: {
                type: 'number',
                min: '0',
                max: '5000',
                step: '1',
                value: String(this.sampleIntervalMs)
            }
        });
        sampleGroup.appendChild(sampleInput);
        sampleGroup.appendChild(createElement('p', {
            className: 'hint',
            textContent: '0 表示每个仿真步都采样；建议 20~100ms。'
        }));
        this.root.appendChild(sampleGroup);
        this.sampleIntervalInput = sampleInput;
        sampleInput.addEventListener('change', () => {
            const normalized = normalizeSampleIntervalMs(sampleInput.value, this.sampleIntervalMs);
            this.sampleIntervalMs = normalized;
            sampleInput.value = String(normalized);
            this.schedulePersist(0);
        });

        // 指针表盘区（电流表/电压表自主读数）
        this.gaugeSectionEl = createElement('div', { className: 'observation-gauge-section' });
        this.gaugeSectionEl.appendChild(createElement('h3', { textContent: '指针表盘' }));
        this.gaugeHintEl = createElement('p', {
            className: 'hint',
            textContent: '右键电流表/电压表，开启“自主读数（右侧表盘）”后将在这里显示。'
        });
        this.gaugeSectionEl.appendChild(this.gaugeHintEl);
        this.gaugeListEl = createElement('div', { className: 'observation-gauge-list' });
        this.gaugeSectionEl.appendChild(this.gaugeListEl);
        this.root.appendChild(this.gaugeSectionEl);

        this.plotListEl = createElement('div', { className: 'observation-plot-list' });
        this.root.appendChild(this.plotListEl);

        addBtn.addEventListener('click', () => this.addPlot());
        clearBtn.addEventListener('click', () => this.clearAllPlots());
        removeAllBtn.addEventListener('click', () => this.deleteAllPlots());

        // 默认添加一张图，便于上手
        this.addPlot();

        // 初始化表盘列表
        this.refreshDialGauges();
    }

    bindTabRefresh() {
        const tabBtn = document.querySelector('.panel-tab-btn[data-panel="observation"]');
        if (!tabBtn) return;
        tabBtn.addEventListener('click', () => {
            this.refreshComponentOptions();
            this.refreshDialGauges();
            this.requestRender({ onlyIfActive: false });
        });
    }

    isObservationActive() {
        const page = document.getElementById('panel-observation');
        return !!(page && page.classList.contains('active'));
    }

    getDefaultComponentId() {
        for (const comp of this.circuit.components.values()) {
            return comp.id;
        }
        return TIME_SOURCE_ID;
    }

    addPlot(options = {}) {
        const plotId = `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const defaultConfig = createDefaultPlotState(this.nextPlotIndex, this.getDefaultComponentId());
        const config = options.config
            ? normalizeObservationState(
                { sampleIntervalMs: this.sampleIntervalMs, plots: [options.config] },
                { defaultYSourceId: this.getDefaultComponentId(), defaultPlotCount: 1 }
            ).plots[0]
            : defaultConfig;

        this.nextPlotIndex += 1;

        const plot = {
            id: plotId,
            name: config.name,
            maxPoints: config.maxPoints,
            yDisplayMode: config.yDisplayMode || ObservationDisplayModes.Signed,
            buffer: new RingBuffer2D(config.maxPoints),
            x: {
                sourceId: config.x.sourceId,
                quantityId: config.x.quantityId,
                transformId: config.x.transformId,
                autoRange: config.x.autoRange,
                min: config.x.min,
                max: config.x.max
            },
            y: {
                sourceId: config.y.sourceId,
                quantityId: config.y.quantityId,
                transformId: config.y.transformId,
                autoRange: config.y.autoRange,
                min: config.y.min,
                max: config.y.max
            },
            elements: {},
            _needsRedraw: true
        };

        const card = this.createPlotCard(plot);
        this.plotListEl.appendChild(card);
        this.plots.push(plot);

        if (!options.skipRefresh) {
            this.refreshComponentOptions();
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        }
    }

    clearAllPlots() {
        for (const plot of this.plots) {
            plot.buffer.clear();
            plot._needsRedraw = true;
        }
        this.requestRender({ onlyIfActive: true });
    }

    deleteAllPlots() {
        this.clearPlotCards();
        this.requestRender({ onlyIfActive: true });
        this.schedulePersist(0);
    }

    clearPlotCards() {
        for (const plot of this.plots) {
            plot.elements.card?.remove();
        }
        this.plots = [];
    }

    toJSON() {
        return {
            sampleIntervalMs: normalizeSampleIntervalMs(this.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS),
            plots: this.plots.map((plot) => ({
                name: plot.name,
                maxPoints: plot.maxPoints,
                yDisplayMode: plot.yDisplayMode || ObservationDisplayModes.Signed,
                x: {
                    sourceId: plot.x.sourceId,
                    quantityId: plot.x.quantityId,
                    transformId: plot.x.transformId,
                    autoRange: !!plot.x.autoRange,
                    min: plot.x.autoRange ? null : parseOptionalNumber(plot.x.min),
                    max: plot.x.autoRange ? null : parseOptionalNumber(plot.x.max)
                },
                y: {
                    sourceId: plot.y.sourceId,
                    quantityId: plot.y.quantityId,
                    transformId: plot.y.transformId,
                    autoRange: !!plot.y.autoRange,
                    min: plot.y.autoRange ? null : parseOptionalNumber(plot.y.min),
                    max: plot.y.autoRange ? null : parseOptionalNumber(plot.y.max)
                }
            }))
        };
    }

    fromJSON(rawState) {
        if (!this.root) return;
        const normalized = normalizeObservationState(rawState, {
            defaultYSourceId: this.getDefaultComponentId(),
            defaultPlotCount: 1,
            allowEmptyPlots: true
        });

        this.sampleIntervalMs = normalized.sampleIntervalMs;
        if (this.sampleIntervalInput) {
            this.sampleIntervalInput.value = String(this.sampleIntervalMs);
        }

        this.clearPlotCards();
        this.nextPlotIndex = 1;
        this._lastSampleTime = Number.NEGATIVE_INFINITY;

        for (const plotState of normalized.plots) {
            this.addPlot({ config: plotState, skipRefresh: true });
        }

        this.refreshComponentOptions();
        for (const plot of this.plots) {
            plot._needsRedraw = true;
        }
        this.requestRender({ onlyIfActive: true });
    }

    removePlot(plotId) {
        const idx = this.plots.findIndex((p) => p.id === plotId);
        if (idx < 0) return;
        const plot = this.plots[idx];
        plot.elements.card?.remove();
        this.plots.splice(idx, 1);
        this.requestRender({ onlyIfActive: true });
        this.schedulePersist(0);
    }

    createPlotCard(plot) {
        const card = createElement('div', { className: 'observation-plot-card', attrs: { 'data-plot-id': plot.id } });

        const header = createElement('div', { className: 'plot-card-header' });
        const titleInput = createElement('input', {
            className: 'plot-title-input',
            attrs: { type: 'text', value: plot.name, placeholder: '图像名称' }
        });
        const removeBtn = createElement('button', {
            className: 'plot-remove-btn',
            textContent: '删除',
            attrs: { type: 'button' }
        });
        header.appendChild(titleInput);
        header.appendChild(removeBtn);
        card.appendChild(header);

        const canvasWrap = createElement('div', { className: 'plot-canvas-wrap' });
        const canvas = createElement('canvas', { className: 'plot-canvas' });
        canvasWrap.appendChild(canvas);
        card.appendChild(canvasWrap);

        const infoRow = createElement('div', { className: 'plot-info-row' });
        const latestText = createElement('div', { className: 'plot-latest', textContent: '最新: —' });
        const clearBtn = createElement('button', {
            className: 'plot-clear-btn',
            textContent: '清空',
            attrs: { type: 'button' }
        });
        infoRow.appendChild(latestText);
        infoRow.appendChild(clearBtn);
        card.appendChild(infoRow);

        const controls = createElement('div', { className: 'plot-controls' });

        const xSourceGroup = createSelectGroup('X 轴来源', `obs-${plot.id}-x-source`);
        const xQuantityGroup = createSelectGroup('X 轴量', `obs-${plot.id}-x-quantity`);
        const xTransformGroup = createSelectGroup('X 轴变换', `obs-${plot.id}-x-transform`);

        const ySourceGroup = createSelectGroup('Y 轴来源', `obs-${plot.id}-y-source`);
        const yQuantityGroup = createSelectGroup('Y 轴量', `obs-${plot.id}-y-quantity`);
        const yTransformGroup = createSelectGroup('Y 轴变换', `obs-${plot.id}-y-transform`);
        const yDisplayGroup = createSelectGroup('Y 显示', `obs-${plot.id}-y-display`);

        controls.appendChild(xSourceGroup);
        controls.appendChild(xQuantityGroup);
        controls.appendChild(xTransformGroup);
        controls.appendChild(ySourceGroup);
        controls.appendChild(yQuantityGroup);
        controls.appendChild(yTransformGroup);
        controls.appendChild(yDisplayGroup);

        // 轴范围
        controls.appendChild(this.createRangeControls(plot, 'x', 'X 轴范围'));
        controls.appendChild(this.createRangeControls(plot, 'y', 'Y 轴范围'));

        // 采样长度
        const pointsGroup = createElement('div', { className: 'form-group' });
        pointsGroup.appendChild(createElement('label', { textContent: '历史点数上限' }));
        const pointsInput = createElement('input', {
            attrs: { type: 'number', min: '100', max: '200000', step: '100', value: String(plot.maxPoints) }
        });
        pointsGroup.appendChild(pointsInput);
        pointsGroup.appendChild(createElement('p', { className: 'hint', textContent: '点数越大，历史越长；建议 1000~10000。' }));
        controls.appendChild(pointsGroup);

        card.appendChild(controls);

        plot.elements = {
            card,
            titleInput,
            removeBtn,
            clearBtn,
            latestText,
            canvas,
            xSourceSelect: xSourceGroup.querySelector('select'),
            xQuantitySelect: xQuantityGroup.querySelector('select'),
            xTransformSelect: xTransformGroup.querySelector('select'),
            ySourceSelect: ySourceGroup.querySelector('select'),
            yQuantitySelect: yQuantityGroup.querySelector('select'),
            yTransformSelect: yTransformGroup.querySelector('select'),
            yDisplaySelect: yDisplayGroup.querySelector('select'),
            xRangeGroup: card.querySelector(`[data-range-for="${plot.id}-x"]`),
            yRangeGroup: card.querySelector(`[data-range-for="${plot.id}-y"]`),
            pointsInput
        };

        titleInput.addEventListener('change', () => {
            plot.name = String(titleInput.value || '').trim() || plot.name;
            this.schedulePersist(0);
        });
        removeBtn.addEventListener('click', () => this.removePlot(plot.id));
        clearBtn.addEventListener('click', () => {
            plot.buffer.clear();
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });

        setSelectOptions(plot.elements.xTransformSelect, TransformOptions, plot.x.transformId);
        setSelectOptions(plot.elements.yTransformSelect, TransformOptions, plot.y.transformId);
        setSelectOptions(
            plot.elements.yDisplaySelect,
            [
                { id: ObservationDisplayModes.Signed, label: '带符号（方向）' },
                { id: ObservationDisplayModes.Magnitude, label: '仅幅值（绝对值）' }
            ],
            plot.yDisplayMode
        );

        plot.elements.xTransformSelect?.addEventListener('change', () => {
            plot.x.transformId = plot.elements.xTransformSelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });
        plot.elements.yTransformSelect?.addEventListener('change', () => {
            plot.y.transformId = plot.elements.yTransformSelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });
        plot.elements.yDisplaySelect?.addEventListener('change', () => {
            plot.yDisplayMode = plot.elements.yDisplaySelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });

        plot.elements.xSourceSelect?.addEventListener('change', () => {
            plot.x.sourceId = plot.elements.xSourceSelect.value;
            this.refreshQuantityOptionsForAxis(plot, 'x');
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });
        plot.elements.ySourceSelect?.addEventListener('change', () => {
            plot.y.sourceId = plot.elements.ySourceSelect.value;
            this.refreshQuantityOptionsForAxis(plot, 'y');
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });
        plot.elements.xQuantitySelect?.addEventListener('change', () => {
            plot.x.quantityId = plot.elements.xQuantitySelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });
        plot.elements.yQuantitySelect?.addEventListener('change', () => {
            plot.y.quantityId = plot.elements.yQuantitySelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });

        pointsInput.addEventListener('change', () => {
            const next = Math.floor(Number(pointsInput.value));
            if (!Number.isFinite(next) || next <= 0) {
                pointsInput.value = String(plot.maxPoints);
                return;
            }
            plot.maxPoints = Math.max(100, Math.min(next, 200000));
            pointsInput.value = String(plot.maxPoints);
            const nextBuffer = new RingBuffer2D(plot.maxPoints);
            plot.buffer.forEach((x, y) => nextBuffer.push(x, y));
            plot.buffer = nextBuffer;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });

        // 初始化 canvas size
        this.resizeCanvasToDisplaySize(canvas);

        return card;
    }

    createRangeControls(plot, axisKey, labelText) {
        const axis = axisKey === 'x' ? plot.x : plot.y;
        const group = createElement('div', { className: 'form-group', attrs: { 'data-range-for': `${plot.id}-${axisKey}` } });
        group.appendChild(createElement('label', { textContent: labelText }));

        const toggleRow = createElement('div', { className: 'obs-range-toggle' });
        const autoToggle = createElement('input', { attrs: { type: 'checkbox' } });
        autoToggle.checked = !!axis.autoRange;
        toggleRow.appendChild(autoToggle);
        toggleRow.appendChild(createElement('span', { textContent: '自动范围' }));
        group.appendChild(toggleRow);

        const inputs = createElement('div', { className: 'obs-range-inputs' });
        const minInput = createElement('input', { attrs: { type: 'number', placeholder: 'min' } });
        const maxInput = createElement('input', { attrs: { type: 'number', placeholder: 'max' } });
        inputs.appendChild(minInput);
        inputs.appendChild(maxInput);
        group.appendChild(inputs);

        const syncVisibility = () => {
            inputs.style.display = autoToggle.checked ? 'none' : 'flex';
        };
        syncVisibility();

        autoToggle.addEventListener('change', () => {
            axis.autoRange = !!autoToggle.checked;
            if (axis.autoRange) {
                axis.min = null;
                axis.max = null;
                minInput.value = '';
                maxInput.value = '';
            } else {
                // 切到手动时，用当前数据范围做默认值，便于直接微调
                const range = computeRangeFromBuffer(plot.buffer);
                if (range) {
                    const nextMin = axisKey === 'x' ? range.minX : range.minY;
                    const nextMax = axisKey === 'x' ? range.maxX : range.maxY;
                    axis.min = nextMin;
                    axis.max = nextMax;
                    minInput.value = String(nextMin);
                    maxInput.value = String(nextMax);
                }
            }
            syncVisibility();
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });

        minInput.addEventListener('change', () => {
            axis.min = parseOptionalNumber(minInput.value);
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });
        maxInput.addEventListener('change', () => {
            axis.max = parseOptionalNumber(maxInput.value);
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
            this.schedulePersist(0);
        });

        return group;
    }

    refreshComponentOptions() {
        const options = getSourceOptions(this.circuit);
        for (const plot of this.plots) {
            const resolvedXSource = setSelectOptions(plot.elements.xSourceSelect, options, plot.x.sourceId);
            const resolvedYSource = setSelectOptions(plot.elements.ySourceSelect, options, plot.y.sourceId);
            if (resolvedXSource && resolvedXSource !== plot.x.sourceId) {
                plot.x.sourceId = resolvedXSource;
            }
            if (resolvedYSource && resolvedYSource !== plot.y.sourceId) {
                plot.y.sourceId = resolvedYSource;
            }
            this.refreshQuantityOptionsForAxis(plot, 'x');
            this.refreshQuantityOptionsForAxis(plot, 'y');
        }
    }

    /**
     * 重新构建“自主读数”表盘列表（DOM）
     */
    refreshDialGauges() {
        if (!this.gaugeListEl) return;

        const meterComponents = [];
        for (const comp of this.circuit.components.values()) {
            if ((comp.type === 'Ammeter' || comp.type === 'Voltmeter') && comp.selfReading) {
                meterComponents.push(comp);
            }
        }

        clearElement(this.gaugeListEl);
        this.gauges.clear();

        if (this.gaugeHintEl) {
            this.gaugeHintEl.style.display = meterComponents.length > 0 ? 'none' : 'block';
        }

        meterComponents.forEach((comp) => {
            const card = createElement('div', { className: 'observation-gauge-card', attrs: { 'data-comp-id': comp.id } });

            const header = createElement('div', { className: 'gauge-card-header' });
            const title = createElement('div', {
                className: 'gauge-title',
                textContent: comp.label ? `${comp.label} · ${comp.id}` : comp.id
            });
            const closeBtn = createElement('button', {
                className: 'gauge-close-btn',
                textContent: '关闭',
                attrs: { type: 'button' }
            });
            header.appendChild(title);
            header.appendChild(closeBtn);
            card.appendChild(header);

            const canvasWrap = createElement('div', { className: 'gauge-canvas-wrap' });
            const canvas = createElement('canvas', { className: 'gauge-canvas' });
            canvasWrap.appendChild(canvas);
            card.appendChild(canvasWrap);

            const footer = createElement('div', { className: 'gauge-footer' });
            const meta = createElement('div', { className: 'gauge-meta', textContent: '—' });
            footer.appendChild(meta);
            card.appendChild(footer);

            closeBtn.addEventListener('click', () => {
                comp.selfReading = false;
                this.refreshDialGauges();
                this.app.updateStatus('已关闭自主读数');
                this.schedulePersist(0);
            });

            this.gaugeListEl.appendChild(card);

            const gauge = {
                compId: comp.id,
                type: comp.type,
                canvas,
                meta,
                lastValue: null,
                _needsRedraw: true
            };
            this.gauges.set(comp.id, gauge);
        });

        this.requestRender({ onlyIfActive: true });
    }

    refreshQuantityOptionsForAxis(plot, axisKey) {
        const axis = axisKey === 'x' ? plot.x : plot.y;
        const select = axisKey === 'x' ? plot.elements.xQuantitySelect : plot.elements.yQuantitySelect;
        const quantities = getQuantitiesForSource(axis.sourceId, this.circuit);
        const resolvedQuantityId = setSelectOptions(select, quantities, axis.quantityId);
        if (resolvedQuantityId && resolvedQuantityId !== axis.quantityId) {
            axis.quantityId = resolvedQuantityId;
        }
    }

    resizeCanvasToDisplaySize(canvas) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const displayW = Math.max(1, Math.floor(rect.width));
        const displayH = Math.max(1, Math.floor(rect.height || 180));
        const internalW = Math.floor(displayW * dpr);
        const internalH = Math.floor(displayH * dpr);
        if (canvas.width !== internalW || canvas.height !== internalH) {
            canvas.width = internalW;
            canvas.height = internalH;
        }
    }

    onCircuitUpdate(results) {
        if (!this.root) return;

        // 若时间被重置（重新运行），默认清空曲线，避免混叠
        const t = Number.isFinite(this.circuit.simTime) ? this.circuit.simTime : 0;
        if (t + 1e-9 < this._lastSimTime) {
            this.clearAllPlots();
            this._lastSampleTime = Number.NEGATIVE_INFINITY;
        }
        this._lastSimTime = t;

        if (!results || !results.valid) {
            if (this.circuit?.isRunning) {
                this.setRuntimeStatus('当前解无效，观察数据已暂停更新。请检查电路连接与参数设置。');
            } else {
                this.setRuntimeStatus('');
            }
            return;
        }
        this.setRuntimeStatus('');

        // 采样 & 请求绘制
        const canRenderNow = this.isObservationActive();
        const shouldSample = shouldSampleAtTime(t, this._lastSampleTime, this.sampleIntervalMs);
        if (shouldSample) {
            for (const plot of this.plots) {
                this.samplePlot(plot, { updateLatestText: canRenderNow });
            }
            this._lastSampleTime = t;
        }

        // 表盘读数（只在“观察”页可见时刷新 DOM/Canvas）
        if (canRenderNow && this.gauges.size > 0) {
            for (const [compId, gauge] of this.gauges) {
                const comp = this.circuit.components.get(compId);
                if (!comp) continue;
                const reading = comp.type === 'Ammeter'
                    ? Math.abs(comp.currentValue || 0)
                    : Math.abs(comp.voltageValue || 0);
                const rounded = Math.round(reading * 1e6) / 1e6;
                if (gauge.lastValue === null || Math.abs((gauge.lastValue || 0) - rounded) > 1e-9) {
                    gauge.lastValue = rounded;
                    gauge._needsRedraw = true;
                }
            }
        }
        this.requestRender({ onlyIfActive: true });
    }

    samplePlot(plot, options = {}) {
        const xRaw = evaluateSourceQuantity(this.circuit, plot.x.sourceId, plot.x.quantityId);
        const yRaw = evaluateSourceQuantity(this.circuit, plot.y.sourceId, plot.y.quantityId);
        const x = applyTransform(xRaw, plot.x.transformId);
        let y = applyTransform(yRaw, plot.y.transformId);
        if (plot.yDisplayMode === ObservationDisplayModes.Magnitude && Number.isFinite(y)) {
            y = Math.abs(y);
        }
        if (x == null || y == null) return;
        plot.buffer.push(x, y);
        plot._needsRedraw = true;

        if (options.updateLatestText && plot.elements.latestText) {
            plot.elements.latestText.textContent = `最新: x=${formatNumberCompact(x)}, y=${formatNumberCompact(y)}`;
        }
    }

    requestRender(options = {}) {
        if (options.onlyIfActive && !this.isObservationActive()) return;
        if (this._renderRaf) return;
        this._renderRaf = window.requestAnimationFrame(() => {
            this._renderRaf = 0;
            this.renderAll();
        });
    }

    renderAll() {
        for (const plot of this.plots) {
            if (!plot._needsRedraw) continue;
            this.renderPlot(plot);
            plot._needsRedraw = false;
        }

        for (const gauge of this.gauges.values()) {
            if (!gauge._needsRedraw) continue;
            this.renderGauge(gauge);
            gauge._needsRedraw = false;
        }
    }

    renderGauge(gauge) {
        const comp = this.circuit.components.get(gauge.compId);
        if (!comp || !gauge.canvas) return;

        this.resizeCanvasToDisplaySize(gauge.canvas);
        const ctx = gauge.canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = gauge.canvas.width;
        const h = gauge.canvas.height;

        const unit = comp.type === 'Ammeter' ? 'A' : 'V';
        const range = Number.isFinite(comp.range) && comp.range > 0 ? comp.range : (comp.type === 'Ammeter' ? 3 : 15);
        const reading = comp.type === 'Ammeter'
            ? Math.abs(comp.currentValue || 0)
            : Math.abs(comp.voltageValue || 0);

        // 更新底部文字
        if (gauge.meta) {
            gauge.meta.textContent = `读数: ${formatNumberCompact(reading, 4)} ${unit} / 量程: ${range}${unit}`;
        }

        // 背景
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        // 仿图片风格：圆弧刻度 + 指针
        const cx = w / 2;
        const cy = h * 0.78;
        const radius = Math.min(w * 0.42, h * 0.62);

        const startAngle = Math.PI * 1.12; // 左侧略偏下
        const endAngle = Math.PI * -0.12;  // 右侧略偏下

        // 外弧
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle, false);
        ctx.stroke();

        // 刻度：使用“漂亮刻度”
        const ticks = computeNiceTicks(0, range, 6)
            .filter((t) => t >= 0 - 1e-12 && t <= range + 1e-12);
        if (ticks.length === 0 || ticks[0] !== 0) ticks.unshift(0);
        if (ticks[ticks.length - 1] !== range) ticks.push(range);

        const toAngle = (v) => {
            const k = Math.min(Math.max(v / range, 0), 1);
            return startAngle + (endAngle - startAngle) * k;
        };

        // 小刻度（在相邻大刻度间插 4 个）
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.lineWidth = 1 * dpr;
        for (let i = 0; i < ticks.length - 1; i++) {
            const a0 = toAngle(ticks[i]);
            const a1 = toAngle(ticks[i + 1]);
            const steps = 5;
            for (let s = 1; s < steps; s++) {
                const a = a0 + (a1 - a0) * (s / steps);
                const x1 = cx + Math.cos(a) * (radius - 10 * dpr);
                const y1 = cy + Math.sin(a) * (radius - 10 * dpr);
                const x2 = cx + Math.cos(a) * (radius - 4 * dpr);
                const y2 = cy + Math.sin(a) * (radius - 4 * dpr);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }

        // 大刻度 + 数字
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 2 * dpr;
        ctx.fillStyle = '#0f172a';
        ctx.font = `${12 * dpr}px serif`;
        ticks.forEach((t) => {
            const a = toAngle(t);
            const x1 = cx + Math.cos(a) * (radius - 14 * dpr);
            const y1 = cy + Math.sin(a) * (radius - 14 * dpr);
            const x2 = cx + Math.cos(a) * (radius + 1 * dpr);
            const y2 = cy + Math.sin(a) * (radius + 1 * dpr);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const labelX = cx + Math.cos(a) * (radius - 28 * dpr);
            const labelY = cy + Math.sin(a) * (radius - 28 * dpr);
            const text = t === 0 ? '0' : (Math.abs(t - range) < 1e-9 ? String(range) : String(t));
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, labelX, labelY);
            ctx.restore();
        });

        // 单位
        ctx.fillStyle = '#111827';
        ctx.font = `${14 * dpr}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit, cx, cy + 26 * dpr);

        // 指针
        const norm = Math.min(Math.max(reading / range, 0), 1);
        const angle = startAngle + (endAngle - startAngle) * norm;
        const px = cx + Math.cos(angle) * (radius - 34 * dpr);
        const py = cy + Math.sin(angle) * (radius - 34 * dpr);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();

        // 中心旋钮
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
    }

    renderPlot(plot) {
        const canvas = plot.elements.canvas;
        if (!canvas) return;

        this.resizeCanvasToDisplaySize(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width;
        const h = canvas.height;
        ctx.save();
        ctx.scale(1, 1);

        // 背景
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        // 留边
        const padL = 46 * dpr;
        const padR = 10 * dpr;
        const padT = 10 * dpr;
        const padB = 28 * dpr;
        const innerW = Math.max(1, w - padL - padR);
        const innerH = Math.max(1, h - padT - padB);

        // 获取范围
        const autoRange = computeRangeFromBuffer(plot.buffer);
        let xMin = plot.x.autoRange ? autoRange?.minX : plot.x.min;
        let xMax = plot.x.autoRange ? autoRange?.maxX : plot.x.max;
        let yMin = plot.y.autoRange ? autoRange?.minY : plot.y.min;
        let yMax = plot.y.autoRange ? autoRange?.maxY : plot.y.max;

        if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
            // 无数据时画占位
            ctx.fillStyle = '#667085';
            ctx.font = `${12 * dpr}px sans-serif`;
            ctx.fillText('暂无数据：运行模拟后开始绘制', padL, padT + 20 * dpr);
            ctx.restore();
            return;
        }

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
        if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
        if (yMin > yMax) [yMin, yMax] = [yMax, yMin];

        // 轻微 padding
        const xPad = (xMax - xMin) * 0.03;
        const yPad = (yMax - yMin) * 0.05;
        xMin -= xPad;
        xMax += xPad;
        yMin -= yPad;
        yMax += yPad;

        const xToPx = (x) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
        const yToPx = (y) => padT + (1 - (y - yMin) / (yMax - yMin)) * innerH;

        // 网格/刻度
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
        ctx.lineWidth = 1 * dpr;

        const xTicks = computeNiceTicks(xMin, xMax, 5);
        const yTicks = computeNiceTicks(yMin, yMax, 5);

        xTicks.forEach((tx) => {
            const x = xToPx(tx);
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + innerH);
            ctx.stroke();
        });

        yTicks.forEach((ty) => {
            const y = yToPx(ty);
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + innerW, y);
            ctx.stroke();
        });

        // 轴线
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + innerH);
        ctx.lineTo(padL + innerW, padT + innerH);
        ctx.stroke();

        // 刻度文字
        ctx.fillStyle = '#344054';
        ctx.font = `${11 * dpr}px sans-serif`;
        yTicks.forEach((ty) => {
            const y = yToPx(ty);
            ctx.fillText(formatNumberCompact(ty, 3), 6 * dpr, y + 4 * dpr);
        });
        xTicks.forEach((tx) => {
            const x = xToPx(tx);
            ctx.fillText(formatNumberCompact(tx, 3), x - 10 * dpr, padT + innerH + 18 * dpr);
        });

        // 曲线（按点序连接，必要时抽样）
        const n = plot.buffer.length;
        if (n <= 0) {
            ctx.restore();
            return;
        }

        const maxDrawPoints = Math.max(200, Math.floor(innerW / dpr) * 2);
        const step = n > maxDrawPoints ? Math.ceil(n / maxDrawPoints) : 1;

        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2 * dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < n; i += step) {
            const pt = plot.buffer.getPoint(i);
            if (!pt) continue;
            const px = xToPx(pt.x);
            const py = yToPx(pt.y);
            if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
            if (!started) {
                ctx.moveTo(px, py);
                started = true;
            } else {
                ctx.lineTo(px, py);
            }
        }
        if (started) ctx.stroke();

        ctx.restore();
    }
}
