import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function toText(value) {
    if (!value) return '';
    return typeof value === 'string' ? value : value.toString('utf8');
}

function runGuardInTempWorkspace({ mutateSolver, mutatePostprocessor } = {}) {
    const tempRoot = mkdtempSync(join(tmpdir(), 'registry-guard-'));
    const solverDir = resolve(tempRoot, 'src/engine');
    const postprocessorDir = resolve(tempRoot, 'src/core/simulation');
    mkdirSync(solverDir, { recursive: true });
    mkdirSync(postprocessorDir, { recursive: true });

    const solverSourcePath = resolve(process.cwd(), 'src/engine/Solver.js');
    const postprocessorSourcePath = resolve(process.cwd(), 'src/core/simulation/ResultPostprocessor.js');
    const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-registry-legacy-fallback-guard.mjs');

    const originalSolver = readFileSync(solverSourcePath, 'utf8');
    const originalPostprocessor = readFileSync(postprocessorSourcePath, 'utf8');
    const nextSolver = typeof mutateSolver === 'function' ? mutateSolver(originalSolver) : originalSolver;
    const nextPostprocessor = typeof mutatePostprocessor === 'function'
        ? mutatePostprocessor(originalPostprocessor)
        : originalPostprocessor;

    writeFileSync(resolve(solverDir, 'Solver.js'), nextSolver, 'utf8');
    writeFileSync(resolve(postprocessorDir, 'ResultPostprocessor.js'), nextPostprocessor, 'utf8');

    try {
        const output = execFileSync('node', [scriptPath], { cwd: tempRoot, encoding: 'utf8' });
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

describe('registry legacy fallback guard wiring', () => {
    it('exposes guard script in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:registry-guard']).toBe('node scripts/ci/assert-registry-legacy-fallback-guard.mjs');
        expect(pkg.scripts.check).toContain('npm run check:registry-guard');
    });

    it('passes on current source with whitelist guard enabled', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-registry-legacy-fallback-guard.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[registry-guard] ok');
    });

    it('guards buildSystemMatrixCacheKey against behavioral side effects', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-registry-legacy-fallback-guard.mjs');
        const content = readFileSync(scriptPath, 'utf8');

        expect(content).toContain('buildSystemMatrixCacheKey(nodeCount)');
        expect(content).toContain('must not invoke stamping APIs');
        expect(content).toContain('must not mutate component state while building cache key');
    });

    it('enforces registry-first method structure contracts', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-registry-legacy-fallback-guard.mjs');
        const content = readFileSync(scriptPath, 'utf8');

        expect(content).toContain('must keep registry-first type lookup');
        expect(content).toContain('must keep default registry fallback lookup');
        expect(content).toContain('must keep dispatcher fallback path');
        expect(content).toContain('must keep current handler invocation path');
        expect(content).toContain('must keep explicit 0A no-handler fallback');
    });

    it('fails when legacy switch fallback is reintroduced in stampComponent', () => {
        const result = runGuardInTempWorkspace({
            mutateSolver: (source) => source.replace(
                /if\s*\(\s*handledByDispatcher\s*\)\s*\{\s*return;\s*\}/,
                `if (handledByDispatcher) {
            return;
        }
        switch (comp.type) {
            default:
                break;
        }`
            )
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('reintroduced legacy "switch (comp.type)" fallback');
    });

    it('fails when registry-first lookup is removed from stampComponent', () => {
        const result = runGuardInTempWorkspace({
            mutateSolver: (source) => source.replace('registry.get(comp.type)', 'registry.get(comp.kind)')
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('must keep registry-first type lookup');
    });

    it('fails when cache-key builder mutates solver state', () => {
        const result = runGuardInTempWorkspace({
            mutateSolver: (source) => source.replace(
                "return keyParts.join('|');",
                "this.gmin = 1e-12;\n        return keyParts.join('|');"
            )
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('must not mutate solver state while building cache key');
    });
});
