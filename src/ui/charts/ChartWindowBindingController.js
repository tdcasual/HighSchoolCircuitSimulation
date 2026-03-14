import { safeInvoke, safeSetAttribute } from '../../utils/RuntimeSafety.js';
import {
    getQuantitiesForSource,
    getSourceOptions,
    TIME_SOURCE_ID
} from '../observation/ObservationSources.js';
import {
    refreshSourceOptions as refreshChartWindowSourceOptions,
    rebuildSeriesControls as rebuildChartWindowSeriesControls
} from './ChartWindowControls.js';

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

export class ChartWindowBindingController {
    constructor(controller) {
        this.controller = controller;
    }

    applyLegendState() {
        const controller = this.controller;
        const collapsed = !!controller.state.ui?.legendCollapsed;
        safeInvokeMethod(controller.elements.root?.classList, 'toggle', 'chart-window-legend-collapsed', collapsed);
        safeSetAttribute(controller.elements.legend, 'aria-label', '图表通道列表');
        if (controller.elements.legendToggleBtn) {
            controller.elements.legendToggleBtn.textContent = collapsed ? '展开通道' : '收起通道';
            safeSetAttribute(controller.elements.legendToggleBtn, 'aria-expanded', collapsed ? 'false' : 'true');
            safeSetAttribute(controller.elements.legendToggleBtn, 'aria-label', collapsed ? '展开通道列表' : '收起通道列表');
        }

        const axisCollapsed = !!controller.state.ui?.axisCollapsed;
        safeInvokeMethod(controller.elements.root?.classList, 'toggle', 'chart-window-axis-collapsed', axisCollapsed);
        if (controller.elements.axisToggleBtn) {
            controller.elements.axisToggleBtn.textContent = axisCollapsed ? '展开X设置' : '收起X设置';
            safeSetAttribute(controller.elements.axisToggleBtn, 'aria-expanded', axisCollapsed ? 'false' : 'true');
            safeSetAttribute(controller.elements.axisToggleBtn, 'aria-label', axisCollapsed ? '展开X轴设置' : '收起X轴设置');
        }
    }

    onAxisSourceChange() {
        const controller = this.controller;
        const sourceId = controller.workspace.resolveSourceId(controller.elements.xSource?.value || TIME_SOURCE_ID);
        const quantityOptions = getQuantitiesForSource(sourceId, controller.workspace.circuit);
        const quantityId = quantityOptions.some((item) => item.id === controller.elements.xQuantity?.value)
            ? controller.elements.xQuantity.value
            : (quantityOptions[0]?.id || 't');

        controller.workspace.commandService.setChartAxisXBinding(controller.state.id, {
            sourceId,
            quantityId
        });
    }

    onAxisQuantityChange() {
        const controller = this.controller;
        const sourceId = controller.workspace.resolveSourceId(controller.elements.xSource?.value || TIME_SOURCE_ID);
        const quantityId = String(controller.elements.xQuantity?.value || 't');
        controller.workspace.commandService.setChartAxisXBinding(controller.state.id, {
            sourceId,
            quantityId
        });
    }

    refreshSourceOptions() {
        refreshChartWindowSourceOptions(this.controller);
    }

    rebuildSeriesControls() {
        rebuildChartWindowSeriesControls(this.controller);
    }

    resolveBindingMeaning(binding = {}) {
        const controller = this.controller;
        const rawSourceId = binding.sourceId;
        const hasSourceId = rawSourceId !== undefined
            && rawSourceId !== null
            && String(rawSourceId).trim() !== '';
        const sourceId = controller.workspace.resolveSourceId?.(hasSourceId ? rawSourceId : TIME_SOURCE_ID) || TIME_SOURCE_ID;
        const quantityId = String(binding.quantityId || 't');
        const sourceOptions = getSourceOptions(controller.workspace.circuit);
        const source = sourceOptions.find((item) => item.id === sourceId);
        const sourceLabelRaw = source?.label || sourceId;
        const sourceLabel = sourceLabelRaw.split(' · ')[0] || sourceLabelRaw;

        const quantityOptions = getQuantitiesForSource(sourceId, controller.workspace.circuit);
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
        const controller = this.controller;
        const xLabel = this.resolveBindingMeaning(controller.state.axis?.xBinding);
        const visibleSeries = (controller.state.series || []).filter((series) => series.visible !== false);
        const seriesList = visibleSeries.length > 0 ? visibleSeries : (controller.state.series || []);
        if (seriesList.length <= 0) {
            return { xLabel, yLabel: '—' };
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
}
