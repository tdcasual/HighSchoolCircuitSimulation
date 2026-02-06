import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Circuit } from '../../src/engine/Circuit.js';
import { createComponent } from '../../src/components/Component.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');
const REFERENCE_CIRCUIT_DIR = resolve(
    ROOT_DIR,
    '_reference/circuitjs1/src/com/lushprojects/circuitjs1/public/circuits'
);
const FIXTURE_CIRCUIT_DIR = resolve(__dirname, 'circuitjs-fixtures');

const OUTPUT_DIR = resolve(ROOT_DIR, 'output/baselines');
const BASELINE_FILE = resolve(__dirname, 'baselines/circuitjs-golden-10-baseline.json');
const CURRENT_SNAPSHOT_FILE = resolve(OUTPUT_DIR, 'circuitjs-golden-10-current.json');
const DIFF_REPORT_FILE = resolve(OUTPUT_DIR, 'circuitjs-golden-10-diff.md');

const ABS_TOL = Number.isFinite(Number(process.env.CIRCUITJS_BASELINE_ABS_TOL))
    ? Number(process.env.CIRCUITJS_BASELINE_ABS_TOL)
    : 1e-6;
const REL_TOL = Number.isFinite(Number(process.env.CIRCUITJS_BASELINE_REL_TOL))
    ? Number(process.env.CIRCUITJS_BASELINE_REL_TOL)
    : 1e-3;

function normalizeNumber(value, digits = 12) {
    if (!Number.isFinite(value)) return 0;
    const normalized = Number(value.toFixed(digits));
    return Math.abs(normalized) < 1e-15 ? 0 : normalized;
}

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function coordinateKey(point) {
    if (!point) return '';
    return `${point.x},${point.y}`;
}

function worldToLocal(rotation, dx, dy) {
    const rot = ((rotation % 360) + 360) % 360;
    switch (rot) {
        case 0:
            return { x: dx, y: dy };
        case 90:
            return { x: dy, y: -dx };
        case 180:
            return { x: -dx, y: -dy };
        case 270:
            return { x: -dy, y: dx };
        default:
            return { x: dx, y: dy };
    }
}

function buildTerminalExtensions(center, rotation, endA, endB) {
    const base0 = { x: -30, y: 0 };
    const base1 = { x: 30, y: 0 };
    const local0 = worldToLocal(rotation, endA.x - center.x, endA.y - center.y);
    const local1 = worldToLocal(rotation, endB.x - center.x, endB.y - center.y);
    return {
        0: {
            x: Math.round(local0.x - base0.x),
            y: Math.round(local0.y - base0.y)
        },
        1: {
            x: Math.round(local1.x - base1.x),
            y: Math.round(local1.y - base1.y)
        }
    };
}

function resolveScenarioText(fileName) {
    const candidatePaths = [
        resolve(REFERENCE_CIRCUIT_DIR, fileName),
        resolve(FIXTURE_CIRCUIT_DIR, fileName)
    ];
    for (const candidatePath of candidatePaths) {
        if (existsSync(candidatePath)) {
            return {
                text: readFileSync(candidatePath, 'utf8'),
                sourcePath: candidatePath
            };
        }
    }
    throw new Error(`Missing CircuitJS fixture: ${fileName}`);
}

function parseVoltageSource(tokens) {
    const waveform = Math.round(safeNumber(tokens[6], 0));
    const frequency = safeNumber(tokens[7], 40);
    const maxVoltage = safeNumber(tokens[8], 5);
    const bias = safeNumber(tokens[9], 0);
    const phaseShiftRad = safeNumber(tokens[10], 0);

    if (waveform === 0) {
        return {
            type: 'PowerSource',
            properties: {
                voltage: maxVoltage + bias,
                internalResistance: 0
            }
        };
    }

    if (waveform === 1) {
        return {
            type: 'ACVoltageSource',
            properties: {
                rmsVoltage: Math.abs(maxVoltage) / Math.sqrt(2),
                frequency: Math.max(0, frequency),
                phase: phaseShiftRad * 180 / Math.PI,
                offset: bias,
                internalResistance: 0
            }
        };
    }

    return null;
}

function parseSwitch(tokens) {
    const rawPosition = tokens[6];
    let position = 1;
    if (rawPosition === 'true') {
        position = 1;
    } else if (rawPosition === 'false') {
        position = 0;
    } else {
        position = Math.round(safeNumber(rawPosition, 1));
    }
    return {
        type: 'Switch',
        properties: {
            closed: position === 0
        }
    };
}

