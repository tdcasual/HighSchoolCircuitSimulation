/**
 * @internal experimental
 * Union-find topology for V2 netlists. Live node SOT remains production NodeBuilder.
 */
import { normalizeCanvasPoint, pointKey } from '../../utils/CanvasCoords.js';
import { getTerminalWorldPosition as getTerminalWorldPositionFromGeometry } from '../../utils/TerminalGeometry.js';
import { getComponentDefinition } from '../infra/components/ComponentDefinitionRegistry.js';

function defaultTerminalCount(type) {
    const definition = getComponentDefinition(type);
    const count = Number(definition?.terminalCount);
    return Number.isInteger(count) && count > 0 ? count : 2;
}

function toMap(collection) {
    if (collection instanceof Map) return collection;
    const map = new Map();
    if (!collection) return map;
    const values = Array.isArray(collection) ? collection : [];
    for (const item of values) {
        if (!item || item.id === undefined || item.id === null) continue;
        if (typeof item.id === 'string' && !item.id.trim()) continue;
        map.set(item.id, item);
    }
    return map;
}

export class NodeBuilderV2 {
    build({ components, wires, getTerminalWorldPosition, getTerminalCount } = {}) {
        const componentMap = toMap(components);
        const wireMap = toMap(wires);
        const resolveTerminalCount = typeof getTerminalCount === 'function'
            ? getTerminalCount
            : defaultTerminalCount;

        const resolveTerminalPosition = (componentId, terminalIndex, comp) => {
            const raw = typeof getTerminalWorldPosition === 'function'
                ? getTerminalWorldPosition(componentId, terminalIndex, comp)
                : getTerminalWorldPositionFromGeometry(comp, terminalIndex);
            // Snapshots may skip Circuit.addWire; non-integers make pointKey return null.
            return normalizeCanvasPoint(raw);
        };

        const parent = new Map();

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

        const coordRepresentative = new Map();
        const coordTerminalCount = new Map();
        const coordWireEndpointCount = new Map();
        const terminalCoordKey = new Map();

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

        for (const [id, comp] of componentMap) {
            const terminalCount = resolveTerminalCount(comp.type);
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

        for (const wire of wireMap.values()) {
            const aPt = normalizeCanvasPoint(wire?.a);
            const bPt = normalizeCanvasPoint(wire?.b);
            if (!aPt || !bPt) continue;
            const aId = registerWireEndpoint(wire.id, 'a', aPt);
            const bId = registerWireEndpoint(wire.id, 'b', bPt);
            union(aId, bId);
        }

        const connectedTerminals = new Map();
        for (const [id, comp] of componentMap) {
            const terminalCount = resolveTerminalCount(comp.type);
            for (let ti = 0; ti < terminalCount; ti++) {
                const tKey = `${id}:${ti}`;
                const coordKey = terminalCoordKey.get(tKey);
                const wireCount = coordWireEndpointCount.get(coordKey) || 0;
                const otherTerminalCount = Math.max(0, (coordTerminalCount.get(coordKey) || 0) - 1);
                const degree = wireCount + otherTerminalCount;
                if (degree > 0) connectedTerminals.set(tKey, degree);
            }
        }

        const nodeMap = new Map();
        let nodeIndex = 0;

        const assignNodeIfNeeded = (root) => {
            if (!nodeMap.has(root)) nodeMap.set(root, nodeIndex++);
        };

        const getTerminalPostId = (componentId, terminalIndex) => `T:${componentId}:${terminalIndex}`;

        let firstGroundPostId = null;
        for (const [id, comp] of componentMap) {
            if (comp.type !== 'Ground') continue;
            const postId = getTerminalPostId(id, 0);
            if (!parent.has(postId)) parent.set(postId, postId);
            if (!firstGroundPostId) {
                firstGroundPostId = postId;
            } else {
                union(postId, firstGroundPostId);
            }
        }

        let groundRoot = null;
        let fallbackGroundRoot = firstGroundPostId ? find(firstGroundPostId) : null;
        for (const [id, comp] of componentMap) {
            if (comp.type !== 'Ground') continue;
            const tKey = `${id}:0`;
            const postId = getTerminalPostId(id, 0);
            const root = find(postId);
            if (connectedTerminals.has(tKey)) {
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        for (const [id, comp] of componentMap) {
            if (groundRoot) break;
            if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
            const negKey = `${id}:1`;
            const negPostId = getTerminalPostId(id, 1);
            const root = find(negPostId);
            if (connectedTerminals.has(negKey)) {
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

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

        if (!groundRoot && fallbackGroundRoot) {
            groundRoot = fallbackGroundRoot;
            assignNodeIfNeeded(groundRoot);
        }

        if (!groundRoot) {
            for (const [id, comp] of componentMap) {
                if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
                const negPostId = getTerminalPostId(id, 1);
                groundRoot = find(negPostId);
                assignNodeIfNeeded(groundRoot);
                break;
            }
        }

        for (const tKey of connectedTerminals.keys()) {
            const [cid, tidxRaw] = tKey.split(':');
            const tidx = Number.parseInt(tidxRaw, 10);
            const root = find(getTerminalPostId(cid, tidx));
            assignNodeIfNeeded(root);
        }

        const componentNodes = new Map();
        for (const [id, comp] of componentMap) {
            const terminalCount = resolveTerminalCount(comp.type);
            const nodes = Array.from({ length: terminalCount }, () => -1);
            for (let ti = 0; ti < terminalCount; ti++) {
                const tKey = `${id}:${ti}`;
                const connected = connectedTerminals.has(tKey);
                const postId = getTerminalPostId(id, ti);
                const root = find(postId);
                const mapped = nodeMap.has(root) ? nodeMap.get(root) : undefined;
                if ((connected || (groundRoot && root === groundRoot)) && mapped !== undefined) {
                    nodes[ti] = mapped;
                }
            }
            componentNodes.set(id, nodes);
            // Working copies only; caller must not pass live Circuit maps.
            comp.nodes = nodes;
        }

        const wireNodeIndex = new Map();
        for (const wire of wireMap.values()) {
            const aId = `W:${wire.id}:a`;
            if (!parent.has(aId)) {
                wire.nodeIndex = -1;
                wireNodeIndex.set(wire.id, -1);
                continue;
            }
            const root = find(aId);
            const mapped = nodeMap.has(root) ? nodeMap.get(root) : -1;
            wire.nodeIndex = mapped;
            wireNodeIndex.set(wire.id, mapped);
        }

        const nodes = Array.from({ length: nodeIndex }, (_, i) => ({ id: i }));
        return {
            nodes,
            terminalConnectionMap: connectedTerminals,
            componentNodes,
            wireNodeIndex
        };
    }
}
