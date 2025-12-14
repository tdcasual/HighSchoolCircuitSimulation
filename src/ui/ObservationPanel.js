/**
 * ObservationPanel.js - 右侧“观察”面板
 * 支持配置 X/Y 观察量，并以 Canvas 绘制函数/参数曲线。
 */

import { createElement, clearElement } from '../utils/SafeDOM.js';
import { applyTransform, computeNiceTicks, computeRangeFromBuffer, formatNumberCompact, RingBuffer2D, TransformIds, TransformOptions } from './observation/ObservationMath.js';
import { evaluateSourceQuantity, getQuantitiesForSource, getSourceOptions, QuantityIds, TIME_SOURCE_ID } from './observation/ObservationSources.js';

function setSelectOptions(selectEl, options, selectedId) {
    if (!selectEl) return;
    clearElement(selectEl);
    options.forEach((opt) => {
        const optionEl = createElement('option', { textContent: opt.label, attrs: { value: opt.id } });
        selectEl.appendChild(optionEl);
    });
    if (selectedId != null) {
        selectEl.value = selectedId;
    }
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
        this.nextPlotIndex = 1;
        this._renderRaf = 0;
        this._lastSimTime = 0;

        if (!this.root) return;

        this.initializeUI();
        this.bindTabRefresh();

        window.addEventListener('resize', () => {
            for (const plot of this.plots) {
                plot._needsRedraw = true;
            }
            this.requestRender({ onlyIfActive: true });
        });
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
            className: 'control-btn stop',
            textContent: '清空全部',
            attrs: { type: 'button' }
        });
        actions.appendChild(addBtn);
        actions.appendChild(clearBtn);
        header.appendChild(actions);

        this.root.appendChild(header);

        this.root.appendChild(createElement('p', {
            className: 'hint',
            textContent: '运行模拟后将持续采样并绘制：y(x) 为参数曲线；也可将 X 设为时间 t 绘制波形。'
        }));

        this.plotListEl = createElement('div', { className: 'observation-plot-list' });
        this.root.appendChild(this.plotListEl);

        addBtn.addEventListener('click', () => this.addPlot());
        clearBtn.addEventListener('click', () => this.clearAllPlots());

        // 默认添加一张图，便于上手
        this.addPlot();
    }

    bindTabRefresh() {
        const tabBtn = document.querySelector('.panel-tab-btn[data-panel="observation"]');
        if (!tabBtn) return;
        tabBtn.addEventListener('click', () => {
            this.refreshComponentOptions();
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

    addPlot() {
        const plotId = `plot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const defaultYSource = this.getDefaultComponentId();
        const defaultYQuantity = defaultYSource === TIME_SOURCE_ID ? QuantityIds.Time : QuantityIds.Current;

        const plot = {
            id: plotId,
            name: `图像 ${this.nextPlotIndex++}`,
            maxPoints: 3000,
            buffer: new RingBuffer2D(3000),
            x: {
                sourceId: TIME_SOURCE_ID,
                quantityId: QuantityIds.Time,
                transformId: TransformIds.Identity,
                autoRange: true,
                min: null,
                max: null
            },
            y: {
                sourceId: defaultYSource,
                quantityId: defaultYQuantity,
                transformId: TransformIds.Abs,
                autoRange: true,
                min: null,
                max: null
            },
            elements: {},
            _needsRedraw: true
        };

        const card = this.createPlotCard(plot);
        this.plotListEl.appendChild(card);
        this.plots.push(plot);

        this.refreshComponentOptions();
        this.requestRender({ onlyIfActive: true });
    }

    clearAllPlots() {
        for (const plot of this.plots) {
            plot.buffer.clear();
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

        controls.appendChild(xSourceGroup);
        controls.appendChild(xQuantityGroup);
        controls.appendChild(xTransformGroup);
        controls.appendChild(ySourceGroup);
        controls.appendChild(yQuantityGroup);
        controls.appendChild(yTransformGroup);

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
            xRangeGroup: card.querySelector(`[data-range-for="${plot.id}-x"]`),
            yRangeGroup: card.querySelector(`[data-range-for="${plot.id}-y"]`),
            pointsInput
        };

        titleInput.addEventListener('change', () => {
            plot.name = String(titleInput.value || '').trim() || plot.name;
        });
        removeBtn.addEventListener('click', () => this.removePlot(plot.id));
        clearBtn.addEventListener('click', () => {
            plot.buffer.clear();
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });

        setSelectOptions(plot.elements.xTransformSelect, TransformOptions, plot.x.transformId);
        setSelectOptions(plot.elements.yTransformSelect, TransformOptions, plot.y.transformId);

        plot.elements.xTransformSelect?.addEventListener('change', () => {
            plot.x.transformId = plot.elements.xTransformSelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });
        plot.elements.yTransformSelect?.addEventListener('change', () => {
            plot.y.transformId = plot.elements.yTransformSelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });

        plot.elements.xSourceSelect?.addEventListener('change', () => {
            plot.x.sourceId = plot.elements.xSourceSelect.value;
            this.refreshQuantityOptionsForAxis(plot, 'x');
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });
        plot.elements.ySourceSelect?.addEventListener('change', () => {
            plot.y.sourceId = plot.elements.ySourceSelect.value;
            this.refreshQuantityOptionsForAxis(plot, 'y');
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });
        plot.elements.xQuantitySelect?.addEventListener('change', () => {
            plot.x.quantityId = plot.elements.xQuantitySelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });
        plot.elements.yQuantitySelect?.addEventListener('change', () => {
            plot.y.quantityId = plot.elements.yQuantitySelect.value;
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
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
        });

        minInput.addEventListener('change', () => {
            axis.min = parseOptionalNumber(minInput.value);
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });
        maxInput.addEventListener('change', () => {
            axis.max = parseOptionalNumber(maxInput.value);
            plot._needsRedraw = true;
            this.requestRender({ onlyIfActive: true });
        });

        return group;
    }

    refreshComponentOptions() {
        const options = getSourceOptions(this.circuit);
        for (const plot of this.plots) {
            setSelectOptions(plot.elements.xSourceSelect, options, plot.x.sourceId);
            setSelectOptions(plot.elements.ySourceSelect, options, plot.y.sourceId);
            this.refreshQuantityOptionsForAxis(plot, 'x');
            this.refreshQuantityOptionsForAxis(plot, 'y');
        }
    }

    refreshQuantityOptionsForAxis(plot, axisKey) {
        const axis = axisKey === 'x' ? plot.x : plot.y;
        const select = axisKey === 'x' ? plot.elements.xQuantitySelect : plot.elements.yQuantitySelect;
        const quantities = getQuantitiesForSource(axis.sourceId, this.circuit);
        setSelectOptions(select, quantities, axis.quantityId);

        // 如果当前 quantity 不存在，回退到第一项
        const selectedOk = quantities.some((q) => q.id === axis.quantityId);
        if (!selectedOk && quantities.length > 0) {
            axis.quantityId = quantities[0].id;
            if (select) select.value = axis.quantityId;
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
        }
        this._lastSimTime = t;

        if (!results || !results.valid) {
            return;
        }

        // 采样 & 请求绘制
        const canRenderNow = this.isObservationActive();
        for (const plot of this.plots) {
            this.samplePlot(plot, { updateLatestText: canRenderNow });
        }
        this.requestRender({ onlyIfActive: true });
    }

    samplePlot(plot, options = {}) {
        const xRaw = evaluateSourceQuantity(this.circuit, plot.x.sourceId, plot.x.quantityId);
        const yRaw = evaluateSourceQuantity(this.circuit, plot.y.sourceId, plot.y.quantityId);
        const x = applyTransform(xRaw, plot.x.transformId);
        const y = applyTransform(yRaw, plot.y.transformId);
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
