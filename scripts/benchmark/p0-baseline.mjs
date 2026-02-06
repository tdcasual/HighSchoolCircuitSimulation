import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Circuit } from '../../src/engine/Circuit.js';
import { createComponent } from '../../src/components/Component.js';
import { getTerminalWorldPosition } from '../../src/utils/TerminalGeometry.js';
import { validateCircuitJSON } from '../../src/utils/circuitSchema.js';

const OUTPUT_DIR = new URL('../../output/benchmarks/', import.meta.url).pathname;

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
        throw new Error(`Invalid terminal positions for wire ${wireId}`);
    }
    circuit.addWire({
        id: wireId,
        a,
        b,
        aRef: { componentId: aComp.id, terminalIndex: aTerminalIndex },
        bRef: { componentId: bComp.id, terminalIndex: bTerminalIndex }
    });
}

function buildSeriesLoopScenario(resistorCount) {
    const circuit = new Circuit();
    const spacing = 120;
    const source = addComponent(circuit, 'PowerSource', 'V1', 0, 0, {
        voltage: 12,
        internalResistance: 0.5
    });

    const resistors = [];
    for (let i = 0; i < resistorCount; i++) {
        resistors.push(
            addComponent(circuit, 'Resistor', `R${i + 1}`, spacing * (i + 1), 0, {
                resistance: 100 + (i % 5) * 20
            })
        );
    }

    connectTerminals(circuit, 'W_source_to_r1', source, 1, resistors[0], 0);
    for (let i = 0; i < resistors.length - 1; i++) {
        connectTerminals(circuit, `W_r${i + 1}_to_r${i + 2}`, resistors[i], 1, resistors[i + 1], 0);
    }
    connectTerminals(circuit, 'W_loop_return', resistors[resistors.length - 1], 1, source, 0);

    return circuit;
}

function buildConflictingIdealSourceScenario() {
    const circuit = new Circuit();
    const v1 = addComponent(circuit, 'PowerSource', 'V1', 0, 0, {
        voltage: 5,
        internalResistance: 0
    });
    const v2 = addComponent(circuit, 'PowerSource', 'V2', 160, 0, {
        voltage: 9,
        internalResistance: 0
    });
    const r1 = addComponent(circuit, 'Resistor', 'R1', 80, 120, {
        resistance: 10
    });

    connectTerminals(circuit, 'W_pos_bus', v1, 0, v2, 0);
    connectTerminals(circuit, 'W_neg_bus', v1, 1, v2, 1);
    connectTerminals(circuit, 'W_v1_pos_to_r', v1, 0, r1, 0);
    connectTerminals(circuit, 'W_v1_neg_to_r', v1, 1, r1, 1);

    return circuit;
}

function summarize(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, value) => acc + value, 0);
    const pick = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
    return {
        avg: sum / samples.length,
        p50: pick(0.5),
        p95: pick(0.95),
        min: sorted[0],
        max: sorted[sorted.length - 1]
    };
}

function benchmark(label, iterations, fn) {
    for (let i = 0; i < 8; i++) {
        fn(i, true);
    }
    const samples = [];
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn(i, false);
        samples.push(performance.now() - t0);
    }
    return { label, iterations, ...summarize(samples) };
}

function withMutedWarnings(fn) {
    const original = console.warn;
    console.warn = () => {};
    try {
        return fn();
    } finally {
        console.warn = original;
    }
}

function runScenarioBenchmarks({ name, resistorCount, importIterations, rebuildIterations, solveIterations, stepIterations }) {
    const templateCircuit = buildSeriesLoopScenario(resistorCount);
    const json = templateCircuit.toJSON();
    validateCircuitJSON(json);

    const importMetric = benchmark(`${name}:import`, importIterations, () => {
        const circuit = new Circuit();
        circuit.fromJSON(json);
    });

    const rebuildCircuit = new Circuit();
    rebuildCircuit.fromJSON(json);
    const rebuildMetric = benchmark(`${name}:rebuildNodes`, rebuildIterations, () => {
        rebuildCircuit.rebuildNodes();
    });

    const solveCircuit = new Circuit();
    solveCircuit.fromJSON(json);
    let invalidSolveCount = 0;
    const solveMetric = withMutedWarnings(() =>
        benchmark(`${name}:solve`, solveIterations, (_index, isWarmup) => {
            solveCircuit.solver.setCircuit(Array.from(solveCircuit.components.values()), solveCircuit.nodes);
            const result = solveCircuit.solver.solve(solveCircuit.dt);
            if (!isWarmup && !result.valid) invalidSolveCount += 1;
        })
    );

    const stepCircuit = new Circuit();
    stepCircuit.fromJSON(json);
    stepCircuit.isRunning = true;
    let invalidStepCount = 0;
    const stepMetric = withMutedWarnings(() =>
        benchmark(`${name}:step`, stepIterations, (_index, isWarmup) => {
            stepCircuit.step();
            if (!isWarmup && !stepCircuit.lastResults?.valid) invalidStepCount += 1;
        })
    );
    stepCircuit.isRunning = false;

    return {
        name,
        resistorCount,
        components: json.components.length,
        wires: json.wires.length,
        nodes: templateCircuit.nodes.length,
        metrics: {
            importMs: importMetric,
            rebuildMs: rebuildMetric,
            solveMs: solveMetric,
            stepMs: stepMetric
        },
        invalidRates: {
            solveInvalidRate: invalidSolveCount / solveIterations,
            stepInvalidRate: invalidStepCount / stepIterations
        }
    };
}

