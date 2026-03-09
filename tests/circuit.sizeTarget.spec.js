import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Circuit target size', () => {
    it('stays within the 1300-line target budget after property-map extraction', () => {
        const circuitPath = resolve(process.cwd(), 'src/core/runtime/Circuit.js');
        const lineCount = readFileSync(circuitPath, 'utf8').split(/\r?\n/u).length;

        expect(lineCount).toBeLessThanOrEqual(1300);
    });
});
