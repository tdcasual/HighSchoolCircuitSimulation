import { installInteractionCorePanelSelectionDelegates } from './InteractionCorePanelSelectionDelegates.js';
import { installInteractionCorePanelPropertyDelegates } from './InteractionCorePanelPropertyDelegates.js';
import { installInteractionCorePanelReadoutDelegates } from './InteractionCorePanelReadoutDelegates.js';

export function installInteractionCorePanelDelegates(InteractionManagerClass) {
    installInteractionCorePanelSelectionDelegates(InteractionManagerClass);
    installInteractionCorePanelPropertyDelegates(InteractionManagerClass);
    installInteractionCorePanelReadoutDelegates(InteractionManagerClass);
}
