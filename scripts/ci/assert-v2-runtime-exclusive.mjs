#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[v2-runtime-exclusive] ${message}`);
    process.exit(1);
}

const mainPath = path.resolve(root, 'src/main.js');
const runtimePath = path.resolve(root, 'src/app/AppRuntimeV2.js');

if (!existsSync(mainPath)) fail('missing file: src/main.js');
if (!existsSync(runtimePath)) fail('missing file: src/app/AppRuntimeV2.js');

const mainSource = readFileSync(mainPath, 'utf8');
const runtimeSource = readFileSync(runtimePath, 'utf8');

const importRegex = /^\s*import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"];?\s*$/gmu;
const importTargets = [];
let match = importRegex.exec(mainSource);
while (match) {
    importTargets.push(match[1]);
    match = importRegex.exec(mainSource);
}

for (const target of importTargets) {
    const allowed = target === './v2/main/bootstrapV2.js' || target === './app/AppRuntimeV2.js';
    if (!allowed) {
        fail(`src/main.js has unexpected import target: ${target}`);
    }
}

if (!mainSource.includes("import { bootstrapV2 } from './v2/main/bootstrapV2.js';")) {
    fail('src/main.js must import bootstrapV2 from v2 main');
}
if (!mainSource.includes("import { AppRuntimeV2 } from './app/AppRuntimeV2.js';")) {
    fail('src/main.js must import AppRuntimeV2 from app runtime module');
}
if (!mainSource.includes('bootstrapV2({')) {
    fail('src/main.js must bootstrap v2 runtime');
}
if (!/AppClass:\s*AppRuntimeV2/u.test(mainSource)) {
    fail('src/main.js must pass AppRuntimeV2 as bootstrap AppClass');
}
if (/new\s+Circuit\s*\(/u.test(mainSource) || /new\s+Renderer\s*\(/u.test(mainSource)) {
    fail('src/main.js must not directly instantiate legacy runtime modules');
}

if (!/export\s+class\s+AppRuntimeV2/u.test(runtimeSource)) {
    fail('src/app/AppRuntimeV2.js must export class AppRuntimeV2');
}
if (!/chartWorkspace/u.test(runtimeSource)) {
    fail('AppRuntimeV2 must expose chartWorkspace runtime contract');
}
if (!/openAIPanel/u.test(runtimeSource)) {
    fail('AppRuntimeV2 must expose openAIPanel runtime contract');
}

console.log('[v2-runtime-exclusive] ok');
