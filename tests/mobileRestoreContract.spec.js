import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile restore contract', () => {
    it('ai mobile e2e script validates restore anchor presence and click path', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/e2e/ai-mobile-layout-regression.mjs'), 'utf8');
        expect(source).toContain('mobile-restore-entry');
        expect(source).toContain("await page.click('#mobile-restore-entry')");
    });

    it('responsive touch e2e script checks restore anchor element in phone layout', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/e2e/responsive-touch-regression.mjs'), 'utf8');
        expect(source).toContain('mobile-restore-entry');
    });
});
