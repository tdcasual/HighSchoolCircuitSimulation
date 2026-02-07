import { getComponentTerminalCount } from '../../components/Component.js';

export class ConnectivityCache {
    computeComponentConnectedState(componentId, comp, terminalConnectionMap = new Map()) {
        if (!comp || !Array.isArray(comp.nodes)) return false;
        const terminalCount = getComponentTerminalCount(comp.type);

        const hasValidNode = (idx) => idx !== undefined && idx !== null && idx >= 0;
        const hasTerminalWire = (terminalIndex) => {
            const key = `${componentId}:${terminalIndex}`;
            return (terminalConnectionMap.get(key) || 0) > 0;
        };

        if (comp.type === 'Ground') {
            return hasValidNode(comp.nodes[0]) && hasTerminalWire(0);
        }

        if (comp.type === 'Relay') {
            const coilConnected = hasValidNode(comp.nodes[0]) && hasValidNode(comp.nodes[1])
                && hasTerminalWire(0) && hasTerminalWire(1);
            const contactConnected = hasValidNode(comp.nodes[2]) && hasValidNode(comp.nodes[3])
                && hasTerminalWire(2) && hasTerminalWire(3);
            return coilConnected || contactConnected;
        }

        if (comp.type !== 'Rheostat' && comp.type !== 'SPDTSwitch') {
            if (terminalCount < 2) return false;
            return hasValidNode(comp.nodes[0]) && hasValidNode(comp.nodes[1])
                && hasTerminalWire(0) && hasTerminalWire(1);
        }

        if (comp.type === 'SPDTSwitch') {
            const routeToB = comp.position === 'b';
            const targetTerminal = routeToB ? 2 : 1;
            return hasValidNode(comp.nodes[0]) && hasValidNode(comp.nodes[targetTerminal])
                && hasTerminalWire(0) && hasTerminalWire(targetTerminal);
        }

        const connectedTerminals = comp.nodes
            .map((nodeIdx, idx) => ({ nodeIdx, idx }))
            .filter(({ nodeIdx, idx }) => hasValidNode(nodeIdx) && hasTerminalWire(idx));
        if (connectedTerminals.length < 2) return false;
        const uniqueNodes = new Set(connectedTerminals.map((t) => t.nodeIdx));
        return uniqueNodes.size >= 2;
    }

    refreshComponentConnectivityCache(
        components,
        topologyVersion,
        terminalConnectionMap = new Map(),
        computeComponentConnectedState = null
    ) {
        const componentMap = components instanceof Map ? components : new Map();
        const compute = typeof computeComponentConnectedState === 'function'
            ? computeComponentConnectedState
            : (componentId, comp) => this.computeComponentConnectedState(componentId, comp, terminalConnectionMap);

        for (const [id, comp] of componentMap) {
            comp._isConnectedCached = compute(id, comp);
            comp._connectionTopologyVersion = topologyVersion;
        }
    }

    isComponentConnected(
        componentId,
        components,
        topologyVersion,
        terminalConnectionMap = new Map(),
        computeComponentConnectedState = null
    ) {
        const componentMap = components instanceof Map ? components : new Map();
        const comp = componentMap.get(componentId);
        if (!comp || !Array.isArray(comp.nodes)) return false;

        if (comp._connectionTopologyVersion === topologyVersion
            && typeof comp._isConnectedCached === 'boolean') {
            return comp._isConnectedCached;
        }

        const compute = typeof computeComponentConnectedState === 'function'
            ? computeComponentConnectedState
            : (id, component) => this.computeComponentConnectedState(id, component, terminalConnectionMap);
        const connected = compute(componentId, comp);
        comp._isConnectedCached = connected;
        comp._connectionTopologyVersion = topologyVersion;
        return connected;
    }
}