function parseComponentRecord(kind, tokens) {
    switch (kind) {
        case 'r':
            return {
                type: 'Resistor',
                properties: {
                    resistance: Math.max(1e-9, safeNumber(tokens[6], 1000))
                }
            };
        case 'c':
            return {
                type: 'Capacitor',
                properties: {
                    capacitance: Math.max(1e-12, safeNumber(tokens[6], 1e-5))
                }
            };
        case 'l':
            return {
                type: 'Inductor',
                properties: {
                    inductance: Math.max(1e-9, safeNumber(tokens[6], 1)),
                    initialCurrent: safeNumber(tokens[7], 0)
                }
            };
        case 'v':
            return parseVoltageSource(tokens);
        case 's':
            return parseSwitch(tokens);
        default:
            return null;
    }
}

function makePoint(tokens, indexOffset) {
    return {
        x: Math.round(safeNumber(tokens[indexOffset], 0)),
        y: Math.round(safeNumber(tokens[indexOffset + 1], 0))
    };
}

function buildCircuitFromCircuitJsText(text, scenarioId) {
    const circuit = new Circuit();
    const unsupportedElements = [];
    const skippedMetadata = [];
    const totalElementKinds = new Map();
    const componentCounters = new Map();
    let wireCounter = 0;

    const lines = String(text || '').split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const tokens = line.split(/\s+/);
        if (tokens.length === 0) continue;

        const kind = tokens[0];
        totalElementKinds.set(kind, (totalElementKinds.get(kind) || 0) + 1);

        if (kind === '$' || kind === 'o' || kind === 'h' || kind === 'O' || kind === '&') {
            skippedMetadata.push(kind);
            continue;
        }

        if (kind === 'w') {
            const a = makePoint(tokens, 1);
            const b = makePoint(tokens, 3);
            wireCounter += 1;
            const wireId = `${scenarioId}_W${wireCounter}`;
            circuit.addWire({ id: wireId, a, b });
            continue;
        }

        if (kind === 'g') {
            const terminal = makePoint(tokens, 1);
            const component = createComponent(
                'Ground',
                terminal.x,
                terminal.y + 20,
                `${scenarioId}_Ground_${(componentCounters.get('Ground') || 0) + 1}`
            );
            componentCounters.set('Ground', (componentCounters.get('Ground') || 0) + 1);
            component.rotation = 0;
            circuit.addComponent(component);
            continue;
        }

        const record = parseComponentRecord(kind, tokens);
        if (!record) {
            unsupportedElements.push({
                kind,
                line
            });
            continue;
        }

        const endA = makePoint(tokens, 1);
        const endB = makePoint(tokens, 3);
        const center = {
            x: Math.round((endA.x + endB.x) / 2),
            y: Math.round((endA.y + endB.y) / 2)
        };
        const rotation = 0;
        const componentIndex = (componentCounters.get(record.type) || 0) + 1;
        componentCounters.set(record.type, componentIndex);
        const componentId = `${scenarioId}_${record.type}_${componentIndex}`;
        const component = createComponent(record.type, center.x, center.y, componentId);
        component.rotation = rotation;
        Object.assign(component, record.properties || {});
        component.terminalExtensions = buildTerminalExtensions(center, rotation, endA, endB);
        circuit.addComponent(component);
    }

    circuit.rebuildNodes();
    return {
        circuit,
        conversion: {
            unsupportedElements,
            skippedMetadata: Array.from(new Set(skippedMetadata)),
            elementKindHistogram: Object.fromEntries(
                Array.from(totalElementKinds.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            )
        }
    };
}

function createScenarioDefinition(id, sourceFile, description, options = {}) {
    return {
        id,
        sourceFile,
        description,
        dt: Number.isFinite(options.dt) ? options.dt : 0.01,
        steps: Number.isFinite(options.steps) ? Math.max(1, Math.floor(options.steps)) : 1,
        initialSimTime: Number.isFinite(options.initialSimTime) ? options.initialSimTime : 0
    };
}

