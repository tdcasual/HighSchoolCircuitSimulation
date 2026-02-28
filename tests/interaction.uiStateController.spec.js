import { afterEach, describe, expect, it, vi } from 'vitest';
import * as UIStateController from '../src/ui/interaction/UIStateController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('UIStateController.isObservationTabActive', () => {
    it('returns true when observation page is active', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: vi.fn(() => true) }
            }))
        });

        expect(UIStateController.isObservationTabActive()).toBe(true);
    });
});

describe('UIStateController.hideDialog', () => {
    it('hides dialog overlay and clears editing component', () => {
        const add = vi.fn();
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { add }
            }))
        });
        const ctx = { editingComponent: { id: 'R1' } };

        UIStateController.hideDialog.call(ctx);

        expect(add).toHaveBeenCalledWith('hidden');
        expect(ctx.editingComponent).toBe(null);
    });
});

describe('UIStateController.safeParseFloat', () => {
    it('returns default for invalid value and clamps min/max', () => {
        expect(UIStateController.safeParseFloat('abc', 12, 0, 20)).toBe(12);
        expect(UIStateController.safeParseFloat('-5', 1, 0, 20)).toBe(0);
        expect(UIStateController.safeParseFloat('50', 1, 0, 20)).toBe(20);
    });
});

describe('UIStateController.getBlackBoxContainedComponentIds', () => {
    it('returns ids inside blackbox and excludes nested blackbox by default', () => {
        const box = { id: 'B1', type: 'BlackBox', x: 100, y: 100, boxWidth: 200, boxHeight: 120 };
        const ctx = {
            circuit: {
                components: new Map([
                    ['B1', box],
                    ['R1', { id: 'R1', type: 'Resistor', x: 120, y: 110 }],
                    ['B2', { id: 'B2', type: 'BlackBox', x: 90, y: 90 }],
                    ['R2', { id: 'R2', type: 'Resistor', x: 500, y: 500 }]
                ])
            }
        };

        const ids = UIStateController.getBlackBoxContainedComponentIds.call(ctx, box);
        expect(ids).toEqual(['R1']);
    });

    it('includes nested blackbox when includeBoxes=true', () => {
        const box = { id: 'B1', type: 'BlackBox', x: 100, y: 100, boxWidth: 200, boxHeight: 120 };
        const ctx = {
            circuit: {
                components: new Map([
                    ['B1', box],
                    ['B2', { id: 'B2', type: 'BlackBox', x: 90, y: 90 }]
                ])
            }
        };

        const ids = UIStateController.getBlackBoxContainedComponentIds.call(ctx, box, { includeBoxes: true });
        expect(ids).toEqual(['B2']);
    });
});

describe('UIStateController.updateStatus', () => {
    it('writes status text', () => {
        const statusNode = { textContent: '' };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => statusNode)
        });

        UIStateController.updateStatus('done');

        expect(statusNode.textContent).toBe('done');
    });
});

describe('UIStateController first-run guide preference', () => {
    function createStorageMock(seed = {}) {
        const map = new Map(Object.entries(seed));
        return {
            getItem: vi.fn((key) => (map.has(key) ? map.get(key) : null)),
            setItem: vi.fn((key, value) => {
                map.set(key, String(value));
            })
        };
    }

    it('shows guide by default and persists remember state', () => {
        const storage = createStorageMock();
        expect(UIStateController.shouldShowFirstRunGuide({ storage })).toBe(true);

        const persisted = UIStateController.setFirstRunGuideDismissed(true, { storage });
        expect(persisted).toBe(true);
        expect(UIStateController.isFirstRunGuideDismissed({ storage })).toBe(true);
        expect(UIStateController.shouldShowFirstRunGuide({ storage })).toBe(false);
    });

    it('disables guide when feature flag is off', () => {
        const storage = createStorageMock();
        expect(UIStateController.shouldShowFirstRunGuide({ storage, enabled: false })).toBe(false);
    });

    it('handles invalid storage access gracefully', () => {
        const storage = {
            getItem: vi.fn(() => {
                throw new Error('blocked');
            }),
            setItem: vi.fn(() => {
                throw new Error('blocked');
            })
        };
        expect(UIStateController.isFirstRunGuideDismissed({ storage })).toBe(false);
        expect(UIStateController.setFirstRunGuideDismissed(true, { storage })).toBe(false);
        expect(UIStateController.shouldShowFirstRunGuide({ storage })).toBe(true);
    });
});
