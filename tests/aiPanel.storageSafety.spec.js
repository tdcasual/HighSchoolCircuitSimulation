import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('AIPanel storage ownership safety', () => {
    it('saveCircuitToLocalStorage delegates to app storage owner when buildSaveData is non-callable', () => {
        const saveCircuitToStorage = vi.fn(() => true);
        const panel = {
            app: {
                buildSaveData: {},
                saveCircuitToStorage,
                logger: {
                    error: vi.fn()
                }
            },
            logPanelEvent: vi.fn()
        };
        const payload = { components: [{ id: 'R1' }], wires: [] };

        let saved = null;
        expect(() => {
            saved = AIPanel.prototype.saveCircuitToLocalStorage.call(panel, payload);
        }).not.toThrow();
        expect(saved).toBe(true);
        expect(saveCircuitToStorage).toHaveBeenCalledWith(payload);
    });

    it('loadCircuitFromLocalStorage delegates to app runtime storage loader', () => {
        const loadCircuitFromStorage = vi.fn(() => true);
        const panel = {
            app: {
                loadCircuitFromStorage,
                logger: {
                    error: vi.fn()
                }
            },
            logPanelEvent: vi.fn()
        };

        let loaded = null;
        expect(() => {
            loaded = AIPanel.prototype.loadCircuitFromLocalStorage.call(panel);
        }).not.toThrow();
        expect(loaded).toBe(true);
        expect(loadCircuitFromStorage).toHaveBeenCalledWith({
            statusText: '已从缓存恢复电路'
        });
    });
});
