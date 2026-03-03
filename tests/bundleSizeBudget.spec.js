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

    it('provides bundle size budget guard script', () => {
        const guardPath = resolve(process.cwd(), 'scripts/ci/assert-bundle-size-budget.mjs');
        expect(existsSync(guardPath)).toBe(true);
    });
});
