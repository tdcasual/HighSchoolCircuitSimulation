import { describe, expect, it } from 'vitest';
import { MobileRestoreBroker } from '../src/ui/mobile/MobileRestoreBroker.js';

describe('MobileRestoreBroker', () => {
    it('keeps only the highest-priority candidate and restores fallback after clear', () => {
        const broker = new MobileRestoreBroker();
        broker.register({
            id: 'ai-return',
            source: 'ai',
            label: '返回编辑',
            priority: 70,
            action: { type: 'focus-canvas' }
        });
        broker.register({
            id: 'guide-resume',
            source: 'guide',
            label: '继续上手',
            priority: 90,
            action: { type: 'show-guide' }
        });

        expect(broker.getCurrent()?.id).toBe('guide-resume');

        broker.clear('guide-resume');
        expect(broker.getCurrent()?.id).toBe('ai-return');
    });

    it('notifies subscribers only when the visible candidate changes', () => {
        const broker = new MobileRestoreBroker();
        const seen = [];
        broker.subscribe((candidate) => seen.push(candidate?.id ?? null));

        broker.register({
            id: 'a',
            source: 'guide',
            label: '继续上手',
            priority: 90,
            action: { type: 'show-guide' }
        });
        broker.register({
            id: 'b',
            source: 'drawer',
            label: '回到画布',
            priority: 40,
            action: { type: 'focus-canvas' }
        });
        broker.clear('a');

        expect(seen).toEqual(['a', 'b']);
    });
});
