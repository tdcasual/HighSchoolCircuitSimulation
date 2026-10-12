import { describe, expect, it } from 'vitest';
import {
    parseMarkdownSafe,
    sanitizeRenderedMarkdown
} from '../src/utils/markdown/sanitizeRenderedMarkdown.js';

describe('markdown sanitizer', () => {
    it('strips script tags', () => {
        const html = sanitizeRenderedMarkdown('<p>ok</p><script>alert(1)</script>');
        expect(html).toContain('<p>ok</p>');
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/alert\(1\)/);
    });

    it('strips img onerror', () => {
        const html = sanitizeRenderedMarkdown('<p>ok</p><img src=x onerror=alert(1)>');
        expect(html).not.toMatch(/onerror/i);
        expect(html).not.toMatch(/<img/i);
    });

    it('neutralizes javascript: links', () => {
        const html = sanitizeRenderedMarkdown('<a href="javascript:alert(1)">x</a>');
        expect(html).not.toMatch(/javascript:/i);
    });

    it('does not turn TeX href into an HTML anchor', () => {
        const html = sanitizeRenderedMarkdown('\\href{javascript:alert(1)}{click}');
        expect(html).not.toMatch(/<a\b/i);
        expect(html).not.toMatch(/<script/i);
    });

    it('parseMarkdownSafe still sanitizes after marked returns raw HTML', () => {
        const marked = {
            parse: () => '<p>ok</p><script>alert(1)</script>'
        };
        const html = parseMarkdownSafe('x', { marked });
        expect(html).toContain('<p>ok</p>');
        expect(html).not.toMatch(/<script/i);
    });
});
