import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OpenAIClientV2 } from '../src/ai/OpenAIClientV2.js';

describe('OpenAIClientV2 responses-only contract', () => {
    it('sends requests only to /v1/responses with input payload', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                output: [{ content: [{ type: 'output_text', text: 'ok' }] }]
            }),
            text: async () => ''
        }));

        const client = new OpenAIClientV2({
            apiEndpoint: 'https://api.openai.com/v1/responses',
            apiKey: 'test-key',
            fetchImpl
        });

        const answer = await client.callAPI(
            [{ role: 'user', content: 'hello' }],
            'gpt-4.1-mini',
            64
        );

        expect(answer).toBe('ok');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, options] = fetchImpl.mock.calls[0];
        expect(String(url)).toContain('/v1/responses');
        const body = String(options.body || '');
        expect(body).toContain('"input"');
        expect(body).toContain('"max_output_tokens"');
        expect(body).not.toContain('"messages"');
    });

    it('contains no fallback logic to chat/completions in v2 client', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ai/OpenAIClientV2.js'), 'utf8');
        expect(source).toContain('/v1/responses');
        expect(source).not.toContain('chat/completions');
        expect(source).not.toContain('call_api_fallback_to_completions');
    });

    it('wires CircuitAIAgent to v2 client path', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ai/agent/CircuitAIAgent.js'), 'utf8');
        expect(source).toContain('OpenAIClientV2');
        expect(source).not.toContain("from '../OpenAIClient.js'");
    });
});
