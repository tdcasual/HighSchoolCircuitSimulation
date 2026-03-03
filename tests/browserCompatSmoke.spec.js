import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('browser compatibility smoke wiring', () => {
    it('declares browser compatibility smoke script in package', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts['test:e2e:compat']).toBe('node scripts/e2e/browser-compat-smoke.mjs');
    });

    it('provides browser compatibility matrix document', () => {
        const matrixPath = resolve(process.cwd(), 'docs/releases/browser-compat-matrix.md');
        expect(existsSync(matrixPath)).toBe(true);

        const matrix = readFileSync(matrixPath, 'utf8');
        expect(matrix).toContain('Browser Compatibility Matrix');
        expect(matrix).toContain('npm run test:e2e:compat');
        expect(matrix).toContain('Chromium');
        expect(matrix).toContain('Firefox');
        expect(matrix).toContain('WebKit');
    });

    it('runs against chart workspace runtime contract instead of observation panel globals', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/e2e/browser-compat-smoke.mjs');
        expect(existsSync(scriptPath)).toBe(true);

        const source = readFileSync(scriptPath, 'utf8');
        expect(source).toContain('window.app?.chartWorkspace');
        expect(source).not.toContain('window.app?.observationPanel');
        expect(source).not.toContain('window.app.observationPanel');
    });
});
