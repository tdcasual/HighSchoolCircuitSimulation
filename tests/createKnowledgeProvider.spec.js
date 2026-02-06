import { describe, it, expect } from 'vitest';
import { createKnowledgeProvider } from '../src/ai/resources/createKnowledgeProvider.js';
import {
    LocalKnowledgeResourceProvider,
    McpKnowledgeResourceProvider
} from '../src/ai/resources/KnowledgeResourceProvider.js';

describe('createKnowledgeProvider', () => {
    it('creates local provider by default', () => {
        const provider = createKnowledgeProvider({});
        expect(provider).toBeInstanceOf(LocalKnowledgeResourceProvider);
    });

    it('creates MCP provider when knowledgeSource is mcp', () => {
        const provider = createKnowledgeProvider({
            knowledgeSource: 'mcp',
            knowledgeMcpEndpoint: 'https://mcp.example.com',
            knowledgeMcpServer: 'test-server'
        });
        expect(provider).toBeInstanceOf(McpKnowledgeResourceProvider);
        expect(provider.endpoint).toBe('https://mcp.example.com');
        expect(provider.server).toBe('test-server');
    });

    it('forwards MCP mode/method/resource options', () => {
        const provider = createKnowledgeProvider({
            knowledgeSource: 'MCP',
            knowledgeMcpEndpoint: 'https://mcp.example.com',
            knowledgeMcpServer: 'school-circuit',
            knowledgeMcpMode: 'resource',
            knowledgeMcpMethod: 'knowledge.search.v2',
            knowledgeMcpResource: 'knowledge://hs-physics/circuit'
        });

        expect(provider).toBeInstanceOf(McpKnowledgeResourceProvider);
        expect(provider.mode).toBe('resource');
        expect(provider.methodName).toBe('knowledge.search.v2');
        expect(provider.resourceName).toBe('knowledge://hs-physics/circuit');
    });
});
