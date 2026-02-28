import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

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
});
