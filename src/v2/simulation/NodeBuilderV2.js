/**
 * Union-find topology for V2 netlists. Shares buildElectricalNodes with live NodeBuilder.
 */
import { normalizeCanvasPoint } from '../../utils/CanvasCoords.js';
import { getTerminalWorldPosition as getTerminalWorldPositionFromGeometry } from '../../utils/TerminalGeometry.js';
import { buildElectricalNodes } from '../../utils/buildElectricalNodes.js';
import { getComponentDefinition } from '../infra/components/ComponentDefinitionRegistry.js';

function defaultTerminalCount(type) {
    const definition = getComponentDefinition(type);
    const count = Number(definition?.terminalCount);
    return Number.isInteger(count) && count > 0 ? count : 2;
}

export class NodeBuilderV2 {
    build({ components, wires, getTerminalWorldPosition } = {}) {
        const resolveTerminalPosition = (componentId, terminalIndex, comp) => {
            const raw = typeof getTerminalWorldPosition === 'function'
                ? getTerminalWorldPosition(componentId, terminalIndex, comp)
                : getTerminalWorldPositionFromGeometry(comp, terminalIndex);
            return normalizeCanvasPoint(raw);
        };
        return buildElectricalNodes({
            components,
            wires,
            getTerminalCount: defaultTerminalCount,
            resolveTerminalPosition,
            normalizePoint: normalizeCanvasPoint,
            writeWireNodeIndex: false
        });
    }
}
