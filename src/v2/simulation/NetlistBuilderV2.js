export class NetlistBuilderV2 {
    static OMIT_PARAM_KEYS = new Set(['id', 'type', 'nodes']);

    toNodeEntry(node, index) {
        if (node && typeof node === 'object' && node.id != null) {
            return { id: String(node.id) };
        }
        if (typeof node === 'string' || typeof node === 'number') {
            return { id: String(node) };
        }
        return { id: `N${index}` };
    }

    normalizeTerminalNode(node) {
        if (typeof node === 'string' || typeof node === 'number') {
            return node;
        }
        if (node && typeof node === 'object' && node.id != null) {
            return String(node.id);
        }
        return null;
    }

    toPlainValue(value) {
        if (value == null) return value;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value
                .map((item) => this.toPlainValue(item))
                .filter((item) => item !== undefined);
        }
        if (typeof value === 'object') {
            return this.toPlainObject(value);
        }
        return undefined;
    }

    toPlainObject(value) {
        const output = {};
        for (const [key, nestedValue] of Object.entries(value || {})) {
            const plainValue = this.toPlainValue(nestedValue);
            if (plainValue === undefined) continue;
            output[key] = plainValue;
        }
        return output;
    }

    extractParams(component) {
        const params = {};
        for (const [key, value] of Object.entries(component || {})) {
            if (NetlistBuilderV2.OMIT_PARAM_KEYS.has(key)) continue;
            const plainValue = this.toPlainValue(value);
            if (plainValue === undefined) continue;
            params[key] = plainValue;
        }
        return params;
    }

    toComponentEntry(component, index) {
        const safeComponent = component && typeof component === 'object' ? component : {};
        const type = typeof safeComponent.type === 'string' ? safeComponent.type : 'Unknown';
        const hasId = safeComponent.id !== undefined
            && safeComponent.id !== null
            && (typeof safeComponent.id !== 'string' || safeComponent.id.trim());
        const id = hasId ? String(safeComponent.id) : `${type}_${index}`;
        const sourceNodes = Array.isArray(safeComponent.nodes) ? safeComponent.nodes : [];
        const nodes = sourceNodes
            .map((node) => this.normalizeTerminalNode(node))
            .filter((node) => node !== null);

        return {
            id,
            type,
            nodes,
            params: this.extractParams(safeComponent)
        };
    }

    build({ components = [], nodes = [] } = {}) {
        const sourceComponents = Array.isArray(components) ? components : [];
        const sourceNodes = Array.isArray(nodes) ? nodes : [];
        return {
            meta: { version: 2 },
            nodes: sourceNodes.map((node, index) => this.toNodeEntry(node, index)),
            components: sourceComponents.map((component, index) => this.toComponentEntry(component, index))
        };
    }
}
