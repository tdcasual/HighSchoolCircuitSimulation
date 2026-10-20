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

function liveNode(nodeIdx) {
    return isValidNode(nodeIdx) && nodeIdx !== 0 ? nodeIdx : null;
}

function sourceIslandNode(comp) {
    const n0 = comp?.nodes?.[0];
    const n1 = comp?.nodes?.[1];
    const a = liveNode(n0);
    const b = liveNode(n1);
    if (a != null && b != null) return a;
    if (a != null && n1 === 0) return a;
    if (b != null && n0 === 0) return b;
    return null;
}

const OPEN_LIKE_RESISTANCE = 1e12;

function isOpenLikeResistance(value) {
    const resistance = Number(value);
    return Number.isFinite(resistance) && resistance >= OPEN_LIKE_RESISTANCE;
}

function relayEnergized(comp, state) {
    const stored = state?.get?.(comp?.id)?.energized;
    return typeof stored === 'boolean' ? stored : !!comp?.energized;
}

function unionStampedTerminals(comp, union, state) {
    const nodes = comp?.nodes || [];
    const type = comp?.type;
    if (type === 'Ground') {
        union(nodes[0], 0);
        return;
    }
    if (type === 'BlackBox') return;
    if (type === 'Voltmeter') {
        const resistance = Number(comp.resistance);
        if (!Number.isFinite(resistance) || resistance <= 0 || isOpenLikeResistance(resistance)) return;
        union(nodes[0], nodes[1]);
        return;
    }
    if (type === 'Switch') {
        if (!comp.closed) return;
        union(nodes[0], nodes[1]);
        return;
    }
    if (type === 'SPDTSwitch') {
        const nOn = comp.position === 'b' ? nodes[2] : nodes[1];
        union(nodes[0], nOn);
        return;
    }
    if (type === 'Relay') {
        if (!isOpenLikeResistance(comp.coilResistance)) union(nodes[0], nodes[1]);
        if (relayEnergized(comp, state)) union(nodes[2], nodes[3]);
        return;
    }
    if (type === 'Fuse' && comp.blown) return;
    if ((type === 'Resistor' || type === 'Bulb') && isOpenLikeResistance(comp.resistance)) return;
    if (type === 'Thermistor' && isOpenLikeResistance(comp.resistanceAt25)) return;
    if (type === 'Photoresistor') {
        const darker = Math.min(Number(comp.resistanceDark), Number(comp.resistanceLight));
        if (isOpenLikeResistance(darker)) return;
    }
    for (let i = 1; i < nodes.length; i += 1) union(nodes[0], nodes[i]);
}

function sourcePartsOf(comp) {
    if (comp?.type === 'PowerSource') {
        const voltage = Number(comp.voltage);
        return { dc: Number.isFinite(voltage) ? Math.abs(voltage) : 0, ac: 0 };
    }
    if (comp?.type === 'ACVoltageSource') {
        const rms = Number(comp.rmsVoltage);
        const offset = Number(comp.offset);
        return {
            dc: Number.isFinite(offset) ? Math.abs(offset) : 0,
            ac: Number.isFinite(rms) ? Math.abs(rms) * Math.SQRT2 : 0
        };
    }
    return { dc: 0, ac: 0 };
}

function sourceAmplitudeOf(comp) {
    const parts = sourcePartsOf(comp);
    return parts.dc + parts.ac;
}

function visitNodes(seeds, adj, forbidden) {
    const visited = new Set();
    const queue = [];
    for (const seed of seeds) {
        if (seed == null || seed === forbidden || visited.has(seed)) continue;
        visited.add(seed);
        queue.push(seed);
    }
    for (let i = 0; i < queue.length; i += 1) {
        for (const next of adj.get(queue[i]) || []) {
            if (next === forbidden || visited.has(next)) continue;
            visited.add(next);
            queue.push(next);
        }
    }
    return visited;
}

function buildStampedAdjacency(components, state) {
    const adj = new Map();
    const touch = (node) => {
        if (!isValidNode(node)) return null;
        if (!adj.has(node)) adj.set(node, new Set());
        return node;
    };
    const addEdge = (left, right) => {
        const a = touch(left);
        const b = touch(right);
        if (a == null || b == null || a === b) return;
        adj.get(a).add(b);
        adj.get(b).add(a);
    };
    for (const comp of components) {
        unionStampedTerminals(comp, addEdge, state);
        for (const node of comp?.nodes || []) touch(node);
    }
    return adj;
}

