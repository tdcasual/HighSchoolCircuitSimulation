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
    ['css', 'css', true],
    ['src', 'src', true],
    ['examples', 'examples', false]
]);

async function ensureExists(absolutePath) {
    try {
        await stat(absolutePath);
        return true;
    } catch (_) {
        return false;
    }
}

async function main() {
    await rm(distDir, { recursive: true, force: true });
    await mkdir(distDir, { recursive: true });

    for (const [sourceRel, targetRel] of FILE_COPIES) {
        const sourceAbs = path.join(projectRoot, sourceRel);
        const targetAbs = path.join(distDir, targetRel);
        const exists = await ensureExists(sourceAbs);
        if (!exists) {
            throw new Error(`Missing build input: ${sourceAbs}`);
        }
        await cp(sourceAbs, targetAbs);
    }

    for (const [sourceRel, targetRel, required] of DIR_COPIES) {
        const sourceAbs = path.join(projectRoot, sourceRel);
        const targetAbs = path.join(distDir, targetRel);
        const exists = await ensureExists(sourceAbs);
        if (!exists) {
            if (required) {
                throw new Error(`Missing build input: ${sourceAbs}`);
            }
            continue;
        }
        await cp(sourceAbs, targetAbs, { recursive: true });
    }

    console.log(`Frontend static build prepared at: ${distDir}`);
}

main().catch((error) => {
    console.error('[build:frontend] failed:', error);
    process.exitCode = 1;
});
