import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIClientV2 } from '../src/ai/OpenAIClientV2.js';

const mockFetch = (response, ok = true, status = 200) => {
    global.fetch = vi.fn().mockResolvedValue({
        ok,
        status,
        json: vi.fn().mockResolvedValue(response)
    });
};

describe('OpenAIClientV2 listModels', () => {
    let client;
    beforeEach(() => {
        client = new OpenAIClientV2({
            fetchImpl: (...args) => global.fetch(...args)
        });
        client.config.apiKey = 'test-key';
        client.config.apiEndpoint = 'https://api.openai.com/v1/responses';
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

describe('OpenAIClientV2 callAPI robustness', () => {
    let client;

    beforeEach(() => {
        client = new OpenAIClientV2({
            fetchImpl: (...args) => global.fetch(...args)
        });
        client.config.apiKey = 'test-key';
        client.config.apiEndpoint = 'https://api.openai.com/v1/responses';
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
            json: vi.fn().mockImplementation(() => {
                throw new Error('invalid json');
            }),
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
            json: vi.fn().mockResolvedValue({
                output: [{ content: [{ text: 'ok' }] }]
            }),
            text: vi.fn().mockResolvedValue(JSON.stringify({
                output: [{ content: [{ text: 'ok' }] }]
            }))
        });

        await client.callAPI([{ role: 'user', content: 'hi' }], client.config.textModel, 10);
        const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(requestBody.stream).toBe(false);
        expect(requestBody).toHaveProperty('input');
        expect(requestBody).not.toHaveProperty('messages');
    });
});

describe('OpenAIClientV2 request strategy', () => {
    let client;

    beforeEach(() => {
        client = new OpenAIClientV2();
        client.config.apiEndpoint = 'https://api.openai.com/v1/responses';
    });

    it('always uses responses payload with max_output_tokens', () => {
        const requestBody = client.buildRequestBody(
            [{ role: 'user', content: 'chat' }],
            'gpt-4o-mini',
            800
        );

        expect(requestBody).toHaveProperty('input');
        expect(requestBody).toHaveProperty('max_output_tokens', 800);
    });
});

describe('OpenAIClientV2 proxy request mode', () => {
    let client;

    beforeEach(() => {
        client = new OpenAIClientV2({
            fetchImpl: (...args) => global.fetch(...args)
        });
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
            json: vi.fn().mockResolvedValue({
                output: [{ content: [{ text: 'proxy answer' }] }]
            }),
            text: vi.fn().mockResolvedValue(JSON.stringify({
                output: [{ content: [{ text: 'proxy answer' }] }]
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
