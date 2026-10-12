import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('MathJax classroom config', () => {
    it('disables TeX href/require/html packages after markdown sanitize', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        expect(html).toContain("packages: { '[-]': ['require', 'autoload', 'html', 'href'] }");
        expect(html).toContain('vendor/mathjax-3.2.2/es5/tex-chtml.js');
        expect(html).not.toMatch(/cdn\.jsdelivr/i);
    });
});
