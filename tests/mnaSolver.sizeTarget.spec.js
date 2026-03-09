import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('MNASolver target size', () => {
    it('stays within the 500-line target budget after shared source-voltage extraction', () => {
        const solverPath = resolve(process.cwd(), 'src/core/simulation/MNASolver.js');
        const lineCount = readFileSync(solverPath, 'utf8').split(/\r?\n/u).length;

        expect(lineCount).toBeLessThanOrEqual(500);
    });
});
