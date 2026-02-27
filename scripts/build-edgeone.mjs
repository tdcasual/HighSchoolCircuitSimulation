import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const embedPackageDir = path.join(projectRoot, 'output', 'embed-package');
const edgeoneEmbedDir = path.join(distDir, 'embed');

async function ensureExists(absolutePath) {
    try {
        await stat(absolutePath);
    } catch (_) {
        throw new Error(`Missing required path: ${absolutePath}`);
    }
}

async function main() {
    await ensureExists(distDir);
    await ensureExists(embedPackageDir);

    await mkdir(distDir, { recursive: true });
    await rm(edgeoneEmbedDir, { recursive: true, force: true });
    await cp(embedPackageDir, edgeoneEmbedDir, { recursive: true });

    console.log(`EdgeOne embed bundle ready at: ${edgeoneEmbedDir}`);
}

main().catch((error) => {
    console.error('[build:edgeone] failed:', error);
    process.exitCode = 1;
});
