import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('release docs integrity', () => {
    it('uses release-evidence-index manifest instead of hard-coded date literals', () => {
        const script = readFileSync(
            resolve(process.cwd(), 'scripts/ci/assert-release-doc-integrity.mjs'),
            'utf8'
        );
        expect(script).toContain('release-evidence-index.json');
        expect(script).not.toContain('Date: 2026-03-29');
    });

    it('has release-doc integrity script wired in package scripts', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:docs-integrity']).toBe('node scripts/ci/assert-release-doc-integrity.mjs');
    });

    it('keeps day28 release-readiness references coherent', () => {
        const reviewPath = resolve(process.cwd(), 'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md');
        const manifestPath = resolve(process.cwd(), 'docs/releases/release-evidence-index.json');
        const content = readFileSync(reviewPath, 'utf8');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

        expect(manifest.reviewPath).toBe('docs/audits/mobile/2026-03-29-day28-release-readiness-review.md');
        expect(Array.isArray(manifest.requiredDocs)).toBe(true);
        expect(manifest.requiredDocs.length).toBeGreaterThan(0);
        for (const relPath of manifest.requiredDocs) {
            expect(content).toContain(relPath);
            expect(existsSync(resolve(process.cwd(), relPath))).toBe(true);
        }

        expect(Array.isArray(manifest.requiredOutputs)).toBe(true);
        expect(manifest.requiredOutputs.length).toBeGreaterThan(0);
        for (const relPath of manifest.requiredOutputs) {
            expect(content).toContain(relPath);
        }
    });

    it('includes new 8-day readiness artifacts in release docs index', () => {
        const indexPath = resolve(process.cwd(), 'docs/releases/v0.9-rc1-artifact-index.md');
        const content = readFileSync(indexPath, 'utf8');

        const requiredDocs = [
            'docs/releases/v1.0-8day-readiness-gate.md',
            'docs/releases/v1.0-8day-go-no-go-matrix.md',
            'docs/audits/mobile/2026-04-06-sprint-closure-review.md'
        ];

        for (const relPath of requiredDocs) {
            expect(content).toContain(relPath);
            expect(existsSync(resolve(process.cwd(), relPath))).toBe(true);
        }
    });

    it('interaction guide was reviewed in sprint closure', () => {
        const guidePath = resolve(process.cwd(), 'docs/process/component-interaction-usage-guide.md');
        const closurePath = resolve(process.cwd(), 'docs/audits/mobile/2026-04-06-sprint-closure-review.md');
        const guide = readFileSync(guidePath, 'utf8');
        const closure = readFileSync(closurePath, 'utf8');

        expect(guide).toContain('Revision: `interaction-guide-r2-2026-04-06`');
        expect(closure).toContain('docs/process/component-interaction-usage-guide.md');
        expect(closure).toContain('interaction-guide-r2-2026-04-06');
    });

    it('executes docs-integrity script on current release references', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-release-doc-integrity.mjs',
            sourceFiles: [
                'docs/releases/release-evidence-index.json',
                'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md',
                'docs/releases/v0.9-qa-checklist.md',
                'docs/releases/v0.9-rc1-release-notes.md',
                'docs/releases/v0.9-rollback-plan.md'
            ]
        });

        expect(output.ok).toBe(true);
        expect(output.output).toContain('[docs-integrity] ok');
    });

    it('fails docs-integrity script when required release doc reference is removed', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-release-doc-integrity.mjs',
            sourceFiles: [
                'docs/releases/release-evidence-index.json',
                'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md',
                'docs/releases/v0.9-qa-checklist.md',
                'docs/releases/v0.9-rc1-release-notes.md',
                'docs/releases/v0.9-rollback-plan.md'
            ],
            mutateByFile: {
                'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md': (content) =>
                    content.split('docs/releases/v0.9-rc1-release-notes.md').join('docs/releases/v0.9-rc1-notes.md')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing reference');
    });

    it('avoids stale pass claims and removed guard command references', () => {
        const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
        const legacyReport = readFileSync(
            resolve(process.cwd(), 'docs/reports/2026-03-02-legacy-prune-final-report.md'),
            'utf8'
        );

        expect(readme).toContain('请以当前 CI 运行结果为准');
        expect(readme).not.toContain('质量门禁：`check:full` + P0/CircuitJS/AI 三组 baseline 回归通过');
        expect(legacyReport).not.toContain('npm run check:legacy-prune-readiness');
    });
});
