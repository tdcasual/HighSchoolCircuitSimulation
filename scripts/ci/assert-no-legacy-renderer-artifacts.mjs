#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[renderer-no-legacy] ${message}`);
    process.exit(1);
}

const legacyRendererDir = path.resolve(root, 'src/components/render/legacy');
if (existsSync(legacyRendererDir)) {
    fail('legacy renderer directory must be removed: src/components/render/legacy');
}

const scanDirs = [
    path.resolve(root, 'src'),
    path.resolve(root, 'tests'),
    path.resolve(root, 'scripts')
];

const forbiddenPatterns = [
    /components\/render\/legacy/u,
    /RendererRegistryLegacy/u,
    /renderLegacyComponent/u
];
const allowListFiles = new Set([
    'scripts/ci/assert-no-legacy-renderer-artifacts.mjs',
    'tests/renderer.noLegacyArtifactsGuard.spec.js'
]);

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
        if (allowListFiles.has(relPath)) {
            continue;
        }
        const source = readFileSync(absPath, 'utf8');
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(source)) {
                fail(`forbidden legacy renderer reference found in ${relPath}: ${pattern}`);
            }
        }
    }
}

for (const dirPath of scanDirs) {
    scanDirectory(dirPath);
}

console.log('[renderer-no-legacy] ok');
