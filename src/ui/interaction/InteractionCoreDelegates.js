import { installInteractionCoreInputDelegates } from './InteractionCoreInputDelegates.js';
import { installInteractionCoreCircuitDelegates } from './InteractionCoreCircuitDelegates.js';
import { installInteractionCorePanelDelegates } from './InteractionCorePanelDelegates.js';

export function installInteractionCoreDelegates(InteractionManagerClass) {
    installInteractionCoreInputDelegates(InteractionManagerClass);
    installInteractionCoreCircuitDelegates(InteractionManagerClass);
    installInteractionCorePanelDelegates(InteractionManagerClass);
}
