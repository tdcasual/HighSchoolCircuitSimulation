export class NetlistBuilder {
    static OMIT_PARAM_KEYS = new Set(['id', 'type', 'nodes']);

    toNodeEntry(node, index) {
        return {
            index,
            node
        };
    }

    toComponentEntry(component, index) {
        const safeComponent = component && typeof component === 'object' ? component : {};
        const type = typeof safeComponent.type === 'string' ? safeComponent.type : 'Unknown';
        const id = safeComponent.id || `${type}_${index}`;
        const nodes = Array.isArray(safeComponent.nodes) ? [...safeComponent.nodes] : [];
        return {
            id,
            type,
            nodes,
            params: this.extractParams(safeComponent),
            source: component
        };
    }

    extractParams(component) {
        const params = {};
        for (const [key, value] of Object.entries(component || {})) {
            if (NetlistBuilder.OMIT_PARAM_KEYS.has(key)) continue;
            if (typeof value === 'function') continue;
            params[key] = value;
        }
        return params;
    }

    build({ components = [], nodes = [] } = {}) {
        const sourceComponents = Array.isArray(components) ? components : [];
        const sourceNodes = Array.isArray(nodes) ? nodes : [];
        return {
            meta: { version: 1 },
            nodes: sourceNodes.map((node, index) => this.toNodeEntry(node, index)),
            components: sourceComponents.map((component, index) => this.toComponentEntry(component, index))
        };
    }
}
