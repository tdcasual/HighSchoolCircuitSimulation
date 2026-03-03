#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[engine-no-adapters] ${message}`);
    process.exit(1);
}

const removedArtifacts = [
    'src/engine'
];

for (const relPath of removedArtifacts) {
    const absPath = path.resolve(root, relPath);
    if (existsSync(absPath)) {
        fail(`legacy engine artifact must be removed: ${relPath}`);
    }
}

const forbiddenPatterns = [
    /src\/engine\//u,
    /['"]\.\.?\/engine\/[^'"]+['"]/u,
    /['"][^'"]*\/engine\/[^'"]+['"]/u
];
const allowListFiles = new Set([
    'scripts/ci/assert-no-engine-adapter-artifacts.mjs',
    'tests/engine.noAdapterArtifactsGuard.spec.js'
]);

const scanRoots = [
    path.resolve(root, 'src'),
    path.resolve(root, 'tests'),
    path.resolve(root, 'scripts')
];

function scanDirectory(dirPath) {
    if (!existsSync(dirPath)) return;
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const absPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            scanDirectory(absPath);
            continue;
        }
        if (!entry.isFile()) continue;
        if (!/\.(js|mjs|cjs)$/u.test(entry.name)) continue;

        const relPath = path.relative(root, absPath).replace(/\\/gu, '/');
        if (allowListFiles.has(relPath)) continue;

        const source = readFileSync(absPath, 'utf8');
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(source)) {
                fail(`forbidden engine legacy reference found in ${relPath}: ${pattern}`);
            }
        }
    }
}

for (const scanRoot of scanRoots) {
    scanDirectory(scanRoot);
}

console.log('[engine-no-adapters] ok');
