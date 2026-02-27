const EMBED_CHANNEL = 'HSCS_EMBED_V1';
const EMBED_API_VERSION = 1;

const DEFAULT_FEATURE_FLAGS = Object.freeze({
    toolbox: true,
    sidePanel: true,
    observation: true,
    ai: false,
    exerciseBoard: false,
    statusBar: true
});

function resolveDefaultEmbedSrc() {
    try {
        return new URL('../../viewer.html', import.meta.url).toString();
    } catch (_) {
        return 'viewer.html';
    }
}

function normalizeMode(mode) {
    const text = String(mode || '').trim().toLowerCase();
    if (text === 'readonly' || text === 'classroom') return text;
    return 'edit';
}

function normalizeLevel(level, mode = 'edit') {
    const text = String(level || '').trim().toLowerCase();
    if (text === 'standard' || text === 'enhanced' || text === 'off') return text;
    if (mode === 'classroom') return 'standard';
    return 'off';
}

function normalizeFeatures(features = {}) {
    const merged = { ...DEFAULT_FEATURE_FLAGS };
    if (features && typeof features === 'object') {
        Object.keys(merged).forEach((key) => {
            if (features[key] !== undefined) {
                merged[key] = !!features[key];
            }
        });
    }
    return merged;
}

function resolveBaseHref(runtimeWindow) {
    return runtimeWindow?.location?.href || 'http://localhost/';
}

function resolveContainer(documentRef, target) {
    if (!target) return null;
    if (typeof target === 'string') {
        return documentRef.querySelector(target);
    }
    if (typeof target.appendChild === 'function') {
        return target;
    }
    return null;
}

export function buildEmbedUrl(options = {}, baseHref = 'http://localhost/') {
    const mode = normalizeMode(options.mode);
    const classroomLevel = normalizeLevel(options.classroomLevel, mode);
    const features = normalizeFeatures(options.features);
    const source = options.src || 'embed.html';
    const url = new URL(source, baseHref);

    url.searchParams.set('embed', '1');
    url.searchParams.set('mode', mode);
    url.searchParams.set('classroomLevel', classroomLevel);
    url.searchParams.set('readonly', options.readOnly || mode === 'readonly' ? '1' : '0');
    url.searchParams.set('autosave', options.autoSave ? '1' : '0');
    url.searchParams.set('restore', options.restoreFromStorage ? '1' : '0');

    const parentOrigin = options.parentOrigin || options.targetOrigin || '*';
    if (parentOrigin && parentOrigin !== '*') {
        url.searchParams.set('targetOrigin', parentOrigin);
    }
    if (Array.isArray(options.allowedParentOrigins) && options.allowedParentOrigins.length > 0) {
        url.searchParams.set('allowedOrigins', options.allowedParentOrigins.join(','));
    }

    Object.entries(features).forEach(([key, value]) => {
        url.searchParams.set(key, value ? '1' : '0');
    });

    return url.toString();
}

export class HSCSApplet {
    constructor(options = {}, runtime = {}) {
        this.window = runtime.window || (typeof window !== 'undefined' ? window : null);
        this.document = runtime.document || (typeof document !== 'undefined' ? document : null);
        const parentOrigin = options.parentOrigin || options.targetOrigin || this.window?.location?.origin || '*';
        this.options = {
            src: options.src || resolveDefaultEmbedSrc(),
            width: options.width || '100%',
            height: options.height || 720,
            mode: normalizeMode(options.mode),
            classroomLevel: normalizeLevel(options.classroomLevel, options.mode),
            readOnly: !!options.readOnly,
            features: normalizeFeatures(options.features),
            parentOrigin,
            allowedParentOrigins: Array.isArray(options.allowedParentOrigins) ? options.allowedParentOrigins : [],
            autoSave: !!options.autoSave,
            restoreFromStorage: !!options.restoreFromStorage,
            initialCircuit: options.initialCircuit || null,
            requestTimeoutMs: Number.isFinite(options.requestTimeoutMs) ? options.requestTimeoutMs : 8000
        };

        this.container = null;
        this.iframe = null;
        this.embedOrigin = '*';
        this.ready = false;
        this.readyPromise = null;
        this.readyResolve = null;
        this.readyReject = null;
        this.readyTimer = null;
        this.messageSeq = 0;
        this.pending = new Map();
        this.listeners = new Map();
        this.boundMessage = (event) => this.onWindowMessage(event);
    }

