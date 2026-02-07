import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

function createEventTarget(initial = {}) {
    const listeners = new Map();
    const element = {
        ...initial,
        addEventListener: vi.fn((type, handler) => {
            listeners.set(type, handler);
        }),
        dispatch(type, event = {}) {
            const handler = listeners.get(type);
            if (!handler) return;
            handler({
                target: element,
                ...event
            });
        }
    };
    return element;
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AIPanel chat behavior', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('delegates askQuestion to ChatController', async () => {
        const panel = { chatController: { askQuestion: vi.fn().mockResolvedValue(undefined) } };
        await AIPanel.prototype.askQuestion.call(panel, 'q1');
        expect(panel.chatController.askQuestion).toHaveBeenCalledWith('q1');
    });

    it('keeps user question visible when circuit is empty', async () => {
        const sendBtn = { textContent: '发送', disabled: false };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'chat-send-btn' ? sendBtn : null))
        });

        const ctx = {
            isProcessing: false,
            circuit: { components: new Map() },
            addChatMessage: vi.fn(),
            getAgentConversationContext: vi.fn().mockReturnValue([]),
            aiAgent: { answerQuestion: vi.fn() },
            removeChatMessage: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            lastQuestion: ''
        };

        await AIPanel.prototype.askQuestion.call(ctx, '  电流为什么变化  ');

        expect(ctx.addChatMessage).toHaveBeenNthCalledWith(1, 'user', '电流为什么变化');
        expect(ctx.addChatMessage).toHaveBeenNthCalledWith(2, 'system', '当前电路为空，请先添加元器件或上传电路图。');
        expect(ctx.aiAgent.answerQuestion).not.toHaveBeenCalled();
    });

    it('renders assistant answer and clears loading state on success', async () => {
        const sendBtn = { textContent: '发送', disabled: false };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'chat-send-btn' ? sendBtn : null))
        });

        const ctx = {
            isProcessing: false,
            circuit: { components: new Map([['r1', {}]]) },
            addChatMessage: vi.fn()
                .mockReturnValueOnce('user-1')
                .mockReturnValueOnce('loading-1')
                .mockReturnValueOnce('assistant-1'),
            getAgentConversationContext: vi.fn().mockReturnValue([{ role: 'user', content: '旧问题' }]),
            aiAgent: {
                answerQuestion: vi.fn().mockResolvedValue('这是答案')
            },
            removeChatMessage: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            lastQuestion: ''
        };

        await AIPanel.prototype.askQuestion.call(ctx, 'R1电流是多少?');

        expect(ctx.aiAgent.answerQuestion).toHaveBeenCalledWith({
            question: 'R1电流是多少?',
            history: [{ role: 'user', content: '旧问题' }],
            traceId: ''
        });
        expect(ctx.removeChatMessage).toHaveBeenCalledWith('loading-1');
        expect(ctx.addChatMessage).toHaveBeenNthCalledWith(3, 'assistant', '这是答案', { markdown: true });
        expect(sendBtn.disabled).toBe(false);
        expect(sendBtn.textContent).toBe('发送');
        expect(ctx.isProcessing).toBe(false);
    });

    it('removes loading indicator and reports error when agent fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const sendBtn = { textContent: '发送', disabled: false };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'chat-send-btn' ? sendBtn : null))
        });

        const ctx = {
            isProcessing: false,
            circuit: { components: new Map([['r1', {}]]) },
            addChatMessage: vi.fn()
                .mockReturnValueOnce('user-1')
                .mockReturnValueOnce('loading-1')
                .mockReturnValueOnce('system-1'),
            getAgentConversationContext: vi.fn().mockReturnValue([]),
            aiAgent: {
                answerQuestion: vi.fn().mockRejectedValue(new Error('请求超时'))
            },
            removeChatMessage: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            lastQuestion: ''
        };

        await AIPanel.prototype.askQuestion.call(ctx, '测试问题');

        expect(ctx.removeChatMessage).toHaveBeenCalledWith('loading-1');
        expect(ctx.addChatMessage).toHaveBeenLastCalledWith('system', '抱歉，出现错误: 请求超时');
        expect(sendBtn.disabled).toBe(false);
        expect(sendBtn.textContent).toBe('发送');
    });

    it('wires click and enter send events in initializeChat', async () => {
        const input = createEventTarget({ value: '' });
        const sendBtn = createEventTarget({ textContent: '发送', disabled: false });
        const followupActions = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const chatControls = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const quickQuestions = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const undoBtn = createEventTarget({});
        const newBtn = createEventTarget({});
        const historySelect = createEventTarget({ value: '' });
        const followups = [
            createEventTarget({ dataset: { mode: 'continue' } }),
            createEventTarget({ dataset: { mode: 'simplify' } })
        ];
        const quickButtons = [
            createEventTarget({ textContent: '为什么电流变化?' })
        ];

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'chat-input': input,
                'chat-send-btn': sendBtn,
                'followup-actions': followupActions,
                'chat-controls': chatControls,
                'quick-questions': quickQuestions,
                'chat-undo-btn': undoBtn,
                'chat-new-btn': newBtn,
                'chat-history-select': historySelect
            }[id] || null)),
            querySelectorAll: vi.fn((selector) => {
                if (selector === '.followup-btn') return followups;
                if (selector === '.quick-question-btn') return quickButtons;
                return [];
            })
        });

        const ctx = {
            isProcessing: false,
            askQuestion: vi.fn().mockResolvedValue(undefined),
            triggerFollowup: vi.fn(),
            undoLastExchange: vi.fn(),
            startNewConversation: vi.fn(),
            loadConversationFromHistory: vi.fn(),
            refreshHistorySelect: vi.fn(),
            addChatMessage: vi.fn(),
            messageHistory: [],
            syncChatInputHeight: vi.fn(),
            updateChatActionVisibility: AIPanel.prototype.updateChatActionVisibility
        };

        AIPanel.prototype.initializeChat.call(ctx);

        input.value = '  测试发送 ';
        sendBtn.dispatch('click');
        await flushMicrotasks();
        expect(ctx.askQuestion).toHaveBeenCalledWith('测试发送');
        expect(input.value).toBe('');

        const preventDefault = vi.fn();
        input.value = '回车发送';
        input.dispatch('keydown', { key: 'Enter', isComposing: false, preventDefault });
        await flushMicrotasks();
        expect(preventDefault).toHaveBeenCalled();
        expect(ctx.askQuestion).toHaveBeenCalledWith('回车发送');
        expect(quickQuestions.classList.remove).toHaveBeenCalledWith('visible');
        expect(chatControls.classList.remove).toHaveBeenCalledWith('visible');
    });

    it('skips send on composing enter and supports followup/quick/history actions', async () => {
        const input = createEventTarget({ value: '' });
        const sendBtn = createEventTarget({ textContent: '发送', disabled: false });
        const followupActions = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const chatControls = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const quickQuestions = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const undoBtn = createEventTarget({});
        const newBtn = createEventTarget({});
        const historySelect = createEventTarget({ value: '' });
        const followups = [
            createEventTarget({ dataset: { mode: 'quiz' } })
        ];
        const quickButtons = [
            createEventTarget({ textContent: '滑动变阻器如何影响电流?' })
        ];

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'chat-input': input,
                'chat-send-btn': sendBtn,
                'followup-actions': followupActions,
                'chat-controls': chatControls,
                'quick-questions': quickQuestions,
                'chat-undo-btn': undoBtn,
                'chat-new-btn': newBtn,
                'chat-history-select': historySelect
            }[id] || null)),
            querySelectorAll: vi.fn((selector) => {
                if (selector === '.followup-btn') return followups;
                if (selector === '.quick-question-btn') return quickButtons;
                return [];
            })
        });

        const ctx = {
            isProcessing: false,
            askQuestion: vi.fn().mockResolvedValue(undefined),
            triggerFollowup: vi.fn(),
            undoLastExchange: vi.fn(),
            startNewConversation: vi.fn(),
            loadConversationFromHistory: vi.fn(),
            refreshHistorySelect: vi.fn(),
            addChatMessage: vi.fn(),
            messageHistory: [],
            syncChatInputHeight: vi.fn(),
            updateChatActionVisibility: AIPanel.prototype.updateChatActionVisibility
        };

        AIPanel.prototype.initializeChat.call(ctx);

        input.value = '输入法中';
        input.dispatch('keydown', {
            key: 'Enter',
            isComposing: true,
            preventDefault: vi.fn()
        });
        await flushMicrotasks();
        expect(ctx.askQuestion).not.toHaveBeenCalled();

        quickButtons[0].dispatch('click');
        await flushMicrotasks();
        expect(ctx.askQuestion).toHaveBeenCalledWith('滑动变阻器如何影响电流?');

        followups[0].dispatch('click');
        expect(ctx.triggerFollowup).toHaveBeenCalledWith('quiz');

        undoBtn.dispatch('click');
        newBtn.dispatch('click');
        expect(ctx.undoLastExchange).toHaveBeenCalledTimes(1);
        expect(ctx.startNewConversation).toHaveBeenCalledTimes(1);

        historySelect.dispatch('change', { target: { value: 'history-1' } });
        expect(ctx.loadConversationFromHistory).toHaveBeenCalledWith('history-1');
    });

    it('shows followup actions only after assistant reply', () => {
        const followupActions = {
            classList: {
                toggle: vi.fn(),
                remove: vi.fn()
            }
        };
        const chatControls = {
            classList: {
                toggle: vi.fn(),
                remove: vi.fn()
            }
        };
        const quickQuestions = {
            classList: {
                remove: vi.fn(),
                toggle: vi.fn()
            }
        };
        const advancedToggleBtn = {
            style: {},
            setAttribute: vi.fn(),
            textContent: ''
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'followup-actions': followupActions,
                'chat-controls': chatControls,
                'quick-questions': quickQuestions,
                'chat-advanced-toggle-btn': advancedToggleBtn
            }[id] || null))
        });

        const ctxWithoutAssistant = {
            messageHistory: [{ role: 'user', content: '问题' }]
        };
        AIPanel.prototype.updateChatActionVisibility.call(ctxWithoutAssistant);
        expect(followupActions.classList.toggle).toHaveBeenLastCalledWith('visible', false);
        expect(chatControls.classList.toggle).toHaveBeenLastCalledWith('visible', false);
        expect(quickQuestions.classList.toggle).toHaveBeenLastCalledWith('visible', false);

        const ctxWithAssistant = {
            messageHistory: [{ role: 'assistant', content: '答案' }],
            chatAdvancedExpanded: true
        };
        AIPanel.prototype.updateChatActionVisibility.call(ctxWithAssistant);
        expect(followupActions.classList.toggle).toHaveBeenLastCalledWith('visible', true);
        expect(chatControls.classList.toggle).toHaveBeenLastCalledWith('visible', true);

        const ctxWithHistoryOnly = {
            messageHistory: [],
            loadHistory: () => [{ id: 'history-1' }],
            chatAdvancedExpanded: true
        };
        AIPanel.prototype.updateChatActionVisibility.call(ctxWithHistoryOnly);
        expect(chatControls.classList.toggle).toHaveBeenLastCalledWith('visible', true);
    });

    it('passes marked output through sanitizer in renderMarkdown', () => {
        const parse = vi.fn().mockReturnValue('<p>unsafe</p>');
        const setOptions = vi.fn();
        vi.stubGlobal('window', {
            marked: {
                parse,
                setOptions
            }
        });

        const ctx = {
            markedConfigured: false,
            ensureMarkedConfigured: AIPanel.prototype.ensureMarkedConfigured,
            sanitizeRenderedMarkdown: vi.fn().mockReturnValue('<p>safe</p>'),
            escapeHtml: AIPanel.prototype.escapeHtml
        };

        const rendered = AIPanel.prototype.renderMarkdown.call(ctx, '**hello**');
        expect(setOptions).toHaveBeenCalledTimes(1);
        expect(parse).toHaveBeenCalledWith('**hello**', { breaks: true, gfm: true });
        expect(ctx.sanitizeRenderedMarkdown).toHaveBeenCalledWith('<p>unsafe</p>');
        expect(rendered).toBe('<p>safe</p>');
    });

    it('retries MathJax typeset when unavailable and clears queue after max retries', () => {
        vi.stubGlobal('window', {});
        const ctx = {
            mathTypesetQueue: new Set([{ isConnected: true }]),
            mathTypesetRetryCount: 0,
            mathTypesetMaxRetries: 2,
            scheduleMathTypesetFlush: vi.fn(),
            logPanelEvent: vi.fn()
        };

        AIPanel.prototype.flushMathTypesetQueue.call(ctx);
        expect(ctx.mathTypesetRetryCount).toBe(1);
        expect(ctx.scheduleMathTypesetFlush).toHaveBeenCalledTimes(1);

        AIPanel.prototype.flushMathTypesetQueue.call(ctx);
        expect(ctx.mathTypesetRetryCount).toBe(2);
        expect(ctx.scheduleMathTypesetFlush).toHaveBeenCalledTimes(2);

        AIPanel.prototype.flushMathTypesetQueue.call(ctx);
        expect(ctx.mathTypesetQueue.size).toBe(0);
        expect(ctx.mathTypesetRetryCount).toBe(0);
        expect(ctx.logPanelEvent).toHaveBeenCalledWith('warn', 'math_typeset_unavailable', {
            pendingCount: 1
        });
    });

    it('typesets queued nodes once MathJax is ready', async () => {
        const typesetPromise = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            MathJax: { typesetPromise }
        });
        const node = { isConnected: true };
        const ctx = {
            mathTypesetQueue: new Set([node]),
            mathTypesetRetryCount: 3,
            logPanelEvent: vi.fn()
        };

        AIPanel.prototype.flushMathTypesetQueue.call(ctx);
        await Promise.resolve();

        expect(typesetPromise).toHaveBeenCalledWith([node]);
        expect(ctx.mathTypesetQueue.size).toBe(0);
        expect(ctx.mathTypesetRetryCount).toBe(0);
    });

    it('does not send on Shift+Enter in chat input', async () => {
        const input = createEventTarget({ value: '多行问题' });
        const sendBtn = createEventTarget({ textContent: '发送', disabled: false });
        const followupActions = { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } };
        const chatControls = { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } };
        const quickQuestions = { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } };
        const undoBtn = createEventTarget({});
        const newBtn = createEventTarget({});
        const historySelect = createEventTarget({ value: '' });

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'chat-input': input,
                'chat-send-btn': sendBtn,
                'followup-actions': followupActions,
                'chat-controls': chatControls,
                'quick-questions': quickQuestions,
                'chat-undo-btn': undoBtn,
                'chat-new-btn': newBtn,
                'chat-history-select': historySelect
            }[id] || null)),
            querySelectorAll: vi.fn((selector) => {
                if (selector === '.followup-btn') return [];
                if (selector === '.quick-question-btn') return [];
                if (selector === '.chat-insert-btn') return [];
                return [];
            })
        });

        const ctx = {
            isProcessing: false,
            askQuestion: vi.fn().mockResolvedValue(undefined),
            triggerFollowup: vi.fn(),
            undoLastExchange: vi.fn(),
            startNewConversation: vi.fn(),
            loadConversationFromHistory: vi.fn(),
            refreshHistorySelect: vi.fn(),
            addChatMessage: vi.fn(),
            messageHistory: [],
            syncChatInputHeight: vi.fn(),
            updateChatActionVisibility: AIPanel.prototype.updateChatActionVisibility
        };

        AIPanel.prototype.initializeChat.call(ctx);

        const preventDefault = vi.fn();
        input.dispatch('keydown', {
            key: 'Enter',
            shiftKey: true,
            isComposing: false,
            preventDefault
        });
        await flushMicrotasks();

        expect(preventDefault).not.toHaveBeenCalled();
        expect(ctx.askQuestion).not.toHaveBeenCalled();
    });

    it('inserts inline and block math templates into input', () => {
        const base = '请分析';
        const input = {
            value: base,
            selectionStart: base.length,
            selectionEnd: base.length,
            focus: vi.fn(),
            setSelectionRange: vi.fn(),
            style: {}
        };
        const ctx = {
            syncChatInputHeight: vi.fn()
        };

        AIPanel.prototype.insertChatTemplateByMode.call(ctx, input, 'inline-math');
        expect(input.value).toBe(`${base}$公式$`);
        expect(input.setSelectionRange).toHaveBeenCalledWith(base.length + 1, base.length + 3);

        input.selectionStart = input.value.length;
        input.selectionEnd = input.value.length;
        AIPanel.prototype.insertChatTemplateByMode.call(ctx, input, 'block-math');
        expect(input.value.endsWith('\n$$\n公式\n$$')).toBe(true);
    });
});
