import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('v2 core-size budget guard', () => {
    it('contains explicit hotspot budgets for post-refactor files', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-core-file-size-budget.mjs');
        const content = readFileSync(scriptPath, 'utf8');

        expect(content).toContain('src/core/runtime/Circuit.js');
        expect(content).toContain('1400');
        expect(content).toContain('src/ui/charts/ChartWindowController.js');
        expect(content).toContain('450');
        expect(content).toContain('src/core/simulation/MNASolver.js');
        expect(content).toContain('650');
        expect(content).toContain('src/app/AppRuntimeV2.js');
        expect(content).toContain('575');
    });

    it('uses target thresholds to emit warnings before hard failures', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-core-file-size-budget.mjs');
        const content = readFileSync(scriptPath, 'utf8');

        expect(content).toContain('targetMaxLines');
        expect(content).toContain('within hard budget, but one or more files exceed target size');
    });
});
