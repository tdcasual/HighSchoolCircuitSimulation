export class ChatController {
    constructor(deps = {}) {
        this.deps = deps;
    }

    withPanel(fn, ...args) {
        const panel = this.deps?.panel || this.deps || {};
        return fn.call(panel, ...args);
    }

    initializeChat() {
        return this.withPanel(initializeChatImpl);
    }

    askQuestion(question) {
        return this.withPanel(askQuestionImpl, question);
    }

    triggerFollowup(mode) {
        return this.withPanel(triggerFollowupImpl, mode);
    }

    getAgentConversationContext(maxTurns = 4) {
        return this.withPanel(getAgentConversationContextImpl, maxTurns);
    }

    addChatMessage(role, content, options = {}) {
        return this.withPanel(addChatMessageImpl, role, content, options);
    }

    removeChatMessage(messageId) {
        return this.withPanel(removeChatMessageImpl, messageId);
    }

    undoLastExchange() {
        return this.withPanel(undoLastExchangeImpl);
    }

    startNewConversation() {
        return this.withPanel(startNewConversationImpl);
    }

    archiveCurrentConversation() {
        return this.withPanel(archiveCurrentConversationImpl);
    }

    loadHistory() {
        return this.withPanel(loadHistoryImpl);
    }

    refreshHistorySelect() {
        return this.withPanel(refreshHistorySelectImpl);
    }

    loadConversationFromHistory(id) {
        return this.withPanel(loadConversationFromHistoryImpl, id);
    }
}

function initializeChatImpl() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const followups = document.querySelectorAll('.followup-btn');
    const advancedToggleBtn = document.getElementById('chat-advanced-toggle-btn');
    const insertButtons = document.querySelectorAll('.chat-insert-btn');
    const followupActions = document.getElementById('followup-actions');
    const quickQuestions = document.getElementById('quick-questions');
    const chatControls = document.getElementById('chat-controls');
    const undoBtn = document.getElementById('chat-undo-btn');
    const newChatBtn = document.getElementById('chat-new-btn');
    const historySelect = document.getElementById('chat-history-select');
    if (!input || !sendBtn) return;
    this.chatAdvancedExpanded = false;
    this.syncChatInputHeight(input);

    const runAskQuestionSafely = async (question) => {
        try {
            await this.askQuestion(question);
        } catch (error) {
            console.error('Ask question failed:', error);
            this.addChatMessage('system', `抱歉，出现错误: ${error.message}`);
            this.logPanelEvent?.('error', 'question_outer_failed', {
                error: error?.message || String(error)
            });
            this.isProcessing = false;
            if (sendBtn) {
                sendBtn.disabled = false;
                if (sendBtn.textContent === '⏳') {
                    sendBtn.textContent = '发送';
                }
            }
            this.updateLogSummaryDisplay?.();
        }
    };

    const sendMessage = async () => {
        const question = input.value.trim();
        if (question && !this.isProcessing) {
            await runAskQuestionSafely(question);
            input.value = '';
            this.syncChatInputHeight(input);
        }
    };

    sendBtn.addEventListener('click', () => {
        void sendMessage();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            void sendMessage();
        }
    });
    input.addEventListener('input', () => {
        this.syncChatInputHeight(input);
    });

    const quickBtns = document.querySelectorAll('.quick-question-btn');
    quickBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const question = btn.textContent?.trim();
            if (!question || this.isProcessing) return;
            void runAskQuestionSafely(question);
        });
    });

    insertButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            this.insertChatTemplateByMode(input, btn?.dataset?.insert);
        });
    });

    if (quickQuestions) {
        quickQuestions.classList.remove('visible');
    }
    if (followupActions) {
        followupActions.classList.remove('visible');
    }
    if (chatControls) {
        chatControls.classList.remove('visible');
    }
    if (advancedToggleBtn) {
        advancedToggleBtn.addEventListener('click', () => {
            this.chatAdvancedExpanded = !this.chatAdvancedExpanded;
            this.updateChatActionVisibility();
        });
    }
    this.updateChatActionVisibility();

    followups.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            this.triggerFollowup(mode);
        });
    });

    if (undoBtn) {
        undoBtn.addEventListener('click', () => this.undoLastExchange());
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => this.startNewConversation());
    }

    if (historySelect) {
        historySelect.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id) this.loadConversationFromHistory(id);
        });
        this.refreshHistorySelect();
    }
}

