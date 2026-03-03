#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[observation-contract] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

const contractTargets = [
    'scripts/e2e/observation-touch-regression.mjs',
    'scripts/e2e/responsive-touch-regression.mjs',
    'src/app/AppBootstrapRuntime.js'
];

const forbiddenPatterns = [
    /window\.app\??\.observationPanel/g,
    /\bapp\.observationPanel\b/g,
    /\bobservationPanel\?\./g
];

for (const relPath of contractTargets) {
    const source = readText(relPath);

    if (!source.includes('chartWorkspace')) {
        fail(`chartWorkspace runtime contract is missing in ${relPath}`);
    }

    for (const pattern of forbiddenPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(source)) {
            fail(`observationPanel runtime contract reference found in ${relPath}`);
        }
    }
}

const legacyModulePath = path.resolve(root, 'src/ui/ObservationPanel.js');
if (existsSync(legacyModulePath)) {
    fail('legacy ObservationPanel module must be removed: src/ui/ObservationPanel.js');
}

function walkFiles(relDir) {
    const baseDir = path.resolve(root, relDir);
    if (!existsSync(baseDir)) return [];
    const entries = [];
    const stack = [baseDir];
    while (stack.length > 0) {
        const current = stack.pop();
        const children = readdirSync(current, { withFileTypes: true });
        for (const child of children) {
            const childPath = path.join(current, child.name);
            if (child.isDirectory()) {
                stack.push(childPath);
                continue;
            }
            if (!child.isFile()) continue;
            const stats = statSync(childPath);
            if (!stats.size) continue;
            entries.push(childPath);
        }
    }
    return entries;
}

const legacyImportPatterns = [
    /from\s+['"]\.\.\/src\/ui\/ObservationPanel\.js['"]/g,
    /from\s+['"]\.\/ObservationPanel\.js['"]/g,
    /from\s+['"]\.\.\/ui\/ObservationPanel\.js['"]/g,
    /import\s*\(\s*['"]\.\.\/src\/ui\/ObservationPanel\.js['"]\s*\)/g,
    /import\s*\(\s*['"]\.\/ObservationPanel\.js['"]\s*\)/g
];
const testFiles = walkFiles('tests').filter((absPath) => absPath.endsWith('.js'));
for (const absPath of testFiles) {
    const relPath = path.relative(root, absPath).replaceAll('\\', '/');
    const source = readFileSync(absPath, 'utf8');
    for (const pattern of legacyImportPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(source)) {
            fail(`legacy ObservationPanel import found in ${relPath}`);
        }
    }
}

console.log('[observation-contract] ok');
