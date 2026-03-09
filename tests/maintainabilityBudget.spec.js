import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

describe('maintainability contract wiring', () => {
    it('exposes check:maintainability in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = readJson(pkgPath);

        expect(pkg.scripts['check:maintainability']).toBe('node scripts/ci/assert-maintainability-budget.mjs');
        expect(pkg.scripts.check).toContain('npm run check:maintainability');
    });

    it('runs maintainability guard in CI quality job', () => {
        const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');
        const content = readFileSync(workflowPath, 'utf8');

        expect(content).toContain('Check maintainability budget');
        expect(content).toContain('npm run check:maintainability');
    });

    it('provides hard-mode maintainability guard script', () => {
        const guardPath = resolve(process.cwd(), 'scripts/ci/assert-maintainability-budget.mjs');
        const content = readFileSync(guardPath, 'utf8');

        expect(existsSync(guardPath)).toBe(true);
        expect(content).toContain("const mode = 'hard'");
        expect(content).toContain('src/core/simulation/MNASolver.js');
        expect(content).toContain('bundle hard budget exceeded');
        expect(content).toContain('shim inventory grew');
        expect(content).not.toContain("const mode = 'monitor'");
    });

    it('links governance doc from README surfaces', () => {
        const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
        const docsReadme = readFileSync(resolve(process.cwd(), 'docs/README.md'), 'utf8');
        const governancePath = 'docs/process/maintainability-governance.md';

        expect(existsSync(resolve(process.cwd(), governancePath))).toBe(true);
        expect(readme).toContain(governancePath);
        expect(docsReadme).toContain(governancePath);
    });

    it('removes transitional shims and resets shim baseline to zero', () => {
        const governance = readFileSync(resolve(process.cwd(), 'docs/process/maintainability-governance.md'), 'utf8');
        const dashboardScript = readFileSync(resolve(process.cwd(), 'scripts/ci/generate-debt-dashboard.mjs'), 'utf8');
        const appRuntime = readFileSync(resolve(process.cwd(), 'src/app/AppRuntimeV2.js'), 'utf8');
        const actionRouter = readFileSync(resolve(process.cwd(), 'src/app/RuntimeActionRouter.js'), 'utf8');
        const component = readFileSync(resolve(process.cwd(), 'src/components/Component.js'), 'utf8');
        const netlistBuilder = readFileSync(resolve(process.cwd(), 'src/core/simulation/NetlistBuilder.js'), 'utf8');

        expect(existsSync(resolve(process.cwd(), 'src/app/AppStorage.js'))).toBe(false);
        expect(existsSync(resolve(process.cwd(), 'src/app/RuntimeStorageRegistry.js'))).toBe(false);
        expect(appRuntime).not.toContain('/app/AppStorage.js');
        expect(appRuntime).not.toContain('/app/RuntimeStorageRegistry.js');
        expect(actionRouter).not.toContain('./AppStorage.js');
        expect(actionRouter).not.toContain('./RuntimeStorageRegistry.js');
        expect(component).not.toContain('@deprecated');
        expect(netlistBuilder).not.toContain('@deprecated');
        expect(governance).toContain('当前 shim inventory baseline 为 `0`');
        expect(dashboardScript).toContain('const SHIM_INVENTORY_BASELINE = 0;');
    });
});
