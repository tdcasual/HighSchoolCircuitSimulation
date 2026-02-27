(function initHSCSEmbedSDK(global) {
    if (!global || !global.document) return;

    var EMBED_CHANNEL = 'HSCS_EMBED_V1';
    var EMBED_API_VERSION = 1;
    var SCRIPT_SRC = global.document.currentScript && global.document.currentScript.src
        ? global.document.currentScript.src
        : '';

    var DEFAULT_FEATURE_FLAGS = Object.freeze({
        toolbox: true,
        sidePanel: true,
        observation: true,
        ai: false,
        exerciseBoard: false,
        statusBar: true
    });

    function normalizeMode(mode) {
        var text = String(mode || '').trim().toLowerCase();
        if (text === 'readonly' || text === 'classroom') return text;
        return 'edit';
    }

    function normalizeLevel(level, mode) {
        var text = String(level || '').trim().toLowerCase();
        if (text === 'standard' || text === 'enhanced' || text === 'off') return text;
        if (mode === 'classroom') return 'standard';
        return 'off';
    }

    function normalizeFeatures(features) {
        var merged = Object.assign({}, DEFAULT_FEATURE_FLAGS);
        if (features && typeof features === 'object') {
            Object.keys(merged).forEach(function eachFeature(key) {
                if (features[key] !== undefined) {
                    merged[key] = !!features[key];
                }
            });
        }
        return merged;
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

    function resolveBaseHref(runtimeWindow) {
        return SCRIPT_SRC || (runtimeWindow && runtimeWindow.location && runtimeWindow.location.href) || 'http://localhost/';
    }

    function buildEmbedUrl(options, baseHref) {
        var normalizedOptions = options || {};
        var mode = normalizeMode(normalizedOptions.mode);
        var classroomLevel = normalizeLevel(normalizedOptions.classroomLevel, mode);
        var features = normalizeFeatures(normalizedOptions.features);
        var source = normalizedOptions.src || 'viewer.html';
        var url = new URL(source, baseHref || 'http://localhost/');
        var parentOrigin = normalizedOptions.parentOrigin || normalizedOptions.targetOrigin || '*';

        url.searchParams.set('embed', '1');
        url.searchParams.set('mode', mode);
        url.searchParams.set('classroomLevel', classroomLevel);
        url.searchParams.set('readonly', normalizedOptions.readOnly || mode === 'readonly' ? '1' : '0');
        url.searchParams.set('autosave', normalizedOptions.autoSave ? '1' : '0');
        url.searchParams.set('restore', normalizedOptions.restoreFromStorage ? '1' : '0');

        if (parentOrigin && parentOrigin !== '*') {
            url.searchParams.set('targetOrigin', parentOrigin);
        }
        if (Array.isArray(normalizedOptions.allowedParentOrigins) && normalizedOptions.allowedParentOrigins.length > 0) {
            url.searchParams.set('allowedOrigins', normalizedOptions.allowedParentOrigins.join(','));
        }

        Object.keys(features).forEach(function setFeature(key) {
            url.searchParams.set(key, features[key] ? '1' : '0');
        });
        return url.toString();
    }

    function HSCSApplet(options) {
        var runtimeOptions = options || {};
        var runtimeWindow = global;
        var runtimeDocument = global.document;
        var parentOrigin = runtimeOptions.parentOrigin
            || runtimeOptions.targetOrigin
            || (runtimeWindow.location && runtimeWindow.location.origin)
            || '*';

        this.window = runtimeWindow;
        this.document = runtimeDocument;
        this.baseHref = runtimeOptions.baseHref || resolveBaseHref(runtimeWindow);
        this.options = {
            src: runtimeOptions.src || 'viewer.html',
            width: runtimeOptions.width || '100%',
            height: runtimeOptions.height || 720,
            mode: normalizeMode(runtimeOptions.mode),
            classroomLevel: normalizeLevel(runtimeOptions.classroomLevel, runtimeOptions.mode),
            readOnly: !!runtimeOptions.readOnly,
            features: normalizeFeatures(runtimeOptions.features),
            parentOrigin: parentOrigin,
            allowedParentOrigins: Array.isArray(runtimeOptions.allowedParentOrigins) ? runtimeOptions.allowedParentOrigins : [],
            autoSave: !!runtimeOptions.autoSave,
            restoreFromStorage: !!runtimeOptions.restoreFromStorage,
            initialCircuit: runtimeOptions.initialCircuit || null,
            requestTimeoutMs: Number.isFinite(runtimeOptions.requestTimeoutMs) ? runtimeOptions.requestTimeoutMs : 8000
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
        this.boundMessage = this.onWindowMessage.bind(this);
    }

    HSCSApplet.prototype.inject = async function inject(target) {
        if (!this.window || !this.document) {
            throw new Error('HSCSApplet requires browser window/document context');
        }

        var container = resolveContainer(this.document, target);
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

        var iframe = this.document.createElement('iframe');
        iframe.className = 'hscs-embed-frame';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.style.width = typeof this.options.width === 'number' ? this.options.width + 'px' : String(this.options.width);
        iframe.style.height = typeof this.options.height === 'number' ? this.options.height + 'px' : String(this.options.height);
        iframe.style.border = '0';
        iframe.style.display = 'block';
        iframe.style.background = '#fff';
        iframe.src = buildEmbedUrl(this.options, this.baseHref);

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
    };

    HSCSApplet.prototype.whenReady = function whenReady() {
        if (this.ready) return Promise.resolve(this);
        if (!this.readyPromise) {
            return Promise.reject(new Error('HSCSApplet is not injected yet'));
        }
        return this.readyPromise.then(() => this);
    };

    HSCSApplet.prototype.on = function on(eventName, handler) {
        if (typeof handler !== 'function') return this;
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(handler);
        return this;
    };

    HSCSApplet.prototype.off = function off(eventName, handler) {
        var bucket = this.listeners.get(eventName);
        if (!bucket) return this;
        bucket.delete(handler);
        if (bucket.size === 0) {
            this.listeners.delete(eventName);
        }
        return this;
    };

    HSCSApplet.prototype.emit = function emit(eventName, payload) {
        var bucket = this.listeners.get(eventName);
        if (!bucket) return;
        bucket.forEach(function eachHandler(handler) {
            try {
                handler(payload);
            } catch (_) {
                // Listener failures must not break SDK runtime.
            }
        });
    };

    HSCSApplet.prototype.onWindowMessage = function onWindowMessage(event) {
        if (!this.iframe || event.source !== this.iframe.contentWindow) return;
        if (this.embedOrigin !== '*' && event.origin && event.origin !== this.embedOrigin) return;

        var data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.channel !== EMBED_CHANNEL || data.apiVersion !== EMBED_API_VERSION) return;

        if (data.type === 'event') {
            if (data.method === 'ready' && !this.ready) {
                this.ready = true;
                this.clearReadyTimer();
                if (this.readyResolve) this.readyResolve(this);
            }
            this.emit(data.method || 'event', data.payload);
            this.emit('event', {
                method: data.method,
                payload: data.payload
            });
            return;
        }

        if (data.type !== 'response' || !data.id) return;
        var pending = this.pending.get(data.id);
        if (!pending) return;

        this.pending.delete(data.id);
        this.window.clearTimeout(pending.timer);
        if (data.ok) {
            pending.resolve(data.payload);
        } else {
            var error = new Error((data.error && data.error.message) || 'Embed request failed');
            error.code = (data.error && data.error.code) || 'EMBED_ERROR';
            error.details = (data.error && data.error.details) || null;
            pending.reject(error);
        }
    };

    HSCSApplet.prototype.rejectReady = function rejectReady(error) {
        this.clearReadyTimer();
        this.ready = false;
        if (this.readyReject) this.readyReject(error);
        this.readyPromise = null;
    };

    HSCSApplet.prototype.clearReadyTimer = function clearReadyTimer() {
        if (!this.window || !this.readyTimer) return;
        this.window.clearTimeout(this.readyTimer);
        this.readyTimer = null;
    };

    HSCSApplet.prototype.request = async function request(method, payload) {
        await this.whenReady();
        if (!this.iframe || !this.iframe.contentWindow) {
            throw new Error('Embed iframe is unavailable');
        }
        var requestId = 'hscs_' + Date.now() + '_' + (++this.messageSeq);
        var envelope = {
            channel: EMBED_CHANNEL,
            apiVersion: EMBED_API_VERSION,
            type: 'request',
            id: requestId,
            method: method,
            payload: payload || {}
        };

        var response = new Promise((resolve, reject) => {
            var timer = this.window.setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error('Embed request timeout: ' + method));
            }, this.options.requestTimeoutMs);
            this.pending.set(requestId, { resolve: resolve, reject: reject, timer: timer });
        });

        this.iframe.contentWindow.postMessage(envelope, this.embedOrigin || '*');
        return response;
    };

    HSCSApplet.prototype.ping = function ping() {
        return this.request('ping');
    };

    HSCSApplet.prototype.setOptions = function setOptions(options) {
        return this.request('setOptions', options || {});
    };

    HSCSApplet.prototype.run = function run() {
        return this.request('run');
    };

    HSCSApplet.prototype.stop = function stop() {
        return this.request('stop');
    };

    HSCSApplet.prototype.clearCircuit = function clearCircuit() {
        return this.request('clearCircuit');
    };

    HSCSApplet.prototype.loadCircuit = function loadCircuit(circuit) {
        return this.request('loadCircuit', { circuit: circuit });
    };

    HSCSApplet.prototype.exportCircuit = async function exportCircuit() {
        var response = await this.request('exportCircuit');
        return response && response.circuit ? response.circuit : null;
    };

    HSCSApplet.prototype.getState = function getState() {
        return this.request('getState');
    };

    HSCSApplet.prototype.setClassroomMode = function setClassroomMode(level, announce) {
        return this.request('setClassroomMode', {
            level: level,
            announce: !!announce
        });
    };

    HSCSApplet.prototype.setReadonly = function setReadonly(readOnly) {
        return this.request('setReadonly', { readOnly: !!readOnly });
    };

    // Compatibility aliases with deployggb-like command naming.
    HSCSApplet.prototype.play = HSCSApplet.prototype.run;
    HSCSApplet.prototype.pause = HSCSApplet.prototype.stop;
    HSCSApplet.prototype.reset = HSCSApplet.prototype.clearCircuit;
    HSCSApplet.prototype.loadScene = HSCSApplet.prototype.loadCircuit;

    HSCSApplet.prototype.togglePlay = async function togglePlay() {
        var state = await this.getState();
        if (state && state.isRunning) {
            return this.stop();
        }
        return this.run();
    };

    HSCSApplet.prototype.destroy = function destroy() {
        if (this.window) {
            this.window.removeEventListener('message', this.boundMessage);
        }
        this.clearReadyTimer();
        if (this.iframe && this.iframe.parentNode) {
            this.iframe.parentNode.removeChild(this.iframe);
        }
        this.iframe = null;
        this.ready = false;
        this.readyPromise = null;

        this.pending.forEach((entry) => {
            this.window && this.window.clearTimeout && this.window.clearTimeout(entry.timer);
            entry.reject(new Error('HSCSApplet destroyed'));
        });
        this.pending.clear();
    };

    global.HSCSApplet = HSCSApplet;
    global.HSCSAppletProtocol = Object.freeze({
        channel: EMBED_CHANNEL,
        apiVersion: EMBED_API_VERSION
    });
    global.HSCSAppletReady = Promise.resolve({ HSCSApplet: HSCSApplet });
})(typeof window !== 'undefined' ? window : globalThis);
