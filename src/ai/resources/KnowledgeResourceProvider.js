/**
 * KnowledgeResourceProvider.js
 * Resource-provider abstraction for AI teaching knowledge (local now, MCP later).
 */

import {
    HIGH_SCHOOL_CIRCUIT_KNOWLEDGE,
    HIGH_SCHOOL_CIRCUIT_KNOWLEDGE_VERSION
} from './HighSchoolCircuitKnowledge.js';

export class KnowledgeResourceProvider {
    async search(_query = {}) {
        throw new Error('KnowledgeResourceProvider.search() is not implemented');
    }

    getMetadata() {
        return {
            source: 'unknown',
            version: 'unknown',
            detail: ''
        };
    }
}

function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
}

function normalizeCategory(value) {
    const raw = String(value || '').toLowerCase().trim();
    if (!raw) return 'general';
    const known = new Set(['formula', 'topology', 'instrument', 'dynamic', 'misconception', 'general']);
    return known.has(raw) ? raw : 'general';
}

function normalizeMcpMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return mode === 'resource' ? 'resource' : 'method';
}

function uniqueStrings(values = []) {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function calcScore(entry, normalizedQuestion, componentTypes) {
    let score = 0;

    const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];
    for (const keyword of keywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalizedKeyword && normalizedQuestion.includes(normalizedKeyword)) {
            score += 3;
        }
    }

    const appliesTo = Array.isArray(entry.appliesTo) ? entry.appliesTo : [];
    for (const type of appliesTo) {
        if (componentTypes.has(type)) {
            score += 2;
        }
    }

    const title = normalizeText(entry.title);
    if (title && normalizedQuestion.includes(title)) {
        score += 2;
    }

    return score;
}

function selectBalancedEntries(scoredEntries = [], limit = 3) {
    const safeLimit = Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 3);
    if (!Array.isArray(scoredEntries) || scoredEntries.length === 0) return [];

    const sorted = scoredEntries
        .filter(item => item && item.entry)
        .slice()
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return String(left.entry.id).localeCompare(String(right.entry.id));
        });

    const selected = [];
    const selectedIds = new Set();
    const byCategory = new Map();
    for (const item of sorted) {
        const category = normalizeCategory(item.entry.category);
        if (!byCategory.has(category)) byCategory.set(category, []);
        byCategory.get(category).push(item);
    }

    const categoryOrder = [...byCategory.entries()]
        .sort((left, right) => {
            const leftBest = left[1][0]?.score ?? 0;
            const rightBest = right[1][0]?.score ?? 0;
            if (rightBest !== leftBest) return rightBest - leftBest;
            return left[0].localeCompare(right[0]);
        })
        .map(([category]) => category);

    for (const category of categoryOrder) {
        const firstItem = byCategory.get(category)?.[0];
        if (!firstItem) continue;
        const id = String(firstItem.entry.id);
        if (selectedIds.has(id)) continue;
        selected.push(firstItem.entry);
        selectedIds.add(id);
        if (selected.length >= safeLimit) return selected;
    }

    for (const item of sorted) {
        const id = String(item.entry.id);
        if (selectedIds.has(id)) continue;
        selected.push(item.entry);
        selectedIds.add(id);
        if (selected.length >= safeLimit) break;
    }
    return selected;
}

export class LocalKnowledgeResourceProvider extends KnowledgeResourceProvider {
    constructor(entries = HIGH_SCHOOL_CIRCUIT_KNOWLEDGE) {
        super();
        this.entries = Array.isArray(entries) ? entries : [];
        this.fallbackIds = ['ohm-law', 'series-parallel', 'power-relation'];
        this.version = HIGH_SCHOOL_CIRCUIT_KNOWLEDGE_VERSION;
    }

