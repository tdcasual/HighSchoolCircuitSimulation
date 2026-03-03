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
        expect(report.bundle.status).toMatch(/^(ok|warn|fail)$/u);
        expect(report.legacyObservation.count).toBeTypeOf('number');
        expect(report.summary).toMatchObject({
            fail: expect.any(Number),
            warn: expect.any(Number),
            ok: expect.any(Number)
        });

        const markdown = readFileSync(mdPath, 'utf8');
        expect(markdown).toContain('# Tech Debt Dashboard');
        expect(markdown).toContain('## Runtime Safety Duplication');
        expect(markdown).toContain('## Core File Budgets');
    });
});
