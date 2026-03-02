import { createElement, clearElement } from '../../utils/SafeDOM.js';
import {
    DEFAULT_OBSERVATION_TEMPLATE_NAME,
    normalizeObservationTemplate
} from './ObservationState.js';
import { normalizeObservationUI } from './ObservationPreferences.js';

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

export function normalizeTemplateCollection(panel, rawTemplates) {
    if (!Array.isArray(rawTemplates)) return [];
    const deduped = new Map();
    for (const rawTemplate of rawTemplates) {
        const template = normalizeObservationTemplate(rawTemplate, {
            defaultName: DEFAULT_OBSERVATION_TEMPLATE_NAME,
            defaultYSourceId: panel.getDefaultComponentId(),
            defaultPlotCount: 1,
            allowEmptyPlots: true
        });
        if (!template?.name) continue;
        deduped.set(template.name, template);
        if (deduped.size >= 30) break;
    }
    return Array.from(deduped.values());
}

export function buildTemplateSaveName(panel, rawName = '') {
    const explicitName = typeof rawName === 'string' ? rawName.trim() : '';
    if (explicitName) return explicitName;

    const baseName = DEFAULT_OBSERVATION_TEMPLATE_NAME;
    if (!Array.isArray(panel.templates) || panel.templates.length === 0) {
        return baseName;
    }
    const hasBase = panel.templates.some((item) => item?.name === baseName);
    if (!hasBase) return baseName;

    let suffix = 2;
    let candidate = `${baseName} ${suffix}`;
    while (panel.templates.some((item) => item?.name === candidate)) {
        suffix += 1;
        candidate = `${baseName} ${suffix}`;
    }
    return candidate;
}

export function buildCurrentTemplate(panel, rawName = '') {
    const name = buildTemplateSaveName(panel, rawName);
    const state = panel.toJSON();
    return normalizeObservationTemplate({
        name,
        plots: state?.plots || [],
        ui: state?.ui || normalizeObservationUI()
    }, {
        defaultName: name,
        defaultYSourceId: panel.getDefaultComponentId(),
        defaultPlotCount: 1,
        allowEmptyPlots: true
    });
}

export function refreshTemplateControls(panel, options = {}) {
    const controls = panel.templateControls || {};
    const selectEl = controls.select;
    if (!selectEl) return;

    const preferredName = typeof options.preferredName === 'string'
        ? options.preferredName.trim()
        : '';
    const fallbackName = preferredName || controls.lastSelectedName || String(selectEl.value || '').trim();
    const templateOptions = Array.isArray(panel.templates)
        ? panel.templates.map((template) => ({ id: template.name, label: template.name }))
        : [];
    const resolved = setSelectOptions(selectEl, templateOptions, fallbackName);
    const hasTemplates = templateOptions.length > 0;

    if (!hasTemplates) {
        selectEl.appendChild(createElement('option', {
            textContent: '暂无模板',
            attrs: { value: '' }
        }));
        selectEl.value = '';
    }

    controls.lastSelectedName = hasTemplates ? (resolved || templateOptions[0]?.id || '') : '';
    if (controls.applyBtn) controls.applyBtn.disabled = !hasTemplates;
    if (controls.deleteBtn) controls.deleteBtn.disabled = !hasTemplates;
}

export function getSelectedTemplateName(panel) {
    const selectEl = panel.templateControls?.select;
    const selectedName = typeof selectEl?.value === 'string' ? selectEl.value.trim() : '';
    if (selectedName) return selectedName;
    if (Array.isArray(panel.templates) && panel.templates.length > 0) {
        return panel.templates[0].name;
    }
    return '';
}

export function saveCurrentAsTemplate(panel, rawName = '') {
    const template = buildCurrentTemplate(panel, rawName);
    if (!template) return null;

    panel.templates = Array.isArray(panel.templates) ? panel.templates : [];
    const existingIndex = panel.templates.findIndex((item) => item?.name === template.name);
    const isUpdate = existingIndex >= 0;
    if (isUpdate) {
        panel.templates[existingIndex] = template;
    } else {
        panel.templates.push(template);
    }

    panel.templates = normalizeTemplateCollection(panel, panel.templates);

    if (typeof panel.refreshTemplateControls === 'function') {
        panel.refreshTemplateControls({ preferredName: template.name });
    } else {
        refreshTemplateControls(panel, { preferredName: template.name });
    }

    if (panel.templateControls?.nameInput) {
        panel.templateControls.nameInput.value = '';
    }

    panel.showTransientStatus?.(isUpdate ? `已更新模板：${template.name}` : `已保存模板：${template.name}`);
    panel.schedulePersist?.(0);
    return template;
}

export function applyTemplateByName(panel, rawName = '') {
    const templateName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!templateName || !Array.isArray(panel.templates) || panel.templates.length === 0) {
        return false;
    }
    const matched = panel.templates.find((item) => item?.name === templateName);
    if (!matched) return false;

    const template = normalizeObservationTemplate(matched, {
        defaultName: templateName,
        defaultYSourceId: panel.getDefaultComponentId(),
        defaultPlotCount: 1,
        allowEmptyPlots: true
    });

    panel.fromJSON?.({
        sampleIntervalMs: panel.sampleIntervalMs,
        plots: template.plots,
        ui: template.ui,
        templates: panel.templates
    });
    panel.showTransientStatus?.(`已应用模板：${template.name}`);
    panel.schedulePersist?.(0);
    return true;
}

export function applySelectedTemplate(panel) {
    const selectedName = getSelectedTemplateName(panel);
    if (!selectedName) return false;
    return applyTemplateByName(panel, selectedName);
}

export function deleteTemplateByName(panel, rawName = '') {
    const templateName = typeof rawName === 'string' ? rawName.trim() : '';
    if (!templateName || !Array.isArray(panel.templates) || panel.templates.length === 0) {
        return false;
    }
    const index = panel.templates.findIndex((item) => item?.name === templateName);
    if (index < 0) return false;

    const [removed] = panel.templates.splice(index, 1);
    const nextName = panel.templates[index]?.name || panel.templates[index - 1]?.name || '';
    if (typeof panel.refreshTemplateControls === 'function') {
        panel.refreshTemplateControls({ preferredName: nextName });
    } else {
        refreshTemplateControls(panel, { preferredName: nextName });
    }
    panel.showTransientStatus?.(`已删除模板：${removed?.name || templateName}`);
    panel.schedulePersist?.(0);
    return true;
}

export function deleteSelectedTemplate(panel) {
    const selectedName = getSelectedTemplateName(panel);
    if (!selectedName) return false;
    return deleteTemplateByName(panel, selectedName);
}
