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

function createPanel({ collapsed = false, left = 100, top = 120, width = 420, height = 420 } = {}) {
    const panel = {
        classList: createClassList(collapsed ? ['collapsed'] : []),
        style: {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`
        },
        getBoundingClientRect() {
            const styleLeft = parseFloat(panel.style.left);
            const styleTop = parseFloat(panel.style.top);
            const styleWidth = parseFloat(panel.style.width);
            const styleHeight = parseFloat(panel.style.height);
            return {
                left: Number.isFinite(styleLeft) ? styleLeft : left,
                top: Number.isFinite(styleTop) ? styleTop : top,
                width: Number.isFinite(styleWidth) ? styleWidth : width,
                height: Number.isFinite(styleHeight) ? styleHeight : height
            };
        }
    };

    Object.defineProperty(panel, 'offsetWidth', {
        get() {
            const value = parseFloat(panel.style.width);
            return Number.isFinite(value) ? value : width;
        }
    });
    Object.defineProperty(panel, 'offsetHeight', {
        get() {
            const value = parseFloat(panel.style.height);
            return Number.isFinite(value) ? value : height;
        }
    });

    return panel;
}

function createContext({ collapsed = false, width = 420, height = 420, expandedPanelWidth = null, expandedPanelHeight = null } = {}) {
    const panel = createPanel({ collapsed, width, height });
    const toggleBtn = {
        textContent: '',
        title: '',
        setAttribute: vi.fn()
    };
    const fabBtn = {
        setAttribute: vi.fn()
    };

    const ctx = {
        panel,
        toggleBtn,
        fabBtn,
        minPanelWidth: 320,
        minPanelHeight: 260,
        collapsedPanelSize: 52,
        expandedPanelWidth,
        expandedPanelHeight,
        viewportPadding: 0,
        defaultRightOffset: 20,
        defaultBottomOffset: 16,
        setPanelAbsolutePosition: AIPanel.prototype.setPanelAbsolutePosition,
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

    return { ctx, panel, toggleBtn, fabBtn };
}

describe('AIPanel layout collapse behavior', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('collapses to floating icon size and keeps expanded dimensions', () => {
        const { ctx, panel, toggleBtn } = createContext({ collapsed: false, width: 420, height: 420 });

        AIPanel.prototype.setPanelCollapsed.call(ctx, true, { persist: false, constrain: false });

        expect(panel.classList.contains('collapsed')).toBe(true);
        expect(panel.style.width).toBe('52px');
        expect(panel.style.height).toBe('52px');
        expect(ctx.expandedPanelWidth).toBe(420);
        expect(ctx.expandedPanelHeight).toBe(420);
        expect(toggleBtn.textContent).toBe('展开');
    });

    it('expands back to previous dimensions after minimizing', () => {
        const { ctx, panel, toggleBtn } = createContext({
            collapsed: true,
            width: 52,
            height: 52,
            expandedPanelWidth: 376,
            expandedPanelHeight: 344
        });

        AIPanel.prototype.setPanelCollapsed.call(ctx, false, { persist: false, constrain: false });

        expect(panel.classList.contains('collapsed')).toBe(false);
        expect(panel.style.width).toBe('376px');
        expect(panel.style.height).toBe('344px');
        expect(toggleBtn.textContent).toBe('最小化');
    });

    it('saves collapsed state with expanded width/height in layout payload', () => {
        const { ctx } = createContext({
            collapsed: true,
            width: 52,
            height: 52,
            expandedPanelWidth: 420,
            expandedPanelHeight: 420
        });
        const store = new Map();
        vi.stubGlobal('localStorage', {
            setItem: (key, value) => store.set(key, value),
            getItem: () => null
        });

        ctx.layoutStorageKey = 'ai_panel_layout_test';
        ctx.savePanelLayout = AIPanel.prototype.savePanelLayout;

        AIPanel.prototype.savePanelLayout.call(ctx);

        const saved = JSON.parse(store.get('ai_panel_layout_test'));
        expect(saved.collapsed).toBe(true);
        expect(saved.width).toBe(52);
        expect(saved.height).toBe(52);
        expect(saved.expandedWidth).toBe(420);
        expect(saved.expandedHeight).toBe(420);
    });

    it('clamps collapsed icon position inside viewport bounds', () => {
        const { ctx, panel } = createContext({ collapsed: false, width: 420, height: 420 });

        AIPanel.prototype.applyPanelLayout.call(ctx, {
            left: 1188,
            top: 788,
            expandedWidth: 420,
            expandedHeight: 420,
            collapsed: true
        });

        expect(panel.style.width).toBe('52px');
        expect(panel.style.height).toBe('52px');
        expect(panel.style.left).toBe('1148px');
        expect(panel.style.top).toBe('748px');
    });

    it('updates floating icon accessibility state while collapsed', () => {
        const { ctx, fabBtn } = createContext({ collapsed: true, width: 52, height: 52 });

        AIPanel.prototype.syncPanelCollapsedUI.call(ctx);

        expect(fabBtn.setAttribute).toHaveBeenCalledWith('aria-hidden', 'false');
        expect(fabBtn.setAttribute).toHaveBeenCalledWith('title', '展开 AI 助手');
    });

    it('allows dragging from floating icon when collapsed', () => {
        const { ctx } = createContext({ collapsed: true, width: 52, height: 52 });
        ctx.startPanelGesture = vi.fn();
        const event = {
            pointerType: 'mouse',
            button: 0,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            target: {
                closest: (selector) => selector === '#ai-fab-btn'
            }
        };

        AIPanel.prototype.tryStartCollapsedPanelDrag.call(ctx, event);

        expect(ctx.startPanelGesture).toHaveBeenCalledWith('drag', event);
    });

    it('reserves phone bottom bars and ignores side panel width when computing bounds', () => {
        const body = {
            classList: {
                contains: (name) => name === 'layout-mode-phone'
            }
        };
        const sidePanel = {
            getBoundingClientRect: () => ({ width: 220, height: 500 })
        };
        const statusBar = {
            hidden: false,
            getBoundingClientRect: () => ({ width: 390, height: 34 })
        };
        const mobileControls = {
            hidden: false,
            getBoundingClientRect: () => ({ width: 374, height: 66 })
        };
        vi.stubGlobal('window', {
            innerWidth: 390,
            innerHeight: 844
        });
        vi.stubGlobal('document', {
            body,
            getElementById: vi.fn((id) => ({
                'side-panel': sidePanel,
                'status-bar': statusBar,
                'canvas-mobile-controls': mobileControls
            }[id] || null))
        });

        const ctx = {
            app: { logger: { warn: vi.fn() } },
            circuit: {},
            viewportPadding: 12,
            defaultRightOffset: 20,
            defaultBottomOffset: 16
        };

        const bounds = AIPanel.prototype.getPanelBounds.call(ctx);

        expect(bounds.maxX).toBe(378);
        expect(bounds.maxY).toBe(724);
    });

    it('does not start resize gesture in phone layout', () => {
        const { ctx } = createContext({ collapsed: false, width: 420, height: 420 });
        const toggle = vi.fn();
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: (name) => name === 'layout-mode-phone',
                    toggle
                }
            }
        });
        ctx.startPanelGesture = vi.fn();
        const event = {
            pointerType: 'mouse',
            button: 0,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        AIPanel.prototype.tryStartPanelResize.call(ctx, event);

        expect(ctx.startPanelGesture).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('toggles ai-panel-open class while expanded in phone layout', () => {
        const { ctx, panel } = createContext({ collapsed: false, width: 420, height: 420 });
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
        panel.classList.add('collapsed');
        AIPanel.prototype.syncPanelCollapsedUI.call(ctx);

        expect(toggle).toHaveBeenCalledWith('ai-panel-open', true);
        expect(toggle).toHaveBeenCalledWith('ai-panel-open', false);
    });
});
