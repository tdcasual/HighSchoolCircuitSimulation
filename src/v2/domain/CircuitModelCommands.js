import { CircuitModel } from './CircuitModel.js';

function ensureModel(model) {
    return model instanceof CircuitModel ? model : CircuitModel.empty();
}

function normalizeEntity(entity, fallbackType, fallbackId) {
    const safeEntity = entity && typeof entity === 'object' ? entity : {};
    const type = typeof safeEntity.type === 'string' && safeEntity.type.trim() ? safeEntity.type : fallbackType;
    const hasId = safeEntity.id !== undefined
        && safeEntity.id !== null
        && (typeof safeEntity.id !== 'string' || safeEntity.id.trim());
    const id = hasId ? String(safeEntity.id) : fallbackId;
    return {
        ...safeEntity,
        id,
        type
    };
}

function wireReferencesComponent(wire, componentId) {
    if (!wire || typeof wire !== 'object') return false;
    const target = String(componentId);
    if (String(wire.aRef?.componentId) === target || String(wire.bRef?.componentId) === target) return true;
    if (String(wire.fromComponentId) === target || String(wire.toComponentId) === target) return true;
    return false;
}

export function addComponent(model, component) {
    const current = ensureModel(model);
    const components = current.cloneComponentsMap();
    const normalized = normalizeEntity(component, 'Unknown', `Unknown_${components.size}`);
    components.set(normalized.id, normalized);
    return current.withState({
        components,
        version: current.version + 1
    });
}

export function removeComponent(model, componentId) {
    const current = ensureModel(model);
    const normalizedId = String(componentId);
    const components = current.cloneComponentsMap();
    const wires = current.cloneWiresMap();
    components.delete(normalizedId);
    for (const [wireId, wire] of wires.entries()) {
        if (wireReferencesComponent(wire, normalizedId)) {
            wires.delete(wireId);
        }
    }
    return current.withState({
        components,
        wires,
        version: current.version + 1
    });
}

export function addWire(model, wire) {
    const current = ensureModel(model);
    const wires = current.cloneWiresMap();
    const normalized = normalizeEntity(wire, 'Wire', `Wire_${wires.size}`);
    wires.set(normalized.id, normalized);
    return current.withState({
        wires,
        version: current.version + 1
    });
}

export function removeWire(model, wireId) {
    const current = ensureModel(model);
    const wires = current.cloneWiresMap();
    wires.delete(String(wireId));
    return current.withState({
        wires,
        version: current.version + 1
    });
}
