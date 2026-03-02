/**
 * ObservationPanel.js - 右侧“观察”面板
 * 支持配置 X/Y 观察量，并以 Canvas 绘制函数/参数曲线。
 */

import { createElement, clearElement } from '../utils/SafeDOM.js';
import { applyTransform, computeNiceTicks, formatNumberCompact, RingBuffer2D, TransformOptions } from './observation/ObservationMath.js';
import { evaluateSourceQuantity, getQuantitiesForSource, getSourceOptions, PROBE_SOURCE_PREFIX, QuantityIds, TIME_SOURCE_ID } from './observation/ObservationSources.js';
import {
    createDefaultPlotState,
    DEFAULT_SAMPLE_INTERVAL_MS,
    normalizeObservationState,
    normalizeSampleIntervalMs,
    ObservationDisplayModes,
    shouldSampleAtTime
} from './observation/ObservationState.js';
import { ObservationUIModes, normalizeObservationUI } from './observation/ObservationPreferences.js';
import {
    applySelectedTemplate as applySelectedTemplateService,
    applyTemplateByName as applyTemplateByNameService,
    buildCurrentTemplate as buildCurrentTemplateService,
    buildTemplateSaveName as buildTemplateSaveNameService,
    deleteSelectedTemplate as deleteSelectedTemplateService,
    deleteTemplateByName as deleteTemplateByNameService,
    getSelectedTemplateName as getSelectedTemplateNameService,
    normalizeTemplateCollection as normalizeTemplateCollectionService,
    refreshTemplateControls as refreshTemplateControlsService,
    saveCurrentAsTemplate as saveCurrentAsTemplateService
} from './observation/ObservationTemplateService.js';
import {
    buildObservationExportFileName as buildObservationExportFileNameService,
    buildObservationExportMetadata as buildObservationExportMetadataService,
    downloadCanvasImage as downloadCanvasImageService,
    exportObservationSnapshot as exportObservationSnapshotService
} from './observation/ObservationExportService.js';
import {
    hydrateObservationState as hydrateObservationStateService,
    serializeObservationState as serializeObservationStateService
} from './observation/ObservationStatePersistenceService.js';
import { ObservationPlotCardController } from './observation/ObservationPlotCardController.js';
import { ObservationChartInteraction } from './observation/ObservationChartInteraction.js';
import { ObservationLayoutController } from './observation/ObservationLayoutController.js';
import { ObservationInteractionController } from './observation/ObservationInteractionController.js';
import { ObservationRenderController } from './observation/ObservationRenderController.js';

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

function safeHasClass(node, className) {
    if (!node || !node.classList || typeof node.classList.contains !== 'function') return false;
    try {
        return node.classList.contains(className);
    } catch (_) {
        return false;
    }
}

