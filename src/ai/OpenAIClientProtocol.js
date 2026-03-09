const DEFAULT_BASE_ENDPOINT = 'https://api.openai.com';

export const DEFAULT_REQUEST_TIMEOUT_MS = 180000;

export function normalizePositiveNumber(value, fallbackValue) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
    return parsed;
}

export function normalizeRequestMode(mode) {
    return String(mode || '').trim().toLowerCase() === 'proxy' ? 'proxy' : 'direct';
}

function normalizeHttpEndpoint(endpoint, fallbackValue) {
    const raw = String(endpoint || '').trim();
    if (!raw) return fallbackValue;
    try {
        return new URL(raw).toString().replace(/\/+$/u, '');
    } catch (_) {
        // continue
    }

    const normalized = raw.startsWith('/') ? `${DEFAULT_BASE_ENDPOINT}${raw}` : `https://${raw}`;
    try {
        return new URL(normalized).toString().replace(/\/+$/u, '');
    } catch (_) {
        return fallbackValue;
    }
}

export function normalizeEndpoint(endpoint) {
    return normalizeHttpEndpoint(endpoint, DEFAULT_BASE_ENDPOINT);
}

export function normalizeApiEndpoint(rawEndpoint) {
    const endpoint = normalizeEndpoint(rawEndpoint);
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

export function normalizeProxyEndpoint(endpoint) {
    return normalizeHttpEndpoint(endpoint, '');
}

export function resolveModelsEndpoint(apiEndpoint) {
    const endpoint = normalizeEndpoint(apiEndpoint);
    if (/\/v1\/[^/]+$/u.test(endpoint)) {
        return endpoint.replace(/\/v1\/[^/]+$/u, '/v1/models');
    }
    if (endpoint.endsWith('/v1')) return `${endpoint}/models`;
    if (/\/v1\//u.test(endpoint)) {
        return `${endpoint.split('/v1/')[0]}/v1/models`;
    }
    return endpoint.endsWith('/') ? `${endpoint}v1/models` : `${endpoint}/v1/models`;
}

export function buildResponsesRequestBody(messages = [], model = '', maxTokens = null, fallbackMaxOutputTokens = 2000) {
    return {
        model: String(model || ''),
        input: Array.isArray(messages) ? messages : [],
        max_output_tokens: normalizePositiveNumber(
            maxTokens,
            normalizePositiveNumber(fallbackMaxOutputTokens, 2000)
        ),
        stream: false
    };
}

export function extractTextFromContent(content) {
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

export function extractResponseText(payload = {}) {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }
    if (typeof payload.response?.output_text === 'string' && payload.response.output_text.trim()) {
        return payload.response.output_text.trim();
    }

    const outputs = payload.output || payload.outputs || payload.response?.output || payload.response?.outputs;
    if (Array.isArray(outputs)) {
        for (const item of outputs) {
            const text = extractTextFromContent(item?.content || item?.message?.content);
            if (text) return text;
        }
    }

    const fallbackText = extractTextFromContent(payload?.choices?.[0]?.message?.content);
    if (fallbackText) return fallbackText;
    return '';
}
