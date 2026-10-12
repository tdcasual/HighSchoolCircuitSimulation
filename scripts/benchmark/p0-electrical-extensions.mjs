import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addComponent, connectWire, createTestCircuit } from '../../tests/helpers/circuitTestUtils.js';
import { createInjectedSolverBackend } from '../../src/v2/app/createInjectedSolverBackend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');
const OUTPUT_DIR = resolve(ROOT_DIR, 'output/baselines');
const BASELINE_FILE = resolve(__dirname, 'baselines/p0-electrical-extensions-baseline.json');
const CURRENT_SNAPSHOT_FILE = resolve(OUTPUT_DIR, 'p0-electrical-extensions-current.json');
const DIFF_REPORT_FILE = resolve(OUTPUT_DIR, 'p0-electrical-extensions-diff.md');
const ABS_TOL = Number.isFinite(Number(process.env.P0_EXT_BASELINE_ABS_TOL))
    ? Number(process.env.P0_EXT_BASELINE_ABS_TOL)
    : 1e-6;
const REL_TOL = Number.isFinite(Number(process.env.P0_EXT_BASELINE_REL_TOL))
    ? Number(process.env.P0_EXT_BASELINE_REL_TOL)
    : 1e-3;

const RUNNER_DC_SOLVE = 'dc-solve';
const RUNNER_PRODUCTION_TICK = 'production-tick';

function normalizeNumber(value, digits = 12) {
    if (!Number.isFinite(value)) return 0;
    const normalized = Number(value.toFixed(digits));
    return Math.abs(normalized) < 1e-15 ? 0 : normalized;
}

function createScenario(id, description, buildFn, options = {}) {
    return {
        id,
        description,
        build: buildFn,
        dt: Number.isFinite(options.dt) ? options.dt : 0.01,
        steps: Number.isFinite(options.steps) ? Math.max(1, Math.floor(options.steps)) : 1,
        initialSimTime: Number.isFinite(options.initialSimTime) ? options.initialSimTime : 0,
        runner: options.runner === RUNNER_PRODUCTION_TICK ? RUNNER_PRODUCTION_TICK : RUNNER_DC_SOLVE
    };
}

export const P0_EXT_SCENARIO_DEFINITIONS = [
    createScenario('motor_stall', '6V ideal source + 5Ω motor armature stall', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        addComponent(circuit, 'Motor', 'M1', { resistance: 5 });
        connectWire(circuit, 'W1', v1, 0, 'M1', 0);
        connectWire(circuit, 'W2', 'M1', 1, v1, 1);
        return circuit;
    }),
    createScenario(
        'ac_resistor_rms',
        '50Hz 10Vrms AC + 10Ω resistor RMS via production ticks',
        () => {
            const circuit = createTestCircuit();
            const vac = addComponent(circuit, 'ACVoltageSource', 'VAC', {
                rmsVoltage: 10,
                frequency: 50,
                phase: 0,
                offset: 0,
                internalResistance: 0
            });
            addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
            connectWire(circuit, 'W1', vac, 0, 'R1', 0);
            connectWire(circuit, 'W2', 'R1', 1, vac, 1);
            return circuit;
        },
        { runner: RUNNER_PRODUCTION_TICK, steps: 4, dt: 0.01 }
    ),
    createScenario('diode_forward', 'Forward-biased diode with 5V / 100Ω', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        addComponent(circuit, 'Diode', 'D1');
        addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', v1, 0, 'D1', 0);
        connectWire(circuit, 'W2', 'D1', 1, 'R1', 0);
        connectWire(circuit, 'W3', 'R1', 1, v1, 1);
        return circuit;
    }),
    createScenario('diode_reverse', 'Reverse-biased diode leakage with 5V / 100Ω', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        addComponent(circuit, 'Diode', 'D1');
        addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', v1, 0, 'D1', 1);
        connectWire(circuit, 'W2', 'D1', 0, 'R1', 0);
        connectWire(circuit, 'W3', 'R1', 1, v1, 1);
        return circuit;
    }),
    createScenario('switch_closed_6v10', 'Closed switch 6V / 10Ω series', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        addComponent(circuit, 'Switch', 'S1', { closed: true });
        connectWire(circuit, 'W1', v1, 0, 'R1', 0);
        connectWire(circuit, 'W2', 'R1', 1, 'S1', 0);
        connectWire(circuit, 'W3', 'S1', 1, v1, 1);
        return circuit;
    }),
    createScenario('switch_open_6v10', 'Open switch 6V / 10Ω series', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        addComponent(circuit, 'Switch', 'S1', { closed: false });
        connectWire(circuit, 'W1', v1, 0, 'R1', 0);
        connectWire(circuit, 'W2', 'R1', 1, 'S1', 0);
        connectWire(circuit, 'W3', 'S1', 1, v1, 1);
        return circuit;
    })
];

