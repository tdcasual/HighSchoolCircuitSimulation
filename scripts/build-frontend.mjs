import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const FILE_COPIES = Object.freeze([
    ['index.html', 'index.html'],
    ['viewer.html', 'viewer.html'],
    ['embed.html', 'embed.html'],
    ['embed.js', 'embed.js'],
    ['deploycircuit.js', 'deploycircuit.js']
]);

const DIR_COPIES = Object.freeze([
    ['css', 'css'],
    ['src', 'src'],
    ['examples', 'examples']
]);

async function ensureExists(absolutePath) {
    try {
        await stat(absolutePath);
    } catch (_) {
        throw new Error(`Missing build input: ${absolutePath}`);
    }
}

async function main() {
    await rm(distDir, { recursive: true, force: true });
    await mkdir(distDir, { recursive: true });

    for (const [sourceRel, targetRel] of FILE_COPIES) {
        const sourceAbs = path.join(projectRoot, sourceRel);
        const targetAbs = path.join(distDir, targetRel);
        await ensureExists(sourceAbs);
        await cp(sourceAbs, targetAbs);
    }

    for (const [sourceRel, targetRel] of DIR_COPIES) {
        const sourceAbs = path.join(projectRoot, sourceRel);
        const targetAbs = path.join(distDir, targetRel);
        await ensureExists(sourceAbs);
        await cp(sourceAbs, targetAbs, { recursive: true });
    }

    console.log(`Frontend static build prepared at: ${distDir}`);
}

main().catch((error) => {
    console.error('[build:frontend] failed:', error);
    process.exitCode = 1;
});
