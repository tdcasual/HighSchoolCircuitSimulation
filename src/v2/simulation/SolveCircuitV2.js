import { ResultPostprocessorV2 } from './ResultPostprocessorV2.js';
import { SimulationStateV2 } from './SimulationStateV2.js';

const EPS = 1e-12;
const LARGE_RESISTANCE = 1e12;
const SMALL_RESISTANCE = 1e-9;

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

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function normalizeNodeIndex(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
}

function normalizeComponent(component, index) {
    const safeComponent = component && typeof component === 'object' ? component : {};
    const type = typeof safeComponent.type === 'string' ? safeComponent.type : 'Unknown';
    const hasId = safeComponent.id !== undefined
        && safeComponent.id !== null
        && (typeof safeComponent.id !== 'string' || safeComponent.id.trim());
    const id = hasId ? String(safeComponent.id) : `${type}_${index}`;
    const sourceNodes = Array.isArray(safeComponent.nodes) ? safeComponent.nodes : [];
    const nodes = sourceNodes
        .map((node) => normalizeNodeIndex(node))
        .filter((node) => node !== null);

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

function initMatrix(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function initVector(size) {
    return Array.from({ length: size }, () => 0);
}

function nodeToMatrixIndex(node) {
    if (!Number.isInteger(node) || node <= 0) return null;
    return node - 1;
}

function stampResistor(matrix, n1, n2, resistance) {
    const r = Number(resistance);
    if (!Number.isFinite(r) || r <= 0) return;
    const g = 1 / r;

    const i1 = nodeToMatrixIndex(n1);
    const i2 = nodeToMatrixIndex(n2);
    if (i1 !== null) matrix[i1][i1] += g;
    if (i2 !== null) matrix[i2][i2] += g;
    if (i1 !== null && i2 !== null) {
        matrix[i1][i2] -= g;
        matrix[i2][i1] -= g;
    }
}

function stampCurrentSource(vector, fromNode, toNode, current) {
    const i = Number(current);
    if (!Number.isFinite(i) || Math.abs(i) < 1e-18) return;

    const from = nodeToMatrixIndex(fromNode);
    const to = nodeToMatrixIndex(toNode);
    if (from !== null) vector[from] -= i;
    if (to !== null) vector[to] += i;
}

function stampIdealVoltageSource(matrix, vector, nodeCount, nPlus, nMinus, voltage, sourceIndex) {
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0) return;

    const iPlus = nodeToMatrixIndex(nPlus);
    const iMinus = nodeToMatrixIndex(nMinus);
    const k = nodeCount - 1 + sourceIndex;
    if (k < 0 || k >= matrix.length) return;

    if (iPlus !== null) {
        matrix[iPlus][k] += 1;
        matrix[k][iPlus] += 1;
    }
    if (iMinus !== null) {
        matrix[iMinus][k] -= 1;
        matrix[k][iMinus] -= 1;
    }
    vector[k] += Number(voltage) || 0;
}

function solveLinearSystem(matrix, vector) {
    const n = matrix.length;
    if (n === 0) return [];

    const a = matrix.map((row) => [...row]);
    const b = [...vector];

    for (let pivot = 0; pivot < n; pivot += 1) {
        let maxRow = pivot;
        let maxValue = Math.abs(a[pivot][pivot]);
        for (let row = pivot + 1; row < n; row += 1) {
            const candidate = Math.abs(a[row][pivot]);
            if (candidate > maxValue) {
                maxValue = candidate;
                maxRow = row;
            }
        }

        if (maxValue < EPS) return null;

        if (maxRow !== pivot) {
            [a[pivot], a[maxRow]] = [a[maxRow], a[pivot]];
            [b[pivot], b[maxRow]] = [b[maxRow], b[pivot]];
        }

        for (let row = pivot + 1; row < n; row += 1) {
            const factor = a[row][pivot] / a[pivot][pivot];
            if (!Number.isFinite(factor) || Math.abs(factor) < 1e-18) continue;
            for (let col = pivot; col < n; col += 1) {
                a[row][col] -= factor * a[pivot][col];
            }
            b[row] -= factor * b[pivot];
        }
    }

    const x = Array.from({ length: n }, () => 0);
    for (let row = n - 1; row >= 0; row -= 1) {
        let sum = b[row];
        for (let col = row + 1; col < n; col += 1) {
            sum -= a[row][col] * x[col];
        }
        if (Math.abs(a[row][row]) < EPS) return null;
        x[row] = sum / a[row][row];
    }

    return x;
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

function resolveDiodeResistance(component, stateEntry) {
    const forwardVoltage = Math.max(0, toFiniteNumber(component.forwardVoltage, component.type === 'LED' ? 2 : 0.7));
    const onResistance = Math.max(1e-6, toFiniteNumber(component.onResistance, component.type === 'LED' ? 2 : 1));
    const offResistance = Math.max(1, toFiniteNumber(component.offResistance, 1e9));

    const conducting = stateEntry && typeof stateEntry.conducting === 'boolean'
        ? stateEntry.conducting
        : !!component.conducting;
    return {
        resistance: conducting ? onResistance : offResistance,
        forwardVoltage,
        onResistance,
        offResistance
    };
}

function assignVoltageSourceIndices(components) {
    let count = 0;
    for (const component of components) {
        component.vsIndex = undefined;
        const n1 = component.nodes?.[0];
        const n2 = component.nodes?.[1];
        const hasTwoNodes = Number.isInteger(n1) && n1 >= 0 && Number.isInteger(n2) && n2 >= 0;
        if (!hasTwoNodes) continue;

        if (component.type === 'PowerSource' || component.type === 'ACVoltageSource') {
            const internalResistance = toFiniteNumber(component.internalResistance, 0.5);
            component.internalResistance = internalResistance;
            if (internalResistance <= SMALL_RESISTANCE) {
                component.vsIndex = count;
                count += 1;
            }
            continue;
        }

        if (component.type === 'Ammeter') {
            const resistance = toFiniteNumber(component.resistance, 0);
            component.resistance = resistance;
            if (resistance <= SMALL_RESISTANCE) {
                component.vsIndex = count;
                count += 1;
            }
            continue;
        }

        if (component.type === 'Motor') {
            component.vsIndex = count;
            count += 1;
        }
    }
    return count;
}

function stampRheostat(component, matrix) {
    const [nLeft, nRight, nSlider] = component.nodes || [];
    const minR = toFiniteNumber(component.minResistance, 0);
    const maxR = Math.max(minR, toFiniteNumber(component.maxResistance, 100));
    const position = clamp(toFiniteNumber(component.position, 0.5), 0, 1);
    const range = Math.max(0, maxR - minR);
    const r1 = Math.max(1e-9, minR + range * position);
    const r2 = Math.max(1e-9, maxR - range * position);
    const mode = String(component.connectionMode || 'none');

    switch (mode) {
        case 'left-slider':
            stampResistor(matrix, nLeft, nSlider, r1);
            break;
        case 'right-slider':
            stampResistor(matrix, nSlider, nRight, r2);
            break;
        case 'left-right':
            stampResistor(matrix, nLeft, nRight, Math.max(1e-9, maxR));
            break;
        case 'all': {
            const leftEqSlider = nLeft === nSlider;
            const rightEqSlider = nRight === nSlider;
            const leftEqRight = nLeft === nRight;

            if (leftEqSlider && rightEqSlider) return;
            if (leftEqSlider) {
                stampResistor(matrix, nSlider, nRight, r2);
                return;
            }
            if (rightEqSlider) {
                stampResistor(matrix, nLeft, nSlider, r1);
                return;
            }
            if (leftEqRight) {
                const parallelR = (r1 * r2) / (r1 + r2);
                stampResistor(matrix, nLeft, nSlider, parallelR);
                return;
            }

            stampResistor(matrix, nLeft, nSlider, r1);
            stampResistor(matrix, nSlider, nRight, r2);
            break;
        }
        default:
            break;
    }
}

function stampComponent(component, context) {
    const {
        matrix,
        vector,
        nodeCount,
        dt,
        simTime,
        state
    } = context;

    const stateEntry = state.ensure({
        id: component.id,
        type: component.type,
        initialCurrent: component.initialCurrent
    });

    const n1 = component.nodes?.[0];
    const n2 = component.nodes?.[1];

    switch (component.type) {
        case 'Ground':
        case 'BlackBox':
            return;
        case 'Resistor':
        case 'Bulb': {
            const resistance = Math.max(1e-9, toFiniteNumber(component.resistance, 100));
            stampResistor(matrix, n1, n2, resistance);
            return;
        }
        case 'Thermistor': {
            stampResistor(matrix, n1, n2, computeNtcThermistorResistance(component));
            return;
        }
        case 'Photoresistor': {
            stampResistor(matrix, n1, n2, computePhotoresistorResistance(component));
            return;
        }
        case 'Diode':
        case 'LED': {
            const diodeModel = resolveDiodeResistance(component, stateEntry);
            stampResistor(matrix, n1, n2, diodeModel.resistance);
            return;
        }
        case 'Switch': {
            const resistance = component.closed ? SMALL_RESISTANCE : LARGE_RESISTANCE;
            stampResistor(matrix, n1, n2, resistance);
            return;
        }
        case 'SPDTSwitch': {
            const nCommon = component.nodes?.[0];
            const nA = component.nodes?.[1];
            const nB = component.nodes?.[2];
            const onR = Math.max(SMALL_RESISTANCE, toFiniteNumber(component.onResistance, SMALL_RESISTANCE));
            const offR = Math.max(onR, toFiniteNumber(component.offResistance, LARGE_RESISTANCE));
            const routeToB = component.position === 'b';
            stampResistor(matrix, nCommon, nA, routeToB ? offR : onR);
            stampResistor(matrix, nCommon, nB, routeToB ? onR : offR);
            return;
        }
        case 'Fuse': {
            const blown = stateEntry.blown ?? !!component.blown;
            const resistance = blown
                ? Math.max(1, toFiniteNumber(component.blownResistance, LARGE_RESISTANCE))
                : Math.max(SMALL_RESISTANCE, toFiniteNumber(component.coldResistance, 0.05));
            stampResistor(matrix, n1, n2, resistance);
            return;
        }
        case 'Ammeter': {
            const resistance = toFiniteNumber(component.resistance, 0);
            if (resistance > SMALL_RESISTANCE) {
                stampResistor(matrix, n1, n2, resistance);
                return;
            }
            stampIdealVoltageSource(matrix, vector, nodeCount, n1, n2, 0, component.vsIndex);
            return;
        }
        case 'Voltmeter': {
            const resistance = Number(component.resistance);
            if (Number.isFinite(resistance) && resistance > 0) {
                stampResistor(matrix, n1, n2, resistance);
            }
            return;
        }
        case 'Rheostat': {
            stampRheostat(component, matrix);
            return;
        }
        case 'Relay': {
            const nCoilA = component.nodes?.[0];
            const nCoilB = component.nodes?.[1];
            const nContactA = component.nodes?.[2];
            const nContactB = component.nodes?.[3];
            const energized = stateEntry.energized ?? !!component.energized;
            const coilR = Math.max(1e-9, toFiniteNumber(component.coilResistance, 200));
            const onR = Math.max(1e-9, toFiniteNumber(component.contactOnResistance, 1e-3));
            const offR = Math.max(1, toFiniteNumber(component.contactOffResistance, LARGE_RESISTANCE));
            stampResistor(matrix, nCoilA, nCoilB, coilR);
            stampResistor(matrix, nContactA, nContactB, energized ? onR : offR);
            return;
        }
        case 'Capacitor':
        case 'ParallelPlateCapacitor': {
            const c = Math.max(1e-18, toFiniteNumber(component.capacitance, 0.001));
            const req = Math.max(1e-9, dt / c);
            const prevVoltage = toFiniteNumber(stateEntry.prevVoltage, 0);
            const ieq = (c * prevVoltage) / dt;
            stampResistor(matrix, n1, n2, req);
            stampCurrentSource(vector, n2, n1, ieq);
            return;
        }
        case 'Inductor': {
            const l = Math.max(1e-12, toFiniteNumber(component.inductance, 0.1));
            const req = Math.max(1e-9, l / dt);
            const prevCurrent = toFiniteNumber(
                stateEntry.prevCurrent,
                toFiniteNumber(component.initialCurrent, 0)
            );
            stampResistor(matrix, n1, n2, req);
            stampCurrentSource(vector, n1, n2, prevCurrent);
            return;
        }
        case 'Motor': {
            const resistance = Math.max(1e-9, toFiniteNumber(component.resistance, 5));
            const backEmf = toFiniteNumber(stateEntry.backEmf, toFiniteNumber(component.backEmf, 0));
            stampResistor(matrix, n1, n2, resistance);
            stampIdealVoltageSource(matrix, vector, nodeCount, n1, n2, -backEmf, component.vsIndex);
            return;
        }
        case 'PowerSource':
        case 'ACVoltageSource': {
            const sourceVoltage = resolveSourceVoltage(component, simTime);
            const internalResistance = toFiniteNumber(component.internalResistance, 0.5);
            if (internalResistance > SMALL_RESISTANCE) {
                stampResistor(matrix, n1, n2, internalResistance);
                stampCurrentSource(vector, n2, n1, sourceVoltage / internalResistance);
                return;
            }
            stampIdealVoltageSource(matrix, vector, nodeCount, n1, n2, sourceVoltage, component.vsIndex);
            return;
        }
        default:
            return;
    }
}

function buildVoltageArray(nodeCount, solutionVector) {
    const voltages = Array.from({ length: nodeCount }, () => 0);
    for (let node = 1; node < nodeCount; node += 1) {
        voltages[node] = Number(solutionVector[node - 1] || 0);
    }
    return voltages;
}

function updateDynamicStates({ components, voltages, currents, dt, state }) {
    for (const component of components) {
        const entry = state.ensure({
            id: component.id,
            type: component.type,
            initialCurrent: component.initialCurrent
        });
        const n1 = component.nodes?.[0];
        const n2 = component.nodes?.[1];
        const v1 = Number.isInteger(n1) ? Number(voltages[n1] || 0) : 0;
        const v2 = Number.isInteger(n2) ? Number(voltages[n2] || 0) : 0;
        const deltaV = v1 - v2;
        const current = Number(currents.get(component.id) || 0);

        switch (component.type) {
            case 'Capacitor':
            case 'ParallelPlateCapacitor': {
                const c = Math.max(1e-18, toFiniteNumber(component.capacitance, 0.001));
                entry.prevVoltage = deltaV;
                entry.prevCharge = c * deltaV;
                entry.prevCurrent = current;
                entry.dynamicHistoryReady = true;
                break;
            }
            case 'Inductor': {
                entry.prevCurrent = current;
                entry.prevVoltage = deltaV;
                entry.dynamicHistoryReady = true;
                break;
            }
            case 'Motor': {
                const torqueConstant = toFiniteNumber(component.torqueConstant, 0.1);
                const emfConstant = toFiniteNumber(component.emfConstant, 0.1);
                const inertia = Math.max(1e-6, toFiniteNumber(component.inertia, 0.01));
                const loadTorque = toFiniteNumber(component.loadTorque, 0.01);
                const speed = Math.max(0, toFiniteNumber(entry.speed, 0));
                const acceleration = ((torqueConstant * current) - loadTorque) / inertia;
                const nextSpeed = Math.max(0, speed + acceleration * dt);
                entry.speed = nextSpeed;
                entry.backEmf = emfConstant * nextSpeed;
                break;
            }
            case 'Relay': {
                const pullIn = Math.max(1e-9, toFiniteNumber(component.pullInCurrent, 0.02));
                const dropOut = Math.min(
                    pullIn,
                    Math.max(1e-9, toFiniteNumber(component.dropOutCurrent, pullIn * 0.5))
                );
                const energized = !!entry.energized;
                const absCoilCurrent = Math.abs(current);
                entry.energized = energized
                    ? absCoilCurrent >= dropOut
                    : absCoilCurrent >= pullIn;
                break;
            }
            case 'Fuse': {
                const threshold = Math.max(1e-9, toFiniteNumber(component.i2tThreshold, 1));
                const prevAccum = Math.max(0, toFiniteNumber(entry.i2tAccum, toFiniteNumber(component.i2tAccum, 0)));
                const accum = prevAccum + current * current * dt;
                entry.i2tAccum = accum;
                entry.blown = !!entry.blown || !!component.blown || accum >= threshold;
                break;
            }
            case 'Diode':
            case 'LED': {
                const forwardVoltage = Math.max(0, toFiniteNumber(component.forwardVoltage, component.type === 'LED' ? 2 : 0.7));
                const referenceCurrent = component.type === 'LED'
                    ? Math.max(1e-6, toFiniteNumber(component.ratedCurrent, 0.02))
                    : Math.max(1e-6, toFiniteNumber(component.referenceCurrent, 0.001));
                entry.conducting = deltaV >= forwardVoltage * 0.95 || current >= referenceCurrent * 0.02;
                if (component.type === 'LED') {
                    entry.brightness = clamp(Math.abs(current) / Math.max(1e-6, referenceCurrent), 0, 1);
                }
                break;
            }
            default:
                break;
        }
    }
}

export function solveCircuitV2(netlistDTO, simulationState = new SimulationStateV2(), options = {}) {
    const dto = clonePlainValue(netlistDTO || {});
    const inputComponents = Array.isArray(dto.components) ? dto.components : [];
    const components = inputComponents.map((component, index) => normalizeComponent(component, index));
    const nextState = cloneState(simulationState);

    const dt = Math.max(1e-6, toFiniteNumber(options?.dt, 0.001));
    const simTime = toFiniteNumber(options?.simTime, 0);

    const diagnostics = {
        code: '',
        warnings: [],
        details: {}
    };

    const nodeCount = inferNodeCount(dto, components);
    const voltageSourceCount = assignVoltageSourceIndices(components);
    const matrixSize = Math.max(0, nodeCount - 1 + voltageSourceCount);

    if (matrixSize === 0) {
        return {
            valid: true,
            voltages: Array.from({ length: Math.max(nodeCount, 1) }, () => 0),
            currents: new Map(),
            nextState,
            diagnostics
        };
    }

    const matrix = initMatrix(matrixSize);
    const vector = initVector(matrixSize);

    for (const component of components) {
        stampComponent(component, {
            matrix,
            vector,
            nodeCount,
            dt,
            simTime,
            state: nextState
        });
    }

    for (let node = 1; node < nodeCount; node += 1) {
        const index = node - 1;
        matrix[index][index] += 1e-12;
    }

    const solution = solveLinearSystem(matrix, vector);
    if (!solution) {
        return {
            valid: false,
            voltages: Array.from({ length: Math.max(nodeCount, 1) }, () => 0),
            currents: new Map(),
            nextState,
            diagnostics: {
                ...diagnostics,
                code: 'SIM_SINGULAR_MATRIX',
                details: {
                    nodeCount,
                    matrixSize
                }
            }
        };
    }

    const voltages = buildVoltageArray(nodeCount, solution);
    const voltageSourceCurrentsById = new Map();
    for (const component of components) {
        if (!Number.isInteger(component.vsIndex)) continue;
        const k = nodeCount - 1 + component.vsIndex;
        voltageSourceCurrentsById.set(component.id, -(Number(solution[k] || 0)));
    }

    const currents = ResultPostprocessorV2.computeCurrents(
        components,
        voltages,
        voltageSourceCurrentsById,
        {
            dt,
            simTime,
            state: nextState
        }
    );

    updateDynamicStates({
        components,
        voltages,
        currents,
        dt,
        state: nextState
    });

    return {
        valid: true,
        voltages,
        currents,
        nextState,
        diagnostics
    };
}
