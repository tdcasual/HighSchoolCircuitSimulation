import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('renderer no-legacy artifacts guard', () => {
    it('wires check script in package pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts['check:renderer-no-legacy'])
            .toBe('node scripts/ci/assert-no-legacy-renderer-artifacts.mjs');
        expect(pkg.scripts.check).toContain('npm run check:renderer-no-legacy');
    });

    it('runs guard in quality workflow', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');
        expect(content).toContain('Check renderer no-legacy artifacts');
        expect(content).toContain('node scripts/ci/assert-no-legacy-renderer-artifacts.mjs');
    });

    it('passes on current source', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-no-legacy-renderer-artifacts.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[renderer-no-legacy] ok');
    });

    it('fails when forbidden legacy renderer import returns', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-no-legacy-renderer-artifacts.mjs',
            sourceFiles: [
                'src/components/Component.js',
                'scripts/ci/assert-no-legacy-renderer-artifacts.mjs'
            ],
            mutateByFile: {
                'src/components/Component.js': (source) => source.replace(
                    "import { renderComponentByRegistry } from './render/RendererRegistry.js';",
                    "import { renderLegacyComponent } from './render/legacy/RendererRegistryLegacy.js';"
                )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('[renderer-no-legacy]');
        expect(result.output).toContain('forbidden legacy renderer reference');
    });
});

