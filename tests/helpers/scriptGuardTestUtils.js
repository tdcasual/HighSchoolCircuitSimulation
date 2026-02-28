import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function toText(value) {
    if (!value) return '';
    return typeof value === 'string' ? value : value.toString('utf8');
}

/**
 * Run a Node script in an isolated temporary workspace with optional source mutations.
 *
 * @param {Object} options
 * @param {string} options.scriptRelPath script path relative to repository root
 * @param {string[]} options.sourceFiles files that should exist in temp workspace
 * @param {Record<string, Function>} [options.mutateByFile] optional per-file mutator
 * @returns {{ ok: boolean, output: string }}
 */
export function runScriptInTempWorkspace({
    scriptRelPath,
    sourceFiles,
    mutateByFile = {}
}) {
    const tempRoot = mkdtempSync(join(tmpdir(), 'script-guard-'));
    const scriptAbsPath = resolve(process.cwd(), scriptRelPath);

    try {
        for (const relPath of sourceFiles || []) {
            const absPath = resolve(process.cwd(), relPath);
            const nextPath = resolve(tempRoot, relPath);
            const nextDir = dirname(nextPath);
            mkdirSync(nextDir, { recursive: true });

            const source = readFileSync(absPath, 'utf8');
            const mutator = mutateByFile[relPath];
            const nextSource = typeof mutator === 'function' ? mutator(source) : source;
            writeFileSync(nextPath, nextSource, 'utf8');
        }

        const output = execFileSync('node', [scriptAbsPath], {
            cwd: tempRoot,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return { ok: true, output };
    } catch (error) {
        return {
            ok: false,
            output: `${toText(error.stdout)}${toText(error.stderr)}`.trim()
        };
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
}
