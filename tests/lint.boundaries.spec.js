import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { resolve } from 'node:path';

describe('ESLint boundaries fixture', () => {
    it('flags a core → ui import in the helper fixture', async () => {
        const fixture = resolve(process.cwd(), 'tests/helpers/eslint-boundary-violation.js');
        const eslint = new ESLint({
            cwd: process.cwd(),
            useEslintrc: false,
            overrideConfig: {
                root: true,
                env: { es2022: true },
                parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
                plugins: ['boundaries'],
                settings: {
                    'boundaries/include': [
                        'tests/helpers/eslint-boundary-violation.js',
                        'src/ui/**/*.js'
                    ],
                    'boundaries/elements': [
                        { type: 'core', mode: 'full', pattern: 'tests/helpers/eslint-boundary-violation.js' },
                        { type: 'ui', mode: 'full', pattern: 'src/ui/**/*.js' }
                    ]
                },
                rules: {
                    'boundaries/element-types': ['error', {
                        default: 'disallow',
                        rules: [
                            { from: 'core', allow: ['core'] },
                            { from: 'ui', allow: ['ui'] }
                        ]
                    }]
                }
            }
        });

        const results = await eslint.lintFiles([fixture]);
        const messages = results.flatMap((result) => result.messages);
        expect(messages.some((message) => message.ruleId === 'boundaries/element-types')).toBe(true);
    });
});
