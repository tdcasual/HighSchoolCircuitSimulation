import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createWire,
    updateWirePathWithGroup
} from '../src/components/render/ComponentWireRenderer.js';

function makeSvgNode(tagName) {
    const attrs = new Map();
    const node = {
        tagName,
        children: [],
        style: {},
        setAttribute(name, value) {
            attrs.set(name, String(value));
        },
        getAttribute(name) {
            return attrs.get(name);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        querySelector(selector) {
            if (selector === 'path.wire') {
                return this.children.find((child) => child.tagName === 'path' && child.getAttribute('class') === 'wire') || null;
            }
            if (selector === 'path.wire-hit-area') {
                return this.children.find((child) => child.tagName === 'path' && child.getAttribute('class') === 'wire-hit-area') || null;
            }
            return null;
        },
        querySelectorAll() {
            return [];
        },
        remove: vi.fn()
    };
    return node;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ComponentWireRenderer', () => {
    it('creates wire group with wire and hit-area paths', () => {
        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tagName) => makeSvgNode(tagName))
        });

        const wire = {
            id: 'W1',
            a: { x: 10, y: 20 },
            b: { x: 30, y: 40 }
        };

        const g = createWire(wire);
        const wirePath = g.children.find((child) => child.getAttribute('class') === 'wire');
        const hitPath = g.children.find((child) => child.getAttribute('class') === 'wire-hit-area');

        expect(g.getAttribute('class')).toBe('wire-group');
        expect(wirePath).toBeTruthy();
        expect(hitPath).toBeTruthy();
        expect(wirePath.getAttribute('d')).toBe('M 10 20 L 30 40');
        expect(hitPath.getAttribute('d')).toBe('M 10 20 L 30 40');
    });

    it('does not throw when classList.contains is non-callable during path update', () => {
        const path = makeSvgNode('path');
        path.setAttribute('class', 'wire');
        const hitArea = makeSvgNode('path');
        hitArea.setAttribute('class', 'wire-hit-area');

        const g = makeSvgNode('g');
        g.children.push(path, hitArea);
        g.querySelector = vi.fn((selector) => {
            if (selector === 'path.wire') return path;
            if (selector === 'path.wire-hit-area') return hitArea;
            return null;
        });
        g.querySelectorAll = vi.fn(() => []);
        g.classList = { contains: {} };

        vi.stubGlobal('document', {
            body: { classList: { contains: {} } },
            createElementNS: vi.fn((_, tagName) => makeSvgNode(tagName))
        });
        vi.stubGlobal('window', {
            matchMedia: vi.fn(() => ({ matches: true }))
        });

        expect(() => {
            updateWirePathWithGroup(g, {
                a: { x: 5, y: 10 },
                b: { x: 25, y: 30 }
            });
        }).not.toThrow();
        expect(path.getAttribute('d')).toBe('M 5 10 L 25 30');
        expect(hitArea.getAttribute('d')).toBe('M 5 10 L 25 30');
    });
});