function collectGroundAnchors(components) {
    const anchors = new Set();
    for (const comp of components) {
        if (comp?.type === 'Ground') {
            const live = liveNode(comp.nodes?.[0]);
            if (live != null) anchors.add(live);
        }
        if (comp?.type !== 'PowerSource' && comp?.type !== 'ACVoltageSource') continue;
        if (!(sourceAmplitudeOf(comp) > 0)) continue;
        const n0 = comp.nodes?.[0];
        const n1 = comp.nodes?.[1];
        if (n0 === 0) {
            const live = liveNode(n1);
            if (live != null) anchors.add(live);
        } else if (n1 === 0) {
            const live = liveNode(n0);
            if (live != null) anchors.add(live);
        }
    }
    return anchors;
}

function collectJunctionNodes(components) {
    const nodes = new Set();
    for (const comp of components) {
        if (comp?.type !== 'Diode' && comp?.type !== 'LED') continue;
        const a = liveNode(comp.nodes?.[0]);
        const b = liveNode(comp.nodes?.[1]);
        if (a != null) nodes.add(a);
        if (b != null) nodes.add(b);
    }
    return nodes;
}

function spurCuts(adj, junctionNodes, groundAnchors) {
    const cuts = [];
    for (const cut of junctionNodes) {
        const seeds = [];
        for (const node of junctionNodes) {
            if (node !== cut) seeds.push(node);
        }
        for (const node of groundAnchors) seeds.push(node);
        const anchored = visitNodes(seeds, adj, cut);
        const hanging = visitNodes(adj.get(cut) || [], adj, cut);
        const spur = new Set();
        for (const node of hanging) {
            if (!anchored.has(node)) spur.add(node);
        }
        cuts.push({ cut, spur });
    }
    return cuts;
}

function isSpurSource(comp, spurSets) {
    if (comp?.type !== 'PowerSource' && comp?.type !== 'ACVoltageSource') return false;
    const n0 = comp.nodes?.[0];
    const n1 = comp.nodes?.[1];
    if (!isValidNode(n0) || !isValidNode(n1)) return false;
    for (const { cut, spur } of spurSets) {
        const hit = (node) => node === cut || spur.has(node);
        if (hit(n0) && hit(n1)) return true;
    }
    return false;
}

function sourcesShareNode(left, right) {
    for (const a of left?.nodes || []) {
        if (!isValidNode(a)) continue;
        for (const b of right?.nodes || []) {
            if (a === b) return true;
        }
    }
    return false;
}

function acPinsOnRectifier(left, right, adj) {
    if (!isValidNode(left) || !isValidNode(right) || left === right) return false;
    const a = adj.get(left);
    const b = adj.get(right);
    if (!a || !b) return false;
    let common = 0;
    for (const node of a) {
        if (node === right) continue;
        if (!b.has(node)) continue;
        common += 1;
        if (common >= 2) return true;
    }
    return false;
}

