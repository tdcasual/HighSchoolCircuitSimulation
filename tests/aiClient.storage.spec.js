import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OpenAIClient } from '../src/ai/OpenAIClient.js';

describe('OpenAIClient storage safety', () => {
    const realLocal = global.localStorage;
    const realSession = global.sessionStorage;

    beforeAll(() => {
        // simple mock
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
        const client = new OpenAIClient();
        expect(client.config.apiEndpoint).toContain('openai.com');
    });

    it('saves and clears api key safely', () => {
        const client = new OpenAIClient();
        client.saveConfig({ apiKey: 'abc123' });
        expect(client.config.apiKey).toBe('abc123');
        client.clearApiKey();
        expect(client.config.apiKey).toBe('');
    });
});
