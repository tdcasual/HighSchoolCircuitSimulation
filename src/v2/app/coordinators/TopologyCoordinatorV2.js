import { NetlistBuilderV2 } from '../../simulation/NetlistBuilderV2.js';
import { NodeBuilderV2 } from '../../simulation/NodeBuilderV2.js';

function asList(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (source instanceof Map) return Array.from(source.values());
    return [];
}

function readSnapshotCollections(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return { components: [], wires: [] };
    }
    return {
        components: asList(snapshot.components),
        wires: asList(snapshot.wires)
    };
}

function workingComponentMap(components) {
    const map = new Map();
    for (const component of components) {
        if (!component || component.id === undefined || component.id === null) continue;
        if (typeof component.id === 'string' && !component.id.trim()) continue;
        map.set(component.id, { ...component });
    }
    return map;
}

function detectRheostatConnectionMode(componentId, terminalConnectionMap) {
    const leftConnected = (terminalConnectionMap.get(`${componentId}:0`) || 0) > 0;
    const rightConnected = (terminalConnectionMap.get(`${componentId}:1`) || 0) > 0;
    const sliderConnected = (terminalConnectionMap.get(`${componentId}:2`) || 0) > 0;

    if (sliderConnected) {
        if (leftConnected && rightConnected) return 'all';
        if (leftConnected) return 'left-slider';
        if (rightConnected) return 'right-slider';
        return 'slider-only';
    }
    if (leftConnected && rightConnected) return 'left-right';
    return 'none';
}

export class TopologyCoordinatorV2 {
    constructor({
        netlistBuilder = new NetlistBuilderV2(),
        nodeBuilder = new NodeBuilderV2()
    } = {}) {
        this.netlistBuilder = netlistBuilder;
        this.nodeBuilder = nodeBuilder;
    }

    buildNetlist(snapshot, options = {}) {
        const { components, wires } = readSnapshotCollections(snapshot);
        const componentMap = workingComponentMap(components);

        const topology = this.nodeBuilder.build({
            components: componentMap,
            wires,
            getTerminalWorldPosition: options.getTerminalWorldPosition
        });

        for (const [id, component] of componentMap) {
            if (component.type !== 'Rheostat') continue;
            component.connectionMode = detectRheostatConnectionMode(id, topology.terminalConnectionMap);
        }

        return this.netlistBuilder.build({
            components: Array.from(componentMap.values()),
            nodes: topology.nodes
        });
    }
}
