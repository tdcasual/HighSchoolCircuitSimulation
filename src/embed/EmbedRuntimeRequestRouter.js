import {
    createBridgeError,
    normalizeFeatureFlags,
    normalizeMode,
    normalizeModeV2Strict
} from './EmbedRuntimeOptions.js';

const READONLY_BLOCKED_METHODS = Object.freeze(['run', 'clearCircuit', 'loadCircuit']);

export function assertMutableEmbedRequestAllowed(bridge, method) {
    if (!READONLY_BLOCKED_METHODS.includes(method) || !bridge?.isReadOnlyActive?.()) {
        return;
    }
    throw createBridgeError(
        'READONLY_MUTATION_BLOCKED',
        'Readonly embed runtime blocked mutation request',
        {
            method,
            readOnly: true
        }
    );
}

export function handleEmbedSetOptions(bridge, payload = {}) {
    if (payload.mode !== undefined) {
        const strictV2 = payload.runtimeVersion === 2 || payload.runtimeVersion === '2';
        bridge.mode = strictV2 ? normalizeModeV2Strict(payload.mode) : normalizeMode(payload.mode);
        bridge.applyMode(bridge.mode);
        bridge.featureFlags = normalizeFeatureFlags(bridge.mode, bridge.featureFlags);
    }
    if (payload.readOnly !== undefined) {
        bridge.readOnly = !!payload.readOnly;
        bridge.applyMode(bridge.mode);
    }
    if (payload.classroomLevel !== undefined) {
        bridge.applyClassroomLevel(payload.classroomLevel, { announce: !!payload.announce });
    }
    if (
        (payload.runtimeVersion === 2 || payload.runtimeVersion === '2')
        && payload.features !== undefined
        && (!payload.features || typeof payload.features !== 'object' || Array.isArray(payload.features))
    ) {
        throw createBridgeError('INVALID_PAYLOAD', 'v2 runtime setOptions.features must be an object');
    }
    if (payload.features && typeof payload.features === 'object') {
        bridge.applyFeatures({
            ...bridge.featureFlags,
            ...payload.features
        });
    } else {
        bridge.applyFeatures(bridge.featureFlags);
    }
    return bridge.getStateSnapshot();
}

export function handleEmbedRuntimeRequest(bridge, method, payload = {}) {
    assertMutableEmbedRequestAllowed(bridge, method);
    switch (method) {
        case 'ping':
            return { pong: true, now: Date.now() };
        case 'getState':
            return bridge.getStateSnapshot();
        case 'setOptions':
            return handleEmbedSetOptions(bridge, payload);
        case 'setClassroomMode':
            bridge.applyClassroomLevel(payload?.level, { announce: !!payload?.announce });
            return bridge.getStateSnapshot();
        case 'setReadonly':
            bridge.readOnly = !!payload?.readOnly;
            bridge.applyMode(bridge.mode);
            return bridge.getStateSnapshot();
        case 'run':
            bridge.app?.startSimulation?.();
            return bridge.getStateSnapshot();
        case 'stop':
            bridge.app?.stopSimulation?.();
            return bridge.getStateSnapshot();
        case 'clearCircuit':
            bridge.app?.clearCircuit?.();
            return bridge.getStateSnapshot();
        case 'loadCircuit':
            if (!payload || typeof payload !== 'object' || !payload.circuit) {
                throw createBridgeError('INVALID_PAYLOAD', 'loadCircuit payload.circuit is required');
            }
            return {
                summary: bridge.app?.loadCircuitData?.(payload.circuit, {
                    silent: true,
                    statusText: '已加载嵌入电路'
                }),
                state: bridge.getStateSnapshot()
            };
        case 'exportCircuit':
            return {
                circuit: bridge.app?.buildSaveData?.() || null
            };
        default:
            throw createBridgeError('UNSUPPORTED_METHOD', `Unsupported method: ${String(method || '')}`);
    }
}
