import { describe, it, expect } from 'vitest';
import { LocalKnowledgeResourceProvider } from '../src/ai/resources/KnowledgeResourceProvider.js';

describe('LocalKnowledgeResourceProvider', () => {
    it('returns highly relevant items by question keyword and component type', async () => {
        const provider = new LocalKnowledgeResourceProvider();
        const results = await provider.search({
            question: '电压表为什么必须并联？读数怎么理解？',
            componentTypes: ['Voltmeter', 'Resistor'],
            limit: 3
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].id).toBe('voltmeter-rule');
    });

    it('falls back to baseline knowledge when no keyword matches', async () => {
        const provider = new LocalKnowledgeResourceProvider();
        const results = await provider.search({
            question: '这是一句没有任何电学关键词的话',
            componentTypes: [],
            limit: 2
        });

        expect(results).toHaveLength(2);
        expect(results[0].id).toBe('ohm-law');
        expect(results[1].id).toBe('series-parallel');
    });

    it('returns diversified categories for similarly scored items', async () => {
        const provider = new LocalKnowledgeResourceProvider([
            {
                id: 'k_formula',
                title: '欧姆定律',
                category: 'formula',
                content: 'I=U/R',
                keywords: ['串联'],
                appliesTo: ['Resistor']
            },
            {
                id: 'k_topology',
                title: '串并联识别',
                category: 'topology',
                content: '先判节点再等效',
                keywords: ['串联'],
                appliesTo: ['Resistor']
            },
            {
                id: 'k_instrument',
                title: '电流表接法',
                category: 'instrument',
                content: '电流表应串联',
                keywords: ['串联'],
                appliesTo: ['Ammeter']
            }
        ]);

        const results = await provider.search({
            question: '串联电路怎么计算？',
            componentTypes: ['Resistor', 'Ammeter'],
            limit: 2
        });

        expect(results).toHaveLength(2);
        const categories = new Set(results.map((item) => item.category));
        expect(categories.size).toBe(2);
    });

    it('prioritizes runtime diagnostic lesson copy with what-why-how structure', async () => {
        const provider = new LocalKnowledgeResourceProvider();
        const results = await provider.search({
            question: '为什么仿真突然停止了？',
            componentTypes: ['PowerSource', 'Resistor'],
            runtimeDiagnostics: {
                code: 'SHORT_CIRCUIT',
                categories: ['SHORT_CIRCUIT'],
                summary: '检测到电源短路风险，请检查导线连接。',
                hints: ['检查电源正负极是否被导线直接短接。']
            },
            limit: 2
        });

        expect(results).toHaveLength(2);
        expect(results[0].id).toBe('diag-short-circuit');
        expect(results[0].content).toMatchInlineSnapshot(`
          "发生了什么：检测到电源近似零阻路径，仿真已触发短路保护。
          为什么会这样：理想电源被低阻导线直接回接，会让电流理论值异常增大，方程不再稳定。
          如何修复：先断开短接导线；再在电源回路串联负载或限流电阻；重新运行并确认短路高亮消失。"
        `);
    });
});
