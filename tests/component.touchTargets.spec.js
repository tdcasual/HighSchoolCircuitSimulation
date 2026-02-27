import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    SVGRenderer,
    TERMINAL_HIT_RADIUS_PX,
    TOUCH_TARGET_RADIUS_PX,
    TOUCH_TARGET_SIZE_PX,
    WIRE_ENDPOINT_HIT_RADIUS_PX
} from '../src/components/Component.js';

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
        remove: vi.fn()
    };
    return node;
}

function hasClass(node, className) {
    const classes = (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    return classes.includes(className);
}

function findByClass(node, className) {
    return node.children.find(child => hasClass(child, className)) || null;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('SVGRenderer touch targets', () => {
    it('renders Switch touch rectangle as 44px target', () => {
        const g = makeSvgNode('g');
        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tagName) => makeSvgNode(tagName))
        });

        SVGRenderer.renderSwitch.call(SVGRenderer, g, { closed: false, label: '' });

        const touchArea = findByClass(g, 'switch-touch');
        expect(touchArea).toBeTruthy();
        expect(touchArea.getAttribute('x')).toBe(String(-TOUCH_TARGET_RADIUS_PX));
        expect(touchArea.getAttribute('y')).toBe(String(-TOUCH_TARGET_RADIUS_PX));
        expect(touchArea.getAttribute('width')).toBe(String(TOUCH_TARGET_SIZE_PX));
        expect(touchArea.getAttribute('height')).toBe(String(TOUCH_TARGET_SIZE_PX));
    });

    it('renders SPDTSwitch touch rectangle as 44px target', () => {
        const g = makeSvgNode('g');
        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tagName) => makeSvgNode(tagName))
        });

        SVGRenderer.renderSPDTSwitch.call(SVGRenderer, g, { position: 'a', label: '' });

        const touchArea = findByClass(g, 'switch-touch');
        expect(touchArea).toBeTruthy();
        expect(touchArea.getAttribute('x')).toBe(String(-TOUCH_TARGET_RADIUS_PX));
        expect(touchArea.getAttribute('y')).toBe(String(-TOUCH_TARGET_RADIUS_PX));
        expect(touchArea.getAttribute('width')).toBe(String(TOUCH_TARGET_SIZE_PX));
        expect(touchArea.getAttribute('height')).toBe(String(TOUCH_TARGET_SIZE_PX));
    });

    it('renders terminal hit area with 44px target diameter', () => {
        const g = makeSvgNode('g');
        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tagName) => makeSvgNode(tagName))
        });

        SVGRenderer.addTerminal.call(SVGRenderer, g, 30, 0, 1, {
            terminalExtensions: [null, { x: 5, y: -5 }]
        });

        const hitCircle = findByClass(g, 'terminal-hit-area');
        expect(hitCircle).toBeTruthy();
        expect(hitCircle.getAttribute('cx')).toBe('35');
        expect(hitCircle.getAttribute('cy')).toBe('-5');
        expect(hitCircle.getAttribute('r')).toBe(String(TERMINAL_HIT_RADIUS_PX));
    });

    it('renders selected wire endpoint hit area with 44px target diameter', () => {
        const path = makeSvgNode('path');
        path.setAttribute('class', 'wire');
        const hitArea = makeSvgNode('path');
        hitArea.setAttribute('class', 'wire-hit-area');

        const staleEndpoint = makeSvgNode('circle');
        staleEndpoint.setAttribute('class', 'wire-endpoint');
        staleEndpoint.remove = vi.fn();
        const staleEndpointHit = makeSvgNode('circle');
        staleEndpointHit.setAttribute('class', 'wire-endpoint-hit');
        staleEndpointHit.remove = vi.fn();

        const g = makeSvgNode('g');
        g.children.push(path, hitArea, staleEndpoint, staleEndpointHit);
        g.querySelector = vi.fn((selector) => {
            if (selector === 'path.wire') return path;
            if (selector === 'path.wire-hit-area') return hitArea;
            return null;
        });
        g.querySelectorAll = vi.fn((selector) => {
            if (selector === '.wire-endpoint, .wire-endpoint-hit') {
                return [staleEndpoint, staleEndpointHit];
            }
            return [];
        });
        g.classList = {
            contains: (className) => className === 'selected'
        };

        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tagName) => makeSvgNode(tagName))
        });

        SVGRenderer.updateWirePathWithGroup.call(SVGRenderer, g, {
            a: { x: 10, y: 20 },
            b: { x: 50, y: 80 }
        });

        expect(path.getAttribute('d')).toBe('M 10 20 L 50 80');
        expect(hitArea.getAttribute('d')).toBe('M 10 20 L 50 80');
        expect(staleEndpoint.remove).toHaveBeenCalledTimes(1);
        expect(staleEndpointHit.remove).toHaveBeenCalledTimes(1);

        const newEndpointHits = g.children.filter(
            child => hasClass(child, 'wire-endpoint-hit') && child.getAttribute('data-end')
        );
        expect(newEndpointHits).toHaveLength(2);
        expect(newEndpointHits[0].getAttribute('r')).toBe(String(WIRE_ENDPOINT_HIT_RADIUS_PX));
        expect(newEndpointHits[1].getAttribute('r')).toBe(String(WIRE_ENDPOINT_HIT_RADIUS_PX));
    });
});
