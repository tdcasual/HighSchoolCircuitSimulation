import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OpenAIClientV2 size target', () => {
    it('keeps OpenAIClientV2 at or below 500 lines', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ai/OpenAIClientV2.js'), 'utf8');
        const lines = source.split('\n').length;

        expect(lines).toBeLessThanOrEqual(500);
    });
});
