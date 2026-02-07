import { installInteractionCoreCircuitWiringFlowDelegates } from './InteractionCoreCircuitWiringFlowDelegates.js';
import { installInteractionCoreCircuitWireDragDelegates } from './InteractionCoreCircuitWireDragDelegates.js';

export function installInteractionCoreCircuitWiringDelegates(InteractionManagerClass) {
    installInteractionCoreCircuitWiringFlowDelegates(InteractionManagerClass);
    installInteractionCoreCircuitWireDragDelegates(InteractionManagerClass);
}
