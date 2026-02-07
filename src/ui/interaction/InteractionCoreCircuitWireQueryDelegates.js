import { installInteractionCoreCircuitSnapDelegates } from './InteractionCoreCircuitSnapDelegates.js';
import { installInteractionCoreCircuitWireSearchDelegates } from './InteractionCoreCircuitWireSearchDelegates.js';
import { installInteractionCoreCircuitWireSplitDelegates } from './InteractionCoreCircuitWireSplitDelegates.js';

export function installInteractionCoreCircuitWireQueryDelegates(InteractionManagerClass) {
    installInteractionCoreCircuitSnapDelegates(InteractionManagerClass);
    installInteractionCoreCircuitWireSearchDelegates(InteractionManagerClass);
    installInteractionCoreCircuitWireSplitDelegates(InteractionManagerClass);
}
