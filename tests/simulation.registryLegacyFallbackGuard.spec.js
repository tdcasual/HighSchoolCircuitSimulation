import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('registry legacy fallback guard wiring', () => {
    it('exposes guard script in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:registry-guard']).toBe('node scripts/ci/assert-registry-legacy-fallback-guard.mjs');
        expect(pkg.scripts.check).toContain('npm run check:registry-guard');
    });
});
