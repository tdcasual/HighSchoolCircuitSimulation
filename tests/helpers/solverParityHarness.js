import { solveCircuitV2 } from '../../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../../src/v2/simulation/SimulationStateV2.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './circuitTestUtils.js';

function clonePlainValue(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => clonePlainValue(item));
    }
    if (typeof value === 'object') {
        const output = {};
        for (const [key, nested] of Object.entries(value)) {
            output[key] = clonePlainValue(nested);
        }
        return output;
    }
    return undefined;
}

function createCase(definition) {
    return Object.freeze(clonePlainValue(definition));
}

export const CANONICAL_SOLVER_CASES = Object.freeze([
    createCase({
        id: 'series-source-resistor',
        components: [
            {
                id: 'V1',
                type: 'PowerSource',
                props: { voltage: 3, internalResistance: 2 },
                terminals: ['n1', 'gnd']
            },
            {
                id: 'R1',
                type: 'Resistor',
                props: { resistance: 8 },
                terminals: ['n1', 'gnd']
            }
        ]
    }),
    createCase({
        id: 'divider-ideal-voltmeter',
        components: [
            {
                id: 'V1',
                type: 'PowerSource',
                props: { voltage: 12, internalResistance: 0 },
                terminals: ['vin', 'gnd']
            },
            {
                id: 'Rtop',
                type: 'Resistor',
                props: { resistance: 100 },
                terminals: ['vin', 'mid']
            },
            {
                id: 'Rbottom',
                type: 'Resistor',
                props: { resistance: 100 },
                terminals: ['mid', 'gnd']
            },
            {
                id: 'VM1',
                type: 'Voltmeter',
                props: { resistance: Infinity, range: 15 },
                terminals: ['mid', 'gnd']
            }
        ]
    }),
    createCase({
        id: 'series-ideal-ammeter',
        components: [
            {
                id: 'V1',
                type: 'PowerSource',
                props: { voltage: 12, internalResistance: 0 },
                terminals: ['vin', 'gnd']
            },
            {
                id: 'A1',
                type: 'Ammeter',
                props: { resistance: 0, range: 3 },
                terminals: ['vin', 'mid']
            },
            {
                id: 'R1',
                type: 'Resistor',
                props: { resistance: 100 },
                terminals: ['mid', 'gnd']
            }
        ]
    }),
    createCase({
        id: 'conflicting-ideal-sources',
        components: [
            {
                id: 'V1',
                type: 'PowerSource',
                props: { voltage: 5, internalResistance: 0 },
                terminals: ['vin', 'gnd']
            },
            {
                id: 'V2',
                type: 'PowerSource',
                props: { voltage: 12, internalResistance: 0 },
                terminals: ['vin', 'gnd']
            }
        ]
    })
]);

export function getCanonicalSolverCase(id) {
    const match = CANONICAL_SOLVER_CASES.find((entry) => entry.id === id);
    if (!match) {
        throw new Error(`Unknown canonical solver case: ${id}`);
    }
    return clonePlainValue(match);
}

function isGroundLabel(label) {
    const key = String(label || '').trim().toLowerCase();
    return key === '0' || key === 'gnd' || key === 'ground';
}

function buildNodeIndexMap(caseDefinition) {
    const map = new Map([['gnd', 0]]);
    let nextIndex = 1;

    for (const component of caseDefinition.components || []) {
        for (const label of component.terminals || []) {
            const normalized = isGroundLabel(label) ? 'gnd' : String(label);
            if (map.has(normalized)) continue;
            map.set(normalized, nextIndex);
            nextIndex += 1;
        }
    }

    return map;
}

function normalizeLabel(label) {
    return isGroundLabel(label) ? 'gnd' : String(label);
}

function buildComponentTerminalGroups(caseDefinition) {
    const groups = new Map();
    for (const component of caseDefinition.components || []) {
        for (let index = 0; index < (component.terminals || []).length; index += 1) {
            const label = normalizeLabel(component.terminals[index]);
            if (!groups.has(label)) {
                groups.set(label, []);
            }
            groups.get(label).push({ componentId: component.id, terminalIndex: index });
        }
    }
    return groups;
}

function buildWireId(caseId, label, index) {
    const safeLabel = String(label).replace(/[^a-zA-Z0-9]+/g, '_') || 'node';
    return `${caseId}_${safeLabel}_${index}`;
}

