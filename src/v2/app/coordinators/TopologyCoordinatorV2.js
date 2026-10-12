import { NetlistBuilderV2 } from '../../simulation/NetlistBuilderV2.js';
import { NodeBuilderV2 } from '../../simulation/NodeBuilderV2.js';
import { getComponentManifestV2 } from '../../domain/components/ComponentManifest.js';

function terminalCountOf(type) {
    try {
        const count = Number(getComponentManifestV2(type).terminalCount);
        return Number.isInteger(count) && count > 0 ? count : 2;
    } catch {
        return 2;
    }
}

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

function copyPoint(point) {
    if (!point || typeof point !== 'object') return point;
    return { x: point.x, y: point.y };
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

function workingWireMap(wires) {
    const map = new Map();
    for (const wire of wires) {
        if (!wire || wire.id === undefined || wire.id === null) continue;
        if (typeof wire.id === 'string' && !wire.id.trim()) continue;
        map.set(wire.id, {
            ...wire,
            a: copyPoint(wire.a),
            b: copyPoint(wire.b)
        });
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
        const wireMap = workingWireMap(wires);

        const topology = this.nodeBuilder.build({
            components: componentMap,
            wires: wireMap,
            getTerminalWorldPosition: options.getTerminalWorldPosition,
            getTerminalCount: terminalCountOf
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
