import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AppRuntimeV2 target size', () => {
    it('stays within the 500-line target budget after deferred runtime extraction', () => {
        const runtimePath = resolve(process.cwd(), 'src/app/AppRuntimeV2.js');
        const lineCount = readFileSync(runtimePath, 'utf8').split(/\r?\n/u).length;

        expect(lineCount).toBeLessThanOrEqual(500);
    });
});
