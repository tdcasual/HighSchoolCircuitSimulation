import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindButtonEvents } from '../src/ui/interaction/PanelBindingsController.js';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';

function createButton() {
    const listeners = new Map();
    return {
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        click(event = {}) {
            const handler = listeners.get('click');
            if (handler) handler(event);
        }
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('mobile restore primary task tracking', () => {
    it('marks build as the active primary task when phone user enters wire mode', () => {
        const wireBtn = createButton();
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'btn-mobile-mode-wire') return wireBtn;
                return null;
            })
        });
        const ctx = {
            app: { markMobilePrimaryTask: vi.fn() },
            setMobileInteractionMode: vi.fn(),
            updateStatus: vi.fn()
        };

        bindButtonEvents.call(ctx);
        wireBtn.click();

        expect(ctx.app.markMobilePrimaryTask).toHaveBeenCalledWith('build');
        expect(ctx.setMobileInteractionMode).toHaveBeenCalledWith('wire');
    });

    it('marks observation as the active primary task before opening chart flow', () => {
        const chartBtn = createButton();
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'btn-mobile-add-chart') return chartBtn;
                return null;
            })
        });
        const ctx = {
            app: {
                markMobilePrimaryTask: vi.fn(),
                chartWorkspace: {
                    addChart: vi.fn(() => ({})),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        bindButtonEvents.call(ctx);
        chartBtn.click();

        expect(ctx.app.markMobilePrimaryTask).toHaveBeenCalledWith('observe');
        expect(ctx.app.chartWorkspace.requestRender).toHaveBeenCalled();
    });

    it('computes restore labels from the tracked primary task', () => {
        const buildLabel = AppRuntimeV2.prototype.getMobileRestoreLabel.call({ mobilePrimaryTask: 'build' });
        const observeLabel = AppRuntimeV2.prototype.getMobileRestoreLabel.call({ mobilePrimaryTask: 'observe' });

        expect(buildLabel).toBe('返回编辑');
        expect(observeLabel).toBe('回到观察');
    });
});
