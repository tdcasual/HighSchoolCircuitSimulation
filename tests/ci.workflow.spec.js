import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('CI workflow coverage', () => {
    it('runs responsive/wire/observation/mode-matrix e2e jobs in GitHub Actions', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('responsive-e2e:');
        expect(content).toContain('npm run test:e2e:responsive');
        expect(content).toContain('responsive-e2e-screenshots');
        expect(content).toContain('output/e2e/responsive-touch');

        expect(content).toContain('wire-e2e:');
        expect(content).toContain('npm run test:e2e:wire');
        expect(content).toContain('wire-e2e-screenshots');
        expect(content).toContain('output/e2e/wire-interaction');

        expect(content).toContain('observation-e2e:');
        expect(content).toContain('npm run test:e2e:observation');
        expect(content).toContain('observation-e2e-screenshots');
        expect(content).toContain('output/e2e/observation-touch');

        expect(content).toContain('mode-conflict-matrix-e2e:');
        expect(content).toContain('npm run mode-conflict-matrix');
        expect(content).toContain('mode-conflict-matrix-artifacts');
        expect(content).toContain('output/e2e/mode-conflict');
    });

    it('includes v0.10 stability release checklist', () => {
        const checklistPath = resolve(process.cwd(), 'docs/releases/v0.10-stability-checklist.md');
        expect(existsSync(checklistPath)).toBe(true);

        const content = readFileSync(checklistPath, 'utf8');
        expect(content).toContain('v0.10 Stability Checklist');
        expect(content).toContain('mode-conflict-matrix');
        expect(content).toContain('test:e2e:wire');
        expect(content).toContain('test:e2e:responsive');
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
            sourceFiles: ['.github/workflows/ci.yml', 'package.json']
        });

        expect(output.ok).toBe(true);
        expect(output.output).toContain('[ci-workflow] ok');
    });

    it('fails CI workflow coverage script when registry guard step is removed', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml', 'package.json'],
            mutateByFile: {
                '.github/workflows/ci.yml': (content) =>
                    content
                        .replace('      - name: Check registry legacy fallback guard\n', '')
                        .replace('        run: node scripts/ci/assert-registry-legacy-fallback-guard.mjs\n', '')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing required step in quality');
        expect(output.output).toContain('Check registry legacy fallback guard');
    });

    it('fails CI workflow coverage script when required step run command drifts', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml', 'package.json'],
            mutateByFile: {
                '.github/workflows/ci.yml': (content) =>
                    content.replace('        run: npm run test:reliability', '        run: npm run test:all')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing run command');
        expect(output.output).toContain('npm run test:reliability');
    });

    it('fails CI workflow coverage script when observation e2e run step is removed', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml', 'package.json'],
            mutateByFile: {
                '.github/workflows/ci.yml': (content) =>
                    content
                        .replace('      - name: Run observation touch E2E\n', '')
                        .replace('        run: npm run test:e2e:observation\n', '')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing required step in observation-e2e');
        expect(output.output).toContain('Run observation touch E2E');
    });

    it('fails CI workflow coverage script when mode matrix run step is removed', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml', 'package.json'],
            mutateByFile: {
                '.github/workflows/ci.yml': (content) =>
                    content
                        .replace('      - name: Run mode conflict matrix E2E\n', '')
                        .replace('        run: npm run mode-conflict-matrix\n', '')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing required step in mode-conflict-matrix-e2e');
        expect(output.output).toContain('Run mode conflict matrix E2E');
    });

    it('fails CI workflow coverage script when workflow npm script is missing in package', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-ci-workflow-coverage.mjs',
            sourceFiles: ['.github/workflows/ci.yml', 'package.json'],
            mutateByFile: {
                'package.json': (content) => content.replace(
                    "\"test:e2e:wire\": \"node scripts/e2e/wire-interaction-regression.mjs\",",
                    ''
                )
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('package.json missing npm script required by workflow');
        expect(output.output).toContain('test:e2e:wire');
    });
});
