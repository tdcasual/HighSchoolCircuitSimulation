import { SOURCE_RENDERER_METHODS } from './SourceRenderers.js';
import { PASSIVE_RENDERER_METHODS } from './PassiveRenderers.js';
import { CONTROL_RENDERER_METHODS } from './ControlRenderers.js';
import { INSTRUMENT_RENDERER_METHODS } from './InstrumentRenderers.js';

export const LEGACY_RENDERER_METHODS = Object.freeze({
    ...SOURCE_RENDERER_METHODS,
    ...PASSIVE_RENDERER_METHODS,
    ...CONTROL_RENDERER_METHODS,
    ...INSTRUMENT_RENDERER_METHODS
});

export function renderLegacyComponent(renderer, g, comp) {
    const methodName = LEGACY_RENDERER_METHODS[comp?.type];
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
