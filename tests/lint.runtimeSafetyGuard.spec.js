import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function createLintRunner() {
    return new ESLint({
        cwd: projectRoot,
        useEslintrc: true
    });
}

describe('runtime safety lint guard', () => {
    it('fails when guarded ui files call addEventListener directly without RuntimeSafety', async () => {
        const eslint = createLintRunner();
        const [result] = await eslint.lintText(
            "export function bind(btn){ btn.addEventListener('click', () => {}); }",
            {
                filePath: path.join(projectRoot, 'src/ui/AIPanel.js')
            }
        );

        const hasRuntimeSafetyGuardError = result.messages.some((message) =>
            message.ruleId === 'no-restricted-syntax'
                && /RuntimeSafety/.test(String(message.message || ''))
        );
        expect(hasRuntimeSafetyGuardError).toBe(true);
    });

    it('allows RuntimeSafety wrapper calls in guarded ui files', async () => {
        const eslint = createLintRunner();
        const [result] = await eslint.lintText(
            "import { safeAddEventListener } from '../utils/RuntimeSafety.js';\n"
                + "export function bind(btn){ safeAddEventListener(btn, 'click', () => {}); }",
            {
                filePath: path.join(projectRoot, 'src/ui/AIPanel.js')
            }
        );

        const hasRuntimeSafetyGuardError = result.messages.some((message) =>
            message.ruleId === 'no-restricted-syntax'
        );
        expect(hasRuntimeSafetyGuardError).toBe(false);
    });
});
