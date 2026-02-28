import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('component interaction usage guide sync', () => {
    it('has interaction-guide sync script wired in package scripts', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:interaction-guide']).toBe('node scripts/ci/assert-interaction-guide-sync.mjs');
    });

    it('documents current key interactions', () => {
        const guidePath = resolve(process.cwd(), 'docs/process/component-interaction-usage-guide.md');
        const content = readFileSync(guidePath, 'utf8');

        expect(content).toContain('Ctrl/Cmd + 拖动端子');
        expect(content).toContain('Ctrl/Cmd + 点击导线');
    });
});
