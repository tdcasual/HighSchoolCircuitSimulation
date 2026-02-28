import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ToolPlacementController from '../src/ui/interaction/ToolPlacementController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ToolPlacementController.setPendingToolType', () => {
    it('sets pending tool and marks selected item', () => {
        const previous = { classList: { remove: vi.fn() } };
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [previous])
        });

        const item = { classList: { add: vi.fn() } };
        const context = {
            pendingToolType: null,
            pendingToolItem: null,
            isWiring: false,
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn()
        };

        ToolPlacementController.setPendingToolType.call(context, 'Resistor', item);

        expect(context.pendingToolType).toBe('Resistor');
        expect(context.pendingToolItem).toBe(item);
        expect(previous.classList.remove).toHaveBeenCalledWith('tool-item-pending');
        expect(item.classList.add).toHaveBeenCalledWith('tool-item-pending');
        expect(context.updateStatus).toHaveBeenCalledWith(expect.stringContaining('已选择'));
    });

    it('toggles off same tool and cancels wiring for wire tool', () => {
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [])
        });

        const context = {
            pendingToolType: 'Wire',
            pendingToolItem: null,
            isWiring: true,
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn()
        };

        ToolPlacementController.setPendingToolType.call(context, 'Wire', null);

        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('已取消工具放置模式');
    });

    it('auto closes overlay drawers after selecting a pending tool on mobile layout', () => {
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [])
        });

        const closeDrawers = vi.fn();
        const context = {
            pendingToolType: null,
            pendingToolItem: null,
            isWiring: false,
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn(),
            app: {
                responsiveLayout: {
                    isOverlayMode: vi.fn(() => true),
                    toolboxOpen: true,
                    sidePanelOpen: false,
                    closeDrawers
                }
            }
        };

        ToolPlacementController.setPendingToolType.call(context, 'Resistor', null);

        expect(closeDrawers).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith(expect.stringContaining('已选择'));
    });
});

describe('ToolPlacementController.clearPendingToolType', () => {
    it('clears pending state and removes pending class on item', () => {
        const remove = vi.fn();
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [])
        });

        const context = {
            pendingToolType: 'Resistor',
            pendingToolItem: { classList: { remove } }
        };

        ToolPlacementController.clearPendingToolType.call(context);

        expect(context.pendingToolType).toBe(null);
        expect(context.pendingToolItem).toBe(null);
        expect(remove).toHaveBeenCalledWith('tool-item-pending');
    });
});

describe('ToolPlacementController.placePendingToolAt', () => {
    it('places component and clears pending tool', () => {
        const context = {
            pendingToolType: 'Resistor',
            screenToCanvas: vi.fn(() => ({ x: 10.2, y: 19.8 })),
            addWireAt: vi.fn(),
            addComponent: vi.fn(),
            clearPendingToolType: vi.fn()
        };

        const placed = ToolPlacementController.placePendingToolAt.call(context, 100, 120);

        expect(placed).toBe(true);
        expect(context.addComponent).toHaveBeenCalledWith('Resistor', 20, 20);
        expect(context.addWireAt).not.toHaveBeenCalled();
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });

    it('places wire when pending type is wire', () => {
        const context = {
            pendingToolType: 'Wire',
            screenToCanvas: vi.fn(() => ({ x: 18.6, y: 21.4 })),
            addWireAt: vi.fn(),
            addComponent: vi.fn(),
            clearPendingToolType: vi.fn()
        };

        const placed = ToolPlacementController.placePendingToolAt.call(context, 100, 120);

        expect(placed).toBe(true);
        expect(context.addWireAt).toHaveBeenCalledWith(20, 20);
        expect(context.addComponent).not.toHaveBeenCalled();
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });
});

describe('ToolPlacementController.setMobileInteractionMode', () => {
    it('enables sticky wire mode and arms pending wire tool', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            querySelectorAll: vi.fn(() => [])
        });

        const context = {
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            setPendingToolType: vi.fn(),
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn(),
            quickActionBar: { update: vi.fn() }
        };

        ToolPlacementController.setMobileInteractionMode.call(context, 'wire');

        expect(context.mobileInteractionMode).toBe('wire');
        expect(context.stickyWireTool).toBe(true);
        expect(context.setPendingToolType).toHaveBeenCalledWith('Wire', null, expect.objectContaining({
            allowToggleOff: false,
            silentStatus: true
        }));
    });

    it('switches back to select mode and clears pending wire state', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            querySelectorAll: vi.fn(() => [])
        });

        const context = {
            pendingToolType: 'Wire',
            isWiring: true,
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            setPendingToolType: vi.fn(),
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn(),
            quickActionBar: { update: vi.fn() }
        };

        ToolPlacementController.setMobileInteractionMode.call(context, 'select');

        expect(context.mobileInteractionMode).toBe('select');
        expect(context.stickyWireTool).toBe(false);
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledWith(expect.objectContaining({
            silent: true,
            preserveMobileMode: true
        }));
    });
});

