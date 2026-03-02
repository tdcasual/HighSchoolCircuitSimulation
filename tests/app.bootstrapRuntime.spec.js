import { describe, expect, it, vi } from 'vitest';
import { registerAppBootstrap } from '../src/app/AppBootstrapRuntime.js';

describe('registerAppBootstrap', () => {
    it('registers DOMContentLoaded handler and initializes app instance on trigger', () => {
        let domReadyHandler = null;
        const doc = {
            addEventListener: vi.fn((eventName, handler) => {
                if (eventName === 'DOMContentLoaded') {
                    domReadyHandler = handler;
                }
            })
        };
        const runtimeWindow = {};
        const appInstance = { id: 'app-instance' };
        const createApp = vi.fn(() => appInstance);

        const registered = registerAppBootstrap({
            documentRef: doc,
            windowRef: runtimeWindow,
            createApp
        });

        expect(registered).toBe(true);
        expect(typeof domReadyHandler).toBe('function');
        domReadyHandler();
        expect(createApp).toHaveBeenCalledTimes(1);
        expect(runtimeWindow.app).toBe(appInstance);
    });

    it('does not throw when event listener registration fails', () => {
        const doc = {
            addEventListener: vi.fn(() => {
                throw new Error('registration failed');
            })
        };
        const createApp = vi.fn(() => ({}));

        expect(() => registerAppBootstrap({
            documentRef: doc,
            windowRef: {},
            createApp
        })).not.toThrow();
        expect(createApp).not.toHaveBeenCalled();
    });
});
