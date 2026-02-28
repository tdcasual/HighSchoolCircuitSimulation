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
    return body;
}

function collectComparedTypeLiterals(body) {
    const typeNames = new Set();

    const compTypeOnLeft = /comp\.type\s*(?:===|!==)\s*(['"])([^'"`]+)\1/g;
    let match = compTypeOnLeft.exec(body);
    while (match) {
        typeNames.add(match[2]);
        match = compTypeOnLeft.exec(body);
    }

    const compTypeOnRight = /(['"])([^'"`]+)\1\s*(?:===|!==)\s*comp\.type/g;
    match = compTypeOnRight.exec(body);
    while (match) {
        typeNames.add(match[2]);
        match = compTypeOnRight.exec(body);
    }

    const includesMatch = /\[([^\]]+)\]\.includes\(\s*comp\.type\s*\)/g;
    match = includesMatch.exec(body);
    while (match) {
        const list = match[1];
        const itemRegex = /(['"])([^'"`]+)\1/g;
        let item = itemRegex.exec(list);
        while (item) {
            typeNames.add(item[2]);
            item = itemRegex.exec(list);
        }
        match = includesMatch.exec(body);
    }

    return typeNames;
}

function assertTypeComparisonWhitelist(body, signature, fileLabel, allowedTypes) {
    const comparedTypes = collectComparedTypeLiterals(body);
    const disallowed = Array.from(comparedTypes)
        .filter((type) => !allowedTypes.has(type))
        .sort();
    if (disallowed.length > 0) {
        fail(
            `${fileLabel} -> ${signature} contains non-whitelisted comp.type branch(es): ${disallowed.join(', ')}`
        );
    }
}

function assertMethodBodyDoesNotMatch(body, signature, fileLabel, checks = []) {
    for (const check of checks) {
        if (check.regex.test(body)) {
            fail(`${fileLabel} -> ${signature} ${check.message}`);
        }
    }
}

const solverPath = 'src/engine/Solver.js';
const resultPath = 'src/core/simulation/ResultPostprocessor.js';

const solverSource = readText(solverPath);
const resultSource = readText(resultPath);

const solverStampBody = assertNoLegacyTypeSwitch(
    solverSource,
    'stampComponent(comp, A, z, nodeCount)',
    solverPath
);
const resultCurrentBody = assertNoLegacyTypeSwitch(
    resultSource,
    'calculateCurrent(comp, context = {})',
    resultPath
);
const cacheKeyBody = extractMethodBody(
    solverSource,
    'buildSystemMatrixCacheKey(nodeCount)',
    solverPath
);

const structuralTypeWhitelist = new Set([
    'Ground',
    'PowerSource',
    'ACVoltageSource',
    'Rheostat',
    'SPDTSwitch',
    'Relay'
]);
assertTypeComparisonWhitelist(
    solverStampBody,
    'stampComponent(comp, A, z, nodeCount)',
    solverPath,
    structuralTypeWhitelist
);
assertTypeComparisonWhitelist(
    resultCurrentBody,
    'calculateCurrent(comp, context = {})',
    resultPath,
    structuralTypeWhitelist
);

assertMethodBodyDoesNotMatch(
    cacheKeyBody,
    'buildSystemMatrixCacheKey(nodeCount)',
    solverPath,
    [
        {
            regex: /\bthis\.stamp[A-Za-z0-9_]*\s*\(/,
            message: 'must not invoke stamping APIs'
        },
        {
            regex: /\bthis\.stampDispatcher\.stamp\s*\(/,
            message: 'must not dispatch stamping from cache-key builder'
        },
        {
            regex: /\bcomp\.[A-Za-z0-9_]+\s*=[^=]/,
            message: 'must not mutate component state while building cache key'
        },
        {
            regex: /\bthis\.[A-Za-z0-9_]+\s*=[^=]/,
            message: 'must not mutate solver state while building cache key'
        }
    ]
);

if (!/return\s+keyParts\.join\(['"]\|['"]\)\s*;/.test(cacheKeyBody)) {
    fail(`${solverPath} -> buildSystemMatrixCacheKey(nodeCount) must return a keyParts join result`);
}

console.log('[registry-guard] ok');
