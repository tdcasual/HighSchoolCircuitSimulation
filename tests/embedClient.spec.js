import { describe, expect, it, vi } from 'vitest';
import { HSCSApplet, buildEmbedUrl } from '../src/embed/EmbedClient.js';

describe('buildEmbedUrl', () => {
    it('builds embed url with mode/features/runtime flags', () => {
        const href = buildEmbedUrl({
            src: 'embed.html',
            mode: 'classroom',
            classroomLevel: 'enhanced',
            readOnly: false,
            autoSave: true,
            restoreFromStorage: false,
            targetOrigin: 'https://lms.example',
            features: {
                toolbox: false,
                ai: true
            }
        }, 'https://sim.example/app/');

        const url = new URL(href);
        expect(url.origin).toBe('https://sim.example');
        expect(url.pathname).toBe('/app/embed.html');
        expect(url.searchParams.get('embed')).toBe('1');
        expect(url.searchParams.get('mode')).toBe('classroom');
        expect(url.searchParams.get('classroomLevel')).toBe('enhanced');
        expect(url.searchParams.get('autosave')).toBe('1');
        expect(url.searchParams.get('restore')).toBe('0');
        expect(url.searchParams.get('targetOrigin')).toBe('https://lms.example');
        expect(url.searchParams.get('toolbox')).toBe('0');
        expect(url.searchParams.get('ai')).toBe('1');
    });

    it('posts to iframe origin and forwards parent origin into runtime query', async () => {
        const listeners = new Map();
        const iframeContentWindow = {
            postMessage: vi.fn()
        };
        const container = {
            child: null,
            appendChild(node) {
                this.child = node;
                node.parentNode = this;
            },
            removeChild(node) {
                if (this.child === node) {
                    this.child = null;
                }
            }
        };

        const doc = {
            querySelector: vi.fn((selector) => (selector === '#mount' ? container : null)),
            createElement: vi.fn(() => ({
                className: '',
                setAttribute: vi.fn(),
                style: {},
                contentWindow: iframeContentWindow,
                parentNode: null
            }))
        };
        const win = {
            location: {
                href: 'https://portal.example/course/lesson',
                origin: 'https://portal.example'
            },
            addEventListener: vi.fn((eventName, handler) => listeners.set(eventName, handler)),
            removeEventListener: vi.fn((eventName) => listeners.delete(eventName)),
            setTimeout,
            clearTimeout
        };

        const applet = new HSCSApplet(
            {
                src: 'https://sim.example/embed.html',
                targetOrigin: 'https://portal.example'
            },
            {
                window: win,
                document: doc
            }
        );

        const injectPromise = applet.inject('#mount');
        const onMessage = listeners.get('message');
        const iframe = container.child;
        const iframeUrl = new URL(iframe.src);
        expect(iframeUrl.origin).toBe('https://sim.example');
        expect(iframeUrl.searchParams.get('targetOrigin')).toBe('https://portal.example');

        onMessage({
            source: iframe.contentWindow,
            origin: 'https://sim.example',
            data: {
                channel: 'HSCS_EMBED_V1',
                apiVersion: 1,
                type: 'event',
                method: 'ready',
                payload: {}
            }
        });
        await injectPromise;

        const requestPromise = applet.request('ping');
        await Promise.resolve();
        expect(iframeContentWindow.postMessage).toHaveBeenCalledTimes(1);
        const [envelope, postOrigin] = iframeContentWindow.postMessage.mock.calls[0];
        expect(postOrigin).toBe('https://sim.example');
        expect(envelope.method).toBe('ping');

        onMessage({
            source: iframe.contentWindow,
            origin: 'https://sim.example',
            data: {
                channel: 'HSCS_EMBED_V1',
                apiVersion: 1,
                type: 'response',
                id: envelope.id,
                ok: true,
                payload: {
                    pong: true
                }
            }
        });
        await expect(requestPromise).resolves.toEqual({ pong: true });
        applet.destroy();
    });
});

