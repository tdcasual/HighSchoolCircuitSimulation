import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Component target size', () => {
    it('stays within the 1100-line target budget after control renderer extraction', () => {
        const componentPath = resolve(process.cwd(), 'src/components/Component.js');
        const lineCount = readFileSync(componentPath, 'utf8').split(/\r?\n/u).length;

        expect(lineCount).toBeLessThanOrEqual(1100);
    });
});
