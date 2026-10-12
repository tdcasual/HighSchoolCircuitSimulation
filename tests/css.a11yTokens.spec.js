import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('toolbox a11y and theme tokens', () => {
    it('gives tool-item a focus ring, tokenized colors, and motion/dark preferences', () => {
        const css = readFileSync(resolve(process.cwd(), 'css/style.css'), 'utf8');
        expect(css).toContain('.tool-item:focus-visible');
        expect(css).toContain('outline: 2px solid var(--primary-color)');
        expect(css).toContain('box-shadow: 0 0 0 2px var(--primary-color)');
        expect(css).toContain('min-height: 36px');
        expect(css).toContain('--tool-item-bg');
        expect(css).toContain('--tool-item-hover-bg');
        expect(css).toContain('prefers-reduced-motion');
        expect(css).toContain('prefers-color-scheme: dark');
        expect(css).not.toMatch(/\.tool-item\s*\{[^}]*transition:\s*all/s);
        expect(css).not.toMatch(/\.tool-item:hover\s*\{[^}]*background:\s*#e3f2fd/s);
        expect(css).not.toMatch(/\.tool-item-quick\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255/s);
    });
});
