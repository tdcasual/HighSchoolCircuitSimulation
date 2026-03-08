import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OpenAIClientV2 } from '../src/ai/OpenAIClientV2.js';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';
import { AIPanel } from '../src/ui/AIPanel.js';

describe('OpenAIClientV2 storage safety', () => {
    const realLocal = global.localStorage;
    const realSession = global.sessionStorage;

    beforeAll(() => {
        let store = {};
        global.localStorage = {
            getItem: (k) => store[k] ?? null,
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        };
        global.sessionStorage = {
            getItem: (k) => store[k] ?? null,
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        };
    });

    afterAll(() => {
        global.localStorage = realLocal;
        global.sessionStorage = realSession;
    });

    it('loads defaults without throwing in mocked storage', () => {
        const client = new OpenAIClientV2();
        expect(client.config.apiEndpoint).toContain('openai.com');
        expect(client.config.apiEndpoint).toContain('/v1/responses');
    });

    it('saves and clears api key safely', () => {
        const client = new OpenAIClientV2();
        client.saveConfig({ apiKey: 'abc123' });
        expect(client.config.apiKey).toBe('abc123');
        client.clearApiKey();
        expect(client.config.apiKey).toBe('');
    });

    it('exposes shared runtime snapshot for downstream AI-facing consumers', () => {
        const saveData = { components: [{ id: 'R1' }], wires: [] };
        const app = {
            circuit: {
                getRuntimeReadSnapshot: vi.fn(() => ({
                    topologyVersion: 4,
                    simulationVersion: 9,
                    components: new Map([['R1', { id: 'R1', label: 'R1' }]])
                }))
            },
            buildSaveData: vi.fn(() => saveData)
        };

        const snapshot = AppRuntimeV2.prototype.getRuntimeReadSnapshot.call(app);

        expect(snapshot.saveData).toEqual(saveData);
        expect(snapshot.topologyVersion).toBe(4);
        expect(snapshot.simulationVersion).toBe(9);
        expect(snapshot.components).toBeInstanceOf(Map);
    });

    it('AIPanel save prefers shared runtime snapshot before buildSaveData fallback', () => {
        const saveCircuitToStorage = vi.fn(() => true);
        const panel = {
            app: {
                getRuntimeReadSnapshot: vi.fn(() => ({
                    saveData: { components: [{ id: 'R1' }], wires: [] }
                })),
                buildSaveData: vi.fn(() => ({ components: [{ id: 'legacy' }], wires: [] })),
                saveCircuitToStorage,
                logger: {
                    error: vi.fn()
                }
            },
            logPanelEvent: vi.fn()
        };

        const saved = AIPanel.prototype.saveCircuitToLocalStorage.call(panel, {
            components: [{ id: 'fallback' }],
            wires: []
        });

        expect(saved).toBe(true);
        expect(saveCircuitToStorage).toHaveBeenCalledWith({
            components: [{ id: 'R1' }],
            wires: []
        });
    });
});
