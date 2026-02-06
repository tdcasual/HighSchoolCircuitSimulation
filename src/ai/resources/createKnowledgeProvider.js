/**
 * createKnowledgeProvider.js
 * Factory helper to instantiate knowledge provider from persisted AI config.
 */

import {
    LocalKnowledgeResourceProvider,
    McpKnowledgeResourceProvider
} from './KnowledgeResourceProvider.js';

function normalizeSource(value) {
    const source = String(value || '').trim().toLowerCase();
    return source === 'mcp' ? 'mcp' : 'local';
}

export function createKnowledgeProvider(config = {}) {
    const source = normalizeSource(config.knowledgeSource);
    if (source === 'mcp') {
        return new McpKnowledgeResourceProvider({
            endpoint: config.knowledgeMcpEndpoint || '',
            server: config.knowledgeMcpServer || 'circuit-knowledge',
            mode: config.knowledgeMcpMode || 'method',
            methodName: config.knowledgeMcpMethod || 'knowledge.search',
            resourceName: config.knowledgeMcpResource || 'knowledge://circuit/high-school'
        });
    }
    return new LocalKnowledgeResourceProvider();
}
