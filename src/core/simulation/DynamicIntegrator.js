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

    updateDynamicComponents(components, voltages, currents = null, dt = 0.001, hasConnectedSwitch = false, simulationState = null) {
        const list = Array.isArray(components) ? components : [];
        const nodeVoltages = Array.isArray(voltages) ? voltages : [];
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        for (const comp of list) {
            const entry = simulationState && comp?.id ? simulationState.ensure(comp.id) : null;
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = nodeVoltages[comp.nodes[0]] || 0;
                const v2 = nodeVoltages[comp.nodes[1]] || 0;
                const v = v1 - v2;
                if (entry) {
                    entry.prevVoltage = v;
                    entry.prevCharge = (comp.capacitance || 0) * v;
                }
                const measuredCurrent = currents && typeof currents.get === 'function'
                    ? currents.get(comp.id)
                    : undefined;
                if (entry && Number.isFinite(measuredCurrent)) {
                    entry.prevCurrent = measuredCurrent;
                }
                if (entry) {
                    entry._dynamicHistoryReady = true;
                }

                comp.prevVoltage = entry?.prevVoltage ?? v;
                comp.prevCharge = entry?.prevCharge ?? ((comp.capacitance || 0) * v);
                if (Number.isFinite(entry?.prevCurrent)) {
                    comp.prevCurrent = entry.prevCurrent;
                } else if (Number.isFinite(measuredCurrent)) {
                    comp.prevCurrent = measuredCurrent;
                }
                comp._dynamicHistoryReady = entry?._dynamicHistoryReady ?? true;
            }

            if (comp.type === 'Motor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = nodeVoltages[comp.nodes[0]] || 0;
                const v2 = nodeVoltages[comp.nodes[1]] || 0;
                const voltage = v1 - v2;
                const resistanceRaw = Number(comp.resistance);
                const resistance = Number.isFinite(resistanceRaw) && resistanceRaw > 0 ? resistanceRaw : 5;
                const torqueConstantRaw = Number(comp.torqueConstant);
                const torqueConstant = Number.isFinite(torqueConstantRaw) ? torqueConstantRaw : 0.1;
                const emfConstantRaw = Number(comp.emfConstant);
                const emfConstant = Number.isFinite(emfConstantRaw) ? emfConstantRaw : 0.1;
                const inertiaRaw = Number(comp.inertia);
                const inertia = Number.isFinite(inertiaRaw) && inertiaRaw > 0 ? inertiaRaw : 0.01;
                const loadTorqueRaw = Number(comp.loadTorque);
                const loadTorque = Number.isFinite(loadTorqueRaw) ? loadTorqueRaw : 0.01;
                const prevBackEmf = Number.isFinite(entry?.backEmf)
                    ? entry.backEmf
                    : (Number.isFinite(comp.backEmf) ? comp.backEmf : 0);
                const prevSpeed = Number.isFinite(entry?.speed)
                    ? entry.speed
                    : (Number.isFinite(comp.speed) ? comp.speed : 0);
                const current = (voltage - prevBackEmf) / resistance;

                const torque = torqueConstant * current;
                const acceleration = (torque - loadTorque) / inertia;
                const nextSpeedRaw = prevSpeed + acceleration * dt;
                const nextSpeed = Number.isFinite(nextSpeedRaw) ? Math.max(0, nextSpeedRaw) : 0;
                const nextBackEmfRaw = emfConstant * nextSpeed;
                const nextBackEmf = Number.isFinite(nextBackEmfRaw) ? nextBackEmfRaw : 0;

                if (entry) {
                    entry.speed = nextSpeed;
                    entry.backEmf = nextBackEmf;
                }

                comp.speed = nextSpeed;
                comp.backEmf = nextBackEmf;
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
                const priorCurrent = Number.isFinite(entry?.prevCurrent)
                    ? entry.prevCurrent
                    : (Number.isFinite(comp.prevCurrent)
                        ? comp.prevCurrent
                        : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0));
                const nextCurrent = Number.isFinite(measuredCurrent)
                    ? measuredCurrent
                    : (priorCurrent + (dt / L) * dV);

                if (entry) {
                    entry.prevCurrent = nextCurrent;
                    entry.prevVoltage = dV;
                    entry._dynamicHistoryReady = true;
                }

                comp.prevCurrent = nextCurrent;
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
