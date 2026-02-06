import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Circuit } from '../../src/engine/Circuit.js';
import { createComponent } from '../../src/components/Component.js';
import { getTerminalWorldPosition } from '../../src/utils/TerminalGeometry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');
const OUTPUT_DIR = resolve(ROOT_DIR, 'output/baselines');
const BASELINE_FILE = resolve(__dirname, 'baselines/p0-electrical-baseline.json');
const CURRENT_SNAPSHOT_FILE = resolve(OUTPUT_DIR, 'p0-electrical-current.json');
const DIFF_REPORT_FILE = resolve(OUTPUT_DIR, 'p0-electrical-diff.md');
const ABS_TOL = Number.isFinite(Number(process.env.P0_BASELINE_ABS_TOL))
    ? Number(process.env.P0_BASELINE_ABS_TOL)
    : 1e-6;
const REL_TOL = Number.isFinite(Number(process.env.P0_BASELINE_REL_TOL))
    ? Number(process.env.P0_BASELINE_REL_TOL)
    : 1e-3;

function normalizeNumber(value, digits = 12) {
    if (!Number.isFinite(value)) return 0;
    const normalized = Number(value.toFixed(digits));
    return Math.abs(normalized) < 1e-15 ? 0 : normalized;
}

function addComponent(circuit, type, id, x, y, props = {}) {
    const component = createComponent(type, x, y, id);
    Object.assign(component, props);
    circuit.addComponent(component);
    return component;
}

function connectTerminals(circuit, wireId, aComp, aTerminalIndex, bComp, bTerminalIndex) {
    const a = getTerminalWorldPosition(aComp, aTerminalIndex);
    const b = getTerminalWorldPosition(bComp, bTerminalIndex);
    if (!a || !b) {
        throw new Error(`Invalid terminal position for ${wireId}`);
    }
    circuit.addWire({
        id: wireId,
        a,
        b,
        aRef: { componentId: aComp.id, terminalIndex: aTerminalIndex },
        bRef: { componentId: bComp.id, terminalIndex: bTerminalIndex }
    });
}

function createScenarioResult(id, description, buildFn, options = {}) {
    return {
        id,
        description,
        build: buildFn,
        dt: Number.isFinite(options.dt) ? options.dt : 0.01,
        steps: Number.isFinite(options.steps) ? Math.max(1, Math.floor(options.steps)) : 1,
        initialSimTime: Number.isFinite(options.initialSimTime) ? options.initialSimTime : 0
    };
}

