import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('component tray contract', () => {
    it('adds a classroom-common region ahead of the full component catalog', () => {
        const html = readFileSync('index.html', 'utf8');

        expect(html).toContain('class="toolbox-lead"');
        expect(html).toContain('data-category="classroom-common"');
        expect(html).toContain('data-collapsible="false"');
        expect(html).toContain('课堂常用');
        expect(html).toContain('vendor/marked-12.0.0.min.js');
        expect(html).toContain('vendor/mathjax-3.2.2/es5/tex-chtml.js');
        expect(html).not.toContain('cdn.jsdelivr');
        expect(html).toContain('<button type="button" class="tool-item');
        expect(html).not.toMatch(/<div class="tool-item/u);
        expect(html).toContain('aria-pressed="false"');
    });
});
