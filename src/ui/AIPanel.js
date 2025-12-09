/**
 * AIPanel.js - AI助手面板控制器
 */

import { OpenAIClient } from '../ai/OpenAIClient.js';
import { CircuitExplainer } from '../ai/CircuitExplainer.js';
import { validateCircuitJSON } from '../utils/circuitSchema.js';

export class AIPanel {
    constructor(app) {
        this.app = app;
        this.circuit = app.circuit;
        this.aiClient = new OpenAIClient();
        this.explainer = new CircuitExplainer(this.circuit);
        this.layoutStorageKey = 'ai_panel_layout';
        this.panelGesture = null;
        this.minPanelWidth = 320;
        this.minPanelHeight = 260;
        this.viewportPadding = 12;
        this.defaultRightOffset = 20;
        this.defaultBottomOffset = 16;
        
        this.currentImage = null;
        this.messageHistory = [];
        this.isProcessing = false;
        this.lastQuestion = '';
        
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

        // 折叠/展开
        const toggleBtn = document.getElementById('ai-toggle-btn');
        const panel = this.panel;
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
            toggleBtn.textContent = panel.classList.contains('collapsed') ? '▲' : '▼';
        });

        // Tab 切换
        const tabs = document.querySelectorAll('.ai-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 设置按钮
        document.getElementById('ai-settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        // 图片上传
        this.initializeImageUpload();

        // 聊天功能
        this.initializeChat();

        // 设置对话框
        this.initializeSettingsDialog();

        // 布局控制
        this.initializePanelLayoutControls();
    }

    /**
     * 切换 Tab
     */
    switchTab(tabName) {
        // 更新 Tab 按钮
        document.querySelectorAll('.ai-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 更新内容区域
        document.querySelectorAll('.ai-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }

    /**
     * 初始化图片上传
     */
    initializeImageUpload() {
        const input = document.getElementById('circuit-image-input');
        const uploadBtn = document.getElementById('image-upload-btn');
        const dropArea = document.getElementById('image-drop-area');
        const convertBtn = document.getElementById('convert-circuit-btn');
        const removeBtn = document.getElementById('image-remove-btn');

        // 点击上传
        uploadBtn.addEventListener('click', () => input.click());

        // 文件选择
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleImageFile(file);
        });

        // 拖放上传
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        });

        // 移除图片
        removeBtn.addEventListener('click', () => {
            this.clearImage();
        });

        // 转换按钮
        convertBtn.addEventListener('click', () => {
            this.convertImageToCircuit();
        });
    }

    /**
     * 处理图片文件
     */
    handleImageFile(file) {
        // 检查文件大小 (最大 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('图片文件过大，请选择小于 5MB 的图片');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            this.displayImagePreview(e.target.result);
            document.getElementById('convert-circuit-btn').disabled = false;
        };
        reader.readAsDataURL(file);
    }

    /**
     * 显示图片预览
     */
    displayImagePreview(dataUrl) {
        const preview = document.getElementById('image-preview');
        const previewArea = document.getElementById('image-preview-area');
        const uploadPrompt = document.getElementById('image-upload-prompt');

        preview.src = dataUrl;
        previewArea.classList.remove('hidden');
        uploadPrompt.style.display = 'none';
    }

    /**
     * 清除图片
     */
    clearImage() {
        this.currentImage = null;
        const preview = document.getElementById('image-preview');
        const previewArea = document.getElementById('image-preview-area');
        const uploadPrompt = document.getElementById('image-upload-prompt');
        const input = document.getElementById('circuit-image-input');

        preview.src = '';
        previewArea.classList.add('hidden');
        uploadPrompt.style.display = 'flex';
        input.value = '';
        document.getElementById('convert-circuit-btn').disabled = true;
    }

    /**
     * 转换图片为电路
     */
    async convertImageToCircuit() {
        if (!this.currentImage || this.isProcessing) return;

        const convertBtn = document.getElementById('convert-circuit-btn');
        const originalText = convertBtn.textContent;
        
        try {
            this.isProcessing = true;
            convertBtn.disabled = true;
            convertBtn.innerHTML = '<span class="loading-indicator"><span></span><span></span><span></span></span> 正在转换...';

            // 提取 base64
            const base64 = this.currentImage.split(',')[1];
            
            // 调用 AI
            const circuitJSON = await this.aiClient.convertImageToCircuit(base64);

            // 验证 JSON
            validateCircuitJSON(circuitJSON);

            // 加载到电路
            this.app.stopSimulation();
            this.circuit.fromJSON(circuitJSON);
            this.app.renderer.render();
            this.app.interaction.clearSelection();

            // 自动求解一次，提前暴露潜在问题
            this.circuit.startSimulation();
            this.circuit.step();
            this.circuit.stopSimulation();

            // 保存到 localStorage
            this.saveCircuitToLocalStorage(circuitJSON);

            this.app.updateStatus(`✅ 成功从图片加载电路: ${circuitJSON.components.length} 个元器件`);
            
            // 清除图片
            this.clearImage();
            
            // 切换到解释 Tab
            setTimeout(() => {
                this.switchTab('explain');
                this.addChatMessage('system', '电路已成功加载！你可以问我关于这个电路的问题。');
            }, 500);

        } catch (error) {
            console.error('Conversion error:', error);
            alert(`转换失败: ${error.message}`);
            this.app.updateStatus(`❌ 转换失败: ${error.message}`);
        } finally {
            this.isProcessing = false;
            convertBtn.disabled = false;
            convertBtn.textContent = originalText;
        }
    }

    /**
     * 初始化聊天功能
     */
    initializeChat() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const followups = document.querySelectorAll('.followup-btn');
        const undoBtn = document.getElementById('chat-undo-btn');
        const newChatBtn = document.getElementById('chat-new-btn');
        const historySelect = document.getElementById('chat-history-select');

        // 发送消息
        const sendMessage = () => {
            const question = input.value.trim();
            if (question && !this.isProcessing) {
                this.askQuestion(question);
                input.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // 快速问题
        const quickBtns = document.querySelectorAll('.quick-question-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.textContent;
                this.askQuestion(question);
            });
        });

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

    /**
     * 提问
     */
    async askQuestion(question) {
        if (this.isProcessing) return;

        // 检查电路是否为空
        if (this.circuit.components.size === 0) {
            this.addChatMessage('system', '当前电路为空，请先添加元器件或上传电路图。');
            return;
        }

        // 添加用户消息
        this.addChatMessage('user', question);
        this.lastQuestion = question;

        const sendBtn = document.getElementById('chat-send-btn');
        const originalText = sendBtn.textContent;

        try {
            this.isProcessing = true;
            sendBtn.disabled = true;
            sendBtn.textContent = '⏳';

            // 添加加载提示
            const loadingId = this.addChatMessage('assistant', '<div class="loading-indicator"><span></span><span></span><span></span></div>', { rawHtml: true });

            // 提取电路状态
            const circuitState = this.explainer.extractCircuitState({ concise: true, includeTopology: true });

            // 调用 AI
            const answer = await this.aiClient.explainCircuit(question, circuitState);

            // 移除加载提示，添加回答
            this.removeChatMessage(loadingId);
            this.addChatMessage('assistant', answer, { markdown: true });

        } catch (error) {
            console.error('Question error:', error);
            this.addChatMessage('system', `抱歉，出现错误: ${error.message}`);
        } finally {
            this.isProcessing = false;
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
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
                prompt = '在上一个问题基础上，请继续深入讲解并补充1-2点与高中物理相关的要点。';
                break;
            case 'simplify':
                prompt = '请用更简洁、更通俗的方式重述上一个问题的解释，控制在3-4句话，仍然保持高中物理范围。';
                break;
            case 'quiz':
                prompt = '请基于上一个问题生成2道简短小测验（选择或填空），并在最后单独列出标准答案。';
                break;
            default:
                prompt = '请继续讲解。';
        }
        const composite = `${this.lastQuestion}\n${prompt}`;
        this.askQuestion(composite);
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
            // 异步渲染公式
            if (window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise([messageEl]).catch(() => {});
            }
        }
        
        this.messageHistory.push({ role, content, id: messageId });
        
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
        if (window.marked?.parse) {
            return window.marked.parse(text, { breaks: true });
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
        const visionSelect = document.getElementById('vision-model-select');
        const textSelect = document.getElementById('text-model-select');
        const visionInput = document.getElementById('vision-model');
        const textInput = document.getElementById('text-model');

        this.bindModelSelector(visionSelect, visionInput);
        this.bindModelSelector(textSelect, textInput);

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
        });

        fetchModelsBtn.addEventListener('click', async () => {
            if (this.isProcessing) return;
            fetchStatus.textContent = '正在获取模型列表...';
            fetchModelsBtn.disabled = true;
            try {
                this.isProcessing = true;
                const models = await this.aiClient.listModels();
                this.populateModelLists(models);
                fetchStatus.textContent = `已加载 ${models.length} 个模型`;
            } catch (e) {
                console.error(e);
                fetchStatus.textContent = `获取失败: ${e.message}`;
            } finally {
                this.isProcessing = false;
                fetchModelsBtn.disabled = false;
            }
        });
    }

    /**
     * 打开设置
     */
    openSettings() {
        const config = this.aiClient.config;
        
        document.getElementById('api-endpoint').value = config.apiEndpoint;
        document.getElementById('api-key').value = config.apiKey;
        document.getElementById('vision-model').value = config.visionModel;
        document.getElementById('text-model').value = config.textModel;
        this.syncSelectToValue(document.getElementById('vision-model-select'), config.visionModel);
        this.syncSelectToValue(document.getElementById('text-model-select'), config.textModel);
        
        document.getElementById('ai-settings-dialog').classList.remove('hidden');
    }

    /**
     * 保存设置
     */
    saveSettings() {
        const config = {
            apiEndpoint: document.getElementById('api-endpoint').value.trim(),
            apiKey: document.getElementById('api-key').value.trim(),
            visionModel: document.getElementById('vision-model').value.trim(),
            textModel: document.getElementById('text-model').value.trim()
        };
        
        this.aiClient.saveConfig(config);
        const keyMsg = config.apiKey ? '（密钥仅保存在当前会话）' : '';
        this.app.updateStatus(`AI 设置已保存${keyMsg}`);
    }

    /**
     * 加载设置
     */
    loadSettings() {
        // 设置已在 OpenAIClient 构造函数中自动加载
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

    isVisionModelId(modelId) {
        if (!modelId) return false;
        const lower = modelId.toLowerCase();
        if (/(vision|image|omni)/.test(lower)) return true;

        // 常见多模态模型前缀（推断）
        const visionPrefixes = [
            'gpt-4o',
            'gpt-4.1',
            'gpt-5'
        ];
        return visionPrefixes.some(prefix => lower.startsWith(prefix));
    }

    populateModelLists(models = []) {
        const visionList = document.getElementById('model-list-vision');
        const textList = document.getElementById('model-list-text');
        const visionSelect = document.getElementById('vision-model-select');
        const textSelect = document.getElementById('text-model-select');
        const visionInput = document.getElementById('vision-model');
        const textInput = document.getElementById('text-model');
        if (!visionList || !textList) return;

        const toOption = (id) => {
            const opt = document.createElement('option');
            opt.value = id;
            return opt;
        };

        // 视觉列表不做过滤，直接展示全部；文本列表同样全部展示
        const visionModels = [...new Set(models)];
        const textModels = [...new Set(models)];

        visionList.innerHTML = '';
        textList.innerHTML = '';

        visionModels.forEach(id => visionList.appendChild(toOption(id)));
        textModels.forEach(id => textList.appendChild(toOption(id)));

        if (visionSelect) {
            this.fillSelectOptions(visionSelect, visionModels, visionInput?.value);
        }
        if (textSelect) {
            this.fillSelectOptions(textSelect, textModels, textInput?.value);
        }

        if (visionSelect && visionInput) {
            this.syncSelectToValue(visionSelect, visionInput.value.trim());
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
            localStorage.setItem('saved_circuit', JSON.stringify(circuitJSON));
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

        if (this.resizeHandle) {
            this.resizeHandle.addEventListener('pointerdown', (e) => this.tryStartPanelResize(e));
        }

        window.addEventListener('resize', () => this.constrainPanelToViewport());
    }

    tryStartPanelDrag(event) {
        if (!this.panel || this.panel.classList.contains('collapsed')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('#ai-panel-actions')) return;

        event.preventDefault();
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
        this.setPanelAbsolutePosition(rect.left, rect.top);

        this.panelGesture = {
            type,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top,
            startWidth: rect.width,
            startHeight: rect.height
        };

        this.panel.classList.add(type === 'drag' ? 'dragging' : 'resizing');
        window.addEventListener('pointermove', this.boundPanelPointerMove);
        window.addEventListener('pointerup', this.boundPanelPointerUp);
        window.addEventListener('pointercancel', this.boundPanelPointerUp);
    }

    handlePanelPointerMove(event) {
        if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;

        event.preventDefault();
        if (this.panelGesture.type === 'drag') {
            this.updatePanelDrag(event);
        } else {
            this.updatePanelResize(event);
        }
    }

    handlePanelPointerUp(event) {
        if (!this.panelGesture || event.pointerId !== this.panelGesture.pointerId) return;

        window.removeEventListener('pointermove', this.boundPanelPointerMove);
        window.removeEventListener('pointerup', this.boundPanelPointerUp);
        window.removeEventListener('pointercancel', this.boundPanelPointerUp);
        this.panel.classList.remove('dragging', 'resizing');
        this.panelGesture = null;
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

    clamp(value, min, max) {
        if (Number.isNaN(value)) return min;
        if (max < min) max = min;
        return Math.min(Math.max(value, min), max);
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
        const baseWidth = this.panel.offsetWidth || 420;
        const baseHeight = this.panel.offsetHeight || 420;

        const width = this.clamp(
            typeof layout.width === 'number' ? layout.width : baseWidth,
            availableWidth ? Math.min(this.minPanelWidth, availableWidth) : this.minPanelWidth,
            availableWidth || this.minPanelWidth
        );

        const height = this.clamp(
            typeof layout.height === 'number' ? layout.height : baseHeight,
            availableHeight ? Math.min(this.minPanelHeight, availableHeight) : this.minPanelHeight,
            availableHeight || this.minPanelHeight
        );

        const maxLeft = Math.max(bounds.minX, bounds.maxX - width);
        const maxTop = Math.max(bounds.minY, bounds.maxY - height);

        const left = this.clamp(
            typeof layout.left === 'number' ? layout.left : (bounds.maxX - width - this.defaultRightOffset),
            bounds.minX,
            maxLeft
        );

        const top = this.clamp(
            typeof layout.top === 'number' ? layout.top : (bounds.maxY - height - this.defaultBottomOffset),
            bounds.minY,
            maxTop
        );

        this.panel.style.width = `${width}px`;
        this.panel.style.height = `${height}px`;
        this.setPanelAbsolutePosition(left, top);
    }

    getSavedPanelLayout() {
        try {
            const raw = localStorage.getItem(this.layoutStorageKey);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const keys = ['left', 'top', 'width', 'height'];
            if (keys.every(key => typeof data[key] === 'number' && !Number.isNaN(data[key]))) {
                return data;
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
            const payload = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };
            localStorage.setItem(this.layoutStorageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save AI panel layout:', error);
        }
    }

    getDefaultPanelLayout() {
        const width = this.panel?.offsetWidth || 420;
        const height = this.panel?.offsetHeight || 420;
        const left = Math.max(this.viewportPadding, window.innerWidth - width - this.defaultRightOffset);
        const top = Math.max(this.viewportPadding, window.innerHeight - height - this.defaultBottomOffset);
        return { left, top, width, height };
    }

    constrainPanelToViewport() {
        if (!this.panel) return;
        const rect = this.panel.getBoundingClientRect();
        this.applyPanelLayout({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
        this.savePanelLayout();
    }

}
