import {
    DEFAULT_SAMPLE_INTERVAL_MS,
    normalizeObservationState,
    normalizeSampleIntervalMs,
    ObservationDisplayModes
} from './ObservationState.js';
import { normalizeObservationUI } from './ObservationPreferences.js';
import { normalizeTemplateCollection, refreshTemplateControls } from './ObservationTemplateService.js';

function parseOptionalNumber(inputValue) {
    if (inputValue == null) return null;
    const trimmed = String(inputValue).trim();
    if (!trimmed) return null;
    const v = Number(trimmed);
    return Number.isFinite(v) ? v : null;
}

export function serializeObservationState(panel) {
    const data = {
        sampleIntervalMs: normalizeSampleIntervalMs(panel.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS),
        ui: normalizeObservationUI(panel.ui),
        plots: panel.plots.map((plot) => ({
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
    const templates = normalizeTemplateCollection(panel, panel.templates);
    if (templates.length > 0) {
        data.templates = templates;
    }
    return data;
}

export function hydrateObservationState(panel, rawState) {
    if (!panel.root) return;
    const templates = rawState && typeof rawState === 'object'
        ? (rawState.templates ?? rawState.templatePresets ?? [])
        : [];
    const normalized = normalizeObservationState(rawState, {
        defaultYSourceId: panel.getDefaultComponentId(),
        defaultPlotCount: 1,
        allowEmptyPlots: true
    });

    panel.sampleIntervalMs = normalized.sampleIntervalMs;
    panel.ui = normalizeObservationUI(normalized.ui);
    panel.templates = normalizeTemplateCollection(panel, templates);
    if (panel.sampleIntervalInput) {
        panel.sampleIntervalInput.value = String(panel.sampleIntervalMs);
    }

    panel.clearPlotCards();
    panel.nextPlotIndex = 1;
    panel._lastSampleTime = Number.NEGATIVE_INFINITY;

    for (const plotState of normalized.plots) {
        panel.addPlot({ config: plotState, skipRefresh: true });
    }

    panel.refreshComponentOptions();
    panel.updateModeToggleUI();
    if (typeof panel.refreshTemplateControls === 'function') {
        panel.refreshTemplateControls();
    } else {
        refreshTemplateControls(panel);
    }
    panel.applyLayoutModeToAllPlotCards();
    panel.requestRender({ onlyIfActive: true });
}
