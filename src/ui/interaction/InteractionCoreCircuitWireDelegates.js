import { installInteractionCoreCircuitWiringDelegates } from './InteractionCoreCircuitWiringDelegates.js';
import { installInteractionCoreCircuitWireCompactionDelegates } from './InteractionCoreCircuitWireCompactionDelegates.js';
import { installInteractionCoreCircuitWireQueryDelegates } from './InteractionCoreCircuitWireQueryDelegates.js';

export function installInteractionCoreCircuitWireDelegates(InteractionManagerClass) {
    installInteractionCoreCircuitWiringDelegates(InteractionManagerClass);
    installInteractionCoreCircuitWireCompactionDelegates(InteractionManagerClass);
    installInteractionCoreCircuitWireQueryDelegates(InteractionManagerClass);
}
