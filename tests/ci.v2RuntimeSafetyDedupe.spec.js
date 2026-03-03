import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v2 runtime safety dedupe guard', () => {
    it('registers check:v2:runtime-safety script and check pipeline wiring', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts['check:v2:runtime-safety']).toBeDefined();
        expect(pkg.scripts.check).toContain('npm run check:v2:runtime-safety');
    });

    it('ensures guard scans src/v2 and blocks local safeInvokeMethod definitions', () => {
        const guardPath = resolve(process.cwd(), 'scripts/ci/assert-v2-runtime-safety-dedupe.mjs');
        const source = readFileSync(guardPath, 'utf8');

        expect(source).toContain('src/v2');
        expect(source).toContain('function safeInvokeMethod(');
    });
});
