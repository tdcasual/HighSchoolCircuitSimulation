import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI client single-stack guard', () => {
    it('AIPanel imports OpenAIClientV2 only', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ui/AIPanel.js'), 'utf8');
        expect(source).toContain('OpenAIClientV2');
        expect(source).not.toContain("from '../ai/OpenAIClient.js'");
    });

    it('legacy OpenAIClient implementation is removed', () => {
        const legacyPath = resolve(process.cwd(), 'src/ai/OpenAIClient.js');
        expect(existsSync(legacyPath)).toBe(false);
    });
});

