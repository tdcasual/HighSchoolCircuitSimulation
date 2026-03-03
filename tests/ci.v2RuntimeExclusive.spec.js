import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('v2 runtime exclusive entry guard', () => {
    it('exposes check:v2:runtime-exclusive in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts['check:v2:runtime-exclusive']).toBe(
            'node scripts/ci/assert-v2-runtime-exclusive.mjs'
        );
        expect(pkg.scripts.check).toContain('npm run check:v2:runtime-exclusive');
    });

    it('runs v2 runtime exclusive guard in quality job', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('Check v2 runtime exclusive entry');
        expect(content).toContain('node scripts/ci/assert-v2-runtime-exclusive.mjs');
    });

    it('passes guard script on current source', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-v2-runtime-exclusive.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[v2-runtime-exclusive] ok');
    });
});
