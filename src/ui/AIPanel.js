/**
 * AIPanel.js - AI助手面板控制器
 */

import { OpenAIClient } from '../ai/OpenAIClient.js';
import { CircuitExplainer } from '../ai/CircuitExplainer.js';
import { CircuitAIAgent } from '../ai/agent/CircuitAIAgent.js';
import { AILogService } from '../ai/AILogService.js';
import { ChatController } from './ai/ChatController.js';
import { SettingsController } from './ai/SettingsController.js';
import { PanelLayoutController } from './ai/PanelLayoutController.js';

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
        const controllerDeps = {
            panel: this,
            app: this.app,
            circuit: this.circuit
        };
        this.chatController = new ChatController(controllerDeps);
        this.settingsController = new SettingsController(controllerDeps);
        this.layoutController = new PanelLayoutController(controllerDeps);
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
        getOrCreateChatController(this).initializeChat();
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

    ensureChatController() {
        return getOrCreateChatController(this);
    }

    /**
     * 提问
     */
    askQuestion(question) {
        return getOrCreateChatController(this).askQuestion(question);
    }

    /**
     * 触发跟进提问（继续/简化/小测验）
     */
    triggerFollowup(mode) {
        return getOrCreateChatController(this).triggerFollowup(mode);
    }

    getAgentConversationContext(maxTurns = 4) {
        return getOrCreateChatController(this).getAgentConversationContext(maxTurns);
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
        return getOrCreateChatController(this).addChatMessage(role, content, options);
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
        return getOrCreateChatController(this).removeChatMessage(messageId);
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
        return getOrCreateChatController(this).undoLastExchange();
    }

    /**
     * 开启新对话：归档当前对话，清空消息
     */
    startNewConversation() {
        return getOrCreateChatController(this).startNewConversation();
    }

    /**
     * 将当前对话保存到 localStorage
     */
    archiveCurrentConversation() {
        return getOrCreateChatController(this).archiveCurrentConversation();
    }

    loadHistory() {
        return getOrCreateChatController(this).loadHistory();
    }

    refreshHistorySelect() {
        return getOrCreateChatController(this).refreshHistorySelect();
    }

    loadConversationFromHistory(id) {
        return getOrCreateChatController(this).loadConversationFromHistory(id);
    }

    /**
     * 初始化设置对话框
     */
    initializeSettingsDialog() {
        return getOrCreateSettingsController(this).initializeSettingsDialog();
    }

    /**
     * 打开设置
     */
    openSettings() {
        return getOrCreateSettingsController(this).openSettings();
    }

    /**
     * 保存设置
     */
    saveSettings() {
        return getOrCreateSettingsController(this).saveSettings();
    }

    /**
     * 加载设置
     */
    loadSettings() {
        return getOrCreateSettingsController(this).loadSettings();
    }

    refreshKnowledgeProvider() {
        return getOrCreateSettingsController(this).refreshKnowledgeProvider();
    }

    syncKnowledgeSettingsVisibility(source, mode = null) {
        return getOrCreateSettingsController(this).syncKnowledgeSettingsVisibility(source, mode);
    }

    formatKnowledgeVersionLabel(metadata = {}) {
        return getOrCreateSettingsController(this).formatKnowledgeVersionLabel(metadata);
    }

    updateKnowledgeVersionDisplay() {
        return getOrCreateSettingsController(this).updateKnowledgeVersionDisplay();
    }

    logPanelEvent(level, stage, data = null, traceId = '') {
        return getOrCreateSettingsController(this).logPanelEvent(level, stage, data, traceId);
    }

    updateLogSummaryDisplay() {
        return getOrCreateSettingsController(this).updateLogSummaryDisplay();
    }

    exportAILogs() {
        return getOrCreateSettingsController(this).exportAILogs();
    }

    clearAILogs() {
        return getOrCreateSettingsController(this).clearAILogs();
    }

    bindModelSelector(selectEl, inputEl) {
        return getOrCreateSettingsController(this).bindModelSelector(selectEl, inputEl);
    }

    fillSelectOptions(selectEl, options = [], currentValue = '') {
        return getOrCreateSettingsController(this).fillSelectOptions(selectEl, options, currentValue);
    }

    syncSelectToValue(selectEl, value) {
        return getOrCreateSettingsController(this).syncSelectToValue(selectEl, value);
    }

    populateModelLists(models = []) {
        return getOrCreateSettingsController(this).populateModelLists(models);
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
        return getOrCreateLayoutController(this).initializePanelLayoutControls();
    }

    tryStartPanelDrag(event) {
        return getOrCreateLayoutController(this).tryStartPanelDrag(event);
    }

    tryStartCollapsedPanelDrag(event) {
        return getOrCreateLayoutController(this).tryStartCollapsedPanelDrag(event);
    }

    tryStartPanelResize(event) {
        return getOrCreateLayoutController(this).tryStartPanelResize(event);
    }

    startPanelGesture(type, event) {
        return getOrCreateLayoutController(this).startPanelGesture(type, event);
    }

    handlePanelPointerMove(event) {
        return getOrCreateLayoutController(this).handlePanelPointerMove(event);
    }

    handlePanelPointerUp(event) {
        return getOrCreateLayoutController(this).handlePanelPointerUp(event);
    }

    updatePanelDrag(event) {
        return getOrCreateLayoutController(this).updatePanelDrag(event);
    }

    updatePanelResize(event) {
        return getOrCreateLayoutController(this).updatePanelResize(event);
    }

    setPanelAbsolutePosition(left, top) {
        return getOrCreateLayoutController(this).setPanelAbsolutePosition(left, top);
    }

    getPanelBounds() {
        return getOrCreateLayoutController(this).getPanelBounds();
    }

    initializeIdleBehavior() {
        return getOrCreateLayoutController(this).initializeIdleBehavior();
    }

    markPanelActive() {
        return getOrCreateLayoutController(this).markPanelActive();
    }

    clamp(value, min, max) {
        return getOrCreateLayoutController(this).clamp(value, min, max);
    }

    isPanelCollapsed() {
        return getOrCreateLayoutController(this).isPanelCollapsed();
    }

    getCollapsedPanelSize() {
        return getOrCreateLayoutController(this).getCollapsedPanelSize();
    }

    getCollapsedPanelWidth() {
        return getOrCreateLayoutController(this).getCollapsedPanelWidth();
    }

    getCollapsedPanelHeight() {
        return getOrCreateLayoutController(this).getCollapsedPanelHeight();
    }

    rememberExpandedPanelSize() {
        return getOrCreateLayoutController(this).rememberExpandedPanelSize();
    }

    syncPanelCollapsedUI() {
        return getOrCreateLayoutController(this).syncPanelCollapsedUI();
    }

    setPanelCollapsed(collapsed, options) {
        return getOrCreateLayoutController(this).setPanelCollapsed(collapsed, options);
    }

    restorePanelLayout() {
        return getOrCreateLayoutController(this).restorePanelLayout();
    }

    applyPanelLayout(layout) {
        return getOrCreateLayoutController(this).applyPanelLayout(layout);
    }

    getSavedPanelLayout() {
        return getOrCreateLayoutController(this).getSavedPanelLayout();
    }

    savePanelLayout() {
        return getOrCreateLayoutController(this).savePanelLayout();
    }

    getDefaultPanelLayout() {
        return getOrCreateLayoutController(this).getDefaultPanelLayout();
    }

    constrainPanelToViewport() {
        return getOrCreateLayoutController(this).constrainPanelToViewport();
    }

}

function getOrCreateChatController(panel) {
    if (!panel.chatController) {
        panel.chatController = new ChatController({
            panel,
            app: panel.app,
            circuit: panel.circuit
        });
    }
    return panel.chatController;
}

function getOrCreateSettingsController(panel) {
    if (!panel.settingsController) {
        panel.settingsController = new SettingsController({
            panel,
            app: panel.app,
            circuit: panel.circuit
        });
    }
    return panel.settingsController;
}

function getOrCreateLayoutController(panel) {
    if (!panel.layoutController) {
        panel.layoutController = new PanelLayoutController({
            panel,
            app: panel.app,
            circuit: panel.circuit
        });
    }
    return panel.layoutController;
}
