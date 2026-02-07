/**
 * AIPanel.js - AI助手面板控制器
 */

import { OpenAIClient } from '../ai/OpenAIClient.js';
import { CircuitExplainer } from '../ai/CircuitExplainer.js';
import { CircuitAIAgent } from '../ai/agent/CircuitAIAgent.js';
import { createKnowledgeProvider } from '../ai/resources/createKnowledgeProvider.js';
import { AILogService } from '../ai/AILogService.js';

export class AIPanel {
    constructor(app) {
        this.app = app;
        this.circuit = app.circuit;
        this.aiLogger = new AILogService();
        this.aiClient = new OpenAIClient();
        this.aiClient.setLogger(this.aiLogger);
        this.explainer = new CircuitExplainer(this.circuit);
        this.aiAgent = new CircuitAIAgent({
            aiClient: this.aiClient,
            explainer: this.explainer,
            circuit: this.circuit,
            logger: this.aiLogger
        });
        this.layoutStorageKey = 'ai_panel_layout';
        this.panelGesture = null;
        this.minPanelWidth = 320;
        this.minPanelHeight = 260;
        this.viewportPadding = 12;
        this.defaultRightOffset = 20;
        this.defaultBottomOffset = 16;
        this.collapsedPanelSize = 52;
        this.expandedPanelWidth = null;
        this.expandedPanelHeight = null;
        this.toggleBtn = null;
        this.fabBtn = null;
        this.suppressFabClickOnce = false;
        this.idleTimeoutMs = 9000;
        this.idleTimer = null;

        this.messageHistory = [];
        this.isProcessing = false;
        this.lastQuestion = '';
        this.chatAdvancedExpanded = false;
        this.markedConfigured = false;
        this.mathTypesetQueue = new Set();
        this.mathTypesetTimer = null;
        this.mathTypesetRetryCount = 0;
        this.mathTypesetRetryDelayMs = 200;
        this.mathTypesetMaxRetries = 30;
        
        this.initializeUI();
        this.loadSettings();
    }

