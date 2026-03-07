import { safeGetStorageItem, safeRemoveStorageItem, safeSetStorageItem } from '../app/AppStorage.js';
import { RuntimeStorageEntries } from '../app/RuntimeStorageRegistry.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 180000;

export class OpenAIClientV2 {
    constructor(options = {}) {
        this.fetchImpl = typeof options.fetchImpl === 'function'
            ? options.fetchImpl
            : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        this.logger = options.logger || null;
        this.config = this.loadConfig(options);
    }

    setLogger(logger) {
        this.logger = logger || null;
    }

    get PUBLIC_CONFIG_KEY() {
        return RuntimeStorageEntries.aiPublicConfig.key;
    }

    get SESSION_KEY_KEY() {
        return RuntimeStorageEntries.aiSessionKey.key;
    }

    normalizePositiveNumber(value, fallbackValue) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
        return parsed;
    }

    normalizeRequestMode(mode) {
        return String(mode || '').trim().toLowerCase() === 'proxy' ? 'proxy' : 'direct';
    }

    normalizeEndpoint(endpoint) {
        const raw = String(endpoint || '').trim();
        if (!raw) return 'https://api.openai.com';
        try {
            return new URL(raw).toString().replace(/\/+$/u, '');
        } catch (_) {
            // continue
        }

        const normalized = raw.startsWith('/') ? `https://api.openai.com${raw}` : `https://${raw}`;
        try {
            return new URL(normalized).toString().replace(/\/+$/u, '');
        } catch (_) {
            return 'https://api.openai.com';
        }
    }

    normalizeApiEndpoint(rawEndpoint) {
        const endpoint = this.normalizeEndpoint(rawEndpoint);
        if (endpoint.endsWith('/v1/responses')) return endpoint;
        if (/\/v1\/[^/]+$/u.test(endpoint)) {
            return endpoint.replace(/\/v1\/[^/]+$/u, '/v1/responses');
        }
        if (endpoint.endsWith('/v1')) return `${endpoint}/responses`;
        if (/\/v1(\/|$)/u.test(endpoint)) {
            return endpoint.replace(/\/v1(\/.*)?$/u, '/v1/responses');
        }
        return `${endpoint}/v1/responses`;
    }

    normalizeProxyEndpoint(endpoint) {
        const raw = String(endpoint || '').trim();
        if (!raw) return '';
        try {
            return new URL(raw).toString().replace(/\/+$/u, '');
        } catch (_) {
            // continue
        }

        const normalized = raw.startsWith('/') ? `https://api.openai.com${raw}` : `https://${raw}`;
        try {
            return new URL(normalized).toString().replace(/\/+$/u, '');
        } catch (_) {
            return '';
        }
    }

    loadConfig(options = {}) {
        const defaultConfig = {
            apiEndpoint: 'https://api.openai.com/v1/responses',
            apiKey: '',
            requestMode: 'direct',
            proxyEndpoint: '',
            textModel: 'gpt-4.1-mini',
            knowledgeSource: 'local',
            knowledgeMcpEndpoint: '',
            knowledgeMcpServer: 'circuit-knowledge',
            knowledgeMcpMode: 'method',
            knowledgeMcpMethod: 'knowledge.search',
            knowledgeMcpResource: 'knowledge://circuit/high-school',
            maxOutputTokens: 2000,
            requestTimeout: DEFAULT_REQUEST_TIMEOUT_MS,
            retryAttempts: 2,
            retryDelayMs: 600
        };

        const savedPublic = safeGetStorageItem(RuntimeStorageEntries.aiPublicConfig) || null;
        const sessionKey = safeGetStorageItem(RuntimeStorageEntries.aiSessionKey) || '';

        let persisted = {};
        if (savedPublic) {
            try {
                persisted = JSON.parse(savedPublic) || {};
            } catch (_) {
                persisted = {};
            }
        }

        const merged = {
            ...defaultConfig,
            ...persisted,
            ...options
        };
        const maxOutputTokens = this.normalizePositiveNumber(
            merged.maxOutputTokens ?? merged.maxTokens,
            defaultConfig.maxOutputTokens
        );
        const requestTimeout = this.normalizePositiveNumber(
            merged.requestTimeout,
            DEFAULT_REQUEST_TIMEOUT_MS
        );

        return {
            ...merged,
            apiEndpoint: this.normalizeApiEndpoint(merged.apiEndpoint),
            requestMode: this.normalizeRequestMode(merged.requestMode),
            proxyEndpoint: this.normalizeProxyEndpoint(merged.proxyEndpoint),
            textModel: String(merged.textModel || defaultConfig.textModel),
            maxOutputTokens,
            requestTimeout,
            retryAttempts: this.normalizePositiveNumber(merged.retryAttempts, defaultConfig.retryAttempts),
            retryDelayMs: this.normalizePositiveNumber(merged.retryDelayMs, defaultConfig.retryDelayMs),
            apiKey: options.apiKey !== undefined
                ? String(options.apiKey || '')
                : String(sessionKey || '')
        };
    }

    saveConfig(config = {}) {
        const next = {
            ...this.config,
            ...config
        };
        this.config = {
            ...next,
            apiEndpoint: this.normalizeApiEndpoint(next.apiEndpoint),
            requestMode: this.normalizeRequestMode(next.requestMode),
            proxyEndpoint: this.normalizeProxyEndpoint(next.proxyEndpoint),
            textModel: String(next.textModel || this.config.textModel || 'gpt-4.1-mini'),
            maxOutputTokens: this.normalizePositiveNumber(
                next.maxOutputTokens ?? next.maxTokens,
                this.config.maxOutputTokens || 2000
            ),
            requestTimeout: this.normalizePositiveNumber(
                next.requestTimeout,
                this.config.requestTimeout || DEFAULT_REQUEST_TIMEOUT_MS
            ),
            retryAttempts: this.normalizePositiveNumber(
                next.retryAttempts,
                this.config.retryAttempts || 2
            ),
            retryDelayMs: this.normalizePositiveNumber(
                next.retryDelayMs,
                this.config.retryDelayMs || 600
            ),
            apiKey: config.apiKey !== undefined
                ? String(config.apiKey || '')
                : String(this.config.apiKey || '')
        };

        const publicConfig = {
            apiEndpoint: this.config.apiEndpoint,
            requestMode: this.config.requestMode,
            proxyEndpoint: this.config.proxyEndpoint,
            textModel: this.config.textModel,
            knowledgeSource: this.config.knowledgeSource,
            knowledgeMcpEndpoint: this.config.knowledgeMcpEndpoint,
            knowledgeMcpServer: this.config.knowledgeMcpServer,
            knowledgeMcpMode: this.config.knowledgeMcpMode,
            knowledgeMcpMethod: this.config.knowledgeMcpMethod,
            knowledgeMcpResource: this.config.knowledgeMcpResource,
            maxOutputTokens: this.config.maxOutputTokens,
            requestTimeout: this.config.requestTimeout,
            retryAttempts: this.config.retryAttempts,
            retryDelayMs: this.config.retryDelayMs
        };
        safeSetStorageItem(RuntimeStorageEntries.aiPublicConfig, JSON.stringify(publicConfig));

        if (config.apiKey !== undefined) {
            if (this.config.apiKey) {
                safeSetStorageItem(RuntimeStorageEntries.aiSessionKey, this.config.apiKey);
            } else {
                safeRemoveStorageItem(RuntimeStorageEntries.aiSessionKey);
            }
        }
    }

    clearApiKey() {
        this.config.apiKey = '';
        safeRemoveStorageItem(RuntimeStorageEntries.aiSessionKey);
    }

    isProxyMode() {
        return this.normalizeRequestMode(this.config?.requestMode) === 'proxy';
    }

    getProxyEndpointOrThrow() {
        const endpoint = this.normalizeProxyEndpoint(this.config?.proxyEndpoint);
        if (!endpoint) {
            throw new Error('请先在设置中配置代理端点');
        }
        return endpoint;
    }

    resolveApiEndpoint() {
        if (this.isProxyMode()) {
            return this.getProxyEndpointOrThrow();
        }
        return this.normalizeApiEndpoint(this.config?.apiEndpoint);
    }

    resolveModelsEndpoint() {
        if (this.isProxyMode()) {
            return this.getProxyEndpointOrThrow();
        }
        const apiEndpoint = this.normalizeEndpoint(this.config?.apiEndpoint);
        if (/\/v1\/[^/]+$/u.test(apiEndpoint)) {
            return apiEndpoint.replace(/\/v1\/[^/]+$/u, '/v1/models');
        }
        if (apiEndpoint.endsWith('/v1')) {
            return `${apiEndpoint}/models`;
        }
        if (/\/v1\//u.test(apiEndpoint)) {
            return `${apiEndpoint.split('/v1/')[0]}/v1/models`;
        }
        return apiEndpoint.endsWith('/') ? `${apiEndpoint}v1/models` : `${apiEndpoint}/v1/models`;
    }

    buildRequestHeaders(includeJson = false) {
        const headers = {};
        if (includeJson) {
            headers['Content-Type'] = 'application/json';
        }
        if (!this.isProxyMode() && this.config.apiKey) {
            headers.Authorization = `Bearer ${this.config.apiKey}`;
        }
        return headers;
    }

    buildRequestBody(messages = [], model = this.config.textModel, maxTokens = null) {
        return {
            model: String(model || this.config.textModel),
            input: Array.isArray(messages) ? messages : [],
            max_output_tokens: this.normalizePositiveNumber(
                maxTokens,
                this.normalizePositiveNumber(this.config.maxOutputTokens, 2000)
            ),
            stream: false
        };
    }

    extractTextFromContent(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) return '';
        const parts = content.map((item) => {
            if (!item) return '';
            if (typeof item === 'string') return item;
            if (typeof item.text === 'string') return item.text;
            return '';
        }).filter(Boolean);
        return parts.join('\n').trim();
    }

    extractResponseText(payload = {}) {
        if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
            return payload.output_text.trim();
        }
        if (typeof payload.response?.output_text === 'string' && payload.response.output_text.trim()) {
            return payload.response.output_text.trim();
        }

        const outputs = payload.output || payload.outputs || payload.response?.output || payload.response?.outputs;
        if (Array.isArray(outputs)) {
            for (const item of outputs) {
                const text = this.extractTextFromContent(item?.content || item?.message?.content);
                if (text) return text;
            }
        }

        const fallbackText = this.extractTextFromContent(payload?.choices?.[0]?.message?.content);
        if (fallbackText) return fallbackText;
        return '';
    }

    getTimeoutMs() {
        return this.normalizePositiveNumber(this.config?.requestTimeout, DEFAULT_REQUEST_TIMEOUT_MS);
    }

    runWithTimeout(taskFactory, timeoutMs, timeoutMessage = '请求超时') {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                settled = true;
                reject(new Error(timeoutMessage));
            }, timeoutMs);

            Promise.resolve()
                .then(() => taskFactory())
                .then((value) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch((error) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    tryParseJson(text) {
        if (typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch (_) {
            return null;
        }
    }

    async readResponsePayload(response, timeoutMs) {
        if (response && typeof response.text === 'function') {
            const text = await this.runWithTimeout(
                () => response.text(),
                timeoutMs,
                '响应读取超时'
            );
            const jsonFromText = this.tryParseJson(typeof text === 'string' ? text : String(text || ''));
            if (jsonFromText) {
                return {
                    text: typeof text === 'string' ? text : String(text || ''),
                    json: jsonFromText
                };
            }
            if (response && typeof response.json === 'function') {
                try {
                    const json = await this.runWithTimeout(
                        () => response.json(),
                        timeoutMs,
                        '响应读取超时'
                    );
                    if (json && typeof json === 'object') {
                        return {
                            text: typeof text === 'string' ? text : String(text || ''),
                            json
                        };
                    }
                } catch (_) {
                    // keep text fallback path when secondary json read fails
                }
            }
            return {
                text: typeof text === 'string' ? text : String(text || ''),
                json: null
            };
        }

        if (response && typeof response.json === 'function') {
            const json = await this.runWithTimeout(
                () => response.json(),
                timeoutMs,
                '响应读取超时'
            );
            return {
                text: '',
                json: json && typeof json === 'object' ? json : null
            };
        }

        return { text: '', json: null };
    }

    resolveHttpErrorMessage(status, statusText, jsonPayload, textPayload) {
        const payloadMessage = jsonPayload?.error?.message || jsonPayload?.message;
        if (payloadMessage) return String(payloadMessage);
        const text = String(textPayload || '').trim();
        if (text) return text.slice(0, 500);
        return `HTTP ${status}: ${statusText || '请求失败'}`;
    }

    logEvent(level, stage, data = null, context = {}) {
        if (!this.logger || typeof this.logger.log !== 'function') return;
        this.logger.log({
            level,
            source: context?.source || 'openai_client_v2',
            stage,
            traceId: context?.traceId || '',
            message: stage,
            data
        });
    }

    async listModels() {
        if (!this.fetchImpl) {
            throw new Error('当前环境不支持 fetch');
        }
        if (!this.isProxyMode() && !this.config.apiKey) {
            throw new Error('请先在设置中配置 API 密钥');
        }

        const endpoint = this.resolveModelsEndpoint();
        const timeoutMs = this.getTimeoutMs();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await this.fetchImpl(endpoint, {
                method: 'GET',
                headers: this.buildRequestHeaders(false),
                signal: controller.signal
            });
            clearTimeout(timer);
            const { json, text } = await this.readResponsePayload(response, timeoutMs);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('API 密钥无效或无访问权限');
                }
                throw new Error(this.resolveHttpErrorMessage(response.status, response.statusText, json, text));
            }

            const payload = json || this.tryParseJson(text);
            if (!payload || typeof payload !== 'object') {
                throw new Error('模型列表响应解析失败');
            }
            return (payload.data || []).map((item) => item?.id).filter(Boolean);
        } catch (error) {
            clearTimeout(timer);
            if (error?.name === 'AbortError') {
                throw new Error(`请求超时（>${timeoutMs}ms）`);
            }
            throw error;
        }
    }

    async callAPI(messages, model, maxTokens = null, context = {}) {
        if (!this.fetchImpl) {
            throw new Error('当前环境不支持 fetch');
        }
        if (!this.isProxyMode() && !this.config.apiKey) {
            throw new Error('请先在设置中配置 API 密钥');
        }

        const attempts = Math.max(1, Number(this.config.retryAttempts || 1));
        let delayMs = Math.max(100, Number(this.config.retryDelayMs || 600));
        let lastError = null;
        const timeoutMs = this.getTimeoutMs();
        const traceId = context?.traceId || '';
        const source = context?.source || 'openai_client_v2.call_api';

        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await this.fetchImpl(this.resolveApiEndpoint(), {
                    method: 'POST',
                    headers: this.buildRequestHeaders(true),
                    body: JSON.stringify(this.buildRequestBody(messages, model, maxTokens)),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const { json, text } = await this.readResponsePayload(response, timeoutMs);
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        throw new Error('API 密钥无效或无访问权限');
                    }

                    const message = this.resolveHttpErrorMessage(response.status, response.statusText, json, text);
                    const retriable = response.status === 429 || response.status >= 500;
                    if (retriable && attempt < attempts - 1) {
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        delayMs *= 2;
                        continue;
                    }
                    throw new Error(message);
                }

                const answer = this.extractResponseText(json || {});
                if (answer) return answer;

                const plainText = String(text || '').trim();
                if (plainText) return plainText;

                throw new Error('响应中未找到文本内容');
            } catch (error) {
                clearTimeout(timeoutId);
                const isAbort = error?.name === 'AbortError';
                const isBodyTimeout = String(error?.message || '').includes('响应读取超时');
                lastError = isAbort ? new Error(`请求超时（>${timeoutMs}ms）`) : error;
                if ((isAbort || isBodyTimeout) && attempt < attempts - 1) {
                    this.logEvent('warn', 'call_api_retry', {
                        attempt: attempt + 1,
                        reason: error?.message || String(error)
                    }, {
                        traceId,
                        source
                    });
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    delayMs *= 2;
                    continue;
                }
                if (isAbort) {
                    throw new Error(`请求超时（>${timeoutMs}ms）`);
                }
                throw lastError;
            }
        }

        throw lastError || new Error('请求失败');
    }

    async testConnection() {
        if (!this.isProxyMode() && !this.config.apiKey) {
            throw new Error('请先设置 API 密钥');
        }

        try {
            await this.callAPI(
                [{ role: 'user', content: 'Hello' }],
                this.config.textModel,
                10,
                { source: 'openai_client_v2.test_connection' }
            );
            return { success: true, message: '连接成功!' };
        } catch (error) {
            return { success: false, message: error?.message || String(error) };
        }
    }
}
