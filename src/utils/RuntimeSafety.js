function normalizeArgs(args) {
    if (args === undefined) return [];
    return Array.isArray(args) ? args : [args];
}

function tryInvoke(target, methodName, args = []) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') {
        return { ok: false, value: undefined };
    }
    try {
        return {
            ok: true,
            value: fn.apply(target, args)
        };
    } catch (_) {
        return { ok: false, value: undefined };
    }
}

export function safeInvoke(target, methodName, args = [], fallbackValue = undefined) {
    const result = tryInvoke(target, methodName, normalizeArgs(args));
    return result.ok ? result.value : fallbackValue;
}

export function safeSetAttribute(node, name, value) {
    return tryInvoke(node, 'setAttribute', [name, String(value)]).ok;
}

export function safeClassListAdd(node, className) {
    return tryInvoke(node?.classList, 'add', [className]).ok;
}

export function safeClassListRemove(node, className) {
    return tryInvoke(node?.classList, 'remove', [className]).ok;
}

export function safeClassListToggle(node, className, force) {
    const hasForce = force !== undefined;
    const result = tryInvoke(
        node?.classList,
        'toggle',
        hasForce ? [className, !!force] : [className]
    );
    if (!result.ok) return false;
    if (typeof result.value === 'boolean') return result.value;
    if (hasForce) return !!force;

    const contains = tryInvoke(node?.classList, 'contains', [className]);
    if (contains.ok) return !!contains.value;
    return true;
}

export function safeAddEventListener(target, eventName, handler, options) {
    const args = options === undefined
        ? [eventName, handler]
        : [eventName, handler, options];
    return tryInvoke(target, 'addEventListener', args).ok;
}

export function safeRemoveEventListener(target, eventName, handler, options) {
    const args = options === undefined
        ? [eventName, handler]
        : [eventName, handler, options];
    return tryInvoke(target, 'removeEventListener', args).ok;
}

export function safeFocus(target, options) {
    const args = options === undefined ? [] : [options];
    return tryInvoke(target, 'focus', args).ok;
}
