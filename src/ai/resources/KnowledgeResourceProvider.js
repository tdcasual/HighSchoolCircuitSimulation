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

const DIAGNOSTIC_CATEGORY_PRIORITY = Object.freeze([
    'CONFLICTING_SOURCES',
    'SHORT_CIRCUIT',
    'SINGULAR_MATRIX',
    'INVALID_PARAMS',
    'FLOATING_SUBCIRCUIT'
]);

const DIAGNOSTIC_LESSON_COPY = Object.freeze({
    CONFLICTING_SOURCES: Object.freeze({
        id: 'diag-conflicting-sources',
        title: '故障学习提示：理想电压源冲突',
        category: 'topology',
        keywords: ['理想电压源', '并联冲突', '电压源冲突'],
        appliesTo: ['PowerSource', 'ACVoltageSource'],
        what: '检测到并联理想电压源给出了互相矛盾的约束，仿真已停止。',
        why: '理想电压源会强制端电压；当同一节点对被不同电压同时约束时，方程组无解。',
        fix: '保留一个主电源；其余电源改为串联或增加内阻后再并联；重新运行确认冲突消失。'
    }),
    SHORT_CIRCUIT: Object.freeze({
        id: 'diag-short-circuit',
        title: '故障学习提示：电源短路',
        category: 'topology',
        keywords: ['短路', '零阻路径', '电源回接'],
        appliesTo: ['PowerSource', 'ACVoltageSource', 'Wire'],
        what: '检测到电源近似零阻路径，仿真已触发短路保护。',
        why: '理想电源被低阻导线直接回接，会让电流理论值异常增大，方程不再稳定。',
        fix: '先断开短接导线；再在电源回路串联负载或限流电阻；重新运行并确认短路高亮消失。'
    }),
    SINGULAR_MATRIX: Object.freeze({
        id: 'diag-singular-matrix',
        title: '故障学习提示：方程奇异',
        category: 'topology',
        keywords: ['矩阵奇异', '方程不可解', '无参考地'],
        appliesTo: ['Ground', 'PowerSource', 'Resistor'],
        what: '当前电路约束不足或互相矛盾，求解矩阵出现奇异。',
        why: '常见原因是缺少参考地、回路断裂，或理想源约束重复导致自由度异常。',
        fix: '先补充参考地与闭合回路；再检查理想源连接方式；必要时加入小电阻稳定方程。'
    }),
    INVALID_PARAMS: Object.freeze({
        id: 'diag-invalid-params',
        title: '故障学习提示：参数非法',
        category: 'misconception',
        keywords: ['参数错误', 'NaN', '非法值'],
        appliesTo: ['Resistor', 'Capacitor', 'Inductor', 'PowerSource'],
        what: '检测到元件参数超出允许范围，仿真已阻止继续计算。',
        why: '无效数值（空值、NaN、负阻等）会破坏元件模型，导致结果失真或发散。',
        fix: '恢复异常元件为默认参数，再按量纲逐项检查输入值并重新运行。'
    }),
    FLOATING_SUBCIRCUIT: Object.freeze({
        id: 'diag-floating-subcircuit',
        title: '故障学习提示：悬浮子电路',
        category: 'topology',
        keywords: ['悬浮', '未接地', '参考依赖'],
        appliesTo: ['Ground', 'Voltmeter', 'Ammeter'],
        what: '检测到局部子电路未连接参考地，读数可能依赖参考选择。',
        why: '悬浮网络电压只确定相对差值，绝对电位缺少统一基准。',
        fix: '为该子电路补充参考地或与主回路建立连接；教学展示时需明确参考条件。'
    })
});