    async search(query = {}) {
        const normalizedQuestion = normalizeText(query.question);
        const componentTypes = new Set(uniqueStrings(query.componentTypes));
        const limit = Math.max(1, Number.isFinite(Number(query.limit)) ? Number(query.limit) : 3);

        const scored = this.entries
            .map(entry => ({ entry, score: calcScore(entry, normalizedQuestion, componentTypes) }))
            .sort((left, right) => {
                if (right.score !== left.score) return right.score - left.score;
                return String(left.entry.id).localeCompare(String(right.entry.id));
            });

        let selected = selectBalancedEntries(scored.filter(item => item.score > 0), limit);
        if (selected.length === 0) {
            selected = this.entries
                .filter(entry => this.fallbackIds.includes(entry.id))
                .slice(0, limit);
        }

        return selected.map(entry => ({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            category: normalizeCategory(entry.category),
            keywords: Array.isArray(entry.keywords) ? [...entry.keywords] : [],
            appliesTo: Array.isArray(entry.appliesTo) ? [...entry.appliesTo] : []
        }));
    }

    getMetadata() {
        return {
            source: 'local',
            version: this.version,
            detail: '内置题库/规则库'
        };
    }
}

function normalizeKnowledgeItem(rawItem, index = 0) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    const content = String(rawItem.content ?? rawItem.text ?? rawItem.body ?? '').trim();
    if (!content) return null;
    const id = String(rawItem.id ?? rawItem.key ?? rawItem.name ?? `item_${index + 1}`).trim();
    const title = String(rawItem.title ?? rawItem.name ?? id).trim() || id;
    const keywords = Array.isArray(rawItem.keywords)
        ? rawItem.keywords
        : (typeof rawItem.keywords === 'string'
            ? rawItem.keywords.split(/[,\s]+/g).filter(Boolean)
            : []);
    const appliesTo = Array.isArray(rawItem.appliesTo)
        ? rawItem.appliesTo
        : (Array.isArray(rawItem.componentTypes) ? rawItem.componentTypes : []);
    return {
        id,
        title,
        content,
        category: normalizeCategory(rawItem.category),
        keywords: uniqueStrings(keywords),
        appliesTo: uniqueStrings(appliesTo)
    };
}

