import { ResultPostprocessorV2 } from './ResultPostprocessorV2.js';
import { SimulationStateV2 } from './SimulationStateV2.js';

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

function normalizeNodeIndex(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
}

function normalizeComponent(component, index) {
    const safeComponent = component && typeof component === 'object' ? component : {};
    const type = typeof safeComponent.type === 'string' ? safeComponent.type : 'Unknown';
    const id = safeComponent.id ? String(safeComponent.id) : `${type}_${index}`;
    const nodes = Array.isArray(safeComponent.nodes)
        ? safeComponent.nodes
            .map((node) => normalizeNodeIndex(node))
            .filter((node) => node !== null)
        : [];
    const params = clonePlainValue(safeComponent.params || {});
    return {
        id,
        type,
        nodes,
        ...(params || {})
    };
}

function initMatrix(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function initVector(size) {
    return Array.from({ length: size }, () => 0);
}

function stampResistor(matrix, n1, n2, resistance) {
    const r = Number(resistance);
    if (!Number.isFinite(r) || r <= 0) return;
    const g = 1 / r;
    const i1 = n1 > 0 ? n1 - 1 : null;
    const i2 = n2 > 0 ? n2 - 1 : null;

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

    const from = fromNode > 0 ? fromNode - 1 : null;
    const to = toNode > 0 ? toNode - 1 : null;
    if (from !== null) vector[from] -= i;
    if (to !== null) vector[to] += i;
}

function stampIdealVoltageSource(matrix, vector, nodeCount, nPlus, nMinus, voltage, sourceIndex) {
    const iPlus = nPlus > 0 ? nPlus - 1 : null;
    const iMinus = nMinus > 0 ? nMinus - 1 : null;
    const k = nodeCount - 1 + sourceIndex;

    if (iPlus !== null) {
        matrix[iPlus][k] += 1;
        matrix[k][iPlus] += 1;
    }
    if (iMinus !== null) {
        matrix[iMinus][k] -= 1;
        matrix[k][iMinus] -= 1;
    }
    vector[k] += Number(voltage);
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

        if (maxValue < 1e-12) {
            return null;
        }

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
        if (Math.abs(a[row][row]) < 1e-12) return null;
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
    return Math.max(explicitNodeCount, maxNode + 1);
}

function buildVoltageArray(nodeCount, solutionVector) {
    const voltages = Array.from({ length: nodeCount }, () => 0);
    for (let node = 1; node < nodeCount; node += 1) {
        voltages[node] = Number(solutionVector[node - 1] || 0);
    }
    return voltages;
}

export function solveCircuitV2(netlistDTO, simulationState = new SimulationStateV2(), options = {}) {
    const dto = clonePlainValue(netlistDTO || {});
    const inputComponents = Array.isArray(dto.components) ? dto.components : [];
    const components = inputComponents.map((component, index) => normalizeComponent(component, index));
    const nextState = cloneState(simulationState);
    const diagnostics = {
        code: '',
        warnings: [],
        details: {}
    };

    const nodeCount = inferNodeCount(dto, components);
    const idealVoltageSources = [];
    for (const component of components) {
        if (component.type !== 'PowerSource' && component.type !== 'ACVoltageSource') continue;
        const internalResistance = Number(component.internalResistance);
        if (!(Number.isFinite(internalResistance) && internalResistance > 1e-9)) {
            idealVoltageSources.push(component);
        }
    }

    const matrixSize = Math.max(0, nodeCount - 1 + idealVoltageSources.length);
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
    const idealSourceIndexById = new Map();
    idealVoltageSources.forEach((component, index) => {
        idealSourceIndexById.set(component.id, index);
    });

    for (const component of components) {
        const n1 = component.nodes?.[0];
        const n2 = component.nodes?.[1];
        if (!Number.isInteger(n1) || !Number.isInteger(n2)) {
            diagnostics.warnings.push(`${component.id}: missing two-node terminals`);
            continue;
        }

        if (component.type === 'PowerSource' || component.type === 'ACVoltageSource') {
            const voltage = Number.isFinite(Number(component.voltage)) ? Number(component.voltage) : 0;
            const internalResistance = Number(component.internalResistance);
            if (Number.isFinite(internalResistance) && internalResistance > 1e-9) {
                stampResistor(matrix, n1, n2, internalResistance);
                stampCurrentSource(vector, n2, n1, voltage / internalResistance);
            } else {
                const sourceIndex = idealSourceIndexById.get(component.id);
                stampIdealVoltageSource(matrix, vector, nodeCount, n1, n2, voltage, sourceIndex);
            }
            continue;
        }

        if (component.type === 'Switch') {
            const resistance = component.closed ? 1e-6 : 1e12;
            stampResistor(matrix, n1, n2, resistance);
            continue;
        }

        const resistance = Number(component.resistance);
        if (Number.isFinite(resistance) && resistance > 0) {
            stampResistor(matrix, n1, n2, resistance);
            continue;
        }

        diagnostics.warnings.push(`${component.id}: unsupported component type "${component.type}"`);
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
    for (const [sourceId, index] of idealSourceIndexById.entries()) {
        const k = nodeCount - 1 + index;
        voltageSourceCurrentsById.set(sourceId, Number(solution[k] || 0));
    }

    const currents = ResultPostprocessorV2.computeCurrents(components, voltages, voltageSourceCurrentsById);
    return {
        valid: true,
        voltages,
        currents,
        nextState,
        diagnostics
    };
}
