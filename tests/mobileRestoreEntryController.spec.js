import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileRestoreBroker } from '../src/ui/mobile/MobileRestoreBroker.js';
import { MobileRestoreEntryController } from '../src/ui/mobile/MobileRestoreEntryController.js';

function createClassList() {
    const values = new Set(['layout-mode-phone']);
    return {
        add: vi.fn((...classes) => classes.forEach((name) => values.add(name))),
        remove: vi.fn((...classes) => classes.forEach((name) => values.delete(name))),
        toggle: vi.fn((name, force) => {
            if (force === undefined) {
                if (values.has(name)) {
                    values.delete(name);
                    return false;
                }
                values.add(name);
                return true;
            }
            if (force) {
                values.add(name);
            } else {
                values.delete(name);
            }
            return !!force;
        }),
        contains: vi.fn((name) => values.has(name))
    };
}

function createButtonMock() {
    const listeners = new Map();
    const attrs = {};
    return {
        hidden: true,
        textContent: '',
        classList: createClassList(),
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        setAttribute: vi.fn((name, value) => {
            attrs[name] = String(value);
        }),
        getAttribute: vi.fn((name) => attrs[name]),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('MobileRestoreEntryController', () => {
    it('shows restore anchor in phone mode and dispatches action through app runtime', () => {
        const button = createButtonMock();
        vi.stubGlobal('document', {
            body: { classList: createClassList() },
            getElementById: vi.fn((id) => (id === 'mobile-restore-entry' ? button : null))
        });
        const broker = new MobileRestoreBroker();
        const app = { runMobileRestoreAction: vi.fn() };
        const controller = new MobileRestoreEntryController(app, broker);

        broker.register({
            id: 'guide-resume',
            source: 'guide',
            label: '继续上手',
            priority: 90,
            action: { type: 'show-guide' }
        });
        controller.sync();
        button.trigger('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });

        expect(button.hidden).toBe(false);
        expect(button.textContent).toContain('继续上手');
        expect(app.runMobileRestoreAction).toHaveBeenCalledWith({ type: 'show-guide' });
    });
});
