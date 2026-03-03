function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function readNodeVoltage(voltages, nodeIndex) {
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return 0;
    return Number(voltages[nodeIndex] || 0);
}

function resolveResistance(value, fallback = Infinity) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function computeNtcThermistorResistance(component = {}) {
    const r25 = Math.max(1e-6, toFiniteNumber(component.resistanceAt25, 1000));
    const beta = Math.max(1, toFiniteNumber(component.beta, 3950));
    const tempC = toFiniteNumber(component.temperatureC, 25);
    const tKelvin = Math.max(1, tempC + 273.15);
    const exponent = beta * ((1 / tKelvin) - (1 / 298.15));
    return clamp(r25 * Math.exp(exponent), 1e-6, 1e15);
}

function computePhotoresistorResistance(component = {}) {
    let dark = Math.max(1e-6, toFiniteNumber(component.resistanceDark, 100000));
    let light = Math.max(1e-6, toFiniteNumber(component.resistanceLight, 500));
    if (dark < light) {
        [dark, light] = [light, dark];
    }
    const level = clamp(toFiniteNumber(component.lightLevel, 0.5), 0, 1);
    const lnR = Math.log(dark) * (1 - level) + Math.log(light) * level;
    return clamp(Math.exp(lnR), 1e-6, 1e15);
}

function resolveSourceVoltage(component, simTime = 0) {
    if (component.type === 'ACVoltageSource') {
        const rms = toFiniteNumber(component.rmsVoltage, toFiniteNumber(component.voltage, 0));
        const frequency = toFiniteNumber(component.frequency, 50);
        const phaseDeg = toFiniteNumber(component.phase, 0);
        const offset = toFiniteNumber(component.offset, 0);
        const omega = 2 * Math.PI * frequency;
        const phaseRad = phaseDeg * Math.PI / 180;
        return offset + (rms * Math.sqrt(2)) * Math.sin(omega * simTime + phaseRad);
    }
    return toFiniteNumber(component.voltage, 0);
}

