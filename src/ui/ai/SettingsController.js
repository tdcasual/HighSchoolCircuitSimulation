import { createKnowledgeProvider } from '../../ai/resources/createKnowledgeProvider.js';

export class SettingsController {
    constructor(deps = {}) {
        this.deps = deps;
    }

    withPanel(fn, ...args) {
        const panel = this.deps?.panel || this.deps || {};
        return fn.call(panel, ...args);
    }

    initializeSettingsDialog() {
        return this.withPanel(initializeSettingsDialogImpl);
    }

    openSettings() {
        return this.withPanel(openSettingsImpl);
    }

    saveSettings() {
        return this.withPanel(saveSettingsImpl);
    }

    loadSettings() {
        return this.withPanel(loadSettingsImpl);
    }

    refreshKnowledgeProvider() {
        return this.withPanel(refreshKnowledgeProviderImpl);
    }

    syncKnowledgeSettingsVisibility(source, mode = null) {
        return this.withPanel(syncKnowledgeSettingsVisibilityImpl, source, mode);
    }

    formatKnowledgeVersionLabel(metadata = {}) {
        return this.withPanel(formatKnowledgeVersionLabelImpl, metadata);
    }

    updateKnowledgeVersionDisplay() {
        return this.withPanel(updateKnowledgeVersionDisplayImpl);
    }

    logPanelEvent(level, stage, data = null, traceId = '') {
        return this.withPanel(logPanelEventImpl, level, stage, data, traceId);
    }

    updateLogSummaryDisplay() {
        return this.withPanel(updateLogSummaryDisplayImpl);
    }

    exportAILogs() {
        return this.withPanel(exportAILogsImpl);
    }

    clearAILogs() {
        return this.withPanel(clearAILogsImpl);
    }

    bindModelSelector(selectEl, inputEl) {
        return this.withPanel(bindModelSelectorImpl, selectEl, inputEl);
    }

    fillSelectOptions(selectEl, options = [], currentValue = '') {
        return this.withPanel(fillSelectOptionsImpl, selectEl, options, currentValue);
    }

    syncSelectToValue(selectEl, value) {
        return this.withPanel(syncSelectToValueImpl, selectEl, value);
    }

    populateModelLists(models = []) {
        return this.withPanel(populateModelListsImpl, models);
    }
}

function initializeSettingsDialogImpl() {
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
        this.saveSettings();

        testBtn.disabled = true;
        testBtn.textContent = '测试中...';

        try {
            const result = await this.aiClient.testConnection();
            alert(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
        } catch (error) {
            alert(`❌ 测试失败: ${error.message}`);
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
            this.saveSettings();
            this.isProcessing = true;
            const models = await this.aiClient.listModels();
            this.populateModelLists(models);
            fetchStatus.textContent = `已加载 ${models.length} 个模型`;
            this.logPanelEvent?.('info', 'fetch_models_success', { count: models.length });
        } catch (e) {
            this.app?.logger?.error?.('Fetch models failed:', e);
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

function openSettingsImpl() {
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

function saveSettingsImpl() {
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

function loadSettingsImpl() {
    this.refreshKnowledgeProvider();
    this.updateKnowledgeVersionDisplay();
    this.logPanelEvent?.('info', 'settings_loaded', {
        endpoint: this.aiClient.config?.apiEndpoint || '',
        knowledgeSource: this.aiClient.config?.knowledgeSource || 'local'
    });
}

function refreshKnowledgeProviderImpl() {
    const provider = createKnowledgeProvider(this.aiClient.config || {});
    this.aiAgent.setKnowledgeProvider(provider);
    this.logPanelEvent?.('info', 'knowledge_provider_refreshed', {
        source: this.aiClient.config?.knowledgeSource || 'local',
        mode: this.aiClient.config?.knowledgeMcpMode || 'method'
    });
    this.updateKnowledgeVersionDisplay();
}

function syncKnowledgeSettingsVisibilityImpl(source, mode = null) {
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

function formatKnowledgeVersionLabelImpl(metadata = {}) {
    const source = metadata.source || 'unknown';
    const version = metadata.version || 'unknown';
    if (source === 'local') return `规则库版本: ${version}（本地）`;
    if (source === 'mcp') return `规则库版本: ${version}（MCP）`;
    if (source === 'mcp-fallback-local') return `规则库版本: ${version}（MCP降级本地）`;
    return `规则库版本: ${version}`;
}

function updateKnowledgeVersionDisplayImpl() {
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

function logPanelEventImpl(level, stage, data = null, traceId = '') {
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

function updateLogSummaryDisplayImpl() {
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

function exportAILogsImpl() {
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

function clearAILogsImpl() {
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

function bindModelSelectorImpl(selectEl, inputEl) {
    if (!selectEl || !inputEl) return;
    selectEl.addEventListener('change', () => {
        if (selectEl.value) {
            inputEl.value = selectEl.value;
        }
    });
}

function fillSelectOptionsImpl(selectEl, options = [], currentValue = '') {
    if (!selectEl) return;
    const current = currentValue?.trim();
    selectEl.innerHTML = '<option value="">从列表选择</option>';
    options.forEach((id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        selectEl.appendChild(opt);
    });
    if (current && !options.includes(current)) {
        const customOpt = document.createElement('option');
        customOpt.value = current;
        customOpt.textContent = `${current} (自定义)`;
        selectEl.appendChild(customOpt);
    }
}

function syncSelectToValueImpl(selectEl, value) {
    if (!selectEl) return;
    const val = value?.trim() || '';
    const hasOption = Array.from(selectEl.options).some((opt) => opt.value === val);
    if (!hasOption && val) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = `${val} (自定义)`;
        selectEl.appendChild(opt);
    }
    selectEl.value = val;
}

function populateModelListsImpl(models = []) {
    const textList = document.getElementById('model-list-text');
    const textSelect = document.getElementById('text-model-select');
    const textInput = document.getElementById('text-model');
    if (!textList) return;

    const toOption = (id) => {
        const opt = document.createElement('option');
        opt.value = id;
        return opt;
    };

    const textModels = [...new Set(models.map((id) => String(id || '').trim()).filter(Boolean))];

    textList.innerHTML = '';
    textModels.forEach((id) => textList.appendChild(toOption(id)));

    if (textSelect) {
        this.fillSelectOptions(textSelect, textModels, textInput?.value);
    }

    if (textSelect && textInput) {
        this.syncSelectToValue(textSelect, textInput.value.trim());
    }
}
