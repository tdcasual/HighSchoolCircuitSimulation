import { getComponentTerminalCount } from '../../components/Component.js';
import { pointKey } from '../../utils/CanvasCoords.js';

export class NodeBuilder {
    build({ components, wires, getTerminalWorldPosition } = {}) {
        const componentMap = components instanceof Map ? components : new Map();
        const wireMap = wires instanceof Map ? wires : new Map();
        const resolveTerminalPosition = typeof getTerminalWorldPosition === 'function'
            ? getTerminalWorldPosition
            : () => null;

        // Union-find over "posts" (component terminals + wire endpoints).
        const parent = new Map(); // postId -> parentPostId

        const find = (key) => {
            if (!parent.has(key)) parent.set(key, key);
            if (parent.get(key) !== key) {
                parent.set(key, find(parent.get(key)));
            }
            return parent.get(key);
        };

        const union = (key1, key2) => {
            const root1 = find(key1);
            const root2 = find(key2);
            if (root1 !== root2) parent.set(root1, root2);
        };

        // Coordinate buckets: posts at the same (quantized) coordinate belong to the same electrical node.
        const coordRepresentative = new Map(); // coordKey -> postId
        const coordTerminalCount = new Map(); // coordKey -> count of component terminals
        const coordWireEndpointCount = new Map(); // coordKey -> count of wire endpoints
        const terminalCoordKey = new Map(); // terminalKey -> coordKey

        const noteCoord = (coordKey, postId) => {
            if (!coordKey) return;
            if (!coordRepresentative.has(coordKey)) {
                coordRepresentative.set(coordKey, postId);
            } else {
                union(postId, coordRepresentative.get(coordKey));
            }
        };

        const registerTerminal = (componentId, terminalIndex, comp) => {
            const pos = resolveTerminalPosition(componentId, terminalIndex, comp);
            if (!pos) return;
            const coordKey = pointKey(pos);
            const postId = `T:${componentId}:${terminalIndex}`;
            parent.set(postId, postId);
            noteCoord(coordKey, postId);
            const tKey = `${componentId}:${terminalIndex}`;
            terminalCoordKey.set(tKey, coordKey);
            coordTerminalCount.set(coordKey, (coordTerminalCount.get(coordKey) || 0) + 1);
        };

        // Register all component terminals (even if isolated; we will later mark unconnected ones as -1).
        for (const [id, comp] of componentMap) {
            const terminalCount = getComponentTerminalCount(comp.type);
            for (let terminalIndex = 0; terminalIndex < terminalCount; terminalIndex++) {
                registerTerminal(id, terminalIndex, comp);
            }
        }

        const registerWireEndpoint = (wireId, which, pt) => {
            const coordKey = pointKey(pt);
            const postId = `W:${wireId}:${which}`;
            parent.set(postId, postId);
            noteCoord(coordKey, postId);
            coordWireEndpointCount.set(coordKey, (coordWireEndpointCount.get(coordKey) || 0) + 1);
            return postId;
        };

        // Register wire endpoints and union each wire's endpoints (ideal conductor).
        for (const wire of wireMap.values()) {
            const aPt = wire?.a;
            const bPt = wire?.b;
            if (!aPt || !bPt) continue;
            const aId = registerWireEndpoint(wire.id, 'a', aPt);
            const bId = registerWireEndpoint(wire.id, 'b', bPt);
            union(aId, bId);
        }

        // Build terminal "degree" map (junction degree at the coordinate point).
        const connectedTerminals = new Map();
        for (const [id, comp] of componentMap) {
            const terminalCount = getComponentTerminalCount(comp.type);
            for (let ti = 0; ti < terminalCount; ti++) {
                const tKey = `${id}:${ti}`;
                const coordKey = terminalCoordKey.get(tKey);
                const wireCount = coordWireEndpointCount.get(coordKey) || 0;
                const otherTerminalCount = Math.max(0, (coordTerminalCount.get(coordKey) || 0) - 1);
                const degree = wireCount + otherTerminalCount;
                if (degree > 0) connectedTerminals.set(tKey, degree);
            }
        }

        // Assign node indices to union roots that contain at least one connected component terminal.
        const nodeMap = new Map(); // root -> nodeIndex
        let nodeIndex = 0;

        const assignNodeIfNeeded = (root) => {
            if (!nodeMap.has(root)) nodeMap.set(root, nodeIndex++);
        };

        const getTerminalPostId = (componentId, terminalIndex) => `T:${componentId}:${terminalIndex}`;

        // Prefer explicit Ground terminal as reference node.
        let groundRoot = null;
        let fallbackGroundRoot = null;
        for (const [id, comp] of componentMap) {
            if (comp.type !== 'Ground') continue;
            const tKey = `${id}:0`;
            const postId = getTerminalPostId(id, 0);
            const root = find(postId);
            if (!fallbackGroundRoot) {
                fallbackGroundRoot = root;
            }
            if (connectedTerminals.has(tKey)) {
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        // Fallback: connected power source negative terminal.
        for (const [id, comp] of componentMap) {
            if (groundRoot) break;
            if (comp.type !== 'PowerSource') continue;
            const negKey = `${id}:1`;
            const negPostId = getTerminalPostId(id, 1);
            const root = find(negPostId);
            if (connectedTerminals.has(negKey)) {
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        // If no connected power negative terminal, pick the first connected terminal as ground.
        if (!groundRoot) {
            for (const tKey of connectedTerminals.keys()) {
                const [cid, tidxRaw] = tKey.split(':');
                const tidx = Number.parseInt(tidxRaw, 10);
                const root = find(getTerminalPostId(cid, tidx));
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        // If explicit Ground exists but is currently isolated, still use it as reference.
        if (!groundRoot && fallbackGroundRoot) {
            groundRoot = fallbackGroundRoot;
            assignNodeIfNeeded(groundRoot);
        }

        // If still none (completely disconnected layout), fall back to first power source negative terminal if any.
        if (!groundRoot) {
            for (const [id, comp] of componentMap) {
                if (comp.type !== 'PowerSource') continue;
                const negPostId = getTerminalPostId(id, 1);
                groundRoot = find(negPostId);
                assignNodeIfNeeded(groundRoot);
                break;
            }
        }

        // Assign remaining connected roots.
        for (const tKey of connectedTerminals.keys()) {
            const [cid, tidxRaw] = tKey.split(':');
            const tidx = Number.parseInt(tidxRaw, 10);
            const root = find(getTerminalPostId(cid, tidx));
            assignNodeIfNeeded(root);
        }

        // Update component node references. Unconnected terminals remain -1 to avoid phantom currents.
        for (const [id, comp] of componentMap) {
            const terminalCount = getComponentTerminalCount(comp.type);
            comp.nodes = Array.from({ length: terminalCount }, () => -1);
            for (let ti = 0; ti < terminalCount; ti++) {
                const tKey = `${id}:${ti}`;
                const connected = connectedTerminals.has(tKey);
                const postId = getTerminalPostId(id, ti);
                const root = find(postId);
                const mapped = nodeMap.has(root) ? nodeMap.get(root) : undefined;
                if ((connected || (groundRoot && root === groundRoot)) && mapped !== undefined) {
                    comp.nodes[ti] = mapped;
                }
            }
        }

        // Record which electrical node each wire belongs to (for short-circuit warnings / animations).
        for (const wire of wireMap.values()) {
            const aId = `W:${wire.id}:a`;
            if (!parent.has(aId)) {
                wire.nodeIndex = -1;
                continue;
            }
            const root = find(aId);
            wire.nodeIndex = nodeMap.has(root) ? nodeMap.get(root) : -1;
        }

        const nodes = Array.from({ length: nodeIndex }, (_, i) => ({ id: i }));
        return {
            nodes,
            terminalConnectionMap: connectedTerminals
        };
    }
}
