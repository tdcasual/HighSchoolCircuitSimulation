export const RuntimeStorageEntries = Object.freeze({
    circuitAutosave: Object.freeze({
        id: 'circuitAutosave',
        key: 'saved_circuit',
        owner: 'app-runtime',
        scope: 'project',
        retention: 'persistent',
        storageArea: 'local'
    }),
    aiPublicConfig: Object.freeze({
        id: 'aiPublicConfig',
        key: 'ai_config',
        owner: 'openai-client',
        scope: 'device',
        retention: 'persistent',
        storageArea: 'local'
    }),
    aiSessionKey: Object.freeze({
        id: 'aiSessionKey',
        key: 'ai_session_key',
        owner: 'openai-client',
        scope: 'session',
        retention: 'session',
        storageArea: 'session'
    })
});

export const RuntimeStorageKeys = Object.freeze(Object.fromEntries(
    Object.entries(RuntimeStorageEntries).map(([id, entry]) => [id, entry.key])
));

export function getRuntimeStorageEntry(id) {
    const normalized = String(id || '').trim();
    return RuntimeStorageEntries[normalized] || null;
}