async function askQuestionImpl(question) {
    if (this.isProcessing) return;
    const normalizedQuestion = String(question || '').trim();
    if (!normalizedQuestion) return;
    const traceId = this.aiLogger?.createTrace?.('chat_question', {
        questionPreview: normalizedQuestion.slice(0, 180),
        componentCount: this.circuit.components.size,
        wireCount: this.circuit.wires.size
    }) || '';
    this.logPanelEvent?.('info', 'question_received', {
        chars: normalizedQuestion.length
    }, traceId);

    this.addChatMessage('user', normalizedQuestion);
    this.lastQuestion = normalizedQuestion;

    if (this.circuit.components.size === 0) {
        this.addChatMessage('system', '当前电路为空，请先添加元器件或上传电路图。');
        this.logPanelEvent?.('warn', 'question_blocked_empty_circuit', null, traceId);
        this.aiLogger?.finishTrace?.(traceId, 'warning', {
            reason: 'empty_circuit'
        });
        this.updateLogSummaryDisplay?.();
        return;
    }

    const historyContext = this.getAgentConversationContext();
    const sendBtn = document.getElementById('chat-send-btn');
    const originalText = sendBtn?.textContent || '发送';
    let loadingId = null;

    try {
        this.isProcessing = true;
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = '⏳';
        }

        loadingId = this.addChatMessage(
            'assistant',
            '<div class="loading-indicator"><span></span><span></span><span></span></div>',
            { rawHtml: true }
        );

        const answer = await this.aiAgent.answerQuestion({
            question: normalizedQuestion,
            history: historyContext,
            traceId
        });

        this.removeChatMessage(loadingId);
        loadingId = null;
        this.addChatMessage('assistant', answer, { markdown: true });
        const fallbackUsed = String(answer || '').includes('离线保底回答路径');
        this.logPanelEvent?.(fallbackUsed ? 'warn' : 'info', 'question_answer_rendered', {
            answerChars: String(answer || '').length,
            fallbackUsed
        }, traceId);
        this.aiLogger?.finishTrace?.(traceId, fallbackUsed ? 'warning' : 'success', {
            fallbackUsed
        });
    } catch (error) {
        console.error('Question error:', error);
        if (loadingId) {
            this.removeChatMessage(loadingId);
            loadingId = null;
        }
        this.addChatMessage('system', `抱歉，出现错误: ${error.message}`);
        this.logPanelEvent?.('error', 'question_failed', {
            error: error?.message || String(error)
        }, traceId);
        this.aiLogger?.finishTrace?.(traceId, 'error', {
            error: error?.message || String(error)
        });
    } finally {
        this.isProcessing = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
        }
        this.updateKnowledgeVersionDisplay();
        this.updateLogSummaryDisplay?.();
    }
}

function triggerFollowupImpl(mode) {
    if (this.isProcessing) return;
    if (!this.lastQuestion) {
        this.addChatMessage('system', '请先提一个问题，再使用跟进按钮。');
        return;
    }
    let prompt;
    switch (mode) {
        case 'continue':
            prompt = '请基于上一轮回答继续深入讲解，并补充1-2点关键物理要点。';
            break;
        case 'simplify':
            prompt = '请把上一轮回答改写成更简洁、更通俗的版本，控制在3-4句话。';
            break;
        case 'quiz':
            prompt = '请基于刚才讲解生成2道简短小测验（选择或填空），最后单独给出答案。';
            break;
        default:
            prompt = '请继续讲解。';
    }
    const composite = `基于我们上一轮对话，${prompt}`;
    this.askQuestion(composite).catch((error) => {
        console.error('Followup question failed:', error);
        this.addChatMessage('system', `抱歉，出现错误: ${error.message}`);
        this.logPanelEvent?.('error', 'followup_failed', {
            mode,
            error: error?.message || String(error)
        });
        this.isProcessing = false;
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
            if (sendBtn.textContent === '⏳') {
                sendBtn.textContent = '发送';
            }
        }
        this.updateLogSummaryDisplay?.();
    });
}

