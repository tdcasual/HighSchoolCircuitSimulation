import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('AIPanel.initializeUI', () => {
    it('does not throw when optional settings button is absent', () => {
        const container = { appendChild: vi.fn() };
        const panel = { addEventListener: vi.fn() };
        const panelHeader = { addEventListener: vi.fn() };
        const toggleBtn = { addEventListener: vi.fn() };
        const fabBtn = { addEventListener: vi.fn() };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'canvas-container': container,
                'ai-assistant-panel': panel,
                'ai-panel-header': panelHeader,
                'ai-toggle-btn': toggleBtn,
                'ai-fab-btn': fabBtn,
                // intentionally missing ai-settings-btn
                'ai-resize-handle': null
            }[id] ?? null)),
            createElement: vi.fn(() => ({
                id: '',
                className: '',
                hidden: false,
                textContent: '',
                style: {},
                appendChild: vi.fn(),
                addEventListener: vi.fn(),
                classList: { add: vi.fn(), remove: vi.fn() }
            }))
        });

        const ctx = {
            syncPanelCollapsedUI: vi.fn(),
            initializeChat: vi.fn(),
            initializeSettingsDialog: vi.fn(),
            initializePanelLayoutControls: vi.fn(),
            bindMathJaxLoadListener: vi.fn(),
            openSettings: vi.fn(),
            setPanelCollapsed: vi.fn(),
            isPanelCollapsed: vi.fn(() => false),
            markPanelActive: vi.fn()
        };

        expect(() => AIPanel.prototype.initializeUI.call(ctx)).not.toThrow();
        expect(ctx.initializeChat).toHaveBeenCalledTimes(1);
        expect(ctx.initializeSettingsDialog).toHaveBeenCalledTimes(1);
        expect(ctx.initializePanelLayoutControls).toHaveBeenCalledTimes(1);
        expect(ctx.bindMathJaxLoadListener).toHaveBeenCalledTimes(1);
    });

    it('header dblclick handler tolerates targets without closest', () => {
        let dblclickHandler = null;
        const panelHeader = {
            addEventListener: vi.fn((type, handler) => {
                if (type === 'dblclick') dblclickHandler = handler;
            })
        };
        const panel = { addEventListener: vi.fn() };
        const toggleBtn = { addEventListener: vi.fn() };
        const fabBtn = { addEventListener: vi.fn() };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'ai-assistant-panel': panel,
                'ai-panel-header': panelHeader,
                'ai-toggle-btn': toggleBtn,
                'ai-fab-btn': fabBtn,
                'ai-resize-handle': null
            }[id] ?? null))
        });

        const ctx = {
            syncPanelCollapsedUI: vi.fn(),
            initializeChat: vi.fn(),
            initializeSettingsDialog: vi.fn(),
            initializePanelLayoutControls: vi.fn(),
            bindMathJaxLoadListener: vi.fn(),
            setPanelCollapsed: vi.fn(),
            isPanelCollapsed: vi.fn(() => false),
            markPanelActive: vi.fn()
        };

        AIPanel.prototype.initializeUI.call(ctx);
        expect(typeof dblclickHandler).toBe('function');

        const event = {
            target: {},
            preventDefault: vi.fn()
        };

        expect(() => dblclickHandler(event)).not.toThrow();
        expect(ctx.setPanelCollapsed).toHaveBeenCalledTimes(1);
    });

    it('does not throw when core addEventListener hooks are non-callable', () => {
        const panel = {};
        const panelHeader = { addEventListener: {} };
        const toggleBtn = { addEventListener: {} };
        const fabBtn = { addEventListener: {} };
        const settingsBtn = { addEventListener: {} };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'ai-assistant-panel': panel,
                'ai-panel-header': panelHeader,
                'ai-toggle-btn': toggleBtn,
                'ai-fab-btn': fabBtn,
                'ai-settings-btn': settingsBtn,
                'ai-resize-handle': null
            }[id] ?? null))
        });

        const ctx = {
            syncPanelCollapsedUI: vi.fn(),
            initializeChat: vi.fn(),
            initializeSettingsDialog: vi.fn(),
            initializePanelLayoutControls: vi.fn(),
            bindMathJaxLoadListener: vi.fn(),
            setPanelCollapsed: vi.fn(),
            isPanelCollapsed: vi.fn(() => false),
            markPanelActive: vi.fn()
        };

        expect(() => AIPanel.prototype.initializeUI.call(ctx)).not.toThrow();
    });
});

describe('AIPanel.bindMathJaxLoadListener', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('does not throw when script addEventListener is non-callable', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'MathJax-script' ? { addEventListener: {} } : null))
        });
        const ctx = {
            mathJaxLoadListenerBound: false,
            flushMathTypesetQueue: vi.fn()
        };

        expect(() => AIPanel.prototype.bindMathJaxLoadListener.call(ctx)).not.toThrow();
    });
});