function safeInvokeMethod(target, methodName, ...args) {
    const method = target?.[methodName];
    if (typeof method !== 'function') return undefined;
    try {
        return method.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function getLayoutController(panel, methodName = '') {
    const controller = panel?.layoutController;
    if (controller && (!methodName || typeof controller[methodName] === 'function')) {
        return controller;
    }
    return new ObservationLayoutController(panel);
}

function getInteractionController(panel, methodName = '') {
    const controller = panel?.interactionController;
    if (controller && (!methodName || typeof controller[methodName] === 'function')) {
        return controller;
    }
    return new ObservationInteractionController(panel);
}

function getRenderController(panel, methodName = '') {
    const controller = panel?.renderController;
    if (controller && (!methodName || typeof controller[methodName] === 'function')) {
        return controller;
    }
    return new ObservationRenderController(panel);
}

const ObservationPresetMeta = Object.freeze({
    'voltage-time': Object.freeze({ id: 'voltage-time', label: '电压-时间', preferred: 'voltage' }),
    'current-time': Object.freeze({ id: 'current-time', label: '电流-时间', preferred: 'current' }),
    'power-time': Object.freeze({ id: 'power-time', label: '功率-时间', preferred: 'power' })
});

function getObservationPresetMeta(presetId) {
    return ObservationPresetMeta[presetId] || ObservationPresetMeta['voltage-time'];
}

function resolvePresetSourceLabel(context = {}) {
    const sourceLabel = typeof context.sourceLabel === 'string' ? context.sourceLabel.trim() : '';
    if (sourceLabel) return sourceLabel;

    const sourceId = typeof context.sourceId === 'string' ? context.sourceId.trim() : '';
    if (!sourceId) return '';
    if (sourceId === TIME_SOURCE_ID) return '时间';
    if (sourceId.startsWith(PROBE_SOURCE_PREFIX)) {
        return sourceId.slice(PROBE_SOURCE_PREFIX.length);
    }
    return sourceId;
}

export function buildObservationPresetHint(presetId, context = {}) {
    const meta = getObservationPresetMeta(presetId);
    const sourceLabel = resolvePresetSourceLabel(context);
    if (!sourceLabel) {
        return `快速添加${meta.label}图`;
    }
    return `快速添加${meta.label}图（来源：${sourceLabel}）`;
}

export function buildObservationPresetStatusText(presetId, context = {}) {
    const meta = getObservationPresetMeta(presetId);
    const sourceLabel = resolvePresetSourceLabel(context);
    if (!sourceLabel) {
        return `已添加${meta.label}图`;
    }
    return `已添加${meta.label}图（来源：${sourceLabel}）`;
}

export function createObservationPreset(context = {}) {
    const sourceId = typeof context.sourceId === 'string' && context.sourceId
        ? context.sourceId
        : TIME_SOURCE_ID;
    const probeType = String(context.probeType || '').trim();
    const preferred = String(context.preferred || '').trim().toLowerCase();

    let yQuantityId = QuantityIds.Voltage;
    if (probeType === 'WireCurrentProbe') {
        yQuantityId = QuantityIds.Current;
    } else if (probeType === 'NodeVoltageProbe') {
        yQuantityId = QuantityIds.Voltage;
    } else if (sourceId === TIME_SOURCE_ID) {
        yQuantityId = QuantityIds.Time;
    } else if (preferred === 'current') {
        yQuantityId = QuantityIds.Current;
    } else if (preferred === 'power') {
        yQuantityId = QuantityIds.Power;
    } else {
        yQuantityId = QuantityIds.Voltage;
    }

    return {
        x: {
            sourceId: TIME_SOURCE_ID,
            quantityId: QuantityIds.Time
        },
        y: {
            sourceId,
            quantityId: yQuantityId
        }
    };
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
        this.ui = normalizeObservationUI();
        this.templates = [];
        this.templateControls = {};
        this.linkedCursorSnapshot = null;
        this.modeButtons = {};
        this.presetButtons = {};
        this._renderRaf = 0;
        this._lastSimTime = 0;
        this._lastSampleTime = Number.NEGATIVE_INFINITY;
        this._runtimeStatusTimer = null;
        this.layoutController = new ObservationLayoutController(this);
        this.interactionController = new ObservationInteractionController(this);
        this.renderController = new ObservationRenderController(this);

        if (!this.root) return;

        this.initializeUI();
        this.bindTabRefresh();

        safeInvokeMethod(window, 'addEventListener', 'resize', () => {
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
        const exportBtn = createElement('button', {
            className: 'control-btn',
            textContent: '导出图像',
            attrs: { type: 'button', 'data-observation-action': 'export' }
        });
        const removeAllBtn = createElement('button', {
            className: 'control-btn stop',
            textContent: '删除全部图像',
            attrs: { type: 'button' }
        });
        actions.appendChild(addBtn);
        actions.appendChild(clearBtn);
        actions.appendChild(exportBtn);
        actions.appendChild(removeAllBtn);
        header.appendChild(actions);

        this.root.appendChild(header);

        this.root.appendChild(createElement('p', {
            className: 'hint',
            textContent: '运行模拟后将持续采样并绘制：y(x) 为参数曲线；也可将 X 设为时间 t 绘制波形。'
        }));

        const modeBar = createElement('div', { className: 'observation-mode-bar' });
        const basicModeBtn = createElement('button', {
            className: 'control-btn',
            textContent: '基础模式',
            attrs: { type: 'button', 'data-observation-mode': ObservationUIModes.Basic }
        });
        const advancedModeBtn = createElement('button', {
            className: 'control-btn',
            textContent: '高级模式',
            attrs: { type: 'button', 'data-observation-mode': ObservationUIModes.Advanced }
        });
        modeBar.appendChild(basicModeBtn);
        modeBar.appendChild(advancedModeBtn);
        this.modeButtons = {
            [ObservationUIModes.Basic]: basicModeBtn,
            [ObservationUIModes.Advanced]: advancedModeBtn
        };
        safeInvokeMethod(basicModeBtn, 'addEventListener', 'click', () => this.setUIMode(ObservationUIModes.Basic));
        safeInvokeMethod(advancedModeBtn, 'addEventListener', 'click', () => this.setUIMode(ObservationUIModes.Advanced));
        this.updateModeToggleUI();

        const presetBar = createElement('div', { className: 'observation-preset-bar' });
        const presets = [
            { id: 'voltage-time', label: 'U-t' },
            { id: 'current-time', label: 'I-t' },
            { id: 'power-time', label: 'P-t' }
        ];
        this.presetButtons = {};
        presets.forEach((preset) => {
            const presetHint = buildObservationPresetHint(preset.id);
            const btn = createElement('button', {
                className: 'control-btn',
                textContent: preset.label,
                attrs: {
                    type: 'button',
                    'data-observation-preset': preset.id,
                    'aria-label': presetHint,
                    title: presetHint
                }
            });
            safeInvokeMethod(btn, 'addEventListener', 'click', () => this.applyQuickPreset(preset.id));
            this.presetButtons[preset.id] = btn;
            presetBar.appendChild(btn);
        });
        this.updatePresetButtonHints();

        const templateBar = createElement('div', { className: 'observation-template-bar' });
        const templateNameInput = createElement('input', {
            className: 'observation-template-name-input',
            attrs: {
                type: 'text',
                placeholder: '模板名称（留空自动命名）',
                'data-observation-template-name': 'true'
            }
        });
        const saveTemplateBtn = createElement('button', {
            className: 'control-btn',
            textContent: '保存模板',
            attrs: {
                type: 'button',
                'data-observation-template-action': 'save'
            }
        });
        const templateSelect = createElement('select', {
            className: 'observation-template-select',
            attrs: {
                'data-observation-template-select': 'true',
                'aria-label': '观察模板列表'
            }
        });
        const applyTemplateBtn = createElement('button', {
            className: 'control-btn',
            textContent: '应用模板',
            attrs: {
                type: 'button',
                'data-observation-template-action': 'apply'
            }
        });
        const deleteTemplateBtn = createElement('button', {
            className: 'control-btn stop',
            textContent: '删除模板',
            attrs: {
                type: 'button',
                'data-observation-template-action': 'delete'
            }
        });
        templateBar.appendChild(templateNameInput);
        templateBar.appendChild(saveTemplateBtn);
        templateBar.appendChild(templateSelect);
        templateBar.appendChild(applyTemplateBtn);
        templateBar.appendChild(deleteTemplateBtn);
        this.templateControls = {
            nameInput: templateNameInput,
            select: templateSelect,
            saveBtn: saveTemplateBtn,
            applyBtn: applyTemplateBtn,
            deleteBtn: deleteTemplateBtn,
            lastSelectedName: ''
        };
        safeInvokeMethod(templateSelect, 'addEventListener', 'change', () => {
            this.templateControls.lastSelectedName = String(templateSelect.value || '').trim();
        });
        safeInvokeMethod(saveTemplateBtn, 'addEventListener', 'click', () => {
            this.saveCurrentAsTemplate(templateNameInput.value);
        });
        safeInvokeMethod(applyTemplateBtn, 'addEventListener', 'click', () => {
            this.applySelectedTemplate();
        });
        safeInvokeMethod(deleteTemplateBtn, 'addEventListener', 'click', () => {
            this.deleteSelectedTemplate();
        });
        this.refreshTemplateControls();

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
        const stickyControls = createElement('div', { className: 'observation-sticky-controls' });
        stickyControls.appendChild(modeBar);
        stickyControls.appendChild(presetBar);
        stickyControls.appendChild(templateBar);
        stickyControls.appendChild(sampleGroup);
        this.root.appendChild(stickyControls);
        this.sampleIntervalInput = sampleInput;
        safeInvokeMethod(sampleInput, 'addEventListener', 'change', () => {
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

        safeInvokeMethod(addBtn, 'addEventListener', 'click', () => this.addPlot());
        safeInvokeMethod(clearBtn, 'addEventListener', 'click', () => this.clearAllPlots());
        safeInvokeMethod(exportBtn, 'addEventListener', 'click', () => this.exportObservationSnapshot());
        safeInvokeMethod(removeAllBtn, 'addEventListener', 'click', () => this.deleteAllPlots());

        // 默认添加一张图，便于上手
        this.addPlot();

        // 初始化表盘列表
        this.refreshDialGauges();
    }

    bindTabRefresh() {
        return getInteractionController(this, 'bindTabRefresh').bindTabRefresh();
    }

    isObservationActive() {
        const page = document.getElementById('panel-observation');
        return safeHasClass(page, 'active');
    }

    getDefaultComponentId() {
        for (const comp of this.circuit.components.values()) {
            return comp.id;
        }
        return TIME_SOURCE_ID;
    }

    resolveSourceIdForPlot(sourceId) {
        if (typeof sourceId !== 'string' || !sourceId) return TIME_SOURCE_ID;
        if (sourceId === TIME_SOURCE_ID) return TIME_SOURCE_ID;
        if (sourceId.startsWith(PROBE_SOURCE_PREFIX)) return sourceId;
        if (this.circuit?.components?.has?.(sourceId)) return sourceId;

        if (typeof this.circuit?.getObservationProbe === 'function') {
            const probe = this.circuit.getObservationProbe(sourceId);
            if (probe) return `${PROBE_SOURCE_PREFIX}${sourceId}`;
        }

        return TIME_SOURCE_ID;
    }

    addPlotForSource(sourceId, options = {}) {
        const resolvedSourceId = this.resolveSourceIdForPlot(sourceId);
        const fallback = createDefaultPlotState(this.nextPlotIndex, resolvedSourceId);
        const quantities = getQuantitiesForSource(resolvedSourceId, this.circuit);
        const quantityIds = quantities.map((item) => item.id);
        const preferredQuantityId = options.quantityId;
        const selectedQuantityId = quantityIds.includes(preferredQuantityId)
            ? preferredQuantityId
            : (quantityIds[0] || fallback.y.quantityId);

        const config = {
            ...fallback,
            name: typeof options.name === 'string' && options.name.trim()
                ? options.name.trim()
                : fallback.name,
            y: {
                ...fallback.y,
                sourceId: resolvedSourceId,
                quantityId: selectedQuantityId
            }
        };

        this.addPlot({ config });
        return this.plots.length > 0 ? this.plots[this.plots.length - 1] : null;
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
            _needsRedraw: true,
            _latestText: '最新: —',
            _staticLayer: null,
            controlsOverride: null,
            chartInteraction: new ObservationChartInteraction()
        };

        const card = this.createPlotCard(plot);
        this.plotListEl.appendChild(card);
        this.applyMobileModeForPlotCard(plot);
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
            plot._latestText = '最新: —';
            if (plot.elements.latestText) {
                plot.elements.latestText.textContent = plot._latestText;
            }
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
            plot.cardController?.dispose?.();
            plot.elements.card?.remove();
        }
        this.plots = [];
        this.linkedCursorSnapshot = null;
    }

    normalizeTemplateCollection(rawTemplates) {
        return normalizeTemplateCollectionService(this, rawTemplates);
    }

    buildTemplateSaveName(rawName = '') {
        return buildTemplateSaveNameService(this, rawName);
    }

    buildCurrentTemplate(rawName = '') {
        return buildCurrentTemplateService(this, rawName);
    }

    refreshTemplateControls(options = {}) {
        return refreshTemplateControlsService(this, options);
    }

    getSelectedTemplateName() {
        return getSelectedTemplateNameService(this);
    }

    saveCurrentAsTemplate(rawName = '') {
        return saveCurrentAsTemplateService(this, rawName);
    }

    applyTemplateByName(rawName = '') {
        return applyTemplateByNameService(this, rawName);
    }

    applySelectedTemplate() {
        return applySelectedTemplateService(this);
    }

    deleteTemplateByName(rawName = '') {
        return deleteTemplateByNameService(this, rawName);
    }

    deleteSelectedTemplate() {
        return deleteSelectedTemplateService(this);
    }

    resolveQuantityLabel(sourceId, quantityId) {
        const quantities = getQuantitiesForSource(sourceId, this.circuit);
        const matched = quantities.find((item) => item.id === quantityId);
        if (matched?.label) return matched.label;
        const fallback = typeof quantityId === 'string' ? quantityId.trim() : '';
        return fallback || '未知量';
    }

    buildObservationExportMetadata(options = {}) {
        return buildObservationExportMetadataService(this, options);
    }

    buildObservationExportFileName(rawDate = new Date()) {
        return buildObservationExportFileNameService(this, rawDate);
    }

    downloadCanvasImage(canvas, fileName = 'observation_export.png') {
        return downloadCanvasImageService(this, canvas, fileName);
    }

    exportObservationSnapshot(options = {}) {
        return exportObservationSnapshotService(this, options);
    }

    toJSON() {
        return serializeObservationStateService(this);
    }

    fromJSON(rawState) {
        return hydrateObservationStateService(this, rawState);
    }

    setUIMode(mode) {
        const normalizedMode = mode === ObservationUIModes.Advanced
            ? ObservationUIModes.Advanced
            : ObservationUIModes.Basic;
        if (this.ui.mode === normalizedMode) return;
        this.ui = {
            ...this.ui,
            mode: normalizedMode
        };
        this.updateModeToggleUI();
        this.applyLayoutModeToAllPlotCards();
        this.requestRender({ onlyIfActive: true });
        this.schedulePersist(0);
    }

    updateModeToggleUI() {
        return getLayoutController(this, 'updateModeToggleUI').updateModeToggleUI();
    }

    isPhoneLayout() {
        return getLayoutController(this, 'isPhoneLayout').isPhoneLayout();
    }

    applyMobileModeForPlotCard(plot) {
        return getLayoutController(this, 'applyMobileModeForPlotCard').applyMobileModeForPlotCard(plot);
    }

    applyLayoutModeToAllPlotCards() {
        return getLayoutController(this, 'applyLayoutModeToAllPlotCards').applyLayoutModeToAllPlotCards();
    }

    onLayoutModeChanged() {
        return getLayoutController(this, 'onLayoutModeChanged').onLayoutModeChanged();
    }

    resolveSourceLabel(sourceId, probeType = '') {
        const normalizedSourceId = typeof sourceId === 'string' ? sourceId : '';
        if (normalizedSourceId === TIME_SOURCE_ID) return '时间';
        if (normalizedSourceId.startsWith(PROBE_SOURCE_PREFIX)) {
            const probeId = normalizedSourceId.slice(PROBE_SOURCE_PREFIX.length);
            if (probeType === 'WireCurrentProbe') return `${probeId}（支路电流探针）`;
            if (probeType === 'NodeVoltageProbe') return `${probeId}（节点电压探针）`;
            return probeId || normalizedSourceId;
        }
        const comp = this.circuit?.components?.get?.(normalizedSourceId);
        if (!comp) return normalizedSourceId;
        if (comp.label && String(comp.label).trim()) {
            const label = String(comp.label).trim();
            return label === comp.id ? comp.id : `${label} (${comp.id})`;
        }
        return comp.id || normalizedSourceId;
    }

    updatePresetButtonHints() {
        const context = this.resolveQuickPresetContext?.() || {};
        for (const [presetId, button] of Object.entries(this.presetButtons || {})) {
            if (!button || typeof button.setAttribute !== 'function') continue;
            const hint = buildObservationPresetHint(presetId, context);
            safeInvokeMethod(button, 'setAttribute', 'aria-label', hint);
            safeInvokeMethod(button, 'setAttribute', 'title', hint);
        }
    }

    resolveQuickPresetContext() {
        const selectedComponentId = this.app?.interaction?.selectedComponent;
        if (selectedComponentId) {
            return {
                sourceId: selectedComponentId,
                sourceLabel: this.resolveSourceLabel(selectedComponentId)
            };
        }

        const selectedWireId = this.app?.interaction?.selectedWire;
        if (selectedWireId && typeof this.circuit?.getAllObservationProbes === 'function') {
            const probes = this.circuit.getAllObservationProbes() || [];
            const preferredProbe = probes.find((probe) => probe?.wireId === selectedWireId && probe.type === 'WireCurrentProbe');
            const fallbackProbe = probes.find((probe) => probe?.wireId === selectedWireId);
            const matchedProbe = preferredProbe || fallbackProbe;
            if (matchedProbe?.id) {
                return {
                    sourceId: `${PROBE_SOURCE_PREFIX}${matchedProbe.id}`,
                    probeType: matchedProbe.type,
                    sourceLabel: this.resolveSourceLabel(`${PROBE_SOURCE_PREFIX}${matchedProbe.id}`, matchedProbe.type)
                };
            }
        }

        const fallbackId = this.getDefaultComponentId();
        return {
            sourceId: fallbackId,
            sourceLabel: this.resolveSourceLabel(fallbackId)
        };
    }

    showTransientStatus(message = '', durationMs = 1800) {
        if (this._runtimeStatusTimer) {
            clearTimeout(this._runtimeStatusTimer);
            this._runtimeStatusTimer = null;
        }
        this.setRuntimeStatus(message);
        if (!message) return;
        this._runtimeStatusTimer = setTimeout(() => {
            this._runtimeStatusTimer = null;
            this.setRuntimeStatus('');
        }, Math.max(400, Number(durationMs) || 1800));
    }

    applyQuickPreset(presetId) {
        const meta = getObservationPresetMeta(presetId);
        const context = this.resolveQuickPresetContext();
        const preset = createObservationPreset({
            ...context,
            preferred: meta.preferred
        });
        this.addPlotForSource(preset.y.sourceId, { quantityId: preset.y.quantityId });
        this.showTransientStatus(buildObservationPresetStatusText(meta.id, context));
        this.updatePresetButtonHints();
        this.requestRender({ onlyIfActive: true });
        this.schedulePersist(0);
    }

    removePlot(plotId) {
        const idx = this.plots.findIndex((p) => p.id === plotId);
        if (idx < 0) return;
        const plot = this.plots[idx];
        if (this.linkedCursorSnapshot?.sourcePlotId === plot.id) {
            this.linkedCursorSnapshot = null;
        }
        plot.cardController?.dispose?.();
        plot.elements.card?.remove();
        this.plots.splice(idx, 1);
        this.requestRender({ onlyIfActive: true });
        this.schedulePersist(0);
    }

    onPlotCardControlChange(plot, event) {
        if (!plot || !event) return;
        if (event.type === 'plot-source-change') {
            if (event.axis === 'x') {
                plot.x.sourceId = event.value;
                this.refreshQuantityOptionsForAxis(plot, 'x');
            } else {
                plot.y.sourceId = event.value;
                this.refreshQuantityOptionsForAxis(plot, 'y');
            }
        } else if (event.type === 'plot-quantity-change') {
            if (event.axis === 'x') {
                plot.x.quantityId = event.value;
            } else {
                plot.y.quantityId = event.value;
            }
        } else if (event.type === 'plot-transform-change') {
            if (event.axis === 'x') {
                plot.x.transformId = event.value;
            } else {
                plot.y.transformId = event.value;
            }
        } else if (event.type === 'plot-display-change') {
            plot.yDisplayMode = event.value;
        } else {
            return;
        }
        plot._needsRedraw = true;
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
        const collapseBtn = createElement('button', {
            className: 'plot-collapse-btn',
            textContent: '收起设置',
            attrs: { type: 'button', title: '收起参数设置' }
        });
        const removeBtn = createElement('button', {
            className: 'plot-remove-btn',
            textContent: '删除',
            attrs: { type: 'button' }
        });
        header.appendChild(titleInput);
        header.appendChild(collapseBtn);
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
            collapseBtn,
            clearBtn,
            latestText,
            canvas,
            controls,
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
        plot.cardController = new ObservationPlotCardController({
            onChange: (event) => this.onPlotCardControlChange(plot, event)
        });
        plot.cardController.mount({
            xSourceSelect: plot.elements.xSourceSelect,
            ySourceSelect: plot.elements.ySourceSelect,
            xQuantitySelect: plot.elements.xQuantitySelect,
            yQuantitySelect: plot.elements.yQuantitySelect,
            xTransformSelect: plot.elements.xTransformSelect,
            yTransformSelect: plot.elements.yTransformSelect,
            yDisplaySelect: plot.elements.yDisplaySelect
        });

        safeInvokeMethod(titleInput, 'addEventListener', 'change', () => {
            plot.name = String(titleInput.value || '').trim() || plot.name;
            this.schedulePersist(0);
        });
        safeInvokeMethod(collapseBtn, 'addEventListener', 'click', () => {
            const isCollapsed = safeHasClass(plot.elements.card, 'observation-card-collapsed');
            if (isCollapsed) {
                plot.controlsOverride = 'expanded';
            } else {
                plot.controlsOverride = 'collapsed';
            }
            this.applyMobileModeForPlotCard(plot);
            this.schedulePersist(0);
        });
        safeInvokeMethod(removeBtn, 'addEventListener', 'click', () => this.removePlot(plot.id));
        safeInvokeMethod(clearBtn, 'addEventListener', 'click', () => {
            plot.buffer.clear();
            plot._latestText = '最新: —';
            if (plot.elements.latestText) {
                plot.elements.latestText.textContent = plot._latestText;
            }
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

        safeInvokeMethod(pointsInput, 'addEventListener', 'change', () => {
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
        this.bindPlotCanvasInteraction(plot);

        return card;
    }

    bindPlotCanvasInteraction(plot) {
        return getInteractionController(this, 'bindPlotCanvasInteraction').bindPlotCanvasInteraction(plot);
    }

    syncLinkedCursorSnapshot(plot) {
        return getInteractionController(this, 'syncLinkedCursorSnapshot').syncLinkedCursorSnapshot(plot);
    }

    resolveLinkedOverlayPoint(plot, frame, dpr) {
        return getInteractionController(this, 'resolveLinkedOverlayPoint').resolveLinkedOverlayPoint(plot, frame, dpr);
    }

    findNearestPlotSampleByX(plot, targetX) {
        return getInteractionController(this, 'findNearestPlotSampleByX').findNearestPlotSampleByX(plot, targetX);
    }

    createRangeControls(plot, axisKey, labelText) {
        return getInteractionController(this, 'createRangeControls').createRangeControls(plot, axisKey, labelText);
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

            safeInvokeMethod(closeBtn, 'addEventListener', 'click', () => {
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
        return getLayoutController(this, 'resizeCanvasToDisplaySize').resizeCanvasToDisplaySize(canvas);
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
            const valueCache = new Map();
            for (const plot of this.plots) {
                this.samplePlot(plot, {
                    updateLatestText: canRenderNow,
                    valueCache
                });
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
        const xRaw = this.getSampleValue(plot.x.sourceId, plot.x.quantityId, options.valueCache);
        const yRaw = this.getSampleValue(plot.y.sourceId, plot.y.quantityId, options.valueCache);
        const x = applyTransform(xRaw, plot.x.transformId);
        let y = applyTransform(yRaw, plot.y.transformId);
        if (plot.yDisplayMode === ObservationDisplayModes.Magnitude && Number.isFinite(y)) {
            y = Math.abs(y);
        }
        if (x == null || y == null) return;
        plot.buffer.push(x, y);
        plot._needsRedraw = true;

        if (options.updateLatestText && plot.elements.latestText) {
            const nextText = `最新: x=${formatNumberCompact(x)}, y=${formatNumberCompact(y)}`;
            if (plot._latestText !== nextText) {
                plot._latestText = nextText;
                plot.elements.latestText.textContent = nextText;
            }
        }
    }

    getSampleValue(sourceId, quantityId, valueCache = null) {
        if (!(valueCache instanceof Map)) {
            return evaluateSourceQuantity(this.circuit, sourceId, quantityId);
        }
        const cacheKey = `${sourceId || ''}\u0000${quantityId || ''}`;
        if (valueCache.has(cacheKey)) {
            return valueCache.get(cacheKey);
        }
        const value = evaluateSourceQuantity(this.circuit, sourceId, quantityId);
        valueCache.set(cacheKey, value);
        return value;
    }

    requestRender(options = {}) {
        return getRenderController(this, 'requestRender').requestRender(options);
    }

    renderAll() {
        return getRenderController(this, 'renderAll').renderAll();
    }

    createCacheCanvas(width, height) {
        const safeWidth = Math.max(1, Math.floor(width || 0));
        const safeHeight = Math.max(1, Math.floor(height || 0));
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(safeWidth, safeHeight);
        }
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const canvas = document.createElement('canvas');
            canvas.width = safeWidth;
            canvas.height = safeHeight;
            return canvas;
        }
        return null;
    }

    formatFrameNumber(value) {
        if (!Number.isFinite(value)) return 'NaN';
        if (Object.is(value, -0)) return '0';
        return value.toPrecision(10);
    }

    buildGaugeStaticSignature(model) {
        return [
            `${model.w}x${model.h}`,
            this.formatFrameNumber(model.dpr),
            this.formatFrameNumber(model.range),
            model.unit
        ].join('|');
    }

    drawGaugeStaticLayer(ctx, model) {
        const { dpr, w, h, unit, range, cx, cy, radius, startAngle, endAngle } = model;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle, false);
        ctx.stroke();

        const ticks = computeNiceTicks(0, range, 6)
            .filter((tick) => tick >= -1e-12 && tick <= range + 1e-12);
        if (ticks.length === 0 || ticks[0] !== 0) ticks.unshift(0);
        if (ticks[ticks.length - 1] !== range) ticks.push(range);

        const toAngle = (value) => {
            const k = Math.min(Math.max(value / range, 0), 1);
            return startAngle + (endAngle - startAngle) * k;
        };

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.lineWidth = 1 * dpr;
        for (let i = 0; i < ticks.length - 1; i++) {
            const a0 = toAngle(ticks[i]);
            const a1 = toAngle(ticks[i + 1]);
            const steps = 5;
            for (let s = 1; s < steps; s++) {
                const angle = a0 + (a1 - a0) * (s / steps);
                const x1 = cx + Math.cos(angle) * (radius - 10 * dpr);
                const y1 = cy + Math.sin(angle) * (radius - 10 * dpr);
                const x2 = cx + Math.cos(angle) * (radius - 4 * dpr);
                const y2 = cy + Math.sin(angle) * (radius - 4 * dpr);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 2 * dpr;
        ctx.fillStyle = '#0f172a';
        ctx.font = `${12 * dpr}px serif`;
        ticks.forEach((tick) => {
            const angle = toAngle(tick);
            const x1 = cx + Math.cos(angle) * (radius - 14 * dpr);
            const y1 = cy + Math.sin(angle) * (radius - 14 * dpr);
            const x2 = cx + Math.cos(angle) * (radius + 1 * dpr);
            const y2 = cy + Math.sin(angle) * (radius + 1 * dpr);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const labelX = cx + Math.cos(angle) * (radius - 28 * dpr);
            const labelY = cy + Math.sin(angle) * (radius - 28 * dpr);
            const label = tick === 0 ? '0' : (Math.abs(tick - range) < 1e-9 ? String(range) : String(tick));
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, labelX, labelY);
            ctx.restore();
        });

        ctx.fillStyle = '#111827';
        ctx.font = `${14 * dpr}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit, cx, cy + 26 * dpr);
    }

    ensureGaugeStaticLayer(gauge, model) {
        const signature = this.buildGaugeStaticSignature(model);
        if (gauge._staticLayer?.signature === signature && gauge._staticLayer.canvas) {
            return gauge._staticLayer.canvas;
        }

        const layerCanvas = this.createCacheCanvas(model.w, model.h);
        const layerCtx = layerCanvas?.getContext?.('2d');
        if (!layerCanvas || !layerCtx) {
            gauge._staticLayer = null;
            return null;
        }

        this.drawGaugeStaticLayer(layerCtx, model);
        gauge._staticLayer = { signature, canvas: layerCanvas };
        return layerCanvas;
    }

    buildPlotStaticSignature(frame) {
        const base = [
            `${frame.w}x${frame.h}`,
            this.formatFrameNumber(frame.dpr),
            this.formatFrameNumber(frame.xMin),
            this.formatFrameNumber(frame.xMax),
            this.formatFrameNumber(frame.yMin),
            this.formatFrameNumber(frame.yMax)
        ];
        const xTicks = frame.xTicks.map((value) => this.formatFrameNumber(value)).join(',');
        const yTicks = frame.yTicks.map((value) => this.formatFrameNumber(value)).join(',');
        return `${base.join('|')}|x:${xTicks}|y:${yTicks}`;
    }

    computePlotFrame(plot, canvas, dpr) {
        return getRenderController(this, 'computePlotFrame').computePlotFrame(plot, canvas, dpr);
    }

    drawPlotStaticLayer(ctx, frame) {
        const { dpr, w, h, padL, padT, innerW, innerH, xMin, xMax, yMin, yMax, xTicks, yTicks } = frame;
        const xToPx = (x) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
        const yToPx = (y) => padT + (1 - (y - yMin) / (yMax - yMin)) * innerH;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
        ctx.lineWidth = 1 * dpr;
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

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + innerH);
        ctx.lineTo(padL + innerW, padT + innerH);
        ctx.stroke();

        ctx.fillStyle = '#344054';
        ctx.font = `${11 * dpr}px sans-serif`;
        yTicks.forEach((tick) => {
            const y = yToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), 6 * dpr, y + 4 * dpr);
        });
        xTicks.forEach((tick) => {
            const x = xToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), x - 10 * dpr, padT + innerH + 18 * dpr);
        });
    }

    ensurePlotStaticLayer(plot, frame) {
        const signature = this.buildPlotStaticSignature(frame);
        if (plot._staticLayer?.signature === signature && plot._staticLayer.canvas) {
            return plot._staticLayer.canvas;
        }

        const layerCanvas = this.createCacheCanvas(frame.w, frame.h);
        const layerCtx = layerCanvas?.getContext?.('2d');
        if (!layerCanvas || !layerCtx) {
            plot._staticLayer = null;
            return null;
        }

        this.drawPlotStaticLayer(layerCtx, frame);
        plot._staticLayer = { signature, canvas: layerCanvas };
        return layerCanvas;
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

        if (gauge.meta) {
            const metaText = `读数: ${formatNumberCompact(reading, 4)} ${unit} / 量程: ${range}${unit}`;
            if (gauge._metaText !== metaText) {
                gauge._metaText = metaText;
                gauge.meta.textContent = metaText;
            }
        }

        const cx = w / 2;
        const cy = h * 0.78;
        const radius = Math.min(w * 0.42, h * 0.62);
        const startAngle = Math.PI * 1.12; // 左侧略偏下
        const endAngle = Math.PI * -0.12;  // 右侧略偏下

        const staticModel = {
            dpr,
            w,
            h,
            unit,
            range,
            cx,
            cy,
            radius,
            startAngle,
            endAngle
        };
        const staticLayer = this.ensureGaugeStaticLayer(gauge, staticModel);

        if (staticLayer) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(staticLayer, 0, 0);
        } else {
            this.drawGaugeStaticLayer(ctx, staticModel);
        }

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
        const frame = this.computePlotFrame(plot, canvas, dpr);
        if (!frame) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#667085';
            ctx.font = `${12 * dpr}px sans-serif`;
            ctx.fillText('暂无数据：运行模拟后开始绘制', 46 * dpr, 30 * dpr);
            plot._lastFrame = null;
            return;
        }
        plot._lastFrame = frame;

        const staticLayer = this.ensurePlotStaticLayer(plot, frame);
        if (staticLayer) {
            ctx.clearRect(0, 0, frame.w, frame.h);
            ctx.drawImage(staticLayer, 0, 0);
        } else {
            this.drawPlotStaticLayer(ctx, frame);
        }

        const { padL, padT, innerW, innerH, xMin, xMax, yMin, yMax } = frame;
        const xToPx = (x) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
        const yToPx = (y) => padT + (1 - (y - yMin) / (yMax - yMin)) * innerH;

        // 曲线（按点序连接，必要时抽样）
        const n = plot.buffer.length;
        if (n <= 0) {
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
        plot.buffer.forEachSampled(step, (x, y) => {
            const px = xToPx(x);
            const py = yToPx(y);
            if (!Number.isFinite(px) || !Number.isFinite(py)) return;
            if (!started) {
                ctx.moveTo(px, py);
                started = true;
            } else {
                ctx.lineTo(px, py);
            }
        });
        if (started) ctx.stroke();

        this.renderPlotInteractionOverlay(plot, ctx, frame, dpr);
    }

    renderPlotInteractionOverlay(plot, ctx, frame, dpr) {
        const overlay = this.resolveLinkedOverlayPoint(plot, frame, dpr);
        if (!overlay) return;
        const x = overlay.x;
        const y = overlay.y;
        const frozen = !!overlay.frozen;
        const linked = !!overlay.linked;
        const overlayColor = frozen
            ? 'rgba(185, 28, 28, 0.92)'
            : linked
                ? 'rgba(2, 132, 199, 0.9)'
                : 'rgba(29, 78, 216, 0.9)';
        const overlayChipColor = frozen
            ? 'rgba(127, 29, 29, 0.92)'
            : linked
                ? 'rgba(3, 105, 161, 0.9)'
                : 'rgba(30, 64, 175, 0.9)';
        const chipText = frozen
            ? (linked ? '联动冻结' : '已冻结')
            : (linked ? '联动游标' : '游标');

        ctx.save();
        ctx.strokeStyle = overlayColor;
        ctx.lineWidth = frozen ? 2 * dpr : 1.5 * dpr;
        ctx.setLineDash(frozen ? [] : [4 * dpr, 3 * dpr]);
        ctx.beginPath();
        ctx.moveTo(x, frame.padT);
        ctx.lineTo(x, frame.padT + frame.innerH);
        ctx.moveTo(frame.padL, y);
        ctx.lineTo(frame.padL + frame.innerW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = overlayColor;
        ctx.beginPath();
        ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        const labelX = Number.isFinite(overlay.xValue)
            ? overlay.xValue
            : frame.xMin + ((x - frame.padL) / Math.max(frame.innerW, 1e-9)) * (frame.xMax - frame.xMin);
        const labelY = Number.isFinite(overlay.yValue)
            ? overlay.yValue
            : frame.yMax - ((y - frame.padT) / Math.max(frame.innerH, 1e-9)) * (frame.yMax - frame.yMin);
        const label = `${chipText} x=${formatNumberCompact(labelX, 3)}, y=${formatNumberCompact(labelY, 3)}`;
        ctx.font = `${11 * dpr}px sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const chipPaddingX = 8 * dpr;
        const chipHeight = 18 * dpr;
        const chipWidth = textWidth + chipPaddingX * 2;
        const chipX = Math.min(frame.padL + frame.innerW - chipWidth - 6 * dpr, Math.max(frame.padL + 6 * dpr, x + 10 * dpr));
        const chipY = Math.max(frame.padT + 6 * dpr, y - chipHeight - 8 * dpr);

        ctx.fillStyle = overlayChipColor;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(chipX, chipY, chipWidth, chipHeight, 6 * dpr);
            ctx.fill();
        } else {
            ctx.fillRect(chipX, chipY, chipWidth, chipHeight);
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, chipX + chipPaddingX, chipY + 12 * dpr);
        ctx.restore();
    }
}
