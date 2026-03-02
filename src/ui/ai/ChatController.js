import {
    safeAddEventListener,
    safeClassListAdd,
    safeClassListRemove,
    safeClassListToggle,
    safeFocus,
    safeInvoke,
    safeSetAttribute
} from '../../utils/RuntimeSafety.js';

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

const NEW_CHAT_CONFIRM_WINDOW_MS = 1800;
const NEW_CHAT_CONFIRM_LABEL = '再点清空';
const NEW_CHAT_CONFIRM_HINT = '再次点击“新对话”将清空当前会话';
const NEW_CHAT_HOLD_HINT = '继续按住可清空当前会话';
const NEW_CHAT_HOLD_MS = 350;
const NEW_CHAT_HOLD_MOVE_TOLERANCE_SQ = 64;

function getBodyClassList() {
    if (typeof document === 'undefined') return null;
    return document.body?.classList || null;
}

function safeHasClass(classList, className) {
    return !!safeInvoke(classList, 'contains', [className], false);
}

function safeAddClass(node, className) {
    safeClassListAdd(node, className);
}

function safeRemoveClass(node, className) {
    safeClassListRemove(node, className);
}

function isPhoneLayoutMode() {
    const classList = getBodyClassList();
    return safeHasClass(classList, 'layout-mode-phone');
}

function isTouchPreferredEnvironment() {
    if (isPhoneLayoutMode()) return true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
    } catch (_) {
        return false;
    }
}

function hasConversationHistory(panel) {
    if (!Array.isArray(panel?.messageHistory)) return false;
    return panel.messageHistory.some((message) => message
        && (message.role === 'user' || message.role === 'assistant')
        && typeof message.content === 'string'
        && message.content.trim());
}

function setBodyFlag(flag, active) {
    if (typeof document === 'undefined') return;
    safeClassListToggle(document.body, flag, !!active);
}

function isVirtualKeyboardOpen() {
    if (typeof window === 'undefined' || !window.visualViewport) return false;
    const viewportHeight = Number(window.visualViewport.height);
    const innerHeight = Number(window.innerHeight);
    if (!Number.isFinite(viewportHeight) || !Number.isFinite(innerHeight) || innerHeight <= 0) return false;
    return innerHeight - viewportHeight > 120;
}

function syncMobileTypingState(panel) {
    if (!isPhoneLayoutMode()) {
        setBodyFlag('ai-input-active', false);
        setBodyFlag('ai-keyboard-open', false);
        return;
    }
    const keyboardOpen = !!panel.chatKeyboardOpen;
    const inputFocused = !!panel.chatInputFocused;
    setBodyFlag('ai-keyboard-open', keyboardOpen);
    setBodyFlag('ai-input-active', keyboardOpen || inputFocused);
}

