import { buildRuntimeDiagnostics } from '../../core/simulation/RuntimeDiagnostics.js';

export class CircuitDiagnosticsAdapter {
    build(payload = {}) {
        return buildRuntimeDiagnostics(payload);
    }

    attach(target, payload = {}) {
        const diagnostics = payload?.diagnostics || this.build(payload);
        if (target && typeof target === 'object') {
            target.runtimeDiagnostics = diagnostics;
        }
        return diagnostics;
    }
}
