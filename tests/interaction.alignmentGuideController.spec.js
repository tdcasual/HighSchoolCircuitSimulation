import { afterEach, describe, expect, it, vi } from 'vitest';
import * as AlignmentGuideController from '../src/ui/interaction/AlignmentGuideController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('AlignmentGuideController.detectAlignment', () => {
    it('returns snapY and horizontal guide when y is within threshold', () => {
        const context = {
            snapThreshold: 10,
            circuit: {
                components: new Map([
                    ['R1', { id: 'R1', x: 100, y: 100 }],
                    ['R2', { id: 'R2', x: 200, y: 220 }]
                ])
            }
        };

        const result = AlignmentGuideController.detectAlignment.call(context, 'R1', 150, 226);

        expect(result.snapY).toBe(220);
        expect(result.snapX).toBe(null);
        expect(result.guideLines).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'horizontal',
                y: 220
            })
        ]));
    });
});

describe('AlignmentGuideController.showAlignmentGuides', () => {
    it('creates guide group and renders lines', () => {
        const setAttr = vi.fn();
        const appendedLines = [];
        let guidesGroup = null;

        const svg = {
            querySelector: vi.fn(() => guidesGroup),
            appendChild: vi.fn((node) => {
                guidesGroup = node;
            })
        };

        const makeNode = (tag) => ({
            tagName: tag,
            id: '',
            innerHTML: '',
            setAttribute: setAttr,
            appendChild: vi.fn((node) => {
                appendedLines.push(node);
            })
        });

        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tag) => makeNode(tag))
        });

        const context = {
            svg,
            viewOffset: { x: 10, y: 20 },
            scale: 1.5
        };

        AlignmentGuideController.showAlignmentGuides.call(context, {
            guideLines: [
                { type: 'horizontal', x1: 0, y: 10, x2: 100 },
                { type: 'vertical', x: 20, y1: 0, y2: 80 }
            ]
        });

        expect(svg.appendChild).toHaveBeenCalledTimes(1);
        expect(setAttr).toHaveBeenCalledWith('transform', 'translate(10, 20) scale(1.5)');
        expect(appendedLines.length).toBe(2);
    });

    it('does not throw when setAttribute is non-callable', () => {
        let guidesGroup = null;

        const svg = {
            querySelector: vi.fn(() => guidesGroup),
            appendChild: vi.fn((node) => {
                guidesGroup = node;
            })
        };

        const makeNode = (tag) => ({
            tagName: tag,
            id: '',
            innerHTML: '',
            setAttribute: {},
            appendChild: vi.fn()
        });

        vi.stubGlobal('document', {
            createElementNS: vi.fn((_, tag) => makeNode(tag))
        });

        const context = {
            svg,
            viewOffset: { x: 10, y: 20 },
            scale: 1.5
        };

        expect(() => AlignmentGuideController.showAlignmentGuides.call(context, {
            guideLines: [
                { type: 'horizontal', x1: 0, y: 10, x2: 100 }
            ]
        })).not.toThrow();
    });
});

describe('AlignmentGuideController.hideAlignmentGuides', () => {
    it('clears existing guide lines', () => {
        const guidesGroup = { innerHTML: 'stub' };
        const context = {
            svg: {
                querySelector: vi.fn(() => guidesGroup)
            }
        };

        AlignmentGuideController.hideAlignmentGuides.call(context);

        expect(guidesGroup.innerHTML).toBe('');
    });
});
