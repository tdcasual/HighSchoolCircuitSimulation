import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('AIPanel local storage safety', () => {
    it('saveCircuitToLocalStorage falls back when buildSaveData is non-callable', () => {
        const setItem = vi.fn();
        vi.stubGlobal('localStorage', {
            setItem
        });

        const panel = {
            app: {
                buildSaveData: {},
                logger: {
                    error: vi.fn()
                }
            },
            logPanelEvent: vi.fn()
        };
        const payload = { components: [{ id: 'R1' }], wires: [] };

        expect(() => AIPanel.prototype.saveCircuitToLocalStorage.call(panel, payload)).not.toThrow();
        expect(setItem).toHaveBeenCalledWith('saved_circuit', JSON.stringify(payload));
    });

    it('loadCircuitFromLocalStorage ignores non-callable exerciseBoard.fromJSON', () => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => JSON.stringify({
                components: [],
                wires: [],
                meta: {
                    exerciseBoard: { enabled: true }
                }
            }))
        });

        const panel = {
            circuit: {
                fromJSON: vi.fn()
            },
            app: {
                renderer: {
                    render: vi.fn()
                },
                exerciseBoard: {
                    fromJSON: {}
                },
                updateStatus: vi.fn(),
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
        expect(panel.circuit.fromJSON).toHaveBeenCalledTimes(1);
        expect(panel.app.renderer.render).toHaveBeenCalledTimes(1);
        expect(panel.app.updateStatus).toHaveBeenCalledWith('已从缓存恢复电路');
    });
});
