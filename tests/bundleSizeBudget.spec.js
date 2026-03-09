import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('bundle size budget guard wiring', () => {
    it('wires bundle budget guard in package scripts and CI workflow', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts['check:bundle-size']).toBe('node scripts/ci/assert-bundle-size-budget.mjs');

        const ciPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const ci = readFileSync(ciPath, 'utf8');
        expect(ci).toContain('Check bundle size budget');
        expect(ci).toContain('npm run check:bundle-size');
    });

    it('defines hard and target bundle thresholds', () => {
        const guardPath = resolve(process.cwd(), 'scripts/ci/assert-bundle-size-budget.mjs');
        const content = readFileSync(guardPath, 'utf8');

        expect(existsSync(guardPath)).toBe(true);
        expect(content).toContain('360 * 1024');
        expect(content).toContain('400 * 1024');
        expect(content).toContain('620 * 1024');
        expect(content).toContain('580 * 1024');
        expect(content).toContain('warning main target exceeded');
    });
});
