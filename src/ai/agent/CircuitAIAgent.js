/**
 * CircuitAIAgent.js - orchestrates AI calls with reusable local skills
 */

import { SkillRegistry } from '../skills/SkillRegistry.js';
import { CircuitSnapshotSkill } from '../skills/CircuitSnapshotSkill.js';
import { KnowledgeRetrievalSkill } from '../skills/KnowledgeRetrievalSkill.js';
import { ClaimExtractSkill } from '../skills/ClaimExtractSkill.js';
import { NumericCheckSkill } from '../skills/NumericCheckSkill.js';
import { AnswerVerifySkill } from '../skills/AnswerVerifySkill.js';
import { QuestionPlanningSkill } from '../skills/QuestionPlanningSkill.js';
import { SimulationRefreshSkill } from '../skills/SimulationRefreshSkill.js';
import { LocalKnowledgeResourceProvider } from '../resources/KnowledgeResourceProvider.js';

const DEFAULT_CHAT_TURNS = 4;
const DEFAULT_KNOWLEDGE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_KNOWLEDGE_CACHE_LIMIT = 120;
const DEFAULT_KNOWLEDGE_ACCESS_LOG_LIMIT = 80;

export class CircuitAIAgent {
    constructor({
        aiClient,
        explainer,
        circuit = null,
        knowledgeProvider = null,
        skillRegistry = null,
        logger = null,
        knowledgeCacheTtlMs = DEFAULT_KNOWLEDGE_CACHE_TTL_MS,
        knowledgeCacheLimit = DEFAULT_KNOWLEDGE_CACHE_LIMIT,
        knowledgeAccessLogLimit = DEFAULT_KNOWLEDGE_ACCESS_LOG_LIMIT
    } = {}) {
        if (!aiClient) {
            throw new Error('CircuitAIAgent requires aiClient');
        }
        this.aiClient = aiClient;
        this.logger = logger || aiClient?.logger || null;
        this.explainer = explainer || null;
        this.circuit = circuit || explainer?.circuit || null;
        this.knowledgeProvider = knowledgeProvider || new LocalKnowledgeResourceProvider();
        this.skills = skillRegistry || this.createDefaultSkillRegistry();
        this.knowledgeCacheTtlMs = Math.max(1000, Number.isFinite(Number(knowledgeCacheTtlMs))
            ? Number(knowledgeCacheTtlMs)
            : DEFAULT_KNOWLEDGE_CACHE_TTL_MS);
        this.knowledgeCacheLimit = Math.max(10, Number.isFinite(Number(knowledgeCacheLimit))
            ? Number(knowledgeCacheLimit)
            : DEFAULT_KNOWLEDGE_CACHE_LIMIT);
        this.knowledgeCache = new Map();
        this.knowledgeAccessLogLimit = Math.max(10, Number.isFinite(Number(knowledgeAccessLogLimit))
            ? Number(knowledgeAccessLogLimit)
            : DEFAULT_KNOWLEDGE_ACCESS_LOG_LIMIT);
        this.knowledgeAccessLog = [];
        this.knowledgeMetrics = {
            requests: 0,
            cacheHits: 0,
            providerQueries: 0,
            fallbackQueries: 0
        };
        this.knowledgeCacheProviderToken = this.getKnowledgeProviderToken();
    }

    setLogger(logger) {
        this.logger = logger || null;
        if (this.aiClient && typeof this.aiClient.setLogger === 'function') {
            this.aiClient.setLogger(this.logger);
        }
    }

    createDefaultSkillRegistry() {
        return new SkillRegistry([
            CircuitSnapshotSkill,
            KnowledgeRetrievalSkill,
            ClaimExtractSkill,
            NumericCheckSkill,
            AnswerVerifySkill,
            QuestionPlanningSkill,
            SimulationRefreshSkill
        ]);
    }

    setKnowledgeProvider(provider) {
        this.knowledgeProvider = provider || new LocalKnowledgeResourceProvider();
        this.invalidateKnowledgeCache('provider-changed');
        this.knowledgeAccessLog = [];
        this.knowledgeMetrics = {
            requests: 0,
            cacheHits: 0,
            providerQueries: 0,
            fallbackQueries: 0
        };
    }

