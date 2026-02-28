import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const packageDir = path.join(projectRoot, 'output', 'embed-package');
const packageAssetsDir = path.join(packageDir, 'assets');
const packageMetaPath = path.join(projectRoot, 'package.json');

const REQUIRED_DIST_FILES = Object.freeze([
    'viewer.html',
    'embed.js',
    'index.html',
    path.join('css', 'style.css'),
    path.join('src', 'main.js')
]);

async function pathExists(absolutePath) {
    try {
        await stat(absolutePath);
        return true;
    } catch (_) {
        return false;
    }
}

async function ensureExists(absolutePath) {
    const exists = await pathExists(absolutePath);
    if (!exists) {
        throw new Error(`Missing expected file: ${absolutePath}`);
    }
}

async function readProjectVersion() {
    const content = await readFile(packageMetaPath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed.version || '0.0.0';
}

async function copyRequiredBundle() {
    await ensureExists(distDir);
    for (const relPath of REQUIRED_DIST_FILES) {
        await ensureExists(path.join(distDir, relPath));
    }

    await rm(packageDir, { recursive: true, force: true });
    await mkdir(packageAssetsDir, { recursive: true });

    await cp(path.join(distDir, 'viewer.html'), path.join(packageDir, 'viewer.html'));
    await cp(path.join(distDir, 'embed.js'), path.join(packageDir, 'embed.js'));

    await cp(path.join(distDir, 'index.html'), path.join(packageAssetsDir, 'index.html'));
    await cp(path.join(distDir, 'embed.html'), path.join(packageAssetsDir, 'embed.html'));
    await cp(path.join(distDir, 'deploycircuit.js'), path.join(packageAssetsDir, 'deploycircuit.js'));
    await cp(path.join(distDir, 'css'), path.join(packageAssetsDir, 'css'), { recursive: true });
    await cp(path.join(distDir, 'src'), path.join(packageAssetsDir, 'src'), { recursive: true });
    const examplesSource = path.join(distDir, 'examples');
    if (await pathExists(examplesSource)) {
        await cp(examplesSource, path.join(packageAssetsDir, 'examples'), { recursive: true });
    }
}

async function writeManifest() {
    const version = await readProjectVersion();
    const manifest = {
        sdk: 'embed.js',
        viewer: 'viewer.html',
        assetsDir: 'assets',
        generatedAt: new Date().toISOString(),
        version
    };
    await writeFile(
        path.join(packageDir, 'embed-manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf-8'
    );
}

async function main() {
    await copyRequiredBundle();
    await writeManifest();
    console.log(`Embed package exported to: ${packageDir}`);
}

main().catch((error) => {
    console.error('[package:embed] failed:', error);
    process.exitCode = 1;
});
