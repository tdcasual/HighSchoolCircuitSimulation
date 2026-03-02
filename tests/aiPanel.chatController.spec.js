import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatController, classifyChatMessageDensity } from '../src/ui/ai/ChatController.js';

describe('ChatController', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new ChatController(deps);
        expect(controller.deps).toBe(deps);
    });

    it('runs askQuestion against panel context', async () => {
        const sendBtn = { textContent: '发送', disabled: false };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'chat-send-btn' ? sendBtn : null))
        });

        const panel = {
            isProcessing: false,
            circuit: { components: new Map() },
            addChatMessage: vi.fn(),
            getAgentConversationContext: vi.fn().mockReturnValue([]),
            aiAgent: { answerQuestion: vi.fn() },
            removeChatMessage: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            lastQuestion: ''
        };
        const controller = new ChatController({ panel });

        await controller.askQuestion('  控制器测试  ');

        expect(panel.addChatMessage).toHaveBeenNthCalledWith(1, 'user', '控制器测试');
        expect(panel.addChatMessage).toHaveBeenNthCalledWith(2, 'system', '当前电路为空，请先添加元器件或上传电路图。');
        expect(panel.aiAgent.answerQuestion).not.toHaveBeenCalled();
    });

    it('classifies short assistant messages as compact on phone', () => {
        const density = classifyChatMessageDensity({
            role: 'assistant',
            content: '这是一个简短回答。',
            isPhoneMode: true
        });
        expect(density).toBe('compact');
    });

    it('classifies long structured assistant messages as relaxed on phone', () => {
        const longStructured = [
            '第一步：先看电源与负载关系。',
            '第二步：再看分压与分流。',
            '- 列出已知条件',
            '- 建立等效电路',
            '- 对关键节点做电压电流分析',
            '```',
            'I = U / R',
            '```'
        ].join('\n');

        const density = classifyChatMessageDensity({
            role: 'assistant',
            content: longStructured.repeat(4),
            isPhoneMode: true
        });
        expect(density).toBe('relaxed');
    });

    it('keeps non-assistant messages as normal density', () => {
        const density = classifyChatMessageDensity({
            role: 'user',
            content: '我想问一个问题',
            isPhoneMode: true
        });
        expect(density).toBe('normal');
    });

    it('addChatMessage does not throw when chat message container is missing', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            createElement: vi.fn(() => ({
                className: '',
                id: '',
                innerHTML: '',
                querySelector: vi.fn(() => null)
            }))
        });

        const panel = {
            messageHistory: [],
            escapeHtml: (text) => String(text || ''),
            renderMarkdown: (text) => String(text || ''),
            queueMathTypeset: vi.fn(),
            updateChatActionVisibility: vi.fn()
        };
        const controller = new ChatController({ panel });

        expect(() => controller.addChatMessage('assistant', '回答内容')).not.toThrow();
        expect(panel.messageHistory).toHaveLength(1);
        expect(panel.updateChatActionVisibility).toHaveBeenCalledTimes(1);
    });

    it('startNewConversation does not throw when chat message container is missing', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null)
        });

        const panel = {
            messageHistory: [{ role: 'user', content: 'q1' }],
            archiveCurrentConversation: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            refreshHistorySelect: vi.fn(),
            lastQuestion: 'q1'
        };
        const controller = new ChatController({ panel });

        expect(() => controller.startNewConversation()).not.toThrow();
        expect(panel.archiveCurrentConversation).toHaveBeenCalledTimes(1);
        expect(panel.messageHistory).toEqual([]);
        expect(panel.lastQuestion).toBe('');
    });

    it('loadConversationFromHistory does not throw when chat message container is missing', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null)
        });

        const panel = {
            messageHistory: [],
            lastQuestion: '',
            loadHistory: vi.fn(() => [{
                id: 'history-1',
                messages: [
                    { role: 'user', content: '第一问' },
                    { role: 'assistant', content: '第一答' }
                ]
            }]),
            addChatMessage: vi.fn(),
            updateChatActionVisibility: vi.fn()
        };
        const controller = new ChatController({ panel });

        expect(() => controller.loadConversationFromHistory('history-1')).not.toThrow();
    });

    it('initializeChat does not throw when body classList contains is non-callable', () => {
        const input = {
            value: '',
            addEventListener: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn()
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: {},
                    toggle: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: null
        });

        const panel = {
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
        expect(panel.syncChatInputHeight).toHaveBeenCalledTimes(1);
    });

    it('initializeChat does not throw when body classList.toggle throws', () => {
        const input = {
            value: '',
            addEventListener: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn()
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false),
                    toggle: () => {
                        throw new TypeError('broken toggle');
                    }
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: null
        });

        const panel = {
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
    });

    it('initializeChat does not throw when quick action classList.remove is non-callable', () => {
        const input = {
            value: '',
            addEventListener: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn()
        };
        const quickQuestions = { classList: { remove: {} } };
        const followupActions = { classList: { remove: {} } };
        const chatControls = { classList: { remove: {} } };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false),
                    toggle: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                if (id === 'quick-questions') return quickQuestions;
                if (id === 'followup-actions') return followupActions;
                if (id === 'chat-controls') return chatControls;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: null
        });

        const panel = {
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
    });

    it('addChatMessage does not throw when message content classList.add is non-callable', () => {
        const contentEl = {
            classList: {
                add: {}
            }
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            createElement: vi.fn(() => ({
                className: '',
                id: '',
                innerHTML: '',
                querySelector: vi.fn(() => contentEl)
            }))
        });

        const panel = {
            messageHistory: [],
            escapeHtml: (text) => String(text || ''),
            renderMarkdown: (text) => String(text || ''),
            queueMathTypeset: vi.fn(),
            updateChatActionVisibility: vi.fn()
        };
        const controller = new ChatController({ panel });

        expect(() => controller.addChatMessage('assistant', '回答内容')).not.toThrow();
        expect(panel.messageHistory).toHaveLength(1);
    });

    it('initializeChat does not throw when visualViewport addEventListener is non-callable', () => {
        const input = {
            value: '',
            addEventListener: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn()
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false),
                    toggle: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: {
                addEventListener: {},
                height: 600
            },
            innerHeight: 800
        });

        const panel = {
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
    });

    it('initializeChat does not throw when send button addEventListener throws', () => {
        const input = {
            value: '',
            addEventListener: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            })
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false),
                    toggle: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: null
        });

        const panel = {
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
    });

    it('initializeChat does not throw when new-chat button setAttribute throws', () => {
        let clickHandler = null;
        const input = {
            value: '',
            addEventListener: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn()
        };
        const newChatBtn = {
            textContent: '新对话',
            title: '新对话',
            addEventListener: vi.fn((eventName, handler) => {
                if (eventName === 'click') clickHandler = handler;
            }),
            setAttribute: vi.fn(() => {
                throw new TypeError('broken setAttribute');
            })
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => true),
                    toggle: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                if (id === 'chat-new-btn') return newChatBtn;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: null,
            matchMedia: vi.fn(() => ({ matches: true }))
        });

        const panel = {
            messageHistory: [{ role: 'user', content: 'q1' }],
            pendingNewChatConfirm: false,
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            startNewConversation: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
        expect(() => clickHandler?.({ preventDefault: vi.fn() })).not.toThrow();
    });

    it('initializeChat input-area click does not throw when input focus throws', () => {
        let inputAreaClick = null;
        const input = {
            value: 'abc',
            addEventListener: vi.fn(),
            focus: vi.fn(() => {
                throw new TypeError('focus failed');
            }),
            setSelectionRange: vi.fn()
        };
        const sendBtn = {
            textContent: '发送',
            disabled: false,
            addEventListener: vi.fn()
        };
        const inputArea = {
            addEventListener: vi.fn((eventName, handler) => {
                if (eventName === 'click') inputAreaClick = handler;
            })
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn((className) => className === 'layout-mode-phone'),
                    toggle: vi.fn()
                }
            },
            getElementById: vi.fn((id) => {
                if (id === 'chat-input') return input;
                if (id === 'chat-send-btn') return sendBtn;
                if (id === 'chat-input-area') return inputArea;
                return null;
            }),
            querySelectorAll: vi.fn(() => [])
        });
        vi.stubGlobal('window', {
            visualViewport: null,
            matchMedia: vi.fn(() => ({ matches: false }))
        });

        const panel = {
            syncChatInputHeight: vi.fn(),
            constrainPanelToViewport: vi.fn(),
            updateChatActionVisibility: vi.fn(),
            app: {
                responsiveLayout: {
                    closeDrawers: vi.fn()
                }
            }
        };
        const controller = new ChatController({ panel });

        expect(() => controller.initializeChat()).not.toThrow();
        expect(() => inputAreaClick?.({ target: {} })).not.toThrow();
    });
});
