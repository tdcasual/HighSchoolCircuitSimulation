import { getComponentTerminalCount } from '../../components/Component.js';
import { buildElectricalNodes } from '../../utils/buildElectricalNodes.js';

export class NodeBuilder {
    build({ components, wires, getTerminalWorldPosition } = {}) {
        return buildElectricalNodes({
            components,
            wires,
            getTerminalCount: getComponentTerminalCount,
            resolveTerminalPosition: typeof getTerminalWorldPosition === 'function'
                ? getTerminalWorldPosition
                : () => null,
            writeWireNodeIndex: true
        });
    }
}
