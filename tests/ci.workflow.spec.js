import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('CI workflow coverage', () => {
    it('runs wire interaction e2e in GitHub Actions', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('wire-e2e:');
        expect(content).toContain('npm run test:e2e:wire');
        expect(content).toContain('wire-e2e-screenshots');
        expect(content).toContain('output/e2e/wire-interaction');
    });

    it('runs reliability-focused regression gate in quality job', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('Run reliability regression gate');
        expect(content).toContain('npm run test:reliability');
    });

    it('runs docs integrity and interaction-guide sync checks in quality job', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('Check release docs integrity');
        expect(content).toContain('node scripts/ci/assert-release-doc-integrity.mjs');
        expect(content).toContain('Check interaction guide sync');
        expect(content).toContain('node scripts/ci/assert-interaction-guide-sync.mjs');
        expect(content).toContain('Check registry legacy fallback guard');
        expect(content).toContain('node scripts/ci/assert-registry-legacy-fallback-guard.mjs');
        expect(content).toContain('Check CI workflow coverage');
        expect(content).toContain('node scripts/ci/assert-ci-workflow-coverage.mjs');
    });

    it('wires CI workflow guard script in package check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:ci-workflow']).toBe('node scripts/ci/assert-ci-workflow-coverage.mjs');
        expect(pkg.scripts.check).toContain('npm run check:ci-workflow');
    });

    it('executes CI workflow coverage script on current workflow', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml']
        });

        expect(output.ok).toBe(true);
        expect(output.output).toContain('[ci-workflow] ok');
    });

    it('fails CI workflow coverage script when registry guard step is removed', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml'],
            mutateByFile: {
                '.github/workflows/ci.yml': (content) =>
                    content
                        .replace('      - name: Check registry legacy fallback guard\n', '')
                        .replace('        run: node scripts/ci/assert-registry-legacy-fallback-guard.mjs\n', '')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing required snippet');
        expect(output.output).toContain('Check registry legacy fallback guard');
    });
});
