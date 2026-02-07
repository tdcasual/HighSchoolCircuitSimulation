import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ContextMenuController from '../src/ui/interaction/ContextMenuController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ContextMenuController.hideContextMenu', () => {
    it('removes existing context menu and detaches click handler', () => {
        const remove = vi.fn();
        const menu = { remove };
        const removeEventListener = vi.fn();
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'context-menu' ? menu : null)),
            removeEventListener
        });
        const context = {
            hideContextMenuHandler: vi.fn()
        };

        ContextMenuController.hideContextMenu.call(context);

        expect(remove).toHaveBeenCalledTimes(1);
        expect(removeEventListener).toHaveBeenCalledWith('click', context.hideContextMenuHandler);
    });

    it('is no-op when context menu is absent', () => {
        const removeEventListener = vi.fn();
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            removeEventListener
        });
        const context = {
            hideContextMenuHandler: vi.fn()
        };

        ContextMenuController.hideContextMenu.call(context);

        expect(removeEventListener).not.toHaveBeenCalled();
    });
});
