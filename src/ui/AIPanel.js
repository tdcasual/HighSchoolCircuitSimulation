/**
 * AIPanel.js - AI助手面板控制器
 */

import { OpenAIClient } from '../ai/OpenAIClient.js';
import { CircuitExplainer } from '../ai/CircuitExplainer.js';

export class AIPanel {
    constructor(app) {
        this.app = app;
        this.circuit = app.circuit;
        this.aiClient = new OpenAIClient();
        this.explainer = new CircuitExplainer(this.circuit);
        
        this.currentImage = null;
        this.messageHistory = [];
        this.isProcessing = false;
        
        this.initializeUI();
        this.loadSettings();
    }

    /**
     * 初始化 UI 事件
     */
    initializeUI() {
        // 折叠/展开
        const toggleBtn = document.getElementById('ai-toggle-btn');
        const panel = document.getElementById('ai-assistant-panel');
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
            if (!circuitJSON.components || !circuitJSON.wires) {
                throw new Error('AI 返回的 JSON 格式不完整');
            }

            // 加载到电路
            this.app.stopSimulation();
            this.circuit.fromJSON(circuitJSON);
            this.app.renderer.render();
            this.app.interaction.clearSelection();

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

        const sendBtn = document.getElementById('chat-send-btn');
        const originalText = sendBtn.textContent;

        try {
            this.isProcessing = true;
            sendBtn.disabled = true;
            sendBtn.textContent = '⏳';

            // 添加加载提示
            const loadingId = this.addChatMessage('assistant', '<div class="loading-indicator"><span></span><span></span><span></span></div>');

            // 提取电路状态
            const circuitState = this.explainer.extractCircuitState();

            // 调用 AI
            const answer = await this.aiClient.explainCircuit(question, circuitState);

            // 移除加载提示，添加回答
            this.removeChatMessage(loadingId);
            this.addChatMessage('assistant', answer);

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
     * 添加聊天消息
     */
    addChatMessage(role, content) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageId = `msg-${Date.now()}-${Math.random()}`;
        
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${role}`;
        messageEl.id = messageId;
        messageEl.innerHTML = `<div class="chat-message-content">${content}</div>`;
        
        messagesDiv.appendChild(messageEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        this.messageHistory.push({ role, content, id: messageId });
        
        return messageId;
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
     * 初始化设置对话框
     */
    initializeSettingsDialog() {
        const dialog = document.getElementById('ai-settings-dialog');
        const saveBtn = document.getElementById('settings-save-btn');
        const cancelBtn = document.getElementById('settings-cancel-btn');
        const testBtn = document.getElementById('settings-test-btn');

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
        this.app.updateStatus('AI 设置已保存');
    }

    /**
     * 加载设置
     */
    loadSettings() {
        // 设置已在 OpenAIClient 构造函数中自动加载
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
}
