import { safeSetAttribute } from '../RuntimeSafety.js';

export const MARKDOWN_ALLOWED_TAGS = Object.freeze([
    'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'a',
    'ul', 'ol', 'li', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'sup', 'sub'
]);

const ALLOWED_TAG_SET = new Set(MARKDOWN_ALLOWED_TAGS);

export function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function isSafeLinkHref(href) {
    const text = String(href || '').trim();
    if (!text) return false;
    if (text.startsWith('#') || text.startsWith('/')) return true;
    try {
        const parsed = new URL(text, 'https://example.com');
        const protocol = String(parsed.protocol || '').toLowerCase();
        return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:';
    } catch (_) {
        return false;
    }
}

function sanitizeRenderedMarkdownWithoutDom(html) {
    let out = String(html);
    out = out.replace(/<(script|style|iframe|object|embed|svg|math|link|meta)\b[\s\S]*?<\/\1>/gi, '');
    out = out.replace(/<(script|style|iframe|object|embed|svg|math|link|meta|img|video|audio|source|form|input|button|textarea|select)\b[^>]*>/gi, '');
    out = out.replace(/<\/(script|style|iframe|object|embed|svg|math|link|meta|img|video|audio|source|form|input|button|textarea|select)>/gi, '');
    out = out.replace(/\s(on[a-z]+|style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g, (match, tag, attrs) => {
        const name = String(tag || '').toLowerCase();
        const isClose = match.startsWith('</');
        if (!ALLOWED_TAG_SET.has(name)) return '';
        if (isClose) return `</${name}>`;
        if (name === 'br' || name === 'hr') return `<${name}>`;
        if (name === 'a') {
            const hrefMatch = String(attrs || '').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
            const href = hrefMatch ? String(hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || '') : '';
            if (isSafeLinkHref(href)) {
                return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
            }
            return '<a>';
        }
        if (name === 'code') {
            const classMatch = String(attrs || '').match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
            const classValue = classMatch ? String(classMatch[1] || classMatch[2] || '').trim() : '';
            if (/^language-[a-z0-9_-]+$/i.test(classValue)) {
                return `<code class="${classValue}">`;
            }
        }
        return `<${name}>`;
    });
    return out;
}

export function sanitizeRenderedMarkdown(html, { documentRef } = {}) {
    if (!html) return '';
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.createElement !== 'function') {
        return sanitizeRenderedMarkdownWithoutDom(String(html));
    }

    const allowedTags = ALLOWED_TAG_SET;
    const template = doc.createElement('template');
    template.innerHTML = String(html);

    const sanitizeElement = (element) => {
        const tag = String(element.tagName || '').toLowerCase();
        if (!allowedTags.has(tag)) {
            const textNode = doc.createTextNode(element.textContent || '');
            element.replaceWith(textNode);
            return false;
        }
        const attrs = Array.from(element.attributes || []);
        attrs.forEach((attr) => {
            const attrName = String(attr.name || '').toLowerCase();
            if (attrName.startsWith('on') || attrName === 'style') {
                element.removeAttribute(attr.name);
                return;
            }
            if (tag === 'a' && (attrName === 'href' || attrName === 'title')) return;
            if (tag === 'code' && attrName === 'class') {
                const classValue = String(attr.value || '').trim();
                if (/^language-[a-z0-9_-]+$/i.test(classValue)) return;
            }
            element.removeAttribute(attr.name);
        });
        if (tag === 'a') {
            const href = element.getAttribute('href');
            if (!isSafeLinkHref(href)) {
                element.removeAttribute('href');
            }
            safeSetAttribute(element, 'target', '_blank');
            safeSetAttribute(element, 'rel', 'noopener noreferrer');
        }
        return true;
    };

    const walk = (node) => {
        let child = node.firstChild;
        while (child) {
            const next = child.nextSibling;
            if (child.nodeType === 1) {
                const shouldTraverse = sanitizeElement(child);
                if (shouldTraverse) {
                    walk(child);
                }
            } else if (child.nodeType === 8) {
                child.remove();
            }
            child = next;
        }
    };

    walk(template.content);
    return template.innerHTML;
}

export function parseMarkdownSafe(text, { marked, documentRef } = {}) {
    if (typeof marked?.parse !== 'function') {
        return escapeHtml(String(text || '')).replace(/\n/g, '<br>');
    }
    const renderer = typeof marked.Renderer === 'function' ? new marked.Renderer() : null;
    if (renderer) renderer.html = () => '';
    const parsed = marked.parse(String(text || ''), {
        breaks: true,
        gfm: true,
        ...(renderer ? { renderer } : {})
    });
    if (typeof parsed !== 'string') {
        return escapeHtml(String(text || '')).replace(/\n/g, '<br>');
    }
    return sanitizeRenderedMarkdown(parsed, { documentRef });
}