function islandSourceAmplitudeAtNode(components, state) {
    const parent = new Map();
    const find = (node) => {
        if (!parent.has(node)) parent.set(node, node);
        const current = parent.get(node);
        if (current === node) return node;
        const root = find(current);
        parent.set(node, root);
        return root;
    };
    const union = (left, right) => {
        const a = liveNode(left);
        const b = liveNode(right);
        if (a == null || b == null) return;
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    };
    for (const comp of components) {
        unionStampedTerminals(comp, union, state);
        for (const node of comp?.nodes || []) {
            const live = liveNode(node);
            if (live != null) find(live);
        }
    }
    const groundAnchors = collectGroundAnchors(components);
    const spurSets = spurCuts(
        buildStampedAdjacency(components, state),
        collectJunctionNodes(components),
        groundAnchors
    );
    const candidates = [];
    for (const comp of components) {
        const parts = sourcePartsOf(comp);
        if (!(parts.dc > 0 || parts.ac > 0)) continue;
        const node = sourceIslandNode(comp);
        if (node == null) continue;
        candidates.push({
            comp,
            parts,
            node,
            skip: isSpurSource(comp, spurSets)
        });
    }
    const byRoot = new Map();
    for (const candidate of candidates) {
        const root = find(candidate.node);
        const list = byRoot.get(root);
        if (list) list.push(candidate);
        else byRoot.set(root, [candidate]);
    }
    for (const list of byRoot.values()) {
        if (list.some((candidate) => !candidate.skip)) continue;
        for (const candidate of list) candidate.skip = false;
    }
    const dcSum = new Map();
    const acMax = new Map();
    const keptByRoot = new Map();
    const junctionAdj = new Map();
    const diodeIslands = new Set();
    const ledIslands = new Set();
    for (const candidate of candidates) {
        if (candidate.skip) continue;
        const root = find(candidate.node);
        const list = keptByRoot.get(root);
        if (list) list.push(candidate);
        else keptByRoot.set(root, [candidate]);
        if (candidate.parts.ac > 0) {
            acMax.set(root, Math.max(acMax.get(root) || 0, candidate.parts.ac));
        }
    }
    for (const comp of components) {
        if (comp?.type !== 'Diode' && comp?.type !== 'LED') continue;
        const n0 = comp.nodes?.[0];
        const n1 = comp.nodes?.[1];
        if (!isValidNode(n0) || !isValidNode(n1) || n0 === n1) continue;
        if (!junctionAdj.has(n0)) junctionAdj.set(n0, new Set());
        if (!junctionAdj.has(n1)) junctionAdj.set(n1, new Set());
        junctionAdj.get(n0).add(n1);
        junctionAdj.get(n1).add(n0);
        const islandNode = liveNode(n0) ?? liveNode(n1);
        if (islandNode == null || !parent.has(islandNode)) continue;
        const island = find(islandNode);
        if (comp.type === 'Diode') diodeIslands.add(island);
        else ledIslands.add(island);
    }
    for (const [root, list] of keptByRoot) {
        const islandAc = acMax.get(root) || 0;
        const mixedBridge = islandAc > 0
            && diodeIslands.has(root)
            && ledIslands.has(root)
            && list.some((other) => (
                other.comp.type === 'ACVoltageSource'
                && other.parts.ac > 0
                && acPinsOnRectifier(other.comp.nodes?.[0], other.comp.nodes?.[1], junctionAdj)
            ));
        for (const candidate of list) {
            if (!(candidate.parts.dc > 0)) continue;
            if (candidate.comp.type === 'PowerSource' && islandAc > 0 && mixedBridge) {
                const sharesAc = list.some((other) => (
                    other.comp.type === 'ACVoltageSource'
                    && other.parts.ac > 0
                    && sourcesShareNode(candidate.comp, other.comp)
                ));
                const sharesJunction = components.some((other) => (
                    (other?.type === 'Diode' || other?.type === 'LED')
                    && sourcesShareNode(candidate.comp, other)
                ));
                const sharesCapacitor = components.some((other) => (
                    (other?.type === 'Capacitor' || other?.type === 'ParallelPlateCapacitor')
                    && sourcesShareNode(candidate.comp, other)
                ));
                if (!sharesAc && !sharesJunction && !sharesCapacitor
                    && !(candidate.parts.dc > 200)) continue;
            }
            dcSum.set(root, (dcSum.get(root) || 0) + candidate.parts.dc);
        }
    }
    return (nodeIdx) => {
        const node = liveNode(nodeIdx);
        if (node == null || !parent.has(node)) return { amp: 0, dc: 0, ac: 0 };
        const root = find(node);
        const dc = dcSum.get(root) || 0;
        const ac = acMax.get(root) || 0;
        return { amp: dc + ac, dc, ac };
    };
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
    state = null,
    mix = 1,
    capHugeJunctionSteps = false
} = {}) {
    let changed = false;
    let maxVoltageDelta = 0;
    const appliedMix = Number.isFinite(mix) && mix > 0 && mix < 1 ? mix : 1;
    const sourceAmplitudeAtNode = capHugeJunctionSteps
        ? islandSourceAmplitudeAtNode(components, state)
        : null;

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
        if (capHugeJunctionSteps) {
            params.capHugeJunctionSteps = true;
            const anodeScale = sourceAmplitudeAtNode(nAnode);
            const cathodeScale = sourceAmplitudeAtNode(nCathode);
            const islandAmp = Math.max(anodeScale.amp, cathodeScale.amp);
            const islandDc = Math.max(anodeScale.dc, cathodeScale.dc);
            const islandAc = Math.max(anodeScale.ac, cathodeScale.ac);
            // Homotopy junk is an AC+C phenomenon: keep 15 V when the island
            // has RMS and no counted DC. AC offset, co-terminal batteries,
            // batteries that share a capacitor node (grounded HV + C),
            // PowerSource DC above 200 V, and series/parallel strings raise
            // the bound. Meter-linked extra ≤200 V loops on a mixed
            // Diode+LED rectifier (AC pins share two junction neighbors)
            // do not.
            params.maxAbsJunctionVoltage = islandAc > 0
                ? Math.max(islandDc, 15)
                : Math.max(islandAmp, 15);
        }
        const predicted = limitJunctionStep(vAk, previousLinearization, params);
        const nextLinearization = appliedMix === 1
            ? predicted
            : previousLinearization + appliedMix * (predicted - previousLinearization);
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
    state = null,
    flippedIds = null
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
        if (nextEnergized === currentEnergized) continue;
        if (flippedIds && flippedIds.has(comp.id)) continue;
        if (flippedIds) flippedIds.add(comp.id);
        changed = true;
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
