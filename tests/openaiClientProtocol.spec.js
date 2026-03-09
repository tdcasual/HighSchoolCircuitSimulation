import { describe, expect, it } from 'vitest';

const apiCases = [
    ['https://api.openai.com', 'https://api.openai.com/v1/responses'],
    ['https://api.openai.com/v1', 'https://api.openai.com/v1/responses'],
    ['https://api.openai.com/v1/chat/completions', 'https://api.openai.com/v1/responses'],
    ['api.deepseek.com', 'https://api.deepseek.com/v1/responses']
];

describe('OpenAI client protocol seam', () => {
    it('normalizes API endpoints to the responses API', async () => {
        const protocol = await import('../src/ai/OpenAIClientProtocol.js');

        apiCases.forEach(([input, expected]) => {
            expect(protocol.normalizeApiEndpoint(input)).toBe(expected);
        });
    });

    it('derives the models endpoint from a responses endpoint', async () => {
        const protocol = await import('../src/ai/OpenAIClientProtocol.js');

        expect(protocol.resolveModelsEndpoint('https://api.openai.com/v1/responses')).toBe(
            'https://api.openai.com/v1/models'
        );
        expect(protocol.resolveModelsEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1/responses')).toBe(
            'https://dashscope.aliyuncs.com/compatible-mode/v1/models'
        );
    });

    it('builds responses request bodies and extracts text output', async () => {
        const protocol = await import('../src/ai/OpenAIClientProtocol.js');

        const body = protocol.buildResponsesRequestBody(
            [{ role: 'user', content: 'hello' }],
            'gpt-4.1-mini',
            128
        );

        expect(body).toMatchObject({
            model: 'gpt-4.1-mini',
            max_output_tokens: 128,
            stream: false
        });
        expect(body).toHaveProperty('input');
        expect(body).not.toHaveProperty('messages');

        expect(protocol.extractResponseText({
            output: [{ content: [{ type: 'output_text', text: 'ok' }] }]
        })).toBe('ok');
    });
});
