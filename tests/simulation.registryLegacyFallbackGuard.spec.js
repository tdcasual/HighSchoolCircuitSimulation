import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

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
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-registry-legacy-fallback-guard.mjs',
            sourceFiles: [
                'src/engine/Solver.js',
                'src/core/simulation/ResultPostprocessor.js'
            ],
            mutateByFile: {
                'src/engine/Solver.js': (source) => source.replace(
                    /if\s*\(\s*handledByDispatcher\s*\)\s*\{\s*return;\s*\}/,
                    `if (handledByDispatcher) {
            return;
        }
        switch (comp.type) {
            default:
                break;
        }`
                )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('reintroduced legacy "switch (comp.type)" fallback');
    });

    it('fails when registry-first lookup is removed from stampComponent', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-registry-legacy-fallback-guard.mjs',
            sourceFiles: [
                'src/engine/Solver.js',
                'src/core/simulation/ResultPostprocessor.js'
            ],
            mutateByFile: {
                'src/engine/Solver.js': (source) => source.replace('registry.get(comp.type)', 'registry.get(comp.kind)')
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('must keep registry-first type lookup');
    });

    it('fails when cache-key builder mutates solver state', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-registry-legacy-fallback-guard.mjs',
            sourceFiles: [
                'src/engine/Solver.js',
                'src/core/simulation/ResultPostprocessor.js'
            ],
            mutateByFile: {
                'src/engine/Solver.js': (source) => source.replace(
                    "return keyParts.join('|');",
                    "this.gmin = 1e-12;\n        return keyParts.join('|');"
                )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('must not mutate solver state while building cache key');
    });
});
