/**
 * V2 MNA kernel. Classroom default tick reaches this through
 * createInjectedSolverBackend → runSimulationStepV2. Exclusive CI keeps the
 * identifier out of src/app|ui|core|embed; that is a dependency boundary,
 * not a tests-only island.
 */
import { ResultPostprocessorV2 } from './ResultPostprocessorV2.js';
import { SimulationStateV2 } from './SimulationStateV2.js';
import {
    DefaultStampRegistryV2,
    IDEAL_SOURCE_RESISTANCE_EPS,
    resolveSourceInstantVoltage
} from './StampRegistryV2.js';
import {
    applyGmin,
    buildSystemMatrixCacheKey,
    factorize,
    GMIN,
    solveWithFactorization,
    stampCurrentSource,
    stampResistor,
    stampSeriesVoltageSource,
    stampVoltageSource,
    zeros,
    zeroVector
} from './LinearAlgebraV2.js';
import {
    resolveDynamicIntegrationMethod,
    updateDynamicComponents,
    updateFuseState,
    updateJunctionLinearizationState,
    updateRelayEnergizedStates
} from './DynamicUpdateV2.js';

function clonePlainValue(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map((item) => clonePlainValue(item));
    if (typeof value === 'object') {
        const output = {};
        for (const [key, nested] of Object.entries(value)) {
            const cloned = clonePlainValue(nested);
            if (cloned === undefined) continue;
            output[key] = cloned;
        }
        return output;
    }
    return undefined;
}