export function classifyChatMessageDensity({ role = '', content = '', isPhoneMode = false } = {}) {
    if (!isPhoneMode) return 'normal';
    if (role !== 'assistant') return 'normal';
    const text = String(content || '');
    const trimmed = text.trim();
    if (!trimmed) return 'normal';

    const lineBreaks = (trimmed.match(/\n/g) || []).length;
    const hasStructuredBlocks = /```|^\s*[-*]\s+|^\s*\d+\.\s+|\$\$|^\s*>\s+/m.test(trimmed);
    const charCount = trimmed.length;

    if (charCount <= 120 && lineBreaks <= 1 && !hasStructuredBlocks) {
        return 'compact';
    }
    if (charCount >= 420 || lineBreaks >= 5 || hasStructuredBlocks) {
        return 'relaxed';
    }
    return 'normal';
}

function initializeChatImpl() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const inputArea = document.getElementById('chat-input-area');
    const followups = document.querySelectorAll('.followup-btn');
    const advancedToggleBtn = document.getElementById('chat-advanced-toggle-btn');
    const insertButtons = document.querySelectorAll('.chat-insert-btn');
    const followupActions = document.getElementById('followup-actions');
    const quickQuestions = document.getElementById('quick-questions');
    const chatControls = document.getElementById('chat-controls');
    const undoBtn = document.getElementById('chat-undo-btn');
    const newChatBtn = document.getElementById('chat-new-btn');
    const historySelect = document.getElementById('chat-history-select');
    const newChatHint = document.getElementById('chat-new-confirm-hint');
    if (!input || !sendBtn) return;
    this.chatAdvancedExpanded = false;
    this.chatInputFocused = false;
    this.chatKeyboardOpen = false;
    this.syncChatInputHeight(input);
    syncMobileTypingState(this);

    const setInputFocusActive = (active) => {
        this.chatInputFocused = !!active;
        if (this.chatInputFocused) {
            this.app?.responsiveLayout?.closeDrawers?.();
        }
        syncMobileTypingState(this);
        this.constrainPanelToViewport?.();
    };

    safeAddEventListener(input, 'focus', () => {
        if (this.chatInputBlurTimer) {
            clearTimeout(this.chatInputBlurTimer);
            this.chatInputBlurTimer = null;
        }
        setInputFocusActive(true);
    });
    safeAddEventListener(input, 'blur', () => {
        if (this.chatInputBlurTimer) {
            clearTimeout(this.chatInputBlurTimer);
        }
        this.chatInputBlurTimer = setTimeout(() => {
            this.chatInputBlurTimer = null;
            setInputFocusActive(false);
        }, 120);
    });

    const updateKeyboardState = () => {
        this.chatKeyboardOpen = isVirtualKeyboardOpen();
        if (this.chatKeyboardOpen) {
            this.app?.responsiveLayout?.closeDrawers?.();
        }
        syncMobileTypingState(this);
        this.constrainPanelToViewport?.();
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
        safeAddEventListener(window.visualViewport, 'resize', updateKeyboardState);
        safeAddEventListener(window.visualViewport, 'scroll', updateKeyboardState);
    }
    updateKeyboardState();

    const runAskQuestionSafely = async (question) => {
        try {
            await this.askQuestion(question);
        } catch (error) {
            this.app?.logger?.error?.('Ask question failed:', error);
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

    let sendInFlight = false;
    const sendMessage = async () => {
        const question = input.value.trim();
        if (!question || this.isProcessing || sendInFlight) return;
        sendInFlight = true;
        try {
            await runAskQuestionSafely(question);
            input.value = '';
            this.syncChatInputHeight(input);
        } finally {
            sendInFlight = false;
        }
    };

    safeAddEventListener(sendBtn, 'click', () => {
        void sendMessage();
    });
    safeAddEventListener(input, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            void sendMessage();
        }
    });
    safeAddEventListener(input, 'input', () => {
        this.syncChatInputHeight(input);
    });
    if (inputArea) {
        safeAddEventListener(inputArea, 'click', (event) => {
            if (!isTouchPreferredEnvironment()) return;
            const target = event?.target;
            const hitInteractive = typeof target?.closest === 'function'
                ? target.closest('button,select,textarea,a,label,input')
                : null;
            if (hitInteractive) return;
            safeFocus(input);
            const textLength = String(input.value || '').length;
            if (typeof input.setSelectionRange === 'function') {
                input.setSelectionRange(textLength, textLength);
            }
        });
    }

    const quickBtns = document.querySelectorAll('.quick-question-btn');
    quickBtns.forEach((btn) => {
        safeAddEventListener(btn, 'click', () => {
            const question = btn.textContent?.trim();
            if (!question || this.isProcessing) return;
            void runAskQuestionSafely(question);
        });
    });

    insertButtons.forEach((btn) => {
        safeAddEventListener(btn, 'click', () => {
            this.insertChatTemplateByMode(input, btn?.dataset?.insert);
        });
    });

    if (quickQuestions) {
        safeRemoveClass(quickQuestions, 'visible');
    }
    if (followupActions) {
        safeRemoveClass(followupActions, 'visible');
    }
    if (chatControls) {
        safeRemoveClass(chatControls, 'visible');
    }
    if (advancedToggleBtn) {
        safeAddEventListener(advancedToggleBtn, 'click', () => {
            this.chatAdvancedExpanded = !this.chatAdvancedExpanded;
            this.updateChatActionVisibility();
        });
    }
    this.updateChatActionVisibility();

    followups.forEach((btn) => {
        safeAddEventListener(btn, 'click', () => {
            const mode = btn.dataset.mode;
            this.triggerFollowup(mode);
        });
    });

    if (undoBtn) {
        safeAddEventListener(undoBtn, 'click', () => this.undoLastExchange());
    }

    if (newChatBtn) {
        const hideNewChatConfirmHint = () => {
            if (!newChatHint) return;
            newChatHint.hidden = true;
            newChatHint.textContent = '';
            safeRemoveClass(newChatHint, 'visible');
        };
        const showNewChatConfirmHint = (message = NEW_CHAT_CONFIRM_HINT) => {
            if (!newChatHint) return;
            newChatHint.textContent = String(message || '');
            newChatHint.hidden = false;
            safeAddClass(newChatHint, 'visible');
        };
        const defaultNewChatLabel = String(newChatBtn.textContent || '').trim() || '新对话';
        const defaultNewChatTitle = String(newChatBtn.title || '').trim() || defaultNewChatLabel;
        const resetNewChatConfirm = () => {
            if (this.pendingNewChatConfirmTimer) {
                clearTimeout(this.pendingNewChatConfirmTimer);
                this.pendingNewChatConfirmTimer = null;
            }
            this.pendingNewChatConfirm = false;
            newChatBtn.textContent = defaultNewChatLabel;
            newChatBtn.title = defaultNewChatTitle;
            safeSetAttribute(newChatBtn, 'aria-label', defaultNewChatLabel);
            hideNewChatConfirmHint();
        };
        const armNewChatConfirm = () => {
            this.pendingNewChatConfirm = true;
            newChatBtn.textContent = NEW_CHAT_CONFIRM_LABEL;
            newChatBtn.title = '再次点击后清空当前对话';
            safeSetAttribute(newChatBtn, 'aria-label', NEW_CHAT_CONFIRM_LABEL);
            showNewChatConfirmHint();
            this.pendingNewChatConfirmTimer = setTimeout(() => {
                resetNewChatConfirm();
            }, NEW_CHAT_CONFIRM_WINDOW_MS);
        };

        const isTouchPointer = (pointerType) => pointerType === 'touch' || pointerType === 'pen';
        let holdTimer = null;
        let holdPointerId = null;
        let holdStartX = 0;
        let holdStartY = 0;
        let suppressNextClick = false;

        const clearHoldTimer = () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        };

        const clearHoldState = () => {
            clearHoldTimer();
            holdPointerId = null;
            holdStartX = 0;
            holdStartY = 0;
        };

        const matchesHoldPointer = (event) => {
            if (!Number.isFinite(holdPointerId)) return true;
            if (!Number.isFinite(event?.pointerId)) return true;
            return Number(event.pointerId) === holdPointerId;
        };

        const tryStartTouchHold = (event) => {
            if (!isTouchPointer(event?.pointerType)) return;
            const requiresTouchConfirmation = hasConversationHistory(this);
            if (!requiresTouchConfirmation) return;
            if (Number.isFinite(event?.button) && event.button !== 0) return;

            clearHoldState();
            holdPointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
            holdStartX = Number(event?.clientX) || 0;
            holdStartY = Number(event?.clientY) || 0;
            this.pendingNewChatConfirm = false;
            showNewChatConfirmHint(NEW_CHAT_HOLD_HINT);
            newChatBtn.title = '继续按住后清空当前对话';
            holdTimer = setTimeout(() => {
                holdTimer = null;
                suppressNextClick = true;
                clearHoldState();
                resetNewChatConfirm();
                this.startNewConversation();
            }, NEW_CHAT_HOLD_MS);
        };

        const cancelTouchHold = () => {
            if (!holdTimer) return;
            clearHoldState();
            resetNewChatConfirm();
        };

        safeAddEventListener(newChatBtn, 'pointerdown', (event) => {
            if (!isTouchPreferredEnvironment()) return;
            tryStartTouchHold(event);
        });
        safeAddEventListener(newChatBtn, 'pointermove', (event) => {
            if (!matchesHoldPointer(event)) return;
            if (!holdTimer) return;
            const dx = (Number(event?.clientX) || 0) - holdStartX;
            const dy = (Number(event?.clientY) || 0) - holdStartY;
            if (dx * dx + dy * dy > NEW_CHAT_HOLD_MOVE_TOLERANCE_SQ) {
                cancelTouchHold();
            }
        });
        const endTouchHold = (event) => {
            if (!matchesHoldPointer(event)) return;
            cancelTouchHold();
        };
        safeAddEventListener(newChatBtn, 'pointerup', endTouchHold);
        safeAddEventListener(newChatBtn, 'pointercancel', endTouchHold);

        hideNewChatConfirmHint();

        safeAddEventListener(newChatBtn, 'click', (event) => {
            if (suppressNextClick) {
                suppressNextClick = false;
                event?.preventDefault?.();
                return;
            }
            const requiresTouchConfirmation = isTouchPreferredEnvironment() && hasConversationHistory(this);
            if (requiresTouchConfirmation && !this.pendingNewChatConfirm) {
                armNewChatConfirm();
                return;
            }
            resetNewChatConfirm();
            this.startNewConversation();
        });
    }

    if (historySelect) {
        safeAddEventListener(historySelect, 'change', (e) => {
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
        this.app?.logger?.error?.('Question error:', error);
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
        this.app?.logger?.error?.('Followup question failed:', error);
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
    const isPhoneMode = isPhoneLayoutMode();
    const density = classifyChatMessageDensity({
        role,
        content,
        isPhoneMode
    });
    const contentEl = messageEl.querySelector('.chat-message-content');
    if (contentEl && density) {
        safeAddClass(contentEl, `chat-density-${density}`);
    }

    if (messagesDiv) {
        messagesDiv.appendChild(messageEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

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
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }
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
        this.logPanelEvent?.('warn', 'chat_history_save_failed', {
            error: e?.message || String(e)
        });
        this.app?.logger?.warn?.('保存历史失败', e);
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
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }
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