function getAgentConversationContextImpl(maxTurns = 4) {
    if (!Array.isArray(this.messageHistory) || this.messageHistory.length === 0) {
        return [];
    }
    const maxMessages = Math.max(1, maxTurns) * 2;
    return this.messageHistory
        .filter((message) => message
            && (message.role === 'user' || message.role === 'assistant')
            && typeof message.content === 'string'
            && message.content.trim()
            && !message.content.includes('loading-indicator'))
        .slice(-maxMessages)
        .map((message) => ({ role: message.role, content: message.content.trim() }));
}

function addChatMessageImpl(role, content, options = {}) {
    const { rawHtml = false, markdown = false } = options;
    const messagesDiv = document.getElementById('chat-messages');
    const messageId = `msg-${Date.now()}-${Math.random()}`;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${role}`;
    messageEl.id = messageId;
    const rendered = rawHtml ? content
        : markdown ? this.renderMarkdown(content)
            : this.escapeHtml(content);
    messageEl.innerHTML = `<div class="chat-message-content">${rendered}</div>`;

    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (markdown) {
        this.queueMathTypeset(messageEl);
    }

    this.messageHistory.push({ role, content, id: messageId });
    this.updateChatActionVisibility();

    return messageId;
}

function removeChatMessageImpl(messageId) {
    const messageEl = document.getElementById(messageId);
    if (messageEl) messageEl.remove();

    this.messageHistory = this.messageHistory.filter((m) => m.id !== messageId);
    this.updateChatActionVisibility();
}

function undoLastExchangeImpl() {
    if (this.isProcessing || this.messageHistory.length === 0) return;
    let removed = false;
    while (this.messageHistory.length > 0) {
        const last = this.messageHistory[this.messageHistory.length - 1];
        this.removeChatMessage(last.id);
        if (last.role === 'assistant') {
            removed = true;
        } else if (removed && last.role === 'user') {
            break;
        }
    }
}

function startNewConversationImpl() {
    if (this.messageHistory.length > 0) {
        this.archiveCurrentConversation();
    }
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = '';
    this.messageHistory = [];
    this.lastQuestion = '';
    this.updateChatActionVisibility();
    this.refreshHistorySelect();
}

function archiveCurrentConversationImpl() {
    const history = this.loadHistory();
    const title = this.messageHistory.find((m) => m.role === 'user')?.content?.slice(0, 40) || '未命名会话';
    const record = {
        id: `history-${Date.now()}`,
        title,
        timestamp: Date.now(),
        messages: [...this.messageHistory]
    };
    history.unshift(record);
    const trimmed = history.slice(0, 20);
    try {
        localStorage.setItem('ai_chat_history', JSON.stringify(trimmed));
    } catch (e) {
        console.warn('保存历史失败', e);
    }
}

function loadHistoryImpl() {
    try {
        const raw = localStorage.getItem('ai_chat_history');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function refreshHistorySelectImpl() {
    const historySelect = document.getElementById('chat-history-select');
    if (!historySelect) return;
    const history = this.loadHistory();
    const currentValue = historySelect.value;
    historySelect.innerHTML = '<option value="">历史记录</option>';
    history.forEach((item) => {
        const opt = document.createElement('option');
        const date = new Date(item.timestamp).toLocaleString();
        opt.value = item.id;
        opt.textContent = `${item.title} (${date})`;
        historySelect.appendChild(opt);
    });
    historySelect.value = currentValue || '';
}

function loadConversationFromHistoryImpl(id) {
    const history = this.loadHistory();
    const record = history.find((h) => h.id === id);
    if (!record) return;

    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = '';
    this.messageHistory = [];
    this.lastQuestion = '';

    for (const msg of record.messages) {
        const opts = { markdown: msg.role === 'assistant' };
        this.addChatMessage(msg.role, msg.content, opts);
        if (msg.role === 'user') {
            this.lastQuestion = msg.content;
        }
    }
    this.updateChatActionVisibility();
}