function collectSnapshotFields(circuit, results, def) {
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

function accumulateRmsSample(circuit, voltages, currents, buckets) {
    buckets.sampleCount += 1;
    for (const comp of circuit.getAllComponents()) {
        const current = currents instanceof Map ? (currents.get(comp.id) || 0) : 0;
        buckets.sumSqCurrent[comp.id] = (buckets.sumSqCurrent[comp.id] || 0) + current * current;
        const n1 = Array.isArray(comp.nodes) ? comp.nodes[0] : -1;
        const n2 = Array.isArray(comp.nodes) ? comp.nodes[1] : -1;
        const v1 = Number.isInteger(n1) && n1 >= 0 ? (voltages?.[n1] || 0) : 0;
        const v2 = Number.isInteger(n2) && n2 >= 0 ? (voltages?.[n2] || 0) : 0;
        const voltage = v1 - v2;
        buckets.sumSqVoltage[comp.id] = (buckets.sumSqVoltage[comp.id] || 0) + voltage * voltage;
    }
}

function runProductionTickScenario(def) {
    const circuit = def.build();
    circuit.solverBackend = createInjectedSolverBackend();
    circuit.dt = def.dt;
    const buckets = {
        sumSqCurrent: {},
        sumSqVoltage: {},
        sampleCount: 0
    };
    // V2 success skips V1 updateDynamicComponents; sample solveFrame per substep instead.
    const backend = circuit.solverBackend;
    const originalSolveFrame = backend.solveFrame.bind(backend);
    backend.solveFrame = (input) => {
        const result = originalSolveFrame(input);
        if (result?.valid) {
            accumulateRmsSample(circuit, result.voltages, result.currents, buckets);
        }
        return result;
    };
    const solver = circuit.solver;
    const originalUpdate = solver.updateDynamicComponents.bind(solver);
    solver.updateDynamicComponents = (voltages, currents) => {
        accumulateRmsSample(circuit, voltages, currents, buckets);
        return originalUpdate(voltages, currents);
    };

    try {
        circuit.prepareSimulation();
        for (let i = 0; i < def.steps; i++) {
            circuit.step();
            if (!circuit.lastResults?.valid) break;
        }
        circuit.haltSimulation();
    } finally {
        solver.updateDynamicComponents = originalUpdate;
        backend.solveFrame = originalSolveFrame;
    }

    const results = circuit.lastResults || { valid: false, voltages: [], currents: new Map() };
    const snapshot = collectSnapshotFields(circuit, results, def);
    const n = buckets.sampleCount > 0 ? buckets.sampleCount : 1;
    const componentRmsCurrents = {};
    const componentRmsVoltages = {};
    for (const id of Object.keys(buckets.sumSqCurrent).sort((a, b) => a.localeCompare(b))) {
        componentRmsCurrents[id] = normalizeNumber(Math.sqrt(buckets.sumSqCurrent[id] / n));
    }
    for (const id of Object.keys(buckets.sumSqVoltage).sort((a, b) => a.localeCompare(b))) {
        componentRmsVoltages[id] = normalizeNumber(Math.sqrt(buckets.sumSqVoltage[id] / n));
    }
    snapshot.runner = RUNNER_PRODUCTION_TICK;
    snapshot.substepCount = circuit.getSimulationSubstepCount(def.dt);
    snapshot.sampleCount = buckets.sampleCount;
    snapshot.componentRmsCurrents = componentRmsCurrents;
    snapshot.componentRmsVoltages = componentRmsVoltages;
    return snapshot;
}

function runDcSolveScenario(def) {
    const circuit = def.build();
    circuit.solverBackend = createInjectedSolverBackend();
    circuit.dt = def.dt;
    circuit.prepareSimulation();
    if (Number.isFinite(def.initialSimTime) && def.initialSimTime !== 0) {
        circuit.simTime = def.initialSimTime;
    }
    for (let i = 0; i < def.steps; i++) {
        circuit.step();
        if (!circuit.lastResults?.valid) break;
    }
    circuit.haltSimulation();
    const results = circuit.lastResults || { valid: false, voltages: [], currents: new Map() };
    const snapshot = collectSnapshotFields(circuit, results, def);
    snapshot.runner = RUNNER_DC_SOLVE;
    return snapshot;
}

function runScenario(def) {
    if (def.runner === RUNNER_PRODUCTION_TICK) {
        return runProductionTickScenario(def);
    }
    return runDcSolveScenario(def);
}

export function runAllScenarios() {
    return P0_EXT_SCENARIO_DEFINITIONS.map((scenario) => runScenario(scenario));
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
    lines.push('# P0 Electrical Extensions Baseline Report');
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
    lines.push('| Scenario | Runner | Valid | Components | Wires | Nodes | simTime |');
    lines.push('|---|---|---|---:|---:|---:|---:|');
    for (const scenario of snapshot.scenarios) {
        lines.push(
            `| ${scenario.id} | ${scenario.runner || ''} | ${scenario.valid ? 'yes' : 'no'} | ${scenario.components} | ${scenario.wires} | ${scenario.nodes} | ${scenario.simTime} |`
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
    const baselineFile = options.baselineFile || BASELINE_FILE;
    const snapshot = buildSnapshot();
    saveJson(CURRENT_SNAPSHOT_FILE, snapshot);

    if (update) {
        saveJson(baselineFile, snapshot);
        const report = makeMarkdownReport(snapshot, null);
        mkdirSync(dirname(DIFF_REPORT_FILE), { recursive: true });
        writeFileSync(DIFF_REPORT_FILE, report, 'utf8');
        console.log(`Updated baseline: ${baselineFile}`);
        console.log(`Current snapshot: ${CURRENT_SNAPSHOT_FILE}`);
        console.log(`Report: ${DIFF_REPORT_FILE}`);
        return 0;
    }

    if (!existsSync(baselineFile)) {
        const report = makeMarkdownReport(snapshot, {
            passed: false,
            errors: [`Baseline not found: ${baselineFile}`]
        });
        mkdirSync(dirname(DIFF_REPORT_FILE), { recursive: true });
        writeFileSync(DIFF_REPORT_FILE, report, 'utf8');
        console.error(`Baseline not found: ${baselineFile}`);
        console.error('Run with --update once to create baseline.');
        return 2;
    }

    const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
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
