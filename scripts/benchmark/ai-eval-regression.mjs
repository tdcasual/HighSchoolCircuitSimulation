import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Circuit } from '../../src/engine/Circuit.js';
import { CircuitExplainer } from '../../src/ai/CircuitExplainer.js';
import { CircuitAIAgent } from '../../src/ai/agent/CircuitAIAgent.js';
import { ClaimExtractSkill } from '../../src/ai/skills/ClaimExtractSkill.js';
import { NumericCheckSkill } from '../../src/ai/skills/NumericCheckSkill.js';
import { OpenAIClient } from '../../src/ai/OpenAIClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');
const SCENARIO_DIR = resolve(__dirname, 'ai-eval-scenarios');
const OUTPUT_DIR = resolve(ROOT_DIR, 'output/baselines');
const BASELINE_FILE = resolve(__dirname, 'baselines/ai-eval-baseline.json');
const CURRENT_SNAPSHOT_FILE = resolve(OUTPUT_DIR, 'ai-eval-current.json');
const DIFF_REPORT_FILE = resolve(OUTPUT_DIR, 'ai-eval-diff.md');

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeToken(value) {
    return String(value || '').trim().toUpperCase();
}

function formatValue(value, unit) {
    const n = Math.abs(safeNumber(value, 0));
    return `${n.toFixed(3)}${unit}`;
}

function listScenarioFiles() {
    if (!existsSync(SCENARIO_DIR)) return [];
    return readdirSync(SCENARIO_DIR)
        .filter((name) => extname(name).toLowerCase() === '.json')
        .sort((left, right) => left.localeCompare(right));
}

function loadScenario(fileName) {
    const filePath = resolve(SCENARIO_DIR, fileName);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    return {
        ...data,
        fileName
    };
}

function loadScenarios() {
    return listScenarioFiles().map(loadScenario);
}

export const AI_EVAL_SCENARIO_FILES = listScenarioFiles();

function refreshCircuitReadings(circuit) {
    circuit.rebuildNodes();
    circuit.ensureSolverPrepared();
    const dt = Math.max(1e-6, safeNumber(circuit.dt, 0.01));
    const simTime = safeNumber(circuit.simTime, 0);
    const results = circuit.solver.solve(dt, simTime);
    circuit.lastResults = results;
    if (results?.valid) {
        circuit.solver.updateDynamicComponents(results.voltages, results.currents);
    }
    return !!results?.valid;
}

function pickComponentsForQuestion(circuit, questionText) {
    const normalizedQuestion = normalizeToken(questionText);
    const components = Array.from(circuit.components.values()).filter(Boolean);
    const scored = components.map((component) => {
        const label = normalizeToken(component.label || component.id);
        const mention = label && normalizedQuestion.includes(label) ? 10 : 0;
        const weight = Math.abs(safeNumber(component.powerValue, 0))
            + Math.abs(safeNumber(component.voltageValue, 0))
            + Math.abs(safeNumber(component.currentValue, 0));
        return {
            component,
            score: mention + weight
        };
    }).sort((left, right) => right.score - left.score);
    return scored.slice(0, 2).map((item) => item.component);
}

function buildMockAnswer(circuit, questionText) {
    const components = pickComponentsForQuestion(circuit, questionText);
    if (components.length === 0) {
        return [
            '## 结论',
            '当前电路为空，无法给出数值结论。',
            '## 推理步骤',
            '1. 未检测到元件。',
            '2. 请先构建电路后再提问。'
        ].join('\n');
    }

    const evidenceLines = [];
    for (const component of components) {
        const label = component.label || component.id;
        evidenceLines.push(`- ${label} 电流约 ${formatValue(component.currentValue, 'A')}`);
        evidenceLines.push(`- ${label} 电压约 ${formatValue(component.voltageValue, 'V')}`);
        evidenceLines.push(`- ${label} 功率约 ${formatValue(component.powerValue, 'W')}`);
    }

    return [
        '## 结论',
        '依据仿真读数，可以给出该问题的主要量值。',
        '## 推理步骤',
        '1. 先确认相关支路与元件连接关系。',
        '2. 读取对应元件的电流、电压、功率。',
        '3. 使用欧姆定律与功率关系进行交叉核对。',
        '## 关键证据值',
        ...evidenceLines.slice(0, 6),
        '## 公式依据',
        '- 欧姆定律：I=U/R',
        '- 功率关系：P=UI'
    ].join('\n');
}

function createMockAiClient(circuit) {
    return {
        config: {
            apiKey: 'mock-key',
            textModel: 'mock-text-model',
            visionModel: 'mock-vision-model'
        },
        async callAPI(messages = []) {
            const userMessage = [...messages]
                .reverse()
                .find((message) => message?.role === 'user' && typeof message?.content === 'string');
            const questionText = String(userMessage?.content || '').trim();
            return buildMockAnswer(circuit, questionText);
        },
        async getCircuitConversionPrompt() {
            return '';
        }
    };
}

