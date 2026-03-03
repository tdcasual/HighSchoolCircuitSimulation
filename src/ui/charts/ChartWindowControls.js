import { createElement } from '../../utils/SafeDOM.js';
import { safeAddEventListener, safeInvoke } from '../../utils/RuntimeSafety.js';
import { TransformOptions } from '../observation/ObservationMath.js';
import {
    getQuantitiesForSource,
    getSourceOptions,
    TIME_SOURCE_ID
} from '../observation/ObservationSources.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

export const X_MODE_OPTIONS = Object.freeze([
    { id: 'shared-x', label: '共享X' },
    { id: 'scatter-override', label: '散点X' }
]);

export const RESIZE_DIRECTIONS = Object.freeze(['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se']);

function normalizeIdentifier(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function resolveSourceSelectionId(value) {
    return normalizeIdentifier(value) || TIME_SOURCE_ID;
}

export function setSelectOptions(selectEl, options, selectedId) {
    if (!selectEl) return null;
    while (selectEl.firstChild) {
        selectEl.removeChild(selectEl.firstChild);
    }

    options.forEach((option) => {
        const optionEl = createElement('option', {
            textContent: option.label,
            attrs: { value: option.id }
        });
        selectEl.appendChild(optionEl);
    });

    const hasSelected = selectedId != null && options.some((item) => item.id === selectedId);
    if (hasSelected) {
        selectEl.value = selectedId;
    } else if (options.length > 0) {
        selectEl.value = options[0].id;
    }

    return selectEl.value || null;
}

export function isInteractiveTarget(node) {
    if (!node || typeof node.closest !== 'function') return false;
    return !!node.closest('input,select,button,textarea,label,a');
}

function createScatterBinding(controller, scatterSourceSelect, scatterQuantitySelect) {
    const sourceId = controller.workspace.resolveSourceId(scatterSourceSelect.value || TIME_SOURCE_ID);
    const quantities = getQuantitiesForSource(sourceId, controller.workspace.circuit);
    const rawQuantityId = scatterQuantitySelect.value || 't';
    const quantityId = quantities.some((item) => item.id === rawQuantityId)
        ? rawQuantityId
        : (quantities[0]?.id || 't');

    return {
        sourceId,
        quantityId,
        transformId: 'identity'
    };
}

export function refreshSourceOptions(controller) {
    const sourceOptions = getSourceOptions(controller.workspace.circuit);
    const axisBinding = controller.state.axis?.xBinding || {};
    const xSource = setSelectOptions(
        controller.elements.xSource,
        sourceOptions,
        resolveSourceSelectionId(axisBinding.sourceId)
    );
    const xQuantities = getQuantitiesForSource(xSource || TIME_SOURCE_ID, controller.workspace.circuit);
    setSelectOptions(controller.elements.xQuantity, xQuantities, axisBinding.quantityId || 't');

    for (const series of controller.state.series || []) {
        const itemEls = controller.seriesElements.get(series.id);
        if (!itemEls) continue;

        const sourceId = setSelectOptions(
            itemEls.sourceSelect,
            sourceOptions,
            resolveSourceSelectionId(series.sourceId)
        );
        const yQuantities = getQuantitiesForSource(sourceId || TIME_SOURCE_ID, controller.workspace.circuit);
        setSelectOptions(itemEls.quantitySelect, yQuantities, series.quantityId || yQuantities[0]?.id || null);
        setSelectOptions(itemEls.transformSelect, TransformOptions.map((opt) => ({ id: opt.id, label: opt.label })), series.transformId);
        setSelectOptions(itemEls.xModeSelect, X_MODE_OPTIONS, series.xMode || 'shared-x');

        const scatterBinding = series.scatterXBinding || { sourceId: TIME_SOURCE_ID, quantityId: 't' };
        const scatterSource = setSelectOptions(
            itemEls.scatterSourceSelect,
            sourceOptions,
            resolveSourceSelectionId(scatterBinding.sourceId)
        );
        const scatterQuantities = getQuantitiesForSource(scatterSource || TIME_SOURCE_ID, controller.workspace.circuit);
        setSelectOptions(itemEls.scatterQuantitySelect, scatterQuantities, scatterBinding.quantityId || scatterQuantities[0]?.id || 't');

        const scatterEnabled = (series.xMode || 'shared-x') === 'scatter-override';
        safeInvokeMethod(itemEls.scatterWrap?.classList, 'toggle', 'hidden', !scatterEnabled);
    }
}

export function rebuildSeriesControls(controller) {
    if (!controller.elements.legendBody) return;
    while (controller.elements.legendBody.firstChild) {
        controller.elements.legendBody.removeChild(controller.elements.legendBody.firstChild);
    }
    controller.seriesElements.clear();

    const seriesList = Array.isArray(controller.state.series) ? controller.state.series : [];
    if (seriesList.length <= 0) {
        controller.elements.legendBody.appendChild(createElement('p', {
            className: 'chart-window-empty-series',
            textContent: '暂无系列，点击“+ 系列”添加。'
        }));
        return;
    }

    seriesList.forEach((series) => {
        const row = createElement('div', {
            className: 'chart-series-row',
            attrs: { 'data-series-id': series.id }
        });

        const head = createElement('div', { className: 'chart-series-row-head' });
        const colorSwatch = createElement('span', {
            className: 'chart-series-color',
            style: { backgroundColor: series.color || '#1d4ed8' }
        });
        const visibleToggle = createElement('input', {
            attrs: {
                type: 'checkbox'
            }
        });
        visibleToggle.checked = series.visible !== false;
        const nameInput = createElement('input', {
            className: 'chart-series-name-input',
            attrs: {
                type: 'text',
                value: series.name || '',
                placeholder: '系列名称'
            }
        });
        const removeBtn = createElement('button', {
            className: 'chart-window-btn chart-window-btn-danger chart-series-remove-btn',
            textContent: '删',
            attrs: { type: 'button' }
        });

        head.appendChild(colorSwatch);
        head.appendChild(visibleToggle);
        head.appendChild(nameInput);
        head.appendChild(removeBtn);

        const body = createElement('div', { className: 'chart-series-row-body' });
        const sourceSelect = createElement('select');
        const quantitySelect = createElement('select');
        const transformSelect = createElement('select');
        const xModeSelect = createElement('select');

        body.appendChild(controller.createControlGroup('Y来源', sourceSelect));
        body.appendChild(controller.createControlGroup('Y量', quantitySelect));
        body.appendChild(controller.createControlGroup('变换', transformSelect));
        body.appendChild(controller.createControlGroup('X模式', xModeSelect));

        const scatterWrap = createElement('div', { className: 'chart-series-scatter-wrap hidden' });
        const scatterSourceSelect = createElement('select');
        const scatterQuantitySelect = createElement('select');
        scatterWrap.appendChild(controller.createControlGroup('散点X来源', scatterSourceSelect));
        scatterWrap.appendChild(controller.createControlGroup('散点X量', scatterQuantitySelect));

        row.appendChild(head);
        row.appendChild(body);
        row.appendChild(scatterWrap);
        controller.elements.legendBody.appendChild(row);

        controller.seriesElements.set(series.id, {
            row,
            colorSwatch,
            visibleToggle,
            nameInput,
            sourceSelect,
            quantitySelect,
            transformSelect,
            xModeSelect,
            scatterWrap,
            scatterSourceSelect,
            scatterQuantitySelect,
            removeBtn
        });

        safeAddEventListener(visibleToggle, 'change', () => {
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                visible: !!visibleToggle.checked
            });
        });

        safeAddEventListener(nameInput, 'change', () => {
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                name: nameInput.value
            });
        });

        safeAddEventListener(sourceSelect, 'change', () => {
            const sourceId = controller.workspace.resolveSourceId(sourceSelect.value || TIME_SOURCE_ID);
            const quantities = getQuantitiesForSource(sourceId, controller.workspace.circuit);
            const quantityId = quantities.some((item) => item.id === quantitySelect.value)
                ? quantitySelect.value
                : (quantities[0]?.id || 'I');
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                sourceId,
                quantityId
            });
        });

        safeAddEventListener(quantitySelect, 'change', () => {
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                quantityId: quantitySelect.value
            });
        });

        safeAddEventListener(transformSelect, 'change', () => {
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                transformId: transformSelect.value
            });
        });

        safeAddEventListener(xModeSelect, 'change', () => {
            const xMode = xModeSelect.value === 'scatter-override' ? 'scatter-override' : 'shared-x';
            const patch = { xMode };
            if (xMode === 'scatter-override') {
                patch.scatterXBinding = createScatterBinding(controller, scatterSourceSelect, scatterQuantitySelect);
            }
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, patch);
        });

        safeAddEventListener(scatterSourceSelect, 'change', () => {
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                xMode: 'scatter-override',
                scatterXBinding: createScatterBinding(controller, scatterSourceSelect, scatterQuantitySelect)
            });
        });

        safeAddEventListener(scatterQuantitySelect, 'change', () => {
            controller.workspace.commandService.updateSeries(controller.state.id, series.id, {
                xMode: 'scatter-override',
                scatterXBinding: createScatterBinding(controller, scatterSourceSelect, scatterQuantitySelect)
            });
        });

        safeAddEventListener(removeBtn, 'click', () => {
            controller.workspace.commandService.removeSeries(controller.state.id, series.id);
        });
    });

    refreshSourceOptions(controller);
}
