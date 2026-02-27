import { createRuntimeLogger } from '../utils/Logger.js';

const EMBED_CHANNEL = 'HSCS_EMBED_V1';
const EMBED_API_VERSION = 1;

const EMBED_MODE_EDIT = 'edit';
const EMBED_MODE_CLASSROOM = 'classroom';
const EMBED_MODE_READONLY = 'readonly';
const EMBED_MODES = Object.freeze([
    EMBED_MODE_EDIT,
    EMBED_MODE_CLASSROOM,
    EMBED_MODE_READONLY
]);

const CLASSROOM_LEVEL_OFF = 'off';
const CLASSROOM_LEVEL_STANDARD = 'standard';
const CLASSROOM_LEVEL_ENHANCED = 'enhanced';

function parseBooleanFlag(rawValue, fallbackValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return fallbackValue;
    }
    const normalized = String(rawValue).trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
    }
    return fallbackValue;
}

function normalizeMode(rawMode) {
    const text = String(rawMode || '').trim().toLowerCase();
    return EMBED_MODES.includes(text) ? text : EMBED_MODE_EDIT;
}

function normalizeClassroomLevel(rawLevel, mode = EMBED_MODE_EDIT) {
    const text = String(rawLevel || '').trim().toLowerCase();
    if (text === CLASSROOM_LEVEL_STANDARD || text === CLASSROOM_LEVEL_ENHANCED || text === CLASSROOM_LEVEL_OFF) {
        return text;
    }
    if (mode === EMBED_MODE_CLASSROOM) {
        return CLASSROOM_LEVEL_STANDARD;
    }
    return CLASSROOM_LEVEL_OFF;
}

function getDefaultFeatureFlags(mode) {
    if (mode === EMBED_MODE_READONLY) {
        return {
            toolbox: false,
            sidePanel: false,
            observation: false,
            ai: false,
            exerciseBoard: false,
            statusBar: true
        };
    }
    if (mode === EMBED_MODE_CLASSROOM) {
        return {
            toolbox: true,
            sidePanel: true,
            observation: true,
            ai: false,
            exerciseBoard: false,
            statusBar: true
        };
    }
    return {
        toolbox: true,
        sidePanel: true,
        observation: true,
        ai: true,
        exerciseBoard: true,
        statusBar: true
    };
}

function normalizeFeatureFlags(mode, incomingFlags = {}) {
    const defaults = getDefaultFeatureFlags(mode);
    const normalized = { ...defaults };
    for (const key of Object.keys(defaults)) {
        if (incomingFlags[key] === undefined) continue;
        normalized[key] = !!incomingFlags[key];
    }
    return normalized;
}

function createBridgeError(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    if (details !== null && details !== undefined) {
        error.details = details;
    }
    return error;
}