export class ResultPostprocessorV2 {
    static computeCurrents(components = [], voltages = [], voltageSourceCurrentsById = new Map(), context = {}) {
        const currents = new Map();
        const state = context?.state;
        const dt = Math.max(1e-6, toFiniteNumber(context?.dt, 0.001));
        const simTime = toFiniteNumber(context?.simTime, 0);

        for (const component of components) {
            const id = String(component?.id || '');
            if (!id) continue;

            const n1 = component?.nodes?.[0];
            const n2 = component?.nodes?.[1];
            const v1 = readNodeVoltage(voltages, n1);
            const v2 = readNodeVoltage(voltages, n2);
            const deltaV = v1 - v2;
            const stateEntry = state && typeof state.get === 'function' ? state.get(id) : null;

            if (component.type === 'Ground' || component.type === 'BlackBox') {
                currents.set(id, 0);
                continue;
            }

            if (component.type === 'PowerSource' || component.type === 'ACVoltageSource') {
                const internalResistance = Number(component.internalResistance);
                const sourceVoltage = resolveSourceVoltage(component, simTime);
                if (Number.isFinite(internalResistance) && internalResistance > 1e-9) {
                    currents.set(id, (sourceVoltage - deltaV) / internalResistance);
                } else {
                    currents.set(id, Number(voltageSourceCurrentsById.get(id) || 0));
                }
                continue;
            }

            if (component.type === 'Ammeter') {
                const resistance = Number(component.resistance);
                if (Number.isFinite(resistance) && resistance > 1e-9) {
                    currents.set(id, deltaV / resistance);
                } else {
                    currents.set(id, Number(voltageSourceCurrentsById.get(id) || 0));
                }
                continue;
            }

            if (component.type === 'Voltmeter') {
                const resistance = Number(component.resistance);
                if (Number.isFinite(resistance) && resistance > 0) {
                    currents.set(id, deltaV / resistance);
                } else {
                    currents.set(id, 0);
                }
                continue;
            }

            if (component.type === 'Switch') {
                currents.set(id, component.closed ? deltaV / 1e-9 : 0);
                continue;
            }

            if (component.type === 'SPDTSwitch') {
                const routeToB = component.position === 'b';
                const targetIdx = routeToB ? 2 : 1;
                const commonNode = component.nodes?.[0];
                const targetNode = component.nodes?.[targetIdx];
                const vCommon = readNodeVoltage(voltages, commonNode);
                const vTarget = readNodeVoltage(voltages, targetNode);
                const onR = Math.max(1e-9, toFiniteNumber(component.onResistance, 1e-9));
                currents.set(id, (vCommon - vTarget) / onR);
                continue;
            }

            if (component.type === 'Fuse') {
                const blown = stateEntry?.blown ?? !!component.blown;
                const resistance = blown
                    ? Math.max(1, toFiniteNumber(component.blownResistance, 1e12))
                    : Math.max(1e-9, toFiniteNumber(component.coldResistance, 0.05));
                currents.set(id, deltaV / resistance);
                continue;
            }

            if (component.type === 'Thermistor') {
                currents.set(id, deltaV / computeNtcThermistorResistance(component));
                continue;
            }

            if (component.type === 'Photoresistor') {
                currents.set(id, deltaV / computePhotoresistorResistance(component));
                continue;
            }

            if (component.type === 'Diode' || component.type === 'LED') {
                const conducting = stateEntry?.conducting ?? !!component.conducting;
                const onR = Math.max(1e-6, toFiniteNumber(component.onResistance, component.type === 'LED' ? 2 : 1));
                const offR = Math.max(1, toFiniteNumber(component.offResistance, 1e9));
                currents.set(id, deltaV / (conducting ? onR : offR));
                continue;
            }

            if (component.type === 'Rheostat') {
                const minR = toFiniteNumber(component.minResistance, 0);
                const maxR = Math.max(minR, toFiniteNumber(component.maxResistance, 100));
                const position = clamp(toFiniteNumber(component.position, 0.5), 0, 1);
                const range = Math.max(0, maxR - minR);
                const r1 = Math.max(1e-9, minR + range * position);
                const r2 = Math.max(1e-9, maxR - range * position);

                const nLeft = component.nodes?.[0];
                const nRight = component.nodes?.[1];
                const nSlider = component.nodes?.[2];
                const vLeft = readNodeVoltage(voltages, nLeft);
                const vRight = readNodeVoltage(voltages, nRight);
                const vSlider = readNodeVoltage(voltages, nSlider);

                switch (component.connectionMode) {
                    case 'left-slider':
                        currents.set(id, (vLeft - vSlider) / r1);
                        break;
                    case 'right-slider':
                        currents.set(id, (vSlider - vRight) / r2);
                        break;
                    case 'left-right':
                        currents.set(id, (vLeft - vRight) / Math.max(1e-9, maxR));
                        break;
                    case 'all': {
                        const i1 = (vLeft - vSlider) / r1;
                        const i2 = (vSlider - vRight) / r2;
                        currents.set(id, Math.abs(i1) > Math.abs(i2) ? i1 : i2);
                        break;
                    }
                    default:
                        currents.set(id, 0);
                        break;
                }
                continue;
            }

            if (component.type === 'Relay') {
                const nCoilA = component.nodes?.[0];
                const nCoilB = component.nodes?.[1];
                const vCoilA = readNodeVoltage(voltages, nCoilA);
                const vCoilB = readNodeVoltage(voltages, nCoilB);
                const coilR = Math.max(1e-9, toFiniteNumber(component.coilResistance, 200));
                currents.set(id, (vCoilA - vCoilB) / coilR);
                continue;
            }

            if (component.type === 'Capacitor' || component.type === 'ParallelPlateCapacitor') {
                const c = Math.max(1e-18, toFiniteNumber(component.capacitance, 0.001));
                const prevVoltage = toFiniteNumber(stateEntry?.prevVoltage, 0);
                currents.set(id, c * (deltaV - prevVoltage) / dt);
                continue;
            }

            if (component.type === 'Inductor') {
                const l = Math.max(1e-12, toFiniteNumber(component.inductance, 0.1));
                const prevCurrent = toFiniteNumber(stateEntry?.prevCurrent, toFiniteNumber(component.initialCurrent, 0));
                currents.set(id, prevCurrent + (dt / l) * deltaV);
                continue;
            }

            if (component.type === 'Motor') {
                if (voltageSourceCurrentsById.has(id)) {
                    currents.set(id, Number(voltageSourceCurrentsById.get(id) || 0));
                } else {
                    const resistance = Math.max(1e-9, toFiniteNumber(component.resistance, 5));
                    const backEmf = toFiniteNumber(stateEntry?.backEmf, toFiniteNumber(component.backEmf, 0));
                    currents.set(id, (deltaV - backEmf) / resistance);
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
