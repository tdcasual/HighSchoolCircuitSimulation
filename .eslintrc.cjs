module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        es2022: true
    },
    extends: ['eslint:recommended'],
    plugins: ['boundaries'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    ignorePatterns: ['node_modules/', 'output/', 'dist/', '.worktrees/', '_reference/'],
    settings: {
        'boundaries/include': ['src/**/*.js'],
        'boundaries/elements': [
            { type: 'entry', mode: 'full', pattern: 'src/main.js' },
            { type: 'ui', mode: 'full', pattern: 'src/ui/**/*.js' },
            { type: 'app', mode: 'full', pattern: 'src/app/**/*.js' },
            { type: 'ai', mode: 'full', pattern: 'src/ai/**/*.js' },
            { type: 'embed', mode: 'full', pattern: 'src/embed/**/*.js' },
            { type: 'engine', mode: 'full', pattern: 'src/engine/**/*.js' },
            { type: 'core', mode: 'full', pattern: 'src/core/**/*.js' },
            { type: 'components', mode: 'full', pattern: 'src/components/**/*.js' },
            { type: 'utils', mode: 'full', pattern: 'src/utils/**/*.js' }
        ]
    },
    overrides: [
        {
            files: [
                'src/ui/AIPanel.js',
                'src/ui/ai/ChatController.js',
                'src/ui/ExerciseBoard.js',
                'src/embed/EmbedClient.js',
                'src/embed/EmbedRuntimeBridge.js'
            ],
            rules: {
                'no-restricted-syntax': ['error',
                    {
                        selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='addEventListener']",
                        message: 'Use RuntimeSafety.safeAddEventListener instead of direct addEventListener.'
                    },
                    {
                        selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='removeEventListener']",
                        message: 'Use RuntimeSafety.safeRemoveEventListener instead of direct removeEventListener.'
                    },
                    {
                        selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='setAttribute']",
                        message: 'Use RuntimeSafety.safeSetAttribute instead of direct setAttribute.'
                    },
                    {
                        selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='focus']",
                        message: 'Use RuntimeSafety.safeFocus instead of direct focus.'
                    },
                    {
                        selector: "CallExpression[callee.type='MemberExpression'][callee.object.type='MemberExpression'][callee.object.property.name='classList'][callee.property.name=/^(add|remove|toggle)$/]",
                        message: 'Use RuntimeSafety classList helpers instead of direct classList mutations.'
                    }
                ]
            }
        },
        {
            files: ['tests/**/*.js'],
            globals: {
                afterAll: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                describe: 'readonly',
                expect: 'readonly',
                it: 'readonly',
                test: 'readonly',
                vi: 'readonly'
            }
        }
    ],
    rules: {
        'boundaries/element-types': ['error', {
            default: 'disallow',
            rules: [
                { from: 'entry', allow: ['ui', 'app', 'ai', 'embed', 'engine', 'core', 'components', 'utils'] },
                { from: 'ui', allow: ['ui', 'app', 'ai', 'core', 'components', 'utils'] },
                { from: 'app', allow: ['app', 'core', 'utils'] },
                { from: 'ai', allow: ['ai', 'engine', 'components', 'utils'] },
                { from: 'embed', allow: ['embed', 'utils'] },
                { from: 'engine', allow: ['engine', 'core', 'utils'] },
                { from: 'core', allow: ['core', 'components', 'utils'] },
                { from: 'components', allow: ['components', 'utils'] },
                { from: 'utils', allow: ['utils'] }
            ]
        }],
        'boundaries/no-unknown-files': 'error',
        'boundaries/no-unknown': 'error',
        'no-constant-condition': ['error', { checkLoops: false }],
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-case-declarations': 'off',
        'no-empty': ['warn', { allowEmptyCatch: true }],
        'no-useless-escape': 'warn'
    }
};
