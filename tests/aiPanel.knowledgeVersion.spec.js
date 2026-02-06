import { describe, it, expect, vi, afterEach } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

describe('AIPanel knowledge version display', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('formats version label with source info', () => {
        const ctx = {};
        expect(
            AIPanel.prototype.formatKnowledgeVersionLabel.call(ctx, { source: 'local', version: 'LOCAL-V1' })
        ).toBe('规则库版本: LOCAL-V1（本地）');
        expect(
            AIPanel.prototype.formatKnowledgeVersionLabel.call(ctx, { source: 'mcp', version: 'MCP-V2' })
        ).toBe('规则库版本: MCP-V2（MCP）');
    });

    it('updates badge and hint text from agent metadata', () => {
        const badge = { textContent: '', title: '' };
        const hint = { textContent: '' };
        vi.stubGlobal('document', {
            getElementById: (id) => {
                if (id === 'knowledge-version-badge') return badge;
                if (id === 'knowledge-source-version') return hint;
                return null;
            }
        });

        const ctx = {
            aiAgent: {
                getKnowledgeMetadata: () => ({
                    source: 'mcp-fallback-local',
                    version: 'LOCAL-V1',
                    detail: 'MCP 未配置'
                })
            },
            formatKnowledgeVersionLabel: AIPanel.prototype.formatKnowledgeVersionLabel
        };

        AIPanel.prototype.updateKnowledgeVersionDisplay.call(ctx);

        expect(badge.textContent).toContain('LOCAL-V1');
        expect(badge.title).toContain('MCP 未配置');
        expect(hint.textContent).toContain('规则库版本');
    });

    it('switches MCP setting rows by source and mode', () => {
        const modeRow = { style: { display: 'none' } };
        const endpointRow = { style: { display: 'none' } };
        const methodRow = { style: { display: 'none' } };
        const resourceRow = { style: { display: 'none' } };
        const modeSelect = { value: 'method' };
        const elements = {
            'knowledge-mcp-mode-row': modeRow,
            'knowledge-mcp-endpoint-row': endpointRow,
            'knowledge-mcp-method-row': methodRow,
            'knowledge-mcp-resource-row': resourceRow,
            'knowledge-mcp-mode': modeSelect
        };
        vi.stubGlobal('document', {
            getElementById: (id) => elements[id] || null
        });

        const ctx = {};
        AIPanel.prototype.syncKnowledgeSettingsVisibility.call(ctx, 'local', 'method');
        expect(modeRow.style.display).toBe('none');
        expect(endpointRow.style.display).toBe('none');
        expect(methodRow.style.display).toBe('none');
        expect(resourceRow.style.display).toBe('none');

        AIPanel.prototype.syncKnowledgeSettingsVisibility.call(ctx, 'mcp', 'method');
        expect(modeSelect.value).toBe('method');
        expect(modeRow.style.display).toBe('');
        expect(endpointRow.style.display).toBe('');
        expect(methodRow.style.display).toBe('');
        expect(resourceRow.style.display).toBe('none');

        AIPanel.prototype.syncKnowledgeSettingsVisibility.call(ctx, 'mcp', 'resource');
        expect(modeSelect.value).toBe('resource');
        expect(methodRow.style.display).toBe('none');
        expect(resourceRow.style.display).toBe('');

        AIPanel.prototype.syncKnowledgeSettingsVisibility.call(ctx, 'mcp', 'unknown');
        expect(modeSelect.value).toBe('method');
        expect(methodRow.style.display).toBe('');
        expect(resourceRow.style.display).toBe('none');
    });
});
