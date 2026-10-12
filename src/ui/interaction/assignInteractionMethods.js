export function assignInteractionMethods(InteractionManagerClass, ...methodMaps) {
    const proto = InteractionManagerClass.prototype;
    for (const map of methodMaps) {
        if (!map) continue;
        for (const name of Object.keys(map)) {
            proto[name] = map[name];
        }
    }
}
