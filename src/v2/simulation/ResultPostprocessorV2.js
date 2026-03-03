function readNodeVoltage(voltages, nodeIndex) {
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return 0;
    return Number(voltages[nodeIndex] || 0);
}

function resolveResistance(value, fallback = Infinity) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class ResultPostprocessorV2 {
    static computeCurrents(components = [], voltages = [], voltageSourceCurrentsById = new Map()) {
        const currents = new Map();

        for (const component of components) {
            const id = String(component?.id || '');
            if (!id) continue;

            const n1 = component?.nodes?.[0];
            const n2 = component?.nodes?.[1];
            const v1 = readNodeVoltage(voltages, n1);
            const v2 = readNodeVoltage(voltages, n2);
            const deltaV = v1 - v2;

            if (component.type === 'PowerSource' || component.type === 'ACVoltageSource') {
                const internalResistance = Number(component.internalResistance);
                const sourceVoltage = Number.isFinite(Number(component.voltage)) ? Number(component.voltage) : 0;
                if (Number.isFinite(internalResistance) && internalResistance > 1e-9) {
                    currents.set(id, (deltaV - sourceVoltage) / internalResistance);
                } else {
                    currents.set(id, Number(voltageSourceCurrentsById.get(id) || 0));
                }
                continue;
            }

            const explicitResistance = resolveResistance(component.resistance, NaN);
            if (Number.isFinite(explicitResistance)) {
                currents.set(id, deltaV / explicitResistance);
                continue;
            }

            currents.set(id, 0);
        }

        return currents;
    }
}
