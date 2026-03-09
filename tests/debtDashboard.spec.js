import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('debt dashboard generator', () => {
    it('wires dashboard generation command in package scripts', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts['report:debt-dashboard']).toBe('node scripts/ci/generate-debt-dashboard.mjs');
    });

    it('generates dashboard json and markdown reports', () => {
        const result = spawnSync('node', ['scripts/ci/generate-debt-dashboard.mjs'], {
            cwd: process.cwd(),
            encoding: 'utf8'
        });
        const output = `${result.stdout || ''}${result.stderr || ''}`;
        expect(result.status).toBe(0);
        expect(output).toContain('[debt-dashboard] wrote docs/reports/debt-dashboard.json');
        expect(output).toContain('[debt-dashboard] wrote docs/reports/debt-dashboard.md');

        const jsonPath = resolve(process.cwd(), 'docs/reports/debt-dashboard.json');
        const mdPath = resolve(process.cwd(), 'docs/reports/debt-dashboard.md');
        expect(existsSync(jsonPath)).toBe(true);
        expect(existsSync(mdPath)).toBe(true);

        const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
        expect(report.generatedAt).toBeTypeOf('string');
        expect(report.runtimeSafety.count).toBeTypeOf('number');
        expect(Array.isArray(report.coreFiles)).toBe(true);
        expect(report.coreFiles.some((entry) => entry.file === 'src/core/simulation/MNASolver.js')).toBe(true);
        expect(report.bundle.status).toMatch(/^(ok|warn|fail)$/u);
        expect(report.bundle.mainKiB === null || typeof report.bundle.mainKiB === 'number').toBe(true);
        expect(report.bundle.targetMainBytes).toBeTypeOf('number');
        expect(report.bundle.targetTotalBytes).toBeTypeOf('number');
        expect(report.legacyObservation.count).toBeTypeOf('number');
        expect(report.lint).toMatchObject({
            status: expect.stringMatching(/^(ok|warn|fail)$/u),
            errorCount: expect.any(Number),
            boundaryErrors: expect.any(Number),
            protectedWarnings: expect.any(Number)
        });
        expect(report.hotspots).toMatchObject({
            status: expect.stringMatching(/^(ok|warn|fail)$/u),
            files: expect.any(Array),
            summary: expect.objectContaining({
                fail: expect.any(Number),
                warn: expect.any(Number),
                ok: expect.any(Number)
            })
        });
        expect(report.shimInventory).toMatchObject({
            count: expect.any(Number),
            baseline: expect.any(Number),
            growth: expect.any(Number)
        });
        expect(report.summary).toMatchObject({
            fail: expect.any(Number),
            warn: expect.any(Number),
            ok: expect.any(Number)
        });

        const markdown = readFileSync(mdPath, 'utf8');
        expect(markdown).toContain('# Tech Debt Dashboard');
        expect(markdown).toContain('## Lint Health');
        expect(markdown).toContain('## Runtime Safety Duplication');
        expect(markdown).toContain('## Core File Budgets');
        expect(markdown).toContain('## Shim Inventory');
        expect(markdown).toContain('target');
        expect(markdown).toContain('baseline');
    }, 15000);
});
