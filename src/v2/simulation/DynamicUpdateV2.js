import { limitJunctionStep, resolveJunctionParameters } from './JunctionModelV2.js';

const DynamicIntegrationMethods = Object.freeze({
    Auto: 'auto',
    Trapezoidal: 'trapezoidal',
    BackwardEuler: 'backward-euler'
});

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function isValidNode(nodeIdx) {
    return nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
}

function readNodeVoltage(voltages, nodeIndex) {
    if (!isValidNode(nodeIndex)) return 0;
    return Number(voltages[nodeIndex] || 0);
}

export function resolveDynamicIntegrationMethod(comp, hasConnectedSwitch = false, entry = null) {
    if (!comp) return DynamicIntegrationMethods.BackwardEuler;
    const methodRaw = typeof comp.integrationMethod === 'string'
        ? comp.integrationMethod.toLowerCase()
        : DynamicIntegrationMethods.Auto;
    const historyReady = !!(entry?.dynamicHistoryReady
        ?? comp.dynamicHistoryReady
        ?? comp._dynamicHistoryReady);

    if (hasConnectedSwitch) {
        return DynamicIntegrationMethods.BackwardEuler;
    }
    if (methodRaw === DynamicIntegrationMethods.Trapezoidal) {
        return historyReady
            ? DynamicIntegrationMethods.Trapezoidal
            : DynamicIntegrationMethods.BackwardEuler;
    }
    if (methodRaw === DynamicIntegrationMethods.BackwardEuler) {
        return DynamicIntegrationMethods.BackwardEuler;
    }
    if (!historyReady) {
        return DynamicIntegrationMethods.BackwardEuler;
    }
    return DynamicIntegrationMethods.Trapezoidal;
}

export function updateDynamicComponents({
    components = [],
    voltages = [],
    currents = null,
    dt = 0.001,
    state = null
} = {}) {
    for (const comp of components) {
        if (!comp?.id || !state) continue;
        const entry = state.ensure(comp);
        const n1 = comp.nodes?.[0];
        const n2 = comp.nodes?.[1];

        if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
            if (!isValidNode(n1) || !isValidNode(n2)) continue;
            const v = readNodeVoltage(voltages, n1) - readNodeVoltage(voltages, n2);
            entry.prevVoltage = v;
            entry.prevCharge = (comp.capacitance || 0) * v;
            const measuredCurrent = currents && typeof currents.get === 'function'
                ? currents.get(comp.id)
                : undefined;
            if (Number.isFinite(measuredCurrent)) {
                entry.prevCurrent = measuredCurrent;
            }
            entry.dynamicHistoryReady = true;
            continue;
        }

        if (comp.type === 'Inductor') {
            if (!isValidNode(n1) || !isValidNode(n2)) continue;
            const dV = readNodeVoltage(voltages, n1) - readNodeVoltage(voltages, n2);
            const L = Math.max(1e-12, comp.inductance || 0);
            const measuredCurrent = currents && typeof currents.get === 'function'
                ? currents.get(comp.id)
                : undefined;
            const priorCurrent = Number.isFinite(entry?.prevCurrent)
                ? entry.prevCurrent
                : (Number.isFinite(comp.prevCurrent)
                    ? comp.prevCurrent
                    : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0));
            entry.prevCurrent = Number.isFinite(measuredCurrent)
                ? measuredCurrent
                : (priorCurrent + (dt / L) * dV);
            entry.prevVoltage = dV;
            entry.dynamicHistoryReady = true;
            continue;
        }

        if (comp.type === 'Motor') {
            if (!isValidNode(n1) || !isValidNode(n2)) continue;
            const measured = currents?.get?.(comp.id);
            if (!Number.isFinite(measured)) continue;
            const torqueConstant = toFiniteNumber(comp.torqueConstant, 0.1);
            const emfConstant = toFiniteNumber(comp.emfConstant, 0.1);
            const inertiaRaw = Number(comp.inertia);
            const inertia = Number.isFinite(inertiaRaw) && inertiaRaw > 0 ? inertiaRaw : 0.01;
            const loadTorque = toFiniteNumber(comp.loadTorque, 0.01);
            const prevSpeed = Number.isFinite(entry?.speed)
                ? entry.speed
                : toFiniteNumber(comp.speed, 0);
            const nextSpeedRaw = prevSpeed + ((torqueConstant * measured) - loadTorque) / inertia * dt;
            const nextSpeed = Number.isFinite(nextSpeedRaw) ? Math.max(0, nextSpeedRaw) : 0;
            const nextBackEmfRaw = emfConstant * nextSpeed;
            entry.speed = nextSpeed;
            entry.backEmf = Number.isFinite(nextBackEmfRaw) ? nextBackEmfRaw : 0;
        }
    }
}