function runAdversarialSingularBenchmark(iterations) {
    const circuit = buildConflictingIdealSourceScenario();
    let invalid = 0;
    const metric = withMutedWarnings(() =>
        benchmark('adversarial:conflictingIdealSource', iterations, (_index, isWarmup) => {
            circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
            const result = circuit.solver.solve(circuit.dt);
            if (!isWarmup && !result.valid) invalid += 1;
        })
    );
    return {
        scenario: 'conflicting_ideal_sources',
        iterations,
        invalidRate: invalid / iterations,
        solveMs: metric
    };
}

function toMs(value) {
    return value.toFixed(4);
}

function makeMarkdownReport(result) {
    const lines = [];
    lines.push('# P0 Baseline Benchmark');
    lines.push('');
    lines.push(`- generatedAt: ${result.generatedAt}`);
    lines.push(`- node: ${result.runtime.node}`);
    lines.push(`- platform: ${result.runtime.platform}`);
    lines.push('');
    lines.push('## Scenario Metrics');
    lines.push('');
    lines.push('| Scenario | Components | Wires | Nodes | Import avg ms | Rebuild avg ms | Solve avg ms | Step avg ms | Solve invalid rate | Step invalid rate |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const scenario of result.scenarios) {
        lines.push(
            `| ${scenario.name} | ${scenario.components} | ${scenario.wires} | ${scenario.nodes} | ${toMs(scenario.metrics.importMs.avg)} | ${toMs(scenario.metrics.rebuildMs.avg)} | ${toMs(scenario.metrics.solveMs.avg)} | ${toMs(scenario.metrics.stepMs.avg)} | ${(scenario.invalidRates.solveInvalidRate * 100).toFixed(2)}% | ${(scenario.invalidRates.stepInvalidRate * 100).toFixed(2)}% |`
        );
    }
    lines.push('');
    lines.push('## Adversarial');
    lines.push('');
    lines.push('| Scenario | Iterations | Invalid rate | Solve avg ms |');
    lines.push('|---|---:|---:|---:|');
    lines.push(
        `| ${result.adversarial.scenario} | ${result.adversarial.iterations} | ${(result.adversarial.invalidRate * 100).toFixed(2)}% | ${toMs(result.adversarial.solveMs.avg)} |`
    );
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- normalScenarioMaxStepAvgMs: ${toMs(result.summary.normalScenarioMaxStepAvgMs)}`);
    lines.push(`- normalScenarioMaxSolveAvgMs: ${toMs(result.summary.normalScenarioMaxSolveAvgMs)}`);
    lines.push(`- normalScenarioMaxInvalidRate: ${(result.summary.normalScenarioMaxInvalidRate * 100).toFixed(2)}%`);
    lines.push(`- adversarialInvalidRate: ${(result.summary.adversarialInvalidRate * 100).toFixed(2)}%`);
    return `${lines.join('\n')}\n`;
}

function main() {
    const scenarioConfigs = [
        {
            name: 'series_20',
            resistorCount: 20,
            importIterations: 60,
            rebuildIterations: 220,
            solveIterations: 320,
            stepIterations: 220
        },
        {
            name: 'series_60',
            resistorCount: 60,
            importIterations: 40,
            rebuildIterations: 180,
            solveIterations: 260,
            stepIterations: 180
        },
        {
            name: 'series_120',
            resistorCount: 120,
            importIterations: 24,
            rebuildIterations: 120,
            solveIterations: 140,
            stepIterations: 120
        }
    ];

    const scenarios = scenarioConfigs.map((config) => runScenarioBenchmarks(config));
    const adversarial = runAdversarialSingularBenchmark(120);

    const summary = {
        normalScenarioMaxStepAvgMs: Math.max(...scenarios.map((item) => item.metrics.stepMs.avg)),
        normalScenarioMaxSolveAvgMs: Math.max(...scenarios.map((item) => item.metrics.solveMs.avg)),
        normalScenarioMaxInvalidRate: Math.max(
            ...scenarios.map((item) => Math.max(item.invalidRates.solveInvalidRate, item.invalidRates.stepInvalidRate))
        ),
        adversarialInvalidRate: adversarial.invalidRate
    };

    const result = {
        generatedAt: new Date().toISOString(),
        runtime: {
            node: process.version,
            platform: `${process.platform} ${process.arch}`
        },
        scenarios,
        adversarial,
        summary
    };

    mkdirSync(OUTPUT_DIR, { recursive: true });

    const jsonPath = `${OUTPUT_DIR}p0-baseline.json`;
    const mdPath = `${OUTPUT_DIR}p0-baseline.md`;
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    writeFileSync(mdPath, makeMarkdownReport(result));

    console.log(`Wrote benchmark JSON: ${jsonPath}`);
    console.log(`Wrote benchmark Markdown: ${mdPath}`);
}

main();
