import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('observation runtime contract guard wiring', () => {
    it('exposes guard script in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:observation-contract']).toBe(
            'node scripts/ci/assert-observation-runtime-contract.mjs'
        );
        expect(pkg.scripts.check).toContain('npm run check:observation-contract');
    });

    it('passes on current source with chartWorkspace-only runtime contract', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-observation-runtime-contract.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[observation-contract] ok');
    });

    it('fails when responsive touch regression script reintroduces observationPanel runtime fallback', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-observation-runtime-contract.mjs',
            sourceFiles: [
                'scripts/e2e/observation-touch-regression.mjs',
                'scripts/e2e/responsive-touch-regression.mjs',
                'src/app/AppBootstrapRuntime.js',
                'tests/e2e.observationTouchContract.spec.js'
            ],
            mutateByFile: {
                'scripts/e2e/responsive-touch-regression.mjs': (source) => source.replace(
                    'return app.chartWorkspace.windows.length;',
                    'return app.observationPanel?.plots?.length || 0;'
                )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('observationPanel runtime contract reference found');
    });

    it('guards against legacy ObservationPanel source module reintroduction', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-observation-runtime-contract.mjs');
        const source = readFileSync(scriptPath, 'utf8');

        expect(source).toContain("src/ui/ObservationPanel.js");
        expect(source).toContain('legacy ObservationPanel module must be removed');
    });

    it('fails when tests import ObservationPanel legacy module', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-observation-runtime-contract.mjs',
            sourceFiles: [
                'scripts/e2e/observation-touch-regression.mjs',
                'scripts/e2e/responsive-touch-regression.mjs',
                'src/app/AppBootstrapRuntime.js',
                'tests/e2e.observationTouchContract.spec.js'
            ],
            mutateByFile: {
                'tests/e2e.observationTouchContract.spec.js': (source) =>
                    `${source}\nimport('../src/ui/Observation\x50anel.js').catch(() => {});\n`
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy ObservationPanel import found');
    });

    it('tracks chart workspace core-size budget instead of ObservationPanel legacy budget', () => {
        const budgetScriptPath = resolve(process.cwd(), 'scripts/ci/assert-core-file-size-budget.mjs');
        const source = readFileSync(budgetScriptPath, 'utf8');

        expect(source).not.toContain("src/ui/ObservationPanel.js");
        expect(source).toContain("src/ui/charts/ChartWindowController.js");
    });
});
