#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalKnowledgeResourceProvider } from '../../src/ai/resources/KnowledgeResourceProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'benchmarks', 'ai-teaching-mini-eval');
const jsonPath = path.join(outputDir, 'mini-eval.json');
const reportPath = path.join(outputDir, 'mini-eval.md');

const cases = [
    { id: 'conflicting', code: 'CONFLICTING_SOURCES' },
    { id: 'short', code: 'SHORT_CIRCUIT' },
    { id: 'singular', code: 'SINGULAR_MATRIX' },
    { id: 'invalid-params', code: 'INVALID_PARAMS' },
    { id: 'floating', code: 'FLOATING_SUBCIRCUIT' },
    { id: 'partial-context', summary: '求解器报告未知异常', hints: ['检查参考地连接'] }
];

function hasStructuredTriplet(content = '') {
    const text = String(content || '');
    return text.includes('发生了什么：')
        && text.includes('为什么会这样：')
        && text.includes('如何修复：');
}

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function main() {
    const provider = new LocalKnowledgeResourceProvider();
    const rows = [];

    for (const testCase of cases) {
        const runtimeDiagnostics = {
            code: testCase.code || '',
            categories: testCase.code ? [testCase.code] : [],
            summary: testCase.summary || `${testCase.code || 'UNKNOWN'} summary`,
            hints: testCase.hints || ['检查连线与参考地']
        };
        const items = await provider.search({
            question: '为什么仿真报错？',
            componentTypes: ['PowerSource', 'Resistor'],
            runtimeDiagnostics,
            limit: 1
        });
        const first = items[0] || null;
        const structured = hasStructuredTriplet(first?.content);
        rows.push({
            caseId: testCase.id,
            code: runtimeDiagnostics.code || 'N/A',
            entryId: first?.id || 'none',
            structured
        });
    }

    const passCount = rows.filter((row) => row.structured).length;
    const totalCount = rows.length;
    const passRate = totalCount > 0 ? passCount / totalCount : 0;
    assertCondition(passCount === totalCount, `structured triplet coverage failed: ${passCount}/${totalCount}`);

    const summary = {
        generatedAt: new Date().toISOString(),
        totalCount,
        passCount,
        passRate,
        rows
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    const lines = [
        '# AI Teaching Mini Eval',
        '',
        `Generated at: ${summary.generatedAt}`,
        '',
        `- Cases: ${totalCount}`,
        `- Structured what/why/how pass: ${passCount}/${totalCount}`,
        `- Pass rate: ${(passRate * 100).toFixed(1)}%`,
        '',
        '## Case Results'
    ];
    rows.forEach((row, index) => {
        lines.push(`${index + 1}. ${row.caseId} (${row.code})`);
        lines.push(`- entry: ${row.entryId}`);
        lines.push(`- structured: ${row.structured ? 'yes' : 'no'}`);
    });

    await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
    console.log('AI teaching mini-eval passed.');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
    console.error('[ai-teaching-mini-eval] FAILED');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
