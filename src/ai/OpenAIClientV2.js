export class OpenAIClientV2 {
    constructor(options = {}) {
        this.fetchImpl = typeof options.fetchImpl === 'function'
            ? options.fetchImpl
            : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        this.logger = options.logger || null;
        this.config = {
            apiEndpoint: this.normalizeApiEndpoint(options.apiEndpoint),
            apiKey: String(options.apiKey || ''),
            textModel: String(options.textModel || 'gpt-4.1-mini'),
            maxOutputTokens: this.normalizePositiveNumber(options.maxOutputTokens, 2000),
            requestTimeout: this.normalizePositiveNumber(options.requestTimeout, 180000),
            retryAttempts: this.normalizePositiveNumber(options.retryAttempts, 2),
            retryDelayMs: this.normalizePositiveNumber(options.retryDelayMs, 600)
        };
    }

    setLogger(logger) {
        this.logger = logger || null;
    }

    normalizePositiveNumber(value, fallbackValue) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
        return parsed;
    }

    normalizeApiEndpoint(rawEndpoint) {
        const endpoint = String(rawEndpoint || 'https://api.openai.com/v1/responses').trim();
        if (!endpoint) return 'https://api.openai.com/v1/responses';
        if (endpoint.endsWith('/v1/responses')) return endpoint;
        if (endpoint.endsWith('/v1')) return `${endpoint}/responses`;
        if (endpoint.includes('/v1/')) return endpoint.replace(/\/v1\/.*$/u, '/v1/responses');
        return `${endpoint.replace(/\/+$/u, '')}/v1/responses`;
    }

    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.config.apiKey) {
            headers.Authorization = `Bearer ${this.config.apiKey}`;
        }
        return headers;
    }

    buildRequestBody(messages = [], model = this.config.textModel, maxTokens = null) {
        return {
            model: String(model || this.config.textModel),
            input: Array.isArray(messages) ? messages : [],
            max_output_tokens: this.normalizePositiveNumber(maxTokens, this.config.maxOutputTokens),
            stream: false
        };
    }

    extractResponseText(payload = {}) {
        if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
            return payload.output_text.trim();
        }

        const outputs = Array.isArray(payload.output) ? payload.output : [];
        for (const item of outputs) {
            const contentItems = Array.isArray(item?.content) ? item.content : [];
            for (const content of contentItems) {
                if (typeof content?.text === 'string' && content.text.trim()) {
                    return content.text.trim();
                }
            }
        }
        return '';
    }

    async callAPI(messages, model, maxTokens = null, _context = {}) {
        if (!this.fetchImpl) {
            throw new Error('当前环境不支持 fetch');
        }

        const attempts = Math.max(1, Number(this.config.retryAttempts));
        let delayMs = Math.max(100, Number(this.config.retryDelayMs));
        let lastError = null;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
            try {
                const response = await this.fetchImpl(this.config.apiEndpoint, {
                    method: 'POST',
                    headers: this.buildHeaders(),
                    body: JSON.stringify(this.buildRequestBody(messages, model, maxTokens)),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const json = await response.json().catch(() => null);
                if (!response.ok) {
                    const status = Number(response.status || 0);
                    const message = String(json?.error?.message || `请求失败 (HTTP ${status})`);
                    const retriable = status === 429 || status >= 500;
                    if (retriable && attempt < attempts - 1) {
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        delayMs *= 2;
                        continue;
                    }
                    throw new Error(message);
                }

                const answer = this.extractResponseText(json || {});
                if (!answer) {
                    throw new Error('响应中未找到文本内容');
                }
                return answer;
            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;
                if (attempt < attempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    delayMs *= 2;
                    continue;
                }
            }
        }

        throw lastError || new Error('请求失败');
    }
}
