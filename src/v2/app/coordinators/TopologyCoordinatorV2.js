import { NetlistBuilderV2 } from '../../simulation/NetlistBuilderV2.js';

function collectNodeList(components = []) {
    let maxNodeIndex = 0;
    for (const component of components) {
        for (const node of component?.nodes || []) {
            const parsed = Number(node);
            if (Number.isInteger(parsed) && parsed > maxNodeIndex) {
                maxNodeIndex = parsed;
            }
        }
    }
    return Array.from({ length: maxNodeIndex + 1 }, (_, index) => index);
}

export class TopologyCoordinatorV2 {
    constructor({ netlistBuilder = new NetlistBuilderV2() } = {}) {
        this.netlistBuilder = netlistBuilder;
    }

    buildNetlist(circuitModel) {
        const componentMap = circuitModel?.components instanceof Map ? circuitModel.components : new Map();
        const components = Array.from(componentMap.values());
        const nodes = collectNodeList(components);
        return this.netlistBuilder.build({
            components,
            nodes
        });
    }
}