function parseMcpKnowledgeResponse(payload) {
    const tryParseTextAsJson = (text) => {
        if (typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch (_) {
            return null;
        }
    };

    const extractFromCandidate = (candidate, basePayload = payload) => {
        if (Array.isArray(candidate)) {
            return {
                items: candidate,
                version: String(basePayload?.version || 'unknown')
            };
        }
        if (!candidate || typeof candidate !== 'object') return null;

        const directItems = Array.isArray(candidate.items)
            ? candidate.items
            : (Array.isArray(candidate.resources) ? candidate.resources : null);
        if (directItems) {
            return {
                items: directItems,
                version: String(
                    candidate.version
                    || candidate.knowledgeVersion
                    || candidate.resourceVersion
                    || candidate.meta?.version
                    || basePayload?.version
                    || 'unknown'
                )
            };
        }

        // MCP resource-like shape: { contents: [{ text/json/data }] }
        if (Array.isArray(candidate.contents)) {
            const collected = [];
            let parsedVersion = String(
                candidate.version
                || candidate.meta?.version
                || basePayload?.version
                || 'unknown'
            );
            for (const content of candidate.contents) {
                if (!content || typeof content !== 'object') continue;
                if (Array.isArray(content.items)) {
                    collected.push(...content.items);
                    continue;
                }
                if (content.json && typeof content.json === 'object') {
                    const parsed = extractFromCandidate(content.json, basePayload);
                    if (parsed?.items?.length) {
                        collected.push(...parsed.items);
                        if (parsed.version && parsed.version !== 'unknown') {
                            parsedVersion = parsed.version;
                        }
                    }
                    continue;
                }
                if (content.data && typeof content.data === 'object') {
                    const parsed = extractFromCandidate(content.data, basePayload);
                    if (parsed?.items?.length) {
                        collected.push(...parsed.items);
                        if (parsed.version && parsed.version !== 'unknown') {
                            parsedVersion = parsed.version;
                        }
                    }
                    continue;
                }
                const parsedFromText = tryParseTextAsJson(content.text);
                if (parsedFromText) {
                    const parsed = extractFromCandidate(parsedFromText, basePayload);
                    if (parsed?.items?.length) {
                        collected.push(...parsed.items);
                        if (parsed.version && parsed.version !== 'unknown') {
                            parsedVersion = parsed.version;
                        }
                    }
                }
            }
            if (collected.length > 0) {
                return {
                    items: collected,
                    version: parsedVersion
                };
            }
        }
        return null;
    };

    const candidates = [payload?.result, payload?.data, payload];
    for (const candidate of candidates) {
        const parsed = extractFromCandidate(candidate, payload);
        if (parsed) {
            return parsed;
        }
    }
    return {
        items: [],
        version: String(payload?.version || 'unknown')
    };
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetchImpl(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}

export class McpKnowledgeResourceProvider extends KnowledgeResourceProvider {
    constructor({
        endpoint = '',
        server = 'circuit-knowledge',
        mode = 'method',
        methodName = 'knowledge.search',
        resourceName = 'knowledge://circuit/high-school',
        timeoutMs = 6000,
        fallbackProvider = new LocalKnowledgeResourceProvider(),
        fetchImpl = null
    } = {}) {
        super();
        this.endpoint = String(endpoint || '').trim();
        this.server = String(server || 'circuit-knowledge').trim();
        this.mode = normalizeMcpMode(mode);
        this.methodName = String(methodName || 'knowledge.search').trim() || 'knowledge.search';
        this.resourceName = String(resourceName || 'knowledge://circuit/high-school').trim() || 'knowledge://circuit/high-school';
        this.timeoutMs = Math.max(1000, Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : 6000);
        this.fallbackProvider = fallbackProvider;
        this.fetchImpl = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        this.metadata = {
            source: this.endpoint ? 'mcp' : 'mcp-fallback-local',
            version: 'unknown',
            detail: this.endpoint
                ? `${this.mode}:${this.mode === 'resource' ? this.resourceName : this.methodName} @ ${this.endpoint}`
                : 'MCP 未配置，使用本地规则库'
        };
    }

    getMetadata() {
        return { ...this.metadata };
    }

    async search(query = {}) {
        if (!this.endpoint || !this.fetchImpl) {
            return this.searchFallback(query, !this.endpoint ? 'MCP 未配置' : '运行环境不支持 fetch');
        }

        const body = {
            server: this.server,
            params: {
                question: String(query.question || ''),
                componentTypes: Array.isArray(query.componentTypes) ? query.componentTypes : [],
                limit: query.limit ?? 3
            }
        };
        if (this.mode === 'resource') {
            body.resource = this.resourceName;
        } else {
            body.method = this.methodName;
        }

        try {
            const response = await fetchWithTimeout(this.fetchImpl, this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }, this.timeoutMs);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            const parsed = parseMcpKnowledgeResponse(payload);
            const normalized = parsed.items
                .map((item, index) => normalizeKnowledgeItem(item, index))
                .filter(Boolean);

            if (normalized.length === 0) {
                return this.searchFallback(query, 'MCP 返回空结果');
            }

            this.metadata = {
                source: 'mcp',
                version: parsed.version || 'unknown',
                detail: `${this.mode}:${this.mode === 'resource' ? this.resourceName : this.methodName} @ ${this.endpoint}`
            };
            return normalized;
        } catch (error) {
            return this.searchFallback(query, `MCP 请求失败: ${error.message}`);
        }
    }

    async searchFallback(query, reason = '') {
        if (this.fallbackProvider && typeof this.fallbackProvider.search === 'function') {
            const items = await this.fallbackProvider.search(query);
            const fallbackMeta = typeof this.fallbackProvider.getMetadata === 'function'
                ? this.fallbackProvider.getMetadata()
                : { source: 'local', version: 'unknown', detail: '' };
            this.metadata = {
                source: 'mcp-fallback-local',
                version: fallbackMeta.version || 'unknown',
                detail: reason || '使用本地规则库'
            };
            return items;
        }
        this.metadata = {
            source: 'mcp',
            version: 'unknown',
            detail: reason || '无可用回退规则库'
        };
        return [];
    }
}
