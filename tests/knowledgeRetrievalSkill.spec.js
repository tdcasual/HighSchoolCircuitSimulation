import { describe, it, expect, vi } from 'vitest';
import { KnowledgeRetrievalSkill } from '../src/ai/skills/KnowledgeRetrievalSkill.js';

describe('KnowledgeRetrievalSkill', () => {
    it('derives component types from circuit map when types are not provided', async () => {
        const provider = {
            search: vi.fn().mockResolvedValue([{ id: 'mock', title: 'mock', content: 'mock' }])
        };
        const circuit = {
            components: new Map([
                ['r1', { type: 'Resistor' }],
                ['v1', { type: 'Voltmeter' }],
                ['r2', { type: 'Resistor' }]
            ])
        };

        const results = await KnowledgeRetrievalSkill.run({
            provider,
            question: '为什么电压表要并联？',
            circuit,
            limit: 3
        });

        expect(results).toHaveLength(1);
        expect(provider.search).toHaveBeenCalledTimes(1);
        const [query] = provider.search.mock.calls[0];
        expect(query.componentTypes).toEqual(['Resistor', 'Voltmeter']);
    });
});
