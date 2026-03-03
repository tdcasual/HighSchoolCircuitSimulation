import { describe, it, expect } from 'vitest';
import { OpenAIClientV2 } from '../src/ai/OpenAIClientV2.js';

const cases = [
    {
        name: 'OpenAI responses (already set)',
        endpoint: 'https://api.openai.com/v1/responses',
        expected: 'https://api.openai.com/v1/responses'
    },
    {
        name: 'OpenAI root domain auto /v1/responses',
        endpoint: 'https://api.openai.com',
        expected: 'https://api.openai.com/v1/responses'
    },
    {
        name: 'Dashscope compatible-mode retains single v1 responses',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        expected: 'https://dashscope.aliyuncs.com/compatible-mode/v1/responses'
    },
    {
        name: 'DeepSeek root domain',
        endpoint: 'https://api.deepseek.com',
        expected: 'https://api.deepseek.com/v1/responses'
    },
    {
        name: 'messages endpoint normalizes to responses',
        endpoint: 'https://api.anthropic.com/v1/messages',
        expected: 'https://api.anthropic.com/v1/responses'
    },
    {
        name: 'Compatible endpoint with /v1 suffix',
        endpoint: 'https://example.com/v1',
        expected: 'https://example.com/v1/responses'
    }
];

describe('resolveApiEndpoint responses-only', () => {
    cases.forEach(({ name, endpoint, expected }) => {
        it(name, () => {
            const client = new OpenAIClientV2();
            client.config.apiEndpoint = endpoint;
            const resolved = client.resolveApiEndpoint();
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
            const client = new OpenAIClientV2();
            client.config.apiEndpoint = endpoint;
            expect(client.resolveModelsEndpoint()).toBe(expected);
        });
    });
});
