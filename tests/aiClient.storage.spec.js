import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OpenAIClientV2 } from '../src/ai/OpenAIClientV2.js';

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
});
