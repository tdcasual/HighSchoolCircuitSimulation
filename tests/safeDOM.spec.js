import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, createFormGroup } from '../src/utils/SafeDOM.js';

function makeNode(tagName = 'div') {
    const attrs = new Map();
    return {
        tagName,
        className: '',
        id: '',
        style: {},
        children: [],
        textContent: '',
        setAttribute(name, value) {
            attrs.set(name, String(value));
        },
        getAttribute(name) {
            return attrs.get(name);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        }
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('SafeDOM.createElement', () => {
    it('skips undefined/null attrs instead of writing stringified placeholders', () => {
        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => makeNode(tagName))
        });

        const input = createElement('input', {
            attrs: {
                min: undefined,
                max: null,
                step: 0,
                placeholder: ''
            }
        });

        expect(input.getAttribute('min')).toBeUndefined();
        expect(input.getAttribute('max')).toBeUndefined();
        expect(input.getAttribute('step')).toBe('0');
        expect(input.getAttribute('placeholder')).toBe('');
    });

    it('does not crash when Node constructor is unavailable while processing children', () => {
        vi.stubGlobal('Node', undefined);
        const textNode = { nodeType: 3, textContent: 'hello' };
        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => makeNode(tagName)),
            createTextNode: vi.fn((text) => ({ nodeType: 3, textContent: String(text) }))
        });

        expect(() => {
            const el = createElement('div', {
                children: [textNode, 'world']
            });
            expect(el.children).toHaveLength(2);
        }).not.toThrow();
    });
});

describe('SafeDOM.createFormGroup', () => {
    it('does not emit undefined min/max/step for optional number input fields', () => {
        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => makeNode(tagName))
        });

        const group = createFormGroup('电阻', {
            id: 'resistance-input',
            type: 'number',
            value: 100,
            placeholder: '输入电阻值',
            unit: 'Ω'
        });

        const inputWrapper = group.children[1];
        const input = inputWrapper.children[0];
        expect(input.getAttribute('type')).toBe('number');
        expect(input.getAttribute('value')).toBe('100');
        expect(input.getAttribute('placeholder')).toBe('输入电阻值');
        expect(input.getAttribute('min')).toBeUndefined();
        expect(input.getAttribute('max')).toBeUndefined();
        expect(input.getAttribute('step')).toBeUndefined();
    });
});