export function buildRuntimeCircuit(caseDefinition) {
    const definition = clonePlainValue(caseDefinition);
    const circuit = createTestCircuit();
    const componentsById = new Map();

    for (const descriptor of definition.components || []) {
        const component = addComponent(circuit, descriptor.type, descriptor.id, clonePlainValue(descriptor.props || {}));
        componentsById.set(component.id, component);
    }

    const groups = buildComponentTerminalGroups(definition);
    for (const [label, refs] of groups.entries()) {
        if (refs.length < 2) continue;
        const anchor = refs[0];
        for (let index = 1; index < refs.length; index += 1) {
            const target = refs[index];
            connectWire(
                circuit,
                buildWireId(definition.id, label, index),
                componentsById.get(anchor.componentId),
                anchor.terminalIndex,
                componentsById.get(target.componentId),
                target.terminalIndex
            );
        }
    }

    return {
        circuit,
        componentsById,
        definition
    };
}

export function buildV2Dto(caseDefinition) {
    const definition = clonePlainValue(caseDefinition);
    const nodeIndexMap = buildNodeIndexMap(definition);
    const nodes = Array.from(nodeIndexMap.entries())
        .sort((left, right) => left[1] - right[1])
        .map(([, index]) => ({ id: String(index) }));

    return {
        meta: { version: 2 },
        nodes,
        components: (definition.components || []).map((component) => ({
            id: component.id,
            type: component.type,
            nodes: (component.terminals || []).map((label) => nodeIndexMap.get(normalizeLabel(label)) ?? 0),
            params: clonePlainValue(component.props || {})
        }))
    };
}

function normalizeInvalidReason(result = {}) {
    const rawReason = String(result?.meta?.invalidReason || result?.diagnostics?.code || '').trim();
    if (!rawReason) return '';
    if (rawReason === 'factorization_failed' || rawReason === 'solve_failed' || rawReason === 'SIM_SINGULAR_MATRIX') {
        return 'singular_matrix';
    }
    return rawReason;
}

function collectCurrents(result, componentsById) {
    const output = {};
    for (const componentId of componentsById.keys()) {
        output[componentId] = Number(result?.currents?.get?.(componentId) || 0);
    }
    return output;
}

function collectTerminalVoltages(result, componentsById) {
    const output = {};
    for (const [componentId, component] of componentsById.entries()) {
        output[componentId] = (component.nodes || []).map((nodeIndex) => Number(result?.voltages?.[nodeIndex] || 0));
    }
    return output;
}

function collectSnapshot(result, componentsById) {
    return {
        valid: !!result?.valid,
        invalidReason: normalizeInvalidReason(result),
        currents: collectCurrents(result, componentsById),
        terminalVoltages: collectTerminalVoltages(result, componentsById)
    };
}

export function runRuntimeSolverCase(caseDefinition, options = {}) {
    const runtime = buildRuntimeCircuit(caseDefinition);
    const dt = Number.isFinite(Number(options.dt)) ? Number(options.dt) : runtime.circuit.dt;
    const simTime = Number.isFinite(Number(options.simTime)) ? Number(options.simTime) : 0;

    runtime.circuit.dt = dt;
    runtime.circuit.resetSimulationState();
    runtime.circuit.solver.setSimulationState(runtime.circuit.simulationState);

    const result = solveCircuit(runtime.circuit, simTime);
    return {
        ...runtime,
        result,
        snapshot: collectSnapshot(result, runtime.componentsById)
    };
}

export function runV2SolverCase(caseDefinition, options = {}) {
    const definition = clonePlainValue(caseDefinition);
    const dto = buildV2Dto(definition);
    const dt = Number.isFinite(Number(options.dt)) ? Number(options.dt) : 0.01;
    const simTime = Number.isFinite(Number(options.simTime)) ? Number(options.simTime) : 0;
    const state = new SimulationStateV2();
    const result = solveCircuitV2(dto, state, { dt, simTime });
    const componentsById = new Map(dto.components.map((component) => [component.id, component]));

    return {
        definition,
        dto,
        componentsById,
        result,
        snapshot: collectSnapshot(result, componentsById)
    };
}

export function runParityCase(caseDefinition, options = {}) {
    return {
        runtime: runRuntimeSolverCase(caseDefinition, options.runtime || options),
        v2: runV2SolverCase(caseDefinition, options.v2 || options)
    };
}
