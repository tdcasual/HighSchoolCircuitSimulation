(function bootstrapHSCSDeployCompat(global) {
    if (!global || !global.document) return;
    if (global.HSCSApplet && global.HSCSAppletReady) return;

    const script = global.document.currentScript;
    const baseHref = script?.src || global.location?.href || '';
    const sdkUrl = new URL('./embed.js', baseHref).toString();

    global.HSCSAppletReady = new Promise((resolve, reject) => {
        const existing = Array.from(global.document.getElementsByTagName('script'))
            .find((tag) => tag.src === sdkUrl);

        const onReady = () => {
            if (!global.HSCSApplet) {
                reject(new Error('[deploycircuit] embed.js loaded but HSCSApplet is unavailable'));
                return;
            }
            resolve({ HSCSApplet: global.HSCSApplet });
        };

        if (global.HSCSApplet) {
            onReady();
            return;
        }

        const loader = existing || global.document.createElement('script');
        if (!existing) {
            loader.src = sdkUrl;
            loader.async = true;
            loader.defer = true;
            global.document.head.appendChild(loader);
        }
        loader.addEventListener('load', onReady, { once: true });
        loader.addEventListener('error', () => {
            reject(new Error('[deploycircuit] failed to load embed.js'));
        }, { once: true });
    });
})(typeof window !== 'undefined' ? window : globalThis);
