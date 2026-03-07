import { getComponentDefinition, listComponentDefinitionTypes } from '../../infra/components/ComponentDefinitionRegistry.js';

function cloneDefaults(defaults = {}) {
    const cloneValue = (value) => {
        if (value == null) return value;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => cloneValue(item));
        }
        if (typeof value === 'object') {
            const output = {};
            for (const [key, nested] of Object.entries(value)) {
                output[key] = cloneValue(nested);
            }
            return output;
        }
        return undefined;
    };
    return cloneValue(defaults);
}

const COMPONENT_MANIFEST_V2_INTERNAL = Object.freeze(Object.fromEntries(
    listComponentDefinitionTypes().map((type) => {
        const definition = getComponentDefinition(type);
        return [
            type,
            Object.freeze({
                displayName: definition.displayName,
                terminalCount: definition.terminalCount,
                defaults: Object.freeze(cloneDefaults(definition.defaults))
            })
        ];
    })
));

export const COMPONENT_MANIFEST_V2 = COMPONENT_MANIFEST_V2_INTERNAL;

export function listComponentTypesV2() {
    return Object.keys(COMPONENT_MANIFEST_V2);
}

export function getComponentManifestV2(type) {
    const key = String(type || '');
    const manifest = COMPONENT_MANIFEST_V2[key];
    if (!manifest) {
        throw new Error(`Unknown component type: ${key}`);
    }
    return {
        ...manifest,
        defaults: cloneDefaults(manifest.defaults)
    };
}
