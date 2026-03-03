import { SOURCE_RENDERER_METHODS } from './registry/SourceRendererMethods.js';
import { PASSIVE_RENDERER_METHODS } from './registry/PassiveRendererMethods.js';
import { CONTROL_RENDERER_METHODS } from './registry/ControlRendererMethods.js';
import { INSTRUMENT_RENDERER_METHODS } from './registry/InstrumentRendererMethods.js';

export const COMPONENT_RENDERER_METHODS = Object.freeze({
    ...SOURCE_RENDERER_METHODS,
    ...PASSIVE_RENDERER_METHODS,
    ...CONTROL_RENDERER_METHODS,
    ...INSTRUMENT_RENDERER_METHODS
});

export function renderComponentByRegistry(renderer, g, comp) {
    const methodName = COMPONENT_RENDERER_METHODS[comp?.type];
    if (!methodName) {
        return false;
    }
    const renderMethod = renderer?.[methodName];
    if (typeof renderMethod !== 'function') {
        return false;
    }
    renderMethod.call(renderer, g, comp);
    return true;
}

