import { createRuntimeLogger } from '../utils/Logger.js';
import {
    CLASSROOM_LEVEL_OFF,
    createBridgeError,
    EMBED_MODE_CLASSROOM,
    EMBED_MODE_EDIT,
    EMBED_MODE_READONLY,
    normalizeClassroomLevel,
    normalizeFeatureFlags,
    normalizeMode
} from './EmbedRuntimeOptions.js';
import {
    handleEmbedRuntimeRequest,
    handleEmbedSetOptions
} from './EmbedRuntimeRequestRouter.js';
import {
    safeAddEventListener,
    safeClassListAdd,
    safeClassListToggle,
    safeRemoveEventListener
} from '../utils/RuntimeSafety.js';

export { normalizeModeV2Strict, parseEmbedRuntimeOptionsFromSearch } from './EmbedRuntimeOptions.js';

const EMBED_CHANNEL = 'HSCS_EMBED_V1';
const EMBED_API_VERSION = 1;
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
        safeAddEventListener(this.window, 'message', this.boundMessage);
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
        safeRemoveEventListener(this.window, 'message', this.boundMessage);
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
        safeClassListAdd(body, 'embed-runtime');
        this.applyMode(this.mode);
        this.applyFeatures(this.featureFlags);
        this.applyClassroomLevel(this.classroomLevel, { announce: false });
    }

    applyMode(nextMode) {
        const body = this.document?.body;
        if (!body?.classList) return;
        this.mode = normalizeMode(nextMode);
        safeClassListToggle(body, 'embed-mode-edit', this.mode === EMBED_MODE_EDIT);
        safeClassListToggle(body, 'embed-mode-classroom', this.mode === EMBED_MODE_CLASSROOM);
        safeClassListToggle(body, 'embed-mode-readonly', this.mode === EMBED_MODE_READONLY);
        safeClassListToggle(body, 'embed-readonly', this.mode === EMBED_MODE_READONLY || this.readOnly);
    }

    applyFeatures(nextFlags = {}) {
        this.featureFlags = normalizeFeatureFlags(this.mode, nextFlags);
        const body = this.document?.body;
        if (!body?.classList) return;

        safeClassListToggle(body, 'embed-hide-toolbox', !this.featureFlags.toolbox);
        safeClassListToggle(body, 'embed-hide-side-panel', !this.featureFlags.sidePanel);
        safeClassListToggle(body, 'embed-hide-status', !this.featureFlags.statusBar);
        safeClassListToggle(body, 'embed-hide-ai', !this.featureFlags.ai);
        safeClassListToggle(body, 'embed-hide-exercise', !this.featureFlags.exerciseBoard);
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

    isReadOnlyActive() {
        return this.mode === EMBED_MODE_READONLY || this.readOnly;
    }

    getStateSnapshot() {
        const componentCount = this.app?.circuit?.components?.size || 0;
        const wireCount = this.app?.circuit?.wires?.size || 0;
        return {
            mode: this.mode,
            readOnly: this.isReadOnlyActive(),
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
        return handleEmbedRuntimeRequest(this, method, payload);
    }

    handleSetOptions(payload = {}) {
        return handleEmbedSetOptions(this, payload);
    }
}

export const EmbedProtocol = Object.freeze({
    channel: EMBED_CHANNEL,
    apiVersion: EMBED_API_VERSION
});
