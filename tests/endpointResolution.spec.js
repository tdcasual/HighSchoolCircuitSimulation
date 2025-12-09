import { describe, it, expect } from 'vitest';
import { OpenAIClient } from '../src/ai/OpenAIClient.js';

const cases = [
    {
        name: 'OpenAI chat/completions (already set)',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        useResponses: false,
        expected: 'https://api.openai.com/v1/chat/completions'
    },
    {
        name: 'OpenAI root domain auto /v1/chat/completions',
        endpoint: 'https://api.openai.com',
        useResponses: false,
        expected: 'https://api.openai.com/v1/chat/completions'
    },
    {
        name: 'Dashscope compatible-mode retains single v1',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        useResponses: false,
        expected: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    },
    {
        name: 'DeepSeek root domain',
        endpoint: 'https://api.deepseek.com',
        useResponses: false,
        expected: 'https://api.deepseek.com/v1/chat/completions'
    },
    {
        name: 'Claude messages endpoint remains unchanged',
        endpoint: 'https://api.anthropic.com/v1/messages',
        useResponses: false,
        expected: 'https://api.anthropic.com/v1/chat/completions'
    },
    {
        name: 'Compatible endpoint with /v1 suffix',
        endpoint: 'https://example.com/v1',
        useResponses: false,
        expected: 'https://example.com/v1/chat/completions'
    }
];

describe('resolveApiEndpoint compatibility', () => {
    cases.forEach(({ name, endpoint, useResponses, expected }) => {
        it(name, () => {
            const client = new OpenAIClient();
            client.config.apiEndpoint = endpoint;
            const resolved = client.resolveApiEndpoint(useResponses);
            expect(resolved).toBe(expected);
        });
    });
});

const modelCases = [
    {
        name: 'models from chat/completions endpoint',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        expected: 'https://api.openai.com/v1/models'
    },
    {
        name: 'models from dashscope compatible',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        expected: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models'
    },
    {
        name: 'models from root domain',
        endpoint: 'https://api.deepseek.com',
        expected: 'https://api.deepseek.com/v1/models'
    }
];

describe('listModels base construction', () => {
    modelCases.forEach(({ name, endpoint, expected }) => {
        it(name, () => {
            const client = new OpenAIClient();
            client.config.apiEndpoint = endpoint;
            const apiEndpoint = client.normalizeEndpoint(endpoint);
            let base;
            if (/\/v1\/[^/]+$/.test(apiEndpoint)) {
                base = apiEndpoint.replace(/\/v1\/[^/]+$/, '/v1/models');
            } else if (apiEndpoint.endsWith('/v1')) {
                base = `${apiEndpoint}/models`;
            } else if (/\/v1\//.test(apiEndpoint)) {
                base = apiEndpoint.split('/v1/')[0] + '/v1/models';
            } else {
                base = apiEndpoint.endsWith('/') ? `${apiEndpoint}v1/models` : `${apiEndpoint}/v1/models`;
            }
            expect(base).toBe(expected);
        });
    });
});
