#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const v2Root = path.resolve(root, 'src/v2');
const localSafeInvokeToken = 'function safeInvokeMethod(';

function normalizePath(value) {
    return value.replaceAll('\\', '/');
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

function findSafeInvokeDefinitions(files) {
    const matches = [];
    for (const absPath of files) {
        const source = readFileSync(absPath, 'utf8');
        if (!source.includes(localSafeInvokeToken)) continue;
        const relPath = normalizePath(path.relative(root, absPath));
        matches.push(relPath);
    }
    return matches;
}

function main() {
    if (!existsSync(v2Root) || !statSync(v2Root).isDirectory()) {
        console.log('[v2-runtime-safety] ok (src/v2 not present yet)');
        return;
    }

    const files = collectJsFiles(v2Root);
    const matches = findSafeInvokeDefinitions(files);
    if (matches.length > 0) {
        console.error('[v2-runtime-safety] local safeInvokeMethod definitions found under src/v2:');
        for (const relPath of matches) {
            console.error(`  - ${relPath}`);
        }
        process.exit(1);
    }

    console.log('[v2-runtime-safety] ok');
}

main();
