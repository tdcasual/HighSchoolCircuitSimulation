import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runScriptInTempWorkspace } from './helpers/scriptGuardTestUtils.js';

const guardSourceFiles = [
    'src/app/interaction/InteractionModeBridge.js',
    'src/app/interaction/InteractionModeStateMachine.js',
    'src/ui/interaction/PointerSessionManager.js',
    'src/ui/interaction/ToolPlacementController.js',
    'src/ui/interaction/InteractionStateInitializer.js',
    'src/ui/interaction/TouchActionController.js',
    'src/app/interaction/InteractionOrchestratorMouseDownPendingToolHandlers.js',
    'src/app/interaction/InteractionOrchestrator.js'
];

describe('interaction mode runtime contract guard wiring', () => {
    it('exposes guard script in package scripts and check pipeline', () => {
        const pkgPath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts['check:interaction-mode-contract']).toBe(
            'node scripts/ci/assert-interaction-mode-runtime-contract.mjs'
        );
        expect(pkg.scripts.check).toContain('npm run check:interaction-mode-contract');
    });

    it('passes on current source with store-only interaction mode reads', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/ci/assert-interaction-mode-runtime-contract.mjs');
        const output = execFileSync('node', [scriptPath], { encoding: 'utf8' });
        expect(output).toContain('[interaction-mode-contract] ok');
    });

    it('fails when InteractionModeBridge reintroduces legacy runtime mode-field fallback reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/app/interaction/InteractionModeBridge.js': (source) =>
                    source.replace(
                        'return normalizeModeContextSnapshot();',
                        `return {
        pendingToolType: normalizePendingToolType(context?.pendingToolType),
        mobileInteractionMode: normalizeMobileInteractionMode(context?.mobileInteractionMode),
        stickyWireTool: !!context?.stickyWireTool,
        isWiring: !!context?.isWiring,
        isDraggingWireEndpoint: !!context?.isDraggingWireEndpoint,
        isTerminalExtending: !!context?.isTerminalExtending,
        isRheostatDragging: !!context?.isRheostatDragging
    };`
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy runtime mode-field fallback read found');
    });

    it('fails when PointerSessionManager reintroduces mode-field fallback reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/ui/interaction/PointerSessionManager.js': (source) =>
                    source.replace(
                        'const pendingTool = modeContext.pendingTool ?? null;',
                        'const pendingTool = modeContext.pendingTool ?? context.pendingToolType ?? null;'
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy mode-field fallback read found');
    });

    it('fails when InteractionModeStateMachine reintroduces runtime mode-field seed reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/app/interaction/InteractionModeStateMachine.js': (source) =>
                    source.replace(
                        'pendingTool: null,',
                        'pendingTool: context.pendingToolType ?? null,'
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy runtime mode-field seed found');
    });

    it('fails when InteractionStateInitializer reintroduces legacy runtime mode-field assignments', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/ui/interaction/InteractionStateInitializer.js': (source) =>
                    source.replace(
                        'context.isDraggingComponent = false; // 标记是否正在拖动元器件（而不是从工具箱拖放）',
                        `context.isDraggingComponent = false; // 标记是否正在拖动元器件（而不是从工具箱拖放）
    context.pendingToolType = null;`
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy runtime mode-field initializer assignment found');
    });

    it('fails when ToolPlacementController reintroduces direct legacy mode reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/ui/interaction/ToolPlacementController.js': (source) =>
                    source.replace(
                        'const pendingTool = modeContext.pendingTool;',
                        'const pendingTool = this.pendingToolType || modeContext.pendingTool;'
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy mode-field direct read found');
    });

    it('fails when TouchActionController reintroduces direct legacy mode reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/ui/interaction/TouchActionController.js': (source) =>
                    source.replace(
                        'if (modeContext.pendingTool) return false;',
                        'if (this.interaction?.pendingToolType) return false;'
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy mode-field direct read found');
    });

    it('fails when pending-tool mousedown handler reintroduces direct legacy mode reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/app/interaction/InteractionOrchestratorMouseDownPendingToolHandlers.js': (source) =>
                    source.replace(
                        'if (wiringActive) {',
                        'if (this.isWiring || wiringActive) {'
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy mode-field direct read found');
    });

    it('fails when orchestrator mousedown path reintroduces direct legacy mode reads', () => {
        const result = runScriptInTempWorkspace({
            scriptRelPath: 'scripts/ci/assert-interaction-mode-runtime-contract.mjs',
            sourceFiles: guardSourceFiles,
            mutateByFile: {
                'src/app/interaction/InteractionOrchestrator.js': (source) =>
                    source.replace(
                        'if (modeContext.wiringActive) {',
                        'if (this.isWiring || modeContext.wiringActive) {'
                    )
            }
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain('legacy mode-field direct read found');
    });
});
