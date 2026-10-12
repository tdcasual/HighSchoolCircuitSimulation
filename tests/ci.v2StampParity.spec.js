import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

const STAMP_PARITY_IMPORTS = [
    'src/v2/simulation/StampRegistryV2.js',
    'src/v2/simulation/JunctionModelV2.js',
    'src/v2/simulation/DynamicUpdateV2.js',
    'src/utils/Physics.js',
    'src/utils/JunctionModel.js',
    'src/utils/registerDefaultStamps.js',
    'src/core/simulation/ComponentRegistry.js',
    'src/core/simulation/JunctionModel.js',
    'src/core/simulation/DynamicIntegrator.js',
    'src/v2/infra/components/ComponentDefinitionRegistry.js'
];

describe('v2 stamp-parity guard', () => {
    it('exposes check:v2:stamp-parity in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts['check:v2:stamp-parity']).toBe('node scripts/ci/assert-v2-stamp-parity.mjs');
        expect(pkg.scripts.check).toContain('npm run check:v2:stamp-parity');
    });

    it('is part of the quality concatenated command rather than a new CI step', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');
        const qualityBlock = content.slice(
            content.indexOf('  quality:'),
            content.indexOf('  responsive-e2e:')
        );

        expect(qualityBlock).toContain('npm run check:v2:stamp-parity');
        expect(qualityBlock).not.toContain('Check v2 stamp parity');
        expect(qualityBlock).toContain('npm run baseline:p0:ext');
    });

    it('locks name comparison and extra-case identifiers in the guard script', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-v2-stamp-parity.mjs');
        const source = readFileSync(scriptPath, 'utf8');

        expect(source).toContain('left[i].name !== right[i].name');
        expect(source).toContain('resistance: 1e-12');
        expect(source).toContain('vsIndex: undefined');
        expect(source).toContain("connectionMode: 'slider-only'");
        expect(source).toContain("resolveDynamicIntegrationMethod: () => 'trapezoidal'");
    });

    it('passes guard script on current source', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-v2-stamp-parity.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[v2-stamp-parity] ok');
    });

    it('fails when a V2 stamp kind drifts from production', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-v2-stamp-parity.mjs',
            sourceFiles: STAMP_PARITY_IMPORTS,
            mutateByFile: {
                'src/v2/simulation/StampRegistryV2.js': (content) => `${content}
DefaultStampRegistryV2.register('Resistor', {
    stamp(comp, context, nodes) {
        context.stampCurrentSource(nodes.i1, nodes.i2, comp.resistance);
    },
    current() { return 0; }
});
`
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('stamp sequence mismatch');
        expect(output.output).toContain('Resistor');
    });
});

