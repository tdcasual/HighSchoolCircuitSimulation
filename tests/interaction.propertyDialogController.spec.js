import { afterEach, describe, expect, it, vi } from 'vitest';
import * as PropertyDialogController from '../src/ui/interaction/PropertyDialogController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('PropertyDialogController.showPropertyDialog', () => {
    it('returns early when component is missing', () => {
        const ctx = {
            circuit: {
                getComponent: vi.fn(() => null)
            }
        };

        PropertyDialogController.showPropertyDialog.call(ctx, 'missing');

        expect(ctx.circuit.getComponent).toHaveBeenCalledWith('missing');
        expect(ctx.editingComponent).toBeUndefined();
    });

    it('shows dialog and writes title for known component', () => {
        const comp = { id: 'G1', type: 'Ground' };
        const titleNode = { textContent: '' };
        const contentNode = { innerHTML: '', appendChild: vi.fn() };
        const dialogNode = {
            classList: { remove: vi.fn() }
        };
        const createElement = vi.fn(() => ({
            className: '',
            id: '',
            textContent: '',
            style: {},
            setAttribute: vi.fn(),
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                contains: vi.fn(() => false),
                toggle: vi.fn()
            }
        }));

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'dialog-overlay') return dialogNode;
                if (id === 'dialog-title') return titleNode;
                if (id === 'dialog-content') return contentNode;
                return null;
            }),
            createElement
        });

        const ctx = {
            circuit: {
                getComponent: vi.fn(() => comp)
            }
        };

        PropertyDialogController.showPropertyDialog.call(ctx, 'G1');

        expect(ctx.editingComponent).toBe(comp);
        expect(titleNode.textContent).toContain('接地');
        expect(dialogNode.classList.remove).toHaveBeenCalledWith('hidden');
    });
});