export const P0_SCENARIO_DEFINITIONS = [
    createScenarioResult('series_single_100ohm', '12V source with 100Ω series resistor', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 180, 0, { resistance: 100 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', r1, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('series_source_internal', '12V source with 2Ω internal + 8Ω load', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 2 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 180, 0, { resistance: 8 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', r1, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('series_two_equal', 'Two 100Ω resistors in series', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 180, 0, { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', 360, 0, { resistance: 100 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', r1, 1, r2, 0);
        connectTerminals(circuit, 'W3', r2, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('series_two_unequal', '50Ω + 150Ω series branch', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 180, 0, { resistance: 50 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', 360, 0, { resistance: 150 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', r1, 1, r2, 0);
        connectTerminals(circuit, 'W3', r2, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('parallel_two_equal', 'Two 100Ω resistors in parallel', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 200, -80, { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', 200, 80, { resistance: 100 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', v1, 0, r2, 0);
        connectTerminals(circuit, 'W3', r1, 1, v1, 1);
        connectTerminals(circuit, 'W4', r2, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('parallel_two_unequal', '100Ω and 200Ω resistors in parallel', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 200, -80, { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', 200, 80, { resistance: 200 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', v1, 0, r2, 0);
        connectTerminals(circuit, 'W3', r1, 1, v1, 1);
        connectTerminals(circuit, 'W4', r2, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('parallel_three_equal', 'Three 120Ω branches in parallel', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 220, -120, { resistance: 120 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', 220, 0, { resistance: 120 });
        const r3 = addComponent(circuit, 'Resistor', 'R3', 220, 120, { resistance: 120 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', v1, 0, r2, 0);
        connectTerminals(circuit, 'W3', v1, 0, r3, 0);
        connectTerminals(circuit, 'W4', r1, 1, v1, 1);
        connectTerminals(circuit, 'W5', r2, 1, v1, 1);
        connectTerminals(circuit, 'W6', r3, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('mixed_series_parallel', '60Ω series with two parallel 120Ω branches', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const rSeries = addComponent(circuit, 'Resistor', 'R1', 160, 0, { resistance: 60 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', 340, -80, { resistance: 120 });
        const r3 = addComponent(circuit, 'Resistor', 'R3', 340, 80, { resistance: 120 });
        connectTerminals(circuit, 'W1', v1, 0, rSeries, 0);
        connectTerminals(circuit, 'W2', rSeries, 1, r2, 0);
        connectTerminals(circuit, 'W3', rSeries, 1, r3, 0);
        connectTerminals(circuit, 'W4', r2, 1, v1, 1);
        connectTerminals(circuit, 'W5', r3, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('switch_open', 'Open switch should block current', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const sw = addComponent(circuit, 'Switch', 'S1', 160, 0, { closed: false });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 320, 0, { resistance: 100 });
        connectTerminals(circuit, 'W1', v1, 0, sw, 0);
        connectTerminals(circuit, 'W2', sw, 1, r1, 0);
        connectTerminals(circuit, 'W3', r1, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('switch_closed', 'Closed switch should conduct current', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const sw = addComponent(circuit, 'Switch', 'S1', 160, 0, { closed: true });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 320, 0, { resistance: 100 });
        connectTerminals(circuit, 'W1', v1, 0, sw, 0);
        connectTerminals(circuit, 'W2', sw, 1, r1, 0);
        connectTerminals(circuit, 'W3', r1, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('rheostat_left_slider', 'Rheostat left-slider mode (position 0.25)', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const rh = addComponent(circuit, 'Rheostat', 'RH1', 220, 0, { minResistance: 0, maxResistance: 100, position: 0.25 });
        connectTerminals(circuit, 'W1', v1, 0, rh, 0);
        connectTerminals(circuit, 'W2', rh, 2, v1, 1);
        return circuit;
    }),
    createScenarioResult('rheostat_right_slider', 'Rheostat right-slider mode (position 0.25)', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const rh = addComponent(circuit, 'Rheostat', 'RH1', 220, 0, { minResistance: 0, maxResistance: 100, position: 0.25 });
        connectTerminals(circuit, 'W1', v1, 0, rh, 2);
        connectTerminals(circuit, 'W2', rh, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('rheostat_left_right', 'Rheostat left-right mode', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const rh = addComponent(circuit, 'Rheostat', 'RH1', 220, 0, { minResistance: 0, maxResistance: 100, position: 0.7 });
        connectTerminals(circuit, 'W1', v1, 0, rh, 0);
        connectTerminals(circuit, 'W2', rh, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('bulb_loop', 'Bulb as resistive load', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const bulb = addComponent(circuit, 'Bulb', 'B1', 200, 0, { resistance: 50, ratedPower: 5 });
        connectTerminals(circuit, 'W1', v1, 0, bulb, 0);
        connectTerminals(circuit, 'W2', bulb, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('ammeter_ideal_series', 'Ideal ammeter in series branch', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const am = addComponent(circuit, 'Ammeter', 'A1', 160, 0, { resistance: 0, range: 3 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 320, 0, { resistance: 100 });
        connectTerminals(circuit, 'W1', v1, 0, am, 0);
        connectTerminals(circuit, 'W2', am, 1, r1, 0);
        connectTerminals(circuit, 'W3', r1, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('ammeter_real_series', 'Ammeter with 1Ω internal resistance', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const am = addComponent(circuit, 'Ammeter', 'A1', 160, 0, { resistance: 1, range: 3 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 320, 0, { resistance: 99 });
        connectTerminals(circuit, 'W1', v1, 0, am, 0);
        connectTerminals(circuit, 'W2', am, 1, r1, 0);
        connectTerminals(circuit, 'W3', r1, 1, v1, 1);
        return circuit;
    }),
    createScenarioResult('voltmeter_ideal_parallel', 'Ideal voltmeter in parallel branch', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 220, 0, { resistance: 100 });
        const vm = addComponent(circuit, 'Voltmeter', 'VM1', 220, 130, { resistance: Infinity, range: 15 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', r1, 1, v1, 1);
        connectTerminals(circuit, 'W3', vm, 0, r1, 0);
        connectTerminals(circuit, 'W4', vm, 1, r1, 1);
        return circuit;
    }),
    createScenarioResult('voltmeter_real_parallel', 'Voltmeter with finite 1000Ω resistance', () => {
        const circuit = new Circuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
        const r1 = addComponent(circuit, 'Resistor', 'R1', 220, 0, { resistance: 100 });
        const vm = addComponent(circuit, 'Voltmeter', 'VM1', 220, 130, { resistance: 1000, range: 15 });
        connectTerminals(circuit, 'W1', v1, 0, r1, 0);
        connectTerminals(circuit, 'W2', r1, 1, v1, 1);
        connectTerminals(circuit, 'W3', vm, 0, r1, 0);
        connectTerminals(circuit, 'W4', vm, 1, r1, 1);
        return circuit;
    }),
    createScenarioResult(
        'rc_charge',
        'RC charging transient to near steady state',
        () => {
            const circuit = new Circuit();
            const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
            const r1 = addComponent(circuit, 'Resistor', 'R1', 180, 0, { resistance: 100 });
            const c1 = addComponent(circuit, 'Capacitor', 'C1', 360, 0, { capacitance: 0.001 });
            connectTerminals(circuit, 'W1', v1, 0, r1, 0);
            connectTerminals(circuit, 'W2', r1, 1, c1, 0);
            connectTerminals(circuit, 'W3', c1, 1, v1, 1);
            return circuit;
        },
        { steps: 2000, dt: 0.01 }
    ),
    createScenarioResult(
        'rl_step',
        'RL step response near steady current',
        () => {
            const circuit = new Circuit();
            const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, { voltage: 12, internalResistance: 0 });
            const r1 = addComponent(circuit, 'Resistor', 'R1', 180, 0, { resistance: 6 });
            const l1 = addComponent(circuit, 'Inductor', 'L1', 360, 0, { inductance: 1, initialCurrent: 0 });
            connectTerminals(circuit, 'W1', v1, 0, r1, 0);
            connectTerminals(circuit, 'W2', r1, 1, l1, 0);
            connectTerminals(circuit, 'W3', l1, 1, v1, 1);
            return circuit;
        },
        { steps: 600, dt: 0.01 }
    )
];

function runScenario(def) {
    const circuit = def.build();
    circuit.dt = def.dt;
    circuit.simTime = def.initialSimTime;
    circuit.rebuildNodes();

    let results = { valid: false, voltages: [], currents: new Map() };
    for (let i = 0; i < def.steps; i++) {
        circuit.ensureSolverPrepared();
        results = circuit.solver.solve(circuit.dt, circuit.simTime);
        circuit.lastResults = results;
        if (!results.valid) break;
        circuit.solver.updateDynamicComponents(results.voltages);
        circuit.simTime += circuit.dt;
    }

    const componentCurrents = {};
    const componentVoltages = {};
    const componentNodeVoltages = {};
    const components = circuit.getAllComponents().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const comp of components) {
        const current = results.currents instanceof Map ? (results.currents.get(comp.id) || 0) : 0;
        componentCurrents[comp.id] = normalizeNumber(current);

        if (Array.isArray(comp.nodes)) {
            componentNodeVoltages[comp.id] = comp.nodes.map((nodeIndex) => {
                if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return 0;
                return normalizeNumber(results.voltages?.[nodeIndex] || 0);
            });
        } else {
            componentNodeVoltages[comp.id] = [];
        }

        const n1 = Array.isArray(comp.nodes) ? comp.nodes[0] : -1;
        const n2 = Array.isArray(comp.nodes) ? comp.nodes[1] : -1;
        const v1 = Number.isInteger(n1) && n1 >= 0 ? (results.voltages?.[n1] || 0) : 0;
        const v2 = Number.isInteger(n2) && n2 >= 0 ? (results.voltages?.[n2] || 0) : 0;
        componentVoltages[comp.id] = normalizeNumber(v1 - v2);
    }

    const wireCurrents = {};
    const wires = circuit.getAllWires().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const wire of wires) {
        const info = circuit.getWireCurrentInfo(wire, results);
        const signedCurrent = info
            ? (Number(info.flowDirection || 0) * Number(info.current || 0))
            : 0;
        wireCurrents[wire.id] = normalizeNumber(signedCurrent);
    }

    const nodeVoltages = Array.isArray(results.voltages)
        ? results.voltages.map((value) => normalizeNumber(value))
        : [];

    return {
        id: def.id,
        description: def.description,
        valid: !!results.valid,
        dt: def.dt,
        steps: def.steps,
        simTime: normalizeNumber(circuit.simTime, 9),
        components: components.length,
        wires: wires.length,
        nodes: circuit.nodes.length,
        nodeVoltages,
        componentCurrents,
        componentVoltages,
        componentNodeVoltages,
        wireCurrents
    };
}

export function runAllScenarios() {
    return P0_SCENARIO_DEFINITIONS.map((scenario) => runScenario(scenario));
}

function buildSnapshot() {
    const scenarios = runAllScenarios();
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        runtime: {
            node: process.version,
            platform: process.platform,
            absTolerance: ABS_TOL,
            relTolerance: REL_TOL
        },
        scenarioCount: scenarios.length,
        scenarios
    };
}

function flattenObject(value, prefix = '', output = new Map()) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const key = prefix ? `${prefix}[${i}]` : `[${i}]`;
            flattenObject(value[i], key, output);
        }
        return output;
    }

    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
        for (const key of keys) {
            const nextPrefix = prefix ? `${prefix}.${key}` : key;
            flattenObject(value[key], nextPrefix, output);
        }
        return output;
    }

    output.set(prefix, value);
    return output;
}

function withinTolerance(current, baseline) {
    const diff = Math.abs(current - baseline);
    if (diff <= ABS_TOL) return true;
    const baselineScale = Math.max(1, Math.abs(baseline));
    return diff <= baselineScale * REL_TOL;
}

function compareSnapshots(currentSnapshot, baselineSnapshot) {
    const errors = [];
    const baselineById = new Map((baselineSnapshot.scenarios || []).map((scenario) => [scenario.id, scenario]));
    const currentById = new Map((currentSnapshot.scenarios || []).map((scenario) => [scenario.id, scenario]));

    for (const scenarioId of baselineById.keys()) {
        if (!currentById.has(scenarioId)) {
            errors.push(`Missing scenario in current snapshot: ${scenarioId}`);
        }
    }
    for (const scenarioId of currentById.keys()) {
        if (!baselineById.has(scenarioId)) {
            errors.push(`New scenario not present in baseline: ${scenarioId}`);
        }
    }

    for (const [scenarioId, baselineScenario] of baselineById.entries()) {
        const currentScenario = currentById.get(scenarioId);
        if (!currentScenario) continue;

        const currentFlat = flattenObject(currentScenario);
        const baselineFlat = flattenObject(baselineScenario);
        const keys = new Set([...currentFlat.keys(), ...baselineFlat.keys()]);
        for (const key of keys) {
            if (!currentFlat.has(key)) {
                errors.push(`${scenarioId}:${key} missing in current snapshot`);
                continue;
            }
            if (!baselineFlat.has(key)) {
                errors.push(`${scenarioId}:${key} missing in baseline snapshot`);
                continue;
            }

            const currentValue = currentFlat.get(key);
            const baselineValue = baselineFlat.get(key);
            if (typeof currentValue === 'number' && typeof baselineValue === 'number') {
                if (!withinTolerance(currentValue, baselineValue)) {
                    errors.push(
                        `${scenarioId}:${key} drift current=${currentValue} baseline=${baselineValue}`
                    );
                }
                continue;
            }

            if (currentValue !== baselineValue) {
                errors.push(
                    `${scenarioId}:${key} changed current=${JSON.stringify(currentValue)} baseline=${JSON.stringify(baselineValue)}`
                );
            }
        }
    }

    return {
        passed: errors.length === 0,
        errors
    };
}

function makeMarkdownReport(snapshot, comparison) {
    const lines = [];
    lines.push('# P0 Electrical Baseline Report');
    lines.push('');
    lines.push(`- generatedAt: ${snapshot.generatedAt}`);
    lines.push(`- node: ${snapshot.runtime.node}`);
    lines.push(`- platform: ${snapshot.runtime.platform}`);
    lines.push(`- scenarios: ${snapshot.scenarioCount}`);
    lines.push(`- absTol: ${snapshot.runtime.absTolerance}`);
    lines.push(`- relTol: ${snapshot.runtime.relTolerance}`);
    lines.push(`- comparison: ${comparison ? (comparison.passed ? 'PASS' : 'FAIL') : 'SKIPPED (update mode)'}`);
    lines.push('');
    lines.push('## Scenario Validity');
    lines.push('');
    lines.push('| Scenario | Valid | Components | Wires | Nodes | simTime |');
    lines.push('|---|---|---:|---:|---:|---:|');
    for (const scenario of snapshot.scenarios) {
        lines.push(
            `| ${scenario.id} | ${scenario.valid ? 'yes' : 'no'} | ${scenario.components} | ${scenario.wires} | ${scenario.nodes} | ${scenario.simTime} |`
        );
    }

    if (comparison && !comparison.passed) {
        lines.push('');
        lines.push('## Drift Details');
        lines.push('');
        const maxErrors = 200;
        const listed = comparison.errors.slice(0, maxErrors);
        for (const error of listed) {
            lines.push(`- ${error}`);
        }
        if (comparison.errors.length > maxErrors) {
            lines.push(`- ... ${comparison.errors.length - maxErrors} more`);
        }
    }

    lines.push('');
    return `${lines.join('\n')}\n`;
}

function saveJson(filePath, payload) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    return {
        update: args.has('--update')
    };
}

export function runBaselineCli(options = {}) {
    const update = !!options.update;
    const snapshot = buildSnapshot();
    saveJson(CURRENT_SNAPSHOT_FILE, snapshot);

    if (update) {
        saveJson(BASELINE_FILE, snapshot);
        const report = makeMarkdownReport(snapshot, null);
        mkdirSync(dirname(DIFF_REPORT_FILE), { recursive: true });
        writeFileSync(DIFF_REPORT_FILE, report, 'utf8');
        console.log(`Updated baseline: ${BASELINE_FILE}`);
        console.log(`Current snapshot: ${CURRENT_SNAPSHOT_FILE}`);
        console.log(`Report: ${DIFF_REPORT_FILE}`);
        return 0;
    }

    if (!existsSync(BASELINE_FILE)) {
        const report = makeMarkdownReport(snapshot, {
            passed: false,
            errors: [`Baseline not found: ${BASELINE_FILE}`]
        });
        mkdirSync(dirname(DIFF_REPORT_FILE), { recursive: true });
        writeFileSync(DIFF_REPORT_FILE, report, 'utf8');
        console.error(`Baseline not found: ${BASELINE_FILE}`);
        console.error('Run with --update once to create baseline.');
        return 2;
    }

    const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    const comparison = compareSnapshots(snapshot, baseline);
    const report = makeMarkdownReport(snapshot, comparison);
    mkdirSync(dirname(DIFF_REPORT_FILE), { recursive: true });
    writeFileSync(DIFF_REPORT_FILE, report, 'utf8');

    if (!comparison.passed) {
        console.error(`Baseline comparison failed. driftCount=${comparison.errors.length}`);
        console.error(`Report: ${DIFF_REPORT_FILE}`);
        return 1;
    }

    console.log(`Baseline comparison passed. scenarios=${snapshot.scenarioCount}`);
    console.log(`Current snapshot: ${CURRENT_SNAPSHOT_FILE}`);
    console.log(`Report: ${DIFF_REPORT_FILE}`);
    return 0;
}

function main() {
    const args = parseArgs(process.argv);
    const code = runBaselineCli(args);
    process.exitCode = code;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
