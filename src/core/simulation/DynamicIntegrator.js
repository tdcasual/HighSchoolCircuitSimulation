const DynamicIntegrationMethods = Object.freeze({
    Auto: 'auto',
    Trapezoidal: 'trapezoidal',
    BackwardEuler: 'backward-euler'
});

export class DynamicIntegrator {
    resolveDynamicIntegrationMethod(comp, hasConnectedSwitch = false) {
        if (!comp) return DynamicIntegrationMethods.BackwardEuler;
        const methodRaw = typeof comp.integrationMethod === 'string'
            ? comp.integrationMethod.toLowerCase()
            : DynamicIntegrationMethods.Auto;
        const historyReady = !!comp._dynamicHistoryReady;

        if (hasConnectedSwitch) {
            return DynamicIntegrationMethods.BackwardEuler;
        }

        if (methodRaw === DynamicIntegrationMethods.Trapezoidal) {
            if (!historyReady) {
                return DynamicIntegrationMethods.BackwardEuler;
            }
            return DynamicIntegrationMethods.Trapezoidal;
        }
        if (methodRaw === DynamicIntegrationMethods.BackwardEuler) {
            return DynamicIntegrationMethods.BackwardEuler;
        }
        if (!historyReady) {
            return DynamicIntegrationMethods.BackwardEuler;
        }
        return DynamicIntegrationMethods.Trapezoidal;
    }

    updateDynamicComponents(components, voltages, currents = null, dt = 0.001, hasConnectedSwitch = false) {
        const list = Array.isArray(components) ? components : [];
        const nodeVoltages = Array.isArray(voltages) ? voltages : [];
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        for (const comp of list) {
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = nodeVoltages[comp.nodes[0]] || 0;
                const v2 = nodeVoltages[comp.nodes[1]] || 0;
                const v = v1 - v2;
                comp.prevVoltage = v;
                comp.prevCharge = (comp.capacitance || 0) * v;
                const measuredCurrent = currents && typeof currents.get === 'function'
                    ? currents.get(comp.id)
                    : undefined;
                if (Number.isFinite(measuredCurrent)) {
                    comp.prevCurrent = measuredCurrent;
                }
                comp._dynamicHistoryReady = true;
            }

            if (comp.type === 'Motor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = nodeVoltages[comp.nodes[0]] || 0;
                const v2 = nodeVoltages[comp.nodes[1]] || 0;
                const voltage = v1 - v2;
                const current = (voltage - (comp.backEmf || 0)) / comp.resistance;

                const torque = comp.torqueConstant * current;
                const acceleration = (torque - comp.loadTorque) / comp.inertia;
                comp.speed = (comp.speed || 0) + acceleration * dt;
                comp.speed = Math.max(0, comp.speed);

                comp.backEmf = comp.emfConstant * comp.speed;
            }

            if (comp.type === 'Inductor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = nodeVoltages[comp.nodes[0]] || 0;
                const v2 = nodeVoltages[comp.nodes[1]] || 0;
                const dV = v1 - v2;
                const L = Math.max(1e-12, comp.inductance || 0);
                const measuredCurrent = currents && typeof currents.get === 'function'
                    ? currents.get(comp.id)
                    : undefined;
                if (Number.isFinite(measuredCurrent)) {
                    comp.prevCurrent = measuredCurrent;
                } else {
                    const prevCurrent = Number.isFinite(comp.prevCurrent)
                        ? comp.prevCurrent
                        : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0);
                    comp.prevCurrent = prevCurrent + (dt / L) * dV;
                }
                comp.prevVoltage = dV;
                comp._dynamicHistoryReady = true;
            }
        }

        // Keep signature parity for callers even though no direct return value is needed.
        return {
            hasConnectedSwitch,
            method: DynamicIntegrationMethods
        };
    }
}

export { DynamicIntegrationMethods };
