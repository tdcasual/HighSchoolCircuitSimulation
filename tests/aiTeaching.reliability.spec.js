import { describe, expect, it, vi } from 'vitest';
import { LocalKnowledgeResourceProvider } from '../src/ai/resources/KnowledgeResourceProvider.js';
import { CircuitAIAgent } from '../src/ai/agent/CircuitAIAgent.js';

describe('AI teaching reliability', () => {
    it('produces stable what-why-how structure for canonical failure categories', async () => {
        const provider = new LocalKnowledgeResourceProvider();
        const categories = [
            'CONFLICTING_SOURCES',
            'SHORT_CIRCUIT',
            'SINGULAR_MATRIX',
            'INVALID_PARAMS',
            'FLOATING_SUBCIRCUIT'
        ];

        for (const category of categories) {
            const results = await provider.search({
                question: '为什么仿真失败？',
                runtimeDiagnostics: {
                    code: category,
                    categories: [category],
                    summary: `${category} summary`,
                    hints: ['hint-a', 'hint-b']
                },
                limit: 1
            });

            expect(results).toHaveLength(1);
            expect(results[0].id).toMatch(/^diag-/);
            expect(results[0].content).toContain('发生了什么：');
            expect(results[0].content).toContain('为什么会这样：');
            expect(results[0].content).toContain('如何修复：');
        }
    });

    it('falls back to deterministic what-why-how copy when diagnostic context is partial', async () => {
        const provider = new LocalKnowledgeResourceProvider();
        const results = await provider.search({
            question: '为什么失败？',
            runtimeDiagnostics: {
                summary: '求解器报告未知异常',
                hints: ['检查参考地连接']
            },
            limit: 1
        });

        expect(results).toHaveLength(1);
        expect(results[0].id).toMatch(/^diag-generic-/);
        expect(results[0].content).toContain('发生了什么：求解器报告未知异常');
        expect(results[0].content).toContain('为什么会这样：');
        expect(results[0].content).toContain('如何修复：检查参考地连接');
    });

    it('injects diagnostic fallback guidance into tutor prompt when provider returns no entries', async () => {
        const callAPI = vi.fn().mockResolvedValue('解释完成。');
        const aiClient = {
            config: {
                apiKey: 'test-key',
                textModel: 'gpt-test'
            },
            callAPI
        };
        const explainer = {
            extractCircuitState: vi.fn().mockReturnValue('mock-circuit')
        };
        const runtimeDiagnostics = {
            code: '',
            categories: [],
            summary: '求解器报告未知异常',
            hints: ['检查参考地连接']
        };
        const circuit = {
            dt: 0.01,
            simTime: 0,
            components: new Map(),
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            solver: {
                solve: vi.fn().mockReturnValue({
                    valid: false,
                    voltages: [0],
                    currents: new Map(),
                    runtimeDiagnostics
                }),
                updateDynamicComponents: vi.fn()
            }
        };
        const knowledgeProvider = {
            search: vi.fn().mockResolvedValue([]),
            getMetadata: vi.fn().mockReturnValue({ source: 'local', version: 'v1', detail: 'local' })
        };
        const agent = new CircuitAIAgent({ aiClient, explainer, circuit, knowledgeProvider });

        await agent.answerQuestion({
            question: '为什么仿真失败？',
            history: []
        });

        expect(callAPI).toHaveBeenCalledTimes(1);
        const [messages] = callAPI.mock.calls[0];
        const systemPrompt = String(messages[0]?.content || '');
        expect(systemPrompt).toContain('故障学习提示（保底）');
        expect(systemPrompt).toContain('发生了什么：求解器报告未知异常');
        expect(systemPrompt).toContain('为什么会这样：');
        expect(systemPrompt).toContain('如何修复：检查参考地连接');
    });
});