export const CIRCUITJS_GOLDEN_SCENARIO_DEFINITIONS = [
    createScenarioDefinition('cjs_resistors', 'resistors.txt', 'Resistor network with multiple switches'),
    createScenarioDefinition('cjs_voltdivide', 'voltdivide.txt', 'Voltage divider (2 and 4 resistor ladders)'),
    createScenarioDefinition('cjs_capac', 'capac.txt', 'RC circuit with capacitor'),
    createScenarioDefinition('cjs_inductac', 'inductac.txt', 'RL AC circuit with inductor'),
    createScenarioDefinition('cjs_capmultcaps', 'capmultcaps.txt', 'Capacitors with multiple capacitances'),
    createScenarioDefinition('cjs_indmultind', 'indmultind.txt', 'Inductors with multiple inductances'),
    createScenarioDefinition('cjs_indmultfreq', 'indmultfreq.txt', 'Inductor response under multiple frequencies'),
    createScenarioDefinition('cjs_res_series', 'res-series.txt', 'Series RLC resonance variants'),
    createScenarioDefinition('cjs_powerfactor1', 'powerfactor1.txt', 'Power factor baseline RL load'),
    createScenarioDefinition('cjs_powerfactor2', 'powerfactor2.txt', 'Power factor corrected RLC load')
];

function runScenario(def) {
    const { text, sourcePath } = resolveScenarioText(def.sourceFile);
    const { circuit, conversion } = buildCircuitFromCircuitJsText(text, def.id);

    circuit.dt = def.dt;
    circuit.simTime = def.initialSimTime;

    let results = { valid: false, voltages: [], currents: new Map() };
    for (let i = 0; i < def.steps; i++) {
        circuit.ensureSolverPrepared();
        results = circuit.solver.solve(circuit.dt, circuit.simTime);
        circuit.lastResults = results;
        if (!results.valid) break;
        circuit.solver.updateDynamicComponents(results.voltages, results.currents);
        circuit.simTime += circuit.dt;
    }

    const components = circuit.getAllComponents().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const wires = circuit.getAllWires().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const componentCurrents = {};
    const componentVoltages = {};
    for (const comp of components) {
        const current = results.currents instanceof Map ? (results.currents.get(comp.id) || 0) : 0;
        componentCurrents[comp.id] = normalizeNumber(current);
        const n1 = Array.isArray(comp.nodes) ? comp.nodes[0] : -1;
        const n2 = Array.isArray(comp.nodes) ? comp.nodes[1] : -1;
        const v1 = Number.isInteger(n1) && n1 >= 0 ? (results.voltages?.[n1] || 0) : 0;
        const v2 = Number.isInteger(n2) && n2 >= 0 ? (results.voltages?.[n2] || 0) : 0;
        componentVoltages[comp.id] = normalizeNumber(v1 - v2);
    }

    const wireCurrents = {};
    for (const wire of wires) {
        const info = circuit.getWireCurrentInfo(wire, results);
        const signedCurrent = info ? (Number(info.flowDirection || 0) * Number(info.current || 0)) : 0;
        wireCurrents[wire.id] = normalizeNumber(signedCurrent);
    }

    const nodeVoltages = Array.isArray(results.voltages)
        ? results.voltages.map((value) => normalizeNumber(value))
        : [];

    return {
        id: def.id,
        sourceFile: def.sourceFile,
        sourcePath,
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
        wireCurrents,
        conversion
    };
}

export function runCircuitJsGoldenScenarios() {
    return CIRCUITJS_GOLDEN_SCENARIO_DEFINITIONS.map((scenario) => runScenario(scenario));
}

function buildSnapshot() {
    const scenarios = runCircuitJsGoldenScenarios();
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
    lines.push('# CircuitJS Golden Regression Report');
    lines.push('');
    lines.push(`- generatedAt: ${snapshot.generatedAt}`);
    lines.push(`- node: ${snapshot.runtime.node}`);
    lines.push(`- platform: ${snapshot.runtime.platform}`);
    lines.push(`- scenarios: ${snapshot.scenarioCount}`);
    lines.push(`- absTol: ${snapshot.runtime.absTolerance}`);
    lines.push(`- relTol: ${snapshot.runtime.relTolerance}`);
    lines.push(`- comparison: ${comparison ? (comparison.passed ? 'PASS' : 'FAIL') : 'SKIPPED (update mode)'}`);
    lines.push('');
    lines.push('| Scenario | Source | Valid | Components | Wires | Nodes | Unsupported |');
    lines.push('|---|---|---|---:|---:|---:|---:|');
    for (const scenario of snapshot.scenarios) {
        lines.push(
            `| ${scenario.id} | ${scenario.sourceFile} | ${scenario.valid ? 'yes' : 'no'} | ${scenario.components} | ${scenario.wires} | ${scenario.nodes} | ${scenario.conversion.unsupportedElements.length} |`
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

export function runCircuitJsBaselineCli(options = {}) {
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
    const code = runCircuitJsBaselineCli(args);
    process.exitCode = code;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
