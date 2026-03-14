import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('assistant surface contract', () => {
    it('uses experiment assistant naming and shared surface hooks', () => {
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('实验助手');
        expect(html).toContain('id="panel-guide"');
        expect(html).toContain('id="exercise-board-panel"');
        expect(html).toContain('assistant-surface');
        expect(html).toContain('assistant-surface-header');
    });
});
