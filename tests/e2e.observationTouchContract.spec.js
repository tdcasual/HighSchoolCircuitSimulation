import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('observation touch e2e contract', () => {
    it('uses chartWorkspace runtime contract instead of legacy observationPanel globals', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/e2e/observation-touch-regression.mjs');
        const source = readFileSync(scriptPath, 'utf8');

        expect(source).toContain('window.app?.chartWorkspace');
        expect(source).not.toContain('window.app?.observationPanel');
        expect(source).not.toContain('window.app.observationPanel');
    });
});