describe('HSCSApplet resilience', () => {
    it('inject keeps progressing when message listener registration throws', async () => {
        const iframeContentWindow = {
            postMessage: vi.fn()
        };
        const container = {
            child: null,
            appendChild(node) {
                this.child = node;
                node.parentNode = this;
            },
            removeChild(node) {
                if (this.child === node) {
                    this.child = null;
                }
            }
        };
        const doc = {
            querySelector: vi.fn((selector) => (selector === '#mount' ? container : null)),
            createElement: vi.fn(() => ({
                className: '',
                setAttribute: vi.fn(),
                style: {},
                contentWindow: iframeContentWindow,
                parentNode: null
            }))
        };
        const win = {
            location: {
                href: 'https://portal.example/course/lesson',
                origin: 'https://portal.example'
            },
            addEventListener: vi.fn(() => {
                throw new Error('listener registration failed');
            }),
            removeEventListener: vi.fn(),
            setTimeout,
            clearTimeout
        };

        const applet = new HSCSApplet(
            {
                src: 'https://sim.example/embed.html',
                requestTimeoutMs: 100
            },
            {
                window: win,
                document: doc
            }
        );

        const injectPromise = applet.inject('#mount');
        await Promise.resolve();
        expect(container.child).toBeTruthy();
        applet.onWindowMessage({
            source: container.child.contentWindow,
            origin: 'https://sim.example',
            data: {
                channel: 'HSCS_EMBED_V1',
                apiVersion: 1,
                type: 'event',
                method: 'ready',
                payload: {}
            }
        });
        await expect(injectPromise).resolves.toBe(applet);
        applet.destroy();
    });

    it('inject tolerates iframe setAttribute failures', async () => {
        const listeners = new Map();
        const iframeContentWindow = {
            postMessage: vi.fn()
        };
        const container = {
            child: null,
            appendChild(node) {
                this.child = node;
                node.parentNode = this;
            },
            removeChild(node) {
                if (this.child === node) {
                    this.child = null;
                }
            }
        };
        const doc = {
            querySelector: vi.fn((selector) => (selector === '#mount' ? container : null)),
            createElement: vi.fn(() => ({
                className: '',
                setAttribute: vi.fn(() => {
                    throw new Error('setAttribute failed');
                }),
                style: {},
                contentWindow: iframeContentWindow,
                parentNode: null
            }))
        };
        const win = {
            location: {
                href: 'https://portal.example/course/lesson',
                origin: 'https://portal.example'
            },
            addEventListener: vi.fn((eventName, handler) => listeners.set(eventName, handler)),
            removeEventListener: vi.fn((eventName) => listeners.delete(eventName)),
            setTimeout,
            clearTimeout
        };

        const applet = new HSCSApplet(
            {
                src: 'https://sim.example/embed.html',
                requestTimeoutMs: 100
            },
            {
                window: win,
                document: doc
            }
        );

        const injectPromise = applet.inject('#mount');
        await Promise.resolve();
        const onMessage = listeners.get('message');
        expect(onMessage).toBeTypeOf('function');
        onMessage({
            source: container.child.contentWindow,
            origin: 'https://sim.example',
            data: {
                channel: 'HSCS_EMBED_V1',
                apiVersion: 1,
                type: 'event',
                method: 'ready',
                payload: {}
            }
        });
        await expect(injectPromise).resolves.toBe(applet);
        applet.destroy();
    });

    it('destroy ignores removeEventListener failures', () => {
        const applet = new HSCSApplet(
            {},
            {
                window: {
                    location: { origin: 'https://portal.example' },
                    removeEventListener: vi.fn(() => {
                        throw new Error('remove failed');
                    }),
                    clearTimeout
                },
                document: {}
            }
        );
        applet.iframe = {
            parentNode: {
                removeChild: vi.fn()
            }
        };

        expect(() => applet.destroy()).not.toThrow();
    });
});
