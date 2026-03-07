import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RuntimeStorageEntries, RuntimeStorageKeys } from '../src/app/RuntimeStorageRegistry.js';

describe('runtime storage ownership contract', () => {
    it('defines canonical storage metadata for circuit autosave and AI config entries', () => {
        expect(RuntimeStorageEntries.circuitAutosave).toMatchObject({
            key: 'saved_circuit',
            owner: 'app-runtime',
            scope: 'project',
            retention: 'persistent',
            storageArea: 'local'
        });
        expect(RuntimeStorageEntries.aiPublicConfig).toMatchObject({
            key: 'ai_config',
            owner: 'openai-client',
            scope: 'device',
            retention: 'persistent',
            storageArea: 'local'
        });
        expect(RuntimeStorageEntries.aiSessionKey).toMatchObject({
            key: 'ai_session_key',
            owner: 'openai-client',
            scope: 'session',
            retention: 'session',
            storageArea: 'session'
        });
        expect(new Set(Object.values(RuntimeStorageKeys)).size).toBe(Object.keys(RuntimeStorageKeys).length);
    });

    it('routes high-risk storage consumers through canonical entries instead of raw key literals', () => {
        const appRuntimeSource = readFileSync(resolve(process.cwd(), 'src/app/AppRuntimeV2.js'), 'utf8');
        const aiPanelSource = readFileSync(resolve(process.cwd(), 'src/ui/AIPanel.js'), 'utf8');
        const openAiSource = readFileSync(resolve(process.cwd(), 'src/ai/OpenAIClientV2.js'), 'utf8');

        expect(appRuntimeSource).toContain('RuntimeStorageEntries.circuitAutosave');
        expect(appRuntimeSource).not.toContain("localStorage.setItem('saved_circuit'");
        expect(appRuntimeSource).not.toContain("localStorage.getItem('saved_circuit'");

        expect(aiPanelSource).not.toContain("localStorage.setItem('saved_circuit'");
        expect(aiPanelSource).not.toContain("localStorage.getItem('saved_circuit'");

        expect(openAiSource).toContain('RuntimeStorageEntries.aiPublicConfig');
        expect(openAiSource).toContain('RuntimeStorageEntries.aiSessionKey');
    });
});
