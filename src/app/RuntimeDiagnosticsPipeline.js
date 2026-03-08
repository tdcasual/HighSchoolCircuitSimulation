import { buildRuntimeDiagnostics } from '../core/simulation/RuntimeDiagnostics.js';

function isObject(value) {
    return !!value && typeof value === 'object';
}

function getCircuitRuntimeReadSnapshot(circuit = null) {
    if (typeof circuit?.getRuntimeReadSnapshot !== 'function') return null;
    try {
        const snapshot = circuit.getRuntimeReadSnapshot();
        return isObject(snapshot) ? snapshot : null;
    } catch (_) {
        return null;
    }
}

function getExpectedRuntimeDiagnosticsFreshness(circuit = null, results = null) {
    const target = isObject(results) ? results : null;
    const runtimeSnapshot = getCircuitRuntimeReadSnapshot(circuit);
    const topologyVersion = Number.isFinite(target?.topologyVersion)
        ? Number(target.topologyVersion)
        : (Number.isFinite(runtimeSnapshot?.topologyVersion)
            ? Number(runtimeSnapshot.topologyVersion)
            : (Number.isFinite(circuit?.topologyVersion) ? Number(circuit.topologyVersion) : null));
    const simulationVersion = Number.isFinite(target?.simulationVersion)
        ? Number(target.simulationVersion)
        : (Number.isFinite(runtimeSnapshot?.simulationVersion)
            ? Number(runtimeSnapshot.simulationVersion)
            : (Number.isFinite(circuit?.simulationStepId) ? Number(circuit.simulationStepId) : null));

    return {
        topologyVersion,
        simulationVersion,
        runtimeSnapshot
    };
}

function isRuntimeDiagnosticsFresh(existing, freshness) {
    if (!isObject(existing)) return false;
    if (Number.isFinite(freshness.topologyVersion) && existing.topologyVersion !== freshness.topologyVersion) {
        return false;
    }
    if (Number.isFinite(freshness.simulationVersion) && existing.simulationVersion !== freshness.simulationVersion) {
        return false;
    }
    return true;
}

export function resolveRuntimeDiagnosticsForUpdate({ results = null, circuit = null } = {}) {
    const target = isObject(results) ? results : null;
    const existing = target?.runtimeDiagnostics;
    const freshness = getExpectedRuntimeDiagnosticsFreshness(circuit, target);
    const runtimeSnapshot = freshness.runtimeSnapshot;
    if (isRuntimeDiagnosticsFresh(existing, freshness)) {
        return existing;
    }

    let diagnostics = null;
    if (target && typeof circuit?.collectRuntimeDiagnostics === 'function') {
        diagnostics = circuit.collectRuntimeDiagnostics(target, circuit?.simTime);
    } else {
        diagnostics = buildRuntimeDiagnostics({
            results: target || results,
            topologyVersion: freshness.topologyVersion,
            simulationVersion: freshness.simulationVersion,
            solverShortCircuitDetected: !!runtimeSnapshot?.solverShortCircuitDetected || !!circuit?.solver?.shortCircuitDetected,
            shortedSourceIds: runtimeSnapshot?.shortedSourceIds || circuit?.shortedSourceIds || null,
            shortedWireIds: runtimeSnapshot?.shortedWireIds || circuit?.shortedWireIds || null
        });
    }

    const normalized = isObject(diagnostics) ? diagnostics : buildRuntimeDiagnostics();
    if (target) {
        target.runtimeDiagnostics = normalized;
    }
    return normalized;
}