function cloneState(state) {
    const next = new SimulationStateV2();
    if (!(state instanceof SimulationStateV2) || !(state.byId instanceof Map)) {
        return next;
    }
    for (const [id, entry] of state.byId.entries()) {
        next.byId.set(String(id), clonePlainValue(entry || {}));
    }
    return next;
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNodeIndex(value) {
    const parsed = Number(value);
    // Keep unconnected slots as -1; dropping a slot would stamp G to ground.
    if (!Number.isInteger(parsed) || parsed < 0) return -1;
    return parsed;
}

export function normalizeComponent(component, index) {
    const safeComponent = component && typeof component === 'object' ? component : {};
    const type = typeof safeComponent.type === 'string' ? safeComponent.type : 'Unknown';
    const hasId = safeComponent.id !== undefined
        && safeComponent.id !== null
        && (typeof safeComponent.id !== 'string' || safeComponent.id.trim());
    const id = hasId ? String(safeComponent.id) : `${type}_${index}`;
    const sourceNodes = Array.isArray(safeComponent.nodes) ? safeComponent.nodes : [];
    const nodes = sourceNodes.map((node) => normalizeNodeIndex(node));

    const params = clonePlainValue(safeComponent.params || {});
    if (params && typeof params === 'object') {
        delete params.id;
        delete params.type;
        delete params.nodes;
    }
    return {
        id,
        type,
        nodes,
        ...params
    };
}

function inferNodeCount(netlist, components) {
    const explicitNodeCount = Array.isArray(netlist?.nodes) ? netlist.nodes.length : 0;
    let maxNode = 0;
    for (const component of components) {
        for (const node of component.nodes || []) {
            if (Number.isInteger(node) && node > maxNode) {
                maxNode = node;
            }
        }
    }
    return Math.max(explicitNodeCount, maxNode + 1, 2);
}

function isValidNode(nodeIdx) {
    return nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
}

function toMatrixIndex(nodeIdx) {
    return isValidNode(nodeIdx) ? nodeIdx - 1 : null;
}

export function assignVoltageSourceIndices(components) {
    let voltageSourceCount = 0;
    let hasConnectedSwitch = false;

    for (const comp of components) {
        if (!comp || typeof comp !== 'object') continue;
        comp.vsIndex = undefined;
        const isPowerSource = comp.type === 'PowerSource' || comp.type === 'ACVoltageSource';
        if (comp.type === 'Ground') {
            comp._isShorted = false;
            continue;
        }
        if (comp.nodes && comp.nodes.length >= 2) {
            const n1 = comp.nodes[0];
            const n2 = comp.type === 'SPDTSwitch'
                ? comp.nodes[comp.position === 'b' ? 2 : 1]
                : comp.nodes[1];
            comp._isShorted = (n1 === n2 && n1 >= 0);
            if (comp.type === 'Relay' || comp.type === 'Rheostat') {
                comp._isShorted = false;
            }
        } else {
            comp._isShorted = false;
        }

        if (isPowerSource) {
            const internalResistance = Number(comp.internalResistance);
            comp.internalResistance = Number.isFinite(internalResistance) && internalResistance >= 0
                ? internalResistance
                : 0.5;
            comp._nortonModel = comp.internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS;
        }
    }

    for (const comp of components) {
        if (!comp || typeof comp !== 'object') continue;

        if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
            if (!(Number.isFinite(comp.internalResistance) && comp.internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS)) {
                if (!comp._isShorted) {
                    const n1 = comp.nodes?.[0];
                    const n2 = comp.nodes?.[1];
                    if (isValidNode(n1) && isValidNode(n2)) {
                        comp.vsIndex = voltageSourceCount++;
                    }
                }
            }
        } else if (comp.type === 'Motor') {
            if (!comp._isShorted) {
                const n1 = comp.nodes?.[0];
                const n2 = comp.nodes?.[1];
                if (isValidNode(n1) && isValidNode(n2)) {
                    comp.vsIndex = voltageSourceCount++;
                }
            }
        } else if (comp.type === 'Ammeter') {
            const ammeterResistance = Number(comp.resistance);
            comp.resistance = Number.isFinite(ammeterResistance) && ammeterResistance >= 0
                ? ammeterResistance
                : 0;
            if (comp.resistance <= 0) {
                if (!comp._isShorted) {
                    const n1 = comp.nodes?.[0];
                    const n2 = comp.nodes?.[1];
                    if (isValidNode(n1) && isValidNode(n2)) {
                        comp.vsIndex = voltageSourceCount++;
                    }
                }
            }
        } else if (comp.type === 'Switch') {
            if (comp.closed && !comp._isShorted) {
                const n1 = comp.nodes?.[0];
                const n2 = comp.nodes?.[1];
                if (isValidNode(n1) && isValidNode(n2)) {
                    comp.vsIndex = voltageSourceCount++;
                }
            } else {
                comp.vsIndex = undefined;
            }
        } else if (comp.type === 'SPDTSwitch') {
            if (!comp._isShorted) {
                const nCommon = comp.nodes?.[0];
                const nA = comp.nodes?.[1];
                const nB = comp.nodes?.[2];
                const routeToB = comp.position === 'b';
                const nOn = routeToB ? nB : nA;
                if (isValidNode(nCommon) && isValidNode(nOn)) {
                    comp.vsIndex = voltageSourceCount++;
                }
            } else {
                comp.vsIndex = undefined;
            }
        }

        if (comp.type === 'Inductor' && !Number.isFinite(comp.prevCurrent)) {
            comp.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
        }
        if (comp.type === 'Inductor' && !Number.isFinite(comp.prevVoltage)) {
            comp.prevVoltage = 0;
        }
        if ((comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') && !Number.isFinite(comp.prevCurrent)) {
            comp.prevCurrent = 0;
        }
        if ((comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') && !Number.isFinite(comp.prevVoltage)) {
            comp.prevVoltage = 0;
        }
        if (comp.type === 'Diode' || comp.type === 'LED') {
            const defaultVf = comp.type === 'LED' ? 2.0 : 0.7;
            const defaultRon = comp.type === 'LED' ? 2 : 1;
            comp.forwardVoltage = Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : defaultVf;
            comp.onResistance = Number.isFinite(comp.onResistance) ? comp.onResistance : defaultRon;
            comp.offResistance = Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9;
            comp.conducting = !!comp.conducting;
        }
        if (comp.type === 'Thermistor') {
            comp.resistanceAt25 = Number.isFinite(comp.resistanceAt25) ? comp.resistanceAt25 : 1000;
            comp.beta = Number.isFinite(comp.beta) ? comp.beta : 3950;
            comp.temperatureC = Number.isFinite(comp.temperatureC) ? comp.temperatureC : 25;
        }
        if (comp.type === 'Photoresistor') {
            comp.resistanceDark = Number.isFinite(comp.resistanceDark) ? comp.resistanceDark : 100000;
            comp.resistanceLight = Number.isFinite(comp.resistanceLight) ? comp.resistanceLight : 500;
            comp.lightLevel = Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5;
        }
        if (comp.type === 'Relay') {
            comp.coilResistance = Number.isFinite(comp.coilResistance) ? comp.coilResistance : 200;
            comp.pullInCurrent = Number.isFinite(comp.pullInCurrent) ? comp.pullInCurrent : 0.02;
            comp.dropOutCurrent = Number.isFinite(comp.dropOutCurrent) ? comp.dropOutCurrent : 0.01;
            comp.contactOnResistance = Number.isFinite(comp.contactOnResistance) ? comp.contactOnResistance : 1e-3;
            comp.contactOffResistance = Number.isFinite(comp.contactOffResistance) ? comp.contactOffResistance : 1e12;
            comp.energized = !!comp.energized;
        }
        if (comp.type === 'Switch' || comp.type === 'SPDTSwitch') {
            const n1 = comp.nodes?.[0];
            const n2 = comp.type === 'SPDTSwitch'
                ? comp.nodes?.[comp.position === 'b' ? 2 : 1]
                : comp.nodes?.[1];
            if (isValidNode(n1) && isValidNode(n2)) {
                hasConnectedSwitch = true;
            }
        }
    }

    return { voltageSourceCount, hasConnectedSwitch };
}

function isFiniteResistanceSource(comp) {
    return (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
        && Number.isFinite(Number(comp.internalResistance))
        && Number(comp.internalResistance) >= IDEAL_SOURCE_RESISTANCE_EPS;
}

function stampComponent(comp, A, z, nodeCount, contextExtras) {
    if (comp.type === 'Ground') return;
    if (!comp.nodes || comp.nodes.length < 2) return;
    if (comp._isShorted && !isFiniteResistanceSource(comp)) return;

    const n1 = comp.nodes[0];
    const n2 = comp.nodes[1];
    if (comp.type !== 'Rheostat' && comp.type !== 'SPDTSwitch' && comp.type !== 'Relay'
        && (!isValidNode(n1) || !isValidNode(n2))) {
        return;
    }

    const handler = DefaultStampRegistryV2.get(comp.type);
    if (!handler || typeof handler.stamp !== 'function') return;

    handler.stamp(comp, {
        stampResistor: (i1, i2, r) => stampResistor(A, i1, i2, r),
        stampCurrentSource: (from, to, current) => stampCurrentSource(z, from, to, current),
        stampVoltageSource: (i1, i2, voltage, vsIndex, totalNodeCount) =>
            stampVoltageSource(A, z, i1, i2, voltage, vsIndex, totalNodeCount),
        stampSeriesVoltageSource: (i1, i2, voltage, seriesR, vsIndex, totalNodeCount) =>
            stampSeriesVoltageSource(A, z, i1, i2, voltage, seriesR, vsIndex, totalNodeCount),
        getSourceInstantVoltage: contextExtras.getSourceInstantVoltage,
        dt: contextExtras.dt,
        simTime: contextExtras.simTime,
        resolveDynamicIntegrationMethod: contextExtras.resolveDynamicIntegrationMethod,
        state: contextExtras.state,
        extraJunctionGmin: contextExtras.extraJunctionGmin
    }, {
        n1,
        n2,
        i1: toMatrixIndex(n1),
        i2: toMatrixIndex(n2),
        nodeCount,
        isValidNode
    });
}

function assemble(components, nodeCount, voltageSourceCount, contextExtras) {
    const size = Math.max(0, nodeCount - 1 + voltageSourceCount);
    const A = zeros(size, size);
    const z = zeroVector(size);
    for (const comp of components) {
        stampComponent(comp, A, z, nodeCount, contextExtras);
    }
    applyGmin(A, nodeCount, GMIN);
    return { A, z, size };
}

function buildVoltageArray(nodeCount, solutionVector) {
    const voltages = Array.from({ length: nodeCount }, () => 0);
    for (let node = 1; node < nodeCount; node += 1) {
        voltages[node] = Number(solutionVector[node - 1] || 0);
    }
    return voltages;
}

function iterationMeta(iterations, maxIterations, converged) {
    return {
        converged: !!converged,
        iterations: Number.isFinite(iterations) ? iterations : 0,
        maxIterations: Number.isFinite(maxIterations) ? maxIterations : 0
    };
}

function emptyResult(nodeCount, nextState, diagnostics, extra = {}) {
    const valid = extra.valid !== false;
    return {
        valid,
        voltages: Array.from({ length: Math.max(nodeCount, 1) }, () => 0),
        currents: extra.currents || new Map(),
        nextState,
        diagnostics,
        meta: extra.meta || iterationMeta(extra.iterations, extra.maxIterations, valid && extra.converged !== false)
    };
}

export function solveCircuitV2(netlistDTO, simulationState = new SimulationStateV2(), options = {}) {
    const dto = clonePlainValue(netlistDTO || {});
    const inputComponents = Array.isArray(dto.components) ? dto.components : [];
    // Stamp order followed JSON/Map order. A 1800 Hz min-Ron LED bridge
    // + C crawls to not_converged when the capacitor stamps before the LEDs.
    const rankedInputs = [...inputComponents].sort((a, b) => {
        const rank = (type) => {
            if (type === 'PowerSource' || type === 'ACVoltageSource') return 0;
            if (type === 'Diode' || type === 'LED') return 1;
            return 2;
        };
        return rank(a?.type) - rank(b?.type);
    });
    const components = rankedInputs.map((component, index) => normalizeComponent(component, index));
    const nextState = cloneState(simulationState);

    const dt = Math.max(1e-6, toFiniteNumber(options?.dt, 0.001));
    const simTime = toFiniteNumber(options?.simTime, 0);
    const diagnostics = { code: '', warnings: [], details: {} };

    const nodeCount = inferNodeCount(dto, components);
    const prepared = assignVoltageSourceIndices(components);
    const voltageSourceCount = prepared.voltageSourceCount;
    const hasConnectedSwitch = prepared.hasConnectedSwitch;
    const matrixSize = Math.max(0, nodeCount - 1 + voltageSourceCount);

    if (matrixSize === 0) {
        return emptyResult(nodeCount, nextState, diagnostics);
    }

    const contextExtras = {
        dt,
        simTime,
        state: nextState,
        getSourceInstantVoltage: (comp) => resolveSourceInstantVoltage(comp, simTime),
        resolveDynamicIntegrationMethod: (comp) => resolveDynamicIntegrationMethod(
            comp,
            hasConnectedSwitch,
            nextState.get(comp.id)
        ),
        extraJunctionGmin: 0
    };

    const hasJunction = components.some((comp) => comp?.type === 'Diode' || comp?.type === 'LED');
    const hasRelay = components.some((comp) => comp?.type === 'Relay');
    const hasStateful = hasJunction || hasRelay;
    const hasCapacitorCompanion = components.some((comp) =>
        comp?.type === 'Capacitor' || comp?.type === 'ParallelPlateCapacitor'
    );
    const junctionCount = components.reduce(
        (count, comp) => count + ((comp?.type === 'Diode' || comp?.type === 'LED') ? 1 : 0),
        0
    );
    // Four dialog-min LEDs settle inside 40; five need ~42. A blown fuse
    // plus min-Ron LED crawls ~vScale per Newton from a cold Vj and needs
    // ~55. Four-diode AC commutation at 500/1000 Hz crawls mixed delta
    // and needs ~150; 32*n (128) exhausts first. Mix-floor 2-cycles get a
    // temporary junction shunt, then the shunt is removed before accept.
    // One-diode + capacitor half-wave crawls after mix damping (~366 NR at
    // 2000 Hz); 64*n is 64 and the floor 80 exhausts first.
    const maxIterations = hasStateful
        ? Math.max(
            80,
            64 * Math.max(junctionCount, hasRelay ? 1 : 0),
            (hasCapacitorCompanion && hasJunction) ? 400 : 0
        )
        : 1;
    const junctionTolerance = 1e-6;
    const stallJunctionGmin = 1e-3;

    let factorizationCache = { key: null, factorization: null, matrixSize: -1 };
    let solvedVoltages = Array.from({ length: Math.max(nodeCount, 1) }, () => 0);
    let solvedCurrents = new Map();
    let solvedValid = false;
    let lastJunctionDelta = 0;
    let previousJunctionDelta = Infinity;
    let junctionMix = 1;
    let extraJunctionGmin = 0;
    let converged = !hasStateful;
    let iterationsUsed = 0;
    const relayFlippedIds = hasRelay ? new Set() : null;

    for (let iter = 0; iter < maxIterations; iter += 1) {
        iterationsUsed = iter + 1;
        contextExtras.extraJunctionGmin = extraJunctionGmin;
        const { A, z, size } = assemble(components, nodeCount, voltageSourceCount, contextExtras);
        const cacheKey = buildSystemMatrixCacheKey({
            nodeCount,
            voltageSourceCount,
            gmin: GMIN,
            dt,
            hasConnectedSwitch,
            components,
            simulationState: nextState,
            resolveDynamicIntegrationMethod: contextExtras.resolveDynamicIntegrationMethod
        });

        let factorization = null;
        if (
            factorizationCache.key === cacheKey
            && factorizationCache.matrixSize === size
            && factorizationCache.factorization
        ) {
            factorization = factorizationCache.factorization;
        } else {
            factorization = factorize(A);
            if (!factorization) {
                return emptyResult(nodeCount, nextState, {
                    ...diagnostics,
                    code: 'SIM_SINGULAR_MATRIX',
                    details: { nodeCount, matrixSize: size }
                }, {
                    valid: false,
                    iterations: iterationsUsed,
                    maxIterations,
                    converged: false
                });
            }
            factorizationCache = { key: cacheKey, factorization, matrixSize: size };
        }

        const x = solveWithFactorization(factorization, z);
        if (!x) {
            return emptyResult(nodeCount, nextState, {
                ...diagnostics,
                code: 'SIM_SINGULAR_MATRIX',
                details: { nodeCount, matrixSize: size }
            }, {
                valid: false,
                iterations: iterationsUsed,
                maxIterations,
                converged: false
            });
        }

        solvedVoltages = buildVoltageArray(nodeCount, x);
        solvedCurrents = ResultPostprocessorV2.computeCurrents(
            components,
            solvedVoltages,
            {
                dt,
                simTime,
                state: nextState,
                solveVector: x,
                nodeCount,
                getSourceInstantVoltage: contextExtras.getSourceInstantVoltage,
                resolveDynamicIntegrationMethod: contextExtras.resolveDynamicIntegrationMethod
            }
        );
        solvedValid = true;

        if (!hasStateful) {
            converged = true;
            break;
        }

        let relayChanged = false;
        if (hasJunction) {
            const previousJunctionVoltages = new Map();
            for (const comp of components) {
                if (comp?.type !== 'Diode' && comp?.type !== 'LED') continue;
                const voltage = nextState.get(comp.id)?.junctionVoltage;
                previousJunctionVoltages.set(comp.id, Number.isFinite(voltage) ? voltage : 0);
            }
            const junctionUpdate = updateJunctionLinearizationState({
                components,
                voltages: solvedVoltages,
                currents: solvedCurrents,
                state: nextState,
                mix: junctionMix
            });
            lastJunctionDelta = Number.isFinite(junctionUpdate.maxVoltageDelta)
                ? junctionUpdate.maxVoltageDelta
                : 0;
            // Capacitor companion + full Newton 2-cycles at commutation.
            // Land on the midpoint of the pair, then damp the next jump.
            const stalled = hasCapacitorCompanion
                && lastJunctionDelta > junctionTolerance
                && lastJunctionDelta >= previousJunctionDelta;
            if (stalled) {
                if (junctionMix <= 1e-4 || extraJunctionGmin > 0) {
                    extraJunctionGmin = Math.max(extraJunctionGmin, stallJunctionGmin);
                    junctionMix = 1;
                    factorizationCache = { key: null, factorization: null, matrixSize: -1 };
                } else {
                    for (const comp of components) {
                        if (comp?.type !== 'Diode' && comp?.type !== 'LED') continue;
                        const entry = nextState.get(comp.id);
                        const previous = previousJunctionVoltages.get(comp.id);
                        if (!entry || !Number.isFinite(previous) || !Number.isFinite(entry.junctionVoltage)) {
                            continue;
                        }
                        entry.junctionVoltage = 0.5 * (entry.junctionVoltage + previous);
                    }
                    junctionMix = Math.max(1e-4, junctionMix * 0.5);
                }
            }
            previousJunctionDelta = lastJunctionDelta;
            if (junctionUpdate.changed) {
                factorizationCache = { key: null, factorization: null, matrixSize: -1 };
            }
        }
        if (hasRelay) {
            relayChanged = !!updateRelayEnergizedStates({
                components,
                currents: solvedCurrents,
                state: nextState,
                flippedIds: relayFlippedIds
            });
            if (relayChanged) {
                factorizationCache = { key: null, factorization: null, matrixSize: -1 };
            }
        }

        const junctionConverged = !hasJunction || lastJunctionDelta <= junctionTolerance;
        if (junctionConverged && extraJunctionGmin > 0 && !relayChanged) {
            extraJunctionGmin = 0;
            junctionMix = 1;
            factorizationCache = { key: null, factorization: null, matrixSize: -1 };
        } else if (junctionConverged && !relayChanged) {
            converged = true;
            break;
        }
    }

    if (!solvedValid) {
        return emptyResult(nodeCount, nextState, {
            ...diagnostics,
            code: 'SIM_SINGULAR_MATRIX',
            details: { nodeCount, matrixSize }
        }, {
            valid: false,
            iterations: iterationsUsed,
            maxIterations,
            converged: false
        });
    }

    updateDynamicComponents({
        components,
        voltages: solvedVoltages,
        currents: solvedCurrents,
        dt,
        state: nextState
    });
    updateFuseState({
        components,
        currents: solvedCurrents,
        dt,
        state: nextState
    });

    const valid = !hasStateful || converged;
    if (!valid) {
        diagnostics.code = 'not_converged';
        diagnostics.details = {
            ...diagnostics.details,
            nodeCount,
            matrixSize,
            maxIterations,
            lastJunctionDelta
        };
    }

    return {
        valid,
        voltages: solvedVoltages,
        currents: solvedCurrents,
        nextState,
        diagnostics,
        meta: iterationMeta(iterationsUsed, maxIterations, valid && converged)
    };
}
