(function bootstrapHSCSDeploy(global) {
    if (!global || !global.document) return;
    const script = global.document.currentScript;
    const baseHref = script?.src || global.location?.href || '';
    const moduleUrl = new URL('./src/embed/EmbedClient.js', baseHref).toString();

    global.HSCSAppletReady = import(moduleUrl)
        .then((module) => {
            global.HSCSApplet = module.HSCSApplet;
            return { HSCSApplet: module.HSCSApplet };
        })
        .catch((error) => {
            global.console?.error?.(
                '[deploycircuit] failed to initialize HSCSApplet. Ensure module CORS is enabled for /src/embed/EmbedClient.js.',
                error
            );
            throw error;
        });
})(typeof window !== 'undefined' ? window : globalThis);
