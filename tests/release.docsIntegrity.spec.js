import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('release docs integrity', () => {
    it('has release-doc integrity script wired in package scripts', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:docs-integrity']).toBe('node scripts/ci/assert-release-doc-integrity.mjs');
    });

    it('keeps day28 release-readiness references coherent', () => {
        const reviewPath = resolve(process.cwd(), 'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md');
        const content = readFileSync(reviewPath, 'utf8');

        expect(content).toContain('Date: 2026-03-29');
        expect(content).toContain('docs/releases/v0.9-qa-checklist.md');
        expect(content).toContain('docs/releases/v0.9-rc1-release-notes.md');
        expect(content).toContain('docs/releases/v0.9-rollback-plan.md');

        const requiredDocs = [
            'docs/releases/v0.9-qa-checklist.md',
            'docs/releases/v0.9-rc1-release-notes.md',
            'docs/releases/v0.9-rollback-plan.md'
        ];
        for (const relPath of requiredDocs) {
            expect(existsSync(resolve(process.cwd(), relPath))).toBe(true);
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
});
