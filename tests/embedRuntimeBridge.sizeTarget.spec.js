import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('EmbedRuntimeBridge size target', () => {
    it('keeps EmbedRuntimeBridge at or below 260 lines', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/embed/EmbedRuntimeBridge.js'), 'utf8');
        const lines = source.split('\n').length;

        expect(lines).toBeLessThanOrEqual(260);
    });
});
