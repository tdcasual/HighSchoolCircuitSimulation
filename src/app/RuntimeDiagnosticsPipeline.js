import { buildRuntimeDiagnostics } from '../core/simulation/RuntimeDiagnostics.js';

function isObject(value) {
    return !!value && typeof value === 'object';
}

export function resolveRuntimeDiagnosticsForUpdate({ results = null, circuit = null } = {}) {
    const target = isObject(results) ? results : null;
    const existing = target?.runtimeDiagnostics;
    if (isObject(existing)) {
        return existing;
    }

    let diagnostics = null;
    if (target && typeof circuit?.collectRuntimeDiagnostics === 'function') {
        diagnostics = circuit.collectRuntimeDiagnostics(target, circuit?.simTime);
    } else {
        diagnostics = buildRuntimeDiagnostics({
            results: target || results,
            solverShortCircuitDetected: !!circuit?.solver?.shortCircuitDetected,
            shortedSourceIds: circuit?.shortedSourceIds || null,
            shortedWireIds: circuit?.shortedWireIds || null
        });
    }

    const normalized = isObject(diagnostics) ? diagnostics : buildRuntimeDiagnostics();
    if (target) {
        target.runtimeDiagnostics = normalized;
    }
    return normalized;
}
