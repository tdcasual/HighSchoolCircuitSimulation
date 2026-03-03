import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

describe('runtime safety dedupe wave1', () => {
    it('keeps local safeInvokeMethod definitions under wave1 threshold', () => {
        const matches = execSync('rg -n "function safeInvokeMethod\\(" src | wc -l', {
            cwd: process.cwd(),
            encoding: 'utf8'
        }).trim();
        expect(Number(matches)).toBeLessThanOrEqual(15);
    });
});