function createLiveAiClient() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
    if (!apiKey) {
        throw new Error('LIVE 模式需要 OPENAI_API_KEY 或 AI_API_KEY');
    }
    const client = new OpenAIClient();
    client.saveConfig({
        ...client.config,
        apiEndpoint: process.env.OPENAI_API_ENDPOINT || client.config.apiEndpoint,
        apiKey,
        textModel: process.env.OPENAI_TEXT_MODEL || client.config.textModel || 'gpt-4o-mini',
        visionModel: process.env.OPENAI_VISION_MODEL || client.config.visionModel || 'gpt-4o-mini'
    });
    return client;
}

function findTargetCheck(target = {}, checks = []) {
    const token = normalizeToken(target.component);
    const quantity = String(target.quantity || '').trim();
    let best = null;
    for (const check of checks) {
        if (!check) continue;
        if (quantity && check.quantity !== quantity) continue;
        const label = normalizeToken(check.component?.label || check.component?.id);
        const matches = token && label && (label === token || label.includes(token) || token.includes(label));
        if (!matches) continue;
        if (!best) {
            best = check;
            continue;
        }
        const score = check.status === 'verified' ? 2 : (check.status === 'mismatch' ? 1 : 0);
        const bestScore = best.status === 'verified' ? 2 : (best.status === 'mismatch' ? 1 : 0);
        if (score > bestScore) best = check;
    }
    return best;
}

function evaluateTargets(targets = [], checks = []) {
    const normalizedTargets = Array.isArray(targets) ? targets : [];
    let verified = 0;
    let mismatch = 0;
    let missing = 0;
    const details = normalizedTargets.map((target) => {
        const matched = findTargetCheck(target, checks);
        if (!matched) {
            missing += 1;
            return {
                component: target.component,
                quantity: target.quantity,
                status: 'missing'
            };
        }
        if (matched.status === 'verified') {
            verified += 1;
        } else if (matched.status === 'mismatch') {
            mismatch += 1;
        } else {
            missing += 1;
        }
        return {
            component: target.component,
            quantity: target.quantity,
            status: matched.status
        };
    });

    return {
        total: normalizedTargets.length,
        verified,
        mismatch,
        missing,
        pass: normalizedTargets.length > 0
            ? (verified === normalizedTargets.length && mismatch === 0)
            : checks.filter((check) => check.status === 'mismatch').length === 0,
        details
    };
}

async function runScenarioEvaluation(scenario, mode = 'mock') {
    const circuit = new Circuit();
    circuit.fromJSON(scenario.circuit || {});
    const valid = refreshCircuitReadings(circuit);
    const explainer = new CircuitExplainer(circuit);
    const aiClient = mode === 'live' ? createLiveAiClient() : createMockAiClient(circuit);
    const agent = new CircuitAIAgent({
        aiClient,
        explainer,
        circuit
    });

    const questionResults = [];
    for (const questionDef of scenario.questions || []) {
        const start = Date.now();
        const answer = await agent.answerQuestion({
            question: questionDef.question,
            history: []
        });
        const latencyMs = Date.now() - start;

        const claims = ClaimExtractSkill.run({ answer, circuit });
        const checks = NumericCheckSkill.run({ claims, circuit });
        const targetEval = evaluateTargets(questionDef.targets || [], checks);
        const mismatchCount = checks.filter((check) => check.status === 'mismatch').length;
        const verifiedCount = checks.filter((check) => check.status === 'verified').length;
        const avgAbsError = checks.length > 0
            ? checks.reduce((sum, check) => sum + Math.abs(safeNumber(check.delta, 0)), 0) / checks.length
            : 0;

        questionResults.push({
            id: questionDef.id,
            question: questionDef.question,
            latencyMs,
            claimCount: claims.length,
            verifiedCount,
            mismatchCount,
            avgAbsError,
            targetEvaluation: targetEval,
            pass: targetEval.pass
        });
    }

    const passCount = questionResults.filter((item) => item.pass).length;
    const totalQuestions = questionResults.length;
    const avgLatencyMs = totalQuestions > 0
        ? questionResults.reduce((sum, item) => sum + item.latencyMs, 0) / totalQuestions
        : 0;
    const avgAbsError = totalQuestions > 0
        ? questionResults.reduce((sum, item) => sum + item.avgAbsError, 0) / totalQuestions
        : 0;

    return {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        valid,
        questionCount: totalQuestions,
        passCount,
        passRate: totalQuestions > 0 ? passCount / totalQuestions : 0,
        avgLatencyMs,
        avgAbsError,
        questions: questionResults
    };
}

