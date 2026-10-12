import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('v2 stamp-parity guard', () => {
    it('exposes check:v2:stamp-parity in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts['check:v2:stamp-parity']).toBe('node scripts/ci/assert-v2-stamp-parity.mjs');
        expect(pkg.scripts.check).toContain('npm run check:v2:stamp-parity');
    });

    it('is part of the quality concatenated command rather than a new CI step', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');
        const qualityBlock = content.slice(
            content.indexOf('  quality:'),
            content.indexOf('  responsive-e2e:')
        );

        expect(qualityBlock).toContain('npm run check:v2:stamp-parity');
        expect(qualityBlock).not.toContain('Check v2 stamp parity');
        expect(qualityBlock).toContain('npm run baseline:p0:ext');
    });

    it('passes guard script on current source', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-v2-stamp-parity.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[v2-stamp-parity] ok');
    });
});
