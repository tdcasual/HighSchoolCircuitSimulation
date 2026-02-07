import { getComponentTerminalCount } from '../../components/Component.js';
import { getTerminalWorldPosition } from '../../utils/TerminalGeometry.js';
import { normalizeCanvasPoint, pointKey, toCanvasInt } from '../../utils/CanvasCoords.js';

export class WireCompactor {
    compact({ components, wires, scopeWireIds = null, syncWireEndpointsToTerminalRefs = null } = {}) {
        const componentMap = components instanceof Map ? components : new Map();
        const wireMap = wires instanceof Map ? wires : new Map();
        if (typeof syncWireEndpointsToTerminalRefs === 'function') {
            syncWireEndpointsToTerminalRefs();
        }
        const scoped = scopeWireIds
            ? new Set(Array.from(scopeWireIds).filter(Boolean))
            : null;

        const removedIds = [];
        const replacementByRemovedId = {};
        let changed = false;

        const setEndpoint = (wire, end, point, ref) => {
            if (!wire || (end !== 'a' && end !== 'b') || !point) return;
            wire[end] = {
                x: toCanvasInt(point.x),
                y: toCanvasInt(point.y)
            };
            const refKey = end === 'a' ? 'aRef' : 'bRef';
            if (ref && ref.componentId !== undefined && Number.isInteger(ref.terminalIndex)) {
                wire[refKey] = {
                    componentId: ref.componentId,
                    terminalIndex: ref.terminalIndex
                };
            } else {
                delete wire[refKey];
            }
        };

        const removeWireById = (wireId) => {
            if (!wireMap.has(wireId)) return;
            wireMap.delete(wireId);
            removedIds.push(wireId);
            changed = true;
        };

        // 先清理零长度导线，避免后续拓扑分析被噪声干扰。
        for (const [wireId, wire] of Array.from(wireMap.entries())) {
            if (scoped && !scoped.has(wireId)) continue;
            const a = normalizeCanvasPoint(wire?.a);
            const b = normalizeCanvasPoint(wire?.b);
            if (!a || !b) {
                removeWireById(wireId);
                continue;
            }
            wire.a = a;
            wire.b = b;
            if (a.x === b.x && a.y === b.y) {
                removeWireById(wireId);
            }
        }

        const terminalCoordKeys = new Set();
        for (const [, comp] of componentMap) {
            const terminalCount = getComponentTerminalCount(comp.type);
            for (let terminalIndex = 0; terminalIndex < terminalCount; terminalIndex++) {
                const pos = getTerminalWorldPosition(comp, terminalIndex);
                const key = pointKey(pos);
                if (!key) continue;
                terminalCoordKeys.add(key);
            }
        }

        const getOtherEnd = (wire, end) => {
            if (end === 'a') {
                return { end: 'b', point: wire?.b, ref: wire?.bRef };
            }
            return { end: 'a', point: wire?.a, ref: wire?.aRef };
        };

        const isCollinearAndOpposite = (shared, p1, p2) => {
            const v1x = p1.x - shared.x;
            const v1y = p1.y - shared.y;
            const v2x = p2.x - shared.x;
            const v2y = p2.y - shared.y;
            const cross = v1x * v2y - v1y * v2x;
            if (Math.abs(cross) > 1e-6) return false;
            const dot = v1x * v2x + v1y * v2y;
            return dot < 0;
        };

        let mergedInPass = true;
        while (mergedInPass) {
            mergedInPass = false;

            const endpointBuckets = new Map(); // coordKey -> [{wireId,end,point}]
            for (const [wireId, wire] of wireMap.entries()) {
                for (const end of ['a', 'b']) {
                    const pt = normalizeCanvasPoint(wire?.[end]);
                    if (!pt) continue;
                    const key = pointKey(pt);
                    if (!key) continue;
                    if (!endpointBuckets.has(key)) endpointBuckets.set(key, []);
                    endpointBuckets.get(key).push({ wireId, end, point: pt });
                }
            }

            for (const [coordKey, endpoints] of endpointBuckets.entries()) {
                if (!Array.isArray(endpoints) || endpoints.length !== 2) continue;
                if (terminalCoordKeys.has(coordKey)) continue;

                const first = endpoints[0];
                const second = endpoints[1];
                if (!first || !second) continue;
                if (first.wireId === second.wireId) continue;
                if (scoped && !scoped.has(first.wireId) && !scoped.has(second.wireId)) continue;

                const wireA = wireMap.get(first.wireId);
                const wireB = wireMap.get(second.wireId);
                if (!wireA || !wireB) continue;

                const sharedRefKeyA = first.end === 'a' ? 'aRef' : 'bRef';
                const sharedRefKeyB = second.end === 'a' ? 'aRef' : 'bRef';
                if (wireA[sharedRefKeyA] || wireB[sharedRefKeyB]) continue;

                const otherA = getOtherEnd(wireA, first.end);
                const otherB = getOtherEnd(wireB, second.end);
                const pA = normalizeCanvasPoint(otherA.point);
                const pB = normalizeCanvasPoint(otherB.point);
                if (!pA || !pB) continue;

                const shared = first.point;
                const keyA = pointKey(pA);
                const keyB = pointKey(pB);

                if (keyA && keyB && keyA === keyB) {
                    const refsConflict = otherA.ref && otherB.ref
                        && (
                            otherA.ref.componentId !== otherB.ref.componentId
                            || otherA.ref.terminalIndex !== otherB.ref.terminalIndex
                        );
                    if (refsConflict) continue;
                    const mergedRef = otherA.ref || otherB.ref || null;
                    setEndpoint(wireA, otherA.end, pA, mergedRef);
                    removeWireById(wireB.id);
                    replacementByRemovedId[wireB.id] = wireA.id;
                    mergedInPass = true;
                    break;
                }

                if (!isCollinearAndOpposite(shared, pA, pB)) continue;

                setEndpoint(wireA, 'a', pA, otherA.ref);
                setEndpoint(wireA, 'b', pB, otherB.ref);
                removeWireById(wireB.id);
                replacementByRemovedId[wireB.id] = wireA.id;
                mergedInPass = true;
                break;
            }
        }

        return { changed, removedIds, replacementByRemovedId };
    }
}
