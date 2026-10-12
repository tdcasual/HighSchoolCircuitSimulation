export function assignInteractionMethods(host, ...methodMaps) {
    if (!host) return;
    for (const map of methodMaps) {
        if (!map) continue;
        for (const name of Object.keys(map)) {
            host[name] = map[name];
        }
    }
}
