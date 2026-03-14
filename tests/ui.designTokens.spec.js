import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI design tokens', () => {
    it('defines the lab-bench semantic token layer', () => {
        const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

        expect(css).toContain('--surface-base');
        expect(css).toContain('--surface-elevated');
        expect(css).toContain('--surface-inset');
        expect(css).toContain('--accent-instrument');
        expect(css).toContain('--accent-observe');
        expect(css).toContain('--accent-run');
        expect(css).toContain('--stroke-soft');
        expect(css).toContain('--text-strong');
    });

    it('uses semantic tokens on primary workbench surfaces', () => {
        const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

        expect(css).toMatch(/body\s*\{[\s\S]*background:\s*var\(--surface-base\)/u);
        expect(css).toMatch(/#top-action-bar\s*\{[\s\S]*border-bottom:\s*1px solid var\(--stroke-soft\)/u);
        expect(css).toMatch(/#toolbox\s*\{[\s\S]*background:\s*var\(--surface-elevated\)/u);
        expect(css).toMatch(/#side-panel\s*\{[\s\S]*background:\s*var\(--surface-elevated\)/u);
    });
});