export function updateJunctionLinearizationState({
    components = [],
    voltages = [],
    currents = null,
    state = null
} = {}) {
    let changed = false;
    let maxVoltageDelta = 0;

    for (const comp of components) {
        if (!comp || (comp.type !== 'Diode' && comp.type !== 'LED') || !state) continue;
        const entry = state.ensure(comp);
        const nAnode = comp.nodes?.[0];
        const nCathode = comp.nodes?.[1];
        if (!isValidNode(nAnode) || !isValidNode(nCathode)) continue;

        const vAk = readNodeVoltage(voltages, nAnode) - readNodeVoltage(voltages, nCathode);
        const previousLinearization = Number.isFinite(entry?.junctionVoltage)
            ? entry.junctionVoltage
            : (Number.isFinite(comp.junctionVoltage) ? comp.junctionVoltage : 0);

        const params = resolveJunctionParameters(comp);
        const nextLinearization = limitJunctionStep(vAk, previousLinearization, params);
        const junctionCurrent = Number(currents?.get(comp.id)) || 0;
        const displayCurrentThreshold = Math.max(1e-4, params.referenceCurrent * 0.02);
        const nextConducting = junctionCurrent >= displayCurrentThreshold
            || vAk >= params.forwardVoltage * 0.95;

        const delta = Math.abs(nextLinearization - previousLinearization);
        maxVoltageDelta = Math.max(maxVoltageDelta, delta);
        if (delta > 1e-9) changed = true;

        entry.junctionVoltage = nextLinearization;
        entry.junctionCurrent = junctionCurrent;
        entry.conducting = nextConducting;
        if (comp.type === 'LED') {
            const rated = Math.max(1e-6, toFiniteNumber(comp.ratedCurrent, 0.02));
            entry.brightness = clamp(Math.abs(junctionCurrent) / rated, 0, 1);
        }
    }

    return { changed, maxVoltageDelta };
}

export function updateRelayEnergizedStates({
    components = [],
    currents = null,
    state = null
} = {}) {
    let changed = false;
    for (const comp of components) {
        if (!comp || comp.type !== 'Relay' || !state) continue;
        const entry = state.ensure(comp);
        const pullIn = Math.max(1e-9, Number(comp.pullInCurrent) || 0.02);
        const dropOutRaw = Math.max(1e-9, Number(comp.dropOutCurrent) || pullIn * 0.5);
        const dropOut = Math.min(dropOutRaw, pullIn);
        const coilCurrentAbs = Math.abs(Number(currents?.get(comp.id)) || 0);
        const currentEnergized = typeof entry.energized === 'boolean'
            ? entry.energized
            : !!comp.energized;
        const nextEnergized = currentEnergized
            ? coilCurrentAbs >= dropOut
            : coilCurrentAbs >= pullIn;
        if (nextEnergized !== currentEnergized) changed = true;
        entry.energized = nextEnergized;
    }
    return changed;
}

export function updateFuseState({
    components = [],
    currents = null,
    dt = 0.001,
    state = null
} = {}) {
    for (const comp of components) {
        if (!comp || comp.type !== 'Fuse' || !state) continue;
        const entry = state.ensure(comp);
        if (entry.blown || comp.blown) {
            entry.blown = true;
            continue;
        }
        const currentAbs = Math.abs(Number(currents?.get(comp.id)) || 0);
        if (!Number.isFinite(currentAbs)) continue;
        const ratedCurrent = Math.max(1e-6, Number(comp.ratedCurrent) || 3);
        const defaultThreshold = ratedCurrent * ratedCurrent * 0.2;
        const threshold = Math.max(1e-9, Number(comp.i2tThreshold) || defaultThreshold);
        const prevAccum = Math.max(0, toFiniteNumber(entry.i2tAccum, toFiniteNumber(comp.i2tAccum, 0)));
        const accum = prevAccum + currentAbs * currentAbs * dt;
        entry.i2tAccum = accum;
        entry.blown = accum >= threshold;
    }
}

export { DynamicIntegrationMethods };
