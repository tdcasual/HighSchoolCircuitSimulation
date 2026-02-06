import { describe, it, expect, vi } from 'vitest';
import { McpKnowledgeResourceProvider } from '../src/ai/resources/KnowledgeResourceProvider.js';

describe('McpKnowledgeResourceProvider', () => {
    it('returns MCP knowledge results and metadata on success', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                result: {
                    version: 'MCP-RULES-1.2',
                    items: [
                        { id: 'k1', title: '并联规则', content: '并联支路电压相等', keywords: ['并联'] }
                    ]
                }
            })
        });

        const provider = new McpKnowledgeResourceProvider({
            endpoint: 'https://mcp.example.com/knowledge/search',
            server: 'circuit-knowledge',
            fetchImpl
        });

        const items = await provider.search({
            question: '并联电压有什么关系？',
            componentTypes: ['Voltmeter'],
            limit: 3
        });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.method).toBe('knowledge.search');
        expect(body.resource).toBeUndefined();
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('并联规则');
        expect(provider.getMetadata().source).toBe('mcp');
        expect(provider.getMetadata().version).toBe('MCP-RULES-1.2');
    });

    it('supports resource mode and parses contents.text JSON payload', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                result: {
                    version: 'MCP-RULES-2.0',
                    contents: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                items: [
                                    { id: 'k2', title: '串联规则', content: '串联电路电流相等' }
                                ]
                            })
                        }
                    ]
                }
            })
        });

        const provider = new McpKnowledgeResourceProvider({
            endpoint: 'https://mcp.example.com/knowledge/search',
            server: 'circuit-knowledge',
            mode: 'resource',
            resourceName: 'knowledge://circuit/high-school',
            fetchImpl
        });

        const items = await provider.search({
            question: '串联电流有什么特点？',
            componentTypes: ['Resistor'],
            limit: 3
        });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.resource).toBe('knowledge://circuit/high-school');
        expect(body.method).toBeUndefined();
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('k2');
        expect(provider.getMetadata().source).toBe('mcp');
        expect(provider.getMetadata().version).toBe('MCP-RULES-2.0');
    });

    it('falls back to local provider when MCP is unavailable', async () => {
        const fallbackProvider = {
            search: vi.fn().mockResolvedValue([{ id: 'local1', title: '本地规则', content: '本地内容' }]),
            getMetadata: vi.fn().mockReturnValue({ source: 'local', version: 'LOCAL-V1', detail: '内置' })
        };
        const provider = new McpKnowledgeResourceProvider({
            endpoint: '',
            fallbackProvider
        });

        const items = await provider.search({
            question: '任意问题',
            componentTypes: ['Resistor'],
            limit: 2
        });

        expect(fallbackProvider.search).toHaveBeenCalledTimes(1);
        expect(items).toHaveLength(1);
        expect(provider.getMetadata().source).toBe('mcp-fallback-local');
        expect(provider.getMetadata().version).toBe('LOCAL-V1');
    });
});
