import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workbench empty state', () => {
    it('defines a guided canvas empty state', () => {
        const html = readFileSync('index.html', 'utf8');
        const css = readFileSync('css/style.css', 'utf8');

        expect(html).toContain('id="workbench-empty-state"');
        expect(html).toContain('data-empty-action="series-circuit"');
        expect(html).toContain('data-empty-action="parallel-circuit"');
        expect(html).toContain('data-empty-action="meter-demo"');

        expect(css).toContain('#workbench-empty-state');
        expect(css).toContain('.workbench-empty-actions');
    });
});
