function readNodeVoltage(voltages, nodeIndex) {
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return 0;
    return Number(voltages[nodeIndex] || 0);
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function hasValidNode(nodes, index) {
    const nodeIndex = nodes?.[index];
    return Number.isInteger(nodeIndex) && nodeIndex >= 0;
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

function collectProjectionSources({ netlist, circuitModel }) {
    const netlistComponents = Array.isArray(netlist?.components) ? netlist.components : [];
    if (netlistComponents.length > 0) {
        return netlistComponents.map((entry, index) => {
            const safe = entry && typeof entry === 'object' ? entry : {};
            const hasId = safe.id !== undefined && safe.id !== null
                && (typeof safe.id !== 'string' || safe.id.trim());
            const params = safe.params && typeof safe.params === 'object' ? { ...safe.params } : {};
            return {
                id: hasId ? String(safe.id) : `Unknown_${index}`,
                type: String(safe.type || 'Unknown'),
                nodes: Array.isArray(safe.nodes) ? safe.nodes : [],
                params
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
            nodes: [],
            params: {}
        });
    }
    return sources;
}

function isFiniteResistanceSource(type, params) {
    if (type !== 'PowerSource' && type !== 'ACVoltageSource') return false;
    const internalResistance = Number(params?.internalResistance);
    return Number.isFinite(internalResistance) && internalResistance >= 1e-9;
}

function isIdealVoltmeter(type, params) {
    if (type !== 'Voltmeter') return false;
    const resistance = params?.resistance;
    return resistance === null || resistance === undefined || resistance === Infinity || Number(resistance) >= 1e10;
}

function isTopologyDisconnected(source) {
    const nodes = source.nodes;
    const type = source.type;
    const params = source.params || {};

    if (type === 'Ground') {
        return !hasValidNode(nodes, 0);
    }
    if (type === 'Relay') {
        const coil = hasValidNode(nodes, 0) && hasValidNode(nodes, 1);
        const contact = hasValidNode(nodes, 2) && hasValidNode(nodes, 3);
        return !coil && !contact;
    }
    if (type === 'SPDTSwitch') {
        const targetIndex = params.position === 'b' ? 2 : 1;
        return !hasValidNode(nodes, 0) || !hasValidNode(nodes, targetIndex);
    }
    if (type === 'Rheostat') {
        switch (params.connectionMode) {
            case 'left-slider':
                return !hasValidNode(nodes, 0) || !hasValidNode(nodes, 2);
            case 'right-slider':
                return !hasValidNode(nodes, 1) || !hasValidNode(nodes, 2);
            case 'left-right':
                return !hasValidNode(nodes, 0) || !hasValidNode(nodes, 1);
            case 'all':
                return !hasValidNode(nodes, 0) || !hasValidNode(nodes, 1) || !hasValidNode(nodes, 2);
            default:
                return true;
        }
    }
    return !hasValidNode(nodes, 0) || !hasValidNode(nodes, 1);
}

function isTerminalShorted(source) {
    if (source.type === 'Rheostat' || source.type === 'Relay') return false;
    if (source.type === 'SPDTSwitch') {
        const targetIndex = source.params?.position === 'b' ? 2 : 1;
        const n1 = source.nodes?.[0];
        const n2 = source.nodes?.[targetIndex];
        return Number.isInteger(n1) && n1 >= 0 && n1 === n2;
    }
    const n1 = source.nodes?.[0];
    const n2 = source.nodes?.[1];
    return Number.isInteger(n1) && n1 >= 0 && n1 === n2;
}

function resolveSolveStatus(solveResult) {
    if (solveResult?.valid) return 'ok';
    const code = String(solveResult?.diagnostics?.code || '');
    if (code.includes('SHORT')) return 'shorted';
    return 'invalid';
}

function readStateEntry(solveResult, id) {
    const state = solveResult?.nextState;
    if (!state || typeof state.get !== 'function') return null;
    const entry = state.get(id);
    return entry && typeof entry === 'object' ? entry : null;
}

function readStateField(entry, field) {
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, field)) return undefined;
    return entry[field];
}

function applyDisconnectedView(type) {
    const view = {
        currentValue: 0,
        voltageValue: 0,
        powerValue: 0,
        status: 'disconnected'
    };
    if (type === 'Diode' || type === 'LED') {
        view.conducting = false;
    }
    if (type === 'Relay') {
        view.energized = false;
    }
    if (type === 'Bulb' || type === 'LED') {
        view.brightness = 0;
    }
    return view;
}

function applyGroundView(status) {
    return {
        currentValue: 0,
        voltageValue: 0,
        powerValue: 0,
        status
    };
}

function applyShortedView(type, status) {
    const view = {
        currentValue: 0,
        voltageValue: 0,
        powerValue: 0,
        status
    };
    if (type === 'Bulb' || type === 'LED') {
        view.brightness = 0;
    }
    return view;
}

function applyRheostatProjection(nodes, voltages, current, connectionMode) {
    const vLeft = readNodeVoltage(voltages, nodes?.[0]);
    const vRight = readNodeVoltage(voltages, nodes?.[1]);
    const vSlider = readNodeVoltage(voltages, nodes?.[2]);
    const view = {
        currentValue: current,
        voltageValue: 0,
        powerValue: 0
    };

    switch (connectionMode) {
        case 'left-slider': {
            const voltage = Math.abs(vLeft - vSlider);
            view.voltageValue = voltage;
            view.voltageSegLeft = voltage;
            break;
        }
        case 'right-slider': {
            const voltage = Math.abs(vSlider - vRight);
            view.voltageValue = voltage;
            view.voltageSegRight = voltage;
            break;
        }
        case 'left-right': {
            const voltage = Math.abs(vLeft - vRight);
            view.voltageValue = voltage;
            view.voltageSegLeft = voltage;
            break;
        }
        case 'all': {
            const voltage = Math.abs(vLeft - vRight);
            view.voltageValue = voltage;
            view.voltageSegLeft = Math.abs(vLeft - vSlider);
            view.voltageSegRight = Math.abs(vSlider - vRight);
            break;
        }
        default:
            break;
    }
    view.powerValue = Math.abs(current * view.voltageValue);
    return view;
}

function applyRelayProjection(nodes, voltages, current, stateEntry) {
    const vCoilA = readNodeVoltage(voltages, nodes?.[0]);
    const vCoilB = readNodeVoltage(voltages, nodes?.[1]);
    const vContactA = readNodeVoltage(voltages, nodes?.[2]);
    const vContactB = readNodeVoltage(voltages, nodes?.[3]);
    const coilVoltage = Math.abs(vCoilA - vCoilB);
    const energized = typeof stateEntry?.energized === 'boolean' ? stateEntry.energized : false;
    const params = stateEntry || {};
    const contactOn = Math.max(1e-9, Number(params.contactOnResistance) || 1e-3);
    const contactOff = Math.max(1, Number(params.contactOffResistance) || 1e12);
    const contactR = energized ? contactOn : contactOff;
    const contactCurrent = (vContactA - vContactB) / contactR;
    return {
        currentValue: current,
        voltageValue: coilVoltage,
        powerValue: Math.abs(coilVoltage * current) + Math.abs((vContactA - vContactB) * contactCurrent),
        energized
    };
}

function applyBrightness(view, type, current, params, stateEntry) {
    if (type === 'Bulb') {
        const ratedPower = Number(params?.ratedPower);
        const brightness = Math.min(1, view.powerValue / ratedPower);
        view.brightness = Number.isFinite(brightness) ? brightness : 0;
        return;
    }
    if (type === 'LED') {
        const ratedCurrent = Math.max(1e-6, Number(params?.ratedCurrent) || 0.02);
        const conducting = typeof stateEntry?.conducting === 'boolean' ? stateEntry.conducting : false;
        view.conducting = conducting;
        view.brightness = conducting ? Math.min(1, Math.abs(current) / ratedCurrent) : 0;
    }
}

function attachDynamicFields(view, type, stateEntry) {
    if (type === 'Diode') {
        const conducting = readStateField(stateEntry, 'conducting');
        if (typeof conducting === 'boolean') view.conducting = conducting;
        return;
    }
    if (type === 'Motor') {
        const speed = readStateField(stateEntry, 'speed');
        const backEmf = readStateField(stateEntry, 'backEmf');
        if (speed !== undefined) view.speed = speed;
        if (backEmf !== undefined) view.backEmf = backEmf;
        return;
    }
    if (type === 'Fuse') {
        const blown = readStateField(stateEntry, 'blown');
        const i2tAccum = readStateField(stateEntry, 'i2tAccum');
        if (blown !== undefined) view.blown = blown;
        if (i2tAccum !== undefined) view.i2tAccum = i2tAccum;
        return;
    }
    if (type === 'Capacitor' || type === 'ParallelPlateCapacitor') {
        const prevCharge = readStateField(stateEntry, 'prevCharge');
        const prevVoltage = readStateField(stateEntry, 'prevVoltage');
        if (prevCharge !== undefined) view.prevCharge = prevCharge;
        if (prevVoltage !== undefined) view.prevVoltage = prevVoltage;
        return;
    }
    if (type === 'Inductor') {
        const prevCurrent = readStateField(stateEntry, 'prevCurrent');
        if (prevCurrent !== undefined) view.prevCurrent = prevCurrent;
    }
}

function projectComponent(source, { voltages, currents, solveResult, solveStatus }) {
    const hasCurrent = currents.has(source.id);
    if (!hasCurrent || isTopologyDisconnected(source)) {
        return applyDisconnectedView(source.type);
    }

    if (source.type === 'Ground') {
        return applyGroundView(solveStatus);
    }

    const shorted = isTerminalShorted(source);
    if (shorted && !isFiniteResistanceSource(source.type, source.params)) {
        return applyShortedView(source.type, 'shorted');
    }

    let current = toFiniteNumber(currents.get(source.id), 0);
    if (isIdealVoltmeter(source.type, source.params)) {
        current = 0;
    }

    const stateEntry = readStateEntry(solveResult, source.id);
    const v1 = readNodeVoltage(voltages, source.nodes?.[0]);
    const v2 = readNodeVoltage(voltages, source.nodes?.[1]);
    let view;

    if (source.type === 'PowerSource' || source.type === 'ACVoltageSource') {
        const terminalVoltage = Math.abs(v1 - v2);
        view = {
            currentValue: current,
            voltageValue: terminalVoltage,
            powerValue: Math.abs(terminalVoltage * current)
        };
    } else if (source.type === 'Rheostat') {
        view = applyRheostatProjection(source.nodes, voltages, current, source.params?.connectionMode);
    } else if (source.type === 'SPDTSwitch') {
        const targetIndex = source.params?.position === 'b' ? 2 : 1;
        const vCommon = readNodeVoltage(voltages, source.nodes?.[0]);
        const vTarget = readNodeVoltage(voltages, source.nodes?.[targetIndex]);
        const voltage = Math.abs(vCommon - vTarget);
        view = {
            currentValue: current,
            voltageValue: voltage,
            powerValue: Math.abs(current * voltage)
        };
    } else if (source.type === 'Relay') {
        view = applyRelayProjection(source.nodes, voltages, current, {
            ...source.params,
            ...stateEntry
        });
    } else {
        const signedVoltage = v1 - v2;
        view = {
            currentValue: current,
            voltageValue: Math.abs(signedVoltage),
            powerValue: Math.abs(current * signedVoltage)
        };
    }

    view.status = shorted ? 'shorted' : solveStatus;
    applyBrightness(view, source.type, current, source.params, stateEntry);
    attachDynamicFields(view, source.type, stateEntry);
    return view;
}

export function projectResultV2({ netlist, solveResult, circuitModel } = {}) {
    const voltages = Array.isArray(solveResult?.voltages) ? [...solveResult.voltages] : [];
    const currents = resolveCurrentsMap(solveResult?.currents);
    const sources = collectProjectionSources({ netlist, circuitModel });
    const solveStatus = resolveSolveStatus(solveResult);

    const components = [];
    const viewMap = new Map();
    for (const source of sources) {
        const view = projectComponent(source, {
            voltages,
            currents,
            solveResult,
            solveStatus
        });
        viewMap.set(source.id, view);
        components.push({
            id: source.id,
            type: source.type,
            status: view.status,
            measurements: {
                voltage: view.voltageValue,
                current: view.currentValue,
                power: view.powerValue
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
        components,
        viewMap
    };
}
