import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIClient } from '../src/ai/OpenAIClient.js';

const mockFetch = (response, ok = true, status = 200) => {
    global.fetch = vi.fn().mockResolvedValue({
        ok,
        status,
        json: vi.fn().mockResolvedValue(response)
    });
};

describe('OpenAIClient listModels', () => {
    let client;
    beforeEach(() => {
        client = new OpenAIClient();
        client.config.apiKey = 'test-key';
        client.config.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns model ids on success', async () => {
        mockFetch({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] });
        const list = await client.listModels();
        expect(list).toEqual(['gpt-4o', 'gpt-4o-mini']);
    });

    it('throws on auth failure', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: vi.fn().mockResolvedValue({ error: { message: 'unauthorized' } })
        });
        await expect(client.listModels()).rejects.toThrow(/无效或无访问权限/);
    });

    it('throws on timeout', async () => {
        client.config.requestTimeout = 10;
        global.fetch = vi.fn().mockImplementation(() => new Promise((_, reject) => {
            setTimeout(() => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), 20);
        }));
        await expect(client.listModels()).rejects.toThrow(/超时/);
    });
});

describe('OpenAIClient callAPI robustness', () => {
    let client;

    beforeEach(() => {
        client = new OpenAIClient();
        client.config.apiKey = 'test-key';
        client.config.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
        client.config.textModel = 'gpt-4o-mini';
        client.config.requestTimeout = 30;
        client.config.retryAttempts = 1;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns plain text when response body is not JSON', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('plain text answer')
        });

        const answer = await client.callAPI([{ role: 'user', content: 'hi' }], client.config.textModel, 10);
        expect(answer).toBe('plain text answer');
    });

    it('throws when response body reading times out', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockImplementation(() => new Promise(() => {}))
        });

        await expect(
            client.callAPI([{ role: 'user', content: 'hi' }], client.config.textModel, 10)
        ).rejects.toThrow(/响应读取超时/);
    });

    it('sets stream false in request body', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(JSON.stringify({
                choices: [{ message: { content: 'ok' } }]
            }))
        });

        await client.callAPI([{ role: 'user', content: 'hi' }], client.config.textModel, 10);
        const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(requestBody.stream).toBe(false);
    });
});

describe('OpenAIClient source-specific request strategy', () => {
    let client;

    beforeEach(() => {
        client = new OpenAIClient();
        client.config.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    });

    it('keeps default temperature for regular text source', () => {
        const requestBody = client.buildRequestBody(
            [{ role: 'user', content: 'chat' }],
            'gpt-4o-mini',
            800,
            false,
            { source: 'openai_client.explain_circuit' }
        );

        expect(requestBody.temperature).toBe(0.7);
    });

    it('omits temperature for gpt-5 regardless of source', () => {
        const requestBody = client.buildRequestBody(
            [{ role: 'user', content: 'chat' }],
            'gpt-5-mini',
            800,
            true,
            { source: 'openai_client.explain_circuit' }
        );

        expect(Object.prototype.hasOwnProperty.call(requestBody, 'temperature')).toBe(false);
    });
});

describe('OpenAIClient proxy request mode', () => {
    let client;

    beforeEach(() => {
        client = new OpenAIClient();
        client.config.requestMode = 'proxy';
        client.config.proxyEndpoint = 'https://proxy.example.com/openai';
        client.config.apiKey = '';
        client.config.textModel = 'gpt-4o-mini';
        client.config.retryAttempts = 1;
        client.config.requestTimeout = 50;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('callAPI does not require apiKey in proxy mode and skips Authorization header', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(JSON.stringify({
                choices: [{ message: { content: 'proxy answer' } }]
            }))
        });

        const answer = await client.callAPI([{ role: 'user', content: 'hello' }], client.config.textModel, 32);

        expect(answer).toBe('proxy answer');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toBe('https://proxy.example.com/openai');
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    it('listModels uses proxy endpoint in proxy mode', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(JSON.stringify({
                data: [{ id: 'proxy-model-1' }]
            }))
        });

        const models = await client.listModels();

        expect(models).toEqual(['proxy-model-1']);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toBe('https://proxy.example.com/openai');
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
});
