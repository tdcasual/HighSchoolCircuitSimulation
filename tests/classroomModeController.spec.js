import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassroomModeController } from '../src/ui/ClassroomModeController.js';

function createClassList() {
    const values = new Set();
    return {
        add: vi.fn((...classes) => {
            classes.forEach((name) => values.add(name));
        }),
        remove: vi.fn((...classes) => {
            classes.forEach((name) => values.delete(name));
        }),
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
        contains: vi.fn((name) => values.has(name)),
        _values: values
    };
}

function createButtonMock() {
    const listeners = new Map();
    const attrs = {};
    return {
        hidden: false,
        disabled: false,
        textContent: '',
        title: '',
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        removeEventListener: vi.fn((eventName, handler) => {
            const current = listeners.get(eventName);
            if (current === handler) listeners.delete(eventName);
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

function createWindowMock(width = 1366) {
    const listeners = new Map();
    return {
        innerWidth: width,
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        removeEventListener: vi.fn((eventName, handler) => {
            const current = listeners.get(eventName);
            if (current === handler) listeners.delete(eventName);
        }),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

function setupFixture(options = {}) {
    const {
        width = 1366,
        storedLevel = null,
        storedLegacy = null
    } = options;
    const body = { classList: createClassList() };
    const button = createButtonMock();
    const win = createWindowMock(width);

    const values = new Map([
        ['ui.classroom_mode_level', storedLevel],
        ['ui.classroom_mode_enabled', storedLegacy]
    ]);

    const storage = {
        getItem: vi.fn((key) => values.get(key) ?? null),
        setItem: vi.fn((key, value) => {
            values.set(key, String(value));
        })
    };

    vi.stubGlobal('document', {
        body,
        getElementById: vi.fn((id) => {
            if (id === 'btn-classroom-mode') return button;
            return null;
        })
    });
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', storage);

    return { body, button, win, storage };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ClassroomModeController', () => {
    it('restores stored enhanced level and applies enhanced class on desktop', () => {
        const { body, button } = setupFixture({ width: 1366, storedLevel: 'enhanced' });
        new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus: vi.fn()
        });

        expect(body.classList.contains('classroom-mode')).toBe(true);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(true);
        expect(button.hidden).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.textContent).toBe('课堂模式: 增强');
    });

    it('restores legacy boolean storage to standard mode for backward compatibility', () => {
        const { body, button } = setupFixture({ width: 1366, storedLevel: null, storedLegacy: '1' });
        new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus: vi.fn()
        });

        expect(body.classList.contains('classroom-mode')).toBe(true);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(false);
        expect(button.textContent).toBe('课堂模式: 标准');
    });

    it('suspends preferred level in compact viewport and restores after resize', () => {
        const { body, button, win } = setupFixture({ width: 820, storedLevel: 'enhanced' });
        let overlay = true;
        new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => overlay },
            updateStatus: vi.fn()
        });

        expect(body.classList.contains('classroom-mode')).toBe(false);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(false);
        expect(button.hidden).toBe(true);

        overlay = false;
        win.innerWidth = 1280;
        win.trigger('resize');

        expect(body.classList.contains('classroom-mode')).toBe(true);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(true);
        expect(button.hidden).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('true');
    });

    it('cycles off -> standard -> enhanced -> off and persists level', () => {
        const { body, button, storage } = setupFixture({ width: 1366 });
        const updateStatus = vi.fn();
        new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus
        });

        button.trigger('click');

        expect(body.classList.contains('classroom-mode')).toBe(true);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(false);
        expect(button.textContent).toBe('课堂模式: 标准');
        expect(storage.setItem).toHaveBeenCalledWith('ui.classroom_mode_level', 'standard');
        expect(storage.setItem).toHaveBeenCalledWith('ui.classroom_mode_enabled', '1');
        expect(updateStatus).toHaveBeenLastCalledWith('已开启课堂模式（标准）');

        button.trigger('click');

        expect(body.classList.contains('classroom-mode')).toBe(true);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(true);
        expect(button.textContent).toBe('课堂模式: 增强');
        expect(storage.setItem).toHaveBeenCalledWith('ui.classroom_mode_level', 'enhanced');
        expect(updateStatus).toHaveBeenLastCalledWith('已开启课堂模式（增强）');

        button.trigger('click');

        expect(body.classList.contains('classroom-mode')).toBe(false);
        expect(body.classList.contains('classroom-mode-enhanced')).toBe(false);
        expect(button.textContent).toBe('课堂模式: 关');
        expect(storage.setItem).toHaveBeenCalledWith('ui.classroom_mode_level', 'off');
        expect(storage.setItem).toHaveBeenCalledWith('ui.classroom_mode_enabled', '0');
        expect(updateStatus).toHaveBeenLastCalledWith('已关闭课堂模式');
    });

    it('forces endpoint auto-bridge off while classroom mode is active and restores previous mode when disabled', () => {
        const { button } = setupFixture({ width: 1366, storedLevel: 'off' });
        const interaction = {
            endpointAutoBridgeMode: 'auto',
            setEndpointAutoBridgeMode: vi.fn((mode) => {
                interaction.endpointAutoBridgeMode = mode;
                return mode;
            })
        };
        new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus: vi.fn(),
            interaction
        });

        button.trigger('click');
        expect(interaction.endpointAutoBridgeMode).toBe('off');
        expect(interaction.setEndpointAutoBridgeMode).toHaveBeenCalledWith('off', {
            persist: false,
            silentStatus: true
        });

        button.trigger('click');
        expect(interaction.endpointAutoBridgeMode).toBe('off');

        button.trigger('click');
        expect(interaction.endpointAutoBridgeMode).toBe('auto');
        expect(interaction.setEndpointAutoBridgeMode).toHaveBeenLastCalledWith('auto', {
            persist: false,
            silentStatus: true
        });
    });

    it('restores endpoint auto-bridge from interaction storage when classroom mode remains off', () => {
        setupFixture({ width: 1366, storedLevel: 'off' });
        const interaction = {
            endpointAutoBridgeMode: 'off',
            restoreEndpointAutoBridgeMode: vi.fn(() => {
                interaction.endpointAutoBridgeMode = 'on';
                return 'on';
            })
        };
        new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus: vi.fn(),
            interaction
        });

        expect(interaction.restoreEndpointAutoBridgeMode).toHaveBeenCalledWith({ silentStatus: true });
        expect(interaction.endpointAutoBridgeMode).toBe('on');
    });

    it('does not throw when button setAttribute and body classList.toggle are non-callable', () => {
        const { body, button } = setupFixture({ width: 1366, storedLevel: 'standard' });
        body.classList.toggle = {};
        button.setAttribute = {};

        expect(() => new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus: vi.fn()
        })).not.toThrow();
    });

    it('does not throw when updateStatus is non-callable while announce is true', () => {
        setupFixture({ width: 1366, storedLevel: 'off' });
        const controller = new ClassroomModeController({
            responsiveLayout: { isOverlayMode: () => false },
            updateStatus: {}
        });

        expect(() => controller.setPreferredLevel('standard', {
            persist: false,
            announce: true
        })).not.toThrow();
    });
});
