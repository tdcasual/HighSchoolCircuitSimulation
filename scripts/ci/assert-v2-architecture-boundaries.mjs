#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const v2Root = path.resolve(root, 'src/v2');
const knownLayers = new Set(['ui', 'app', 'domain', 'simulation', 'infra']);

const allowedDeps = Object.freeze({
    ui: new Set(['ui', 'app']),
    app: new Set(['app', 'domain', 'simulation', 'infra']),
    domain: new Set(['domain', 'simulation', 'infra']),
    simulation: new Set(['simulation', 'infra']),
    infra: new Set(['infra'])
});

function fail(message) {
    console.error(`[v2-architecture] ${message}`);
    process.exit(1);
}

function collectJsFiles(directory) {
    const files = [];
    if (!existsSync(directory)) return files;
    const queue = [directory];
    while (queue.length > 0) {
        const current = queue.pop();
        const entries = readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const absPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(absPath);
                continue;
            }
            if (!entry.isFile()) continue;
            if (/\.(js|mjs|cjs)$/u.test(entry.name)) {
                files.push(absPath);
            }
        }
    }
    return files.sort();
}

function normalizePath(p) {
    return p.replaceAll('\\', '/');
}

function inferLayer(absPath) {
    const rel = normalizePath(path.relative(v2Root, absPath));
    const layer = rel.split('/')[0];
    return knownLayers.has(layer) ? layer : null;
}

function inferLayerFromTarget(absPath) {
    const normalized = normalizePath(absPath);
    const marker = '/src/v2/';
    const idx = normalized.lastIndexOf(marker);
    if (idx === -1) return null;
    const tail = normalized.slice(idx + marker.length);
    const layer = tail.split('/')[0];
    return knownLayers.has(layer) ? layer : null;
}

function resolveImportTarget(absFile, importSpec) {
    if (!importSpec || typeof importSpec !== 'string') return null;
    if (importSpec.startsWith('.')) {
        return path.resolve(path.dirname(absFile), importSpec);
    }
    if (importSpec.startsWith('/')) {
        return path.resolve(root, `.${importSpec}`);
    }
    return null;
}

function extractImports(source) {
    const imports = [];
    const staticImportRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gu;
    const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/gu;
    for (const regex of [staticImportRegex, dynamicImportRegex]) {
        let match = regex.exec(source);
        while (match) {
            imports.push(match[1]);
            match = regex.exec(source);
        }
    }
    return imports;
}

function assertDependencyBoundaries(files) {
    for (const absFile of files) {
        const layer = inferLayer(absFile);
        if (!layer) continue;
        const allowed = allowedDeps[layer];
        if (!allowed) continue;
        const source = readFileSync(absFile, 'utf8');
        const imports = extractImports(source);
        for (const spec of imports) {
            const targetAbs = resolveImportTarget(absFile, spec);
            if (!targetAbs) continue;
            const targetLayer = inferLayerFromTarget(targetAbs);
            if (!targetLayer) {
                fail(`${normalizePath(path.relative(root, absFile))} imports outside src/v2 via "${spec}"`);
            }
            if (!allowed.has(targetLayer)) {
                fail(
                    `${normalizePath(path.relative(root, absFile))} violates layer boundary: `
                    + `${layer} -> ${targetLayer} via "${spec}"`
                );
            }
        }
    }
}

function assertSimulationNoBrowserGlobals(files) {
    const browserGlobalRegex = /\b(window|document|localStorage|sessionStorage|navigator)\b/gu;
    for (const absFile of files) {
        if (inferLayer(absFile) !== 'simulation') continue;
        const source = readFileSync(absFile, 'utf8');
        if (browserGlobalRegex.test(source)) {
            fail(
                `${normalizePath(path.relative(root, absFile))} must not reference browser global `
                + `(window/document/localStorage/sessionStorage/navigator)`
            );
        }
    }
}

function main() {
    if (!existsSync(v2Root) || !statSync(v2Root).isDirectory()) {
        console.log('[v2-architecture] ok (src/v2 not present yet)');
        return;
    }

    const files = collectJsFiles(v2Root);
    assertDependencyBoundaries(files);
    assertSimulationNoBrowserGlobals(files);
    console.log('[v2-architecture] ok');
}

main();
