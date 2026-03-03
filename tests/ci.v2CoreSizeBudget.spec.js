import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v2 core-size budget guard', () => {
    it('contains v2 budget entries capped at 800 lines', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-core-file-size-budget.mjs');
        const content = readFileSync(scriptPath, 'utf8');

        expect(content).toContain('src/v2');
        expect(content).toContain('800');
    });
});
