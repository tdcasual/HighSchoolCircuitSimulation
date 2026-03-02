import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('legacy prune readiness guard', () => {
    it('exposes guard script in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:legacy-prune-readiness']).toBe('node scripts/ci/assert-legacy-prune-readiness.mjs');
        expect(pkg.scripts.check).toContain('npm run check:legacy-prune-readiness');
    });

    it('passes on current checklist and batch-b audit docs', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-legacy-prune-readiness.mjs',
            sourceFiles: [
                'docs/plans/2026-03-02-legacy-removal-checklist.md',
                'docs/plans/2026-03-02-batch-b-mode-fallback-audit.md'
            ]
        });

        expect(output.ok).toBe(true);
        expect(output.output).toContain('[legacy-prune-readiness] ok');
    });

    it('fails when checklist loses batch-b blocked status', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-legacy-prune-readiness.mjs',
            sourceFiles: [
                'docs/plans/2026-03-02-legacy-removal-checklist.md',
                'docs/plans/2026-03-02-batch-b-mode-fallback-audit.md'
            ],
            mutateByFile: {
                'docs/plans/2026-03-02-legacy-removal-checklist.md': (content) =>
                    content.replace('Batch B：预审计已完成，结论为“暂缓删除（阻塞中）”。', 'Batch B：预审计已完成，结论为“可执行删除”。')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('must keep batch-b blocked status');
    });

    it('fails when batch-a commit evidence is missing in checklist', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-legacy-prune-readiness.mjs',
            sourceFiles: [
                'docs/plans/2026-03-02-legacy-removal-checklist.md',
                'docs/plans/2026-03-02-batch-b-mode-fallback-audit.md'
            ],
            mutateByFile: {
                'docs/plans/2026-03-02-legacy-removal-checklist.md': (content) =>
                    content.replace('（commit: `ec3ee3a`，删无引用 script alias）', '（删无引用 script alias）')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('must include batch-a commit evidence');
    });

    it('fails when batch-b audit doc no longer marks blocking decision', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-legacy-prune-readiness.mjs',
            sourceFiles: [
                'docs/plans/2026-03-02-legacy-removal-checklist.md',
                'docs/plans/2026-03-02-batch-b-mode-fallback-audit.md'
            ],
            mutateByFile: {
                'docs/plans/2026-03-02-batch-b-mode-fallback-audit.md': (content) =>
                    content.replace('Batch B 当前状态：阻塞（Not Removable Yet）。', 'Batch B 当前状态：可删除（Removable）。')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('must keep batch-b audit blocking decision');
    });
});
