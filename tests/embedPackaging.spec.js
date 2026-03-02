import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();
const readJson = (relPath) => JSON.parse(fs.readFileSync(path.join(rootDir, relPath), 'utf-8'));

function runNodeScript(relPath) {
    const result = spawnSync('node', [relPath], {
        cwd: rootDir,
        encoding: 'utf-8'
    });
    if (result.status !== 0) {
        throw new Error([
            `Script failed: ${relPath}`,
            result.stdout || '',
            result.stderr || ''
        ].join('\n'));
    }
}

describe('embed packaging pipeline', () => {
    it('declares frontend/embed build scripts', () => {
        const pkg = readJson('package.json');
        expect(pkg.scripts['build:frontend']).toBeTypeOf('string');
        expect(pkg.scripts['package:embed']).toBeTypeOf('string');
        expect(pkg.scripts['build:edgeone']).toBeTypeOf('string');
    });

    // Build packaging may exceed default 5s timeout on busy CI runners.
    it('exports embed package and edgeone embed directory', () => {
        runNodeScript('scripts/build-frontend.mjs');
        expect(fs.existsSync(path.join(rootDir, 'dist', 'viewer.html'))).toBe(true);
        expect(fs.existsSync(path.join(rootDir, 'dist', 'embed.js'))).toBe(true);

        runNodeScript('scripts/embed-packager.mjs');
        expect(fs.existsSync(path.join(rootDir, 'output', 'embed-package', 'viewer.html'))).toBe(true);
        expect(fs.existsSync(path.join(rootDir, 'output', 'embed-package', 'embed.js'))).toBe(true);
        expect(fs.existsSync(path.join(rootDir, 'output', 'embed-package', 'assets', 'src', 'main.js'))).toBe(true);

        runNodeScript('scripts/build-edgeone.mjs');
        expect(fs.existsSync(path.join(rootDir, 'dist', 'embed', 'viewer.html'))).toBe(true);
        expect(fs.existsSync(path.join(rootDir, 'dist', 'embed', 'embed.js'))).toBe(true);
    }, 30000);
});
