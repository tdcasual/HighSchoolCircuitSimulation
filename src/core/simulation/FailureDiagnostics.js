export const FailureCategories = Object.freeze({
    ShortCircuit: 'SHORT_CIRCUIT',
    FloatingSubcircuit: 'FLOATING_SUBCIRCUIT',
    SingularMatrix: 'SINGULAR_MATRIX',
    ConflictingSources: 'CONFLICTING_SOURCES',
    InvalidParams: 'INVALID_PARAMS'
});

const CategoryPriority = Object.freeze([
    FailureCategories.ConflictingSources,
    FailureCategories.ShortCircuit,
    FailureCategories.SingularMatrix,
    FailureCategories.InvalidParams,
    FailureCategories.FloatingSubcircuit
]);

const FatalCategorySet = new Set([
    FailureCategories.ConflictingSources,
    FailureCategories.ShortCircuit,
    FailureCategories.SingularMatrix,
    FailureCategories.InvalidParams
]);

const SingularReasonSet = new Set([
    'factorization_failed',
    'solve_failed'
]);

function hasFloatingWarning(topologyReport) {
    const warnings = Array.isArray(topologyReport?.warnings)
        ? topologyReport.warnings
        : [];
    return warnings.some((warning) => warning?.code === 'TOPO_FLOATING_SUBCIRCUIT');
}

function hasConflictingSources(topologyReport) {
    return topologyReport?.error?.code === 'TOPO_CONFLICTING_IDEAL_SOURCES';
}

function hasSingularFailure(results) {
    const invalidReason = String(results?.meta?.invalidReason || '').trim();
    return SingularReasonSet.has(invalidReason);
}

function hasInvalidParamsSignal({ invalidParameterIssues = null, results = null } = {}) {
    if (Array.isArray(invalidParameterIssues) && invalidParameterIssues.length > 0) {
        return true;
    }
    const invalidReason = String(results?.meta?.invalidReason || '').trim();
    return invalidReason === 'invalid_params';
}

function hasShortCircuitSignal({ solverShortCircuitDetected = false, shortedSourceIds = null } = {}) {
    if (solverShortCircuitDetected) return true;
    if (shortedSourceIds instanceof Set) return shortedSourceIds.size > 0;
    if (Array.isArray(shortedSourceIds)) return shortedSourceIds.length > 0;
    return false;
}

export function collectFailureCategories(signals = {}) {
    const categories = new Set();
    const topologyReport = signals?.topologyReport;
    const results = signals?.results;

    if (hasConflictingSources(topologyReport)) {
        categories.add(FailureCategories.ConflictingSources);
    }
    if (hasShortCircuitSignal(signals)) {
        categories.add(FailureCategories.ShortCircuit);
    }
    if (hasSingularFailure(results)) {
        categories.add(FailureCategories.SingularMatrix);
    }
    if (hasInvalidParamsSignal(signals)) {
        categories.add(FailureCategories.InvalidParams);
    }
    if (hasFloatingWarning(topologyReport)) {
        categories.add(FailureCategories.FloatingSubcircuit);
    }

    return CategoryPriority.filter((category) => categories.has(category));
}

export function hasFatalFailure(categories) {
    const list = Array.isArray(categories) ? categories : [];
    return list.some((category) => FatalCategorySet.has(category));
}