function normalizeDiagnosticCode(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeRuntimeDiagnostics(raw = null) {
    if (!raw || typeof raw !== 'object') {
        return {
            code: '',
            categories: [],
            summary: '',
            hints: []
        };
    }

    const code = normalizeDiagnosticCode(raw.code);
    const categories = uniqueStrings(Array.isArray(raw.categories) ? raw.categories : [])
        .map(normalizeDiagnosticCode)
        .filter(Boolean);
    if (code && !categories.includes(code)) {
        categories.unshift(code);
    }

    const ordered = DIAGNOSTIC_CATEGORY_PRIORITY.filter((item) => categories.includes(item));
    const extras = categories
        .filter((item) => !DIAGNOSTIC_CATEGORY_PRIORITY.includes(item))
        .sort();

    return {
        code: code || ordered[0] || '',
        categories: [...ordered, ...extras],
        summary: String(raw.summary || '').trim(),
        hints: uniqueStrings(Array.isArray(raw.hints) ? raw.hints : []).slice(0, 4)
    };
}

function buildGenericDiagnosticLessonEntry(runtimeDiagnostics = {}) {
    const codeSignal = normalizeDiagnosticCode(runtimeDiagnostics.code);
    const categorySignal = normalizeDiagnosticCode(runtimeDiagnostics.categories?.[0]);
    const summary = String(runtimeDiagnostics.summary || '').trim();
    const hints = uniqueStrings(Array.isArray(runtimeDiagnostics.hints) ? runtimeDiagnostics.hints : []);
    const hasSignals = Boolean(codeSignal || categorySignal || summary || hints.length > 0);
    if (!hasSignals) return null;
    const primaryCode = codeSignal || categorySignal || 'RUNTIME_DIAGNOSTIC';

    const what = summary || `检测到 ${primaryCode}，当前电路存在需要进一步定位的异常。`;
    const why = '当前诊断上下文不完整，但可确定电路约束、拓扑连接或元件参数存在不一致。';
    const fixHints = hints.slice(0, 2);
    const fix = fixHints.length > 0
        ? `${fixHints.join('；')}。`
        : '按“电源-负载-回路-参考地”顺序逐项排查，并在每次改动后重新仿真确认。';
    const normalizedIdSuffix = primaryCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return {
        id: `diag-generic-${normalizedIdSuffix || 'runtime'}`,
        title: '故障学习提示：运行时诊断',
        category: 'topology',
        keywords: uniqueStrings([primaryCode, '运行时诊断', '故障排查']),
        appliesTo: [],
        content: `发生了什么：${what}\n为什么会这样：${why}\n如何修复：${fix}`
    };
}

function buildDiagnosticLessonEntries(runtimeDiagnostics, limit = 3) {
    const safeLimit = Math.max(0, Number.isFinite(Number(limit)) ? Number(limit) : 3);
    if (safeLimit === 0) return [];
    if (!runtimeDiagnostics || !Array.isArray(runtimeDiagnostics.categories)) return [];

    const selected = [];
    const selectedIds = new Set();
    for (const category of runtimeDiagnostics.categories) {
        const template = DIAGNOSTIC_LESSON_COPY[category];
        if (!template) continue;
        if (selectedIds.has(template.id)) continue;
        selected.push({
            id: template.id,
            title: template.title,
            category: template.category,
            keywords: [...template.keywords],
            appliesTo: [...template.appliesTo],
            content: `发生了什么：${template.what}\n为什么会这样：${template.why}\n如何修复：${template.fix}`
        });
        selectedIds.add(template.id);
        if (selected.length >= safeLimit) break;
    }

    if (selected.length === 0) {
        const generic = buildGenericDiagnosticLessonEntry(runtimeDiagnostics);
        if (generic) {
            selected.push(generic);
        }
    }

    return selected;
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
        const runtimeDiagnostics = normalizeRuntimeDiagnostics(query.runtimeDiagnostics);
        const diagnosticEntries = buildDiagnosticLessonEntries(runtimeDiagnostics, limit);
        const remainingLimit = Math.max(0, limit - diagnosticEntries.length);

        const scored = this.entries
            .map(entry => ({ entry, score: calcScore(entry, normalizedQuestion, componentTypes) }))
            .sort((left, right) => {
                if (right.score !== left.score) return right.score - left.score;
                return String(left.entry.id).localeCompare(String(right.entry.id));
            });

        let selected = [];
        if (remainingLimit > 0) {
            selected = selectBalancedEntries(scored.filter(item => item.score > 0), remainingLimit);
            if (selected.length === 0) {
                selected = this.entries
                    .filter(entry => this.fallbackIds.includes(entry.id))
                    .slice(0, remainingLimit);
            }
        }

        const merged = [...diagnosticEntries, ...selected].slice(0, limit);
        return merged.map(entry => ({
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
                limit: query.limit ?? 3,
                runtimeDiagnostics: query.runtimeDiagnostics || null
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
