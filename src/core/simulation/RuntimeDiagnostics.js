import { collectFailureCategories, FailureCategories, hasFatalFailure } from './FailureDiagnostics.js';

const CategorySummary = Object.freeze({
    [FailureCategories.ConflictingSources]: '检测到并联理想电压源冲突，仿真已停止。',
    [FailureCategories.ShortCircuit]: '检测到电源短路风险，请检查导线连接。',
    [FailureCategories.SingularMatrix]: '电路方程不可解（矩阵奇异），请检查拓扑与元件参数。',
    [FailureCategories.InvalidParams]: '检测到非法参数，已阻止不稳定仿真。',
    [FailureCategories.FloatingSubcircuit]: '检测到悬浮子电路，读数可能依赖参考选择。'
});

const CategoryHints = Object.freeze({
    [FailureCategories.ConflictingSources]: Object.freeze([
        '检查并联理想电压源是否对同一节点对设置了不同电压。',
        '可为其中一个电源添加内阻，避免理想冲突。'
    ]),
    [FailureCategories.ShortCircuit]: Object.freeze([
        '检查电源正负极是否被导线直接短接。',
        '沿红色高亮导线回溯并移除低阻短接路径。'
    ]),
    [FailureCategories.SingularMatrix]: Object.freeze([
        '确认电路至少存在一个参考地并形成闭合回路。',
        '检查是否存在仅由理想源组成且约束冲突的子网络。'
    ]),
    [FailureCategories.InvalidParams]: Object.freeze([
        '检查元件参数是否为空、NaN 或超出合理范围。',
        '恢复默认参数后重新运行仿真。'
    ]),
    [FailureCategories.FloatingSubcircuit]: Object.freeze([
        '为悬浮子电路补充参考地或与主回路建立连接。',
        '若为教学演示，可继续运行但需说明参考依赖。'
    ])
});

function normalizeIdList(ids) {
    if (ids instanceof Set) {
        return Array.from(ids).filter((id) => typeof id === 'string' && id);
    }
    if (Array.isArray(ids)) {
        return ids.filter((id) => typeof id === 'string' && id);
    }
    return [];
}

function collectComponentIds(signals, categories) {
    const componentIds = new Set();

    if (categories.includes(FailureCategories.ConflictingSources)) {
        const sourceIds = signals?.topologyReport?.error?.details?.sourceIds;
        normalizeIdList(sourceIds).forEach((id) => componentIds.add(id));
    }

    if (categories.includes(FailureCategories.FloatingSubcircuit)) {
        const warnings = Array.isArray(signals?.topologyReport?.warnings)
            ? signals.topologyReport.warnings
            : [];
        warnings
            .filter((warning) => warning?.code === 'TOPO_FLOATING_SUBCIRCUIT')
            .forEach((warning) => {
                const groups = Array.isArray(warning?.details?.groups) ? warning.details.groups : [];
                groups.forEach((group) => {
                    normalizeIdList(group?.componentIds).forEach((id) => componentIds.add(id));
                });
            });
    }

    if (categories.includes(FailureCategories.ShortCircuit)) {
        normalizeIdList(signals?.shortedSourceIds).forEach((id) => componentIds.add(id));
    }

    if (categories.includes(FailureCategories.InvalidParams)) {
        const issues = Array.isArray(signals?.invalidParameterIssues)
            ? signals.invalidParameterIssues
            : [];
        issues
            .map((issue) => issue?.componentId)
            .filter((id) => typeof id === 'string' && id)
            .forEach((id) => componentIds.add(id));
    }

    return Array.from(componentIds);
}

function collectWireIds(signals, categories) {
    const wireIds = new Set();
    if (categories.includes(FailureCategories.ShortCircuit)) {
        normalizeIdList(signals?.shortedWireIds).forEach((id) => wireIds.add(id));
    }
    if (categories.includes(FailureCategories.InvalidParams)) {
        const issues = Array.isArray(signals?.invalidParameterIssues)
            ? signals.invalidParameterIssues
            : [];
        issues
            .map((issue) => issue?.wireId)
            .filter((id) => typeof id === 'string' && id)
            .forEach((id) => wireIds.add(id));
    }
    return Array.from(wireIds);
}

function collectHints(categories) {
    const hints = [];
    categories.forEach((category) => {
        const categoryHints = CategoryHints[category] || [];
        categoryHints.forEach((hint) => hints.push(hint));
    });
    return hints;
}

export function buildRuntimeDiagnostics(signals = {}) {
    const categories = collectFailureCategories(signals);
    const primaryCode = categories[0] || '';

    return {
        code: primaryCode,
        categories,
        fatal: hasFatalFailure(categories),
        summary: primaryCode ? (CategorySummary[primaryCode] || '') : '',
        hints: collectHints(categories),
        componentIds: collectComponentIds(signals, categories),
        wireIds: collectWireIds(signals, categories)
    };
}
