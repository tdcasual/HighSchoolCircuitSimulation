export class CircuitResultProjectionService {
    applyStepResults(circuit, results, elapsedStepDt = 0) {
        if (!circuit || !results?.valid) return false;

        this.updateComponentDisplayValues(circuit, results);
        return this.updateFuseState(circuit, results, elapsedStepDt);
    }

    updateComponentDisplayValues(circuit, results) {
        for (const [id, comp] of circuit.components) {
            const current = results.currents.get(id) || 0;
            const v1 = this.getNodeVoltage(results, comp.nodes?.[0]);
            const v2 = this.getNodeVoltage(results, comp.nodes?.[1]);
            const isConnected = circuit.isComponentConnected(id);

            if (!isConnected) {
                this.resetDisconnectedComponent(comp);
                continue;
            }

            if (comp.type === 'Ground') {
                comp.currentValue = 0;
                comp.voltageValue = 0;
                comp.powerValue = 0;
                continue;
            }

            const isFiniteResistanceSource = (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
                && Number.isFinite(Number(comp.internalResistance))
                && Number(comp.internalResistance) >= 1e-9;
            if (comp._isShorted && !isFiniteResistanceSource) {
                comp.currentValue = 0;
                comp.voltageValue = 0;
                comp.powerValue = 0;
                if (comp.type === 'Bulb' || comp.type === 'LED') {
                    comp.brightness = 0;
                }
                continue;
            }

            comp.currentValue = current;
            if (circuit.isIdealVoltmeter(comp)) {
                comp.currentValue = 0;
            }

            if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
                const terminalVoltage = Math.abs(v1 - v2);
                comp.voltageValue = terminalVoltage;
                comp.powerValue = Math.abs(terminalVoltage * current);
            } else if (comp.type === 'Rheostat') {
                this.applyRheostatProjection(comp, results, current);
            } else if (comp.type === 'SPDTSwitch') {
                const routeToB = comp.position === 'b';
                const targetIdx = routeToB ? 2 : 1;
                const vCommon = this.getNodeVoltage(results, comp.nodes?.[0]);
                const vTarget = this.getNodeVoltage(results, comp.nodes?.[targetIdx]);
                const voltage = Math.abs(vCommon - vTarget);
                comp.voltageValue = voltage;
                comp.powerValue = Math.abs(current * voltage);
            } else if (comp.type === 'Relay') {
                this.applyRelayProjection(comp, results, current);
            } else {
                comp.voltageValue = Math.abs(v1 - v2);
                comp.powerValue = Math.abs(current * (v1 - v2));
            }

            this.applyBrightnessProjection(comp, current);
        }
    }

    updateFuseState(circuit, results, elapsedStepDt) {
        let fuseStateChanged = false;
        for (const [id, comp] of circuit.components) {
            if (comp.type !== 'Fuse') continue;
            if (comp.blown) continue;
            if (!circuit.isComponentConnected(id)) continue;

            const currentAbs = Math.abs(results.currents.get(id) || 0);
            if (!Number.isFinite(currentAbs)) continue;

            const ratedCurrent = Math.max(1e-6, Number(comp.ratedCurrent) || 3);
            const defaultThreshold = ratedCurrent * ratedCurrent * 0.2;
            const threshold = Math.max(1e-9, Number(comp.i2tThreshold) || defaultThreshold);
            comp.i2tAccum = Math.max(0, Number(comp.i2tAccum) || 0) + currentAbs * currentAbs * elapsedStepDt;
            if (comp.i2tAccum >= threshold) {
                comp.blown = true;
                fuseStateChanged = true;
            }
        }
        if (fuseStateChanged) {
            circuit.markSolverCircuitDirty();
        }
        return fuseStateChanged;
    }

    resetDisconnectedComponent(comp) {
        comp.currentValue = 0;
        comp.voltageValue = 0;
        comp.powerValue = 0;
        comp._isShorted = false;
        if (comp.type === 'Diode' || comp.type === 'LED') {
            comp.conducting = false;
        }
        if (comp.type === 'Relay') {
            comp.energized = false;
        }
        if (comp.type === 'Bulb' || comp.type === 'LED') {
            comp.brightness = 0;
        }
    }

    applyRheostatProjection(comp, results, current) {
        const vLeft = this.getNodeVoltage(results, comp.nodes?.[0]);
        const vRight = this.getNodeVoltage(results, comp.nodes?.[1]);
        const vSlider = this.getNodeVoltage(results, comp.nodes?.[2]);
        comp.voltageSegLeft = 0;
        comp.voltageSegRight = 0;

        let voltage = 0;
        switch (comp.connectionMode) {
            case 'left-slider':
                voltage = Math.abs(vLeft - vSlider);
                comp.voltageSegLeft = voltage;
                comp.voltageSegRight = undefined;
                break;
            case 'right-slider':
                voltage = Math.abs(vSlider - vRight);
                comp.voltageSegLeft = undefined;
                comp.voltageSegRight = voltage;
                break;
            case 'left-right':
                voltage = Math.abs(vLeft - vRight);
                comp.voltageSegLeft = voltage;
                comp.voltageSegRight = undefined;
                break;
            case 'all':
                voltage = Math.abs(vLeft - vRight);
                comp.voltageSegLeft = Math.abs(vLeft - vSlider);
                comp.voltageSegRight = Math.abs(vSlider - vRight);
                break;
            default:
                voltage = 0;
                comp.voltageSegLeft = undefined;
                comp.voltageSegRight = undefined;
        }
        comp.voltageValue = voltage;
        comp.powerValue = Math.abs(current * voltage);
    }

    applyRelayProjection(comp, results, current) {
        const vCoilA = this.getNodeVoltage(results, comp.nodes?.[0]);
        const vCoilB = this.getNodeVoltage(results, comp.nodes?.[1]);
        const vContactA = this.getNodeVoltage(results, comp.nodes?.[2]);
        const vContactB = this.getNodeVoltage(results, comp.nodes?.[3]);
        const coilVoltage = Math.abs(vCoilA - vCoilB);
        const contactR = comp.energized
            ? Math.max(1e-9, Number(comp.contactOnResistance) || 1e-3)
            : Math.max(1, Number(comp.contactOffResistance) || 1e12);
        const contactCurrent = (vContactA - vContactB) / contactR;
        comp.contactCurrent = contactCurrent;
        comp.voltageValue = coilVoltage;
        comp.powerValue = Math.abs(coilVoltage * current) + Math.abs((vContactA - vContactB) * contactCurrent);
    }

    applyBrightnessProjection(comp, current) {
        if (comp.type === 'Bulb') {
            comp.brightness = Math.min(1, comp.powerValue / comp.ratedPower);
        }
        if (comp.type === 'LED') {
            const ratedCurrent = Math.max(1e-6, Number(comp.ratedCurrent) || 0.02);
            const currentAbs = Math.abs(current);
            comp.brightness = comp.conducting ? Math.min(1, currentAbs / ratedCurrent) : 0;
        }
    }

    getNodeVoltage(results, nodeIdx) {
        if (nodeIdx === undefined || nodeIdx < 0) return 0;
        return results?.voltages?.[nodeIdx] || 0;
    }
}
