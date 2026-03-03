import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('v2 architecture boundaries guard', () => {
    it('exposes check:v2:boundaries in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:v2:boundaries']).toBe(
            'node scripts/ci/assert-v2-architecture-boundaries.mjs'
        );
        expect(pkg.scripts.check).toContain('npm run check:v2:boundaries');
    });

    it('runs v2 architecture boundary guard in quality job', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('Check v2 architecture boundaries');
        expect(content).toContain('node scripts/ci/assert-v2-architecture-boundaries.mjs');
    });

    it('passes guard script on current source', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-v2-architecture-boundaries.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[v2-architecture] ok');
    });
});
