import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ai mobile e2e contract', () => {
    it('waits for lazy-load trigger contract instead of eager aiPanel instance', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/e2e/ai-mobile-layout-regression.mjs');
        const source = readFileSync(scriptPath, 'utf8');

        expect(source).toContain('window.app?.openAIPanel');
        expect(source).not.toContain('window.app?.aiPanel && window.app?.responsiveLayout');
    });
});
