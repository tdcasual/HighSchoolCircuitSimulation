import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';
import { SettingsController } from '../src/ui/ai/SettingsController.js';

function createElementMock(initial = {}) {
    return {
        value: '',
        textContent: '',
        style: {},
        classList: {
            remove: vi.fn(),
            add: vi.fn()
        },
        ...initial
    };
}

function stubDocument(elementsById) {
    vi.stubGlobal('document', {
        getElementById: vi.fn((id) => elementsById[id] || null),
        createElement: vi.fn(() => createElementMock()),
        body: { appendChild: vi.fn() }
    });
}

describe('SettingsController', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new SettingsController(deps);
        expect(controller.deps).toBe(deps);
    });

    it('delegates saveSettings to SettingsController', () => {
        const panel = {
            settingsController: {
                saveSettings: vi.fn()
            }
        };

        AIPanel.prototype.saveSettings.call(panel);

        expect(panel.settingsController.saveSettings).toHaveBeenCalledTimes(1);
    });

    it('openSettings fills request mode and proxy endpoint fields', () => {
        const elements = {
            'api-endpoint': createElementMock(),
            'api-key': createElementMock(),
            'text-model': createElementMock(),
            'knowledge-source': createElementMock(),
            'knowledge-mcp-endpoint': createElementMock(),
            'knowledge-mcp-server': createElementMock(),
            'knowledge-mcp-mode': createElementMock(),
            'knowledge-mcp-method': createElementMock(),
            'knowledge-mcp-resource': createElementMock(),
            'text-model-select': createElementMock({ options: [] }),
            'ai-settings-dialog': createElementMock(),
            'request-mode': createElementMock(),
            'proxy-endpoint': createElementMock()
        };
        stubDocument(elements);

        const panel = {
            aiClient: {
                config: {
                    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
                    apiKey: '',
                    textModel: 'gpt-4o-mini',
                    knowledgeSource: 'local',
                    knowledgeMcpEndpoint: '',
                    knowledgeMcpServer: 'circuit-knowledge',
                    knowledgeMcpMode: 'method',
                    knowledgeMcpMethod: 'knowledge.search',
                    knowledgeMcpResource: 'knowledge://circuit/high-school',
                    requestMode: 'proxy',
                    proxyEndpoint: 'https://proxy.example.com/openai'
                }
            },
            syncKnowledgeSettingsVisibility: vi.fn(),
            syncSelectToValue: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            updateLogSummaryDisplay: vi.fn()
        };

        const controller = new SettingsController({ panel });
        controller.openSettings();

        expect(elements['request-mode'].value).toBe('proxy');
        expect(elements['proxy-endpoint'].value).toBe('https://proxy.example.com/openai');
    });

    it('saveSettings persists request mode and proxy endpoint', () => {
        const elements = {
            'api-endpoint': createElementMock({ value: 'https://api.openai.com/v1/chat/completions' }),
            'api-key': createElementMock({ value: '' }),
            'text-model': createElementMock({ value: 'gpt-4o-mini' }),
            'knowledge-source': createElementMock({ value: 'local' }),
            'knowledge-mcp-endpoint': createElementMock({ value: '' }),
            'knowledge-mcp-server': createElementMock({ value: 'circuit-knowledge' }),
            'knowledge-mcp-mode': createElementMock({ value: 'method' }),
            'knowledge-mcp-method': createElementMock({ value: 'knowledge.search' }),
            'knowledge-mcp-resource': createElementMock({ value: 'knowledge://circuit/high-school' }),
            'request-mode': createElementMock({ value: 'proxy' }),
            'proxy-endpoint': createElementMock({ value: 'https://proxy.example.com/openai' })
        };
        stubDocument(elements);

        const panel = {
            aiClient: {
                saveConfig: vi.fn()
            },
            refreshKnowledgeProvider: vi.fn(),
            app: {
                updateStatus: vi.fn()
            },
            logPanelEvent: vi.fn(),
            updateLogSummaryDisplay: vi.fn()
        };
        const controller = new SettingsController({ panel });

        controller.saveSettings();

        expect(panel.aiClient.saveConfig).toHaveBeenCalledTimes(1);
        expect(panel.aiClient.saveConfig.mock.calls[0][0]).toMatchObject({
            requestMode: 'proxy',
            proxyEndpoint: 'https://proxy.example.com/openai'
        });
    });

    it('initializeSettingsDialog does not throw when settings dialog nodes are missing', () => {
        stubDocument({});
        const panel = {
            bindModelSelector: vi.fn(),
            syncKnowledgeSettingsVisibility: vi.fn(),
            saveSettings: vi.fn(),
            aiClient: {
                testConnection: vi.fn(async () => ({ success: true, message: 'ok' })),
                clearApiKey: vi.fn(),
                listModels: vi.fn(async () => [])
            },
            app: { updateStatus: vi.fn() },
            populateModelLists: vi.fn()
        };

        const controller = new SettingsController({ panel });
        expect(() => controller.initializeSettingsDialog()).not.toThrow();
    });

    it('openSettings does not throw when core form fields are missing', () => {
        stubDocument({});
        const panel = {
            aiClient: {
                config: {
                    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
                    apiKey: '',
                    textModel: 'gpt-4o-mini',
                    knowledgeSource: 'local',
                    knowledgeMcpMode: 'method',
                    requestMode: 'direct'
                }
            },
            syncKnowledgeSettingsVisibility: vi.fn(),
            syncSelectToValue: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            updateLogSummaryDisplay: vi.fn()
        };

        const controller = new SettingsController({ panel });
        expect(() => controller.openSettings()).not.toThrow();
    });

    it('openSettings does not throw when settings dialog classList remove is non-callable', () => {
        const elements = {
            'api-endpoint': createElementMock(),
            'api-key': createElementMock(),
            'text-model': createElementMock(),
            'knowledge-source': createElementMock(),
            'knowledge-mcp-endpoint': createElementMock(),
            'knowledge-mcp-server': createElementMock(),
            'knowledge-mcp-mode': createElementMock(),
            'knowledge-mcp-method': createElementMock(),
            'knowledge-mcp-resource': createElementMock(),
            'text-model-select': createElementMock({ options: [] }),
            'request-mode': createElementMock(),
            'proxy-endpoint': createElementMock(),
            'ai-settings-dialog': createElementMock({
                classList: {
                    remove: {}
                }
            })
        };
        stubDocument(elements);
        const panel = {
            aiClient: { config: {} },
            syncKnowledgeSettingsVisibility: vi.fn(),
            syncSelectToValue: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            updateLogSummaryDisplay: vi.fn()
        };

        const controller = new SettingsController({ panel });
        expect(() => controller.openSettings()).not.toThrow();
    });

    it('saveSettings falls back to existing config when form fields are missing', () => {
        stubDocument({});
        const panel = {
            aiClient: {
                config: {
                    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
                    apiKey: 'KEY',
                    textModel: 'gpt-4o-mini',
                    requestMode: 'proxy',
                    proxyEndpoint: 'https://proxy.example.com/openai',
                    knowledgeSource: 'mcp',
                    knowledgeMcpEndpoint: 'https://mcp.example.com',
                    knowledgeMcpServer: 'circuit-knowledge',
                    knowledgeMcpMode: 'resource',
                    knowledgeMcpMethod: 'knowledge.search',
                    knowledgeMcpResource: 'knowledge://circuit/high-school'
                },
                saveConfig: vi.fn()
            },
            refreshKnowledgeProvider: vi.fn(),
            app: {
                updateStatus: vi.fn()
            },
            logPanelEvent: vi.fn(),
            updateLogSummaryDisplay: vi.fn()
        };
        const controller = new SettingsController({ panel });

        expect(() => controller.saveSettings()).not.toThrow();
        expect(panel.aiClient.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
            apiEndpoint: 'https://api.openai.com/v1/chat/completions',
            apiKey: 'KEY',
            textModel: 'gpt-4o-mini',
            requestMode: 'proxy',
            proxyEndpoint: 'https://proxy.example.com/openai'
        }));
    });

    it('bindModelSelector does not throw when select addEventListener is non-callable', () => {
        const panel = {};
        const controller = new SettingsController({ panel });
        const selectEl = { addEventListener: {}, value: 'gpt-4o' };
        const inputEl = { value: '' };

        expect(() => controller.bindModelSelector(selectEl, inputEl)).not.toThrow();
    });

    it('bindModelSelector does not throw when select addEventListener throws', () => {
        const panel = {};
        const controller = new SettingsController({ panel });
        const selectEl = {
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            }),
            value: 'gpt-4o'
        };
        const inputEl = { value: '' };

        expect(() => controller.bindModelSelector(selectEl, inputEl)).not.toThrow();
    });
});