export async function runAiEvalScenarios(options = {}) {
    const mode = String(options.mode || process.env.AI_EVAL_MODE || 'mock').toLowerCase() === 'live'
        ? 'live'
        : 'mock';
    const scenarios = loadScenarios();
    const scenarioResults = [];
    for (const scenario of scenarios) {
        const result = await runScenarioEvaluation(scenario, mode);
        scenarioResults.push(result);
    }

    const totalQuestions = scenarioResults.reduce((sum, item) => sum + item.questionCount, 0);
    const totalPass = scenarioResults.reduce((sum, item) => sum + item.passCount, 0);
    const weightedLatency = scenarioResults.reduce((sum, item) => sum + item.avgLatencyMs * item.questionCount, 0);
    const weightedAbsError = scenarioResults.reduce((sum, item) => sum + item.avgAbsError * item.questionCount, 0);

    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        mode,
        scenarioCount: scenarioResults.length,
        totalQuestions,
        passCount: totalPass,
        passRate: totalQuestions > 0 ? totalPass / totalQuestions : 0,
        avgLatencyMs: totalQuestions > 0 ? weightedLatency / totalQuestions : 0,
        avgAbsError: totalQuestions > 0 ? weightedAbsError / totalQuestions : 0,
        scenarios: scenarioResults
    };
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
        if (!!currentScenario.valid !== !!baselineScenario.valid) {
            errors.push(`${scenarioId}: valid changed current=${currentScenario.valid} baseline=${baselineScenario.valid}`);
        }
        const baselineQuestions = new Map((baselineScenario.questions || []).map((item) => [item.id, item]));
        const currentQuestions = new Map((currentScenario.questions || []).map((item) => [item.id, item]));

        for (const questionId of baselineQuestions.keys()) {
            if (!currentQuestions.has(questionId)) {
                errors.push(`${scenarioId}:${questionId} missing in current snapshot`);
            }
        }
        for (const questionId of currentQuestions.keys()) {
            if (!baselineQuestions.has(questionId)) {
                errors.push(`${scenarioId}:${questionId} missing in baseline snapshot`);
            }
        }

        for (const [questionId, baselineQuestion] of baselineQuestions.entries()) {
            const currentQuestion = currentQuestions.get(questionId);
            if (!currentQuestion) continue;
            if (!!currentQuestion.pass !== !!baselineQuestion.pass) {
                errors.push(`${scenarioId}:${questionId} pass changed current=${currentQuestion.pass} baseline=${baselineQuestion.pass}`);
            }
            const currentTarget = currentQuestion.targetEvaluation || {};
            const baselineTarget = baselineQuestion.targetEvaluation || {};
            if ((currentTarget.verified || 0) !== (baselineTarget.verified || 0)) {
                errors.push(`${scenarioId}:${questionId} target verified drift current=${currentTarget.verified || 0} baseline=${baselineTarget.verified || 0}`);
            }
            if ((currentTarget.mismatch || 0) !== (baselineTarget.mismatch || 0)) {
                errors.push(`${scenarioId}:${questionId} target mismatch drift current=${currentTarget.mismatch || 0} baseline=${baselineTarget.mismatch || 0}`);
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
    lines.push('# AI Eval Regression Report');
    lines.push('');
    lines.push(`- generatedAt: ${snapshot.generatedAt}`);
    lines.push(`- mode: ${snapshot.mode}`);
    lines.push(`- scenarios: ${snapshot.scenarioCount}`);
    lines.push(`- totalQuestions: ${snapshot.totalQuestions}`);
    lines.push(`- passRate: ${(snapshot.passRate * 100).toFixed(1)}%`);
    lines.push(`- avgLatencyMs: ${snapshot.avgLatencyMs.toFixed(2)}`);
    lines.push(`- avgAbsError: ${snapshot.avgAbsError.toFixed(6)}`);
    lines.push(`- comparison: ${comparison ? (comparison.passed ? 'PASS' : 'FAIL') : 'SKIPPED (update mode)'}`);
    lines.push('');
    lines.push('| Scenario | Valid | Questions | Pass | PassRate | AvgLatency(ms) | AvgAbsError |');
    lines.push('|---|---|---:|---:|---:|---:|---:|');
    for (const scenario of snapshot.scenarios || []) {
        lines.push(
            `| ${scenario.id} | ${scenario.valid ? 'yes' : 'no'} | ${scenario.questionCount} | ${scenario.passCount} | ${(scenario.passRate * 100).toFixed(1)}% | ${scenario.avgLatencyMs.toFixed(2)} | ${scenario.avgAbsError.toFixed(6)} |`
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
    const args = argv.slice(2);
    const update = args.includes('--update');
    const modeArg = args.find((arg) => arg.startsWith('--mode='));
    const mode = modeArg ? modeArg.split('=')[1] : undefined;
    return { update, mode };
}

export async function runAiEvalBaselineCli(options = {}) {
    const update = !!options.update;
    const mode = options.mode || 'mock';
    const snapshot = await runAiEvalScenarios({ mode });
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
        console.error(`AI eval baseline comparison failed. driftCount=${comparison.errors.length}`);
        console.error(`Report: ${DIFF_REPORT_FILE}`);
        return 1;
    }

    console.log(`AI eval baseline comparison passed. scenarios=${snapshot.scenarioCount}`);
    console.log(`Current snapshot: ${CURRENT_SNAPSHOT_FILE}`);
    console.log(`Report: ${DIFF_REPORT_FILE}`);
    return 0;
}

async function main() {
    const args = parseArgs(process.argv);
    const code = await runAiEvalBaselineCli(args);
    process.exitCode = code;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