export function parseEmbedRuntimeOptionsFromSearch(search = '') {
    const query = typeof search === 'string' ? search : '';
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    const hasEmbedFlag = parseBooleanFlag(params.get('embed'), false);
    const hasModeFlag = params.has('mode');
    const enabled = hasEmbedFlag || hasModeFlag;
    const mode = normalizeMode(params.get('mode'));

    const rawFeatureFlags = {};
    [
        ['toolbox', 'toolbox'],
        ['sidePanel', 'sidePanel'],
        ['observation', 'observation'],
        ['ai', 'ai'],
        ['exerciseBoard', 'exerciseBoard'],
        ['statusBar', 'statusBar']
    ].forEach(([queryKey, featureKey]) => {
        if (!params.has(queryKey)) return;
        rawFeatureFlags[featureKey] = parseBooleanFlag(params.get(queryKey), undefined);
    });

    const targetOrigin = params.get('targetOrigin') || '*';
    const allowedParentOrigins = (params.get('allowedOrigins') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (allowedParentOrigins.length === 0 && targetOrigin !== '*') {
        allowedParentOrigins.push(targetOrigin);
    }

    return {
        enabled,
        mode,
        readOnly: mode === EMBED_MODE_READONLY || parseBooleanFlag(params.get('readonly'), false),
        classroomLevel: normalizeClassroomLevel(params.get('classroomLevel'), mode),
        targetOrigin,
        allowedParentOrigins,
        autoSave: enabled ? parseBooleanFlag(params.get('autosave'), false) : true,
        restoreFromStorage: enabled ? parseBooleanFlag(params.get('restore'), false) : true,
        features: normalizeFeatureFlags(mode, rawFeatureFlags)
    };
}

export class EmbedRuntimeBridge {
    constructor(app, options = {}, runtime = {}) {
        this.app = app;
        this.options = options;
        this.window = runtime.window || (typeof window !== 'undefined' ? window : null);
        this.document = runtime.document || (typeof document !== 'undefined' ? document : null);
        this.parentWindow = this.window?.parent || null;
        this.logger = app?.logger?.child?.('embedBridge') || createRuntimeLogger({ scope: 'embedBridge' });

        this.enabled = !!options.enabled;
        this.mode = normalizeMode(options.mode);
        this.readOnly = !!options.readOnly;
        this.classroomLevel = normalizeClassroomLevel(options.classroomLevel, this.mode);
        this.targetOrigin = options.targetOrigin || '*';
        this.allowedParentOrigins = Array.isArray(options.allowedParentOrigins)
            ? options.allowedParentOrigins
            : [];
        this.featureFlags = normalizeFeatureFlags(this.mode, options.features);
        this.parentOrigin = null;
        this.boundMessage = (event) => this.onWindowMessage(event);
        this.statusPatched = false;

        if (this.enabled) {
            this.initialize();
        }
    }

    initialize() {
        if (!this.window || !this.document) return;
        this.window.addEventListener('message', this.boundMessage);
        this.patchStatusPublisher();
        this.applyRuntimeOptions();
        this.window.setTimeout(() => {
            this.emitEvent('ready', {
                channel: EMBED_CHANNEL,
                apiVersion: EMBED_API_VERSION,
                state: this.getStateSnapshot()
            });
        }, 0);
    }

    destroy() {
        if (!this.window) return;
        this.window.removeEventListener('message', this.boundMessage);
    }

    patchStatusPublisher() {
        if (this.statusPatched) return;
        if (!this.app || typeof this.app.updateStatus !== 'function') return;
        const original = this.app.updateStatus.bind(this.app);
        this.app.updateStatus = (text) => {
            original(text);
            this.emitEvent('status', { text: String(text || '') });
        };
        this.statusPatched = true;
    }

    isOriginAllowed(origin) {
        if (!origin || origin === 'null') return false;
        if (!Array.isArray(this.allowedParentOrigins) || this.allowedParentOrigins.length === 0) {
            return true;
        }
        return this.allowedParentOrigins.includes(origin);
    }

    applyRuntimeOptions() {
        const body = this.document?.body;
        if (!body?.classList) return;
        body.classList.add('embed-runtime');
        this.applyMode(this.mode);
        this.applyFeatures(this.featureFlags);
        this.applyClassroomLevel(this.classroomLevel, { announce: false });
    }

    applyMode(nextMode) {
        const body = this.document?.body;
        if (!body?.classList) return;
        this.mode = normalizeMode(nextMode);
        body.classList.toggle('embed-mode-edit', this.mode === EMBED_MODE_EDIT);
        body.classList.toggle('embed-mode-classroom', this.mode === EMBED_MODE_CLASSROOM);
        body.classList.toggle('embed-mode-readonly', this.mode === EMBED_MODE_READONLY);
        body.classList.toggle('embed-readonly', this.mode === EMBED_MODE_READONLY || this.readOnly);
    }

    applyFeatures(nextFlags = {}) {
        this.featureFlags = normalizeFeatureFlags(this.mode, nextFlags);
        const body = this.document?.body;
        if (!body?.classList) return;

        body.classList.toggle('embed-hide-toolbox', !this.featureFlags.toolbox);
        body.classList.toggle('embed-hide-side-panel', !this.featureFlags.sidePanel);
        body.classList.toggle('embed-hide-status', !this.featureFlags.statusBar);
        body.classList.toggle('embed-hide-ai', !this.featureFlags.ai);
        body.classList.toggle('embed-hide-exercise', !this.featureFlags.exerciseBoard);
        body.classList.toggle('embed-hide-observation', !this.featureFlags.observation);

        const observationTab = this.document.querySelector?.('.panel-tab-btn[data-panel="observation"]');
        if (observationTab) {
            observationTab.hidden = !this.featureFlags.observation;
        }
        const observationPanel = this.document.getElementById?.('panel-observation');
        if (observationPanel) {
            observationPanel.hidden = !this.featureFlags.observation;
            observationPanel.setAttribute('aria-hidden', !this.featureFlags.observation ? 'true' : 'false');
        }
        if (!this.featureFlags.observation && typeof this.app?.interaction?.activateSidePanelTab === 'function') {
            this.app.interaction.activateSidePanelTab('properties');
        }
    }

    applyClassroomLevel(level, options = {}) {
        const { announce = false } = options;
        this.classroomLevel = normalizeClassroomLevel(level, this.mode);
        if (this.mode !== EMBED_MODE_CLASSROOM && this.classroomLevel !== CLASSROOM_LEVEL_OFF) {
            this.classroomLevel = CLASSROOM_LEVEL_OFF;
        }
        if (typeof this.app?.setClassroomModeLevel === 'function') {
            this.app.setClassroomModeLevel(this.classroomLevel, { announce, persist: false });
        }
    }

    getStateSnapshot() {
        const componentCount = this.app?.circuit?.components?.size || 0;
        const wireCount = this.app?.circuit?.wires?.size || 0;
        return {
            mode: this.mode,
            readOnly: this.mode === EMBED_MODE_READONLY || this.readOnly,
            classroomLevel: this.app?.classroomMode?.activeLevel || CLASSROOM_LEVEL_OFF,
            isRunning: !!this.app?.circuit?.isRunning,
            componentCount,
            wireCount,
            featureFlags: { ...this.featureFlags }
        };
    }

    emitEvent(method, payload = {}) {
        const envelope = {
            channel: EMBED_CHANNEL,
            apiVersion: EMBED_API_VERSION,
            type: 'event',
            method,
            payload
        };
        this.postEnvelope(envelope, this.parentOrigin || this.targetOrigin || '*');
    }

    postEnvelope(envelope, targetOrigin = '*') {
        if (!this.parentWindow || typeof this.parentWindow.postMessage !== 'function') return;
        this.parentWindow.postMessage(envelope, targetOrigin || '*');
    }

    postResponse(method, id, payload, origin) {
        this.postEnvelope({
            channel: EMBED_CHANNEL,
            apiVersion: EMBED_API_VERSION,
            type: 'response',
            method,
            id,
            ok: true,
            payload
        }, origin);
    }

    postError(method, id, error, origin) {
        const code = error?.code || 'INTERNAL_ERROR';
        this.postEnvelope({
            channel: EMBED_CHANNEL,
            apiVersion: EMBED_API_VERSION,
            type: 'response',
            method,
            id,
            ok: false,
            error: {
                code,
                message: error?.message || '嵌入桥接请求失败',
                details: error?.details || null
            }
        }, origin);
    }

    onWindowMessage(event) {
        const data = event?.data;
        if (!data || typeof data !== 'object') return;
        if (data.channel !== EMBED_CHANNEL) return;
        if (data.apiVersion !== EMBED_API_VERSION) return;
        if (data.type !== 'request') return;
        if (this.parentWindow && event.source && event.source !== this.parentWindow) return;
        if (!this.isOriginAllowed(event.origin)) {
            this.postError(data.method, data.id, createBridgeError('FORBIDDEN', 'Origin is not allowed'), event.origin);
            return;
        }

        this.parentOrigin = event.origin;
        Promise.resolve()
            .then(() => this.handleRequest(data.method, data.payload))
            .then((payload) => this.postResponse(data.method, data.id, payload, event.origin))
            .catch((error) => {
                this.logger?.error?.('Embed request failed', error);
                this.postError(data.method, data.id, error, event.origin);
            });
    }

    handleRequest(method, payload = {}) {
        switch (method) {
            case 'ping':
                return { pong: true, now: Date.now() };
            case 'getState':
                return this.getStateSnapshot();
            case 'setOptions':
                return this.handleSetOptions(payload);
            case 'setClassroomMode':
                this.applyClassroomLevel(payload?.level, { announce: !!payload?.announce });
                return this.getStateSnapshot();
            case 'setReadonly':
                this.readOnly = !!payload?.readOnly;
                this.applyMode(this.mode);
                return this.getStateSnapshot();
            case 'run':
                this.app?.startSimulation?.();
                return this.getStateSnapshot();
            case 'stop':
                this.app?.stopSimulation?.();
                return this.getStateSnapshot();
            case 'clearCircuit':
                this.app?.clearCircuit?.();
                return this.getStateSnapshot();
            case 'loadCircuit':
                if (!payload || typeof payload !== 'object' || !payload.circuit) {
                    throw createBridgeError('INVALID_PAYLOAD', 'loadCircuit payload.circuit is required');
                }
                return {
                    summary: this.app?.loadCircuitData?.(payload.circuit, {
                        silent: true,
                        statusText: '已加载嵌入电路'
                    }),
                    state: this.getStateSnapshot()
                };
            case 'exportCircuit':
                return {
                    circuit: this.app?.buildSaveData?.() || null
                };
            default:
                throw createBridgeError('UNSUPPORTED_METHOD', `Unsupported method: ${String(method || '')}`);
        }
    }

    handleSetOptions(payload = {}) {
        if (payload.mode !== undefined) {
            this.mode = normalizeMode(payload.mode);
            this.applyMode(this.mode);
            this.featureFlags = normalizeFeatureFlags(this.mode, this.featureFlags);
        }
        if (payload.readOnly !== undefined) {
            this.readOnly = !!payload.readOnly;
            this.applyMode(this.mode);
        }
        if (payload.classroomLevel !== undefined) {
            this.applyClassroomLevel(payload.classroomLevel, { announce: !!payload.announce });
        }
        if (payload.features && typeof payload.features === 'object') {
            this.applyFeatures({
                ...this.featureFlags,
                ...payload.features
            });
        } else {
            this.applyFeatures(this.featureFlags);
        }
        return this.getStateSnapshot();
    }
}

export const EmbedProtocol = Object.freeze({
    channel: EMBED_CHANNEL,
    apiVersion: EMBED_API_VERSION
});
