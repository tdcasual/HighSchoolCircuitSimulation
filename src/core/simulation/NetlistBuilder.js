export class NetlistBuilder {
    build({ components = [], nodes = [] } = {}) {
        return {
            nodes: Array.isArray(nodes) ? nodes : [],
            components: Array.isArray(components) ? components : []
        };
    }
}
