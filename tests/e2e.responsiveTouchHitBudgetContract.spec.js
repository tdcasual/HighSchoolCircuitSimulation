import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('responsive touch hit budget contract', () => {
    it('covers edge-biased terminal taps for PRJ-019 in responsive touch regression', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/e2e/responsive-touch-regression.mjs'), 'utf8');

        expect(source).toContain('edgeBiasedTapStartArmsWiring');
        expect(source).toContain('edgeBiasedTapFinishCreatesWire');
        expect(source).toContain('document.elementFromPoint');
        expect(source).toContain('wire mode edge-biased touch inside terminal hit budget should arm wiring');
        expect(source).toContain('wire mode edge-biased finish touch inside terminal hit budget should create wire');
    });
});
