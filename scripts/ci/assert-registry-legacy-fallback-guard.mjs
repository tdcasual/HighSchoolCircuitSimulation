#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[registry-guard] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

function extractMethodBody(source, signature, fileLabel) {
    const signatureIdx = source.indexOf(signature);
    if (signatureIdx < 0) {
        fail(`cannot find method signature "${signature}" in ${fileLabel}`);
    }

    const openBraceIdx = source.indexOf('{', signatureIdx + signature.length);
    if (openBraceIdx < 0) {
        fail(`cannot find opening brace for "${signature}" in ${fileLabel}`);
    }

    let depth = 1;
    for (let i = openBraceIdx + 1; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (depth === 0) {
            return source.slice(openBraceIdx + 1, i);
        }
    }

    fail(`cannot find closing brace for "${signature}" in ${fileLabel}`);
}

function assertNoLegacyTypeSwitch(source, signature, fileLabel) {
    const body = extractMethodBody(source, signature, fileLabel);
    if (/switch\s*\(\s*comp\.type\s*\)/.test(body)) {
        fail(`${fileLabel} -> ${signature} reintroduced legacy "switch (comp.type)" fallback`);
    }
}

const solverPath = 'src/engine/Solver.js';
const resultPath = 'src/core/simulation/ResultPostprocessor.js';

const solverSource = readText(solverPath);
const resultSource = readText(resultPath);

assertNoLegacyTypeSwitch(solverSource, 'stampComponent(comp, A, z, nodeCount)', solverPath);
assertNoLegacyTypeSwitch(resultSource, 'calculateCurrent(comp, context = {})', resultPath);

console.log('[registry-guard] ok');
