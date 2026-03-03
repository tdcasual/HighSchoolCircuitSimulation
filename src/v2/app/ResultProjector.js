function readNodeVoltage(voltages, nodeIndex) {
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return 0;
    return Number(voltages[nodeIndex] || 0);
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveCurrentsMap(currents) {
    if (currents instanceof Map) {
        const normalized = new Map();
        for (const [key, value] of currents.entries()) {
            normalized.set(String(key), value);
        }
        return normalized;
    }
    if (currents && typeof currents === 'object') {
        return new Map(Object.entries(currents));
    }
    return new Map();
}

function resolveStatus(solveResult, hasCurrent) {
    if (!solveResult?.valid) {
        const code = String(solveResult?.diagnostics?.code || '');
        if (code.includes('SHORT')) return 'shorted';
        return 'invalid';
    }
    if (!hasCurrent) return 'disconnected';
    return 'ok';
}

export function projectResultV2({ circuitModel, solveResult } = {}) {
    const componentMap = circuitModel?.components instanceof Map ? circuitModel.components : new Map();
    const voltages = Array.isArray(solveResult?.voltages) ? [...solveResult.voltages] : [];
    const currents = resolveCurrentsMap(solveResult?.currents);

    const components = [];
    for (const [id, component] of componentMap.entries()) {
        const safeComponent = component && typeof component === 'object' ? component : {};
        const n1 = safeComponent.nodes?.[0];
        const n2 = safeComponent.nodes?.[1];
        const voltage = readNodeVoltage(voltages, n1) - readNodeVoltage(voltages, n2);
        const hasCurrent = currents.has(id);
        const current = hasCurrent ? toFiniteNumber(currents.get(id), 0) : 0;
        const power = voltage * current;

        components.push({
            id: String(id),
            type: String(safeComponent.type || 'Unknown'),
            status: resolveStatus(solveResult, hasCurrent),
            measurements: {
                voltage,
                current,
                power
            }
        });
    }

    return {
        valid: !!solveResult?.valid,
        diagnostics: {
            code: String(solveResult?.diagnostics?.code || ''),
            warnings: Array.isArray(solveResult?.diagnostics?.warnings)
                ? [...solveResult.diagnostics.warnings]
                : []
        },
        components
    };
}
