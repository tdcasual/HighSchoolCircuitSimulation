import { describe, it, expect, vi } from 'vitest';
import { CircuitAIAgent } from '../src/ai/agent/CircuitAIAgent.js';

describe('CircuitAIAgent', () => {
    it('injects circuit snapshot and chat history for answer requests', async () => {
        const callAPI = vi.fn().mockResolvedValue('R1 电流约 0.300A。');
        const aiClient = {
            config: {
                apiKey: 'test-key',
                textModel: 'gpt-test'
            },
            callAPI
        };
        const explainer = {
            extractCircuitState: vi.fn().mockReturnValue('节点1: R1:0, E1:1')
        };
        const circuit = {
            components: new Map([
                ['r1', {
                    id: 'Resistor_1',
                    label: 'R1',
                    type: 'Resistor',
                    currentValue: 0.3,
                    voltageValue: 2.4,
                    powerValue: 0.72
                }]
            ])
        };
        const knowledgeProvider = {
            search: vi.fn().mockResolvedValue([
                {
                    id: 'k1',
                    title: '测试知识点',
                    content: '这是一条用于校正推理的知识。'
                }
            ])
        };

        const agent = new CircuitAIAgent({ aiClient, explainer, circuit, knowledgeProvider });
        const history = [
            { role: 'system', content: '提示' },
            { role: 'user', content: '上一个问题' },
            { role: 'assistant', content: '上一个回答' }
        ];

        const answer = await agent.answerQuestion({
            question: '现在电流是多少？',
            history
        });

        expect(answer).toContain('R1 电流约 0.300A');
        expect(answer).toContain('### 数值核对');
        expect(answer).toContain('[通过]');
        expect(callAPI).toHaveBeenCalledTimes(1);
        const [messages, model, maxTokens] = callAPI.mock.calls[0];
        expect(model).toBe('gpt-test');
        expect(maxTokens).toBe(1500);
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toContain('节点1: R1:0, E1:1');
        expect(messages[0].content).toContain('测试知识点');
        expect(knowledgeProvider.search).toHaveBeenCalledTimes(1);
        expect(messages[1]).toEqual({ role: 'user', content: '上一个问题' });
        expect(messages[2]).toEqual({ role: 'assistant', content: '上一个回答' });
        expect(messages[messages.length - 1]).toEqual({ role: 'user', content: '现在电流是多少？' });
    });

    it('caches knowledge retrieval for repeated same question', async () => {
        const callAPI = vi.fn().mockResolvedValue('AI答复');
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
        const knowledgeProvider = {
            search: vi.fn().mockResolvedValue([{ id: 'k1', title: 'K1', content: '知识1' }]),
            getMetadata: vi.fn().mockReturnValue({ source: 'local', version: 'v1', detail: 'local' })
        };
        const agent = new CircuitAIAgent({
            aiClient,
            explainer,
            knowledgeProvider,
            knowledgeCacheTtlMs: 60_000
        });

        await agent.answerQuestion({ question: '电压表为什么并联？', history: [] });
        await agent.answerQuestion({ question: '电压表为什么并联？', history: [] });

        expect(knowledgeProvider.search).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache when provider version changes', async () => {
        const callAPI = vi.fn().mockResolvedValue('AI答复');
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
        let version = 'v1';
        const knowledgeProvider = {
            search: vi.fn().mockResolvedValue([{ id: 'k1', title: 'K1', content: '知识1' }]),
            getMetadata: vi.fn(() => ({ source: 'mcp', version, detail: 'http://mcp.local' }))
        };
        const agent = new CircuitAIAgent({
            aiClient,
            explainer,
            knowledgeProvider,
            knowledgeCacheTtlMs: 60_000
        });

        await agent.answerQuestion({ question: '滑动变阻器怎么影响电流？', history: [] });
        version = 'v2';
        await agent.answerQuestion({ question: '滑动变阻器怎么影响电流？', history: [] });

        expect(knowledgeProvider.search).toHaveBeenCalledTimes(2);
    });

    it('returns deterministic fallback answer when model call fails', async () => {
        const aiClient = {
            config: {
                apiKey: 'test-key',
                textModel: 'gpt-test'
            },
            callAPI: vi.fn().mockRejectedValue(new Error('network down')),
        };
        const explainer = {
            extractCircuitState: vi.fn().mockReturnValue('mock-circuit-state')
        };
        const circuit = {
            dt: 0.01,
            simTime: 0,
            components: new Map([
                ['r1', {
                    id: 'Resistor_1',
                    label: 'R1',
                    type: 'Resistor',
                    currentValue: 0.2,
                    voltageValue: 2,
                    powerValue: 0.4
                }]
            ]),
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            solver: {
                solve: vi.fn().mockReturnValue({ valid: true, voltages: [0], currents: new Map() }),
                updateDynamicComponents: vi.fn()
            }
        };
        const agent = new CircuitAIAgent({ aiClient, explainer, circuit });

        const answer = await agent.answerQuestion({
            question: 'R1 电流是多少？',
            history: []
        });

        expect(answer).toContain('离线保底回答路径');
        expect(answer).toContain('关键证据值');
    });

    it('tracks knowledge cache hit rate and access log', async () => {
        const callAPI = vi.fn().mockResolvedValue('R1 电流约 0.300A。');
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
        const circuit = {
            dt: 0.01,
            simTime: 0,
            components: new Map([
                ['r1', {
                    id: 'Resistor_1',
                    label: 'R1',
                    type: 'Resistor',
                    currentValue: 0.3,
                    voltageValue: 2.4,
                    powerValue: 0.72
                }]
            ]),
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            solver: {
                solve: vi.fn().mockReturnValue({ valid: true, voltages: [0], currents: new Map() }),
                updateDynamicComponents: vi.fn()
            }
        };
        const knowledgeProvider = {
            search: vi.fn().mockResolvedValue([{ id: 'k1', title: 'K1', content: '知识1' }]),
            getMetadata: vi.fn().mockReturnValue({ source: 'local', version: 'v1', detail: 'local' })
        };
        const agent = new CircuitAIAgent({
            aiClient,
            explainer,
            circuit,
            knowledgeProvider,
            knowledgeCacheTtlMs: 60_000
        });

        await agent.answerQuestion({ question: 'R1 电流是多少？', history: [] });
        await agent.answerQuestion({ question: 'R1 电流是多少？', history: [] });

        const metadata = agent.getKnowledgeMetadata();
        expect(metadata.knowledgeRequests).toBe(2);
        expect(metadata.cacheHits).toBe(1);
        expect(metadata.cacheHitRate).toBeCloseTo(0.5, 5);
        const logs = agent.getKnowledgeAccessLog(5);
        expect(logs.length).toBeGreaterThan(0);
    });
});
