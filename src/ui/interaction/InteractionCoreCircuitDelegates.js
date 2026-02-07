import { installInteractionCoreCircuitActionDelegates } from './InteractionCoreCircuitActionDelegates.js';
import { installInteractionCoreCircuitWireDelegates } from './InteractionCoreCircuitWireDelegates.js';
import { installInteractionCoreCircuitDragDelegates } from './InteractionCoreCircuitDragDelegates.js';

export function installInteractionCoreCircuitDelegates(InteractionManagerClass) {
    installInteractionCoreCircuitActionDelegates(InteractionManagerClass);
    installInteractionCoreCircuitWireDelegates(InteractionManagerClass);
    installInteractionCoreCircuitDragDelegates(InteractionManagerClass);
}
