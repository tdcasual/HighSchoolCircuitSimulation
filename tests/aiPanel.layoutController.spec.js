import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';
import { PanelLayoutController } from '../src/ui/ai/PanelLayoutController.js';

describe('PanelLayoutController', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new PanelLayoutController(deps);
        expect(controller.deps).toBe(deps);
    });

    it('delegates setPanelCollapsed to PanelLayoutController', () => {
        const panel = {
            layoutController: {
                setPanelCollapsed: vi.fn()
            }
        };

        AIPanel.prototype.setPanelCollapsed.call(panel, true);

        expect(panel.layoutController.setPanelCollapsed).toHaveBeenCalledWith(true, undefined);
    });

    it('tryStartPanelDrag does not throw when target has no closest method', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false)
                }
            }
        });
        const panel = {
            panel: {},
            startPanelGesture: vi.fn()
        };
        const controller = new PanelLayoutController({ panel });
        const event = {
            pointerType: 'mouse',
            button: 0,
            target: {},
            preventDefault: vi.fn()
        };

        expect(() => controller.tryStartPanelDrag(event)).not.toThrow();
        expect(panel.startPanelGesture).toHaveBeenCalledTimes(1);
    });

    it('tryStartCollapsedPanelDrag does not throw when target has no closest method', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false)
                }
            }
        });
        const panel = {
            panel: {},
            isPanelCollapsed: vi.fn(() => true),
            startPanelGesture: vi.fn()
        };
        const controller = new PanelLayoutController({ panel });
        const event = {
            pointerType: 'mouse',
            button: 0,
            target: {},
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        expect(() => controller.tryStartCollapsedPanelDrag(event)).not.toThrow();
        expect(panel.startPanelGesture).not.toHaveBeenCalled();
    });

    it('tryStartPanelDrag does not throw when body classList contains is non-callable', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: {}
                }
            }
        });
        const panel = {
            panel: {},
            startPanelGesture: vi.fn()
        };
        const controller = new PanelLayoutController({ panel });
        const event = {
            pointerType: 'mouse',
            button: 0,
            target: {},
            preventDefault: vi.fn()
        };

        expect(() => controller.tryStartPanelDrag(event)).not.toThrow();
        expect(panel.startPanelGesture).toHaveBeenCalledTimes(1);
    });

    it('isPanelCollapsed returns false when classList contains is non-callable', () => {
        const panel = {
            panel: {
                classList: {
                    contains: {}
                }
            }
        };
        const controller = new PanelLayoutController({ panel });

        expect(() => controller.isPanelCollapsed()).not.toThrow();
        expect(controller.isPanelCollapsed()).toBe(false);
    });

    it('setPanelCollapsed does not throw when classList add/remove are non-callable', () => {
        const panel = {
            panel: {
                classList: {
                    add: {},
                    remove: {}
                },
                style: {}
            },
            isPanelCollapsed: vi.fn(() => false),
            rememberExpandedPanelSize: vi.fn(),
            getCollapsedPanelWidth: vi.fn(() => 52),
            getCollapsedPanelHeight: vi.fn(() => 52),
            syncPanelCollapsedUI: vi.fn(),
            markPanelActive: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            savePanelLayout: vi.fn()
        };
        const controller = new PanelLayoutController({ panel });

        expect(() => controller.setPanelCollapsed(true)).not.toThrow();
    });

    it('syncPanelCollapsedUI does not throw when fab button setAttribute is non-callable', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    toggle: vi.fn()
                }
            }
        });
        const panel = {
            panel: {},
            isPanelCollapsed: vi.fn(() => true),
            toggleBtn: null,
            fabBtn: {
                setAttribute: {}
            }
        };
        const controller = new PanelLayoutController({ panel });

        expect(() => controller.syncPanelCollapsedUI()).not.toThrow();
    });

    it('applyPanelLayout does not throw in phone mode when panel classList.toggle is non-callable', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn((name) => name === 'layout-mode-phone')
                }
            },
            getElementById: vi.fn(() => null)
        });
        vi.stubGlobal('window', {
            innerWidth: 390,
            innerHeight: 844,
            visualViewport: null
        });
        const panel = {
            panel: {
                classList: {
                    toggle: {}
                },
                style: {},
                offsetWidth: 320,
                offsetHeight: 300
            },
            minPanelWidth: 320,
            minPanelHeight: 260,
            viewportPadding: 12,
            expandedPanelWidth: 320,
            expandedPanelHeight: 300,
            clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
            getCollapsedPanelWidth: () => 52,
            getCollapsedPanelHeight: () => 52,
            getCollapsedPanelSize: () => 52,
            setPanelAbsolutePosition: vi.fn(),
            syncPanelCollapsedUI: vi.fn(),
            getPanelBounds: () => ({ minX: 12, minY: 12, maxX: 378, maxY: 700 }),
            isPanelCollapsed: () => false,
            defaultRightOffset: 20,
            defaultBottomOffset: 16
        };
        const controller = new PanelLayoutController({ panel });

        expect(() => controller.applyPanelLayout({ collapsed: true })).not.toThrow();
    });
});
