import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CI workflow coverage', () => {
    it('runs wire interaction e2e in GitHub Actions', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('wire-e2e:');
        expect(content).toContain('npm run test:e2e:wire');
        expect(content).toContain('wire-e2e-screenshots');
        expect(content).toContain('output/e2e/wire-interaction');
    });

    it('runs reliability-focused regression gate in quality job', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('Run reliability regression gate');
        expect(content).toContain('npm run test:reliability');
    });
});