    async inject(target) {
        if (!this.window || !this.document) {
            throw new Error('HSCSApplet requires browser window/document context');
        }
        const container = resolveContainer(this.document, target);
        if (!container) {
            throw new Error('Invalid container target for HSCSApplet.inject');
        }
        this.destroy();
        this.container = container;
        this.window.addEventListener('message', this.boundMessage);

        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        this.readyTimer = this.window.setTimeout(() => {
            if (this.ready) return;
            this.rejectReady(new Error('HSCSApplet embed handshake timeout'));
        }, this.options.requestTimeoutMs);

        const iframe = this.document.createElement('iframe');
        iframe.className = 'hscs-embed-frame';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.style.width = typeof this.options.width === 'number' ? `${this.options.width}px` : String(this.options.width);
        iframe.style.height = typeof this.options.height === 'number' ? `${this.options.height}px` : String(this.options.height);
        iframe.style.border = '0';
        iframe.style.display = 'block';
        iframe.style.background = '#fff';
        iframe.src = buildEmbedUrl(this.options, resolveBaseHref(this.window));
        try {
            this.embedOrigin = new URL(iframe.src).origin;
        } catch (_) {
            this.embedOrigin = '*';
        }
        container.appendChild(iframe);
        this.iframe = iframe;

        await this.whenReady();
        if (this.options.initialCircuit) {
            await this.loadCircuit(this.options.initialCircuit);
        }
        return this;
    }

    whenReady() {
        if (this.ready) {
            return Promise.resolve(this);
        }
        if (!this.readyPromise) {
            return Promise.reject(new Error('HSCSApplet is not injected yet'));
        }
        return this.readyPromise.then(() => this);
    }

    on(eventName, handler) {
        if (typeof handler !== 'function') return this;
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(handler);
        return this;
    }

    off(eventName, handler) {
        const bucket = this.listeners.get(eventName);
        if (!bucket) return this;
        bucket.delete(handler);
        if (bucket.size === 0) {
            this.listeners.delete(eventName);
        }
        return this;
    }

    emit(eventName, payload) {
        const bucket = this.listeners.get(eventName);
        if (!bucket) return;
        bucket.forEach((handler) => {
            try {
                handler(payload);
            } catch (_) {
                // Listener failures must not break SDK runtime.
            }
        });
    }

    onWindowMessage(event) {
        if (!this.iframe || event.source !== this.iframe.contentWindow) return;
        if (this.embedOrigin !== '*' && event.origin && event.origin !== this.embedOrigin) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.channel !== EMBED_CHANNEL || data.apiVersion !== EMBED_API_VERSION) return;

        if (data.type === 'event') {
            if (data.method === 'ready' && !this.ready) {
                this.ready = true;
                this.clearReadyTimer();
                this.readyResolve?.(this);
            }
            this.emit(data.method || 'event', data.payload);
            this.emit('event', {
                method: data.method,
                payload: data.payload
            });
            return;
        }

        if (data.type !== 'response' || !data.id) return;
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        this.window.clearTimeout(pending.timer);
        if (data.ok) {
            pending.resolve(data.payload);
        } else {
            const error = new Error(data.error?.message || 'Embed request failed');
            error.code = data.error?.code || 'EMBED_ERROR';
            error.details = data.error?.details || null;
            pending.reject(error);
        }
    }

    rejectReady(error) {
        this.clearReadyTimer();
        this.ready = false;
        this.readyReject?.(error);
        this.readyPromise = null;
    }

    clearReadyTimer() {
        if (!this.window || !this.readyTimer) return;
        this.window.clearTimeout(this.readyTimer);
        this.readyTimer = null;
    }

    async request(method, payload = {}) {
        await this.whenReady();
        if (!this.iframe?.contentWindow) {
            throw new Error('Embed iframe is unavailable');
        }
        const id = `hscs_${Date.now()}_${++this.messageSeq}`;
        const envelope = {
            channel: EMBED_CHANNEL,
            apiVersion: EMBED_API_VERSION,
            type: 'request',
            id,
            method,
            payload
        };
        const response = new Promise((resolve, reject) => {
            const timer = this.window.setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Embed request timeout: ${method}`));
            }, this.options.requestTimeoutMs);
            this.pending.set(id, { resolve, reject, timer });
        });
        this.iframe.contentWindow.postMessage(envelope, this.embedOrigin || '*');
        return response;
    }

    async setOptions(options = {}) {
        return this.request('setOptions', options);
    }

    async run() {
        return this.request('run');
    }

    async stop() {
        return this.request('stop');
    }

    async clearCircuit() {
        return this.request('clearCircuit');
    }

    async loadCircuit(circuit) {
        return this.request('loadCircuit', { circuit });
    }

    async exportCircuit() {
        const response = await this.request('exportCircuit');
        return response?.circuit || null;
    }

    async getState() {
        return this.request('getState');
    }

    async setClassroomMode(level, announce = false) {
        return this.request('setClassroomMode', {
            level,
            announce
        });
    }

    async setReadonly(readOnly) {
        return this.request('setReadonly', { readOnly: !!readOnly });
    }

    destroy() {
        if (this.window) {
            this.window.removeEventListener('message', this.boundMessage);
        }
        this.clearReadyTimer();
        if (this.iframe?.parentNode) {
            this.iframe.parentNode.removeChild(this.iframe);
        }
        this.iframe = null;
        this.ready = false;
        this.readyPromise = null;
        this.pending.forEach((entry) => {
            this.window?.clearTimeout?.(entry.timer);
            entry.reject(new Error('HSCSApplet destroyed'));
        });
        this.pending.clear();
    }
}