describe('ToolPlacementController endpoint auto-bridge mode controls', () => {
    it('cycles endpoint auto-bridge mode and persists it', () => {
        const setItem = vi.fn();
        vi.stubGlobal('localStorage', {
            setItem,
            getItem: vi.fn(() => null)
        });

        const context = {
            endpointAutoBridgeMode: 'auto',
            updateStatus: vi.fn()
        };

        const first = ToolPlacementController.cycleEndpointAutoBridgeMode.call(context);
        const second = ToolPlacementController.cycleEndpointAutoBridgeMode.call(context);
        const third = ToolPlacementController.cycleEndpointAutoBridgeMode.call(context);

        expect(first).toBe('on');
        expect(second).toBe('off');
        expect(third).toBe('auto');
        expect(setItem).toHaveBeenNthCalledWith(1, 'interaction.endpoint_auto_bridge_mode', 'on');
        expect(setItem).toHaveBeenNthCalledWith(2, 'interaction.endpoint_auto_bridge_mode', 'off');
        expect(setItem).toHaveBeenNthCalledWith(3, 'interaction.endpoint_auto_bridge_mode', 'auto');
        expect(context.updateStatus).toHaveBeenCalledTimes(3);
    });

    it('restores endpoint auto-bridge mode from storage without writing back', () => {
        const getItem = vi.fn(() => 'on');
        const setItem = vi.fn();
        const modeButton = { textContent: '', dataset: {} };
        vi.stubGlobal('localStorage', { getItem, setItem });
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'btn-mobile-endpoint-bridge-mode' ? modeButton : null))
        });

        const context = {
            endpointAutoBridgeMode: 'auto',
            updateStatus: vi.fn()
        };

        const restored = ToolPlacementController.restoreEndpointAutoBridgeMode.call(context, { silentStatus: true });

        expect(restored).toBe('on');
        expect(context.endpointAutoBridgeMode).toBe('on');
        expect(modeButton.textContent).toBe('端点补线: 总是开启');
        expect(setItem).not.toHaveBeenCalled();
        expect(context.updateStatus).not.toHaveBeenCalled();
    });

    it('locks endpoint auto-bridge mode to off during classroom mode without overriding storage preference', () => {
        const setItem = vi.fn();
        vi.stubGlobal('localStorage', {
            setItem,
            getItem: vi.fn(() => null)
        });

        const context = {
            endpointAutoBridgeMode: 'off',
            updateStatus: vi.fn(),
            app: {
                classroomMode: {
                    activeLevel: 'standard'
                }
            }
        };

        const nextMode = ToolPlacementController.setEndpointAutoBridgeMode.call(context, 'on');

        expect(nextMode).toBe('off');
        expect(context.endpointAutoBridgeMode).toBe('off');
        expect(setItem).not.toHaveBeenCalled();
        expect(context.updateStatus).toHaveBeenCalledWith('课堂模式下端点补线已锁定关闭');
    });

    it('disables endpoint auto-bridge button while classroom mode is active', () => {
        const modeButton = { textContent: '', dataset: {}, disabled: false, title: '' };
        const modeNote = { textContent: '', hidden: true };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'btn-mobile-endpoint-bridge-mode') return modeButton;
                if (id === 'mobile-endpoint-bridge-note') return modeNote;
                return null;
            })
        });

        const context = {
            endpointAutoBridgeMode: 'off',
            app: {
                classroomMode: {
                    activeLevel: 'enhanced'
                }
            }
        };

        ToolPlacementController.syncEndpointAutoBridgeButton.call(context);

        expect(modeButton.textContent).toBe('端点补线: 课堂锁定');
        expect(modeButton.disabled).toBe(true);
        expect(modeButton.title).toContain('课堂模式');
        expect(modeNote.hidden).toBe(false);
        expect(modeNote.textContent).toBe('课堂模式已锁定端点补线为关闭');
    });

    it('hides classroom lock note when classroom mode is inactive', () => {
        const modeButton = { textContent: '', dataset: {}, disabled: true, title: '' };
        const modeNote = { textContent: '', hidden: false };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'btn-mobile-endpoint-bridge-mode') return modeButton;
                if (id === 'mobile-endpoint-bridge-note') return modeNote;
                return null;
            })
        });

        const context = {
            endpointAutoBridgeMode: 'auto',
            app: {
                classroomMode: {
                    activeLevel: 'off'
                }
            }
        };

        ToolPlacementController.syncEndpointAutoBridgeButton.call(context);

        expect(modeButton.textContent).toBe('端点补线: 手机自动');
        expect(modeButton.disabled).toBe(false);
        expect(modeNote.hidden).toBe(true);
    });
});
