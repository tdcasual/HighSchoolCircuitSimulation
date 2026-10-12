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

function collectProjectionSources({ netlist, circuitModel }) {
    const netlistComponents = Array.isArray(netlist?.components) ? netlist.components : [];
    if (netlistComponents.length > 0) {
        return netlistComponents.map((entry, index) => {
            const safe = entry && typeof entry === 'object' ? entry : {};
            const hasId = safe.id !== undefined && safe.id !== null
                && (typeof safe.id !== 'string' || safe.id.trim());
            return {
                id: hasId ? String(safe.id) : `Unknown_${index}`,
                type: String(safe.type || 'Unknown'),
                nodes: Array.isArray(safe.nodes) ? safe.nodes : []
            };
        });
    }

    const componentMap = circuitModel?.components instanceof Map ? circuitModel.components : new Map();
    const sources = [];
    for (const [id, component] of componentMap.entries()) {
        const safeComponent = component && typeof component === 'object' ? component : {};
        sources.push({
            id: String(id),
            type: String(safeComponent.type || 'Unknown'),
            nodes: []
        });
    }
    return sources;
}

export function projectResultV2({ netlist, solveResult, circuitModel } = {}) {
    const voltages = Array.isArray(solveResult?.voltages) ? [...solveResult.voltages] : [];
    const currents = resolveCurrentsMap(solveResult?.currents);
    const sources = collectProjectionSources({ netlist, circuitModel });

    const components = [];
    for (const source of sources) {
        const n1 = source.nodes?.[0];
        const n2 = source.nodes?.[1];
        const voltage = readNodeVoltage(voltages, n1) - readNodeVoltage(voltages, n2);
        const hasCurrent = currents.has(source.id);
        const current = hasCurrent ? toFiniteNumber(currents.get(source.id), 0) : 0;
        const power = voltage * current;

        components.push({
            id: source.id,
            type: source.type,
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
