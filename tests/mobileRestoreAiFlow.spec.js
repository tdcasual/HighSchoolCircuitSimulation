import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

function createClassList(initial = []) {
    const set = new Set(initial);
    return {
        add: (...names) => names.forEach((name) => set.add(name)),
        remove: (...names) => names.forEach((name) => set.delete(name)),
        contains: (name) => set.has(name),
        toggle: (name, force) => {
            if (force === true) {
                set.add(name);
                return true;
            }
            if (force === false) {
                set.delete(name);
                return false;
            }
            if (set.has(name)) {
                set.delete(name);
                return false;
            }
            set.add(name);
            return true;
        }
    };
}

function createPanel({ collapsed = false, width = 420, height = 420 } = {}) {
    const panel = {
        classList: createClassList(collapsed ? ['collapsed'] : []),
        style: {
            width: `${width}px`,
            height: `${height}px`
        }
    };
    Object.defineProperty(panel, 'offsetWidth', { get: () => width });
    Object.defineProperty(panel, 'offsetHeight', { get: () => height });
    return panel;
}

function createContext({ collapsed = false } = {}) {
    const panel = createPanel({ collapsed });
    return {
        app: {
            mobileRestoreBroker: {
                register: vi.fn(),
                clear: vi.fn()
            },
            getMobileRestoreLabel: vi.fn(() => '返回编辑')
        },
        panel,
        toggleBtn: { textContent: '', title: '', setAttribute: vi.fn() },
        fabBtn: { setAttribute: vi.fn() },
        minPanelWidth: 320,
        minPanelHeight: 260,
        collapsedPanelSize: 52,
        expandedPanelWidth: 420,
        expandedPanelHeight: 420,
        viewportPadding: 0,
        defaultRightOffset: 20,
        defaultBottomOffset: 16,
        getPanelBounds: () => ({ minX: 0, minY: 0, maxX: 1200, maxY: 800 }),
        constrainPanelToViewport: vi.fn(),
        savePanelLayout: vi.fn(),
        markPanelActive: vi.fn(),
        clamp: AIPanel.prototype.clamp,
        isPanelCollapsed: AIPanel.prototype.isPanelCollapsed,
        getCollapsedPanelSize: AIPanel.prototype.getCollapsedPanelSize,
        getCollapsedPanelWidth: AIPanel.prototype.getCollapsedPanelWidth,
        getCollapsedPanelHeight: AIPanel.prototype.getCollapsedPanelHeight,
        rememberExpandedPanelSize: AIPanel.prototype.rememberExpandedPanelSize,
        syncPanelCollapsedUI: AIPanel.prototype.syncPanelCollapsedUI,
        setPanelCollapsed: AIPanel.prototype.setPanelCollapsed,
        applyPanelLayout: AIPanel.prototype.applyPanelLayout
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('AIPanel mobile restore flow', () => {
    it('registers 返回编辑 candidate when AI panel expands in phone mode', () => {
        const ctx = createContext({ collapsed: false });
        const toggle = vi.fn();
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: (name) => name === 'layout-mode-phone',
                    toggle
                }
            }
        });

        AIPanel.prototype.syncPanelCollapsedUI.call(ctx);

        expect(ctx.app.mobileRestoreBroker.register).toHaveBeenCalledWith(expect.objectContaining({
            id: 'ai-return-to-edit',
            source: 'ai',
            label: '返回编辑',
            action: { type: 'focus-canvas' }
        }));
    });

    it('clears AI restore candidate when panel collapses', () => {
        const ctx = createContext({ collapsed: true });
        const toggle = vi.fn();
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: (name) => name === 'layout-mode-phone',
                    toggle
                }
            }
        });

        AIPanel.prototype.syncPanelCollapsedUI.call(ctx);

        expect(ctx.app.mobileRestoreBroker.clear).toHaveBeenCalledWith('ai');
    });
});
