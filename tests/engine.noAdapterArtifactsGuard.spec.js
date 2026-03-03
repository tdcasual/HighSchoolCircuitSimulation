import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('engine no-adapter artifacts guard', () => {
    it('wires check script in package pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts['check:engine-no-adapters'])
            .toBe('node scripts/ci/assert-no-engine-adapter-artifacts.mjs');
        expect(pkg.scripts.check).toContain('npm run check:engine-no-adapters');
    });

    it('runs guard in quality workflow', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');
        expect(content).toContain('Check engine no-adapter artifacts');
        expect(content).toContain('node scripts/ci/assert-no-engine-adapter-artifacts.mjs');
    });

    it('passes on current source', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-no-engine-adapter-artifacts.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[engine-no-adapters] ok');
    });

    it('fails when forbidden engine adapter import returns', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-no-engine-adapter-artifacts.mjs',
            sourceFiles: [
                'src/engine/Circuit.js',
                'scripts/ci/assert-no-engine-adapter-artifacts.mjs'
            ],
            mutateByFile: {
                'src/engine/Circuit.js': (source) => source.replace(
                    "import { CircuitPersistenceAdapter } from '../core/runtime/CircuitPersistenceAdapter.js';",
                    "import { CircuitPersistenceAdapter } from './runtime/CircuitPersistenceAdapter.js';"
                )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('[engine-no-adapters]');
        expect(result.output).toContain('forbidden engine adapter reference');
    });
});

