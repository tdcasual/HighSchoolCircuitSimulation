import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('shared storage seam', () => {
    it('exposes canonical storage registry from utils without app compatibility wrappers', async () => {
        const utilsRegistry = await import('../src/utils/storage/StorageRegistry.js');

        expect(utilsRegistry.RuntimeStorageEntries).toBeDefined();
        expect(utilsRegistry.getRuntimeStorageEntry).toBeTypeOf('function');
        expect(existsSync(resolve(process.cwd(), 'src/app/RuntimeStorageRegistry.js'))).toBe(false);
    });

    it('exposes canonical safe storage helpers from utils without app compatibility wrappers', async () => {
        const utilsStorage = await import('../src/utils/storage/SafeStorage.js');

        expect(utilsStorage.safeGetStorageItem).toBeTypeOf('function');
        expect(utilsStorage.safeSetStorageItem).toBeTypeOf('function');
        expect(utilsStorage.safeRemoveStorageItem).toBeTypeOf('function');
        expect(existsSync(resolve(process.cwd(), 'src/app/AppStorage.js'))).toBe(false);
    });

    it('runtime consumers depend on utils storage seam instead of app storage modules', () => {
        const aiSource = readFileSync(resolve(process.cwd(), 'src/ai/OpenAIClientV2.js'), 'utf8');
        const appRuntimeSource = readFileSync(resolve(process.cwd(), 'src/app/AppRuntimeV2.js'), 'utf8');
        const actionRouterSource = readFileSync(resolve(process.cwd(), 'src/app/RuntimeActionRouter.js'), 'utf8');

        expect(aiSource).toContain('../utils/storage/SafeStorage.js');
        expect(aiSource).toContain('../utils/storage/StorageRegistry.js');
        expect(appRuntimeSource).toContain('../utils/storage/SafeStorage.js');
        expect(appRuntimeSource).toContain('../utils/storage/StorageRegistry.js');
        expect(actionRouterSource).toContain('../utils/storage/SafeStorage.js');
        expect(actionRouterSource).toContain('../utils/storage/StorageRegistry.js');
        expect(aiSource).not.toContain('../app/AppStorage.js');
        expect(aiSource).not.toContain('../app/RuntimeStorageRegistry.js');
        expect(appRuntimeSource).not.toContain('../app/AppStorage.js');
        expect(appRuntimeSource).not.toContain('../app/RuntimeStorageRegistry.js');
        expect(actionRouterSource).not.toContain('./AppStorage.js');
        expect(actionRouterSource).not.toContain('./RuntimeStorageRegistry.js');
    });
});