    getKnowledgeStats() {
        const requests = Number(this.knowledgeMetrics?.requests || 0);
        const cacheHits = Number(this.knowledgeMetrics?.cacheHits || 0);
        const providerQueries = Number(this.knowledgeMetrics?.providerQueries || 0);
        const fallbackQueries = Number(this.knowledgeMetrics?.fallbackQueries || 0);
        const cacheHitRate = requests > 0 ? cacheHits / requests : 0;
        return {
            requests,
            cacheHits,
            providerQueries,
            fallbackQueries,
            cacheHitRate
        };
    }

    recordKnowledgeAccess(event = {}) {
        const normalized = {
            time: Date.now(),
            query: String(event.query || '').slice(0, 160),
            source: String(event.source || 'unknown'),
            cache: !!event.cache,
            count: Number.isFinite(Number(event.count)) ? Number(event.count) : 0,
            note: String(event.note || '')
        };
        this.knowledgeAccessLog.push(normalized);
        while (this.knowledgeAccessLog.length > this.knowledgeAccessLogLimit) {
            this.knowledgeAccessLog.shift();
        }
    }

    getKnowledgeAccessLog(limit = 20) {
        const max = Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 20);
        return this.knowledgeAccessLog.slice(-max).map(item => ({ ...item }));
    }

    getKnowledgeMetadata() {
        const stats = this.getKnowledgeStats();
        if (!this.knowledgeProvider || typeof this.knowledgeProvider.getMetadata !== 'function') {
            return {
                source: 'unknown',
                version: 'unknown',
                detail: '',
                cacheSize: this.knowledgeCache.size,
                knowledgeRequests: stats.requests,
                cacheHits: stats.cacheHits,
                cacheHitRate: stats.cacheHitRate
            };
        }
        return {
            ...this.knowledgeProvider.getMetadata(),
            cacheSize: this.knowledgeCache.size,
            knowledgeRequests: stats.requests,
            cacheHits: stats.cacheHits,
            cacheHitRate: stats.cacheHitRate
        };
    }

    getKnowledgeProviderToken() {
        const metadata = this.getKnowledgeMetadata();
        return `${metadata.source || 'unknown'}|${metadata.version || 'unknown'}|${metadata.detail || ''}`;
    }

    invalidateKnowledgeCache(_reason = 'manual') {
        this.knowledgeCache.clear();
        this.knowledgeCacheProviderToken = this.getKnowledgeProviderToken();
    }

    normalizeCacheQuestion(question) {
        return String(question || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .slice(0, 300);
    }

    extractComponentTypes(circuit = this.circuit) {
        if (!circuit || !(circuit.components instanceof Map)) return [];
        return [...new Set(
            Array.from(circuit.components.values())
                .map(component => component?.type)
                .filter(Boolean)
        )].sort();
    }

    buildKnowledgeCacheKey({ question, componentTypes = [], limit = 3 } = {}) {
        const normalizedQuestion = this.normalizeCacheQuestion(question);
        const normalizedTypes = [...new Set(componentTypes.map(type => String(type || '').trim()).filter(Boolean))]
            .sort()
            .join(',');
        return `${normalizedQuestion}|${normalizedTypes}|${limit}`;
    }

    pruneKnowledgeCache(nowMs = Date.now()) {
        for (const [key, entry] of this.knowledgeCache.entries()) {
            if (!entry || entry.expiresAt <= nowMs) {
                this.knowledgeCache.delete(key);
            }
        }

        if (this.knowledgeCache.size <= this.knowledgeCacheLimit) return;
        const ordered = [...this.knowledgeCache.entries()]
            .sort((left, right) => (left[1].createdAt || 0) - (right[1].createdAt || 0));
        while (ordered.length > this.knowledgeCacheLimit) {
            const oldest = ordered.shift();
            if (oldest) {
                this.knowledgeCache.delete(oldest[0]);
            }
        }
    }

    async getKnowledgeItems(question, { limit = 3, circuit = this.circuit } = {}) {
        const componentTypes = this.extractComponentTypes(circuit);
        const providerTokenBefore = this.getKnowledgeProviderToken();
        if (providerTokenBefore !== this.knowledgeCacheProviderToken) {
            this.invalidateKnowledgeCache('provider-token-updated');
        }
        this.knowledgeMetrics.requests += 1;
        const queryText = String(question || '').trim();

        const now = Date.now();
        this.pruneKnowledgeCache(now);

        const cacheKey = this.buildKnowledgeCacheKey({
            question,
            componentTypes,
            limit
        });
        const cached = this.knowledgeCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            this.knowledgeMetrics.cacheHits += 1;
            this.recordKnowledgeAccess({
                query: queryText,
                source: 'cache',
                cache: true,
                count: cached.items.length
            });
            return cached.items.map(item => ({ ...item }));
        }

        this.knowledgeMetrics.providerQueries += 1;
        const items = await this.skills.run('knowledge_retrieve', {
            provider: this.knowledgeProvider,
            question,
            circuit,
            componentTypes,
            limit
        }, {
            knowledgeProvider: this.knowledgeProvider,
            circuit
        });
        const normalizedItems = Array.isArray(items)
            ? items.filter(Boolean).map(item => ({ ...item }))
            : [];
        const providerMetadata = (this.knowledgeProvider && typeof this.knowledgeProvider.getMetadata === 'function')
            ? this.knowledgeProvider.getMetadata()
            : { source: 'unknown' };
        if (String(providerMetadata?.source || '').includes('fallback')) {
            this.knowledgeMetrics.fallbackQueries += 1;
        }
        this.recordKnowledgeAccess({
            query: queryText,
            source: providerMetadata?.source || 'unknown',
            cache: false,
            count: normalizedItems.length
        });

        const providerTokenAfter = this.getKnowledgeProviderToken();
        if (providerTokenAfter !== this.knowledgeCacheProviderToken) {
            this.invalidateKnowledgeCache('provider-token-refreshed');
        }

        this.knowledgeCache.set(cacheKey, {
            items: normalizedItems,
            createdAt: now,
            expiresAt: now + this.knowledgeCacheTtlMs
        });
        this.pruneKnowledgeCache(now);

        return normalizedItems;
    }

    getConversationContext(history = [], maxTurns = DEFAULT_CHAT_TURNS) {
        if (!Array.isArray(history) || history.length === 0) return [];
        const maxMessages = Math.max(1, maxTurns) * 2;
        return history
            .filter(item => item
                && (item.role === 'user' || item.role === 'assistant')
                && typeof item.content === 'string'
                && item.content.trim())
            .slice(-maxMessages)
            .map(item => ({ role: item.role, content: item.content.trim() }));
    }

    buildKnowledgeReferenceSection(knowledgeItems = []) {
        if (!Array.isArray(knowledgeItems) || knowledgeItems.length === 0) {
            return '';
        }
        const lines = knowledgeItems
            .filter(item => item && item.title && item.content)
            .map((item, index) => `${index + 1}. ${item.title}：${item.content}`);
        if (lines.length === 0) return '';
        return `\n\n教学参考要点（用于校正推理，不要逐字复述）：\n${lines.join('\n')}`;
    }

    collectRelevantComponents(question = '', limit = 6) {
        if (!this.circuit || !(this.circuit.components instanceof Map)) return [];
        const normalizedQuestion = String(question || '').toUpperCase();
        const allComponents = Array.from(this.circuit.components.values()).filter(Boolean);
        const scored = allComponents.map(component => {
            const label = String(component.label || component.id || '').toUpperCase();
            const id = String(component.id || '').toUpperCase();
            const mentionScore = label && normalizedQuestion.includes(label)
                ? 3
                : (id && normalizedQuestion.includes(id) ? 2 : 0);
            const numericWeight = Math.abs(Number(component.powerValue || 0))
                + Math.abs(Number(component.voltageValue || 0))
                + Math.abs(Number(component.currentValue || 0));
            return {
                component,
                score: mentionScore * 1000 + numericWeight
            };
        }).sort((left, right) => right.score - left.score);
        return scored.slice(0, Math.max(1, limit)).map(item => item.component);
    }

    buildEvidenceSection(question = '', limit = 6) {
        const components = this.collectRelevantComponents(question, limit);
        if (!components.length) return '';
        const lines = [];
        for (const component of components) {
            const label = component.label || component.id;
            const current = Math.abs(Number(component.currentValue || 0)).toFixed(3);
            const voltage = Math.abs(Number(component.voltageValue || 0)).toFixed(3);
            const power = Math.abs(Number(component.powerValue || 0)).toFixed(3);
            lines.push(`- ${label}(${component.type}): I=${current}A, U=${voltage}V, P=${power}W`);
        }
        return `\n\n仿真证据快照（优先引用以下数值）：\n${lines.join('\n')}`;
    }

    buildPlanSection(plan = {}) {
        const steps = Array.isArray(plan.steps) ? plan.steps : [];
        if (!steps.length) return '';
        return `\n\n回答流程提示：${steps.join(' -> ')}`;
    }

    logEvent(level, stage, data = null, traceId = '') {
        if (!this.logger || typeof this.logger.log !== 'function') return;
        this.logger.log({
            level,
            source: 'ai_agent',
            stage,
            traceId,
            message: stage,
            data
        });
    }

    buildTutorSystemPrompt(circuitState, knowledgeItems = [], plan = {}, evidenceSection = '') {
        return `你是一名高中物理电路老师，请基于给定电路状态进行可靠讲解。
要求：
- 严格使用高中范围：欧姆定律、串并联、功率、电荷守恒、能量守恒。
- 必须按以下结构输出：结论、推理步骤、关键证据值、公式依据、自检题。
- “关键证据值”至少给 2 条，必须带单位，并注明对应元件（如 R1、E1）。
- “公式依据”至少写 1 条，并说明每个变量的物理量含义。
- 先给一句结论，再给 3-5 步推理，每步要有物理依据。
- 优先使用给定拓扑与节点映射，不要凭空假设串并联关系。
- 若信息不足，先明确假设再计算，并说明假设影响。
- 关键数值给出单位，保留 2-3 位有效数字。
- 最后给 1-2 个简短检查题（选择或填空）帮助学生自测。
- 输出使用 Markdown。
- 优先给出与问题相关元件的电流/电压/功率证据值，不要泛泛而谈。

当前电路状态：
${circuitState}${evidenceSection}${this.buildKnowledgeReferenceSection(knowledgeItems)}${this.buildPlanSection(plan)}`;
    }

    buildFallbackAnswer({
        question = '',
        plan = {},
        refreshResult = null,
        evidenceSection = '',
        knowledgeItems = [],
        error = null
    } = {}) {
        const reason = error ? `模型调用失败：${error.message}` : '模型调用不可用';
        const planMode = plan?.mode || 'unknown';
        const evidence = evidenceSection
            ? evidenceSection.replace(/^\n+/, '')
            : '仿真证据快照（优先引用以下数值）：\n- 当前未提取到可用证据。';
        const knowledgeLines = (knowledgeItems || [])
            .slice(0, 3)
            .map((item, index) => `${index + 1}. ${item.title}：${item.content}`);
        const knowledgeBlock = knowledgeLines.length > 0
            ? `\n\n可参考规则：\n${knowledgeLines.join('\n')}`
            : '';
        const refreshNote = refreshResult
            ? `仿真刷新：${refreshResult.valid ? '成功' : `失败（${refreshResult.reason || 'unknown'}）`}`
            : '仿真刷新：未执行';

        return `## 结论
当前进入离线保底回答路径，以下基于电路仿真实时数值与规则库给出可验证说明。

## 推理步骤
1. 识别问题类型：${planMode}。
2. ${refreshNote}。
3. 结合元件读数与拓扑关系给出结论，优先使用欧姆定律与串并联规则。

## 关键证据值
${evidence}

## 公式依据
- 欧姆定律：\\(I=\\frac{U}{R}\\)。
- 功率关系：\\(P=UI\\) 或 \\(P=I^2R\\)。

## 备注
- ${reason}
- 原问题：${question}${knowledgeBlock}`;
    }

    async answerQuestion({ question, history = [], traceId = '' } = {}) {
        const normalizedQuestion = String(question || '').trim();
        if (!normalizedQuestion) {
            throw new Error('问题不能为空');
        }
        const startedAt = Date.now();
        this.logEvent('info', 'answer_question_start', {
            questionPreview: normalizedQuestion.slice(0, 160),
            historyCount: Array.isArray(history) ? history.length : 0
        }, traceId);

        const planStart = Date.now();
        const plan = await this.skills.run('question_plan', {
            question: normalizedQuestion
        }, {
            circuit: this.circuit
        });
        this.logEvent('info', 'question_plan_ready', {
            mode: plan?.mode || 'unknown',
            requiresNumericVerification: !!plan?.requiresNumericVerification,
            durationMs: Date.now() - planStart
        }, traceId);

        const refreshStart = Date.now();
        const refreshResult = await this.skills.run('simulation_refresh', {
            circuit: this.circuit
        }, {
            circuit: this.circuit
        });
        this.logEvent(refreshResult?.valid ? 'info' : 'warn', 'simulation_refresh_done', {
            valid: !!refreshResult?.valid,
            reason: refreshResult?.reason || 'unknown',
            durationMs: Date.now() - refreshStart
        }, traceId);

        const snapshotStart = Date.now();
        const circuitState = await this.skills.run('circuit_snapshot', {
            explainer: this.explainer,
            concise: false,
            includeTopology: plan?.includeTopology !== false,
            includeNodes: true
        }, { explainer: this.explainer });
        this.logEvent('info', 'circuit_snapshot_ready', {
            chars: String(circuitState || '').length,
            durationMs: Date.now() - snapshotStart
        }, traceId);
        const evidenceSection = this.buildEvidenceSection(normalizedQuestion, plan?.evidenceLimit || 6);

        const knowledgeStart = Date.now();
        const knowledgeItems = await this.getKnowledgeItems(normalizedQuestion, {
            limit: plan?.knowledgeLimit || 3,
            circuit: this.circuit
        });
        this.logEvent('info', 'knowledge_items_ready', {
            count: Array.isArray(knowledgeItems) ? knowledgeItems.length : 0,
            durationMs: Date.now() - knowledgeStart
        }, traceId);

        const messages = [
            { role: 'system', content: this.buildTutorSystemPrompt(circuitState, knowledgeItems, plan, evidenceSection) },
            ...this.getConversationContext(history),
            { role: 'user', content: normalizedQuestion }
        ];

        let answer;
        try {
            this.logEvent('info', 'model_call_start', {
                model: this.aiClient.config.textModel,
                messageCount: messages.length
            }, traceId);
            answer = await this.aiClient.callAPI(messages, this.aiClient.config.textModel, 1500, {
                traceId,
                source: 'ai_agent.answer_question'
            });
            this.logEvent('info', 'model_call_success', {
                model: this.aiClient.config.textModel,
                answerChars: String(answer || '').length
            }, traceId);
        } catch (error) {
            this.logEvent('error', 'model_call_failed', {
                error: error?.message || String(error)
            }, traceId);
            const fallbackAnswer = this.buildFallbackAnswer({
                question: normalizedQuestion,
                plan,
                refreshResult,
                evidenceSection,
                knowledgeItems,
                error
            });
            this.logEvent('warn', 'fallback_answer_returned', {
                reason: error?.message || 'model_call_failed',
                durationMs: Date.now() - startedAt
            }, traceId);
            return fallbackAnswer;
        }
        try {
            const claims = await this.skills.run('claim_extract', {
                answer,
                circuit: this.circuit
            }, {
                circuit: this.circuit
            });
            if (plan?.requiresNumericVerification) {
                const checks = await this.skills.run('numeric_check', {
                    claims,
                    circuit: this.circuit
                }, {
                    circuit: this.circuit
                });
                const verified = await this.skills.run('answer_verify', {
                    answer,
                    checks
                });
                this.logEvent('info', 'answer_verify_done', {
                    checkCount: Array.isArray(checks) ? checks.length : 0,
                    durationMs: Date.now() - startedAt
                }, traceId);
                return verified;
            }
            this.logEvent('info', 'answer_question_done', {
                durationMs: Date.now() - startedAt
            }, traceId);
            return answer;
        } catch (error) {
            this.logEvent('warn', 'answer_post_process_failed', {
                error: error?.message || String(error),
                durationMs: Date.now() - startedAt
            }, traceId);
            return answer;
        }
    }
}