    /**
     * 初始化 UI 事件
     */
    initializeUI() {
        this.panel = document.getElementById('ai-assistant-panel');
        this.panelHeader = document.getElementById('ai-panel-header');
        this.resizeHandle = document.getElementById('ai-resize-handle');
        this.toggleBtn = document.getElementById('ai-toggle-btn');
        this.fabBtn = document.getElementById('ai-fab-btn');

        // 折叠/展开
        if (this.toggleBtn && this.panel) {
            this.toggleBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.setPanelCollapsed(!this.isPanelCollapsed());
                this.markPanelActive();
            });
        }
        if (this.panelHeader) {
            this.panelHeader.addEventListener('dblclick', (event) => {
                if (event.target.closest('#ai-panel-actions')) return;
                event.preventDefault();
                this.setPanelCollapsed(!this.isPanelCollapsed());
                this.markPanelActive();
            });
        }
        if (this.fabBtn) {
            this.fabBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.suppressFabClickOnce) {
                    this.suppressFabClickOnce = false;
                    return;
                }
                this.setPanelCollapsed(false);
                this.markPanelActive();
            });
        }
        this.syncPanelCollapsedUI();

        // 设置按钮
        document.getElementById('ai-settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        // 聊天功能
        this.initializeChat();

        // 设置对话框
        this.initializeSettingsDialog();

        // 布局控制
        this.initializePanelLayoutControls();
        this.bindMathJaxLoadListener();
    }

    /**
     * 初始化聊天功能
     */
    initializeChat() {
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

        // 发送消息
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

        // 快速问题
        const quickBtns = document.querySelectorAll('.quick-question-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.textContent?.trim();
                if (!question || this.isProcessing) return;
                void runAskQuestionSafely(question);
            });
        });

        insertButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.insertChatTemplateByMode(input, btn?.dataset?.insert);
            });
        });

        // 默认隐藏快捷问题，减少视觉干扰
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

        followups.forEach(btn => {
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

    syncChatInputHeight(input) {
        if (!input || !input.style) return;
        const minHeight = 40;
        const maxHeight = 148;
        input.style.height = 'auto';
        const scrollHeight = Number(input.scrollHeight) || minHeight;
        const targetHeight = Math.min(maxHeight, Math.max(minHeight, scrollHeight));
        input.style.height = `${targetHeight}px`;
        input.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }

    insertChatTemplateByMode(input, mode) {
        if (!input) return;
        const currentValue = String(input.value || '');
        const start = Number.isFinite(Number(input.selectionStart)) ? Number(input.selectionStart) : currentValue.length;
        const end = Number.isFinite(Number(input.selectionEnd)) ? Number(input.selectionEnd) : start;
        const selected = currentValue.slice(start, end);

        const templates = {
            'inline-math': {
                prefix: '$',
                placeholder: selected || '公式',
                suffix: '$',
                block: false
            },
            'block-math': {
                prefix: '$$\n',
                placeholder: selected || '公式',
                suffix: '\n$$',
                block: true
            }
        };

        const template = templates[mode] || templates['inline-math'];
        const needsLeadingNewline = template.block && start > 0 && currentValue[start - 1] !== '\n';
        const insertPrefix = `${needsLeadingNewline ? '\n' : ''}${template.prefix}`;
        const insertedText = `${insertPrefix}${template.placeholder}${template.suffix}`;
        input.value = `${currentValue.slice(0, start)}${insertedText}${currentValue.slice(end)}`;

        const selectionStart = start + insertPrefix.length;
        const selectionEnd = selectionStart + template.placeholder.length;
        input.focus();
        if (typeof input.setSelectionRange === 'function') {
            input.setSelectionRange(selectionStart, selectionEnd);
        }
        this.syncChatInputHeight(input);
    }

    /**
     * 提问
     */
    async askQuestion(question) {
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

        // 添加用户消息（无论后续是否可求解，都保留对话上下文）
        this.addChatMessage('user', normalizedQuestion);
        this.lastQuestion = normalizedQuestion;

        // 检查电路是否为空
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

            // 添加加载提示
            loadingId = this.addChatMessage('assistant', '<div class="loading-indicator"><span></span><span></span><span></span></div>', { rawHtml: true });

            // 调用 Agent（自动注入电路快照 + 对话上下文）
            const answer = await this.aiAgent.answerQuestion({
                question: normalizedQuestion,
                history: historyContext,
                traceId
            });

            // 移除加载提示，添加回答
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

    /**
     * 触发跟进提问（继续/简化/小测验）
     */
    triggerFollowup(mode) {
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

    getAgentConversationContext(maxTurns = 4) {
        if (!Array.isArray(this.messageHistory) || this.messageHistory.length === 0) {
            return [];
        }
        const maxMessages = Math.max(1, maxTurns) * 2;
        return this.messageHistory
            .filter(message => message
                && (message.role === 'user' || message.role === 'assistant')
                && typeof message.content === 'string'
                && message.content.trim()
                && !message.content.includes('loading-indicator'))
            .slice(-maxMessages)
            .map(message => ({ role: message.role, content: message.content.trim() }));
    }

    ensureMarkedConfigured() {
        if (this.markedConfigured) return;
        if (typeof window === 'undefined') return;
        if (!window.marked || typeof window.marked.setOptions !== 'function') return;
        window.marked.setOptions({
            gfm: true,
            breaks: true,
            mangle: false,
            headerIds: false
        });
        this.markedConfigured = true;
    }

    isSafeLinkHref(href) {
        const text = String(href || '').trim();
        if (!text) return false;
        if (text.startsWith('#') || text.startsWith('/')) return true;
        try {
            const parsed = new URL(text, 'https://example.com');
            const protocol = String(parsed.protocol || '').toLowerCase();
            return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:';
        } catch (_) {
            return false;
        }
    }

    sanitizeRenderedMarkdown(html) {
        if (!html) return '';
        if (typeof document === 'undefined') {
            return this.escapeHtml(String(html));
        }
        const allowedTags = new Set([
            'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'a',
            'ul', 'ol', 'li', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'sup', 'sub'
        ]);
        const template = document.createElement('template');
        template.innerHTML = String(html);

        const sanitizeElement = (element) => {
            const tag = String(element.tagName || '').toLowerCase();
            if (!allowedTags.has(tag)) {
                const textNode = document.createTextNode(element.textContent || '');
                element.replaceWith(textNode);
                return false;
            }
            const attrs = Array.from(element.attributes || []);
            attrs.forEach((attr) => {
                const attrName = String(attr.name || '').toLowerCase();
                if (attrName.startsWith('on') || attrName === 'style') {
                    element.removeAttribute(attr.name);
                    return;
                }
                if (tag === 'a' && (attrName === 'href' || attrName === 'title')) return;
                if (tag === 'code' && attrName === 'class') {
                    const classValue = String(attr.value || '').trim();
                    if (/^language-[a-z0-9_-]+$/i.test(classValue)) return;
                }
                element.removeAttribute(attr.name);
            });
            if (tag === 'a') {
                const href = element.getAttribute('href');
                if (!this.isSafeLinkHref(href)) {
                    element.removeAttribute('href');
                }
                element.setAttribute('target', '_blank');
                element.setAttribute('rel', 'noopener noreferrer');
            }
            return true;
        };

        const walk = (node) => {
            let child = node.firstChild;
            while (child) {
                const next = child.nextSibling;
                if (child.nodeType === 1) {
                    const shouldTraverse = sanitizeElement(child);
                    if (shouldTraverse) {
                        walk(child);
                    }
                } else if (child.nodeType === 8) {
                    child.remove();
                }
                child = next;
            }
        };

        walk(template.content);
        return template.innerHTML;
    }

    bindMathJaxLoadListener() {
        if (typeof document === 'undefined') return;
        const script = document.getElementById('MathJax-script');
        if (!script || this.mathJaxLoadListenerBound) return;
        this.mathJaxLoadListenerBound = true;
        script.addEventListener('load', () => {
            this.flushMathTypesetQueue();
        });
    }

    scheduleMathTypesetFlush(delayMs = this.mathTypesetRetryDelayMs) {
        if (this.mathTypesetTimer) return;
        this.mathTypesetTimer = setTimeout(() => {
            this.mathTypesetTimer = null;
            this.flushMathTypesetQueue();
        }, Math.max(16, Number(delayMs) || this.mathTypesetRetryDelayMs));
    }

    queueMathTypeset(element) {
        if (!element) return;
        this.mathTypesetQueue.add(element);
        this.flushMathTypesetQueue();
    }

    flushMathTypesetQueue() {
        if (!this.mathTypesetQueue || this.mathTypesetQueue.size === 0) return;
        const mathJax = typeof window !== 'undefined' ? window.MathJax : null;
        if (!mathJax || typeof mathJax.typesetPromise !== 'function') {
            this.mathTypesetRetryCount += 1;
            if (this.mathTypesetRetryCount > this.mathTypesetMaxRetries) {
                this.logPanelEvent?.('warn', 'math_typeset_unavailable', {
                    pendingCount: this.mathTypesetQueue.size
                });
                this.mathTypesetQueue.clear();
                this.mathTypesetRetryCount = 0;
                return;
            }
            this.scheduleMathTypesetFlush();
            return;
        }

        const nodes = Array.from(this.mathTypesetQueue)
            .filter(node => node && node.isConnected !== false);
        this.mathTypesetQueue.clear();
        this.mathTypesetRetryCount = 0;
        if (!nodes.length) return;

        mathJax.typesetPromise(nodes).catch((error) => {
            this.logPanelEvent?.('warn', 'math_typeset_failed', {
                error: error?.message || String(error)
            });
        });
    }

    /**
     * 添加聊天消息
     */
    addChatMessage(role, content, options = {}) {
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

    escapeHtml(text) {
        if (text === undefined || text === null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    renderMarkdown(markdownText) {
        const text = markdownText || '';
        this.ensureMarkedConfigured();
        if (typeof window !== 'undefined' && window.marked?.parse) {
            try {
                const parsed = window.marked.parse(text, { breaks: true, gfm: true });
                return this.sanitizeRenderedMarkdown(parsed);
            } catch (_) {
                // fallback below
            }
        }

        // 轻量 fallback：仅处理粗体/斜体/代码/换行
        const escaped = this.escapeHtml(text);
        const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
        const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return withItalic.replace(/\n/g, '<br>');
    }

    /**
     * 移除聊天消息
     */
    removeChatMessage(messageId) {
        const messageEl = document.getElementById(messageId);
        if (messageEl) messageEl.remove();
        
        this.messageHistory = this.messageHistory.filter(m => m.id !== messageId);
        this.updateChatActionVisibility();
    }

    updateChatActionVisibility() {
        const followupActions = document.getElementById('followup-actions');
        const quickQuestions = document.getElementById('quick-questions');
        const chatControls = document.getElementById('chat-controls');
        const advancedToggleBtn = document.getElementById('chat-advanced-toggle-btn');
        const hasAssistantReply = Array.isArray(this.messageHistory)
            && this.messageHistory.some(message => message
                && message.role === 'assistant'
                && typeof message.content === 'string'
                && message.content.trim()
                && !message.content.includes('loading-indicator'));
        const hasConversation = Array.isArray(this.messageHistory)
            && this.messageHistory.some(message => message
                && (message.role === 'user' || message.role === 'assistant')
                && typeof message.content === 'string'
                && message.content.trim()
                && !message.content.includes('loading-indicator'));
        const hasArchivedHistory = (() => {
            if (typeof this.loadHistory !== 'function') return false;
            try {
                const history = this.loadHistory();
                return Array.isArray(history) && history.length > 0;
            } catch (_) {
                return false;
            }
        })();
        const hasAdvancedActions = hasAssistantReply || hasConversation || hasArchivedHistory;
        if (!hasAdvancedActions && this.chatAdvancedExpanded) {
            this.chatAdvancedExpanded = false;
        }
        const advancedOpen = !!this.chatAdvancedExpanded && hasAdvancedActions;
        if (followupActions) {
            followupActions.classList.toggle('visible', advancedOpen && hasAssistantReply);
        }
        if (quickQuestions) {
            quickQuestions.classList.toggle('visible', advancedOpen && !hasConversation);
        }
        if (chatControls) {
            chatControls.classList.toggle('visible', advancedOpen && (hasConversation || hasArchivedHistory));
        }
        if (advancedToggleBtn) {
            const showToggle = hasAdvancedActions;
            advancedToggleBtn.style.display = showToggle ? '' : 'none';
            advancedToggleBtn.setAttribute('aria-hidden', showToggle ? 'false' : 'true');
            advancedToggleBtn.setAttribute('aria-expanded', advancedOpen ? 'true' : 'false');
            advancedToggleBtn.textContent = advancedOpen ? '收起操作' : '更多操作';
        }
    }

    /**
     * 回撤上一轮问答（移除最后的 assistant + preceding user）
     */
    undoLastExchange() {
        if (this.isProcessing || this.messageHistory.length === 0) return;
        // 找到最后一个 assistant 消息
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

    /**
     * 开启新对话：归档当前对话，清空消息
     */
    startNewConversation() {
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

    /**
     * 将当前对话保存到 localStorage
     */
    archiveCurrentConversation() {
        const history = this.loadHistory();
        const title = this.messageHistory.find(m => m.role === 'user')?.content?.slice(0, 40) || '未命名会话';
        const record = {
            id: `history-${Date.now()}`,
            title,
            timestamp: Date.now(),
            messages: [...this.messageHistory]
        };
        history.unshift(record);
        // 保留最新的 20 条
        const trimmed = history.slice(0, 20);
        try {
            localStorage.setItem('ai_chat_history', JSON.stringify(trimmed));
        } catch (e) {
            console.warn('保存历史失败', e);
        }
    }

    loadHistory() {
        try {
            const raw = localStorage.getItem('ai_chat_history');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    refreshHistorySelect() {
        const historySelect = document.getElementById('chat-history-select');
        if (!historySelect) return;
        const history = this.loadHistory();
        const currentValue = historySelect.value;
        historySelect.innerHTML = '<option value=\"\">历史记录</option>';
        history.forEach(item => {
            const opt = document.createElement('option');
            const date = new Date(item.timestamp).toLocaleString();
            opt.value = item.id;
            opt.textContent = `${item.title} (${date})`;
            historySelect.appendChild(opt);
        });
        // 保持选择
        historySelect.value = currentValue || '';
    }

    loadConversationFromHistory(id) {
        const history = this.loadHistory();
        const record = history.find(h => h.id === id);
        if (!record) return;

        // 清空现有
        const messagesDiv = document.getElementById('chat-messages');
        messagesDiv.innerHTML = '';
        this.messageHistory = [];
        this.lastQuestion = '';

        // 重新渲染
        for (const msg of record.messages) {
            const opts = { markdown: msg.role === 'assistant' };
            this.addChatMessage(msg.role, msg.content, opts);
            if (msg.role === 'user') {
                this.lastQuestion = msg.content;
            }
        }
        this.updateChatActionVisibility();
    }

    /**
     * 初始化设置对话框
     */
    initializeSettingsDialog() {
        const dialog = document.getElementById('ai-settings-dialog');
        const saveBtn = document.getElementById('settings-save-btn');
        const cancelBtn = document.getElementById('settings-cancel-btn');
        const testBtn = document.getElementById('settings-test-btn');
        const clearKeyBtn = document.getElementById('settings-clear-key-btn');
        const fetchModelsBtn = document.getElementById('settings-fetch-models-btn');
        const fetchStatus = document.getElementById('model-fetch-status');
        const exportLogsBtn = document.getElementById('settings-export-logs-btn');
        const clearLogsBtn = document.getElementById('settings-clear-logs-btn');
        const textSelect = document.getElementById('text-model-select');
        const textInput = document.getElementById('text-model');
        const knowledgeSourceSelect = document.getElementById('knowledge-source');
        const knowledgeMcpModeSelect = document.getElementById('knowledge-mcp-mode');

        this.bindModelSelector(textSelect, textInput);
        if (knowledgeSourceSelect) {
            knowledgeSourceSelect.addEventListener('change', () => {
                this.syncKnowledgeSettingsVisibility(
                    knowledgeSourceSelect.value,
                    knowledgeMcpModeSelect?.value
                );
            });
        }
        if (knowledgeMcpModeSelect) {
            knowledgeMcpModeSelect.addEventListener('change', () => {
                this.syncKnowledgeSettingsVisibility(
                    knowledgeSourceSelect?.value,
                    knowledgeMcpModeSelect.value
                );
            });
        }

        cancelBtn.addEventListener('click', () => {
            dialog.classList.add('hidden');
        });

        saveBtn.addEventListener('click', () => {
            this.saveSettings();
            dialog.classList.add('hidden');
        });

        testBtn.addEventListener('click', async () => {
            // 先保存当前设置
            this.saveSettings();
            
            testBtn.disabled = true;
            testBtn.textContent = '测试中...';
            
            try {
                const result = await this.aiClient.testConnection();
                alert(result.success ? '✅ ' + result.message : '❌ ' + result.message);
            } catch (error) {
                alert('❌ 测试失败: ' + error.message);
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = '测试连接';
            }
        });

        clearKeyBtn.addEventListener('click', () => {
            this.aiClient.clearApiKey();
            document.getElementById('api-key').value = '';
            this.app.updateStatus('API 密钥已清除（仅会话存储）');
            this.logPanelEvent?.('warn', 'api_key_cleared');
        });

        fetchModelsBtn.addEventListener('click', async () => {
            if (this.isProcessing) return;
            fetchStatus.textContent = '正在获取模型列表...';
            fetchModelsBtn.disabled = true;
            try {
                // 先保存当前设置，确保使用最新端点/密钥
                this.saveSettings();
                this.isProcessing = true;
                const models = await this.aiClient.listModels();
                this.populateModelLists(models);
                fetchStatus.textContent = `已加载 ${models.length} 个模型`;
                this.logPanelEvent?.('info', 'fetch_models_success', { count: models.length });
            } catch (e) {
                console.error(e);
                fetchStatus.textContent = `获取失败: ${e.message}`;
                this.logPanelEvent?.('error', 'fetch_models_failed', { error: e.message });
            } finally {
                this.isProcessing = false;
                fetchModelsBtn.disabled = false;
                this.updateLogSummaryDisplay?.();
            }
        });

        if (exportLogsBtn) {
            exportLogsBtn.addEventListener('click', () => {
                this.exportAILogs();
            });
        }
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearAILogs();
            });
        }
        this.updateLogSummaryDisplay?.();
    }

    /**
     * 打开设置
     */
    openSettings() {
        const config = this.aiClient.config;
        
        document.getElementById('api-endpoint').value = config.apiEndpoint;
        document.getElementById('api-key').value = config.apiKey;
        document.getElementById('text-model').value = config.textModel;
        const knowledgeSource = document.getElementById('knowledge-source');
        const knowledgeMcpEndpoint = document.getElementById('knowledge-mcp-endpoint');
        const knowledgeMcpServer = document.getElementById('knowledge-mcp-server');
        const knowledgeMcpMode = document.getElementById('knowledge-mcp-mode');
        const knowledgeMcpMethod = document.getElementById('knowledge-mcp-method');
        const knowledgeMcpResource = document.getElementById('knowledge-mcp-resource');
        if (knowledgeSource) {
            knowledgeSource.value = config.knowledgeSource || 'local';
        }
        if (knowledgeMcpMode) {
            knowledgeMcpMode.value = config.knowledgeMcpMode || 'method';
        }
        if (knowledgeMcpEndpoint) {
            knowledgeMcpEndpoint.value = config.knowledgeMcpEndpoint || '';
        }
        if (knowledgeMcpServer) {
            knowledgeMcpServer.value = config.knowledgeMcpServer || 'circuit-knowledge';
        }
        if (knowledgeMcpMethod) {
            knowledgeMcpMethod.value = config.knowledgeMcpMethod || 'knowledge.search';
        }
        if (knowledgeMcpResource) {
            knowledgeMcpResource.value = config.knowledgeMcpResource || 'knowledge://circuit/high-school';
        }
        this.syncKnowledgeSettingsVisibility(
            knowledgeSource?.value || config.knowledgeSource || 'local',
            knowledgeMcpMode?.value || config.knowledgeMcpMode || 'method'
        );
        this.syncSelectToValue(document.getElementById('text-model-select'), config.textModel);
        this.updateKnowledgeVersionDisplay();
        this.updateLogSummaryDisplay?.();
        
        document.getElementById('ai-settings-dialog').classList.remove('hidden');
    }

    /**
     * 保存设置
     */
    saveSettings() {
        const knowledgeSource = document.getElementById('knowledge-source');
        const knowledgeMcpEndpoint = document.getElementById('knowledge-mcp-endpoint');
        const knowledgeMcpServer = document.getElementById('knowledge-mcp-server');
        const knowledgeMcpMode = document.getElementById('knowledge-mcp-mode');
        const knowledgeMcpMethod = document.getElementById('knowledge-mcp-method');
        const knowledgeMcpResource = document.getElementById('knowledge-mcp-resource');
        const config = {
            apiEndpoint: document.getElementById('api-endpoint').value.trim(),
            apiKey: document.getElementById('api-key').value.trim(),
            textModel: document.getElementById('text-model').value.trim(),
            knowledgeSource: knowledgeSource?.value || 'local',
            knowledgeMcpEndpoint: knowledgeMcpEndpoint?.value?.trim?.() || '',
            knowledgeMcpServer: knowledgeMcpServer?.value?.trim?.() || 'circuit-knowledge',
            knowledgeMcpMode: knowledgeMcpMode?.value || 'method',
            knowledgeMcpMethod: knowledgeMcpMethod?.value?.trim?.() || 'knowledge.search',
            knowledgeMcpResource: knowledgeMcpResource?.value?.trim?.() || 'knowledge://circuit/high-school'
        };
        
        this.aiClient.saveConfig(config);
        this.refreshKnowledgeProvider();
        const keyMsg = config.apiKey ? '（密钥仅保存在当前会话）' : '';
        const sourceText = config.knowledgeSource === 'mcp'
            ? `MCP(${config.knowledgeMcpMode === 'resource' ? 'resource' : 'method'})`
            : '本地';
        this.logPanelEvent?.('info', 'settings_saved', {
            endpoint: config.apiEndpoint,
            textModel: config.textModel,
            knowledgeSource: config.knowledgeSource,
            knowledgeMode: config.knowledgeMcpMode
        });
        this.updateLogSummaryDisplay?.();
        this.app.updateStatus(`AI 设置已保存${keyMsg}，规则库来源：${sourceText}`);
    }

    /**
     * 加载设置
     */
    loadSettings() {
        this.refreshKnowledgeProvider();
        this.updateKnowledgeVersionDisplay();
        this.logPanelEvent?.('info', 'settings_loaded', {
            endpoint: this.aiClient.config?.apiEndpoint || '',
            knowledgeSource: this.aiClient.config?.knowledgeSource || 'local'
        });
    }

    refreshKnowledgeProvider() {
        const provider = createKnowledgeProvider(this.aiClient.config || {});
        this.aiAgent.setKnowledgeProvider(provider);
        this.logPanelEvent?.('info', 'knowledge_provider_refreshed', {
            source: this.aiClient.config?.knowledgeSource || 'local',
            mode: this.aiClient.config?.knowledgeMcpMode || 'method'
        });
        this.updateKnowledgeVersionDisplay();
    }

    syncKnowledgeSettingsVisibility(source, mode = null) {
        const modeRow = document.getElementById('knowledge-mcp-mode-row');
        const endpointRow = document.getElementById('knowledge-mcp-endpoint-row');
        const methodRow = document.getElementById('knowledge-mcp-method-row');
        const resourceRow = document.getElementById('knowledge-mcp-resource-row');
        const modeSelect = document.getElementById('knowledge-mcp-mode');
        if (!endpointRow) return;
        const useMcp = String(source || '').trim().toLowerCase() === 'mcp';
        const normalizedMode = String(mode || modeSelect?.value || 'method').trim().toLowerCase() === 'resource'
            ? 'resource'
            : 'method';
        if (modeSelect) modeSelect.value = normalizedMode;
        if (modeRow) modeRow.style.display = useMcp ? '' : 'none';
        endpointRow.style.display = useMcp ? '' : 'none';
        if (methodRow) methodRow.style.display = useMcp && normalizedMode === 'method' ? '' : 'none';
        if (resourceRow) resourceRow.style.display = useMcp && normalizedMode === 'resource' ? '' : 'none';
    }

    formatKnowledgeVersionLabel(metadata = {}) {
        const source = metadata.source || 'unknown';
        const version = metadata.version || 'unknown';
        if (source === 'local') return `规则库版本: ${version}（本地）`;
        if (source === 'mcp') return `规则库版本: ${version}（MCP）`;
        if (source === 'mcp-fallback-local') return `规则库版本: ${version}（MCP降级本地）`;
        return `规则库版本: ${version}`;
    }

    updateKnowledgeVersionDisplay() {
        const metadata = this.aiAgent?.getKnowledgeMetadata?.() || {};
        const label = this.formatKnowledgeVersionLabel(metadata);
        const detail = metadata.detail ? ` | ${metadata.detail}` : '';
        const hasStats = Number.isFinite(Number(metadata.knowledgeRequests)) && Number(metadata.knowledgeRequests) > 0;
        const stats = hasStats
            ? ` | 缓存命中率 ${(Number(metadata.cacheHitRate || 0) * 100).toFixed(0)}% (${Number(metadata.cacheHits || 0)}/${Number(metadata.knowledgeRequests || 0)})`
            : '';
        const badgeEl = document.getElementById('knowledge-version-badge');
        if (badgeEl) {
            badgeEl.textContent = label;
            badgeEl.title = `${label}${detail}${stats}`;
        }
        const hintEl = document.getElementById('knowledge-source-version');
        if (hintEl) {
            hintEl.textContent = `${label}${detail}${stats}`;
        }
    }

    logPanelEvent(level, stage, data = null, traceId = '') {
        if (!this.aiLogger || typeof this.aiLogger.log !== 'function') return;
        this.aiLogger.log({
            level,
            source: 'ai_panel',
            stage,
            traceId,
            message: stage,
            data
        });
    }

    updateLogSummaryDisplay() {
        const summaryEl = document.getElementById('settings-log-summary');
        if (!summaryEl || !this.aiLogger) return;
        const summary = this.aiLogger.getSummary();
        const lastTime = summary.lastTimestamp
            ? new Date(summary.lastTimestamp).toLocaleString()
            : '--';
        const lastErrorText = summary.lastError
            ? `最近错误: ${summary.lastError.source}/${summary.lastError.stage} - ${summary.lastError.message || 'unknown'}`
            : '最近错误: 无';
        summaryEl.textContent = `日志: ${summary.total} 条 | 错误 ${summary.errorCount} | 警告 ${summary.warnCount} | 最近更新 ${lastTime} | ${lastErrorText}`;
    }

    exportAILogs() {
        if (!this.aiLogger) return;
        const payload = this.aiLogger.exportPayload(3000);
        const fileName = `ai-runtime-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        try {
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            this.logPanelEvent?.('info', 'export_logs', {
                entries: Array.isArray(payload.entries) ? payload.entries.length : 0,
                fileName
            });
            this.app.updateStatus('AI 运行日志已导出');
        } catch (error) {
            this.logPanelEvent?.('error', 'export_logs_failed', {
                error: error?.message || String(error)
            });
            this.app.updateStatus(`AI 日志导出失败: ${error.message}`);
        } finally {
            this.updateLogSummaryDisplay?.();
        }
    }

    clearAILogs() {
        if (!this.aiLogger) return;
        const allowed = typeof window?.confirm === 'function'
            ? window.confirm('确定清空 AI 运行日志吗？此操作不可恢复。')
            : true;
        if (!allowed) return;
        this.aiLogger.clear();
        this.logPanelEvent?.('warn', 'logs_cleared');
        this.updateLogSummaryDisplay?.();
        this.app.updateStatus('AI 运行日志已清空');
    }

    bindModelSelector(selectEl, inputEl) {
        if (!selectEl || !inputEl) return;
        selectEl.addEventListener('change', () => {
            if (selectEl.value) {
                inputEl.value = selectEl.value;
            }
        });
    }

    fillSelectOptions(selectEl, options = [], currentValue = '') {
        if (!selectEl) return;
        const current = currentValue?.trim();
        selectEl.innerHTML = '<option value=\"\">从列表选择</option>';
        options.forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            selectEl.appendChild(opt);
        });
        // 保留当前值，即便它不在新列表中
        if (current && !options.includes(current)) {
            const customOpt = document.createElement('option');
            customOpt.value = current;
            customOpt.textContent = `${current} (自定义)`;
            selectEl.appendChild(customOpt);
        }
    }

    syncSelectToValue(selectEl, value) {
        if (!selectEl) return;
        const val = value?.trim() || '';
        const hasOption = Array.from(selectEl.options).some(opt => opt.value === val);
        if (!hasOption && val) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = `${val} (自定义)`;
            selectEl.appendChild(opt);
        }
        selectEl.value = val;
    }

    populateModelLists(models = []) {
        const textList = document.getElementById('model-list-text');
        const textSelect = document.getElementById('text-model-select');
        const textInput = document.getElementById('text-model');
        if (!textList) return;

        const toOption = (id) => {
            const opt = document.createElement('option');
            opt.value = id;
            return opt;
        };

        const textModels = [...new Set(models.map(id => String(id || '').trim()).filter(Boolean))];

        textList.innerHTML = '';
        textModels.forEach(id => textList.appendChild(toOption(id)));

        if (textSelect) {
            this.fillSelectOptions(textSelect, textModels, textInput?.value);
        }

        if (textSelect && textInput) {
            this.syncSelectToValue(textSelect, textInput.value.trim());
        }
    }

    /**
     * 保存电路到 localStorage
     */
    saveCircuitToLocalStorage(circuitJSON) {
        try {
            // Prefer app-level serializer so extra UI state (e.g. 习题板) can be persisted together.
            const payload = this.app?.buildSaveData ? this.app.buildSaveData() : circuitJSON;
            localStorage.setItem('saved_circuit', JSON.stringify(payload));
        } catch (e) {
            console.error('Failed to save circuit:', e);
        }
    }

    /**
     * 从 localStorage 加载电路
     */
    loadCircuitFromLocalStorage() {
        try {
            const saved = localStorage.getItem('saved_circuit');
            if (saved) {
                const circuitJSON = JSON.parse(saved);
                this.circuit.fromJSON(circuitJSON);
                this.app.renderer.render();
                this.app.exerciseBoard?.fromJSON?.(circuitJSON.meta?.exerciseBoard);
                this.app.updateStatus('已从缓存恢复电路');
                return true;
            }
        } catch (e) {
            console.error('Failed to load circuit:', e);
        }
        return false;
    }

    /**
     * 初始化 AI 面板的拖拽和缩放
     */
    initializePanelLayoutControls() {
        if (!this.panel) return;

        this.boundPanelPointerMove = (event) => this.handlePanelPointerMove(event);
        this.boundPanelPointerUp = (event) => this.handlePanelPointerUp(event);

        this.restorePanelLayout();

        if (this.panelHeader) {
            this.panelHeader.addEventListener('pointerdown', (e) => this.tryStartPanelDrag(e));
        }

        if (this.panel) {
            this.panel.addEventListener('pointerdown', (e) => this.tryStartCollapsedPanelDrag(e));
        }

        if (this.resizeHandle) {
            this.resizeHandle.addEventListener('pointerdown', (e) => this.tryStartPanelResize(e));
        }

        window.addEventListener('resize', () => this.constrainPanelToViewport());
        this.initializeIdleBehavior();
    }

    tryStartPanelDrag(event) {
        if (!this.panel) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('#ai-panel-actions')) return;

        event.preventDefault();
        this.startPanelGesture('drag', event);
    }

    tryStartCollapsedPanelDrag(event) {
        if (!this.panel || !this.isPanelCollapsed()) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (!event.target.closest('#ai-fab-btn')) return;
        event.preventDefault();
        event.stopPropagation();
        this.startPanelGesture('drag', event);
    }

    tryStartPanelResize(event) {
        if (!this.panel || this.panel.classList.contains('collapsed')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        this.startPanelGesture('resize', event);
    }

    startPanelGesture(type, event) {
        const rect = this.panel.getBoundingClientRect();
        const styleLeft = parseFloat(this.panel.style.left);
        const styleTop = parseFloat(this.panel.style.top);
        const startLeft = Number.isFinite(styleLeft) ? styleLeft : rect.left;
        const startTop = Number.isFinite(styleTop) ? styleTop : rect.top;
        this.setPanelAbsolutePosition(startLeft, startTop);
        this.suppressFabClickOnce = false;

        this.panelGesture = {
            type,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft,
            startTop,
            startWidth: rect.width,
            startHeight: rect.height,
            moved: false
        };

        this.panel.classList.add(type === 'drag' ? 'dragging' : 'resizing');
        window.addEventListener('pointermove', this.boundPanelPointerMove);
        window.addEventListener('pointerup', this.boundPanelPointerUp);
        window.addEventListener('pointercancel', this.boundPanelPointerUp);
        this.markPanelActive();
    }

    handlePanelPointerMove(event) {
        if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;

        event.preventDefault();
        this.markPanelActive();
        if (this.panelGesture.type === 'drag') {
            this.updatePanelDrag(event);
        } else {
            this.updatePanelResize(event);
        }
    }

    handlePanelPointerUp(event) {
        if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;
        const endedGestureType = this.panelGesture.type;
        const moved = !!this.panelGesture.moved;

        window.removeEventListener('pointermove', this.boundPanelPointerMove);
        window.removeEventListener('pointerup', this.boundPanelPointerUp);
        window.removeEventListener('pointercancel', this.boundPanelPointerUp);
        this.panel.classList.remove('dragging', 'resizing');
        this.panelGesture = null;
        if (endedGestureType === 'resize' && !this.isPanelCollapsed()) {
            this.rememberExpandedPanelSize();
        }
        if (endedGestureType === 'drag' && moved && this.isPanelCollapsed()) {
            this.suppressFabClickOnce = true;
        }
        this.markPanelActive();
        this.savePanelLayout();
    }

    updatePanelDrag(event) {
        if (!this.panelGesture) return;

        const { startX, startY, startLeft, startTop, startWidth, startHeight } = this.panelGesture;
        const bounds = this.getPanelBounds();
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const maxLeft = Math.max(bounds.minX, bounds.maxX - startWidth);
        const maxTop = Math.max(bounds.minY, bounds.maxY - startHeight);
        const nextLeft = this.clamp(startLeft + dx, bounds.minX, maxLeft);
        const nextTop = this.clamp(startTop + dy, bounds.minY, maxTop);
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            this.panelGesture.moved = true;
        }

        this.setPanelAbsolutePosition(nextLeft, nextTop);
    }

    updatePanelResize(event) {
        if (!this.panelGesture) return;

        const { startX, startY, startWidth, startHeight, startLeft, startTop } = this.panelGesture;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const bounds = this.getPanelBounds();

        const availableWidth = Math.max(bounds.maxX - startLeft, 0);
        const availableHeight = Math.max(bounds.maxY - startTop, 0);
        const minWidth = Math.min(this.minPanelWidth, availableWidth || this.minPanelWidth);
        const minHeight = Math.min(this.minPanelHeight, availableHeight || this.minPanelHeight);
        const maxWidth = availableWidth || this.minPanelWidth;
        const maxHeight = availableHeight || this.minPanelHeight;

        const nextWidth = this.clamp(startWidth + dx, minWidth, Math.max(minWidth, maxWidth));
        const nextHeight = this.clamp(startHeight + dy, minHeight, Math.max(minHeight, maxHeight));

        this.panel.style.width = `${nextWidth}px`;
        this.panel.style.height = `${nextHeight}px`;
        this.expandedPanelWidth = nextWidth;
        this.expandedPanelHeight = nextHeight;
    }

    setPanelAbsolutePosition(left, top) {
        if (!this.panel) return;
        this.panel.style.left = `${left}px`;
        this.panel.style.top = `${top}px`;
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
    }

    getPanelBounds() {
        const padding = this.viewportPadding;
        return {
            minX: padding,
            minY: padding,
            maxX: window.innerWidth - padding,
            maxY: window.innerHeight - padding
        };
    }

    initializeIdleBehavior() {
        if (!this.panel || typeof window === 'undefined') return;
        const activate = () => this.markPanelActive();
        this.panel.addEventListener('pointerdown', activate);
        this.panel.addEventListener('pointermove', activate);
        this.panel.addEventListener('keydown', activate);
        this.panel.addEventListener('focusin', activate);
        window.addEventListener('pointermove', activate);
        window.addEventListener('keydown', activate);
        window.addEventListener('wheel', activate, { passive: true });
        window.addEventListener('touchstart', activate, { passive: true });
        this.markPanelActive();
    }

    markPanelActive() {
        if (!this.panel) return;
        this.panel.classList.remove('idle');
        if (this.idleTimer) {
            window.clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        this.idleTimer = window.setTimeout(() => {
            this.panel?.classList.add('idle');
        }, this.idleTimeoutMs);
    }

    clamp(value, min, max) {
        if (Number.isNaN(value)) return min;
        if (max < min) max = min;
        return Math.min(Math.max(value, min), max);
    }

    isPanelCollapsed() {
        return !!(this.panel && this.panel.classList.contains('collapsed'));
    }

    getCollapsedPanelSize() {
        return Math.max(40, Number(this.collapsedPanelSize) || 52);
    }

    getCollapsedPanelWidth() {
        return this.getCollapsedPanelSize();
    }

    getCollapsedPanelHeight() {
        return this.getCollapsedPanelSize();
    }

    rememberExpandedPanelSize() {
        if (!this.panel || this.isPanelCollapsed()) return;
        const styleWidth = parseFloat(this.panel.style.width);
        const styleHeight = parseFloat(this.panel.style.height);
        const rectWidth = this.panel.getBoundingClientRect().width;
        const rectHeight = this.panel.getBoundingClientRect().height;
        const nextWidth = Number.isFinite(styleWidth) ? styleWidth : rectWidth;
        const nextHeight = Number.isFinite(styleHeight) ? styleHeight : rectHeight;
        if (Number.isFinite(nextWidth) && nextWidth > this.getCollapsedPanelWidth()) {
            this.expandedPanelWidth = nextWidth;
        }
        if (Number.isFinite(nextHeight) && nextHeight > this.getCollapsedPanelHeight()) {
            this.expandedPanelHeight = nextHeight;
        }
    }

    syncPanelCollapsedUI() {
        const collapsed = this.isPanelCollapsed();
        if (this.toggleBtn) {
            this.toggleBtn.textContent = collapsed ? '展开' : '最小化';
            this.toggleBtn.title = collapsed ? '展开面板' : '最小化面板';
            if (typeof this.toggleBtn.setAttribute === 'function') {
                this.toggleBtn.setAttribute('aria-label', this.toggleBtn.title);
                this.toggleBtn.setAttribute('aria-expanded', String(!collapsed));
            }
        }
        if (this.fabBtn && typeof this.fabBtn.setAttribute === 'function') {
            this.fabBtn.setAttribute('aria-hidden', String(!collapsed));
            this.fabBtn.setAttribute('title', collapsed ? '展开 AI 助手' : 'AI 助手');
        }
    }

    setPanelCollapsed(collapsed, options = {}) {
        if (!this.panel) return;
        const { persist = true, constrain = true } = options;
        const shouldCollapse = !!collapsed;
        const currentlyCollapsed = this.isPanelCollapsed();

        if (shouldCollapse === currentlyCollapsed) {
            this.syncPanelCollapsedUI();
            if (persist) this.savePanelLayout();
            return;
        }

        if (shouldCollapse) {
            this.rememberExpandedPanelSize();
            this.panel.classList.add('collapsed');
            this.panel.style.width = `${this.getCollapsedPanelWidth()}px`;
            this.panel.style.height = `${this.getCollapsedPanelHeight()}px`;
        } else {
            this.panel.classList.remove('collapsed');
            const bounds = this.getPanelBounds();
            const availableWidth = Math.max(bounds.maxX - bounds.minX, 0);
            const availableHeight = Math.max(bounds.maxY - bounds.minY, 0);
            const restoredWidth = this.clamp(
                this.expandedPanelWidth || 420,
                availableWidth ? Math.min(this.minPanelWidth, availableWidth) : this.minPanelWidth,
                availableWidth || this.minPanelWidth
            );
            const restoredHeight = this.clamp(
                this.expandedPanelHeight || 420,
                availableHeight ? Math.min(this.minPanelHeight, availableHeight) : this.minPanelHeight,
                availableHeight || this.minPanelHeight
            );
            this.panel.style.width = `${restoredWidth}px`;
            this.panel.style.height = `${restoredHeight}px`;
            this.expandedPanelWidth = restoredWidth;
            this.expandedPanelHeight = restoredHeight;
        }

        this.syncPanelCollapsedUI();
        this.markPanelActive();
        if (constrain) {
            this.constrainPanelToViewport();
        } else if (persist) {
            this.savePanelLayout();
        }
    }

    restorePanelLayout() {
        const saved = this.getSavedPanelLayout();
        const layout = saved || this.getDefaultPanelLayout();
        this.applyPanelLayout(layout);
    }

    applyPanelLayout(layout) {
        if (!this.panel) return;

        const bounds = this.getPanelBounds();
        const availableWidth = Math.max(bounds.maxX - bounds.minX, 0);
        const availableHeight = Math.max(bounds.maxY - bounds.minY, 0);
        const currentCollapsed = this.isPanelCollapsed();
        const shouldCollapse = typeof layout.collapsed === 'boolean' ? layout.collapsed : currentCollapsed;
        const measuredWidth = this.panel.offsetWidth || 420;
        const measuredHeight = this.panel.offsetHeight || 420;
        const baseExpandedWidth = Number.isFinite(this.expandedPanelWidth)
            ? this.expandedPanelWidth
            : (currentCollapsed ? 420 : measuredWidth);
        const baseExpandedHeight = Number.isFinite(this.expandedPanelHeight)
            ? this.expandedPanelHeight
            : (currentCollapsed ? 420 : measuredHeight);

        const expandedWidth = this.clamp(
            typeof layout.expandedWidth === 'number'
                ? layout.expandedWidth
                : (typeof layout.width === 'number' ? layout.width : baseExpandedWidth),
            availableWidth ? Math.min(this.minPanelWidth, availableWidth) : this.minPanelWidth,
            availableWidth || this.minPanelWidth
        );

        const expandedHeight = this.clamp(
            typeof layout.expandedHeight === 'number'
                ? layout.expandedHeight
                : (typeof layout.height === 'number' ? layout.height : baseExpandedHeight),
            availableHeight ? Math.min(this.minPanelHeight, availableHeight) : this.minPanelHeight,
            availableHeight || this.minPanelHeight
        );

        this.expandedPanelWidth = expandedWidth;
        this.expandedPanelHeight = expandedHeight;

        const effectiveWidth = shouldCollapse ? this.getCollapsedPanelWidth() : expandedWidth;
        const effectiveHeight = shouldCollapse ? this.getCollapsedPanelHeight() : expandedHeight;
        const maxLeft = Math.max(bounds.minX, bounds.maxX - effectiveWidth);
        const maxTop = Math.max(bounds.minY, bounds.maxY - effectiveHeight);
        const left = this.clamp(
            typeof layout.left === 'number' ? layout.left : (bounds.maxX - effectiveWidth - this.defaultRightOffset),
            bounds.minX,
            maxLeft
        );
        const top = this.clamp(
            typeof layout.top === 'number' ? layout.top : (bounds.maxY - effectiveHeight - this.defaultBottomOffset),
            bounds.minY,
            maxTop
        );

        this.panel.classList.toggle('collapsed', shouldCollapse);
        this.panel.style.width = `${effectiveWidth}px`;
        this.panel.style.height = `${effectiveHeight}px`;
        this.setPanelAbsolutePosition(left, top);

        this.syncPanelCollapsedUI();
    }

    getSavedPanelLayout() {
        try {
            const raw = localStorage.getItem(this.layoutStorageKey);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const keys = ['left', 'top', 'width', 'height'];
            if (keys.every(key => typeof data[key] === 'number' && !Number.isNaN(data[key]))) {
                return {
                    left: data.left,
                    top: data.top,
                    width: data.width,
                    height: data.height,
                    expandedWidth: typeof data.expandedWidth === 'number' && !Number.isNaN(data.expandedWidth)
                        ? data.expandedWidth
                        : (typeof data.width === 'number' ? data.width : undefined),
                    expandedHeight: typeof data.expandedHeight === 'number' && !Number.isNaN(data.expandedHeight)
                        ? data.expandedHeight
                        : undefined,
                    collapsed: typeof data.collapsed === 'boolean' ? data.collapsed : undefined
                };
            }
        } catch (error) {
            console.warn('Failed to load AI panel layout:', error);
        }
        return null;
    }

    savePanelLayout() {
        if (!this.panel) return;
        try {
            const rect = this.panel.getBoundingClientRect();
            const styleLeft = parseFloat(this.panel.style.left);
            const styleTop = parseFloat(this.panel.style.top);
            const styleWidth = parseFloat(this.panel.style.width);
            const styleHeight = parseFloat(this.panel.style.height);
            if (!this.isPanelCollapsed()) {
                this.rememberExpandedPanelSize();
            }
            const expandedWidth = Number.isFinite(this.expandedPanelWidth)
                ? this.expandedPanelWidth
                : (Number.isFinite(styleWidth) ? styleWidth : rect.width);
            const expandedHeight = Number.isFinite(this.expandedPanelHeight)
                ? this.expandedPanelHeight
                : (Number.isFinite(styleHeight) ? styleHeight : rect.height);
            const payload = {
                left: Number.isFinite(styleLeft) ? styleLeft : rect.left,
                top: Number.isFinite(styleTop) ? styleTop : rect.top,
                width: Number.isFinite(styleWidth) ? styleWidth : rect.width,
                height: Number.isFinite(styleHeight) ? styleHeight : rect.height,
                expandedWidth,
                expandedHeight,
                collapsed: this.isPanelCollapsed()
            };
            localStorage.setItem(this.layoutStorageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save AI panel layout:', error);
        }
    }

    getDefaultPanelLayout() {
        const measuredWidth = this.panel?.offsetWidth || 420;
        const measuredHeight = this.panel?.offsetHeight || 420;
        const width = Number.isFinite(this.expandedPanelWidth)
            ? this.expandedPanelWidth
            : (this.isPanelCollapsed() ? 420 : measuredWidth);
        const isCollapsed = this.isPanelCollapsed();
        const expandedHeight = Number.isFinite(this.expandedPanelHeight)
            ? this.expandedPanelHeight
            : (isCollapsed ? 420 : measuredHeight);
        const widthForPosition = isCollapsed ? this.getCollapsedPanelWidth() : width;
        const heightForPosition = isCollapsed ? this.getCollapsedPanelHeight() : expandedHeight;
        let reservedRight = 0;
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) {
            const rect = sidePanel.getBoundingClientRect();
            if (rect.width > 0) {
                reservedRight = rect.width + 12;
            }
        }
        const left = Math.max(this.viewportPadding, window.innerWidth - widthForPosition - this.defaultRightOffset - reservedRight);
        const top = Math.max(this.viewportPadding, window.innerHeight - heightForPosition - this.defaultBottomOffset);
        return { left, top, width, height: expandedHeight, expandedWidth: width, expandedHeight, collapsed: isCollapsed };
    }

    constrainPanelToViewport() {
        if (!this.panel) return;
        const rect = this.panel.getBoundingClientRect();
        const styleLeft = parseFloat(this.panel.style.left);
        const styleTop = parseFloat(this.panel.style.top);
        const styleWidth = parseFloat(this.panel.style.width);
        const styleHeight = parseFloat(this.panel.style.height);
        const collapsed = this.isPanelCollapsed();
        if (!collapsed) {
            this.rememberExpandedPanelSize();
        }
        const measuredExpandedWidth = Number.isFinite(this.expandedPanelWidth)
            ? this.expandedPanelWidth
            : (Number.isFinite(styleWidth) ? styleWidth : rect.width);
        const measuredExpandedHeight = Number.isFinite(this.expandedPanelHeight)
            ? this.expandedPanelHeight
            : (Number.isFinite(styleHeight) ? styleHeight : rect.height);
        this.applyPanelLayout({
            left: Number.isFinite(styleLeft) ? styleLeft : rect.left,
            top: Number.isFinite(styleTop) ? styleTop : rect.top,
            width: measuredExpandedWidth,
            height: measuredExpandedHeight,
            expandedWidth: measuredExpandedWidth,
            expandedHeight: measuredExpandedHeight,
            collapsed
        });
        this.savePanelLayout();
    }

}
