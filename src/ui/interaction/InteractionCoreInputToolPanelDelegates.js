import { installInteractionCoreInputToolboxDelegates } from './InteractionCoreInputToolboxDelegates.js';
import { installInteractionCoreInputPlacementDelegates } from './InteractionCoreInputPlacementDelegates.js';
import { installInteractionCoreInputPanelStateDelegates } from './InteractionCoreInputPanelStateDelegates.js';

export function installInteractionCoreInputToolPanelDelegates(InteractionManagerClass) {
    installInteractionCoreInputToolboxDelegates(InteractionManagerClass);
    installInteractionCoreInputPlacementDelegates(InteractionManagerClass);
    installInteractionCoreInputPanelStateDelegates(InteractionManagerClass);
}
