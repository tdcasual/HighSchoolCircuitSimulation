import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

describe('component interaction usage guide sync', () => {
    it('has interaction-guide sync script wired in package scripts', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:interaction-guide']).toBe('node scripts/ci/assert-interaction-guide-sync.mjs');
    });

    it('documents current key interactions', () => {
        const guidePath = resolve(process.cwd(), 'docs/process/component-interaction-usage-guide.md');
        const content = readFileSync(guidePath, 'utf8');

        expect(content).toContain('Ctrl/Cmd + 拖动端子');
        expect(content).toContain('Ctrl/Cmd + 点击导线');
    });

    it('executes interaction-guide sync script on current workspace', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-guide-sync.mjs',
            sourceFiles: [
                'docs/process/component-interaction-usage-guide.md',
                'src/app/interaction/InteractionOrchestrator.js'
            ]
        });

        expect(output.ok).toBe(true);
        expect(output.output).toContain('[interaction-guide-sync] ok');
    });

    it('fails when required interaction item is missing from guide', () => {
        const output = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-guide-sync.mjs',
            sourceFiles: [
                'docs/process/component-interaction-usage-guide.md',
                'src/app/interaction/InteractionOrchestrator.js'
            ],
            mutateByFile: {
                'docs/process/component-interaction-usage-guide.md': (content) =>
                    content.replace('Ctrl/Cmd + 点击导线', 'Ctrl/Cmd + 点击连线')
            }
        });

        expect(output.ok).toBe(false);
        expect(output.output).toContain('missing item');
    });
});
