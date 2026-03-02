import { afterEach, describe, expect, it, vi } from 'vitest';
import * as UIStateController from '../src/ui/interaction/UIStateController.js';
import { getLegacyPathUsageSnapshot } from '../src/app/legacy/LegacyPathUsageTracker.js';

afterEach(() => {
    vi.useRealTimers();
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

    it('returns false when observation page classList contains is non-callable', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { contains: {} }
            }))
        });

        expect(() => UIStateController.isObservationTabActive()).not.toThrow();
        expect(UIStateController.isObservationTabActive()).toBe(false);
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

    it('does not throw when dialog overlay is missing', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null)
        });
        const ctx = { editingComponent: { id: 'R1' } };

        expect(() => UIStateController.hideDialog.call(ctx)).not.toThrow();
        expect(ctx.editingComponent).toBe(null);
    });

    it('does not throw when dialog classList add is non-callable', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                classList: { add: {} }
            }))
        });
        const ctx = { editingComponent: { id: 'R1' } };

        expect(() => UIStateController.hideDialog.call(ctx)).not.toThrow();
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

describe('UIStateController.getActiveInteractionMode', () => {
    it('prefers interaction mode store state over legacy flags', () => {
        const context = {
            interactionModeStore: {
                getState: vi.fn(() => ({
                    mode: 'endpoint-edit'
                }))
            },
            pendingToolType: 'Wire',
            isWiring: true
        };

        expect(UIStateController.getActiveInteractionMode.call(context)).toBe('endpoint-edit');
    });

    it('falls back to legacy flags when mode store is unavailable', () => {
        const context = {
            pendingToolType: 'Wire',
            isWiring: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        expect(UIStateController.getActiveInteractionMode.call(context)).toBe('wire');
        const snapshot = getLegacyPathUsageSnapshot(context);
        expect(snapshot).toHaveLength(1);
        expect(snapshot[0].key).toBe('interaction.mode.legacy-fallback');
        expect(snapshot[0].count).toBe(1);
        expect(snapshot[0].lastDetails?.reason).toBe('store-missing');
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
        const actionButton = {
            hidden: false,
            textContent: '撤销',
            onclick: vi.fn(),
            setAttribute: vi.fn()
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'status-text') return statusNode;
                if (id === 'status-action-btn') return actionButton;
                return null;
            })
        });

        UIStateController.updateStatus('done');

        expect(statusNode.textContent).toBe('done');
        expect(actionButton.hidden).toBe(true);
    });
});

describe('UIStateController status action', () => {
    it('shows status action and invokes callback on click', () => {
        const statusNode = { textContent: '' };
        const actionButton = {
            hidden: true,
            textContent: '',
            onclick: null,
            setAttribute: vi.fn(),
            removeAttribute: vi.fn()
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'status-text') return statusNode;
                if (id === 'status-action-btn') return actionButton;
                return null;
            })
        });
        const ctx = {};
        const onAction = vi.fn();

        const shown = UIStateController.showStatusAction.call(ctx, {
            label: '撤销',
            statusText: '已删除导线',
            durationMs: 2000,
            onAction
        });

        expect(shown).toBe(true);
        expect(statusNode.textContent).toBe('已删除导线');
        expect(actionButton.hidden).toBe(false);
        expect(actionButton.textContent).toBe('撤销');
        expect(typeof actionButton.onclick).toBe('function');

        actionButton.onclick({ preventDefault: vi.fn() });
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(actionButton.hidden).toBe(true);
    });

    it('auto-hides status action after duration', () => {
        vi.useFakeTimers();
        const actionButton = {
            hidden: true,
            textContent: '',
            onclick: null,
            setAttribute: vi.fn(),
            removeAttribute: vi.fn()
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'status-text') return { textContent: '' };
                if (id === 'status-action-btn') return actionButton;
                return null;
            })
        });
        const ctx = {};
        const onAction = vi.fn();

        UIStateController.showStatusAction.call(ctx, {
            label: '撤销',
            durationMs: 2000,
            onAction
        });

        expect(actionButton.hidden).toBe(false);
        vi.advanceTimersByTime(2000);
        expect(actionButton.hidden).toBe(true);
        expect(onAction).not.toHaveBeenCalled();
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
